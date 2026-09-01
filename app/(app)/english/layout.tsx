import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { todayJst, weekStart } from '@/lib/date'
import { nextSkill, weeklyProgress } from '@/lib/english/balance'
import {
  getActivities,
  getGoals,
  getRecentLogs,
  lastDoneBySkill,
  sumBySkill,
} from '@/lib/english/queries'
import { EnglishRecordSheet } from './record-sheet'

/**
 * 英語のどの画面からでも記録できるように、右下のボタンをここに置く。
 *
 * 最初に選んでおく技能は、記録画面と同じ「いちばん遅れているもの」にする。
 * 開いた瞬間にやるべき技能が選ばれているぶん、タップが 1 回減る。
 */
export default async function EnglishLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const today = todayJst()
  const [activities, goals, recentLogs] = await Promise.all([
    getActivities(),
    getGoals(user.id),
    getRecentLogs(user.id, today),
  ])

  const thisWeekStart = weekStart(today)
  const weekLogs = recentLogs.filter((log) => weekStart(log.date) === thisWeekStart)
  const progress = weeklyProgress(sumBySkill(weekLogs), goals)
  const focus = nextSkill(progress, lastDoneBySkill(recentLogs))

  return (
    <>
      {children}
      <EnglishRecordSheet today={today} activities={activities} defaultSkill={focus} />
    </>
  )
}
