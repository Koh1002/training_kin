/**
 * 筋群の定義。人体図の塗り分け単位であり、種目→筋群の寄与度マッピングの
 * 参照先でもある。DB の `muscles` テーブルと 1:1 で対応させる。
 */

export const MUSCLE_CODES = [
  // 前面
  'chest_upper',
  'chest_mid',
  'delt_front',
  'delt_mid',
  'biceps',
  'forearm',
  'abs',
  'oblique',
  'quad',
  'adductor',
  // 背面
  'trap',
  'delt_rear',
  'lat',
  'erector',
  'triceps',
  'glute',
  'hamstring',
  'calf',
] as const

export type MuscleCode = (typeof MUSCLE_CODES)[number]

export type MuscleRegion = 'front' | 'back' | 'both'

export type MuscleDef = {
  code: MuscleCode
  nameJa: string
  /** 人体図のどちら側に描くか。delt_mid は前後どちらからも見える */
  region: MuscleRegion
  /** カテゴリ表示用のまとまり */
  group: '胸' | '肩' | '腕' | '背中' | '体幹' | '脚'
}

export const MUSCLES: readonly MuscleDef[] = [
  { code: 'chest_upper', nameJa: '大胸筋上部', region: 'front', group: '胸' },
  { code: 'chest_mid', nameJa: '大胸筋中部', region: 'front', group: '胸' },
  { code: 'delt_front', nameJa: '三角筋前部', region: 'front', group: '肩' },
  { code: 'delt_mid', nameJa: '三角筋中部', region: 'both', group: '肩' },
  { code: 'delt_rear', nameJa: '三角筋後部', region: 'back', group: '肩' },
  { code: 'biceps', nameJa: '上腕二頭筋', region: 'front', group: '腕' },
  { code: 'triceps', nameJa: '上腕三頭筋', region: 'back', group: '腕' },
  { code: 'forearm', nameJa: '前腕', region: 'front', group: '腕' },
  { code: 'trap', nameJa: '僧帽筋', region: 'back', group: '背中' },
  { code: 'lat', nameJa: '広背筋', region: 'back', group: '背中' },
  { code: 'erector', nameJa: '脊柱起立筋', region: 'back', group: '背中' },
  { code: 'abs', nameJa: '腹直筋', region: 'front', group: '体幹' },
  { code: 'oblique', nameJa: '腹斜筋', region: 'front', group: '体幹' },
  { code: 'glute', nameJa: '大臀筋', region: 'back', group: '脚' },
  { code: 'quad', nameJa: '大腿四頭筋', region: 'front', group: '脚' },
  { code: 'hamstring', nameJa: 'ハムストリング', region: 'back', group: '脚' },
  { code: 'adductor', nameJa: '内転筋', region: 'front', group: '脚' },
  { code: 'calf', nameJa: 'ふくらはぎ', region: 'back', group: '脚' },
]

const BY_CODE = new Map(MUSCLES.map((m) => [m.code, m]))

export function muscleName(code: string): string {
  return BY_CODE.get(code as MuscleCode)?.nameJa ?? code
}

export function muscleDef(code: string): MuscleDef | undefined {
  return BY_CODE.get(code as MuscleCode)
}

/** 人体図の面ごとに描画すべき筋群 */
export function musclesForRegion(region: 'front' | 'back'): MuscleDef[] {
  return MUSCLES.filter((m) => m.region === region || m.region === 'both')
}
