import { AnalyticsEvents, DialogType, trackEvent } from '@durabull/analytics'
import { Copy, Loader2, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { JsonEditor } from '@/components/json-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddJob } from '@/hooks/use-queues'

interface DuplicateJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  queueName: string
  originalJobId: string
  originalJobName: string
  originalJobData: Record<string, unknown>
  originalOptions?: {
    delay?: number
    priority?: number
    attempts?: number
  }
  onSuccess?: (newJobId: string) => void
}

export function DuplicateJobDialog({
  open,
  onOpenChange,
  queueName,
  originalJobId,
  originalJobName,
  originalJobData,
  originalOptions,
  onSuccess,
}: DuplicateJobDialogProps) {
  const [jobName, setJobName] = useState(originalJobName)
  const [jobData, setJobData] = useState<unknown>(originalJobData)
  const [isJsonValid, setIsJsonValid] = useState(true)
  const [delay, setDelay] = useState<string>(String(originalOptions?.delay ?? 0))
  const [priority, setPriority] = useState<string>(String(originalOptions?.priority ?? 0))
  const [attempts, setAttempts] = useState<string>(String(originalOptions?.attempts ?? 1))

  const addJobMutation = useAddJob()

  // Reset form when dialog opens with new job
  useEffect(() => {
    if (open) {
      setJobName(originalJobName)
      setJobData(originalJobData)
      setIsJsonValid(true)
      setDelay(String(originalOptions?.delay ?? 0))
      setPriority(String(originalOptions?.priority ?? 0))
      setAttempts(String(originalOptions?.attempts ?? 1))
    }
  }, [open, originalJobName, originalJobData, originalOptions])

  const handleJsonChange = (value: unknown, isValid: boolean) => {
    setJobData(value)
    setIsJsonValid(isValid)
  }

  const handleSubmit = async () => {
    if (!isJsonValid || !jobName.trim()) return

    const delayMs = Number.parseInt(delay, 10) || 0
    const priorityNum = Number.parseInt(priority, 10) || 0
    const attemptsNum = Number.parseInt(attempts, 10) || 1

    try {
      const result = await addJobMutation.mutateAsync({
        queueName,
        name: jobName.trim(),
        jobData,
        options: {
          delay: delayMs > 0 ? delayMs : undefined,
          priority: priorityNum > 0 ? priorityNum : undefined,
          attempts: attemptsNum > 1 ? attemptsNum : undefined,
        },
      })

      toast.success('Job created successfully', {
        description: `Job ID: ${result.jobId}`,
      })

      onOpenChange(false)
      if (result.jobId && onSuccess) {
        onSuccess(result.jobId)
      }
    } catch {
      // Error is handled by react-query
    }
  }

  const isSubmitting = addJobMutation.isPending
  const canSubmit = isJsonValid && jobName.trim() && !isSubmitting

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        trackEvent(newOpen ? AnalyticsEvents.DIALOG_OPENED : AnalyticsEvents.DIALOG_CLOSED, {
          dialog_type: DialogType.DUPLICATE_JOB,
        })
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicate Job
          </DialogTitle>
          <DialogDescription>
            Create a new job based on the original. You can modify the data and options before
            adding it to the queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Original Job ID (read-only reference) */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Duplicating from job:</p>
            <p className="font-mono text-sm break-all">{originalJobId}</p>
          </div>

          {/* Job Name */}
          <div className="space-y-2">
            <Label htmlFor="job-name">Job Name</Label>
            <Input
              id="job-name"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Enter job name"
            />
          </div>

          {/* Job Data */}
          <div className="space-y-2">
            <Label>Job Data (JSON)</Label>
            <JsonEditor value={jobData} onChange={handleJsonChange} minHeight="180px" />
          </div>

          {/* Options */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Options</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delay" className="text-xs text-muted-foreground">
                  Delay (ms)
                </Label>
                <Input
                  id="delay"
                  type="number"
                  min="0"
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-xs text-muted-foreground">
                  Priority
                </Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attempts" className="text-xs text-muted-foreground">
                  Max Attempts
                </Label>
                <Input
                  id="attempts"
                  type="number"
                  min="1"
                  value={attempts}
                  onChange={(e) => setAttempts(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Add Job
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
