'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'

type Props = {
  title: string
  /** 表示している日付を受け取って中身を作る。シートを開くまで組み立てない */
  children: (args: { date: string; close: () => void; refresh: () => void }) => React.ReactNode
  /** date の指定が無いときの既定（＝今日） */
  defaultDate: string
}

/**
 * 右下に常駐する記録ボタン。
 *
 * 記録欄はページのいちばん下にあり、人体図が縦に長いぶんスクロールしないと
 * 届かなかった。「どこから記録すればいいのか分からない」の直接の原因なので、
 * どの画面からでも同じ場所から始められるようにする。
 *
 * 追加してもシートは閉じない。ジムでは続けて数種目入れるため。
 */
export function RecordFab({ title, children, defaultDate }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const params = useSearchParams()

  // 履歴画面などで過去の日を見ているなら、その日に記録する
  const raw = params.get('date') ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : defaultDate

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={title}
        className="fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform active:scale-95"
        // ホームインジケータに被らせない
        style={{ bottom: 'calc(1rem + var(--safe-bottom))' }}
      >
        <Pencil size={22} aria-hidden />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {open
          ? children({
              date,
              close: () => setOpen(false),
              // Server Component 側の一覧を取り直す。記録した内容がすぐ下に出る
              refresh: () => router.refresh(),
            })
          : null}
      </Sheet>
    </>
  )
}
