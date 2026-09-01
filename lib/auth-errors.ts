/**
 * Supabase の認証エラーを、日本語の文言と「次に何ができるか」に変換する。
 *
 * 分岐には `error.code`（`invalid_credentials` など）と `error.status` を使い、
 * `error.message` の文字列一致はしない。メッセージの文言は Supabase 側の都合で変わる。
 *
 * ただし `error.code` は**来ないことがある**。@supabase/auth-js はレスポンス本文の
 * `code`（API バージョンが新しい場合のみ）か `error_code` からしか code を拾わないので、
 * 本文の形が違えば undefined になり、生の英語メッセージが表示されてしまう。
 * 実際に本番でそうなった。HTTP ステータスは必ず入るので、429 は code の有無に関わらず
 * レート制限として扱う。
 */

/** メールアドレスとパスワードでのログイン／登録が失敗したとき。 */
export function describePasswordError(
  code: string | undefined,
  status: number | undefined,
  fallbackMessage: string,
): string {
  if (code === 'over_request_rate_limit' || status === 429) {
    return '試行回数が多すぎます。少し待ってからもう一度お試しください。'
  }

  switch (code) {
    case 'invalid_credentials':
      return 'メールアドレスかパスワードが違います。'

    case 'email_not_confirmed':
      // これが出るということは Supabase の「Confirm email」が有効なまま。
      // そのままだとメールの確認待ちになり、マジックリンクのときと同じ詰まり方をする。
      // どこを切ればいいかを名指しする。
      return (
        'メールアドレスの確認待ちになっています。Supabase の Authentication > Providers > Email で ' +
        '「Confirm email」を切ってください。'
      )

    case 'user_already_exists':
      return 'このメールアドレスは登録済みです。「ログイン」の方をお使いください。'

    case 'weak_password':
      return 'パスワードが短すぎます。8文字以上にしてください。'

    case 'signup_disabled':
      return '新規登録が無効になっています。Supabase の Authentication > Providers > Email で有効にしてください。'

    case 'email_address_invalid':
      return 'このメールアドレスは受け付けられませんでした。入力を確認してください。'

    default:
      return `ログインできませんでした: ${fallbackMessage}`
  }
}

/**
 * 登録はできたのにセッションが返らなかったとき。
 *
 * これは失敗ではなく**設定の問題**で、「Confirm email」が有効だと Supabase は
 * 確認メールを送ってセッションを返さない。エラーとして扱わないと、
 * 登録できたように見えて入れない、という一番分かりにくい形になる。
 */
export const SIGNUP_NEEDS_CONFIRMATION =
  'アカウントは作成されましたが、メールアドレスの確認待ちになっています。' +
  'Supabase の Authentication > Providers > Email で「Confirm email」を切ってから、' +
  'もう一度ログインしてください。'
