import { requireUser } from '../_shared/auth.ts'
import { adzunaDigest, digestVars } from '../_shared/digest.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://quickgig.vercel.app'

// Sends a user their first WhatsApp job digest (same approved 4-var template
// the cron uses). No-ops cleanly until Twilio WhatsApp secrets are set.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const gate = await requireUser(req, CORS); if (gate instanceof Response) return gate

  const ok = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const { phone, name, role, location } = await req.json()
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const token = Deno.env.get('TWILIO_AUTH_TOKEN')
    const from = Deno.env.get('TWILIO_WHATSAPP_FROM')
    const template = Deno.env.get('TWILIO_WHATSAPP_ALERT_TEMPLATE_SID')
    if (!sid || !token || !from || !template) return ok({ sent: false, skipped: 'twilio_whatsapp_not_configured' })
    if (!phone) return ok({ sent: false, error: 'no phone' })

    const { jobs } = await adzunaDigest(location ?? '')
    if (jobs.length === 0) return ok({ sent: false, skipped: 'no_jobs_nearby' })

    const body = new URLSearchParams()
    body.set('To', `whatsapp:${String(phone).startsWith('+') ? phone : '+' + phone}`)
    body.set('From', from)
    body.set('ContentSid', template)
    body.set('ContentVariables', JSON.stringify(digestVars({ name, role, location, jobs, appUrl: APP_URL })))

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await res.json()
    if (!res.ok) { console.error('send-whatsapp error', res.status, data?.message); return ok({ sent: false, error: data?.message ?? 'twilio error' }) }
    return ok({ sent: true, sid: data.sid, status: data.status })
  } catch (e) {
    console.error('send-whatsapp error', e)
    return ok({ sent: false, error: 'failed' })
  }
})
