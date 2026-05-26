import { createMcpRoutes, getDefaultAllowedHosts, getProductionAllowedHosts } from '@durabull/mcp'
import { env } from '@durabull/env'

import { APP_VERSION } from '../lib/build-info'

/**
 * Thin API ingress: mounts MCP Streamable HTTP transport at `/mcp`.
 * All MCP protocol, transport, and tool logic lives in `@durabull/mcp`.
 */
export function mountMcpIngress() {
  const appBaseUrl = env.APP_BASE_URL ?? 'http://localhost:5173'
  const isProduction = env.NODE_ENV === 'production'

  return createMcpRoutes({
    version: APP_VERSION,
    allowedHosts: isProduction
      ? getProductionAllowedHosts(appBaseUrl)
      : getDefaultAllowedHosts({ appBaseUrl, includeDevHosts: true }),
    corsOrigins: [appBaseUrl],
    allowHostnameWithoutPort: !isProduction,
  })
}
