'use client'

import { useId } from 'react'
import { muscleName, type MuscleCode } from '@/lib/muscles'
import { intensityColor, type MapMode } from '@/lib/workout/color-scale'
import {
  BACK_PARTS,
  BACK_SILHOUETTE,
  BODY_VIEWBOX,
  FRONT_PARTS,
  FRONT_SILHOUETTE,
  MIRROR_TRANSFORM,
  type BodyPart,
  type Silhouette,
} from './body-paths'

type Props = {
  side: 'front' | 'back'
  mode: MapMode
  /** 筋群コード → 0〜1 の強度 */
  values: Partial<Record<MuscleCode, number>>
  selected?: MuscleCode | null
  onSelect?: (code: MuscleCode) => void
}

const HEAD = { cx: 100, cy: 26, rx: 17, ry: 21 }

/**
 * 人体図 1 面ぶん。
 *
 * 左半身のパスを 2 回（そのままと左右反転）描いて全身にする。同じ筋群のパスが
 * 2 つ出るので、どちらをタップしても同じ部位が選ばれる。
 *
 * 筋群レイヤーは輪郭でクリップしている。こうすると肩や脇のように輪郭が
 * 曲がる場所で筋肉がはみ出さず、パスの端を 1px 単位で合わせずに済む。
 */
export function BodyFigure({ side, mode, values, selected, onSelect }: Props) {
  const clipId = useId()
  const silhouette: Silhouette[] = side === 'front' ? FRONT_SILHOUETTE : BACK_SILHOUETTE
  const parts: BodyPart[] = side === 'front' ? FRONT_PARTS : BACK_PARTS

  const bothHalves = (render: (mirrored: boolean) => React.ReactNode) => (
    <>
      {render(false)}
      {render(true)}
    </>
  )

  return (
    <figure className="flex flex-col items-center gap-1">
      <svg
        viewBox={BODY_VIEWBOX}
        role="img"
        aria-label={`${side === 'front' ? '身体の前面' : '身体の背面'}の${
          mode === 'stimulus' ? '刺激' : '筋肉痛'
        }マップ`}
        className="h-auto w-full max-w-[190px]"
      >
        <defs>
          {/*
            clipPath の子に <g> は使えない（SVG の仕様上ここでは無視される）ので、
            transform は個々の <path> に直接かける。
          */}
          <clipPath id={clipId}>
            {bothHalves((mirrored) =>
              silhouette.map((s, i) => (
                <path
                  key={`${mirrored ? 'r' : 'l'}${i}`}
                  d={s.d}
                  transform={mirrored ? MIRROR_TRANSFORM : undefined}
                />
              )),
            )}
          </clipPath>
        </defs>

        {/* 土台となる身体のシルエット。頭部は左右対称なので 1 つだけ描く。 */}
        <ellipse
          {...HEAD}
          fill="var(--color-surface-muted)"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        {bothHalves((mirrored) => (
          <g key={mirrored ? 'r' : 'l'} transform={mirrored ? MIRROR_TRANSFORM : undefined}>
            {silhouette.map((s, i) => (
              <path
                key={i}
                d={s.d}
                fill="var(--color-surface-muted)"
                stroke="var(--color-border)"
                strokeWidth={1}
              />
            ))}
          </g>
        ))}

        {/* 筋群のレイヤー */}
        <g clipPath={`url(#${clipId})`}>
          {bothHalves((mirrored) => (
            <g key={mirrored ? 'r' : 'l'} transform={mirrored ? MIRROR_TRANSFORM : undefined}>
              {parts.map((part) => {
                const value = values[part.muscle] ?? 0
                const isSelected = selected === part.muscle
                return (
                  <path
                    key={part.muscle}
                    d={part.d}
                    data-muscle={part.muscle}
                    fill={intensityColor(mode, value)}
                    stroke={isSelected ? 'var(--color-foreground)' : 'var(--color-border)'}
                    strokeWidth={isSelected ? 3 : 0.8}
                    className={onSelect ? 'cursor-pointer' : undefined}
                    onClick={onSelect ? () => onSelect(part.muscle) : undefined}
                  >
                    <title>{`${muscleName(part.muscle)}: ${Math.round(value * 100)}%`}</title>
                  </path>
                )
              })}
            </g>
          ))}
        </g>
      </svg>
      <figcaption className="text-xs text-muted">{side === 'front' ? '前面' : '背面'}</figcaption>
    </figure>
  )
}
