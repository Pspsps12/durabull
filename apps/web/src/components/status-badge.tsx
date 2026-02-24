import { cn } from '@/lib/utils'

type StatusType =
  | 'active'
  | 'running'
  | 'paused'
  | 'idle'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'enabled'
  | 'disabled'

interface StatusBadgeProps {
  status: StatusType
  showPulse?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig: Record<
  StatusType,
  {
    label: string
    bgColor: string
    textColor: string
    dotColor: string
    pulseColor: string
  }
> = {
  active: {
    label: 'Active',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    pulseColor: 'bg-emerald-400',
  },
  running: {
    label: 'Running',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    pulseColor: 'bg-blue-400',
  },
  paused: {
    label: 'Paused',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    pulseColor: 'bg-amber-400',
  },
  idle: {
    label: 'Idle',
    bgColor: 'bg-slate-500/10 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
    dotColor: 'bg-slate-400',
    pulseColor: 'bg-slate-300',
  },
  waiting: {
    label: 'Waiting',
    bgColor: 'bg-slate-500/10 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
    dotColor: 'bg-slate-400',
    pulseColor: 'bg-slate-300',
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-green-500/10 dark:bg-green-500/20',
    textColor: 'text-green-600 dark:text-green-400',
    dotColor: 'bg-green-500',
    pulseColor: 'bg-green-400',
  },
  failed: {
    label: 'Failed',
    bgColor: 'bg-red-500/10 dark:bg-red-500/20',
    textColor: 'text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500',
    pulseColor: 'bg-red-400',
  },
  delayed: {
    label: 'Delayed',
    bgColor: 'bg-orange-500/10 dark:bg-orange-500/20',
    textColor: 'text-orange-600 dark:text-orange-400',
    dotColor: 'bg-orange-500',
    pulseColor: 'bg-orange-400',
  },
  enabled: {
    label: 'Enabled',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    pulseColor: 'bg-emerald-400',
  },
  disabled: {
    label: 'Disabled',
    bgColor: 'bg-slate-500/10 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
    dotColor: 'bg-slate-400',
    pulseColor: 'bg-slate-300',
  },
}

const sizeConfig = {
  sm: {
    badge: 'px-2 py-0.5 text-xs gap-1.5',
    dot: 'h-1.5 w-1.5',
  },
  md: {
    badge: 'px-2.5 py-1 text-xs gap-2',
    dot: 'h-2 w-2',
  },
  lg: {
    badge: 'px-3 py-1.5 text-sm gap-2',
    dot: 'h-2.5 w-2.5',
  },
}

export function StatusBadge({
  status,
  showPulse = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizeStyles = sizeConfig[size]
  const shouldPulse = showPulse && (status === 'active' || status === 'running')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-all',
        config.bgColor,
        config.textColor,
        sizeStyles.badge,
        className
      )}
    >
      <span className="relative flex">
        <span className={cn('rounded-full', config.dotColor, sizeStyles.dot)} />
        {shouldPulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              config.pulseColor
            )}
          />
        )}
      </span>
      {config.label}
    </span>
  )
}

// Simple animated dot for inline use
export function StatusDot({
  status,
  showPulse = true,
  size = 'md',
  className,
}: Omit<StatusBadgeProps, 'showLabel'>) {
  const config = statusConfig[status]
  const sizeStyles = sizeConfig[size]
  const shouldPulse = showPulse && (status === 'active' || status === 'running')

  return (
    <span className={cn('relative inline-flex', className)}>
      <span className={cn('rounded-full', config.dotColor, sizeStyles.dot)} />
      {shouldPulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            config.pulseColor
          )}
        />
      )}
    </span>
  )
}

// Inline status indicator (dot + text) - matches Worker Details table style
interface StatusIndicatorProps {
  status: StatusType
  showPulse?: boolean
  className?: string
}

export function StatusIndicator({ status, showPulse = true, className }: StatusIndicatorProps) {
  const config = statusConfig[status]
  const shouldPulse = showPulse && (status === 'active' || status === 'running')

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {shouldPulse ? (
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.pulseColor
            )}
          />
          <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', config.dotColor)} />
        </span>
      ) : (
        <span className={cn('flex h-2.5 w-2.5 rounded-full', config.dotColor)} />
      )}
      <span className={cn('text-xs font-medium leading-none', config.textColor)}>
        {config.label}
      </span>
    </div>
  )
}
