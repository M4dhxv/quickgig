const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const { what, where = '', page = 1, perPage = 10 } = await req.json()

  const params = new URLSearchParams({
    app_id: Deno.env.get('ADZUNA_APP_ID')!,
    app_key: Deno.env.get('ADZUNA_APP_KEY')!,
    results_per_page: String(perPage),
    page: String(page),
    what,
    'content-type': 'application/json',
  })
  if (where) params.set('where', where)

  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/gb/search/1?${params}`)
  const data = await res.json()

  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
