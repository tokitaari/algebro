import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// In the dev container (DEV_CONTAINER=true) the server must bind to 0.0.0.0 so
// it is reachable from the host. Polling is only needed if the project folder
// lives on a Windows drive (WSL2, /mnt/...).
const inContainer = process.env.DEV_CONTAINER === 'true'
const usePolling = process.env.VITE_USE_POLLING === 'true'

// BASE_PATH is set in CI for GitHub Pages (e.g. "/algebro/").
// Locally and in tests, "/" is used.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    host: inContainer ? '0.0.0.0' : 'localhost',
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
  preview: {
    host: inContainer ? '0.0.0.0' : 'localhost',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
