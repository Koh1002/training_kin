/**
 * Supabase の認証エラーを、日本語の文言と「次に何ができるか」に変換する。
 *
 * 分岐には `error.code`（`over_email_send_rate_limit` など）と `error.status` を使い、
 * `error.message` の文字列一致はしない。メッセージの文言は Supabase 側の都合で変わる。
 *
 * ただし `error.code` は**来ないことがある**。@supabase/auth-js はレスポンス本文の
 * `code`（API バージョンが新しい場合のみ）か `error_code` からしか code を拾わないので、
 * 本文の形が違えば undefined になり、生の英語メッセージが表示されてしまう。
 * 実際に本番でそうなった。HTTP ステータスは必ず入るので、429 は code の有無に関わらず
 * レート制限として扱う。
 */

export type AuthErrorInfo = {
  message: string
  /** 設定の直し方など、本文より一段小さく添える補足。 */
  hint?: string
  /**
   * 送信そのものは失敗したが、**すでに届いているメールで先に進める**場合に true。
   * 送信上限はまさにこれで、直前のメールが届いているからこそ上限に当たっている。
   * ここで赤いエラーを出して止めると、使えるメールを持っているユーザーを足止めしてしまう。
   */
  canUseExistingCode: boolean
}

/** ログイン用メールの送信に失敗したとき。 */
export function describeSendError(
  code: string | undefined,
  status: number | undefined,
  fallbackMessage: string,
): AuthErrorInfo {
  // code が来なくても 429 ならレート制限。ここを status に頼るのが要点。
  const rateLimited = code === 'over_email_send_rate_limit' || status === 429

  if (rateLimited) {
    // 「6桁コードが届いているはず」と言い切らない。テンプレートに {{ .Token }} が
    // 無ければコードはそもそも本文に入らず、届いていない人に届いていると言うことになる。
    // 実際にそれで詰まった。手元にあるメールで試せることを並べ、無かった場合の
    // 直し方まで書く。
    return {
      message:
        'メールの送信上限に達しました。すでに届いているメールがまだ使えます。' +
        '本文のリンクを開くか、6桁コードがあれば下に入力してください。',
      hint:
        'コードが本文に無い場合は、下の「コードが本文に無いとき」からリンクを貼り付けて' +
        'ログインしてください。新しく送れるようになるまでは1時間ほどかかります' +
        '（内蔵のメール送信は1時間あたり2通まで）。',
      canUseExistingCode: true,
    }
  }

  switch (code) {
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
export function describeVerifyError(code: string | undefined, status?: number): string {
  if (code === 'over_request_rate_limit' || status === 429) {
    return '試行回数が多すぎます。少し待ってからもう一度お試しください。'
  }

  switch (code) {
    case 'otp_expired':
      return 'コードが違うか、有効期限が切れています。もう一度送り直してください。'
    case 'otp_disabled':
      // テンプレートの編集には独自 SMTP が要るので、「{{ .Token }} を足してください」
      // だけでは詰む環境がある。リンクを貼り付ける道を案内する。
      return 'コードでのログインが有効になっていません。下の「コードが本文に無いとき」からリンクを貼り付けてください。'
    case 'over_request_rate_limit':
      return '試行回数が多すぎます。少し待ってからもう一度お試しください。'
    default:
      return 'コードが違うか、有効期限が切れています。もう一度送り直してください。'
  }
}
