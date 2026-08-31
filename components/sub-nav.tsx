'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Item = { href: string; label: string }

/** タブ内の「記録 / 履歴 / 種目」などの二次ナビゲーション。 */
export function SubNav({ items, accent }: { items: Item[]; accent: string }) {
  const pathname = usePathname()

  return (
    <nav
      className="mb-4 flex gap-1 rounded-app-lg border border-border bg-surface-muted p-1"
      aria-label="ページ内ナビゲーション"
    >
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="flex-1 rounded-app px-3 py-1.5 text-center text-[13px] font-medium transition"
            style={
              active
                ? { background: 'var(--surface)', color: accent, boxShadow: '0 1px 2px rgb(0 0 0 / 0.06)' }
                : { color: 'var(--muted)' }
            }
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
