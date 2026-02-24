/**
 * Realistic Payload Generators
 *
 * Generates realistic job payloads for each queue type.
 * These payloads look like real production data.
 */

import {
  prefixedId,
  shortId,
  pickRandom,
  randomInRange,
  randomAmount,
  randomFileSize,
  randomEmail,
  randomIp,
  randomBool,
  randomPastTime,
} from '../utils'

// ============================================================================
// Common Data Pools
// ============================================================================

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
]

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
]

const COMPANY_NAMES = [
  'Acme Inc', 'TechCorp', 'GlobalSoft', 'DataFlow', 'CloudNine', 'ByteWorks',
  'NetSphere', 'CodeBase', 'InfoTech', 'DigiCore', 'WebScale', 'AppForge',
  'SyncTech', 'LogicWave', 'PrimeSoft', 'NexGen', 'AlphaCode', 'BetaSystems',
]

const CURRENCIES = ['usd', 'eur', 'gbp', 'cad', 'aud']

const COUNTRIES = ['US', 'CA', 'GB', 'DE', 'FR', 'AU', 'JP', 'BR', 'MX', 'IN']

const IMAGE_FORMATS = ['jpg', 'png', 'webp', 'gif', 'heic']

const VIDEO_FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm']

const REPORT_TYPES = ['daily', 'weekly', 'monthly', 'quarterly', 'annual']

const WEBHOOK_EVENTS = [
  'order.created', 'order.completed', 'order.cancelled',
  'payment.succeeded', 'payment.failed', 'payment.refunded',
  'subscription.created', 'subscription.cancelled', 'subscription.renewed',
  'user.created', 'user.updated', 'user.deleted',
  'invoice.created', 'invoice.paid', 'invoice.overdue',
]

// ============================================================================
// Payload Generators by Queue
// ============================================================================

/**
 * Generate a random person (used across multiple payloads)
 */
function randomPerson() {
  const firstName = pickRandom(FIRST_NAMES)
  const lastName = pickRandom(LAST_NAMES)
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${pickRandom(['gmail.com', 'yahoo.com', 'outlook.com', 'company.com'])}`,
  }
}

// ============================================================================
// Payment & Billing Payloads
// ============================================================================

export function paymentProcessingPayload(jobName: string): Record<string, unknown> {
  const person = randomPerson()
  
  switch (jobName) {
    case 'charge-card':
      return {
        orderId: prefixedId('ord'),
        customerId: prefixedId('cus'),
        amount: randomAmount(10, 500),
        currency: pickRandom(CURRENCIES),
        paymentMethodId: prefixedId('pm'),
        paymentMethod: {
          type: 'card',
          brand: pickRandom(['visa', 'mastercard', 'amex', 'discover']),
          last4: String(randomInRange(1000, 9999)),
          expMonth: randomInRange(1, 12),
          expYear: randomInRange(2025, 2030),
        },
        billing: {
          name: person.fullName,
          email: person.email,
          address: {
            line1: `${randomInRange(100, 9999)} ${pickRandom(['Main', 'Oak', 'Elm', 'Park', 'Cedar'])} ${pickRandom(['St', 'Ave', 'Blvd', 'Dr'])}`,
            city: pickRandom(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix']),
            state: pickRandom(['NY', 'CA', 'IL', 'TX', 'AZ']),
            postalCode: String(randomInRange(10000, 99999)),
            country: 'US',
          },
        },
        metadata: {
          source: pickRandom(['web', 'mobile', 'api']),
          sessionId: prefixedId('sess'),
          ipAddress: randomIp(),
        },
      }

    case 'process-refund':
      return {
        refundId: prefixedId('ref'),
        chargeId: prefixedId('ch'),
        orderId: prefixedId('ord'),
        customerId: prefixedId('cus'),
        amount: randomAmount(10, 200),
        currency: pickRandom(CURRENCIES),
        reason: pickRandom(['duplicate', 'fraudulent', 'requested_by_customer', 'product_not_received']),
        metadata: {
          requestedBy: person.email,
          ticketId: prefixedId('tkt'),
        },
      }

    case 'renew-subscription':
      return {
        subscriptionId: prefixedId('sub'),
        customerId: prefixedId('cus'),
        planId: prefixedId('plan'),
        planName: pickRandom(['Starter', 'Professional', 'Enterprise', 'Team']),
        interval: pickRandom(['month', 'year']),
        amount: randomAmount(9, 299),
        currency: pickRandom(CURRENCIES),
        currentPeriodEnd: Date.now() + randomInRange(1, 30) * 24 * 60 * 60 * 1000,
        billingEmail: person.email,
      }

    case 'update-payment-method':
      return {
        customerId: prefixedId('cus'),
        oldPaymentMethodId: prefixedId('pm'),
        newPaymentMethodId: prefixedId('pm'),
        newMethod: {
          type: 'card',
          brand: pickRandom(['visa', 'mastercard', 'amex']),
          last4: String(randomInRange(1000, 9999)),
        },
        setAsDefault: randomBool(0.8),
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

export function invoiceGenerationPayload(jobName: string): Record<string, unknown> {
  const person = randomPerson()

  switch (jobName) {
    case 'generate-invoice-pdf':
      return {
        invoiceId: prefixedId('inv'),
        invoiceNumber: `INV-${randomInRange(10000, 99999)}`,
        customerId: prefixedId('cus'),
        customer: {
          name: randomBool(0.3) ? pickRandom(COMPANY_NAMES) : person.fullName,
          email: person.email,
          address: {
            line1: `${randomInRange(100, 9999)} Business Park`,
            city: pickRandom(['San Francisco', 'Seattle', 'Austin', 'Denver', 'Boston']),
            country: pickRandom(COUNTRIES),
          },
        },
        lineItems: Array.from({ length: randomInRange(1, 5) }, () => ({
          description: pickRandom(['Professional Services', 'Software License', 'Support Hours', 'Consulting', 'Training']),
          quantity: randomInRange(1, 10),
          unitPrice: randomAmount(50, 500),
        })),
        subtotal: randomAmount(100, 5000),
        tax: randomAmount(10, 500),
        total: randomAmount(110, 5500),
        currency: pickRandom(CURRENCIES),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }

    case 'send-invoice-email':
      return {
        invoiceId: prefixedId('inv'),
        recipientEmail: person.email,
        recipientName: person.fullName,
        invoiceNumber: `INV-${randomInRange(10000, 99999)}`,
        amount: randomAmount(100, 5000),
        currency: pickRandom(CURRENCIES),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        pdfUrl: `https://storage.example.com/invoices/${shortId()}.pdf`,
      }

    case 'generate-receipt':
      return {
        receiptId: prefixedId('rcpt'),
        paymentId: prefixedId('pay'),
        customerId: prefixedId('cus'),
        customerEmail: person.email,
        amount: randomAmount(10, 1000),
        currency: pickRandom(CURRENCIES),
        paymentMethod: `•••• ${randomInRange(1000, 9999)}`,
        description: pickRandom(['Subscription payment', 'One-time purchase', 'Service fee']),
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

// ============================================================================
// User Management Payloads
// ============================================================================

export function userRegistrationPayload(jobName: string): Record<string, unknown> {
  const person = randomPerson()

  switch (jobName) {
    case 'create-account':
      return {
        userId: prefixedId('usr'),
        email: person.email,
        name: person.fullName,
        source: pickRandom(['organic', 'referral', 'paid_ad', 'social', 'partner']),
        referralCode: randomBool(0.3) ? prefixedId('ref') : null,
        marketingConsent: randomBool(0.7),
        metadata: {
          signupIp: randomIp(),
          country: pickRandom(COUNTRIES),
          timezone: pickRandom(['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']),
          locale: pickRandom(['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE']),
        },
      }

    case 'send-verification-email':
      return {
        userId: prefixedId('usr'),
        email: person.email,
        name: person.firstName,
        verificationToken: shortId() + shortId(),
        verificationUrl: `https://app.example.com/verify/${shortId()}`,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }

    case 'setup-default-workspace':
      return {
        userId: prefixedId('usr'),
        workspaceId: prefixedId('ws'),
        workspaceName: `${person.firstName}'s Workspace`,
        template: pickRandom(['blank', 'starter', 'team', 'enterprise']),
        features: pickRandom([['projects'], ['projects', 'tasks'], ['projects', 'tasks', 'calendar']]),
      }

    case 'sync-to-crm':
      return {
        userId: prefixedId('usr'),
        email: person.email,
        name: person.fullName,
        crmProvider: pickRandom(['salesforce', 'hubspot', 'pipedrive', 'zoho']),
        contactId: prefixedId('crm'),
        properties: {
          source: pickRandom(['website', 'referral', 'event']),
          plan: pickRandom(['free', 'starter', 'professional']),
          company: randomBool(0.4) ? pickRandom(COMPANY_NAMES) : null,
        },
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

export function userNotificationsPayload(jobName: string): Record<string, unknown> {
  const person = randomPerson()

  switch (jobName) {
    case 'send-push-notification':
      return {
        userId: prefixedId('usr'),
        deviceTokens: Array.from({ length: randomInRange(1, 3) }, () => shortId() + shortId()),
        notification: {
          title: pickRandom([
            'New message received',
            'Your report is ready',
            'Task assigned to you',
            'Payment confirmed',
            'Weekly summary available',
          ]),
          body: pickRandom([
            'Click to view details',
            'Tap to open the app',
            'Review now',
          ]),
          data: {
            type: pickRandom(['message', 'task', 'payment', 'report']),
            targetId: shortId(),
          },
        },
        priority: pickRandom(['high', 'normal', 'low']),
      }

    case 'create-in-app-message':
      return {
        userId: prefixedId('usr'),
        messageId: prefixedId('msg'),
        type: pickRandom(['info', 'success', 'warning', 'action_required']),
        title: pickRandom([
          'Welcome to the new dashboard',
          'Your trial is ending soon',
          'New feature available',
          'Security alert',
        ]),
        body: 'Click here to learn more about this update.',
        actionUrl: `/app/${pickRandom(['settings', 'billing', 'features', 'security'])}`,
        expiresAt: Date.now() + randomInRange(1, 14) * 24 * 60 * 60 * 1000,
      }

    case 'send-activity-digest':
      return {
        userId: prefixedId('usr'),
        email: person.email,
        digestType: pickRandom(['daily', 'weekly']),
        period: {
          start: Date.now() - 7 * 24 * 60 * 60 * 1000,
          end: Date.now(),
        },
        stats: {
          tasksCompleted: randomInRange(0, 50),
          messagesReceived: randomInRange(0, 100),
          collaborators: randomInRange(0, 20),
        },
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

// ============================================================================
// Media & Files Payloads
// ============================================================================

export function imageProcessingPayload(jobName: string): Record<string, unknown> {
  const imageId = shortId()
  const format = pickRandom(IMAGE_FORMATS)

  switch (jobName) {
    case 'resize-image':
      return {
        imageId: prefixedId('img'),
        sourceUrl: `s3://uploads/images/${imageId}.${format}`,
        sourceBucket: 'uploads',
        sourceKey: `images/${imageId}.${format}`,
        targetSizes: pickRandom([
          [{ width: 150, height: 150 }, { width: 300, height: 300 }, { width: 600, height: 600 }],
          [{ width: 200, height: 200 }, { width: 400, height: 400 }, { width: 800, height: 800 }],
          [{ width: 100, height: 100 }, { width: 500, height: 500 }],
        ]),
        outputBucket: 'processed-images',
        outputFormat: pickRandom(['webp', 'jpg', 'png']),
        quality: randomInRange(70, 95),
        metadata: {
          uploadedBy: prefixedId('usr'),
          originalSize: randomFileSize(0.5, 10),
        },
      }

    case 'compress-image':
      return {
        imageId: prefixedId('img'),
        sourceUrl: `s3://uploads/images/${imageId}.${format}`,
        targetQuality: randomInRange(60, 90),
        maxWidth: pickRandom([1920, 2560, 3840]),
        maxHeight: pickRandom([1080, 1440, 2160]),
        preserveMetadata: randomBool(0.3),
        outputBucket: 'compressed-images',
      }

    case 'generate-thumbnail':
      return {
        imageId: prefixedId('img'),
        sourceUrl: `s3://uploads/images/${imageId}.${format}`,
        thumbnailSize: pickRandom([
          { width: 150, height: 150 },
          { width: 200, height: 200 },
          { width: 100, height: 100 },
        ]),
        cropMode: pickRandom(['center', 'smart', 'entropy']),
        outputBucket: 'thumbnails',
        outputKey: `thumb_${imageId}.webp`,
      }

    case 'extract-metadata':
      return {
        imageId: prefixedId('img'),
        sourceUrl: `s3://uploads/images/${imageId}.${format}`,
        extractExif: true,
        extractColors: randomBool(0.5),
        detectFaces: randomBool(0.3),
        detectObjects: randomBool(0.2),
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

export function videoTranscodingPayload(jobName: string): Record<string, unknown> {
  const videoId = shortId()
  const format = pickRandom(VIDEO_FORMATS)
  const duration = randomInRange(30, 7200) // 30s to 2 hours

  switch (jobName) {
    case 'transcode-720p':
    case 'transcode-1080p':
      const resolution = jobName === 'transcode-720p' ? '720p' : '1080p'
      return {
        videoId: prefixedId('vid'),
        sourceUrl: `s3://uploads/videos/${videoId}.${format}`,
        sourceBucket: 'uploads',
        sourceKey: `videos/${videoId}.${format}`,
        outputResolution: resolution,
        outputCodec: pickRandom(['h264', 'h265', 'vp9']),
        outputContainer: 'mp4',
        bitrate: resolution === '720p' ? '2500k' : '5000k',
        outputBucket: 'transcoded-videos',
        outputKey: `${videoId}_${resolution}.mp4`,
        metadata: {
          duration,
          originalCodec: pickRandom(['h264', 'prores', 'hevc']),
          originalSize: randomFileSize(50, 2000),
          uploadedBy: prefixedId('usr'),
        },
      }

    case 'generate-hls-playlist':
      return {
        videoId: prefixedId('vid'),
        sourceUrl: `s3://transcoded-videos/${videoId}_1080p.mp4`,
        outputBucket: 'streaming',
        outputPrefix: `hls/${videoId}`,
        segmentDuration: 6,
        variants: [
          { resolution: '360p', bitrate: '800k' },
          { resolution: '720p', bitrate: '2500k' },
          { resolution: '1080p', bitrate: '5000k' },
        ],
        includeSubtitles: randomBool(0.3),
        encryptSegments: randomBool(0.2),
      }

    case 'extract-audio':
      return {
        videoId: prefixedId('vid'),
        sourceUrl: `s3://uploads/videos/${videoId}.${format}`,
        outputFormat: pickRandom(['mp3', 'aac', 'wav']),
        bitrate: pickRandom(['128k', '192k', '256k', '320k']),
        outputBucket: 'audio-extracts',
        outputKey: `${videoId}.${pickRandom(['mp3', 'aac'])}`,
        normalizeAudio: randomBool(0.5),
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

// ============================================================================
// Data & Analytics Payloads
// ============================================================================

export function analyticsPipelinePayload(jobName: string): Record<string, unknown> {
  switch (jobName) {
    case 'aggregate-events':
      return {
        aggregationId: prefixedId('agg'),
        eventTypes: pickRandom([
          ['page_view', 'click', 'scroll'],
          ['purchase', 'add_to_cart', 'checkout'],
          ['signup', 'login', 'logout'],
        ]),
        timeRange: {
          start: Date.now() - 24 * 60 * 60 * 1000,
          end: Date.now(),
        },
        granularity: pickRandom(['minute', 'hour', 'day']),
        dimensions: pickRandom([['country'], ['device', 'browser'], ['page', 'referrer']]),
        outputTable: `analytics.events_${pickRandom(['hourly', 'daily'])}`,
      }

    case 'calculate-metrics':
      return {
        metricsJobId: prefixedId('met'),
        metrics: pickRandom([
          ['dau', 'mau', 'retention'],
          ['revenue', 'arpu', 'ltv'],
          ['conversion_rate', 'bounce_rate', 'session_duration'],
        ]),
        timeRange: {
          start: Date.now() - 7 * 24 * 60 * 60 * 1000,
          end: Date.now(),
        },
        compareWithPrevious: randomBool(0.7),
        outputFormat: 'json',
      }

    case 'update-dashboard-cache':
      return {
        dashboardId: prefixedId('dash'),
        widgets: Array.from({ length: randomInRange(3, 10) }, () => ({
          widgetId: shortId(),
          type: pickRandom(['chart', 'metric', 'table', 'map']),
        })),
        cacheKey: `dashboard:${shortId()}`,
        ttl: randomInRange(300, 3600),
      }

    case 'generate-insights':
      return {
        insightsJobId: prefixedId('ins'),
        analysisType: pickRandom(['anomaly_detection', 'trend_analysis', 'cohort_analysis', 'funnel_analysis']),
        dataSource: pickRandom(['events', 'users', 'transactions']),
        timeRange: {
          start: Date.now() - 30 * 24 * 60 * 60 * 1000,
          end: Date.now(),
        },
        confidence: randomInRange(90, 99) / 100,
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

export function dataExportPayload(jobName: string): Record<string, unknown> {
  const person = randomPerson()

  switch (jobName) {
    case 'export-to-csv':
    case 'export-to-json':
      const format = jobName.includes('csv') ? 'csv' : 'json'
      return {
        exportId: prefixedId('exp'),
        requestedBy: prefixedId('usr'),
        dataType: pickRandom(['users', 'orders', 'events', 'products']),
        filters: {
          dateRange: {
            start: Date.now() - randomInRange(7, 90) * 24 * 60 * 60 * 1000,
            end: Date.now(),
          },
          status: pickRandom([null, 'active', 'completed']),
        },
        format,
        includeHeaders: true,
        outputBucket: 'exports',
        outputKey: `${format}/${shortId()}.${format}`,
        notifyEmail: person.email,
      }

    case 'gdpr-data-request':
      return {
        requestId: prefixedId('gdpr'),
        userId: prefixedId('usr'),
        email: person.email,
        requestType: 'data_access',
        dataSources: ['profile', 'orders', 'events', 'messages', 'preferences'],
        format: 'json',
        deadline: Date.now() + 30 * 24 * 60 * 60 * 1000,
        notifyOnComplete: true,
      }

    case 'gdpr-deletion-request':
      return {
        requestId: prefixedId('gdpr'),
        userId: prefixedId('usr'),
        email: person.email,
        requestType: 'data_deletion',
        retainForLegal: ['invoices', 'tax_records'],
        deleteFrom: ['profile', 'preferences', 'events', 'messages'],
        anonymizeIn: ['orders', 'support_tickets'],
        deadline: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

// ============================================================================
// Communication Payloads
// ============================================================================

export function emailDeliveryPayload(jobName: string): Record<string, unknown> {
  const person = randomPerson()

  switch (jobName) {
    case 'send-transactional':
      return {
        emailId: prefixedId('eml'),
        to: person.email,
        toName: person.fullName,
        from: 'noreply@acme.com',
        fromName: 'Acme App',
        templateId: prefixedId('tmpl'),
        templateName: pickRandom(['order_confirmation', 'shipping_update', 'payment_receipt', 'account_update']),
        variables: {
          firstName: person.firstName,
          orderId: prefixedId('ord'),
          amount: `$${(randomAmount(10, 500) / 100).toFixed(2)}`,
        },
        headers: {
          'X-Transaction-Id': shortId(),
          'X-Category': 'transactional',
        },
        trackOpens: true,
        trackClicks: true,
      }

    case 'send-marketing':
      return {
        campaignId: prefixedId('camp'),
        emailId: prefixedId('eml'),
        to: person.email,
        toName: person.fullName,
        from: 'marketing@acme.com',
        fromName: 'Acme Team',
        subject: pickRandom([
          'Special offer just for you!',
          'Your weekly roundup is here',
          "Don't miss out on these deals",
          "New features you'll love",
        ]),
        templateId: prefixedId('tmpl'),
        variables: {
          firstName: person.firstName,
          unsubscribeUrl: `https://acme.com/unsubscribe/${shortId()}`,
        },
        listId: prefixedId('list'),
        scheduledAt: randomBool(0.3) ? Date.now() + randomInRange(1, 24) * 60 * 60 * 1000 : null,
      }

    case 'send-password-reset':
      return {
        userId: prefixedId('usr'),
        email: person.email,
        name: person.firstName,
        resetToken: shortId() + shortId() + shortId(),
        resetUrl: `https://app.acme.com/reset-password/${shortId()}`,
        expiresAt: Date.now() + 60 * 60 * 1000,
        ipAddress: randomIp(),
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      }

    case 'send-welcome-email':
      return {
        userId: prefixedId('usr'),
        email: person.email,
        name: person.fullName,
        firstName: person.firstName,
        templateId: 'tmpl_welcome_v2',
        variables: {
          firstName: person.firstName,
          loginUrl: 'https://app.acme.com/login',
          gettingStartedUrl: 'https://docs.acme.com/getting-started',
        },
        sendAfter: Date.now() + 5 * 60 * 1000, // 5 minutes after signup
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

export function webhookDispatchPayload(jobName: string): Record<string, unknown> {
  switch (jobName) {
    case 'dispatch-webhook':
      return {
        webhookId: prefixedId('whk'),
        subscriptionId: prefixedId('sub'),
        endpoint: `https://${pickRandom(['api', 'hooks', 'webhooks'])}.${pickRandom(['partner', 'client', 'integration'])}.com/webhook/${shortId()}`,
        event: pickRandom(WEBHOOK_EVENTS),
        payload: {
          id: prefixedId('evt'),
          type: pickRandom(WEBHOOK_EVENTS),
          created: Date.now(),
          data: {
            object: {
              id: shortId(),
              status: pickRandom(['active', 'completed', 'pending']),
            },
          },
        },
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': shortId(),
          'X-Signature': shortId() + shortId(),
        },
        timeout: randomInRange(5000, 30000),
        retryCount: 0,
        maxRetries: 5,
      }

    case 'verify-webhook-signature':
      return {
        subscriptionId: prefixedId('sub'),
        endpoint: `https://api.partner.com/webhook/${shortId()}`,
        signatureHeader: 'X-Signature-256',
        secret: shortId() + shortId(),
        algorithm: pickRandom(['sha256', 'sha512']),
      }

    case 'retry-failed-webhook':
      return {
        webhookId: prefixedId('whk'),
        originalJobId: shortId(),
        endpoint: `https://hooks.client.com/webhook/${shortId()}`,
        event: pickRandom(WEBHOOK_EVENTS),
        payload: { id: shortId(), type: 'retry' },
        attemptNumber: randomInRange(1, 4),
        maxAttempts: 5,
        lastError: pickRandom([
          'Connection timeout',
          'HTTP 503 Service Unavailable',
          'HTTP 429 Too Many Requests',
        ]),
        nextRetryAt: Date.now() + randomInRange(60000, 3600000),
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

// ============================================================================
// Background Tasks Payloads
// ============================================================================

export function scheduledReportsPayload(jobName: string): Record<string, unknown> {
  const person = randomPerson()

  switch (jobName) {
    case 'generate-daily-report':
    case 'generate-weekly-report':
    case 'generate-monthly-report':
      const reportType = jobName.replace('generate-', '').replace('-report', '')
      return {
        reportId: prefixedId('rpt'),
        reportType,
        reportName: `${pickRandom(['Sales', 'Usage', 'Performance', 'Activity'])} ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        timeRange: {
          start: Date.now() - (reportType === 'daily' ? 1 : reportType === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000,
          end: Date.now(),
        },
        format: pickRandom(['pdf', 'xlsx', 'html']),
        sections: pickRandom([
          ['summary', 'charts', 'tables'],
          ['overview', 'metrics', 'trends'],
          ['highlights', 'details', 'recommendations'],
        ]),
        recipients: Array.from({ length: randomInRange(1, 5) }, () => randomEmail()),
        outputBucket: 'reports',
      }

    case 'send-report-email':
      return {
        reportId: prefixedId('rpt'),
        reportUrl: `https://storage.acme.com/reports/${shortId()}.pdf`,
        recipients: Array.from({ length: randomInRange(1, 3) }, () => ({
          email: randomEmail(),
          name: `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`,
        })),
        subject: `Your ${pickRandom(REPORT_TYPES)} report is ready`,
        reportType: pickRandom(REPORT_TYPES),
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

export function cleanupTasksPayload(jobName: string): Record<string, unknown> {
  switch (jobName) {
    case 'cleanup-expired-sessions':
      return {
        taskId: prefixedId('task'),
        sessionPrefix: 'session:',
        maxAge: randomInRange(24, 168) * 60 * 60 * 1000, // 1-7 days
        batchSize: randomInRange(100, 1000),
        dryRun: false,
      }

    case 'purge-old-logs':
      return {
        taskId: prefixedId('task'),
        logTypes: pickRandom([
          ['access', 'error', 'audit'],
          ['application', 'security'],
          ['debug', 'info'],
        ]),
        retentionDays: randomInRange(30, 90),
        archiveBefore: Date.now() - randomInRange(30, 90) * 24 * 60 * 60 * 1000,
        archiveBucket: 'log-archives',
        deleteAfterArchive: true,
      }

    case 'invalidate-cache':
      return {
        taskId: prefixedId('task'),
        cachePatterns: pickRandom([
          ['cache:user:*', 'cache:api:*'],
          ['cache:products:*'],
          ['cache:search:*', 'cache:recommendations:*'],
        ]),
        reason: pickRandom(['deployment', 'data_update', 'scheduled', 'manual']),
        notifyServices: randomBool(0.5),
      }

    case 'archive-old-data':
      return {
        taskId: prefixedId('task'),
        dataType: pickRandom(['events', 'logs', 'messages', 'notifications']),
        archiveOlderThan: Date.now() - randomInRange(90, 365) * 24 * 60 * 60 * 1000,
        archiveFormat: pickRandom(['parquet', 'json.gz', 'csv.gz']),
        archiveBucket: 'data-archives',
        deleteAfterArchive: randomBool(0.7),
        estimatedRecords: randomInRange(10000, 1000000),
      }

    default:
      return { type: jobName, id: shortId() }
  }
}

// ============================================================================
// Main Payload Generator
// ============================================================================

const PAYLOAD_GENERATORS: Record<string, (jobName: string) => Record<string, unknown>> = {
  'payment-processing': paymentProcessingPayload,
  'invoice-generation': invoiceGenerationPayload,
  'user-registration': userRegistrationPayload,
  'user-notifications': userNotificationsPayload,
  'image-processing': imageProcessingPayload,
  'video-transcoding': videoTranscodingPayload,
  'analytics-pipeline': analyticsPipelinePayload,
  'data-export': dataExportPayload,
  'email-delivery': emailDeliveryPayload,
  'webhook-dispatch': webhookDispatchPayload,
  'scheduled-reports': scheduledReportsPayload,
  'cleanup-tasks': cleanupTasksPayload,
}

/**
 * Generate a payload for a specific queue and job type
 */
export function generatePayload(queueName: string, jobName: string): Record<string, unknown> {
  const generator = PAYLOAD_GENERATORS[queueName]
  if (generator) {
    return generator(jobName)
  }
  return { type: jobName, id: shortId(), timestamp: Date.now() }
}

/**
 * Generate a return value for a completed job
 */
export function generateReturnValue(queueName: string, jobName: string): Record<string, unknown> {
  const baseResult = {
    success: true,
    processedAt: new Date().toISOString(),
    duration: randomInRange(50, 5000),
  }

  // Add queue-specific return values
  switch (queueName) {
    case 'payment-processing':
      return {
        ...baseResult,
        chargeId: prefixedId('ch'),
        status: 'succeeded',
        receiptUrl: `https://pay.acme.com/receipts/${shortId()}`,
      }
    case 'image-processing':
      return {
        ...baseResult,
        outputUrls: {
          thumbnail: `https://cdn.acme.com/thumb/${shortId()}.webp`,
          medium: `https://cdn.acme.com/medium/${shortId()}.webp`,
          large: `https://cdn.acme.com/large/${shortId()}.webp`,
        },
        savedBytes: randomInRange(10000, 500000),
      }
    case 'video-transcoding':
      return {
        ...baseResult,
        outputUrl: `https://cdn.acme.com/videos/${shortId()}.mp4`,
        duration: randomInRange(30, 7200),
        fileSize: randomFileSize(10, 500),
      }
    case 'email-delivery':
      return {
        ...baseResult,
        messageId: prefixedId('msg'),
        provider: pickRandom(['sendgrid', 'ses', 'postmark']),
        delivered: true,
      }
    case 'webhook-dispatch':
      return {
        ...baseResult,
        statusCode: 200,
        responseTime: randomInRange(50, 2000),
        acknowledged: true,
      }
    default:
      return baseResult
  }
}
