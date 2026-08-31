import { describe, expect, it } from 'vitest'
import {
  describeSet,
  effectiveWeightKg,
  effortScore,
  formatVolume,
  muscleVolumes,
  setVolumeKg,
} from '@/lib/workout/volume'
import type { ExerciseWithMuscles } from '@/types/database'

const bench = { load_type: 'weight', bodyweight_factor: null, is_unilateral: false } as const
const torsoRotation = { load_type: 'weight', bodyweight_factor: null, is_unilateral: true } as const
const pushUp = { load_type: 'bodyweight', bodyweight_factor: 0.65, is_unilateral: false } as const
const walking = { load_type: 'cardio', bodyweight_factor: null, is_unilateral: false } as const
const plank = { load_type: 'time', bodyweight_factor: null, is_unilateral: false } as const

describe('setVolumeKg', () => {
  it('過去メモの「ベンチ胸 20k 10r 3s」を 600kg として扱う', () => {
    expect(setVolumeKg(bench, { weightKg: 20, reps: 10, sets: 3 }, 65)).toBe(600)
  })

  it('左右別種目（x2 表記）は負荷を 2 倍にする', () => {
    // 「腹斜筋 36k 10r 3s x2」→ 36 × 10 × 3 × 2
    expect(setVolumeKg(torsoRotation, { weightKg: 36, reps: 10, sets: 3 }, 65)).toBe(2160)
  })

  it('自重種目は体重 × 係数を実効重量にする', () => {
    // 腕立て（係数 0.65）を体重 65kg で 10回 3セット
    expect(effectiveWeightKg(pushUp, {}, 65)).toBeCloseTo(42.25)
    expect(setVolumeKg(pushUp, { reps: 10, sets: 3 }, 65)).toBeCloseTo(1267.5)
  })

  it('体重が変われば自重種目の負荷も変わる', () => {
    expect(setVolumeKg(pushUp, { reps: 10, sets: 3 }, 70)).toBeCloseTo(1365)
  })

  it('有酸素は総負荷に合算しない', () => {
    expect(setVolumeKg(walking, { durationMin: 20, speed: 5, inclineDeg: 10 }, 65)).toBe(0)
  })

  it('時間種目は重量が無いので負荷 0 になる', () => {
    expect(setVolumeKg(plank, { holdSec: 30, sets: 3 }, 65)).toBe(0)
  })

  it('未入力の欄があっても NaN にならない', () => {
    expect(setVolumeKg(bench, { weightKg: 20, reps: null, sets: 3 }, 65)).toBe(0)
    expect(setVolumeKg(bench, {}, 65)).toBe(0)
  })
})

describe('describeSet', () => {
  it('load_type ごとに読める文字列を返す', () => {
    expect(describeSet(bench, { weightKg: 40, reps: 10, sets: 3 })).toBe('40kg × 10回 × 3セット')
    expect(describeSet(torsoRotation, { weightKg: 36, reps: 10, sets: 3 })).toContain('（左右）')
    expect(describeSet(pushUp, { reps: 10, sets: 3 })).toBe('自重 × 10回 × 3セット')
    expect(describeSet(plank, { holdSec: 30, sets: 3 })).toBe('30秒 × 3セット')
    expect(describeSet(walking, { durationMin: 20, speed: 5, inclineDeg: 10 })).toBe(
      '20分 / 速度5 / 傾斜10°',
    )
  })

  it('小数の重量も末尾のゼロを落として表示する', () => {
    expect(describeSet(bench, { weightKg: 8.75, reps: 10, sets: 3 })).toBe('8.75kg × 10回 × 3セット')
    expect(describeSet(bench, { weightKg: 42.5, reps: 8, sets: 4 })).toBe('42.5kg × 8回 × 4セット')
  })
})

describe('formatVolume', () => {
  it('1t 以上はトン表記にする', () => {
    expect(formatVolume(600)).toBe('600 kg')
    expect(formatVolume(12400)).toBe('12.40 t')
  })
})

describe('effortScore', () => {
  it('直近の最大値を 100 とした相対値になる', () => {
    expect(effortScore(5000, [10000, 8000])).toBe(50)
    expect(effortScore(12000, [10000, 8000])).toBe(100) // 自己ベスト更新は満点で頭打ち
  })

  it('比較対象が無ければ null（初回記録）', () => {
    expect(effortScore(600, [])).toBeNull()
    expect(effortScore(600, [0, 0])).toBeNull()
  })
})

describe('muscleVolumes', () => {
  const benchExercise = {
    exercise_muscles: [
      { muscle_code: 'chest_mid', contribution: 1.0 },
      { muscle_code: 'triceps', contribution: 0.4 },
    ],
  } as ExerciseWithMuscles

  const flyExercise = {
    exercise_muscles: [{ muscle_code: 'chest_mid', contribution: 1.0 }],
  } as ExerciseWithMuscles

  it('寄与度を掛けて筋群ごとに合算する', () => {
    const result = muscleVolumes([
      { exercise: benchExercise, volumeKg: 1000 },
      { exercise: flyExercise, volumeKg: 500 },
    ])
    expect(result.chest_mid).toBe(1500)
    expect(result.triceps).toBe(400)
  })

  it('負荷 0 の行（有酸素など）は筋群に寄与しない', () => {
    expect(muscleVolumes([{ exercise: benchExercise, volumeKg: 0 }])).toEqual({})
  })
})
