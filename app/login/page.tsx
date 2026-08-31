import { describeCallbackError } from '@/lib/auth-errors'
import { LoginForm } from './login-form'

export default async function LoginPage(props: PageProps<'/login'>) {
  const params = await props.searchParams
  const next = typeof params.next === 'string' ? params.next : undefined
  // マジックリンクから戻って失敗したときの理由。出さないと「また同じ画面に
  // 戻された」としか見えず、原因にたどり着けない。
  const callbackError = describeCallbackError(
    typeof params.error === 'string' ? params.error : undefined,
  )

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5"
      style={{
        paddingTop: 'calc(3rem + var(--safe-top))',
        paddingBottom: 'calc(3rem + var(--safe-bottom))',
      }}
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">筋トレ &amp; 英語ログ</h1>
        <p className="text-sm text-muted">
          毎日の筋トレの負荷と、英語4技能の学習時間を記録します。
          メールアドレスにログイン用のリンクを送ります。
        </p>
      </header>
      <LoginForm next={next} callbackError={callbackError} />
    </main>
  )
}
