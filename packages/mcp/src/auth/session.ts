/** Normalize Better Auth / DAL date fields for expiry checks. */
export function toAccessTokenExpiry(
  expiresAt: Date | string | number | null | undefined
): Date | null {
  if (expiresAt == null) {
    return null
  }

  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isMcpAccessTokenExpired(
  expiresAt: Date | string | number | null | undefined,
  now: Date = new Date()
): boolean {
  const expiry = toAccessTokenExpiry(expiresAt)
  if (!expiry) {
    return true
  }

  return expiry.getTime() <= now.getTime()
}
