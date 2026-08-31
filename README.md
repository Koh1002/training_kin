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
4. Authentication > URL Configuration の **Redirect URLs** に
   `http://localhost:3000/auth/callback` と本番の `https://<your-app>.vercel.app/auth/callback`
   を追加する。

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
   - `NEXT_PUBLIC_SITE_URL`（例 `https://your-app.vercel.app`。マジックリンクの戻り先に使う）
3. デプロイ後、その URL を Supabase の Redirect URLs にも追加する。

`service_role` キーはアプリからは使いません。すべてのアクセスは anon key + RLS を通ります。

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
