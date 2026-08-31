import Link from 'next/link'
import { Moon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { Card, CardTitle, EmptyState } from '@/components/ui/card'
import { SubNav } from '@/components/sub-nav'
import { VolumeChart } from '@/components/workout/volume-chart'
import { dateRange, formatDateLabel, shiftDate, todayJst } from '@/lib/date'
import { getCurrentUser } from '@/lib/supabase/server'
import { getDailySummaries, getExerciseBests } from '@/lib/workout/queries'
import { formatKg, formatVolume } from '@/lib/workout/volume'
import { WORKOUT_NAV } from '../nav'

const RANGE_DAYS = 30

export default async function WorkoutHistoryPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const today = todayJst()
  const from = shiftDate(today, -(RANGE_DAYS - 1))

  const [summaries, bests] = await Promise.all([
    getDailySummaries(user.id, from, today),
    getExerciseBests(user.id),
  ])

  const byDate = new Map(summaries.map((s) => [s.date, s]))

  // 記録が無い日も 0 として並べ、休んだ日が図から消えないようにする
  const points = dateRange(from, today).map((date) => {
    const s = byDate.get(date)
    return {
      date,
      volumeKg: Number(s?.total_volume_kg ?? 0),
      isRest: s?.kind === 'rest',
    }
  })

  const trainedDays = summaries.filter((s) => Number(s.total_volume_kg) > 0).length
  const restDays = summaries.filter((s) => s.kind === 'rest').length
  const totalVolume = summaries.reduce((sum, s) => sum + Number(s.total_volume_kg), 0)
  const cardio = summaries.reduce((sum, s) => sum + Number(s.cardio_minutes), 0)

  return (
    <>
      <SubNav items={WORKOUT_NAV} accent="var(--accent-workout)" />

      <div className="space-y-4">
        <Card>
          <CardTitle>直近{RANGE_DAYS}日の総負荷</CardTitle>
          {totalVolume > 0 ? (
            <VolumeChart data={points} />
          ) : (
            <EmptyState>まだ記録がありません。</EmptyState>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="トレした日" value={`${trainedDays} 日`} />
            <Stat label="休養日" value={`${restDays} 日`} />
            <Stat label="合計負荷" value={formatVolume(totalVolume)} />
            <Stat label="有酸素" value={`${cardio} 分`} />
          </dl>
        </Card>

        <Card>
          <CardTitle>日別</CardTitle>
          {summaries.length === 0 ? (
            <EmptyState>記録された日がまだありません。</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {[...summaries].reverse().map((s) => (
                <li key={s.date}>
                  <Link
                    href={`/workout?date=${s.date}`}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <span className="text-[15px]">{formatDateLabel(s.date)}</span>
                    <span className="text-sm text-muted">
                      {s.kind === 'rest' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Moon size={14} aria-hidden />
                          {s.rest_reason ?? 'オフ'}
                        </span>
                      
                      ) : (
                        <>
                          <span className="tabular">{formatVolume(Number(s.total_volume_kg))}</span>
                          <span className="ml-2">{s.exercise_count}種目</span>
                          {Number(s.cardio_minutes) > 0 ? (
                            <span className="ml-2">有酸素{Number(s.cardio_minutes)}分</span>
                          ) : null}
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>種目別ベスト</CardTitle>
          {bests.length === 0 ? (
            <EmptyState>種目を記録するとここに自己ベストが並びます。</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {bests.map((b) => (
                <li key={b.exerciseId} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{b.exerciseName}</p>
                    <p className="text-xs text-muted">
                      {b.sessionCount}日 ・ 最終 {formatDateLabel(b.lastDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="tabular">最大 {formatKg(b.maxWeightKg)} kg</p>
                    <p className="tabular text-xs text-muted">
                      1日最大 {formatVolume(b.maxDailyVolumeKg)}
                    </p>
                  </div>
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
    <div className="rounded-app bg-surface-muted px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  )
}
