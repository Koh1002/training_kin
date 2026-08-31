'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SKILL_CODES, SKILL_LABELS } from '@/lib/english/balance'
import { formatDateLabel } from '@/lib/date'

export type WeeklyPoint = {
  weekStart: string
  reading: number
  listening: number
  speaking: number
  writing: number
}

// 4技能を色相で分ける。積み上げても隣接する色が判別できる並びにしている。
const SKILL_COLORS = {
  reading: '#4f5bd5',
  listening: '#2f9e8f',
  speaking: '#e0862c',
  writing: '#a4519b',
} as const

/** 週ごとの学習時間を技能別に積み上げる。偏りが縦の色の比率で分かる。 */
export function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const points = data.map((d) => ({ ...d, label: `${formatDateLabel(d.weekStart)}〜` }))

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            stroke="var(--color-border)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            stroke="var(--color-border)"
            unit="分"
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-muted)' }}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value, name) => [`${Number(value ?? 0)}分`, SKILL_LABELS[name as never] ?? name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => SKILL_LABELS[value as never] ?? value}
          />
          {SKILL_CODES.map((code) => (
            <Bar key={code} dataKey={code} stackId="a" fill={SKILL_COLORS[code]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
