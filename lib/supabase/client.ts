'use client'

import { createBrowserClient } from '@supabase/ssr'

/** ブラウザ側の Supabase クライアント。Cookie は @supabase/ssr が自動で扱う。 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
