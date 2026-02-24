/**
 * Job Log Generators
 *
 * Generates realistic job execution logs for completed and failed jobs.
 * These logs simulate what a real application worker would output.
 */

import { pickRandom, randomInRange, shortId, prefixedId } from '../utils'

// ============================================================================
// Log Level Distribution
// ============================================================================

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LOG_LEVEL_WEIGHTS: { level: LogLevel; weight: number }[] = [
  { level: 'DEBUG', weight: 3 },
  { level: 'INFO', weight: 5 },
  { level: 'WARN', weight: 1 },
  { level: 'ERROR', weight: 1 },
]

function pickLogLevel(): LogLevel {
  const total = LOG_LEVEL_WEIGHTS.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * total
  for (const item of LOG_LEVEL_WEIGHTS) {
    random -= item.weight
    if (random <= 0) return item.level
  }
  return 'INFO'
}

// ============================================================================
// Log Templates by Queue
// ============================================================================

interface LogTemplate {
  level: LogLevel
  message: string
}

const PAYMENT_PROCESSING_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Starting payment processing for order {orderId}' },
  { level: 'DEBUG', message: 'Validating payment method {paymentMethodId}' },
  { level: 'DEBUG', message: 'Card details verified: •••• {last4}' },
  { level: 'INFO', message: 'Initiating charge for ${amount} {currency}' },
  { level: 'DEBUG', message: 'Sending request to payment gateway' },
  { level: 'INFO', message: 'Payment gateway response received in {duration}ms' },
  { level: 'DEBUG', message: 'Charge successful: {chargeId}' },
  { level: 'INFO', message: 'Updating order status to paid' },
  { level: 'DEBUG', message: 'Triggering post-payment webhooks' },
  { level: 'INFO', message: 'Payment processing completed successfully' },
  { level: 'WARN', message: 'Payment verification required additional authentication' },
]

const INVOICE_GENERATION_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Starting invoice generation for {invoiceId}' },
  { level: 'DEBUG', message: 'Loading customer data: {customerId}' },
  { level: 'DEBUG', message: 'Calculating line items: {itemCount} items' },
  { level: 'INFO', message: 'Generating PDF document' },
  { level: 'DEBUG', message: 'Applying invoice template: {templateId}' },
  { level: 'DEBUG', message: 'Rendering charts and tables' },
  { level: 'INFO', message: 'PDF generated: {pageCount} pages, {fileSize}' },
  { level: 'DEBUG', message: 'Uploading to storage bucket' },
  { level: 'INFO', message: 'Invoice available at {invoiceUrl}' },
  { level: 'INFO', message: 'Invoice generation completed' },
]

const USER_REGISTRATION_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Processing new user registration' },
  { level: 'DEBUG', message: 'Validating email format: {email}' },
  { level: 'DEBUG', message: 'Checking for existing account' },
  { level: 'INFO', message: 'Creating user account: {userId}' },
  { level: 'DEBUG', message: 'Hashing password with bcrypt' },
  { level: 'INFO', message: 'User record created in database' },
  { level: 'DEBUG', message: 'Generating email verification token' },
  { level: 'INFO', message: 'Sending verification email to {email}' },
  { level: 'DEBUG', message: 'Syncing user to CRM: {crmId}' },
  { level: 'INFO', message: 'User registration completed: {userId}' },
  { level: 'WARN', message: 'Email provider returned soft bounce, will retry' },
]

const USER_NOTIFICATIONS_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Processing notification for user {userId}' },
  { level: 'DEBUG', message: 'Loading user notification preferences' },
  { level: 'DEBUG', message: 'User has {deviceCount} registered devices' },
  { level: 'INFO', message: 'Sending push notification: "{title}"' },
  { level: 'DEBUG', message: 'FCM message ID: {messageId}' },
  { level: 'INFO', message: 'Notification delivered successfully' },
  { level: 'DEBUG', message: 'Recording delivery metrics' },
  { level: 'WARN', message: 'Device token expired, removing from registry' },
]

const IMAGE_PROCESSING_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Starting image processing for {imageId}' },
  { level: 'DEBUG', message: 'Downloading source image from {sourceUrl}' },
  { level: 'DEBUG', message: 'Source image: {width}x{height}, {format}' },
  { level: 'INFO', message: 'Resizing to {targetWidth}x{targetHeight}' },
  { level: 'DEBUG', message: 'Applying compression: quality={quality}' },
  { level: 'DEBUG', message: 'Converting to {outputFormat}' },
  { level: 'INFO', message: 'Image optimization complete: {savedPercent}% size reduction' },
  { level: 'DEBUG', message: 'Uploading processed image to CDN' },
  { level: 'INFO', message: 'Image available at {outputUrl}' },
  { level: 'WARN', message: 'Image contains EXIF data, stripping for privacy' },
]

const VIDEO_TRANSCODING_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Starting video transcode job for {videoId}' },
  { level: 'DEBUG', message: 'Probing source video: {sourceUrl}' },
  { level: 'DEBUG', message: 'Source: {duration}s, {codec}, {resolution}' },
  { level: 'INFO', message: 'Transcoding to {targetResolution}' },
  { level: 'DEBUG', message: 'FFmpeg progress: {progress}%' },
  { level: 'DEBUG', message: 'Encoding frame {currentFrame}/{totalFrames}' },
  { level: 'INFO', message: 'Transcode complete: {outputSize}' },
  { level: 'DEBUG', message: 'Generating HLS segments' },
  { level: 'INFO', message: 'Created {segmentCount} HLS segments' },
  { level: 'DEBUG', message: 'Uploading to streaming bucket' },
  { level: 'INFO', message: 'Video ready for streaming: {playbackUrl}' },
  { level: 'WARN', message: 'Audio track has low bitrate, upsampling' },
]

const ANALYTICS_PIPELINE_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Starting analytics aggregation job' },
  { level: 'DEBUG', message: 'Time range: {startDate} to {endDate}' },
  { level: 'DEBUG', message: 'Querying events table: {eventCount} events' },
  { level: 'INFO', message: 'Aggregating by {dimensions}' },
  { level: 'DEBUG', message: 'Processing batch {batchNum}/{totalBatches}' },
  { level: 'INFO', message: 'Calculated {metricCount} metrics' },
  { level: 'DEBUG', message: 'Writing results to {outputTable}' },
  { level: 'INFO', message: 'Updating dashboard cache' },
  { level: 'DEBUG', message: 'Cache invalidation sent to {nodeCount} nodes' },
  { level: 'INFO', message: 'Analytics pipeline completed' },
  { level: 'WARN', message: 'Some events missing required fields, skipped {skipCount}' },
]

const DATA_EXPORT_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Starting data export job {exportId}' },
  { level: 'DEBUG', message: 'Export requested by user {userId}' },
  { level: 'DEBUG', message: 'Querying data with filters: {filters}' },
  { level: 'INFO', message: 'Found {recordCount} records to export' },
  { level: 'DEBUG', message: 'Writing to {format} format' },
  { level: 'DEBUG', message: 'Progress: {progress}% ({writtenCount}/{recordCount})' },
  { level: 'INFO', message: 'Export file size: {fileSize}' },
  { level: 'DEBUG', message: 'Uploading to exports bucket' },
  { level: 'INFO', message: 'Sending download link to {email}' },
  { level: 'INFO', message: 'Export completed successfully' },
]

const EMAIL_DELIVERY_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Preparing email for delivery' },
  { level: 'DEBUG', message: 'Recipient: {recipient}' },
  { level: 'DEBUG', message: 'Template: {templateId}' },
  { level: 'DEBUG', message: 'Rendering email content' },
  { level: 'INFO', message: 'Sending via {provider}' },
  { level: 'DEBUG', message: 'SMTP response: {smtpCode}' },
  { level: 'INFO', message: 'Email accepted for delivery: {messageId}' },
  { level: 'DEBUG', message: 'Recording delivery event' },
  { level: 'INFO', message: 'Email delivery completed' },
  { level: 'WARN', message: 'Recipient domain has strict DMARC policy' },
]

const WEBHOOK_DISPATCH_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Dispatching webhook: {event}' },
  { level: 'DEBUG', message: 'Endpoint: {endpoint}' },
  { level: 'DEBUG', message: 'Generating signature with {algorithm}' },
  { level: 'INFO', message: 'Sending HTTP POST request' },
  { level: 'DEBUG', message: 'Request body size: {bodySize} bytes' },
  { level: 'DEBUG', message: 'Waiting for response...' },
  { level: 'INFO', message: 'Received response: HTTP {statusCode}' },
  { level: 'DEBUG', message: 'Response time: {responseTime}ms' },
  { level: 'INFO', message: 'Webhook delivered successfully' },
  { level: 'WARN', message: 'Endpoint responded slowly ({responseTime}ms)' },
]

const SCHEDULED_REPORTS_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Generating {reportType} report' },
  { level: 'DEBUG', message: 'Report period: {startDate} to {endDate}' },
  { level: 'DEBUG', message: 'Loading data from warehouse' },
  { level: 'INFO', message: 'Building report sections' },
  { level: 'DEBUG', message: 'Section: {sectionName} - {status}' },
  { level: 'INFO', message: 'Rendering PDF: {pageCount} pages' },
  { level: 'DEBUG', message: 'Applying branding and styles' },
  { level: 'INFO', message: 'Report generated: {fileSize}' },
  { level: 'DEBUG', message: 'Uploading to reports storage' },
  { level: 'INFO', message: 'Sending report to {recipientCount} recipients' },
]

const CLEANUP_TASKS_LOGS: LogTemplate[] = [
  { level: 'INFO', message: 'Starting cleanup task: {taskName}' },
  { level: 'DEBUG', message: 'Scanning for expired items' },
  { level: 'DEBUG', message: 'Found {itemCount} items to clean up' },
  { level: 'INFO', message: 'Processing in batches of {batchSize}' },
  { level: 'DEBUG', message: 'Batch {batchNum}: deleted {deletedCount} items' },
  { level: 'INFO', message: 'Cleanup progress: {progress}%' },
  { level: 'DEBUG', message: 'Archived {archiveCount} items before deletion' },
  { level: 'INFO', message: 'Cleanup completed: {totalDeleted} items removed' },
  { level: 'DEBUG', message: 'Freed {freedSpace} of storage' },
  { level: 'WARN', message: 'Some items locked, skipped {skippedCount}' },
]

// ============================================================================
// Log Templates Map
// ============================================================================

const QUEUE_LOG_TEMPLATES: Record<string, LogTemplate[]> = {
  'payment-processing': PAYMENT_PROCESSING_LOGS,
  'invoice-generation': INVOICE_GENERATION_LOGS,
  'user-registration': USER_REGISTRATION_LOGS,
  'user-notifications': USER_NOTIFICATIONS_LOGS,
  'image-processing': IMAGE_PROCESSING_LOGS,
  'video-transcoding': VIDEO_TRANSCODING_LOGS,
  'analytics-pipeline': ANALYTICS_PIPELINE_LOGS,
  'data-export': DATA_EXPORT_LOGS,
  'email-delivery': EMAIL_DELIVERY_LOGS,
  'webhook-dispatch': WEBHOOK_DISPATCH_LOGS,
  'scheduled-reports': SCHEDULED_REPORTS_LOGS,
  'cleanup-tasks': CLEANUP_TASKS_LOGS,
}

// ============================================================================
// Variable Replacements
// ============================================================================

const VARIABLE_GENERATORS: Record<string, () => string> = {
  orderId: () => prefixedId('ord'),
  paymentMethodId: () => prefixedId('pm'),
  last4: () => String(randomInRange(1000, 9999)),
  amount: () => String(randomInRange(10, 500)),
  currency: () => pickRandom(['USD', 'EUR', 'GBP']),
  duration: () => String(randomInRange(50, 2000)),
  chargeId: () => prefixedId('ch'),
  invoiceId: () => prefixedId('inv'),
  customerId: () => prefixedId('cus'),
  itemCount: () => String(randomInRange(1, 10)),
  templateId: () => prefixedId('tmpl'),
  pageCount: () => String(randomInRange(1, 5)),
  fileSize: () => `${randomInRange(10, 500)}KB`,
  invoiceUrl: () => `https://storage.acme.com/invoices/${shortId()}.pdf`,
  email: () => `user${shortId()}@example.com`,
  userId: () => prefixedId('usr'),
  crmId: () => prefixedId('crm'),
  deviceCount: () => String(randomInRange(1, 5)),
  title: () => pickRandom(['New message', 'Task assigned', 'Payment received']),
  messageId: () => prefixedId('msg'),
  imageId: () => prefixedId('img'),
  sourceUrl: () => `s3://uploads/${shortId()}.jpg`,
  width: () => String(randomInRange(1920, 4096)),
  height: () => String(randomInRange(1080, 2160)),
  format: () => pickRandom(['JPEG', 'PNG', 'WebP']),
  targetWidth: () => String(randomInRange(200, 800)),
  targetHeight: () => String(randomInRange(200, 800)),
  quality: () => String(randomInRange(70, 95)),
  outputFormat: () => pickRandom(['webp', 'jpg', 'png']),
  savedPercent: () => String(randomInRange(30, 70)),
  outputUrl: () => `https://cdn.acme.com/${shortId()}.webp`,
  videoId: () => prefixedId('vid'),
  codec: () => pickRandom(['H.264', 'H.265', 'VP9']),
  resolution: () => pickRandom(['1080p', '720p', '4K']),
  targetResolution: () => pickRandom(['1080p', '720p']),
  progress: () => String(randomInRange(0, 100)),
  currentFrame: () => String(randomInRange(1000, 50000)),
  totalFrames: () => String(randomInRange(50000, 100000)),
  outputSize: () => `${randomInRange(50, 500)}MB`,
  segmentCount: () => String(randomInRange(50, 500)),
  playbackUrl: () => `https://stream.acme.com/${shortId()}/playlist.m3u8`,
  startDate: () => new Date(Date.now() - randomInRange(1, 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: () => new Date().toISOString().split('T')[0],
  eventCount: () => String(randomInRange(10000, 1000000)),
  dimensions: () => pickRandom(['country, device', 'page, referrer', 'user_type']),
  batchNum: () => String(randomInRange(1, 10)),
  totalBatches: () => String(randomInRange(5, 20)),
  metricCount: () => String(randomInRange(10, 50)),
  outputTable: () => `analytics.events_${pickRandom(['hourly', 'daily'])}`,
  nodeCount: () => String(randomInRange(3, 12)),
  skipCount: () => String(randomInRange(0, 100)),
  exportId: () => prefixedId('exp'),
  filters: () => pickRandom(['date > 2024-01-01', 'status = active', 'type IN (a, b)']),
  recordCount: () => String(randomInRange(100, 10000)),
  writtenCount: () => String(randomInRange(50, 5000)),
  recipient: () => `user${shortId()}@example.com`,
  provider: () => pickRandom(['SendGrid', 'SES', 'Postmark']),
  smtpCode: () => pickRandom(['250', '250 OK', '250 2.0.0 OK']),
  event: () => pickRandom(['order.created', 'payment.succeeded', 'user.signup']),
  endpoint: () => `https://api.partner.com/webhook/${shortId()}`,
  algorithm: () => pickRandom(['HMAC-SHA256', 'HMAC-SHA512']),
  bodySize: () => String(randomInRange(200, 5000)),
  statusCode: () => pickRandom(['200', '201', '202']),
  responseTime: () => String(randomInRange(50, 2000)),
  reportType: () => pickRandom(['daily', 'weekly', 'monthly']),
  sectionName: () => pickRandom(['Summary', 'Metrics', 'Charts', 'Tables']),
  status: () => pickRandom(['complete', 'generated', 'ready']),
  recipientCount: () => String(randomInRange(1, 10)),
  taskName: () => pickRandom(['session-cleanup', 'log-purge', 'cache-invalidation']),
  batchSize: () => String(randomInRange(100, 1000)),
  deletedCount: () => String(randomInRange(50, 500)),
  archiveCount: () => String(randomInRange(10, 100)),
  totalDeleted: () => String(randomInRange(500, 5000)),
  freedSpace: () => `${randomInRange(100, 500)}MB`,
  skippedCount: () => String(randomInRange(0, 10)),
}

/**
 * Replace variables in a log message template
 */
function replaceVariables(message: string): string {
  return message.replace(/\{(\w+)\}/g, (match, varName) => {
    const generator = VARIABLE_GENERATORS[varName]
    return generator ? generator() : match
  })
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a single log entry
 */
function generateLogEntry(template: LogTemplate, timestamp: Date): string {
  const message = replaceVariables(template.message)
  return `[${timestamp.toISOString()}] ${template.level}: ${message}`
}

/**
 * Generate job logs for a specific queue
 */
export function generateJobLogs(queueName: string, count?: number): string[] {
  const templates = QUEUE_LOG_TEMPLATES[queueName] || PAYMENT_PROCESSING_LOGS
  const logCount = count || randomInRange(5, 15)
  
  const logs: string[] = []
  let timestamp = new Date(Date.now() - randomInRange(1000, 10000))
  
  // Pick a subset of templates and ensure logical order
  const selectedTemplates = templates.slice(0, Math.min(logCount, templates.length))
  
  for (const template of selectedTemplates) {
    logs.push(generateLogEntry(template, timestamp))
    // Add some time between log entries
    timestamp = new Date(timestamp.getTime() + randomInRange(10, 500))
  }
  
  // Add more logs if needed
  while (logs.length < logCount) {
    const template = pickRandom(templates.filter(t => t.level !== 'ERROR'))
    logs.push(generateLogEntry(template, timestamp))
    timestamp = new Date(timestamp.getTime() + randomInRange(10, 500))
  }
  
  return logs
}

/**
 * Generate error logs for a failed job
 */
export function generateErrorLogs(queueName: string, errorMessage: string): string[] {
  const templates = QUEUE_LOG_TEMPLATES[queueName] || PAYMENT_PROCESSING_LOGS
  const logs: string[] = []
  
  let timestamp = new Date(Date.now() - randomInRange(1000, 10000))
  
  // Add some initial logs
  const initialLogs = templates.slice(0, randomInRange(2, 5))
  for (const template of initialLogs) {
    if (template.level !== 'ERROR') {
      logs.push(generateLogEntry(template, timestamp))
      timestamp = new Date(timestamp.getTime() + randomInRange(10, 500))
    }
  }
  
  // Add warning before error
  logs.push(`[${timestamp.toISOString()}] WARN: Operation encountering issues, retrying...`)
  timestamp = new Date(timestamp.getTime() + randomInRange(100, 1000))
  
  // Add the error
  logs.push(`[${timestamp.toISOString()}] ERROR: ${errorMessage}`)
  
  return logs
}
