import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'

import { createHostValidationMiddleware } from './middleware/host-validation'
import { createMcpSessionRegistry } from './transport/session-registry'

export interface CreateMcpRoutesOptions {
  /** App version reported in MCP server metadata. */
  version: string
  /** Host allowlist (required — set at API ingress from APP_BASE_URL). */
  allowedHosts: ReadonlySet<string>
  /** CORS origins for /mcp. */
  corsOrigins: string[]
  /**
   * Middleware applied after host validation and before body limit.
   * PR-03: bearer token validation goes here.
   */
  middleware?: MiddlewareHandler[]
  /** When false, only exact host entries match (recommended for production). */
  allowHostnameWithoutPort?: boolean
}

export function createMcpRoutes(options: CreateMcpRoutesOptions): Hono {
  const registry = createMcpSessionRegistry({
    version: options.version,
    allowedHosts: options.allowedHosts,
  })

  const routes = new Hono()

  routes.use(
    '*',
    cors({
      origin: options.corsOrigins,
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Mcp-Session-Id',
        'Mcp-Protocol-Version',
        'Last-Event-ID',
      ],
    })
  )

  routes.use(
    '*',
    createHostValidationMiddleware(options.allowedHosts, {
      allowHostnameWithoutPort: options.allowHostnameWithoutPort,
    })
  )

  for (const middleware of options.middleware ?? []) {
    routes.use('*', middleware)
  }

  routes.use(
    '*',
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (c) =>
        c.json({ error: 'Payload Too Large', message: 'Request body exceeds 1MB limit' }, 413),
    })
  )

  // GET / POST / DELETE delegated to Streamable HTTP transport (@hono/mcp).
  routes.all('/', async (c) => registry.handleRequest(c))

  return routes
}
