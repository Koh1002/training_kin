import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import { TZDate } from '@date-fns/tz'

export const TIME_ZONE = 'Asia/Tokyo'

/** 'yyyy-MM-dd' 形式の日付文字列。DB の date 列と 1:1 で対応する。 */
export type DateString = string

/** 日本時間での「今日」。サーバーが UTC でも前日にずれない。 */
export function todayJst(): DateString {
  return format(new TZDate(Date.now(), TIME_ZONE), 'yyyy-MM-dd')
}

/** 日付文字列を（タイムゾーンの影響を受けない）ローカル正午の Date にする。 */
export function toDate(date: DateString): Date {
  return parseISO(`${date}T12:00:00`)
}

export function shiftDate(date: DateString, days: number): DateString {
  return format(addDays(toDate(date), days), 'yyyy-MM-dd')
}

/** a - b を日数で返す（a の方が新しければ正）。 */
export function daysBetween(a: DateString, b: DateString): number {
  return differenceInCalendarDays(toDate(a), toDate(b))
}

/** 月曜はじまりの週の開始日。DB の date_trunc('week', ...) と揃えている。 */
export function weekStart(date: DateString): DateString {
  return format(startOfWeek(toDate(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/** from から to までの日付を昇順で列挙する（両端を含む）。 */
export function dateRange(from: DateString, to: DateString): DateString[] {
  const out: DateString[] = []
  for (let d = from; daysBetween(to, d) >= 0; d = shiftDate(d, 1)) out.push(d)
  return out
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

/** '8/31(日)' のような表示用ラベル。 */
export function formatDateLabel(date: DateString): string {
  const d = toDate(date)
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_JA[d.getDay()]})`
}

export function formatDateLong(date: DateString): string {
  const d = toDate(date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_JA[d.getDay()]})`
}
