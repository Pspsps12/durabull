import { Hono } from 'hono'
import { getAuth } from '../lib/auth'
import { getAuthlessContext, isAuthlessMode } from '../lib/authless'

const app = new Hono()

/**
 * Handle all auth requests using Better Auth's handler.
 * Better Auth uses a catch-all pattern for all auth operations:
 * - POST /sign-up/email - Sign up with email/password
 * - POST /sign-in/email - Sign in with email/password
 * - POST /sign-out - Sign out
 * - GET /session - Get current session
 * - And more...
 */
app.all('/*', async (c) => {
  if (isAuthlessMode()) {
    const context = await getAuthlessContext()
    const path = c.req.path

    if (c.req.method === 'GET' && (path.endsWith('/get-session') || path.endsWith('/session'))) {
      return c.json({ user: context.user, session: context.session })
    }

    if (c.req.method === 'POST' && path.endsWith('/sign-out')) {
      return c.json({ success: true })
    }

    return c.json(
      {
        error: 'Authentication is disabled in authless mode.',
      },
      403
    )
  }

  const auth = await getAuth()
  return auth.handler(c.req.raw)
})

export default app
