import { eq, getDb, invitation, organization, user } from '@durabull/dal'
import { Hono } from 'hono'

/**
 * Public invitation routes for the invite acceptance flow.
 * These routes do NOT require authentication - they allow fetching
 * invitation details to display to potential new users.
 */
const app = new Hono()
  /**
   * Get invitation details by ID.
   * This is a PUBLIC endpoint - no auth required.
   * Returns invitation info so the invite page can display:
   * - Organization name
   * - Inviter name
   * - Role being offered
   * - Expiration status
   */
  .get('/:id', async (c) => {
    const { id } = c.req.param()

    try {
      const db = await getDb()

      // Fetch invitation with organization and inviter details
      const result = await db
        .select({
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            organizationId: invitation.organizationId,
          },
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            logo: organization.logo,
          },
          inviter: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          },
        })
        .from(invitation)
        .innerJoin(organization, eq(invitation.organizationId, organization.id))
        .innerJoin(user, eq(invitation.inviterId, user.id))
        .where(eq(invitation.id, id))
        .limit(1)

      if (result.length === 0) {
        return c.json(
          {
            error: 'Invitation not found',
            code: 'INVITATION_NOT_FOUND',
          },
          404
        )
      }

      const { invitation: inv, organization: org, inviter } = result[0]

      // Check if invitation has expired
      const isExpired = new Date(inv.expiresAt) < new Date()

      // Check if invitation is still pending
      if (inv.status !== 'pending') {
        return c.json(
          {
            error: `Invitation has already been ${inv.status}`,
            code: 'INVITATION_NOT_PENDING',
            status: inv.status,
          },
          400
        )
      }

      if (isExpired) {
        return c.json(
          {
            error: 'Invitation has expired',
            code: 'INVITATION_EXPIRED',
          },
          400
        )
      }

      // SECURITY: Do not expose whether a user account exists
      // The frontend should show both sign-in and sign-up options
      // and handle the flow based on user action, not server hints

      return c.json({
        invitation: {
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt.toISOString(),
        },
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
        },
        inviter: {
          name: inviter.name,
          email: inviter.email,
          image: inviter.image,
        },
      })
    } catch (error) {
      console.error('[invitations] Error fetching invitation:', error)
      return c.json(
        {
          error: 'Failed to fetch invitation',
          code: 'INTERNAL_ERROR',
        },
        500
      )
    }
  })

export default app
