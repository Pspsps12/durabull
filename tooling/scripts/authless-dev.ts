import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import process from 'node:process'

const env = { ...process.env }

env.DURABULL_AUTHLESS = env.DURABULL_AUTHLESS ?? 'true'

env.DURABULL_REDIS_URL_MAIN =
  env.DURABULL_REDIS_URL_MAIN ?? env.REDIS_URL ?? 'redis://localhost:6379'

env.DURABULL_REDIS_URL_MAIN_ENVIRONMENT =
  env.DURABULL_REDIS_URL_MAIN_ENVIRONMENT ?? 'development'

env.DURABULL_REDIS_URL_DEFAULT = env.DURABULL_REDIS_URL_DEFAULT ?? 'MAIN'
env.DURABULL_ENV_CONNECTIONS = env.DURABULL_ENV_CONNECTIONS ?? 'true'
env.BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET ?? 'authless-dev-secret'
env.DURABULL_REDIS_URL_ENCRYPTION_KEY =
  env.DURABULL_REDIS_URL_ENCRYPTION_KEY ??
  createHash('sha256').update(env.BETTER_AUTH_SECRET).digest('hex')

const child = spawn('bun', ['run', 'dev'], {
  stdio: 'inherit',
  env,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
