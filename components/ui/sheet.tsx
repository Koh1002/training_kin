'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '@/components/ui/button'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

/**
 * 下から出るシート。
 *
 * 記録は片手で、画面の下半分だけで終わらせたい操作なので、中央のダイアログでは
 * なく下から出す。親指の届く範囲に閉じるボタンと入力欄が来る。
 */
export function Sheet({ open, onClose, title, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      // フォーカスをシートの中に閉じ込める。開いている間に背面のボタンへ
      // タブで移れてしまうと、見えていないものを操作できてしまう。
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // 背面がスクロールすると、シートを閉じたときに見ていた位置を見失う
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      {/* 背景。タップで閉じる */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-[1.25rem] border border-border bg-surface"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <IconButton type="button" variant="ghost" onClick={onClose} aria-label="閉じる">
            <X size={18} aria-hidden />
          </IconButton>
        </div>

        {/* 中身が長いときはここだけスクロールする */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}
