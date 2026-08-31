'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { describeSendError, describeVerifyError } from '@/lib/auth-errors'
import { safeDestination } from '@/lib/safe-redirect'
import { resolveOrigin } from '@/lib/site-origin'
import { createClient } from '@/lib/supabase/server'

/**
 * ログイン。パスワードを持たないので流出のリスクがない。
 *
 * 1 通のメールに「マジックリンク」と「6 桁のコード」の両方が入る。
 * リンクはメールクライアントが長い URL を折り返すと途中で切れることがあり、
 * その場合ホスト名が壊れて開けない。コードならその壊れ方をしないうえ、
 * 通知のプレビューだけ見て入力できるのでアプリを行き来せずに済む。
 *
 * コードを届けるには Supabase の Magic Link テンプレートに {{ .Token }} が要る。
 * 詳細は README を参照。
 */

const emailSchema = z.object({
  email: z.email({ message: 'メールアドレスの形式が正しくありません' }),
  next: z.string().optional(),
})

export type LoginState =
  | { status: 'idle' }
  // tone は通知の色。送信上限のときも入力欄までは進めるので、
  // 「送れた」と「送れなかったが手元のコードで進める」を色で区別する。
  | {
      status: 'sent'
      email: string
      message: string
      /** 設定の直し方など、本文より一段小さく添える補足。 */
      hint?: string
      tone: 'info' | 'warning'
    }
  | { status: 'error'; message: string }

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({
    email: formData.get('email'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  // マジックリンクの戻り先。SITE_URL に NEXT_PUBLIC_ を付けていないのは、
  // ここが Server Action の中だけで読まれ、ブラウザでは一度も評価されないため。
  // 明らかに使えない設定（本番なのに localhost など）は resolveOrigin が弾く。
  const headerList = await headers()
  const origin = resolveOrigin(
    process.env.SITE_URL,
    headerList.get('x-forwarded-host') ?? headerList.get('host'),
  )

  const redirectTo = new URL('/auth/callback', origin)
  if (parsed.data.next) redirectTo.searchParams.set('next', parsed.data.next)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo.toString() },
  })

  if (error) {
    const info = describeSendError(error.code, error.status, error.message)

    // 送信上限に当たったということは、直前のメールが届いているということでもある。
    // そのコードがまだ有効な可能性が高いので、入力欄まで進めて手元のコードを使わせる。
    // ここで止めると、使えるコードを持ったまま足止めすることになる。
    if (info.canUseExistingCode) {
      return {
        status: 'sent',
        email: parsed.data.email,
        message: info.message,
        hint: info.hint,
        tone: 'warning',
      }
    }

    return { status: 'error', message: info.message }
  }

  return {
    status: 'sent',
    email: parsed.data.email,
    message: `${parsed.data.email} にログイン用のリンクとコードを送りました。`,
    // 戻り先を画面に出す。「メールのリンクが localhost に飛ぶ」とき、原因が
    // アプリ側（送っている値そのものが localhost）なのか Supabase 側
    // （redirect_to が Redirect URLs に無く Site URL に差し替えられた）なのかは、
    // 送った値が見えないと切り分けられない。ここに出ている値とメールの
    // リンクが食い違っていれば、原因は Supabase の設定側だと確定する。
    hint: `戻り先: ${redirectTo.toString()}`,
    tone: 'info',
  }
}

const codeSchema = z.object({
  email: z.email({ message: 'メールアドレスが不正です' }),
  // Supabase の OTP は 6 桁の数字
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: '6桁の数字を入力してください' }),
  next: z.string().optional(),
})

export type VerifyState = { status: 'idle' | 'error'; message?: string }

/** メールに届いた 6 桁のコードでログインする。 */
export async function verifyOtpCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const parsed = codeSchema.safeParse({
    email: formData.get('email'),
    token: formData.get('token'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: 'email',
  })

  if (error) {
    return { status: 'error', message: describeVerifyError(error.code, error.status) }
  }

  // 成功したら遷移する。redirect() は例外を投げて制御を返さないので、
  // この後に到達するコードは無い。
  redirect(safeDestination(parsed.data.next))
}
