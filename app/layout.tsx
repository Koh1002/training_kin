import type { Metadata, Viewport } from 'next'
import './globals.css'

const APP_NAME = '筋トレ & 英語ログ'
const APP_DESCRIPTION = '筋トレの負荷と英語4技能の学習時間を毎日記録して可視化するアプリ'

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  // ホーム画面から起動したときに全画面で開くための iOS 向けメタ情報。
  // statusBarStyle は 'default' にしている。iOS はこの値のときステータスバーの
  // 文字色をシステムの外観に合わせるので、prefers-color-scheme で切り替わる
  // このアプリと足並みが揃う。'black-translucent' は文字が常に白になり、
  // ライトテーマで読めなくなる。
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
  },
  formatDetection: {
    // 「10 20 3」のような数字の並びを電話番号と誤検知させない
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0f13' },
  ],
  width: 'device-width',
  initialScale: 1,
  // ノッチのある端末で画面の端まで使う。これが無いと env(safe-area-inset-*) が
  // 常に 0 になり、globals.css の --safe-* が効かない。
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
