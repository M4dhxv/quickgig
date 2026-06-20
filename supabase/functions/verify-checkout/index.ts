import Stripe from 'https://esm.sh/stripe@14'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' })
const supabase = createClient(
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

    // Confirm the payment directly with Stripe — no webhook required.
    const cs = await stripe.checkout.sessions.retrieve(csId)
    const paid = cs.payment_status === 'paid' || cs.status === 'complete'

    if (!paid) {
      return new Response(JSON.stringify({ active: false }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const sid = sessionId || cs.metadata?.sessionId
    if (sid) {
      await supabase.from('sessions').update({
        plan: 'active',
        stripe_customer_id: cs.customer as string,
        stripe_subscription_id: cs.subscription as string,
      }).eq('id', sid)
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
