import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'
import { fetchInvoices, PLANS, razorpayConfigured } from '@/lib/razorpay'

export async function GET() {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) {
    return NextResponse.json({ data: { plan: 'free', status: 'active', invoices: [] }, error: null })
  }

  const { data: sub } = await sb
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId!)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // No subscription row → free plan
  if (!sub) {
    return NextResponse.json({
      data: {
        plan:    'free',
        status:  'active',
        invoices: [],
        razorpayConfigured: razorpayConfigured(),
      },
      error: null,
    })
  }

  // Fetch invoices from Razorpay if subscription exists
  let invoices: { id: string; date: number; amount_paid: number; status: string; short_url: string }[] = []
  if (sub.razorpay_subscription_id && razorpayConfigured()) {
    try { invoices = await fetchInvoices(sub.razorpay_subscription_id) } catch {}
  }

  return NextResponse.json({
    data: {
      plan:                    sub.plan,
      status:                  sub.status,
      razorpaySubscriptionId:  sub.razorpay_subscription_id,
      currentPeriodStart:      sub.current_period_start,
      currentPeriodEnd:        sub.current_period_end,
      cancelAtPeriodEnd:       sub.cancel_at_period_end,
      cancelledAt:             sub.cancelled_at,
      invoices,
      razorpayConfigured:      razorpayConfigured(),
    },
    error: null,
  })
}
