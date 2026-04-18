import { useCallback, useEffect, useState } from 'react'
import { isConnected, requestAccess, getAddress } from '@stellar/freighter-api'
import { fetchXlmBalance } from '../stellar/payments'

/**
 * Freighter: always use requestAccess() when the user clicks Connect so the
 * approval prompt runs for this origin. The old pattern (isConnected → getAddress only)
 * skipped requestAccess and often failed until the site was allowlisted.
 */
export function useWallet() {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [balance, setBalance] = useState<string>('—')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshBalance = useCallback(async (pk: string) => {
    const b = await fetchXlmBalance(pk)
    setBalance(parseFloat(b).toFixed(4))
  }, [])

  const connect = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      let status = await isConnected()
      if (status.error) {
        throw new Error(status.error.message || 'Could not reach Freighter')
      }
      if (!status.isConnected) {
        await new Promise((r) => setTimeout(r, 500))
        status = await isConnected()
        if (status.error) {
          throw new Error(status.error.message || 'Could not reach Freighter')
        }
      }
      if (!status.isConnected) {
        throw new Error(
          'Freighter was not detected. Install the extension for your browser, pin it, then refresh this page.',
        )
      }

      const req = await requestAccess()
      if (req.error) {
        const msg = req.error.message || String(req.error)
        throw new Error(msg || 'Freighter rejected the connection')
      }
      if (!req.address) {
        throw new Error('No address returned — unlock Freighter and try again')
      }

      setPublicKey(req.address)
      localStorage.setItem('sm_wallet', req.address)
      await refreshBalance(req.address)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet error')
    } finally {
      setBusy(false)
    }
  }, [refreshBalance])

  /** Silent refresh of address when we already have a stored key (no popup if already allowed). */
  const tryRefreshAddress = useCallback(async () => {
    const addr = await getAddress()
    if (addr.error || !addr.address) return null
    return addr.address
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('sm_wallet')
    if (!stored) return

    setPublicKey(stored)
    refreshBalance(stored).catch(() => setBalance('—'))

    /** If the tab was opened before Freighter injected, retry address sync once. */
    let cancelled = false
    const t = window.setTimeout(async () => {
      if (cancelled) return
      const status = await isConnected()
      if (status.isConnected && !cancelled) {
        const pk = await tryRefreshAddress()
        if (pk && pk !== stored) {
          setPublicKey(pk)
          localStorage.setItem('sm_wallet', pk)
          refreshBalance(pk).catch(() => setBalance('—'))
        }
      }
    }, 800)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [refreshBalance, tryRefreshAddress])

  return { publicKey, balance, busy, error, connect, refreshBalance, setPublicKey, clearError: () => setError(null) }
}
