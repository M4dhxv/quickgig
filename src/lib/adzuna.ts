import { supabase } from './supabase'

export type AdzunaJob = {
  id: string
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
}

export async function searchJobs(what: string, where = '', page = 1, perPage = 10): Promise<{ jobs: AdzunaJob[]; count: number }> {
  const { data, error } = await supabase.functions.invoke('search-jobs', {
    body: { what, where, page, perPage },
  })
  if (error) throw new Error(`Search error: ${error.message}`)

  const jobs: AdzunaJob[] = (data.results ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    company: r.company?.display_name ?? '',
    location: r.location?.display_name ?? '',
    salary_min: r.salary_min ?? null,
    salary_max: r.salary_max ?? null,
    description: r.description ?? '',
    contract_time: r.contract_time ?? null,
    contract_type: r.contract_type ?? null,
    redirect_url: r.redirect_url,
    category: r.category?.label ?? '',
    posted_at: r.created,
  }))

  return { jobs, count: data.count ?? 0 }
}

export function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return 'Salary not specified'
  const fmt = (n: number) => `£${(n / 1000).toFixed(0)}k`
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`
  return fmt((min ?? max)!)
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1d ago' : `${d}d ago`
}

export function matchScore(job: AdzunaJob, keywords: string[]): number {
  const text = `${job.title} ${job.description} ${job.category}`.toLowerCase()
  const hits = keywords.filter(k => text.includes(k.toLowerCase())).length
  const base = 60
  return Math.min(99, base + hits * 6 + (job.salary_min && job.salary_min > 30000 ? 5 : 0))
}
