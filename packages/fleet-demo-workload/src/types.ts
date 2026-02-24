export type EnvironmentType = 'development' | 'staging' | 'production'

export interface WeightedJobType {
  name: string
  weight: number
}

export interface ScheduledJobWorkloadConfig {
  id: string
  name: string
  pattern: string
  description: string
  attempts?: number
}

export interface QueueWorkloadConfig {
  name: string
  description: string
  jobTypes: WeightedJobType[]
  scheduledJobs?: ScheduledJobWorkloadConfig[]
  baseIntervalMs: number
  processingMs: {
    min: number
    max: number
  }
  concurrency: number
  attempts: number
  baseFailureRate: number
  priorityChance: number
  delayedChance: number
  delayedMs: {
    min: number
    max: number
  }
}

export interface WorkloadConnectionConfig {
  slug: string
  name: string
  environment: EnvironmentType
  url: string
  urlSource: string
  throughputMultiplier: number
  queuePrefix: string
}

export interface ActiveIncident {
  id: string
  queueName: string | 'all'
  startedAt: number
  endsAt: number
  failureBoost: number
  reason: string
}

export interface JobTraceContext {
  traceId: string
  producedAt: string
  connectionSlug: string
  connectionName: string
  environment: EnvironmentType
  queueName: string
}

export interface BasePayload {
  trace: JobTraceContext
  customerId: string
  sessionId: string
  locale: string
  country: string
  salesChannel: 'web' | 'ios' | 'android' | 'marketplace'
}
