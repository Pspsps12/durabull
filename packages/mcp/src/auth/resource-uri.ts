/**
 * Canonical MCP resource URI for OAuth resource indicators (RFC 8707) and PRM.
 * Format: `${APP_BASE_URL}/mcp` (no trailing slash).
 */
export function getCanonicalMcpResourceUri(appBaseUrl: string): string {
  const base = new URL(appBaseUrl)
  return `${base.origin}/mcp`
}

export function getMcpProtectedResourceMetadataUrl(appBaseUrl: string): string {
  const base = new URL(appBaseUrl)
  return `${base.origin}/.well-known/oauth-protected-resource`
}
