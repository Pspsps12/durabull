import { describe, expect, it } from 'bun:test'
import { buildIoRedisConnectionOptions, toRedisConnectionOptions } from './connection-options'

describe('connection-options', () => {
  it('returns empty TLS options by default', () => {
    expect(buildIoRedisConnectionOptions()).toEqual({})
    expect(buildIoRedisConnectionOptions({ allowSelfSignedCerts: false })).toEqual({})
  })

  it('disables certificate verification when self-signed certs are allowed', () => {
    expect(buildIoRedisConnectionOptions({ allowSelfSignedCerts: true })).toEqual({
      tls: {
        rejectUnauthorized: false,
      },
    })
  })

  it('normalizes nullable allowSelfSignedCerts values', () => {
    expect(toRedisConnectionOptions(undefined)).toEqual({ allowSelfSignedCerts: false })
    expect(toRedisConnectionOptions(null)).toEqual({ allowSelfSignedCerts: false })
    expect(toRedisConnectionOptions(true)).toEqual({ allowSelfSignedCerts: true })
  })
})
