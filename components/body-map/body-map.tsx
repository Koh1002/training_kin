'use client'

import { useState } from 'react'
import { muscleName, type MuscleCode } from '@/lib/muscles'
import { legendStops, type MapMode } from '@/lib/workout/color-scale'
import { sorenessLabel } from '@/lib/workout/soreness'
import { formatVolume } from '@/lib/workout/volume'
import { BodyFigure } from './body-figure'

export type MuscleBreakdown = {
  /** その部位に効いた種目と負荷 */
  exercises: Array<{ name: string; volumeKg: number }>
  volumeKg: number
}

type Props = {
  mode: MapMode
  onModeChange?: (mode: MapMode) => void
  /** 表示に使う 0〜1 の強度 */
  values: Partial<Record<MuscleCode, number>>
  /** タップしたときに出す内訳（刺激モードのみ） */
  breakdown?: Partial<Record<MuscleCode, MuscleBreakdown>>
  /** モード切替タブを出すか */
  showModeToggle?: boolean
}

const MODE_LABEL: Record<MapMode, string> = {
  stimulus: '今日の刺激',
  soreness: '筋肉痛',
}

/**
 * 人体図。前面と背面を並べ、筋群の強度を色で示す。
 * 色だけに頼らないよう、タップで数値と内訳を出せるようにしている。
 */
export function BodyMap({ mode, onModeChange, values, breakdown, showModeToggle = true }: Props) {
  const [selected, setSelected] = useState<MuscleCode | null>(null)

  const selectedValue = selected ? (values[selected] ?? 0) : 0
  const selectedBreakdown = selected ? breakdown?.[selected] : undefined

  return (
    <div className="space-y-3">
      {showModeToggle && onModeChange ? (
        <div role="tablist" aria-label="表示モード" className="flex gap-1 rounded-app-lg bg-surface-muted p-1">
          {(['stimulus', 'soreness'] as MapMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => onModeChange(m)}
              className={`flex-1 rounded-app px-3 py-2 text-sm font-medium transition-colors ${
                mode === m ? 'bg-surface shadow-sm' : 'text-muted'
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex justify-center gap-2">
        <BodyFigure side="front" mode={mode} values={values} selected={selected} onSelect={setSelected} />
        <BodyFigure side="back" mode={mode} values={values} selected={selected} onSelect={setSelected} />
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-muted">
        <span>{mode === 'stimulus' ? '刺激なし' : '痛みなし'}</span>
        <span className="flex overflow-hidden rounded-full border border-border">
          {legendStops(mode).map((stop) => (
            <span key={stop.value} className="h-3 w-6" style={{ background: stop.color }} />
          ))}
        </span>
        <span>{mode === 'stimulus' ? '強' : '強い'}</span>
      </div>

      {selected ? (
        <div className="rounded-app-lg border border-border bg-surface-muted p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <strong>{muscleName(selected)}</strong>
            <span className="tabular text-muted">
              {mode === 'soreness'
                ? `${sorenessLabel(selectedValue)}（${Math.round(selectedValue * 100)}%）`
                : `${Math.round(selectedValue * 100)}%`}
            </span>
          </div>

          {selectedBreakdown && selectedBreakdown.exercises.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[13px] text-muted">
              {selectedBreakdown.exercises.map((ex) => (
                <li key={ex.name} className="flex justify-between gap-2">
                  <span>{ex.name}</span>
                  <span className="tabular">{formatVolume(ex.volumeKg)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-2 border-t border-border pt-1 font-medium text-foreground">
                <span>合計</span>
                <span className="tabular">{formatVolume(selectedBreakdown.volumeKg)}</span>
              </li>
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-muted">
              {mode === 'soreness'
                ? 'この部位に残っている筋肉痛はありません。'
                : 'この日はこの部位を鍛えていません。'}
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-muted">部位をタップすると内訳が見られます</p>
      )}
    </div>
  )
}
