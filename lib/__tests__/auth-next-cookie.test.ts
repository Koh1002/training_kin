import { describe, expect, it } from 'vitest'
import { isSecureOrigin, NEXT_COOKIE, nextCookieOptions } from '@/lib/auth-next-cookie'

describe('nextCookieOptions', () => {
  it('SameSite は lax にする', () => {
    // この Cookie はメールのリンクを踏んで外部から戻ってきたリクエストで
    // 送られる必要がある。'strict' だとそのとき送られず、行き先を復元できない。
    expect(nextCookieOptions(true).sameSite).toBe('lax')
  })

  it('JS から触らせない', () => {
    expect(nextCookieOptions(true).httpOnly).toBe(true)
  })

  it('サイト全体に効かせる', () => {
    // 行き先はどのパスにもなり得るし、読み取るのは /auth/callback なので
    // パスを絞ると読めなくなる。
    expect(nextCookieOptions(true).path).toBe('/')
  })

  it('ログインの往復より長く残さない', () => {
    const { maxAge } = nextCookieOptions(true)
    expect(maxAge).toBeGreaterThan(0)
    expect(maxAge).toBeLessThanOrEqual(30 * 60)
  })

  it('secure は呼び出し側の指定に従う', () => {
    expect(nextCookieOptions(true).secure).toBe(true)
    // ローカル開発は http。secure を付けると保存されず、行き先が毎回失われる。
    expect(nextCookieOptions(false).secure).toBe(false)
  })
})

describe('isSecureOrigin', () => {
  it('https だけ true', () => {
    expect(isSecureOrigin('https://training-kin.vercel.app')).toBe(true)
    expect(isSecureOrigin('http://localhost:3000')).toBe(false)
  })

  it('壊れた値では secure を付けない', () => {
    // 付けてしまうと保存されず、原因の分かりにくい失敗になる
    expect(isSecureOrigin('')).toBe(false)
    expect(isSecureOrigin('not a url')).toBe(false)
  })
})

describe('NEXT_COOKIE', () => {
  it('Supabase の認証 Cookie と名前がぶつからない', () => {
    expect(NEXT_COOKIE.startsWith('sb-')).toBe(false)
  })
})
