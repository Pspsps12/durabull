import { pickRandom, randomInt, shortId } from './random'

interface ErrorDetails {
  queueName: string
  jobName: string
  traceId: string
  connectionSlug: string
  attempt: number
}

class WorkloadProcessingError extends Error {
  readonly code: string
  readonly details: ErrorDetails

  constructor(name: string, code: string, message: string, details: ErrorDetails) {
    super(message)
    this.name = name
    this.code = code
    this.details = details
  }
}

class PaymentGatewayTimeoutError extends WorkloadProcessingError {
  constructor(details: ErrorDetails) {
    super(
      'PaymentGatewayTimeoutError',
      'PAYMENT_GATEWAY_TIMEOUT',
      `Payment gateway timeout after ${randomInt(1_500, 6_500)}ms (trace ${details.traceId})`,
      details
    )
  }
}

class InventoryRaceConditionError extends WorkloadProcessingError {
  constructor(details: ErrorDetails) {
    super(
      'InventoryRaceConditionError',
      'INVENTORY_RACE',
      `Inventory reservation conflict on sku_${shortId()} (trace ${details.traceId})`,
      details
    )
  }
}

class ShippingCarrierError extends WorkloadProcessingError {
  constructor(details: ErrorDetails) {
    super(
      'ShippingCarrierError',
      'CARRIER_UNAVAILABLE',
      pickRandom([
        `Carrier API returned HTTP 503 while purchasing label (trace ${details.traceId})`,
        `Carrier quote endpoint timed out for region us-east (trace ${details.traceId})`,
        `Carrier account throttled: retry window 120s (trace ${details.traceId})`,
      ]),
      details
    )
  }
}

class RefundReconciliationError extends WorkloadProcessingError {
  constructor(details: ErrorDetails) {
    super(
      'RefundReconciliationError',
      'REFUND_RECONCILIATION',
      `Refund ledger mismatch for payout_${shortId()} (trace ${details.traceId})`,
      details
    )
  }
}

class FraudServiceDegradedError extends WorkloadProcessingError {
  constructor(details: ErrorDetails) {
    super(
      'FraudServiceDegradedError',
      'FRAUD_ENGINE_DEGRADED',
      `Risk-scoring provider unavailable (circuit open, trace ${details.traceId})`,
      details
    )
  }
}

class GenericDownstreamError extends WorkloadProcessingError {
  constructor(details: ErrorDetails) {
    super(
      'GenericDownstreamError',
      'DOWNSTREAM_FAILURE',
      pickRandom([
        `Downstream dependency timeout in worker graph (trace ${details.traceId})`,
        `Unexpected 5xx response from internal service mesh (trace ${details.traceId})`,
        `Transient network partition while processing ${details.jobName} (trace ${details.traceId})`,
      ]),
      details
    )
  }
}

export function createSimulatedProcessingError(input: {
  queueName: string
  jobName: string
  traceId: string
  connectionSlug: string
  attempt: number
}): Error {
  const details: ErrorDetails = {
    queueName: input.queueName,
    jobName: input.jobName,
    traceId: input.traceId,
    connectionSlug: input.connectionSlug,
    attempt: input.attempt,
  }

  switch (input.queueName) {
    case 'payment-processing':
      return new PaymentGatewayTimeoutError(details)
    case 'inventory-sync':
    case 'order-processing':
      return new InventoryRaceConditionError(details)
    case 'shipment-processing':
      return new ShippingCarrierError(details)
    case 'refund-processing':
    case 'return-processing':
      return new RefundReconciliationError(details)
    case 'fraud-review':
      return new FraudServiceDegradedError(details)
    default:
      return new GenericDownstreamError(details)
  }
}
