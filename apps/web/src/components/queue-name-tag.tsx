import { Link, useParams } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useConnection } from './connection-provider'

interface QueueNameTagProps {
  name: string
  /** Render as a link to the queue detail page */
  asLink?: boolean
  /** Additional class names */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
}

/**
 * A distinctive tag component for displaying queue names consistently
 * across the application. Matches the original Badge outline style with monospace font.
 */
export function QueueNameTag({ name, asLink = false, className, size = 'md' }: QueueNameTagProps) {
  const { currentConnection } = useConnection()
  const connectionId = currentConnection?.id
  // Get orgSlug from route params for org-scoped navigation
  const params = useParams({ strict: false })
  const orgSlug = (params as { orgSlug?: string }).orgSlug

  const baseStyles = cn(
    // Core tag styling - matches Badge outline variant
    'inline-flex items-center rounded-full border font-mono font-semibold',
    // Text color adapts to theme
    'text-foreground',
    // Size variant
    sizeStyles[size],
    // Transition for hover states
    'transition-colors duration-150',
    className
  )

  if (asLink && connectionId && orgSlug) {
    return (
      <Link
        to="/$orgSlug/c/$connectionId/queues/$queueName"
        params={{ orgSlug, connectionId, queueName: name }}
        search={{}}
        className={cn(
          baseStyles,
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
      >
        {name}
      </Link>
    )
  }

  return <span className={baseStyles}>{name}</span>
}
