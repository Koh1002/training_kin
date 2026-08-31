'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Item = { href: string; label: string }

/**
 * タブ内の「記録 / 履歴 / 種目」などの二次ナビゲーション。
 *
 * 以前は灰色の帯の中に白いつまみを浮かせていたが、白いカードの上に灰色の面が
 * 乗るぶん重く、上部タブと主従が付かなかった。枠線だけの器にして、
 * 選択中の項目にだけ地を敷く。色は使わず、太さと濃さで示す。
 */
export function SubNav({ items }: { items: Item[] }) {
  const pathname = usePathname()

  return (
    <nav
      className="mb-4 flex gap-0.5 rounded-app-lg border border-border p-0.5"
      aria-label="ページ内ナビゲーション"
    >
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 rounded-app px-3 py-1.5 text-center text-[13px] transition-colors ${
              active
                ? 'bg-surface-muted font-medium text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
