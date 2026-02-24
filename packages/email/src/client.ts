import { env, requireEnv } from '@durabull/env'
import { Resend } from 'resend'

let resendClient: Resend | null = null

/**
 * Get or create the Resend client (singleton pattern).
 * Requires RESEND_API_KEY environment variable.
 */
export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = requireEnv('RESEND_API_KEY', 'RESEND_API_KEY environment variable is required')
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

/**
 * Check if email sending is configured (API key is present).
 */
export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY
}
