import type { LeaderboardRow } from '../types'
import { Trophy } from 'lucide-react'

type Props = {
  rows: LeaderboardRow[]
}

export function Leaderboard({ rows }: Props) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-semibold text-amber-200">
        <Trophy className="h-4 w-4" />
        Leaderboard
      </div>
      <ol className="space-y-2 text-left text-sm">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/40 px-2 py-1.5"
          >
            <span className="flex items-center gap-2">
              <span className="w-5 text-slate-500">{i + 1}</span>
              <span className="font-medium text-slate-200">{r.name}</span>
            </span>
            <span className="text-xs text-slate-400">
              {r.propertiesOwned} props · {r.propertyValue} XLM value
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
