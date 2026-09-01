'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { describePasswordError } from '@/lib/auth-errors'
import { SKILL_CODES } from '@/lib/english/balance'
import { SORENESS_CURVES } from '@/lib/workout/soreness'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export type ActionState = { ok: boolean; message?: string }

const profileSchema = z.object({
  displayName: z.string().trim().max(40).nullish(),
  bodyweightKg: z.coerce.number().positive('体重を入力してください').max(500),
  sorenessCurve: z.enum(['same_day_peak', 'delayed_peak']),
})

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }

  const parsed = profileSchema.safeParse({
    displayName: formData.get('displayName'),
    bodyweightKg: formData.get('bodyweightKg'),
    sorenessCurve: formData.get('sorenessCurve'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: parsed.data.displayName || null,
    bodyweight_kg: parsed.data.bodyweightKg,
    soreness_curve: [...SORENESS_CURVES[parsed.data.sorenessCurve]],
    updated_at: new Date().toISOString(),
  })

  if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` }

  // 体重は自重種目の負荷に効くので、筋トレ画面も作り直す
  revalidatePath('/workout')
  revalidatePath('/settings')
  return { ok: true, message: '保存しました' }
}

const goalsSchema = z.object({
  reading: z.coerce.number().int().min(0).max(10080),
  listening: z.coerce.number().int().min(0).max(10080),
  speaking: z.coerce.number().int().min(0).max(10080),
  writing: z.coerce.number().int().min(0).max(10080),
})

export async function updateGoals(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }

  const parsed = goalsSchema.safeParse(Object.fromEntries(SKILL_CODES.map((c) => [c, formData.get(c)])))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('english_goals').upsert(
    SKILL_CODES.map((code) => ({
      user_id: user.id,
      skill_code: code,
      weekly_target_min: parsed.data[code],
    })),
    { onConflict: 'user_id,skill_code' },
  )

  if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` }

  revalidatePath('/english')
  revalidatePath('/settings')
  return { ok: true, message: '週の目標を保存しました' }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

const passwordSchema = z
  .object({
    password: z.string().min(8, { message: 'パスワードは8文字以上にしてください' }),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: '確認用のパスワードが一致しません',
  })

/**
 * パスワードを変える。
 *
 * 忘れたときの復旧手段が Supabase の管理画面しか無い状態にはしない。
 * メール送信を使わない構成なので、パスワードの再発行メールも届かない。
 */
export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }

  const parsed = passwordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return { ok: false, message: describePasswordError(error.code, error.status, error.message) }
  }

  return { ok: true, message: 'パスワードを変更しました' }
}
