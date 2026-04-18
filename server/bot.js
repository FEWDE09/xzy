/**
 * CPU opponents: resolve turns server-side without Freighter.
 * Chain-backed humans paying bot landlords use rent → BANK (see verify_rent_tx).
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {import('socket.io').Server} io
 * @param {Map<string, object>} rooms
 * @param {string} roomId
 * @param {(room: object) => void} broadcastRoom
 */
export function scheduleBotTurn(io, rooms, roomId, broadcastRoom) {
  setTimeout(() => {
    const room = rooms.get(roomId);
    if (!room) return;
    runBotTurn(io, rooms, roomId, broadcastRoom).catch((e) => console.error('[bot]', e));
  }, 850);
}

async function runBotTurn(io, rooms, roomId, broadcastRoom) {
  const {
    currentPlayer,
    rollDiceAction,
    endTurn,
    skipPassGoReward,
    skipChanceGain,
    declineBuy,
    confirmBuyAfterTx,
    confirmRentAfterTx,
    confirmTaxAfterTx,
  } = await import('./gameEngine.js');

  const room = rooms.get(roomId);
  if (!room || room.phase !== 'playing') return;

  let cp = currentPlayer(room);
  if (!cp?.isBot) return;

  await sleep(500);

  if (!room.diceRolled) {
    const r = rollDiceAction(room, cp.id);
    if (r.error) return;
    io.to(room.id).emit('dice_rolled', { dice: room.lastDice, result: r });
    broadcastRoom(room);
    await sleep(500);
  }

  for (let iter = 0; iter < 32; iter++) {
    const r0 = rooms.get(roomId);
    if (!r0 || r0.phase !== 'playing') return;
    cp = currentPlayer(r0);
    if (!cp?.isBot) return;

    const pend = r0.pending;
    if (!pend) {
      endTurn(r0, cp.id);
      broadcastRoom(r0);
      scheduleBotTurn(io, rooms, roomId, broadcastRoom);
      return;
    }

    if (pend.kind === 'message') {
      endTurn(r0, cp.id);
      broadcastRoom(r0);
      scheduleBotTurn(io, rooms, roomId, broadcastRoom);
      return;
    }

    if (pend.kind === 'pass_go_reward' && pend.playerId === cp.id) {
      skipPassGoReward(r0, cp.id);
      broadcastRoom(r0);
      await sleep(420);
      continue;
    }

    if (pend.kind === 'buy_offer' && pend.playerId === cp.id) {
      const buy = Math.random() > 0.12;
      if (buy) confirmBuyAfterTx(r0, cp.id, pend.cellId);
      else declineBuy(r0, cp.id);
      broadcastRoom(r0);
      await sleep(450);
      continue;
    }

    if (pend.kind === 'pay_rent' && pend.payerId === cp.id) {
      confirmRentAfterTx(r0, cp.id);
      broadcastRoom(r0);
      await sleep(400);
      continue;
    }

    if (pend.kind === 'pay_tax' && pend.playerId === cp.id) {
      confirmTaxAfterTx(r0, cp.id);
      broadcastRoom(r0);
      await sleep(400);
      continue;
    }

    if (pend.kind === 'chance_gain' && pend.playerId === cp.id) {
      skipChanceGain(r0, cp.id);
      broadcastRoom(r0);
      await sleep(350);
      continue;
    }

    /* Human must act */
    return;
  }
}
