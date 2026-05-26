import { getCanonicalMcpResourceUri } from '@durabull/mcp/auth'

/** Dev-only bearer accepted when `DURABULL_AUTHLESS=true`. */
export const AUTHLESS_MCP_BEARER_TOKEN = 'durabull-authless-mcp'

export function getMcpAuthConfig(appBaseUrl: string) {
  const canonicalResourceUri = getCanonicalMcpResourceUri(appBaseUrl)
  const appOrigin = new URL(appBaseUrl).origin
  return {
    canonicalResourceUri,
    /** Matches Better Auth `withMcpAuth` challenge URL (auth base path). */
    resourceMetadataUrl: `${appOrigin}/api/auth/.well-known/oauth-protected-resource`,
    /** App-origin fallback for clients that ignore `WWW-Authenticate` (RFC 9728). */
    rootResourceMetadataUrl: `${appOrigin}/.well-known/oauth-protected-resource`,
    authorizationServerUrl: `${appOrigin}/api/auth`,
  }
}
