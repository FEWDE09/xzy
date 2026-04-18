/**
 * Base URL for REST calls to the game server (no trailing slash).
 * - `VITE_SOCKET_URL` when set (e.g. production).
 * - In **dev**, default `http://127.0.0.1:3847` so fetches hit the API directly.
 *   Relying on Vite's `/api` proxy alone returns the SPA HTML if the proxy fails or
 *   only `vite` is running without the API.
 * - Production build: `''` = same origin (serve app + API together).
 */
export function getApiOrigin(): string {
  const raw = import.meta.env.VITE_SOCKET_URL
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim().replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:3847'
  }
  return ''
}
