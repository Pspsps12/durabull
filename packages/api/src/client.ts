/**
 * Hono RPC Client for type-safe API calls
 * https://hono.dev/docs/guides/rpc
 */

import type { ApiType as ServerApiType } from '@durabull/api/app'
import { hc } from 'hono/client'

const API_REQUEST_TIMEOUT_MS = 15_000

/**
 * Re-export the API type for consumers who need it
 */
export type ApiType = ServerApiType

function getRequestPath(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.pathname
  return input.url
}

function isRedisScopedApiRequest(input: string | URL | Request): boolean {
  const path = getRequestPath(input)
  return path.includes('/api/c/')
}

async function fetchWithTimeout(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), API_REQUEST_TIMEOUT_MS)

  const callerSignal = init?.signal
  const abortFromCaller = () => timeoutController.abort()
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeout)
      throw new Error('Request was aborted before it started.')
    }
    callerSignal.addEventListener('abort', abortFromCaller, { once: true })
  }

  try {
    return await fetch(input, {
      ...init,
      signal: timeoutController.signal,
    })
  } catch (error) {
    if (timeoutController.signal.aborted && !callerSignal?.aborted) {
      const seconds = Math.floor(API_REQUEST_TIMEOUT_MS / 1000)
      const timeoutMessage = isRedisScopedApiRequest(input)
        ? `Request timed out after ${seconds}s. Unable to connect to Redis for this connection. Check Redis URL, credentials, TLS settings, and IP allowlist, then retry.`
        : `Request timed out after ${seconds}s. The server did not respond in time.`
      throw new Error(timeoutMessage)
    }
    throw error
  } finally {
    clearTimeout(timeout)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}

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
  fetch: fetchWithTimeout,
  init: {
    credentials: 'include', // Required for Better Auth session cookies
  },
})
