import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { socket } from './socket'
import { useWallet } from './hooks/useWallet'
import { GameBoard } from './components/GameBoard'
import { WalletPanel } from './components/WalletPanel'
import { TransactionFeed, type TxLine } from './components/TransactionFeed'
import { Leaderboard } from './components/Leaderboard'
import { playDiceRoll, playMoney, playNotify } from './lib/sounds'
import { signAndSubmitPayment } from './stellar/payments'
import type { GameState, LeaderboardRow, Pending } from './types'
import { getApiOrigin } from './lib/apiOrigin'
import { Users, Play, DoorOpen, Eye, Loader2, Bot } from 'lucide-react'

function pushTx(set: Dispatch<SetStateAction<TxLine[]>>, text: string) {
  set((prev) => [...prev, { id: crypto.randomUUID(), text, time: Date.now() }].slice(-40))
}

export default function App() {
  const wallet = useWallet()
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('sm_name') || '')
  const [roomId, setRoomId] = useState<string | null>(() => localStorage.getItem('sm_room'))
  const [playerId, setPlayerId] = useState<string | null>(() => localStorage.getItem('sm_player'))
  const [isSpectator, setIsSpectator] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [txLines, setTxLines] = useState<TxLine[]>([])
  const [bankPk, setBankPk] = useState<string | null>(null)
  const [demoSkip, setDemoSkip] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [diceRolling, setDiceRolling] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [minJoinBalanceXlm, setMinJoinBalanceXlm] = useState(800)
  const [joinBalanceCheckEnabled, setJoinBalanceCheckEnabled] = useState(true)

  const playerNameById = useMemo(() => {
    const m: Record<string, string> = {}
    game?.players.forEach((p) => {
      m[p.id] = p.name
    })
    return m
  }, [game])

  const refreshHealth = useCallback(async () => {
    try {
      const base = getApiOrigin()
      const r = await fetch(`${base}/api/health`)
      const j = await r.json()
      setBankPk(j.bankPublicKey || null)
      setDemoSkip(Boolean(j.demoSkipChain))
      if (typeof j.minJoinBalanceXlm === 'number' && Number.isFinite(j.minJoinBalanceXlm)) {
        setMinJoinBalanceXlm(j.minJoinBalanceXlm)
      }
      setJoinBalanceCheckEnabled(
        typeof j.joinBalanceCheckEnabled === 'boolean' ? j.joinBalanceCheckEnabled : true,
      )
    } catch {
      setBankPk(null)
    }
  }, [])

  useEffect(() => {
    refreshHealth()
  }, [refreshHealth])

  /** Rejoin room after refresh if session exists */
  useEffect(() => {
    const rid = localStorage.getItem('sm_room')
    const pid = localStorage.getItem('sm_player')
    const pk = localStorage.getItem('sm_wallet')
    const nm = localStorage.getItem('sm_name')
    if (!rid || !pid || !pk || !nm) return
    socket.emit(
      'join_room',
      { roomId: rid, name: nm, publicKey: pk, reconnectPlayerId: pid },
      (res: { error?: string; roomId?: string; playerId?: string; state?: GameState }) => {
        if (res?.error || !res?.state || !res.roomId || !res.playerId) return
        setRoomId(res.roomId)
        setPlayerId(res.playerId)
        setGame(res.state)
        setIsSpectator(false)
        pushTx(setTxLines, 'Session restored')
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot session restore
  }, [])

  useEffect(() => {
    const onState = (s: GameState) => {
      setGame(s)
      if (s.pending?.kind === 'message' && 'text' in s.pending) {
        playNotify()
      }
    }
    const onLb = (rows: LeaderboardRow[]) => setLeaderboard(rows)
    const onDice = () => {
      setDiceRolling(true)
      playDiceRoll()
      setTimeout(() => setDiceRolling(false), 650)
    }
    const onTx = (p: { type: string; txHash?: string }) => {
      playMoney()
      pushTx(setTxLines, `${p.type}${p.txHash ? ` · ${p.txHash.slice(0, 12)}…` : ''}`)
    }
    const onErr = (e: { message?: string }) => setBanner(e.message || 'Error')
    const onReconnect = () => pushTx(setTxLines, 'Reconnected to room')

    socket.on('game_state', onState)
    socket.on('leaderboard', onLb)
    socket.on('dice_rolled', onDice)
    socket.on('tx_confirmed', onTx)
    socket.on('error_msg', onErr)
    socket.on('reconnected', onReconnect)
    return () => {
      socket.off('game_state', onState)
      socket.off('leaderboard', onLb)
      socket.off('dice_rolled', onDice)
      socket.off('tx_confirmed', onTx)
      socket.off('error_msg', onErr)
      socket.off('reconnected', onReconnect)
    }
  }, [])

  const persistSession = (rid: string, pid: string) => {
    const roomKey = rid.trim().toUpperCase()
    localStorage.setItem('sm_room', roomKey)
    localStorage.setItem('sm_player', pid)
    setRoomId(roomKey)
    setPlayerId(pid)
  }

  const createRoom = () => {
    if (!wallet.publicKey || !displayName.trim()) {
      setBanner('Connect wallet and enter display name')
      return
    }
    localStorage.setItem('sm_name', displayName.trim())
    socket.emit('create_room', { name: displayName.trim(), publicKey: wallet.publicKey }, (res: { error?: string; roomId?: string; playerId?: string; state?: GameState }) => {
      if (res.error) return setBanner(res.error)
      if (res.roomId && res.playerId && res.state) {
        persistSession(res.roomId, res.playerId)
        setGame(res.state)
        setIsSpectator(false)
        pushTx(setTxLines, `Room ${res.roomId} created`)
      }
    })
  }

  const joinRoom = () => {
    const code = joinInput.trim().toUpperCase() || roomId
    if (!wallet.publicKey || !displayName.trim() || !code) {
      setBanner('Need wallet, name, and room code')
      return
    }
    localStorage.setItem('sm_name', displayName.trim())
    const reconnect = localStorage.getItem('sm_player')
    socket.emit(
      'join_room',
      {
        roomId: code,
        name: displayName.trim(),
        publicKey: wallet.publicKey,
        reconnectPlayerId: reconnect || undefined,
      },
      (res: { error?: string; roomId?: string; playerId?: string; state?: GameState }) => {
        if (res.error) return setBanner(res.error)
        if (res.roomId && res.playerId && res.state) {
          persistSession(res.roomId, res.playerId)
          setGame(res.state)
          setIsSpectator(false)
          pushTx(setTxLines, `Joined room ${res.roomId}`)
        }
      },
    )
  }

  const spectate = () => {
    const code = joinInput.trim().toUpperCase()
    if (!code) {
      setBanner('Enter room code to spectate')
      return
    }
    socket.emit('spectate', { roomId: code, name: displayName || 'Spectator' }, (res: { error?: string; state?: GameState }) => {
      if (res.error) return setBanner(res.error)
      if (res.state) {
        setRoomId(code)
        setPlayerId(null)
        setIsSpectator(true)
        setGame(res.state)
        localStorage.removeItem('sm_player')
        pushTx(setTxLines, `Spectating ${code}`)
      }
    })
  }

  const startGame = () => {
    if (!roomId || !playerId) return
    socket.emit('start_game', { roomId, playerId }, (res: { error?: string; state?: GameState }) => {
      if (res.error) return setBanner(res.error)
      if (res.state) setGame(res.state)
    })
  }

  const addBot = async () => {
    const rid = (game?.id ?? roomId ?? '').toString().trim().toUpperCase()
    if (!rid) {
      setBanner('No room — create one first.')
      return
    }
    if (!wallet.publicKey) {
      setBanner('Connect Freighter — the server checks your wallet matches the room host.')
      return
    }
    setBanner(null)
    setActionBusy(true)
    try {
      const base = getApiOrigin()
      const res = await fetch(`${base}/api/rooms/${encodeURIComponent(rid)}/bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostPublicKey: wallet.publicKey }),
      })
      const text = await res.text()
      let j: { ok?: boolean; error?: string; state?: GameState }
      try {
        j = JSON.parse(text) as typeof j
      } catch {
        throw new Error(
          text.includes('<!DOCTYPE') || text.includes('<html')
            ? 'Game API not reachable — run the server on port 3847 (e.g. `npm run dev` from the repo root, or `npm run dev --prefix server`).'
            : (text.slice(0, 160) || `Bad response (${res.status})`),
        )
      }
      if (!res.ok) throw new Error(j.error || `Server returned ${res.status}`)
      const st = j.state
      if (st) {
        setGame(st)
        const host = st.players.find((p) => p.id === st.hostId)
        if (host?.publicKey && wallet.publicKey === host.publicKey) {
          persistSession(st.id, st.hostId)
        }
        pushTx(setTxLines, 'CPU player added')
      }
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not add CPU player')
    } finally {
      setActionBusy(false)
    }
  }

  const roll = () => {
    if (!roomId || !playerId) return
    socket.emit('roll_dice', { roomId, playerId }, (res: { error?: string }) => {
      if (res?.error) setBanner(res.error)
    })
  }

  const endTurn = () => {
    if (!roomId || !playerId) return
    socket.emit('end_turn', { roomId, playerId }, (res: { error?: string }) => {
      if (res?.error) setBanner(res.error)
    })
  }

  const runPayment = async (fn: () => Promise<void>) => {
    setActionBusy(true)
    setBanner(null)
    try {
      await fn()
      await wallet.refreshBalance(wallet.publicKey!)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Transaction failed')
    } finally {
      setActionBusy(false)
    }
  }

  const payBuy = async (pending: Extract<Pending, { kind: 'buy_offer' }>) => {
    if (!roomId || !playerId || !wallet.publicKey) return
    if (!bankPk) {
      setBanner('Server BANK_PUBLIC_KEY missing — cannot buy on-chain')
      return
    }
    const memo = `SM-BUY-${roomId}-${pending.cellId}`
    await runPayment(async () => {
      const { hash } = await signAndSubmitPayment({
        sourcePublicKey: wallet.publicKey!,
        destination: bankPk,
        amountXlm: pending.price,
        memo,
      })
      await new Promise<void>((resolve, reject) => {
        socket.emit('verify_buy_tx', { roomId, playerId, cellId: pending.cellId, txHash: hash }, (r: { error?: string }) => {
          if (r?.error) reject(new Error(r.error))
          else resolve()
        })
      })
    })
  }

  const payRent = async (pending: Extract<Pending, { kind: 'pay_rent' }>) => {
    if (!roomId || !wallet.publicKey || !playerId) return
    const landlordIsBot = Boolean(pending.landlordIsBot)
    const dest = landlordIsBot ? bankPk : pending.payeeKey
    if (!dest) {
      setBanner(
        landlordIsBot
          ? 'BANK_PUBLIC_KEY must be set on the server to pay rent to a CPU landlord'
          : 'Missing landlord address',
      )
      return
    }
    const memo = landlordIsBot
      ? `SM-RENT-BOT-${roomId}-${pending.cellId}-${pending.payeeId}`
      : `SM-RENT-${roomId}-${pending.cellId}`
    await runPayment(async () => {
      const { hash } = await signAndSubmitPayment({
        sourcePublicKey: wallet.publicKey!,
        destination: dest,
        amountXlm: pending.amount,
        memo,
      })
      await new Promise<void>((resolve, reject) => {
        socket.emit('verify_rent_tx', { roomId, payerId: playerId, txHash: hash }, (r: { error?: string }) => {
          if (r?.error) reject(new Error(r.error))
          else resolve()
        })
      })
    })
  }

  const payTax = async (pending: Extract<Pending, { kind: 'pay_tax' }>) => {
    if (!roomId || !playerId || !wallet.publicKey) return
    if (!bankPk) {
      setBanner('Server BANK_PUBLIC_KEY missing')
      return
    }
    const memo = `SM-TAX-${roomId}-${pending.cellId}`
    await runPayment(async () => {
      const { hash } = await signAndSubmitPayment({
        sourcePublicKey: wallet.publicKey!,
        destination: bankPk,
        amountXlm: pending.amount,
        memo,
      })
      await new Promise<void>((resolve, reject) => {
        socket.emit('verify_tax_tx', { roomId, playerId, txHash: hash }, (r: { error?: string }) => {
          if (r?.error) reject(new Error(r.error))
          else resolve()
        })
      })
    })
  }

  const declineBuy = () => {
    if (!roomId || !playerId) return
    socket.emit('decline_buy', { roomId, playerId }, (r: { error?: string }) => {
      if (r?.error) setBanner(r.error)
    })
  }

  const demoBuy = (cellId: number) => {
    if (!roomId || !playerId) return
    socket.emit('confirm_buy_demo', { roomId, playerId, cellId }, (r: { error?: string }) => {
      if (r?.error) setBanner(r.error)
    })
  }

  const skipPassGo = () => {
    if (!roomId || !playerId) return
    socket.emit('skip_pass_go', { roomId, playerId }, (r: { error?: string }) => {
      if (r?.error) setBanner(r.error)
    })
  }

  const completePassGo = () => {
    if (!roomId || !playerId) return
    socket.emit('complete_pass_go', { roomId, playerId }, (r: { error?: string }) => {
      if (r?.error) setBanner(r.error)
    })
  }

  const completeChance = () => {
    if (!roomId || !playerId) return
    socket.emit('complete_chance_gain', { roomId, playerId }, (r: { error?: string }) => {
      if (r?.error) setBanner(r.error)
    })
  }

  const skipChance = () => {
    if (!roomId || !playerId) return
    socket.emit('skip_chance_gain', { roomId, playerId }, (r: { error?: string }) => {
      if (r?.error) setBanner(r.error)
    })
  }

  const pending = game?.pending
  const myTurn = Boolean(game && playerId && game.currentPlayerId === playerId)
  /** Host controls: match Freighter to host player (playerId in localStorage often goes stale). */
  const isRoomHost = useMemo(() => {
    if (!game?.hostId) return false
    if (wallet.publicKey) {
      const host = game.players.find((p) => p.id === game.hostId)
      if (host?.publicKey === wallet.publicKey) return true
    }
    return Boolean(playerId && game.hostId === playerId)
  }, [game, wallet.publicKey, playerId])

  return (
    <div className="flex flex-col gap-6 pb-12 lg:flex-row lg:gap-8">
      <div className="flex-1 space-y-4">
        <header className="text-left">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Stellar Monopoly
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Multiplayer orbit board — every rent, tax, and purchase is a real Stellar payment (testnet by default).
          </p>
        </header>

        {banner && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {banner}
            <button type="button" className="ml-2 text-rose-400 underline" onClick={() => setBanner(null)}>
              Dismiss
            </button>
          </div>
        )}

        {!game || game.phase === 'lobby' ? (
          <div className="grid gap-4 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 sm:grid-cols-2">
            <div className="space-y-2 text-left">
              <label className="text-xs uppercase text-slate-500">Display name</label>
              <input
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Commander"
              />
            </div>
            <WalletPanel
              publicKey={wallet.publicKey}
              balance={wallet.balance}
              busy={wallet.busy}
              error={wallet.error}
              onConnect={wallet.connect}
              onRefresh={() => wallet.publicKey && wallet.refreshBalance(wallet.publicKey)}
              onDismissError={wallet.clearError}
              minJoinBalanceXlm={minJoinBalanceXlm}
              joinBalanceCheckEnabled={joinBalanceCheckEnabled}
            />
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createRoom}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                <Users className="h-4 w-4" />
                Create room
              </button>
              <input
                className="min-w-[140px] flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm uppercase text-white"
                placeholder="ROOM CODE"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
              />
              <button
                type="button"
                onClick={joinRoom}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                <DoorOpen className="h-4 w-4" />
                Join
              </button>
              <button
                type="button"
                onClick={spectate}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-500/50 px-4 py-2 text-sm text-violet-200 hover:bg-violet-950/50"
              >
                <Eye className="h-4 w-4" />
                Spectate
              </button>
            </div>
            {game && (
              <div className="sm:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-left text-sm text-emerald-100">
                <p className="font-mono text-lg">
                  Room <strong>{game.id}</strong> · {game.players.length} / 6 players
                </p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  Solo? Add one or more CPU opponents, then start (needs 2+ players total).
                </p>
                <ul className="mt-2 space-y-1 border-t border-emerald-500/20 pt-2">
                  {game.players.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-slate-200">
                      <span>{p.name}</span>
                      {p.isBot ? (
                        <span className="shrink-0 rounded bg-cyan-500/25 px-2 py-0.5 text-xs text-cyan-200">CPU</span>
                      ) : (
                        <span className="shrink-0 text-xs text-slate-500">Human</span>
                      )}
                    </li>
                  ))}
                </ul>
                {isRoomHost && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addBot}
                      disabled={game.players.length >= 6 || actionBusy}
                      title={game.players.length >= 6 ? 'Room is full' : undefined}
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-950/40 px-3 py-1.5 text-sm font-medium text-cyan-100 hover:bg-cyan-950/70 disabled:opacity-40"
                    >
                      <Bot className="h-4 w-4" />
                      Add CPU player
                    </button>
                    <button
                      type="button"
                      onClick={startGame}
                      disabled={game.players.length < 2 || actionBusy}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      Start game
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {game && (
              <GameBoard
                board={game.board}
                players={game.players}
                ownership={game.ownership}
                playerNameById={playerNameById}
                lastDice={game.lastDice}
                diceRolling={diceRolling}
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              {myTurn && !isSpectator && (
                <>
                  <button
                    type="button"
                    disabled={Boolean(game?.diceRolled) || actionBusy}
                    onClick={roll}
                    className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40"
                  >
                    Roll dice
                  </button>
                  <button
                    type="button"
                    disabled={!game?.diceRolled || actionBusy}
                    onClick={endTurn}
                    className="rounded-xl border border-slate-500 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                  >
                    End turn
                  </button>
                </>
              )}
              {actionBusy && (
                <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing…
                </span>
              )}
            </div>

            {pending && game && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4 text-left text-sm text-amber-50">
                <PendingActions
                  board={game.board}
                  pending={pending}
                  myTurn={myTurn}
                  isSpectator={isSpectator}
                  playerId={playerId}
                  demoSkip={demoSkip}
                  bankConfigured={Boolean(bankPk)}
                  onPayBuy={() => pending?.kind === 'buy_offer' && payBuy(pending)}
                  onDeclineBuy={declineBuy}
                  onDemoBuy={demoBuy}
                  onPayRent={() => pending?.kind === 'pay_rent' && payRent(pending)}
                  onPayTax={() => pending?.kind === 'pay_tax' && payTax(pending)}
                  onSkipPassGo={skipPassGo}
                  onCompletePassGo={completePassGo}
                  onCompleteChance={completeChance}
                  onSkipChance={skipChance}
                />
              </div>
            )}
          </>
        )}
      </div>

      <aside className="w-full space-y-4 lg:w-80">
        <WalletPanel
          publicKey={wallet.publicKey}
          balance={wallet.balance}
          busy={wallet.busy}
          error={wallet.error}
          onConnect={wallet.connect}
          onRefresh={() => wallet.publicKey && wallet.refreshBalance(wallet.publicKey)}
          onDismissError={wallet.clearError}
          minJoinBalanceXlm={minJoinBalanceXlm}
          joinBalanceCheckEnabled={joinBalanceCheckEnabled}
        />
        <Leaderboard rows={leaderboard} />
        <TransactionFeed lines={txLines} />
        <p className="text-center text-[11px] text-slate-600">
          Configure BANK_PUBLIC_KEY + TREASURY_SECRET on the server for full flows. Set DEMO_SKIP_CHAIN=1 for offline
          property tests. Balance-gated joining is optional (ENABLE_JOIN_BALANCE_CHECK=1).
        </p>
      </aside>
    </div>
  )
}

function PendingActions({
  board,
  pending,
  myTurn,
  isSpectator,
  playerId,
  demoSkip,
  bankConfigured,
  onPayBuy,
  onDeclineBuy,
  onDemoBuy,
  onPayRent,
  onPayTax,
  onSkipPassGo,
  onCompletePassGo,
  onCompleteChance,
  onSkipChance,
}: {
  board: GameState['board']
  pending: NonNullable<GameState['pending']>
  myTurn: boolean
  isSpectator: boolean
  playerId: string | null
  demoSkip: boolean
  bankConfigured: boolean
  onPayBuy: () => void
  onDeclineBuy: () => void
  onDemoBuy: (cellId: number) => void
  onPayRent: () => void
  onPayTax: () => void
  onSkipPassGo: () => void
  onCompletePassGo: () => void
  onCompleteChance: () => void
  onSkipChance: () => void
}) {
  if (isSpectator) return <p className="text-slate-400">Spectator — no actions.</p>

  if (pending.kind === 'message') {
    return <p>{pending.text}</p>
  }

  if (pending.kind === 'buy_offer') {
    const mine = pending.playerId === playerId
    const cellName = board.find((c) => c.id === pending.cellId)?.name ?? `Cell ${pending.cellId}`
    return (
      <div className="space-y-2">
        <p>
          Buy <strong>{cellName}</strong> for <strong>{pending.price} XLM</strong>?
        </p>
        {pending.rent > 0 && (
          <p className="text-xs text-slate-400">
            Listed rent (before color monopoly / railroad count / dice):{' '}
            <strong className="text-slate-200">{pending.rent} XLM</strong>
          </p>
        )}
        {pending.rentNote && <p className="text-xs text-slate-500">{pending.rentNote}</p>}
        {mine && myTurn && (
          <div className="flex flex-wrap gap-2">
            {bankConfigured && (
              <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold" onClick={onPayBuy}>
                Sign purchase (Freighter)
              </button>
            )}
            {demoSkip && (
              <button
                type="button"
                className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs"
                onClick={() => onDemoBuy(pending.cellId)}
              >
                Demo buy (no chain)
              </button>
            )}
            <button type="button" className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs" onClick={onDeclineBuy}>
              Decline
            </button>
          </div>
        )}
      </div>
    )
  }

  if (pending.kind === 'pay_rent') {
    const mine = pending.payerId === playerId
    return (
      <div>
        <p>
          Rent due: <strong>{pending.amount} XLM</strong>
          {pending.landlordIsBot
            ? ' — sent to the game bank on-chain (CPU landlord).'
            : ' — to the landlord wallet.'}
        </p>
        {mine && (
          <button type="button" className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold" onClick={onPayRent}>
            Sign rent payment
          </button>
        )}
      </div>
    )
  }

  if (pending.kind === 'pay_tax') {
    const mine = pending.playerId === playerId
    return (
      <div>
        <p>
          {pending.label || 'Tax'}: <strong>{pending.amount} XLM</strong>
        </p>
        {mine && (
          <button type="button" className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold" onClick={onPayTax}>
            Sign tax payment
          </button>
        )}
      </div>
    )
  }

  if (pending.kind === 'pass_go_reward') {
    const mine = pending.playerId === playerId
    return (
      <div>
        <p>
          Pass GO — treasury pays <strong>{pending.amount} XLM</strong> (requires server treasury key).
        </p>
        {mine && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs" onClick={onCompletePassGo}>
              Request payout
            </button>
            <button type="button" className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs" onClick={onSkipPassGo}>
              Skip (continue)
            </button>
          </div>
        )}
      </div>
    )
  }

  if (pending.kind === 'chance_gain') {
    const mine = pending.playerId === playerId
    return (
      <div>
        <p>
          Card payout: credit <strong>{pending.amount} XLM</strong> from treasury (Chance / Community Chest).
        </p>
        {mine && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs" onClick={onCompleteChance}>
              Claim
            </button>
            <button type="button" className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs" onClick={onSkipChance}>
              Skip
            </button>
          </div>
        )}
      </div>
    )
  }

  return <p className="text-slate-500">Waiting…</p>
}
