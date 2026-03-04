import type { redisDiscoveredQueue } from './schema'

export type RedisDiscoveredQueue = typeof redisDiscoveredQueue.$inferSelect
export type NewRedisDiscoveredQueue = typeof redisDiscoveredQueue.$inferInsert

export type { QueueDiscoveryState } from './schema'
