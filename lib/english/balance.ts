import type { EnglishActivity, SkillCode } from '@/types/database'
import { daysBetween, todayJst, type DateString } from '@/lib/date'

/**
 * 英語 4 技能のバランス評価。
 * 「Reading だけ 3 時間やって Speaking はゼロ」を放置しないための仕組みで、
 *  - 週次目標に対する達成率（レーダー）
 *  - 4 技能がどれだけ均等かのバランススコア
 *  - いま最も遅れている技能から出す「次のおすすめ」
 * の 3 つを提供する。
 */

export const SKILL_CODES: readonly SkillCode[] = ['reading', 'listening', 'speaking', 'writing']

export const SKILL_LABELS: Record<SkillCode, string> = {
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing',
}

export const SKILL_LABELS_JA: Record<SkillCode, string> = {
  reading: '読む',
  listening: '聴く',
  speaking: '話す',
  writing: '書く',
}

export type SkillMinutes = Record<SkillCode, number>

export function emptySkillMinutes(): SkillMinutes {
  return { reading: 0, listening: 0, speaking: 0, writing: 0 }
}

/**
 * バランススコア（0〜100）。
 *
 *   share_i = minutes_i / total
 *   score   = 100 × (1 − Σ|share_i − 0.25| / 1.5)
 *
 * 4 技能が完全に均等なら 100、1 技能に全振りなら 0。
 * 偏差の合計は最大 1.5（= 0.75 + 0.25×3）なので、必ず 0〜100 に収まる。
 */
export function balanceScore(minutes: SkillMinutes): number {
  const total = SKILL_CODES.reduce((sum, code) => sum + minutes[code], 0)
  if (total <= 0) return 0

  const deviation = SKILL_CODES.reduce(
    (sum, code) => sum + Math.abs(minutes[code] / total - 0.25),
    0,
  )
  const maxDeviation = 1.5
  return Math.round(Math.max(0, 1 - deviation / maxDeviation) * 100)
}

/**
 * バランススコアの読み方を一言で添える。
 *
 * 合計時間も受け取るのは、記録が 1 件も無い週のスコアが 0 になり、
 * 「特定の技能に偏っています」と出てしまっていたため。まだ何もしていない週に
 * 偏りの指摘をするのは事実に反する。
 */
export function balanceComment(score: number, totalMinutes: number): string {
  if (totalMinutes <= 0) return 'まだ今週の記録がありません'
  if (score >= 85) return '4技能がよく揃っています'
  if (score >= 65) return 'おおむねバランスが取れています'
  if (score >= 40) return '少し偏ってきました'
  return '特定の技能に偏っています'
}

export type SkillProgress = {
  skill: SkillCode
  minutes: number
  targetMin: number
  /** 達成率（0〜1 以上。目標超過は 1 を超える） */
  ratio: number
}

export function weeklyProgress(
  minutes: SkillMinutes,
  goals: Partial<Record<SkillCode, number>>,
): SkillProgress[] {
  return SKILL_CODES.map((skill) => {
    const targetMin = goals[skill] ?? 60
    const done = minutes[skill]
    return {
      skill,
      minutes: done,
      targetMin,
      ratio: targetMin > 0 ? done / targetMin : done > 0 ? 1 : 0,
    }
  })
}

/**
 * 次に取り組むべき技能。週の達成率が最も低いものを選ぶ。
 * 同率のときは「最後にやった日が古い方」を優先する。
 */
export function nextSkill(
  progress: SkillProgress[],
  lastDoneAt: Partial<Record<SkillCode, DateString>> = {},
): SkillCode {
  const sorted = [...progress].sort((a, b) => {
    if (Math.abs(a.ratio - b.ratio) > 1e-9) return a.ratio - b.ratio
    const aDate = lastDoneAt[a.skill]
    const bDate = lastDoneAt[b.skill]
    // 最後にやった日が古い（= 日付が小さい）方を先頭に持ってくる
    if (aDate && bDate) return daysBetween(aDate, bDate)
    if (aDate) return 1 // 未実施の方を優先
    if (bDate) return -1
    return SKILL_CODES.indexOf(a.skill) - SKILL_CODES.indexOf(b.skill)
  })
  return sorted[0].skill
}

/**
 * 「今日はこれをやろう」の候補。遅れている技能の項目から数件出す。
 * 日付をシードにした決定的な並べ替えにしているので、
 * 同じ日に何度開いても提案が入れ替わらない。
 */
export function suggestActivities(
  skill: SkillCode,
  activities: EnglishActivity[],
  count = 3,
  seed: DateString = todayJst(),
): EnglishActivity[] {
  const pool = activities.filter((a) => a.skill_code === skill && a.is_active)
  if (pool.length <= count) return pool

  const base = hashString(`${seed}:${skill}`)
  return [...pool]
    .map((activity, index) => ({ activity, key: (base + index * 2654435761) % 1000003 }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count)
    .map((x) => x.activity)
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * 連続学習日数。今日まだ記録が無い場合は昨日までの連続日数を返すので、
 * 日中に開いてもストリークが 0 に見えて心が折れることはない。
 */
export function currentStreak(datesWithLogs: Iterable<DateString>, today: DateString = todayJst()): number {
  const set = new Set(datesWithLogs)
  if (set.size === 0) return 0

  let cursor = set.has(today) ? today : shift(today, -1)
  if (!set.has(cursor)) return 0

  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor = shift(cursor, -1)
  }
  return streak
}

function shift(date: DateString, days: number): DateString {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}
