import { type Job, Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import {
  COMPLETED_JOB_RETENTION,
  EVENT_STREAM_MAX_LEN,
  FAILED_JOB_RETENTION,
  JOB_LOG_RETENTION,
  METRICS_MAX_DATA_POINTS,
  RESET_ON_BOOT,
} from './config'
import { createSimulatedProcessingError } from './errors'
import { IncidentController } from './incident-controller'
import type { Logger } from './logger'
import { createPayload, createReturnValue, formatJobLog, getProcessingStages } from './payloads'
import { chance, randomFloat, randomInt, shortId, sleep, weightedPick, withJitter } from './random'
import type { StatsTracker } from './stats'
import type { QueueWorkloadConfig, WorkloadConnectionConfig } from './types'

interface QueueRuntime {
  config: QueueWorkloadConfig
  queue: Queue
  worker: Worker
}

const REDIS_CONNECTION_OPTIONS = {
  family: 4 as const,
  maxRetriesPerRequest: null,
}

const REDIS_DELETE_BATCH_SIZE = 250
const METRIC_TYPES = ['completed', 'failed'] as const

export class ConnectionRuntime {
  private readonly logger: Logger
  private readonly incidentController: IncidentController
  private readonly queueRuntimes: QueueRuntime[] = []
  private readonly producerTimers = new Set<ReturnType<typeof setTimeout>>()
  private healthClient: IORedis | null = null
  private isStopping = false

  constructor(
    private readonly connection: WorkloadConnectionConfig,
    private readonly queues: QueueWorkloadConfig[],
    private readonly stats: StatsTracker,
    logger: Logger
  ) {
    this.logger = logger.child('connection', {
      connection: connection.slug,
      environment: connection.environment,
    })
    this.incidentController = new IncidentController(
      this.queues.map((queue) => queue.name),
      this.logger
    )
  }

  async start(): Promise<void> {
    this.logger.info('start.begin', 'Starting connection runtime', {
      queuePrefix: this.connection.queuePrefix,
      throughputMultiplier: this.connection.throughputMultiplier,
    })

    this.healthClient = new IORedis(this.connection.url, {
      family: 4,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 30_000,
    })

    await this.healthClient.connect()
    await this.healthClient.ping()
    await this.resetDemoQueuesOnBoot()
    await this.runRedisMemoryMaintenance()

    for (const queueConfig of this.queues) {
      const queue = new Queue(queueConfig.name, {
        prefix: this.connection.queuePrefix,
        connection: {
          url: this.connection.url,
          ...REDIS_CONNECTION_OPTIONS,
        },
        streams: {
          events: {
            maxLen: EVENT_STREAM_MAX_LEN,
          },
        },
        defaultJobOptions: {
          attempts: queueConfig.attempts,
          backoff: {
            type: 'exponential',
            delay: 2_000,
          },
          removeOnComplete: {
            count: COMPLETED_JOB_RETENTION,
          },
          removeOnFail: {
            count: FAILED_JOB_RETENTION,
          },
          keepLogs: JOB_LOG_RETENTION,
          stackTraceLimit: 5,
        },
      })

      const worker = new Worker(queueConfig.name, this.createProcessor(queueConfig), {
        prefix: this.connection.queuePrefix,
        connection: {
          url: this.connection.url,
          ...REDIS_CONNECTION_OPTIONS,
        },
        concurrency: queueConfig.concurrency,
        metrics: {
          maxDataPoints: METRICS_MAX_DATA_POINTS,
        },
      })

      worker.on('completed', () => {
        this.stats.markCompleted(this.connection.slug, queueConfig.name)
      })

      worker.on('failed', (job, error) => {
        const maxAttempts = job?.opts.attempts ?? queueConfig.attempts
        const attemptsMade = job?.attemptsMade ?? 1
        const isTerminalFailure = attemptsMade >= maxAttempts

        if (isTerminalFailure) {
          this.stats.markFailed(this.connection.slug, queueConfig.name)
        }

        this.logger.warn(
          'job.failed',
          'Worker reported failed job',
          {
            queueName: queueConfig.name,
            jobId: job?.id ?? null,
            jobName: job?.name ?? null,
            attemptsMade,
            maxAttempts,
            terminal: isTerminalFailure,
            errorMessage: error.message,
          },
          error
        )
      })

      worker.on('error', (error) => {
        this.logger.error(
          'worker.error',
          'Worker emitted runtime error',
          {
            queueName: queueConfig.name,
          },
          error
        )
      })

      this.queueRuntimes.push({
        config: queueConfig,
        queue,
        worker,
      })
    }

    try {
      await this.ensureScheduledJobs()
      await this.seedInitialBacklog()
      this.startProducers()
    } catch (error) {
      if (!isRedisOutOfMemoryError(error)) throw error

      this.logger.error(
        'redis.oom.startup',
        'Redis is over maxmemory after cleanup; workload will stay alive with workers and producers paused',
        {
          queueCount: this.queueRuntimes.length,
          completedRetention: COMPLETED_JOB_RETENTION,
          failedRetention: FAILED_JOB_RETENTION,
          eventStreamMaxLen: EVENT_STREAM_MAX_LEN,
          metricsMaxDataPoints: METRICS_MAX_DATA_POINTS,
        },
        error
      )
      await this.pauseWorkersAfterStartupOom()
    }

    this.logger.info('start.complete', 'Connection runtime started', {
      queues: this.queueRuntimes.length,
      workers: this.queueRuntimes.length,
      metricsMaxDataPoints: METRICS_MAX_DATA_POINTS,
      completedRetention: COMPLETED_JOB_RETENTION,
      failedRetention: FAILED_JOB_RETENTION,
      jobLogRetention: JOB_LOG_RETENTION,
      eventStreamMaxLen: EVENT_STREAM_MAX_LEN,
      resetOnBoot: RESET_ON_BOOT,
    })
  }

  async stop(reason = 'shutdown'): Promise<void> {
    if (this.isStopping) return
    this.isStopping = true

    this.logger.info('stop.begin', 'Stopping connection runtime', { reason })

    for (const timer of this.producerTimers) {
      clearTimeout(timer)
    }
    this.producerTimers.clear()

    await Promise.allSettled(
      this.queueRuntimes.map(async (runtime) => {
        await runtime.worker.close()
        await runtime.queue.close()
      })
    )

    this.queueRuntimes.length = 0

    if (this.healthClient) {
      try {
        await this.healthClient.quit()
      } catch {
        this.healthClient.disconnect()
      } finally {
        this.healthClient = null
      }
    }

    this.logger.info('stop.complete', 'Connection runtime stopped')
  }

  getSnapshot(): {
    connection: string
    environment: string
    activeIncident: string | null
    queueCount: number
  } {
    return {
      connection: this.connection.slug,
      environment: this.connection.environment,
      activeIncident: this.incidentController.getActiveIncident()?.id ?? null,
      queueCount: this.queueRuntimes.length,
    }
  }

  private startProducers(): void {
    for (const runtime of this.queueRuntimes) {
      this.scheduleProducer(runtime, randomInt(300, 2_000))
    }
  }

  private scheduleProducer(runtime: QueueRuntime, delayMs: number): void {
    if (this.isStopping) return

    const timer = setTimeout(async () => {
      this.producerTimers.delete(timer)
      if (this.isStopping) return

      try {
        await this.runProducerTick(runtime)
      } catch (error) {
        this.logger.error(
          'producer.error',
          'Producer tick failed',
          {
            queueName: runtime.config.name,
          },
          error
        )
      }

      this.scheduleProducer(runtime, this.nextProducerInterval(runtime.config))
    }, delayMs)

    this.producerTimers.add(timer)
  }

  private nextProducerInterval(config: QueueWorkloadConfig): number {
    const scaledInterval = Math.round(config.baseIntervalMs / this.connection.throughputMultiplier)
    return withJitter(scaledInterval, 0.3)
  }

  private async runProducerTick(runtime: QueueRuntime): Promise<void> {
    this.incidentController.tick()

    let jobsToProduce = 1
    if (chance(0.14)) jobsToProduce += 1
    if (chance(0.03)) jobsToProduce += 1

    for (let index = 0; index < jobsToProduce; index++) {
      await this.enqueueOne(runtime)
    }
  }

  private async enqueueOne(runtime: QueueRuntime): Promise<void> {
    const jobType = weightedPick(runtime.config.jobTypes)
    const incidentBoostAtEnqueue = this.incidentController.getFailureBoost(runtime.config.name)
    const seedTerminalFailure = chance(this.terminalFailureSeedChance(runtime.config.name))
    const attempts = seedTerminalFailure ? 1 : runtime.config.attempts

    const payload = createPayload({
      connection: this.connection,
      queueName: runtime.config.name,
      jobName: jobType.name,
    })
    const payloadWithControl = {
      ...payload,
      workloadControl: {
        seedTerminalFailure,
        incidentBoostAtEnqueue: Number(incidentBoostAtEnqueue.toFixed(4)),
        enqueuedAt: new Date().toISOString(),
      },
    }

    const priority = chance(runtime.config.priorityChance) ? randomInt(1, 10) : undefined
    const delay = chance(runtime.config.delayedChance)
      ? randomInt(runtime.config.delayedMs.min, runtime.config.delayedMs.max)
      : 0

    await runtime.queue.add(jobType.name, payloadWithControl, {
      jobId: `${this.connection.slug}-${runtime.config.name}-${shortId()}`,
      attempts,
      priority,
      delay,
    })

    this.stats.markProduced(this.connection.slug, runtime.config.name)

    if (delay > 0 || priority) {
      this.logger.debug('job.enqueued', 'Enqueued job with scheduling metadata', {
        queueName: runtime.config.name,
        jobName: jobType.name,
        delayMs: delay,
        priority: priority ?? null,
      })
    }
  }

  private async ensureScheduledJobs(): Promise<void> {
    this.logger.info('schedulers.begin', 'Configuring scheduled jobs for queues')

    let totalSchedulers = 0
    const schedulesPerQueue: Record<string, number> = {}

    for (const runtime of this.queueRuntimes) {
      const scheduledJobs = runtime.config.scheduledJobs ?? []
      if (scheduledJobs.length === 0) continue

      for (const schedule of scheduledJobs) {
        const payload = createPayload({
          connection: this.connection,
          queueName: runtime.config.name,
          jobName: schedule.name,
        })
        const payloadWithControl = {
          ...payload,
          workloadControl: {
            seedTerminalFailure: false,
            incidentBoostAtEnqueue: 0,
            enqueuedAt: new Date().toISOString(),
            trigger: 'scheduler',
            schedulerId: schedule.id,
            schedulerDescription: schedule.description,
          },
        }

        await runtime.queue.upsertJobScheduler(
          schedule.id,
          {
            pattern: schedule.pattern,
          },
          {
            name: schedule.name,
            data: payloadWithControl,
            opts: {
              attempts: schedule.attempts ?? runtime.config.attempts,
              backoff: {
                type: 'exponential',
                delay: 2_000,
              },
              removeOnComplete: {
                count: COMPLETED_JOB_RETENTION,
              },
              removeOnFail: {
                count: FAILED_JOB_RETENTION,
              },
              keepLogs: JOB_LOG_RETENTION,
              stackTraceLimit: 5,
            },
          }
        )

        totalSchedulers += 1
        schedulesPerQueue[runtime.config.name] = (schedulesPerQueue[runtime.config.name] ?? 0) + 1
      }
    }

    this.logger.info('schedulers.complete', 'Scheduled jobs configured', {
      totalSchedulers,
      queuesWithSchedules: Object.keys(schedulesPerQueue).length,
      schedulesPerQueue,
    })
  }

  private async seedInitialBacklog(): Promise<void> {
    this.logger.info('seed.begin', 'Seeding initial backlog')

    for (const runtime of this.queueRuntimes) {
      const initialJobs = randomInt(4, 10)
      for (let index = 0; index < initialJobs; index++) {
        await this.enqueueOne(runtime)
      }
    }

    this.logger.info('seed.complete', 'Initial backlog seeded')
  }

  private async runRedisMemoryMaintenance(): Promise<void> {
    if (!this.healthClient) return

    this.logger.info('redis.maintenance.begin', 'Trimming retained BullMQ data before startup', {
      completedRetention: COMPLETED_JOB_RETENTION,
      failedRetention: FAILED_JOB_RETENTION,
      jobLogRetention: JOB_LOG_RETENTION,
      eventStreamMaxLen: EVENT_STREAM_MAX_LEN,
      metricsMaxDataPoints: METRICS_MAX_DATA_POINTS,
    })

    const totals = {
      removedFinishedJobs: 0,
      trimmedEventStreams: 0,
      trimmedMetricLists: 0,
    }

    for (const queueConfig of this.queues) {
      const baseKey = this.queueBaseKey(queueConfig.name)

      try {
        totals.removedFinishedJobs += await this.trimFinishedJobs(
          `${baseKey}:completed`,
          COMPLETED_JOB_RETENTION,
          baseKey
        )
        totals.removedFinishedJobs += await this.trimFinishedJobs(
          `${baseKey}:failed`,
          FAILED_JOB_RETENTION,
          baseKey
        )
      } catch (error) {
        this.logger.warn(
          'redis.maintenance.finished_jobs_failed',
          'Could not trim retained finished jobs for queue',
          { queueName: queueConfig.name },
          error
        )
      }

      try {
        totals.trimmedEventStreams += await this.trimEventStream(`${baseKey}:events`)
      } catch (error) {
        this.logger.warn(
          'redis.maintenance.events_failed',
          'Could not trim BullMQ event stream for queue',
          { queueName: queueConfig.name },
          error
        )
      }

      for (const metricType of METRIC_TYPES) {
        try {
          totals.trimmedMetricLists += await this.trimMetricList(
            `${baseKey}:metrics:${metricType}:data`
          )
        } catch (error) {
          this.logger.warn(
            'redis.maintenance.metrics_failed',
            'Could not trim BullMQ metrics list for queue',
            { queueName: queueConfig.name, metricType },
            error
          )
        }
      }

      try {
        await this.healthClient.hset(
          `${baseKey}:meta`,
          'opts.maxLenEvents',
          String(EVENT_STREAM_MAX_LEN)
        )
      } catch (error) {
        this.logger.warn(
          'redis.maintenance.meta_failed',
          'Could not update BullMQ event stream retention metadata',
          { queueName: queueConfig.name },
          error
        )
      }
    }

    this.logger.info('redis.maintenance.complete', 'Redis startup maintenance complete', totals)
  }

  private async resetDemoQueuesOnBoot(): Promise<void> {
    if (!this.healthClient || !RESET_ON_BOOT) return

    this.logger.warn('redis.reset.begin', 'Resetting demo workload queues before startup', {
      queuePrefix: this.connection.queuePrefix,
      queueCount: this.queues.length,
    })

    let deletedKeys = 0
    for (const queueConfig of this.queues) {
      deletedKeys += await this.deleteKeysByPattern(`${this.queueBaseKey(queueConfig.name)}:*`)
    }

    this.logger.warn('redis.reset.complete', 'Demo workload queue reset complete', {
      deletedKeys,
    })
  }

  private async deleteKeysByPattern(pattern: string): Promise<number> {
    if (!this.healthClient) return 0

    let cursor = '0'
    let deletedKeys = 0

    do {
      const [nextCursor, keys] = await this.healthClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        REDIS_DELETE_BATCH_SIZE
      )
      cursor = nextCursor

      if (keys.length > 0) {
        await this.healthClient.del(...keys)
        deletedKeys += keys.length
      }
    } while (cursor !== '0')

    return deletedKeys
  }

  private queueBaseKey(queueName: string): string {
    return `${this.connection.queuePrefix}:${queueName}`
  }

  private async trimFinishedJobs(
    finishedKey: string,
    keepCount: number,
    baseKey: string
  ): Promise<number> {
    if (!this.healthClient) return 0

    const finishedCount = await this.healthClient.zcard(finishedKey)
    const removeCount = Math.max(0, finishedCount - keepCount)
    if (removeCount === 0) return 0

    let removed = 0
    while (removed < removeCount) {
      const batchSize = Math.min(REDIS_DELETE_BATCH_SIZE, removeCount - removed)
      const jobIds = await this.healthClient.zrange(finishedKey, 0, batchSize - 1)
      if (jobIds.length === 0) break

      const pipeline = this.healthClient.pipeline()
      pipeline.zrem(finishedKey, ...jobIds)

      for (const jobId of jobIds) {
        const jobKey = `${baseKey}:${jobId}`
        pipeline.del(
          jobKey,
          `${jobKey}:logs`,
          `${jobKey}:dependencies`,
          `${jobKey}:processed`,
          `${jobKey}:failed`,
          `${jobKey}:unsuccessful`
        )
      }

      await pipeline.exec()
      removed += jobIds.length
    }

    return removed
  }

  private async trimEventStream(eventsKey: string): Promise<number> {
    if (!this.healthClient) return 0

    const currentLength = await this.healthClient.xlen(eventsKey).catch(() => 0)
    if (currentLength <= EVENT_STREAM_MAX_LEN) return 0

    await this.healthClient.xtrim(eventsKey, 'MAXLEN', '~', EVENT_STREAM_MAX_LEN)
    return 1
  }

  private async trimMetricList(metricDataKey: string): Promise<number> {
    if (!this.healthClient) return 0

    const currentLength = await this.healthClient.llen(metricDataKey).catch(() => 0)
    if (currentLength <= METRICS_MAX_DATA_POINTS) return 0

    await this.healthClient.ltrim(metricDataKey, 0, METRICS_MAX_DATA_POINTS - 1)
    return 1
  }

  private async pauseWorkersAfterStartupOom(): Promise<void> {
    await Promise.allSettled(this.queueRuntimes.map((runtime) => runtime.worker.close(true)))
  }

  private createProcessor(config: QueueWorkloadConfig) {
    return async (job: Job<Record<string, unknown>>): Promise<Record<string, unknown>> => {
      const startedAt = Date.now()
      const trace =
        typeof job.data.trace === 'object' && job.data.trace
          ? (job.data.trace as { traceId?: unknown })
          : null
      const workloadControl =
        typeof job.data.workloadControl === 'object' && job.data.workloadControl
          ? (job.data.workloadControl as {
              seedTerminalFailure?: unknown
              incidentBoostAtEnqueue?: unknown
            })
          : null
      const traceId =
        trace && typeof trace.traceId === 'string' && trace.traceId.length > 0
          ? trace.traceId
          : shortId()

      await job.log(
        formatJobLog('INFO', 'Job picked up by worker', {
          traceId,
          queueName: config.name,
          jobName: job.name,
          attempt: job.attemptsMade + 1,
        })
      )

      const stages = getProcessingStages(config.name)
      const totalDurationMs = this.pickProcessingDuration(config)
      const stageDuration = Math.max(40, Math.floor(totalDurationMs / (stages.length + 1)))

      for (let index = 0; index < stages.length; index++) {
        await sleep(withJitter(stageDuration, 0.4))
        const progress = Math.min(95, Math.round(((index + 1) / (stages.length + 1)) * 100))

        await job.updateProgress({
          progress,
          stage: stages[index],
          traceId,
        })

        await job.log(
          formatJobLog('DEBUG', stages[index], {
            traceId,
            progress,
          })
        )
      }

      const failureProbability = this.resolveFailureProbability(config.name, config.baseFailureRate)
      const forceTerminalFailure =
        workloadControl?.seedTerminalFailure === true && (job.opts.attempts ?? 1) <= 1

      if (forceTerminalFailure || chance(failureProbability)) {
        const error = createSimulatedProcessingError({
          queueName: config.name,
          jobName: job.name,
          traceId,
          connectionSlug: this.connection.slug,
          attempt: job.attemptsMade + 1,
        })

        await job.log(
          formatJobLog('ERROR', error.message, {
            traceId,
            failureProbability: Number(failureProbability.toFixed(4)),
            attempt: job.attemptsMade + 1,
            forceTerminalFailure,
            incidentBoostAtEnqueue:
              typeof workloadControl?.incidentBoostAtEnqueue === 'number'
                ? workloadControl.incidentBoostAtEnqueue
                : null,
          })
        )

        throw error
      }

      await sleep(withJitter(stageDuration, 0.5))
      const durationMs = Date.now() - startedAt

      await job.updateProgress(100)
      await job.log(
        formatJobLog('INFO', 'Job completed successfully', {
          traceId,
          durationMs,
        })
      )

      return createReturnValue({
        queueName: config.name,
        jobName: job.name,
        durationMs,
        traceId,
      })
    }
  }

  private resolveFailureProbability(queueName: string, base: number): number {
    const incidentBoost = this.incidentController.getFailureBoost(queueName)
    const randomNoise = chance(0.008) ? randomFloat(0.01, 0.04) : 0
    return Math.min(0.95, base + incidentBoost + randomNoise)
  }

  private pickProcessingDuration(config: QueueWorkloadConfig): number {
    const base = randomInt(config.processingMs.min, config.processingMs.max)
    if (chance(0.03)) {
      return base + randomInt(2_000, 6_000)
    }
    return base
  }

  private terminalFailureSeedChance(queueName: string): number {
    switch (queueName) {
      case 'payment-processing':
      case 'refund-processing':
      case 'return-processing':
        return 0.01
      case 'order-processing':
      case 'shipment-processing':
        return 0.006
      default:
        return 0.003
    }
  }
}

function isRedisOutOfMemoryError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('OOM command not allowed') ||
      error.message.includes("used memory > 'maxmemory'"))
  )
}
