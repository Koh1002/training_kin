/**
 * 言われた種目名を、マスタの種目に寄せる。
 *
 * 音声認識は「フロントレイズ」を「フロント冷図」のように返すことがあるし、
 * 人は「肩前ダンベル」のような自分の呼び方で言う。表記の揺れを吸収して
 * 候補を出すが、**確信が持てないときは当てない**。適当に一番近いものを選ぶと、
 * 確認画面で正しく見えてしまい、間違った種目のまま保存される。
 */

export type MatchCandidate = {
  id: string
  nameJa: string
  /** 0〜1。1 に近いほど似ている */
  score: number
}

/** 寄せる相手。マスタの行のうち、照合に使う分だけ。 */
export type MatchableExercise = {
  id: string
  name_ja: string
  memo_alias?: string | null
}

/**
 * これを下回ったら「近い種目なし」とする。
 * 0.34 は「べんち」→「ベンチプレス（胸）」が通り、「バーピー」が通らない位置。
 * 下げすぎると無関係な種目を提案してしまう。
 */
export const MATCH_THRESHOLD = 0.34

/**
 * 照合用の正規化。
 * カタカナをひらがなに寄せるのは、音声認識がどちらでも返すため。
 * 長音・中黒・括弧は表記の揺れでしかないので落とす。
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    // カタカナ → ひらがな
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[ー・（）()\[\]【】\s,、。]/g, '')
}

/** 文字バイグラムの集合。1 文字の語はその 1 文字を返す。 */
function bigrams(text: string): string[] {
  if (text.length <= 1) return text ? [text] : []
  const out: string[] = []
  for (let i = 0; i < text.length - 1; i++) out.push(text.slice(i, i + 2))
  return out
}

/** Dice 係数。外部依存なしで日本語の表記揺れに効く。 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

  const ga = bigrams(a)
  const gb = bigrams(b)
  if (ga.length === 0 || gb.length === 0) return 0

  // 同じバイグラムが複数回出ることがあるので、個数を数えて重なりを取る
  const counts = new Map<string, number>()
  for (const g of ga) counts.set(g, (counts.get(g) ?? 0) + 1)

  let overlap = 0
  for (const g of gb) {
    const n = counts.get(g) ?? 0
    if (n > 0) {
      overlap++
      counts.set(g, n - 1)
    }
  }

  return (2 * overlap) / (ga.length + gb.length)
}

/** 1 つの種目に対する得点。name_ja と memo_alias の良い方を採る。 */
function scoreOne(query: string, exercise: MatchableExercise): number {
  const targets = [exercise.name_ja, exercise.memo_alias ?? '']
    .filter(Boolean)
    .map(normalizeName)

  let best = 0
  for (const target of targets) {
    let s = similarity(query, target)
    // 完全一致と前方一致は、バイグラムの重なりだけでは差が付きにくいので加点する。
    // 「ベンチプレス」が「ベンチプレス（胸）」に確実に勝つようにするため。
    if (target === query) s = 1
    else if (target.startsWith(query) || query.startsWith(target)) s = Math.min(1, s + 0.15)
    best = Math.max(best, s)
  }
  return best
}

/**
 * 似ている順に候補を返す。閾値を下回るものは含めない。
 * 空配列なら「近い種目なし」。
 */
export function matchExercise(
  rawName: string,
  exercises: MatchableExercise[],
  limit = 3,
): MatchCandidate[] {
  const query = normalizeName(rawName)
  if (!query) return []

  return exercises
    .map((e) => ({ id: e.id, nameJa: e.name_ja, score: scoreOne(query, e) }))
    .filter((c) => c.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.nameJa.localeCompare(b.nameJa))
    .slice(0, limit)
}
