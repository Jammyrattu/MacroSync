import { useEffect, useState } from 'react'

/**
 * Animated calorie ring — consumed vs goal, with the remainder in the middle.
 *
 * Hand-rolled SVG rather than a chart library: it's one arc, and this way the
 * sweep animates by transitioning stroke-dashoffset from full to its target.
 */
export function CalorieRing({
  consumed,
  goal,
  size = 190,
  strokeWidth = 14,
}: {
  consumed: number
  goal: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const ratio = goal > 0 ? consumed / goal : 0
  const over = ratio > 1
  // Clamp the arc at a full circle; going over is communicated by colour and
  // the "over" label rather than by winding the stroke around twice.
  const progress = Math.min(ratio, 1)

  // Start at 0 and flip to the real value after mount so the ring sweeps in.
  const [drawn, setDrawn] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(progress))
    return () => cancelAnimationFrame(id)
  }, [progress])

  const remaining = Math.max(0, goal - consumed)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - drawn)}
          className={`transition-[stroke-dashoffset] duration-700 ease-out ${
            over ? 'stroke-red-500' : 'stroke-brand-500'
          }`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {over ? (
          <>
            <span className="text-3xl font-bold text-red-600">{consumed - goal}</span>
            <span className="text-xs font-medium text-red-500">kcal over</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold text-slate-900">{remaining}</span>
            <span className="text-xs font-medium text-slate-500">kcal left</span>
          </>
        )}
        <span className="mt-1 text-[11px] text-slate-400">
          {consumed} / {goal}
        </span>
      </div>
    </div>
  )
}
