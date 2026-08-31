'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDateLabel } from '@/lib/date'
import { formatVolume } from '@/lib/workout/volume'

export type VolumePoint = { date: string; volumeKg: number; isRest: boolean }

/** 日次の総負荷の推移。休養日は 0 の空バーとして残し、休みも履歴として見えるようにする。 */
export function VolumeChart({ data }: { data: VolumePoint[] }) {
  const points = data.map((d) => ({ ...d, label: formatDateLabel(d.date) }))

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            stroke="var(--color-border)"
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            stroke="var(--color-border)"
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}t` : String(v))}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-muted)' }}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value) => [formatVolume(Number(value ?? 0)), '総負荷']}
          />
          <Bar dataKey="volumeKg" fill="var(--color-data-ink)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
