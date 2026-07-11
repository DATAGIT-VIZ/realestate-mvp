import { NextRequest, NextResponse } from 'next/server'
import { calcLeadScore, type CRMLead, type CRMLeadInput } from '@/lib/twenty'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

type RouteCtx = { params: Promise<{ id: string }> }

// ─── Supabase row → CRMLead ───────────────────────────────────────────────────
function rowToCrm(r: Record<string, unknown>): CRMLead {
  const parts = ((r.name as string) ?? '').trim().split(/\s+/)
  return {
    id:           r.id as string,
    name:         { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') },
    phones:       { primaryPhoneNumber: (r.phone as string) ?? '', primaryPhoneCountryCode: 'IN' },
    emails:       { primaryEmail: (r.email as string) ?? '' },
    city:         (r.city as string) ?? null,
    intentScore:  (r.intent_score as number) ?? 0,
    status:       (r.status as string) ?? 'Fresh',
    leadPortalId: (r.cs_id as string) ?? null,
    sourcePortal: (r.source as string) ?? null,
    sourceDetail: (() => {
      const parts: string[] = []
      if (r.client_type)    parts.push(`[${r.client_type}]`)
      if (r.portal_lead_id) parts.push(`[pid:${r.portal_lead_id}]`)
      return parts.length ? parts.join(' ') : null
    })(),
    budgetMin:    (r.budget_min as number)  ?? null,
    budgetMax:    (r.budget_max as number)  ?? null,
    propertyType: (r.property_type as string) ? [(r.property_type as string)] : null,
    timeline:     (r.timeline as string)    ?? null,
    localities:   (r.locations as string[]) ?? null,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
  }
}

// ─── GET /api/crm/leads/[id] ─────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Database not configured' }, { status: 503 })

  try {
    const { id } = await params

    const { data: lead, error: leadErr } = await sb.from('leads')
      .select('*')
      .eq('id', id)
      .eq('agent_id', userId!)
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ data: null, error: 'Lead not found' }, { status: 404 })
    }

    // Fetch activities from lead_activities (real agent-attributed log)
    const { data: actRows } = await sb.from('lead_activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })

    const activities = (actRows ?? []).map(a => {
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

    return NextResponse.json({ data: { lead: rowToCrm(lead as Record<string, unknown>), activities }, error: null })
  } catch (err) {
    console.error('[GET /api/crm/leads/[id]]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch lead' }, { status: 500 })
  }
}

// ─── PATCH /api/crm/leads/[id] ───────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Database not configured' }, { status: 503 })

  try {
    const { id } = await params
    const body: Record<string, unknown> = await req.json()

    // Build Supabase update object from incoming fields
    const update: Record<string, unknown> = {}

    if (body.firstName !== undefined || body.lastName !== undefined) {
      // Merge with existing name if only one half is sent
      const { data: cur } = await sb.from('leads').select('name').eq('id', id).single()
      const existingParts = ((cur?.name as string) ?? '').trim().split(/\s+/)
      const firstName = (body.firstName as string) ?? existingParts[0] ?? ''
      const lastName  = (body.lastName  as string) ?? existingParts.slice(1).join(' ') ?? ''
      update.name = `${firstName} ${lastName}`.trim()
    }
    if (body.phone        !== undefined) update.phone         = body.phone
    if (body.email        !== undefined) update.email         = body.email
    if (body.city         !== undefined) update.city          = body.city
    if (body.status       !== undefined) update.status        = body.status
    if (body.sourcePortal !== undefined) update.source        = body.sourcePortal
    if (body.clientType   !== undefined) update.client_type   = body.clientType
    if (body.budgetMin    !== undefined) update.budget_min    = body.budgetMin
    if (body.budgetMax    !== undefined) update.budget_max    = body.budgetMax
    if (body.timeline     !== undefined) update.timeline      = body.timeline
    if (body.localities   !== undefined) update.locations     = body.localities
    if (body.propertyType !== undefined) update.property_type = Array.isArray(body.propertyType) ? body.propertyType[0] : body.propertyType
    if (body.intentScore  !== undefined) update.intent_score  = body.intentScore

    // Recalculate intent score when qualification fields change
    const scoreFields = ['phone','email','budgetMin','budgetMax','timeline','sourcePortal']
    if (scoreFields.some(f => body[f] !== undefined)) {
      const { data: cur } = await sb.from('leads').select('*').eq('id', id).single()
      if (cur) {
        const merged: Partial<CRMLeadInput> = {
          phone:        (body.phone        as string) ?? cur.phone,
          email:        (body.email        as string) ?? cur.email,
          budgetMin:    (body.budgetMin    as number) ?? cur.budget_min,
          budgetMax:    (body.budgetMax    as number) ?? cur.budget_max,
          timeline:     (body.timeline     as string) ?? cur.timeline,
          sourcePortal: (body.sourcePortal as string) ?? cur.source,
        }
        update.intent_score = calcLeadScore(merged)
      }
    }

    const { data: updated, error: updateErr } = await sb.from('leads')
      .update(update)
      .eq('id', id)
      .eq('agent_id', userId!)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ data: null, error: updateErr.message }, { status: 400 })

    return NextResponse.json({ data: rowToCrm(updated as Record<string, unknown>), error: null })
  } catch (err) {
    console.error('[PATCH /api/crm/leads/[id]]', err)
    return NextResponse.json({ data: null, error: 'Failed to update lead' }, { status: 500 })
  }
}

// ─── DELETE /api/crm/leads/[id] ──────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Database not configured' }, { status: 503 })

  try {
    const { id } = await params
    const { error } = await sb.from('leads').delete().eq('id', id).eq('agent_id', userId!)
    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })
    return NextResponse.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[DELETE /api/crm/leads/[id]]', err)
    return NextResponse.json({ data: null, error: 'Failed to delete lead' }, { status: 500 })
  }
}
