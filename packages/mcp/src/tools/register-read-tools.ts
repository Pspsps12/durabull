import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { getMcpRequestContext } from '../request-context'

export interface ListConnectionsHandlerInput {
  principal:
    | {
        type: 'delegated_user'
        principalId: string
        userId: string
      }
    | {
        type: 'service_account'
        principalId: string
        organizationId: string
      }
  cursor?: string
  pageSize: number
}

export interface ListConnectionsHandlerOutput {
  [key: string]: unknown
  connections: Array<{
    id: string
    name: string
    environment: string | null
    prefix: string
    isDefault: boolean
    organizationId: string
  }>
  nextCursor: string | null
}

export interface ListQueuesHandlerInput {
  principal: ListConnectionsHandlerInput['principal']
  connectionId: string
  cursor?: string
  pageSize: number
}

export interface ListQueuesHandlerOutput {
  [key: string]: unknown
  connectionId: string
  total: number
  queues: Array<{
    name: string
    status: 'paused' | 'active'
    isPaused: boolean
    discoveryState: string
    jobCounts: {
      waiting: number
      active: number
      delayed: number
      completed: number
      failed: number
      paused: number
      prioritized: number
    }
  }>
  nextCursor: string | null
}

export interface GetQueueHandlerInput {
  principal: ListConnectionsHandlerInput['principal']
  connectionId: string
  queueName: string
}

export interface GetQueueHandlerOutput {
  [key: string]: unknown
  connectionId: string
  name: string
  status: 'paused' | 'active'
  isPaused: boolean
  scheduledJobsCount: number
  jobCounts: {
    waiting: number
    active: number
    delayed: number
    completed: number
    failed: number
    paused: number
    prioritized: number
  }
  workers: Array<{
    id: string
    name: string
    address: string
    ageMs: number
    idleMs: number
  }>
}

export interface ListJobsHandlerInput {
  principal: ListConnectionsHandlerInput['principal']
  connectionId: string
  queueName: string
  status?: string
  name?: string
  jobId?: string
  cursor?: string
  pageSize: number
}

export interface ListJobsHandlerOutput {
  [key: string]: unknown
  connectionId: string
  queueName: string
  total: number
  jobs: Array<{
    id: string
    name: string
    status: string
    attemptsMade: number
    maxAttempts: number
    failedReason: string | null
    processedOn: number | null
    finishedOn: number | null
    timestamp: number | null
    delay: number
    priority: number
  }>
  nextCursor: string | null
}

export interface GetJobHandlerInput {
  principal: ListConnectionsHandlerInput['principal']
  connectionId: string
  queueName: string
  jobId: string
}

export interface GetJobHandlerOutput {
  [key: string]: unknown
  connectionId: string
  queueName: string
  job: {
    id: string
    name: string
    status: string
    data: Record<string, unknown>
    progress: unknown
    attemptsMade: number
    maxAttempts: number
    failedReason: string | null
    processedOn: number | null
    finishedOn: number | null
    timestamp: number | null
    delay: number
    priority: number
    opts: Record<string, unknown>
    returnvalue: unknown
    stacktraceCount: number
  }
}

export interface GetJobLogsHandlerInput {
  principal: ListConnectionsHandlerInput['principal']
  connectionId: string
  queueName: string
  jobId: string
  cursor?: string
  pageSize: number
}

export interface GetJobLogsHandlerOutput {
  [key: string]: unknown
  connectionId: string
  queueName: string
  jobId: string
  logs: string[]
  total: number
  nextCursor: string | null
}

export interface GetJobStacktracesHandlerInput {
  principal: ListConnectionsHandlerInput['principal']
  connectionId: string
  queueName: string
  jobId: string
  cursor?: string
  pageSize: number
}

export interface GetJobStacktracesHandlerOutput {
  [key: string]: unknown
  connectionId: string
  queueName: string
  jobId: string
  total: number
  stacktraces: Array<{
    attemptNumber: number
    stacktrace: string
    isLatest: boolean
  }>
  nextCursor: string | null
}

export interface RegisterReadToolsOptions {
  listConnections?: (input: ListConnectionsHandlerInput) => Promise<ListConnectionsHandlerOutput>
  listQueues?: (input: ListQueuesHandlerInput) => Promise<ListQueuesHandlerOutput>
  getQueue?: (input: GetQueueHandlerInput) => Promise<GetQueueHandlerOutput>
  listJobs?: (input: ListJobsHandlerInput) => Promise<ListJobsHandlerOutput>
  getJob?: (input: GetJobHandlerInput) => Promise<GetJobHandlerOutput>
  getJobLogs?: (input: GetJobLogsHandlerInput) => Promise<GetJobLogsHandlerOutput>
  getJobStacktraces?: (
    input: GetJobStacktracesHandlerInput
  ) => Promise<GetJobStacktracesHandlerOutput>
}

function parsePageSize(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 25
  return Math.min(100, Math.max(1, Math.floor(raw)))
}

function parseCursor(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined
}

type ToolPrincipal = ListConnectionsHandlerInput['principal']

function getPrincipalFromContext(): ToolPrincipal {
  const requestContext = getMcpRequestContext()
  const principal = requestContext?.principal
  if (!principal) {
    throw new Error('MCP principal context is unavailable for this request.')
  }
  if (principal.type === 'delegated_user' && !principal.userId) {
    throw new Error('Delegated principal is missing user id.')
  }
  if (principal.type === 'service_account' && !principal.organizationId) {
    throw new Error('Service account principal is missing organization id.')
  }
  return principal.type === 'delegated_user'
    ? {
        type: 'delegated_user',
        principalId: principal.principalId,
        userId: principal.userId!,
      }
    : {
        type: 'service_account',
        principalId: principal.principalId,
        organizationId: principal.organizationId!,
      }
}

function toToolError(error: unknown): { code: string; message: string } {
  const INTERNAL_ERROR_MESSAGE = 'Tool invocation failed.'
  const KNOWN_CODES = new Set(['not_found', 'validation_error', 'forbidden'])

  if (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    const code = (error as { code: string }).code
    return {
      code: KNOWN_CODES.has(code) ? code : 'internal_error',
      message:
        KNOWN_CODES.has(code) && error instanceof Error ? error.message : INTERNAL_ERROR_MESSAGE,
    }
  }

  return {
    code: 'internal_error',
    message: INTERNAL_ERROR_MESSAGE,
  }
}

export function registerReadTools(server: McpServer, options: RegisterReadToolsOptions): void {
  const listConnections = options.listConnections
  if (listConnections) {
    const listConnectionsSchema = {
      cursor: z.string().optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    }

    server.tool(
      'list_connections',
      listConnectionsSchema,
      async (args) => {
        try {
          const result = await listConnections({
            principal: getPrincipalFromContext(),
            cursor: parseCursor(args.cursor),
            pageSize: parsePageSize(args.pageSize),
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          }
        } catch (error) {
          const toolError = toToolError(error)
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: toolError }) }],
            structuredContent: { error: toolError },
          }
        }
      }
    )
  }

  const listQueues = options.listQueues
  if (listQueues) {
    server.tool(
      'list_queues',
      {
        connectionId: z.string().min(1),
        cursor: z.string().optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
      async (args) => {
        try {
          const result = await listQueues({
            principal: getPrincipalFromContext(),
            connectionId: args.connectionId,
            cursor: parseCursor(args.cursor),
            pageSize: parsePageSize(args.pageSize),
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          }
        } catch (error) {
          const toolError = toToolError(error)
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: toolError }) }],
            structuredContent: { error: toolError },
          }
        }
      }
    )
  }

  const getQueue = options.getQueue
  if (getQueue) {
    server.tool(
      'get_queue',
      {
        connectionId: z.string().min(1),
        queueName: z.string().min(1),
      },
      async (args) => {
        try {
          const result = await getQueue({
            principal: getPrincipalFromContext(),
            connectionId: args.connectionId,
            queueName: args.queueName,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          }
        } catch (error) {
          const toolError = toToolError(error)
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: toolError }) }],
            structuredContent: { error: toolError },
          }
        }
      }
    )
  }

  const listJobs = options.listJobs
  if (listJobs) {
    server.tool(
      'list_jobs',
      {
        connectionId: z.string().min(1),
        queueName: z.string().min(1),
        status: z.string().optional(),
        name: z.string().optional(),
        jobId: z.string().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
      async (args) => {
        try {
          const result = await listJobs({
            principal: getPrincipalFromContext(),
            connectionId: args.connectionId,
            queueName: args.queueName,
            status: args.status,
            name: args.name,
            jobId: args.jobId,
            cursor: parseCursor(args.cursor),
            pageSize: parsePageSize(args.pageSize),
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          }
        } catch (error) {
          const toolError = toToolError(error)
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: toolError }) }],
            structuredContent: { error: toolError },
          }
        }
      }
    )
  }

  const getJob = options.getJob
  if (getJob) {
    server.tool(
      'get_job',
      {
        connectionId: z.string().min(1),
        queueName: z.string().min(1),
        jobId: z.string().min(1),
      },
      async (args) => {
        try {
          const result = await getJob({
            principal: getPrincipalFromContext(),
            connectionId: args.connectionId,
            queueName: args.queueName,
            jobId: args.jobId,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          }
        } catch (error) {
          const toolError = toToolError(error)
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: toolError }) }],
            structuredContent: { error: toolError },
          }
        }
      }
    )
  }

  const getJobLogs = options.getJobLogs
  if (getJobLogs) {
    server.tool(
      'get_job_logs',
      {
        connectionId: z.string().min(1),
        queueName: z.string().min(1),
        jobId: z.string().min(1),
        cursor: z.string().optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
      async (args) => {
        try {
          const result = await getJobLogs({
            principal: getPrincipalFromContext(),
            connectionId: args.connectionId,
            queueName: args.queueName,
            jobId: args.jobId,
            cursor: parseCursor(args.cursor),
            pageSize: parsePageSize(args.pageSize),
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          }
        } catch (error) {
          const toolError = toToolError(error)
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: toolError }) }],
            structuredContent: { error: toolError },
          }
        }
      }
    )
  }

  const getJobStacktraces = options.getJobStacktraces
  if (getJobStacktraces) {
    server.tool(
      'get_job_stacktraces',
      {
        connectionId: z.string().min(1),
        queueName: z.string().min(1),
        jobId: z.string().min(1),
        cursor: z.string().optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
      async (args) => {
        try {
          const result = await getJobStacktraces({
            principal: getPrincipalFromContext(),
            connectionId: args.connectionId,
            queueName: args.queueName,
            jobId: args.jobId,
            cursor: parseCursor(args.cursor),
            pageSize: parsePageSize(args.pageSize),
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          }
        } catch (error) {
          const toolError = toToolError(error)
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: toolError }) }],
            structuredContent: { error: toolError },
          }
        }
      }
    )
  }
}
