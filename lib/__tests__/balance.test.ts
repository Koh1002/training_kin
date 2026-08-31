import { describe, expect, it } from 'vitest'
import {
  balanceScore,
  currentStreak,
  emptySkillMinutes,
  formatMinutes,
  nextSkill,
  suggestActivities,
  weeklyProgress,
} from '@/lib/english/balance'
import type { EnglishActivity, SkillCode } from '@/types/database'

function minutes(r: number, l: number, s: number, w: number) {
  return { reading: r, listening: l, speaking: s, writing: w }
}

describe('balanceScore', () => {
  it('4技能が完全に均等なら 100', () => {
    expect(balanceScore(minutes(30, 30, 30, 30))).toBe(100)
    expect(balanceScore(minutes(5, 5, 5, 5))).toBe(100)
  })

  it('1技能に全振りなら 0', () => {
    expect(balanceScore(minutes(120, 0, 0, 0))).toBe(0)
  })

  it('記録がゼロでも 0 除算せずに 0 を返す', () => {
    expect(balanceScore(emptySkillMinutes())).toBe(0)
  })

  it('偏るほどスコアが下がる', () => {
    const even = balanceScore(minutes(30, 30, 30, 30))
    const slight = balanceScore(minutes(45, 30, 30, 15))
    const heavy = balanceScore(minutes(90, 20, 10, 0))
    expect(even).toBeGreaterThan(slight)
    expect(slight).toBeGreaterThan(heavy)
  })

  it('必ず 0〜100 の範囲に収まる', () => {
    const cases = [minutes(1, 0, 0, 0), minutes(0, 0, 0, 999), minutes(7, 3, 11, 2)]
    for (const c of cases) {
      const score = balanceScore(c)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })
})

describe('weeklyProgress', () => {
  it('週目標に対する達成率を出す', () => {
    const progress = weeklyProgress(minutes(30, 60, 0, 120), {
      reading: 60,
      listening: 60,
      speaking: 60,
      writing: 60,
    })
    expect(progress.find((p) => p.skill === 'reading')!.ratio).toBe(0.5)
    expect(progress.find((p) => p.skill === 'listening')!.ratio).toBe(1)
    expect(progress.find((p) => p.skill === 'speaking')!.ratio).toBe(0)
    expect(progress.find((p) => p.skill === 'writing')!.ratio).toBe(2) // 超過は 1 を超える
  })

  it('目標が未設定なら 60分/週を既定にする', () => {
    const progress = weeklyProgress(minutes(30, 0, 0, 0), {})
    expect(progress.find((p) => p.skill === 'reading')!.targetMin).toBe(60)
  })

  it('目標 0 分でも 0 除算しない', () => {
    const progress = weeklyProgress(minutes(30, 0, 0, 0), { reading: 0, listening: 0, speaking: 0, writing: 0 })
    expect(progress.find((p) => p.skill === 'reading')!.ratio).toBe(1)
    expect(progress.find((p) => p.skill === 'listening')!.ratio).toBe(0)
  })
})

describe('nextSkill', () => {
  const goals = { reading: 60, listening: 60, speaking: 60, writing: 60 }

  it('達成率が最も低い技能を選ぶ', () => {
    const progress = weeklyProgress(minutes(60, 45, 10, 30), goals)
    expect(nextSkill(progress)).toBe('speaking')
  })

  it('同率なら最後にやった日が古い方を優先する', () => {
    const progress = weeklyProgress(minutes(60, 60, 0, 0), goals)
    const picked = nextSkill(progress, { speaking: '2026-08-30', writing: '2026-08-20' })
    expect(picked).toBe('writing')
  })

  it('一度もやっていない技能は実施済みより優先する', () => {
    const progress = weeklyProgress(minutes(60, 60, 0, 0), goals)
    expect(nextSkill(progress, { speaking: '2026-08-30' })).toBe('writing')
  })

  it('全く記録が無ければ Reading から始める', () => {
    expect(nextSkill(weeklyProgress(emptySkillMinutes(), goals))).toBe('reading')
  })
})

describe('suggestActivities', () => {
  function activity(skill: SkillCode, name: string): EnglishActivity {
    return {
      id: `${skill}-${name}`,
      user_id: null,
      skill_code: skill,
      name_ja: name,
      description: null,
      is_active: true,
      sort_order: 0,
      created_at: '2026-08-31T00:00:00Z',
    }
  }

  const pool: EnglishActivity[] = [
    ...['シャドーイング', 'ポッドキャスト', 'ディクテーション', '映画', '教材', '講演'].map((n) =>
      activity('listening', n),
    ),
    activity('reading', '単語'),
  ]

  it('指定した技能の項目だけを返す', () => {
    const picked = suggestActivities('listening', pool, 3, '2026-08-31')
    expect(picked).toHaveLength(3)
    expect(picked.every((a) => a.skill_code === 'listening')).toBe(true)
  })

  it('同じ日なら何度呼んでも同じ提案になる', () => {
    const a = suggestActivities('listening', pool, 3, '2026-08-31')
    const b = suggestActivities('listening', pool, 3, '2026-08-31')
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id))
  })

  it('休止中の項目は提案しない', () => {
    const withInactive = [...pool, { ...activity('speaking', '停止中'), is_active: false }]
    expect(suggestActivities('speaking', withInactive, 3, '2026-08-31')).toHaveLength(0)
  })

  it('候補が要求数以下ならそのまま返す', () => {
    expect(suggestActivities('reading', pool, 3, '2026-08-31')).toHaveLength(1)
  })
})

describe('currentStreak', () => {
  it('今日から遡って連続した日数を数える', () => {
    expect(currentStreak(['2026-08-31', '2026-08-30', '2026-08-29'], '2026-08-31')).toBe(3)
  })

  it('今日まだ記録が無くても、昨日までの連続はストリークとして残す', () => {
    expect(currentStreak(['2026-08-30', '2026-08-29'], '2026-08-31')).toBe(2)
  })

  it('2日以上空いていればストリークは切れる', () => {
    expect(currentStreak(['2026-08-28', '2026-08-27'], '2026-08-31')).toBe(0)
  })

  it('記録が無ければ 0', () => {
    expect(currentStreak([], '2026-08-31')).toBe(0)
  })

  it('月をまたいでも連続として数える', () => {
    expect(currentStreak(['2026-09-01', '2026-08-31', '2026-08-30'], '2026-09-01')).toBe(3)
  })
})

describe('formatMinutes', () => {
  it('60分以上は時間表記にする', () => {
    expect(formatMinutes(45)).toBe('45分')
    expect(formatMinutes(60)).toBe('1時間')
    expect(formatMinutes(95)).toBe('1時間35分')
  })
})
