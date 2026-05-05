import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  connectLinearIntegrationMutateAsync: vi.fn(),
  deleteLinearIntegrationMutateAsync: vi.fn(),
  linearIntegration: null as null | {
    id: string
    connected: boolean
    validationStatus: 'valid' | 'invalid' | 'unknown'
    scopes: string
    linearOrganizationName: string | null
    defaultTeamId: string | null
    defaultProjectId: string | null
    defaultLabelIds: string[]
    defaultAssigneeId: string | null
    defaultStateId: string | null
    defaultPriority: number | null
    lastValidatedAt: string | null
  },
  listAccounts: vi.fn(),
  saveLinearIntegrationMutateAsync: vi.fn(),
  testLinearIntegrationMutateAsync: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
  }),
}))

vi.mock('@durabull/analytics', () => ({
  AnalyticsEvents: {
    DIALOG_CLOSED: 'DIALOG_CLOSED',
    DIALOG_OPENED: 'DIALOG_OPENED',
    USER_ACCOUNT_LINKED: 'USER_ACCOUNT_LINKED',
    USER_ACCOUNT_UNLINKED: 'USER_ACCOUNT_UNLINKED',
  },
  DialogType: {
    UNLINK_ACCOUNT: 'UNLINK_ACCOUNT',
  },
  trackEvent: mocks.trackEvent,
}))

vi.mock('@/components/app-top-bar', () => ({
  useAppTopBar: vi.fn(),
}))

vi.mock('@/hooks/use-app-config', () => ({
  useAppConfig: () => ({
    config: {
      telemetry: {
        collectionRequired: true,
        disclosureUrl: 'https://durabull.io/privacy',
      },
    },
  }),
}))

vi.mock('@/hooks/use-alerts', () => ({
  useLinearIntegration: () => ({ data: { integration: mocks.linearIntegration } }),
  useConnectLinearIntegration: () => ({
    mutateAsync: mocks.connectLinearIntegrationMutateAsync,
    isPending: false,
  }),
  useSaveLinearIntegration: () => ({
    mutateAsync: mocks.saveLinearIntegrationMutateAsync,
    isPending: false,
  }),
  useDeleteLinearIntegration: () => ({
    mutateAsync: mocks.deleteLinearIntegrationMutateAsync,
    isPending: false,
  }),
  useTestLinearIntegration: () => ({
    mutateAsync: mocks.testLinearIntegrationMutateAsync,
    isPending: false,
  }),
}))

vi.mock('@/hooks/use-auth', () => ({
  linkSocial: vi.fn(),
  listAccounts: mocks.listAccounts,
  unlinkAccount: vi.fn(),
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'test@example.com',
    },
    isLoading: false,
  }),
}))

vi.mock('@/lib/app-version', () => ({
  APP_BUILD_INFO: {
    version: '1.2.3-test',
    buildId: 'test-build',
    buildTime: null,
  },
}))

import { Route } from '@/routes/settings'

describe('SettingsPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    mocks.connectLinearIntegrationMutateAsync.mockReset()
    mocks.connectLinearIntegrationMutateAsync.mockResolvedValue({
      authorizationUrl: 'https://linear.app/oauth/authorize?state=test',
    })
    mocks.deleteLinearIntegrationMutateAsync.mockReset()
    mocks.linearIntegration = null
    mocks.listAccounts.mockReset()
    mocks.listAccounts.mockResolvedValue({ data: [] })
    mocks.saveLinearIntegrationMutateAsync.mockReset()
    mocks.testLinearIntegrationMutateAsync.mockReset()
    mocks.trackEvent.mockReset()
  })

  it('shows the current app version quietly on the settings page', () => {
    const Component = Route.options.component as () => React.ReactNode

    render(<Component />)

    expect(screen.getByText('Durabull v1.2.3-test')).toBeInTheDocument()
  })

  it('allows entering a Linear team before starting OAuth and starts the connect flow', async () => {
    const Component = Route.options.component as () => React.ReactNode
    mocks.connectLinearIntegrationMutateAsync.mockImplementation(() => new Promise(() => {}))

    render(<Component />)

    const teamInput = screen.getByRole('textbox', { name: /default linear team id/i })
    fireEvent.change(teamInput, { target: { value: 'team-123' } })
    expect(teamInput).toHaveValue('team-123')

    const connectButton = screen.getByRole('button', { name: /connect linear/i })
    expect(connectButton).toBeEnabled()
    fireEvent.click(connectButton)

    await waitFor(() => expect(mocks.connectLinearIntegrationMutateAsync).toHaveBeenCalledTimes(1))
    expect(window.sessionStorage.getItem('durabull.linear.pendingDefaultTeamId')).toBe('team-123')
  })

  it('saves a team entered before OAuth after Linear returns connected', async () => {
    window.sessionStorage.setItem('durabull.linear.pendingDefaultTeamId', 'team-456')
    mocks.linearIntegration = {
      id: 'linear-1',
      connected: true,
      validationStatus: 'valid',
      scopes: 'read issues:create',
      linearOrganizationName: 'Acme',
      defaultTeamId: null,
      defaultProjectId: null,
      defaultLabelIds: [],
      defaultAssigneeId: null,
      defaultStateId: null,
      defaultPriority: null,
      lastValidatedAt: null,
    }
    mocks.saveLinearIntegrationMutateAsync.mockResolvedValue({
      integration: mocks.linearIntegration,
    })
    const Component = Route.options.component as () => React.ReactNode

    render(<Component />)

    await waitFor(() =>
      expect(mocks.saveLinearIntegrationMutateAsync).toHaveBeenCalledWith({
        defaultTeamId: 'team-456',
      })
    )
    expect(screen.getByRole('textbox', { name: /default linear team id/i })).toHaveValue('team-456')
    expect(window.sessionStorage.getItem('durabull.linear.pendingDefaultTeamId')).toBeNull()
  })
})
