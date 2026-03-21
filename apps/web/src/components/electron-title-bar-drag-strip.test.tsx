import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElectronTitleBarDragStrip } from '@/components/electron-title-bar-drag-strip'

const mockState = vi.hoisted(() => ({
  isElectronShell: false,
}))

vi.mock('@/hooks/use-electron-shell', () => ({
  useIsElectronShell: () => mockState.isElectronShell,
}))

describe('ElectronTitleBarDragStrip', () => {
  beforeEach(() => {
    mockState.isElectronShell = false
  })

  it('does not render outside the Electron shell', () => {
    const { container } = render(<ElectronTitleBarDragStrip />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders a draggable 40px strip inside Electron', () => {
    mockState.isElectronShell = true

    const { container } = render(<ElectronTitleBarDragStrip />)

    const strip = container.querySelector('.app-region-drag')
    expect(strip).toHaveAttribute('aria-hidden')
    expect(strip).toHaveClass('app-region-drag')
    expect(strip).toHaveStyle({ height: '40px' })
  })
})
