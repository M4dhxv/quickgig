import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adzunaDigest } from '../_shared/digest.ts'
import { sendJobAlert, buildVars } from '../_shared/whatsapp.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const MIN_HOURS = 20   // minimum gap between alerts (~daily)
const DAILY_SEND = 2   // jobs per send
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://www.gignearby.com').replace(/\/$/, '')

Deno.serve(async (req) => {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 401 })

  const cutoff = new Date(Date.now() - MIN_HOURS * 3600 * 1000).toISOString()
  const { data: users } = await admin
    .from('sessions')
    .select('id, profile, last_alert_at, user_id')
    .eq('plan', 'active')
    .not('user_id', 'is', null)
    .or(`last_alert_at.is.null,last_alert_at.lt.${cutoff}`)
    .limit(500)

  let sent = 0
  for (const u of users ?? []) {
    const p = (u.profile ?? {}) as Record<string, string>

    // Always use verified E.164 phone from Supabase Auth — never profile.phone
    const { data: { user: authUser } } = await admin.auth.admin.getUserById(u.user_id)
    const phone = authUser?.phone
    if (!phone) continue

    // Pick DAILY_SEND unsent jobs from saved pool
    const { data: pool } = await admin
      .from('user_jobs')
      .select('id, title, company, url, location')
      .eq('session_id', u.id)
      .is('sent_at', null)
      .order('created_at')
      .limit(DAILY_SEND)

    let jobs: { id: string; title: string; company: string; url: string; location: string }[] = pool ?? []

    // Pool exhausted — refill from Adzuna
    if (jobs.length < DAILY_SEND && p.location) {
      const { jobs: fresh } = await adzunaDigest(p.location, 20)
      if (fresh.length > 0) {
        // Insert into job_results first to get share UUIDs
        const { data: jobResults } = await admin.from('job_results').insert(
          fresh.map(j => ({
            session_id:   u.id,
            user_id:      u.user_id,
            adzuna_id:    j.adzunaId,
            title:        j.title,
            company:      j.company,
            location:     j.location,
            redirect_url: j.redirectUrl,
            is_shared:    true,
          }))
        ).select('id, title, company, location')
        const { data: refilled } = await admin.from('user_jobs').insert(
          (jobResults ?? []).map((r: any) => ({
            session_id: u.id,
            user_id:    u.user_id,
            title:      r.title,
            company:    r.company,
            location:   r.location,
            url:        `${APP_URL}/jobs/${r.id}`,
          }))
        ).select('id, title, company, url, location')
        jobs = (refilled ?? []).slice(0, DAILY_SEND)
      }
    }

    if (jobs.length === 0) continue

    const ok = await sendJobAlert(phone, buildVars({
      name: p.name, role: p.currentRole, location: p.location, jobs, appUrl: APP_URL,
    }))

    if (ok) {
      sent++
      await admin.from('user_jobs').update({ sent_at: new Date().toISOString() }).in('id', jobs.map(j => j.id))
      await admin.from('sessions').update({ last_alert_at: new Date().toISOString() }).eq('id', u.id)
    }
  }

  return new Response(JSON.stringify({ ran: true, due: (users ?? []).length, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
