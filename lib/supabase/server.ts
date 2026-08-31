import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { requireSupabaseEnv } from './env'

/**
 * Server Component / Server Action 用の Supabase クライアント。
 * Next.js 16 では `cookies()` が非同期なので await が必須。
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = requireSupabaseEnv()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component からは Cookie を書けない。
            // セッションの更新は proxy.ts 側が担当するので、ここは無視してよい。
          }
        },
      },
    },
  )
}

/**
 * ログイン済みユーザーを返す。未ログインなら null。
 * `getUser()` は Auth サーバーにトークンを検証させるため、
 * Cookie を信用する `getSession()` より安全。
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
