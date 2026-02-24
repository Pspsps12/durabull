type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogRecord {
  timestamp: string
  level: LogLevel
  scope: string
  event: string
  message: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

interface LoggerOptions {
  scope: string
  staticContext?: Record<string, unknown>
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function resolveMinimumLevel(): LogLevel {
  const raw = process.env.WORKLOAD_LOG_LEVEL?.trim().toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw
  }
  return 'info'
}

const MIN_LEVEL = resolveMinimumLevel()

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    }
  }

  if (error && typeof error === 'object') {
    return {
      name: 'Error',
      message: JSON.stringify(error),
    }
  }

  return undefined
}

function mergeContext(
  first: Record<string, unknown> | undefined,
  second: Record<string, unknown> | undefined
) {
  if (!first && !second) return undefined
  return { ...(first ?? {}), ...(second ?? {}) }
}

function write(record: LogRecord): void {
  if (process.stdout.isTTY) {
    const context = record.context ? ` ${JSON.stringify(record.context)}` : ''
    const error = record.error ? ` ${JSON.stringify(record.error)}` : ''
    console.log(
      `[${record.timestamp}] ${LEVEL_LABELS[record.level]} ${record.scope}.${record.event} ${record.message}${context}${error}`
    )
    return
  }

  console.log(JSON.stringify(record))
}

export interface Logger {
  debug(event: string, message: string, context?: Record<string, unknown>): void
  info(event: string, message: string, context?: Record<string, unknown>): void
  warn(event: string, message: string, context?: Record<string, unknown>, error?: unknown): void
  error(event: string, message: string, context?: Record<string, unknown>, error?: unknown): void
  child(scope: string, staticContext?: Record<string, unknown>): Logger
}

export function createLogger(options: LoggerOptions): Logger {
  const scope = options.scope
  const staticContext = options.staticContext

  const emit = (
    level: LogLevel,
    event: string,
    message: string,
    context?: Record<string, unknown>,
    error?: unknown
  ) => {
    if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) {
      return
    }

    write({
      timestamp: new Date().toISOString(),
      level,
      scope,
      event,
      message,
      context: mergeContext(staticContext, context),
      error: normalizeError(error),
    })
  }

  return {
    debug(event, message, context) {
      emit('debug', event, message, context)
    },
    info(event, message, context) {
      emit('info', event, message, context)
    },
    warn(event, message, context, error) {
      emit('warn', event, message, context, error)
    },
    error(event, message, context, error) {
      emit('error', event, message, context, error)
    },
    child(childScope, childContext) {
      return createLogger({
        scope: `${scope}.${childScope}`,
        staticContext: mergeContext(staticContext, childContext),
      })
    },
  }
}
