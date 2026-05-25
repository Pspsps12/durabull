import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { env } from '@durabull/env'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
])

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('fe80:')) return true
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length)
    if (isIP(mapped) === 4) {
      return isPrivateIpv4(mapped.split('.').map(Number))
    }
  }
  return false
}

function isPrivateIpAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    return isPrivateIpv4(address.split('.').map(Number))
  }
  if (version === 6) {
    return isPrivateIpv6(address)
  }
  return true
}

function isHttpAllowed(): boolean {
  return env.DURABULL_WEBHOOK_ALLOW_HTTP === true || env.NODE_ENV === 'development'
}

export function normalizeWebhookUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl)
  parsed.hash = ''
  return parsed.toString()
}

export function getWebhookDeliveryTarget(rawUrl: string): string {
  const parsed = new URL(rawUrl)
  parsed.hash = ''
  return `${parsed.origin}${parsed.pathname}${parsed.search}`
}

export async function assertAllowedWebhookUrl(rawUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new WebhookUrlError('Webhook URL must be a valid URL.')
  }

  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isHttpAllowed())) {
    throw new WebhookUrlError('Webhook URL must use HTTPS.')
  }

  if (parsed.username || parsed.password) {
    throw new WebhookUrlError('Webhook URL must not include credentials.')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new WebhookUrlError('Webhook URL hostname is not allowed.')
  }

  const directIpVersion = isIP(hostname)
  if (directIpVersion !== 0) {
    if (isPrivateIpAddress(hostname)) {
      throw new WebhookUrlError('Webhook URL must not target private or local IP addresses.')
    }
    return
  }

  let addresses: string[]
  try {
    const result = await lookup(hostname, { all: true, verbatim: true })
    addresses = result.map((entry) => entry.address)
  } catch {
    throw new WebhookUrlError('Webhook URL hostname could not be resolved.')
  }

  if (addresses.length === 0) {
    throw new WebhookUrlError('Webhook URL hostname could not be resolved.')
  }

  for (const address of addresses) {
    if (isPrivateIpAddress(address)) {
      throw new WebhookUrlError('Webhook URL must not target private or local IP addresses.')
    }
  }
}

export class WebhookUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookUrlError'
  }
}
