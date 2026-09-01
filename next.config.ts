import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // マジックリンクを廃止した際に消したルート。受信箱には古いログインメールが
        // 残り続けるので、押されるたびに 404 の行き止まりに当たる。
        //
        // `/` は app/(app)/page.tsx が /workout へ送るので、ログイン済みなら
        // そのまま記録画面に着く。未ログインなら proxy が /login へ送る。
        //
        // permanent: false（307）にしているのは、恒久リダイレクトがブラウザに
        // 強くキャッシュされ、将来このパスを使いたくなったときに取り消せないため。
        // 古いメールが尽きるまでの経過措置。
        source: '/auth/callback',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
