/**
 * @durabull/api - API client for the Durabull web application
 *
 * This package provides a type-safe API client using Hono RPC.
 * Types are automatically inferred from the server routes.
 *
 * @example
 * ```ts
 * import { api } from '@durabull/api'
 *
 * // Type-safe API calls with credentials included
 * const res = await api.connections.$get()
 * const data = await res.json()
 * ```
 */

export type { InferRequestType, InferResponseType } from 'hono/client'
export { type ApiType, api } from './client'
