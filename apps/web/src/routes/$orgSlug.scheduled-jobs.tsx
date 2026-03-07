import { createFileRoute } from '@tanstack/react-router'
import { Calendar } from 'lucide-react'
import { NoConnectionConfigured } from '@/components/no-connection-configured'

export const Route = createFileRoute('/$orgSlug/scheduled-jobs')({
  component: ScheduledJobsFallbackRoute,
})

function ScheduledJobsFallbackRoute() {
  const { orgSlug } = Route.useParams()

  return (
    <NoConnectionConfigured
      orgSlug={orgSlug}
      area="Scheduled Jobs"
      icon={Calendar}
      description="Scheduled jobs need a configured Redis connection before Durabull can index schedulers and surface upcoming work."
    />
  )
}
