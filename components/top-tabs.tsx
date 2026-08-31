'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/workout', label: '筋トレ', icon: '💪', accent: 'var(--accent-workout)' },
  { href: '/english', label: '英語', icon: '📖', accent: 'var(--accent-english)' },
] as const

/** 筋トレ / 英語を切り替える上部タブ。下線の色でどちらにいるかを示す。 */
export function TopTabs() {
  const pathname = usePathname()

  return (
    // ホーム画面から起動すると sticky なこのヘッダーがステータスバー／ノッチの
    // 下に潜り込む。その高さぶんだけ上に余白を足して逃がす。
    <header
      className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <nav className="mx-auto flex w-full max-w-2xl items-stretch">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className="relative flex-1 py-3.5 text-center text-[15px] font-semibold transition"
              style={{ color: active ? tab.accent : 'var(--muted)' }}
            >
              <span aria-hidden className="mr-1.5">
                {tab.icon}
              </span>
              {tab.label}
              <span
                className="absolute inset-x-0 bottom-0 h-[3px] rounded-t"
                style={{ background: active ? tab.accent : 'transparent' }}
              />
            </Link>
          )
        })}
        <Link
          href="/settings"
          aria-label="設定"
          aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
          className="flex w-14 items-center justify-center text-lg text-muted transition"
          style={{ color: pathname.startsWith('/settings') ? 'var(--foreground)' : undefined }}
        >
          ⚙︎
        </Link>
      </nav>
    </header>
  )
}
