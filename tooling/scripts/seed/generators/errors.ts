/**
 * Error Message and Stacktrace Generators
 *
 * Generates realistic error messages and stacktraces for failed jobs.
 * These errors look like real production errors with proper file paths,
 * line numbers, and error types.
 */

import { pickRandom, randomInRange, randomIp, shortId } from '../utils'

// ============================================================================
// Error Categories
// ============================================================================

interface ErrorTemplate {
  type: string
  messages: string[]
  stackFrames: StackFrame[]
}

interface StackFrame {
  function: string
  file: string
  line: number
  column: number
}

// ============================================================================
// Network/Connection Errors
// ============================================================================

const NETWORK_ERRORS: ErrorTemplate[] = [
  {
    type: 'ConnectionRefusedError',
    messages: [
      `ECONNREFUSED ${randomIp()}:5432`,
      `ECONNREFUSED ${randomIp()}:6379`,
      `ECONNREFUSED ${randomIp()}:3306`,
      `connect ECONNREFUSED 127.0.0.1:5432`,
    ],
    stackFrames: [
      { function: 'TCPConnectWrap.afterConnect [as oncomplete]', file: 'node:net', line: 1494, column: 16 },
      { function: 'Connection._handleConnectTimeout', file: '/app/node_modules/pg/lib/connection.js', line: 92, column: 28 },
      { function: 'PostgresClient.connect', file: '/app/node_modules/pg/lib/client.js', line: 93, column: 28 },
      { function: 'Pool._acquireClient', file: '/app/node_modules/pg-pool/index.js', line: 45, column: 18 },
      { function: 'DatabaseService.query', file: '/app/src/services/database.ts', line: 87, column: 24 },
    ],
  },
  {
    type: 'ConnectionTimeoutError',
    messages: [
      'Connection timed out after 30000ms',
      'Socket hang up',
      'ETIMEDOUT: connection timed out',
      'Connection to database timed out',
    ],
    stackFrames: [
      { function: 'Timeout._onTimeout', file: 'node:internal/timers', line: 573, column: 17 },
      { function: 'listOnTimeout', file: 'node:internal/timers', line: 559, column: 17 },
      { function: 'Connection.handleTimeout', file: '/app/node_modules/pg/lib/connection.js', line: 123, column: 15 },
      { function: 'ConnectionPool.acquire', file: '/app/src/lib/connection-pool.ts', line: 156, column: 22 },
    ],
  },
  {
    type: 'DNSLookupError',
    messages: [
      'getaddrinfo ENOTFOUND db.internal.acme.com',
      'getaddrinfo EAI_AGAIN redis.cluster.local',
      'DNS lookup failed for api.stripe.com',
    ],
    stackFrames: [
      { function: 'GetAddrInfoReqWrap.onlookup [as oncomplete]', file: 'node:dns', line: 109, column: 26 },
      { function: 'DNSResolver.resolve', file: '/app/node_modules/dns-resolver/lib/resolver.js', line: 45, column: 12 },
      { function: 'ConnectionManager.connect', file: '/app/src/lib/connection-manager.ts', line: 78, column: 18 },
    ],
  },
]

// ============================================================================
// Validation/Business Logic Errors
// ============================================================================

const VALIDATION_ERRORS: ErrorTemplate[] = [
  {
    type: 'ValidationError',
    messages: [
      'Card declined - insufficient funds (code: card_declined)',
      'Invalid email format: must be a valid email address',
      'Amount must be greater than 0',
      'Required field "customerId" is missing',
      'Invalid currency code: must be ISO 4217 format',
      'Phone number format invalid for region US',
    ],
    stackFrames: [
      { function: 'validateInput', file: '/app/src/validators/input.ts', line: 45, column: 11 },
      { function: 'Validator.validate', file: '/app/src/lib/validator.ts', line: 89, column: 15 },
      { function: 'PaymentProcessor.processPayment', file: '/app/src/processors/payment.ts', line: 234, column: 24 },
      { function: 'PaymentService.charge', file: '/app/src/services/payment.ts', line: 142, column: 18 },
    ],
  },
  {
    type: 'BusinessRuleError',
    messages: [
      'User subscription has expired',
      'Daily transaction limit exceeded ($10,000)',
      'Cannot process refund: original transaction not found',
      'Duplicate transaction detected within 5 minutes',
      'Account is locked due to suspicious activity',
    ],
    stackFrames: [
      { function: 'BusinessRules.evaluate', file: '/app/src/rules/business-rules.ts', line: 156, column: 13 },
      { function: 'RuleEngine.run', file: '/app/src/lib/rule-engine.ts', line: 78, column: 22 },
      { function: 'TransactionService.validate', file: '/app/src/services/transaction.ts', line: 201, column: 16 },
    ],
  },
  {
    type: 'CardDeclinedError',
    messages: [
      'Your card was declined. Please try a different payment method.',
      'Card declined: do_not_honor',
      'Card declined: expired_card',
      'Card declined: incorrect_cvc',
      'Card declined: processing_error',
    ],
    stackFrames: [
      { function: 'StripeAdapter.handleDecline', file: '/app/src/adapters/stripe.ts', line: 87, column: 15 },
      { function: 'PaymentGateway.charge', file: '/app/src/gateways/payment.ts', line: 234, column: 24 },
      { function: 'CheckoutService.processPayment', file: '/app/src/services/checkout.ts', line: 156, column: 20 },
    ],
  },
]

// ============================================================================
// Rate Limiting Errors
// ============================================================================

const RATE_LIMIT_ERRORS: ErrorTemplate[] = [
  {
    type: 'RateLimitError',
    messages: [
      'Rate limit exceeded: 100 requests per minute (retry after: 45s)',
      'Too Many Requests: API rate limit reached',
      'Rate limit exceeded for endpoint /api/v1/users',
      'Request throttled: please retry in 30 seconds',
      'API quota exhausted: 10000/10000 requests used',
    ],
    stackFrames: [
      { function: 'RateLimiter.check', file: '/app/src/middleware/rate-limiter.ts', line: 67, column: 13 },
      { function: 'APIClient.handleResponse', file: '/app/src/lib/api-client.ts', line: 78, column: 13 },
      { function: 'WebhookDispatcher.send', file: '/app/src/services/webhooks.ts', line: 156, column: 20 },
      { function: 'ExternalAPI.request', file: '/app/src/lib/external-api.ts', line: 234, column: 18 },
    ],
  },
  {
    type: 'QuotaExceededError',
    messages: [
      'Monthly email quota exceeded (50000/50000)',
      'Storage quota exceeded: 10GB limit reached',
      'API calls quota exceeded for current billing period',
      'SMS quota exhausted: upgrade plan to continue',
    ],
    stackFrames: [
      { function: 'QuotaManager.check', file: '/app/src/lib/quota-manager.ts', line: 89, column: 17 },
      { function: 'UsageTracker.validate', file: '/app/src/services/usage.ts', line: 145, column: 14 },
      { function: 'EmailService.send', file: '/app/src/services/email.ts', line: 234, column: 22 },
    ],
  },
]

// ============================================================================
// Timeout Errors
// ============================================================================

const TIMEOUT_ERRORS: ErrorTemplate[] = [
  {
    type: 'TimeoutError',
    messages: [
      'Operation timed out after 30000ms',
      'Request timeout: no response received within 60s',
      'Database query timed out after 15000ms',
      'External API call timed out',
      'Job processing exceeded maximum duration (300s)',
    ],
    stackFrames: [
      { function: 'Timeout.<anonymous>', file: 'node:internal/timers', line: 573, column: 17 },
      { function: 'AbortSignal.timeout', file: 'node:internal/abort_controller', line: 167, column: 13 },
      { function: 'fetchWithTimeout', file: '/app/src/lib/fetch.ts', line: 45, column: 11 },
      { function: 'APIClient.request', file: '/app/src/lib/api-client.ts', line: 123, column: 18 },
      { function: 'VideoTranscoder.process', file: '/app/src/workers/video.ts', line: 89, column: 12 },
    ],
  },
  {
    type: 'DeadlineExceededError',
    messages: [
      'Job deadline exceeded: 5 minutes',
      'Processing deadline exceeded, job will be retried',
      'Worker heartbeat timeout: job assumed failed',
    ],
    stackFrames: [
      { function: 'DeadlineMonitor.check', file: '/app/src/lib/deadline-monitor.ts', line: 56, column: 15 },
      { function: 'Worker.processJob', file: '/app/node_modules/bullmq/src/classes/worker.ts', line: 318, column: 20 },
      { function: 'JobProcessor.execute', file: '/app/src/processors/job.ts', line: 145, column: 16 },
    ],
  },
]

// ============================================================================
// Resource Errors
// ============================================================================

const RESOURCE_ERRORS: ErrorTemplate[] = [
  {
    type: 'ResourceExhaustedError',
    messages: [
      'Memory limit exceeded (used: 512MB, limit: 256MB)',
      'CPU usage exceeded threshold: 95%',
      'Disk space critically low: 98% used',
      'File descriptor limit reached (4096/4096)',
    ],
    stackFrames: [
      { function: 'ResourceMonitor.check', file: '/app/src/lib/resource-monitor.ts', line: 78, column: 13 },
      { function: 'ImageProcessor.resize', file: '/app/src/processors/image.ts', line: 67, column: 11 },
      { function: 'Worker.processJob', file: '/app/node_modules/bullmq/src/classes/worker.ts', line: 318, column: 20 },
    ],
  },
  {
    type: 'OutOfMemoryError',
    messages: [
      'JavaScript heap out of memory',
      'FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed',
      'FATAL ERROR: Ineffective mark-compacts near heap limit',
      'Process killed: OOM (Out Of Memory)',
    ],
    stackFrames: [
      { function: 'FATAL ERROR', file: 'v8::internal::Heap::FatalProcessOutOfMemory', line: 0, column: 0 },
      { function: 'processLargeDataset', file: '/app/src/processors/data.ts', line: 234, column: 15 },
      { function: 'AnalyticsService.aggregate', file: '/app/src/services/analytics.ts', line: 156, column: 22 },
    ],
  },
  {
    type: 'StorageError',
    messages: [
      'S3 bucket access denied: insufficient permissions',
      'Failed to upload file: bucket does not exist',
      'Storage write failed: disk full',
      'Object too large: max size 5GB exceeded',
    ],
    stackFrames: [
      { function: 'S3Client.putObject', file: '/app/node_modules/@aws-sdk/client-s3/dist-cjs/commands/PutObjectCommand.js', line: 45, column: 18 },
      { function: 'StorageService.upload', file: '/app/src/services/storage.ts', line: 123, column: 16 },
      { function: 'FileProcessor.save', file: '/app/src/processors/file.ts', line: 89, column: 14 },
    ],
  },
]

// ============================================================================
// External Service Errors
// ============================================================================

const EXTERNAL_SERVICE_ERRORS: ErrorTemplate[] = [
  {
    type: 'ExternalServiceError',
    messages: [
      'Stripe API returned 503: Service Unavailable',
      'SendGrid API error: invalid API key',
      'Twilio: Unable to create message, account suspended',
      'AWS S3: Access Denied (403)',
      'GitHub API: Rate limit exceeded, retry after 3600s',
    ],
    stackFrames: [
      { function: 'StripeClient.request', file: '/app/node_modules/stripe/lib/stripe.js', line: 234, column: 18 },
      { function: 'PaymentAdapter.processRequest', file: '/app/src/adapters/payment.ts', line: 156, column: 22 },
      { function: 'ExternalAPIWrapper.call', file: '/app/src/lib/external-api.ts', line: 89, column: 14 },
    ],
  },
  {
    type: 'WebhookDeliveryError',
    messages: [
      'Webhook delivery failed: HTTP 500 Internal Server Error',
      'Webhook endpoint returned 404 Not Found',
      'SSL certificate verification failed for webhook endpoint',
      'Webhook signature verification failed',
    ],
    stackFrames: [
      { function: 'WebhookDispatcher.deliver', file: '/app/src/services/webhook-dispatcher.ts', line: 145, column: 18 },
      { function: 'HTTPClient.post', file: '/app/src/lib/http-client.ts', line: 78, column: 14 },
      { function: 'RetryQueue.process', file: '/app/src/queues/retry.ts', line: 56, column: 20 },
    ],
  },
  {
    type: 'EmailDeliveryError',
    messages: [
      'Email bounced: recipient address rejected',
      'SMTP connection failed: authentication error',
      'Email rejected: spam content detected',
      'Recipient mailbox full',
      'Invalid recipient: address does not exist',
    ],
    stackFrames: [
      { function: 'SMTPTransport.send', file: '/app/node_modules/nodemailer/lib/smtp-transport/index.js', line: 234, column: 16 },
      { function: 'EmailService.deliver', file: '/app/src/services/email.ts', line: 178, column: 20 },
      { function: 'NotificationWorker.processEmail', file: '/app/src/workers/notification.ts', line: 89, column: 14 },
    ],
  },
]

// ============================================================================
// Database Errors
// ============================================================================

const DATABASE_ERRORS: ErrorTemplate[] = [
  {
    type: 'DatabaseError',
    messages: [
      'duplicate key value violates unique constraint "users_email_key"',
      'null value in column "user_id" violates not-null constraint',
      'foreign key constraint "orders_user_id_fkey" violated',
      'deadlock detected',
      'connection pool exhausted',
    ],
    stackFrames: [
      { function: 'PostgresError.parse', file: '/app/node_modules/pg/lib/client.js', line: 345, column: 18 },
      { function: 'Query.handleError', file: '/app/node_modules/pg/lib/query.js', line: 145, column: 14 },
      { function: 'UserRepository.create', file: '/app/src/repositories/user.ts', line: 78, column: 22 },
      { function: 'UserService.register', file: '/app/src/services/user.ts', line: 156, column: 18 },
    ],
  },
  {
    type: 'TransactionError',
    messages: [
      'Transaction aborted due to conflict',
      'Serialization failure: could not serialize access',
      'Transaction rolled back: lock wait timeout exceeded',
    ],
    stackFrames: [
      { function: 'Transaction.commit', file: '/app/node_modules/pg/lib/transaction.js', line: 89, column: 16 },
      { function: 'TransactionManager.execute', file: '/app/src/lib/transaction-manager.ts', line: 145, column: 20 },
      { function: 'OrderService.createOrder', file: '/app/src/services/order.ts', line: 234, column: 18 },
    ],
  },
]

// ============================================================================
// All Error Categories
// ============================================================================

const ALL_ERROR_TEMPLATES: ErrorTemplate[] = [
  ...NETWORK_ERRORS,
  ...VALIDATION_ERRORS,
  ...RATE_LIMIT_ERRORS,
  ...TIMEOUT_ERRORS,
  ...RESOURCE_ERRORS,
  ...EXTERNAL_SERVICE_ERRORS,
  ...DATABASE_ERRORS,
]

// ============================================================================
// Queue-Specific Error Mappings
// ============================================================================

const QUEUE_ERROR_MAPPINGS: Record<string, ErrorTemplate[]> = {
  'payment-processing': [...VALIDATION_ERRORS, ...EXTERNAL_SERVICE_ERRORS, ...DATABASE_ERRORS],
  'invoice-generation': [...RESOURCE_ERRORS, ...EXTERNAL_SERVICE_ERRORS],
  'user-registration': [...VALIDATION_ERRORS, ...DATABASE_ERRORS, ...EXTERNAL_SERVICE_ERRORS],
  'user-notifications': [...RATE_LIMIT_ERRORS, ...EXTERNAL_SERVICE_ERRORS],
  'image-processing': [...RESOURCE_ERRORS, ...TIMEOUT_ERRORS],
  'video-transcoding': [...RESOURCE_ERRORS, ...TIMEOUT_ERRORS],
  'analytics-pipeline': [...DATABASE_ERRORS, ...TIMEOUT_ERRORS, ...RESOURCE_ERRORS],
  'data-export': [...RESOURCE_ERRORS, ...TIMEOUT_ERRORS],
  'email-delivery': [...EXTERNAL_SERVICE_ERRORS, ...RATE_LIMIT_ERRORS],
  'webhook-dispatch': [...NETWORK_ERRORS, ...RATE_LIMIT_ERRORS, ...TIMEOUT_ERRORS],
  'scheduled-reports': [...DATABASE_ERRORS, ...TIMEOUT_ERRORS],
  'cleanup-tasks': [...DATABASE_ERRORS, ...RESOURCE_ERRORS],
}

// ============================================================================
// Stacktrace Generation
// ============================================================================

/**
 * Build a realistic stacktrace string from an error template
 */
function buildStacktrace(errorTemplate: ErrorTemplate, message: string): string {
  const lines: string[] = []
  
  // Error header
  lines.push(`${errorTemplate.type}: ${message}`)
  
  // Stack frames
  const numFrames = randomInRange(5, 12)
  const frames = [...errorTemplate.stackFrames]
  
  // Add some additional common frames
  const commonFrames: StackFrame[] = [
    { function: 'Worker.processJob', file: '/app/node_modules/bullmq/src/classes/worker.ts', line: 318, column: 20 },
    { function: 'Worker.run', file: '/app/node_modules/bullmq/src/classes/worker.ts', line: 245, column: 18 },
    { function: 'processTicksAndRejections', file: 'node:internal/process/task_queues', line: 95, column: 5 },
    { function: 'async Job.processJob', file: '/app/src/lib/job-processor.ts', line: 45, column: 12 },
    { function: 'runMicrotasks', file: '<anonymous>', line: 0, column: 0 },
  ]
  
  frames.push(...commonFrames)
  
  // Shuffle and take numFrames
  const selectedFrames = frames
    .sort(() => Math.random() - 0.5)
    .slice(0, numFrames)
  
  for (const frame of selectedFrames) {
    // Vary line numbers slightly for realism
    const line = frame.line + randomInRange(-5, 5)
    const col = frame.column + randomInRange(-3, 3)
    lines.push(`    at ${frame.function} (${frame.file}:${Math.max(1, line)}:${Math.max(1, col)})`)
  }
  
  return lines.join('\n')
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a random error for a specific queue
 */
export function generateError(queueName: string): { message: string; stacktrace: string; type: string } {
  const templates = QUEUE_ERROR_MAPPINGS[queueName] || ALL_ERROR_TEMPLATES
  const template = pickRandom(templates)
  const message = pickRandom(template.messages)
  const stacktrace = buildStacktrace(template, message)
  
  return {
    type: template.type,
    message,
    stacktrace,
  }
}

/**
 * Generate consistent error data for a job with multiple failed attempts.
 * All stacktraces will use the same error type and message for consistency.
 */
export function generateConsistentErrorData(queueName: string, attemptCount: number): {
  failedReason: string
  stacktraces: string[]
  type: string
} {
  const templates = QUEUE_ERROR_MAPPINGS[queueName] || ALL_ERROR_TEMPLATES
  const template = pickRandom(templates)
  const message = pickRandom(template.messages)
  const failedReason = `${template.type}: ${message}`
  
  // Generate stacktraces using the SAME error template and message
  const stacktraces = Array.from({ length: attemptCount }, () => 
    buildStacktrace(template, message)
  )
  
  return {
    failedReason,
    stacktraces,
    type: template.type,
  }
}

/**
 * Generate multiple stacktraces for a job with multiple failed attempts
 * @deprecated Use generateConsistentErrorData() for consistent error messages and stacktraces
 */
export function generateStacktraces(queueName: string, attemptCount: number): string[] {
  return Array.from({ length: attemptCount }, () => {
    const error = generateError(queueName)
    return error.stacktrace
  })
}

/**
 * Generate a failed reason string (shorter than full stacktrace)
 * @deprecated Use generateConsistentErrorData() for consistent error messages and stacktraces
 */
export function generateFailedReason(queueName: string): string {
  const templates = QUEUE_ERROR_MAPPINGS[queueName] || ALL_ERROR_TEMPLATES
  const template = pickRandom(templates)
  const message = pickRandom(template.messages)
  return `${template.type}: ${message}`
}
