import { createFileRoute } from '@tanstack/react-router'
import { BarChart3 } from 'lucide-react'
import { NoConnectionConfigured } from '@/components/no-connection-configured'

export const Route = createFileRoute('/$orgSlug/analytics')({
  component: AnalyticsFallbackRoute,
})

function AnalyticsFallbackRoute() {
  const { orgSlug } = Route.useParams()

  return (
    <NoConnectionConfigured
      orgSlug={orgSlug}
      area="Analytics"
      icon={BarChart3}
      description="Analytics needs a connection before Durabull can aggregate queue health, throughput, and fleet-level risk signals."
    />
  )
}
