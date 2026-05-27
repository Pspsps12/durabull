import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import {
  closeDb,
  getDb,
  mcpPolicyBinding,
  mcpServiceAccount,
  member,
  oauthAccessToken,
  oauthApplication,
  organization,
  redisConnection,
  redisConnectionRepository,
  user,
} from '@durabull/dal'
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
const originalRedisUrlEncryptionKey = process.env.DURABULL_REDIS_URL_ENCRYPTION_KEY

const authlessAuthorization = `Bearer ${DEFAULT_AUTHLESS_MCP_BEARER_TOKEN}`
const mcpResource = 'http://localhost:3000/mcp'
const resourceMetadataUrl =
  'http://localhost:3000/api/auth/.well-known/oauth-protected-resource'

const TEST_REDIS_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

let tempPgliteDir = ''
let app: Hono

describe('api MCP ingress', () => {
  beforeEach(async () => {
    tempPgliteDir = await mkdtemp(join(tmpdir(), 'durabull-api-mcp-'))
    process.env.DURABULL_PGLITE_DIR = tempPgliteDir
    mutableEnv.APP_BASE_URL = 'http://localhost:3000'
    mutableEnv.DURABULL_AUTHLESS = true
    process.env.DURABULL_REDIS_URL_ENCRYPTION_KEY = TEST_REDIS_ENCRYPTION_KEY
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

    if (originalRedisUrlEncryptionKey) {
      process.env.DURABULL_REDIS_URL_ENCRYPTION_KEY = originalRedisUrlEncryptionKey
    } else {
      delete process.env.DURABULL_REDIS_URL_ENCRYPTION_KEY
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
    const toolNames = listPayload.result?.tools?.map((tool) => tool.name) ?? []
    expect(toolNames).toContain('ping')
    expect(toolNames).toContain('list_connections')
    expect(toolNames).toContain('list_queues')
    expect(toolNames).toContain('get_queue')
    expect(toolNames).toContain('list_jobs')
    expect(toolNames).toContain('get_job')
    expect(toolNames).toContain('get_job_logs')
    expect(toolNames).toContain('get_job_stacktraces')

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

  it('returns 403 for tools requiring mcp:jobs:read when token only has mcp:discover', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const now = new Date()
    const userId = `scope-user-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(user).values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: 'Scope Test User',
      createdAt: now,
      updatedAt: now,
      image: null,
      lastSignInAt: null,
    })
    const clientId = `scope-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'scope-test-client',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'public',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })

    const token = `scope-token-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: token,
      refreshToken: `refresh-${token}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId,
      scopes: 'mcp:discover',
      resource: mcpResource,
      createdAt: now,
      updatedAt: now,
    })

    const initResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'scope-test', version: '1.0.0' },
        },
      },
      { authorization: `Bearer ${token}` }
    )
    expect(initResponse.status).toBe(200)
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const response = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_connections',
          arguments: {
            pageSize: 10,
          },
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )

    expect(response.status).toBe(403)
    const denialBody = await response.text()
    expect(denialBody).toContain('missing_scopes')
    expect(denialBody).toContain('mcp:jobs:read')
  })

  it('returns 403 for logs tools when token lacks mcp:logs:read scope', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const now = new Date()
    const userId = `logs-user-${crypto.randomUUID().slice(0, 8)}`
    const orgId = `logs-org-${crypto.randomUUID().slice(0, 8)}`

    await db.insert(user).values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: 'Logs Scope User',
      createdAt: now,
      updatedAt: now,
      image: null,
      lastSignInAt: null,
    })
    await db.insert(organization).values({
      id: orgId,
      name: 'Logs Scope Org',
      slug: `logs-scope-org-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    })
    const [connection] = await db
      .insert(redisConnection)
      .values({
        id: crypto.randomUUID(),
        name: 'Logs Scope Connection',
        url: 'redis://localhost:6379/3',
        isDefault: true,
        environment: 'development',
        prefix: 'bull',
        allowSelfSignedCerts: false,
        organizationId: orgId,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId,
      role: 'member',
      createdAt: now,
      updatedAt: now,
    })
    const clientId = `logs-scope-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'logs-scope-client',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'public',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })
    const token = `logs-scope-token-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: token,
      refreshToken: `refresh-${token}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId,
      scopes: 'mcp:discover mcp:jobs:read',
      resource: mcpResource,
      createdAt: now,
      updatedAt: now,
    })

    const initResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'logs-scope-test', version: '1.0.0' },
        },
      },
      { authorization: `Bearer ${token}` }
    )
    expect(initResponse.status).toBe(200)
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const response = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_job_logs',
          arguments: {
            connectionId: connection.id,
            queueName: 'emails',
            jobId: 'abc',
            pageSize: 10,
          },
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )

    expect(response.status).toBe(403)
    const denialBody = await response.text()
    expect(denialBody).toContain('missing_scopes')
    expect(denialBody).toContain('mcp:logs:read')
  })

  it('denies service-account tool calls without policy bindings', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const now = new Date()
    const orgId = `org-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(organization).values({
      id: orgId,
      name: 'Service Account Org',
      slug: `service-account-org-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    })

    const clientId = `svc-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'service-account-client',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'confidential',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })
    const [serviceAccount] = await db
      .insert(mcpServiceAccount)
      .values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        name: 'svc-account',
        oauthClientId: clientId,
        disabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    expect(serviceAccount.id).toBeDefined()

    const token = `svc-token-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: token,
      refreshToken: `refresh-${token}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId: null,
      scopes: 'mcp:discover',
      resource: mcpResource,
      createdAt: now,
      updatedAt: now,
    })

    const initResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'svc-test', version: '1.0.0' },
        },
      },
      { authorization: `Bearer ${token}` }
    )
    expect(initResponse.status).toBe(200)
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const callResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {},
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )
    expect(callResponse.status).toBe(403)
  })

  it('fails closed when a disabled service-account client presents a user token', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const now = new Date()
    const userId = `disabled-svc-user-${crypto.randomUUID().slice(0, 8)}`
    const orgId = `org-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(user).values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: 'Disabled Service Account User',
      createdAt: now,
      updatedAt: now,
      image: null,
      lastSignInAt: null,
    })
    await db.insert(organization).values({
      id: orgId,
      name: 'Disabled Service Account Org',
      slug: `disabled-service-account-org-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    })

    const clientId = `disabled-svc-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'disabled-service-account-client',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'confidential',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(mcpServiceAccount).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      name: 'disabled-svc-account',
      oauthClientId: clientId,
      disabled: true,
      createdAt: now,
      updatedAt: now,
    })

    const token = `disabled-svc-token-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: token,
      refreshToken: `refresh-${token}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId,
      scopes: 'mcp:discover mcp:jobs:read',
      resource: mcpResource,
      createdAt: now,
      updatedAt: now,
    })

    const initResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'disabled-svc-test', version: '1.0.0' },
        },
      },
      { authorization: `Bearer ${token}` }
    )
    expect(initResponse.status).toBe(200)
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const callResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_connections',
          arguments: { pageSize: 10 },
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )

    expect(callResponse.status).toBe(403)
    const denialBody = await callResponse.text()
    expect(denialBody).toContain('principal resolution failed')
  })

  it('allows service-account ping when a matching policy binding exists', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const now = new Date()
    const orgId = `org-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(organization).values({
      id: orgId,
      name: 'Service Account Allowed Org',
      slug: `service-account-allowed-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    })

    const clientId = `svc-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'service-account-allowed-client',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'confidential',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })
    const [serviceAccount] = await db
      .insert(mcpServiceAccount)
      .values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        name: 'svc-account-allowed',
        oauthClientId: clientId,
        disabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    await db.insert(mcpPolicyBinding).values({
      id: crypto.randomUUID(),
      principalType: 'service_account',
      principalId: serviceAccount.id,
      organizationId: orgId,
      toolName: 'ping',
      scope: 'mcp:discover',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })

    const token = `svc-token-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: token,
      refreshToken: `refresh-${token}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId: null,
      scopes: 'mcp:discover',
      resource: mcpResource,
      createdAt: now,
      updatedAt: now,
    })

    const initResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'svc-test', version: '1.0.0' },
        },
      },
      { authorization: `Bearer ${token}` }
    )
    expect(initResponse.status).toBe(200)
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const callResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {},
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )

    expect(callResponse.status).toBe(200)
    const callPayload = parseSseJson(await callResponse.text()) as {
      result?: { content?: Array<{ text?: string }> }
    }
    expect(callPayload.result?.content?.[0]?.text).toBe('pong')
  })

  it('denies delegated-user tool calls when connection is outside membership boundary', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const now = new Date()
    const userId = `user-${crypto.randomUUID().slice(0, 8)}`
    const memberOrgId = `org-${crypto.randomUUID().slice(0, 8)}`
    const otherOrgId = `org-${crypto.randomUUID().slice(0, 8)}`

    await db.insert(organization).values([
      {
        id: memberOrgId,
        name: 'Member Org',
        slug: `member-org-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: otherOrgId,
        name: 'Other Org',
        slug: `other-org-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      },
    ])
    await db.insert(user).values({
      id: userId,
      email: `user-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      name: 'MCP Delegated User',
      createdAt: now,
      updatedAt: now,
      image: null,
      lastSignInAt: null,
    })
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: memberOrgId,
      userId,
      role: 'member',
      createdAt: now,
      updatedAt: now,
    })
    const [otherConnection] = await db
      .insert(redisConnection)
      .values({
        id: crypto.randomUUID(),
        name: 'Other Connection',
        url: 'redis://localhost:6379/1',
        isDefault: true,
        environment: 'development',
        prefix: 'bull',
        allowSelfSignedCerts: false,
        organizationId: otherOrgId,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    const clientId = `delegated-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'delegated-client',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'public',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })
    const token = `delegated-token-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: token,
      refreshToken: `refresh-${token}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId,
      scopes: 'mcp:discover',
      resource: mcpResource,
      createdAt: now,
      updatedAt: now,
    })

    const initResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'delegated-test', version: '1.0.0' },
        },
      },
      { authorization: `Bearer ${token}` }
    )
    expect(initResponse.status).toBe(200)
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const callResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {
            connectionId: otherConnection.id,
          },
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )
    expect(callResponse.status).toBe(403)
  })

  it('returns paginated list_connections results for delegated users', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const now = new Date()
    const userId = `user-${crypto.randomUUID().slice(0, 8)}`
    const orgId = `org-${crypto.randomUUID().slice(0, 8)}`

    await db.insert(organization).values({
      id: orgId,
      name: 'Delegated List Org',
      slug: `delegated-list-org-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(user).values({
      id: userId,
      email: `list-user-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      name: 'List User',
      createdAt: now,
      updatedAt: now,
      image: null,
      lastSignInAt: null,
    })
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId,
      role: 'member',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(redisConnection).values([
      {
        id: crypto.randomUUID(),
        name: 'Conn A',
        url: 'redis://localhost:6379/0',
        isDefault: true,
        environment: 'development',
        prefix: 'bull',
        allowSelfSignedCerts: false,
        organizationId: orgId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: 'Conn B',
        url: 'redis://localhost:6379/1',
        isDefault: false,
        environment: 'staging',
        prefix: 'bull',
        allowSelfSignedCerts: false,
        organizationId: orgId,
        createdAt: now,
        updatedAt: now,
      },
    ])

    const clientId = `delegated-list-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'delegated-list-client',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'public',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })
    const token = `delegated-list-token-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: token,
      refreshToken: `refresh-${token}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId,
      scopes: 'mcp:discover mcp:jobs:read',
      resource: mcpResource,
      createdAt: now,
      updatedAt: now,
    })

    const initResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'delegated-list-test', version: '1.0.0' },
        },
      },
      { authorization: `Bearer ${token}` }
    )
    expect(initResponse.status).toBe(200)
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const firstCall = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_connections',
          arguments: {
            pageSize: 1,
          },
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )
    expect(firstCall.status).toBe(200)
    const firstPayload = parseSseJson(await firstCall.text()) as {
      result?: { content?: Array<{ text?: string }> }
    }
    const firstResult = JSON.parse(firstPayload.result?.content?.[0]?.text ?? '{}') as {
      connections?: Array<{ name: string }>
      nextCursor?: string | null
    }
    expect(firstResult.connections?.length).toBe(1)
    expect(firstResult.nextCursor).toBeDefined()

    const secondCall = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_connections',
          arguments: {
            pageSize: 1,
            cursor: firstResult.nextCursor,
          },
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )
    expect(secondCall.status).toBe(200)
    const secondPayload = parseSseJson(await secondCall.text()) as {
      result?: { content?: Array<{ text?: string }> }
    }
    const secondResult = JSON.parse(secondPayload.result?.content?.[0]?.text ?? '{}') as {
      connections?: Array<{ name: string }>
    }
    expect(secondResult.connections?.length).toBe(1)
  })

  it('allows service-account list_connections with matching scope and policy binding', async () => {
    mutableEnv.DURABULL_AUTHLESS = false
    await closeDb()
    ;({ app } = await createApiApp({ enableLogging: false }))

    const db = await getDb()
    const now = new Date()
    const orgId = `org-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(organization).values({
      id: orgId,
      name: 'Service Account List Org',
      slug: `service-account-list-org-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    })
    await redisConnectionRepository.create({
      name: 'Service Account Conn',
      url: 'redis://localhost:6379/2',
      isDefault: true,
      environment: 'development',
      prefix: 'bull',
      allowSelfSignedCerts: false,
      organizationId: orgId,
    })

    const clientId = `svc-list-client-${crypto.randomUUID().slice(0, 8)}`
    await db.insert(oauthApplication).values({
      id: crypto.randomUUID(),
      name: 'service-account-list-client',
      clientId,
      redirectUrls: 'http://127.0.0.1/callback',
      type: 'confidential',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })
    const [serviceAccount] = await db
      .insert(mcpServiceAccount)
      .values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        name: 'svc-list-account',
        oauthClientId: clientId,
        disabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    await db.insert(mcpPolicyBinding).values({
      id: crypto.randomUUID(),
      principalType: 'service_account',
      principalId: serviceAccount.id,
      organizationId: orgId,
      toolName: 'list_connections',
      scope: 'mcp:jobs:read',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    })

    const token = `svc-list-token-${crypto.randomUUID().slice(0, 8)}`
    const future = new Date(Date.now() + 3600_000)
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      accessToken: token,
      refreshToken: `refresh-${token}`,
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
      clientId,
      userId: null,
      scopes: 'mcp:discover mcp:jobs:read',
      resource: mcpResource,
      createdAt: now,
      updatedAt: now,
    })

    const initResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'svc-list-test', version: '1.0.0' },
        },
      },
      { authorization: `Bearer ${token}` }
    )
    expect(initResponse.status).toBe(200)
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const callResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_connections',
          arguments: { pageSize: 10 },
        },
      },
      { authorization: `Bearer ${token}`, sessionId: sessionId ?? undefined }
    )
    expect(callResponse.status).toBe(200)
    const payload = parseSseJson(await callResponse.text()) as {
      result?: { content?: Array<{ text?: string }> }
    }
    const parsed = JSON.parse(payload.result?.content?.[0]?.text ?? '{}') as {
      connections?: Array<{ name: string }>
    }
    expect(parsed.connections?.map((connection) => connection.name)).toContain('Service Account Conn')
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
