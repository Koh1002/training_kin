'use client'

import { useState } from 'react'
import { BodyMap, type MuscleBreakdown } from '@/components/body-map/body-map'
import type { MuscleCode } from '@/lib/muscles'
import type { MapMode } from '@/lib/workout/color-scale'
import type { SorenessContribution } from '@/lib/workout/soreness'

type Props = {
  stimulus: Partial<Record<MuscleCode, number>>
  soreness: Partial<Record<MuscleCode, number>>
  /** 刺激モードの内訳: その日どの種目がこの部位を叩いたか */
  breakdown: Partial<Record<MuscleCode, MuscleBreakdown>>
  /** 筋肉痛モードの内訳: どの日のトレーニングがいまの痛みに効いているか */
  sorenessDetail: Partial<Record<MuscleCode, SorenessContribution[]>>
}

/**
 * 人体図のモード切替を保持するだけのラッパー。
 * データの集計はサーバー側で済ませ、ここは表示の状態だけを持つ。
 *
 * モードごとに内訳の中身が違う。以前は筋肉痛モードに内訳を渡しておらず、
 * 何をタップしても「残っている筋肉痛はありません」と出ていた——色が付いていても。
 */
export function BodyMapPanel({ stimulus, soreness, breakdown, sorenessDetail }: Props) {
  const [mode, setMode] = useState<MapMode>('stimulus')

  return (
    <BodyMap
      mode={mode}
      onModeChange={setMode}
      values={mode === 'stimulus' ? stimulus : soreness}
      breakdown={breakdown}
      sorenessDetail={sorenessDetail}
    />
  )
}
