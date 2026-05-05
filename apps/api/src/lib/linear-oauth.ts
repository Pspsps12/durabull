import { decryptSecret, linearIntegrationRepository, type LinearIntegration } from '@durabull/dal'
import { env } from '@durabull/env'
import { refreshLinearOauthToken } from './linear-client'

const LINEAR_AUTHORIZATION_URL = 'https://linear.app/oauth/authorize'
const LINEAR_OAUTH_SCOPE = 'read,issues:create'
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000

export function getLinearOauthConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  const clientId = env.LINEAR_OAUTH_CLIENT_ID?.trim()
  const clientSecret = env.LINEAR_OAUTH_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('LINEAR_OAUTH_CLIENT_ID and LINEAR_OAUTH_CLIENT_SECRET are required.')
  }

  const redirectUri =
    env.LINEAR_OAUTH_REDIRECT_URI?.trim() ||
    `${env.APP_BASE_URL.replace(/\/+$/, '')}/api/alerts/integrations/linear/callback`

  return { clientId, clientSecret, redirectUri }
}

export function buildLinearOauthAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: LINEAR_OAUTH_SCOPE,
    state: input.state,
    actor: 'app',
  })

  return `${LINEAR_AUTHORIZATION_URL}?${params.toString()}`
}

export async function getValidLinearAccessToken(integration: LinearIntegration): Promise<string> {
  if (integration.accessTokenExpiresAt.getTime() - TOKEN_REFRESH_SKEW_MS > Date.now()) {
    return decryptSecret(integration.encryptedAccessToken)
  }

  const { clientId, clientSecret } = getLinearOauthConfig()
  const token = await refreshLinearOauthToken({
    refreshToken: decryptSecret(integration.encryptedRefreshToken),
    clientId,
    clientSecret,
  })
  const refreshed = await linearIntegrationRepository.updateOauthTokens(
    integration.organizationId,
    {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      scopes: token.scopes,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
    }
  )

  return decryptSecret(refreshed?.encryptedAccessToken ?? integration.encryptedAccessToken)
}
