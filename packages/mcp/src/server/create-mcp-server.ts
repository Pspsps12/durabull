import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { MCP_SERVER_NAME } from '../constants'
import { registerSmokeTools } from '../tools/register-smoke-tools'

export interface CreateMcpServerOptions {
  version: string
}

export function createMcpServer({ version }: CreateMcpServerOptions): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version,
  })

  registerSmokeTools(server)

  return server
}
