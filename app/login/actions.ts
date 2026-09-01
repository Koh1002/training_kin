'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { describePasswordError, SIGNUP_NEEDS_CONFIRMATION } from '@/lib/auth-errors'
import { safeDestination } from '@/lib/safe-redirect'
import { createClient } from '@/lib/supabase/server'

/**
 * ログイン。メールアドレスとパスワード。
 *
 * 以前はマジックリンクだったが、**アプリ側では直せない理由で通らなかった**。
 * リンクの戻り先は `/auth/callback` まで届いていたのに、PKCE のコード交換に必要な
 * 値がメールを送ったブラウザの Cookie にしか無く、スマートフォンでメールアプリ内の
 * ブラウザがリンクを開くと必ず失敗する。@supabase/ssr は flowType を pkce に
 * 固定していて上書きできず、6 桁コードに逃げる道も、Supabase がメールテンプレートの
 * 編集を独自 SMTP とセットにしているため塞がっていた。
 *
 * メールの往復をやめると、戻り先の設定・PKCE・送信上限がまとめて要らなくなる。
 * 利用者が 1 人なので、この交換で失うものはほぼ無い。
 */

const credentialsSchema = z.object({
  email: z.email({ message: 'メールアドレスの形式が正しくありません' }),
  // Supabase の既定は 6 文字。ここは少し厳しくしておく
  password: z.string().min(8, { message: 'パスワードは8文字以上にしてください' }),
  next: z.string().optional(),
})

export type AuthState = { status: 'idle' | 'error'; message?: string }

function parse(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  })
}

/** 既存のアカウントでログインする。 */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parse(formData)
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return {
      status: 'error',
      message: describePasswordError(error.code, error.status, error.message),
    }
  }

  redirect(safeDestination(parsed.data.next))
}

/** 新しくアカウントを作る。 */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parse(formData)
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return {
      status: 'error',
      message: describePasswordError(error.code, error.status, error.message),
    }
  }

  // エラーが無いことは、入れることを意味しない。「Confirm email」が有効だと
  // Supabase は確認メールを送ってセッションを返さない。ここを見ないと、
  // 登録できたように見えて入れない、という一番分かりにくい形になる。
  if (!data.session) {
    return { status: 'error', message: SIGNUP_NEEDS_CONFIRMATION }
  }

  redirect(safeDestination(parsed.data.next))
}
