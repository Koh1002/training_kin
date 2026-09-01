-- ============================================================================
-- 共通マスタのシード
--   * 筋群 18
--   * 種目 39（過去の筋トレメモから抽出。memo_alias に当時の表記を残す）
--   * 英語 4 技能 / 22 項目
-- 再実行しても安全なように on conflict で冪等にしている。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 筋群
-- ---------------------------------------------------------------------------
insert into public.muscles (code, name_ja, region, sort_order) values
  ('chest_upper', '大胸筋上部',     'front', 10),
  ('chest_mid',   '大胸筋中部',     'front', 20),
  ('delt_front',  '三角筋前部',     'front', 30),
  ('delt_mid',    '三角筋中部',     'both',  40),
  ('delt_rear',   '三角筋後部',     'back',  50),
  ('biceps',      '上腕二頭筋',     'front', 60),
  ('triceps',     '上腕三頭筋',     'back',  70),
  ('forearm',     '前腕',           'front', 80),
  ('trap',        '僧帽筋',         'back',  90),
  ('lat',         '広背筋',         'back',  100),
  ('erector',     '脊柱起立筋',     'back',  110),
  ('abs',         '腹直筋',         'front', 120),
  ('oblique',     '腹斜筋',         'front', 130),
  ('glute',       '大臀筋',         'back',  140),
  ('quad',        '大腿四頭筋',     'front', 150),
  ('hamstring',   'ハムストリング', 'back',  160),
  ('adductor',    '内転筋',         'front', 170),
  ('calf',        'ふくらはぎ',     'back',  180)
on conflict (code) do update
  set name_ja = excluded.name_ja,
      region  = excluded.region,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 英語 4 技能
-- ---------------------------------------------------------------------------
insert into public.english_skills (code, name_ja, sort_order) values
  ('reading',   'Reading',   10),
  ('listening', 'Listening', 20),
  ('speaking',  'Speaking',  30),
  ('writing',   'Writing',   40)
on conflict (code) do update set name_ja = excluded.name_ja, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 種目 + 筋群マッピング
--   共通マスタは user_id IS NULL。name_ja で冪等にするため部分ユニーク索引を張る。
-- ---------------------------------------------------------------------------
create unique index if not exists exercises_shared_name_uniq
  on public.exercises (name_ja) where user_id is null;

create unique index if not exists english_activities_shared_name_uniq
  on public.english_activities (skill_code, name_ja) where user_id is null;

-- 種目を1件と、その筋群寄与度をまとめて登録するヘルパー。
-- muscle_map は '{"chest_mid": 1.0, "triceps": 0.4}' 形式の JSON。
create or replace function public.seed_shared_exercise(
  p_name_ja           text,
  p_memo_alias        text,
  p_category          text,
  p_load_type         text,
  p_bodyweight_factor numeric,
  p_is_unilateral     boolean,
  p_default_weight_kg numeric,
  p_default_reps      int,
  p_default_sets      int,
  p_sort_order        int,
  p_muscle_map        jsonb
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.exercises (
    user_id, name_ja, memo_alias, category, load_type, bodyweight_factor,
    is_unilateral, default_weight_kg, default_reps, default_sets, sort_order
  ) values (
    null, p_name_ja, p_memo_alias, p_category, p_load_type, p_bodyweight_factor,
    p_is_unilateral, p_default_weight_kg, p_default_reps, p_default_sets, p_sort_order
  )
  on conflict (name_ja) where user_id is null do update set
    memo_alias        = excluded.memo_alias,
    category          = excluded.category,
    load_type         = excluded.load_type,
    bodyweight_factor = excluded.bodyweight_factor,
    is_unilateral     = excluded.is_unilateral,
    default_weight_kg = excluded.default_weight_kg,
    default_reps      = excluded.default_reps,
    default_sets      = excluded.default_sets,
    sort_order        = excluded.sort_order
  returning id into v_id;

  delete from public.exercise_muscles where exercise_id = v_id;

  insert into public.exercise_muscles (exercise_id, muscle_code, contribution)
  select v_id, key, value::numeric
  from jsonb_each_text(p_muscle_map);

  return v_id;
end;
$$;

select public.seed_shared_exercise(name_ja, memo_alias, category, load_type, bodyweight_factor,
                                   is_unilateral, default_weight_kg, default_reps, default_sets,
                                   sort_order, muscle_map)
from (values
  -- 胸 ---------------------------------------------------------------------
  ('ベンチプレス（胸）',       'ベンチ胸',       'chest',    'weight',     null,   false, 40,   10, 3, 10,  '{"chest_mid":1.0,"triceps":0.4,"delt_front":0.3}'::jsonb),
  ('インクラインプレス',       'インクラ',       'chest',    'weight',     null,   false, 40,   8,  3, 20,  '{"chest_upper":1.0,"delt_front":0.4,"triceps":0.3}'::jsonb),
  ('チェストプレス',           'チェストプレス', 'chest',    'weight',     null,   false, 20,   10, 3, 30,  '{"chest_mid":1.0,"triceps":0.3}'::jsonb),
  ('胸フライ（ペックフライ）', '胸フライ',       'chest',    'weight',     null,   false, 36,   10, 3, 40,  '{"chest_mid":1.0}'::jsonb),
  ('ダンベルフライ',           'ダンベルフライ', 'chest',    'weight',     null,   false, 7,    10, 3, 50,  '{"chest_mid":1.0,"delt_front":0.3}'::jsonb),
  ('チューブ胸',               'チューブ胸',     'chest',    'weight',     null,   false, 8.75, 10, 3, 60,  '{"chest_mid":0.8,"delt_front":0.3}'::jsonb),
  ('腕立て伏せ',               '腕立て',         'chest',    'bodyweight', 0.65,   false, null, 10, 3, 70,  '{"chest_mid":1.0,"triceps":0.5,"delt_front":0.3}'::jsonb),
  -- 背中 -------------------------------------------------------------------
  ('懸垂マシン（背中）',       '懸垂 背中',      'back',     'weight',     null,   false, 41,   10, 3, 110, '{"lat":1.0,"trap":0.3,"biceps":0.3}'::jsonb),
  ('懸垂マシン（腕）',         '懸垂 腕',        'back',     'weight',     null,   false, 41,   10, 3, 120, '{"biceps":1.0,"lat":0.5}'::jsonb),
  ('懸垂（自重）',             '懸垂 自重',      'back',     'bodyweight', 1.0,    false, null, 3,  2, 130, '{"lat":1.0,"biceps":0.5,"trap":0.3}'::jsonb),
  ('ラットプルダウン',         'ラッドプル',     'back',     'weight',     null,   false, 47,   10, 3, 140, '{"lat":1.0,"biceps":0.3,"trap":0.3}'::jsonb),
  ('ハンマーロウ（上部）',     'ハンマー背中上', 'back',     'weight',     null,   false, 26,   10, 3, 150, '{"trap":1.0,"lat":0.5,"delt_rear":0.3}'::jsonb),
  ('ハンマーロウ（下部）',     'ハンマー背中下', 'back',     'weight',     null,   false, 26,   10, 3, 160, '{"lat":1.0,"trap":0.3}'::jsonb),
  ('デッドリフト',             'デットリフト',   'back',     'weight',     null,   false, 40,   10, 3, 170, '{"erector":1.0,"hamstring":0.6,"glute":0.6,"trap":0.3}'::jsonb),
  ('バックエクステンション',   '背筋 自重',      'back',     'bodyweight', 0.4,    false, null, 10, 3, 180, '{"erector":1.0,"glute":0.4}'::jsonb),
  -- 肩 ---------------------------------------------------------------------
  ('ショルダープレス',         'ベンチ肩',       'shoulder', 'weight',     null,   false, 20,   10, 3, 210, '{"delt_front":1.0,"delt_mid":0.6,"triceps":0.4}'::jsonb),
  ('リアレイズ',               '肩うしろ',       'shoulder', 'weight',     null,   true,  9,    10, 3, 220, '{"delt_rear":1.0}'::jsonb),
  ('サイドレイズ（マシン）',   '肩中央部',       'shoulder', 'weight',     null,   true,  9,    10, 3, 230, '{"delt_mid":1.0}'::jsonb),
  ('サイドレイズ（ダンベル）', 'サイドレイズ',   'shoulder', 'weight',     null,   false, 15,   10, 3, 240, '{"delt_mid":1.0,"delt_rear":0.3}'::jsonb),
  ('フロントレイズ（ダンベル）','肩前ダンベル',   'shoulder', 'weight',     null,   false, 8,    10, 3, 245, '{"delt_front":1.0,"delt_mid":0.3}'::jsonb),
  ('肩フライ',                 '肩フライ',       'shoulder', 'weight',     null,   false, 25,   10, 3, 250, '{"delt_mid":1.0,"delt_rear":0.5}'::jsonb),
  ('チューブ肩',               'チューブ肩',     'shoulder', 'weight',     null,   false, 3.75, 10, 3, 260, '{"delt_mid":0.8,"delt_rear":0.4}'::jsonb),
  -- 腕 ---------------------------------------------------------------------
  ('アームカール',             '二頭筋',         'arm',      'weight',     null,   false, 8,    10, 3, 310, '{"biceps":1.0,"forearm":0.3}'::jsonb),
  ('チューブ腕',               'チューブ腕',     'arm',      'weight',     null,   false, 13.75,10, 3, 320, '{"biceps":0.6,"triceps":0.6}'::jsonb),
  ('前腕カール（U字バー）',    '前腕U字',        'arm',      'weight',     null,   false, 25,   10, 3, 330, '{"forearm":1.0}'::jsonb),
  ('前腕カール（立位）',       '前腕 立ち',      'arm',      'weight',     null,   false, 8,    10, 3, 340, '{"forearm":1.0}'::jsonb),
  ('前腕カール（座位）',       '前腕 椅子',      'arm',      'weight',     null,   false, 8,    10, 3, 350, '{"forearm":1.0}'::jsonb),
  -- 脚 ---------------------------------------------------------------------
  ('スクワット',               'スクワット',     'leg',      'weight',     null,   false, 35,   10, 4, 410, '{"quad":1.0,"glute":0.7,"hamstring":0.4,"erector":0.3}'::jsonb),
  ('スクワット（自重）',       'スクワット 自重','leg',      'bodyweight', 0.6,    false, null, 15, 4, 420, '{"quad":1.0,"glute":0.7}'::jsonb),
  ('レッグエクステンション',   'もも前',         'leg',      'weight',     null,   false, 33,   10, 3, 430, '{"quad":1.0}'::jsonb),
  ('レッグカール',             'もも裏',         'leg',      'weight',     null,   false, 55,   10, 4, 440, '{"hamstring":1.0,"glute":0.3}'::jsonb),
  ('レッグカール（左右別）',   'レッグカール',   'leg',      'weight',     null,   true,  8,    10, 3, 450, '{"hamstring":1.0}'::jsonb),
  ('アダクション（内転筋）',   'ももうち',       'leg',      'weight',     null,   false, 50,   10, 4, 460, '{"adductor":1.0}'::jsonb),
  -- 体幹 -------------------------------------------------------------------
  ('アブクランチ',             '腹直筋',         'core',     'weight',     null,   false, 15,   10, 3, 510, '{"abs":1.0}'::jsonb),
  ('トーソローテーション',     '腹斜筋',         'core',     'weight',     null,   true,  32,   10, 3, 520, '{"oblique":1.0,"abs":0.3}'::jsonb),
  ('V字腹筋',                  'V字腹筋',        'core',     'bodyweight', 0.4,    false, null, 10, 3, 530, '{"abs":1.0,"oblique":0.3}'::jsonb),
  ('プランク',                 'プランク',       'core',     'time',       null,   false, null, null, 3, 540, '{"abs":1.0,"oblique":0.4,"erector":0.4}'::jsonb),
  -- 有酸素 -----------------------------------------------------------------
  ('ウォーキング（トレッドミル）','ウォーキング','cardio',   'cardio',     null,   false, null, null, null, 610, '{"quad":0.3,"calf":0.3,"glute":0.2}'::jsonb),
  ('有酸素（その他）',         '有酸素',         'cardio',   'cardio',     null,   false, null, null, null, 620, '{"quad":0.2,"calf":0.2}'::jsonb),
  ('登山',                     '登山',           'cardio',   'cardio',     null,   false, null, null, null, 630, '{"quad":0.5,"glute":0.4,"calf":0.4,"hamstring":0.3}'::jsonb)
) as t(name_ja, memo_alias, category, load_type, bodyweight_factor, is_unilateral,
       default_weight_kg, default_reps, default_sets, sort_order, muscle_map);

-- ---------------------------------------------------------------------------
-- 英語の学習項目
-- ---------------------------------------------------------------------------
insert into public.english_activities (user_id, skill_code, name_ja, description, sort_order) values
  -- Reading
  (null, 'reading',   '単語（単語帳・Anki）',       '語彙のインプット。カード枚数ではなく取り組んだ時間で記録する',  10),
  (null, 'reading',   '長文読解',                   '問題集・試験形式の長文',                                        20),
  (null, 'reading',   '論文精読',                   '専門分野の論文を辞書を引きながら読む',                          30),
  (null, 'reading',   '音読',                       '声に出して読む。発音とリズムを body に入れる',                  40),
  (null, 'reading',   'ニュース記事',               'BBC / Reuters などの時事英文',                                  50),
  (null, 'reading',   '洋書多読',                   '辞書を引かずに量を読む',                                        60),
  -- Listening
  (null, 'listening', 'シャドーイング',             '音源に半拍遅れて追いかけて発話する',                            10),
  (null, 'listening', '英語教材リスニング',         'TOEIC / 教材付属音源など',                                      20),
  (null, 'listening', 'ポッドキャスト',             '興味のある分野の英語ポッドキャスト',                            30),
  (null, 'listening', '講演・学会動画の視聴',       'YouTube / 学会アーカイブの英語発表',                            40),
  (null, 'listening', 'ディクテーション',           '聞き取って書き起こす',                                          50),
  (null, 'listening', '映画・ドラマ（英語音声）',   '英語字幕または字幕なしで視聴',                                  60),
  -- Speaking
  (null, 'speaking',  '1分スピーチ',                'お題を決めて1分間話し切る。録音して聞き返す',                   10),
  (null, 'speaking',  '学会発表台本の作成',         '発表原稿を英語で書き起こす',                                    20),
  (null, 'speaking',  '学会発表リハーサル（音読）', '台本を声に出して通し練習する',                                  30),
  (null, 'speaking',  'オンライン英会話',           'ネイティブ／講師との対話',                                      40),
  (null, 'speaking',  '独り言英語（セルフトーク）', '身の回りのことを英語で実況する',                                50),
  (null, 'speaking',  '質疑応答（Q&A）練習',        '想定質問に即興で答える練習',                                    60),
  -- Writing
  (null, 'writing',   '英語日記',                   'その日あったことを数行で書く',                                  10),
  (null, 'writing',   '作文・エッセイ',             'お題に対して構成のあるまとまった文章を書く',                    20),
  (null, 'writing',   '論文アブストラクト執筆',     '自分の研究の要旨を英語でまとめる',                              30),
  (null, 'writing',   '英文メール作成',             'ビジネス・研究連絡の定型表現を身につける',                      40),
  (null, 'writing',   '要約ライティング',           '読んだ記事や論文を英語で要約する',                              50)
on conflict (skill_code, name_ja) where user_id is null do update
  set description = excluded.description, sort_order = excluded.sort_order;
