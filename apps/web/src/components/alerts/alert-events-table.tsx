import { Link } from '@tanstack/react-router'
import { ArrowUpRight, CheckCheck, Loader2 } from 'lucide-react'
import {
  AlertStatusBadge,
  AlertTypeBadge,
  formatAlertDate,
} from '@/components/alerts/alert-primitives'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AlertEventRecord } from '@/hooks/use-alerts'

interface AlertEventsTableProps {
  orgSlug: string
  events: AlertEventRecord[]
  emptyTitle: string
  emptyCopy: string
  showConnectionColumn?: boolean
  connectionNameForEvent?: (event: AlertEventRecord) => string
  onResolve?: (event: AlertEventRecord) => void
  resolvingEventId?: string | null
}

export function AlertEventsTable({
  orgSlug,
  events,
  emptyTitle,
  emptyCopy,
  showConnectionColumn = false,
  connectionNameForEvent,
  onResolve,
  resolvingEventId,
}: AlertEventsTableProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 py-12 text-center">
        <h3 className="text-lg font-semibold">{emptyTitle}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{emptyCopy}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {showConnectionColumn ? <TableHead>Connection</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>Queue</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Fired</TableHead>
            <TableHead className="w-[140px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const isResolving = resolvingEventId === event.id

            return (
              <TableRow key={event.id}>
                {showConnectionColumn ? (
                  <TableCell className="text-sm font-medium">
                    {connectionNameForEvent?.(event) ?? 'Unknown connection'}
                  </TableCell>
                ) : null}
                <TableCell>
                  <AlertStatusBadge status={event.status} emphasize={event.status === 'firing'} />
                </TableCell>
                <TableCell>
                  <AlertTypeBadge type={event.type} compact />
                </TableCell>
                <TableCell className="max-w-[220px]">
                  <Link
                    to="/$orgSlug/c/$connectionId/queues/$queueName"
                    params={{
                      orgSlug,
                      connectionId: event.connectionId,
                      queueName: event.queueName,
                    }}
                    className="inline-flex items-center gap-1.5 truncate font-medium hover:text-primary"
                  >
                    <span className="truncate">{event.queueName}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                </TableCell>
                <TableCell className="max-w-[520px]">
                  <div className="space-y-1">
                    <p className="line-clamp-2 text-sm font-medium">{event.summary}</p>
                    {event.resolvedAt && event.status === 'resolved' ? (
                      <p className="text-xs text-muted-foreground">
                        Resolved {formatAlertDate(event.resolvedAt)}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <DeliverySummary event={event} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatAlertDate(event.firedAt)}
                </TableCell>
                <TableCell className="text-right">
                  {event.status === 'firing' && onResolve ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => onResolve(event)}
                      disabled={isResolving}
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Resolving
                        </>
                      ) : (
                        <>
                          <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                          Resolve
                        </>
                      )}
                    </Button>
                  ) : (
                    <Link
                      to="/$orgSlug/c/$connectionId/alerts"
                      params={{ orgSlug, connectionId: event.connectionId }}
                      search={{ tab: 'history' }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open alerts
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function DeliverySummary({ event }: { event: AlertEventRecord }) {
  const linearDelivery = event.deliveries.find(
    (delivery) => delivery.channelType === 'linear' && delivery.externalUrl
  )
  if (linearDelivery?.externalUrl) {
    return (
      <a
        href={linearDelivery.externalUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {linearDelivery.externalIdentifier ?? 'Linear issue'}
        <ArrowUpRight className="h-3 w-3" />
      </a>
    )
  }

  const webhookDelivery = event.deliveries.find((delivery) => delivery.channelType === 'webhook')
  if (webhookDelivery) {
    const httpStatus = webhookDelivery.providerMetadata?.httpStatus
    if (webhookDelivery.status === 'delivered') {
      return (
        <span className="text-xs text-muted-foreground">
          Webhook {typeof httpStatus === 'number' ? `HTTP ${httpStatus}` : 'delivered'}
        </span>
      )
    }
    if (webhookDelivery.status === 'failed') {
      return (
        <span className="text-xs text-destructive">
          Webhook failed{webhookDelivery.lastError ? `: ${webhookDelivery.lastError}` : ''}
        </span>
      )
    }
    return <span className="text-xs text-muted-foreground">Webhook pending</span>
  }

  if (event.deliveries.length > 0) {
    const delivered = event.deliveries.filter((delivery) => delivery.status === 'delivered').length
    return (
      <span className="text-xs text-muted-foreground">
        {delivered}/{event.deliveries.length} delivered
      </span>
    )
  }

  return (
    <span className="text-xs text-muted-foreground">
      {event.notificationSentAt ? 'Delivered' : 'Not sent'}
    </span>
  )
}
