import type { MuscleCode } from '@/lib/muscles'

/**
 * 人体図の塗り分け。
 *
 * 2 つのモードで色相を変えている:
 *   stimulus … その日どこに効いたか（グレー → 水色 → 青）
 *   soreness … いまどこが筋肉痛か（グレー → 黄 → 橙 → 赤）
 *
 * 色相だけに頼ると色覚特性によっては読み取れないので、
 * 明度も単調に変化させ、UI 側では数値ラベルも併記している。
 */

export type MapMode = 'stimulus' | 'soreness'

type Stop = { at: number; color: [number, number, number] }

const SCALES: Record<MapMode, Stop[]> = {
  stimulus: [
    { at: 0.0, color: [222, 226, 233] }, // 0 は intensityColor 側でテーマ色に差し替える
    { at: 0.25, color: [167, 216, 240] },
    { at: 0.6, color: [76, 154, 224] },
    { at: 1.0, color: [23, 78, 166] },
  ],
  soreness: [
    { at: 0.0, color: [222, 226, 233] },
    { at: 0.25, color: [250, 219, 122] },
    { at: 0.6, color: [240, 148, 56] },
    { at: 1.0, color: [193, 47, 47] },
  ],
}

/** 0〜1 の強度を CSS の色にする。 */
export function intensityColor(mode: MapMode, value: number): string {
  const v = Math.max(0, Math.min(1, value))
  const stops = SCALES[mode]

  // 未刺激はテーマの地の色に沈める。ここだけ固定色にすると、
  // ダークテーマで「鍛えていない部位」の方が明るく目立ってしまう。
  if (v <= 0) return 'var(--color-surface-muted)'

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1]
    const next = stops[i]
    if (v <= next.at) {
      const t = (v - prev.at) / (next.at - prev.at)
      const [r, g, b] = prev.color.map((c, k) => Math.round(c + (next.color[k] - c) * t))
      return `rgb(${r} ${g} ${b})`
    }
  }

  const [r, g, b] = stops[stops.length - 1].color
  return `rgb(${r} ${g} ${b})`
}

/** 凡例に出す 5 段階の色見本。 */
export function legendStops(mode: MapMode): Array<{ value: number; color: string }> {
  return [0, 0.25, 0.5, 0.75, 1].map((value) => ({ value, color: intensityColor(mode, value) }))
}

/**
 * 筋群ごとの負荷[kg]を 0〜1 に正規化する。
 * その日の最大値を 1 とする相対表示にしているので、
 * 脚（重量が大きい）と肩（重量が小さい）を同じ図の上で比べられる。
 */
export function normalizeVolumes(
  volumes: Partial<Record<MuscleCode, number>>,
): Partial<Record<MuscleCode, number>> {
  const values = Object.values(volumes).filter((v): v is number => typeof v === 'number' && v > 0)
  if (values.length === 0) return {}
  const max = Math.max(...values)

  const out: Partial<Record<MuscleCode, number>> = {}
  for (const [code, volume] of Object.entries(volumes) as [MuscleCode, number][]) {
    if (volume > 0) out[code] = volume / max
  }
  return out
}
