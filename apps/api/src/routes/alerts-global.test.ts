import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  alertEventRepository,
  alertRuleRepository,
  closeDb,
  decryptSecret,
  getDb,
  linearIntegrationRepository,
  organization,
  redisConnection,
} from '@durabull/dal'
import { env } from '@durabull/env'
import { Hono } from 'hono'

const TEST_ORG_ID = 'alert-global-org'
const FIRST_CONNECTION_ID = '66666666-6666-4666-8666-666666666666'
const SECOND_CONNECTION_ID = '77777777-7777-4777-8777-777777777777'

const mutableEnv = env as {
  DATABASE_URL?: string
  DURABULL_SECRET_ENCRYPTION_KEY?: string
  LINEAR_OAUTH_CLIENT_ID?: string
  LINEAR_OAUTH_CLIENT_SECRET?: string
  LINEAR_OAUTH_REDIRECT_URI?: string
  APP_BASE_URL: string
}

const originalDatabaseUrl = mutableEnv.DATABASE_URL
const originalSecretKey = mutableEnv.DURABULL_SECRET_ENCRYPTION_KEY
const originalLinearClientId = mutableEnv.LINEAR_OAUTH_CLIENT_ID
const originalLinearClientSecret = mutableEnv.LINEAR_OAUTH_CLIENT_SECRET
const originalLinearRedirectUri = mutableEnv.LINEAR_OAUTH_REDIRECT_URI
const originalAppBaseUrl = mutableEnv.APP_BASE_URL
const originalPgliteDir = process.env.DURABULL_PGLITE_DIR

let tempPgliteDir = ''

const exchangeLinearOauthCodeMock = mock(async () => ({
  accessToken: 'linear-access-token',
  refreshToken: 'linear-refresh-token',
  tokenType: 'Bearer',
  expiresIn: 86_399,
  scopes: 'read issues:create',
  accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
}))
const validateLinearAccessTokenMock = mock(async () => ({ organizationName: 'Acme' }))
const fetchLinearMetadataMock = mock(async () => ({
  teams: [],
  projects: [],
  labels: [],
  users: [],
  states: [],
}))
const revokeLinearOauthTokenMock = mock(async () => undefined)
const refreshLinearOauthTokenMock = mock(async () => ({
  accessToken: 'refreshed-linear-access-token',
  refreshToken: 'refreshed-linear-refresh-token',
  tokenType: 'Bearer',
  expiresIn: 86_399,
  scopes: 'read issues:create',
  accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
}))

mock.module('../lib/linear-client', () => ({
  exchangeLinearOauthCode: exchangeLinearOauthCodeMock,
  validateLinearAccessToken: validateLinearAccessTokenMock,
  fetchLinearMetadata: fetchLinearMetadataMock,
  revokeLinearOauthToken: revokeLinearOauthTokenMock,
  refreshLinearOauthToken: refreshLinearOauthTokenMock,
  LinearApiError: class LinearApiError extends Error {
    status = 400
    retryable = false
  },
}))

async function seedOrganization() {
  const db = await getDb()
  const now = new Date()

  await db.insert(organization).values({
    id: TEST_ORG_ID,
    name: 'Alert Global Org',
    slug: 'alert-global-org',
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(redisConnection).values([
    {
      id: FIRST_CONNECTION_ID,
      name: 'Primary Redis',
      url: 'redis://localhost:6379/0',
      environment: 'development',
      isDefault: true,
      organizationId: TEST_ORG_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SECOND_CONNECTION_ID,
      name: 'Worker Redis',
      url: 'redis://localhost:6379/1',
      environment: 'staging',
      isDefault: false,
      organizationId: TEST_ORG_ID,
      createdAt: now,
      updatedAt: now,
    },
  ])
}

async function createGlobalAlertsRouteApp() {
  const { default: alertsGlobalRoutes } = await import('./alerts-global')

  return new Hono()
    .use('*', async (c, next) => {
      c.set('organizationId', TEST_ORG_ID)
      c.set('user', {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await next()
    })
    .route('/', alertsGlobalRoutes)
}

describe('global alerts routes', () => {
  beforeEach(async () => {
    tempPgliteDir = await mkdtemp(join(tmpdir(), 'durabull-alert-global-routes-'))
    process.env.DURABULL_PGLITE_DIR = tempPgliteDir
    delete process.env.DATABASE_URL
    mutableEnv.DATABASE_URL = undefined
    mutableEnv.DURABULL_SECRET_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    mutableEnv.LINEAR_OAUTH_CLIENT_ID = 'linear-client-id'
    mutableEnv.LINEAR_OAUTH_CLIENT_SECRET = 'linear-client-secret'
    mutableEnv.LINEAR_OAUTH_REDIRECT_URI =
      'https://app.durabull.test/api/alerts/integrations/linear/callback'
    mutableEnv.APP_BASE_URL = 'https://app.durabull.test'
    exchangeLinearOauthCodeMock.mockClear()
    validateLinearAccessTokenMock.mockClear()
    fetchLinearMetadataMock.mockClear()
    revokeLinearOauthTokenMock.mockClear()
    refreshLinearOauthTokenMock.mockClear()
    await closeDb()
    await seedOrganization()
  })

  afterEach(async () => {
    await closeDb()
    mutableEnv.DATABASE_URL = originalDatabaseUrl
    mutableEnv.DURABULL_SECRET_ENCRYPTION_KEY = originalSecretKey
    mutableEnv.LINEAR_OAUTH_CLIENT_ID = originalLinearClientId
    mutableEnv.LINEAR_OAUTH_CLIENT_SECRET = originalLinearClientSecret
    mutableEnv.LINEAR_OAUTH_REDIRECT_URI = originalLinearRedirectUri
    mutableEnv.APP_BASE_URL = originalAppBaseUrl

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

  it('returns organization-wide event history filtered by status', async () => {
    const firstRule = await alertRuleRepository.create({
      organizationId: TEST_ORG_ID,
      connectionId: FIRST_CONNECTION_ID,
      queueName: 'email-send',
      name: 'Email failures',
      type: 'failure_threshold',
      config: { count: 5, windowMinutes: 5 },
      cooldownMinutes: 30,
    })
    const secondRule = await alertRuleRepository.create({
      organizationId: TEST_ORG_ID,
      connectionId: SECOND_CONNECTION_ID,
      queueName: 'invoice-send',
      name: 'Invoice failures',
      type: 'failure_threshold',
      config: { count: 5, windowMinutes: 5 },
      cooldownMinutes: 30,
    })

    await alertEventRepository.create({
      alertRuleId: firstRule.id,
      organizationId: TEST_ORG_ID,
      connectionId: FIRST_CONNECTION_ID,
      queueName: 'email-send',
      type: firstRule.type,
      status: 'resolved',
      summary: 'Resolved incident',
      context: {},
      firedAt: new Date(Date.now() - 10 * 60_000),
    })
    await alertEventRepository.create({
      alertRuleId: secondRule.id,
      organizationId: TEST_ORG_ID,
      connectionId: SECOND_CONNECTION_ID,
      queueName: 'invoice-send',
      type: secondRule.type,
      status: 'firing',
      summary: 'Active incident',
      context: {},
      firedAt: new Date(),
    })

    const app = await createGlobalAlertsRouteApp()
    const response = await app.request('/events?status=resolved')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      events: [expect.objectContaining({ status: 'resolved', connectionId: FIRST_CONNECTION_ID })],
    })
  })

  it('returns open incident counts grouped by connection', async () => {
    const firstRule = await alertRuleRepository.create({
      organizationId: TEST_ORG_ID,
      connectionId: FIRST_CONNECTION_ID,
      queueName: 'email-send',
      name: 'Email failures',
      type: 'failure_threshold',
      config: { count: 5, windowMinutes: 5 },
      cooldownMinutes: 30,
    })
    const secondRule = await alertRuleRepository.create({
      organizationId: TEST_ORG_ID,
      connectionId: SECOND_CONNECTION_ID,
      queueName: 'invoice-send',
      name: 'Invoice failures',
      type: 'failure_threshold',
      config: { count: 5, windowMinutes: 5 },
      cooldownMinutes: 30,
    })

    await alertEventRepository.create({
      alertRuleId: firstRule.id,
      organizationId: TEST_ORG_ID,
      connectionId: FIRST_CONNECTION_ID,
      queueName: 'email-send',
      type: firstRule.type,
      status: 'firing',
      summary: 'Primary incident',
      context: {},
      firedAt: new Date(),
    })
    await alertEventRepository.create({
      alertRuleId: firstRule.id,
      organizationId: TEST_ORG_ID,
      connectionId: FIRST_CONNECTION_ID,
      queueName: 'email-send',
      type: firstRule.type,
      status: 'firing',
      summary: 'Primary incident 2',
      context: {},
      firedAt: new Date(Date.now() - 1_000),
    })
    await alertEventRepository.create({
      alertRuleId: secondRule.id,
      organizationId: TEST_ORG_ID,
      connectionId: SECOND_CONNECTION_ID,
      queueName: 'invoice-send',
      type: secondRule.type,
      status: 'resolved',
      summary: 'Resolved elsewhere',
      context: {},
      firedAt: new Date(),
    })

    const app = await createGlobalAlertsRouteApp()
    const response = await app.request('/summary')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      connections: [{ connectionId: FIRST_CONNECTION_ID, count: 2 }],
    })
  })

  it('stores Linear OAuth tokens encrypted and returns only connection metadata', async () => {
    const app = await createGlobalAlertsRouteApp()
    const connectResponse = await app.request('/integrations/linear/connect', { method: 'POST' })

    expect(connectResponse.status).toBe(200)
    const connectBody = (await connectResponse.json()) as { authorizationUrl: string }
    const authorizeUrl = new URL(connectBody.authorizationUrl)
    expect(`${authorizeUrl.origin}${authorizeUrl.pathname}`).toBe(
      'https://linear.app/oauth/authorize'
    )
    expect(authorizeUrl.searchParams.get('client_id')).toBe('linear-client-id')
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
      'https://app.durabull.test/api/alerts/integrations/linear/callback'
    )
    expect(authorizeUrl.searchParams.get('scope')).toBe('read,issues:create')

    const state = authorizeUrl.searchParams.get('state')
    expect(state).toBeTruthy()

    const callbackResponse = await app.request(
      `/integrations/linear/callback?code=linear-code&state=${state}`
    )
    expect(callbackResponse.status).toBe(302)
    expect(callbackResponse.headers.get('location')).toBe(
      'https://app.durabull.test/settings?linear=connected'
    )
    expect(exchangeLinearOauthCodeMock).toHaveBeenCalledWith({
      code: 'linear-code',
      redirectUri: 'https://app.durabull.test/api/alerts/integrations/linear/callback',
      clientId: 'linear-client-id',
      clientSecret: 'linear-client-secret',
    })
    expect(validateLinearAccessTokenMock).toHaveBeenCalledWith('linear-access-token')

    const response = await app.request('/integrations/linear')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      integration: {
        connected: true,
        validationStatus: 'valid',
        scopes: 'read issues:create',
        linearOrganizationName: 'Acme',
      },
    })

    const stored = await linearIntegrationRepository.findByOrganization(TEST_ORG_ID)
    expect(stored?.encryptedAccessToken).not.toContain('linear-access-token')
    expect(stored?.encryptedRefreshToken).not.toContain('linear-refresh-token')
    expect(decryptSecret(stored?.encryptedAccessToken ?? '')).toBe('linear-access-token')
    expect(decryptSecret(stored?.encryptedRefreshToken ?? '')).toBe('linear-refresh-token')
  })
})
