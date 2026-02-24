import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getEnvRedisConnections, shouldUseEnvConnections } from '@durabull/dal'
import { isEmailConfigured } from '@durabull/email'
import { env } from '@durabull/env'
import { serveStatic } from 'hono/bun'

import { createApiApp } from './app'
import { isAuthlessMode } from './lib/authless'

// Create the API app
const { app } = await createApiApp()

// Serve static files from web app build (for production)
const webDistPath = join(import.meta.dir, '../../web/dist')
const hasWebBuild = existsSync(webDistPath)

if (hasWebBuild) {
  // Serve static assets with immutable cache headers (hashed filenames)
  app.use(
    '/assets/*',
    serveStatic({
      root: webDistPath,
      onFound: (_path, c) => {
        c.header('Cache-Control', 'public, max-age=31536000, immutable')
      },
    })
  )

  // Serve other static files (favicons, etc.)
  app.use('*', serveStatic({ root: webDistPath }))

  // SPA fallback - serve index.html for all unmatched routes
  app.get('*', serveStatic({ root: webDistPath, path: 'index.html' }))
}

// Re-export the API type for RPC client
export type { ApiType } from './app'

// Port: 3000 for production, 3001 for development
const port = env.PORT ?? (env.NODE_ENV === 'production' ? 3000 : 3001)

const emailBanner = isEmailConfigured()
  ? '📧 Email: Resend configured'
  : '⚠️  Email: Not configured (RESEND_API_KEY missing)'

const dbBanner = env.DATABASE_URL ? '🐘 DB:     PostgreSQL' : '🪶 DB:     PGlite (local)'
const envConnectionCount = shouldUseEnvConnections() ? getEnvRedisConnections().length : 0
const authBanner = isAuthlessMode() ? '🔐 Auth:   Authless' : '🔐 Auth:   Better Auth'
const connectionsBanner = shouldUseEnvConnections()
  ? `🔌 Connections: Env (${envConnectionCount})`
  : '🔌 Connections: DB'
const authlessProductionWarning =
  isAuthlessMode() && env.NODE_ENV === 'production'
    ? '⚠️  WARNING: Authless mode is enabled in production. Restrict network access to trusted environments only.'
    : null

console.log(`
🚀 Durabull API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 API:    http://localhost:${port}/api
🏥 Health: http://localhost:${port}/api/health
${dbBanner}
${authBanner}
${connectionsBanner}
${emailBanner}
${authlessProductionWarning ? `${authlessProductionWarning}` : ''}
${hasWebBuild ? `🌐 Web:    http://localhost:${port}` : '⚠️  Web: Run "bun run build" first'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

export default {
  port,
  fetch: app.fetch,
}
