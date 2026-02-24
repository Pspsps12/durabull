/**
 * Hono RPC Client for type-safe API calls
 * https://hono.dev/docs/guides/rpc
 */

import type { ApiType as ServerApiType } from '@durabull/api/app'
import { hc } from 'hono/client'

/**
 * Re-export the API type for consumers who need it
 */
export type ApiType = ServerApiType

/**
 * Type-safe API client
 * All types are automatically inferred from the server routes
 *
 * Usage:
 *   const res = await api.connections.$get()
 *   const data = await res.json() // Properly typed!
 *
 * For connection-specific routes:
 *   const res = await api.c[':connectionId'].queues.$get({
 *     param: { connectionId: 'some-id' }
 *   })
 */
export const api = hc<ApiType>('/api', {
  init: {
    credentials: 'include', // Required for Better Auth session cookies
  },
})
