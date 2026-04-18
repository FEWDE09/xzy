import { useEffect, useRef } from 'react'
import { ArrowRightLeft } from 'lucide-react'

export type TxLine = { id: string; text: string; time: number }

type Props = {
  lines: TxLine[]
}

export function TransactionFeed({ lines }: Props) {
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="flex max-h-48 flex-col rounded-2xl border border-violet-500/20 bg-slate-950/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        Chain activity
      </div>
      <div className="max-h-36 space-y-1.5 overflow-y-auto text-left text-xs text-slate-400">
        {lines.length === 0 && <p className="text-slate-500">Payments appear here after Freighter confirmation.</p>}
        {lines.map((l) => (
          <div key={l.id} className="rounded border border-white/5 bg-slate-900/50 px-2 py-1 font-mono text-[11px] text-cyan-100/90">
            {l.text}
          </div>
        ))}
        <div ref={bottom} />
      </div>
    </div>
  )
}
