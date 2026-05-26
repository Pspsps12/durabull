import { StreamableHTTPTransport } from '@hono/mcp'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { createMcpServer } from '../server/create-mcp-server'

interface McpSessionEntry {
  transport: StreamableHTTPTransport
  server: McpServer
  connected: Promise<void>
}

export interface McpSessionRegistryOptions {
  version: string
  allowedHosts: ReadonlySet<string>
}

export function createMcpSessionRegistry(options: McpSessionRegistryOptions) {
  const sessions = new Map<string, McpSessionEntry>()
  const allowedHostList = [...options.allowedHosts]

  function createSessionEntry(): McpSessionEntry {
    const server = createMcpServer({ version: options.version })
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableDnsRebindingProtection: true,
      allowedHosts: allowedHostList,
      // Origin checks are handled by Hono CORS middleware (non-browser MCP clients omit Origin).
      onsessioninitialized: async (sessionId) => {
        sessions.set(sessionId, { transport, server, connected: connectPromise })
      },
      onsessionclosed: async (sessionId) => {
        sessions.delete(sessionId)
        try {
          await server.close()
        } catch {
          // Session already torn down.
        }
      },
    })

    const connectPromise = server.connect(transport)
    return { transport, server, connected: connectPromise }
  }

  async function handleRequest(c: Context): Promise<Response | undefined> {
    const sessionId = c.req.header('mcp-session-id')

    try {
      if (sessionId) {
        const session = sessions.get(sessionId)
        if (!session) {
          return jsonRpcErrorResponse(404, 'Session not found')
        }

        await session.connected
        return session.transport.handleRequest(c)
      }

      const session = createSessionEntry()
      await session.connected
      return session.transport.handleRequest(c)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }

      console.error('[mcp] Request failed:', error)
      return jsonRpcErrorResponse(-32603, 'Internal error')
    }
  }

  return { handleRequest }
}

function jsonRpcErrorResponse(code: number, message: string): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code, message },
      id: null,
    },
    { status: code === 404 ? 404 : 500 }
  )
}
