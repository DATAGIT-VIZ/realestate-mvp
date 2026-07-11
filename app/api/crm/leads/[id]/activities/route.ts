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
  | 'Note'
  | 'Status Changed'
  | 'Site Visit Scheduled'
  | 'Site Visit Done'
  | 'Follow Up Set'

export type ActivityPayload = {
  type: ActivityType
  notes?: string
  outcome?: string
  duration?: number
  nextActionDate?: string
  metadata?: Record<string, unknown>
}

type RouteCtx = { params: Promise<{ id: string }> }

// ─── GET /api/crm/leads/[id]/activities ──────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: RouteCtx
) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Database not configured' }, { status: 503 })

  try {
    const { id } = await params

    // Verify lead belongs to this agent
    const { data: lead, error: leadErr } = await sb
      .from('leads').select('id').eq('id', id).eq('agent_id', userId!).single()
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
        notes:          (d.notes          as string  | null) ?? null,
        outcome:        (d.outcome        as string  | null) ?? null,
        duration:       (d.duration       as number  | null) ?? null,
        nextActionDate: (d.nextActionDate as string  | null) ?? null,
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

  try {
    const { id } = await params
    const body: ActivityPayload = await req.json()

    if (!body.type) {
      return NextResponse.json({ data: null, error: 'activity type is required' }, { status: 400 })
    }

    // Verify lead belongs to this agent
    const { data: lead, error: leadErr } = await sb
      .from('leads').select('id').eq('id', id).eq('agent_id', userId!).single()
    if (leadErr || !lead) {
      return NextResponse.json({ data: null, error: 'Lead not found' }, { status: 404 })
    }

    // Insert into Supabase lead_activities
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
        error: null,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/crm/leads/[id]/activities]', err)
    return NextResponse.json({ data: null, error: 'Failed to log activity' }, { status: 500 })
  }
}
