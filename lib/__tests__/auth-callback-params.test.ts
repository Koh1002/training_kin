import { describe, expect, it } from 'vitest'
import { authCallbackParams } from '@/lib/auth-callback-params'

const params = (query: string) => new URLSearchParams(query)

describe('authCallbackParams', () => {
  it('PKCE の code を取り出す', () => {
    expect(authCallbackParams(params('code=abc-123'))).toEqual({ kind: 'code', code: 'abc-123' })
  })

  describe('token_hash は受け付けない', () => {
    // verifyOtp({token_hash, type}) はメールアドレスにも検証用の値にも紐付かない。
    // proxy がこれをどのパスでも拾って自動で検証すると、攻撃者が自分宛に取った
    // token を仕込んだ URL を 1 回踏ませるだけで、被害者を攻撃者のアカウントに
    // ログインさせられる。既存のセッションも差し替わる。
    // 貼り付けフォーム（lib/auth-link.ts）だけが token_hash を受ける。
    it('token_hash', () => {
      expect(authCallbackParams(params('token_hash=stolen&type=magiclink'))).toBeNull()
    })

    it('旧世代の token', () => {
      expect(authCallbackParams(params('token=stolen&type=magiclink'))).toBeNull()
    })

    it('type だけ', () => {
      expect(authCallbackParams(params('type=magiclink'))).toBeNull()
    })
  })

  describe('Supabase 側のエラーを取り出す', () => {
    it('error_code を優先する', () => {
      expect(
        authCallbackParams(params('error=access_denied&error_code=otp_expired&error_description=x')),
      ).toEqual({ kind: 'error', code: 'otp_expired' })
    })

    it('error_code が無ければ error を使う', () => {
      expect(authCallbackParams(params('error=access_denied'))).toEqual({
        kind: 'error',
        code: 'access_denied',
      })
    })

    it('エラーは code より先に見る', () => {
      // 期限切れのときコードが一緒に付いてくることがある。交換を試みる前に
      // 理由が分かっているなら、そちらを出す。
      expect(authCallbackParams(params('code=abc&error_code=otp_expired'))).toEqual({
        kind: 'error',
        code: 'otp_expired',
      })
    })
  })

  it('ログインに関係する値が無ければ null', () => {
    // proxy はこれを見て転送するかどうかを決める。無関係なクエリで転送すると
    // 普通のページ遷移が壊れる。
    expect(authCallbackParams(params(''))).toBeNull()
    expect(authCallbackParams(params('date=2026-08-31'))).toBeNull()
    expect(authCallbackParams(params('next=%2Fworkout'))).toBeNull()
  })
})
