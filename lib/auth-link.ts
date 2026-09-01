/**
 * メールに届いたログイン用リンクを、貼り付けから読み取る。
 *
 * リンクの戻り先（`redirect_to`）が localhost などになっていると、スマートフォンで
 * 開いても何も起きない。ただしリンクそのものには**ログインに必要な token が
 * 入っている**ので、戻り先を経由せずにこちらで検証すれば入れる。
 *
 * 受け付ける形は 2 つ。
 *
 * 1. メール本文のリンク（Supabase の verify エンドポイント）
 *    `https://<ref>.supabase.co/auth/v1/verify?token=<hash>&type=magiclink&redirect_to=...`
 *    テンプレートの世代によって `token` と `token_hash` のどちらもあり得る。
 * 2. リンクを開いた結果アドレスバーに出た URL
 *    `http://localhost:3000/auth/callback?code=<code>`
 *    戻り先が壊れていて画面が出なくても、URL 自体はコピーできることが多い。
 *    ただしこちらは PKCE の検証用の値が要るので、**メールを送ったブラウザで、
 *    いちばん新しいメールのぶん**しか使えない。1 の形にはその制限が無いので、
 *    可能なら 1 を貼らせる。
 */

/** Supabase の verifyOtp が受け付けるメール系の type。 */
const OTP_TYPES = ['magiclink', 'email', 'signup', 'recovery', 'invite', 'email_change'] as const

export type MagicLinkOtpType = (typeof OTP_TYPES)[number]

export type ParsedMagicLink =
  | { kind: 'token'; tokenHash: string; type: MagicLinkOtpType }
  | { kind: 'code'; code: string }

/** verifyOtp に渡してよい type か。判定を 2 箇所に書くと片方だけ緩むので共有する。 */
export function isOtpType(value: string): value is MagicLinkOtpType {
  return (OTP_TYPES as readonly string[]).includes(value)
}

/**
 * 貼り付けられた文字列からログインに使える値を取り出す。
 * 読み取れなければ null を返す。例外は投げない（入力欄に貼られる値なので、
 * 壊れていて当たり前）。
 */
export function parseMagicLink(input: string): ParsedMagicLink | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  // http(s) 以外は受け付けない。javascript: などを URL として渡させない
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  // メールクライアントによってはハッシュ側に載ることがある
  const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  const param = (name: string) => url.searchParams.get(name) ?? hashParams.get(name)

  const tokenHash = param('token_hash') ?? param('token')
  if (tokenHash) {
    const rawType = param('type') ?? 'magiclink'
    if (!isOtpType(rawType)) return null
    return { kind: 'token', tokenHash, type: rawType }
  }

  const code = param('code')
  if (code) return { kind: 'code', code }

  return null
}
