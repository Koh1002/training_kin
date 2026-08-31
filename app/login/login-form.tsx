'use client'

import { useActionState, useState } from 'react'
import {
  sendMagicLink,
  verifyOtpCode,
  type LoginState,
  type VerifyState,
} from './actions'

const initialSend: LoginState = { status: 'idle' }
const initialVerify: VerifyState = { status: 'idle' }

/**
 * ログイン。メールを送ったあと、同じ画面でコードを入力できる。
 *
 * リンクとコードのどちらでも入れるようにしているのは、メールクライアントが
 * 長い URL を折り返すとリンクが途中で切れて開けなくなることがあるため。
 * スマホでは通知のプレビューからコードを読んで入力する方が速い。
 */
export function LoginForm({ next }: { next?: string }) {
  const [sendState, sendAction, sending] = useActionState(sendMagicLink, initialSend)
  const [verifyState, verifyAction, verifying] = useActionState(verifyOtpCode, initialVerify)
  const [email, setEmail] = useState('')

  // 「別のアドレスでやり直す」でメール入力に戻す。
  // 再送信すると useActionState が新しいオブジェクトを返すので、
  // 参照を比べれば「戻したあとに新しい結果が来たか」が分かり、自動で解除できる。
  const [dismissed, setDismissed] = useState<LoginState | null>(null)
  const showCodeStep = sendState.status === 'sent' && dismissed !== sendState

  if (showCodeStep) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            sendState.tone === 'warning'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {sendState.message}
        </p>

        <form action={verifyAction} className="space-y-4">
          <input type="hidden" name="email" value={sendState.email} />
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <div className="space-y-1.5">
            <label htmlFor="token" className="text-sm font-medium">
              6桁のコード
            </label>
            <input
              id="token"
              name="token"
              // iOS / Android のキーボード上部に、届いたコードの候補を出させる
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="field tabular text-center text-2xl tracking-[0.4em]"
            />
            <p className="text-xs text-muted">
              メールのリンクを開いてもログインできます。うまく開けないときはこちらを使ってください。
            </p>
          </div>

          <button
            type="submit"
            disabled={verifying}
            className="w-full rounded-xl bg-foreground px-4 py-3 font-semibold text-background transition disabled:opacity-50"
          >
            {verifying ? '確認中…' : 'ログイン'}
          </button>

          {verifyState.message ? (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
            >
              {verifyState.message}
            </p>
          ) : null}
        </form>

        <button
          type="button"
          onClick={() => setDismissed(sendState)}
          className="text-sm text-muted underline"
        >
          別のアドレスでやり直す
        </button>
      </div>
    )
  }

  return (
    <form action={sendAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-xl bg-foreground px-4 py-3 font-semibold text-background transition disabled:opacity-50"
      >
        {sending ? '送信中…' : 'ログイン用のメールを送る'}
      </button>

      {sendState.status === 'error' && sendState.message ? (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {sendState.message}
        </p>
      ) : null}
    </form>
  )
}
