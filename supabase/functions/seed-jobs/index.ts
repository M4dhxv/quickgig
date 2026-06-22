import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adzunaDigest } from '../_shared/digest.ts'
import { sendJobAlert, buildVars } from '../_shared/whatsapp.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://www.gignearby.com').replace(/\/$/, '')

Deno.serve(async (req) => {
  const secret = req.headers.get('x-internal-secret')
  if (secret !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 401 })
  }

  const { sessionId, userId } = await req.json()
  if (!sessionId || !userId) return new Response('missing params', { status: 400 })

  const { data: session } = await admin
    .from('sessions').select('profile').eq('id', sessionId).single()
  const p = (session?.profile ?? {}) as Record<string, string>

  const { data: { user: authUser } } = await admin.auth.admin.getUserById(userId)
  const phone = authUser?.phone
  if (!phone) {
    return new Response(JSON.stringify({ seeded: 0, sent: false, reason: 'no verified phone' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { jobs } = await adzunaDigest(p.location || '', 20)
  if (jobs.length === 0) {
    return new Response(JSON.stringify({ seeded: 0, sent: false, reason: 'no jobs found' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Insert into job_results as shared — this creates the /jobs/:id pages
  const { data: jobResults } = await admin.from('job_results').insert(
    jobs.map(j => ({
      session_id:    sessionId,
      user_id:       userId,
      adzuna_id:     j.adzunaId,
      title:         j.title,
      company:       j.company,
      location:      j.location,
      redirect_url:  j.redirectUrl,
      is_shared:     true,
    }))
  ).select('id, title, company, location')

  // Build user_jobs pool with gignearby share links
  const poolRows = (jobResults ?? []).map((r: any) => ({
    session_id: sessionId,
    user_id:    userId,
    title:      r.title,
    company:    r.company,
    location:   r.location,
    url:        `${APP_URL}/jobs/${r.id}`,
  }))
  const { data: inserted } = await admin.from('user_jobs').insert(poolRows).select('id, title, company, location, url')

  // Send first 2 immediately
  const top2 = (inserted ?? poolRows).slice(0, 2)
  const ok = await sendJobAlert(phone, buildVars({
    name: p.name, role: p.currentRole, location: p.location, jobs: top2, appUrl: APP_URL,
  }))

  if (ok && inserted?.length) {
    await admin.from('user_jobs').update({ sent_at: new Date().toISOString() }).in('id', inserted.slice(0, 2).map((r: any) => r.id))
    await admin.from('sessions').update({ last_alert_at: new Date().toISOString() }).eq('id', sessionId)
  }

  console.log(`seed-jobs: seeded=${jobs.length}, sent=${ok}, phone=${phone}`)
  return new Response(JSON.stringify({ seeded: jobs.length, sent: ok }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
