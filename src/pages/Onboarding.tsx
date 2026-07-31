import { useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  ACTIVITY_LABELS,
  ACTIVITY_MULTIPLIERS,
  GOAL_LABELS,
  calculateTargets,
} from '@/lib/nutrition'
import type { ActivityLevel, Goal, Sex } from '@/types/db'
import { Logo } from '@/components/ui/Logo'
import { Alert } from '@/components/ui/Alert'

/**
 * First-run wizard. Collects the six inputs Mifflin-St Jeor needs, previews the
 * calculated targets, then writes them to nutrition_profiles with onboarded=true
 * — which is what releases the OnboardedGate.
 */

const STEPS = ['About you', 'Measurements', 'Activity', 'Goal', 'Your targets'] as const

export function Onboarding() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()

  const [step, setStep] = useState(0)
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex | ''>('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activity, setActivity] = useState<ActivityLevel | ''>('')
  const [goal, setGoal] = useState<Goal | ''>('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const ready = age && sex && heightCm && weightKg && activity && goal
  const targets = ready
    ? calculateTargets({
        age: Number(age),
        sex: sex as Sex,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        activity_level: activity as ActivityLevel,
        goal: goal as Goal,
      })
    : null

  // Each step's own validity — drives the Continue button.
  const stepValid = [
    Boolean(age && Number(age) >= 13 && Number(age) <= 120 && sex),
    Boolean(heightCm && Number(heightCm) > 0 && weightKg && Number(weightKg) > 0),
    Boolean(activity),
    Boolean(goal),
    Boolean(targets),
  ][step]

  async function handleFinish() {
    if (!user || !targets) return
    setSaving(true)
    setError('')

    // upsert, not update: the signup trigger normally creates this row, but
    // upsert keeps onboarding working for any user predating the trigger.
    const { error: saveError } = await supabase.from('nutrition_profiles').upsert(
      {
        user_id: user.id,
        age: Number(age),
        sex,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        activity_level: activity,
        goal,
        calorie_target: targets.calorie_target,
        protein_target: targets.protein_target,
        carbs_target: targets.carbs_target,
        fat_target: targets.fat_target,
        onboarded: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    // Seed the weight chart with today's starting weight.
    await supabase.from('weight_logs').upsert(
      {
        user_id: user.id,
        weight_kg: Number(weightKg),
        log_date: new Date().toISOString().slice(0, 10),
      },
      { onConflict: 'user_id,log_date' },
    )

    await refreshProfile()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-slate-50 to-ocean-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
            <span>{STEPS[step]}</span>
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="card p-6">
          {step === 0 && (
            <div className="space-y-5">
              <Header
                title="Tell us about you"
                detail="We use this to estimate how much energy your body burns at rest."
              />
              <div>
                <label className="label" htmlFor="age">
                  Age
                </label>
                <input
                  id="age"
                  type="number"
                  inputMode="numeric"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="input"
                  placeholder="30"
                />
              </div>
              <div>
                <span className="label">Sex</span>
                <div className="grid grid-cols-2 gap-3">
                  {(['male', 'female'] as const).map((option) => (
                    <ChoiceButton
                      key={option}
                      selected={sex === option}
                      onClick={() => setSex(option)}
                    >
                      <span className="capitalize">{option}</span>
                    </ChoiceButton>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Mifflin-St Jeor is defined with two sex coefficients; pick whichever gives you the
                  more useful estimate. You can change it any time in Settings.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Header title="Your measurements" detail="Height and current weight, in metric." />
              <div>
                <label className="label" htmlFor="height">
                  Height (cm)
                </label>
                <input
                  id="height"
                  type="number"
                  inputMode="decimal"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="input"
                  placeholder="175"
                />
              </div>
              <div>
                <label className="label" htmlFor="weight">
                  Weight (kg)
                </label>
                <input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="input"
                  placeholder="72.5"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Header title="How active are you?" detail="Counting everything, not just training." />
              {(Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[]).map((level) => (
                <ChoiceButton
                  key={level}
                  selected={activity === level}
                  onClick={() => setActivity(level)}
                  align="left"
                >
                  <span className="block font-semibold">{ACTIVITY_LABELS[level].title}</span>
                  <span className="block text-xs text-slate-500">
                    {ACTIVITY_LABELS[level].detail}
                  </span>
                </ChoiceButton>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <Header title="What's your goal?" detail="This shifts your daily calorie target." />
              {(['lose', 'maintain', 'gain'] as Goal[]).map((option) => (
                <ChoiceButton
                  key={option}
                  selected={goal === option}
                  onClick={() => setGoal(option)}
                  align="left"
                >
                  <span className="block font-semibold">{GOAL_LABELS[option].title}</span>
                  <span className="block text-xs text-slate-500">{GOAL_LABELS[option].detail}</span>
                </ChoiceButton>
              ))}
            </div>
          )}

          {step === 4 && targets && (
            <div className="space-y-5">
              <Header
                title="Here are your targets"
                detail="Calculated with the Mifflin-St Jeor equation. Adjustable later in Settings."
              />

              <div className="rounded-2xl bg-brand-50 p-5 text-center">
                <p className="text-xs font-medium tracking-wide text-brand-700 uppercase">
                  Daily calories
                </p>
                <p className="text-4xl font-bold text-brand-800">{targets.calorie_target}</p>
                <p className="mt-1 text-xs text-brand-700">
                  BMR {targets.bmr} · maintenance {targets.tdee} kcal
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MacroPreview label="Protein" grams={targets.protein_target} color="protein" />
                <MacroPreview label="Carbs" grams={targets.carbs_target} color="carbs" />
                <MacroPreview label="Fat" grams={targets.fat_target} color="fat" />
              </div>

              <Alert tone="error">{error}</Alert>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="btn-secondary flex-1"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!stepValid}
                onClick={() => setStep((s) => s + 1)}
                className="btn-primary flex-1"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || !targets}
                onClick={handleFinish}
                className="btn-primary flex-1"
              >
                {saving ? 'Saving…' : "Let's go"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Header({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  )
}

function ChoiceButton({
  selected,
  onClick,
  children,
  align = 'center',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xl border-2 px-4 py-3 text-sm transition-colors ${
        align === 'left' ? 'text-left' : 'text-center font-semibold'
      } ${
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-900'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function MacroPreview({
  label,
  grams,
  color,
}: {
  label: string
  grams: number
  color: 'protein' | 'carbs' | 'fat'
}) {
  const bg = {
    protein: 'bg-macro-protein/10 text-macro-protein',
    carbs: 'bg-macro-carbs/10 text-macro-carbs',
    fat: 'bg-macro-fat/10 text-macro-fat',
  }[color]

  return (
    <div className={`rounded-xl p-3 text-center ${bg}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-lg font-bold">{grams}g</p>
    </div>
  )
}
