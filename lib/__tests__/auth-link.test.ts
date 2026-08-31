import { describe, expect, it } from 'vitest'
import { parseMagicLink } from '@/lib/auth-link'

describe('parseMagicLink', () => {
  it('メール本文の verify リンクから token を取り出す', () => {
    expect(
      parseMagicLink(
        'https://abcdefg.supabase.co/auth/v1/verify?token=pkce_abc123&type=magiclink&redirect_to=http://localhost:3000/auth/callback',
      ),
    ).toEqual({ kind: 'token', tokenHash: 'pkce_abc123', type: 'magiclink' })
  })

  it('新しいテンプレートの token_hash も読む', () => {
    expect(
      parseMagicLink('https://abcdefg.supabase.co/auth/v1/verify?token_hash=hash123&type=email'),
    ).toEqual({ kind: 'token', tokenHash: 'hash123', type: 'email' })
  })

  it('リンクを開いた先のアドレス（code 付き）も読む', () => {
    // 戻り先が localhost で画面が出なくても、URL 自体はコピーできることが多い
    expect(parseMagicLink('http://localhost:3000/auth/callback?code=abc-123')).toEqual({
      kind: 'code',
      code: 'abc-123',
    })
  })

  it('ハッシュ側に載っている場合も読む', () => {
    expect(parseMagicLink('https://x.supabase.co/auth/v1/verify#token=t1&type=recovery')).toEqual({
      kind: 'token',
      tokenHash: 't1',
      type: 'recovery',
    })
  })

  it('前後の空白は無視する', () => {
    expect(parseMagicLink('  https://x.supabase.co/auth/v1/verify?token=t1&type=email  ')).toEqual({
      kind: 'token',
      tokenHash: 't1',
      type: 'email',
    })
  })

  it('type が未知なら受け付けない', () => {
    expect(parseMagicLink('https://x.supabase.co/auth/v1/verify?token=t1&type=sms')).toBeNull()
  })

  it('type が無いときはマジックリンクとして扱う', () => {
    expect(parseMagicLink('https://x.supabase.co/auth/v1/verify?token=t1')).toEqual({
      kind: 'token',
      tokenHash: 't1',
      type: 'magiclink',
    })
  })

  it('http(s) 以外のスキームは受け付けない', () => {
    // 入力欄に貼られる値なので、URL として解釈できるだけでは通さない
    expect(parseMagicLink('javascript:alert(1)//?token=t1')).toBeNull()
  })

  it('URL でない文字列や空文字は null', () => {
    expect(parseMagicLink('123456')).toBeNull()
    expect(parseMagicLink('')).toBeNull()
    expect(parseMagicLink('   ')).toBeNull()
  })

  it('token も code も無い URL は null', () => {
    expect(parseMagicLink('https://example.com/')).toBeNull()
  })
})
