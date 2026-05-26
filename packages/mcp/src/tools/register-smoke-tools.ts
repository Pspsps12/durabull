import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/** Phase-1 smoke tools only (transport validation). Domain tools register in PR-05. */
export function registerSmokeTools(server: McpServer): void {
  server.tool(
    'ping',
    'Health check for MCP transport wiring (non-domain smoke tool).',
    async () => ({
      content: [{ type: 'text', text: 'pong' }],
    })
  )
}
