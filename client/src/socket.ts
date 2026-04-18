import { io, Socket } from 'socket.io-client'

/**
 * - `VITE_SOCKET_URL` — always wins when set (production or custom API host).
 * - Dev (`vite`): default `http://127.0.0.1:3847` so the client connects straight to
 *   the game server (CORS is open). Same-origin + Vite proxy is optional via env.
 * - Production build: same origin if no env (API served with the static app).
 */
function socketUrl(): string {
  const env = import.meta.env.VITE_SOCKET_URL
  if (env != null && String(env).trim() !== '') {
    return String(env).trim()
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return 'http://127.0.0.1:3847'
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'http://127.0.0.1:3847'
}

export const socket: Socket = io(socketUrl(), {
  path: '/socket.io',
  transports: ['polling', 'websocket'],
  autoConnect: true,
})
