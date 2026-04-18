import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import {
  createRoom,
  addPlayer,
  addBotPlayer,
  addSpectator,
  findPlayer,
  startGame,
  rollDiceAction,
  declineBuy,
  confirmBuyAfterTx,
  confirmRentAfterTx,
  confirmTaxAfterTx,
  endTurn,
  getPublicState,
  leaderboard,
  fulfillPassGoReward,
  fulfillChanceGain,
  skipPassGoReward,
  skipChanceGain,
} from './gameEngine.js';
import { scheduleBotTurn } from './bot.js';
import {
  verifyPaymentTx,
  bankPublicKey,
  horizonUrl,
  assertSufficientJoinBalance,
  getMinJoinBalanceXlm,
  isJoinBalanceCheckEnabled,
} from './stellar.js';
import { getCell } from './board.js';

dotenv.config();

const DEMO_SKIP_CHAIN = process.env.DEMO_SKIP_CHAIN === '1';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

/** @type {Map<string, ReturnType<createRoom>>} */
const rooms = new Map();
const socketIndex = new Map();

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    horizon: horizonUrl,
    bankPublicKey: bankPublicKey || null,
    bankConfigured: Boolean(bankPublicKey),
    demoSkipChain: DEMO_SKIP_CHAIN,
    minJoinBalanceXlm: getMinJoinBalanceXlm(),
    joinBalanceCheckEnabled: isJoinBalanceCheckEnabled(),
  });
});

function normalizeRoomId(rid) {
  if (rid == null || typeof rid !== 'string') return null;
  const u = rid.trim().toUpperCase();
  return u.length ? u : null;
}

app.get('/api/rooms/:id', (req, res) => {
  const id = normalizeRoomId(req.params.id);
  const room = id ? rooms.get(id) : null;
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(getPublicState(room));
});

/**
 * Add CPU — HTTP only, auth by host wallet (never trust client playerId; it goes stale vs game.hostId).
 * Body: { hostPublicKey: string }  (must equal the Stellar address of room.players[host])
 */
app.post('/api/rooms/:id/bots', (req, res) => {
  const id = normalizeRoomId(req.params.id);
  const { hostPublicKey } = req.body || {};
  if (!id || !hostPublicKey || typeof hostPublicKey !== 'string') {
    return res.status(400).json({ error: 'room id and hostPublicKey (Freighter address) are required' });
  }
  const room = rooms.get(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const hostPlayer = room.players.find((p) => p.id === room.hostId);
  if (!hostPlayer || hostPlayer.isBot) {
    return res.status(400).json({ error: 'Invalid room host' });
  }
  if (hostPlayer.publicKey !== hostPublicKey.trim()) {
    return res.status(403).json({
      error: 'Connected wallet is not the room host — connect the same Freighter account you used to create the room',
    });
  }
  if (room.phase !== 'lobby') {
    return res.status(400).json({ error: 'Game already started' });
  }
  const r = addBotPlayer(room);
  if (r.error) return res.status(400).json({ error: r.error });
  broadcastRoom(room);
  res.json({ ok: true, state: getPublicState(room) });
});

function broadcastRoom(room) {
  io.to(room.id).emit('game_state', getPublicState(room));
  io.to(room.id).emit('leaderboard', leaderboard(room));
}

function queueBot(roomId) {
  const id = normalizeRoomId(roomId);
  if (!id) return;
  scheduleBotTurn(io, rooms, id, broadcastRoom);
}

/** Host actions must use this — do not trust client-sent playerId (can get out of sync). */
function assertIsRoomHost(socket, room) {
  const meta = socketIndex.get(socket.id);
  if (meta?.role === 'spectator') {
    return { error: 'Spectators cannot use host actions' };
  }
  if (!meta || meta.role !== 'player' || !meta.playerId) {
    return { error: 'Reconnect to the room (your session is not linked to a player)' };
  }
  if (meta.playerId !== room.hostId) {
    return { error: 'Only the room host can do that' };
  }
  return null;
}

function getRoomOrEmit(socket, roomId) {
  const id = normalizeRoomId(roomId);
  if (!id) {
    socket.emit('error_msg', { message: 'Invalid room id' });
    return null;
  }
  const room = rooms.get(id);
  if (!room) {
    socket.emit('error_msg', { message: 'Room not found' });
    return null;
  }
  socket.join(room.id);
  return room;
}

io.on('connection', (socket) => {
  socket.on('create_room', async ({ name, publicKey }, cb) => {
    try {
      if (!name || !publicKey) {
        cb?.({ error: 'Name and public key required' });
        return;
      }
      const gate = await assertSufficientJoinBalance(publicKey);
      if (!gate.ok) {
        cb?.({ error: gate.error });
        return;
      }
      const room = createRoom(socket.id, name, publicKey);
      rooms.set(room.id, room);
      socket.join(room.id);
      const player = room.players[0];
      socketIndex.set(socket.id, { roomId: room.id, playerId: player.id, role: 'player' });
      cb?.({ roomId: room.id, playerId: player.id, state: getPublicState(room) });
      broadcastRoom(room);
    } catch (e) {
      cb?.({ error: String(e.message || e) });
    }
  });

  socket.on('join_room', async ({ roomId, name, publicKey, reconnectPlayerId }, cb) => {
    try {
      const id = normalizeRoomId(roomId);
      if (!id) return cb?.({ error: 'Invalid room id' });
      const room = rooms.get(id);
      if (!room) return cb?.({ error: 'Room not found' });

      const existing = room.players.find((p) => p.id === reconnectPlayerId && p.publicKey === publicKey);
      if (existing) {
        existing.socketId = socket.id;
        existing.disconnected = false;
        socket.join(room.id);
        socketIndex.set(socket.id, { roomId: room.id, playerId: existing.id, role: 'player' });
        cb?.({ roomId: room.id, playerId: existing.id, state: getPublicState(room) });
        broadcastRoom(room);
        socket.emit('reconnected', { playerId: existing.id });
        return;
      }

      if (!name || !publicKey) {
        cb?.({ error: 'Name and public key required' });
        return;
      }
      const gate = await assertSufficientJoinBalance(publicKey);
      if (!gate.ok) {
        cb?.({ error: gate.error });
        return;
      }

      const r = addPlayer(room, socket.id, name, publicKey);
      if (r.error) return cb?.({ error: r.error });
      socket.join(room.id);
      socketIndex.set(socket.id, { roomId: room.id, playerId: r.playerId, role: 'player' });
      cb?.({ roomId: room.id, playerId: r.playerId, state: getPublicState(room) });
      broadcastRoom(room);
    } catch (e) {
      cb?.({ error: String(e.message || e) });
    }
  });

  socket.on('spectate', ({ roomId, name }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'Room not found' });
    const r = addSpectator(room, socket.id, name || 'Spectator');
    socket.join(room.id);
    socketIndex.set(socket.id, { roomId: room.id, spectatorId: r.spectatorId, role: 'spectator' });
    cb?.({ state: getPublicState(room) });
    broadcastRoom(room);
  });

  socket.on('start_game', ({ roomId, playerId: _playerId }, cb) => {
    try {
      const room = getRoomOrEmit(socket, roomId);
      if (!room) return cb?.({ error: 'No room' });
      const denied = assertIsRoomHost(socket, room);
      if (denied) return cb?.(denied);
      const r = startGame(room);
      if (r.error) return cb?.({ error: r.error });
      broadcastRoom(room);
      queueBot(room.id);
      cb?.({ ok: true, state: getPublicState(room) });
    } catch (e) {
      cb?.({ error: String(e?.message || e) });
    }
  });

  socket.on('add_bot', ({ roomId, playerId, hostPublicKey }, cb) => {
    try {
      const room = getRoomOrEmit(socket, roomId);
      if (!room) return cb?.({ error: 'No room' });
      const hostPlayer = room.players.find((p) => p.id === room.hostId);
      const walletOk =
        hostPublicKey &&
        typeof hostPublicKey === 'string' &&
        hostPlayer &&
        !hostPlayer.isBot &&
        hostPlayer.publicKey === hostPublicKey.trim();
      const denied = assertIsRoomHost(socket, room);
      const trustedHost = (playerId && playerId === room.hostId) || walletOk;
      if (denied && !trustedHost) return cb?.(denied);
      const r = addBotPlayer(room);
      if (r.error) return cb?.({ error: r.error });
      broadcastRoom(room);
      cb?.({ ok: true, state: getPublicState(room) });
    } catch (e) {
      cb?.({ error: String(e?.message || e) });
    }
  });

  socket.on('roll_dice', ({ roomId, playerId }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const r = rollDiceAction(room, playerId);
    if (r.error) return cb?.({ error: r.error });
    io.to(room.id).emit('dice_rolled', { dice: room.lastDice, result: r });
    broadcastRoom(room);
    cb?.({ ok: true, result: r });
  });

  socket.on('decline_buy', ({ roomId, playerId }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const r = declineBuy(room, playerId);
    if (r.error) return cb?.({ error: r.error });
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('confirm_buy_demo', ({ roomId, playerId, cellId }, cb) => {
    if (!DEMO_SKIP_CHAIN) return cb?.({ error: 'Demo purchases disabled' });
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const c = confirmBuyAfterTx(room, playerId, cellId);
    if (c.error) return cb?.({ error: c.error });
    io.to(room.id).emit('tx_confirmed', { type: 'buy', demo: true, cellId });
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('verify_buy_tx', async ({ roomId, playerId, cellId, txHash }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const p = room.pending;
    if (!p || p.kind !== 'buy_offer' || p.playerId !== playerId || p.cellId !== cellId) {
      return cb?.({ error: 'No matching purchase pending' });
    }
    const buyer = findPlayer(room, playerId);
    if (!buyer) return cb?.({ error: 'Player missing' });
    if (!bankPublicKey) return cb?.({ error: 'BANK_PUBLIC_KEY not set on server' });
    const cell = getCell(cellId);
    const memo = `SM-BUY-${room.id}-${cellId}`;
    const v = await verifyPaymentTx(txHash, {
      amountXlm: cell.price,
      from: buyer.publicKey,
      to: bankPublicKey,
      memo,
    });
    if (!v.ok) return cb?.({ error: v.error || 'Verification failed' });
    const c = confirmBuyAfterTx(room, playerId, cellId);
    if (c.error) return cb?.({ error: c.error });
    io.to(room.id).emit('tx_confirmed', { type: 'buy', txHash, cellId });
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('verify_rent_tx', async ({ roomId, payerId, txHash }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const p = room.pending;
    if (!p || p.kind !== 'pay_rent' || p.payerId !== payerId) {
      return cb?.({ error: 'No rent pending' });
    }
    const payer = findPlayer(room, payerId);
    const payee = findPlayer(room, p.payeeId);
    if (!payer || !payee) return cb?.({ error: 'Players missing' });
    const landlordIsBot = Boolean(p.landlordIsBot);
    const to = landlordIsBot ? bankPublicKey : payee.publicKey;
    if (!to) {
      return cb?.({
        error: landlordIsBot ? 'BANK_PUBLIC_KEY not set (required for CPU landlord rent)' : 'Missing payee',
      });
    }
    const memo = landlordIsBot
      ? `SM-RENT-BOT-${room.id}-${p.cellId}-${p.payeeId}`
      : `SM-RENT-${room.id}-${p.cellId}`;
    const v = await verifyPaymentTx(txHash, {
      amountXlm: p.amount,
      from: payer.publicKey,
      to,
      memo,
    });
    if (!v.ok) return cb?.({ error: v.error || 'Verification failed' });
    const c = confirmRentAfterTx(room, payerId);
    if (c.error) return cb?.({ error: c.error });
    io.to(room.id).emit('tx_confirmed', { type: 'rent', txHash });
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('verify_tax_tx', async ({ roomId, playerId, txHash }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const p = room.pending;
    if (!p || p.kind !== 'pay_tax' || p.playerId !== playerId) {
      return cb?.({ error: 'No tax pending' });
    }
    const pl = findPlayer(room, playerId);
    if (!pl) return cb?.({ error: 'Player missing' });
    if (!bankPublicKey) return cb?.({ error: 'BANK_PUBLIC_KEY not set on server' });
    const memo = `SM-TAX-${room.id}-${p.cellId}`;
    const v = await verifyPaymentTx(txHash, {
      amountXlm: p.amount,
      from: pl.publicKey,
      to: bankPublicKey,
      memo,
    });
    if (!v.ok) return cb?.({ error: v.error || 'Verification failed' });
    const c = confirmTaxAfterTx(room, playerId);
    if (c.error) return cb?.({ error: c.error });
    io.to(room.id).emit('tx_confirmed', { type: 'tax', txHash });
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('skip_pass_go', ({ roomId, playerId }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const r = skipPassGoReward(room, playerId);
    if (r.error) return cb?.({ error: r.error });
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('complete_pass_go', async ({ roomId, playerId }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const r = await fulfillPassGoReward(room, playerId);
    if (r.error) return cb?.({ error: r.error });
    broadcastRoom(room);
    cb?.({ ok: true, ...r });
  });

  socket.on('complete_chance_gain', async ({ roomId, playerId }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const r = await fulfillChanceGain(room, playerId);
    if (r.error) return cb?.({ error: r.error });
    broadcastRoom(room);
    cb?.({ ok: true, ...r });
  });

  socket.on('skip_chance_gain', ({ roomId, playerId }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const r = skipChanceGain(room, playerId);
    if (r.error) return cb?.({ error: r.error });
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('end_turn', ({ roomId, playerId }, cb) => {
    const room = getRoomOrEmit(socket, roomId);
    if (!room) return cb?.({ error: 'No room' });
    const r = endTurn(room, playerId);
    if (r.error) return cb?.({ error: r.error });
    broadcastRoom(room);
    queueBot(room.id);
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const meta = socketIndex.get(socket.id);
    if (!meta) return;
    const room = rooms.get(meta.roomId);
    if (room && meta.playerId) {
      const pl = findPlayer(room, meta.playerId);
      if (pl) pl.disconnected = true;
      broadcastRoom(room);
    }
    socketIndex.delete(socket.id);
  });
});

const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || '0.0.0.0';

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[Stellar Monopoly] Port ${PORT} is already in use — another API is probably still running.\n` +
        `  Fix: stop that process, then start again. Examples:\n` +
        `    npx --yes kill-port ${PORT}\n` +
        `    pkill -f "node.*stellar-monopoly/server"   # Linux/mac\n` +
        `  Or use another port:  PORT=3848 npm start\n` +
        `  (then set client VITE_SOCKET_URL=http://127.0.0.1:3848)\n`,
    );
  } else {
    console.error('[Stellar Monopoly] Server failed to start:', err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const loopback = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`Stellar Monopoly API  http://${loopback}:${PORT}`);
  console.log(`Horizon: ${horizonUrl}`);
});
