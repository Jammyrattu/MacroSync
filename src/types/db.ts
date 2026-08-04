/**
 * Hand-written types mirroring supabase/migrations/0001_init.sql.
 *
 * These are the single source of truth for the shape of every row in the app.
 * If you change a column in the migration, change it here too — nothing
 * regenerates this automatically.
 */

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
export type Goal = 'lose' | 'maintain' | 'gain'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks'
export type Visibility = 'private' | 'public'
export type PostCategory =
  | 'recipe'
  | 'food_idea'
  | 'tip'
  | 'progress'
  | 'question'
  | 'motivation'

export interface Profile {
  id: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export interface NutritionProfile {
  id: string
  user_id: string
  age: number | null
  sex: Sex | null
  height_cm: number | null
  weight_kg: number | null
  activity_level: ActivityLevel | null
  goal: Goal | null
  calorie_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  /** Daily activity goals. null means "not set", which the tiles display. */
  step_goal: number | null
  active_calorie_goal: number | null
  sleep_goal_minutes: number | null
  onboarded: boolean
  created_at: string
  updated_at: string
}

/**
 * Macros are stored PER 100 GRAMS, exactly as Open Food Facts returns them,
 * alongside the serving the user picked. Storing the source values rather than
 * pre-multiplied totals is what lets "edit serving" recompute losslessly.
 */
export interface FoodNutrients {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface FoodSnapshot extends FoodNutrients {
  food_name: string
  brand: string | null
  barcode: string | null
  image_url: string | null
  serving_size: string | null
}

export interface FoodLog extends FoodSnapshot {
  id: string
  user_id: string
  log_date: string
  meal: Meal
  serving_grams: number
  quantity: number
  created_at: string
}

export interface FavoriteFood extends FoodSnapshot {
  id: string
  user_id: string
  created_at: string
}

export interface WeightLog {
  id: string
  user_id: string
  weight_kg: number
  log_date: string
  created_at: string
}

/** One entry in the `workouts.exercises` jsonb array. */
export interface RoutineExercise {
  exercise_id: string
  name: string
  muscle_group: string
  sets: number
  reps: number
  rest_seconds: number
}

export interface Workout {
  id: string
  user_id: string
  name: string
  description: string | null
  exercises: RoutineExercise[]
  visibility: Visibility
  created_at: string
  updated_at: string
}

/** One ticked-off set inside `workout_logs.completed_sets`. */
export interface CompletedSet {
  exercise_id: string
  name: string
  set_number: number
  reps: number
  weight_kg: number
}

export interface WorkoutLog {
  id: string
  user_id: string
  workout_id: string | null
  workout_name: string
  duration_seconds: number
  completed_sets: CompletedSet[]
  total_volume: number
  /** MET estimate; null where body weight was unknown at the time. */
  calories_burned: number | null
  /** Seconds that counted — excludes idle rest and the session cap. */
  active_seconds: number | null
  met_used: number | null
  performed_at: string
}

export interface CommunityPost {
  id: string
  user_id: string
  title: string
  content: string
  category: PostCategory
  image_url: string | null
  created_at: string
}

export interface PostReaction {
  id: string
  post_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  /** Optional GIF, hot-linked from the provider rather than stored in a bucket. */
  image_url: string | null
  created_at: string
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

/**
 * Roles are stored in their own table, not as a profiles column: "profiles
 * updatable by owner" is a row-level policy, so a column there would let any
 * user promote themselves. No row means an ordinary user.
 */
export type UserRole = 'moderator' | 'admin'

export interface UserRoleRow {
  user_id: string
  role: UserRole
  granted_by: string | null
  created_at: string
}

/**
 * Google Health connection status.
 *
 * Deliberately carries no tokens: those live in health_tokens, which has RLS
 * enabled and no policies, so the client cannot read them at all.
 */
export interface HealthConnection {
  user_id: string
  provider: 'google_health'
  scopes: string[]
  connected_at: string
  last_synced_at: string | null
  last_sync_error: string | null
}

export type HealthMetricName =
  | 'steps'
  | 'active_calories'
  | 'distance_m'
  | 'sleep_minutes'
  | 'exercise_minutes'

export interface HealthMetric {
  id: string
  user_id: string
  metric_date: string
  metric: HealthMetricName
  value: number
  source: string
  updated_at: string
}

/**
 * Challenges — invite other members to compete on a shared goal.
 * No money is involved anywhere: there is no buy-in, stake or payout.
 */
export type ChallengeMetric =
  | 'daily_checkin'
  | 'total_workouts'
  | 'steps'
  | 'macro_adherence'
  | 'custom'

export type ChallengeVerification = 'honor' | 'photo'
export type ParticipantStatus = 'pending' | 'accepted' | 'declined'
export type ChallengeVisibility = 'private' | 'public'

export interface Challenge {
  id: string
  owner_id: string
  name: string
  description: string
  metric: ChallengeMetric
  /** Daily bar for metrics that need one (e.g. steps); null otherwise. */
  goal_target: number | null
  verification: ChallengeVerification
  starts_on: string
  ends_on: string
  /** Days a week a participant is expected to check in (2–7). */
  min_checkins_per_week: number
  /** Public challenges are listed in Community; invites stay private either way. */
  visibility: ChallengeVisibility
  logo_url: string | null
  created_at: string
}

export interface ChallengeParticipant {
  id: string
  challenge_id: string
  user_id: string
  status: ParticipantStatus
  /** Denormalised leaderboard figure; meaning depends on the challenge metric. */
  score: number
  invited_by: string | null
  responded_at: string | null
  scored_at: string | null
  created_at: string
}

export interface ChallengeCheckin {
  id: string
  challenge_id: string
  user_id: string
  on_date: string
  value: number
  note: string
  /** Required when the challenge's verification is 'photo' — enforced by a trigger. */
  photo_url: string | null
  created_at: string
}

export interface ChallengeCheckinComment {
  id: string
  checkin_id: string
  challenge_id: string
  user_id: string
  content: string
  /** Optional GIF, hot-linked from the provider. */
  image_url: string | null
  created_at: string
}

/** An exercise as stored in the database — admins can edit these. */
export interface ExerciseRow {
  id: string
  name: string
  muscle_group: string
  equipment: string
  demo: string | null
  steps: string[]
  sort_order: number
  created_at: string
  updated_at: string
}

/** Author fields embedded via the FK to profiles — see the migration's FK note. */
export type WithAuthor<T> = T & {
  profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}
