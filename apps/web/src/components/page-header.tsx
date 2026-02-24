import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PageHeaderVariant =
  | 'default'
  | 'green'
  | 'rose'
  | 'indigo'
  | 'violet'
  | 'blue'
  | 'amber'
  | 'purple'

const variantStyles: Record<
  PageHeaderVariant,
  {
    iconBg: string
    iconColor: string
  }
> = {
  default: {
    iconBg: 'from-muted to-muted/50',
    iconColor: 'text-muted-foreground',
  },
  green: {
    iconBg: 'from-green-500/20 to-green-500/5 dark:from-green-500/10 dark:to-green-500/5',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  rose: {
    iconBg: 'from-rose-500/20 to-rose-500/5 dark:from-rose-500/10 dark:to-rose-500/5',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  indigo: {
    iconBg: 'from-indigo-500/20 to-purple-500/20 dark:from-indigo-500/10 dark:to-purple-500/10',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  violet: {
    iconBg: 'from-violet-500/20 to-fuchsia-500/20 dark:from-violet-500/10 dark:to-fuchsia-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  blue: {
    iconBg: 'from-blue-500/20 to-blue-500/5 dark:from-blue-500/10 dark:to-blue-500/5',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    iconBg: 'from-amber-500/20 to-amber-500/5 dark:from-amber-500/10 dark:to-amber-500/5',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  purple: {
    iconBg: 'from-purple-500/20 to-purple-500/5 dark:from-purple-500/10 dark:to-purple-500/5',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
}

export interface PageHeaderProps {
  /**
   * The title of the page
   */
  title: string
  /**
   * Optional description below the title
   */
  description?: string
  /**
   * Icon to display in the header
   */
  icon: LucideIcon
  /**
   * Color variant for the icon background
   */
  variant?: PageHeaderVariant
  /**
   * Optional action buttons to display on the right
   */
  actions?: React.ReactNode
  /**
   * Additional className for the container
   */
  className?: string
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  variant = 'default',
  actions,
  className,
}: PageHeaderProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br',
            styles.iconBg
          )}
        >
          <Icon className={cn('h-5 w-5', styles.iconColor)} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
