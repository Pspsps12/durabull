import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useIsElectronShell, useIsMacElectronShell } from '@/hooks/use-electron-shell'

const originalUserAgent = navigator.userAgent

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  })
}

afterEach(() => {
  setUserAgent(originalUserAgent)
})

describe('useIsElectronShell', () => {
  it('returns false for a regular browser user agent', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Safari/537.36')

    const { result } = renderHook(() => useIsElectronShell())

    expect(result.current).toBe(false)
  })

  it('returns true when the user agent contains Electron', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Durabull/1.0 Electron/41.0.2 Safari/537.36'
    )

    const { result } = renderHook(() => useIsElectronShell())

    expect(result.current).toBe(true)
  })
})

describe('useIsMacElectronShell', () => {
  it('returns true only for Electron on macOS', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Durabull/1.0 Electron/41.0.2 Safari/537.36'
    )

    const { result } = renderHook(() => useIsMacElectronShell())

    expect(result.current).toBe(true)
  })

  it('returns false for Electron on non-mac platforms', () => {
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Durabull/1.0 Electron/41.0.2 Safari/537.36'
    )

    const { result } = renderHook(() => useIsMacElectronShell())

    expect(result.current).toBe(false)
  })
})
