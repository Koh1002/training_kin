'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { MUSCLE_CODES } from '@/lib/muscles'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

/** ユーザー独自の種目の追加・削除。共通マスタは RLS 側で編集を拒否している。 */

const createSchema = z.object({
  nameJa: z.string().trim().min(1, '種目名を入力してください').max(40),
  category: z.enum(['chest', 'back', 'shoulder', 'arm', 'leg', 'core', 'cardio']),
  loadType: z.enum(['weight', 'bodyweight', 'time', 'cardio']),
  bodyweightFactor: z.coerce.number().positive().max(2).nullish(),
  isUnilateral: z.boolean(),
  muscles: z.array(z.enum(MUSCLE_CODES)).min(1, '効く部位を1つ以上選んでください'),
})

export type ActionState = { ok: boolean; message?: string }

export async function createExercise(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }

  const loadType = formData.get('loadType')
  const parsed = createSchema.safeParse({
    nameJa: formData.get('nameJa'),
    category: formData.get('category'),
    loadType,
    // 自重種目のときだけ係数を要求する
    bodyweightFactor: loadType === 'bodyweight' ? (formData.get('bodyweightFactor') ?? 0.65) : null,
    isUnilateral: formData.get('isUnilateral') === 'on',
    muscles: formData.getAll('muscles').map(String),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const input = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: user.id,
      name_ja: input.nameJa,
      category: input.category,
      load_type: input.loadType,
      bodyweight_factor: input.loadType === 'bodyweight' ? (input.bodyweightFactor ?? 0.65) : null,
      is_unilateral: input.isUnilateral,
      default_reps: input.loadType === 'cardio' ? null : 10,
      default_sets: input.loadType === 'cardio' ? null : 3,
      sort_order: 900,
    })
    .select('id')
    .single()

  if (error) return { ok: false, message: `追加に失敗しました: ${error.message}` }

  // 主働筋を 1.0、残りを 0.5 として登録する。細かい調整は後から DB で変えられる。
  const { error: mapError } = await supabase.from('exercise_muscles').insert(
    input.muscles.map((code, index) => ({
      exercise_id: data.id,
      muscle_code: code,
      contribution: index === 0 ? 1 : 0.5,
    })),
  )

  if (mapError) return { ok: false, message: `部位の登録に失敗しました: ${mapError.message}` }

  revalidatePath('/workout')
  revalidatePath('/workout/exercises')
  return { ok: true, message: `「${input.nameJa}」を追加しました` }
}

export async function deleteExercise(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = formData.get('exerciseId')
  if (typeof id !== 'string') return

  const supabase = await createClient()
  // 記録に使われている種目は消さず、一覧から隠すだけにする（履歴を壊さないため）
  const { count } = await supabase
    .from('workout_sets')
    .select('id', { count: 'exact', head: true })
    .eq('exercise_id', id)

  if (count && count > 0) {
    await supabase.from('exercises').update({ is_active: false }).eq('id', id).eq('user_id', user.id)
  } else {
    await supabase.from('exercises').delete().eq('id', id).eq('user_id', user.id)
  }

  revalidatePath('/workout')
  revalidatePath('/workout/exercises')
}
