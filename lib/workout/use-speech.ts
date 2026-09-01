'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Web Speech API で日本語の発話を文字にする。
 *
 * サーバも API キーも要らないので費用が増えない。ただし対応はブラウザ次第で、
 * HTTPS とマイクの許可も要る。**使えない場合に黙って何も起きないのが最悪**なので、
 * 対応状況と失敗の理由を必ず返し、呼び出し側が画面に出せるようにする。
 */

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定で許可してください。',
  'service-not-allowed':
    'マイクの使用が許可されていません。ブラウザの設定で許可してください。',
  'no-speech': '声が聞き取れませんでした。もう一度お試しください。',
  'audio-capture': 'マイクが見つかりませんでした。',
  network: '音声認識がネットワークに接続できませんでした。',
  aborted: '',
}

export type SpeechState = {
  /** このブラウザで使えるか。false ならボタンを出さず、打ち込む欄だけにする */
  supported: boolean
  listening: boolean
  /** 認識中の途中経過を含む文字列 */
  transcript: string
  error: string | null
  /**
   * 認識を始める。**終わったら onFinal が最終結果で呼ばれる。**
   * 話し終わりは沈黙で自動的に来るので、呼び出し側が「終わった」を
   * 押させる必要はない（押しても同じ経路を通る）。
   */
  start: (onFinal?: (text: string) => void) => void
  stop: () => void
  reset: () => void
}

/**
 * 対応状況はブラウザ側にしか無い事実なので、外部ストアとして読む。
 * サーバでは常に false を返し、ハイドレーションのずれを避ける。
 * 一度決まったら変わらないので購読は何もしない。
 */
const subscribeNever = () => () => {}
const isSupportedNow = () => getCtor() !== null
const isSupportedOnServer = () => false

export function useSpeech(): SpeechState {
  const supported = useSyncExternalStore(subscribeNever, isSupportedNow, isSupportedOnServer)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // onend のクロージャからは state の最新値が見えないので、ref に持つ
  const transcriptRef = useRef('')

  useEffect(() => {
    return () => recognitionRef.current?.abort()
  }, [])

  const start = useCallback((onFinal?: (text: string) => void) => {
    const Ctor = getCtor()
    if (!Ctor) return

    recognitionRef.current?.abort()
    transcriptRef.current = ''
    setTranscript('')
    setError(null)

    const recognition = new Ctor()
    recognition.lang = 'ja-JP'
    // 種目を続けて言えるように、句切りで止めない
    recognition.continuous = true
    // 話している途中も画面に出す。無反応に見えるのを避ける
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      transcriptRef.current = text
      setTranscript(text)
    }
    recognition.onerror = (event) => {
      const message = ERROR_MESSAGES[event.error] ?? `音声を認識できませんでした（${event.error}）`
      if (message) setError(message)
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      // 沈黙で自動的に終わることも、停止ボタンで終わることもある。
      // どちらでもここを通るので、解析の入口を 1 つにできる。
      if (transcriptRef.current.trim()) onFinal?.(transcriptRef.current)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      // すでに開始しているときなど。無反応にせず理由を出す
      setError('音声認識を開始できませんでした。もう一度お試しください。')
    }
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    recognitionRef.current?.abort()
    transcriptRef.current = ''
    setTranscript('')
    setError(null)
    setListening(false)
  }, [])

  return { supported, listening, transcript, error, start, stop, reset }
}
