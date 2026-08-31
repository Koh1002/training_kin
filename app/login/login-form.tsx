'use client'

import { useActionState } from 'react'
import { sendMagicLink, type LoginState } from './actions'

const initialState: LoginState = { status: 'idle' }

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initialState)

  return (
    <form action={action} className="space-y-4">
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
          className="field"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-foreground px-4 py-3 font-semibold text-background transition disabled:opacity-50"
      >
        {pending ? '送信中…' : 'ログインリンクを送る'}
      </button>

      {state.message ? (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.status === 'error'
              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
