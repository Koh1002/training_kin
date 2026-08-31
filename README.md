# 筋トレ & 英語ログ

毎日の筋トレの負荷と、英語4技能の学習時間を記録して可視化する個人用アプリ。
上部のタブで **💪 筋トレ** と **📖 英語** を切り替えます。

- **フロント**: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4 / Recharts
- **バックエンド**: Supabase（Postgres + Auth + Row Level Security）
- **ホスティング**: Vercel

## できること

### 💪 筋トレ

- **すばやい記録** — 39種目のマスタから選び、重量・回数・セットを入れるだけ。
  前回の値が自動で入るので、多くの日は数字に触らず「追加」を押すだけで終わります。
  重量はステッパー（±2.5kg 等）で親指だけで操作できます。
- **負荷の可視化** — `重量 × 回数 × セット`（左右別種目は ×2）で日々の総負荷を算出。
  直近30日の最高記録を 100 とした「今日の頑張り」ゲージと、総負荷の推移グラフを表示します。
- **自重・有酸素にも対応** — 自重種目は種目ごとの体重係数（腕立て 0.65 / 懸垂 1.0 など）で
  kg に換算して総負荷に合算。有酸素は単位が違うので総負荷に混ぜず、分数・速度・傾斜で別に記録します。
- **人体図** — 前面／背面の人体図を18の筋群に分け、色で塗り分けます。
  - **今日の刺激**: その日どこに効いたか（グレー → 青）
  - **筋肉痛**: いまどこが痛いか（グレー → 黄 → 橙 → 赤）
  部位をタップすると、その部位に効いた種目と負荷の内訳が出ます。
- **休養日** — 1タップで「オフ」を記録。理由（出張・二日酔いなど）も残せます。

### 🔑 ログイン

パスワードは持ちません。メールアドレスを入れると、**マジックリンクと 6 桁のコードが入った
メールが 1 通**届き、どちらでもログインできます。

コードを用意しているのは、メールクライアントが長い URL を折り返すとリンクが途中で切れて
開けなくなることがあるためです。スマホでは通知のプレビューからコードを読んで入力する方が
速く、メールアプリとブラウザを行き来せずに済みます。

### 📖 英語

- Reading / Listening / Speaking / Writing の4技能 × 23項目から選び、**分数だけ**を記録します。
- **達成率レーダー** — 技能ごとの週間目標（既定60分/週、変更可）に対する達成率。
- **バランススコア** — 4技能が均等なら 100、1技能に全振りなら 0。
- **次におすすめ** — 週の達成率が最も低い技能の項目を提示します。
- 連続学習日数（ストリーク）、週ごとの積み上げグラフ、項目別の合計。

## 筋肉痛のモデル

トレーニングした部位の筋肉痛は **当日から翌々日まで残り、徐々に軽減** します。

```
soreness(筋群, 日) = clamp01( Σ  その日の筋群負荷 / 基準値 × カーブ[経過日数] )
                          経過日数 0..2
```

- 減衰カーブは `lib/workout/soreness.ts` の配列 1 本で表現しています。
  - `当日ピーク`（既定）: `[1.0, 0.66, 0.33]`
  - `翌日ピーク`（DOMS の実感に近い）: `[0.4, 1.0, 0.5]`

  設定画面でどちらかを選べます。3日目以降はどちらも 0 になります。
- **基準値** は「その筋群を鍛えた日の負荷」の直近90日の75パーセンタイル。
  脚（55kg）と肩（9kg）のように重量のスケールが違う部位を同じ図の上で比べるための正規化です。
  記録が2件以下のうちは既定値と混ぜて、初日から真っ赤にならないようにしています。
- 複数日の刺激は加算され 1.0 で頭打ちになるので、連日同じ部位を叩くと濃く残ります。

## セットアップ

### 1. Supabase プロジェクト

1. [supabase.com](https://supabase.com) でプロジェクトを作成する。
2. SQL Editor で以下を**順に**実行する（`supabase` CLI があれば `supabase db push` でも可）。
   - `supabase/migrations/0001_schema.sql` — テーブル・RLS・集計ビュー
   - `supabase/migrations/0002_seed_masters.sql` — 筋群18・種目39・英語項目23
   - `supabase/migrations/0003_setup_status.sql` — セットアップ診断用の関数

   3つとも**何度実行しても壊れません**。途中で失敗したら、直してから頭から流し直して構いません。
3. Authentication > Providers で **Email** を有効にする（マジックリンクを使うので
   「Confirm email」は有効のままでよい）。
4. Authentication > URL Configuration を設定する。**2 つあるので両方**触ること。
   - **Site URL** — 本番の URL（`https://<your-app>.vercel.app`）。
     既定の `http://localhost:3000` のままだと、許可されていない戻り先を要求したときに
     ここへフォールバックし、スマホから開いて「サーバが見つかりません」になる。
   - **Redirect URLs** — `http://localhost:3000/auth/callback` と
     本番の `https://<your-app>.vercel.app/auth/callback` を追加する。
5. **独自の SMTP を設定する**（Project Settings > Authentication > SMTP Settings）。
   Supabase の組み込みメール送信は**共有の検証用サービス**で、**1時間あたり数通**しか
   送れません。少し試すだけで `email rate limit exceeded` に当たり、実用になりません。
   Resend / SendGrid / Amazon SES などを設定してください。設定後は
   Authentication > Rate Limits で上限も引き上げられます。
6. Authentication > Email Templates > **Magic Link** に `{{ .Token }}` を足す。
   既定のテンプレートはリンクだけで、**これを足さないと 6 桁コードが届かない**。
   本文の最後にこんな行を足せばよい:

   ```html
   <p>または、次のコードを入力してください: <strong>{{ .Token }}</strong></p>
   ```

### 2. ローカル開発

```bash
cp .env.example .env.local   # Supabase の URL と anon key を書く
npm install
npm run check:setup          # 設定が正しいか診断する
npm run dev                  # http://localhost:3000
```

`.env.local` に入れるのは **anon（publishable）キー**です。`service_role`（`sb_secret_`）キーを
入れるとブラウザに配信されて RLS が丸ごと迂回されるため、`check:setup` はこれを検出して止めます。

### セットアップの診断

```bash
npm run check:setup
```

Supabase に接続して、次を順に確認します。問題があれば、どのファイルを実行すればよいかまで出ます。

| 確認すること | 見逃すとどうなるか |
|---|---|
| anon キーの種別 | `service_role` を貼っていると RLS が完全に迂回される |
| REST API への到達性 | URL 違い / プロジェクト停止 |
| テーブル10件・ビュー4件 | `0001` の流し忘れ |
| マスタの件数（筋群18・種目39・技能4・英語項目23） | `0002` の流し忘れ。ログインはできるが何も記録できない |
| 全テーブルで RLS が有効か | 他人のデータが見える |
| Email プロバイダが有効か | ログインリンクが届かない（画面にエラーは出ない） |

**Redirect URLs だけは API から確認できない**ので、この診断の対象外です。手で確認してください
（登録すべき値はスクリプトが出力します）。

### 3. Vercel へのデプロイ

1. GitHub リポジトリを Vercel にインポートする。
2. 環境変数を設定する。
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SITE_URL`（例 `https://your-app.vercel.app`。マジックリンクの戻り先に使う）

   **`SITE_URL` には本番の安定したドメインを入れてください。** Vercel は 3 種類の
   ドメインを発行しますが、使ってよいのは 1 つだけです。

   | 種類 | 例 | `SITE_URL` に使う |
   |---|---|---|
   | 本番 | `your-app.vercel.app` | **これ** |
   | ブランチごと | `your-app-git-main-xxx.vercel.app` | ✗ |
   | デプロイごと | `your-app-a1b2c3-xxx.vercel.app` | ✗ デプロイのたびに変わる |

   ローカルの値（`http://localhost:3000`）が残っていると、本番から送ったログインリンクが
   localhost を指してしまいます。これは**メールは届くのに永久にログインできない**という
   分かりにくい壊れ方をするため、`lib/site-origin.ts` が「外からのリクエストなのに
   `SITE_URL` が localhost」という組み合わせを検出して無視するようにしていますが、
   値そのものを正しくしておくのが本筋です。

   `SITE_URL` に `NEXT_PUBLIC_` は付けません。この値は Server Action の中でしか読まないため、
   付けると Vercel に「ブラウザへ露出する」と警告されます。未設定でもリクエストのホストから
   組み立てて動きますが、本番では宛先を推測に頼らないよう設定しておくことを勧めます。
3. デプロイ後、その URL を Supabase の Redirect URLs にも追加する。

`service_role` キーはアプリからは使いません。すべてのアクセスは anon key + RLS を通ります。

### ログインメールのリンクが localhost に飛ぶとき

原因はアプリ側と Supabase 側の 2 つがあり、見分けがつかないと直しようがありません。
メールを送ると、送信完了の表示に**アプリが Supabase に渡した戻り先**が出ます。
これとメールのリンクを突き合わせれば、どちらが localhost を入れているか確定します。

| 画面の「戻り先」 | メールのリンク | 原因 | 直すところ |
| --- | --- | --- | --- |
| 本番の URL | 本番の URL | 正常 | — |
| 本番の URL | localhost | **Supabase 側** | Site URL と Redirect URLs |
| localhost | localhost | **アプリ側** | Vercel の `SITE_URL`、またはデプロイが古い |

「戻り先」が本番なのにリンクが localhost になるのは、渡した戻り先が
**Redirect URLs に登録されていない**ためです。この場合 Supabase は渡された値を捨てて
**Site URL** に差し替えます。つまり Site URL が localhost のままだと localhost に飛びます。
Authentication > URL Configuration で次の 2 つをどちらも直してください。

- **Site URL** — 本番の URL
- **Redirect URLs** — `https://<本番の URL>/auth/callback`（ローカル開発用の
  `http://localhost:3000/auth/callback` と両方あって構いません）

なお、リンクが直るまでの間も **6 桁コード**があればログインできます。コードは
Magic Link テンプレートに `{{ .Token }}` があるときだけメール本文に入るので、
まだ入れていなければ先に入れてください（リンクの設定と違って、こちらは
Redirect URLs の影響を受けません）。

## スマホのホーム画面に追加する

ジムではセット間の短い時間に数字を入れることになるので、ブラウザで URL を開くところから
始まるのは面倒です。ホーム画面に追加すると、アイコンから直接・全画面で起動できます
（アドレスバーが消えるぶん画面も広くなります）。

- **iPhone / iPad** — Safari で開き、共有ボタン → 「ホーム画面に追加」。iOS 15.4 以降が必要です。
- **Android** — Chrome で開き、メニュー → 「ホーム画面に追加」。

ノッチやホームインジケータのある端末でも、上部タブがステータスバーに潜り込んだり、
最下部のボタンがインジケータに隠れたりしないようにしてあります
（`app/globals.css` の `--safe-top` / `--safe-bottom`）。

### サービスワーカーは入れていません

Chrome の「インストール」プロンプトを出すには、オフラインで動くサービスワーカーが要ります。
ただしこのアプリは**全画面が Supabase への問い合わせに依存していて、オフラインでは何も表示できません**。
キャッシュを持たせても古いデータや壊れたログイン状態を見せるだけなので、入れない判断をしました。

サービスワーカーが無くても、manifest の `display: standalone` によって
**iOS も Android もホーム画面から全画面で起動します**。自動のインストールプロンプトが出ないだけです。

### アイコンを作り直す

元図は `design/icons/` にある SVG 3 枚です（通常 / ファビコン用に図形を拡大したもの /
Android の切り抜き用に縮めたもの）。色や形を変えたらここを編集して、PNG を書き出し直します。

| 書き出し先 | サイズ | 元図 | 用途 |
|---|---|---|---|
| `app/icon.png` | 32 | `icon-small.svg` | ブラウザのタブ |
| `app/apple-icon.png` | 180 | `icon.svg` | iOS のホーム画面（iOS は manifest のアイコンを見ない） |
| `public/icon-192.png` | 192 | `icon.svg` | manifest |
| `public/icon-512.png` | 512 | `icon.svg` | manifest |
| `public/icon-maskable-512.png` | 512 | `icon-maskable.svg` | Android のアダプティブアイコン |

書き出しは SVG を指定サイズで描画して PNG 保存するだけなので、ブラウザや画像ツールなど
好きな方法で構いません。PNG はリポジトリにコミットしてあります。

## コマンド

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run test       # Vitest（負荷計算・筋肉痛・バランススコア）
npm run check:setup # Supabase の設定を診断する
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
```

## 構成

```
app/
  manifest.ts             PWA の manifest（ホーム画面に追加したときの名前・アイコン）
  icon.png / apple-icon.png  タブと iOS ホーム画面のアイコン
  login/                  マジックリンクのログイン
  auth/callback/          セッション確立
  (app)/                  上部タブ（筋トレ / 英語）+ 認証ガード
    workout/              記録・人体図・頑張りゲージ / history / exercises
    english/              記録・レーダー・おすすめ / history / activities
    settings/             体重・筋肉痛カーブ・週間目標
proxy.ts                  セッション更新と未認証リダイレクト（Next.js 16 の middleware）
lib/
  muscles.ts              筋群18の定義
  date.ts                 Asia/Tokyo 基準の日付ヘルパー
  workout/volume.ts       実効重量・負荷・頑張りスコア
  workout/soreness.ts     筋肉痛の減衰モデル
  workout/color-scale.ts  人体図のカラースケール
  english/balance.ts      バランススコア・週次達成率・おすすめ
components/
  body-map/               人体図の SVG（左半身を定義して左右反転で全身にする）
supabase/migrations/      スキーマ・RLS・ビュー・マスタ投入・診断用の関数
scripts/check-setup.mjs   セットアップ診断（npm run check:setup）
design/icons/             アイコンの元図（SVG）。PNG はここから書き出す
```

## 設計上の判断

- **負荷の計算は SQL のビューに集約** — `v_set_load` / `v_daily_muscle_volume` などで一次計算を済ませ、
  一覧や集計はそのまま読むだけにしています。`lib/workout/volume.ts` に同じ式があるのは、
  保存前の入力プレビュー（数字を打つそばから負荷が見える）に必要なためです。
  **片方を変えたら必ず両方を揃えてください。**
- **日付はすべて Asia/Tokyo** — サーバーが UTC でも「今日」が前日にずれないよう、
  `lib/date.ts` で JST に丸めてから DB の `date` 列に渡します。
- **マスタは `user_id IS NULL` を共通行として扱う** — 全員が読めるが編集はできません（RLS）。
  自分だけの種目・項目は `user_id` 付きで追加します。
- **記録に使われたマスタは削除せず非表示にする** — 過去のログを壊さないためです。
- **人体図は左半身だけを定義** — 描画時に `translate(200,0) scale(-1,1)` で反転させたコピーを
  重ねて全身にしています。パスが半分で済み、左右がずれません。
  筋群レイヤーは輪郭で `clipPath` しているので、肩や脇で色がはみ出しません。
- **診断用の関数だけは `security definer`** — マスタの RLS は `to authenticated` なので、
  anon キーでは件数を数えられず「シードが入ったか」を判定できません。かといって診断のために
  `service_role` キーを手元に置かせるのは権限が強すぎるため、
  `public.setup_status()` が**共通マスタの件数と RLS の有効/無効だけ**を返します。
  個人のデータは 1 行も通らず、動的 SQL も使いません。
- **セーフエリアは `env()` を直接書かず変数に通す** — `--safe-top` / `--safe-bottom` を
  `:root` に置き、各所ではそれを参照しています。`env()` を直に書くとヘッドレスブラウザでは
  常に 0 になり、ノッチ対応ができているかを確かめる手段が無くなるためです。
  変数にしておけば実機相当の値を流し込んで再現・確認できます。
