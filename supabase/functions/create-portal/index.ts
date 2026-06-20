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
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', sessionId)
    .single()

  if (!data?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'No subscription found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Resolve the subscription so we can deep-link to the cancel flow.
  // (The inline "Cancel plan" link doesn't render reliably when plan-switching
  // is disabled, so we send the user straight to the cancellation screen.)
  let subId = (data.stripe_subscription_id as string | null) ?? null
  if (!subId) {
    const subs = await stripe.subscriptions.list({ customer: data.stripe_customer_id, status: 'active', limit: 1 })
    subId = subs.data[0]?.id ?? null
  }

  // Only deep-link to cancel if the sub is actually cancellable — Stripe rejects
  // a cancel flow for a subscription that's already set to cancel_at_period_end
  // or is no longer active. Otherwise open the normal portal (where they can
  // renew / manage payment).
  let canCancel = false
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      canCancel = (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') && !sub.cancel_at_period_end
    } catch { canCancel = false }
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/dashboard`,
    ...(canCancel && subId
      ? { flow_data: { type: 'subscription_cancel', subscription_cancel: { subscription: subId } } }
      : {}),
  })

  return new Response(JSON.stringify({ url: portal.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
