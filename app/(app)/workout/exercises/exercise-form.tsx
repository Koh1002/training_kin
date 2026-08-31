'use client'

import { useActionState, useState } from 'react'
import { MUSCLES } from '@/lib/muscles'
import { createExercise, type ActionState } from './actions'

const CATEGORIES = [
  ['chest', '胸'],
  ['back', '背中'],
  ['shoulder', '肩'],
  ['arm', '腕'],
  ['leg', '脚'],
  ['core', '体幹'],
  ['cardio', '有酸素'],
] as const

const LOAD_TYPES = [
  ['weight', '重量（kg × 回数 × セット）'],
  ['bodyweight', '自重（体重 × 係数）'],
  ['time', '時間（保持秒数）'],
  ['cardio', '有酸素（分・速度・傾斜）'],
] as const

const initialState: ActionState = { ok: false }

/** 自分だけの種目を足すフォーム。既定の39種目に無いマシンを使うとき用。 */
export function ExerciseForm() {
  const [state, action, pending] = useActionState(createExercise, initialState)
  const [loadType, setLoadType] = useState<string>('weight')

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-muted">種目名</span>
        <input name="nameJa" required maxLength={40} className="field" placeholder="例: ケーブルクロスオーバー" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">分類</span>
          <select name="category" className="field" defaultValue="chest">
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted">記録の種類</span>
          <select
            name="loadType"
            className="field"
            value={loadType}
            onChange={(e) => setLoadType(e.target.value)}
          >
            {LOAD_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadType === 'bodyweight' ? (
        <label className="block">
          <span className="mb-1 block text-xs text-muted">
            体重係数（腕立て 0.65 / 懸垂 1.0 が目安）
          </span>
          <input
            name="bodyweightFactor"
            type="number"
            step="0.05"
            min="0.05"
            max="2"
            defaultValue="0.65"
            className="field"
          />
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isUnilateral" className="size-4" />
        左右別に行う（負荷を2倍で計算する）
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs text-muted">
          効く部位（最初に選んだものが主働筋になります）
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLES.map((m) => (
            <label
              key={m.code}
              className="cursor-pointer rounded-lg border border-border px-2 py-1 text-[13px] has-checked:border-workout has-checked:bg-workout has-checked:text-white"
            >
              <input type="checkbox" name="muscles" value={m.code} className="sr-only" />
              {m.nameJa}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-workout px-4 py-2.5 font-semibold text-white disabled:opacity-50"
      >
        {pending ? '追加中…' : '種目を追加'}
      </button>

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
