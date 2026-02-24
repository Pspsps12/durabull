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
  assertRedisUrlEncryptionKeyConfigured,
  auditRedisConnectionUrlEncryption,
  getDb,
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
  assertRedisUrlEncryptionKeyConfigured()
  const db = await getDb()
  const result = await auditRedisConnectionUrlEncryption(db, {
    organizationId: options.organizationId,
    migratePlaintext: true,
    dryRun: options.dryRun,
  })

  console.log('Redis URL encryption migration complete:')
  console.log(`- total rows scanned: ${result.totalRows}`)
  console.log(`- already encrypted: ${result.encryptedRows}`)
  console.log(
    `- migrated from plaintext: ${result.migratedRows}${options.dryRun ? ' (dry-run)' : ''}`
  )
  console.log(`- invalid encrypted rows: ${result.invalidEncryptedRows}`)

  if (result.invalidEncryptedRows > 0) {
    const sampleIds = result.invalidEncryptedConnectionIds.slice(0, 5).join(', ')
    if (sampleIds) {
      console.error(`- sample invalid connection IDs: ${sampleIds}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Redis URL encryption migration failed: ${message}`)
  process.exit(1)
})
