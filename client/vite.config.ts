import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3847',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3847',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/socket.io': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3847',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3847',
        changeOrigin: true,
      },
    },
  },
})
