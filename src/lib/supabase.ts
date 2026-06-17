import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_KEY as string,
)

export type JobResult = {
  id?: string
  adzuna_id: string
  title: string
  company: string
  location: string
  salary_min: number | null
  salary_max: number | null
  description: string
  contract_time: string | null
  contract_type: string | null
  redirect_url: string
  category: string
  posted_at: string
  score: number
  search_id?: string
}

export type ChatMessage = {
  id?: string
  session_id: string
  role: 'user' | 'sarah'
  content: string
  created_at?: string
}

export type SavedJob = {
  id?: string
  session_id: string
  adzuna_id: string
  title: string
  company: string
  location: string
  salary_min: number | null
  salary_max: number | null
  redirect_url: string
  created_at?: string
}
