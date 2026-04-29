import type { telemetryInstallation } from './schema'

export type TelemetryInstallation = typeof telemetryInstallation.$inferSelect
export type NewTelemetryInstallation = typeof telemetryInstallation.$inferInsert
