import {
  alertDeliveryRepository,
  alertEventRepository,
  decryptSecret,
  linearIntegrationRepository,
} from '@durabull/dal'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { fetchLinearMetadata, LinearApiError, validateLinearApiKey } from '../lib/linear-client'
import { requireOrganization } from '../middleware/auth'

const linearDefaultsSchema = z.object({
  defaultTeamId: z.string().min(1).nullable().optional(),
  defaultProjectId: z.string().min(1).nullable().optional(),
  defaultLabelIds: z.array(z.string().min(1)).max(50).optional().default([]),
  defaultAssigneeId: z.string().min(1).nullable().optional(),
  defaultStateId: z.string().min(1).nullable().optional(),
  defaultPriority: z.number().int().min(0).max(4).nullable().optional(),
})

const putLinearIntegrationSchema = linearDefaultsSchema.extend({
  apiKey: z.string().min(20).optional(),
})

const app = new Hono()
  .use('*', requireOrganization)
  .get(
    '/events',
    zValidator(
      'query',
      z.object({
        offset: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        status: z.enum(['firing', 'resolved', 'suppressed']).optional(),
      })
    ),
    async (c) => {
      const { offset, limit, status } = c.req.valid('query')
      const organizationId = c.get('organizationId')
      if (!organizationId) {
        return c.json({ error: 'Organization is required' }, 403)
      }

      const events = await alertEventRepository.findByOrganization(organizationId, {
        offset,
        limit,
        status,
      })
      return c.json({ events: await attachDeliveries(events) })
    }
  )
  .get('/summary', async (c) => {
    const organizationId = c.get('organizationId')
    if (!organizationId) {
      return c.json({ error: 'Organization is required' }, 403)
    }

    const counts = await alertEventRepository.countFiringByOrganization(organizationId)
    return c.json({ connections: counts })
  })
  .get('/integrations/linear', async (c) => {
    const organizationId = c.get('organizationId')
    if (!organizationId) {
      return c.json({ error: 'Organization is required' }, 403)
    }

    const integration = await linearIntegrationRepository.findByOrganization(organizationId)
    return c.json({ integration: integration ? serializeLinearIntegration(integration) : null })
  })
  .put('/integrations/linear', zValidator('json', putLinearIntegrationSchema), async (c) => {
    const body = c.req.valid('json')
    const organizationId = c.get('organizationId')
    if (!organizationId) {
      return c.json({ error: 'Organization is required' }, 403)
    }

    const existing = await linearIntegrationRepository.findByOrganization(organizationId)
    if (!existing && !body.apiKey) {
      return c.json({ error: 'Linear API key is required.' }, 400)
    }

    try {
      let integration = existing
      if (body.apiKey) {
        await validateLinearApiKey(body.apiKey)
        integration = await linearIntegrationRepository.upsert({
          organizationId,
          apiKey: body.apiKey,
          validationStatus: 'valid',
          lastValidatedAt: new Date(),
          ...normalizeLinearDefaults(body),
        })
      } else if (existing) {
        integration = await linearIntegrationRepository.updateDefaults(organizationId, {
          validationStatus: existing.validationStatus,
          lastValidatedAt: existing.lastValidatedAt,
          ...normalizeLinearDefaults(body),
        })
      }

      return c.json({ integration: integration ? serializeLinearIntegration(integration) : null })
    } catch (error) {
      if (error instanceof LinearApiError) {
        return c.json({ error: error.message }, error.status === 401 ? 401 : 400)
      }
      throw error
    }
  })
  .delete('/integrations/linear', async (c) => {
    const organizationId = c.get('organizationId')
    if (!organizationId) {
      return c.json({ error: 'Organization is required' }, 403)
    }

    await linearIntegrationRepository.delete(organizationId)
    return c.json({ success: true })
  })
  .post('/integrations/linear/test', async (c) => {
    const organizationId = c.get('organizationId')
    if (!organizationId) {
      return c.json({ error: 'Organization is required' }, 403)
    }

    const integration = await linearIntegrationRepository.findByOrganization(organizationId)
    if (!integration) {
      return c.json({ error: 'Linear integration is not configured.' }, 404)
    }

    try {
      const result = await validateLinearApiKey(decryptSecret(integration.encryptedApiKey))
      await linearIntegrationRepository.markValidationStatus(organizationId, 'valid')
      return c.json({ ok: true, organizationName: result.organizationName })
    } catch (error) {
      await linearIntegrationRepository.markValidationStatus(organizationId, 'invalid')
      if (error instanceof LinearApiError) {
        return c.json({ error: error.message }, error.status === 401 ? 401 : 400)
      }
      throw error
    }
  })
  .get('/integrations/linear/metadata', async (c) => {
    const organizationId = c.get('organizationId')
    if (!organizationId) {
      return c.json({ error: 'Organization is required' }, 403)
    }

    const integration = await linearIntegrationRepository.findByOrganization(organizationId)
    if (!integration || integration.validationStatus !== 'valid') {
      return c.json({ error: 'Linear integration is not configured or valid.' }, 400)
    }

    try {
      const metadata = await fetchLinearMetadata(decryptSecret(integration.encryptedApiKey))
      return c.json({ metadata })
    } catch (error) {
      if (error instanceof LinearApiError) {
        return c.json({ error: error.message }, error.retryable ? 503 : 400)
      }
      throw error
    }
  })

function normalizeLinearDefaults(body: z.infer<typeof linearDefaultsSchema>) {
  return {
    defaultTeamId: body.defaultTeamId ?? null,
    defaultProjectId: body.defaultProjectId ?? null,
    defaultLabelIds: body.defaultLabelIds ?? [],
    defaultAssigneeId: body.defaultAssigneeId ?? null,
    defaultStateId: body.defaultStateId ?? null,
    defaultPriority: body.defaultPriority ?? null,
  }
}

async function attachDeliveries<T extends { id: string }>(events: T[]) {
  return Promise.all(
    events.map(async (event) => ({
      ...event,
      deliveries: await alertDeliveryRepository.listByEvent(event.id),
    }))
  )
}

function serializeLinearIntegration(
  integration: NonNullable<
    Awaited<ReturnType<typeof linearIntegrationRepository.findByOrganization>>
  >
) {
  return {
    id: integration.id,
    organizationId: integration.organizationId,
    keyPreview: integration.keyPreview,
    validationStatus: integration.validationStatus,
    defaultTeamId: integration.defaultTeamId,
    defaultProjectId: integration.defaultProjectId,
    defaultLabelIds: integration.defaultLabelIds,
    defaultAssigneeId: integration.defaultAssigneeId,
    defaultStateId: integration.defaultStateId,
    defaultPriority: integration.defaultPriority,
    lastValidatedAt: integration.lastValidatedAt,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  }
}

export default app
