import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' })

// Only our real plans can be checked out — stops arbitrary/probe price IDs.
const ALLOWED_PRICES = new Set([
  'price_1TjbbqCX4iU4nm420REMahwK', // Weekly $7.99/week
  'price_1TjbcsCX4iU4nm425XmOflkS', // Monthly $19.99/month
])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { priceId, sessionId, email } = await req.json()
    const origin = req.headers.get('origin') ?? 'https://quickgig.vercel.app'

    if (!ALLOWED_PRICES.has(priceId)) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?payment=success&session_id=${sessionId ?? ''}&cs_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/dashboard?session_id=${sessionId ?? ''}`,
      customer_email: email ?? undefined,
      metadata: { sessionId: sessionId ?? '' },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
