import { describe, expect, it } from 'vitest'
import { describeSendError, describeVerifyError } from '@/lib/auth-errors'

describe('describeSendError', () => {
  it('送信上限のときは、届いているコードで進めると伝える', () => {
    const info = describeSendError('over_email_send_rate_limit', 'email rate limit exceeded')
    expect(info.canUseExistingCode).toBe(true)
    expect(info.message).toContain('すでに届いている')
    expect(info.message).toContain('SMTP')
    // Supabase の英語メッセージをそのまま出さない
    expect(info.message).not.toContain('rate limit exceeded')
  })

  it('メール認証が無効なら、どこを直せばいいか示す', () => {
    const info = describeSendError('email_provider_disabled', 'signups not allowed')
    expect(info.canUseExistingCode).toBe(false)
    expect(info.message).toContain('Providers')
  })

  it('その他のレート制限は待つよう促すが、コードでは進めない', () => {
    const info = describeSendError('over_request_rate_limit', 'too many requests')
    expect(info.canUseExistingCode).toBe(false)
    expect(info.message).toContain('待って')
  })

  it('アドレスが不正なら入力を確認させる', () => {
    expect(describeSendError('email_address_invalid', 'x').message).toContain('確認')
  })

  it('未知のコードは元のメッセージを添えて返す', () => {
    const info = describeSendError('something_new', 'boom')
    expect(info.canUseExistingCode).toBe(false)
    expect(info.message).toBe('送信に失敗しました: boom')
  })

  it('コードが無い場合（ネットワーク断など）もフォールバックする', () => {
    expect(describeSendError(undefined, 'fetch failed').message).toBe('送信に失敗しました: fetch failed')
  })
})

describe('describeVerifyError', () => {
  it('期限切れは送り直しを促す', () => {
    expect(describeVerifyError('otp_expired')).toContain('送り直して')
  })

  it('コードログインが無効ならテンプレートの設定を示す', () => {
    expect(describeVerifyError('otp_disabled')).toContain('{{ .Token }}')
  })

  it('試行過多は待つよう促す', () => {
    expect(describeVerifyError('over_request_rate_limit')).toContain('待って')
  })

  it('未知のコードでも日本語で返す', () => {
    expect(describeVerifyError(undefined)).toContain('コードが違うか')
  })
})
