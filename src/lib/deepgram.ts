import { supabase } from './supabase'

export async function textToSpeech(text: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('tts', { body: { text } })
  if (error) throw error

  const binary = atob(data.audio as string)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)

  return new Promise((resolve, reject) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve() }
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('audio play failed')) }
    audio.play().catch(reject)
  })
}

type TranscriptCallback = (text: string, isFinal: boolean) => void

// Uses browser Web Speech API — no API key needed, works in Chrome/Edge/Safari
export class DeepgramSTT {
  private recognition: any = null

  async start(onTranscript: TranscriptCallback): Promise<void> {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) throw new Error('Speech recognition not supported in this browser')

    this.recognition = new SR()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-GB'

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript as string
        const isFinal = event.results[i].isFinal as boolean
        if (text.trim()) onTranscript(text, isFinal)
      }
    }

    this.recognition.onerror = () => {}
    this.recognition.start()
  }

  stop(): void {
    try { this.recognition?.stop() } catch {}
    this.recognition = null
  }
}
