# Fleet Demo Workload

24/7 BullMQ workload generator and processor for Durabull Fleet Analytics demos.

## What it does

- Runs continuously and produces/consumes jobs across multiple ecommerce queues.
- Uses 1 logical connection.
- Injects low-rate random failures plus intermittent incident windows.
- Enables BullMQ native metrics on every worker (`metrics.maxDataPoints`).
- Retains the last 100 completed jobs per queue.
- Upserts 38 scheduled jobs across 9 queues using realistic cron patterns.

## Queue set

- `user-welcome`
- `cart-recovery`
- `order-processing`
- `payment-processing`
- `shipment-processing`
- `inventory-sync`
- `refund-processing`
- `return-processing`
- `fraud-review`

## Environment variables

The workload runs against one Redis URL.

```bash
# Primary Redis URL for the fleet workload
WORKLOAD_REDIS_URL=redis://localhost:6379

# Optional runtime tuning
WORKLOAD_METRICS_MAX_DATA_POINTS=20160
WORKLOAD_HEARTBEAT_MS=60000
WORKLOAD_LOG_LEVEL=info
# Optional: namespace queues when sharing Redis with other Bull workloads
# WORKLOAD_NAMESPACE_QUEUES=true
```

Notes:

- By default, queue names remain generic (`user-welcome`, `order-processing`, etc.).
- Enable `WORKLOAD_NAMESPACE_QUEUES=true` if this workload shares Redis with other Bull workloads and you need strict isolation.
- On Render, use the full internal Redis URL (often `rediss://...` with credentials) and make sure env changes are applied to the worker service before restart.

## Run

```bash
bun --filter @durabull/fleet-demo-workload start
```

or:

```bash
cd packages/fleet-demo-workload
bun run start
```

## Development

```bash
cd packages/fleet-demo-workload
bun run dev
```
