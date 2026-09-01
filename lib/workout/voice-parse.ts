/**
 * 発話（または打ち込んだ文）を、記録できる形に割る。
 *
 * 「ベンチプレス10キロ10回3セット、スクワット20キロ10回3セット」のような 1 文を
 * 種目ごとの行にする。**足りない値は埋めない。** 音声認識は必ず聞き間違えるので、
 * 推測で数字を作ると、確認画面で「合っている」ように見えてしまう。
 * 拾えなかったものは null のまま返し、人が入れる。
 */

export type ParsedEntry = {
  /** 言われた種目名。マスタへの寄せは match-exercise.ts が行う */
  rawName: string
  weightKg: number | null
  reps: number | null
  sets: number | null
}

/**
 * 種目の区切り。読点のほか、話し言葉のつなぎも切る。
 *
 * ピリオドとカンマは、**数字に挟まれていないときだけ**区切りとして扱う。
 * そうしないと「3.75キロ」が「3」と「75キロ」に割れる。
 */
const SEPARATORS = /[、。\n]+|(?:(?<!\d)[.,]|[.,](?!\d))+|それから|そのあと|つぎに|次に|あと/g

/**
 * 単位の言い換え。音声認識の揺れを吸収する。
 * 長いものから順に試すこと（「キログラム」が「キロ」に食われないように）。
 */
const WEIGHT_UNITS = ['キログラム', 'きろぐらむ', 'キロ', 'きろ', 'kg', 'kilo']
const REPS_UNITS = ['レップス', 'レップ', 'れっぷ', 'かい', '回', 'reps', 'rep']
const SETS_UNITS = ['セット', 'せっと', 'sets', 'set']

/**
 * 全角の数字や記号を半角へ。音声認識は全角で返すことがある。
 * 区切りより先に通す。全角のピリオド（．）を半角に寄せてからでないと、
 * 小数点かどうかの判定ができない。
 */
function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

/**
 * 「10キロ」のように、数値の直後に単位が付いたものを拾う。
 * 見つけた箇所は文字列から取り除き、残りを種目名の候補にする。
 */
function takeNumberWithUnit(text: string, units: string[]): { value: number | null; rest: string } {
  for (const unit of units) {
    // 数値（小数可）と単位のあいだに空白が入ることがある
    const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, 'i')
    const m = text.match(re)
    if (m) {
      return { value: Number(m[1]), rest: text.replace(m[0], ' ') }
    }
  }
  return { value: null, rest: text }
}

/** 単位の付かない裸の数字。出てきた順に使う。 */
function bareNumbers(text: string): number[] {
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
}

/** 正規化済みの塊を 1 行にする。 */
function parseOne(text: string): ParsedEntry | null {
  if (!text.trim()) return null

  // 単位付きを先に確定させる。順番は重要で、キロ → 回 → セットの順に取らないと
  // 「10回」の 10 を重量として拾ってしまう。
  const w = takeNumberWithUnit(text, WEIGHT_UNITS)
  const r = takeNumberWithUnit(w.rest, REPS_UNITS)
  const s = takeNumberWithUnit(r.rest, SETS_UNITS)

  let { value: weightKg } = w
  let { value: reps } = r
  let { value: sets } = s

  // 残った裸の数字を、まだ埋まっていない項目へ順に割り当てる。
  // 「ベンチプレス 10 10 3」のように単位を言わなかった場合に効く。
  const rest = bareNumbers(s.rest)
  for (const n of rest) {
    if (weightKg === null) weightKg = n
    else if (reps === null) reps = n
    else if (sets === null) sets = n
  }

  // 数字と単位を落とした残りが種目名
  const rawName = s.rest
    .replace(/\d+(?:\.\d+)?/g, ' ')
    .replace(/[×x*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!rawName) return null
  return { rawName, weightKg, reps, sets }
}

/** 1 文を種目ごとの行にする。読み取れなかった塊は捨てる。 */
export function parseVoiceInput(input: string): ParsedEntry[] {
  return normalize(input)
    .split(SEPARATORS)
    .map(parseOne)
    .filter((e): e is ParsedEntry => e !== null)
}
