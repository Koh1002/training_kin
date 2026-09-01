import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { authCallbackParams } from '@/lib/auth-callback-params'
import { NEXT_COOKIE } from '@/lib/auth-next-cookie'
import { safeDestination } from '@/lib/safe-redirect'
import { createClient } from '@/lib/supabase/server'

/**
 * マジックリンクから戻ってきたときのセッション確立。
 *
 * 受けるのは PKCE の `code` と、Supabase 側が返すエラーだけ。`token_hash` は
 * ここでは受けない（理由は lib/auth-callback-params.ts）。貼り付けフォームには残る。
 *
 * ログイン後の行き先は Cookie から取る。戻り先の URL に `?next=…` を付けると
 * Redirect URLs の照合に通らず、戻り先ごと Site URL に差し替えられてここに
 * 到達しない。詳細は lib/auth-next-cookie.ts。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const cookieStore = await cookies()
  // 書くときにも safeDestination を通しているが、ここでも通す。
  // 検査を片側だけにすると、将来この Cookie を書く経路が増えたときに気付けない。
  const destination = safeDestination(cookieStore.get(NEXT_COOKIE)?.value)

  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin))
    // 使い終わった行き先は消す。期限任せにすると、次のログインで
    // 前回の行き先に飛ばされる。
    response.cookies.delete(NEXT_COOKIE)
    return response
  }

  const params = authCallbackParams(searchParams)

  if (!params) {
    return redirectTo('/login?error=missing_code')
  }

  // Supabase 側が理由を返しているなら、それをそのまま画面に伝える
  if (params.kind === 'error') {
    return redirectTo(`/login?error=${encodeURIComponent(params.code)}`)
  }

  const supabase = await createClient()
  // セッションの有無をここで見る必要は無い。exchangeCodeForSession は
  // セッションが無ければ自分でエラーを返す（GoTrueClient.ts の
  // AuthInvalidTokenResponseError）。到達しない分岐を置くと、起こり得ない状態を
  // 扱っているように読めてしまう。verifyOtp を呼ぶ貼り付け経路にはこの保証が
  // 無いので、あちらでは data.session を見ている。
  const { error } = await supabase.auth.exchangeCodeForSession(params.code)

  if (error) {
    return redirectTo('/login?error=exchange_failed')
  }

  return redirectTo(destination)
}
