'use client'

import { useActionState } from 'react'
import { SKILL_CODES, SKILL_LABELS, SKILL_LABELS_JA } from '@/lib/english/balance'
import { SORENESS_CURVE_LABELS, type SorenessCurveKey } from '@/lib/workout/soreness'
import type { SkillCode } from '@/types/database'
import { Button } from '@/components/ui/button'
import { updateGoals, updateProfile, type ActionState } from './actions'

const initial: ActionState = { ok: false }

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p
      role="status"
      className={`text-sm ${state.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
    >
      {state.message}
    </p>
  )
}

export function ProfileForm({
  displayName,
  bodyweightKg,
  curveKey,
}: {
  displayName: string
  bodyweightKg: number
  curveKey: SorenessCurveKey
}) {
  const [state, action, pending] = useActionState(updateProfile, initial)

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-muted">表示名</span>
        <input name="displayName" defaultValue={displayName} maxLength={40} className="field" />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">
          体重（kg）— 自重種目の負荷換算に使います
        </span>
        <input
          name="bodyweightKg"
          type="number"
          step="0.1"
          min="1"
          defaultValue={bodyweightKg}
          required
          className="field tabular"
        />
      </label>

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-xs text-muted">筋肉痛の出かた</legend>
        {(Object.keys(SORENESS_CURVE_LABELS) as SorenessCurveKey[]).map((key) => (
          <label key={key} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="sorenessCurve"
              value={key}
              defaultChecked={key === curveKey}
              className="mt-1 size-4"
            />
            <span>{SORENESS_CURVE_LABELS[key]}</span>
          </label>
        ))}
        <p className="text-xs text-muted">
          どちらも翌々日でゼロになります。3日目以降は表示されません。
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-app-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? '保存中…' : '保存'}
      </button>
      <Status state={state} />
    </form>
  )
}

export function GoalsForm({ goals }: { goals: Partial<Record<SkillCode, number>> }) {
  const [state, action, pending] = useActionState(updateGoals, initial)

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {SKILL_CODES.map((code) => (
          <label key={code} className="block">
            <span className="mb-1 block text-xs text-muted">
              {SKILL_LABELS[code]}（{SKILL_LABELS_JA[code]}）
            </span>
            <input
              name={code}
              type="number"
              min="0"
              step="5"
              defaultValue={goals[code] ?? 60}
              className="field tabular"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">
        1週間あたりの目標分数です。レーダーの外周がこの値になります。
      </p>
      <Button type="submit" variant="primary" size="lg" full disabled={pending}>
        {pending ? '保存中…' : '週の目標を保存'}
      </Button>
      <Status state={state} />
    </form>
  )
}
