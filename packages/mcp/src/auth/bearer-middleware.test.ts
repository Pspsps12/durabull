import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'

import { createMcpBearerAuthMiddleware } from './bearer-middleware'
import { MCP_SCOPE_DISCOVER } from './scopes'

const canonicalResourceUri = 'http://localhost:3000/mcp'
const resourceMetadataUrl = 'http://localhost:3000/.well-known/oauth-protected-resource'

describe('createMcpBearerAuthMiddleware', () => {
  const app = new Hono()
  app.use(
    '*',
    createMcpBearerAuthMiddleware({
      canonicalResourceUri,
      resourceMetadataUrl,
      requiredScopes: [MCP_SCOPE_DISCOVER],
      verifyAccessToken: async (token) => {
        if (token === 'throws') {
          throw new Error('verification backend unavailable')
        }

        if (token === 'valid') {
          return {
            accessToken: token,
            clientId: 'client',
            userId: 'user',
            scopes: [MCP_SCOPE_DISCOVER],
            accessTokenExpiresAt: new Date(Date.now() + 60_000),
            resource: canonicalResourceUri,
          }
        }

        if (token === 'wrong-resource') {
          return {
            accessToken: token,
            clientId: 'client',
            userId: 'user',
            scopes: [MCP_SCOPE_DISCOVER],
            accessTokenExpiresAt: new Date(Date.now() + 60_000),
            resource: 'http://evil.example.com/mcp',
          }
        }

        if (token === 'missing-scope') {
          return {
            accessToken: token,
            clientId: 'client',
            userId: 'user',
            scopes: ['openid'],
            accessTokenExpiresAt: new Date(Date.now() + 60_000),
            resource: null,
          }
        }

        return null
      },
    })
  )
  app.get('/', (c) => c.json({ ok: true }))

  it('returns 401 with WWW-Authenticate when Authorization is missing', async () => {
    const response = await app.request('/', { headers: { host: 'localhost:3000' } })

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain(resourceMetadataUrl)
  })

  it('returns 401 for invalid tokens', async () => {
    const response = await app.request('/', {
      headers: {
        host: 'localhost:3000',
        authorization: 'Bearer invalid',
      },
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('error="invalid_token"')
  })

  it('returns 401 for wrong resource binding', async () => {
    const response = await app.request('/', {
      headers: {
        host: 'localhost:3000',
        authorization: 'Bearer wrong-resource',
      },
    })

    expect(response.status).toBe(401)
  })

  it('returns 403 with scope challenge when scope is missing', async () => {
    const response = await app.request('/', {
      headers: {
        host: 'localhost:3000',
        authorization: 'Bearer missing-scope',
      },
    })

    expect(response.status).toBe(403)
    const challenge = response.headers.get('WWW-Authenticate') ?? ''
    expect(challenge).toContain('insufficient_scope')
    expect(challenge).toContain(MCP_SCOPE_DISCOVER)
  })

  it('allows valid bearer tokens through', async () => {
    const response = await app.request('/', {
      headers: {
        host: 'localhost:3000',
        authorization: 'Bearer valid',
      },
    })

    expect(response.status).toBe(200)
  })

  it('returns 401 when token verification throws', async () => {
    const response = await app.request('/', {
      headers: {
        host: 'localhost:3000',
        authorization: 'Bearer throws',
      },
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('invalid_token')
    expect(response.headers.get('WWW-Authenticate')).toContain(resourceMetadataUrl)
  })
})
