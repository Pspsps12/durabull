import type { Logger } from './logger'
import { chance, pickRandom, randomFloat, randomInt, shortId } from './random'
import type { ActiveIncident } from './types'

const GLOBAL_INCIDENT_REASONS = [
  'network packet loss spike',
  'downstream API saturation',
  'redis replication lag spike',
  'service mesh timeout burst',
]

const INCIDENT_REASONS_BY_QUEUE: Record<string, string[]> = {
  'payment-processing': [
    'payment gateway brownout',
    'card network timeout burst',
    'payment provider rate limiting',
  ],
  'refund-processing': ['refund ledger reconciliation lag', 'payout service timeout burst'],
  'shipment-processing': ['carrier endpoint degradation', 'shipping label provider throttling'],
  'inventory-sync': ['inventory write model contention', 'warehouse feed latency spike'],
  'order-processing': ['order validation dependency timeout', 'inventory reservation contention'],
  'return-processing': ['returns intake service degradation', 'restock workflow timeout burst'],
  'fraud-review': ['risk engine response latency spike', 'fraud scoring provider timeout burst'],
  'user-welcome': ['onboarding notification provider lag', 'profile bootstrap dependency timeout'],
  'cart-recovery': ['campaign dispatch API saturation', 'recovery scoring service timeout burst'],
}

export class IncidentController {
  private activeIncident: ActiveIncident | null = null
  private nextIncidentAt = Date.now() + this.randomDelayUntilIncident()
  private readonly queueNames: string[]
  private readonly logger: Logger

  constructor(queueNames: string[], logger: Logger) {
    this.queueNames = queueNames
    this.logger = logger
  }

  tick(now = Date.now()): void {
    if (this.activeIncident && now >= this.activeIncident.endsAt) {
      this.logger.info('incident.resolved', 'Resolved temporary failure incident', {
        incidentId: this.activeIncident.id,
        queueName: this.activeIncident.queueName,
      })
      this.activeIncident = null
      this.nextIncidentAt = now + this.randomDelayUntilIncident()
      return
    }

    if (!this.activeIncident && now >= this.nextIncidentAt) {
      this.startIncident(now)
    }
  }

  getFailureBoost(queueName: string): number {
    this.tick()
    if (!this.activeIncident) return 0
    if (this.activeIncident.queueName === 'all') return this.activeIncident.failureBoost
    if (this.activeIncident.queueName === queueName) return this.activeIncident.failureBoost
    return 0
  }

  getActiveIncident(): ActiveIncident | null {
    this.tick()
    return this.activeIncident
  }

  private startIncident(now: number): void {
    const targetQueue = chance(0.18) ? 'all' : pickRandom(this.queueNames)
    const durationMs = randomInt(45_000, 3 * 60_000)
    const reasonPool =
      targetQueue === 'all'
        ? GLOBAL_INCIDENT_REASONS
        : (INCIDENT_REASONS_BY_QUEUE[targetQueue] ?? GLOBAL_INCIDENT_REASONS)
    const incident: ActiveIncident = {
      id: shortId(),
      queueName: targetQueue,
      startedAt: now,
      endsAt: now + durationMs,
      failureBoost: randomFloat(0.08, 0.22),
      reason: pickRandom(reasonPool),
    }

    this.activeIncident = incident
    this.logger.warn('incident.started', 'Started temporary failure incident', {
      incidentId: incident.id,
      queueName: incident.queueName,
      durationMs,
      failureBoost: Number(incident.failureBoost.toFixed(3)),
      reason: incident.reason,
    })
  }

  private randomDelayUntilIncident(): number {
    return randomInt(6 * 60_000, 22 * 60_000)
  }
}
