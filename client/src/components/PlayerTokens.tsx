import { motion } from 'framer-motion'
import type { GamePlayer } from '../types'

const COLORS = ['#22d3ee', '#c084fc', '#fbbf24', '#34d399', '#fb7185', '#60a5fa']

type Props = {
  players: GamePlayer[]
  cellCenters: { left: number; top: number }[]
}

export function PlayerTokens({ players, cellCenters }: Props) {
  return (
    <>
      {players.map((p, idx) => {
        const pos = cellCenters[p.position] ?? cellCenters[0]
        const offset = (idx - (players.length - 1) / 2) * 6
        return (
          <motion.div
            key={p.id}
            layout
            initial={false}
            animate={{
              left: `${pos.left + offset}%`,
              top: `${pos.top}%`,
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
            title={p.name}
          />
        )
      })}
    </>
  )
}
