/**
 * Shared Redis URL validation.
 * This validator is used for both API-submitted URLs and env-driven URLs.
 */

export interface RedisUrlValidationResult {
  valid: boolean
  error?: string
  hostname?: string
  port?: number
}

/**
 * Strict production-safe Redis URL validation.
 */
export function validateRedisUrl(url: string): RedisUrlValidationResult {
  try {
    const parsed = new URL(url)

    if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
      return {
        valid: false,
        error: `Invalid protocol "${parsed.protocol}". Only redis:// and rediss:// are allowed.`,
      }
    }

    const port = parsed.port ? parseInt(parsed.port, 10) : 6379
    if (port < 1 || port > 65535) {
      return {
        valid: false,
        error: 'Invalid port number.',
      }
    }

    return {
      valid: true,
      hostname: parsed.hostname,
      port,
    }
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format.',
    }
  }
}

/**
 * Connections are allowed for every resolvable host, including private/internal addresses.
 * Network reachability is verified by the live Redis connect test flow.
 */
export function allowsInternalConnections(): boolean {
  return true
}

/**
 * Environment-aware validation:
 * - all environments: protocol + URL format validation
 */
export function validateRedisUrlForEnvironment(url: string): RedisUrlValidationResult {
  if (allowsInternalConnections()) {
    try {
      const parsed = new URL(url)
      if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
        return {
          valid: false,
          error: `Invalid protocol "${parsed.protocol}". Only redis:// and rediss:// are allowed.`,
        }
      }
      return {
        valid: true,
        hostname: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      }
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format.',
      }
    }
  }

  return validateRedisUrl(url)
}
