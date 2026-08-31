import { X } from 'lucide-react'
import { IconButton } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import { Card, CardTitle } from '@/components/ui/card'
import { SubNav } from '@/components/sub-nav'
import { muscleName } from '@/lib/muscles'
import { getCurrentUser } from '@/lib/supabase/server'
import { getExercises } from '@/lib/workout/queries'
import type { ExerciseCategory } from '@/types/database'
import { WORKOUT_NAV } from '../nav'
import { ExerciseForm } from './exercise-form'
import { deleteExercise } from './actions'

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  chest: '胸',
  back: '背中',
  shoulder: '肩',
  arm: '腕',
  leg: '脚',
  core: '体幹',
  cardio: '有酸素',
}

const LOAD_TYPE_LABEL = {
  weight: '重量',
  bodyweight: '自重',
  time: '時間',
  cardio: '有酸素',
} as const

export default async function ExercisesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const exercises = await getExercises()
  const byCategory = new Map<ExerciseCategory, typeof exercises>()
  for (const e of exercises) {
    byCategory.set(e.category, [...(byCategory.get(e.category) ?? []), e])
  }

  return (
    <>
      <SubNav items={WORKOUT_NAV} />

      <div className="space-y-4">
        <Card>
          <CardTitle>種目を追加</CardTitle>
          <ExerciseForm />
        </Card>

        {[...byCategory.entries()].map(([category, list]) => (
          <Card key={category}>
            <CardTitle right={<span className="text-xs text-muted">{list.length}種目</span>}>
              {CATEGORY_LABEL[category]}
            </CardTitle>
            <ul className="divide-y divide-border">
              {list.map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">
                      {e.name_ja}
                      {e.memo_alias && e.memo_alias !== e.name_ja ? (
                        <span className="ml-1.5 text-xs text-muted">（メモ: {e.memo_alias}）</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {LOAD_TYPE_LABEL[e.load_type]}
                      {e.load_type === 'bodyweight' ? ` ×${e.bodyweight_factor}` : ''}
                      {e.is_unilateral ? ' ・左右別' : ''}
                      {' ・ '}
                      {e.exercise_muscles
                        .slice()
                        .sort((a, b) => b.contribution - a.contribution)
                        .map((m) => muscleName(m.muscle_code))
                        .join('・')}
                    </p>
                  </div>
                  {e.user_id ? (
                    <form action={deleteExercise}>
                      <input type="hidden" name="exerciseId" value={e.id} />
                      <IconButton type="submit" size="sm" aria-label={`${e.name_ja}を削除`}>
                        <X size={15} aria-hidden />
                      </IconButton>
                    </form>
                  ) : (
                    <span className="shrink-0 rounded-app-sm border border-border px-1.5 py-0.5 text-[11px] text-muted">
                      共通
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
