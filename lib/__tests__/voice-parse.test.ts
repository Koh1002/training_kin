import { describe, expect, it } from 'vitest'
import { parseVoiceInput } from '@/lib/workout/voice-parse'

describe('parseVoiceInput', () => {
  it('単位付きの 1 種目を読む', () => {
    expect(parseVoiceInput('ベンチプレス10キロ10回3セット')).toEqual([
      { rawName: 'ベンチプレス', weightKg: 10, reps: 10, sets: 3 },
    ])
  })

  it('1 文の中の複数種目を分ける', () => {
    const r = parseVoiceInput('スクワット20キロ10回3セット、デッドリフト20キロ10回3セット')
    expect(r).toHaveLength(2)
    expect(r[0]).toEqual({ rawName: 'スクワット', weightKg: 20, reps: 10, sets: 3 })
    expect(r[1]).toEqual({ rawName: 'デッドリフト', weightKg: 20, reps: 10, sets: 3 })
  })

  it('話し言葉のつなぎでも分ける', () => {
    // 音声認識は読点を入れてくれないことがある
    const r = parseVoiceInput('ベンチプレス10キロ10回3セット それから スクワット20キロ10回3セット')
    expect(r).toHaveLength(2)
    expect(r[1].rawName).toBe('スクワット')
  })

  it('全角の数字を読む', () => {
    // 音声認識は全角で返すことがある
    expect(parseVoiceInput('ベンチプレス１０キロ１０回３セット')[0]).toEqual({
      rawName: 'ベンチプレス',
      weightKg: 10,
      reps: 10,
      sets: 3,
    })
  })

  it('単位の言い換えを吸収する', () => {
    expect(parseVoiceInput('ベンチプレス10キログラム10レップ3set')[0]).toMatchObject({
      weightKg: 10,
      reps: 10,
      sets: 3,
    })
    expect(parseVoiceInput('ベンチプレス10kg10かい3せっと')[0]).toMatchObject({
      weightKg: 10,
      reps: 10,
      sets: 3,
    })
  })

  it('「キログラム」が「キロ」に食われない', () => {
    // 長い単位から先に試さないと、10 を取り残して「グラム」が名前に混ざる
    expect(parseVoiceInput('スクワット20キログラム10回3セット')[0].rawName).toBe('スクワット')
  })

  it('小数の重量を読む', () => {
    expect(parseVoiceInput('チューブ肩3.75キロ10回3セット')[0].weightKg).toBe(3.75)
  })

  it('単位を言わなかったら順に重量・回数・セットとみなす', () => {
    expect(parseVoiceInput('ベンチプレス 10 10 3')[0]).toEqual({
      rawName: 'ベンチプレス',
      weightKg: 10,
      reps: 10,
      sets: 3,
    })
  })

  it('足りない値は埋めずに null で残す', () => {
    // 推測で数字を作ると、確認画面で「合っている」ように見えてしまう
    expect(parseVoiceInput('ベンチプレス10キロ10回')[0]).toEqual({
      rawName: 'ベンチプレス',
      weightKg: 10,
      reps: 10,
      sets: null,
    })
    expect(parseVoiceInput('スクワット')[0]).toEqual({
      rawName: 'スクワット',
      weightKg: null,
      reps: null,
      sets: null,
    })
  })

  it('順番が入れ替わっても単位で判断する', () => {
    expect(parseVoiceInput('ベンチプレス3セット10回10キロ')[0]).toEqual({
      rawName: 'ベンチプレス',
      weightKg: 10,
      reps: 10,
      sets: 3,
    })
  })

  it('空の入力や数字だけの塊は捨てる', () => {
    expect(parseVoiceInput('')).toEqual([])
    expect(parseVoiceInput('、、')).toEqual([])
    expect(parseVoiceInput('10キロ10回3セット')).toEqual([])
  })
})
