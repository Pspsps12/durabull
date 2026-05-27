import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AlertRuleBuilderPage } from '@/components/alerts/alert-rule-builder-page'
import { useConnection } from '@/components/connection-provider'
import { useCreateAlertRule, useLinearIntegration } from '@/hooks/use-alerts'
import { useQueues } from '@/hooks/use-queues'

export const Route = createFileRoute('/$orgSlug/c/$connectionId/alerts/new')({
  component: CreateAlertRuleRoute,
})

export function CreateAlertRuleRoute() {
  const { orgSlug, connectionId } = Route.useParams()
  const navigate = useNavigate()
  const { currentConnection } = useConnection()
  const queuesQuery = useQueues({ pageSize: 100 })
  const createRuleMutation = useCreateAlertRule(connectionId)
  const linearIntegrationQuery = useLinearIntegration()

  return (
    <AlertRuleBuilderPage
      mode="create"
      key={`create-${connectionId}`}
      orgSlug={orgSlug}
      connectionId={connectionId}
      connectionName={currentConnection?.name}
      availableQueues={(queuesQuery.data?.queues ?? []).map((queue) => queue.name)}
      isSaving={createRuleMutation.isPending}
      linearIntegrationConfigured={
        linearIntegrationQuery.data?.integration?.validationStatus === 'valid'
      }
      onSave={async (inputs) => {
        for (const input of inputs) {
          await createRuleMutation.mutateAsync(input)
        }

        const ruleCount = inputs.length
        const primaryRuleName = inputs[0]?.name ?? 'Alert rule'

        toast.success(ruleCount === 1 ? 'Alert rule created' : 'Alert rules created', {
          description:
            ruleCount === 1
              ? `${primaryRuleName} is now being evaluated in the background.`
              : `${ruleCount} queue-scoped alert rules were created from this builder.`,
        })

        navigate({
          to: '/$orgSlug/c/$connectionId/alerts',
          params: { orgSlug, connectionId },
          search: { tab: 'rules' },
        })
      }}
    />
  )
}
