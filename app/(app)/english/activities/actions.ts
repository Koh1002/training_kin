'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

/** ユーザー独自の学習項目の追加・削除。 */

const schema = z.object({
  skillCode: z.enum(['reading', 'listening', 'speaking', 'writing']),
  nameJa: z.string().trim().min(1, '項目名を入力してください').max(40),
  description: z.string().trim().max(120).nullish(),
})

export type ActionState = { ok: boolean; message?: string }

export async function createActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }

  const parsed = schema.safeParse({
    skillCode: formData.get('skillCode'),
    nameJa: formData.get('nameJa'),
    description: formData.get('description'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('english_activities').insert({
    user_id: user.id,
    skill_code: parsed.data.skillCode,
    name_ja: parsed.data.nameJa,
    description: parsed.data.description || null,
    sort_order: 900,
  })

  if (error) return { ok: false, message: `追加に失敗しました: ${error.message}` }

  revalidatePath('/english')
  revalidatePath('/english/activities')
  return { ok: true, message: `「${parsed.data.nameJa}」を追加しました` }
}

export async function deleteActivity(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = formData.get('activityId')
  if (typeof id !== 'string') return

  const supabase = await createClient()
  // 記録済みの項目は消さずに隠す（過去のログを壊さないため）
  const { count } = await supabase
    .from('english_logs')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', id)

  if (count && count > 0) {
    await supabase
      .from('english_activities')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id)
  } else {
    await supabase.from('english_activities').delete().eq('id', id).eq('user_id', user.id)
  }

  revalidatePath('/english')
  revalidatePath('/english/activities')
}
