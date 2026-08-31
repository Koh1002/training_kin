/**
 * ログイン後の行き先を、メールの往復のあいだ預かる Cookie。
 *
 * かつてはマジックリンクの戻り先に `?next=/workout` を付けていた。しかし Supabase は
 * 渡された戻り先を Redirect URLs のパターンと**URL 全体で**照合し、一致しなければ
 * その値を捨てて Site URL に差し替える。完全一致で登録した
 * `https://…/auth/callback` は、クエリの付いた `…/auth/callback?next=%2Fworkout` に
 * 一致しない。差し替えが起きるとコードはサイトのルートに着地し、
 * `exchangeCodeForSession` を呼ぶ /auth/callback を通らないままログインが失敗する。
 *
 * 未ログインでアプリを開くと proxy が必ず `/login?next=…` に飛ばすので、
 * これは例外的な経路ではなく通常の経路だった。
 *
 * 戻り先からクエリを外し、行き先はこの Cookie で運ぶ。戻り先が常に
 * `<origin>/auth/callback` ちょうどになるので、許可リストは完全一致の 1 件で足り、
 * ダッシュボードの設定とアプリの挙動がずれる余地が無くなる。
 *
 * 名前と属性をここに集めているのは、設定側と読み取り側で属性が食い違うと
 * 「書けているのに読めない」という気づきにくい壊れ方をするため。
 */

export const NEXT_COOKIE = 'login_next'

/** ログインの往復より長く残す意味がない。期限切れの行き先で飛ばされる方が困る。 */
const MAX_AGE_SECONDS = 15 * 60

export type NextCookieOptions = {
  httpOnly: true
  sameSite: 'lax'
  path: '/'
  maxAge: number
  secure: boolean
}

/**
 * @param secure https のときだけ true。ローカル開発（http）で付けると保存されず、
 *               行き先が毎回失われる。
 */
export function nextCookieOptions(secure: boolean): NextCookieOptions {
  return {
    httpOnly: true,
    // 'strict' にしてはいけない。この Cookie はメールのリンクを踏んで
    // 外部（メールクライアント）から戻ってきたリクエストで送られる必要がある。
    // 'strict' だとそのとき送られず、行き先を復元できない。
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    secure,
  }
}

/** origin が https かどうか。壊れた値なら secure を付けない（付けると保存されない）。 */
export function isSecureOrigin(origin: string): boolean {
  try {
    return new URL(origin).protocol === 'https:'
  } catch {
    return false
  }
}
