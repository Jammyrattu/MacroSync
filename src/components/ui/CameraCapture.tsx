import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { ImageIcon } from '@/components/ui/icons'

/**
 * Take a photo with the device camera.
 *
 * Uses getUserMedia and a canvas grab rather than <input capture>, because that
 * attribute is ignored on desktop — it would silently reopen the same file
 * picker the "Choose photo" button already offers, which is a confusing way to
 * label a button "Take photo".
 *
 * The stream is stopped on close and on unmount. A live track keeps the
 * recording indicator lit and holds the device against other apps.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setReady(false)
  }, [])

  const start = useCallback(
    async (mode: 'environment' | 'user') => {
      setError('')
      stop()

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false,
        })
        streamRef.current = stream

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setReady(true)
      } catch (err) {
        setReady(false)
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera access was denied. Allow it in your browser settings, or choose a photo instead.'
            : 'Could not start the camera. Choose a photo from your device instead.',
        )
      }
    },
    [stop],
  )

  useEffect(() => {
    if (open) void start(facing)
    else stop()
    return stop
  }, [open, facing, start, stop])

  function capture() {
    const video = videoRef.current
    if (!video || !ready) return

    const canvas = document.createElement('canvas')
    // Grab at the sensor's own resolution rather than the CSS size, or the
    // photo comes out as blurry as the preview box.
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Could not capture the photo. Try again.')
          return
        }
        onCapture(new File([blob], `checkin-${Date.now()}.jpg`, { type: 'image/jpeg' }))
        stop()
        onClose()
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Take a photo">
      <div className="space-y-3">
        <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-scrim">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`size-full object-cover ${ready ? '' : 'opacity-0'} ${
              // The front camera is mirrored so it behaves like a mirror; the
              // captured frame is not, which is what people expect.
              facing === 'user' ? 'scale-x-[-1]' : ''
            }`}
          />
          {!ready && !error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
              <ImageIcon className="size-9" />
              <p className="text-sm">Starting the camera…</p>
            </div>
          ) : null}
        </div>

        <Alert tone="error">{error}</Alert>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            className="btn-secondary shrink-0"
          >
            Flip
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            className="btn-primary flex-1"
          >
            Capture
          </button>
        </div>
      </div>
    </Modal>
  )
}
