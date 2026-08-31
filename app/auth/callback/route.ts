import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { authCallbackParams } from '@/lib/auth-callback-params'
import { NEXT_COOKIE } from '@/lib/auth-next-cookie'
import { safeDestination } from '@/lib/safe-redirect'
import { createClient } from '@/lib/supabase/server'

/**
 * マジックリンクから戻ってきたときのセッション確立。
 *
 * PKCE の `code` と、テンプレートの世代によって使われる `token_hash` の両方を受ける。
 * どちらで来るかは Supabase 側の設定次第で、片方しか見ないと「リンクは開くのに
 * ログインされない」という分かりにくい失敗になる。
 *
 * ログイン後の行き先は Cookie から取る。かつては戻り先の URL に `?next=…` を
 * 付けていたが、それだと Supabase の Redirect URLs の照合に通らず、戻り先ごと
 * Site URL に差し替えられてここに到達しなかった。詳細は lib/auth-next-cookie.ts。
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

  const supabase = await createClient()
  const { error } =
    params.kind === 'code'
      ? await supabase.auth.exchangeCodeForSession(params.code)
      : await supabase.auth.verifyOtp({ token_hash: params.tokenHash, type: params.type })

  if (error) {
    return redirectTo('/login?error=exchange_failed')
  }

  return redirectTo(destination)
}
