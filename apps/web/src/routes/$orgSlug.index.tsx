import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { connectionsQueryKey } from '@/components/connection-provider'
import { ApiError, api, type InferResponseType } from '@/lib/api'

export const Route = createFileRoute('/$orgSlug/')({
  component: OrgIndexRoute,
})

// Type helpers using Hono's InferResponseType
type ListConnectionsResponse = InferResponseType<(typeof api.connections)['$get'], 200>
type Connection = ListConnectionsResponse['connections'][number]

async function fetchConnections(): Promise<Connection[]> {
  const res = await api.connections.$get()
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new ApiError(data.error || data.message || `API error: ${res.status}`, res.status)
  }
  const data = await res.json()
  return data.connections
}

/**
 * Index route for an organization.
 * Automatically redirects to the default connection's queues dashboard.
 */
function OrgIndexRoute() {
  const { orgSlug } = Route.useParams()

  const {
    data: connections,
    isLoading,
    error,
  } = useQuery({
    queryKey: connectionsQueryKey,
    queryFn: fetchConnections,
    staleTime: 30_000,
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading connections...</p>
      </div>
    )
  }

  // Error state or no connections - redirect to connections page to set up
  if (error || !connections || connections.length === 0) {
    return <Navigate to="/$orgSlug/connections" params={{ orgSlug }} replace />
  }

  // Find the default connection or use the first one
  const defaultConnection = connections.find((c) => c.isDefault) ?? connections[0]

  // Redirect to the default connection's queues dashboard
  return (
    <Navigate
      to="/$orgSlug/c/$connectionId"
      params={{ orgSlug, connectionId: defaultConnection.id }}
      replace
    />
  )
}
