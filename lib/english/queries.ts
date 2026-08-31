import { createClient } from '@/lib/supabase/server'
import { shiftDate, weekStart, type DateString } from '@/lib/date'
import { emptySkillMinutes, SKILL_CODES, type SkillMinutes } from '@/lib/english/balance'
import type { EnglishActivity, EnglishGoal, EnglishLog, SkillCode } from '@/types/database'

/** 英語タブの読み取り。 */

export async function getActivities(): Promise<EnglishActivity[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('english_activities')
    .select('*')
    .eq('is_active', true)
    .order('skill_code')
    .order('sort_order')
  return (data as EnglishActivity[]) ?? []
}

export async function getGoals(userId: string): Promise<Partial<Record<SkillCode, number>>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('english_goals')
    .select('skill_code, weekly_target_min')
    .eq('user_id', userId)

  const goals: Partial<Record<SkillCode, number>> = {}
  for (const row of (data as EnglishGoal[]) ?? []) goals[row.skill_code] = row.weekly_target_min
  return goals
}

export type LogWithActivity = EnglishLog & {
  english_activities: Pick<EnglishActivity, 'name_ja' | 'skill_code'> | null
}

export async function getLogsForDate(userId: string, date: DateString): Promise<LogWithActivity[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('english_logs')
    .select('*, english_activities(name_ja, skill_code)')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at')
  return (data as LogWithActivity[]) ?? []
}

export async function getLogsBetween(
  userId: string,
  from: DateString,
  to: DateString,
): Promise<LogWithActivity[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('english_logs')
    .select('*, english_activities(name_ja, skill_code)')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date')
  return (data as LogWithActivity[]) ?? []
}

/** その週（月曜はじまり）の技能ごとの合計分数。 */
export function sumBySkill(logs: LogWithActivity[]): SkillMinutes {
  const minutes = emptySkillMinutes()
  for (const log of logs) {
    const skill = log.english_activities?.skill_code
    if (skill) minutes[skill] += log.minutes
  }
  return minutes
}

/** 技能ごとの「最後に取り組んだ日」。おすすめの同率タイブレークに使う。 */
export function lastDoneBySkill(logs: LogWithActivity[]): Partial<Record<SkillCode, DateString>> {
  const last: Partial<Record<SkillCode, DateString>> = {}
  for (const log of logs) {
    const skill = log.english_activities?.skill_code
    if (!skill) continue
    if (!last[skill] || log.date > last[skill]!) last[skill] = log.date
  }
  return last
}

/** 週ごと × 技能ごとの分数。履歴の積み上げグラフ用。 */
export function weeklyBuckets(logs: LogWithActivity[]): Array<{ weekStart: DateString } & SkillMinutes> {
  const buckets = new Map<DateString, SkillMinutes>()
  for (const log of logs) {
    const skill = log.english_activities?.skill_code
    if (!skill) continue
    const key = weekStart(log.date)
    const bucket = buckets.get(key) ?? emptySkillMinutes()
    bucket[skill] += log.minutes
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([week, minutes]) => ({ weekStart: week, ...minutes }))
}

/** 項目ごとの合計分数（多い順）。 */
export function totalsByActivity(logs: LogWithActivity[]) {
  const totals = new Map<string, { name: string; skill: SkillCode; minutes: number }>()
  for (const log of logs) {
    const activity = log.english_activities
    if (!activity) continue
    const entry = totals.get(activity.name_ja) ?? {
      name: activity.name_ja,
      skill: activity.skill_code,
      minutes: 0,
    }
    entry.minutes += log.minutes
    totals.set(activity.name_ja, entry)
  }
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes)
}

/** 直近 N 日ぶんのログをまとめて取る（ストリークと週次集計の共通の元データ）。 */
export async function getRecentLogs(userId: string, onDate: DateString, days = 120) {
  return getLogsBetween(userId, shiftDate(onDate, -days), onDate)
}

export { SKILL_CODES }
