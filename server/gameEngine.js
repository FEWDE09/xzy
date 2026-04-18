import { v4 as uuidv4 } from 'uuid';
import { Keypair } from '@stellar/stellar-sdk';
import {
  BOARD,
  BOARD_SIZE,
  CELL_TYPES,
  GO_REWARD_XLM,
  JAIL_POSITION,
  RAILROAD_RENTS,
  getCell,
} from './board.js';
import { sendTreasuryPayment } from './stellar.js';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const BOT_NAMES = [
  'CPU · Orion',
  'CPU · Vega',
  'CPU · Nova',
  'CPU · Lyra',
  'CPU · Sol',
];

function rollDice() {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return { d1, d2, total: d1 + d2 };
}

const CHANCE_CARDS = [
  { text: 'Advance to GO — collect salary (on-chain).', effect: 'advance_go' },
  { text: 'Bank pays you dividend — gain 50 XLM.', effect: 'gain', amount: 50 },
  { text: 'Speeding fine — pay 50 XLM.', effect: 'pay_tax', amount: 50 },
  { text: 'Trip to nearest Railroad — pay owner 2× rent (demo: move 5).', effect: 'move', spaces: 5 },
  { text: 'Building loan matures — collect 75 XLM.', effect: 'gain', amount: 75 },
  { text: 'General repairs — pay 60 XLM.', effect: 'pay_tax', amount: 60 },
  { text: 'Go back 3 spaces.', effect: 'move', spaces: -3 },
  { text: 'Go to Jail — do not pass GO.', effect: 'go_jail' },
];

const COMMUNITY_CARDS = [
  { text: 'Advance to GO — collect salary (on-chain).', effect: 'advance_go' },
  { text: 'Bank error in your favor — collect 100 XLM.', effect: 'gain', amount: 100 },
  { text: "Doctor's fee — pay 50 XLM.", effect: 'pay_tax', amount: 50 },
  { text: 'Income tax refund — collect 20 XLM.', effect: 'gain', amount: 20 },
  { text: 'School tax — pay 50 XLM.', effect: 'pay_tax', amount: 50 },
  { text: 'You inherit orbit shares — collect 50 XLM.', effect: 'gain', amount: 50 },
  { text: 'Go to Jail.', effect: 'go_jail' },
];

function randomChance() {
  return CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
}

function randomCommunity() {
  return COMMUNITY_CARDS[Math.floor(Math.random() * COMMUNITY_CARDS.length)];
}

function cellsOwnedBy(room, playerId) {
  return Object.entries(room.ownership)
    .filter(([, pid]) => pid === playerId)
    .map(([cid]) => Number(cid));
}

function countRailroads(room, playerId) {
  return cellsOwnedBy(room, playerId).filter((cid) => getCell(cid).type === CELL_TYPES.RAILROAD).length;
}

function countUtilities(room, playerId) {
  return cellsOwnedBy(room, playerId).filter((cid) => getCell(cid).type === CELL_TYPES.UTILITY).length;
}

function hasMonopolyOnGroup(room, landlordId, group) {
  if (!group) return false;
  const cellsInGroup = BOARD.filter((c) => c.group === group);
  if (!cellsInGroup.length) return false;
  return cellsInGroup.every((c) => room.ownership[c.id] === landlordId);
}

function computeRent(room, cell, tenantId) {
  const landlordId = room.ownership[cell.id];
  if (!landlordId || landlordId === tenantId) return 0;

  if (cell.type === CELL_TYPES.PROPERTY) {
    const base = cell.rent ?? 0;
    return hasMonopolyOnGroup(room, landlordId, cell.group) ? base * 2 : base;
  }
  if (cell.type === CELL_TYPES.RAILROAD) {
    const n = Math.min(4, Math.max(0, countRailroads(room, landlordId)));
    return RAILROAD_RENTS[n];
  }
  if (cell.type === CELL_TYPES.UTILITY) {
    const dice = room.lastDice?.total ?? 0;
    const u = countUtilities(room, landlordId);
    if (u === 1) return dice * 4;
    if (u >= 2) return dice * 10;
    return 0;
  }
  return 0;
}

function isPurchasable(cell) {
  return (
    cell.type === CELL_TYPES.PROPERTY ||
    cell.type === CELL_TYPES.RAILROAD ||
    cell.type === CELL_TYPES.UTILITY
  );
}

export function createRoom(hostSocketId, hostName, publicKey) {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  const hostId = uuidv4();
  const player = {
    id: hostId,
    name: hostName,
    publicKey,
    position: 0,
    inJail: false,
    properties: [],
    socketId: hostSocketId,
    disconnected: false,
    isSpectator: false,
    isBot: false,
  };
  return {
    id: roomId,
    hostId,
    players: [player],
    spectators: [],
    phase: 'lobby',
    turnIndex: 0,
    pending: null,
    diceRolled: false,
    lastDice: null,
    lastChance: null,
    ownership: {},
    winnerId: null,
    movementPath: null,
    passGoPending: null,
    createdAt: Date.now(),
  };
}

export function addPlayer(room, socketId, name, publicKey) {
  if (room.players.length >= MAX_PLAYERS) return { error: 'Room is full' };
  if (room.phase !== 'lobby') return { error: 'Game already started' };
  if (room.players.some((p) => p.publicKey === publicKey)) {
    return { error: 'Wallet already in room' };
  }
  const id = uuidv4();
  room.players.push({
    id,
    name,
    publicKey,
    position: 0,
    inJail: false,
    properties: [],
    socketId,
    disconnected: false,
    isSpectator: false,
    isBot: false,
  });
  return { playerId: id };
}

export function addBotPlayer(room) {
  if (room.players.length >= MAX_PLAYERS) return { error: 'Room is full' };
  if (room.phase !== 'lobby') return { error: 'Game already started' };
  const id = uuidv4();
  const kp = Keypair.random();
  const usedNames = new Set(room.players.map((p) => p.name));
  let name = BOT_NAMES.find((n) => !usedNames.has(n));
  if (!name) name = `CPU · ${id.slice(0, 4)}`;
  room.players.push({
    id,
    name,
    publicKey: kp.publicKey(),
    position: 0,
    inJail: false,
    properties: [],
    socketId: null,
    disconnected: false,
    isSpectator: false,
    isBot: true,
  });
  return { playerId: id };
}

export function addSpectator(room, socketId, name) {
  const id = uuidv4();
  room.spectators.push({
    id,
    name: name || 'Spectator',
    socketId,
    isSpectator: true,
  });
  return { spectatorId: id };
}

export function findPlayer(room, playerId) {
  return room.players.find((p) => p.id === playerId);
}

export function currentPlayer(room) {
  if (!room.players.length) return null;
  return room.players[room.turnIndex % room.players.length];
}

export function startGame(room) {
  const humans = room.players.filter((p) => !p.isBot);
  if (humans.length < 1) {
    return { error: 'Need at least one human player' };
  }
  if (room.players.length < MIN_PLAYERS) {
    return { error: `Need at least ${MIN_PLAYERS} players — invite a friend or add CPU opponents` };
  }
  room.phase = 'playing';
  room.turnIndex = 0;
  room.pending = null;
  room.diceRolled = false;
  room.ownership = {};
  room.players.forEach((p) => {
    p.position = 0;
    p.inJail = false;
    p.properties = [];
  });
  return { ok: true };
}

export function rollDiceAction(room, playerId) {
  if (room.phase !== 'playing') return { error: 'Not in game' };
  const cp = currentPlayer(room);
  if (!cp || cp.id !== playerId) return { error: 'Not your turn' };
  if (room.diceRolled) return { error: 'Already rolled' };
  if (room.pending && room.pending.kind !== 'chance_followup') {
    return { error: 'Resolve pending action first' };
  }

  const dice = rollDice();
  room.lastDice = dice;
  room.diceRolled = true;

  const fromPos = cp.position;
  const path = [];
  let pos = fromPos;
  for (let i = 0; i < dice.total; i++) {
    pos = (pos + 1) % BOARD_SIZE;
    path.push(pos);
  }

  const passedGo = fromPos + dice.total >= BOARD_SIZE;
  cp.position = path[path.length - 1];
  room.movementPath = { playerId, path, from: fromPos };

  const cell = getCell(cp.position);
  if (passedGo) {
    room.resumeAfterPassGo = cell;
    room.pending = {
      kind: 'pass_go_reward',
      playerId: cp.id,
      amount: GO_REWARD_XLM,
    };
    return { dice: room.lastDice, landed: cell, action: 'pass_go_reward' };
  }
  return resolveLanding(room, cp, cell);
}

function ownerOf(room, cellId) {
  return room.ownership[cellId] || null;
}

function resolveLanding(room, player, cell) {
  room.pending = null;
  room.lastChance = null;

  if (cell.type === CELL_TYPES.GO_TO_JAIL) {
    player.position = JAIL_POSITION;
    player.inJail = true;
    room.pending = { kind: 'message', text: `${player.name} — Go to Jail.` };
    return { dice: room.lastDice, landed: cell, action: 'jail' };
  }

  if (cell.type === CELL_TYPES.JAIL) {
    room.pending = {
      kind: 'message',
      text: `${player.name} is just visiting Jail.`,
    };
    return { dice: room.lastDice, landed: cell, action: 'idle' };
  }

  if (cell.type === CELL_TYPES.PARKING) {
    room.pending = {
      kind: 'message',
      text: 'Free Parking — relax (no jackpot in this build).',
    };
    return { dice: room.lastDice, landed: cell, action: 'idle' };
  }

  if (cell.type === CELL_TYPES.GO) {
    room.pending = { kind: 'message', text: 'Landed on GO.' };
    return { dice: room.lastDice, landed: cell, action: 'idle' };
  }

  if (cell.type === CELL_TYPES.CHANCE) {
    return applyDeckCard(room, player, randomChance(), 'chance');
  }

  if (cell.type === CELL_TYPES.COMMUNITY) {
    return applyDeckCard(room, player, randomCommunity(), 'community');
  }

  if (cell.type === CELL_TYPES.TAX) {
    room.pending = {
      kind: 'pay_tax',
      cellId: cell.id,
      playerId: player.id,
      amount: cell.taxAmount,
    };
    return { dice: room.lastDice, landed: cell, action: 'pay_tax' };
  }

  if (isPurchasable(cell)) {
    const owner = ownerOf(room, cell.id);
    if (!owner) {
      const listedRent =
        cell.type === CELL_TYPES.UTILITY
          ? 0
          : cell.type === CELL_TYPES.RAILROAD
            ? RAILROAD_RENTS[1]
            : cell.rent ?? 0;
      const rentNote =
        cell.type === CELL_TYPES.UTILITY
          ? 'Rent = 4× dice (one utility) or 10× dice (both utilities).'
          : cell.type === CELL_TYPES.RAILROAD
            ? 'Railroad rent: 20 / 40 / 80 / 160 XLM for 1–4 railroads owned.'
            : 'Rent doubles on a color group when the owner holds every street of that color.';
      room.pending = {
        kind: 'buy_offer',
        cellId: cell.id,
        playerId: player.id,
        price: cell.price,
        rent: listedRent,
        rentNote,
      };
      return { dice: room.lastDice, landed: cell, action: 'buy_offer' };
    }
    if (owner !== player.id) {
      const amount = computeRent(room, cell, player.id);
      const landlord = room.players.find((p) => p.id === owner);
      const landlordIsBot = Boolean(landlord?.isBot);
      room.pending = {
        kind: 'pay_rent',
        cellId: cell.id,
        payerId: player.id,
        payeeId: owner,
        payeeKey: landlord?.publicKey,
        amount,
        landlordIsBot,
      };
      return { dice: room.lastDice, landed: cell, action: 'pay_rent' };
    }
  }

  room.pending = { kind: 'message', text: 'Nothing to do here. End turn when ready.' };
  return { dice: room.lastDice, landed: cell, action: 'idle' };
}

/** @param {'chance' | 'community'} deck */
function applyDeckCard(room, player, card, deck) {
  room.pending = null;
  room.lastChance = { text: card.text, effect: card.effect, deck };

  const label = deck === 'chance' ? 'Chance' : 'Community Chest';

  switch (card.effect) {
    case 'advance_go':
      player.position = 0;
      room.resumeAfterPassGo = getCell(0);
      room.pending = {
        kind: 'pass_go_reward',
        playerId: player.id,
        amount: GO_REWARD_XLM,
      };
      break;
    case 'pay_tax':
      room.pending = {
        kind: 'pay_tax',
        cellId: -1,
        playerId: player.id,
        amount: card.amount,
        label: `${label} card`,
      };
      break;
    case 'gain':
      room.pending = {
        kind: 'chance_gain',
        playerId: player.id,
        amount: card.amount,
        memo: `SM-${deck === 'chance' ? 'CH' : 'CC'}-${room.id}-${player.id.slice(0, 8)}`,
      };
      break;
    case 'move': {
      const delta = card.spaces ?? 0;
      const old = player.position;
      player.position = (player.position + delta + BOARD_SIZE * 20) % BOARD_SIZE;
      if (delta > 0 && old + delta >= BOARD_SIZE) {
        room.resumeAfterPassGo = getCell(player.position);
        room.pending = {
          kind: 'pass_go_reward',
          playerId: player.id,
          amount: GO_REWARD_XLM,
        };
        return {
          dice: room.lastDice,
          landed: getCell(player.position),
          action: 'pass_go_reward',
        };
      }
      return resolveLanding(room, player, getCell(player.position));
    }
    case 'go_jail':
      player.position = JAIL_POSITION;
      player.inJail = true;
      room.pending = { kind: 'message', text: `${player.name} goes to Jail.` };
      break;
    default:
      room.pending = { kind: 'message', text: card.text };
  }
  return {
    dice: room.lastDice,
    landed: getCell(player.position),
    action: deck === 'chance' ? 'chance' : 'community',
    card,
  };
}

export function declineBuy(room, playerId) {
  const p = room.pending;
  if (!p || p.kind !== 'buy_offer' || p.playerId !== playerId) {
    return { error: 'Invalid decline' };
  }
  room.pending = {
    kind: 'message',
    text: 'Declined — property stays with the bank (auction not implemented).',
  };
  return { ok: true };
}

export function confirmBuyAfterTx(room, playerId, cellId) {
  const p = room.pending;
  if (!p || p.kind !== 'buy_offer' || p.playerId !== playerId || p.cellId !== cellId) {
    return { error: 'No pending purchase' };
  }
  const pl = findPlayer(room, playerId);
  if (!pl) return { error: 'Player missing' };
  room.ownership[cellId] = playerId;
  if (!pl.properties.includes(cellId)) pl.properties.push(cellId);
  room.pending = { kind: 'message', text: `${pl.name} acquired ${getCell(cellId).name}!` };
  return { ok: true };
}

export function confirmRentAfterTx(room, payerId) {
  const p = room.pending;
  if (!p || p.kind !== 'pay_rent' || p.payerId !== payerId) return { error: 'Invalid rent confirm' };
  room.pending = { kind: 'message', text: 'Rent paid.' };
  return { ok: true };
}

export function confirmTaxAfterTx(room, playerId) {
  const p = room.pending;
  if (!p || p.kind !== 'pay_tax' || p.playerId !== playerId) return { error: 'Invalid tax' };
  room.pending = { kind: 'message', text: 'Tax settled.' };
  return { ok: true };
}

export function endTurn(room, playerId) {
  if (room.phase !== 'playing') return { error: 'Not playing' };
  const cp = currentPlayer(room);
  if (!cp || cp.id !== playerId) return { error: 'Not your turn' };
  if (!room.diceRolled) return { error: 'Roll first' };
  if (
    room.pending &&
    ['buy_offer', 'pay_rent', 'pay_tax', 'pass_go_reward', 'chance_gain'].includes(room.pending.kind)
  ) {
    return { error: 'Complete pending payment or action' };
  }

  room.turnIndex = (room.turnIndex + 1) % room.players.length;
  room.diceRolled = false;
  room.lastDice = null;
  room.pending = null;
  room.resumeAfterPassGo = undefined;
  room.movementPath = null;
  return { ok: true };
}

export function getPublicState(room) {
  return {
    id: room.id,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      publicKey: p.publicKey,
      position: p.position,
      inJail: p.inJail,
      properties: p.properties,
      disconnected: p.disconnected,
      isBot: Boolean(p.isBot),
    })),
    spectators: room.spectators.map((s) => ({ id: s.id, name: s.name })),
    turnIndex: room.turnIndex,
    currentPlayerId: currentPlayer(room)?.id,
    pending: room.pending,
    lastDice: room.lastDice,
    lastChance: room.lastChance,
    ownership: { ...room.ownership },
    diceRolled: room.diceRolled,
    board: BOARD,
    movementPath: room.movementPath,
    winnerId: room.winnerId,
  };
}

export async function fulfillChanceGain(room, playerId) {
  const p = room.pending;
  if (!p || p.kind !== 'chance_gain' || p.playerId !== playerId) {
    return { error: 'No chance gain pending' };
  }
  const pl = findPlayer(room, playerId);
  if (!pl) return { error: 'Player missing' };
  const res = await sendTreasuryPayment(pl.publicKey, p.amount, p.memo || '');
  if (!res.ok) {
    room.pending = {
      kind: 'message',
      text: `Chance reward skipped (${res.error}).`,
    };
    return { ok: true, demo: true };
  }
  room.pending = { kind: 'message', text: `Chance: +${p.amount} XLM (tx ${res.hash}).` };
  return { ok: true, hash: res.hash };
}

export function skipPassGoReward(room, playerId) {
  const p = room.pending;
  if (!p || p.kind !== 'pass_go_reward' || p.playerId !== playerId) {
    return { error: 'No pass GO reward pending' };
  }
  const pl = findPlayer(room, playerId);
  if (!pl) return { error: 'Player missing' };
  const cell = room.resumeAfterPassGo || getCell(pl.position);
  delete room.resumeAfterPassGo;
  resolveLanding(room, pl, cell);
  return { ok: true };
}

export function skipChanceGain(room, playerId) {
  const p = room.pending;
  if (!p || p.kind !== 'chance_gain' || p.playerId !== playerId) {
    return { error: 'No chance gain pending' };
  }
  room.pending = { kind: 'message', text: 'Chance reward skipped.' };
  return { ok: true };
}

export async function fulfillPassGoReward(room, playerId) {
  const p = room.pending;
  if (!p || p.kind !== 'pass_go_reward' || p.playerId !== playerId) {
    return { error: 'No pass GO reward pending' };
  }
  const pl = findPlayer(room, playerId);
  if (!pl) return { error: 'Player missing' };
  const memo = `SM-GO-${room.id}-${playerId.slice(0, 8)}`;
  const res = await sendTreasuryPayment(pl.publicKey, p.amount, memo);
  const cell = room.resumeAfterPassGo || getCell(pl.position);
  delete room.resumeAfterPassGo;

  if (!res.ok) {
    resolveLanding(room, pl, cell);
    return { ok: true, demo: true, note: res.error };
  }
  const land = resolveLanding(room, pl, cell);
  return { ok: true, hash: res.hash, land };
}

/** Leaderboard stats */
export function leaderboard(room) {
  return room.players
    .map((p) => {
      const props = p.properties || [];
      const assetValue = props.reduce((sum, cid) => {
        const c = getCell(cid);
        return sum + (c.price || 0);
      }, 0);
      return {
        id: p.id,
        name: p.name,
        propertiesOwned: props.length,
        propertyValue: assetValue,
        position: p.position,
      };
    })
    .sort((a, b) => b.propertyValue + b.propertiesOwned * 10 - (a.propertyValue + a.propertiesOwned * 10));
}
