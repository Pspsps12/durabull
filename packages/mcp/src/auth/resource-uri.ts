/**
 * Canonical MCP resource URI for OAuth resource indicators (RFC 8707) and PRM.
 * Format: `${APP_BASE_URL}/mcp` (no trailing slash on the resource path).
 */
function joinAppBasePath(appBaseUrl: string, suffix: string): string {
  const base = new URL(appBaseUrl)
  const basePath = base.pathname.replace(/\/+$/, '')
  const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`
  return `${base.origin}${basePath}${normalizedSuffix}`
}

export function getCanonicalMcpResourceUri(appBaseUrl: string): string {
  return joinAppBasePath(appBaseUrl, '/mcp')
}

export function getMcpProtectedResourceMetadataUrl(appBaseUrl: string): string {
  return joinAppBasePath(appBaseUrl, '/.well-known/oauth-protected-resource')
}
