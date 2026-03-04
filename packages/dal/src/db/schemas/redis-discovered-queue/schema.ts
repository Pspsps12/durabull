import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { baseColumns } from '../common'
import { redisConnection } from '../redis-connection/schema'

export const queueDiscoveryStates = ['pending', 'confirmed'] as const
export type QueueDiscoveryState = (typeof queueDiscoveryStates)[number]

/**
 * Redis discovered queue index.
 * Stores queue names discovered per Redis connection so UI can load quickly
 * without scanning Redis keyspace on every request.
 */
export const redisDiscoveredQueue = pgTable(
  'redis_discovered_queue',
  {
    ...baseColumns,
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => redisConnection.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    state: text('state').$type<QueueDiscoveryState>().notNull().default('pending'),
    lastDiscoveredAt: timestamp('last_discovered_at', { withTimezone: true }),
  },
  (table) => ({
    uniqueConnectionQueueName: uniqueIndex('redis_discovered_queue_connection_id_name_idx').on(
      table.connectionId,
      table.name
    ),
    connectionStateIdx: index('redis_discovered_queue_connection_id_state_idx').on(
      table.connectionId,
      table.state
    ),
  })
)
