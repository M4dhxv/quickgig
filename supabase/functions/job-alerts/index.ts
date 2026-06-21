import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Per-user minimum gap between alerts. Cron runs daily; this controls cadence.
// 20h ≈ daily. Change to 44 for every-other-day.
const MIN_HOURS = 20
const APP_URL = Deno.env.get('APP_URL') ?? 'https://quickgig.vercel.app'

async function adzunaNearby(where: string): Promise<{ count: number; titles: string[] }> {
  const id = Deno.env.get('ADZUNA_APP_ID')
  const key = Deno.env.get('ADZUNA_APP_KEY')
  if (!id || !key) return { count: 0, titles: [] }
  const city = where.split(',')[0].trim()
  const params = new URLSearchParams({
    app_id: id, app_key: key, results_per_page: '5', where: city,
    what: 'warehouse retail care logistics delivery cleaning hospitality',
    sort_by: 'date', max_days_old: '3',
  })
  try {
    const res = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`)
    if (!res.ok) return { count: 0, titles: [] }
    const d = await res.json()
    return { count: d.count ?? 0, titles: (d.results ?? []).slice(0, 3).map((j: any) => j.title).filter(Boolean) }
  } catch { return { count: 0, titles: [] } }
}

async function sendWhatsApp(toPhone: string, vars: Record<string, string>): Promise<boolean> {
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
  // Only the scheduler (with the shared secret) can trigger this.
  const secret = req.headers.get('x-cron-secret')
  if (secret !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 401 })
  }

  const cutoff = new Date(Date.now() - MIN_HOURS * 3600 * 1000).toISOString()
  // Paid users due for an alert.
  const { data: users } = await admin
    .from('sessions')
    .select('id, profile, last_alert_at')
    .eq('plan', 'active')
    .or(`last_alert_at.is.null,last_alert_at.lt.${cutoff}`)
    .limit(500)

  let eligible = 0, sent = 0
  for (const u of users ?? []) {
    const p = (u.profile ?? {}) as Record<string, string>
    const phone = p.phone, loc = p.location
    if (!phone || !loc) continue
    eligible++

    const { count, titles } = await adzunaNearby(loc)
    if (count === 0 || titles.length === 0) continue  // don't send an empty digest

    const ok = await sendWhatsApp(phone, {
      '1': (p.name || 'there').split(' ')[0],
      '2': String(count),
      '3': titles.slice(0, 2).join(', '),
      '4': APP_URL,
    })
    if (ok) sent++
    // Stamp regardless of send success-vs-skip so we respect cadence and don't spin.
    await admin.from('sessions').update({ last_alert_at: new Date().toISOString() }).eq('id', u.id)
  }

  return new Response(JSON.stringify({ ran: true, due: (users ?? []).length, eligible, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
