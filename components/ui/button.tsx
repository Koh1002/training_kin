import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  // 主要な操作。前景色で塗る（テーマに応じて黒/白）
  primary: 'bg-foreground text-background hover:opacity-90',
  // 枠線だけの控えめな操作
  secondary: 'border border-border bg-surface hover:border-border-strong',
  ghost: 'hover:bg-surface-muted',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-[15px]',
}

type Props = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
  full?: boolean
}

/** アプリ内のボタン。見た目の差し替えをここ 1 箇所に閉じ込める。 */
export function Button({
  variant = 'secondary',
  size = 'md',
  full = false,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-app font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
        VARIANTS[variant]
      } ${SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
}

/** アイコンだけの正方形ボタン。必ず aria-label を付けること。 */
export function IconButton({
  className = '',
  size = 'md',
  ...rest
}: Omit<Props, 'full' | 'size'> & { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-7' : 'size-9'
  return (
    <Button
      className={`${box} shrink-0 !px-0 text-muted hover:text-foreground ${className}`}
      {...rest}
    />
  )
}
