import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'

const MCP_PROTOCOL_VERSION = '2024-11-05'
const MCP_JSON_RPC_VERSION = '2.0'

function parseSseJson(body: string): unknown {
  const trimmed = body.trim()
  const lastEvent = trimmed.split('\n\n').at(-1) ?? trimmed
  const dataLines = lastEvent
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))
  return JSON.parse(dataLines.join('\n') || trimmed)
}

const WEB_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
const CANONICAL_MCP_RESOURCE = `${WEB_BASE_URL.replace(/\/$/, '')}/mcp`
const MCP_CALLBACK_URL = 'http://127.0.0.1:8765/callback'

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url')
}

function createPkcePair() {
  const codeVerifier = base64UrlEncode(randomBytes(32))
  const codeChallenge = base64UrlEncode(createHash('sha256').update(codeVerifier).digest())
  return { codeVerifier, codeChallenge }
}

async function assertProtectedResourceMetadata(): Promise<void> {
  const response = await fetch(
    `${WEB_BASE_URL}/api/auth/.well-known/oauth-protected-resource`
  )
  expect(response.ok).toBeTruthy()
  const body = (await response.json()) as { resource?: string }
  expect(body.resource).toBe(CANONICAL_MCP_RESOURCE)
}

async function registerMcpOAuthClient() {
  const response = await fetch(`${WEB_BASE_URL}/api/auth/mcp/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: [MCP_CALLBACK_URL],
      client_name: `playwright-mcp-oauth-${Date.now()}`,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    }),
  })
  const text = await response.text()
  expect(response.ok, `register failed: ${response.status} ${text}`).toBeTruthy()
  const body = JSON.parse(text) as { client_id?: string }
  expect(body.client_id).toBeTruthy()
  return body.client_id as string
}

function buildAuthorizeUrl(input: {
  clientId: string
  resource: string
  codeChallenge: string
  state: string
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: MCP_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid mcp:discover',
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    resource: input.resource,
    prompt: 'consent',
  })
  return `${WEB_BASE_URL}/api/auth/mcp/authorize?${params.toString()}`
}

test.describe('MCP OAuth browser flow', () => {
  test('register → authorize → consent → token → MCP ping', async ({ page }) => {
    await assertProtectedResourceMetadata()
    const resource = CANONICAL_MCP_RESOURCE
    const clientId = await registerMcpOAuthClient()
    const { codeVerifier, codeChallenge } = createPkcePair()
    const state = `pw-${randomBytes(8).toString('hex')}`

    const authorizeUrl = buildAuthorizeUrl({
      clientId,
      resource,
      codeChallenge,
      state,
    })

    let authorizationCode: string | null = null
    let callbackState: string | null = null
    await page.route(`${MCP_CALLBACK_URL}**`, async (route) => {
      const callbackUrl = new URL(route.request().url())
      authorizationCode = callbackUrl.searchParams.get('code')
      callbackState = callbackUrl.searchParams.get('state')
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'ok',
      })
    })

    await page.goto(authorizeUrl, { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/consent/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Authorize application' })).toBeVisible()
    await expect(page.getByTestId('mcp-consent-allow')).toBeEnabled({ timeout: 30_000 })

    await page.getByTestId('mcp-consent-allow').click()
    await expect
      .poll(() => authorizationCode, { timeout: 30_000 })
      .not.toBeNull()

    const code = authorizationCode
    expect(code).toBeTruthy()
    expect(callbackState).toBe(state)

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: MCP_CALLBACK_URL,
      client_id: clientId,
      code_verifier: codeVerifier,
      resource,
    })
    const tokenResponse = await fetch(`${WEB_BASE_URL}/api/auth/mcp/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })
    const tokenText = await tokenResponse.text()
    expect(tokenResponse.ok, `token failed: ${tokenResponse.status} ${tokenText}`).toBeTruthy()
    const tokenBody = JSON.parse(tokenText) as { access_token?: string; scope?: string }
    expect(tokenBody.access_token).toBeTruthy()
    expect(tokenBody.scope).toContain('mcp:discover')

    const sessionCheck = await fetch(`${WEB_BASE_URL}/api/auth/mcp/get-session`, {
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    })
    const sessionBody = await sessionCheck.json()
    expect(sessionCheck.ok, `get-session failed: ${JSON.stringify(sessionBody)}`).toBeTruthy()
    expect(sessionBody).not.toBeNull()

    const mcpHost = new URL(CANONICAL_MCP_RESOURCE).host
    const initResponse = await fetch(CANONICAL_MCP_RESOURCE, {
      method: 'POST',
      headers: {
        host: mcpHost,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: `Bearer ${tokenBody.access_token}`,
      },
      body: JSON.stringify({
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'playwright-mcp-oauth', version: '1.0.0' },
        },
      }),
    })

    const initText = await initResponse.text()
    expect(initResponse.status, `initialize failed: ${initResponse.status} ${initText}`).toBe(
      200
    )
    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const initBody = parseSseJson(initText) as {
      result?: { serverInfo?: { name?: string } }
    }
    expect(initBody.result?.serverInfo?.name).toBe('durabull-mcp')

    await fetch(CANONICAL_MCP_RESOURCE, {
      method: 'POST',
      headers: {
        host: mcpHost,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: `Bearer ${tokenBody.access_token}`,
        'mcp-session-id': sessionId as string,
      },
      body: JSON.stringify({
        jsonrpc: MCP_JSON_RPC_VERSION,
        method: 'notifications/initialized',
      }),
    })

    const pingResponse = await fetch(CANONICAL_MCP_RESOURCE, {
      method: 'POST',
      headers: {
        host: mcpHost,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: `Bearer ${tokenBody.access_token}`,
        'mcp-session-id': sessionId as string,
      },
      body: JSON.stringify({
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: { name: 'ping', arguments: {} },
      }),
    })

    expect(pingResponse.ok).toBeTruthy()
    const pingBody = parseSseJson(await pingResponse.text()) as {
      result?: { content?: Array<{ text?: string }> }
    }
    expect(pingBody.result?.content?.[0]?.text).toContain('pong')
  })
})
