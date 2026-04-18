import type { BoardCell } from '../types'

type Props = {
  cell: BoardCell
  ownerName?: string
  compact?: boolean
}

const railStyle = 'border-b-2 border-slate-900 bg-slate-700'
const utilStyle = 'border-b-2 border-slate-900 bg-cyan-800'
const chanceStyle = 'border-b-2 border-slate-900 bg-rose-700'
const ccStyle = 'border-b-2 border-slate-900 bg-emerald-800'
const taxStyle = 'border-b-2 border-slate-900 bg-slate-600'
const cornerStyle = 'h-full w-full flex flex-col items-center justify-center bg-slate-900 text-center'

export function PropertyCard({ cell, ownerName, compact }: Props) {
  const t = compact ? 'text-[7px] leading-[1.1]' : 'text-xs'
  const isDeed =
    cell.type === 'property' || cell.type === 'railroad' || cell.type === 'utility'

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-sm border border-white/10 bg-slate-900/95 text-left shadow-sm ${t}`}
    >
      {cell.type === 'property' && cell.color && (
        <div
          className={`h-2 shrink-0 border-b border-black/30 bg-gradient-to-b ${cell.color}`}
          aria-hidden
        />
      )}
      {cell.type === 'railroad' && <div className={`h-2 shrink-0 ${railStyle}`} aria-hidden />}
      {cell.type === 'utility' && <div className={`h-2 shrink-0 ${utilStyle}`} aria-hidden />}
      {cell.type === 'chance' && <div className={`h-2 shrink-0 ${chanceStyle}`} aria-hidden />}
      {cell.type === 'community_chest' && <div className={`h-1.5 shrink-0 ${ccStyle}`} aria-hidden />}
      {cell.type === 'tax' && <div className={`h-1.5 shrink-0 ${taxStyle}`} aria-hidden />}

      {(cell.type === 'go' ||
        cell.type === 'jail' ||
        cell.type === 'parking' ||
        cell.type === 'go_to_jail') && (
        <div className={cornerStyle}>
          <div className="font-[family-name:var(--font-display)] font-bold leading-tight text-amber-200">
            {cell.name}
          </div>
        </div>
      )}

      {!['go', 'jail', 'parking', 'go_to_jail'].includes(cell.type) && (
        <>
          <div className="min-h-0 flex-1 px-0.5 py-0.5 font-[family-name:var(--font-display)] font-semibold text-slate-100">
            {cell.name}
          </div>
          {isDeed && cell.price != null && (
            <div className="mt-auto border-t border-white/10 px-0.5 py-0.5 text-amber-200/95">
              {cell.price} XLM
            </div>
          )}
          {cell.type === 'tax' && cell.taxAmount != null && (
            <div className="mt-auto border-t border-white/10 px-0.5 py-0.5 text-rose-200/90">
              Pay {cell.taxAmount}
            </div>
          )}
          {ownerName && (
            <div className="truncate border-t border-amber-500/30 px-0.5 py-0.5 text-[6px] text-amber-300/90">
              {ownerName}
            </div>
          )}
        </>
      )}
    </div>
  )
}
