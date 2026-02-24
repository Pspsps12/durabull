/**
 * Seed Script Utilities
 *
 * Shared utility functions for the seed script including
 * ID generation, random selection, and formatting helpers.
 */

import { uuidv7 } from '@durabull/utils/uuid'

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a short ID for display purposes (8 characters)
 */
export function shortId(): string {
  return uuidv7().slice(0, 8)
}

/**
 * Generate a prefixed ID (e.g., "ord_abc123", "cus_xyz789")
 */
export function prefixedId(prefix: string): string {
  return `${prefix}_${shortId()}`
}

/**
 * Generate a full UUIDv7
 */
export function generateId(): string {
  return uuidv7()
}

// ============================================================================
// Random Selection
// ============================================================================

/**
 * Pick a random item from an array
 */
export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * Pick multiple random items from an array (with replacement)
 */
export function pickMultiple<T>(items: T[], count: number): T[] {
  return Array.from({ length: count }, () => pickRandom(items))
}

/**
 * Pick a random number in a range (inclusive)
 */
export function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Pick a weighted random item
 */
export function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight
  for (const item of items) {
    random -= item.weight
    if (random <= 0) return item
  }
  return items[items.length - 1]
}

/**
 * Random boolean with given probability (0-1)
 */
export function randomBool(probability = 0.5): boolean {
  return Math.random() < probability
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Get timestamp from some time ago
 */
export function timeAgo(ms: number): number {
  return Date.now() - ms
}

/**
 * Get timestamp for some time in the future
 */
export function timeFromNow(ms: number): number {
  return Date.now() + ms
}

/**
 * Random timestamp within a range from now
 */
export function randomTimeInRange(minMs: number, maxMs: number): number {
  return Date.now() + randomInRange(minMs, maxMs)
}

/**
 * Random timestamp in the past within a range
 */
export function randomPastTime(minMsAgo: number, maxMsAgo: number): number {
  return Date.now() - randomInRange(minMsAgo, maxMsAgo)
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

// ============================================================================
// Data Generation
// ============================================================================

/**
 * Generate a random email address
 */
export function randomEmail(domain = 'example.com'): string {
  const names = ['john', 'jane', 'mike', 'sarah', 'alex', 'emma', 'chris', 'lisa', 'david', 'maria']
  const name = pickRandom(names)
  return `${name}.${shortId()}@${domain}`
}

/**
 * Generate a random IP address
 */
export function randomIp(): string {
  return `${randomInRange(1, 255)}.${randomInRange(0, 255)}.${randomInRange(0, 255)}.${randomInRange(1, 254)}`
}

/**
 * Generate a random user agent string
 */
export function randomUserAgent(): string {
  const browsers = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ]
  return pickRandom(browsers)
}

/**
 * Generate a random amount in cents (for payments)
 */
export function randomAmount(minDollars = 1, maxDollars = 500): number {
  return randomInRange(minDollars * 100, maxDollars * 100)
}

/**
 * Generate a random file size in bytes
 */
export function randomFileSize(minMb = 0.1, maxMb = 100): number {
  return randomInRange(Math.floor(minMb * 1024 * 1024), Math.floor(maxMb * 1024 * 1024))
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Shuffle an array in place
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

/**
 * Create an array of n items using a factory function
 */
export function times<T>(n: number, factory: (index: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => factory(i))
}

// ============================================================================
// Console Output
// ============================================================================

/**
 * Log a section header
 */
export function logSection(title: string): void {
  console.log(`\n${'━'.repeat(50)}`)
  console.log(`  ${title}`)
  console.log('━'.repeat(50))
}

/**
 * Log a sub-item
 */
export function logItem(message: string): void {
  console.log(`  ${message}`)
}

/**
 * Log success
 */
export function logSuccess(message: string): void {
  console.log(`  ✅ ${message}`)
}

/**
 * Log warning
 */
export function logWarning(message: string): void {
  console.log(`  ⚠️  ${message}`)
}

/**
 * Log error
 */
export function logError(message: string): void {
  console.log(`  ❌ ${message}`)
}
