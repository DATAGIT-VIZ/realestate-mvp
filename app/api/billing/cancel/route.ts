import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'
import { cancelSubscription, razorpayConfigured } from '@/lib/razorpay'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'DB not configured' }, { status: 503 })

  const { immediately = false } = await req.json().catch(() => ({}))

  const { data: sub } = await sb
    .from('subscriptions')
    .select('razorpay_subscription_id, plan')
    .eq('user_id', userId!)
    .eq('status', 'active')
    .single()

  if (!sub?.razorpay_subscription_id) {
    return NextResponse.json({ data: null, error: 'No active subscription found' }, { status: 404 })
  }

  if (razorpayConfigured()) {
    try {
      await cancelSubscription(sub.razorpay_subscription_id, !immediately)
    } catch (err) {
      console.error('[cancel] Razorpay cancel failed:', err)
    }
  }

  // Update Supabase immediately so UI reflects cancellation
  await sb.from('subscriptions').update({
    cancel_at_period_end: !immediately,
    cancelled_at:         immediately ? new Date().toISOString() : null,
    status:               immediately ? 'cancelled' : 'active',
    updated_at:           new Date().toISOString(),
  }).eq('user_id', userId!).eq('razorpay_subscription_id', sub.razorpay_subscription_id)

  return NextResponse.json({ data: { cancelled: true, immediately }, error: null })
}
