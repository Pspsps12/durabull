import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Pure SPA Vite Configuration
 *
 * Development:
 *   - `bun dev` runs both API (port 3001) and Vite dev server (port 5173)
 *   - Proxy forwards /api/* and /ingest/* to appropriate targets
 *
 * Production:
 *   - `bun run build` outputs static files to dist/
 *   - API server serves these static files on port 3000
 */
export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  server: {
    port: 5173,
    host: 'localhost',
    proxy: {
      // API requests to the API server
      '/api/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // PostHog proxy traffic always goes through the API server.
      '/ingest': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    viteReact(),
  ],
})
