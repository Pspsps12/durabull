interface Counter {
  produced: number
  completed: number
  failed: number
}

interface Snapshot {
  uptimeMs: number
  windowMs: number
  totals: Counter
  window: Counter
  connections: Array<{
    connection: string
    produced: number
    completed: number
    failed: number
  }>
  hottestQueues: Array<{
    queue: string
    produced: number
    completed: number
    failed: number
  }>
}

function newCounter(): Counter {
  return { produced: 0, completed: 0, failed: 0 }
}

function increment(counter: Counter, field: keyof Counter): void {
  counter[field] += 1
}

export class StatsTracker {
  private readonly startedAt = Date.now()
  private windowStartedAt = Date.now()
  private readonly totals = newCounter()
  private readonly windowTotals = newCounter()
  private readonly byConnectionWindow = new Map<string, Counter>()
  private readonly byQueueWindow = new Map<string, Counter>()

  markProduced(connectionSlug: string, queueName: string): void {
    increment(this.totals, 'produced')
    increment(this.windowTotals, 'produced')
    increment(this.ensureConnection(connectionSlug), 'produced')
    increment(this.ensureQueue(`${connectionSlug}:${queueName}`), 'produced')
  }

  markCompleted(connectionSlug: string, queueName: string): void {
    increment(this.totals, 'completed')
    increment(this.windowTotals, 'completed')
    increment(this.ensureConnection(connectionSlug), 'completed')
    increment(this.ensureQueue(`${connectionSlug}:${queueName}`), 'completed')
  }

  markFailed(connectionSlug: string, queueName: string): void {
    increment(this.totals, 'failed')
    increment(this.windowTotals, 'failed')
    increment(this.ensureConnection(connectionSlug), 'failed')
    increment(this.ensureQueue(`${connectionSlug}:${queueName}`), 'failed')
  }

  snapshotAndResetWindow(): Snapshot {
    const now = Date.now()
    const snapshot: Snapshot = {
      uptimeMs: now - this.startedAt,
      windowMs: now - this.windowStartedAt,
      totals: { ...this.totals },
      window: { ...this.windowTotals },
      connections: Array.from(this.byConnectionWindow.entries())
        .map(([connection, counter]) => ({
          connection,
          produced: counter.produced,
          completed: counter.completed,
          failed: counter.failed,
        }))
        .sort((left, right) => right.produced - left.produced),
      hottestQueues: Array.from(this.byQueueWindow.entries())
        .map(([queue, counter]) => ({
          queue,
          produced: counter.produced,
          completed: counter.completed,
          failed: counter.failed,
        }))
        .sort((left, right) => right.produced - left.produced)
        .slice(0, 6),
    }

    this.windowStartedAt = now
    this.windowTotals.produced = 0
    this.windowTotals.completed = 0
    this.windowTotals.failed = 0
    this.byConnectionWindow.clear()
    this.byQueueWindow.clear()

    return snapshot
  }

  private ensureConnection(connection: string): Counter {
    let counter = this.byConnectionWindow.get(connection)
    if (!counter) {
      counter = newCounter()
      this.byConnectionWindow.set(connection, counter)
    }
    return counter
  }

  private ensureQueue(queue: string): Counter {
    let counter = this.byQueueWindow.get(queue)
    if (!counter) {
      counter = newCounter()
      this.byQueueWindow.set(queue, counter)
    }
    return counter
  }
}
