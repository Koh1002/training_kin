'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  sendMagicLink,
  verifyMagicLinkUrl,
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
export function LoginForm({
  next,
  /** マジックリンクから戻って失敗したときの理由。無ければ null。 */
  callbackError,
}: {
  next?: string
  callbackError?: string | null
}) {
  const [sendState, sendAction, sending] = useActionState(sendMagicLink, initialSend)
  const [verifyState, verifyAction, verifying] = useActionState(verifyOtpCode, initialVerify)
  const [linkState, linkAction, verifyingLink] = useActionState(verifyMagicLinkUrl, initialVerify)
  const [email, setEmail] = useState('')

  // 「別のアドレスでやり直す」でメール入力に戻す。
  // 再送信すると useActionState が新しいオブジェクトを返すので、
  // 参照を比べれば「戻したあとに新しい結果が来たか」が分かり、自動で解除できる。
  const [dismissed, setDismissed] = useState<LoginState | null>(null)
  const showCodeStep = sendState.status === 'sent' && dismissed !== sendState

  if (showCodeStep) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className={`space-y-1.5 rounded-app border px-3 py-2 text-sm ${
            sendState.tone === 'warning'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          <p>{sendState.message}</p>
          {sendState.hint ? <p className="text-xs opacity-80">{sendState.hint}</p> : null}
        </div>

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
              className="field tabular h-14 text-center text-2xl tracking-[0.4em]"
            />
            <p className="text-xs text-muted">
              本文に6桁のコードが載っている場合は、こちらが最短です。
            </p>
          </div>

          <Button type="submit" variant="primary" size="lg" full disabled={verifying}>
            {verifying ? '確認中…' : 'ログイン'}
          </Button>

          {verifyState.message ? (
            <p
              role="alert"
              className="rounded-app border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
            >
              {verifyState.message}
            </p>
          ) : null}
        </form>

        <PasteLink
          next={next}
          action={linkAction}
          pending={verifyingLink}
          message={linkState.message}
        />

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

  const emailStep = (
    <form action={sendAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {callbackError ? (
        <p
          role="alert"
          className="rounded-app border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {callbackError}
        </p>
      ) : null}

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

      <Button type="submit" variant="primary" size="lg" full disabled={sending}>
        {sending ? '送信中…' : 'ログイン用のメールを送る'}
      </Button>

      {sendState.status === 'error' && sendState.message ? (
        <p
          role="alert"
          className="rounded-app border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {sendState.message}
        </p>
      ) : null}
    </form>
  )

  // リンクから戻って失敗したときは、手元にリンクがある。送り直させると
  // 送信上限を 1 通ぶん無駄に使うので、その場で貼り付けられるようにする。
  if (!callbackError) return emailStep

  return (
    <div className="space-y-4">
      {emailStep}
      <PasteLink
        next={next}
        action={linkAction}
        pending={verifyingLink}
        message={linkState.message}
      />
    </div>
  )
}

/**
 * リンクを貼り付けて入る道。
 *
 * リンクの戻り先が壊れていると開いても何も起きないが、リンク自体には token が
 * 入っているので、戻り先を経由せずここで検証すれば入れる。Supabase はメール
 * テンプレートの編集を独自 SMTP の設定とセットにしているため、SMTP を用意できない
 * 環境では本文にコードが載らない。そこでの唯一の道になる。
 *
 * **メール本文のリンク**（`supabase.co` で始まるもの）を貼った場合は、ログインの
 * 途中の値を使わないので、メールを送ったブラウザと違っても通る。
 * リンクを開いた先のアドレス（`?code=…`）を貼った場合はその限りではない——
 * 送信したブラウザの、いちばん新しいメールのぶんしか使えない。
 */
function PasteLink({
  next,
  action,
  pending,
  message,
}: {
  next?: string
  action: (formData: FormData) => void
  pending: boolean
  message?: string
}) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <h2 className="text-sm font-medium">コードが本文に無いとき</h2>
        <p className="mt-1 text-xs text-muted">
          メール本文のボタンを長押し（PC なら右クリック）してリンクのアドレスをコピーし、
          ここに貼り付けてください。リンクを開いても何も起きない場合や、
          別のブラウザで開いてしまった場合でも入れます。
        </p>
      </div>

      <form action={action} className="space-y-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input
          name="url"
          type="url"
          required
          inputMode="url"
          autoComplete="off"
          placeholder="https://….supabase.co/auth/v1/verify?token=…"
          className="field text-[13px]"
        />
        <Button type="submit" variant="secondary" size="lg" full disabled={pending}>
          {pending ? '確認中…' : 'リンクでログイン'}
        </Button>

        {message ? (
          <p
            role="alert"
            className="rounded-app border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ) : null}
      </form>
    </div>
  )
}
