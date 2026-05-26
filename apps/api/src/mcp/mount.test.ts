import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { closeDb } from '@durabull/dal'
import { MCP_PROTOCOL_VERSION } from '@durabull/mcp'
import {
  MCP_JSON_RPC_VERSION,
  mcpHeaders,
  parseSseJson,
  postMcpJson,
} from '@durabull/mcp/testing'
import { env } from '@durabull/env'
import { createApiApp } from '../app'

const mutableEnv = env as {
  APP_BASE_URL?: string
  DURABULL_AUTHLESS?: boolean
}

const originalAppBaseUrl = mutableEnv.APP_BASE_URL
const originalAuthless = mutableEnv.DURABULL_AUTHLESS
const originalPgliteDir = process.env.DURABULL_PGLITE_DIR

let tempPgliteDir = ''
let app: Hono

describe('api MCP ingress', () => {
  beforeEach(async () => {
    tempPgliteDir = await mkdtemp(join(tmpdir(), 'durabull-api-mcp-'))
    process.env.DURABULL_PGLITE_DIR = tempPgliteDir
    mutableEnv.APP_BASE_URL = 'http://localhost:3000'
    mutableEnv.DURABULL_AUTHLESS = true
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))
  })

  afterEach(async () => {
    await closeDb()
    mutableEnv.APP_BASE_URL = originalAppBaseUrl
    mutableEnv.DURABULL_AUTHLESS = originalAuthless

    if (originalPgliteDir) {
      process.env.DURABULL_PGLITE_DIR = originalPgliteDir
    } else {
      delete process.env.DURABULL_PGLITE_DIR
    }

    if (tempPgliteDir) {
      await rm(tempPgliteDir, { recursive: true, force: true })
      tempPgliteDir = ''
    }
  })

  const postMcp = (body: Parameters<typeof postMcpJson>[2], options?: Parameters<typeof postMcpJson>[3]) =>
    postMcpJson((path, init) => app.request(path, init), '/mcp', body, options)

  it('rejects /mcp requests with invalid Host header', async () => {
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
      { host: 'attacker.example.com' }
    )

    expect(response.status).toBe(403)
  })

  it('supports initialize, tools/list, and ping on one app instance', async () => {
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
    const listPayload = parseSseJson(await listResponse.text()) as {
      result?: { tools?: Array<{ name: string }> }
    }
    expect(listPayload.result?.tools?.map((tool) => tool.name)).toContain('ping')

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
    const callPayload = parseSseJson(await callResponse.text()) as {
      result?: { content?: Array<{ type: string; text?: string }> }
    }
    expect(callPayload.result?.content?.[0]?.text).toBe('pong')
  })

  it('does not treat GET /mcp as SPA static fallback when web build is absent', async () => {
    const response = await app.request('/mcp', {
      method: 'GET',
      headers: mcpHeaders(),
    })

    expect(response.headers.get('content-type')).not.toContain('text/html')
  })
})
