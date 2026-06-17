const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { what = 'warehouse', where = '', page = 1, perPage = 10 } = await req.json()

    const params = new URLSearchParams({
      app_id: Deno.env.get('ADZUNA_APP_ID') ?? '',
      app_key: Deno.env.get('ADZUNA_APP_KEY') ?? '',
      results_per_page: String(perPage),
      what,
    })
    if (where) params.set('where', where)

    // Page goes in the URL path per Adzuna docs
    const url = `https://api.adzuna.com/v1/api/jobs/gb/search/${page}?${params}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), results: [], count: 0 }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
