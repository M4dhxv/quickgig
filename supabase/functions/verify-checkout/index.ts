import Stripe from 'https://esm.sh/stripe@14'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' })
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { csId, sessionId } = await req.json()
    if (!csId) {
      return new Response(JSON.stringify({ active: false, error: 'No checkout id' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Get calling user from their JWT
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: { user } } = await admin.auth.getUser(token)
    const userId = user?.id

    // Confirm payment with Stripe
    const cs = await stripe.checkout.sessions.retrieve(csId)
    const paid = cs.payment_status === 'paid' || cs.status === 'complete'

    if (!paid) {
      return new Response(JSON.stringify({ active: false }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const sid = sessionId || cs.metadata?.sessionId
    if (sid) {
      await admin.from('sessions').update({
        plan: 'active',
        stripe_customer_id: cs.customer as string,
        stripe_subscription_id: cs.subscription as string,
      }).eq('id', sid)

      // Fire seed-jobs to fetch job pool and send first WhatsApp immediately
      if (userId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        fetch(`${supabaseUrl}/functions/v1/seed-jobs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, userId }),
        }).catch(e => console.error('seed-jobs fire failed:', e))
      }
    }

    return new Response(JSON.stringify({ active: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ active: false, error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
