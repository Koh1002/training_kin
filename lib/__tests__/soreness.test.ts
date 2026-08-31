import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SORENESS_CURVE,
  FALLBACK_REFERENCE_KG,
  SORENESS_CURVES,
  buildReferences,
  buildSorenessMap,
  matchCurvePreset,
  sorenessLabel,
  sortedSoreness,
  type MuscleVolumeByDate,
} from '@/lib/workout/soreness'

/** 基準値ちょうどの負荷を入れて、減衰カーブの値がそのまま出るようにする */
function historyAt(date: string, volumeKg: number): MuscleVolumeByDate {
  return new Map([[date, { chest_mid: volumeKg }]])
}

const REF = { references: undefined }

describe('buildSorenessMap', () => {
  it('当日は満点、翌日・翌々日と徐々に軽減し、3日後には消える', () => {
    const history = historyAt('2026-09-01', FALLBACK_REFERENCE_KG)
    const refs = buildReferences(new Map())

    expect(buildSorenessMap('2026-09-01', history, { references: refs }).chest_mid).toBeCloseTo(1.0)
    expect(buildSorenessMap('2026-09-02', history, { references: refs }).chest_mid).toBeCloseTo(0.66)
    expect(buildSorenessMap('2026-09-03', history, { references: refs }).chest_mid).toBeCloseTo(0.33)
    expect(buildSorenessMap('2026-09-04', history, { references: refs }).chest_mid).toBeUndefined()
  })

  it('トレーニング前の日には筋肉痛が出ない', () => {
    const history = historyAt('2026-09-01', FALLBACK_REFERENCE_KG)
    expect(buildSorenessMap('2026-08-31', history).chest_mid).toBeUndefined()
  })

  it('連日の刺激は加算され、1.0 でクランプされる', () => {
    const history: MuscleVolumeByDate = new Map([
      ['2026-09-01', { chest_mid: FALLBACK_REFERENCE_KG }],
      ['2026-09-02', { chest_mid: FALLBACK_REFERENCE_KG }],
    ])
    const refs = buildReferences(new Map())
    // 9/2 時点: 当日ぶん 1.0 + 前日ぶん 0.66 = 1.66 → 1.0 に頭打ち
    expect(buildSorenessMap('2026-09-02', history, { references: refs }).chest_mid).toBe(1)
  })

  it('軽い刺激なら加算されても 1.0 に届かない', () => {
    const history: MuscleVolumeByDate = new Map([
      ['2026-09-01', { chest_mid: FALLBACK_REFERENCE_KG * 0.2 }],
      ['2026-09-02', { chest_mid: FALLBACK_REFERENCE_KG * 0.2 }],
    ])
    const refs = buildReferences(new Map())
    // 0.2 × 1.0 + 0.2 × 0.66
    expect(buildSorenessMap('2026-09-02', history, { references: refs }).chest_mid).toBeCloseTo(0.332)
  })

  it('カーブを差し替えると翌日ピークになる', () => {
    const history = historyAt('2026-09-01', FALLBACK_REFERENCE_KG)
    const refs = buildReferences(new Map())
    const opts = { curve: SORENESS_CURVES.delayed_peak, references: refs }

    expect(buildSorenessMap('2026-09-01', history, opts).chest_mid).toBeCloseTo(0.4)
    expect(buildSorenessMap('2026-09-02', history, opts).chest_mid).toBeCloseTo(1.0)
    expect(buildSorenessMap('2026-09-03', history, opts).chest_mid).toBeCloseTo(0.5)
  })

  it('空のカーブが渡されても既定にフォールバックする', () => {
    const history = historyAt('2026-09-01', FALLBACK_REFERENCE_KG)
    const refs = buildReferences(new Map())
    expect(buildSorenessMap('2026-09-01', history, { curve: [], references: refs }).chest_mid).toBeCloseTo(1)
  })

  it('履歴が空なら何も返さない', () => {
    expect(buildSorenessMap('2026-09-01', new Map(), REF)).toEqual({})
  })
})

describe('buildReferences', () => {
  it('記録が無い筋群はフォールバック値を使う', () => {
    expect(buildReferences(new Map()).chest_mid).toBe(FALLBACK_REFERENCE_KG)
  })

  it('十分な記録があれば 75 パーセンタイルを基準にする', () => {
    const history: MuscleVolumeByDate = new Map([
      ['2026-09-01', { chest_mid: 1000 }],
      ['2026-09-02', { chest_mid: 2000 }],
      ['2026-09-03', { chest_mid: 3000 }],
      ['2026-09-04', { chest_mid: 4000 }],
    ])
    expect(buildReferences(history).chest_mid).toBeCloseTo(3250)
  })

  it('記録が 2 件以下のうちはフォールバックと混ぜて極端な基準を避ける', () => {
    const history: MuscleVolumeByDate = new Map([['2026-09-01', { chest_mid: 100 }]])
    // 100 と 2000 の中間になるので、初日から真っ赤にはならない
    expect(buildReferences(history).chest_mid).toBeCloseTo((100 + FALLBACK_REFERENCE_KG) / 2)
  })

  it('鍛えていない日は分位点の計算に含めない', () => {
    const history: MuscleVolumeByDate = new Map([
      ['2026-09-01', { chest_mid: 3000 }],
      ['2026-09-02', { quad: 3000 }], // 胸はこの日ゼロ
      ['2026-09-03', { chest_mid: 3000 }],
      ['2026-09-04', { chest_mid: 3000 }],
    ])
    expect(buildReferences(history).chest_mid).toBeCloseTo(3000)
  })
})

describe('sorenessLabel / sortedSoreness', () => {
  it('強度を段階ラベルにする', () => {
    expect(sorenessLabel(0)).toBe('なし')
    expect(sorenessLabel(0.1)).toBe('軽い張り')
    expect(sorenessLabel(0.4)).toBe('軽度')
    expect(sorenessLabel(0.6)).toBe('中等度')
    expect(sorenessLabel(0.9)).toBe('強い')
  })

  it('強い順に並べ、ほぼゼロの部位は落とす', () => {
    const sorted = sortedSoreness({ chest_mid: 0.3, lat: 0.8, quad: 0.0001 })
    expect(sorted.map((s) => s.code)).toEqual(['lat', 'chest_mid'])
  })
})

describe('matchCurvePreset', () => {
  it('既定カーブは当日ピークのプリセットと一致する', () => {
    expect(matchCurvePreset(DEFAULT_SORENESS_CURVE)).toBe('same_day_peak')
    expect(matchCurvePreset(SORENESS_CURVES.delayed_peak)).toBe('delayed_peak')
    expect(matchCurvePreset([0.9, 0.1])).toBeNull()
  })
})
