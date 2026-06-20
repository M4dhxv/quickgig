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

  const { sessionId } = await req.json()
  const origin = req.headers.get('origin') ?? 'https://quickgig.vercel.app'

  const { data } = await supabase
    .from('sessions')
    .select('stripe_customer_id')
    .eq('id', sessionId)
    .single()

  if (!data?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'No subscription found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/dashboard`,
  })

  return new Response(JSON.stringify({ url: portal.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
