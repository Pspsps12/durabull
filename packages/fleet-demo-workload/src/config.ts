import type { EnvironmentType, QueueWorkloadConfig, WorkloadConnectionConfig } from './types'

export const COMPLETED_JOB_RETENTION = readPositiveInt(
  process.env.WORKLOAD_COMPLETED_JOB_RETENTION,
  25
)
export const FAILED_JOB_RETENTION = readPositiveInt(process.env.WORKLOAD_FAILED_JOB_RETENTION, 50)
export const JOB_LOG_RETENTION = readPositiveInt(process.env.WORKLOAD_JOB_LOG_RETENTION, 6)
export const EVENT_STREAM_MAX_LEN = readPositiveInt(process.env.WORKLOAD_EVENT_STREAM_MAX_LEN, 500)
export const METRICS_MAX_DATA_POINTS = readPositiveInt(
  process.env.WORKLOAD_METRICS_MAX_DATA_POINTS,
  60 * 24
)
export const HEARTBEAT_INTERVAL_MS = readPositiveInt(process.env.WORKLOAD_HEARTBEAT_MS, 60_000)
export const RESET_ON_BOOT = readBoolean(process.env.WORKLOAD_RESET_ON_BOOT, true)
export const NAMESPACE_QUEUES = readBoolean(process.env.WORKLOAD_NAMESPACE_QUEUES, false)
const CONNECTION_SLUG = 'prod-east'
const CONNECTION_NAME = 'Commerce Production East'
const CONNECTION_ENVIRONMENT: EnvironmentType = 'production'
const CONNECTION_THROUGHPUT_MULTIPLIER = 1

const LOCAL_FALLBACK_REDIS_URL = 'redis://127.0.0.1:6379'

export function getWorkloadConnections(): WorkloadConnectionConfig[] {
  const { url: resolvedUrl, source: urlSource } = resolveRedisUrl()

  return [
    {
      slug: CONNECTION_SLUG,
      name: CONNECTION_NAME,
      environment: CONNECTION_ENVIRONMENT,
      url: resolvedUrl,
      urlSource,
      throughputMultiplier: CONNECTION_THROUGHPUT_MULTIPLIER,
      // Optional namespacing can isolate this workload from other Bull queues
      // that share the same Redis host.
      queuePrefix: NAMESPACE_QUEUES ? `bull:${CONNECTION_SLUG}` : 'bull',
    },
  ]
}

export const QUEUE_CONFIGS: QueueWorkloadConfig[] = [
  {
    name: 'user-welcome',
    description: 'Welcome lifecycle, profile bootstrap, and first-session messaging.',
    jobTypes: [
      { name: 'send-welcome-email', weight: 5 },
      { name: 'create-customer-profile', weight: 3 },
      { name: 'sync-marketing-contact', weight: 2 },
    ],
    scheduledJobs: [
      {
        id: 'welcome-nurture-wave-10m',
        name: 'send-welcome-email',
        pattern: '*/10 * * * *',
        description: 'Follow-up welcome nudges for new signups.',
      },
      {
        id: 'profile-bootstrap-backfill-hourly',
        name: 'create-customer-profile',
        pattern: '15 * * * *',
        description: 'Retry profile bootstrap for incomplete accounts.',
      },
      {
        id: 'marketing-contact-reconcile-3h',
        name: 'sync-marketing-contact',
        pattern: '0 */3 * * *',
        description: 'Reconcile CRM contact sync drift.',
      },
      {
        id: 'locale-template-refresh-daily',
        name: 'send-welcome-email',
        pattern: '30 2 * * *',
        description: 'Refresh locale-specific onboarding copy.',
      },
    ],
    baseIntervalMs: 12_000,
    processingMs: { min: 200, max: 1_200 },
    concurrency: 2,
    attempts: 3,
    baseFailureRate: 0.01,
    priorityChance: 0.1,
    delayedChance: 0.15,
    delayedMs: { min: 3_000, max: 45_000 },
  },
  {
    name: 'cart-recovery',
    description: 'Abandoned cart reminders and offer experiments.',
    jobTypes: [
      { name: 'score-cart-intent', weight: 4 },
      { name: 'send-cart-reminder', weight: 5 },
      { name: 'issue-recovery-coupon', weight: 1 },
    ],
    scheduledJobs: [
      {
        id: 'cart-reminder-wave-15m',
        name: 'send-cart-reminder',
        pattern: '*/15 * * * *',
        description: 'Send reminder waves for abandoned carts.',
      },
      {
        id: 'cart-intent-rescore-hourly',
        name: 'score-cart-intent',
        pattern: '10 * * * *',
        description: 'Refresh abandonment intent scoring each hour.',
      },
      {
        id: 'recovery-coupon-batch-2h',
        name: 'issue-recovery-coupon',
        pattern: '0 */2 * * *',
        description: 'Issue batch recovery incentives for high-value carts.',
      },
      {
        id: 'weekday-winback-campaign-930',
        name: 'send-cart-reminder',
        pattern: '30 9 * * 1-5',
        description: 'Weekday morning winback campaign delivery.',
      },
    ],
    baseIntervalMs: 10_000,
    processingMs: { min: 300, max: 1_500 },
    concurrency: 2,
    attempts: 4,
    baseFailureRate: 0.009,
    priorityChance: 0.08,
    delayedChance: 0.25,
    delayedMs: { min: 30_000, max: 6 * 60_000 },
  },
  {
    name: 'order-processing',
    description: 'Order validation and orchestration into downstream systems.',
    jobTypes: [
      { name: 'validate-order', weight: 4 },
      { name: 'reserve-inventory', weight: 4 },
      { name: 'finalize-order', weight: 2 },
    ],
    scheduledJobs: [
      {
        id: 'order-validation-sweep-5m',
        name: 'validate-order',
        pattern: '*/5 * * * *',
        description: 'Sweep stale checkout sessions into validation.',
      },
      {
        id: 'inventory-reservation-retry-hourly',
        name: 'reserve-inventory',
        pattern: '20 * * * *',
        description: 'Retry reservations that timed out in downstream systems.',
      },
      {
        id: 'order-finalization-audit-1am',
        name: 'finalize-order',
        pattern: '0 1 * * *',
        description: 'Run nightly order finalization audit and repair.',
      },
      {
        id: 'weekend-backlog-drain-4h',
        name: 'validate-order',
        pattern: '0 */4 * * 6,0',
        description: 'Drain weekend backlog with periodic validation passes.',
      },
    ],
    baseIntervalMs: 5_000,
    processingMs: { min: 250, max: 1_800 },
    concurrency: 3,
    attempts: 5,
    baseFailureRate: 0.015,
    priorityChance: 0.25,
    delayedChance: 0.05,
    delayedMs: { min: 2_000, max: 20_000 },
  },
  {
    name: 'payment-processing',
    description: 'Authorization, capture, and settlement handoff.',
    jobTypes: [
      { name: 'authorize-payment', weight: 4 },
      { name: 'capture-payment', weight: 4 },
      { name: 'settle-payment', weight: 2 },
    ],
    scheduledJobs: [
      {
        id: 'gateway-authorization-replay-10m',
        name: 'authorize-payment',
        pattern: '*/10 * * * *',
        description: 'Replay authorization checks for pending intents.',
      },
      {
        id: 'capture-reconciliation-hourly',
        name: 'capture-payment',
        pattern: '5 * * * *',
        description: 'Reconcile captured charges against gateway ledgers.',
      },
      {
        id: 'settlement-handoff-2h',
        name: 'settle-payment',
        pattern: '0 */2 * * *',
        description: 'Push settlement batches to finance every two hours.',
      },
      {
        id: 'daily-ledger-close-230',
        name: 'settle-payment',
        pattern: '30 2 * * *',
        description: 'Perform daily payment ledger close procedure.',
      },
      {
        id: 'monthly-settlement-close-1st',
        name: 'settle-payment',
        pattern: '0 0 1 * *',
        description: 'Execute monthly settlement and reconciliation close.',
      },
    ],
    baseIntervalMs: 6_000,
    processingMs: { min: 300, max: 2_200 },
    concurrency: 3,
    attempts: 5,
    baseFailureRate: 0.017,
    priorityChance: 0.35,
    delayedChance: 0.06,
    delayedMs: { min: 2_000, max: 30_000 },
  },
  {
    name: 'shipment-processing',
    description: 'Carrier rating, label creation, and dispatch updates.',
    jobTypes: [
      { name: 'create-shipment', weight: 4 },
      { name: 'purchase-shipping-label', weight: 3 },
      { name: 'dispatch-shipment-events', weight: 3 },
    ],
    scheduledJobs: [
      {
        id: 'carrier-rating-refresh-30m',
        name: 'create-shipment',
        pattern: '*/30 * * * *',
        description: 'Refresh carrier-rate snapshots across active lanes.',
      },
      {
        id: 'label-purchase-retry-hourly',
        name: 'purchase-shipping-label',
        pattern: '12 * * * *',
        description: 'Retry label purchases blocked by transient carrier errors.',
      },
      {
        id: 'dispatch-events-sync-20m',
        name: 'dispatch-shipment-events',
        pattern: '*/20 * * * *',
        description: 'Sync dispatch status updates back into OMS.',
      },
      {
        id: 'weekday-undeliverable-review-715',
        name: 'create-shipment',
        pattern: '15 7 * * 1-5',
        description: 'Escalate weekday undeliverable shipment exceptions.',
      },
    ],
    baseIntervalMs: 9_000,
    processingMs: { min: 350, max: 2_500 },
    concurrency: 2,
    attempts: 4,
    baseFailureRate: 0.012,
    priorityChance: 0.18,
    delayedChance: 0.2,
    delayedMs: { min: 15_000, max: 4 * 60_000 },
  },
  {
    name: 'inventory-sync',
    description: 'Stock adjustment and multi-warehouse reconciliation.',
    jobTypes: [
      { name: 'apply-stock-delta', weight: 5 },
      { name: 'reconcile-warehouse-bucket', weight: 3 },
      { name: 'publish-availability-update', weight: 2 },
    ],
    scheduledJobs: [
      {
        id: 'stock-delta-ingest-10m',
        name: 'apply-stock-delta',
        pattern: '*/10 * * * *',
        description: 'Ingest accumulated stock deltas from partner systems.',
      },
      {
        id: 'availability-publish-15m',
        name: 'publish-availability-update',
        pattern: '*/15 * * * *',
        description: 'Push availability updates to storefront and marketplaces.',
      },
      {
        id: 'warehouse-reconcile-nightly',
        name: 'reconcile-warehouse-bucket',
        pattern: '0 3 * * *',
        description: 'Run nightly cross-warehouse inventory reconciliation.',
      },
      {
        id: 'cycle-count-prep-monday-6',
        name: 'reconcile-warehouse-bucket',
        pattern: '0 6 * * 1',
        description: 'Prepare weekly cycle-count packets before operations.',
      },
    ],
    baseIntervalMs: 8_000,
    processingMs: { min: 200, max: 1_500 },
    concurrency: 2,
    attempts: 4,
    baseFailureRate: 0.011,
    priorityChance: 0.22,
    delayedChance: 0.1,
    delayedMs: { min: 5_000, max: 75_000 },
  },
  {
    name: 'refund-processing',
    description: 'Refund validation, payout, and customer updates.',
    jobTypes: [
      { name: 'validate-refund-request', weight: 4 },
      { name: 'issue-refund', weight: 4 },
      { name: 'notify-refund-status', weight: 2 },
    ],
    scheduledJobs: [
      {
        id: 'refund-validation-sweep-30m',
        name: 'validate-refund-request',
        pattern: '*/30 * * * *',
        description: 'Re-evaluate pending refund validations.',
      },
      {
        id: 'refund-payout-batch-2h',
        name: 'issue-refund',
        pattern: '30 */2 * * *',
        description: 'Release batched refund payouts every two hours.',
      },
      {
        id: 'refund-notification-hourly',
        name: 'notify-refund-status',
        pattern: '20 * * * *',
        description: 'Send hourly refund status notifications.',
      },
      {
        id: 'finance-refund-ledger-sync-515',
        name: 'issue-refund',
        pattern: '15 5 * * *',
        description: 'Sync refund ledger entries with finance systems.',
      },
    ],
    baseIntervalMs: 15_000,
    processingMs: { min: 250, max: 2_000 },
    concurrency: 2,
    attempts: 4,
    baseFailureRate: 0.02,
    priorityChance: 0.2,
    delayedChance: 0.18,
    delayedMs: { min: 30_000, max: 10 * 60_000 },
  },
  {
    name: 'return-processing',
    description: 'Return intake, item inspection, and restocking workflows.',
    jobTypes: [
      { name: 'open-return-request', weight: 4 },
      { name: 'inspect-returned-item', weight: 3 },
      { name: 'restock-returned-item', weight: 3 },
    ],
    scheduledJobs: [
      {
        id: 'return-intake-sweep-20m',
        name: 'open-return-request',
        pattern: '*/20 * * * *',
        description: 'Sweep inbound RMAs from support channels.',
      },
      {
        id: 'inspection-priority-pass-3h',
        name: 'inspect-returned-item',
        pattern: '0 */3 * * *',
        description: 'Prioritize aging returns for inspection.',
      },
      {
        id: 'restock-refresh-430',
        name: 'restock-returned-item',
        pattern: '30 4 * * *',
        description: 'Refresh restock availability after nightly intake.',
      },
      {
        id: 'weekday-rma-sla-report-8',
        name: 'inspect-returned-item',
        pattern: '0 8 * * 1-5',
        description: 'Generate weekday RMA SLA report for operations.',
      },
    ],
    baseIntervalMs: 18_000,
    processingMs: { min: 350, max: 2_800 },
    concurrency: 1,
    attempts: 4,
    baseFailureRate: 0.018,
    priorityChance: 0.14,
    delayedChance: 0.3,
    delayedMs: { min: 60_000, max: 30 * 60_000 },
  },
  {
    name: 'fraud-review',
    description: 'Risk scoring and manual-review escalation flow.',
    jobTypes: [
      { name: 'score-order-risk', weight: 5 },
      { name: 'open-fraud-review-ticket', weight: 2 },
      { name: 'release-risk-hold', weight: 1 },
    ],
    scheduledJobs: [
      {
        id: 'risk-rescore-10m',
        name: 'score-order-risk',
        pattern: '*/10 * * * *',
        description: 'Rescore high-risk orders with latest fraud signals.',
      },
      {
        id: 'manual-review-reminder-2h',
        name: 'open-fraud-review-ticket',
        pattern: '0 */2 * * *',
        description: 'Remind analysts about manual review backlog.',
      },
      {
        id: 'release-hold-recheck-hourly',
        name: 'release-risk-hold',
        pattern: '25 * * * *',
        description: 'Recheck held orders that may now be safe to release.',
      },
      {
        id: 'compromised-card-list-sync-1am',
        name: 'score-order-risk',
        pattern: '0 1 * * *',
        description: 'Sync compromised card intelligence feeds.',
      },
      {
        id: 'weekly-model-drift-check-monday',
        name: 'open-fraud-review-ticket',
        pattern: '0 9 * * 1',
        description: 'Flag weekly fraud model drift review tasks.',
      },
    ],
    baseIntervalMs: 20_000,
    processingMs: { min: 200, max: 1_600 },
    concurrency: 1,
    attempts: 3,
    baseFailureRate: 0.013,
    priorityChance: 0.35,
    delayedChance: 0.12,
    delayedMs: { min: 10_000, max: 2 * 60_000 },
  },
]

export const TOTAL_SCHEDULED_JOBS = QUEUE_CONFIGS.reduce(
  (count, queueConfig) => count + (queueConfig.scheduledJobs?.length ?? 0),
  0
)

export function maskRedisUrl(url: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
}

function resolveRedisUrl(): { url: string; source: string } {
  const shared = normalizeEnvValue(process.env.WORKLOAD_REDIS_URL)
  if (shared) {
    return { url: shared, source: 'WORKLOAD_REDIS_URL' }
  }

  const legacy = normalizeEnvValue(process.env.REDIS_URL)
  if (legacy) {
    return { url: legacy, source: 'REDIS_URL' }
  }

  return {
    url: LOCAL_FALLBACK_REDIS_URL,
    source: 'default-localhost',
  }
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function readBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function normalizeEnvValue(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}
