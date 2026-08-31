'use client'

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { SKILL_LABELS, type SkillProgress } from '@/lib/english/balance'

/**
 * 4技能の週次達成率レーダー。
 * 外周が週目標の 100%。超過しても図が破綻しないよう 120% で頭打ちにする。
 */
export function SkillRadar({ progress }: { progress: SkillProgress[] }) {
  const data = progress.map((p) => ({
    skill: SKILL_LABELS[p.skill],
    percent: Math.min(120, Math.round(p.ratio * 100)),
  }))

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="68%">
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
          />
          <PolarRadiusAxis domain={[0, 120]} tick={false} axisLine={false} />
          <Radar
            dataKey="percent"
            stroke="var(--color-english)"
            fill="var(--color-english)"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
