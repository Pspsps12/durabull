import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_VERSION_CHECK_INTERVAL_MS,
  isAppUpdateRequired,
  useAppVersionCheck,
} from './use-app-version-check'

const mocks = vi.hoisted(() => ({
  fetchApi: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  fetchApi: mocks.fetchApi,
}))

vi.mock('@/lib/app-version', () => ({
  APP_BUILD_INFO: {
    version: '1.2.3',
    buildId: 'client-build',
    buildTime: null,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useAppVersionCheck', () => {
  beforeEach(() => {
    mocks.fetchApi.mockReset()
  })

  it('checks the no-store version endpoint with the current client build metadata', async () => {
    mocks.fetchApi.mockResolvedValue({
      version: '1.2.4',
      buildId: 'server-build',
      buildTime: null,
      releaseChannel: 'stable',
      update: {
        required: true,
        reason: 'build_mismatch',
      },
    })

    const { result } = renderHook(() => useAppVersionCheck(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.server?.buildId).toBe('server-build'))

    expect(mocks.fetchApi).toHaveBeenCalledWith(
      '/api/app/version?clientVersion=1.2.3&clientBuildId=client-build',
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    )
    expect(result.current.updateRequired).toBe(true)
    expect(result.current.updateReason).toBe('build_mismatch')
    expect(result.current.client).toEqual({
      version: '1.2.3',
      buildId: 'client-build',
      buildTime: null,
    })
  })

  it('uses a five minute polling interval', () => {
    expect(APP_VERSION_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000)
  })

  it('only treats explicit server update responses as stale', () => {
    expect(isAppUpdateRequired(null)).toBe(false)
    expect(
      isAppUpdateRequired({
        version: '1.2.3',
        buildId: 'client-build',
        buildTime: null,
        releaseChannel: 'stable',
        update: {
          required: false,
          reason: 'up_to_date',
        },
      })
    ).toBe(false)
    expect(
      isAppUpdateRequired({
        version: '1.2.4',
        buildId: 'server-build',
        buildTime: null,
        releaseChannel: 'stable',
        update: {
          required: true,
          reason: 'build_mismatch',
        },
      })
    ).toBe(true)
  })
})
