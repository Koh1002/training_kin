import { describe, expect, it } from 'vitest'
import { describePasswordError, SIGNUP_NEEDS_CONFIRMATION } from '@/lib/auth-errors'

describe('describePasswordError', () => {
  it('資格情報の誤りをそう言う', () => {
    expect(describePasswordError('invalid_credentials', 400, 'Invalid login credentials')).toBe(
      'メールアドレスかパスワードが違います。',
    )
  })

  it('確認待ちのときは、どこを切ればいいか名指しする', () => {
    // これが出るのは Supabase の「Confirm email」が有効なまま。放っておくと
    // メールの確認待ちになり、マジックリンクのときと同じ詰まり方をする。
    const message = describePasswordError('email_not_confirmed', 400, 'Email not confirmed')
    expect(message).toContain('Confirm email')
    expect(message).toContain('Providers')
  })

  it('登録済みならログインの方へ誘導する', () => {
    expect(describePasswordError('user_already_exists', 422, 'User already registered')).toContain(
      'ログイン',
    )
  })

  it('短すぎるパスワードは文字数を示す', () => {
    expect(describePasswordError('weak_password', 422, 'Password is too short')).toContain('8文字')
  })

  it('新規登録が無効ならどこで有効にするか示す', () => {
    expect(describePasswordError('signup_disabled', 422, 'Signups not allowed')).toContain(
      'Providers',
    )
  })

  it('code が来なくても 429 ならレート制限として扱う', () => {
    // 実際に本番で起きた。auth-js はレスポンス本文の形によっては code を拾えず、
    // 生の英語メッセージが出てしまっていた。ステータスは必ず入るのでそれで判定する。
    const message = describePasswordError(undefined, 429, 'too many requests')
    expect(message).toContain('待って')
    expect(message).not.toContain('too many requests')
  })

  it('知らないコードでも英語をそのまま出さない形にする', () => {
    // 完全には隠せないが、日本語の前置きを付けて何の話か分かるようにする
    expect(describePasswordError('something_new', 400, 'Some new failure')).toContain(
      'ログインできませんでした',
    )
  })
})

describe('SIGNUP_NEEDS_CONFIRMATION', () => {
  it('登録できたのに入れない理由と、直す場所を書く', () => {
    // エラー無し・セッション無しで返るので、ここを見ないと
    // 「登録できたように見えて入れない」という一番分かりにくい形になる
    expect(SIGNUP_NEEDS_CONFIRMATION).toContain('Confirm email')
    expect(SIGNUP_NEEDS_CONFIRMATION).toContain('確認待ち')
  })
})
