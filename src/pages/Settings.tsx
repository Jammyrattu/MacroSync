import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { uploadImage } from '@/lib/storage'
import {
  ACTIVITY_LABELS,
  ACTIVITY_MULTIPLIERS,
  GOAL_LABELS,
  calculateTargets,
} from '@/lib/nutrition'
import type { ActivityLevel, Goal, Sex } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { Alert } from '@/components/ui/Alert'
import { LogoutIcon } from '@/components/ui/icons'
import { HealthSyncCard } from '@/components/health/HealthSyncCard'
import { NotificationPreferences } from '@/components/settings/NotificationPreferences'
import { ThemePicker } from '@/components/settings/ThemePicker'
import { DeleteAccount } from '@/components/settings/DeleteAccount'

/**
 * Profile, body stats and macro targets.
 *
 * Targets are editable by hand; "Recalculate from profile" runs the same
 * calculateTargets() used at onboarding, so the two can never disagree.
 */
export function Settings() {
  const { user, profile, nutritionProfile, role, isAdmin, refreshProfile, signOut } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('moderate')
  const [goal, setGoal] = useState<Goal>('maintain')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [stepGoal, setStepGoal] = useState('')
  const [activeCalorieGoal, setActiveCalorieGoal] = useState('')
  const [sleepGoalHours, setSleepGoalHours] = useState('')

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Seed the form from context once it's loaded.
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setBio(profile.bio ?? '')
    }
    if (nutritionProfile) {
      setAge(nutritionProfile.age ? String(nutritionProfile.age) : '')
      setSex(nutritionProfile.sex ?? 'male')
      setHeightCm(nutritionProfile.height_cm ? String(nutritionProfile.height_cm) : '')
      setWeightKg(nutritionProfile.weight_kg ? String(nutritionProfile.weight_kg) : '')
      setActivity(nutritionProfile.activity_level ?? 'moderate')
      setGoal(nutritionProfile.goal ?? 'maintain')
      setCalories(nutritionProfile.calorie_target ? String(nutritionProfile.calorie_target) : '')
      setProtein(nutritionProfile.protein_target ? String(nutritionProfile.protein_target) : '')
      setCarbs(nutritionProfile.carbs_target ? String(nutritionProfile.carbs_target) : '')
      setFat(nutritionProfile.fat_target ? String(nutritionProfile.fat_target) : '')
      setStepGoal(nutritionProfile.step_goal ? String(nutritionProfile.step_goal) : '')
      setActiveCalorieGoal(
        nutritionProfile.active_calorie_goal ? String(nutritionProfile.active_calorie_goal) : '',
      )
      // Stored in minutes, entered in hours — nobody thinks "450 minutes".
      setSleepGoalHours(
        nutritionProfile.sleep_goal_minutes
          ? String(Math.round((nutritionProfile.sleep_goal_minutes / 60) * 10) / 10)
          : '',
      )
    }
  }, [profile, nutritionProfile])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4000)
  }

  function handleRecalculate() {
    if (!age || !heightCm || !weightKg) {
      setError('Fill in age, height and weight first.')
      return
    }

    const targets = calculateTargets({
      age: Number(age),
      sex,
      height_cm: Number(heightCm),
      weight_kg: Number(weightKg),
      activity_level: activity,
      goal,
    })

    setCalories(String(targets.calorie_target))
    setProtein(String(targets.protein_target))
    setCarbs(String(targets.carbs_target))
    setFat(String(targets.fat_target))
    setError('')
    flash(`Recalculated: ${targets.calorie_target} kcal (maintenance ${targets.tdee}).`)
  }

  async function handleAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    setError('')

    try {
      const url = await uploadImage('avatars', user.id, file)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id)
      if (updateError) throw new Error(updateError.message)

      await refreshProfile()
      flash('Avatar updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!user) return

    setSaving(true)
    setError('')

    const [profileRes, nutritionRes] = await Promise.all([
      supabase
        .from('profiles')
        .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
        .eq('id', user.id),
      supabase
        .from('nutrition_profiles')
        .update({
          age: age ? Number(age) : null,
          sex,
          height_cm: heightCm ? Number(heightCm) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
          activity_level: activity,
          goal,
          calorie_target: calories ? Number(calories) : null,
          protein_target: protein ? Number(protein) : null,
          carbs_target: carbs ? Number(carbs) : null,
          fat_target: fat ? Number(fat) : null,
          // Blank clears the goal, which the tiles show as "not set" — that's a
          // real state, not a zero.
          step_goal: stepGoal ? Number(stepGoal) : null,
          active_calorie_goal: activeCalorieGoal ? Number(activeCalorieGoal) : null,
          sleep_goal_minutes: sleepGoalHours ? Math.round(Number(sleepGoalHours) * 60) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id),
    ])

    setSaving(false)

    const failure = profileRes.error ?? nutritionRes.error
    if (failure) {
      setError(failure.message)
      return
    }

    await refreshProfile()
    flash('Settings saved.')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Settings</h1>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Alert tone="error">{error}</Alert>

      {/* Profile */}
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Profile</h2>

        <div className="mt-4 flex items-center gap-4">
          <Avatar url={profile?.avatar_url} name={displayName || user?.email} size={64} />
          <label className="btn-secondary cursor-pointer">
            {uploading ? 'Uploading…' : 'Change avatar'}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatar}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="display-name">
              Display name
            </label>
            <input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="A line about you"
            />
          </div>

          <p className="text-xs text-slate-500">Signed in as {user?.email}</p>

          {user ? (
            <Link to={`/u/${user.id}`} className="btn-secondary w-full">
              View your public profile
            </Link>
          ) : null}

          {isAdmin ? (
            <Link to="/admin" className="btn-secondary w-full">
              Admin console
            </Link>
          ) : null}
          {role === 'moderator' ? (
            <p className="text-xs text-slate-500">
              You are a moderator — you can remove any community post or comment.
            </p>
          ) : null}
        </div>
      </section>

      {/* Appearance. Applies on click and saves itself, so it sits above the
          form rather than inside it — it isn't waiting on "Save changes". */}
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Appearance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Applies straight away and follows your account to any device you sign in on.
        </p>
        <div className="mt-4">
          <ThemePicker />
        </div>
      </section>

      {/* Body stats */}
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Body & goal</h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="set-age">
              Age
            </label>
            <input
              id="set-age"
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="set-sex">
              Sex
            </label>
            <select
              id="set-sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
              className="input"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="set-height">
              Height (cm)
            </label>
            <input
              id="set-height"
              type="number"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="set-weight">
              Weight (kg)
            </label>
            <input
              id="set-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="set-activity">
            Activity level
          </label>
          <select
            id="set-activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityLevel)}
            className="input"
          >
            {(Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[]).map((level) => (
              <option key={level} value={level}>
                {ACTIVITY_LABELS[level].title} — {ACTIVITY_LABELS[level].detail}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="set-goal">
            Goal
          </label>
          <select
            id="set-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value as Goal)}
            className="input"
          >
            {(['lose', 'maintain', 'gain'] as Goal[]).map((option) => (
              <option key={option} value={option}>
                {GOAL_LABELS[option].title} — {GOAL_LABELS[option].detail}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Activity goals */}
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Daily activity goals</h2>
        <p className="mt-1 text-sm text-slate-500">
          Optional. Set one and the Progress tiles show your progress against it instead of the
          trend. Leave blank for no goal.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="set-step-goal">
              Steps
            </label>
            <input
              id="set-step-goal"
              type="number"
              inputMode="numeric"
              min={1}
              value={stepGoal}
              onChange={(e) => setStepGoal(e.target.value)}
              className="input"
              placeholder="10000"
            />
          </div>

          <div>
            <label className="label" htmlFor="set-active-goal">
              Active kcal
            </label>
            <input
              id="set-active-goal"
              type="number"
              inputMode="numeric"
              min={1}
              value={activeCalorieGoal}
              onChange={(e) => setActiveCalorieGoal(e.target.value)}
              className="input"
              placeholder="500"
            />
          </div>

          <div>
            <label className="label" htmlFor="set-sleep-goal">
              Sleep (hours)
            </label>
            <input
              id="set-sleep-goal"
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0.5}
              max={24}
              value={sleepGoalHours}
              onChange={(e) => setSleepGoalHours(e.target.value)}
              className="input"
              placeholder="8"
            />
          </div>
        </div>
      </section>

      <NotificationPreferences />

      {/* Google Health */}
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Google Health</h2>
        <div className="mt-3">
          <HealthSyncCard returnTo="/settings" />
        </div>
      </section>

      {/* Targets */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Daily targets</h2>
          <button type="button" onClick={handleRecalculate} className="btn-secondary !py-1.5 !px-3">
            Recalculate from profile
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="set-calories">
              Calories
            </label>
            <input
              id="set-calories"
              type="number"
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="set-protein">
              Protein (g)
            </label>
            <input
              id="set-protein"
              type="number"
              inputMode="numeric"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="set-carbs">
              Carbs (g)
            </label>
            <input
              id="set-carbs"
              type="number"
              inputMode="numeric"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="set-fat">
              Fat (g)
            </label>
            <input
              id="set-fat"
              type="number"
              inputMode="numeric"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </section>

      <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      <button type="button" onClick={() => void signOut()} className="btn-secondary w-full">
        <LogoutIcon className="size-4" />
        Log out
      </button>

      <DeleteAccount />

      <p className="pb-2 text-center text-xs text-slate-400">
        <a href="/privacy" className="hover:text-slate-600 hover:underline">
          Privacy Policy
        </a>
        <span aria-hidden="true"> · </span>
        <a href="/terms" className="hover:text-slate-600 hover:underline">
          Terms of Service
        </a>
      </p>
    </div>
  )
}
