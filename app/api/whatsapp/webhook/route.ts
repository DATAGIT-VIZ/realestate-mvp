/**
 * POST /api/whatsapp/webhook
 *
 * Interakt fires this webhook on message events:
 *   - sent, delivered, read (delivery status updates)
 *   - user reply received
 *
 * Interakt webhook docs: https://developers.interakt.ai/reference/webhooks
 *
 * Configure in Interakt: Settings → Webhooks → URL = https://yourapp.com/api/whatsapp/webhook
 *
 * A reply from a known lead is saved to Supabase as a `WhatsApp Received`
 * activity, so it shows on the lead's timeline and AI Workflows can read it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { normalisePhone } from '@/lib/dedup'
import { resolveLeadState } from '@/lib/resolveLeadState'
import { recalcLeadScore } from '@/lib/leadScore'

// Interakt has sent replies as `user_message` with data.text, and as
// `message_received` with data.message.message. Both are accepted.
type InteraktEvent = {
  type?: string
  data?: {
    customer?: {
      phone_number?: string
      channel_phone_number?: string
      country_code?: string
      name?: string
    }
    text?: string
    message?: {
      id?: string
      status?: string
      message?: string
      text?: string
      message_content_type?: string
    }
  }
}

const REPLY_TYPES = new Set(['user_message', 'message_received'])

function replyOf(event: InteraktEvent) {
  const d = event.data ?? {}
  const phone = d.customer?.phone_number ?? d.customer?.channel_phone_number ?? ''
  const raw   = d.text ?? d.message?.message ?? d.message?.text ?? ''
  const text  = typeof raw === 'string' ? raw.trim() : ''
  return { phone, text, messageId: d.message?.id ?? null }
}

async function saveReply(phone: string, text: string, messageId: string | null) {
  const sb = getAdminClient()
  if (!sb) return
  const last10 = normalisePhone(phone).slice(-10)
  if (last10.length !== 10) return

  // Phones are stored as +91XXXXXXXXXX, but imports can carry other formats
  const { data: leads } = await sb
    .from('leads')
    .select('id, agent_id, status, failed_contact_attempts, hold_previous_status')
    .ilike('phone', `%${last10}`)
    .order('updated_at', { ascending: false })
    .limit(1)
  const lead = leads?.[0]
  if (!lead) return // we don't auto-create leads from a WhatsApp reply

  const { data: existing } = await sb.from('lead_activities').select('activity_type').eq('lead_id', lead.id)
  const resolution = resolveLeadState(
    {
      status:                  (lead.status as string) ?? 'New',
      failed_contact_attempts: (lead.failed_contact_attempts as number) ?? 0,
      hold_previous_status:    (lead.hold_previous_status as string | null) ?? null,
      hold_until:              null,
    },
    { type: 'WhatsApp Received' },
    (existing ?? []).map((a: { activity_type: string }) => a.activity_type),
  )

  // A reply on a Closed or Disqualified lead is still saved, without a stage change
  const changes = resolution.blockedReason ? null : resolution
  await sb.from('lead_activities').insert({
    lead_id:       lead.id,
    agent_id:      lead.agent_id ?? null,
    activity_type: 'WhatsApp Received',
    activity_data: {
      notes:     text,
      outcome:   null,
      auditNote: changes?.auditNote ?? null,
      channel:   'whatsapp',
      from:      phone,
      messageId,
    },
  })

  const update: Record<string, unknown> = { last_activity_date: new Date().toISOString() }
  if (changes?.newStatus)                 update.status                  = changes.newStatus
  if (changes?.newFailedAttempts != null) update.failed_contact_attempts = changes.newFailedAttempts
  await sb.from('leads').update(update).eq('id', lead.id)

  recalcLeadScore(lead.id as string).catch(() => {})
}

export async function POST(req: NextRequest) {
  try {
    const event: InteraktEvent = await req.json()

    // Interakt sends a GET for webhook verification — return 200 with the token
    if (!event || !event.type) {
      return NextResponse.json({ ok: true })
    }

    if (REPLY_TYPES.has(event.type)) {
      const { phone, text, messageId } = replyOf(event)
      if (phone && text) await saveReply(phone, text, messageId)
    }

    // message_status events (sent/delivered/read/failed) — no action needed right now
    // Future: update last known delivery status on the activity record

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/whatsapp/webhook]', err)
    // Always return 200 to Interakt so it doesn't keep retrying
    return NextResponse.json({ ok: true })
  }
}

// Interakt webhook verification: GET with ?hub.challenge=<token>
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new Response(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}
