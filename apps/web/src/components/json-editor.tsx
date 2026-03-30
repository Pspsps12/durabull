import { AlertCircle, CheckCircle2, WandSparkles } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface JsonEditorProps {
  value: unknown
  onChange: (value: unknown, isValid: boolean) => void
  className?: string
  minHeight?: string
}

const INDENT = '  '

function getLineStart(text: string, index: number): number {
  return text.lastIndexOf('\n', Math.max(index - 1, 0)) + 1
}

function getLineEnd(text: string, index: number): number {
  const lineEnd = text.indexOf('\n', index)
  return lineEnd === -1 ? text.length : lineEnd
}

function indentSelectedLines(text: string, start: number, end: number): [string, number, number] {
  const lineStart = getLineStart(text, start)
  const lineEnd = getLineEnd(text, end)
  const selectedText = text.slice(lineStart, lineEnd)
  const indented = selectedText
    .split('\n')
    .map((line) => `${INDENT}${line}`)
    .join('\n')

  const nextText = `${text.slice(0, lineStart)}${indented}${text.slice(lineEnd)}`
  const affectedLines = selectedText.split('\n').length

  return [nextText, start + INDENT.length, end + affectedLines * INDENT.length]
}

function outdentSelectedLines(text: string, start: number, end: number): [string, number, number] {
  const lineStart = getLineStart(text, start)
  const lineEnd = getLineEnd(text, end)
  const selectedText = text.slice(lineStart, lineEnd)
  const lines = selectedText.split('\n')

  let removedBeforeSelection = 0
  let removedWithinSelection = 0

  const outdented = lines
    .map((line, index) => {
      if (!line.startsWith(INDENT)) {
        return line
      }

      if (index === 0 && start > lineStart) {
        removedBeforeSelection = Math.min(INDENT.length, start - lineStart)
      }

      removedWithinSelection += INDENT.length
      return line.slice(INDENT.length)
    })
    .join('\n')

  const nextText = `${text.slice(0, lineStart)}${outdented}${text.slice(lineEnd)}`

  return [
    nextText,
    Math.max(lineStart, start - removedBeforeSelection),
    Math.max(lineStart, end - removedWithinSelection),
  ]
}

function insertIndentedNewline(text: string, start: number, end: number): [string, number, number] {
  const beforeSelection = text.slice(0, start)
  const afterSelection = text.slice(end)
  const currentLine = beforeSelection.slice(getLineStart(text, start))
  const currentIndent = currentLine.match(/^\s*/)?.[0] ?? ''
  const trimmedBefore = beforeSelection.trimEnd()
  const nextNonWhitespace = afterSelection.match(/\S/)?.[0] ?? ''
  const shouldIncreaseIndent = /[[{]$/.test(trimmedBefore)
  const shouldSplitClosing = /[}\]]/.test(nextNonWhitespace)

  if (shouldIncreaseIndent && shouldSplitClosing) {
    const inserted = `\n${currentIndent}${INDENT}\n${currentIndent}`
    const caret = start + currentIndent.length + INDENT.length + 1
    const nextText = `${beforeSelection}${inserted}${afterSelection}`
    return [nextText, caret, caret]
  }

  const inserted = `\n${currentIndent}${shouldIncreaseIndent ? INDENT : ''}`
  const caret = start + inserted.length
  const nextText = `${beforeSelection}${inserted}${afterSelection}`
  return [nextText, caret, caret]
}

export function JsonEditor({ value, onChange, className, minHeight = '200px' }: JsonEditorProps) {
  const initialText = useMemo(() => JSON.stringify(value, null, 2), [value])
  const [text, setText] = useState(initialText)
  const [error, setError] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lastCommittedTextRef = useRef(initialText)

  useEffect(() => {
    if (initialText === lastCommittedTextRef.current) {
      return
    }

    setText(initialText)
    setError(null)
    lastCommittedTextRef.current = initialText
  }, [initialText])

  const lineCount = useMemo(() => Math.max(text.split('\n').length, 1), [text])

  const applyText = useCallback(
    (nextText: string) => {
      setText(nextText)

      try {
        const parsed = JSON.parse(nextText)
        const normalized = JSON.stringify(parsed, null, 2)
        setError(null)
        lastCommittedTextRef.current = normalized
        onChange(parsed, true)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON'
        setError(message)
        onChange(value, false)
      }
    },
    [onChange, value]
  )

  const formatText = useCallback(() => {
    try {
      const parsed = JSON.parse(text)
      const formatted = JSON.stringify(parsed, null, 2)
      setText(formatted)
      setError(null)
      lastCommittedTextRef.current = formatted
      onChange(parsed, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON'
      setError(message)
      onChange(value, false)
    }
  }, [onChange, text, value])

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      applyText(event.target.value)
    },
    [applyText]
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const target = event.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        formatText()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const [nextText, nextStart, nextEnd] = event.shiftKey
          ? outdentSelectedLines(text, start, end)
          : indentSelectedLines(text, start, end)
        applyText(nextText)
        requestAnimationFrame(() => {
          target.selectionStart = nextStart
          target.selectionEnd = nextEnd
        })
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const [nextText, nextStart, nextEnd] = insertIndentedNewline(text, start, end)
        applyText(nextText)
        requestAnimationFrame(() => {
          target.selectionStart = nextStart
          target.selectionEnd = nextEnd
        })
      }
    },
    [applyText, formatText, text]
  )

  return (
    <div className={cn('space-y-2', className)}>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-[#0b1220] shadow-[0_18px_60px_-40px_rgba(15,23,42,0.8)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[linear-gradient(90deg,rgba(56,189,248,0.12),rgba(15,23,42,0.35),rgba(16,185,129,0.1))] px-3 py-2.5">
          <div className="space-y-0.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300/80">
              Payload Editor
            </div>
            <div className="text-xs text-slate-400">
              Tab to indent, Shift+Tab to outdent, Cmd/Ctrl+Shift+F to format.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                error ? 'bg-red-500/15 text-red-200' : 'bg-emerald-500/15 text-emerald-200'
              )}
            >
              {error ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {error ? 'Invalid JSON' : 'Valid JSON'}
            </span>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={formatText}
              className="border border-white/10 bg-white/10 text-slate-100 hover:bg-white/15"
            >
              <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
              Format
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)]">
          <div
            aria-hidden="true"
            className="border-r border-white/10 bg-[#050b16] px-3 py-3 text-right font-mono text-xs leading-6 text-slate-500"
            style={{ transform: `translateY(-${scrollTop}px)` }}
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <div key={index + 1}>{index + 1}</div>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!error) {
                formatText()
              }
            }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            aria-label="Payload"
            className={cn(
              'w-full resize-y border-0 bg-[#0b1220] px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none',
              'placeholder:text-slate-500 focus:ring-0'
            )}
            style={{ minHeight }}
            spellCheck={false}
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
}
