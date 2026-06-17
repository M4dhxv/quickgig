import { supabase } from './supabase'

export async function askSarah(
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ask-sarah', {
    body: { messages: history },
  })
  if (error) throw error
  return data.text as string
}
