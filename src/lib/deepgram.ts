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

export class DeepgramSTT {
  private ws: WebSocket | null = null
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null

  async start(onTranscript: TranscriptCallback): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const { data, error } = await supabase.functions.invoke('deepgram-token')
    if (error) throw new Error('Could not get speech token')
    const token = data.key as string

    const params = new URLSearchParams({
      token,
      model: 'nova-2',
      language: 'en-GB',
      interim_results: 'true',
      smart_format: 'true',
      endpointing: '500',
    })

    this.ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`)

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Deepgram timeout')), 6000)
      this.ws!.onopen = () => { clearTimeout(t); resolve() }
      this.ws!.onerror = () => { clearTimeout(t); reject(new Error('Deepgram WS error')) }
    })

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string)
        const text: string = data?.channel?.alternatives?.[0]?.transcript ?? ''
        const isFinal: boolean = data?.is_final ?? false
        if (text) onTranscript(text, isFinal)
      } catch {}
    }

    this.ws.onerror = () => {}

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : ''

    this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(e.data)
      }
    }
    this.mediaRecorder.start(250)
  }

  stop(): void {
    this.mediaRecorder?.stop()
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.close()
    this.stream?.getTracks().forEach(t => t.stop())
    this.mediaRecorder = null
    this.ws = null
    this.stream = null
  }
}
