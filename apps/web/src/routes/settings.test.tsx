import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listAccounts: vi.fn(),
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
  useLinearIntegration: () => ({ data: { integration: null } }),
  useConnectLinearIntegration: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveLinearIntegration: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteLinearIntegration: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTestLinearIntegration: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
    mocks.listAccounts.mockReset()
    mocks.listAccounts.mockResolvedValue({ data: [] })
    mocks.trackEvent.mockReset()
  })

  it('shows the current app version quietly on the settings page', () => {
    const Component = Route.options.component as () => React.ReactNode

    render(<Component />)

    expect(screen.getByText('Durabull v1.2.3-test')).toBeInTheDocument()
  })
})
