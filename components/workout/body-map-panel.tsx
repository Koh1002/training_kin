'use client'

import { useState } from 'react'
import { BodyMap, type MuscleBreakdown } from '@/components/body-map/body-map'
import type { MuscleCode } from '@/lib/muscles'
import type { MapMode } from '@/lib/workout/color-scale'

type Props = {
  stimulus: Partial<Record<MuscleCode, number>>
  soreness: Partial<Record<MuscleCode, number>>
  breakdown: Partial<Record<MuscleCode, MuscleBreakdown>>
}

/**
 * 人体図のモード切替を保持するだけのラッパー。
 * データの集計はサーバー側で済ませ、ここは表示の状態だけを持つ。
 */
export function BodyMapPanel({ stimulus, soreness, breakdown }: Props) {
  const [mode, setMode] = useState<MapMode>('stimulus')

  return (
    <BodyMap
      mode={mode}
      onModeChange={setMode}
      values={mode === 'stimulus' ? stimulus : soreness}
      breakdown={mode === 'stimulus' ? breakdown : undefined}
    />
  )
}
