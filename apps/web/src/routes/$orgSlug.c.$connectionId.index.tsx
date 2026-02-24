import { createFileRoute } from '@tanstack/react-router'
import { Activity, AlertCircle, CheckCircle2, Clock, Layers, Timer, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { useAppTopBar } from '@/components/app-top-bar'
import { QueueTable } from '@/components/queue-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type ListQueuesResponse, useQueues } from '@/hooks/use-queues'
import { cn, formatNumber } from '@/lib/utils'

export const Route = createFileRoute('/$orgSlug/c/$connectionId/')({
  component: Dashboard,
})

function Dashboard() {
  const { data, isLoading, error } = useQueues()
  const topBarConfig = useMemo(
    () => ({
      left: (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
            <Layers className="h-4 w-4" />
          </span>
          <h1 className="truncate text-base font-semibold md:text-lg">Queues</h1>
          <span className="hidden text-sm text-muted-foreground xl:inline">
            Monitor and manage your job queues
          </span>
        </div>
      ),
    }),
    []
  )

  useAppTopBar(topBarConfig)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Failed to load queues</h2>
        <p className="text-muted-foreground text-center max-w-md">{error.message}</p>
      </div>
    )
  }

  const queues = data?.queues ?? []
  type Queue = ListQueuesResponse['queues'][number]
  type Totals = {
    waiting: number
    active: number
    failed: number
    delayed: number
    completed: number
  }
  const totals = queues.reduce<Totals>(
    (acc: Totals, q: Queue) => ({
      waiting: acc.waiting + q.jobCounts.waiting,
      active: acc.active + q.jobCounts.active,
      failed: acc.failed + q.jobCounts.failed,
      delayed: acc.delayed + q.jobCounts.delayed,
      completed: acc.completed + q.jobCounts.completed,
    }),
    { waiting: 0, active: 0, failed: 0, delayed: 0, completed: 0 }
  )

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Summary stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Waiting"
            value={totals.waiting}
            icon={Clock}
            loading={isLoading}
            tooltip="Jobs waiting to be processed"
          />
          <StatCard
            title="Active"
            value={totals.active}
            icon={Activity}
            loading={isLoading}
            variant="blue"
            showPulse={totals.active > 0}
            tooltip="Jobs currently being processed"
          />
          <StatCard
            title="Delayed"
            value={totals.delayed}
            icon={Timer}
            loading={isLoading}
            variant="orange"
            tooltip="Jobs scheduled for later"
          />
          <StatCard
            title="Completed"
            value={totals.completed}
            icon={CheckCircle2}
            loading={isLoading}
            variant="green"
            tooltip="Successfully completed jobs"
          />
          <StatCard
            title="Failed"
            value={totals.failed}
            icon={AlertCircle}
            loading={isLoading}
            variant="red"
            tooltip="Jobs that failed to process"
          />
        </div>

        {/* Queues Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Queues</h2>
              {data && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {data.total} total
                </span>
              )}
            </div>
            {queues.some((q) => q.jobCounts.active > 0) && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                {queues.reduce((acc: number, q: Queue) => acc + q.jobCounts.active, 0)} jobs
                processing
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-lg border bg-card">
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ) : queues.length === 0 ? (
            <EmptyState />
          ) : (
            <QueueTable queues={queues} />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

type StatVariant = 'default' | 'blue' | 'green' | 'orange' | 'red'

interface StatCardProps {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  loading?: boolean
  variant?: StatVariant
  showPulse?: boolean
  tooltip?: string
}

const variantStyles: Record<
  StatVariant,
  {
    icon: string
    value: string
    bg: string
    border: string
  }
> = {
  default: {
    icon: 'text-muted-foreground',
    value: 'text-foreground',
    bg: 'bg-muted/50',
    border: 'border-border',
  },
  blue: {
    icon: 'text-blue-500',
    value: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/5 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-900',
  },
  green: {
    icon: 'text-green-500',
    value: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/5 dark:bg-green-500/10',
    border: 'border-green-200 dark:border-green-900',
  },
  orange: {
    icon: 'text-orange-500',
    value: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500/5 dark:bg-orange-500/10',
    border: 'border-orange-200 dark:border-orange-900',
  },
  red: {
    icon: 'text-red-500',
    value: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/5 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-900',
  },
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  variant = 'default',
  showPulse,
  tooltip,
}: StatCardProps) {
  const styles = variantStyles[variant]

  const cardContent = (
    <Card className={cn('transition-all hover:shadow-md', styles.bg, styles.border)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="relative">
          <Icon className={cn('h-4 w-4', styles.icon)} />
          {showPulse && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className={cn('text-2xl font-bold tabular-nums', styles.value)}>
            {formatNumber(value)}
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return cardContent
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-16">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Zap className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No queues found</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        No BullMQ queues were detected. Make sure your Redis connection is configured correctly and
        that you have created some queues.
      </p>
    </div>
  )
}
