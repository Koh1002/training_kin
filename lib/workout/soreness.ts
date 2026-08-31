import { MUSCLE_CODES, type MuscleCode } from '@/lib/muscles'
import { daysBetween, type DateString } from '@/lib/date'

/**
 * 筋肉痛モデル。
 *
 * 仕様は「トレーニングした翌々日まで続き、徐々に軽減されていく」。
 * 減衰の形は配列 1 つで表現しており、添字がトレーニングからの経過日数、
 * 値がその日に残っている強度の比率になる。配列長を超えた日は 0。
 *
 * 既定は当日がピークの線形減衰。医学的な DOMS は 24〜48 時間後がピークなので、
 * そちらの感覚に合わせたい人向けに DELAYED_PEAK プリセットも用意し、
 * profiles.soreness_curve から差し替えられるようにしている。
 */

export const SORENESS_CURVES = {
  /** 当日ピーク: トレーニング直後がいちばん張っている感覚に合う */
  same_day_peak: [1.0, 0.66, 0.33],
  /** 翌日ピーク: いわゆる DOMS の経過に近い */
  delayed_peak: [0.4, 1.0, 0.5],
} as const

export type SorenessCurveKey = keyof typeof SORENESS_CURVES
export const DEFAULT_SORENESS_CURVE: readonly number[] = SORENESS_CURVES.same_day_peak

export const SORENESS_CURVE_LABELS: Record<SorenessCurveKey, string> = {
  same_day_peak: '当日ピーク（当日がいちばん強く、翌々日まで軽減）',
  delayed_peak: '翌日ピーク（翌日がいちばん強く、翌々日まで軽減）',
}

/** 保存されているカーブがどのプリセットに一致するか。一致しなければ null。 */
export function matchCurvePreset(curve: readonly number[]): SorenessCurveKey | null {
  for (const [key, preset] of Object.entries(SORENESS_CURVES) as [SorenessCurveKey, readonly number[]][]) {
    if (preset.length === curve.length && preset.every((v, i) => Math.abs(v - curve[i]) < 1e-6)) {
      return key
    }
  }
  return null
}

/**
 * 筋群ごとの「1 セッションぶんの負荷の基準値」。
 * これで割ることで、部位ごとの重量スケールの差（脚 55kg と肩 9kg）を吸収する。
 * 記録がまだ少ないうちはフォールバック値を使い、貯まるにつれ自分基準に寄っていく。
 */
export const FALLBACK_REFERENCE_KG = 2000

export type MuscleVolumeByDate = Map<DateString, Partial<Record<MuscleCode, number>>>

/**
 * 直近の履歴から、筋群ごとの基準負荷を求める。
 * 「その筋群を鍛えた日」だけを対象に 75 パーセンタイルを取る。
 * 平均ではなく上位寄りの分位点にすることで、軽い日に引っ張られて
 * 基準が下がりすぎるのを防いでいる。
 */
export function buildReferences(history: MuscleVolumeByDate): Record<MuscleCode, number> {
  const buckets = new Map<MuscleCode, number[]>()
  for (const perMuscle of history.values()) {
    for (const code of MUSCLE_CODES) {
      const v = perMuscle[code]
      if (v && v > 0) {
        const list = buckets.get(code) ?? []
        list.push(v)
        buckets.set(code, list)
      }
    }
  }

  const refs = {} as Record<MuscleCode, number>
  for (const code of MUSCLE_CODES) {
    const values = buckets.get(code)
    if (!values || values.length === 0) {
      refs[code] = FALLBACK_REFERENCE_KG
      continue
    }
    values.sort((a, b) => a - b)
    // 記録が 1〜2 件しかないうちはフォールバックと混ぜて極端な基準を避ける
    const p75 = percentile(values, 0.75)
    refs[code] = values.length >= 3 ? p75 : (p75 + FALLBACK_REFERENCE_KG) / 2
  }
  return refs
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export type SorenessMap = Partial<Record<MuscleCode, number>>

/**
 * ある日 `onDate` 時点の、筋群ごとの筋肉痛強度（0〜1）。
 *
 *   soreness(m) = clamp01( Σ_d  volume(m, d) / reference(m) × curve[onDate - d] )
 *
 * 複数日の刺激は加算されるので、連日同じ部位を叩けば濃く残る。
 */
export function buildSorenessMap(
  onDate: DateString,
  history: MuscleVolumeByDate,
  options: { curve?: readonly number[]; references?: Record<MuscleCode, number> } = {},
): SorenessMap {
  const curve = options.curve?.length ? options.curve : DEFAULT_SORENESS_CURVE
  const references = options.references ?? buildReferences(history)

  const out: SorenessMap = {}
  for (const [date, perMuscle] of history) {
    const elapsed = daysBetween(onDate, date)
    if (elapsed < 0 || elapsed >= curve.length) continue
    const weight = curve[elapsed]
    if (weight <= 0) continue

    for (const code of MUSCLE_CODES) {
      const volume = perMuscle[code]
      if (!volume || volume <= 0) continue
      const ref = references[code] || FALLBACK_REFERENCE_KG
      out[code] = (out[code] ?? 0) + (volume / ref) * weight
    }
  }

  for (const code of Object.keys(out) as MuscleCode[]) {
    out[code] = Math.min(1, out[code]!)
  }
  return out
}

/** 強度を人が読める段階に落とす。数値だけだと色に頼りすぎるため併記する。 */
export function sorenessLabel(value: number): string {
  if (value <= 0.001) return 'なし'
  if (value < 0.25) return '軽い張り'
  if (value < 0.5) return '軽度'
  if (value < 0.75) return '中等度'
  return '強い'
}

/** 筋肉痛が残っている部位を強い順に返す。 */
export function sortedSoreness(map: SorenessMap): Array<{ code: MuscleCode; value: number }> {
  return (Object.entries(map) as [MuscleCode, number][])
    .filter(([, v]) => v > 0.001)
    .map(([code, value]) => ({ code, value }))
    .sort((a, b) => b.value - a.value)
}
