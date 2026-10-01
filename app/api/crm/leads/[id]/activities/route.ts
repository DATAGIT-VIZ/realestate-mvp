import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import { recalcLeadScore } from '@/lib/leadScore'
import { resolveLeadState } from '@/lib/resolveLeadState'

export type ActivityType =
  | 'Call Made'
  | 'Call Missed'
  | 'WhatsApp Sent'
  | 'WhatsApp Received'
  | 'Email Sent'
  | 'Email Received'
  | 'VM Done'
  | 'OBM Done'
  | 'Site Visit Scheduled'
  | 'Site Visit Done'
  | 'EOI Received'
  | 'Deal Closed'
  | 'Follow Up Set'
  | 'Hold'
  | 'Note'
  | 'Status Changed'

export type ActivityPayload = {
  type: ActivityType
  notes?: string
  outcome?: string
  duration?: number
  nextActionDate?: string
  // Status Changed
  reason?: string
  // Hold
  hold_until?: string
  hold_reason?: string
  // Structured call logging
  callOutcome?: 'connected' | 'nca' | 'invalid_number' | null
  disposition?: string | null
  ncaAttempt?: number | null
  checklist?: {
    contactMade?: boolean
    requirements?: boolean
    brochure?: boolean
    propertyAssigned?: boolean
    svBooked?: boolean
  } | null
  metadata?: Record<string, unknown>
}

type RouteCtx = { params: Promise<{ id: string }> }

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'

// ─── GET /api/crm/leads/[id]/activities ──────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: RouteCtx
) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Database not configured' }, { status: 503 })

  const isDevBypass = userId === DEV_AGENT

  try {
    const { id } = await params

    let leadQ = sb.from('leads').select('id').eq('id', id)
    if (!isDevBypass) leadQ = leadQ.eq('agent_id', userId!)
    const { data: lead, error: leadErr } = await leadQ.single()
    if (leadErr || !lead) {
      return NextResponse.json({ data: null, error: 'Lead not found' }, { status: 404 })
    }

    const { data: rows, error } = await sb
      .from('lead_activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })

    const activities = (rows ?? []).map(a => {
      const d = (a.activity_data as Record<string, unknown>) ?? {}
      return {
        id:             a.id,
        type:           a.activity_type,
        createdAt:      a.created_at,
        notes:          (d.notes          as string | null) ?? null,
        outcome:        (d.outcome        as string | null) ?? null,
        duration:       (d.duration       as number | null) ?? null,
        nextActionDate: (d.nextActionDate as string | null) ?? null,
      }
    })

    return NextResponse.json({ data: { activities, totalCount: activities.length }, error: null })
  } catch (err) {
    console.error('[GET /api/crm/leads/[id]/activities]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch activities' }, { status: 500 })
  }
}

// ─── POST /api/crm/leads/[id]/activities ─────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: RouteCtx
) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Database not configured' }, { status: 503 })

  const isDevBypass = userId === DEV_AGENT

  try {
    const { id } = await params
    const body: ActivityPayload = await req.json()

    if (!body.type) {
      return NextResponse.json({ data: null, error: 'activity type is required' }, { status: 400 })
    }

    // Fetch current lead state
    let leadQ = sb
      .from('leads')
      .select('id, status, failed_contact_attempts, hold_previous_status')
      .eq('id', id)
    if (!isDevBypass) leadQ = leadQ.eq('agent_id', userId!)
    const { data: lead, error: leadErr } = await leadQ.single()
    if (leadErr || !lead) {
      return NextResponse.json({ data: null, error: 'Lead not found' }, { status: 404 })
    }

    const currentStatus  = (lead.status as string) ?? 'New'
    const failedAttempts = (lead.failed_contact_attempts as number) ?? 0

    // Fetch existing activity types for milestone idempotency check
    const { data: existingActs } = await sb
      .from('lead_activities')
      .select('activity_type')
      .eq('lead_id', id)
    const existingTypes = (existingActs ?? []).map((a: { activity_type: string }) => a.activity_type)

    // Run pure lifecycle engine
    const resolution = resolveLeadState(
      {
        status:                  currentStatus,
        failed_contact_attempts: failedAttempts,
        hold_previous_status:    (lead.hold_previous_status as string | null) ?? null,
        hold_until:              null,
      },
      {
        type:        body.type,
        outcome:     body.outcome    ?? null,
        reason:      body.reason     ?? null,
        hold_until:  body.hold_until  ?? null,
        hold_reason: body.hold_reason ?? null,
      },
      existingTypes,
    )

    if (resolution.blockedReason) {
      return NextResponse.json({ data: null, error: resolution.blockedReason }, { status: 409 })
    }

    const { newStatus, newFailedAttempts, newHoldPreviousStatus, auditNote } = resolution

    // Insert activity
    const { data: act, error: actErr } = await sb
      .from('lead_activities')
      .insert({
        lead_id:       id,
        activity_type: body.type,
        activity_data: {
          notes:          body.notes          ?? null,
          outcome:        body.outcome        ?? null,
          duration:       body.duration       ?? null,
          nextActionDate: body.nextActionDate ?? null,
          reason:         body.reason         ?? null,
          hold_until:     body.hold_until     ?? null,
          hold_reason:    body.hold_reason    ?? null,
          auditNote:      auditNote           ?? null,
          // Structured call logging
          callOutcome:    body.callOutcome    ?? null,
          disposition:    body.disposition    ?? null,
          ncaAttempt:     body.ncaAttempt     ?? null,
          checklist:      body.checklist      ?? null,
          ...(body.metadata ?? {}),
        },
      })
      .select()
      .single()

    if (actErr) {
      console.error('[POST lead_activities insert]', actErr)
      return NextResponse.json({ data: null, error: actErr.message }, { status: 400 })
    }

    // Build lead update patch
    const leadUpdate: Record<string, unknown> = {}
    if (newStatus !== null)             leadUpdate.status                  = newStatus
    if (newFailedAttempts !== null)     leadUpdate.failed_contact_attempts = newFailedAttempts
    if (newHoldPreviousStatus !== null) leadUpdate.hold_previous_status    = newHoldPreviousStatus
    if (body.hold_until)               leadUpdate.hold_until               = body.hold_until
    // Persist latest call disposition for analytics
    if (body.disposition)              leadUpdate.last_disposition         = body.disposition
    if (body.callOutcome)              leadUpdate.last_call_outcome        = body.callOutcome
    // Follow Up Set — persist date on the lead itself
    if (body.type === 'Follow Up Set' && body.nextActionDate) {
      leadUpdate.follow_up_date = body.nextActionDate
    }

    if (Object.keys(leadUpdate).length > 0) {
      await sb.from('leads').update(leadUpdate).eq('id', id)
    }

    // Recalculate intent score asynchronously (fire-and-forget)
    recalcLeadScore(id).catch(() => {})

    // Schedule follow-up notification
    if (body.type === 'Follow Up Set' && body.nextActionDate) {
      const scheduledFor = new Date(body.nextActionDate)
      scheduledFor.setHours(9, 0, 0, 0)
      if (scheduledFor > new Date()) {
        createNotification({
          type: 'follow_up_due',
          title: 'Follow-up reminder',
          body: body.notes ? `Note: ${body.notes}` : 'Follow-up reminder triggered.',
          leadId: id,
          scheduledFor,
        }).catch(() => {})
      }
    }

    const d = (act.activity_data as Record<string, unknown>) ?? {}
    return NextResponse.json(
      {
        data: {
          id:             act.id,
          type:           act.activity_type,
          createdAt:      act.created_at,
          notes:          (d.notes          as string | null) ?? null,
          outcome:        (d.outcome        as string | null) ?? null,
          duration:       (d.duration       as number | null) ?? null,
          nextActionDate: (d.nextActionDate as string | null) ?? null,
          auditNote:      (d.auditNote      as string | null) ?? null,
        },
        statusAdvancedTo:      newStatus         ?? undefined,
        newFailedAttempts:     newFailedAttempts ?? undefined,
        newHoldPreviousStatus: newHoldPreviousStatus ?? undefined,
        error: null,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/crm/leads/[id]/activities]', err)
    return NextResponse.json({ data: null, error: 'Failed to log activity' }, { status: 500 })
  }
}
