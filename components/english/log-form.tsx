'use client'

import { useActionState, useState } from 'react'
import { addEnglishLog, type ActionState } from '@/app/(app)/english/actions'
import { SKILL_CODES, SKILL_LABELS } from '@/lib/english/balance'
import type { EnglishActivity, SkillCode } from '@/types/database'

type Props = {
  date: string
  activities: EnglishActivity[]
  /** 最初に開いたときに選んでおく技能（いま最も遅れているもの） */
  defaultSkill: SkillCode
}

const initialState: ActionState = { ok: false }
const QUICK_MINUTES = [10, 15, 20, 30, 45, 60]

/** 英語の記録入力。技能 → 項目 → 分の 3 タップで終わる。 */
export function LogForm({ date, activities, defaultSkill }: Props) {
  const [state, action, pending] = useActionState(addEnglishLog, initialState)
  const [skill, setSkill] = useState<SkillCode>(defaultSkill)
  const [activityId, setActivityId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState('20')

  const visible = activities.filter((a) => a.skill_code === skill)
  const selected = activities.find((a) => a.id === activityId)

  // 記録できたら項目の選択を解除する。useActionState は結果ごとに新しい
  // オブジェクトを返すので、参照の比較で「未処理の結果か」を判定できる。
  const [handledState, setHandledState] = useState(state)
  if (state !== handledState) {
    setHandledState(state)
    if (state.ok) setActivityId(null)
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="activityId" value={activityId ?? ''} />

      <div className="grid grid-cols-4 gap-1.5">
        {SKILL_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              setSkill(code)
              setActivityId(null)
            }}
            aria-pressed={skill === code}
            className={`rounded-app border px-1 py-2 text-[13px] transition ${
              skill === code
                ? 'border-english/40 bg-english/10 font-medium text-english'
                : 'border-border text-muted'
            }`}
          >
            {SKILL_LABELS[code]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visible.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setActivityId(a.id === activityId ? null : a.id)}
            aria-pressed={a.id === activityId}
            className={`rounded-app border px-2.5 py-1.5 text-[13px] transition ${
              a.id === activityId
                ? 'border-transparent bg-english font-medium text-white'
                : 'border-border bg-surface'
            }`}
          >
            {a.name_ja}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="space-y-3 rounded-app-lg border border-border bg-surface-muted p-3">
          <div>
            <strong className="text-[15px]">{selected.name_ja}</strong>
            {selected.description ? (
              <p className="mt-0.5 text-xs text-muted">{selected.description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(String(m))}
                aria-pressed={minutes === String(m)}
                className={`rounded-app border px-3 py-1.5 text-sm transition ${
                  minutes === String(m) ? 'border-english bg-english text-white' : 'border-border bg-surface'
                }`}
              >
                {m}分
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-muted">学習時間（分）</span>
            <input
              name="minutes"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              inputMode="numeric"
              required
              className="field tabular"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-muted">メモ（任意）</span>
            <input name="note" maxLength={200} className="field" placeholder="読んだ論文、話した内容など" />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-app-lg bg-english px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? '記録中…' : '記録する'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">項目を選ぶと時間を入力できます。</p>
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
