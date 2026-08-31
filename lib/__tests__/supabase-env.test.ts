import { afterEach, describe, expect, it } from 'vitest'
import {
  MissingSupabaseEnvError,
  missingSupabaseEnv,
  requireSupabaseEnv,
} from '@/lib/supabase/env'

const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('requireSupabaseEnv', () => {
  it('揃っていれば値を返す', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    expect(requireSupabaseEnv()).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon' })
  })

  it('足りない変数を名指しして投げる', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    try {
      requireSupabaseEnv()
      throw new Error('投げるはず')
    } catch (e) {
      expect(e).toBeInstanceOf(MissingSupabaseEnvError)
      expect((e as MissingSupabaseEnvError).missing).toEqual([
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      ])
      // 素の Internal Server Error ではなく、何が無いか分かる文言にする
      expect((e as Error).message).toContain('NEXT_PUBLIC_SUPABASE_URL')
    }
  })

  it('片方だけ欠けている場合はそれだけを挙げる', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    expect(missingSupabaseEnv()).toEqual(['NEXT_PUBLIC_SUPABASE_ANON_KEY'])
  })

  it('揃っていれば missingSupabaseEnv は空', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    expect(missingSupabaseEnv()).toEqual([])
  })
})
