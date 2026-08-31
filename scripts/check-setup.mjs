#!/usr/bin/env node
/**
 * Supabase のセットアップ診断。
 *
 *   npm run check:setup
 *
 * 「マイグレーションを流したつもりだが本当に動くのか」を、手元で 1 コマンド
 * 確かめるためのもの。依存は増やさず fetch だけで Supabase の REST / Auth を叩く。
 *
 * .env.local は自前で読む。Node の --env-file はバージョンによって挙動が違い、
 * ファイルが無いときのエラーも不親切なため。環境変数が直接設定されている場合
 * （Vercel など）はそちらを使う。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 期待されるマスタの件数。supabase/migrations/0002_seed_masters.sql と対応する。
const EXPECTED = {
  muscles: 18,
  shared_exercises: 39,
  english_skills: 4,
  shared_activities: 23,
}

// 0001_schema.sql が作るオブジェクト
const TABLES = [
  'profiles', 'muscles', 'exercises', 'exercise_muscles',
  'workout_sessions', 'workout_sets',
  'english_skills', 'english_activities', 'english_logs', 'english_goals',
]
const VIEWS = [
  'v_set_load', 'v_daily_workout_summary', 'v_daily_muscle_volume', 'v_weekly_english_summary',
]

// --- 出力 --------------------------------------------------------------------

const failures = []
const notes = []

const c = process.stdout.isTTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
  : { g: '', r: '', y: '', d: '', b: '', x: '' }

const ok = (msg, extra) => console.log(`  ${c.g}✓${c.x} ${msg}${extra ? ` ${c.d}${extra}${c.x}` : ''}`)
const skip = (msg, extra) => console.log(`  ${c.y}−${c.x} ${msg}${extra ? ` ${c.d}${extra}${c.x}` : ''}`)
const section = (title) => console.log(`\n${c.b}${title}${c.x}`)

function fail(msg, fix) {
  console.log(`  ${c.r}✗${c.x} ${msg}`)
  if (fix) console.log(`    ${c.d}→ ${fix}${c.x}`)
  failures.push(msg)
}

// --- 環境変数 ----------------------------------------------------------------

/** .env.local を読む。KEY=VALUE のみを見る簡易パーサ。 */
function loadEnvFile(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return {}
  }

  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // 前後のクォートだけ外す
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

/**
 * ホストされたプロジェクトか、ローカルの Supabase かを判定する。
 * `supabase start` のローカル環境は http://127.0.0.1:54321 になるので、
 * これを弾いてしまわないようにする。
 */
function isSupabaseUrl(value) {
  if (/^https:\/\/[a-z0-9-]+\.supabase\.(co|red)$/.test(value)) return true
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(value)
}

/** JWT の payload を検証せずに覗く。キーの貼り間違いを見つけるためだけに使う。 */
function peekJwtRole(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

const fileEnv = loadEnvFile(resolve(process.cwd(), '.env.local'))
const env = { ...fileEnv, ...process.env }
const usingFile = Object.keys(fileEnv).length > 0

const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

console.log(`${c.b}Supabase セットアップ診断${c.x}`)
console.log(`${c.d}${usingFile ? '.env.local を読み込みました' : '環境変数から読み込みました（.env.local は見つかりません）'}${c.x}`)

section('1. 環境変数')

let urlLooksSane = false
if (!url) {
  fail('NEXT_PUBLIC_SUPABASE_URL が設定されていません', 'cp .env.example .env.local して、Supabase の Settings > API の Project URL を入れてください')
} else if (!isSupabaseUrl(url)) {
  fail(
    `NEXT_PUBLIC_SUPABASE_URL の形が想定と違います: ${url}`,
    'https://<プロジェクトID>.supabase.co の形で入れてください（supabase start のローカル環境なら http://127.0.0.1:54321）',
  )
} else {
  ok('NEXT_PUBLIC_SUPABASE_URL', url)
  urlLooksSane = true
}

// キーの貼り間違いはここで必ず止める。
// service_role キーはブラウザに配信されるコードに埋め込まれるため、
// 入っていると RLS が丸ごと無効化され、URL を知る全員が全データを読み書きできる。
let keyLooksSane = false
if (!anonKey) {
  fail('NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません', 'Settings > API の anon / publishable キーを入れてください')
} else if (anonKey.startsWith('sb_secret_')) {
  fail(
    '【危険】anon キーの欄に secret キー（sb_secret_...）が入っています',
    'このキーはブラウザに配信されるため RLS が完全に迂回されます。' +
      'publishable キー（sb_publishable_...）に差し替え、漏れた可能性があるなら Supabase でローテーションしてください',
  )
} else if (anonKey.startsWith('sb_publishable_')) {
  ok('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'publishable キー')
  keyLooksSane = true
} else {
  const role = peekJwtRole(anonKey)
  if (role === 'service_role') {
    fail(
      '【危険】anon キーの欄に service_role キーが入っています',
      'このキーはブラウザに配信されるため RLS が完全に迂回され、URL を知る全員が全データを読み書きできます。' +
        'anon キーに差し替え、漏れた可能性があるなら Supabase でローテーションしてください',
    )
  } else if (role === 'anon') {
    ok('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon キー')
    keyLooksSane = true
  } else if (role) {
    fail(`anon キーの role が想定外です: ${role}`, 'Settings > API の anon キーを入れてください')
  } else {
    skip('NEXT_PUBLIC_SUPABASE_ANON_KEY の種別を判定できませんでした', '未知の形式です。そのまま接続を試します')
    keyLooksSane = true
  }
}

if (!urlLooksSane || !keyLooksSane) {
  console.log(`\n${c.r}環境変数が揃っていないため、ここで終了します。${c.x}`)
  process.exit(1)
}

// --- 通信 --------------------------------------------------------------------

const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` }

async function request(path, init = {}) {
  try {
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15000),
    })
    return { res }
  } catch (error) {
    return { error }
  }
}

section('2. 接続')

const root = await request('/rest/v1/')
if (root.error) {
  fail(
    `${url} に接続できません（${root.error.cause?.code ?? root.error.name}）`,
    'URL が正しいか、プロジェクトが一時停止していないか、ネットワークが Supabase に到達できるかを確認してください',
  )
  console.log(`\n${c.r}接続できないため、ここで終了します。${c.x}`)
  process.exit(1)
} else if (root.res.status === 401) {
  fail('接続はできましたが認証されませんでした（401）', 'anon キーがこのプロジェクトのものか確認してください')
  console.log(`\n${c.r}認証できないため、ここで終了します。${c.x}`)
  process.exit(1)
} else {
  ok('REST API に到達できました', `HTTP ${root.res.status}`)
}

// --- スキーマ ----------------------------------------------------------------

section('3. スキーマ（0001_schema.sql）')

const missing = []
for (const name of [...TABLES, ...VIEWS]) {
  // RLS で 0 件になるのと、オブジェクトが存在しないのは別物。
  // 前者は 200 + []、後者は 404 + PGRST205 なので区別できる。
  const { res, error } = await request(`/rest/v1/${name}?select=*&limit=0`)
  if (error) {
    missing.push(`${name}（通信エラー）`)
  } else if (res.status === 404) {
    missing.push(name)
  } else if (!res.ok && res.status !== 401 && res.status !== 403) {
    missing.push(`${name}（HTTP ${res.status}）`)
  }
}

if (missing.length === 0) {
  ok(`テーブル ${TABLES.length} 件・ビュー ${VIEWS.length} 件をすべて確認`)
} else {
  fail(
    `見つからないオブジェクトがあります: ${missing.join(', ')}`,
    'Supabase の SQL Editor で supabase/migrations/0001_schema.sql を実行してください',
  )
}

// --- シードと RLS ------------------------------------------------------------

section('4. マスタとRLS（0002_seed_masters.sql）')

const status = await request('/rest/v1/rpc/setup_status', { method: 'POST' })

if (status.error) {
  fail(`診断用の関数を呼び出せませんでした（${status.error.name}）`)
} else if (status.res.status === 404) {
  skip(
    '診断用の関数 setup_status() がありません',
    'supabase/migrations/0003_setup_status.sql を実行すると、マスタ件数とRLSも確認できるようになります',
  )
  notes.push('0003_setup_status.sql が未適用のため、マスタ件数とRLSは未確認です')
} else if (!status.res.ok) {
  fail(`診断用の関数がエラーを返しました（HTTP ${status.res.status}）`, await status.res.text().catch(() => ''))
} else {
  const data = await status.res.json()

  // 対処はどれも「0002 を流す」なので、ずれた項目はまとめて 1 件として出す
  const mismatches = Object.entries(EXPECTED)
    .map(([key, expected]) => ({ key, expected, actual: Number(data[key] ?? 0) }))
    .filter((m) => m.actual !== m.expected)

  if (Number(data.exercise_muscle_links ?? 0) === 0) {
    mismatches.push({ key: 'exercise_muscle_links（種目と筋群の対応）', expected: '1以上', actual: 0 })
  }

  if (mismatches.length === 0) {
    ok(
      'マスタが投入されています',
      `筋群${data.muscles} / 種目${data.shared_exercises} / 技能${data.english_skills} / 英語項目${data.shared_activities}`,
    )
  } else {
    const allEmpty = mismatches.every((m) => m.actual === 0)
    fail(
      `マスタの件数が期待と違います: ${mismatches.map((m) => `${m.key} ${m.actual}件（期待 ${m.expected}）`).join(' / ')}`,
      allEmpty
        ? 'Supabase の SQL Editor で supabase/migrations/0002_seed_masters.sql を実行してください'
        : '0002_seed_masters.sql を実行し直すと期待値に揃います（何度実行しても安全です）',
    )
  }

  // RLS が切れているテーブルは、他人のデータが見えるということなので必ず名指しする
  const rls = data.rls_enabled ?? {}
  const unprotected = TABLES.filter((t) => rls[t] === false)
  const unknown = TABLES.filter((t) => rls[t] === undefined)

  if (unprotected.length > 0) {
    fail(
      `RLS が無効なテーブルがあります: ${unprotected.join(', ')}（他人のデータが見える状態です）`,
      'supabase/migrations/0001_schema.sql を実行し直してください',
    )
  } else if (unknown.length > 0) {
    skip(`RLS の状態を確認できないテーブルがあります: ${unknown.join(', ')}`)
  } else {
    ok(`RLS が全 ${TABLES.length} テーブルで有効`)
  }
}

// --- 認証 --------------------------------------------------------------------

section('5. 認証')

const settings = await request('/auth/v1/settings')
if (settings.error || !settings.res.ok) {
  skip('認証設定を取得できませんでした', 'Authentication > Providers を目視で確認してください')
} else {
  const data = await settings.res.json()
  if (data.external?.email === false) {
    fail(
      'Email プロバイダが無効です',
      'Authentication > Providers で Email を有効にしてください（無効だとログインリンクが届きません）',
    )
  } else {
    ok('Email プロバイダが有効')
  }
}

// Redirect URL は API から確認できない。確認していないことを黙って伏せない。
skip('Redirect URLs は API から確認できません', '下の「手で確認すること」を見てください')

// --- まとめ ------------------------------------------------------------------

console.log(`\n${c.b}手で確認すること${c.x}`)
console.log(`  Supabase の Authentication > URL Configuration > Redirect URLs に`)
console.log(`  次が登録されているか（無いとログインリンクを踏んでも戻ってこられません）:`)
console.log(`    ${c.d}http://localhost:3000/auth/callback${c.x}`)
console.log(`    ${c.d}https://<本番のドメイン>/auth/callback${c.x}`)

for (const note of notes) console.log(`\n${c.y}※ ${note}${c.x}`)

if (failures.length > 0) {
  console.log(`\n${c.r}${c.b}${failures.length} 件の問題が見つかりました。${c.x}`)
  process.exit(1)
}

console.log(`\n${c.g}${c.b}問題は見つかりませんでした。${c.x}`)
console.log(`${c.d}npm run dev で起動し、メールアドレスを入れてログインしてみてください。${c.x}`)
