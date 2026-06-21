import JSZip from 'https://esm.sh/jszip@3.10.1'
import { requireUser } from '../_shared/auth.ts'

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

function b64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

function decodeText(base64: string): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(b64ToBytes(base64))
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
}

// .docx / .odt are ZIP archives; pull text out of their main XML part.
async function zipDocToText(base64: string, kind: 'docx' | 'odt'): Promise<string> {
  const zip = await JSZip.loadAsync(b64ToBytes(base64))
  const part = kind === 'docx' ? 'word/document.xml' : 'content.xml'
  const file = zip.file(part)
  if (!file) return ''
  const xml = await file.async('string')
  const text = xml
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<text:tab\b[^>]*\/?>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/text:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Strip RTF control words / groups down to plain text.
function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\'[0-9a-fA-F]{2}/g, '')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Last-resort text recovery from a legacy binary .doc — pull printable runs.
function binaryToText(base64: string): string {
  const bytes = b64ToBytes(base64)
  let out = ''
  let run = ''
  for (const b of bytes) {
    if ((b >= 32 && b < 127) || b === 10 || b === 13 || b === 9) {
      run += String.fromCharCode(b)
    } else {
      if (run.length >= 4) out += run + ' '
      run = ''
    }
  }
  if (run.length >= 4) out += run
  return out.replace(/\s{3,}/g, '\n').trim()
}

function ext(fileName?: string): string {
  return (fileName?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]) ?? ''
}

const IMAGE_MEDIA: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const gate = await requireUser(req, CORS); if (gate instanceof Response) return gate

  try {
    const { fileName, base64, mediaType } = await req.json()
    const e = ext(fileName)
    const content: unknown[] = []

    if (base64) {
      if (e === 'pdf' || mediaType === 'application/pdf' || base64.startsWith('JVBERi')) {
        // PDF → native document block
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })

      } else if (IMAGE_MEDIA[e] || (mediaType ?? '').startsWith('image/')) {
        // Image scan/photo of a CV → vision block
        const media = IMAGE_MEDIA[e] ?? mediaType
        content.push({ type: 'image', source: { type: 'base64', media_type: media, data: base64 } })

      } else {
        // Everything else → extract text and send as text
        let text = ''
        try {
          if (e === 'docx' || (mediaType ?? '').includes('wordprocessingml')) {
            text = await zipDocToText(base64, 'docx')
          } else if (e === 'odt' || (mediaType ?? '').includes('opendocument.text')) {
            text = await zipDocToText(base64, 'odt')
          } else if (e === 'rtf' || (mediaType ?? '').includes('rtf')) {
            text = rtfToText(decodeText(base64))
          } else if (e === 'txt' || e === 'md' || (mediaType ?? '').startsWith('text/')) {
            text = decodeText(base64)
          } else if (e === 'doc') {
            text = binaryToText(base64)
          } else {
            // Unknown — try plain text, then a binary salvage
            text = decodeText(base64)
            if (!/[a-zA-Z]{3,}/.test(text)) text = binaryToText(base64)
          }
        } catch (err) { console.error('text extract failed:', err) }

        if (text && text.trim().length > 20) {
          content.push({ type: 'text', text: `CV contents (extracted from ${e || 'file'}):\n\n${text.slice(0, 20000)}` })
        }
      }
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
    try { profile = JSON.parse(raw) }
    catch { console.error('profile JSON parse failed. raw:', raw.slice(0, 300)); profile = EMPTY }

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
