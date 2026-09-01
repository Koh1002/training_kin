import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { shiftDate, todayJst } from '@/lib/date'
import { getExercises, getLastInputs, getProfile } from '@/lib/workout/queries'
import { WorkoutRecordSheet } from './record-sheet'

/**
 * 筋トレのどの画面からでも記録できるように、右下のボタンをここに置く。
 * 記録に要るデータ（種目・前回値・体重）はここで 1 回だけ取る。
 */
export default async function WorkoutLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const today = todayJst()
  const [profile, exercises, lastInputs] = await Promise.all([
    getProfile(user.id),
    getExercises(),
    getLastInputs(user.id, shiftDate(today, -1)),
  ])

  return (
    <>
      {children}
      <WorkoutRecordSheet
        today={today}
        exercises={exercises}
        lastInputs={Object.fromEntries(lastInputs)}
        recentExerciseIds={[...lastInputs.keys()]}
        bodyweightKg={profile?.bodyweight_kg ?? 65}
      />
    </>
  )
}
