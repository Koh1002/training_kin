import { redirect } from 'next/navigation'
import { Card, CardTitle, EmptyState } from '@/components/ui/card'
import { DateNav } from '@/components/date-nav'
import { SubNav } from '@/components/sub-nav'
import { LogForm } from '@/components/english/log-form'
import { SkillRadar } from '@/components/english/skill-radar'
import { todayJst, weekStart } from '@/lib/date'
import {
  balanceComment,
  balanceScore,
  currentStreak,
  formatMinutes,
  nextSkill,
  SKILL_LABELS,
  suggestActivities,
  weeklyProgress,
} from '@/lib/english/balance'
import {
  getActivities,
  getGoals,
  getLogsForDate,
  getRecentLogs,
  lastDoneBySkill,
  sumBySkill,
} from '@/lib/english/queries'
import { getCurrentUser } from '@/lib/supabase/server'
import { ENGLISH_NAV } from './nav'
import { deleteEnglishLog } from './actions'

export default async function EnglishPage(props: PageProps<'/english'>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const params = await props.searchParams
  const raw = typeof params.date === 'string' ? params.date : ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayJst()

  const [activities, goals, todayLogs, recentLogs] = await Promise.all([
    getActivities(),
    getGoals(user.id),
    getLogsForDate(user.id, date),
    getRecentLogs(user.id, date),
  ])

  // 「今週」は月曜はじまり。DB の date_trunc('week') と揃えている。
  const thisWeekStart = weekStart(date)
  const weekLogs = recentLogs.filter((log) => weekStart(log.date) === thisWeekStart)

  const weekMinutes = sumBySkill(weekLogs)
  const progress = weeklyProgress(weekMinutes, goals)
  const score = balanceScore(weekMinutes)
  const focus = nextSkill(progress, lastDoneBySkill(recentLogs))
  const suggestions = suggestActivities(focus, activities, 3, date)
  const streak = currentStreak(
    recentLogs.map((log) => log.date),
    date,
  )

  const todayMinutes = todayLogs.reduce((sum, log) => sum + log.minutes, 0)
  const weekTotal = Object.values(weekMinutes).reduce((a, b) => a + b, 0)

  return (
    <>
      <SubNav items={ENGLISH_NAV} accent="var(--accent-english)" />
      <DateNav date={date} basePath="/english" />

      <div className="space-y-4">
        <Card>
          <CardTitle right={<span className="text-xs text-muted">月曜はじまり</span>}>
            今週のバランス
          </CardTitle>
          <SkillRadar progress={progress} />

          <div className="mt-1 flex items-baseline justify-between gap-2">
            <p className="text-sm">
              <span className="text-muted">バランススコア </span>
              <strong className="tabular text-lg">{score}</strong>
              <span className="text-muted"> / 100</span>
            </p>
            <p className="text-xs text-muted">{balanceComment(score)}</p>
          </div>

          <ul className="mt-3 space-y-1.5">
            {progress.map((p) => (
              <li key={p.skill} className="flex items-center gap-2 text-sm">
                <span className="w-20 shrink-0 text-muted">{SKILL_LABELS[p.skill]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span
                    className="block h-full rounded-full bg-english"
                    style={{ width: `${Math.min(100, p.ratio * 100)}%` }}
                  />
                </span>
                <span className="tabular w-24 shrink-0 text-right text-xs text-muted">
                  {p.minutes}/{p.targetMin}分
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-muted">
            今週の合計 {formatMinutes(weekTotal)}
            {streak > 0 ? ` ・ ${streak}日連続で学習中 🔥` : ''}
          </p>
        </Card>

        <Card>
          <CardTitle>次におすすめ</CardTitle>
          <p className="mb-2 text-sm">
            <strong className="text-english">{SKILL_LABELS[focus]}</strong>
            <span className="text-muted"> が今週いちばん遅れています。</span>
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {suggestions.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-english/40 bg-english/5 px-2.5 py-1.5 text-[13px]"
              >
                {a.name_ja}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle right={<span className="tabular text-sm">{formatMinutes(todayMinutes)}</span>}>
            この日の記録（{todayLogs.length}件）
          </CardTitle>
          {todayLogs.length === 0 ? (
            <EmptyState>まだ記録がありません。下から追加してください。</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {todayLogs.map((log) => (
                <li key={log.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">
                      <span className="mr-1.5 text-xs text-muted">
                        {log.english_activities ? SKILL_LABELS[log.english_activities.skill_code] : ''}
                      </span>
                      {log.english_activities?.name_ja}
                    </p>
                    {log.note ? <p className="truncate text-[13px] text-muted">{log.note}</p> : null}
                  </div>
                  <span className="tabular shrink-0 text-sm text-muted">{log.minutes}分</span>
                  <form action={deleteEnglishLog}>
                    <input type="hidden" name="logId" value={log.id} />
                    <button
                      type="submit"
                      aria-label={`${log.english_activities?.name_ja ?? ''}の記録を削除`}
                      className="px-1 text-muted"
                    >
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>学習を記録</CardTitle>
          <LogForm date={date} activities={activities} defaultSkill={focus} />
        </Card>
      </div>
    </>
  )
}
