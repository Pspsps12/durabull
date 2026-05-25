import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  type BackoffMode,
  type JobOptionsFormValue,
  type JobOptionsValidationErrors,
  type RetentionMode,
} from '@/lib/job-options'

const RETENTION_PRESETS = [25, 100, 500] as const

function FieldMessage({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

function RetentionControl({
  label,
  description,
  mode,
  countValue,
  onModeChange,
  onCountChange,
  error,
}: {
  label: string
  description: string
  mode: RetentionMode
  countValue: string
  onModeChange: (mode: RetentionMode) => void
  onCountChange: (value: string) => void
  error?: string
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/15 p-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <Select value={mode} onChange={(event) => onModeChange(event.target.value as RetentionMode)}>
        <option value="keep">Keep all</option>
        <option value="remove">Remove immediately</option>
        <option value="count">Keep latest N</option>
      </Select>

      {mode === 'count' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {RETENTION_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={countValue === String(preset) ? 'secondary' : 'outline'}
                size="xs"
                onClick={() => onCountChange(String(preset))}
              >
                {preset}
              </Button>
            ))}
          </div>
          <Input
            value={countValue}
            onChange={(event) => onCountChange(event.target.value)}
            inputMode="numeric"
            placeholder="100"
            className={error ? 'border-destructive focus-visible:ring-destructive' : undefined}
          />
          <FieldMessage message={error} />
        </div>
      ) : null}
    </div>
  )
}

interface JobOptionsFieldsProps {
  value: JobOptionsFormValue
  onChange: (value: JobOptionsFormValue) => void
  errors?: JobOptionsValidationErrors
  showDelay?: boolean
  idPrefix?: string
  compact?: boolean
}

function updateField<K extends keyof JobOptionsFormValue>(
  value: JobOptionsFormValue,
  onChange: (value: JobOptionsFormValue) => void,
  field: K,
  nextValue: JobOptionsFormValue[K]
) {
  onChange({ ...value, [field]: nextValue })
}

export function JobOptionsFields({
  value,
  onChange,
  errors = {},
  showDelay = false,
  idPrefix = 'job-options',
  compact = false,
}: JobOptionsFieldsProps) {
  const gridClassName = compact ? 'grid grid-cols-3 gap-4' : 'grid gap-4 md:grid-cols-3'

  return (
    <div className="space-y-4">
      <div className={gridClassName}>
        {showDelay ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-delay`} className="text-xs text-muted-foreground">
              Delay (ms)
            </Label>
            <Input
              id={`${idPrefix}-delay`}
              type="number"
              min="0"
              value={value.delay}
              onChange={(event) => updateField(value, onChange, 'delay', event.target.value)}
              placeholder="0"
              className={
                errors.delay ? 'border-destructive focus-visible:ring-destructive' : undefined
              }
            />
            <FieldMessage message={errors.delay} />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label
            htmlFor={`${idPrefix}-attempts`}
            className={compact ? 'text-xs text-muted-foreground' : undefined}
          >
            {compact ? 'Max Attempts' : 'Attempts'}
          </Label>
          <Input
            id={`${idPrefix}-attempts`}
            value={value.attempts}
            onChange={(event) => updateField(value, onChange, 'attempts', event.target.value)}
            inputMode="numeric"
            min={compact ? '1' : undefined}
            className={
              errors.attempts ? 'border-destructive focus-visible:ring-destructive' : undefined
            }
          />
          <FieldMessage message={errors.attempts} />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor={`${idPrefix}-priority`}
            className={compact ? 'text-xs text-muted-foreground' : undefined}
          >
            Priority
          </Label>
          <Input
            id={`${idPrefix}-priority`}
            value={value.priority}
            onChange={(event) => updateField(value, onChange, 'priority', event.target.value)}
            inputMode="numeric"
            min={compact ? '0' : undefined}
            className={
              errors.priority ? 'border-destructive focus-visible:ring-destructive' : undefined
            }
          />
          <FieldMessage message={errors.priority} />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor={`${idPrefix}-backoff-type`}
            className={compact ? 'text-xs text-muted-foreground' : undefined}
          >
            Backoff
          </Label>
          <Select
            id={`${idPrefix}-backoff-type`}
            value={value.backoffMode}
            onChange={(event) =>
              updateField(value, onChange, 'backoffMode', event.target.value as BackoffMode)
            }
          >
            <option value="none">No backoff</option>
            <option value="fixed">Fixed</option>
            <option value="exponential">Exponential</option>
          </Select>
        </div>
      </div>

      {value.backoffMode !== 'none' ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-backoff-delay`}>Backoff Delay (ms)</Label>
          <Input
            id={`${idPrefix}-backoff-delay`}
            value={value.backoffDelay}
            onChange={(event) => updateField(value, onChange, 'backoffDelay', event.target.value)}
            inputMode="numeric"
            className={
              errors.backoff ? 'border-destructive focus-visible:ring-destructive' : undefined
            }
          />
          <FieldMessage message={errors.backoff} />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <RetentionControl
          label="Completed Job Retention"
          description="Keep history for successful runs or trim it automatically."
          mode={value.removeOnCompleteMode}
          countValue={value.removeOnCompleteCount}
          onModeChange={(mode) => updateField(value, onChange, 'removeOnCompleteMode', mode)}
          onCountChange={(count) => updateField(value, onChange, 'removeOnCompleteCount', count)}
          error={errors.removeOnComplete}
        />
        <RetentionControl
          label="Failed Job Retention"
          description="Control how much failed-run history stays available for debugging."
          mode={value.removeOnFailMode}
          countValue={value.removeOnFailCount}
          onModeChange={(mode) => updateField(value, onChange, 'removeOnFailMode', mode)}
          onCountChange={(count) => updateField(value, onChange, 'removeOnFailCount', count)}
          error={errors.removeOnFail}
        />
      </div>
    </div>
  )
}
