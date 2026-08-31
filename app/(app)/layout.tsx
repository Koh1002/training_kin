import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { TopTabs } from '@/components/top-tabs'

/**
 * アプリ本体のシェル。上部タブで筋トレ / 英語を切り替える。
 * proxy.ts でも弾いているが、こちらでも getUser() で確認しておく
 * （proxy は楽観的なガードにすぎないため）。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-dvh">
      <TopTabs />
      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">{children}</main>
    </div>
  )
}
