import { formatVolume } from '@/lib/workout/volume'

type Props = {
  volumeKg: number
  /** 0〜100。比較対象が無ければ null */
  score: number | null
  setCount: number
  cardioMinutes: number
}

/**
 * その日の頑張りを表す円弧ゲージ。
 * 直近の自己ベストを 100 とした相対値なので、
 * 続けるほど基準が上がっていく（= 昨日の自分と比べられる）。
 */
export function EffortGauge({ volumeKg, score, setCount, cardioMinutes }: Props) {
  const radius = 52
  const circumference = Math.PI * radius // 半円ぶんの弧長
  const ratio = (score ?? 0) / 100

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg viewBox="0 0 130 74" className="w-[130px]" role="img" aria-label={`今日の頑張り ${score ?? 0}%`}>
          <path
            d={`M 13 65 A ${radius} ${radius} 0 0 1 117 65`}
            fill="none"
            stroke="var(--color-surface-muted)"
            strokeWidth={12}
            strokeLinecap="round"
          />
          <path
            d={`M 13 65 A ${radius} ${radius} 0 0 1 117 65`}
            fill="none"
            stroke="var(--color-workout)"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="tabular text-2xl font-bold">{score ?? '—'}</span>
          <span className="text-xs text-muted">{score === null ? '' : '%'}</span>
        </div>
      </div>

      <div className="min-w-0 space-y-0.5">
        <p className="tabular text-2xl font-bold">{formatVolume(volumeKg)}</p>
        <p className="text-sm text-muted">
          {setCount} 種目
          {cardioMinutes > 0 ? ` ・ 有酸素 ${cardioMinutes}分` : ''}
        </p>
        <p className="text-xs text-muted">
          {score === null
            ? 'まだ比較できる記録がありません'
            : score >= 100
              ? '直近30日で最高の総負荷です'
              : '直近30日の最高記録を100とした相対値'}
        </p>
      </div>
    </div>
  )
}
