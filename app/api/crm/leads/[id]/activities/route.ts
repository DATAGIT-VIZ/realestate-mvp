import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'

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
  | 'Note'
  | 'Status Changed'

export type ActivityPayload = {
  type: ActivityType
  notes?: string
  outcome?: string
  duration?: number
  nextActionDate?: string
  metadata?: Record<string, unknown>
}

type RouteCtx = { params: Promise<{ id: string }> }

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'

// ─── Lifecycle engine ─────────────────────────────────────────────────────────

// Forward-only progression order (terminals handled separately)
const STATUS_ORDER = ['New', 'Cold', 'Warm', 'Hot', 'Closed']

// Which status an activity unlocks (minimum target)
const ACTIVITY_ADVANCES: Partial<Record<ActivityType, string>> = {
  'Call Made':         'Cold',
  'Call Missed':       'Cold',
  'WhatsApp Sent':     'Cold',
  'WhatsApp Received': 'Cold',
  'Email Sent':        'Cold',
  'VM Done':           'Warm',
  'OBM Done':          'Warm',
  'Site Visit Done':   'Warm',
  'EOI Received':      'Hot',
  'Deal Closed':       'Closed',
}

// Milestone activities — can only be logged once per lead
const MILESTONES: ActivityType[] = ['VM Done', 'OBM Done', 'Site Visit Done', 'EOI Received', 'Deal Closed']

// Failed-contact activities: outcome 'No Response' increments the NC counter
const NC_ACTIVITY_TYPES: ActivityType[] = ['Call Made', 'Call Missed']

async function applyLifecycleRules(
  sb: ReturnType<typeof getAdminClient>,
  leadId: string,
  currentStatus: string,
  failedAttempts: number,
  activity: ActivityPayload,
  existingTypes: string[],
): Promise<{ newStatus: string | null; newFailedAttempts: number | null; blockedReason: string | null }> {

  // Block repeated milestones
  if (MILESTONES.includes(activity.type) && existingTypes.includes(activity.type)) {
    return { newStatus: null, newFailedAttempts: null, blockedReason: `${activity.type} has already been logged for this lead` }
  }

  // Don't advance if lead is already terminal
  if (currentStatus === 'Disqualified' || currentStatus === 'Closed') {
    return { newStatus: null, newFailedAttempts: null, blockedReason: null }
  }

  let newStatus: string | null = null
  let newFailedAttempts: number | null = null

  // NC tracking — increment on No Response calls
  if (NC_ACTIVITY_TYPES.includes(activity.type) && activity.outcome === 'No Response') {
    const nextCount = failedAttempts + 1
    newFailedAttempts = nextCount
    if (nextCount >= 5) {
      // Auto-disqualify after 5 failed contact attempts
      newStatus = 'Disqualified'
      return { newStatus, newFailedAttempts, blockedReason: null }
    }
  }

  // Determine target status from the activity
  const targetStatus = ACTIVITY_ADVANCES[activity.type]
  if (!targetStatus) return { newStatus, newFailedAttempts, blockedReason: null }

  const currentIdx = STATUS_ORDER.indexOf(currentStatus)
  const targetIdx  = STATUS_ORDER.indexOf(targetStatus)

  // Only advance forward — never regress
  if (targetIdx > currentIdx) {
    newStatus = targetStatus
  }

  return { newStatus, newFailedAttempts, blockedReason: null }
}

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
    if (!isDevBypass) leadQ = leadQ.or(`agent_id.is.null,agent_id.eq.${userId}`)
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

    // Fetch current lead state for lifecycle engine
    let leadQ = sb
      .from('leads')
      .select('id, status, failed_contact_attempts')
      .eq('id', id)
    if (!isDevBypass) leadQ = leadQ.or(`agent_id.is.null,agent_id.eq.${userId}`)
    const { data: lead, error: leadErr } = await leadQ.single()
    if (leadErr || !lead) {
      return NextResponse.json({ data: null, error: 'Lead not found' }, { status: 404 })
    }

    const currentStatus   = (lead.status as string) ?? 'New'
    const failedAttempts  = (lead.failed_contact_attempts as number) ?? 0

    // Fetch existing activity types for milestone idempotency check
    const { data: existingActs } = await sb
      .from('lead_activities')
      .select('activity_type')
      .eq('lead_id', id)
    const existingTypes = (existingActs ?? []).map((a: any) => a.activity_type as string)

    // Run lifecycle engine
    const { newStatus, newFailedAttempts, blockedReason } = await applyLifecycleRules(
      sb, id, currentStatus, failedAttempts, body, existingTypes
    )

    if (blockedReason) {
      return NextResponse.json({ data: null, error: blockedReason }, { status: 409 })
    }

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
          ...(body.metadata ?? {}),
        },
      })
      .select()
      .single()

    if (actErr) {
      console.error('[POST lead_activities insert]', actErr)
      return NextResponse.json({ data: null, error: actErr.message }, { status: 400 })
    }

    // Apply status/counter updates from lifecycle engine
    const leadUpdate: Record<string, unknown> = {}
    if (newStatus)         leadUpdate.status                  = newStatus
    if (newFailedAttempts !== null) leadUpdate.failed_contact_attempts = newFailedAttempts

    if (Object.keys(leadUpdate).length > 0) {
      await sb.from('leads').update(leadUpdate).eq('id', id)
    }

    // Schedule follow-up notification if applicable
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
        },
        statusAdvancedTo: newStatus ?? undefined,
        newFailedAttempts: newFailedAttempts ?? undefined,
        error: null,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/crm/leads/[id]/activities]', err)
    return NextResponse.json({ data: null, error: 'Failed to log activity' }, { status: 500 })
  }
}
