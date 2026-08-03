import { Suspense, lazy } from 'react'
import type { PickedGif } from './MediaPicker'

/**
 * Code-split wrapper for MediaPicker.
 *
 * The emoji catalogue is ~190 kB of data. Splitting it out keeps it off the
 * initial load for the many sessions that never open a picker, and `open`
 * gates the import so the chunk isn't fetched until it's actually needed.
 */
const MediaPicker = lazy(() =>
  import('./MediaPicker').then((m) => ({ default: m.MediaPicker })),
)

export type { PickedGif }

export function LazyMediaPicker(props: {
  open: boolean
  onClose: () => void
  onPickEmoji: (emoji: string) => void
  onPickGif?: (gif: PickedGif) => void
  initialTab?: 'emoji' | 'gif'
}) {
  if (!props.open) return null

  return (
    <Suspense fallback={null}>
      <MediaPicker {...props} />
    </Suspense>
  )
}
