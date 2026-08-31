-- ============================================================================
-- セットアップ診断用の関数
--
-- `npm run check:setup` が anon キーだけで「マイグレーションとシードが
-- 正しく流れているか」を確認できるようにするためのもの。
--
-- なぜ security definer か:
--   マスタ（muscles など）の RLS は `to authenticated` なので、anon キーで
--   数えると常に 0 件になり、シードの有無を判定できない。かといって診断のために
--   service_role キーを手元の .env.local に置かせるのは権限が強すぎる。
--
-- 何を返すか:
--   全ユーザー共通のマスタの「件数」と、テーブルごとの RLS の有効/無効だけ。
--   個人のデータは 1 行も通らないので、anon に開いても漏れるものが無い。
--   集計しか返さないよう、動的 SQL を使わず search_path も固定している。
-- ============================================================================

create or replace function public.setup_status()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'muscles',               (select count(*) from public.muscles),
    'shared_exercises',      (select count(*) from public.exercises where user_id is null),
    'exercise_muscle_links', (select count(*) from public.exercise_muscles),
    'english_skills',        (select count(*) from public.english_skills),
    'shared_activities',     (select count(*) from public.english_activities where user_id is null),
    -- テーブルごとの RLS の有効/無効。どこかで切れていたら他人のデータが見えてしまうので、
    -- スキーマが通っているかとは別に必ず確認する。
    'rls_enabled', (
      select jsonb_object_agg(c.relname, c.relrowsecurity)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
    )
  )
$$;

comment on function public.setup_status() is
  'セットアップ診断用。共通マスタの件数と各テーブルの RLS 状態のみを返す（個人データは含まない）。';

-- 既定の PUBLIC への実行権を落としてから、必要なロールにだけ与える
revoke all on function public.setup_status() from public;
grant execute on function public.setup_status() to anon, authenticated;

-- PostgREST に関数を認識させる。Supabase は通常自動で再読込するが、
-- 流した直後に /rest/v1/rpc/setup_status が 404 になるのを避けるため明示しておく。
notify pgrst, 'reload schema';
