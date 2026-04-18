import { motion } from 'framer-motion'

type Props = {
  d1?: number
  d2?: number
  rolling?: boolean
}

export function DiceRoller({ d1, d2, rolling }: Props) {
  return (
    <div className="flex items-center justify-center gap-4">
      <motion.div
        animate={rolling ? { rotate: [0, 360, 720], scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.6 }}
        className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-cyan-400/50 bg-gradient-to-br from-slate-800 to-slate-900 font-[family-name:var(--font-display)] text-2xl font-bold text-white shadow-[0_0_24px_rgba(34,211,238,0.25)]"
      >
        {d1 ?? '—'}
      </motion.div>
      <motion.div
        animate={rolling ? { rotate: [0, -360, -720], scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.6 }}
        className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-violet-400/50 bg-gradient-to-br from-slate-800 to-slate-900 font-[family-name:var(--font-display)] text-2xl font-bold text-white shadow-[0_0_24px_rgba(167,139,250,0.25)]"
      >
        {d2 ?? '—'}
      </motion.div>
    </div>
  )
}
