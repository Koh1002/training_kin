/**
 * Supabase のスキーマに対応する型。
 * `npx supabase gen types typescript --linked > types/database.ts` で再生成できるが、
 * 手元にリンク済みプロジェクトが無くてもビルドできるよう手書きで維持している。
 * スキーマを変更したら supabase/migrations と合わせてここも更新すること。
 */

export type ExerciseCategory =
  | 'chest'
  | 'back'
  | 'shoulder'
  | 'arm'
  | 'leg'
  | 'core'
  | 'cardio'

export type LoadType = 'weight' | 'bodyweight' | 'time' | 'cardio'

export type SkillCode = 'reading' | 'listening' | 'speaking' | 'writing'

export type SessionKind = 'training' | 'rest'

export type Profile = {
  id: string
  display_name: string | null
  bodyweight_kg: number
  soreness_curve: number[]
  created_at: string
  updated_at: string
}

export type Muscle = {
  code: string
  name_ja: string
  region: 'front' | 'back' | 'both'
  sort_order: number
}

export type Exercise = {
  id: string
  user_id: string | null
  name_ja: string
  memo_alias: string | null
  category: ExerciseCategory
  load_type: LoadType
  bodyweight_factor: number | null
  is_unilateral: boolean
  default_weight_kg: number | null
  default_reps: number | null
  default_sets: number | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type ExerciseMuscle = {
  exercise_id: string
  muscle_code: string
  contribution: number
}

/** 種目に筋群の寄与度をぶら下げた、UI で扱いやすい形 */
export type ExerciseWithMuscles = Exercise & {
  exercise_muscles: Pick<ExerciseMuscle, 'muscle_code' | 'contribution'>[]
}

export type WorkoutSession = {
  id: string
  user_id: string
  date: string
  kind: SessionKind
  rest_reason: string | null
  bodyweight_kg: number | null
  note: string | null
  created_at: string
}

export type WorkoutSet = {
  id: string
  session_id: string
  exercise_id: string
  order_index: number
  weight_kg: number | null
  reps: number | null
  sets: number | null
  duration_min: number | null
  hold_sec: number | null
  speed: number | null
  incline_deg: number | null
  distance_m: number | null
  note: string | null
  created_at: string
}

export type EnglishSkill = {
  code: SkillCode
  name_ja: string
  sort_order: number
}

export type EnglishActivity = {
  id: string
  user_id: string | null
  skill_code: SkillCode
  name_ja: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type EnglishLog = {
  id: string
  user_id: string
  date: string
  activity_id: string
  minutes: number
  note: string | null
  created_at: string
}

export type EnglishGoal = {
  user_id: string
  skill_code: SkillCode
  weekly_target_min: number
}

// --- ビュー ------------------------------------------------------------------

export type SetLoadRow = {
  set_id: string
  session_id: string
  user_id: string
  date: string
  exercise_id: string
  exercise_name: string
  category: ExerciseCategory
  load_type: LoadType
  order_index: number
  weight_kg: number | null
  reps: number | null
  sets: number | null
  duration_min: number | null
  hold_sec: number | null
  speed: number | null
  incline_deg: number | null
  distance_m: number | null
  effective_weight_kg: number
  volume_kg: number
}

export type DailyWorkoutSummary = {
  user_id: string
  date: string
  kind: SessionKind
  rest_reason: string | null
  total_volume_kg: number
  set_count: number
  exercise_count: number
  cardio_minutes: number
}

export type DailyMuscleVolume = {
  user_id: string
  date: string
  muscle_code: string
  volume_kg: number
}

export type WeeklyEnglishSummary = {
  user_id: string
  week_start: string
  skill_code: SkillCode
  minutes: number
}
