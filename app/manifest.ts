import type { MetadataRoute } from 'next'

/**
 * ホーム画面から「アプリとして」起動するための manifest。
 * Next.js のファイル規約なので、これを置くだけで /manifest.webmanifest が生え、
 * <link rel="manifest"> も自動で入る。
 *
 * サービスワーカーは意図的に置いていない。理由は README を参照
 * （このアプリは全画面が Supabase 依存で、オフラインでは何も表示できないため）。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // アプリの同一性を固定する。start_url を変えてもホーム画面のアイコンが別物にならない。
    id: '/',
    name: '筋トレ & 英語ログ',
    // ホーム画面のラベルは長いと省略されるので短くする
    short_name: '筋トレ&英語',
    description: '筋トレの負荷と英語4技能の学習時間を毎日記録して可視化するアプリ',
    lang: 'ja',
    // 「/」は /workout へのリダイレクトなので、1 ホップ省いて直接開く
    start_url: '/workout',
    scope: '/',
    display: 'standalone',
    // 起動時のスプラッシュの色。テーマごとに出し分けられないので、既定のライト側に合わせる。
    background_color: '#f7f7f8',
    theme_color: '#f7f7f8',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android は端末ごとに円や角丸で切り抜く。これが無いと図形が欠ける。
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
