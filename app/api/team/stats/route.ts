import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// GET /api/team/stats
// Per-agent numbers for the Team page, worked out from the leads table (leads.assigned_to = team_members.id)
// and lead_activities. The Deals table is mostly empty, so the old page always showed ₹0 and 0 won.
//
// "Won" = leads in Closed, "Lost" = leads in Disqualified, dated by the lead's updated_at
// (the leads table has no closed_at column). Pipeline = budget_max (or budget_min) of open leads.

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'
const DAY = 86_400_000
const OPEN = new Set(['New', 'Cold', 'Warm', 'Hot', 'Hold'])
const WORKED = new Set(['Cold', 'Warm', 'Hot'])
// Activities that count as the agent reaching out (not inbound replies or system events)
const TOUCH = new Set(['Call Made', 'Call Missed', 'WhatsApp Sent', 'Email Sent', 'VM Done', 'OBM Done', 'Site Visit Scheduled', 'Site Visit Done', 'Follow Up Set', 'Note'])
const STAGES = ['New', 'Cold', 'Warm', 'Hot', 'Closed', 'Disqualified', 'Hold'] as const

type Period = { month: number; d30: number; all: number }
export type AgentAgg = {
  leads: number
  byStage: Record<(typeof STAGES)[number], number>
  openValue: number
  won: Period
  lost: Period
  quiet: number           // Cold / Warm / Hot leads with no update in 7+ days
  calls: { d7: number; d30: number }
  touches: { d7: number; d30: number }
  lastActivity: string | null
}

const blank = (): AgentAgg => ({
  leads: 0,
  byStage: { New: 0, Cold: 0, Warm: 0, Hot: 0, Closed: 0, Disqualified: 0, Hold: 0 },
  openValue: 0,
  won: { month: 0, d30: 0, all: 0 },
  lost: { month: 0, d30: 0, all: 0 },
  quiet: 0,
  calls: { d7: 0, d30: 0 },
  touches: { d7: 0, d30: 0 },
  lastActivity: null,
})

function stageOf(s: string | null): (typeof STAGES)[number] {
  const k = (s ?? 'New').trim().toLowerCase()
  const hit = STAGES.find(x => x.toLowerCase() === k)
  if (hit) return hit
  if (k === 'won') return 'Closed'
  if (k === 'lost' || k === 'nc') return 'Disqualified'
  if (k === 'on hold') return 'Hold'
  if (k === 'site visit' || k === 'negotiation') return 'Hot'
  if (k === 'connected' || k === 'virtual meeting') return 'Warm'
  if (k === 'attempting' || k === 'vm done') return 'Cold'
  return 'New'
}

export async function GET() {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const isDevBypass = userId === DEV_AGENT
  const now = Date.now()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const since30 = new Date(now - 30 * DAY).toISOString()

  try {
    // ── Leads (paged, Supabase caps a page at 1000 rows) ──
    type LeadRow = { id: string; assigned_to: string | null; status: string | null; budget_min: number | null; budget_max: number | null; updated_at: string | null; created_at: string | null }
    const leads: LeadRow[] = []
    for (let from = 0; from < 50_000; from += 1000) {
      let q = sb.from('leads').select('id, assigned_to, status, budget_min, budget_max, updated_at, created_at').range(from, from + 999)
      if (!isDevBypass) q = q.eq('agent_id', userId!)
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      leads.push(...((data ?? []) as LeadRow[]))
      if (!data || data.length < 1000) break
    }

    const agents: Record<string, AgentAgg> = {}
    const leadOwner = new Map<string, string>()
    let unassigned = 0

    for (const l of leads) {
      if (!l.assigned_to) { unassigned++; continue }
      leadOwner.set(l.id, l.assigned_to)
      const a = (agents[l.assigned_to] ??= blank())
      const st = stageOf(l.status)
      const upd = l.updated_at ? new Date(l.updated_at).getTime() : 0
      a.leads++
      a.byStage[st]++
      if (OPEN.has(st)) a.openValue += Number(l.budget_max ?? l.budget_min ?? 0) || 0
      if (WORKED.has(st) && upd && now - upd >= 7 * DAY) a.quiet++
      if (st === 'Closed' || st === 'Disqualified') {
        const p = st === 'Closed' ? a.won : a.lost
        p.all++
        if (upd >= monthStart) p.month++
        if (upd && now - upd <= 30 * DAY) p.d30++
      }
    }

    // ── Activities in the last 30 days on assigned leads ──
    if (leadOwner.size) {
      for (let from = 0; from < 20_000; from += 1000) {
        let q = sb.from('lead_activities')
          .select('lead_id, activity_type, created_at, leads!inner ( agent_id, assigned_to )')
          .gte('created_at', since30)
          .not('leads.assigned_to', 'is', null)
          .order('created_at', { ascending: false })
          .range(from, from + 999)
        if (!isDevBypass) q = q.eq('leads.agent_id', userId!)
        const { data, error } = await q
        if (error) break   // activity numbers are a bonus; never fail the page for them
        for (const r of (data ?? []) as { lead_id: string; activity_type: string; created_at: string }[]) {
          const owner = leadOwner.get(r.lead_id)
          if (!owner || !TOUCH.has(r.activity_type)) continue
          const a = (agents[owner] ??= blank())
          const age = now - new Date(r.created_at).getTime()
          a.touches.d30++
          if (age <= 7 * DAY) a.touches.d7++
          if (r.activity_type === 'Call Made') {
            a.calls.d30++
            if (age <= 7 * DAY) a.calls.d7++
          }
          if (!a.lastActivity || r.created_at > a.lastActivity) a.lastActivity = r.created_at
        }
        if (!data || data.length < 1000) break
      }
    }

    return NextResponse.json({ agents, unassigned, totalLeads: leads.length, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[GET /api/team/stats]', err)
    return NextResponse.json({ error: 'Failed to load team stats' }, { status: 500 })
  }
}
