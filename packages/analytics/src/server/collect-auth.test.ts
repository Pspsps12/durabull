import { describe, expect, it } from 'bun:test'

import {
  signTelemetryCollectBody,
  TELEMETRY_COLLECT_SIGNATURE_TOLERANCE_SEC,
  verifyTelemetryCollectSignature,
} from './collect-auth'

const SECRET = 'test-collect-signing-secret'
const RAW_BODY = JSON.stringify({
  instanceId: '41111111-1111-4111-8111-111111111111',
  events: [{ event: 'queue_paused', properties: {}, sessionId: 'session' }],
})

describe('telemetry collect auth', () => {
  it('signs and verifies collect payloads', () => {
    const timestamp = 1_700_000_000
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      timestamp,
      RAW_BODY
    )

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: RAW_BODY,
        nowSec: timestamp,
      })
    ).toEqual({ ok: true })
  })

  it('rejects missing signature headers', () => {
    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader: undefined,
        signatureHeader: undefined,
        rawBody: RAW_BODY,
      })
    ).toEqual({ ok: false, error: 'missing' })
  })

  it('rejects expired signatures', () => {
    const timestamp = 1_700_000_000
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      timestamp,
      RAW_BODY
    )

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: RAW_BODY,
        nowSec: timestamp + TELEMETRY_COLLECT_SIGNATURE_TOLERANCE_SEC + 1,
      })
    ).toEqual({ ok: false, error: 'expired' })
  })

  it('rejects tampered bodies', () => {
    const timestamp = 1_700_000_000
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      timestamp,
      RAW_BODY
    )

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: `${RAW_BODY} `,
        nowSec: timestamp,
      })
    ).toEqual({ ok: false, error: 'invalid' })
  })
})
