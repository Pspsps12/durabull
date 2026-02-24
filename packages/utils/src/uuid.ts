import { uuidv7 as generateUuidv7 } from 'uuidv7'

/**
 * Generate a UUID v7 string.
 * UUID v7 is a time-ordered UUID that combines a Unix timestamp with random bits,
 * making it ideal for database primary keys as it provides natural ordering.
 */
export function uuidv7(): string {
  return generateUuidv7()
}
