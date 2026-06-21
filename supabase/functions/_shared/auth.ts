import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type Cors = Record<string, string>

async function userFromReq(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data.user ?? null
}

// Requires a real signed-in app user (anonymous-auth counts). Blocks raw
// curl/abuse that only carries the public apikey. Returns a Response on failure.
export async function requireUser(req: Request, cors: Cors): Promise<{ userId: string } | Response> {
  const user = await userFromReq(req)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Sign in required' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  return { userId: user.id }
}

// Requires the user to have an active paid plan on one of their sessions.
export async function requirePaid(req: Request, cors: Cors): Promise<{ userId: string } | Response> {
  const res = await requireUser(req, cors)
  if (res instanceof Response) return res
  const { data } = await admin
    .from('sessions')
    .select('id')
    .eq('user_id', res.userId)
    .eq('plan', 'active')
    .limit(1)
  if (!data || data.length === 0) {
    return new Response(JSON.stringify({ error: 'Active plan required', code: 'plan_required' }), {
      status: 402, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  return res
}
