import type { Exercise, ExerciseWithMuscles, LoadType } from '@/types/database'
import type { MuscleCode } from '@/lib/muscles'

/**
 * 負荷（頑張り）の計算。
 *
 * 基本式は  負荷[kg] = 実効重量 × reps × sets × (左右別なら 2)。
 * 実効重量は種目の load_type で決まる:
 *   weight     … 入力した重量そのもの
 *   bodyweight … 体重 × 種目ごとの係数（腕立て 0.65、懸垂 1.0 など）
 *   time       … 保持時間で記録するため重量は 0
 *   cardio     … 総負荷には合算しない（分・速度・傾斜を別指標として扱う）
 *
 * SQL 側の v_set_load ビューと同じ式をクライアントでも使えるようにしたもの。
 * 入力中のプレビュー（保存前に負荷が見える）に必要なので二重に持っている。
 * どちらかを変えたら必ず両方を揃えること。
 */

export type SetInput = {
  weightKg?: number | null
  reps?: number | null
  sets?: number | null
  durationMin?: number | null
  holdSec?: number | null
  speed?: number | null
  inclineDeg?: number | null
  distanceM?: number | null
}

type ExerciseLike = Pick<Exercise, 'load_type' | 'bodyweight_factor' | 'is_unilateral'>

/** 1 レップあたりに身体が受ける重量[kg]。 */
export function effectiveWeightKg(exercise: ExerciseLike, input: SetInput, bodyweightKg: number): number {
  switch (exercise.load_type) {
    case 'weight':
      return input.weightKg ?? 0
    case 'bodyweight':
      return bodyweightKg * (exercise.bodyweight_factor ?? 1)
    default:
      return 0
  }
}

/** 1 行（種目 × 重量 × reps × sets）の負荷[kg]。 */
export function setVolumeKg(exercise: ExerciseLike, input: SetInput, bodyweightKg: number): number {
  if (exercise.load_type === 'cardio') return 0
  const weight = effectiveWeightKg(exercise, input, bodyweightKg)
  const reps = input.reps ?? 0
  const sets = input.sets ?? 0
  const sides = exercise.is_unilateral ? 2 : 1
  return weight * reps * sets * sides
}

/** 種目の load_type ごとに、記録に必要な入力欄を返す。 */
export function requiredFields(loadType: LoadType): Array<keyof SetInput> {
  switch (loadType) {
    case 'weight':
      return ['weightKg', 'reps', 'sets']
    case 'bodyweight':
      return ['reps', 'sets']
    case 'time':
      return ['holdSec', 'sets']
    case 'cardio':
      return ['durationMin']
  }
}

/** '40kg 10回 3セット' のような1行サマリ。履歴表示に使う。 */
export function describeSet(exercise: ExerciseLike & { name_ja?: string }, input: SetInput): string {
  switch (exercise.load_type) {
    case 'weight':
      return `${formatKg(input.weightKg ?? 0)}kg × ${input.reps ?? 0}回 × ${input.sets ?? 0}セット${
        exercise.is_unilateral ? '（左右）' : ''
      }`
    case 'bodyweight':
      return `自重 × ${input.reps ?? 0}回 × ${input.sets ?? 0}セット`
    case 'time':
      return `${input.holdSec ?? 0}秒 × ${input.sets ?? 0}セット`
    case 'cardio': {
      const parts = [`${input.durationMin ?? 0}分`]
      if (input.speed) parts.push(`速度${input.speed}`)
      if (input.inclineDeg) parts.push(`傾斜${input.inclineDeg}°`)
      if (input.distanceM) parts.push(`${input.distanceM}m`)
      return parts.join(' / ')
    }
  }
}

/** 総負荷の表示。1t を超えたらトン表記にして桁を読みやすくする。 */
export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`
  return `${Math.round(kg).toLocaleString('ja-JP')} kg`
}

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * 今日の頑張りゲージ（0〜100）。
 * 直近の日次総負荷の最大値を 100 とした相対値にする。
 * 「調子が上がるほど基準も上がる」ので、自己ベスト更新が満点になる。
 */
export function effortScore(todayVolumeKg: number, recentVolumesKg: number[]): number | null {
  const best = Math.max(0, ...recentVolumesKg)
  if (best <= 0) return null // 比較対象が無い（初回記録）
  return Math.round(Math.min(1, todayVolumeKg / best) * 100)
}

/** 1日分のセット行から、筋群ごとの負荷[kg]を集計する。 */
export function muscleVolumes(
  rows: Array<{ exercise: ExerciseWithMuscles; volumeKg: number }>,
): Partial<Record<MuscleCode, number>> {
  const out: Partial<Record<MuscleCode, number>> = {}
  for (const { exercise, volumeKg } of rows) {
    if (volumeKg <= 0) continue
    for (const em of exercise.exercise_muscles) {
      const code = em.muscle_code as MuscleCode
      out[code] = (out[code] ?? 0) + volumeKg * em.contribution
    }
  }
  return out
}
