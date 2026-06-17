const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const SYSTEM = `You are Sarah, GigGrab's AI career agent for frontline UK workers — warehouse, logistics, construction, care, hospitality, cleaning, security. Help with interview prep, salary negotiation, CV advice, and role-specific questions. Be warm, direct, and practical. UK English. Reply in under 80 words.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { messages } = await req.json()

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 256, system: SYSTEM, messages }),
    })

    const json = await res.json()
    const text: string = json.content?.[0]?.text ?? ''

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ text: "I'm having trouble connecting right now. Try again in a moment." }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
