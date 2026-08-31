/**
 * Supabase の認証エラーを、日本語の文言と「次に何ができるか」に変換する。
 *
 * 分岐には `error.code`（`over_email_send_rate_limit` など）を使い、
 * `error.message` の文字列一致はしない。メッセージの文言は Supabase 側の都合で
 * 変わりうるが、コードは機械可読な契約として安定しているため。
 */

export type AuthErrorInfo = {
  message: string
  /**
   * 送信そのものは失敗したが、**すでに届いているメールのコードで先に進める**場合に true。
   * 送信上限はまさにこれで、直前のメールが届いているからこそ上限に当たっている。
   * ここで赤いエラーを出して止めると、使えるコードを持っているユーザーを足止めしてしまう。
   */
  canUseExistingCode: boolean
}

/** ログイン用メールの送信に失敗したとき。 */
export function describeSendError(code: string | undefined, fallbackMessage: string): AuthErrorInfo {
  switch (code) {
    case 'over_email_send_rate_limit':
      return {
        message:
          'メールの送信上限に達しました。すでに届いているメールの6桁コードがまだ使えます。' +
          '新しく送るには1時間ほど待つか、Supabase に独自の SMTP を設定してください。',
        canUseExistingCode: true,
      }
    case 'over_request_rate_limit':
      return {
        message: 'リクエストが多すぎます。少し待ってからもう一度お試しください。',
        canUseExistingCode: false,
      }
    case 'email_provider_disabled':
      return {
        message:
          'メールでのログインが無効になっています。Supabase の Authentication > Providers で Email を有効にしてください。',
        canUseExistingCode: false,
      }
    case 'email_address_invalid':
      return {
        message: 'このメールアドレスは受け付けられませんでした。入力を確認してください。',
        canUseExistingCode: false,
      }
    case 'email_address_not_authorized':
      return {
        message:
          'このメールアドレスへの送信が許可されていません。Supabase の SMTP 設定を確認してください。',
        canUseExistingCode: false,
      }
    default:
      return { message: `送信に失敗しました: ${fallbackMessage}`, canUseExistingCode: false }
  }
}

/** 6桁コードの検証に失敗したとき。 */
export function describeVerifyError(code: string | undefined): string {
  switch (code) {
    case 'otp_expired':
      return 'コードが違うか、有効期限が切れています。もう一度送り直してください。'
    case 'otp_disabled':
      return 'コードでのログインが有効になっていません。Supabase の Magic Link テンプレートに {{ .Token }} を追加してください。'
    case 'over_request_rate_limit':
      return '試行回数が多すぎます。少し待ってからもう一度お試しください。'
    default:
      return 'コードが違うか、有効期限が切れています。もう一度送り直してください。'
  }
}
