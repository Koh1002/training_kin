export function Card({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-app-lg border border-border bg-surface p-4 ${className}`} {...rest}>
      {children}
    </div>
  )
}

/**
 * カードの見出し。本文とは字の大きさではなく色と字間で差を付ける。
 * right には合計値などの補助情報を置く。
 */
export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-medium tracking-wider text-muted uppercase">{children}</h2>
      {right ? <div className="text-sm text-muted">{right}</div> : null}
    </div>
  )
}

/**
 * 記録がまだ無いときの表示。
 *
 * 以前は破線で囲んでいたが、破線の枠は「ここに何かが入る予定の場所」に見えて、
 * 作りかけの画面のような印象になっていた。枠を外して、余白と文字色だけで
 * 空であることを示す。
 */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-7 text-center text-sm text-muted">{children}</p>
}
