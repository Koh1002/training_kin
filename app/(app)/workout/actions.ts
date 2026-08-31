'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

/**
 * 筋トレの記録に関する書き込み。
 * 数値は「未入力」と「0」を区別したいので、空文字は null に落としてから検証する。
 */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が正しくありません')

const optionalNumber = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === '' || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  })
  .pipe(z.number().nonnegative().nullable())

const addSetSchema = z.object({
  date: dateSchema,
  exerciseId: z.uuid(),
  weightKg: optionalNumber,
  reps: optionalNumber,
  sets: optionalNumber,
  durationMin: optionalNumber,
  holdSec: optionalNumber,
  speed: optionalNumber,
  inclineDeg: optionalNumber,
  distanceM: optionalNumber,
  note: z.string().max(200).nullish(),
})

export type ActionState = { ok: boolean; message?: string }

function field(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value : null
}

/** その日のセッションを取得し、無ければ作る。 */
async function ensureSession(userId: string, date: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('workout_sessions')
    .select('id, kind')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    // 休養日として記録した日に種目を足したら、トレーニング日に戻す
    if (existing.kind === 'rest') {
      await supabase
        .from('workout_sessions')
        .update({ kind: 'training', rest_reason: null })
        .eq('id', existing.id)
    }
    return existing.id as string
  }

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ user_id: userId, date, kind: 'training' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

export async function addSet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }

  const parsed = addSetSchema.safeParse({
    date: field(formData, 'date'),
    exerciseId: field(formData, 'exerciseId'),
    weightKg: field(formData, 'weightKg'),
    reps: field(formData, 'reps'),
    sets: field(formData, 'sets'),
    durationMin: field(formData, 'durationMin'),
    holdSec: field(formData, 'holdSec'),
    speed: field(formData, 'speed'),
    inclineDeg: field(formData, 'inclineDeg'),
    distanceM: field(formData, 'distanceM'),
    note: field(formData, 'note'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力を確認してください' }
  }

  const input = parsed.data

  try {
    const supabase = await createClient()
    const sessionId = await ensureSession(user.id, input.date)

    // 同じ日の中での並び順。追加した順に下へ積む。
    const { count } = await supabase
      .from('workout_sets')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    const { error } = await supabase.from('workout_sets').insert({
      session_id: sessionId,
      exercise_id: input.exerciseId,
      order_index: count ?? 0,
      weight_kg: input.weightKg,
      reps: input.reps,
      sets: input.sets,
      duration_min: input.durationMin,
      hold_sec: input.holdSec,
      speed: input.speed,
      incline_deg: input.inclineDeg,
      distance_m: input.distanceM,
      note: input.note || null,
    })

    if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '保存に失敗しました' }
  }

  revalidatePath('/workout')
  return { ok: true, message: '記録しました' }
}

export async function deleteSet(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const setId = field(formData, 'setId')
  if (!setId) return

  const supabase = await createClient()
  // RLS が親セッションの所有者を見るので、他人の行は消せない
  await supabase.from('workout_sets').delete().eq('id', setId)

  revalidatePath('/workout')
}

const restSchema = z.object({ date: dateSchema, reason: z.string().max(100).nullish() })

/** 休養日を1タップで記録する。 */
export async function markRestDay(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const parsed = restSchema.safeParse({ date: field(formData, 'date'), reason: field(formData, 'reason') })
  if (!parsed.success) return

  const supabase = await createClient()
  await supabase.from('workout_sessions').upsert(
    {
      user_id: user.id,
      date: parsed.data.date,
      kind: 'rest',
      rest_reason: parsed.data.reason || 'オフ',
    },
    { onConflict: 'user_id,date' },
  )

  revalidatePath('/workout')
}

/** 休養日の取り消し。セットが 1 件も無ければセッションごと消す。 */
export async function clearRestDay(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const date = field(formData, 'date')
  if (!date) return

  const supabase = await createClient()
  const { data: session } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  if (!session) return

  const { count } = await supabase
    .from('workout_sets')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session.id)

  if (count && count > 0) {
    await supabase
      .from('workout_sessions')
      .update({ kind: 'training', rest_reason: null })
      .eq('id', session.id)
  } else {
    await supabase.from('workout_sessions').delete().eq('id', session.id)
  }

  revalidatePath('/workout')
}

const bodyweightSchema = z.object({
  date: dateSchema,
  bodyweightKg: z.coerce.number().positive().max(500),
})

/** その日の体重。自重種目の負荷換算に効くので、日単位で上書きできるようにしている。 */
export async function setSessionBodyweight(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const parsed = bodyweightSchema.safeParse({
    date: field(formData, 'date'),
    bodyweightKg: field(formData, 'bodyweightKg'),
  })
  if (!parsed.success) return

  const supabase = await createClient()
  await supabase.from('workout_sessions').upsert(
    {
      user_id: user.id,
      date: parsed.data.date,
      bodyweight_kg: parsed.data.bodyweightKg,
    },
    { onConflict: 'user_id,date' },
  )

  revalidatePath('/workout')
}
