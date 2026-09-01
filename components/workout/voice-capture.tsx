'use client'

import { useState } from 'react'
import { Mic, Square, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/button'
import { addSet } from '@/app/(app)/workout/actions'
import { matchExercise } from '@/lib/workout/match-exercise'
import { parseVoiceInput } from '@/lib/workout/voice-parse'
import { useSpeech } from '@/lib/workout/use-speech'
import type { ExerciseWithMuscles } from '@/types/database'

type Draft = {
  key: string
  rawName: string
  /** 空文字なら「決まっていない」。この行は記録できない */
  exerciseId: string
  candidates: { id: string; nameJa: string }[]
  weight: string
  reps: string
  sets: string
}

type Props = {
  date: string
  exercises: ExerciseWithMuscles[]
  onSaved: () => void
}

const EXAMPLE = 'ベンチプレス10キロ10回3セット、スクワット20キロ10回3セット'

/**
 * 声（または打ち込んだ文）から記録する。
 *
 * **言われたとおりには保存しない。** 音声認識は必ず聞き間違えるので、
 * 種目をマスタに寄せたうえで確認画面を挟む。ここを飛ばす道は作らない。
 */
export function VoiceCapture({ date, exercises, onSaved }: Props) {
  const speech = useSpeech()
  const [typed, setTyped] = useState('')
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const analyze = (text: string) => {
    const entries = parseVoiceInput(text)
    setMessage(null)
    if (entries.length === 0) {
      setDrafts([])
      return
    }
    setDrafts(
      entries.map((entry, i) => {
        const candidates = matchExercise(entry.rawName, exercises).map((c) => ({
          id: c.id,
          nameJa: c.nameJa,
        }))
        return {
          key: `${i}-${entry.rawName}`,
          rawName: entry.rawName,
          // 候補が無ければ空のまま。勝手に一番近いものを選ばない
          exerciseId: candidates[0]?.id ?? '',
          candidates,
          weight: entry.weightKg?.toString() ?? '',
          reps: entry.reps?.toString() ?? '',
          sets: entry.sets?.toString() ?? '',
        }
      }),
    )
  }

  const update = (key: string, patch: Partial<Draft>) => {
    setDrafts((current) =>
      current ? current.map((d) => (d.key === key ? { ...d, ...patch } : d)) : current,
    )
  }

  const ready =
    drafts !== null &&
    drafts.length > 0 &&
    drafts.every((d) => d.exerciseId && d.weight && d.reps && d.sets)

  const save = async () => {
    if (!drafts || !ready) return
    setSaving(true)
    setMessage(null)

    // 1 行ずつ既存の addSet に渡す。サーバ側の検証をそのまま通したいので、
    // ここで独自の保存経路は作らない。
    try {
      for (const draft of drafts) {
        const formData = new FormData()
        formData.set('date', date)
        formData.set('exerciseId', draft.exerciseId)
        formData.set('weightKg', draft.weight)
        formData.set('reps', draft.reps)
        formData.set('sets', draft.sets)
        const result = await addSet({ ok: false }, formData)
        if (!result?.ok) {
          setSaving(false)
          setMessage(result?.message ?? '保存に失敗しました')
          return
        }
      }
    } catch (e) {
      // ここで握り潰すと「記録中…」のまま固まり、何が起きたか分からなくなる
      setSaving(false)
      setMessage(e instanceof Error ? `保存に失敗しました: ${e.message}` : '保存に失敗しました')
      return
    }

    setSaving(false)
    setDrafts(null)
    setTyped('')
    speech.reset()
    setMessage(`${drafts.length}件を記録しました`)
    onSaved()
  }

  const heard = speech.transcript || typed

  return (
    <div className="space-y-3">
      {speech.supported ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant={speech.listening ? 'secondary' : 'primary'}
            size="lg"
            full
            onClick={() => {
              if (speech.listening) {
                // 停止しても onend を通るので、解析は start に渡した側で行われる
                speech.stop()
              } else {
                setDrafts(null)
                speech.start(analyze)
              }
            }}
          >
            {speech.listening ? (
              <>
                <Square size={16} aria-hidden />
                話し終わったら押す
              </>
            ) : (
              <>
                <Mic size={16} aria-hidden />
                声で記録する
              </>
            )}
          </Button>
          <p className="text-xs text-muted">
            例: 「{EXAMPLE}」のように続けて言えます。
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted">
          このブラウザは音声入力に対応していません。下の欄に同じ書き方で打ち込めます。
        </p>
      )}

      {speech.transcript ? (
        <p className="rounded-app border border-border bg-surface-muted px-3 py-2 text-sm">
          {speech.transcript}
        </p>
      ) : null}

      {speech.error ? (
        <p role="alert" className="rounded-app border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {speech.error}
        </p>
      ) : null}

      {/* 音声が使えないとき、および言い直すより打った方が速いときの入口 */}
      <div className="flex gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={EXAMPLE}
          aria-label="記録する内容"
          className="field flex-1 text-[13px]"
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="shrink-0"
          disabled={!heard.trim()}
          onClick={() => analyze(heard)}
        >
          読み取る
        </Button>
      </div>

      {drafts !== null && drafts.length === 0 ? (
        <p className="text-sm text-muted">
          読み取れませんでした。「{EXAMPLE}」のように、種目名・重量・回数・セット数を
          続けて言ってください。
        </p>
      ) : null}

      {drafts !== null && drafts.length > 0 ? (
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted">
            内容を確かめてから記録してください。聞き間違いはここで直せます。
          </p>

          {drafts.map((draft) => (
            <div key={draft.key} className="space-y-2 rounded-app-lg border border-border p-3">
              <div className="flex items-center gap-2">
                {draft.candidates.length > 0 ? (
                  <select
                    aria-label="種目"
                    value={draft.exerciseId}
                    onChange={(e) => update(draft.key, { exerciseId: e.target.value })}
                    className="field flex-1"
                  >
                    {draft.candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameJa}
                      </option>
                    ))}
                  </select>
                ) : (
                  // 近い種目が無かった行。全種目から選ばせる
                  <select
                    aria-label="種目"
                    value={draft.exerciseId}
                    onChange={(e) => update(draft.key, { exerciseId: e.target.value })}
                    className="field flex-1"
                  >
                    <option value="">
                      「{draft.rawName}」に近い種目がありません。選んでください
                    </option>
                    {exercises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name_ja}
                      </option>
                    ))}
                  </select>
                )}

                <IconButton
                  type="button"
                  variant="ghost"
                  aria-label="この行を消す"
                  onClick={() =>
                    setDrafts((c) => (c ? c.filter((d) => d.key !== draft.key) : c))
                  }
                >
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </div>

              <p className="text-xs text-muted">聞き取り: {draft.rawName}</p>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['weight', '重量(kg)'],
                    ['reps', '回数'],
                    ['sets', 'セット'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="space-y-1 text-xs text-muted">
                    <span>{label}</span>
                    <input
                      value={draft[field]}
                      onChange={(e) => update(draft.key, { [field]: e.target.value })}
                      inputMode="decimal"
                      className="field tabular"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="primary"
            size="lg"
            full
            disabled={!ready || saving}
            onClick={save}
          >
            {saving ? '記録中…' : `${drafts.length}件を記録する`}
          </Button>

          {!ready ? (
            <p className="text-xs text-muted">
              種目・重量・回数・セットがすべて埋まると記録できます。
            </p>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
    </div>
  )
}
