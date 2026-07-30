import type { ReactNode } from 'react'

interface DetailDrawerProps {
  'aria-label': string
  onClose: () => void
  children: ReactNode
}

/**
 * Drawer lateral + backdrop: clique fora fecha (mesmo handler do ×).
 */
export function DetailDrawer({
  'aria-label': ariaLabel,
  onClose,
  children,
}: DetailDrawerProps) {
  return (
    <>
      <div
        className="detail-backdrop"
        role="presentation"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="detail-drawer scrollable" aria-label={ariaLabel}>
        {children}
      </aside>
    </>
  )
}
