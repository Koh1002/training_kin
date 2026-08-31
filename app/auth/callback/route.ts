import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * マジックリンクから戻ってきたときのセッション確立。
 * Supabase は PKCE の `code` を付けてここへリダイレクトしてくる。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // オープンリダイレクトを防ぐため、自サイト内の絶対パスだけを受け付ける
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/workout'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=exchange_failed', origin))
  }

  return NextResponse.redirect(new URL(destination, origin))
}
