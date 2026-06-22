// Shared job-digest helpers for the WhatsApp alert template `jobalerts`:
//   {{1}}=first name  {{2}}=role  {{3}}=city  {{4}}=a job line

export type Job = { title: string; company: string; url: string; location: string }

export async function adzunaDigest(location: string, limit = 3): Promise<{ count: number; jobs: Job[] }> {
  const id = Deno.env.get('ADZUNA_APP_ID')
  const key = Deno.env.get('ADZUNA_APP_KEY')
  if (!id || !key || !location) return { count: 0, jobs: [] }
  const city = location.split(',')[0].trim()
  const params = new URLSearchParams({
    app_id: id, app_key: key, results_per_page: String(Math.min(limit, 50)), where: city,
    what_or: 'warehouse retail care logistics delivery cleaning hospitality security',
    sort_by: 'date', max_days_old: '14',
  })
  try {
    const res = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`)
    if (!res.ok) return { count: 0, jobs: [] }
    const d = await res.json()
    const jobs: Job[] = (d.results ?? []).slice(0, limit).map((j: any) => ({
      title:    j.title ?? '',
      company:  j.company?.display_name ?? '',
      url:      j.redirect_url ?? '',
      location: j.location?.display_name ?? city,
    })).filter((j: Job) => j.title)
    return { count: d.count ?? jobs.length, jobs }
  } catch { return { count: 0, jobs: [] } }
}

export function digestVars(opts: { name?: string; role?: string; location?: string; jobs: Job[]; appUrl: string }): Record<string, string> {
  const first = (opts.name || 'there').trim().split(/\s+/)[0]
  const city = (opts.location || '').split(',')[0].trim() || 'your area'
  const top = opts.jobs[0]
  const jobLine = top
    ? `${top.title}${top.company ? ' at ' + top.company : ''}. See more: ${opts.appUrl}`
    : `New roles near you. See more: ${opts.appUrl}`
  return { '1': first, '2': (opts.role || 'frontline').trim(), '3': city, '4': jobLine }
}
