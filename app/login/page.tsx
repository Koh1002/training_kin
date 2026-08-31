import { LoginForm } from './login-form'

export default async function LoginPage(props: PageProps<'/login'>) {
  const params = await props.searchParams
  const next = typeof params.next === 'string' ? params.next : undefined

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-12">
      <header className="space-y-2">
        <p className="text-3xl">💪 📖</p>
        <h1 className="text-2xl font-bold">筋トレ &amp; 英語ログ</h1>
        <p className="text-sm text-muted">
          毎日の筋トレの負荷と、英語4技能の学習時間を記録します。
          メールアドレスにログイン用のリンクを送ります。
        </p>
      </header>
      <LoginForm next={next} />
    </main>
  )
}
