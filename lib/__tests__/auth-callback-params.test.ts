import { describe, expect, it } from 'vitest'
import { authCallbackParams } from '@/lib/auth-callback-params'

const params = (query: string) => new URLSearchParams(query)

describe('authCallbackParams', () => {
  it('PKCE の code を取り出す', () => {
    expect(authCallbackParams(params('code=abc-123'))).toEqual({ kind: 'code', code: 'abc-123' })
  })

  it('token_hash と type を取り出す', () => {
    expect(authCallbackParams(params('token_hash=hash1&type=email'))).toEqual({
      kind: 'token',
      tokenHash: 'hash1',
      type: 'email',
    })
  })

  it('古い世代の token= も読む', () => {
    expect(authCallbackParams(params('token=hash1&type=magiclink'))).toEqual({
      kind: 'token',
      tokenHash: 'hash1',
      type: 'magiclink',
    })
  })

  it('type が無いときはマジックリンクとして扱う', () => {
    expect(authCallbackParams(params('token_hash=hash1'))).toEqual({
      kind: 'token',
      tokenHash: 'hash1',
      type: 'magiclink',
    })
  })

  it('未知の type は受け付けない', () => {
    expect(authCallbackParams(params('token_hash=hash1&type=sms'))).toBeNull()
  })

  it('ログイン用の値が無ければ null', () => {
    // proxy はこれを見て転送するかどうかを決める。無関係なクエリで
    // 転送してしまうと、普通のページ遷移が壊れる。
    expect(authCallbackParams(params(''))).toBeNull()
    expect(authCallbackParams(params('date=2026-08-31'))).toBeNull()
    expect(authCallbackParams(params('next=%2Fworkout'))).toBeNull()
  })
})
