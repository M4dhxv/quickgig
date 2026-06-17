import { supabase } from './supabase'

export type UserProfile = {
  name: string
  currentRole: string
  location: string
  phone: string
  email: string
  summary: string
  skills: string[]
  certifications: string[]
  experience: { role: string; company: string; duration: string }[]
}

export async function askSarah(
  history: { role: 'user' | 'assistant'; content: string }[],
  profile?: UserProfile | null
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ask-sarah', {
    body: { messages: history, profile: profile ?? null },
  })
  if (error) throw error
  return data.text as string
}
