import type { alertDelivery } from './schema'

export type AlertDelivery = typeof alertDelivery.$inferSelect
export type NewAlertDelivery = typeof alertDelivery.$inferInsert
export type { AlertDeliveryChannelType, AlertDeliveryStatus } from './schema'
