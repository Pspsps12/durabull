import { useIsElectronShell } from '@/hooks/use-electron-shell'

const DRAG_STRIP_PX = 40

/**
 * Full-width top strip so auth / setup flows can move the window in Electron
 * (matches ~native title bar height).
 */
export function ElectronTitleBarDragStrip() {
  const isElectronShell = useIsElectronShell()
  if (!isElectronShell) return null

  return (
    <div
      className="w-full shrink-0 app-region-drag"
      style={{ height: DRAG_STRIP_PX }}
      aria-hidden
    />
  )
}
