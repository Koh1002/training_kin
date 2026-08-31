import { redirect } from 'next/navigation'
import { Card, CardTitle, EmptyState } from '@/components/ui/card'
import { SubNav } from '@/components/sub-nav'
import { WeeklyChart } from '@/components/english/weekly-chart'
import { formatDateLabel, todayJst } from '@/lib/date'
import {
  balanceScore,
  currentStreak,
  formatMinutes,
  SKILL_LABELS,
  type SkillMinutes,
} from '@/lib/english/balance'
import { getRecentLogs, sumBySkill, totalsByActivity, weeklyBuckets } from '@/lib/english/queries'
import { getCurrentUser } from '@/lib/supabase/server'
import { ENGLISH_NAV } from '../nav'

const RANGE_DAYS = 84 // 12週間

export default async function EnglishHistoryPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const today = todayJst()
  const logs = await getRecentLogs(user.id, today, RANGE_DAYS)

  const weekly = weeklyBuckets(logs)
  const totals: SkillMinutes = sumBySkill(logs)
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0)
  const byActivity = totalsByActivity(logs)
  const streak = currentStreak(
    logs.map((l) => l.date),
    today,
  )
  const studiedDays = new Set(logs.map((l) => l.date)).size

  return (
    <>
      <SubNav items={ENGLISH_NAV} accent="var(--accent-english)" />

      <div className="space-y-4">
        <Card>
          <CardTitle>週ごとの学習時間</CardTitle>
          {weekly.length === 0 ? (
            <EmptyState>まだ記録がありません。</EmptyState>
          ) : (
            <WeeklyChart data={weekly} />
          )}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="合計" value={formatMinutes(grandTotal)} />
            <Stat label="学習した日" value={`${studiedDays} 日`} />
            <Stat label="連続日数" value={`${streak} 日`} />
            <Stat label="バランス" value={`${balanceScore(totals)} / 100`} />
          </dl>
        </Card>

        <Card>
          <CardTitle>技能別の合計</CardTitle>
          <ul className="space-y-1.5">
            {(Object.keys(SKILL_LABELS) as Array<keyof typeof SKILL_LABELS>).map((code) => {
              const minutes = totals[code]
              const share = grandTotal > 0 ? minutes / grandTotal : 0
              return (
                <li key={code} className="flex items-center gap-2 text-sm">
                  <span className="w-20 shrink-0 text-muted">{SKILL_LABELS[code]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full rounded-full bg-english"
                      style={{ width: `${share * 100}%` }}
                    />
                  </span>
                  <span className="tabular w-20 shrink-0 text-right text-xs text-muted">
                    {formatMinutes(minutes)}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle>項目別の合計</CardTitle>
          {byActivity.length === 0 ? (
            <EmptyState>記録するとここに内訳が並びます。</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {byActivity.map((a) => (
                <li key={a.name} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate text-[15px]">
                    <span className="mr-1.5 text-xs text-muted">{SKILL_LABELS[a.skill]}</span>
                    {a.name}
                  </span>
                  <span className="tabular shrink-0 text-sm text-muted">{formatMinutes(a.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>最近の記録</CardTitle>
          {logs.length === 0 ? (
            <EmptyState>まだ記録がありません。</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {[...logs].reverse().slice(0, 30).map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="w-20 shrink-0 text-muted">{formatDateLabel(log.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{log.english_activities?.name_ja}</span>
                  <span className="tabular shrink-0 text-muted">{log.minutes}分</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-muted px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  )
}
