const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function buildSystem(profile?: any): string {
  let sys = `You are Sarah, GigGrab's AI career agent for frontline UK workers — warehouse, logistics, construction, care, hospitality, cleaning, security. Help with interview prep, salary negotiation, CV advice, and role-specific questions. Be warm, direct, and practical. UK English. Reply in under 80 words.`

  if (profile?.name) {
    const parts = [
      `Worker: ${profile.name}`,
      profile.currentRole && `Current role: ${profile.currentRole}`,
      profile.location && `Location: ${profile.location}`,
      profile.skills?.length && `Skills: ${profile.skills.join(', ')}`,
      profile.certifications?.length && `Certifications: ${profile.certifications.join(', ')}`,
      profile.summary && `Background: ${profile.summary}`,
    ].filter(Boolean)
    sys += `\n\nWorker profile:\n${parts.join('\n')}\n\nAlways personalise your advice to their specific background, skills and certifications.`
  }

  return sys
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { messages, profile } = await req.json()

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        system: buildSystem(profile),
        messages,
      }),
    })

    const json = await res.json()
    const text: string = json.content?.[0]?.text ?? ''

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ text: "I'm having trouble connecting right now. Try again in a moment." }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
