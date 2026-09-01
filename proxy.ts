import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { authCallbackParams } from '@/lib/auth-callback-params'
import { missingSupabaseEnv } from '@/lib/supabase/env'

/**
 * Next.js 16 では middleware が proxy にリネームされた。
 * ここでは Supabase のセッション Cookie を更新しつつ、
 * 未ログインのアクセスを /login に送る楽観的なガードを行う。
 * 本来の認可はページ側の getUser() と DB の RLS が担保する。
 */
// 認証なしで配信するパス。
// manifest はブラウザがログイン前に取りに来るので、ここに入れないと
// ログイン画面の HTML が返り、ホーム画面に追加してもアプリ名もアイコンも付かない。
const PUBLIC_PATHS = ['/login', '/auth', '/manifest.webmanifest']

export async function proxy(request: NextRequest) {
  // 環境変数が無いまま Supabase クライアントを作ると、ライブラリの奥で落ちて
  // 画面には素の「Internal Server Error」しか出ない。何が足りないかを画面に出す。
  const missing = missingSupabaseEnv()
  if (missing.length > 0) return setupRequiredResponse(missing)

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
          // 認証 Cookie を載せたレスポンスは CDN にキャッシュさせない
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value)
          }
        },
      },
    },
  )

  // getUser() を呼ぶことでトークンのリフレッシュと Cookie の書き戻しが走る
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  /*
   * getUser() はトークンの期限が切れていれば更新する。新しいトークンは setAll 経由で
   * `response` に溜まっているので、**リダイレクトを返すときも必ず載せ替える**。
   * 新しい NextResponse.redirect() をそのまま返すと、更新後のトークンがブラウザに
   * 届かない一方で古いリフレッシュトークンは使用済みになり、次のアクセスで
   * 突然ログアウトする。@supabase/ssr 自身が警告している失敗そのもの。
   */
  const redirectKeeping = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    return redirect
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  // ログインの結果が /auth/callback 以外に着地したら、そこへ回す。
  // Supabase は戻り先が Redirect URLs に一致しないと Site URL に差し替えるので、
  // コードやエラーがサイトのルートに落ちることがある。以前はそれを /login に
  // 飛ばして捨てていた（URL に残っているのに、見る場所が無かった）。
  //
  // 公開パスは対象外。ここを外すと /login?error=… 自体がコールバックに見え、
  // /auth/callback がまた /login?error=… を返して無限に往復する。
  if (!isPublic && authCallbackParams(request.nextUrl.searchParams)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return redirectKeeping(url)
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return redirectKeeping(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/workout'
    // ログインに失敗して戻ってきた場合は、その理由を読ませてから追い出す。
    // ここで search ごと捨てると、失敗の説明が誰にも見えない。
    if (request.nextUrl.searchParams.has('error')) return response
    url.search = ''
    return redirectKeeping(url)
  }

  return response
}

/**
 * 設定不足を伝える画面。原因と直し方をその場に書く。
 *
 * Vercel の環境変数は Production / Preview / Development が別管理で、
 * Production にだけ登録するとプレビューには届かない。実際にこれで詰まったので、
 * その可能性を最初に挙げている。
 */
function setupRequiredResponse(missing: string[]): NextResponse {
  const items = missing.map((name) => `<li><code>${name}</code></li>`).join('')
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>設定が必要です</title>
<style>
  :root { color-scheme: light dark }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
    font-family: ui-sans-serif, system-ui, -apple-system, "Hiragino Kaku Gothic ProN", sans-serif;
    background:#fafafa; color:#18181b }
  @media (prefers-color-scheme: dark) { body { background:#151515; color:#f2f2f2 } }
  main { max-width:34rem; line-height:1.7 }
  h1 { font-size:1.25rem; margin:0 0 .75rem }
  code { font-family: ui-monospace, monospace; font-size:.875em;
    background:rgb(128 128 128 / .15); padding:.1em .4em; border-radius:.3em }
  ol, ul { padding-left:1.25rem }
  li { margin:.25rem 0 }
  p { margin:.75rem 0 }
  .muted { opacity:.7; font-size:.875rem }
</style></head>
<body><main>
  <h1>環境変数が設定されていません</h1>
  <p>このデプロイには次が届いていません。</p>
  <ul>${items}</ul>
  <p><strong>Vercel の環境変数は Production / Preview / Development が別管理です。</strong>
     Production にだけ登録すると、プレビュー用のデプロイには届きません。
     ブランチ名が入った URL を開いている場合はこれが原因です。</p>
  <ol>
    <li>Vercel の Settings → Environment Variables を開く</li>
    <li>上の変数が Preview にもチェックが入っているか確認する</li>
    <li>変更したら再デプロイする</li>
  </ol>
  <p class="muted">値は Supabase の Project Settings → API から取得します。
     anon（publishable）キーを使ってください。</p>
</main></body></html>`

  return new NextResponse(html, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export const config = {
  matcher: [
    // 静的ファイルと画像最適化を除く全てのリクエスト
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
