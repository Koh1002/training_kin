import { redirect } from 'next/navigation'
import { Card, CardTitle } from '@/components/ui/card'
import { getGoals } from '@/lib/english/queries'
import { getCurrentUser } from '@/lib/supabase/server'
import { getProfile } from '@/lib/workout/queries'
import { matchCurvePreset } from '@/lib/workout/soreness'
import { GoalsForm, ProfileForm } from './settings-forms'
import { signOut } from './actions'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [profile, goals] = await Promise.all([getProfile(user.id), getGoals(user.id)])
  const curveKey = matchCurvePreset(profile?.soreness_curve ?? []) ?? 'same_day_peak'

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>プロフィール</CardTitle>
        <ProfileForm
          displayName={profile?.display_name ?? ''}
          bodyweightKg={profile?.bodyweight_kg ?? 65}
          curveKey={curveKey}
        />
      </Card>

      <Card>
        <CardTitle>英語の週間目標</CardTitle>
        <GoalsForm goals={goals} />
      </Card>

      <Card>
        <CardTitle>アカウント</CardTitle>
        <p className="mb-3 text-sm text-muted">{user.email}</p>
        <form action={signOut}>
          <button type="submit" className="rounded-xl border border-border px-4 py-2 text-sm">
            ログアウト
          </button>
        </form>
      </Card>
    </div>
  )
}
