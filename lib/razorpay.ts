import crypto from 'crypto'

const KEY_ID     = () => process.env.RAZORPAY_KEY_ID!
const KEY_SECRET = () => process.env.RAZORPAY_KEY_SECRET!

const AUTH = () => `Basic ${Buffer.from(`${KEY_ID()}:${KEY_SECRET()}`).toString('base64')}`
const BASE  = 'https://api.razorpay.com/v1'

export function razorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id:          'free',
    label:       'Free',
    price:       0,
    priceLabel:  '₹0',
    period:      'forever',
    color:       '#64748B',
    features:    ['Up to 50 leads', 'Basic CRM', 'Call logging', 'Calculators'],
    limits:      { leads: 50, agents: 1 },
  },
  pro: {
    id:          'pro',
    label:       'Pro',
    price:       249900, // paise = ₹2,499
    priceLabel:  '₹2,499',
    period:      'per month',
    color:       '#2563EB',
    razorpayPlanId: () => process.env.RAZORPAY_PLAN_PRO_MONTHLY ?? '',
    features:    [
      'Unlimited leads',
      'AI Follow-up Writer',
      'AI Property Matcher',
      'Exotel Click-to-Call',
      'Bulk WhatsApp Broadcast',
      'Outreach Sequences',
      'Advanced Analytics',
    ],
    limits:      { leads: -1, agents: 1 },
  },
  team: {
    id:          'team',
    label:       'Team',
    price:       599900, // paise = ₹5,999
    priceLabel:  '₹5,999',
    period:      'per month',
    color:       '#7C3AED',
    razorpayPlanId: () => process.env.RAZORPAY_PLAN_TEAM_MONTHLY ?? '',
    features:    [
      'Everything in Pro',
      'Up to 5 agents',
      'Team analytics',
      'Shared lead pool',
      'Priority support',
      'Custom integrations',
    ],
    limits:      { leads: -1, agents: 5 },
  },
} as const

export type PlanId = keyof typeof PLANS

// ─── Razorpay REST helpers ────────────────────────────────────────────────────

export async function createSubscription(planId: string, notes: Record<string, string> = {}) {
  const res = await fetch(`${BASE}/subscriptions`, {
    method:  'POST',
    headers: { Authorization: AUTH(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id:      planId,
      total_count:  12,    // 12 billing cycles (1 year); Razorpay auto-renews after
      quantity:     1,
      notes,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Razorpay createSubscription failed: ${err}`)
  }
  return res.json() as Promise<{ id: string; status: string; short_url: string }>
}

export async function cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true) {
  const res = await fetch(`${BASE}/subscriptions/${subscriptionId}/cancel`, {
    method:  'POST',
    headers: { Authorization: AUTH(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Razorpay cancelSubscription failed: ${err}`)
  }
  return res.json()
}

export async function fetchSubscription(subscriptionId: string) {
  const res = await fetch(`${BASE}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: AUTH() },
  })
  if (!res.ok) throw new Error(`Razorpay fetchSubscription failed: ${res.status}`)
  return res.json()
}

export async function fetchInvoices(subscriptionId: string) {
  const res = await fetch(`${BASE}/invoices?subscription_id=${subscriptionId}&count=12`, {
    headers: { Authorization: AUTH() },
  })
  if (!res.ok) return []
  const json = await res.json()
  return (json.items ?? []) as {
    id: string; date: number; amount_paid: number; status: string; short_url: string
  }[]
}

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return true // skip in dev if not set
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return expected === signature
}
