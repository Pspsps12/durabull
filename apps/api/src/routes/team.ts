import { eq, getDb, member, user } from '@durabull/dal'
import { Hono } from 'hono'
import { requireOrganization } from '../middleware/auth'

const app = new Hono().use('*', requireOrganization).get('/members', async (c) => {
  const organizationId = c.get('organizationId')!
  const db = await getDb()

  const members = await db
    .select({
      id: member.id,
      userId: member.userId,
      organizationId: member.organizationId,
      role: member.role,
      createdAt: member.createdAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        lastSignInAt: user.lastSignInAt,
      },
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId))

  return c.json({
    members,
    total: members.length,
  })
})

export default app
