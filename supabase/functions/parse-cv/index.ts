import JSZip from 'https://esm.sh/jszip@3.10.1'

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

const EMPTY = { name: '', currentRole: '', location: '', phone: '', email: '', summary: '', skills: [], certifications: [], experience: [] }

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
}

// A .docx is a ZIP archive; the body text lives in word/document.xml inside
// <w:t> runs, with paragraphs delimited by <w:p>. The Anthropic document
// block only accepts PDFs, so for Word docs we extract the text ourselves.
async function docxToText(base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const zip = await JSZip.loadAsync(bytes)
  const file = zip.file('word/document.xml')
  if (!file) return ''
  const xml = await file.async('string')
  const text = xml
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function looksLikePdf(base64: string, mediaType?: string, fileName?: string): boolean {
  if (mediaType === 'application/pdf') return true
  if (fileName?.toLowerCase().endsWith('.pdf')) return true
  return base64.startsWith('JVBERi') // "%PDF"
}

function looksLikeDocx(base64: string, mediaType?: string, fileName?: string): boolean {
  if (mediaType?.includes('wordprocessingml')) return true
  if (fileName?.toLowerCase().endsWith('.docx')) return true
  return base64.startsWith('UEsD') // "PK\x03\x04" — ZIP header
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { fileName, base64, mediaType } = await req.json()

    const content: unknown[] = []

    if (base64 && looksLikeDocx(base64, mediaType, fileName)) {
      // Word doc → extract text and send as plain text
      let text = ''
      try { text = await docxToText(base64) } catch (e) { console.error('docx extract failed:', e) }
      if (text) {
        content.push({ type: 'text', text: `CV contents (extracted from Word document):\n\n${text}` })
      }
    } else if (base64 && looksLikePdf(base64, mediaType, fileName)) {
      // PDF → native document block
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
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
        max_tokens: 1500,
        system: PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('anthropic error', res.status, errText)
      return new Response(JSON.stringify({ profile: EMPTY, error: `anthropic ${res.status}` }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const json = await res.json()
    const raw = (json.content?.[0]?.text ?? '{}')
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let profile
    try {
      profile = JSON.parse(raw)
    } catch (e) {
      console.error('profile JSON parse failed. raw:', raw.slice(0, 300))
      profile = EMPTY
    }
    return new Response(JSON.stringify({ profile }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('parse-cv error:', e)
    return new Response(JSON.stringify({ profile: EMPTY }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
