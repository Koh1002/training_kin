'use client'

import { useActionState } from 'react'
import { SKILL_CODES, SKILL_LABELS, SKILL_LABELS_JA } from '@/lib/english/balance'
import { createActivity, type ActionState } from './actions'

const initialState: ActionState = { ok: false }

export function ActivityForm() {
  const [state, action, pending] = useActionState(createActivity, initialState)

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-muted">技能</span>
        <select name="skillCode" className="field" defaultValue="reading">
          {SKILL_CODES.map((code) => (
            <option key={code} value={code}>
              {SKILL_LABELS[code]}（{SKILL_LABELS_JA[code]}）
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">項目名</span>
        <input name="nameJa" required maxLength={40} className="field" placeholder="例: TED 視聴" />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">説明（任意）</span>
        <input name="description" maxLength={120} className="field" placeholder="どんな取り組みか" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-english px-4 py-2.5 font-semibold text-white disabled:opacity-50"
      >
        {pending ? '追加中…' : '項目を追加'}
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
