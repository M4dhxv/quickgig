const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  return new Response(JSON.stringify({ key: Deno.env.get('DEEPGRAM_KEY')! }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
