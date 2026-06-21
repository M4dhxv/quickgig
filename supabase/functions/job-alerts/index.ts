import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adzunaDigest, digestVars } from '../_shared/digest.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Per-user minimum gap between alerts. Cron runs daily; this controls cadence.
// 20h ≈ daily. Change to 44 for every-other-day.
const MIN_HOURS = 20
const APP_URL = Deno.env.get('APP_URL') ?? 'https://quickgig.vercel.app'

async function sendTemplate(toPhone: string, vars: Record<string, string>): Promise<boolean> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM')
  const template = Deno.env.get('TWILIO_WHATSAPP_ALERT_TEMPLATE_SID')
  if (!sid || !token || !from || !template) return false  // no-op until configured
  const body = new URLSearchParams()
  body.set('To', `whatsapp:${toPhone.startsWith('+') ? toPhone : '+' + toPhone}`)
  body.set('From', from)
  body.set('ContentSid', template)
  body.set('ContentVariables', JSON.stringify(vars))
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) { console.error('alert send failed', await res.text()); return false }
  return true
}

Deno.serve(async (req) => {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 401 })

  const cutoff = new Date(Date.now() - MIN_HOURS * 3600 * 1000).toISOString()
  const { data: users } = await admin
    .from('sessions')
    .select('id, profile, last_alert_at')
    .eq('plan', 'active')
    .or(`last_alert_at.is.null,last_alert_at.lt.${cutoff}`)
    .limit(500)

  let eligible = 0, sent = 0
  for (const u of users ?? []) {
    const p = (u.profile ?? {}) as Record<string, string>
    if (!p.phone || !p.location) continue
    eligible++

    const { jobs } = await adzunaDigest(p.location)
    if (jobs.length === 0) continue  // never send an empty digest

    const ok = await sendTemplate(p.phone, digestVars({ name: p.name, role: p.currentRole, location: p.location, jobs, appUrl: APP_URL }))
    if (ok) sent++
    await admin.from('sessions').update({ last_alert_at: new Date().toISOString() }).eq('id', u.id)
  }

  return new Response(JSON.stringify({ ran: true, due: (users ?? []).length, eligible, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
