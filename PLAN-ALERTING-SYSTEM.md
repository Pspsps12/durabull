# Alerting System Plan

## Problem Statement

Durabull currently only connects to customer Redis instances on-demand — when a user is actively browsing the dashboard. There is no background process monitoring queues for failures. To offer alerting (e.g. "your `email-send` queue has 50 failed jobs in the last 5 minutes"), we need a persistent connection layer that runs independently of user sessions.

---

## Key Design Questions Answered

### Does it have to be per-queue or per-job?

**Per-queue is the right granularity.** Per-job alerting would require subscribing to BullMQ's `QueueEvents` for every queue (one persistent Redis connection per queue per customer connection), which doesn't scale and creates excessive noise. Instead, we poll at the queue level and let users configure alert rules per queue (or across all queues on a connection).

### Can we just poll Redis and dedupe via Postgres?

**Yes — this is the recommended approach.** BullMQ stores job counts directly in Redis sorted sets. We can poll `queue.getJobCounts()` and `queue.getMetrics('failed', ...)` on an interval without subscribing to real-time events. Postgres acts as the deduplication and state layer — tracking which failures we've already alerted on and suppressing duplicates.

This is simpler, more reliable, and more resource-efficient than maintaining persistent `QueueEvents` listeners. It also matches the existing architecture (the app already uses polling for queue discovery).

### Why not BullMQ's `QueueEvents` listener?

`QueueEvents` would give us real-time `failed` events, but:
1. Requires one persistent Redis connection per queue being monitored (doesn't scale)
2. If the API server restarts, we miss events during downtime (no replay)
3. BullMQ already maintains failed job counts and metrics in Redis — polling reads the same data without the connection overhead
4. Polling is idempotent and surverable — if the server restarts, it just picks up where it left off on the next tick

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Durabull API (Hono/Bun)               │
│                                                         │
│  ┌─────────────────┐    ┌────────────────────────────┐  │
│  │  Existing API    │    │  Alert Monitor (Background) │  │
│  │  Routes          │    │                            │  │
│  │  (on-demand)     │    │  1. Poll loop (interval)   │  │
│  │                  │    │  2. For each connection:    │  │
│  │                  │    │     - Get discovered queues │  │
│  │                  │    │     - Poll failed counts    │  │
│  │                  │    │  3. Evaluate alert rules    │  │
│  │                  │    │  4. Dedupe via Postgres     │  │
│  │                  │    │  5. Dispatch notifications  │  │
│  └─────────────────┘    └────────────────────────────┘  │
│           │                         │                    │
│           ▼                         ▼                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │          Shared Redis Connection Cache           │    │
│  │          (existing: apps/api/src/lib/redis.ts)   │    │
│  └─────────────────────────────────────────────────┘    │
│           │                         │                    │
└───────────┼─────────────────────────┼────────────────────┘
            ▼                         ▼
    ┌──────────────┐          ┌──────────────┐
    │   Postgres   │          │  Customer    │
    │   (alerts,   │          │  Redis       │
    │    rules,    │          │  Instances   │
    │    history)  │          │              │
    └──────────────┘          └──────────────┘
```

---

## Implementation Plan

### Phase 1: Database Schema (DAL Package)

Add three new tables to `packages/dal/src/db/schemas/`:

#### 1. `alert_rule` — What to alert on

```
alert_rule
├── id (uuid, PK)
├── organization_id (FK → organization)
├── connection_id (FK → redis_connection)
├── queue_name (text, nullable)          -- NULL = all queues on this connection
├── name (text)                          -- Human-readable rule name
├── type (text)                          -- 'failure_threshold' | 'failure_rate' | 'queue_stalled'
├── config (jsonb)                       -- Type-specific configuration:
│                                        --   failure_threshold: { count: 10, windowMinutes: 5 }
│                                        --   failure_rate: { rate: 0.5, windowMinutes: 15, minSample: 10 }
│                                        --   queue_stalled: { stalledMinutes: 30 }
├── enabled (boolean, default true)
├── notification_channels (jsonb)        -- [{ type: 'email', target: 'team@co.com' }]
├── cooldown_minutes (integer, default 30)  -- Min time between repeated alerts for same rule
├── created_at (timestamp)
├── updated_at (timestamp)
```

**Alert types explained:**
- `failure_threshold` — "Alert when ≥ N jobs fail within M minutes" (most common)
- `failure_rate` — "Alert when failure rate exceeds X% over M minutes" (for high-volume queues)
- `queue_stalled` — "Alert when a queue has waiting jobs but no completions for M minutes" (workers died)

#### 2. `alert_event` — Deduplication + history

```
alert_event
├── id (uuid, PK)
├── alert_rule_id (FK → alert_rule)
├── organization_id (FK → organization)
├── connection_id (FK → redis_connection)
├── queue_name (text)
├── type (text)                          -- Matches the rule type that triggered it
├── status (text)                        -- 'firing' | 'resolved' | 'suppressed'
├── summary (text)                       -- Human-readable: "47 jobs failed in email-send (last 5 min)"
├── context (jsonb)                      -- Snapshot of data at trigger time:
│                                        --   { failedCount: 47, windowMinutes: 5, threshold: 10 }
├── fired_at (timestamp)
├── resolved_at (timestamp, nullable)
├── notification_sent_at (timestamp, nullable)
├── created_at (timestamp)
├── updated_at (timestamp)
```

**Indexes:**
- `(alert_rule_id, status)` — Fast lookup for active alerts per rule (cooldown check)
- `(organization_id, fired_at)` — Alert history feed
- `(connection_id, queue_name, status)` — Per-queue alert status

#### 3. `alert_check_cursor` — Polling state tracker

```
alert_check_cursor
├── id (uuid, PK)
├── connection_id (FK → redis_connection)
├── queue_name (text)
├── last_checked_at (timestamp)
├── last_failed_count (integer)          -- Failed count at last check (for delta calc)
├── last_metrics_snapshot (jsonb)        -- Raw metrics snapshot for debugging
├── created_at (timestamp)
├── updated_at (timestamp)
```

**Unique index:** `(connection_id, queue_name)`

This table prevents re-alerting on the same failures. By tracking the failed count at each poll, we compute deltas ("12 new failures since last check") rather than absolute counts.

---

### Phase 2: Alert Monitor Background Process

New file: `apps/api/src/lib/alert-monitor.ts`

This is the core polling loop that runs inside the existing API process (not a separate service).

#### Lifecycle

```typescript
// Start on API boot (apps/api/src/index.ts)
import { startAlertMonitor, stopAlertMonitor } from './lib/alert-monitor'

// After server starts listening:
startAlertMonitor()

// On graceful shutdown:
stopAlertMonitor()
```

#### Polling Loop Design

```
Every POLL_INTERVAL (default: 60 seconds):
  1. Query Postgres for all enabled alert_rules, grouped by connection_id
  2. For each unique connection_id:
     a. Get the Redis connection (reuses existing getRedis() cache)
     b. Get the list of discovered queues for this connection
     c. For each queue that has an applicable alert rule:
        - Instantiate a BullMQ Queue (reuses existing getQueue() cache)
        - Call queue.getJobCounts() for current failed count
        - Call queue.getMetrics('failed', 0, windowMinutes) for time-windowed data
        - Call queue.getMetrics('completed', 0, windowMinutes) for rate calculations
     d. Compare against alert_check_cursor to compute deltas
     e. Evaluate each alert rule against the data
     f. If rule triggers and no active alert exists within cooldown: create alert_event
     g. Update alert_check_cursor with new snapshot
  3. For each new alert_event: dispatch notification
```

#### Key Design Decisions

**Serial per connection, parallel across connections.** We process connections sequentially to avoid overwhelming a single Redis instance, but multiple connections can be checked concurrently (with a configurable concurrency limit, default 3).

**Jitter on startup.** To avoid thundering herd on multi-instance deployments, add random jitter (0-30s) to the first poll cycle.

**Timeout per connection.** Each connection check has a 30-second timeout. If a customer's Redis is slow/unreachable, it doesn't block other connections.

**Graceful degradation.** If a Redis connection fails, log the error and continue to the next connection. The existing `recentRedisConnectionFailures` cache in `redis.ts` will handle cooldowns.

---

### Phase 3: Alert Rule Evaluation Engine

New file: `apps/api/src/lib/alert-evaluator.ts`

Each alert type gets a pure evaluation function:

```typescript
interface AlertEvaluation {
  triggered: boolean
  summary: string
  context: Record<string, unknown>
}

// failure_threshold: "≥ N failures in M minutes"
function evaluateFailureThreshold(
  config: { count: number; windowMinutes: number },
  currentFailedCount: number,
  cursorFailedCount: number,
  failedMetrics: Metrics
): AlertEvaluation

// failure_rate: "failure rate > X% over M minutes"
function evaluateFailureRate(
  config: { rate: number; windowMinutes: number; minSample: number },
  completedMetrics: Metrics,
  failedMetrics: Metrics
): AlertEvaluation

// queue_stalled: "waiting jobs but no completions for M minutes"
function evaluateQueueStalled(
  config: { stalledMinutes: number },
  jobCounts: { waiting: number; active: number },
  completedMetrics: Metrics
): AlertEvaluation
```

These are pure functions — easy to test, no side effects.

---

### Phase 4: Notification Dispatch

New file: `apps/api/src/lib/alert-notifier.ts`

Start with **email only** (the `@durabull/email` package already integrates with Resend).

```typescript
async function dispatchAlertNotification(
  event: AlertEvent,
  channels: NotificationChannel[]
): Promise<void> {
  for (const channel of channels) {
    switch (channel.type) {
      case 'email':
        await sendAlertEmail(channel.target, event)
        break
      // Future: 'webhook', 'slack', 'pagerduty'
    }
  }
}
```

**Email template** should include:
- Alert rule name
- Queue name and connection name
- What triggered it (e.g., "47 failures in last 5 minutes, threshold is 10")
- Link to the queue in the Durabull dashboard
- "Mute this alert" link

---

### Phase 5: API Routes

New route group: `apps/api/src/routes/alerts.ts`

Mounted at `/api/c/:connectionId/alerts/`

```
GET    /rules                    — List alert rules for connection
POST   /rules                    — Create alert rule
PUT    /rules/:ruleId            — Update alert rule
DELETE /rules/:ruleId            — Delete alert rule
GET    /rules/:ruleId/events     — Alert history for a rule
POST   /rules/:ruleId/test       — Dry-run: evaluate rule against current data without firing

GET    /events                   — Alert event feed (paginated, filterable)
POST   /events/:eventId/resolve  — Manually resolve an alert
POST   /events/:eventId/mute     — Suppress future alerts for this rule (within cooldown)
```

Also add a **global alerts route** (not scoped to connection):

```
GET /api/alerts/events            — All alert events across all connections for the org
GET /api/alerts/summary           — Active alert count per connection (for nav badge)
```

---

### Phase 6: Frontend (Later, Out of Scope for Initial API Work)

- Alert rules management UI per queue and per connection
- Alert event feed/timeline
- Badge on sidebar showing active alert count
- Toast notifications via polling (React Query, same pattern as everything else)

---

## How Deduplication Works

This is the most important part of the system. Without good deduplication, users get spammed.

### Layer 1: Delta-based detection (alert_check_cursor)

We don't alert on absolute failed counts. We track the failed count at each poll and compute deltas:

```
Poll at T1: failed_count = 100, cursor says last was 95 → delta = 5
Poll at T2: failed_count = 112, cursor says last was 100 → delta = 12
Poll at T3: failed_count = 112, cursor says last was 112 → delta = 0 (no new failures)
```

This means retried/old failures don't re-trigger alerts.

### Layer 2: Cooldown (alert_rule.cooldown_minutes)

Even if new failures keep coming, we only fire one alert per cooldown window:

```
Alert fires at T1 (cooldown = 30 min)
New failures at T1+5min → suppressed (within cooldown)
New failures at T1+35min → new alert fires
```

### Layer 3: Firing/resolved state (alert_event.status)

An alert stays in `firing` state until:
- Manually resolved by user
- Auto-resolved when the condition clears (e.g., failure rate drops below threshold)

While an alert is `firing`, subsequent evaluations update the existing event rather than creating new ones.

---

## Resource & Scalability Considerations

### Redis Connection Overhead

The alert monitor **reuses the existing connection cache** in `redis.ts`. No new connections are created — if a connection is already open from a user browsing the dashboard, the monitor shares it. If no one is browsing, the monitor opens it (and it stays cached for subsequent polls).

**Cost per monitored connection:** 1 shared Redis connection (already exists), ~3-5 Redis commands per queue per poll cycle. For 10 queues, that's ~50 commands every 60 seconds — trivial.

### Postgres Load

Per poll cycle: 1 query to load rules, N upserts to `alert_check_cursor` (one per queue), 0-few inserts to `alert_event`. Negligible.

### Memory

No significant additional memory. BullMQ `Queue` instances are already cached. Alert rules are loaded fresh each cycle (not cached) to pick up changes immediately.

### Multi-instance Deployment (Future)

If Durabull scales to multiple API instances, the poll loop would run on all instances. To prevent duplicate alerts:

**Option A (Simple, recommended for now):** Use a Postgres advisory lock or a simple `SELECT ... FOR UPDATE SKIP LOCKED` pattern on `alert_check_cursor`. First instance to lock a cursor row processes it; others skip.

**Option B (Later):** Designate one instance as the alert leader via a simple lease in Postgres (a row with `leader_id` and `lease_expires_at`).

For now, with a single API instance, this isn't needed.

---

## Migration Path

### Step 1: Schema + Monitor (background, no user-facing changes)
1. Add the three new tables via Drizzle migration
2. Implement the alert monitor loop
3. Implement the evaluator functions
4. Start the monitor on API boot
5. Log alerts to console (no notifications yet)

### Step 2: API Routes + Email
1. Add alert rule CRUD routes
2. Add alert event routes
3. Wire up email notifications via `@durabull/email`

### Step 3: Frontend
1. Alert rule management UI
2. Alert feed/timeline
3. Dashboard badge

---

## What We Explicitly Don't Need

- **Separate microservice** — The alert monitor runs inside the existing API process. It's a background loop, not a new deployment.
- **Message broker** — No Kafka, RabbitMQ, or internal BullMQ queue needed. Postgres is the state layer.
- **WebSockets** — The frontend can poll for alert status on the same interval it polls for everything else.
- **Per-job tracking** — We track queue-level metrics, not individual job IDs. BullMQ already maintains the counts.
- **Real-time event streaming** — Polling every 60s is fast enough for alerting. Sub-second latency isn't a requirement.

---

## File Changes Summary

```
packages/dal/src/db/schemas/
  alert-rule/schema.ts                    (NEW)
  alert-event/schema.ts                   (NEW)
  alert-check-cursor/schema.ts            (NEW)

packages/dal/src/repositories/
  alert-rule.ts                           (NEW)
  alert-event.ts                          (NEW)
  alert-check-cursor.ts                   (NEW)

apps/api/src/lib/
  alert-monitor.ts                        (NEW) — Background poll loop
  alert-evaluator.ts                      (NEW) — Pure evaluation functions
  alert-notifier.ts                       (NEW) — Notification dispatch

apps/api/src/routes/
  alerts.ts                               (NEW) — API routes

apps/api/src/index.ts                     (MODIFIED) — Start/stop monitor
apps/api/src/app.ts                       (MODIFIED) — Mount alert routes
```
