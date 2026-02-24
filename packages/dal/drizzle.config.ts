import { env } from '@durabull/env'
import { defineConfig } from 'drizzle-kit'

// Use real PostgreSQL if DATABASE_URL is set (CI/production), otherwise use pglite (local dev)
const databaseUrl = env.DATABASE_URL

export default databaseUrl
  ? defineConfig({
      schema: './src/db/schemas/index.ts',
      out: './src/db/migrations',
      dialect: 'postgresql',
      dbCredentials: {
        url: databaseUrl,
      },
    })
  : defineConfig({
      schema: './src/db/schemas/index.ts',
      out: './src/db/migrations',
      dialect: 'postgresql',
      driver: 'pglite',
      dbCredentials: {
        url: './data/pglite',
      },
    })
