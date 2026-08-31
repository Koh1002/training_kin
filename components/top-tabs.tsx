'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Dumbbell, Settings } from 'lucide-react'

const TABS = [
  { href: '/workout', label: '筋トレ', Icon: Dumbbell, accent: 'var(--accent-workout)' },
  { href: '/english', label: '英語', Icon: BookOpen, accent: 'var(--accent-english)' },
] as const

/** 筋トレ / 英語を切り替える上部タブ。下線の色でどちらにいるかを示す。 */
export function TopTabs() {
  const pathname = usePathname()
  const settingsActive = pathname.startsWith('/settings')

  return (
    // ホーム画面から起動すると sticky なこのヘッダーがステータスバー／ノッチの
    // 下に潜り込む。その高さぶんだけ上に余白を足して逃がす。
    <header
      className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur-md"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <nav className="mx-auto flex w-full max-w-2xl items-stretch px-2">
        {TABS.map(({ href, label, Icon, accent }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors"
              style={{ color: active ? accent : 'var(--muted)' }}
            >
              <Icon size={16} strokeWidth={2} aria-hidden />
              {label}
              <span
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                style={{ background: active ? accent : 'transparent' }}
              />
            </Link>
          )
        })}
        <Link
          href="/settings"
          aria-label="設定"
          aria-current={settingsActive ? 'page' : undefined}
          className="flex w-11 items-center justify-center transition-colors"
          style={{ color: settingsActive ? 'var(--foreground)' : 'var(--muted)' }}
        >
          <Settings size={17} strokeWidth={2} aria-hidden />
        </Link>
      </nav>
    </header>
  )
}
