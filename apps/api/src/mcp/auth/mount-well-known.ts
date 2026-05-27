import { Hono } from 'hono'
import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata } from 'better-auth/plugins'

import { getAuth } from '../../lib/auth'
import { isAuthlessMode } from '../../lib/authless'
import { buildAuthlessMcpProtectedResourceMetadata } from './authless-metadata'

/**
 * App-origin well-known routes for MCP clients that cannot parse `WWW-Authenticate`.
 * Better Auth also serves the same metadata under `/api/auth/.well-known/*`.
 *
 * @see https://better-auth.com/docs/plugins/mcp#oauth-protected-resource-metadata
 */
export function mountMcpWellKnownRoutes(appBaseUrl: string) {
  const routes = new Hono()

  routes.get('/.well-known/oauth-protected-resource', async (c) => {
    if (isAuthlessMode()) {
      c.header('Cache-Control', 'public, max-age=300')
      return c.json(buildAuthlessMcpProtectedResourceMetadata(appBaseUrl))
    }

    const auth = await getAuth()
    c.header('Cache-Control', 'public, max-age=300')
    return oAuthProtectedResourceMetadata(auth)(c.req.raw)
  })

  routes.get('/.well-known/oauth-authorization-server', async (c) => {
    if (isAuthlessMode()) {
      return c.notFound()
    }

    const auth = await getAuth()
    return oAuthDiscoveryMetadata(auth)(c.req.raw)
  })

  return routes
}
