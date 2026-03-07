import { createFileRoute } from '@tanstack/react-router'
import { Network } from 'lucide-react'
import { NoConnectionConfigured } from '@/components/no-connection-configured'

export const Route = createFileRoute('/$orgSlug/workers')({
  component: WorkersFallbackRoute,
})

function WorkersFallbackRoute() {
  const { orgSlug } = Route.useParams()

  return (
    <NoConnectionConfigured
      orgSlug={orgSlug}
      area="Workers"
      icon={Network}
      description="Workers becomes available once Durabull can inspect a Redis connection and map workers back to discovered queues."
    />
  )
}
