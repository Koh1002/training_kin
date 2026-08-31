/** ログイン後の既定の行き先 */
export const DEFAULT_DESTINATION = '/workout'

/**
 * ログイン後の遷移先を安全な値に丸める。
 *
 * `next` はクエリ文字列から来る。つまり攻撃者がログイン URL を組み立てて
 * 他人に踏ませられるので、そのまま `redirect()` に渡すとオープンリダイレクトになる。
 * 自サイト内の絶対パスだけを通す:
 *
 *   - `/` で始まること（`https://evil.com` のような絶対 URL を弾く）
 *   - ただし `//` で始まらないこと（`//evil.com` はスキーム相対 URL として
 *     外部ホストに飛んでしまう）
 *   - `\` を含まないこと（一部のブラウザが `/\evil.com` を `//evil.com` として扱う）
 *
 * マジックリンクの戻り先（app/auth/callback/route.ts）と、
 * 6 桁コードでのログイン（app/login/actions.ts）の両方から使う。
 * 判定を 2 箇所で書き分けると、片方だけ緩い状態に気づけない。
 */
export function safeDestination(next: string | null | undefined): string {
  if (!next) return DEFAULT_DESTINATION
  if (!next.startsWith('/')) return DEFAULT_DESTINATION
  if (next.startsWith('//')) return DEFAULT_DESTINATION
  if (next.includes('\\')) return DEFAULT_DESTINATION
  return next
}
