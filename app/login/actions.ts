'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  email: z.email({ message: 'メールアドレスの形式が正しくありません' }),
  next: z.string().optional(),
})

export type LoginState = { status: 'idle' | 'sent' | 'error'; message?: string }

/**
 * マジックリンクを送る。パスワードを持たないので流出のリスクが無く、
 * スマホと PC のどちらからでもメールを開くだけでログインできる。
 */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const headerList = await headers()
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${headerList.get('x-forwarded-host') ?? headerList.get('host')}`

  const redirectTo = new URL('/auth/callback', origin)
  if (parsed.data.next) redirectTo.searchParams.set('next', parsed.data.next)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo.toString() },
  })

  if (error) {
    return { status: 'error', message: `送信に失敗しました: ${error.message}` }
  }

  return { status: 'sent', message: `${parsed.data.email} にログイン用のリンクを送りました。` }
}
