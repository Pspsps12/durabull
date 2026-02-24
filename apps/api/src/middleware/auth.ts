import type { Auth } from '@durabull/auth'
import { env } from '@durabull/env'
import type { Session, User } from 'better-auth/types'
import { createMiddleware } from 'hono/factory'
import { getAuthlessContext, isAuthlessMode } from '../lib/authless'

// Extended session type that includes organization plugin fields
interface SessionWithOrg extends Session {
  activeOrganizationId?: string | null
}

interface OrganizationContext {
  id: string
  name: string
  slug: string
}

// Extend Hono's context to include session, user, and organization
declare module 'hono' {
  interface ContextVariableMap {
    user: User | null
    session: SessionWithOrg | null
    organizationId: string | null
    organization: OrganizationContext | null
  }
}

/**
 * Creates a session middleware that injects user session information into the Hono context.
 * This middleware fetches the session from Better Auth and makes it available via:
 * - c.get("user") - The authenticated user or null
 * - c.get("session") - The session object or null
 * - c.get("organizationId") - The active organization ID or null
 *
 * This middleware does NOT block unauthenticated requests - it simply injects session info.
 * Use `requireAuth` middleware if you want to protect routes.
 */
export function createSessionMiddleware(auth?: Auth) {
  return createMiddleware(async (c, next) => {
    if (isAuthlessMode()) {
      const context = await getAuthlessContext()
      c.set('user', context.user)
      c.set('session', context.session)
      c.set('organizationId', context.organization.id)
      c.set('organization', context.organization)
      return next()
    }

    if (!auth) {
      return c.json(
        {
          error: 'Service Unavailable',
          message: 'Authentication service is not configured.',
        },
        503
      )
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session) {
      // Only log in development to avoid leaking request patterns in production
      if (env.NODE_ENV !== 'production') {
        console.log('🔓 No session found for request:', c.req.path)
      }
      c.set('user', null)
      c.set('session', null)
      c.set('organizationId', null)
      c.set('organization', null)
      return next()
    }

    // Extract activeOrganizationId from the session (added by organization plugin)
    const sessionWithOrg = session.session as SessionWithOrg
    const organizationId = sessionWithOrg.activeOrganizationId ?? null

    // Only log session info in development - avoid logging PII in production
    if (env.NODE_ENV !== 'production') {
      console.log('🔐 Session found:', {
        path: c.req.path,
        userId: session.user.id,
        organizationId,
      })
    }
    c.set('user', session.user)
    c.set('session', sessionWithOrg)
    c.set('organizationId', organizationId)
    c.set('organization', null)
    return next()
  })
}

/**
 * Creates an authentication guard middleware that requires a valid session.
 * Returns 401 Unauthorized if no session is found.
 *
 * Use this to protect routes that require authentication.
 * Should be used AFTER the session middleware has run.
 */
export function createRequireAuthMiddleware(auth?: Auth) {
  return createMiddleware(async (c, next) => {
    if (isAuthlessMode()) {
      const context = await getAuthlessContext()
      c.set('user', context.user)
      c.set('session', context.session)
      c.set('organizationId', context.organization.id)
      c.set('organization', context.organization)
      return next()
    }

    if (!auth) {
      return c.json(
        {
          error: 'Service Unavailable',
          message: 'Authentication service is not configured.',
        },
        503
      )
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to access this resource',
        },
        401
      )
    }

    const sessionWithOrg = session.session as SessionWithOrg
    c.set('user', session.user)
    c.set('session', sessionWithOrg)
    c.set('organizationId', sessionWithOrg.activeOrganizationId ?? null)
    c.set('organization', null)
    return next()
  })
}

/**
 * Simple guard middleware that checks if session was already set by sessionMiddleware.
 * More efficient than requireAuth as it doesn't make another API call.
 *
 * Use this AFTER sessionMiddleware has already run.
 */
export const requireSession = createMiddleware(async (c, next) => {
  const user = c.get('user')

  if (!user) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource',
      },
      401
    )
  }

  return next()
})

/**
 * Middleware that requires an active organization.
 * Returns 403 Forbidden if user doesn't have an active organization.
 *
 * Use this AFTER sessionMiddleware has already run.
 */
export const requireOrganization = createMiddleware(async (c, next) => {
  const organizationId = c.get('organizationId')

  if (!organizationId) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You must have an active organization to access this resource',
      },
      403
    )
  }

  return next()
})
