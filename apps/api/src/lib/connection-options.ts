import type { Context } from 'hono'
import type { RedisOptions } from 'ioredis'

export type RedisConnectionOptions = {
  allowSelfSignedCerts?: boolean
}

export function getConnectionRedisOptions(c: Context): RedisConnectionOptions {
  return toRedisConnectionOptions(c.get('connectionAllowSelfSignedCerts'))
}

export function buildIoRedisConnectionOptions(
  options?: RedisConnectionOptions
): Pick<RedisOptions, 'tls'> {
  if (!options?.allowSelfSignedCerts) {
    return {}
  }

  return {
    tls: {
      rejectUnauthorized: false,
    },
  }
}

export function toRedisConnectionOptions(
  allowSelfSignedCerts?: boolean | null
): RedisConnectionOptions {
  return {
    allowSelfSignedCerts: allowSelfSignedCerts ?? false,
  }
}
