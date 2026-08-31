import { describe, expect, it } from 'vitest'
import { DEFAULT_DESTINATION, safeDestination } from '@/lib/safe-redirect'

describe('safeDestination', () => {
  it('自サイト内のパスはそのまま通す', () => {
    expect(safeDestination('/workout')).toBe('/workout')
    expect(safeDestination('/english/history')).toBe('/english/history')
    expect(safeDestination('/workout?date=2026-09-01')).toBe('/workout?date=2026-09-01')
  })

  it('未指定なら既定の行き先にする', () => {
    expect(safeDestination(null)).toBe(DEFAULT_DESTINATION)
    expect(safeDestination(undefined)).toBe(DEFAULT_DESTINATION)
    expect(safeDestination('')).toBe(DEFAULT_DESTINATION)
  })

  it('絶対 URL を弾く（オープンリダイレクト対策）', () => {
    expect(safeDestination('https://evil.com')).toBe(DEFAULT_DESTINATION)
    expect(safeDestination('http://evil.com/x')).toBe(DEFAULT_DESTINATION)
    expect(safeDestination('javascript:alert(1)')).toBe(DEFAULT_DESTINATION)
  })

  it('スキーム相対 URL を弾く', () => {
    // 「/」で始まるが外部ホストに飛ぶ
    expect(safeDestination('//evil.com')).toBe(DEFAULT_DESTINATION)
    expect(safeDestination('//evil.com/path')).toBe(DEFAULT_DESTINATION)
  })

  it('バックスラッシュを含むものを弾く', () => {
    // 一部のブラウザが /\evil.com を //evil.com として扱う
    expect(safeDestination('/\\evil.com')).toBe(DEFAULT_DESTINATION)
    expect(safeDestination('/path\\..\\x')).toBe(DEFAULT_DESTINATION)
  })
})
