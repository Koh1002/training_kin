'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { signIn, signUp, type AuthState } from './actions'

const initial: AuthState = { status: 'idle' }

type Mode = 'signin' | 'signup'

/**
 * ログイン。メールアドレスとパスワードの 1 画面。
 *
 * 以前はマジックリンクを送って、コードを入れるか、リンクを貼り付けるか、という
 * 3 通りの導線があった。どれも Supabase 側の制約で通らず、画面だけが複雑になっていた。
 */
export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [signInState, signInAction, signingIn] = useActionState(signIn, initial)
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, initial)

  const isSignUp = mode === 'signup'
  const state = isSignUp ? signUpState : signInState
  const pending = isSignUp ? signingUp : signingIn

  return (
    <form action={isSignUp ? signUpAction : signInAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div
        role="tablist"
        aria-label="ログインと新規登録"
        className="flex gap-0.5 rounded-app-lg border border-border p-0.5"
      >
        {(['signin', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-app px-3 py-1.5 text-center text-[13px] transition-colors ${
              mode === m
                ? 'bg-surface-muted font-medium text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {m === 'signin' ? 'ログイン' : '新規登録'}
          </button>
        ))}
      </div>

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

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          // 新規登録ではパスワード管理アプリに新しいものを作らせる
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          className="field"
        />
        <p className="text-xs text-muted">
          {isSignUp
            ? '8文字以上。ほかで使っていないものにしてください。'
            : '8文字以上'}
        </p>
      </div>

      <Button type="submit" variant="primary" size="lg" full disabled={pending}>
        {pending ? '確認中…' : isSignUp ? 'アカウントを作る' : 'ログイン'}
      </Button>

      {state.status === 'error' && state.message ? (
        <p
          role="alert"
          className="rounded-app border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
