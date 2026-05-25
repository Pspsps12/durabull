import { createHmac } from 'node:crypto'
import {
  assertAllowedWebhookUrl,
  normalizeWebhookUrl,
  WebhookUrlError,
} from './alert-webhook-url'

export const WEBHOOK_TIMEOUT_MS = 10_000
export const WEBHOOK_SIGNATURE_TOLERANCE_SEC = 300
export const WEBHOOK_DELIVERY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const WEBHOOK_DELIVERY_ABANDONED_MESSAGE =
  'Webhook delivery abandoned after 7 days of failed attempts.'

export function isWebhookDeliveryExpired(
  createdAt: Date | string,
  nowMs: number = Date.now()
): boolean {
  const createdMs = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime()
  if (!Number.isFinite(createdMs)) return true
  return nowMs - createdMs >= WEBHOOK_DELIVERY_MAX_AGE_MS
}

export interface WebhookDeliveryRequest {
  url: string
  body: string
  secret?: string | null
  deliveryId: string
  idempotencyKey: string
}

export interface WebhookDeliveryResult {
  success: boolean
  httpStatus: number | null
  durationMs: number
  error?: string
  retryable: boolean
  responseBodySnippet?: string
}

export class WebhookDeliveryError extends Error {
  readonly httpStatus: number | null
  readonly retryable: boolean
  readonly responseBodySnippet?: string

  constructor(
    message: string,
    options: { httpStatus?: number | null; retryable: boolean; responseBodySnippet?: string }
  ) {
    super(message)
    this.name = 'WebhookDeliveryError'
    this.httpStatus = options.httpStatus ?? null
    this.retryable = options.retryable
    this.responseBodySnippet = options.responseBodySnippet
  }
}

export function signWebhookPayload(
  secret: string,
  timestamp: number,
  body: string
): { signature: string; timestamp: string } {
  const timestampValue = String(timestamp)
  const digest = createHmac('sha256', secret)
    .update(`${timestampValue}.${body}`)
    .digest('hex')
  return {
    signature: `sha256=${digest}`,
    timestamp: timestampValue,
  }
}

export function classifyWebhookHttpStatus(status: number): { retryable: boolean; message: string } {
  if (status >= 200 && status < 300) {
    return { retryable: false, message: 'Delivered successfully.' }
  }
  if (status === 408 || status === 429 || status >= 500) {
    return { retryable: true, message: `Webhook endpoint returned HTTP ${status}.` }
  }
  return { retryable: false, message: `Webhook endpoint returned HTTP ${status}.` }
}

export async function deliverWebhook(request: WebhookDeliveryRequest): Promise<WebhookDeliveryResult> {
  const startedAt = Date.now()

  try {
    await assertAllowedWebhookUrl(request.url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      error: message,
      retryable: false,
    }
  }

  const normalizedUrl = normalizeWebhookUrl(request.url)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Durabull-Alerts/1.0',
    'X-Durabull-Delivery-Id': request.deliveryId,
    'Idempotency-Key': request.idempotencyKey,
  }

  if (request.secret) {
    const signed = signWebhookPayload(request.secret, Math.floor(Date.now() / 1000), request.body)
    headers['X-Durabull-Signature'] = signed.signature
    headers['X-Durabull-Timestamp'] = signed.timestamp
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const response = await fetch(normalizedUrl, {
      method: 'POST',
      headers,
      body: request.body,
      redirect: 'manual',
      signal: controller.signal,
    })

    const durationMs = Date.now() - startedAt
    const responseBodySnippet = await readResponseSnippet(response)
    const classification = classifyWebhookHttpStatus(response.status)

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        httpStatus: response.status,
        durationMs,
        retryable: false,
        responseBodySnippet,
      }
    }

    return {
      success: false,
      httpStatus: response.status,
      durationMs,
      error: classification.message,
      retryable: classification.retryable,
      responseBodySnippet,
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        httpStatus: null,
        durationMs,
        error: `Webhook request timed out after ${WEBHOOK_TIMEOUT_MS}ms.`,
        retryable: true,
      }
    }

    return {
      success: false,
      httpStatus: null,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
      retryable: true,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function deliverWebhookOrThrow(
  request: WebhookDeliveryRequest
): Promise<{ httpStatus: number; durationMs: number; responseBodySnippet?: string }> {
  const result = await deliverWebhook(request)
  if (result.success && result.httpStatus !== null) {
    return {
      httpStatus: result.httpStatus,
      durationMs: result.durationMs,
      responseBodySnippet: result.responseBodySnippet,
    }
  }

  throw new WebhookDeliveryError(result.error ?? 'Webhook delivery failed.', {
    httpStatus: result.httpStatus,
    retryable: result.retryable,
    responseBodySnippet: result.responseBodySnippet,
  })
}

async function readResponseSnippet(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text()
    if (!text) return undefined
    return text.slice(0, 500)
  } catch {
    return undefined
  }
}

export { WebhookUrlError }
