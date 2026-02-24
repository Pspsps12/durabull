import { AnalyticsEvents, DialogType, trackEvent } from '@durabull/analytics'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useClearJobLogs } from '@/hooks/use-queues'

interface DeleteJobLogsButtonProps {
  queueName: string
  jobId: string
  logCount: number
}

function formatLogCount(logCount: number): string {
  return `${logCount.toLocaleString()} log${logCount === 1 ? '' : 's'}`
}

export function DeleteJobLogsButton({ queueName, jobId, logCount }: DeleteJobLogsButtonProps) {
  const clearLogsMutation = useClearJobLogs()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const openConfirm = () => {
    if (logCount <= 0 || clearLogsMutation.isPending) {
      return
    }
    setConfirmOpen(true)
  }

  const handleDelete = () => {
    if (logCount <= 0 || clearLogsMutation.isPending) {
      return
    }

    clearLogsMutation.mutate(
      { queueName, jobId },
      {
        onSuccess: ({ removed }) => {
          setConfirmOpen(false)
          toast.success('Job logs deleted', {
            description: `Permanently deleted ${formatLogCount(removed)} from Redis.`,
          })
        },
        onError: (error) => {
          toast.error('Failed to delete job logs', {
            description: error.message,
          })
        },
      }
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={openConfirm}
        disabled={logCount <= 0 || clearLogsMutation.isPending}
        data-testid="delete-job-logs-button"
      >
        {clearLogsMutation.isPending ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Deleting...
          </>
        ) : (
          <>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete Logs
          </>
        )}
      </Button>

      <Dialog
        open={confirmOpen}
        onOpenChange={(newOpen) => {
          trackEvent(newOpen ? AnalyticsEvents.DIALOG_OPENED : AnalyticsEvents.DIALOG_CLOSED, {
            dialog_type: DialogType.DELETE_JOB_LOGS,
          })
          setConfirmOpen(newOpen)
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Job Logs?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete {formatLogCount(logCount)} from Redis for this job. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={clearLogsMutation.isPending}
              data-testid="delete-job-logs-confirm-button"
            >
              {clearLogsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {formatLogCount(logCount)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
