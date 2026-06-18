const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface Job {
  id: string
  source: string
  title: string
  company: string
  location: string
  country: string
  salary_min: number | null
  salary_max: number | null
  description: string
  contract_time: string | null
  contract_type: string | null
  redirect_url: string
  category: string
  posted_at: string
}

// ─── ADZUNA — multi-country ───────────────────────────────────────────────────
// Tier 1 markets: US primary, then English-speaking, then Western Europe
const ADZUNA_MARKETS = [
  { code: 'us', country: 'United States'   },
  { code: 'gb', country: 'United Kingdom'  },
  { code: 'ca', country: 'Canada'          },
  { code: 'au', country: 'Australia'       },
  { code: 'nz', country: 'New Zealand'     },
  { code: 'de', country: 'Germany'         },
  { code: 'fr', country: 'France'          },
  { code: 'nl', country: 'Netherlands'     },
  { code: 'za', country: 'South Africa'    },
  { code: 'sg', country: 'Singapore'       },
  { code: 'be', country: 'Belgium'         },
  { code: 'at', country: 'Austria'         },
  { code: 'it', country: 'Italy'           },
  { code: 'pl', country: 'Poland'          },
  { code: 'br', country: 'Brazil'          },
  { code: 'mx', country: 'Mexico'          },
  { code: 'in', country: 'India'           },
]

async function fetchAdzuna(what: string, where: string, page: number, perPage: number) {
  const perMarket = Math.max(3, Math.floor(perPage / 4)) // spread across markets

  const results = await Promise.allSettled(
    ADZUNA_MARKETS.map(async market => {
      const params = new URLSearchParams({
        app_id:           Deno.env.get('ADZUNA_APP_ID')  ?? '',
        app_key:          Deno.env.get('ADZUNA_APP_KEY') ?? '',
        results_per_page: String(perMarket),
        what,
      })
      if (where) params.set('where', where)
      const res  = await fetch(
        `https://api.adzuna.com/v1/api/jobs/${market.code}/search/${page}?${params}`,
        { headers: { Accept: 'application/json' } }
      )
      if (!res.ok) return { jobs: [], count: 0 }
      const data = await res.json()
      const jobs: Job[] = (data.results ?? []).map((r: any) => ({
        id:            `az-${market.code}-${r.id}`,
        source:        'adzuna',
        title:         r.title ?? '',
        company:       r.company?.display_name ?? '',
        location:      r.location?.display_name ?? '',
        country:       market.country,
        salary_min:    r.salary_min ?? null,
        salary_max:    r.salary_max ?? null,
        description:   r.description ?? '',
        contract_time: r.contract_time ?? null,
        contract_type: r.contract_type ?? null,
        redirect_url:  r.redirect_url ?? '',
        category:      r.category?.label ?? '',
        posted_at:     r.created ?? '',
      }))
      return { jobs, count: data.count ?? 0 }
    })
  )

  let jobs: Job[] = [], count = 0
  results.forEach(r => {
    if (r.status === 'fulfilled') { jobs = [...jobs, ...r.value.jobs]; count += r.value.count }
  })
  return { jobs, count }
}

// ─── AMAZON.JOBS — global ────────────────────────────────────────────────────
const AMAZON_MARKETS = [
  { country: 'USA', label: 'United States' },
  { country: 'GBR', label: 'United Kingdom' },
  { country: 'CAN', label: 'Canada' },
  { country: 'AUS', label: 'Australia' },
  { country: 'DEU', label: 'Germany' },
  { country: 'FRA', label: 'France' },
  { country: 'IND', label: 'India' },
  { country: 'JPN', label: 'Japan' },
  { country: 'SGP', label: 'Singapore' },
  { country: 'MEX', label: 'Mexico' },
]

async function fetchAmazon(what: string, page: number, perPage: number) {
  const perMarket = Math.max(3, Math.floor(perPage / 3))
  const offset = (page - 1) * perMarket

  const results = await Promise.allSettled(
    AMAZON_MARKETS.map(async market => {
      const params = new URLSearchParams({
        base_query:   what || 'warehouse',
        country:      market.country,
        result_limit: String(perMarket),
        offset:       String(offset),
      })
      const res = await fetch(`https://www.amazon.jobs/en/search.json?${params}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; GigGrab/1.0)' },
      })
      if (!res.ok) return { jobs: [], count: 0 }
      const data = await res.json()
      const jobs: Job[] = (data.jobs ?? []).map((j: any) => ({
        id:            `amz-${market.country}-${j.id_icims}`,
        source:        'amazon',
        title:         j.title ?? '',
        company:       'Amazon',
        location:      j.city ? `${j.city}${j.state ? ', ' + j.state : ''}` : (j.location ?? ''),
        country:       market.label,
        salary_min:    null,
        salary_max:    null,
        description:   j.description_short ?? j.description ?? '',
        contract_time: (j.schedule_type ?? '').toLowerCase().includes('part') ? 'part_time' : 'full_time',
        contract_type: (j.employment_type ?? '').toLowerCase().includes('temp') ? 'contract' : 'permanent',
        redirect_url:  `https://www.amazon.jobs${j.job_path ?? ''}`,
        category:      j.job_category ?? 'Warehouse & Logistics',
        posted_at:     j.posted_date ?? '',
      }))
      return { jobs, count: data.hits ?? 0 }
    })
  )

  let jobs: Job[] = [], count = 0
  results.forEach(r => {
    if (r.status === 'fulfilled') { jobs = [...jobs, ...r.value.jobs]; count += r.value.count }
  })
  return { jobs, count }
}

// ─── SMARTRECRUITERS — open API, no key needed ───────────────────────────────
// Verified working companies (totalFound > 0 confirmed 2025-06)
const SR_COMPANIES = [
  // Food Service
  { id: 'Dominos',    company: "Domino's",   country: 'US' },   // 24k+ franchise jobs
  // Facilities / Catering
  { id: 'Sodexo',     company: 'Sodexo',     country: 'Global' },
  // Hospitality
  { id: 'Accor',      company: 'Accor',      country: 'Global' },
  // Security
  { id: 'Securitas',  company: 'Securitas',  country: 'Global' },
  // Retail
  { id: 'Primark',    company: 'Primark',    country: 'Global' },
]

async function fetchSmartRecruiters(what: string, where: string): Promise<{ jobs: Job[]; count: number }> {
  const city = where ? where.split(',')[0].trim() : ''

  const results = await Promise.allSettled(
    SR_COMPANIES.map(async co => {
      const params = new URLSearchParams({ limit: '20' })
      if (what) params.set('q', what)
      if (city) params.set('city', city)

      const res = await fetch(
        `https://api.smartrecruiters.com/v1/companies/${co.id}/postings?${params}`,
        { headers: { Accept: 'application/json' } }
      )
      if (!res.ok) return { jobs: [] as Job[], count: 0 }
      const data = await res.json()

      const jobs: Job[] = (data.content ?? []).map((j: any): Job => ({
        id:            `sr-${j.uuid ?? j.id}`,
        source:        'smartrecruiters',
        title:         j.name ?? '',
        company:       co.company,
        location:      j.location?.fullLocation ?? j.location?.city ?? '',
        country:       j.location?.country ?? co.country,
        salary_min:    null,
        salary_max:    null,
        description:   '',
        contract_time: j.typeOfEmployment?.id === 'part_time' ? 'part_time' : 'full_time',
        contract_type: null,
        redirect_url:  `https://jobs.smartrecruiters.com/${co.id}/${j.id}`,
        category:      j.industry?.label ?? j.function?.label ?? '',
        posted_at:     j.releasedDate ?? '',
      }))
      return { jobs, count: data.totalFound ?? 0 }
    })
  )

  const all: Job[] = []
  let count = 0
  results.forEach(r => {
    if (r.status === 'fulfilled') { all.push(...r.value.jobs); count += r.value.count }
  })
  return { jobs: all, count }
}

// ─── GREENHOUSE — open API ────────────────────────────────────────────────────
// Only verified-working slugs (404s removed; all tested 2025-06)
const GH_COMPANIES = [
  // Food & Beverage — US (verified)
  { slug: 'sweetgreen',       company: 'Sweetgreen',            country: 'US' },
  // Grocery delivery (verified)
  { slug: 'ocadogroup',       company: 'Ocado Group',           country: 'UK' },
  { slug: 'hellofresh',       company: 'HelloFresh',            country: 'Global' },
  { slug: 'instacart',        company: 'Instacart',             country: 'US' },
  // Delivery & Mobility (verified)
  { slug: 'wolt',             company: 'Wolt',                  country: 'Global' },
  { slug: 'cabify',           company: 'Cabify',                country: 'Global' },
  { slug: 'roadie',           company: 'Roadie',                country: 'US' },
]

async function fetchGreenhouse(what: string): Promise<{ jobs: Job[]; count: number }> {
  const keyword = (what || '').toLowerCase()

  const results = await Promise.allSettled(
    GH_COMPANIES.map(c =>
      fetch(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`)
        .then(r => r.ok ? r.json() : { jobs: [] })
        .then((d: any) => ({ co: c, postings: (d.jobs ?? []) as any[] }))
        .catch(() => ({ co: c, postings: [] }))
    )
  )

  const all: Job[] = []
  results.forEach(r => {
    if (r.status !== 'fulfilled') return
    const { co, postings } = r.value
    postings.forEach((j: any) => {
      if (keyword) {
        const text = `${j.title ?? ''} ${j.content ?? ''}`.toLowerCase()
        if (!text.includes(keyword)) return
      }
      all.push({
        id:            `gh-${j.id}`,
        source:        'greenhouse',
        title:         j.title ?? '',
        company:       co.company,
        location:      j.location?.name ?? '',
        country:       co.country,
        salary_min:    null,
        salary_max:    null,
        description:   j.content ?? '',
        contract_time: null,
        contract_type: null,
        redirect_url:  j.absolute_url ?? '',
        category:      j.departments?.[0]?.name ?? '',
        posted_at:     j.updated_at ?? '',
      })
    })
  })
  return { jobs: all, count: all.length }
}

// ─── LEVER — open API ────────────────────────────────────────────────────────
// Only verified-working slugs (404s removed; all tested 2025-06)
const LEVER_COMPANIES = [
  // Delivery & Logistics (verified)
  { slug: 'gopuff',           company: 'GoPuff',                country: 'US' },
  { slug: 'lalamove',         company: 'Lalamove',              country: 'Global' },
  { slug: 'stuart',           company: 'Stuart',                country: 'EU' },
  { slug: 'blablacar',        company: 'BlaBlaCar',             country: 'EU' },
  // Gig & On-demand (verified)
  { slug: 'wonolo',           company: 'Wonolo',                country: 'US' },
]

async function fetchLever(what: string): Promise<{ jobs: Job[]; count: number }> {
  const keyword = (what || '').toLowerCase()

  const results = await Promise.allSettled(
    LEVER_COMPANIES.map(c =>
      fetch(`https://api.lever.co/v0/postings/${c.slug}?mode=json`)
        .then(r => r.ok ? r.json() : [])
        .then((d: any) => ({ co: c, postings: Array.isArray(d) ? d : [] }))
        .catch(() => ({ co: c, postings: [] }))
    )
  )

  const all: Job[] = []
  results.forEach(r => {
    if (r.status !== 'fulfilled') return
    const { co, postings } = r.value
    postings.forEach((j: any) => {
      if (keyword) {
        const text = `${j.text ?? ''} ${j.descriptionPlain ?? ''}`.toLowerCase()
        if (!text.includes(keyword)) return
      }
      all.push({
        id:            `lv-${j.id}`,
        source:        'lever',
        title:         j.text ?? '',
        company:       co.company,
        location:      j.categories?.location ?? '',
        country:       co.country,
        salary_min:    null,
        salary_max:    null,
        description:   j.descriptionPlain ?? '',
        contract_time: (j.categories?.commitment ?? '').toLowerCase().includes('part') ? 'part_time' : 'full_time',
        contract_type: null,
        redirect_url:  j.hostedUrl ?? '',
        category:      j.categories?.team ?? '',
        posted_at:     j.createdAt ? new Date(j.createdAt).toISOString() : '',
      })
    })
  })
  return { jobs: all, count: all.length }
}

// ─── REED — UK only, needs key ────────────────────────────────────────────────
async function fetchReed(what: string, where: string, page: number, perPage: number) {
  const key = Deno.env.get('REED_API_KEY')
  if (!key) return { jobs: [], count: 0 }

  const params = new URLSearchParams({
    keywords:      what || 'warehouse',
    locationName:  where || 'United Kingdom',
    resultsToTake: String(perPage),
    resultsToSkip: String((page - 1) * perPage),
  })
  const res = await fetch(`https://www.reed.co.uk/api/1.0/search?${params}`, {
    headers: { Authorization: `Basic ${btoa(key + ':')}`, Accept: 'application/json' },
  })
  if (!res.ok) return { jobs: [], count: 0 }
  const data = await res.json()

  return {
    count: data.totalResults ?? 0,
    jobs: (data.results ?? []).map((j: any): Job => ({
      id:            `reed-${j.jobId}`,
      source:        'reed',
      title:         j.jobTitle ?? '',
      company:       j.employerName ?? '',
      location:      j.locationName ?? '',
      country:       'United Kingdom',
      salary_min:    j.minimumSalary ?? null,
      salary_max:    j.maximumSalary ?? null,
      description:   j.jobDescription ?? '',
      contract_time: null,
      contract_type: null,
      redirect_url:  j.jobUrl ?? '',
      category:      '',
      posted_at:     j.date ?? '',
    })),
  }
}

// ─── DEDUP ────────────────────────────────────────────────────────────────────
function dedup(jobs: Job[]): Job[] {
  const seen = new Set<string>()
  return jobs.filter(j => {
    const key = `${j.title.toLowerCase().slice(0, 30)}|${j.company.toLowerCase().slice(0, 20)}|${j.location.toLowerCase().slice(0, 12)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { what = '', where = '', page = 1, perPage = 20 } = await req.json()

    const [adzuna, amazon, greenhouse, lever, reed, smartrecruiters] = await Promise.allSettled([
      fetchAdzuna(what, where, page, perPage),
      fetchAmazon(what, page, perPage),
      fetchGreenhouse(what),
      fetchLever(what),
      fetchReed(what, where, page, perPage),
      fetchSmartRecruiters(what, where),
    ])

    const allJobs: Job[] = []
    let totalCount = 0

    const sources: Record<string, number | string> = {}
    for (const [name, result] of Object.entries({ adzuna, amazon, greenhouse, lever, reed, smartrecruiters })) {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value.jobs)
        totalCount += result.value.count
        sources[name] = result.value.count
      } else {
        sources[name] = 'error'
      }
    }

    return new Response(
      JSON.stringify({ results: dedup(allJobs), count: totalCount, sources }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), results: [], count: 0 }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
