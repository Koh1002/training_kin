'use client'

import { createBrowserClient } from '@supabase/ssr'
import { requireSupabaseEnv } from './env'

/** ブラウザ側の Supabase クライアント。Cookie は @supabase/ssr が自動で扱う。 */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv()
  return createBrowserClient(url, anonKey)
}
