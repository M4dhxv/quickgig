const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const PROMPT = `You are a CV parser. Extract a structured profile from the CV text provided.
Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "name": "Full Name",
  "currentRole": "Most recent job title",
  "location": "City or region",
  "phone": "Phone number or empty string",
  "email": "Email address or empty string",
  "summary": "1-2 sentence professional summary",
  "skills": ["skill1", "skill2"],
  "certifications": ["cert1", "cert2"],
  "experience": [
    { "role": "Job Title", "company": "Company", "duration": "e.g. Mar 2020 - Present" }
  ]
}
If the CV text is garbled or empty, infer reasonable details from the filename. Return only the JSON object.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { fileName, text } = await req.json()

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        system: PROMPT,
        messages: [{
          role: 'user',
          content: `CV filename: ${fileName}\n\nCV content:\n${(text ?? '').slice(0, 2500)}`,
        }],
      }),
    })

    const json = await res.json()
    const raw = (json.content?.[0]?.text ?? '{}')
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const profile = JSON.parse(raw)
    return new Response(JSON.stringify({ profile }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({
      profile: { name: '', currentRole: '', location: '', phone: '', email: '', summary: '', skills: [], certifications: [], experience: [] },
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
