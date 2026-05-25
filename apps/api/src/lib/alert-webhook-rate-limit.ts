import { sendTestWebhookDelivery, type TestWebhookDeliveryInput } from './alert-webhook-test'

const TEST_WEBHOOK_LIMIT = 10
const TEST_WEBHOOK_WINDOW_MS = 60_000
const testWebhookAttempts = new Map<string, number[]>()

export async function sendRateLimitedTestWebhook(input: TestWebhookDeliveryInput) {
  const now = Date.now()
  const attempts = (testWebhookAttempts.get(input.organizationId) ?? []).filter(
    (timestamp) => now - timestamp < TEST_WEBHOOK_WINDOW_MS
  )

  if (attempts.length >= TEST_WEBHOOK_LIMIT) {
    return {
      success: false,
      httpStatus: null,
      durationMs: 0,
      retryable: false,
      error: 'Webhook test rate limit exceeded. Try again in a minute.',
    } as const
  }

  attempts.push(now)
  testWebhookAttempts.set(input.organizationId, attempts)

  return sendTestWebhookDelivery(input)
}

export function resetTestWebhookRateLimitsForTests(): void {
  testWebhookAttempts.clear()
}
