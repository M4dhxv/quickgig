import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUser } from '../_shared/auth.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// After phone verification the user is a NEW (phone) identity. This reassigns
// the session (and its CV) created during the anonymous CV-upload flow to the
// now-verified user, and saves the reviewed profile — all with service role so
// RLS ownership ends up correct.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const gate = await requireUser(req, CORS)
  if (gate instanceof Response) return gate

  try {
    const { sessionId, profile } = await req.json()
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const { error } = await admin.rpc('claim_session', {
      p_session: sessionId,
      p_uid: gate.userId,
      p_profile: profile ?? {},
    })
    if (error) {
      console.error('claim_session error', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ error: 'failed' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
