/**
 * ログインメールの戻り先に使う origin を決める。
 *
 * `SITE_URL` は本番の宛先を固定するためのもので、ホストヘッダ（呼び出し側から
 * 差し込める値）に頼らずに済ませるために用意している。ただし設定を鵜呑みにすると、
 * 本番なのに localhost 宛のログインリンクを送ってしまう事故が起きる。
 * これは「メールは届くのに永久に入れない」という最も分かりにくい壊れ方をするので、
 * 明らかに使えない設定はここで無視する。
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function hostnameOf(host: string): string {
  // "localhost:3000" や "[::1]:3000" からホスト名だけを取り出す
  const withoutPort = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]
  return withoutPort.toLowerCase()
}

function isLocal(host: string): boolean {
  return LOCAL_HOSTNAMES.has(hostnameOf(host))
}

/** リクエストのホストから origin を組み立てる。ローカルは http、それ以外は https。 */
function originFromHost(requestHost: string | null): string {
  if (!requestHost) return ''
  // ローカル開発に https を付けると開けない URL になる
  const scheme = isLocal(requestHost) ? 'http' : 'https'
  return `${scheme}://${requestHost}`
}

/**
 * @param siteUrl     環境変数 SITE_URL（未設定なら undefined）
 * @param requestHost x-forwarded-host または host ヘッダ
 */
export function resolveOrigin(siteUrl: string | undefined, requestHost: string | null): string {
  const fallback = originFromHost(requestHost)

  if (!siteUrl) return fallback

  let parsed: URL
  try {
    parsed = new URL(siteUrl)
  } catch {
    // 壊れた値でログイン全体を 500 にしない
    return fallback
  }

  // 設定は localhost なのに、リクエストは外から来ている。
  // localhost 宛のリンクを送っても相手は絶対に開けないので、事実の方を優先する。
  if (isLocal(parsed.host) && requestHost && !isLocal(requestHost)) {
    return fallback
  }

  // 末尾のスラッシュは new URL() の基準にすると差が出ないが、揃えておく
  return parsed.origin
}
