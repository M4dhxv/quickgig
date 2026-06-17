import { supabase } from './supabase'

const SKILL_WORDS = [
  'warehouse', 'logistics', 'forklift', 'picking', 'packing', 'dispatch',
  'stock control', 'inventory', 'operations', 'supervisor', 'fulfilment',
  'supply chain', 'distribution', 'loading', 'unloading', 'goods in',
  'goods out', 'wms', 'rf scanner', 'team leader', 'shift manager',
]

const CERT_WORDS = [
  'flt', 'iosh', 'cscs', 'nvq', 'cpc', 'adr', 'first aid',
  'health and safety', 'counterbalance', 'reach truck', 'manual handling',
  'nebosh', 'fire warden', 'food hygiene', 'haccp',
]

export type MatchBreakdown = {
  score: number
  skills: boolean
  certs: boolean
  salary: boolean
  fullTime: boolean
}

export function getMatchBreakdown(job: AdzunaJob): MatchBreakdown {
  const text = `${job.title} ${job.description} ${job.category}`.toLowerCase()
  const skillHits = SKILL_WORDS.filter(k => text.includes(k)).length
  const certHits  = CERT_WORDS.filter(k => text.includes(k)).length
  const salary    = !!(job.salary_min && job.salary_min >= 24000)
  const fullTime  = job.contract_time === 'full_time'

  const score = Math.min(99,
    50 +
    Math.min(24, skillHits * 4) +
    Math.min(12, certHits * 6) +
    (salary ? 8 : 0) +
    (fullTime ? 5 : 0)
  )

  return { score, skills: skillHits > 0, certs: certHits > 0, salary, fullTime }
}

export type AdzunaJob = {
  id: string
  source?: string
  title: string
  company: string
  location: string
  country?: string
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

// Multi-source aggregator — Adzuna + Amazon + Greenhouse + Lever + Workday + Reed
export async function searchJobsMulti(what: string, where = '', page = 1, perPage = 10): Promise<{ jobs: AdzunaJob[]; count: number; sources?: Record<string, number | string> }> {
  const { data, error } = await supabase.functions.invoke('aggregate-jobs', {
    body: { what, where, page, perPage },
  })
  if (error) {
    // Fall back to Adzuna-only if aggregator fails
    return searchJobs(what, where, page, perPage)
  }

  const jobs: AdzunaJob[] = (data.results ?? []).map((r: any) => ({
    id:            r.id,
    title:         r.title,
    company:       r.company ?? '',
    location:      r.location ?? '',
    country:       r.country ?? '',
    salary_min:    r.salary_min ?? null,
    salary_max:    r.salary_max ?? null,
    description:   r.description ?? '',
    contract_time: r.contract_time ?? null,
    contract_type: r.contract_type ?? null,
    redirect_url:  r.redirect_url,
    category:      r.category ?? '',
    posted_at:     r.posted_at ?? '',
  }))

  return { jobs, count: data.count ?? 0, sources: data.sources }
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

export function matchScore(job: AdzunaJob): number {
  return getMatchBreakdown(job).score
}
