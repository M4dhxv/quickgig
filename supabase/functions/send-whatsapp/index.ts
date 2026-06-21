import { requireUser } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Sends a WhatsApp message via Twilio. Set these function secrets to enable:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//   and one sender: TWILIO_WHATSAPP_FROM (e.g. "whatsapp:+1...") OR
//                   TWILIO_WHATSAPP_MESSAGING_SERVICE_SID
//   optional: TWILIO_WHATSAPP_TEMPLATE_SID (approved Content template; uses var {{1}}=name)
// Until configured it no-ops cleanly so callers (fire-and-forget) never break.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const gate = await requireUser(req, CORS); if (gate instanceof Response) return gate

  const ok = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const { phone, name, text } = await req.json()
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const from = Deno.env.get('TWILIO_WHATSAPP_FROM')
    const msgService = Deno.env.get('TWILIO_WHATSAPP_MESSAGING_SERVICE_SID')
    const templateSid = Deno.env.get('TWILIO_WHATSAPP_TEMPLATE_SID')
    // Auth: prefer an API Key (SID+Secret); fall back to the account Auth Token.
    const keySid = Deno.env.get('TWILIO_API_KEY_SID')
    const keySecret = Deno.env.get('TWILIO_API_KEY_SECRET')
    const authUser = keySid || sid
    const authPass = keySecret || Deno.env.get('TWILIO_AUTH_TOKEN')

    if (!sid || !authUser || !authPass || (!from && !msgService)) {
      return ok({ sent: false, skipped: 'twilio_whatsapp_not_configured' })
    }
    if (!phone) return ok({ sent: false, error: 'no phone' })

    const to = `whatsapp:${String(phone).startsWith('+') ? phone : '+' + phone}`
    const params = new URLSearchParams()
    params.set('To', to)
    if (msgService) params.set('MessagingServiceSid', msgService)
    else params.set('From', from!)

    if (templateSid) {
      params.set('ContentSid', templateSid)
      params.set('ContentVariables', JSON.stringify({ '1': name || 'there' }))
    } else {
      params.set('Body', text || `Hi ${name || 'there'} — you're all set on GigNearby. We'll WhatsApp you jobs near you the moment they open, so you're first in line. Reply STOP to opt out.`)
    }

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${authUser}:${authPass}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('twilio whatsapp error', res.status, data?.message)
      return ok({ sent: false, error: data?.message ?? 'twilio error' })
    }
    return ok({ sent: true, sid: data.sid, status: data.status })
  } catch (e) {
    console.error('send-whatsapp error', e)
    return ok({ sent: false, error: 'failed' })
  }
})
