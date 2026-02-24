/**
 * One-time migration script that encrypts plaintext Redis connection URLs
 * already stored in the redis_connection table.
 *
 * Usage:
 *   bun tooling/scripts/encrypt-redis-connection-urls.ts
 *   bun tooling/scripts/encrypt-redis-connection-urls.ts --dry-run
 *   bun tooling/scripts/encrypt-redis-connection-urls.ts --organization <organization-id>
 */

import {
  decryptRedisUrl,
  encryptRedisUrl,
  eq,
  getDb,
  isRedisUrlEncrypted,
  redisConnection,
} from '@durabull/dal'

interface CliOptions {
  dryRun: boolean
  organizationId?: string
}

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--organization') {
      const organizationId = argv[i + 1]
      if (!organizationId) {
        throw new Error('Missing value for --organization')
      }
      options.organizationId = organizationId
      i += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const db = await getDb()

  let query = db
    .select({
      id: redisConnection.id,
      name: redisConnection.name,
      url: redisConnection.url,
      organizationId: redisConnection.organizationId,
    })
    .from(redisConnection)

  if (options.organizationId) {
    query = query.where(eq(redisConnection.organizationId, options.organizationId))
  }

  const rows = await query

  let encryptedCount = 0
  let migratedCount = 0
  let invalidEncryptedCount = 0

  for (const row of rows) {
    if (isRedisUrlEncrypted(row.url)) {
      try {
        decryptRedisUrl(row.url)
        encryptedCount += 1
      } catch (error) {
        invalidEncryptedCount += 1
        const message = error instanceof Error ? error.message : 'unknown error'
        console.error(
          `✗ Failed to decrypt existing encrypted URL for connection ${row.id} (${row.name}): ${message}`
        )
      }
      continue
    }

    const encryptedUrl = encryptRedisUrl(row.url)
    migratedCount += 1

    if (options.dryRun) {
      continue
    }

    await db
      .update(redisConnection)
      .set({
        url: encryptedUrl,
        updatedAt: new Date(),
      })
      .where(eq(redisConnection.id, row.id))
  }

  console.log('Redis URL encryption migration complete:')
  console.log(`- total rows scanned: ${rows.length}`)
  console.log(`- already encrypted: ${encryptedCount}`)
  console.log(`- migrated from plaintext: ${migratedCount}${options.dryRun ? ' (dry-run)' : ''}`)
  console.log(`- invalid encrypted rows: ${invalidEncryptedCount}`)

  if (invalidEncryptedCount > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Redis URL encryption migration failed: ${message}`)
  process.exit(1)
})

