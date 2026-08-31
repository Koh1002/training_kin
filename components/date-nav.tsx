'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '@/components/ui/button'
import { formatDateLong, shiftDate, todayJst } from '@/lib/date'

/** 日付を前後に動かすナビ。過去の記録の修正と、当日への復帰をすばやく行えるようにする。 */
export function DateNav({ date, basePath }: { date: string; basePath: string }) {
  const router = useRouter()
  const today = todayJst()
  const go = (next: string) => router.push(`${basePath}?date=${next}`)

  return (
    // 日付は見出しなので、前後の矢印は枠を持たせず控えめにする。
    // 枠付きのボタンを両端に置くと、日付より矢印の方が目立っていた。
    <div className="mb-4 flex items-center justify-between gap-2">
      <IconButton
        type="button"
        variant="ghost"
        onClick={() => go(shiftDate(date, -1))}
        aria-label="前の日"
      >
        <ChevronLeft size={18} aria-hidden />
      </IconButton>

      <div className="text-center">
        <p className="text-[15px] font-semibold">{formatDateLong(date)}</p>
        {date === today ? (
          <p className="text-xs text-muted">今日</p>
        ) : (
          <button type="button" onClick={() => go(today)} className="text-xs text-muted underline">
            今日に戻る
          </button>
        )}
      </div>

      <IconButton
        type="button"
        variant="ghost"
        onClick={() => go(shiftDate(date, 1))}
        aria-label="次の日"
        disabled={date >= today}
      >
        <ChevronRight size={18} aria-hidden />
      </IconButton>
    </div>
  )
}
