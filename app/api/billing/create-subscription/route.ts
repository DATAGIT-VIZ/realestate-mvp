import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createSubscription, PLANS, razorpayConfigured } from '@/lib/razorpay'
import type { PlanId } from '@/lib/razorpay'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  if (!razorpayConfigured()) {
    return NextResponse.json(
      { data: null, error: 'Razorpay not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local' },
      { status: 503 }
    )
  }

  const body                     = await req.json()
  const planId = body.plan as PlanId

  if (!planId || planId === 'free') {
    return NextResponse.json({ data: null, error: 'Invalid plan' }, { status: 400 })
  }

  const plan = PLANS[planId]
  if (!('razorpayPlanId' in plan)) {
    return NextResponse.json({ data: null, error: 'Plan not available' }, { status: 400 })
  }

  const rzpPlanId = plan.razorpayPlanId()
  if (!rzpPlanId) {
    return NextResponse.json(
      { data: null, error: `RAZORPAY_PLAN_${planId.toUpperCase()}_MONTHLY not set` },
      { status: 503 }
    )
  }

  try {
    const sub = await createSubscription(rzpPlanId, {
      user_id: userId!,
      plan:    planId,
    })

    return NextResponse.json({
      data: {
        subscriptionId: sub.id,
        keyId:          process.env.RAZORPAY_KEY_ID,
        planLabel:      plan.label,
        amount:         plan.price,
      },
      error: null,
    })
  } catch (err) {
    console.error('[POST /api/billing/create-subscription]', err)
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
