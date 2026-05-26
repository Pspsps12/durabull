import { Hono } from 'hono'

import { getAuth } from '../../lib/auth'
import { isAuthlessMode } from '../../lib/authless'
import { getMcpProtectedResourceMetadata } from './protected-resource-metadata'

export function mountMcpWellKnownRoutes(appBaseUrl: string) {
  const routes = new Hono()

  routes.get('/.well-known/oauth-protected-resource', async (c) => {
    const auth = isAuthlessMode() ? undefined : await getAuth()
    const metadata = await getMcpProtectedResourceMetadata(auth, appBaseUrl)
    c.header('Cache-Control', 'public, max-age=300')
    return c.json(metadata)
  })

  return routes
}
