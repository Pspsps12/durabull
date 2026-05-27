import { createMcpRoutes, getDefaultAllowedHosts, getProductionAllowedHosts } from '@durabull/mcp'
import { env } from '@durabull/env'

import { APP_VERSION } from '../lib/build-info'
import { assertMcpAuthConfiguration } from './auth/mcp-auth-config'
import { createMcpSessionMiddleware } from './auth/mcp-session-middleware'
import { createMcpPolicyMiddleware } from './policy/mcp-policy-middleware'
import { explainJobFailureHandler } from './tools/explain-job-failure-handler'
import { getFailureEventsHandler } from './tools/get-failure-events-handler'
import { getJobHandler } from './tools/get-job-handler'
import { getJobLogsHandler } from './tools/get-job-logs-handler'
import { getJobStacktracesHandler } from './tools/get-job-stacktraces-handler'
import { getQueueMetricsHandler } from './tools/get-queue-metrics-handler'
import { getQueueHandler } from './tools/get-queue-handler'
import { getWorkersHandler } from './tools/get-workers-handler'
import { listConnectionsHandler } from './tools/list-connections-handler'
import { listJobsHandler } from './tools/list-jobs-handler'
import { listQueuesHandler } from './tools/list-queues-handler'

/**
 * Thin API ingress: mounts MCP Streamable HTTP transport at `/mcp`.
 * All MCP protocol, transport, and tool logic lives in `@durabull/mcp`.
 */
export async function mountMcpIngress() {
  assertMcpAuthConfiguration()

  const appBaseUrl = env.APP_BASE_URL ?? 'http://localhost:5173'
  const isProduction = env.NODE_ENV === 'production'
  const authMiddleware = await createMcpSessionMiddleware(appBaseUrl)
  const policyMiddleware = createMcpPolicyMiddleware()

  return createMcpRoutes({
    version: APP_VERSION,
    allowedHosts: isProduction
      ? getProductionAllowedHosts(appBaseUrl)
      : getDefaultAllowedHosts({ appBaseUrl, includeDevHosts: true }),
    corsOrigins: [appBaseUrl],
    allowHostnameWithoutPort: !isProduction,
    readTools: {
      listConnections: listConnectionsHandler,
      listQueues: listQueuesHandler,
      getQueue: getQueueHandler,
      listJobs: listJobsHandler,
      getJob: getJobHandler,
      getJobLogs: getJobLogsHandler,
      getJobStacktraces: getJobStacktracesHandler,
      getFailureEvents: getFailureEventsHandler,
      getQueueMetrics: getQueueMetricsHandler,
      getWorkers: getWorkersHandler,
      explainJobFailure: explainJobFailureHandler,
    },
    requestContextResolver: (c) => {
      const principal = c.get('mcpPrincipal')
      const decision = c.get('mcpPolicyDecision')
      if (!principal) {
        return undefined
      }
      return {
        principal:
          principal.type === 'delegated_user'
            ? {
                type: 'delegated_user' as const,
                principalId: principal.principalId,
                userId: principal.userId,
              }
            : {
                type: 'service_account' as const,
                principalId: principal.principalId,
                organizationId: principal.organizationId,
              },
        correlationId: decision?.correlationId,
        grantedScopes: c.get('mcpGrantedScopes'),
        resolvedConnection: c.get('mcpResolvedConnection'),
      }
    },
    middleware: [authMiddleware, policyMiddleware],
  })
}
