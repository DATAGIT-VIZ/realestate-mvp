import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'
import { type CRMLead } from '@/lib/twenty'

export const runtime = 'nodejs'

const LEADS_CAP      = 5_000
const ACTIVITIES_CAP = 20_000
const DEMO_THRESHOLD = 5   // if fewer real activities than this, inject demo set

// ─── Row → CRMLead + assignedTo ───────────────────────────────────────────────
function rowToLead(r: Record<string, unknown>): CRMLead & { assignedTo: string | null } {
  const parts = ((r.name as string) ?? '').trim().split(/\s+/)
  return {
    id:          r.id as string,
    name:        { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') },
    phones:      { primaryPhoneNumber: (r.phone as string) ?? '', primaryPhoneCountryCode: 'IN' },
    emails:      { primaryEmail: (r.email as string) ?? '' },
    city:        (r.city as string) ?? null,
    intentScore: (r.intent_score as number) ?? 0,
    status:      (r.status as string) ?? 'New',
    leadPortalId:  (r.cs_id as string) ?? null,
    sourcePortal:  (r.source as string) ?? null,
    sourceDetail:  buildSourceDetail(r.client_type as string, r.portal_lead_id as string),
    budgetMin:    (r.budget_min as number) ?? null,
    budgetMax:    (r.budget_max as number) ?? null,
    propertyType: (r.property_type as string) ? [(r.property_type as string)] : null,
    timeline:     (r.timeline as string) ?? null,
    localities:               (r.locations as string[]) ?? null,
    failedContactAttempts:    (r.failed_contact_attempts as number) ?? 0,
    escalated:    (r.escalated as boolean) ?? false,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
    assignedTo:   (r.assigned_to as string) ?? null,
  }
}

function buildSourceDetail(clientType?: string | null, portalId?: string | null): string | null {
  const parts: string[] = []
  if (clientType) parts.push(`[${clientType}]`)
  if (portalId)   parts.push(`[pid:${portalId}]`)
  return parts.length ? parts.join(' ') : null
}

// ─── Demo activities (in-memory, never written to DB) ─────────────────────────
type ActivityRow = {
  id: string; leadId: string; type: string; outcome: string | null
  callOutcome: string | null; duration: number | null; notes: string | null; createdAt: string
}

const ACT_SCRIPTS: Array<{
  type: string; outcome: string | null; callOutcome: 'connected' | 'nca' | null; dur: number | null; note: string
}> = [
  { type: 'Call Made',              outcome: 'Spoke',            callOutcome: 'connected', dur: 240,  note: 'Discussed requirements and budget range' },
  { type: 'Call Made',              outcome: 'Spoke',            callOutcome: 'connected', dur: 360,  note: 'Confirmed timeline and preferred localities' },
  { type: 'Call Made',              outcome: 'Spoke',            callOutcome: 'connected', dur: 180,  note: 'Sent brochure post call, follow-up next week' },
  { type: 'Call Missed',            outcome: null,               callOutcome: 'nca',       dur: null, note: 'No answer — will retry tomorrow morning' },
  { type: 'Call Missed',            outcome: null,               callOutcome: 'nca',       dur: null, note: 'Busy — SMS sent asking to call back' },
  { type: 'WhatsApp Sent',          outcome: 'Message sent',     callOutcome: null,        dur: null, note: 'Sent project brochure and price list' },
  { type: 'WhatsApp Sent',          outcome: 'Message sent',     callOutcome: null,        dur: null, note: 'Follow-up on availability for site visit' },
  { type: 'Email Sent',             outcome: 'Email delivered',  callOutcome: null,        dur: null, note: 'Sent detailed floor plan and payment schedule' },
  { type: 'Site Visit Scheduled',   outcome: 'Confirmed',        callOutcome: null,        dur: null, note: 'Site visit booked for the weekend' },
  { type: 'Site Visit Done',        outcome: 'Positive',         callOutcome: null,        dur: null, note: 'Very interested — loved the 3 BHK unit' },
  { type: 'Follow Up Set',          outcome: null,               callOutcome: null,        dur: null, note: 'Set follow-up for next week after site visit' },
  { type: 'Call Made',              outcome: 'Negotiating',      callOutcome: 'connected', dur: 420,  note: 'Price negotiation ongoing — 5% discount discussed' },
  { type: 'EOI Received',           outcome: 'EOI submitted',    callOutcome: null,        dur: null, note: 'EOI amount paid, booking form being processed' },
  { type: 'Call Made',              outcome: 'Spoke',            callOutcome: 'connected', dur: 150,  note: 'Checked in on loan sanction status' },
  { type: 'WhatsApp Sent',          outcome: 'Message sent',     callOutcome: null,        dur: null, note: 'Shared AgreementToSale draft for review' },
  { type: 'Deal Closed',            outcome: 'Won',              callOutcome: null,        dur: null, note: 'Deal successfully closed — token paid and receipt shared' },
  { type: 'Call Made',              outcome: 'Not interested',   callOutcome: 'connected', dur: 90,   note: 'Budget has changed — no longer looking at this segment' },
  { type: 'VM Done',                outcome: 'Completed',        callOutcome: null,        dur: null, note: 'Virtual model unit shown over video call' },
  { type: 'OBM Done',               outcome: 'Completed',        callOutcome: null,        dur: null, note: 'OBM completed, client pleased with view from floor 14' },
  { type: 'Note',                   outcome: null,               callOutcome: null,        dur: null, note: 'Internal note: high priority — investor with 2 other inquiries' },
]

// Seed deterministically from leadIndex so it is stable across refreshes
function demoForLead(leadId: string, leadIndex: number, leadCreatedAt: string, now: number): ActivityRow[] {
  const rows: ActivityRow[] = []
  const leadAge  = now - new Date(leadCreatedAt).getTime()
  const window   = Math.min(leadAge, 88 * 86_400_000)

  // How many activities this lead gets (3–9, varied by index)
  const count    = 3 + (leadIndex % 7)
  // Spread over the window since the lead was created
  const interval = window / (count + 1)

  // Each lead picks a different starting script offset so activity mix varies
  const offset = (leadIndex * 3) % ACT_SCRIPTS.length

  for (let i = 0; i < count; i++) {
    const scriptIdx = (offset + i) % ACT_SCRIPTS.length
    const s = ACT_SCRIPTS[scriptIdx]
    // Time: spread backward from now, jittered by lead index and activity index
    const jitter   = ((leadIndex * 7 + i * 13) % 6) * 3_600_000   // 0–5 hr offset
    const msAgo    = interval * (i + 1) + jitter
    const ts       = new Date(now - Math.min(msAgo, window)).toISOString()

    // Pick a realistic hour for the heatmap (working hours, weighted)
    const hour     = [9, 10, 11, 14, 15, 16, 17, 18][(leadIndex + i) % 8]
    const tsDate   = new Date(ts)
    tsDate.setHours(hour, (i * 7) % 60, 0, 0)

    rows.push({
      id:          `demo-${leadId}-${i}`,
      leadId,
      type:        s.type,
      outcome:     s.outcome,
      callOutcome: s.callOutcome,
      duration:    s.dur,
      notes:       s.note,
      createdAt:   tsDate.toISOString(),
    })
  }
  return rows
}

function buildDemoActivities(leads: (CRMLead & { assignedTo: string | null })[], now: number): ActivityRow[] {
  const rows: ActivityRow[] = []
  // Use up to 50 leads so charts have variety
  leads.slice(0, 50).forEach((l, idx) => {
    rows.push(...demoForLead(l.id, idx, l.createdAt, now))
  })
  return rows
}

// ─── GET /api/insights?days=N ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const days        = Math.max(7, Math.min(365, Number(req.nextUrl.searchParams.get('days') ?? '90')))
  const DEV_AGENT   = '00000000-0000-0000-0000-000000000001'
  const isDevBypass = userId === DEV_AGENT
  const now         = Date.now()

  // ── Leads ──────────────────────────────────────────────────────────────────
  let leadsQ = sb
    .from('leads')
    .select('id, name, phone, email, city, intent_score, status, cs_id, source, client_type, portal_lead_id, property_type, locations, budget_min, budget_max, timeline, failed_contact_attempts, escalated, assigned_to, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(LEADS_CAP + 1)

  if (!isDevBypass) leadsQ = leadsQ.eq('agent_id', userId!)

  const { data: leadRows, error: leadsErr } = await leadsQ
  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

  const cappedLeads = (leadRows ?? []).length > LEADS_CAP
  const leads       = (leadRows ?? []).slice(0, LEADS_CAP).map(r => rowToLead(r as Record<string, unknown>))
  const leadIds     = leads.map(l => l.id)

  // ── Activities ─────────────────────────────────────────────────────────────
  let activities: ActivityRow[] = []
  let activitiesFailed = false
  let cappedActs = false
  let demo = false

  if (leadIds.length > 0) {
    const since = new Date(now - days * 86_400_000).toISOString()

    try {
      const { data: actRows, error: actsErr } = await sb
        .from('lead_activities')
        .select('id, lead_id, activity_type, activity_data, created_at')
        .in('lead_id', leadIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(ACTIVITIES_CAP + 1)

      if (actsErr) {
        activitiesFailed = true
      } else {
        cappedActs = (actRows ?? []).length > ACTIVITIES_CAP
        activities = (actRows ?? []).slice(0, ACTIVITIES_CAP).map(a => {
          const d = (a.activity_data as Record<string, unknown>) ?? {}
          return {
            id:          a.id,
            leadId:      a.lead_id,
            type:        a.activity_type,
            outcome:     (d.outcome     as string | null) ?? null,
            callOutcome: (d.callOutcome as string | null) ?? null,
            duration:    (d.duration    as number | null) ?? null,
            notes:       (d.notes       as string | null) ?? null,
            createdAt:   a.created_at,
          }
        })
      }
    } catch {
      activitiesFailed = true
    }

    // If the activities table is essentially empty, inject a demo set so every
    // chart has something to render. These are computed in memory — nothing is
    // written to the database.
    if (activities.length < DEMO_THRESHOLD && !activitiesFailed) {
      activities = buildDemoActivities(leads, now)
      demo = true
    }
  }

  return NextResponse.json({
    leads,
    activities,
    days,
    capped:           { leads: cappedLeads, activities: cappedActs },
    activitiesFailed,
    demo,
  })
}
