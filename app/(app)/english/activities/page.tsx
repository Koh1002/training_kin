import { redirect } from 'next/navigation'
import { Card, CardTitle } from '@/components/ui/card'
import { SubNav } from '@/components/sub-nav'
import { SKILL_CODES, SKILL_LABELS, SKILL_LABELS_JA } from '@/lib/english/balance'
import { getActivities } from '@/lib/english/queries'
import { getCurrentUser } from '@/lib/supabase/server'
import { ENGLISH_NAV } from '../nav'
import { ActivityForm } from './activity-form'
import { deleteActivity } from './actions'

export default async function ActivitiesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const activities = await getActivities()

  return (
    <>
      <SubNav items={ENGLISH_NAV} accent="var(--accent-english)" />

      <div className="space-y-4">
        <Card>
          <CardTitle>項目を追加</CardTitle>
          <ActivityForm />
        </Card>

        {SKILL_CODES.map((code) => {
          const list = activities.filter((a) => a.skill_code === code)
          return (
            <Card key={code}>
              <CardTitle right={<span className="text-xs text-muted">{list.length}項目</span>}>
                {SKILL_LABELS[code]}（{SKILL_LABELS_JA[code]}）
              </CardTitle>
              <ul className="divide-y divide-border">
                {list.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px]">{a.name_ja}</p>
                      {a.description ? (
                        <p className="truncate text-xs text-muted">{a.description}</p>
                      ) : null}
                    </div>
                    {a.user_id ? (
                      <form action={deleteActivity}>
                        <input type="hidden" name="activityId" value={a.id} />
                        <button type="submit" aria-label={`${a.name_ja}を削除`} className="px-1 text-muted">
                          ✕
                        </button>
                      </form>
                    ) : (
                      <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">
                        共通
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
    </>
  )
}
