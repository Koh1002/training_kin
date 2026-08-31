'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

/** 英語学習の記録。入力は「項目 + 分」だけに絞って続けやすくしている。 */

const addLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が正しくありません'),
  activityId: z.uuid('項目を選んでください'),
  minutes: z.coerce.number().int().positive('1分以上で入力してください').max(1440),
  note: z.string().max(200).nullish(),
})

export type ActionState = { ok: boolean; message?: string }

export async function addEnglishLog(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }

  const parsed = addLogSchema.safeParse({
    date: formData.get('date'),
    activityId: formData.get('activityId'),
    minutes: formData.get('minutes'),
    note: formData.get('note'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('english_logs').insert({
    user_id: user.id,
    date: parsed.data.date,
    activity_id: parsed.data.activityId,
    minutes: parsed.data.minutes,
    note: parsed.data.note || null,
  })

  if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` }

  revalidatePath('/english')
  return { ok: true, message: `${parsed.data.minutes}分を記録しました` }
}

export async function deleteEnglishLog(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = formData.get('logId')
  if (typeof id !== 'string') return

  const supabase = await createClient()
  await supabase.from('english_logs').delete().eq('id', id).eq('user_id', user.id)

  revalidatePath('/english')
}
