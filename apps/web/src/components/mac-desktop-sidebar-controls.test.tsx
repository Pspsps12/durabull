import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MacDesktopSidebarControls } from '@/components/mac-desktop-sidebar-controls'

const mockState = vi.hoisted(() => ({
  isMacElectronShell: false,
  location: {
    pathname: '/',
    search: {},
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => mockState.location,
}))

vi.mock('@/hooks/use-electron-shell', () => ({
  useIsMacElectronShell: () => mockState.isMacElectronShell,
}))

function setNavigationAvailability(canGoBack: boolean, canGoForward: boolean) {
  const navigationApi = new EventTarget() as EventTarget & {
    canGoBack: boolean
    canGoForward: boolean
  }

  navigationApi.canGoBack = canGoBack
  navigationApi.canGoForward = canGoForward

  Object.defineProperty(window, 'navigation', {
    configurable: true,
    value: navigationApi,
  })

  return navigationApi
}

describe('MacDesktopSidebarControls', () => {
  beforeEach(() => {
    mockState.isMacElectronShell = false
    mockState.location = {
      pathname: '/',
      search: {},
    }
    Reflect.deleteProperty(window, 'navigation')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'navigation')
  })

  it('does not render outside the macOS Electron shell', () => {
    const { container } = render(<MacDesktopSidebarControls />)

    expect(container).toBeEmptyDOMElement()
  })

  it('tracks back and forward availability from route changes', async () => {
    const user = userEvent.setup()
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const forwardSpy = vi.spyOn(window.history, 'forward').mockImplementation(() => {})

    mockState.isMacElectronShell = true
    mockState.location = {
      pathname: '/org/queues',
      search: {},
    }

    const { rerender } = render(<MacDesktopSidebarControls />)

    expect(screen.getByRole('button', { name: 'Go back' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Go forward' })).toBeDisabled()

    mockState.location = {
      pathname: '/org/queues/job-1',
      search: {},
    }
    rerender(<MacDesktopSidebarControls />)

    expect(screen.getByRole('button', { name: 'Go back' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Go forward' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Go back' }))
    expect(backSpy).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new PopStateEvent('popstate'))
    mockState.location = {
      pathname: '/org/queues',
      search: {},
    }
    rerender(<MacDesktopSidebarControls />)

    expect(screen.getByRole('button', { name: 'Go forward' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Go forward' }))
    expect(forwardSpy).toHaveBeenCalledTimes(1)
  })

  it('uses the native navigation API availability when present', () => {
    mockState.isMacElectronShell = true
    setNavigationAvailability(true, true)

    render(<MacDesktopSidebarControls />)

    expect(screen.getByRole('button', { name: 'Go back' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Go forward' })).toBeEnabled()
  })
})
