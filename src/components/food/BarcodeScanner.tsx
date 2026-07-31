import { useEffect, useRef, useState } from 'react'
import { BarcodeIcon } from '@/components/ui/icons'
import { Alert } from '@/components/ui/Alert'

/**
 * Camera barcode scanning via the native BarcodeDetector API.
 *
 * BarcodeDetector ships in Chrome/Edge/Android but not Safari or Firefox, so
 * support is feature-detected and unsupported browsers get a clear message
 * pointing at Search rather than a broken camera view.
 */

// Minimal shape of the API — TS's DOM lib doesn't declare BarcodeDetector.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

export function BarcodeScanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  // Held in a ref so the rAF loop can stop without being re-created.
  const activeRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)

  // Always release the camera on unmount — a live track keeps the recording
  // indicator on and holds the device.
  useEffect(() => {
    return () => {
      activeRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function start() {
    setError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setScanning(true)
      activeRef.current = true

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()

      const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector
      const detector = new Ctor({ formats: FORMATS })

      const tick = async () => {
        if (!activeRef.current || !videoRef.current) return

        try {
          const codes = await detector.detect(videoRef.current)
          const value = codes[0]?.rawValue
          if (value) {
            stop()
            onDetected(value)
            return
          }
        } catch {
          // A single failed frame is normal (e.g. mid-focus) — keep scanning.
        }

        requestAnimationFrame(() => void tick())
      }

      requestAnimationFrame(() => void tick())
    } catch (err) {
      setScanning(false)
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow it in your browser settings, or use Search instead.'
          : 'Could not start the camera. Try Search instead.',
      )
    }
  }

  function stop() {
    activeRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setScanning(false)
  }

  if (!supported) {
    return (
      <div className="card p-6 text-center">
        <BarcodeIcon className="mx-auto size-10 text-slate-300" />
        <p className="mt-3 font-semibold text-slate-700">Scanning isn't available here</p>
        <p className="mt-1 text-sm text-slate-500">
          Your browser doesn't support the BarcodeDetector API. It works in Chrome, Edge and Android;
          on Safari or Firefox, use the Search tab instead.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-[4/3]">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`size-full object-cover ${scanning ? '' : 'opacity-0'}`}
        />

        {scanning ? (
          // Framing guide.
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-4/5 rounded-xl border-2 border-brand-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-slate-300">
            <BarcodeIcon className="size-10" />
            <p className="text-sm">Point your camera at a product barcode</p>
          </div>
        )}
      </div>

      <Alert tone="error">{error}</Alert>

      {scanning ? (
        <button type="button" onClick={stop} className="btn-secondary w-full">
          Stop scanning
        </button>
      ) : (
        <button type="button" onClick={() => void start()} className="btn-primary w-full">
          <BarcodeIcon className="size-4" />
          Start camera
        </button>
      )}
    </div>
  )
}
