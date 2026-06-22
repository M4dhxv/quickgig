import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adzunaDigest } from '../_shared/digest.ts'
import { sendJobAlert, buildVars } from '../_shared/whatsapp.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const APP_URL = Deno.env.get('APP_URL') ?? 'https://gignearby.com'

// Internal-only — called by verify-checkout with x-internal-secret header.
Deno.serve(async (req) => {
  const secret = req.headers.get('x-internal-secret')
  if (secret !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 401 })
  }

  const { sessionId, userId } = await req.json()
  if (!sessionId || !userId) return new Response('missing params', { status: 400 })

  // Get session profile
  const { data: session } = await admin
    .from('sessions').select('profile').eq('id', sessionId).single()
  const p = (session?.profile ?? {}) as Record<string, string>

  // Always use the verified E.164 phone from Supabase Auth — never profile.phone
  const { data: { user: authUser } } = await admin.auth.admin.getUserById(userId)
  const phone = authUser?.phone
  if (!phone) {
    console.log('seed-jobs: no verified phone for user', userId)
    return new Response(JSON.stringify({ seeded: 0, sent: false, reason: 'no verified phone' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch 20 matching jobs
  const { jobs } = await adzunaDigest(p.location || '', 20)
  if (jobs.length === 0) {
    return new Response(JSON.stringify({ seeded: 0, sent: false, reason: 'no jobs found' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Save pool to user_jobs
  const { data: inserted } = await admin.from('user_jobs')
    .insert(jobs.map(j => ({ session_id: sessionId, user_id: userId, title: j.title, company: j.company, url: j.url, location: j.location })))
    .select('id, title, company, url, location')

  // Send immediately with top 2
  const top2 = (inserted ?? jobs).slice(0, 2)
  const ok = await sendJobAlert(phone, buildVars({ name: p.name, role: p.currentRole, location: p.location, jobs: top2, appUrl: APP_URL }))

  if (ok && inserted?.length) {
    const toMark = inserted.slice(0, 2).map((r: any) => r.id)
    await admin.from('user_jobs').update({ sent_at: new Date().toISOString() }).in('id', toMark)
    await admin.from('sessions').update({ last_alert_at: new Date().toISOString() }).eq('id', sessionId)
  }

  console.log(`seed-jobs: seeded ${jobs.length}, sent=${ok}, phone=${phone}`)
  return new Response(JSON.stringify({ seeded: jobs.length, sent: ok }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
