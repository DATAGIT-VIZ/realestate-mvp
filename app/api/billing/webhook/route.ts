import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { verifyWebhookSignature } from '@/lib/razorpay'

export const runtime = 'nodejs'

function planFromNotes(notes: Record<string, string> | null): string {
  return notes?.plan ?? 'pro'
}

export async function POST(req: NextRequest) {
  const rawBody  = await req.text()
  const sig      = req.headers.get('x-razorpay-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { event: string; payload: Record<string, unknown> }
  try { event = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ ok: true }) // no-op if DB not configured

  const eventType = event.event
  const payload   = event.payload as Record<string, Record<string, unknown>>

  // Helper to extract subscription entity
  const getSub = () => payload?.subscription?.entity as Record<string, unknown> | undefined
  const getPmt = () => payload?.payment?.entity      as Record<string, unknown> | undefined

  const sub   = getSub()
  const pmt   = getPmt()

  const rzpSubId = (sub?.id ?? pmt?.subscription_id) as string | undefined
  const userId   = (sub?.notes as Record<string, string> | null)?.user_id ??
                   (pmt?.notes as Record<string, string> | null)?.user_id

  // Log every event
  try {
    await sb.from('billing_events').insert({
      user_id:                  userId ?? null,
      event_type:               eventType,
      razorpay_payment_id:      pmt?.id as string ?? null,
      razorpay_subscription_id: rzpSubId ?? null,
      amount:                   pmt?.amount as number ?? null,
      plan:                     planFromNotes((sub?.notes ?? pmt?.notes) as Record<string, string> | null),
      payload:                  event.payload,
    })
  } catch (e) { console.error('[billing_events insert]', e) }

  if (!userId || !rzpSubId) {
    return NextResponse.json({ ok: true })
  }

  const now = new Date().toISOString()

  switch (eventType) {
    case 'subscription.activated': {
      await sb.from('subscriptions').upsert({
        user_id:                  userId,
        plan:                     planFromNotes(sub?.notes as Record<string, string> | null),
        status:                   'active',
        razorpay_subscription_id: rzpSubId,
        current_period_start:     sub?.current_start ? new Date((sub.current_start as number) * 1000).toISOString() : null,
        current_period_end:       sub?.current_end   ? new Date((sub.current_end   as number) * 1000).toISOString() : null,
        cancel_at_period_end:     false,
        cancelled_at:             null,
        updated_at:               now,
      }, { onConflict: 'user_id' })
      break
    }

    case 'subscription.charged': {
      await sb.from('subscriptions').update({
        status:              'active',
        current_period_start: sub?.current_start ? new Date((sub.current_start as number) * 1000).toISOString() : null,
        current_period_end:   sub?.current_end   ? new Date((sub.current_end   as number) * 1000).toISOString() : null,
        updated_at:           now,
      }).eq('razorpay_subscription_id', rzpSubId)
      break
    }

    case 'subscription.pending':
    case 'subscription.halted': {
      await sb.from('subscriptions').update({
        status:     'past_due',
        updated_at: now,
      }).eq('razorpay_subscription_id', rzpSubId)
      break
    }

    case 'subscription.cancelled': {
      await sb.from('subscriptions').update({
        status:       'cancelled',
        cancelled_at: now,
        updated_at:   now,
      }).eq('razorpay_subscription_id', rzpSubId)
      break
    }

    case 'subscription.completed': {
      await sb.from('subscriptions').update({
        status:     'cancelled',
        updated_at: now,
      }).eq('razorpay_subscription_id', rzpSubId)
      break
    }
  }

  return NextResponse.json({ ok: true })
}
