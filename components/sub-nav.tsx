'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Item = { href: string; label: string }

/** タブ内の「記録 / 履歴 / 種目」などの二次ナビゲーション。 */
export function SubNav({ items, accent }: { items: Item[]; accent: string }) {
  const pathname = usePathname()

  return (
    <nav className="mb-4 flex gap-1.5 overflow-x-auto pb-0.5" aria-label="ページ内ナビゲーション">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
            style={
              active
                ? { background: accent, borderColor: accent, color: '#fff' }
                : { borderColor: 'var(--border)', color: 'var(--muted)' }
            }
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
