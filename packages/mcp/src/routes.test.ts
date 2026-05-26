import { describe, expect, it } from 'bun:test'

import { MCP_PROTOCOL_VERSION } from './constants'
import { createMcpRoutes } from './routes'
import {
  MCP_JSON_RPC_VERSION,
  postMcpJson,
  readMcpJsonResponse,
} from './testing/mcp-test-client'

describe('createMcpRoutes', () => {
  const app = createMcpRoutes({
    version: 'test',
    allowedHosts: new Set(['localhost', '127.0.0.1', 'localhost:3000']),
    corsOrigins: ['http://localhost:3000'],
  })

  const postMcp = (body: Parameters<typeof postMcpJson>[2], options?: Parameters<typeof postMcpJson>[3]) =>
    postMcpJson((path, init) => Promise.resolve(app.request(path, init)), '/', body, options)

  it('rejects invalid Host header with 403', async () => {
    const response = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
      { host: 'evil.example.com' }
    )

    expect(response.status).toBe(403)
  })

  it('rejects host header with fake port suffix', async () => {
    const response = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
      { host: 'localhost:3000.evil' }
    )

    expect(response.status).toBe(403)
  })

  it('initializes MCP session and lists ping tool', async () => {
    const initResponse = await postMcp({
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    })

    expect(initResponse.status).toBe(200)
    const initPayload = (await readMcpJsonResponse(initResponse)) as {
      result?: { protocolVersion?: string }
    }
    expect(initPayload.result?.protocolVersion).toBeTruthy()

    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        method: 'notifications/initialized',
      },
      { sessionId: sessionId ?? undefined }
    )

    const listResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/list',
        params: {},
      },
      { sessionId: sessionId ?? undefined }
    )

    expect(listResponse.status).toBe(200)
    const listPayload = (await readMcpJsonResponse(listResponse)) as {
      result?: { tools?: Array<{ name: string }> }
    }
    expect(listPayload.result?.tools?.map((tool) => tool.name)).toContain('ping')
  })

  it('calls ping and returns pong', async () => {
    const initResponse = await postMcp({
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    })

    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        method: 'notifications/initialized',
      },
      { sessionId: sessionId ?? undefined }
    )

    const callResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {},
        },
      },
      { sessionId: sessionId ?? undefined }
    )

    expect(callResponse.status).toBe(200)
    const callPayload = (await readMcpJsonResponse(callResponse)) as {
      result?: { content?: Array<{ type: string; text?: string }> }
    }
    expect(callPayload.result?.content?.[0]?.text).toBe('pong')
  })
})
