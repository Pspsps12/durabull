import * as React from 'react'
import { cn } from '@/lib/utils'

interface CollapsibleContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

function useCollapsibleContext() {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error('Collapsible components must be used within a Collapsible')
  }
  return context
}

interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

export function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  className,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      <div className={className} data-state={open ? 'open' : 'closed'}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export function CollapsibleTrigger({
  children,
  asChild,
  onClick,
  className,
  ...props
}: CollapsibleTriggerProps) {
  const { open, onOpenChange } = useCollapsibleContext()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(!open)
    onClick?.(e)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
      {
        onClick: (e: React.MouseEvent) => {
          onOpenChange(!open)
          const childProps = children.props as { onClick?: (e: React.MouseEvent) => void }
          childProps.onClick?.(e)
        },
      }
    )
  }

  return (
    <button
      type="button"
      aria-expanded={open}
      data-state={open ? 'open' : 'closed'}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}

interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CollapsibleContent({ children, className, ...props }: CollapsibleContentProps) {
  const { open } = useCollapsibleContext()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | undefined>(open ? undefined : 0)
  const [isAnimating, setIsAnimating] = React.useState(false)

  React.useEffect(() => {
    const content = contentRef.current
    if (!content) return

    if (open) {
      setIsAnimating(true)
      const contentHeight = content.scrollHeight
      setHeight(contentHeight)

      const timer = setTimeout(() => {
        setHeight(undefined)
        setIsAnimating(false)
      }, 200)

      return () => clearTimeout(timer)
    } else {
      setIsAnimating(true)
      const contentHeight = content.scrollHeight
      setHeight(contentHeight)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0)
        })
      })

      const timer = setTimeout(() => {
        setIsAnimating(false)
      }, 200)

      return () => clearTimeout(timer)
    }
  }, [open])

  if (!open && !isAnimating && height === 0) {
    return null
  }

  return (
    <div
      ref={contentRef}
      data-state={open ? 'open' : 'closed'}
      className={cn('overflow-hidden transition-[height] duration-200 ease-out', className)}
      style={{ height: height !== undefined ? `${height}px` : 'auto' }}
      {...props}
    >
      {children}
    </div>
  )
}
