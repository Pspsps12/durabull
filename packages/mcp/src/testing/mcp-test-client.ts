import {
  MCP_ACCEPT_HEADER,
  MCP_CONTENT_TYPE,
  MCP_JSON_RPC_VERSION,
} from '../constants'

export { MCP_ACCEPT_HEADER, MCP_CONTENT_TYPE, MCP_JSON_RPC_VERSION }

export function mcpHeaders(host = 'localhost:3000', sessionId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    host,
    accept: MCP_ACCEPT_HEADER,
    'content-type': MCP_CONTENT_TYPE,
  }

  if (sessionId) {
    headers['mcp-session-id'] = sessionId
  }

  return headers
}

export function parseSseJson(body: string): unknown {
  const dataLines = body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))

  if (dataLines.length === 0) {
    return JSON.parse(body)
  }

  return JSON.parse(dataLines.at(-1) ?? dataLines[0] ?? '{}')
}

export async function readMcpJsonResponse(response: Response): Promise<unknown> {
  return parseSseJson(await response.text())
}

export interface JsonRpcRequest {
  jsonrpc: typeof MCP_JSON_RPC_VERSION
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

export async function postMcpJson(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  path: string,
  body: JsonRpcRequest | Record<string, unknown>,
  options: { host?: string; sessionId?: string } = {}
): Promise<Response> {
  return request(path, {
    method: 'POST',
    headers: mcpHeaders(options.host, options.sessionId),
    body: JSON.stringify(body),
  })
}
