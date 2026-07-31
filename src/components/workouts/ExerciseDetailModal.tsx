import { useEffect, useState } from 'react'
import { EXERCISE_GUIDES, demoFrames } from '@/data/exerciseGuides'
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '@/data/exercises'
import { Modal } from '@/components/ui/Modal'

/** How long each of the two frames is held, in ms. */
const FRAME_MS = 800

/**
 * The demo is two photographs — the start and end of the rep — cross-faded back
 * and forth to animate the movement. Both are rendered stacked so the second
 * frame is already decoded before it's first shown, otherwise the first cycle
 * flashes white.
 */
function ExerciseDemo({ frames, name }: { frames: [string, string]; name: string }) {
  const [frame, setFrame] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (failed) return
    const id = window.setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), FRAME_MS)
    return () => window.clearInterval(id)
  }, [failed])

  if (failed) return null

  return (
    <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-slate-100">
      {frames.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === 0 ? `${name} — starting position` : `${name} — end of the movement`}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`absolute inset-0 size-full object-contain transition-opacity duration-300 ${
            frame === i ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  )
}

/** Full-screen how-to for one exercise: looping demo plus the coaching cues. */
export function ExerciseDetailModal({
  exerciseId,
  name,
  muscleGroup,
  equipment,
  onClose,
}: {
  exerciseId: string | null
  name: string
  muscleGroup: MuscleGroup
  equipment: string
  onClose: () => void
}) {
  const guide = exerciseId ? EXERCISE_GUIDES[exerciseId] : undefined
  const frames = demoFrames(guide?.demo ?? null)

  return (
    <Modal open={exerciseId !== null} onClose={onClose} title={name}>
      <div className="space-y-4">
        <p className="text-xs font-medium text-slate-500">
          {[MUSCLE_GROUP_LABELS[muscleGroup], equipment].filter(Boolean).join(' · ')}
        </p>

        {frames ? <ExerciseDemo frames={frames} name={name} /> : null}

        {guide ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">How to perform it</h3>
            <ul className="space-y-2">
              {guide.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-slate-700">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No guide for this exercise yet.</p>
        )}
      </div>
    </Modal>
  )
}
