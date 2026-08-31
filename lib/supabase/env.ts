/**
 * Supabase の接続情報を読む。
 *
 * 未設定のまま `createServerClient(undefined!, undefined!)` を呼ぶと、
 * ライブラリの奥で落ちて画面には素の「Internal Server Error」しか出ない。
 * 実際に Vercel のプレビュー環境で起きた（Vercel の環境変数は
 * Production / Preview / Development が別管理で、Production にだけ登録すると
 * プレビューには届かない）。何が足りないかを名指しできるようにしておく。
 */

export type SupabaseEnv = { url: string; anonKey: string }

export class MissingSupabaseEnvError extends Error {
  constructor(readonly missing: string[]) {
    super(`Supabase の環境変数が設定されていません: ${missing.join(', ')}`)
    this.name = 'MissingSupabaseEnvError'
  }
}

/** 揃っていなければ MissingSupabaseEnvError を投げる。 */
export function requireSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (missing.length > 0) throw new MissingSupabaseEnvError(missing)

  return { url: url!, anonKey: anonKey! }
}

/** 投げずに確認したいとき。proxy が案内画面を出すかの判定に使う。 */
export function missingSupabaseEnv(): string[] {
  const missing: string[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return missing
}
