import { Moon, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import { Card, CardTitle, EmptyState } from '@/components/ui/card'
import { DateNav } from '@/components/date-nav'
import { SubNav } from '@/components/sub-nav'
import { BodyMapPanel } from '@/components/workout/body-map-panel'
import { EffortGauge } from '@/components/workout/effort-gauge'
import type { MuscleBreakdown } from '@/components/body-map/body-map'
import { shiftDate, todayJst } from '@/lib/date'
import { muscleName, type MuscleCode } from '@/lib/muscles'
import { getCurrentUser } from '@/lib/supabase/server'
import { normalizeVolumes } from '@/lib/workout/color-scale'
import {
  getDailySummaries,
  getExercises,
  getMuscleVolumeHistory,
  getProfile,
  getSession,
  getSetsForDate,
} from '@/lib/workout/queries'
import {
  buildReferences,
  buildSorenessMap,
  sorenessContributions,
  sortedSoreness,
} from '@/lib/workout/soreness'
import { describeSet, effortScore, formatVolume } from '@/lib/workout/volume'
import { WORKOUT_NAV } from './nav'
import { clearRestDay, deleteSet, markRestDay } from './actions'

export default async function WorkoutPage(props: PageProps<'/workout'>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const params = await props.searchParams
  const raw = typeof params.date === 'string' ? params.date : ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayJst()

  const [profile, exercises, session, sets, history, summaries] = await Promise.all([
    getProfile(user.id),
    getExercises(),
    getSession(user.id, date),
    getSetsForDate(user.id, date),
    getMuscleVolumeHistory(user.id, date),
    getDailySummaries(user.id, shiftDate(date, -30), date),
  ])

  const bodyweightKg = session?.bodyweight_kg ?? profile?.bodyweight_kg ?? 65
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))

  // --- その日の集計 ---------------------------------------------------------
  const totalVolumeKg = sets.reduce((sum, s) => sum + Number(s.volume_kg), 0)
  const cardioMinutes = sets
    .filter((s) => s.load_type === 'cardio')
    .reduce((sum, s) => sum + Number(s.duration_min ?? 0), 0)

  const recentVolumes = summaries.filter((s) => s.date !== date).map((s) => Number(s.total_volume_kg))
  const score = effortScore(totalVolumeKg, recentVolumes)

  // --- 人体図の入力 ---------------------------------------------------------
  // 「今日の刺激」はその日の筋群別負荷を、その日の最大値で正規化したもの
  const todayMuscleVolumes = history.get(date) ?? {}
  const stimulus = normalizeVolumes(todayMuscleVolumes)

  // 「筋肉痛」は当日を含む直近3日ぶんを減衰カーブで重ねたもの。
  // 強度と内訳は同じ引数で作る。別々に組み立てると、片方だけ設定が古くなって
  // 画面の色と内訳の合計が食い違う。
  const sorenessOptions = {
    curve: profile?.soreness_curve,
    references: buildReferences(history),
  }
  const soreness = buildSorenessMap(date, history, sorenessOptions)
  const sorenessDetail = sorenessContributions(date, history, sorenessOptions)

  // 部位タップ時に出す内訳（どの種目がその部位を叩いたか）
  const breakdown: Partial<Record<MuscleCode, MuscleBreakdown>> = {}
  for (const set of sets) {
    const exercise = exerciseById.get(set.exercise_id)
    const volume = Number(set.volume_kg)
    if (!exercise || volume <= 0) continue

    for (const em of exercise.exercise_muscles) {
      const code = em.muscle_code as MuscleCode
      const entry = (breakdown[code] ??= { exercises: [], volumeKg: 0 })
      const contribution = volume * em.contribution
      const existing = entry.exercises.find((e) => e.name === exercise.name_ja)
      if (existing) existing.volumeKg += contribution
      else entry.exercises.push({ name: exercise.name_ja, volumeKg: contribution })
      entry.volumeKg += contribution
    }
  }
  for (const entry of Object.values(breakdown)) {
    entry.exercises.sort((a, b) => b.volumeKg - a.volumeKg)
  }

  const sore = sortedSoreness(soreness).slice(0, 3)
  const isRest = session?.kind === 'rest'

  return (
    <>
      <SubNav items={WORKOUT_NAV} />
      <DateNav date={date} basePath="/workout" />

      <div className="space-y-4">
        {sore.length > 0 ? (
          <p className="rounded-app-lg border border-border bg-surface px-3 py-2 text-sm">
            <span className="text-muted">いま筋肉痛が残っている部位: </span>
            {sore.map((s) => `${muscleName(s.code)}（${Math.round(s.value * 100)}%）`).join('、')}
          </p>
        ) : null}

        <Card>
          <CardTitle>今日の頑張り</CardTitle>
          <EffortGauge
            volumeKg={totalVolumeKg}
            score={score}
            setCount={new Set(sets.map((s) => s.exercise_id)).size}
            cardioMinutes={cardioMinutes}
          />
        </Card>

        <Card>
          <CardTitle
            right={
              <span className="text-xs text-muted">体重 {bodyweightKg}kg で換算</span>
            }
          >
            効いている部位
          </CardTitle>
          <BodyMapPanel
            stimulus={stimulus}
            soreness={soreness}
            breakdown={breakdown}
            sorenessDetail={sorenessDetail}
          />
        </Card>

        <Card>
          <CardTitle right={<span className="tabular text-sm">{formatVolume(totalVolumeKg)}</span>}>
            記録（{sets.length}件）
          </CardTitle>

          {isRest ? (
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-2 rounded-app bg-surface-muted px-4 py-6 text-sm">
                <Moon size={16} className="text-muted" aria-hidden />
                休養日（{session?.rest_reason}）
              </p>
              <form action={clearRestDay}>
                <input type="hidden" name="date" value={date} />
                <button type="submit" className="text-xs text-muted underline">
                  休養日を取り消す
                </button>
              </form>
            </div>
          ) : sets.length === 0 ? (
            <div>
              <EmptyState>まだ記録がありません。下から種目を追加してください。</EmptyState>
              {/*
                休養日の登録。見出しを付けずに空の状態のすぐ下に置いていたときは、
                入力欄が何のためのものか分からなかった。区切り線と小見出しで、
                記録一覧とは別の操作であることを示す。
              */}
              <div className="mt-1 border-t border-border pt-3">
                <p className="mb-2 text-xs text-muted">意図的に休んだ日として残す</p>
                <form action={markRestDay} className="flex items-center gap-2">
                  <input type="hidden" name="date" value={date} />
                  <input
                    name="reason"
                    placeholder="理由（任意）"
                    className="field flex-1 py-2 text-sm"
                    maxLength={100}
                  />
                  <Button type="submit" variant="secondary" size="md" className="shrink-0 text-muted">
                    <Moon size={15} aria-hidden />
                    休養日
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sets.map((set) => {
                const exercise = exerciseById.get(set.exercise_id)
                return (
                  <li key={set.set_id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{set.exercise_name}</p>
                      <p className="text-[13px] text-muted">
                        {exercise
                          ? describeSet(exercise, {
                              weightKg: set.weight_kg,
                              reps: set.reps,
                              sets: set.sets,
                              durationMin: set.duration_min,
                              holdSec: set.hold_sec,
                              speed: set.speed,
                              inclineDeg: set.incline_deg,
                              distanceM: set.distance_m,
                            })
                          : null}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-sm text-muted">
                      {Number(set.volume_kg) > 0 ? formatVolume(Number(set.volume_kg)) : '—'}
                    </span>
                    <form action={deleteSet}>
                      <input type="hidden" name="setId" value={set.set_id} />
                      <IconButton type="submit" size="sm" aria-label={`${set.exercise_name}の記録を削除`}>
                        <X size={15} aria-hidden />
                      </IconButton>
                    </form>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
