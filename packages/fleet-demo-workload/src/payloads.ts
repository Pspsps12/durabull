import { pickRandom, randomInt, shortId } from './random'
import type { BasePayload, WorkloadConnectionConfig } from './types'

const COUNTRIES = ['US', 'CA', 'GB', 'AU', 'DE']
const LOCALES = ['en-US', 'en-GB', 'de-DE']
const CHANNELS = ['web', 'ios', 'android', 'marketplace'] as const
const CARD_BRANDS = ['visa', 'mastercard', 'amex']
const CARRIERS = ['usps', 'ups', 'fedex', 'dhl']
const WAREHOUSES = ['us-east-1', 'us-central-1', 'eu-west-1']

function createBasePayload(
  connection: WorkloadConnectionConfig,
  queueName: string
): BasePayload & {
  orderId: string
  cartId: string
} {
  return {
    trace: {
      traceId: shortId(),
      producedAt: new Date().toISOString(),
      connectionSlug: connection.slug,
      connectionName: connection.name,
      environment: connection.environment,
      queueName,
    },
    customerId: `cus_${shortId()}`,
    sessionId: `sess_${shortId()}`,
    locale: pickRandom(LOCALES),
    country: pickRandom(COUNTRIES),
    salesChannel: pickRandom([...CHANNELS]),
    orderId: `ord_${shortId()}`,
    cartId: `cart_${shortId()}`,
  }
}

export function createPayload(input: {
  connection: WorkloadConnectionConfig
  queueName: string
  jobName: string
}): Record<string, unknown> {
  const base = createBasePayload(input.connection, input.queueName)

  switch (input.queueName) {
    case 'user-welcome':
      return {
        ...base,
        email: `customer+${shortId()}@example.com`,
        welcomeVariant: pickRandom(['onboarding-a', 'onboarding-b', 'onboarding-c']),
        preferredCategory: pickRandom(['electronics', 'home', 'fashion', 'sport']),
      }
    case 'cart-recovery':
      return {
        ...base,
        abandonedAt: Date.now() - randomInt(20 * 60_000, 36 * 60 * 60_000),
        cartTotalCents: randomInt(4_000, 35_000),
        itemCount: randomInt(1, 8),
        incentiveTier: pickRandom(['none', '5_percent', 'free_shipping']),
      }
    case 'order-processing':
      return {
        ...base,
        orderTotalCents: randomInt(2_500, 75_000),
        lineItems: Array.from({ length: randomInt(1, 5) }, () => ({
          sku: `sku_${shortId()}`,
          quantity: randomInt(1, 3),
          unitPriceCents: randomInt(800, 15_000),
        })),
        source: pickRandom(['checkout', 'subscription_renewal', 'admin_portal']),
      }
    case 'payment-processing':
      return {
        ...base,
        paymentIntentId: `pi_${shortId()}`,
        amountCents: randomInt(2_500, 75_000),
        cardBrand: pickRandom(CARD_BRANDS),
        cardLast4: String(randomInt(1000, 9999)),
        gateway: pickRandom(['stripe', 'adyen', 'braintree']),
      }
    case 'shipment-processing':
      return {
        ...base,
        shipmentId: `shp_${shortId()}`,
        packageWeightGrams: randomInt(250, 15_000),
        carrier: pickRandom(CARRIERS),
        destinationPostalCode: String(randomInt(10000, 99999)),
      }
    case 'inventory-sync':
      return {
        ...base,
        sku: `sku_${shortId()}`,
        warehouseId: pickRandom(WAREHOUSES),
        quantityDelta: randomInt(-8, 25),
        sourceSystem: pickRandom(['oms', 'wms', 'marketplace_feed']),
      }
    case 'refund-processing':
      return {
        ...base,
        refundId: `ref_${shortId()}`,
        amountCents: randomInt(500, 40_000),
        reason: pickRandom(['damaged_item', 'late_delivery', 'customer_remorse']),
      }
    case 'return-processing':
      return {
        ...base,
        returnId: `ret_${shortId()}`,
        itemCondition: pickRandom(['sealed', 'opened', 'damaged']),
        returnReason: pickRandom(['size_mismatch', 'not_as_described', 'defective']),
      }
    case 'fraud-review':
      return {
        ...base,
        riskSignalId: `risk_${shortId()}`,
        scoreInput: {
          ipReputation: randomInt(1, 100),
          deviceRisk: randomInt(1, 100),
          velocityScore: randomInt(1, 100),
        },
        holdReason: pickRandom(['geo_mismatch', 'velocity_spike', 'card_testing']),
      }
    default:
      return {
        ...base,
        jobName: input.jobName,
      }
  }
}

export function createReturnValue(input: {
  queueName: string
  jobName: string
  durationMs: number
  traceId: string
}): Record<string, unknown> {
  const base = {
    success: true,
    queueName: input.queueName,
    jobName: input.jobName,
    traceId: input.traceId,
    processedAt: new Date().toISOString(),
    durationMs: input.durationMs,
  }

  switch (input.queueName) {
    case 'payment-processing':
      return {
        ...base,
        authorizationCode: `auth_${shortId()}`,
        settlementBatch: `batch_${shortId()}`,
      }
    case 'shipment-processing':
      return {
        ...base,
        trackingNumber: `trk_${shortId()}${randomInt(1000, 9999)}`,
      }
    case 'inventory-sync':
      return {
        ...base,
        writeModelVersion: randomInt(100, 999),
      }
    case 'fraud-review':
      return {
        ...base,
        verdict: pickRandom(['approved', 'blocked', 'manual_review']),
      }
    default:
      return base
  }
}

const STAGE_LIBRARY: Record<string, string[]> = {
  'user-welcome': [
    'validate-user-context',
    'create-user-profile',
    'dispatch-welcome-touchpoint',
    'record-onboarding-metrics',
  ],
  'cart-recovery': [
    'load-cart-snapshot',
    'compute-recovery-score',
    'select-message-template',
    'enqueue-reminder',
  ],
  'order-processing': [
    'validate-order',
    'reserve-inventory',
    'persist-order-state',
    'emit-order-events',
  ],
  'payment-processing': [
    'validate-payment-method',
    'authorize-payment',
    'capture-payment',
    'publish-payment-event',
  ],
  'shipment-processing': [
    'rate-carriers',
    'purchase-label',
    'create-shipment-record',
    'notify-fulfillment',
  ],
  'inventory-sync': ['load-current-inventory', 'apply-delta', 'publish-availability'],
  'refund-processing': ['validate-refund', 'issue-refund', 'send-refund-notification'],
  'return-processing': ['create-return-ticket', 'inspect-return', 'update-restock-status'],
  'fraud-review': ['load-fraud-signals', 'score-order-risk', 'apply-risk-decision'],
}

export function getProcessingStages(queueName: string): string[] {
  return STAGE_LIBRARY[queueName] ?? ['receive-job', 'process-job', 'complete-job']
}

export function formatJobLog(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  message: string,
  context?: Record<string, unknown>
): string {
  const contextChunk = context ? ` ${JSON.stringify(context)}` : ''
  return `[${new Date().toISOString()}] ${level}: ${message}${contextChunk}`
}
