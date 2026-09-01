import Link from 'next/link'

/**
 * 404。
 *
 * これが無いと Next.js の既定ページが出る。英語で、アプリと無関係な見た目で、
 * 戻る導線も無い。消したルートに古いリンクから着地したときに、それを見せていた。
 */
export default function NotFound() {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5"
      style={{
        paddingTop: 'calc(3rem + var(--safe-top))',
        paddingBottom: 'calc(3rem + var(--safe-bottom))',
      }}
    >
      <div className="space-y-2">
        <p className="tabular text-sm text-muted">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">このページはありません</h1>
        <p className="text-sm text-muted">
          アドレスが変わったか、入力が間違っている可能性があります。
        </p>
      </div>

      <Link
        href="/workout"
        className="inline-flex h-11 items-center justify-center rounded-app bg-foreground px-5 text-[15px] font-medium text-background transition-colors hover:opacity-90"
      >
        記録に戻る
      </Link>
    </main>
  )
}
