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

// ─── WORKDAY — direct employer scraper ───────────────────────────────────────
const WORKDAY_SITES = [
  // ── UNITED STATES ────────────────────────────────────────────────────────
  { company: 'Walmart',           country: 'US', host: 'walmart.wd5.myworkdayjobs.com',        tenant: 'Walmart',        path: 'External' },
  { company: 'Target',            country: 'US', host: 'target.wd5.myworkdayjobs.com',         tenant: 'Target',         path: 'Target' },
  { company: 'Home Depot',        country: 'US', host: 'homedepot.wd5.myworkdayjobs.com',      tenant: 'HomeDepot',      path: 'External' },
  { company: "Lowe's",            country: 'US', host: 'lowes.wd5.myworkdayjobs.com',          tenant: 'Lowes',          path: 'External' },
  { company: 'CVS Health',        country: 'US', host: 'cvshealth.wd1.myworkdayjobs.com',      tenant: 'CVSHealth',      path: 'External' },
  { company: 'Walgreens',         country: 'US', host: 'walgreens.wd5.myworkdayjobs.com',      tenant: 'Walgreens',      path: 'External' },
  { company: 'Kroger',            country: 'US', host: 'kroger.wd5.myworkdayjobs.com',         tenant: 'Kroger',         path: 'External' },
  { company: 'Dollar General',    country: 'US', host: 'dollargeneral.wd5.myworkdayjobs.com',  tenant: 'DollarGeneral',  path: 'External' },
  { company: 'Dollar Tree',       country: 'US', host: 'dollartree.wd5.myworkdayjobs.com',     tenant: 'DollarTree',     path: 'External' },
  { company: "Wendy's",           country: 'US', host: 'wendys.wd5.myworkdayjobs.com',         tenant: 'Wendys',         path: 'External' },
  { company: 'Restaurant Brands', country: 'US', host: 'rbi.wd1.myworkdayjobs.com',            tenant: 'RBI',            path: 'External' }, // BK + Tim Hortons + Popeyes
  { company: 'Papa Johns',        country: 'US', host: 'papajohns.wd1.myworkdayjobs.com',      tenant: 'PapaJohns',      path: 'External' },
  { company: 'Panera Bread',      country: 'US', host: 'panerabread.wd5.myworkdayjobs.com',    tenant: 'PaneraBread',    path: 'External' },
  { company: 'Chipotle',          country: 'US', host: 'chipotle.wd5.myworkdayjobs.com',       tenant: 'Chipotle',       path: 'Chipotle' },
  { company: 'Hyatt',             country: 'US', host: 'hyatt.wd5.myworkdayjobs.com',          tenant: 'Hyatt',          path: 'External' },
  { company: 'IHG',               country: 'US', host: 'ihg.wd3.myworkdayjobs.com',            tenant: 'IHG',            path: 'IHG' },
  { company: 'Wyndham Hotels',    country: 'US', host: 'wyndham.wd5.myworkdayjobs.com',        tenant: 'Wyndham',        path: 'External' },
  { company: 'Choice Hotels',     country: 'US', host: 'choicehotels.wd5.myworkdayjobs.com',   tenant: 'ChoiceHotels',   path: 'External' },
  { company: 'FedEx',             country: 'US', host: 'fedex.wd1.myworkdayjobs.com',          tenant: 'FedEx',          path: 'FedEx_Careers' },
  { company: 'DHL US',            country: 'US', host: 'dhl.wd3.myworkdayjobs.com',            tenant: 'DHL',            path: 'DHL_Careers' },
  { company: 'Uber',              country: 'US', host: 'uber.wd5.myworkdayjobs.com',           tenant: 'Uber',           path: 'External' },

  // ── UNITED KINGDOM ───────────────────────────────────────────────────────
  { company: "McDonald's UK",     country: 'UK', host: 'mcdonalds.wd5.myworkdayjobs.com',      tenant: 'McDonalds',      path: 'External' },
  { company: 'Tesco',             country: 'UK', host: 'tesco.wd3.myworkdayjobs.com',          tenant: 'Tesco',          path: 'Tesco_Careers' },
  { company: 'Asda',              country: 'UK', host: 'asda.wd3.myworkdayjobs.com',           tenant: 'Asda',           path: 'ASDA_Careers' },
  { company: 'Morrisons',         country: 'UK', host: 'morrisons.wd3.myworkdayjobs.com',      tenant: 'Morrisons',      path: 'Morrisons' },
  { company: 'Costa Coffee',      country: 'UK', host: 'costa.wd3.myworkdayjobs.com',          tenant: 'Costa',          path: 'Costa_Careers' },
  { company: 'Whitbread',         country: 'UK', host: 'whitbread.wd3.myworkdayjobs.com',      tenant: 'Whitbread',      path: 'Whitbread' },
  { company: 'DHL UK',            country: 'UK', host: 'dhl.wd3.myworkdayjobs.com',            tenant: 'DHL',            path: 'DHL_Careers' },

  // ── GLOBAL (Hilton, Marriott — post to global instance, returns per location) ─
  { company: 'Hilton',            country: 'Global', host: 'hilton.wd5.myworkdayjobs.com',     tenant: 'Hilton',         path: 'Hilton_Jobs' },
  { company: 'Marriott',          country: 'Global', host: 'marriott.wd5.myworkdayjobs.com',   tenant: 'Marriott',       path: 'marriottjobsandcareer' },

  // ── CANADA ───────────────────────────────────────────────────────────────
  { company: 'Loblaws',           country: 'CA', host: 'loblaws.wd3.myworkdayjobs.com',        tenant: 'Loblaws',        path: 'External' },
  { company: 'Canadian Tire',     country: 'CA', host: 'canadiantire.wd3.myworkdayjobs.com',   tenant: 'CanadianTire',   path: 'External' },
  { company: 'Tim Hortons (CA)',  country: 'CA', host: 'rbi.wd1.myworkdayjobs.com',            tenant: 'RBI',            path: 'External' },

  // ── AUSTRALIA ────────────────────────────────────────────────────────────
  { company: 'Woolworths AU',     country: 'AU', host: 'woolworths.wd3.myworkdayjobs.com',     tenant: 'Woolworths',     path: 'External' },
  { company: 'Coles AU',          country: 'AU', host: 'coles.wd3.myworkdayjobs.com',          tenant: 'Coles',          path: 'External' },
  { company: 'Wesfarmers/Bunnings',country:'AU', host: 'wesfarmers.wd3.myworkdayjobs.com',     tenant: 'Wesfarmers',     path: 'External' },
]

async function fetchWorkday(what: string): Promise<{ jobs: Job[]; count: number }> {
  const results = await Promise.allSettled(
    WORKDAY_SITES.map(async site => {
      const url = `https://${site.host}/wday/cxs/${site.tenant}/${site.path}/jobs`
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({ limit: 10, offset: 0, searchText: what || '', appliedFacets: {} }),
      })
      if (!res.ok) return []
      const data = await res.json()
      return (data.jobPostings ?? []).map((j: any): Job => ({
        id:            `wd-${site.tenant}-${(j.bulletFields?.[0] ?? j.title ?? Math.random()).toString().replace(/\s/g, '').slice(0, 12)}`,
        source:        'workday',
        title:         j.title ?? '',
        company:       site.company,
        location:      j.locationsText ?? '',
        country:       site.country,
        salary_min:    null,
        salary_max:    null,
        description:   j.briefDescription ?? '',
        contract_time: null,
        contract_type: null,
        redirect_url:  j.externalPath
          ? `https://${site.host}${j.externalPath}`
          : `https://${site.host}/en-US/${site.path}/job/${encodeURIComponent(j.title ?? '')}`,
        category:      j.jobFunctionSummary ?? '',
        posted_at:     j.postedOn ?? '',
      }))
    })
  )

  const all: Job[] = []
  results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value) })
  return { jobs: all, count: all.length }
}

// ─── GREENHOUSE — open API ────────────────────────────────────────────────────
const GH_COMPANIES = [
  // Food & Beverage — US
  { slug: 'shakeshack',       company: 'Shake Shack',           country: 'US' },
  { slug: 'sweetgreen',       company: 'Sweetgreen',            country: 'US' },
  { slug: 'freshii',          company: 'Freshii',               country: 'US' },
  { slug: 'wingstop',         company: 'Wingstop',              country: 'US' },
  { slug: 'jackinthebox',     company: 'Jack in the Box',       country: 'US' },
  { slug: 'dairyqueen',       company: 'Dairy Queen',           country: 'US' },
  { slug: 'chickfila',        company: "Chick-fil-A",           country: 'US' },
  // Food & Beverage — UK
  { slug: 'pret',             company: 'Pret a Manger',         country: 'UK' },
  { slug: 'leon',             company: 'Leon Restaurants',      country: 'UK' },
  { slug: 'nandos',           company: "Nando's",               country: 'UK' },
  { slug: 'greggs',           company: 'Greggs',                country: 'UK' },
  { slug: 'tgi',              company: 'TGI Fridays UK',        country: 'UK' },
  // Facilities & Cleaning — Global
  { slug: 'compassgroup',     company: 'Compass Group',         country: 'Global' },
  { slug: 'aramark',          company: 'Aramark',               country: 'US' },
  { slug: 'sodexo',           company: 'Sodexo',                country: 'Global' },
  { slug: 'mitie',            company: 'Mitie',                 country: 'UK' },
  { slug: 'iss',              company: 'ISS',                   country: 'Global' },
  { slug: 'initial',          company: 'Initial Facilities',    country: 'UK' },
  // Security
  { slug: 'g4s',              company: 'G4S',                   country: 'Global' },
  { slug: 'securitas',        company: 'Securitas',             country: 'Global' },
  { slug: 'allieduniversal',  company: 'Allied Universal',      country: 'US' },
  // Delivery & Logistics
  { slug: 'deliveroo',        company: 'Deliveroo',             country: 'UK' },
  { slug: 'gopuff',           company: 'GoPuff',                country: 'US' },
  { slug: 'getir',            company: 'Getir',                 country: 'Global' },
  { slug: 'ocado',            company: 'Ocado',                 country: 'UK' },
  { slug: 'yodel',            company: 'Yodel',                 country: 'UK' },
  { slug: 'wincanton',        company: 'Wincanton',             country: 'UK' },
  { slug: 'xpo',              company: 'XPO Logistics',         country: 'US' },
  { slug: 'ceva',             company: 'CEVA Logistics',        country: 'Global' },
  { slug: 'kuehnenagel',      company: 'Kuehne+Nagel',          country: 'Global' },
  // Staffing — US
  { slug: 'adeccousa',        company: 'Adecco USA',            country: 'US' },
  { slug: 'manpowergroup',    company: 'ManpowerGroup',         country: 'US' },
  { slug: 'roberthalfintl',   company: 'Robert Half',           country: 'US' },
  // Retail — US
  { slug: 'fiveguys',         company: 'Five Guys',             country: 'US' },
  { slug: 'tjx',              company: 'TJX Companies',         country: 'US' },
  { slug: 'gap',              company: 'Gap Inc.',               country: 'US' },
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
const LEVER_COMPANIES = [
  // Logistics & Delivery
  { slug: 'deliveroo',        company: 'Deliveroo',             country: 'UK' },
  { slug: 'gopuff',           company: 'GoPuff',                country: 'US' },
  { slug: 'stuart',           company: 'Stuart',                country: 'EU' },
  { slug: 'gophr',            company: 'Gophr',                 country: 'UK' },
  { slug: 'lalamove',         company: 'Lalamove',              country: 'Global' },
  // Staffing & Temp
  { slug: 'manpower',         company: 'Manpower',              country: 'US' },
  { slug: 'adecco',           company: 'Adecco',                country: 'Global' },
  { slug: 'randstad',         company: 'Randstad',              country: 'Global' },
  { slug: 'hays',             company: 'Hays',                  country: 'UK' },
  { slug: 'kelly',            company: 'Kelly Services',        country: 'US' },
  { slug: 'spherion',         company: 'Spherion',              country: 'US' },
  // Ops & Customer Service
  { slug: 'concentrix',       company: 'Concentrix',            country: 'Global' },
  { slug: 'taskus',           company: 'TaskUs',                country: 'US' },
  { slug: 'teleperformance',  company: 'Teleperformance',       country: 'Global' },
  // Gig & On-demand
  { slug: 'instawork',        company: 'Instawork',             country: 'US' },
  { slug: 'shiftgig',         company: 'Shiftgig',              country: 'US' },
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

    const sources: Record<string, number | string> = {}
    for (const [name, result] of Object.entries({ adzuna, amazon, greenhouse, lever, workday, reed })) {
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
