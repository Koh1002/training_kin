'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { describeSendError, describeVerifyError } from '@/lib/auth-errors'
import { parseMagicLink } from '@/lib/auth-link'
import { isSecureOrigin, NEXT_COOKIE, nextCookieOptions } from '@/lib/auth-next-cookie'
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

  // クエリ文字列は付けない。Supabase は戻り先を Redirect URLs のパターンと
  // URL 全体で照合し、一致しなければ値を捨てて Site URL に差し替える。
  // `?next=…` が付くと完全一致の登録に一致せず、差し替えられた結果
  // /auth/callback を通らないままログインが失敗する。行き先は Cookie で運ぶ。
  const redirectTo = new URL('/auth/callback', origin)

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

  // 行き先を預ける。書く時点で安全な値に丸めておけば、読み取り側が
  // 壊れた値を受け取ることがない。
  if (parsed.data.next) {
    const cookieStore = await cookies()
    cookieStore.set(NEXT_COOKIE, safeDestination(parsed.data.next), nextCookieOptions(isSecureOrigin(origin)))
  }

  return {
    status: 'sent',
    email: parsed.data.email,
    // 「コードを送りました」とは書かない。テンプレートに {{ .Token }} が無ければ
    // コードは本文に入らず、その編集には独自 SMTP が要る。届かないものを
    // 届いたことにすると、探して見つからず詰まる。
    message: `${parsed.data.email} にログイン用のメールを送りました。`,
    // 戻り先を画面に出す。「メールのリンクが localhost に飛ぶ」とき、原因が
    // アプリ側（送っている値そのものが localhost）なのか Supabase 側
    // （redirect_to が Redirect URLs に無く Site URL に差し替えられた）なのかは、
    // 送った値が見えないと切り分けられない。ここに出ている値とメールの
    // リンクが食い違っていれば、原因は Supabase の設定側だと確定する。
    hint: `戻り先: ${redirectTo.toString()}`,
    tone: 'info',
  }
}

/**
 * 預けてある行き先を消す。
 *
 * /auth/callback 以外の経路（6 桁コード、貼り付け）は行き先を hidden field で
 * 受け取るので Cookie は使わないが、消さないと 15 分間残り、次のログインで
 * 前回の行き先に飛ばされる。
 */
async function clearNextCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(NEXT_COOKIE)
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

  await clearNextCookie()

  // 成功したら遷移する。redirect() は例外を投げて制御を返さないので、
  // この後に到達するコードは無い。
  redirect(safeDestination(parsed.data.next))
}

const linkSchema = z.object({
  url: z.string().trim().min(1, { message: 'リンクを貼り付けてください' }),
  next: z.string().optional(),
})

/**
 * メールのリンクを貼り付けてログインする。
 *
 * リンクの戻り先が壊れていると、開いても何も起きないか localhost に飛んで終わる。
 * ただしリンクそのものには token が入っているので、戻り先を経由せずここで検証すれば
 * 入れる。テンプレートを編集できない（Supabase はメールテンプレートの編集を
 * 独自 SMTP の設定とセットにしている）環境では、6 桁コードが本文に入らないため
 * これが最後の手段になる。
 */
export async function verifyMagicLinkUrl(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const parsed = linkSchema.safeParse({
    url: formData.get('url'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const link = parseMagicLink(parsed.data.url)
  if (!link) {
    return {
      status: 'error',
      message:
        'リンクとして読み取れませんでした。メール本文のボタンを長押し（右クリック）して、'
        + 'リンクのアドレスをそのままコピーしてください。',
    }
  }

  const supabase = await createClient()
  const { data, error } =
    link.kind === 'token'
      ? await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      : await supabase.auth.exchangeCodeForSession(link.code)

  if (error || !data.session) {
    // 2 つの形で失敗の理由が違う。token（メール本文のリンク）はログインの途中の値を
    // 使わないので、ブラウザが違っても通る——駄目なら本当に期限切れか使用済み。
    // code（開いた先のアドレス）は送信したブラウザの、いちばん新しいメールのぶんしか
    // 使えない。ここを一緒くたにすると原因を取り違えさせる。
    return {
      status: 'error',
      message:
        link.kind === 'token'
          ? 'このリンクは使えませんでした。すでに開いたか、有効期限が切れています。'
            + 'メールを送り直して、届いた新しいリンクを貼り付けてください。'
          : 'このアドレスでは入れませんでした。メールを送ったのと同じブラウザで、'
            + 'いちばん新しいメールのぶんだけが使えます。'
            + 'メール本文のリンク（supabase.co で始まるもの）を貼ると、この制限がありません。',
    }
  }

  // 行き先は hidden field で受け取っているので、預けてある Cookie は用済み。
  // 消さずに置くと、次に別経路でログインしたとき前回の行き先に飛ばされる。
  await clearNextCookie()

  redirect(safeDestination(parsed.data.next))
}
