import { useEffect, type ReactNode } from 'react'
import { XIcon } from '@/components/ui/icons'

/**
 * Bottom-sheet on mobile, centred dialog on desktop.
 * Locks body scroll and closes on Escape while open.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
