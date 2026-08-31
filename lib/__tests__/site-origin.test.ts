import { describe, expect, it } from 'vitest'
import { resolveOrigin } from '@/lib/site-origin'

describe('resolveOrigin', () => {
  it('SITE_URL 未設定ならリクエストのホストを使う', () => {
    expect(resolveOrigin(undefined, 'example.vercel.app')).toBe('https://example.vercel.app')
  })

  it('ローカル開発では http を使う（https だと開けない URL になる）', () => {
    expect(resolveOrigin(undefined, 'localhost:3000')).toBe('http://localhost:3000')
    expect(resolveOrigin(undefined, '127.0.0.1:3000')).toBe('http://127.0.0.1:3000')
  })

  it('SITE_URL が設定されていればそれを使う', () => {
    expect(resolveOrigin('https://example.vercel.app', 'other.vercel.app')).toBe(
      'https://example.vercel.app',
    )
  })

  it('末尾のスラッシュがあっても origin に揃える', () => {
    expect(resolveOrigin('https://example.vercel.app/', 'x')).toBe('https://example.vercel.app')
  })

  it('本番のリクエストに対して localhost の SITE_URL は無視する', () => {
    // 実際に起きた事故: Vercel の SITE_URL に localhost が残っていて、
    // 本番から送ったログインリンクが localhost を指してしまった
    expect(resolveOrigin('http://localhost:3000', 'example.vercel.app')).toBe(
      'https://example.vercel.app',
    )
    expect(resolveOrigin('http://127.0.0.1:54321', 'example.vercel.app')).toBe(
      'https://example.vercel.app',
    )
  })

  it('ローカル開発なら localhost の SITE_URL はそのまま使う', () => {
    expect(resolveOrigin('http://localhost:3000', 'localhost:3000')).toBe('http://localhost:3000')
  })

  it('壊れた SITE_URL でも例外を投げずフォールバックする', () => {
    // スキーム無しは new URL() が投げる。ここで落ちるとログイン自体が 500 になる
    expect(resolveOrigin('example.vercel.app', 'real.vercel.app')).toBe('https://real.vercel.app')
    expect(resolveOrigin('', 'real.vercel.app')).toBe('https://real.vercel.app')
  })

  it('ホストヘッダが無くても落ちない', () => {
    expect(resolveOrigin(undefined, null)).toBe('')
    expect(resolveOrigin('https://example.vercel.app', null)).toBe('https://example.vercel.app')
  })
})
