/**
 * リクエストのクエリから、ログインの結果に関わる値を取り出す。
 *
 * Supabase は戻り先が Redirect URLs に一致しないとき、その値を捨てて **Site URL** に
 * 差し替える。すると結果はサイトのルートに着地し、`/auth/callback` を通らない。
 * 自分のドメインに届いた値は、どのパスに落ちたかに関わらず拾う。
 *
 * **`token_hash` はここでは受けない。** `verifyOtp({token_hash, type})` は
 * メールアドレスにも検証用の値にも紐付かないので、どのパスでも拾って自動で検証すると、
 * 攻撃者が自分宛に取った token を仕込んだ URL を 1 回踏ませるだけで、
 * 被害者を攻撃者のアカウントにログインさせられる（既存のセッションも差し替わる）。
 *
 * `code` にはこの問題が無い。交換には送信したブラウザにしか無い検証用の値が要るため、
 * 他人の `code` を踏ませても成立しない。テンプレートを編集できない構成では
 * メールのリンクは必ず `?code=` で戻るので、`code` だけで足りる。
 *
 * 貼り付けフォーム（`lib/auth-link.ts`）は `token_hash` も受けるが、あちらは
 * 利用者が意図して貼る操作が要るので 1 クリックの経路にはならない。
 */
export type AuthCallbackParams =
  /** ログインを成立させられる値 */
  | { kind: 'code'; code: string }
  /** Supabase 側が返したエラー。期限切れ・使用済みなど */
  | { kind: 'error'; code: string }

export function authCallbackParams(params: URLSearchParams): AuthCallbackParams | null {
  // 期限切れ・使用済みのリンクは ?error=access_denied&error_code=otp_expired で戻る。
  // これを読まないと「リンクにログイン情報が入っていませんでした」という
  // 見当違いの説明になる。
  const errorCode = params.get('error_code') ?? params.get('error')
  if (errorCode) return { kind: 'error', code: errorCode }

  const code = params.get('code')
  if (code) return { kind: 'code', code }

  return null
}
