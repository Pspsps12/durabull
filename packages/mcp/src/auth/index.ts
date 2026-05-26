export {
  createMcpBearerAuthMiddleware,
  type McpBearerAuthMiddlewareOptions,
} from './bearer-middleware'
export {
  getCanonicalMcpResourceUri,
  getMcpProtectedResourceMetadataUrl,
} from './resource-uri'
export {
  MCP_PHASE1_SCOPES,
  MCP_SCOPE_DIAGNOSTICS_READ,
  MCP_SCOPE_DISCOVER,
  MCP_SCOPE_FAILURES_READ,
  MCP_SCOPE_JOBS_READ,
  MCP_SCOPE_LOGS_READ,
  MCP_TRANSPORT_REQUIRED_SCOPES,
  missingScopes,
  parseScopeString,
  tokenHasScopes,
} from './scopes'
export type { McpAccessTokenClaims, McpTokenValidationResult } from './types'
export { extractBearerToken, validateMcpAccessTokenClaims } from './validate-token'
export { buildWwwAuthenticateChallenge, mcpAuthResponseHeaders } from './www-authenticate'
