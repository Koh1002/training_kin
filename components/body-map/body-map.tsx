'use client'

import { useState } from 'react'
import { muscleName, type MuscleCode } from '@/lib/muscles'
import { legendStops, type MapMode } from '@/lib/workout/color-scale'
import { sorenessLabel, type SorenessContribution } from '@/lib/workout/soreness'
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
  /** 筋肉痛モードの内訳: どの日のトレーニングがいまの痛みに効いているか */
  sorenessDetail?: Partial<Record<MuscleCode, SorenessContribution[]>>
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
/** 「2026-08-31」→「8/31」。内訳は 3 日ぶんしか出ないので年は要らない */
function formatDateShort(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

function daysAgoLabel(daysAgo: number): string {
  if (daysAgo === 0) return '（今日）'
  if (daysAgo === 1) return '（昨日）'
  return `（${daysAgo}日前）`
}

export function BodyMap({
  mode,
  onModeChange,
  values,
  breakdown,
  sorenessDetail,
  showModeToggle = true,
}: Props) {
  const [selected, setSelected] = useState<MuscleCode | null>(null)

  const selectedValue = selected ? (values[selected] ?? 0) : 0
  const selectedBreakdown = selected ? breakdown?.[selected] : undefined
  const selectedContributions = (selected ? sorenessDetail?.[selected] : undefined) ?? []
  const contributionTotal = selectedContributions.reduce((sum, c) => sum + c.value, 0)

  return (
    <div className="space-y-3">
      {showModeToggle && onModeChange ? (
        <div
          role="tablist"
          aria-label="表示モード"
          className="flex gap-0.5 rounded-app-lg border border-border p-0.5"
        >
          {(['stimulus', 'soreness'] as MapMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => onModeChange(m)}
              className={`flex-1 rounded-app px-3 py-1.5 text-[13px] transition-colors ${
                mode === m
                  ? 'bg-surface-muted font-medium text-foreground'
                  : 'text-muted hover:text-foreground'
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

          {mode === 'soreness' ? (
            selectedContributions.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[13px] text-muted">
                {selectedContributions.map((c) => (
                  <li key={c.date} className="flex justify-between gap-2">
                    <span>
                      {formatDateShort(c.date)}
                      <span className="ml-1 text-muted">{daysAgoLabel(c.daysAgo)}</span>
                    </span>
                    <span className="tabular">
                      {formatVolume(c.volumeKg)} → {Math.round(c.value * 100)}%
                    </span>
                  </li>
                ))}
                {/*
                  強度は 1 で頭打ちにしている。合計が 100% を超えたとき、
                  内訳の和と見出しの数字が合わなくなるので、その理由をその場に書く。
                  黙って食い違わせない。
                */}
                {contributionTotal > 1 ? (
                  <li className="flex justify-between gap-2 border-t border-border pt-1">
                    <span>合計</span>
                    <span className="tabular">
                      {Math.round(contributionTotal * 100)}% → 100% で頭打ち
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-muted">
                {/*
                  強度が実質 0 のときだけ「無い」と言う。値が付いているのに内訳が
                  出せていないなら、その事実の方を出す。以前はここを値と無関係に
                  「ありません」と書いていて、色と真っ向から矛盾していた。
                */}
                {selectedValue <= 0.001
                  ? 'この部位に残っている筋肉痛はありません。'
                  : '内訳を表示できませんでした。'}
              </p>
            )
          ) : selectedBreakdown && selectedBreakdown.exercises.length > 0 ? (
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
            <p className="mt-1 text-[13px] text-muted">この日はこの部位を鍛えていません。</p>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-muted">部位をタップすると内訳が見られます</p>
      )}
    </div>
  )
}
