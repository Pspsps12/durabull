import { type Job, Queue, QueueEvents, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { COMPLETED_JOB_RETENTION, FAILED_JOB_RETENTION, METRICS_MAX_DATA_POINTS } from './config'
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
  queueEvents: QueueEvents
  worker: Worker
}

const REDIS_CONNECTION_OPTIONS = {
  family: 4 as const,
  maxRetriesPerRequest: null,
}

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

    for (const queueConfig of this.queues) {
      const queue = new Queue(queueConfig.name, {
        prefix: this.connection.queuePrefix,
        connection: {
          url: this.connection.url,
          ...REDIS_CONNECTION_OPTIONS,
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
        },
      })

      const queueEvents = new QueueEvents(queueConfig.name, {
        prefix: this.connection.queuePrefix,
        connection: {
          url: this.connection.url,
          ...REDIS_CONNECTION_OPTIONS,
        },
      })
      await queueEvents.waitUntilReady()

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
        queueEvents,
        worker,
      })
    }

    await this.ensureScheduledJobs()
    await this.seedInitialBacklog()
    this.startProducers()

    this.logger.info('start.complete', 'Connection runtime started', {
      queues: this.queueRuntimes.length,
      workers: this.queueRuntimes.length,
      metricsMaxDataPoints: METRICS_MAX_DATA_POINTS,
      completedRetention: COMPLETED_JOB_RETENTION,
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
        await runtime.queueEvents.close()
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
