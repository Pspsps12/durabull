import { createHmac, timingSafeEqual } from 'node:crypto'

export const TELEMETRY_COLLECT_SIGNATURE_TOLERANCE_SEC = 300
export const TELEMETRY_COLLECT_TIMESTAMP_HEADER = 'X-Durabull-Telemetry-Timestamp'
export const TELEMETRY_COLLECT_SIGNATURE_HEADER = 'X-Durabull-Telemetry-Signature'

export function signTelemetryCollectBody(
  secret: string,
  timestamp: number,
  rawBody: string
): { signature: string; timestamp: string } {
  const timestampValue = String(timestamp)
  const digest = createHmac('sha256', secret)
    .update(`${timestampValue}.${rawBody}`)
    .digest('hex')

  return {
    signature: `sha256=${digest}`,
    timestamp: timestampValue,
  }
}

export function verifyTelemetryCollectSignature(input: {
  secret: string
  timestampHeader: string | undefined
  signatureHeader: string | undefined
  rawBody: string
  nowSec?: number
}): { ok: true } | { ok: false; error: 'missing' | 'invalid' | 'expired' } {
  const { secret, timestampHeader, signatureHeader, rawBody } = input
  if (!timestampHeader?.trim() || !signatureHeader?.trim()) {
    return { ok: false, error: 'missing' }
  }

  const timestampSec = Number.parseInt(timestampHeader, 10)
  if (!Number.isFinite(timestampSec)) {
    return { ok: false, error: 'invalid' }
  }

  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - timestampSec) > TELEMETRY_COLLECT_SIGNATURE_TOLERANCE_SEC) {
    return { ok: false, error: 'expired' }
  }

  const expected = signTelemetryCollectBody(secret, timestampSec, rawBody).signature
  const provided = signatureHeader.trim()

  try {
    const expectedBuffer = Buffer.from(expected)
    const providedBuffer = Buffer.from(provided)
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return { ok: false, error: 'invalid' }
    }
  } catch {
    return { ok: false, error: 'invalid' }
  }

  return { ok: true }
}
