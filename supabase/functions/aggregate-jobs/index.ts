const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Normalised job shape (matches Adzuna output the frontend already knows)
interface Job {
  id: string
  source: string
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

// ─── ADZUNA ──────────────────────────────────────────────────────────────────
async function fetchAdzuna(what: string, where: string, page: number, perPage: number) {
  const params = new URLSearchParams({
    app_id:           Deno.env.get('ADZUNA_APP_ID')  ?? '',
    app_key:          Deno.env.get('ADZUNA_APP_KEY') ?? '',
    results_per_page: String(perPage),
    what,
  })
  if (where) params.set('where', where)

  const res  = await fetch(`https://api.adzuna.com/v1/api/jobs/gb/search/${page}?${params}`, {
    headers: { Accept: 'application/json' },
  })
  const data = await res.json()

  const jobs: Job[] = (data.results ?? []).map((r: any) => ({
    id:            `az-${r.id}`,
    source:        'adzuna',
    title:         r.title ?? '',
    company:       r.company?.display_name ?? '',
    location:      r.location?.display_name ?? '',
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
}

// ─── AMAZON.JOBS ─────────────────────────────────────────────────────────────
async function fetchAmazon(what: string, page: number, perPage: number) {
  const offset = (page - 1) * perPage
  const params = new URLSearchParams({
    base_query:   what || 'warehouse',
    loc_query:    'United Kingdom',
    country:      'GBR',
    result_limit: String(perPage),
    offset:       String(offset),
  })

  const res = await fetch(`https://www.amazon.jobs/en/search.json?${params}`, {
    headers: {
      'Accept':     'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; GigGrab/1.0)',
    },
  })
  if (!res.ok) return { jobs: [], count: 0 }
  const data = await res.json()

  const jobs: Job[] = (data.jobs ?? []).map((j: any) => ({
    id:            `amz-${j.id_icims}`,
    source:        'amazon',
    title:         j.title ?? '',
    company:       'Amazon',
    location:      j.city ? `${j.city}${j.state ? ', ' + j.state : ''}` : (j.location ?? 'UK'),
    salary_min:    null,
    salary_max:    null,
    description:   j.description_short ?? j.description ?? j.basic_qualifications ?? '',
    contract_time: (j.schedule_type ?? '').toLowerCase().includes('part') ? 'part_time' : 'full_time',
    contract_type: (j.employment_type ?? '').toLowerCase().includes('temp') ? 'contract' : 'permanent',
    redirect_url:  `https://www.amazon.jobs${j.job_path ?? ''}`,
    category:      j.job_category ?? 'Warehouse & Logistics',
    posted_at:     j.posted_date ?? '',
  }))

  return { jobs, count: data.hits ?? 0 }
}

// ─── GREENHOUSE (open API — no key) ──────────────────────────────────────────
// Blue-collar / frontline companies known to be on Greenhouse
const GH_COMPANIES = [
  'shashkeshack',      // Shake Shack
  'pret',              // Pret a Manger
  'leon',              // Leon Restaurants
  'nandos',            // Nando's
  'greggs',            // Greggs
  'tgi',               // TGI Fridays
  'compassgroup',      // Compass Group (catering/facilities)
  'aramark',           // Aramark (food service)
  'sodexo',            // Sodexo (facilities/catering)
  'mitie',             // Mitie (facilities management, cleaning, security)
  'g4s',               // G4S (security)
  'securitas',         // Securitas
  'initial',           // Initial Facilities
  'iss',               // ISS (cleaning/facilities)
  'deliveroo',         // Deliveroo
  'getir',             // Getir
  'gopuff',            // GoPuff
  'ocado',             // Ocado
  'parcelforce',       // Parcelforce
  'yodel',             // Yodel
  'wincanton',         // Wincanton
  'xpo',               // XPO Logistics
  'ceva',              // CEVA Logistics
  'kuehnenagel',       // Kuehne+Nagel
]

async function fetchGreenhouse(what: string): Promise<{ jobs: Job[]; count: number }> {
  const keyword = (what || 'warehouse').toLowerCase()

  const results = await Promise.allSettled(
    GH_COMPANIES.map(slug =>
      fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`)
        .then(r => r.ok ? r.json() : { jobs: [] })
        .then((d: any) => (d.jobs ?? []) as any[])
        .catch(() => [] as any[])
    )
  )

  const all: Job[] = []
  results.forEach(r => {
    if (r.status !== 'fulfilled') return
    r.value.forEach((j: any) => {
      const text = `${j.title ?? ''} ${j.content ?? ''}`.toLowerCase()
      if (!text.includes(keyword) && keyword !== 'warehouse') return // filter by search
      all.push({
        id:            `gh-${j.id}`,
        source:        'greenhouse',
        title:         j.title ?? '',
        company:       j.company_name ?? (j.departments?.[0]?.name ?? ''),
        location:      j.location?.name ?? 'UK',
        salary_min:    null,
        salary_max:    null,
        description:   j.content ?? '',
        contract_time: null,
        contract_type: null,
        redirect_url:  j.absolute_url ?? '',
        category:      j.departments?.[0]?.name ?? 'General',
        posted_at:     j.updated_at ?? '',
      })
    })
  })

  return { jobs: all, count: all.length }
}

// ─── LEVER (open API — no key) ───────────────────────────────────────────────
const LEVER_COMPANIES = [
  'amazon',
  'deliveroo',
  'gopuff',
  'stuart',          // Stuart courier
  'gophr',           // Gophr courier
  'henchman',        // Henchman logistics
  'taskus',          // TaskUs
  'concentrix',      // Concentrix (customer service/ops)
  'manpower',
  'adecco',
  'randstad',
  'hays',
]

async function fetchLever(what: string): Promise<{ jobs: Job[]; count: number }> {
  const keyword = (what || 'warehouse').toLowerCase()

  const results = await Promise.allSettled(
    LEVER_COMPANIES.map(slug =>
      fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`)
        .then(r => r.ok ? r.json() : [])
        .catch(() => [] as any[])
    )
  )

  const all: Job[] = []
  results.forEach(r => {
    if (r.status !== 'fulfilled') return
    const postings: any[] = Array.isArray(r.value) ? r.value : []
    postings.forEach((j: any) => {
      const text = `${j.text ?? ''} ${j.descriptionPlain ?? ''}`.toLowerCase()
      if (!text.includes(keyword) && keyword !== 'warehouse') return
      all.push({
        id:            `lv-${j.id}`,
        source:        'lever',
        title:         j.text ?? '',
        company:       j.hostedUrl?.split('jobs.lever.co/')?.[1]?.split('/')?.[0] ?? 'Company',
        location:      j.categories?.location ?? j.country ?? 'UK',
        salary_min:    null,
        salary_max:    null,
        description:   j.descriptionPlain ?? j.description ?? '',
        contract_time: (j.categories?.commitment ?? '').toLowerCase().includes('part') ? 'part_time' : 'full_time',
        contract_type: null,
        redirect_url:  j.hostedUrl ?? '',
        category:      j.categories?.team ?? 'General',
        posted_at:     j.createdAt ? new Date(j.createdAt).toISOString() : '',
      })
    })
  })

  return { jobs: all, count: all.length }
}

// ─── WORKDAY SCRAPER ─────────────────────────────────────────────────────────
// Undocumented but stable POST JSON endpoint on every Workday career site
const WORKDAY_SITES = [
  { company: "McDonald's UK",    host: 'mcdonalds.wd5.myworkdayjobs.com',    tenant: 'McDonalds',   path: 'External' },
  { company: 'Tesco',            host: 'tesco.wd3.myworkdayjobs.com',         tenant: 'Tesco',       path: 'Tesco_Careers' },
  { company: 'Asda',             host: 'asda.wd3.myworkdayjobs.com',          tenant: 'Asda',        path: 'ASDA_Careers' },
  { company: 'Morrisons',        host: 'morrisons.wd3.myworkdayjobs.com',     tenant: 'Morrisons',   path: 'Morrisons' },
  { company: 'Chipotle',         host: 'chipotle.wd5.myworkdayjobs.com',      tenant: 'Chipotle',    path: 'Chipotle' },
  { company: 'DHL',              host: 'dhl.wd3.myworkdayjobs.com',           tenant: 'DHL',         path: 'DHL_Careers' },
  { company: 'FedEx',            host: 'fedex.wd1.myworkdayjobs.com',         tenant: 'FedEx',       path: 'FedEx_Careers' },
  { company: 'Hilton',           host: 'hilton.wd5.myworkdayjobs.com',        tenant: 'Hilton',      path: 'Hilton_Jobs' },
  { company: 'Marriott',         host: 'marriott.wd5.myworkdayjobs.com',      tenant: 'Marriott',    path: 'marriottjobsandcareer' },
  { company: 'Costa Coffee',     host: 'costa.wd3.myworkdayjobs.com',         tenant: 'Costa',       path: 'Costa_Careers' },
  { company: 'Whitbread',        host: 'whitbread.wd3.myworkdayjobs.com',     tenant: 'Whitbread',   path: 'Whitbread' },
]

async function fetchWorkday(what: string): Promise<{ jobs: Job[]; count: number }> {
  const results = await Promise.allSettled(
    WORKDAY_SITES.map(async site => {
      const url = `https://${site.host}/wday/cxs/${site.tenant}/${site.path}/jobs`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ limit: 10, offset: 0, searchText: what || 'warehouse', appliedFacets: {} }),
      })
      if (!res.ok) return []
      const data = await res.json()
      return (data.jobPostings ?? []).map((j: any): Job => ({
        id:            `wd-${site.tenant}-${j.bulletFields?.join('') ?? j.title?.slice(0, 8)}`.replace(/\s/g, ''),
        source:        'workday',
        title:         j.title ?? '',
        company:       site.company,
        location:      j.locationsText ?? j.localizationCountry ?? 'UK',
        salary_min:    null,
        salary_max:    null,
        description:   j.jobDescription ?? j.briefDescription ?? '',
        contract_time: null,
        contract_type: null,
        redirect_url:  j.externalPath
          ? `https://${site.host}${j.externalPath}`
          : `https://${site.host}/en-US/${site.path}/job/${j.bulletFields?.[0] ?? ''}`,
        category:      j.jobFunctionSummary ?? 'General',
        posted_at:     j.postedOn ?? '',
      }))
    })
  )

  const all: Job[] = []
  results.forEach(r => {
    if (r.status === 'fulfilled') all.push(...r.value)
  })
  return { jobs: all, count: all.length }
}

// ─── REED.CO.UK (needs key — skipped if env var not set) ─────────────────────
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
    headers: {
      Authorization: `Basic ${btoa(key + ':')}`,
      Accept:        'application/json',
    },
  })
  if (!res.ok) return { jobs: [], count: 0 }
  const data = await res.json()

  const jobs: Job[] = (data.results ?? []).map((j: any) => ({
    id:            `reed-${j.jobId}`,
    source:        'reed',
    title:         j.jobTitle ?? '',
    company:       j.employerName ?? '',
    location:      j.locationName ?? '',
    salary_min:    j.minimumSalary ?? null,
    salary_max:    j.maximumSalary ?? null,
    description:   j.jobDescription ?? '',
    contract_time: null,
    contract_type: null,
    redirect_url:  j.jobUrl ?? '',
    category:      '',
    posted_at:     j.date ?? '',
  }))

  return { jobs, count: data.totalResults ?? 0 }
}

// ─── DEDUP ───────────────────────────────────────────────────────────────────
function dedup(jobs: Job[]): Job[] {
  const seen = new Set<string>()
  return jobs.filter(j => {
    const key = `${j.title.toLowerCase().slice(0, 30)}|${j.company.toLowerCase().slice(0, 20)}|${j.location.toLowerCase().slice(0, 15)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { what = 'warehouse', where = '', page = 1, perPage = 10 } = await req.json()

    // Run all sources in parallel — failures are isolated
    const [adzuna, amazon, greenhouse, lever, workday, reed] = await Promise.allSettled([
      fetchAdzuna(what, where, page, perPage),
      fetchAmazon(what, page, perPage),
      fetchGreenhouse(what),
      fetchLever(what),
      fetchWorkday(what),
      fetchReed(what, where, page, perPage),
    ])

    const allJobs: Job[] = []
    let totalCount = 0

    for (const result of [adzuna, amazon, greenhouse, lever, workday, reed]) {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value.jobs)
        totalCount += result.value.count
      }
    }

    const unique = dedup(allJobs)

    // Summary of active sources (for debugging)
    const sources = {
      adzuna:     adzuna.status    === 'fulfilled' ? adzuna.value.count     : 'failed',
      amazon:     amazon.status    === 'fulfilled' ? amazon.value.count     : 'failed',
      greenhouse: greenhouse.status === 'fulfilled' ? greenhouse.value.count : 'failed',
      lever:      lever.status      === 'fulfilled' ? lever.value.count      : 'failed',
      workday:    workday.status    === 'fulfilled' ? workday.value.count    : 'failed',
      reed:       reed.status       === 'fulfilled' ? reed.value.count       : 'no key',
    }

    return new Response(
      JSON.stringify({ results: unique, count: totalCount, sources }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), results: [], count: 0 }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
