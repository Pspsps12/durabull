import { useEffect, useState } from 'react'

function isElectronUserAgent(userAgent: string | undefined): boolean {
  return Boolean(userAgent && /\belectron\b/i.test(userAgent))
}

function isMacElectronUserAgent(userAgent: string | undefined): boolean {
  return isElectronUserAgent(userAgent) && /Mac OS|Macintosh/i.test(userAgent ?? '')
}

function getUserAgent(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.userAgent
}

/**
 * True when the web UI runs inside the Electron desktop shell (User-Agent includes Electron).
 */
export function useIsElectronShell(): boolean {
  const [isElectron, setIsElectron] = useState(() => isElectronUserAgent(getUserAgent()))

  useEffect(() => {
    setIsElectron(isElectronUserAgent(getUserAgent()))
  }, [])

  return isElectron
}

/**
 * True when the UI runs inside the macOS Electron desktop shell.
 */
export function useIsMacElectronShell(): boolean {
  const [isMacElectron, setIsMacElectron] = useState(() => isMacElectronUserAgent(getUserAgent()))

  useEffect(() => {
    setIsMacElectron(isMacElectronUserAgent(getUserAgent()))
  }, [])

  return isMacElectron
}
