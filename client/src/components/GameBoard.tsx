import { PropertyCard } from './PropertyCard'
import { PlayerTokens } from './PlayerTokens'
import { DiceRoller } from './DiceRoller'
import type { BoardCell, GamePlayer } from '../types'

/** Percent center (0–100) for each cell from 11×11 grid coordinates (1-based). */
export function boardCellCenters(board: BoardCell[]) {
  return board.map((cell) => {
    const gr = cell.gridRow ?? 6
    const gc = cell.gridCol ?? 6
    return {
      left: ((gc - 0.5) / 11) * 100,
      top: ((gr - 0.5) / 11) * 100,
    }
  })
}

type Props = {
  board: BoardCell[]
  players: GamePlayer[]
  ownership: Record<string, string>
  playerNameById: Record<string, string>
  lastDice: { d1: number; d2: number; total: number } | null
  diceRolling?: boolean
}

export function GameBoard({
  board,
  players,
  ownership,
  playerNameById,
  lastDice,
  diceRolling,
}: Props) {
  const centers = boardCellCenters(board)

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[min(96vw,760px)]">
      <div className="absolute inset-0 rounded-xl border-[3px] border-amber-900/60 bg-[#0d4a2d] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-1 rounded-lg border border-amber-200/20" />
      </div>

      <div className="relative z-10 grid h-full w-full grid-cols-11 grid-rows-11 gap-0.5 p-1">
        {board.map((cell) => {
          const ownerId = ownership[String(cell.id)]
          const ownerName = ownerId ? playerNameById[ownerId] : undefined
          const gr = cell.gridRow ?? 1
          const gc = cell.gridCol ?? 1
          const isCorner =
            cell.type === 'go' ||
            cell.type === 'jail' ||
            cell.type === 'parking' ||
            cell.type === 'go_to_jail'
          return (
            <div
              key={cell.id}
              className={`min-h-0 min-w-0 overflow-hidden rounded-sm border border-black/40 bg-slate-950/90 shadow-inner ${
                isCorner ? 'p-0.5' : 'p-0.5'
              }`}
              style={{ gridRow: gr, gridColumn: gc }}
            >
              <PropertyCard cell={cell} ownerName={ownerName} compact />
            </div>
          )
        })}

        <div className="pointer-events-none relative z-30 col-span-9 col-start-2 row-span-9 row-start-2 flex flex-col items-center justify-center gap-2 rounded-lg border border-amber-900/40 bg-gradient-to-b from-emerald-950/95 to-slate-950/95 p-3 shadow-inner">
          <h2 className="text-center font-[family-name:var(--font-display)] text-[clamp(0.65rem,1.8vw,0.95rem)] font-bold leading-tight tracking-wide text-amber-100">
            STELLAR
            <br />
            <span className="text-amber-300/90">MONOPOLY</span>
          </h2>
          <DiceRoller d1={lastDice?.d1} d2={lastDice?.d2} rolling={diceRolling} />
          {lastDice && (
            <p className="text-[10px] text-amber-100/70">
              Total <span className="font-semibold text-white">{lastDice.total}</span>
            </p>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 z-20">
          <PlayerTokens players={players} cellCenters={centers} />
        </div>
      </div>
    </div>
  )
}
