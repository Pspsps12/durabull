/**
 * API utilities for making authenticated requests
 *
 * Re-exports the typed Hono RPC client from @durabull/api-client
 * and provides helper utilities for error handling.
 */

import type { InferResponseType } from '@durabull/api-client'
import { toast } from 'sonner'

export type { ApiType, InferRequestType, InferResponseType } from '@durabull/api-client'
export { api } from '@durabull/api-client'

/**
 * Custom error class for API errors with status code
 * Provides better error handling and type safety
 */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

/**
 * Extract the 200 response type from a Hono client endpoint
 * Use this to get the success type for an endpoint
 */
export type SuccessResponse<T extends (...args: never[]) => Promise<Response>> = InferResponseType<
  T,
  200
>

/**
 * Helper to handle API response errors and extract JSON
 * Throws ApiError on non-OK responses
 *
 * The generic T should be the expected success response type.
 * Since this throws on error, the returned data is always the success type.
 */
export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `API error: ${res.status}`
    try {
      const errorData = (await res.clone().json()) as { error?: string; message?: string }
      if (errorData.message || errorData.error) {
        message = errorData.message ?? errorData.error ?? message
      }
    } catch {
      // Ignore JSON parse errors
    }

    // Show toast for rate limit errors
    if (res.status === 429) {
      toast.error('Too many requests', {
        description: message || 'Please slow down and try again in a moment.',
      })
    }

    throw new ApiError(message, res.status)
  }
  return res.json() as Promise<T>
}

/**
 * Shorter alias for handleResponse - use in hooks for cleaner code.
 * Handles response, shows toast on 429, throws ApiError on error.
 */
export const handleRes = handleResponse

/**
 * Generic fetch function for API requests
 * Used for routes that don't have full RPC type support
 */
export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type') && options?.body) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    let message = `API error: ${res.status}`
    try {
      const errorData = await res.json()
      if (errorData.message || errorData.error) {
        message = errorData.message || errorData.error
      }
    } catch {
      // Ignore JSON parse errors
    }

    // Show toast for rate limit errors
    if (res.status === 429) {
      toast.error('Too many requests', {
        description: message || 'Please slow down and try again in a moment.',
      })
    }

    throw new ApiError(message, res.status)
  }

  return res.json()
}

/**
 * Create a fetch function scoped to a specific Redis connection
 * API calls are made to /api/c/:connectionId/...
 */
export function createConnectionFetchApi(connectionId: string | undefined) {
  return async function connectionFetchApi<T>(path: string, options?: RequestInit): Promise<T> {
    if (!connectionId) {
      throw new ApiError('No connection selected', 400)
    }

    const url = `/api/c/${connectionId}${path}`
    return fetchApi<T>(url, options)
  }
}
