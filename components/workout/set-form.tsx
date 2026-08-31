'use client'

import { useActionState, useMemo, useState } from 'react'
import { addSet, type ActionState } from '@/app/(app)/workout/actions'
import { muscleName } from '@/lib/muscles'
import { formatVolume, setVolumeKg } from '@/lib/workout/volume'
import type { ExerciseCategory, ExerciseWithMuscles, SetLoadRow } from '@/types/database'

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  chest: '胸',
  back: '背中',
  shoulder: '肩',
  arm: '腕',
  leg: '脚',
  core: '体幹',
  cardio: '有酸素',
}

const CATEGORY_ORDER: ExerciseCategory[] = ['chest', 'back', 'shoulder', 'arm', 'leg', 'core', 'cardio']

type Props = {
  date: string
  exercises: ExerciseWithMuscles[]
  /** 種目ID → 前回の入力値。プリフィルに使う */
  lastInputs: Record<string, Pick<SetLoadRow, 'weight_kg' | 'reps' | 'sets' | 'duration_min' | 'hold_sec' | 'speed' | 'incline_deg' | 'date'>>
  /** 最近使った種目ID（新しい順） */
  recentExerciseIds: string[]
  bodyweightKg: number
}

const initialState: ActionState = { ok: false }

/**
 * 筋トレの記録入力。
 * 「種目を選ぶ → 重量・回数・セットを入れる」の 2 ステップで終わるようにし、
 * 前回の値をあらかじめ入れておくことで、多くの日は数字を触らず追加できる。
 */
export function SetForm({ date, exercises, lastInputs, recentExerciseIds, bodyweightKg }: Props) {
  const [state, formAction, pending] = useActionState(addSet, initialState)
  const [category, setCategory] = useState<ExerciseCategory | 'recent'>('recent')
  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('')
  const [duration, setDuration] = useState('')
  const [hold, setHold] = useState('')
  const [speed, setSpeed] = useState('')
  const [incline, setIncline] = useState('')

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const exercise = exerciseId ? byId.get(exerciseId) : undefined

  // 追加が成功したら種目の選択だけ解除し、次の種目をすぐ選べるようにする。
  // useActionState は結果ごとに新しいオブジェクトを返すので、
  // 「まだ処理していない結果か」を参照の比較で判定できる。
  const [handledState, setHandledState] = useState(state)
  if (state !== handledState) {
    setHandledState(state)
    if (state.ok) setExerciseId(null)
  }

  /**
   * 種目を選んだ時点で、前回値（無ければマスタの既定値）を入力欄に流し込む。
   * effect ではなくハンドラでやることで、選択と入力欄が 1 回の描画で揃う。
   */
  function selectExercise(next: ExerciseWithMuscles | null) {
    if (!next || next.id === exerciseId) {
      setExerciseId(null)
      return
    }

    setExerciseId(next.id)

    const last = lastInputs[next.id]
    const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

    setWeight(num(last?.weight_kg ?? next.default_weight_kg))
    setReps(num(last?.reps ?? next.default_reps))
    setSets(num(last?.sets ?? next.default_sets))
    setDuration(num(last?.duration_min) || (next.load_type === 'cardio' ? '20' : ''))
    setHold(num(last?.hold_sec))
    setSpeed(num(last?.speed))
    setIncline(num(last?.incline_deg))
  }

  const recent = useMemo(
    () => recentExerciseIds.map((id) => byId.get(id)).filter((e): e is ExerciseWithMuscles => Boolean(e)),
    [recentExerciseIds, byId],
  )

  const visible = useMemo(() => {
    if (category === 'recent') return recent.length > 0 ? recent : exercises.slice(0, 12)
    return exercises.filter((e) => e.category === category)
  }, [category, recent, exercises])

  const preview = exercise
    ? setVolumeKg(
        exercise,
        {
          weightKg: weight === '' ? null : Number(weight),
          reps: reps === '' ? null : Number(reps),
          sets: sets === '' ? null : Number(sets),
        },
        bodyweightKg,
      )
    : 0

  const lastDate = exercise ? lastInputs[exercise.id]?.date : undefined

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="exerciseId" value={exerciseId ?? ''} />

      {/* カテゴリ */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['recent', ...CATEGORY_ORDER] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
              category === c
                ? 'border-workout bg-workout/10 font-medium text-workout'
                : 'border-border text-muted'
            }`}
          >
            {c === 'recent' ? '最近' : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* 種目 */}
      <div className="flex flex-wrap gap-1.5">
        {visible.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => selectExercise(e)}
            aria-pressed={e.id === exerciseId}
            className={`rounded-lg border px-2.5 py-1.5 text-[13px] transition ${
              e.id === exerciseId
                ? 'border-workout bg-workout font-medium text-white'
                : 'border-border bg-surface'
            }`}
          >
            {e.name_ja}
          </button>
        ))}
        {visible.length === 0 ? (
          <p className="text-sm text-muted">この分類の種目がありません。</p>
        ) : null}
      </div>

      {exercise ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface-muted p-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="text-[15px]">{exercise.name_ja}</strong>
            <span className="text-xs text-muted">
              {exercise.exercise_muscles
                .slice()
                .sort((a, b) => b.contribution - a.contribution)
                .slice(0, 3)
                .map((m) => muscleName(m.muscle_code))
                .join('・')}
            </span>
            {exercise.is_unilateral ? (
              <span className="rounded bg-workout/15 px-1.5 py-0.5 text-[11px] text-workout">左右別</span>
            ) : null}
          </div>

          {lastDate ? (
            <p className="text-xs text-muted">前回（{lastDate}）の値を入れています</p>
          ) : null}

          {exercise.load_type === 'weight' ? (
            <NumberField label="重量" unit="kg" value={weight} onChange={setWeight} name="weightKg" step={2.5} />
          ) : null}

          {exercise.load_type === 'bodyweight' ? (
            <p className="rounded-lg bg-surface px-3 py-2 text-sm">
              自重 {bodyweightKg}kg × 係数 {exercise.bodyweight_factor} ={' '}
              <strong className="tabular">
                {(bodyweightKg * (exercise.bodyweight_factor ?? 1)).toFixed(1)} kg
              </strong>
            </p>
          ) : null}

          {(exercise.load_type === 'weight' || exercise.load_type === 'bodyweight') && (
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="回数" unit="回" value={reps} onChange={setReps} name="reps" step={1} />
              <NumberField label="セット" unit="s" value={sets} onChange={setSets} name="sets" step={1} />
            </div>
          )}

          {exercise.load_type === 'time' ? (
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="保持時間" unit="秒" value={hold} onChange={setHold} name="holdSec" step={10} />
              <NumberField label="セット" unit="s" value={sets} onChange={setSets} name="sets" step={1} />
            </div>
          ) : null}

          {exercise.load_type === 'cardio' ? (
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="時間" unit="分" value={duration} onChange={setDuration} name="durationMin" compact />
              <NumberField label="速度" unit="" value={speed} onChange={setSpeed} name="speed" compact />
              <NumberField label="傾斜" unit="°" value={incline} onChange={setIncline} name="inclineDeg" compact />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {exercise.load_type === 'cardio' ? (
                '有酸素は総負荷に含めず、分数で記録します'
              ) : (
                <>
                  この種目の負荷 <strong className="tabular text-foreground">{formatVolume(preview)}</strong>
                </>
              )}
            </p>
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 whitespace-nowrap rounded-xl bg-workout px-5 py-2.5 font-semibold text-white transition disabled:opacity-50"
            >
              {pending ? '追加中…' : '追加'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">種目を選ぶと入力欄が出ます。</p>
      )}

      {state.message ? (
        <p
          role="status"
          className={`text-sm ${state.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

/**
 * 数値入力。既定では片手（親指だけ）で完結するよう、キーボードを出さずに
 * 増減できるステッパーを左右に置く。
 *
 * 3 列に並べる有酸素の欄ではステッパーを出すと数値の表示幅が潰れてしまうので、
 * `compact` を指定すると素の入力欄になる。
 */
function NumberField({
  label,
  unit,
  value,
  onChange,
  name,
  step,
  compact = false,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  name: string
  step?: number
  compact?: boolean
}) {
  const bump = (delta: number) => {
    const next = Math.max(0, Math.round(((Number(value) || 0) + delta) * 100) / 100)
    onChange(String(next))
  }

  const input = (
    <input
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      aria-label={label}
      className={
        compact
          ? 'field tabular text-center'
          : 'tabular w-full min-w-0 border-x border-border bg-transparent px-1 py-2 text-center text-base'
      }
    />
  )

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">
        {label}
        {unit ? `（${unit}）` : ''}
      </span>
      {compact || step === undefined ? (
        input
      ) : (
        <span className="flex items-stretch overflow-hidden rounded-lg border border-border bg-surface">
          <button
            type="button"
            onClick={() => bump(-step)}
            aria-label={`${label}を${step}減らす`}
            className="w-10 shrink-0 text-lg text-muted"
          >
            −
          </button>
          {input}
          <button
            type="button"
            onClick={() => bump(step)}
            aria-label={`${label}を${step}増やす`}
            className="w-10 shrink-0 text-lg text-muted"
          >
            ＋
          </button>
        </span>
      )}
    </label>
  )
}
