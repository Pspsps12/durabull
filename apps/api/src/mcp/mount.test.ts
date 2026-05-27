import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { closeDb, getDb, oauthAccessToken, oauthApplication } from '@durabull/dal'
import { MCP_PROTOCOL_VERSION } from '@durabull/mcp'
import {
  MCP_JSON_RPC_VERSION,
  mcpHeaders,
  parseSseJson,
  postMcpJson,
} from '@durabull/mcp/testing'
import { env } from '@durabull/env'
import { createApiApp } from '../app'
import { DEFAULT_AUTHLESS_MCP_BEARER_TOKEN } from './auth/mcp-auth-config'

const mutableEnv = env as {
  APP_BASE_URL?: string
  DURABULL_AUTHLESS?: boolean
}

const originalAppBaseUrl = mutableEnv.APP_BASE_URL
const originalAuthless = mutableEnv.DURABULL_AUTHLESS
const originalPgliteDir = process.env.DURABULL_PGLITE_DIR

const authlessAuthorization = `Bearer ${DEFAULT_AUTHLESS_MCP_BEARER_TOKEN}`
const mcpResource = 'http://localhost:3000/mcp'
const resourceMetadataUrl =
  'http://localhost:3000/api/auth/.well-known/oauth-protected-resource'

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
    postMcpJson((path, init) => Promise.resolve(app.request(path, init)), '/mcp', body, {
      authorization: authlessAuthorization,
      ...options,
    })

  it('returns 401 with WWW-Authenticate when bearer token is missing', async () => {
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
      { authorization: undefined }
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain(resourceMetadataUrl)
  })

  it('returns 401 for invalid bearer tokens', async () => {
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
      { authorization: 'Bearer not-a-real-token' }
    )

    expect(response.status).toBe(401)
  })

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

  it('exposes protected resource metadata on app origin', async () => {
    const response = await app.request('/.well-known/oauth-protected-resource')

    expect(response.status).toBe(200)
    const metadata = (await response.json()) as {
      resource?: string
      authorization_servers?: string[]
    }
    expect(metadata.resource).toBe('http://localhost:3000/mcp')
    expect(metadata.authorization_servers).toContain('http://localhost:3000/api/auth')
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

  it('returns 401 for expired OAuth access tokens', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const clientId = `test-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'mount-test',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'public',
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const expiredToken = `expired-${crypto.randomUUID().slice(0, 8)}`
    const past = new Date(Date.now() - 60_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: expiredToken,
      refreshToken: `refresh-${expiredToken}`,
      accessTokenExpiresAt: past,
      refreshTokenExpiresAt: past,
      clientId,
      userId: null,
      scopes: 'mcp:discover openid',
      resource: mcpResource,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

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
      { authorization: `Bearer ${expiredToken}` }
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('invalid_token')
  })

  it('returns 403 for OAuth tokens without mcp:discover', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const clientId = `test-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'mount-test',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'public',
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const scopedToken = `scoped-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: scopedToken,
      refreshToken: `refresh-${scopedToken}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId: null,
      scopes: 'openid',
      resource: mcpResource,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

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
      { authorization: `Bearer ${scopedToken}` }
    )

    expect(response.status).toBe(403)
  })

  it('does not treat GET /mcp as SPA static fallback when web build is absent', async () => {
    const response = await app.request('/mcp', {
      method: 'GET',
      headers: {
        ...mcpHeaders('localhost:3000', undefined, authlessAuthorization),
      },
    })

    expect(response.headers.get('content-type')).not.toContain('text/html')
    expect(response.status).toBe(400)
  })
})
