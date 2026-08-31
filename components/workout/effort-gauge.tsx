import { formatVolume } from '@/lib/workout/volume'

type Props = {
  volumeKg: number
  /** 0〜100。比較対象が無ければ null */
  score: number | null
  setCount: number
  cardioMinutes: number
}

/**
 * その日の頑張り。
 *
 * 主役は総負荷（kg）で、その下に直近 30 日と比べた相対値を細い帯で添える。
 * 以前は大きな円弧を左に置いていたが、記録が無い日は空の弧だけが残って
 * 壊れているように見えたうえ、数字より弧の方が目立っていた。
 * 比較できる記録が無い日はそもそも帯を出さない。
 */
export function EffortGauge({ volumeKg, score, setCount, cardioMinutes }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="tabular text-[2rem] leading-none font-semibold">
          {formatVolume(volumeKg)}
        </span>
        <span className="text-sm text-muted">
          {setCount} 種目
          {cardioMinutes > 0 ? ` ・ 有酸素 ${cardioMinutes}分` : ''}
        </span>
      </div>

      {score === null ? (
        <p className="text-xs text-muted">
          数日ぶんたまると、直近30日と比べた位置が出ます
        </p>
      ) : (
        <div className="space-y-1.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-data-track"
            role="img"
            aria-label={`直近30日の最高記録に対して ${score}%`}
          >
            <span
              className="block h-full rounded-full bg-data-ink transition-[width] duration-300"
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            直近30日の最高を 100 として <span className="tabular text-foreground">{score}</span>
            {score >= 100 ? '（最高記録）' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
