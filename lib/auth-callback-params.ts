import { isOtpType, type MagicLinkOtpType } from '@/lib/auth-link'

/**
 * リクエストのクエリから、ログインを成立させられる値を取り出す。
 *
 * Supabase は戻り先が Redirect URLs に一致しないとき、その値を捨てて **Site URL** に
 * 差し替える。すると `?code=…` はサイトのルートに着地し、`/auth/callback` を
 * 通らない。かつてはそこで proxy が `/login` に飛ばして終わりだった——URL に
 * コードが残っているのに、それを見る場所が無かった。
 *
 * 自分のドメインに届いた値は、どのパスに落ちたかに関わらず拾う。設定と実際の
 * 戻り先がずれても、症状が出なくなる。
 */
export type AuthCallbackParams =
  | { kind: 'code'; code: string }
  | { kind: 'token'; tokenHash: string; type: MagicLinkOtpType }

export function authCallbackParams(params: URLSearchParams): AuthCallbackParams | null {
  // テンプレートの世代によっては code ではなく token_hash で戻ってくる
  const tokenHash = params.get('token_hash') ?? params.get('token')
  if (tokenHash) {
    const rawType = params.get('type') ?? 'magiclink'
    return isOtpType(rawType) ? { kind: 'token', tokenHash, type: rawType } : null
  }

  const code = params.get('code')
  if (code) return { kind: 'code', code }

  return null
}
