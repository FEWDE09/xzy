import { Wallet, RefreshCw } from 'lucide-react'

type Props = {
  publicKey: string | null
  balance: string
  busy: boolean
  error?: string | null
  onConnect: () => void
  onRefresh: () => void
  onDismissError?: () => void
  /** Server rule: minimum XLM to create or join a room (Horizon-checked). */
  minJoinBalanceXlm?: number
  joinBalanceCheckEnabled?: boolean
}

export function WalletPanel({
  publicKey,
  balance,
  busy,
  error,
  onConnect,
  onRefresh,
  onDismissError,
  minJoinBalanceXlm = 800,
  joinBalanceCheckEnabled = true,
}: Props) {
  const balNum = parseFloat(balance)
  const hasBal = Number.isFinite(balNum)
  const underMin = joinBalanceCheckEnabled && minJoinBalanceXlm > 0 && hasBal && balNum < minJoinBalanceXlm

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-semibold tracking-wide text-cyan-300">
        <Wallet className="h-4 w-4" />
        Freighter
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-950/50 px-2 py-1.5 text-left text-xs text-rose-100">
          {error}
          {onDismissError && (
            <button type="button" className="ml-2 text-rose-300 underline" onClick={onDismissError}>
              Dismiss
            </button>
          )}
        </p>
      )}
      {joinBalanceCheckEnabled && minJoinBalanceXlm > 0 && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/30 px-2 py-1.5 text-left text-[11px] leading-snug text-amber-100/95">
          Create / join requires <strong className="text-amber-50">{minJoinBalanceXlm}+ XLM</strong> (server checks Horizon
          before you enter a room).
        </p>
      )}
      {!joinBalanceCheckEnabled && (
        <p className="mt-2 text-left text-[11px] text-slate-500">
          Join balance check is off on the server (<code className="text-slate-400">SKIP_JOIN_BALANCE_CHECK</code>).
        </p>
      )}

      {publicKey ? (
        <div className="mt-3 space-y-2 text-left">
          <p className="break-all font-mono text-xs text-slate-400">{publicKey}</p>
          {underMin && (
            <p className="rounded border border-rose-500/40 bg-rose-950/40 px-2 py-1 text-[11px] text-rose-100">
              Balance is below the server minimum — fund this wallet before Create room / Join.
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-semibold text-white">{balance} XLM</span>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-800"
              title="Refresh balance"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onConnect}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 hover:opacity-95 disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Connect wallet'}
        </button>
      )}
    </div>
  )
}
