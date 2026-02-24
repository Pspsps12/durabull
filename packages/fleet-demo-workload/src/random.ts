import { uuidv7 } from '@durabull/utils/uuid'

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function chance(probability: number): boolean {
  return Math.random() < probability
}

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = Math.random() * total

  for (const item of items) {
    cursor -= item.weight
    if (cursor <= 0) {
      return item
    }
  }

  return items[items.length - 1]
}

export function shortId(): string {
  return uuidv7().slice(0, 8)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function withJitter(baseMs: number, jitterRatio = 0.25): number {
  const jitter = baseMs * jitterRatio
  return Math.max(150, Math.round(baseMs + randomFloat(-jitter, jitter)))
}
