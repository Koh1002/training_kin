'use client'

import { useRouter } from 'next/navigation'
import { formatDateLong, shiftDate, todayJst } from '@/lib/date'

/** 日付を前後に動かすナビ。過去の記録の修正と、当日への復帰をすばやく行えるようにする。 */
export function DateNav({ date, basePath }: { date: string; basePath: string }) {
  const router = useRouter()
  const today = todayJst()

  const go = (next: string) => router.push(`${basePath}?date=${next}`)

  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => go(shiftDate(date, -1))}
        aria-label="前の日"
        className="rounded-lg border border-border px-3 py-1.5 text-sm"
      >
        ‹
      </button>

      <div className="text-center">
        <p className="font-semibold">{formatDateLong(date)}</p>
        {date !== today ? (
          <button type="button" onClick={() => go(today)} className="text-xs text-muted underline">
            今日に戻る
          </button>
        ) : (
          <p className="text-xs text-muted">今日</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => go(shiftDate(date, 1))}
        aria-label="次の日"
        disabled={date >= today}
        className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-30"
      >
        ›
      </button>
    </div>
  )
}
