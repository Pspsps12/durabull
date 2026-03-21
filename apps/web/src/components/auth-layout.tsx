import type { ReactNode } from 'react'
import { ElectronTitleBarDragStrip } from '@/components/electron-title-bar-drag-strip'

interface AuthLayoutProps {
  children: ReactNode
}

/**
 * Simple layout for auth pages (login, signup, auth-error, invite).
 * Provides a minimal dark-themed container without the full landing page chrome.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <ElectronTitleBarDragStrip />
      {children}
    </div>
  )
}
