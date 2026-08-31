import { createClient } from '@/lib/supabase/server'
import { shiftDate, type DateString } from '@/lib/date'
import type { MuscleCode } from '@/lib/muscles'
import type { MuscleVolumeByDate } from '@/lib/workout/soreness'
import type {
  DailyMuscleVolume,
  DailyWorkoutSummary,
  ExerciseWithMuscles,
  Profile,
  SetLoadRow,
  WorkoutSession,
} from '@/types/database'

/**
 * 筋トレ画面が必要とする読み取り。
 * 集計はすべて DB のビュー側で済ませ、ここでは形を整えるだけにしている。
 */

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return (data as Profile) ?? null
}

/** 種目マスタ（共通 + 自分の追加分）を筋群の寄与度つきで取得する。 */
export async function getExercises(): Promise<ExerciseWithMuscles[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('exercises')
    .select('*, exercise_muscles(muscle_code, contribution)')
    .eq('is_active', true)
    .order('sort_order')
  return (data as ExerciseWithMuscles[]) ?? []
}

export async function getSession(userId: string, date: DateString): Promise<WorkoutSession | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  return (data as WorkoutSession) ?? null
}

/** その日の全セットを、実効重量と負荷が計算済みの形で取得する。 */
export async function getSetsForDate(userId: string, date: DateString): Promise<SetLoadRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('v_set_load')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('order_index')
  return (data as SetLoadRow[]) ?? []
}

export async function getDailySummaries(
  userId: string,
  from: DateString,
  to: DateString,
): Promise<DailyWorkoutSummary[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('v_daily_workout_summary')
    .select('*')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date')
  return (data as DailyWorkoutSummary[]) ?? []
}

/**
 * 筋肉痛の計算に使う、筋群 × 日付の負荷履歴。
 * 基準値（パーセンタイル）を安定させたいので既定で 90 日ぶん遡る。
 */
export async function getMuscleVolumeHistory(
  userId: string,
  onDate: DateString,
  days = 90,
): Promise<MuscleVolumeByDate> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('v_daily_muscle_volume')
    .select('*')
    .eq('user_id', userId)
    .gte('date', shiftDate(onDate, -days))
    .lte('date', onDate)

  const history: MuscleVolumeByDate = new Map()
  for (const row of (data as DailyMuscleVolume[]) ?? []) {
    const bucket = history.get(row.date) ?? {}
    bucket[row.muscle_code as MuscleCode] = Number(row.volume_kg)
    history.set(row.date, bucket)
  }
  return history
}

/**
 * 種目ごとの「前回の入力値」。入力欄のプリフィルに使う。
 * 直近 180 日を見て、種目ごとに最も新しい 1 件を採用する。
 */
export async function getLastInputs(
  userId: string,
  before: DateString,
): Promise<Map<string, SetLoadRow>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('v_set_load')
    .select('*')
    .eq('user_id', userId)
    .gte('date', shiftDate(before, -180))
    .lte('date', before)
    .order('date', { ascending: false })
    .order('order_index', { ascending: false })

  const last = new Map<string, SetLoadRow>()
  for (const row of (data as SetLoadRow[]) ?? []) {
    if (!last.has(row.exercise_id)) last.set(row.exercise_id, row)
  }
  return last
}

/** 種目別の自己ベスト（最大重量と、1日あたりの最大負荷）。 */
export type ExerciseBest = {
  exerciseId: string
  exerciseName: string
  maxWeightKg: number
  maxDailyVolumeKg: number
  lastDate: DateString
  sessionCount: number
}

export async function getExerciseBests(userId: string): Promise<ExerciseBest[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('v_set_load')
    .select('exercise_id, exercise_name, date, effective_weight_kg, volume_kg')
    .eq('user_id', userId)

  const rows = (data as Pick<
    SetLoadRow,
    'exercise_id' | 'exercise_name' | 'date' | 'effective_weight_kg' | 'volume_kg'
  >[]) ?? []

  const byExercise = new Map<string, ExerciseBest & { dailyVolume: Map<DateString, number> }>()
  for (const row of rows) {
    const entry =
      byExercise.get(row.exercise_id) ??
      {
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name,
        maxWeightKg: 0,
        maxDailyVolumeKg: 0,
        lastDate: row.date,
        sessionCount: 0,
        dailyVolume: new Map<DateString, number>(),
      }

    entry.maxWeightKg = Math.max(entry.maxWeightKg, Number(row.effective_weight_kg))
    entry.dailyVolume.set(row.date, (entry.dailyVolume.get(row.date) ?? 0) + Number(row.volume_kg))
    if (row.date > entry.lastDate) entry.lastDate = row.date
    byExercise.set(row.exercise_id, entry)
  }

  return [...byExercise.values()]
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      exerciseName: entry.exerciseName,
      maxWeightKg: entry.maxWeightKg,
      maxDailyVolumeKg: Math.max(0, ...entry.dailyVolume.values()),
      lastDate: entry.lastDate,
      sessionCount: entry.dailyVolume.size,
    }))
    .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1))
}
