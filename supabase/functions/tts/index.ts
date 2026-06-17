const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const { text } = await req.json()

  const res = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
    method: 'POST',
    headers: {
      Authorization: `Token ${Deno.env.get('DEEPGRAM_KEY')!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Deepgram TTS ${res.status}` }), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Return base64 so supabase.functions.invoke can parse it as JSON
  const buffer = await res.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

  return new Response(JSON.stringify({ audio: base64 }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
