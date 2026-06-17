const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const PROMPT = `You are a CV parser. Extract a structured profile from the CV provided.
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
If the CV is unreadable, infer reasonable details from the filename. Return only the JSON object.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { fileName, base64, mediaType } = await req.json()

    // Build content array — use PDF document if we have base64, else text fallback
    const content: unknown[] = []
    if (base64) {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: mediaType ?? 'application/pdf',
          data: base64,
        },
      })
    }
    content.push({
      type: 'text',
      text: `CV filename: ${fileName}\nExtract the structured profile from this CV.`,
    })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })

    const json = await res.json()
    const raw = (json.content?.[0]?.text ?? '{}')
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const profile = JSON.parse(raw)
    return new Response(JSON.stringify({ profile }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('parse-cv error:', e)
    return new Response(JSON.stringify({
      profile: { name: '', currentRole: '', location: '', phone: '', email: '', summary: '', skills: [], certifications: [], experience: [] },
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
