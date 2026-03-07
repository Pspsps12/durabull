import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { AlertCircle, Layers, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { useConnection } from '@/components/connection-provider'
import { NoConnectionConfigured } from '@/components/no-connection-configured'
import { OrganizationOnboarding } from '@/components/organization-onboarding'
import { useOrganizations } from '@/hooks/use-organization'

const onboardingSearchSchema = z.object({
  onboarding: z
    .union([z.literal(true), z.literal('true'), z.literal(1), z.literal('1')])
    .transform(() => true)
    .optional(),
})

const ONBOARDING_STORAGE_PREFIX = 'durabull:onboarding:'

export const Route = createFileRoute('/$orgSlug/')({
  validateSearch: zodValidator(onboardingSearchSchema),
  component: OrgIndexRoute,
})

function getOnboardingStorageKey(orgSlug: string) {
  return `${ONBOARDING_STORAGE_PREFIX}${orgSlug}`
}

function readOnboardingState(orgSlug: string): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(getOnboardingStorageKey(orgSlug)) === 'completed'
}

function writeOnboardingState(orgSlug: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getOnboardingStorageKey(orgSlug), 'completed')
}

function humanizeOrgSlug(orgSlug: string) {
  return orgSlug
    .split('-')
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(' ')
}

function OrgIndexRoute() {
  const { orgSlug } = Route.useParams()
  const { onboarding } = Route.useSearch()
  const navigate = useNavigate()
  const { connections, currentConnection, isLoading, error } = useConnection()
  const { data: organizations } = useOrganizations()
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => readOnboardingState(orgSlug))

  useEffect(() => {
    setOnboardingCompleted(readOnboardingState(orgSlug))
  }, [orgSlug])

  const completeOnboarding = useCallback(() => {
    writeOnboardingState(orgSlug)
    setOnboardingCompleted(true)
    void navigate({
      to: '/$orgSlug',
      params: { orgSlug },
      search: {},
      replace: true,
    })
  }, [navigate, orgSlug])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading connections...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Failed to load connections</h2>
        <p className="mt-2 max-w-md text-center text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  if (connections.length === 0) {
    const organizationName =
      organizations?.find((organization) => organization.slug === orgSlug)?.name ??
      humanizeOrgSlug(orgSlug)

    if (onboarding || !onboardingCompleted) {
      return (
        <OrganizationOnboarding
          orgSlug={orgSlug}
          organizationName={organizationName}
          onSkip={completeOnboarding}
        />
      )
    }

    return <NoConnectionConfigured orgSlug={orgSlug} area="Queues" icon={Layers} />
  }

  if (!currentConnection) {
    return <NoConnectionConfigured orgSlug={orgSlug} area="Queues" icon={Layers} />
  }

  return (
    <Navigate
      to="/$orgSlug/c/$connectionId"
      params={{ orgSlug, connectionId: currentConnection.id }}
      replace
    />
  )
}
