function isValidPort(port: string): boolean {
  if (!/^\d{1,5}$/.test(port)) return false
  const value = Number(port)
  return value >= 1 && value <= 65535
}

export interface ParsedHostHeader {
  /** Lowercase hostname or bracketed IPv6 (e.g. `[::1]`). */
  hostname: string
  /** Numeric port when present. */
  port?: string
  /** Full host value for exact allowlist matching (`hostname` or `hostname:port`). */
  host: string
}

/**
 * Parse an HTTP Host header without treating fake port suffixes as valid
 * (e.g. `localhost:3000.evil` is rejected).
 */
export function parseHostHeader(hostHeader: string): ParsedHostHeader | null {
  const trimmed = hostHeader.trim().toLowerCase()
  if (!trimmed) return null

  if (trimmed.includes('..') || /[^a-z0-9.:[\]-]/.test(trimmed)) {
    return null
  }

  if (trimmed.startsWith('[')) {
    const closeBracket = trimmed.indexOf(']')
    if (closeBracket === -1) return null

    const hostname = trimmed.slice(0, closeBracket + 1)
    const after = trimmed.slice(closeBracket + 1)
    if (after === '') {
      return { hostname, host: hostname }
    }
    if (!after.startsWith(':')) return null

    const port = after.slice(1)
    if (!isValidPort(port)) return null

    return { hostname, port, host: `${hostname}:${port}` }
  }

  const colonCount = (trimmed.match(/:/g) ?? []).length
  if (colonCount > 1) return null

  if (colonCount === 0) {
    return { hostname: trimmed, host: trimmed }
  }

  const [hostname, port] = trimmed.split(':')
  if (!hostname || !port || !isValidPort(port)) return null

  return { hostname, port, host: `${hostname}:${port}` }
}
