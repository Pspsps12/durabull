import { AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface JsonEditorProps {
  value: unknown
  onChange: (value: unknown, isValid: boolean) => void
  className?: string
  minHeight?: string
}

export function JsonEditor({ value, onChange, className, minHeight = '200px' }: JsonEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)

  // Update text when external value changes
  useEffect(() => {
    const newText = JSON.stringify(value, null, 2)
    setText(newText)
    setError(null)
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value
      setText(newText)

      try {
        const parsed = JSON.parse(newText)
        setError(null)
        onChange(parsed, true)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON'
        setError(message)
        onChange(value, false)
      }
    },
    [onChange, value]
  )

  return (
    <div className={cn('space-y-2', className)}>
      <textarea
        value={text}
        onChange={handleChange}
        className={cn(
          'w-full rounded-md border bg-[#0d1117] p-4 font-mono text-sm text-[#c9d1d9] resize-y',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          error ? 'border-destructive' : 'border-[#30363d]'
        )}
        style={{ minHeight }}
        spellCheck={false}
      />
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
