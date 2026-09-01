import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { matchExercise, normalizeName, similarity } from '@/lib/workout/match-exercise'

/**
 * マスタの実物を seed の SQL から読む。テスト用に手で写すと、
 * マスタを増やしたときに片方だけ古くなる。
 */
function loadMaster(): { id: string; name_ja: string; memo_alias: string | null }[] {
  const sql = readFileSync('supabase/migrations/0002_seed_masters.sql', 'utf8')
  const rows: { id: string; name_ja: string; memo_alias: string | null }[] = []
  // ('ベンチプレス（胸）', 'ベンチ胸', 'chest', ...) の先頭 2 つだけ拾う
  for (const m of sql.matchAll(/^\s*\('([^']+)',\s*'([^']*)',\s*'(?:chest|back|shoulder|arm|leg|core|cardio)'/gm)) {
    rows.push({ id: m[1], name_ja: m[1], memo_alias: m[2] || null })
  }
  return rows
}

const MASTER = loadMaster()

describe('マスタの読み込み', () => {
  it('種目が一通り読めている', () => {
    // 40 件。減っていたら正規表現がマスタの書式に追従できていない
    expect(MASTER.length).toBeGreaterThanOrEqual(40)
    expect(MASTER.map((e) => e.name_ja)).toContain('フロントレイズ（ダンベル）')
  })
})

describe('normalizeName', () => {
  it('カタカナとひらがなを同じに寄せる', () => {
    expect(normalizeName('ベンチプレス')).toBe(normalizeName('べんちぷれす'))
  })

  it('括弧・中黒・長音・空白を落とす', () => {
    expect(normalizeName('サイドレイズ（ダンベル）')).toBe(normalizeName('さいどれいず だんべる'))
  })
})

describe('similarity', () => {
  it('同じ語は 1', () => {
    expect(similarity('あいう', 'あいう')).toBe(1)
  })

  it('無関係な語は低い', () => {
    expect(similarity('ばーぴー', 'すくわっと')).toBeLessThan(0.2)
  })

  it('空文字は 0', () => {
    expect(similarity('', 'あいう')).toBe(0)
  })
})

describe('matchExercise', () => {
  const top = (q: string) => matchExercise(q, MASTER)[0]?.nameJa

  it('言われたとおりの名前が 1 位になる', () => {
    expect(top('ベンチプレス')).toBe('ベンチプレス（胸）')
    expect(top('スクワット')).toBe('スクワット')
    expect(top('デッドリフト')).toBe('デッドリフト')
  })

  it('自分の呼び方（memo_alias）から寄る', () => {
    // 今回これが無くて種目を足すことになった
    expect(top('肩前ダンベル')).toBe('フロントレイズ（ダンベル）')
    expect(top('ベンチ胸')).toBe('ベンチプレス（胸）')
    expect(top('ラッドプル')).toBe('ラットプルダウン')
  })

  it('ひらがなで言っても寄る', () => {
    expect(top('べんちぷれす')).toBe('ベンチプレス（胸）')
    expect(top('でっどりふと')).toBe('デッドリフト')
  })

  it('括弧の中まで言わなくても寄る', () => {
    expect(top('サイドレイズ')).toContain('サイドレイズ')
  })

  it('無関係な語では当てない', () => {
    // 一番近いものを無理に返すと、確認画面で正しく見えて誤って保存される
    expect(matchExercise('バーピー', MASTER)).toEqual([])
    expect(matchExercise('ラーメン', MASTER)).toEqual([])
    expect(matchExercise('', MASTER)).toEqual([])
  })

  it('候補は指定した数まで、似ている順', () => {
    const r = matchExercise('レイズ', MASTER, 3)
    expect(r.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score)
    }
  })

  it('マスタの全種目が、自分の名前で自分に寄る', () => {
    // 1 件でも自分以外が 1 位になるなら、閾値か加点の設計が間違っている
    const wrong = MASTER.filter((e) => top(e.name_ja) !== e.name_ja)
    expect(wrong.map((e) => `${e.name_ja} → ${top(e.name_ja)}`)).toEqual([])
  })

  it('マスタの全種目が、自分の memo_alias で候補に入る', () => {
    // 1 位であることまでは求めない。マスタには実際に衝突がある——
    // 「レッグカール」は『レッグカール』の名前であり、同時に
    // 『レッグカール（左右別）』の別名でもある。この場合に名前の方が
    // 1 位になるのは正しいので、**両方が候補に出ること**を確かめる。
    const withAlias = MASTER.filter((e) => e.memo_alias)
    const missing = withAlias.filter(
      (e) => !matchExercise(e.memo_alias!, MASTER, 5).some((c) => c.nameJa === e.name_ja),
    )
    expect(missing.map((e) => e.memo_alias)).toEqual([])
  })

  it('名前と別名が衝突する種目は、両方が候補に出る', () => {
    const names = matchExercise('レッグカール', MASTER, 5).map((c) => c.nameJa)
    expect(names).toContain('レッグカール')
    expect(names).toContain('レッグカール（左右別）')
  })
})
