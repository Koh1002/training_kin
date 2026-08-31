-- ============================================================================
-- 筋トレ・英語学習 記録アプリ  スキーマ
--
-- 設計方針:
--   * 全ユーザーデータは RLS で auth.uid() により分離する。
--   * マスタ（筋群・種目・英語項目）は user_id IS NULL を「共通マスタ」とし、
--     全ユーザーが読めるが編集はできない。ユーザー独自の追加は user_id 付きで行う。
--   * 負荷（volume）の一次計算はビューに集約し、アプリ側と二重実装しない。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- プロフィール
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users on delete cascade,
  display_name   text,
  -- 自重種目の負荷換算に使う。日毎の体重は workout_sessions 側で上書きできる。
  bodyweight_kg  numeric not null default 65 check (bodyweight_kg > 0 and bodyweight_kg < 500),
  -- 筋肉痛の減衰カーブ。添字 0 = トレーニング当日, 1 = 翌日, 2 = 翌々日。
  -- 既定は「当日がピークで翌々日まで徐々に軽減」。設定画面から差し替えられる。
  soreness_curve numeric[] not null default '{1.0,0.66,0.33}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint soreness_curve_len check (array_length(soreness_curve, 1) between 1 and 7)
);

-- ---------------------------------------------------------------------------
-- 筋群マスタ（人体図の塗り分け単位）
-- ---------------------------------------------------------------------------
create table if not exists public.muscles (
  code       text primary key,
  name_ja    text not null,
  -- 'front' | 'back' | 'both'（both = 三角筋中部のように前後どちらからも見える）
  region     text not null check (region in ('front', 'back', 'both')),
  sort_order int  not null default 0
);

-- ---------------------------------------------------------------------------
-- 種目マスタ
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id                uuid primary key default gen_random_uuid(),
  -- NULL = 共通マスタ（全ユーザーが読める）
  user_id           uuid references auth.users on delete cascade,
  name_ja           text not null,
  -- 過去メモでの表記（例 'ベンチ胸'）。検索のヒント用。
  memo_alias        text,
  category          text not null check (category in ('chest','back','shoulder','arm','leg','core','cardio')),
  -- weight   : 重量×回数×セット
  -- bodyweight: 体重 × bodyweight_factor を実効重量として扱う
  -- time     : 保持時間で記録（プランク等）
  -- cardio   : 速度・傾斜・時間で記録。総負荷には合算しない
  load_type         text not null check (load_type in ('weight','bodyweight','time','cardio')),
  bodyweight_factor numeric check (bodyweight_factor > 0 and bodyweight_factor <= 2),
  -- 過去メモの "x2" 表記。左右別に行うため負荷が 2 倍になる。
  is_unilateral     boolean not null default false,
  default_weight_kg numeric,
  default_reps      int,
  default_sets      int,
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  -- 自重種目は係数が必須、それ以外は係数を持たない
  constraint bodyweight_factor_required check (
    (load_type = 'bodyweight' and bodyweight_factor is not null)
    or (load_type <> 'bodyweight' and bodyweight_factor is null)
  )
);

create index if not exists exercises_user_idx on public.exercises (user_id, category, sort_order);

-- 種目 → 筋群の寄与度。人体図の塗り分けと筋肉痛計算の両方の入力になる。
create table if not exists public.exercise_muscles (
  exercise_id  uuid not null references public.exercises on delete cascade,
  muscle_code  text not null references public.muscles,
  -- 1.0 = 主働筋、0.3〜0.5 = 協働筋
  contribution numeric not null check (contribution > 0 and contribution <= 1),
  primary key (exercise_id, muscle_code)
);

-- ---------------------------------------------------------------------------
-- 筋トレの記録
-- ---------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  -- JST での「その日」。アプリ側で Asia/Tokyo 基準に丸めてから渡す。
  date          date not null,
  kind          text not null default 'training' check (kind in ('training','rest')),
  -- 休養日の理由（'オフ' '出張' '二日酔い' 'ジム休業' など任意テキスト）
  rest_reason   text,
  -- その日の体重。NULL なら profiles.bodyweight_kg を使う。
  bodyweight_kg numeric check (bodyweight_kg > 0 and bodyweight_kg < 500),
  note          text,
  created_at    timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, date desc);

create table if not exists public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.workout_sessions on delete cascade,
  exercise_id  uuid not null references public.exercises,
  order_index  int  not null default 0,
  -- load_type = 'weight'
  weight_kg    numeric check (weight_kg >= 0),
  reps         int    check (reps > 0),
  sets         int    check (sets > 0),
  -- load_type = 'time' | 'cardio'
  duration_min numeric check (duration_min > 0),
  hold_sec     numeric check (hold_sec > 0),
  -- load_type = 'cardio'（メモの "5s 10° 20m" に対応）
  speed        numeric check (speed >= 0),
  incline_deg  numeric check (incline_deg >= 0),
  distance_m   numeric check (distance_m >= 0),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists workout_sets_session_idx
  on public.workout_sets (session_id, order_index);
create index if not exists workout_sets_exercise_idx
  on public.workout_sets (exercise_id);

-- ---------------------------------------------------------------------------
-- 英語学習
-- ---------------------------------------------------------------------------
create table if not exists public.english_skills (
  code       text primary key check (code in ('reading','listening','speaking','writing')),
  name_ja    text not null,
  sort_order int not null default 0
);

create table if not exists public.english_activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade,  -- NULL = 共通マスタ
  skill_code  text not null references public.english_skills,
  name_ja     text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists english_activities_user_idx
  on public.english_activities (user_id, skill_code, sort_order);

create table if not exists public.english_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  date        date not null,
  activity_id uuid not null references public.english_activities,
  minutes     int not null check (minutes > 0 and minutes <= 1440),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists english_logs_user_date_idx
  on public.english_logs (user_id, date desc);

create table if not exists public.english_goals (
  user_id           uuid not null references auth.users on delete cascade,
  skill_code        text not null references public.english_skills,
  weekly_target_min int not null default 60 check (weekly_target_min >= 0),
  primary key (user_id, skill_code)
);

-- ---------------------------------------------------------------------------
-- 集計ビュー（security_invoker により参照元テーブルの RLS がそのまま効く）
-- ---------------------------------------------------------------------------

-- 1セット行あたりの実効重量と負荷
create or replace view public.v_set_load
with (security_invoker = true) as
select
  ws.id                as set_id,
  s.id                 as session_id,
  s.user_id,
  s.date,
  ws.exercise_id,
  e.name_ja            as exercise_name,
  e.category,
  e.load_type,
  ws.order_index,
  ws.weight_kg,
  ws.reps,
  ws.sets,
  ws.duration_min,
  ws.hold_sec,
  ws.speed,
  ws.incline_deg,
  ws.distance_m,
  -- 自重種目は「その日の体重（無ければプロフィールの体重）× 係数」を実効重量とする
  case e.load_type
    when 'weight'     then coalesce(ws.weight_kg, 0)
    when 'bodyweight' then coalesce(s.bodyweight_kg, p.bodyweight_kg) * e.bodyweight_factor
    else 0
  end::numeric         as effective_weight_kg,
  -- 有酸素は総負荷に混ぜない（単位が違うため別指標として扱う）
  case
    when e.load_type = 'cardio' then 0
    else
      case e.load_type
        when 'weight'     then coalesce(ws.weight_kg, 0)
        when 'bodyweight' then coalesce(s.bodyweight_kg, p.bodyweight_kg) * e.bodyweight_factor
        else 0
      end
      * coalesce(ws.reps, 0)
      * coalesce(ws.sets, 0)
      * case when e.is_unilateral then 2 else 1 end
  end::numeric         as volume_kg
from public.workout_sets ws
join public.workout_sessions s on s.id = ws.session_id
join public.exercises e        on e.id = ws.exercise_id
left join public.profiles p    on p.id = s.user_id;

-- 日次サマリ（総負荷・セット数・有酸素分数）
create or replace view public.v_daily_workout_summary
with (security_invoker = true) as
select
  s.user_id,
  s.date,
  s.kind,
  s.rest_reason,
  coalesce(sum(l.volume_kg), 0)                                        as total_volume_kg,
  count(l.set_id)                                                      as set_count,
  count(distinct l.exercise_id)                                        as exercise_count,
  coalesce(sum(l.duration_min) filter (where l.load_type = 'cardio'), 0) as cardio_minutes
from public.workout_sessions s
left join public.v_set_load l on l.session_id = s.id
group by s.user_id, s.date, s.kind, s.rest_reason;

-- 日次 × 筋群の負荷。人体図と筋肉痛モデルの共通の入力。
create or replace view public.v_daily_muscle_volume
with (security_invoker = true) as
select
  l.user_id,
  l.date,
  em.muscle_code,
  sum(l.volume_kg * em.contribution)::numeric as volume_kg
from public.v_set_load l
join public.exercise_muscles em on em.exercise_id = l.exercise_id
where l.volume_kg > 0
group by l.user_id, l.date, em.muscle_code;

-- 英語の週次サマリ（週は月曜はじまり）
create or replace view public.v_weekly_english_summary
with (security_invoker = true) as
select
  g.user_id,
  date_trunc('week', g.date)::date as week_start,
  a.skill_code,
  sum(g.minutes)::int              as minutes
from public.english_logs g
join public.english_activities a on a.id = g.activity_id
group by g.user_id, date_trunc('week', g.date), a.skill_code;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.muscles            enable row level security;
alter table public.exercises          enable row level security;
alter table public.exercise_muscles   enable row level security;
alter table public.workout_sessions   enable row level security;
alter table public.workout_sets       enable row level security;
alter table public.english_skills     enable row level security;
alter table public.english_activities enable row level security;
alter table public.english_logs       enable row level security;
alter table public.english_goals      enable row level security;

-- 参照のみの共通マスタ
create policy muscles_select on public.muscles
  for select to authenticated using (true);
create policy english_skills_select on public.english_skills
  for select to authenticated using (true);

-- プロフィールは本人のみ
create policy profiles_select on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy profiles_insert on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy profiles_update on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 種目: 共通マスタ + 自分の追加分を読める。書き込みは自分の分だけ。
create policy exercises_select on public.exercises
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy exercises_insert on public.exercises
  for insert to authenticated with check (user_id = auth.uid());
create policy exercises_update on public.exercises
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exercises_delete on public.exercises
  for delete to authenticated using (user_id = auth.uid());

-- 種目↔筋群: 親の種目の可視性に従う
create policy exercise_muscles_select on public.exercise_muscles
  for select to authenticated using (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid())
    )
  );
create policy exercise_muscles_write on public.exercise_muscles
  for all to authenticated
  using (
    exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = auth.uid())
  );

-- 筋トレ記録は本人のみ
create policy workout_sessions_all on public.workout_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- セットは親セッションの所有者で判定する
create policy workout_sets_all on public.workout_sets
  for all to authenticated
  using (
    exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- 英語項目: 共通マスタ + 自分の追加分
create policy english_activities_select on public.english_activities
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy english_activities_insert on public.english_activities
  for insert to authenticated with check (user_id = auth.uid());
create policy english_activities_update on public.english_activities
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy english_activities_delete on public.english_activities
  for delete to authenticated using (user_id = auth.uid());

create policy english_logs_all on public.english_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy english_goals_all on public.english_goals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 新規ユーザーの初期化（profiles と英語の週次目標を作る）
-- テーブル定義より後に置く必要があるためファイル末尾で定義する。
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  -- 英語の週次目標を 4 技能ぶん初期化する
  insert into public.english_goals (user_id, skill_code, weekly_target_min)
  select new.id, s.code, 60 from public.english_skills s
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
