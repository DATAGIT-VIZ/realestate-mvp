import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

// POST /api/crm/leads/distribute
// Body: { assignments: Array<{ agentId: string; agentName: string; count: number }>, priority: 'score' | 'oldest' | 'newest' }
// Picks `count` unassigned leads for each agent and sets assigned_to = agentId.

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  try {
    const { assignments, priority = 'score' } = await req.json() as {
      assignments: Array<{ agentId: string; agentName: string; count: number }>
      priority: 'score' | 'oldest' | 'newest'
    }

    if (!assignments?.length) {
      return NextResponse.json({ error: 'assignments array required' }, { status: 400 })
    }

    const DEV_AGENT   = '00000000-0000-0000-0000-000000000001'
    const isDevBypass = userId === DEV_AGENT
    const totalNeeded = assignments.reduce((s, a) => s + (a.count ?? 0), 0)

    if (totalNeeded === 0) {
      return NextResponse.json({ error: 'Total count must be > 0' }, { status: 400 })
    }
    if (totalNeeded > 10_000) {
      return NextResponse.json({ error: 'Cannot distribute more than 10,000 leads at once' }, { status: 400 })
    }

    // Fetch unassigned lead IDs in the requested priority order
    let q = sb.from('leads')
      .select('id')
      .is('assigned_to', null)
      .limit(totalNeeded)

    if (!isDevBypass) q = (q as any).eq('agent_id', userId)

    if (priority === 'score')   q = (q as any).order('intent_score', { ascending: false, nullsFirst: false })
    if (priority === 'oldest')  q = (q as any).order('created_at',   { ascending: true  })
    if (priority === 'newest')  q = (q as any).order('created_at',   { ascending: false })

    const { data: pool, error: poolErr } = await q
    if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 400 })
    if (!pool?.length) {
      return NextResponse.json({ distributed: 0, message: 'No unassigned leads found' })
    }

    // Slice the pool into chunks per agent
    let cursor = 0
    let distributed = 0
    const now = new Date().toISOString()
    const details: Array<{ agentName: string; assigned: number }> = []

    for (const { agentId, agentName, count } of assignments) {
      if (!count || cursor >= pool.length) { details.push({ agentName, assigned: 0 }); continue }

      const slice   = pool.slice(cursor, cursor + count)
      const ids     = slice.map(r => r.id)
      cursor       += slice.length

      const { error: updErr } = await sb.from('leads')
        .update({ assigned_to: agentId, assigned_at: now })
        .in('id', ids)

      if (updErr) {
        details.push({ agentName, assigned: 0 })
        continue
      }

      distributed += ids.length
      details.push({ agentName, assigned: ids.length })
    }

    return NextResponse.json({
      distributed,
      total:   pool.length,
      details,
      message: `Distributed ${distributed} leads across ${details.filter(d => d.assigned > 0).length} agents`,
    })
  } catch (err) {
    console.error('[POST /api/crm/leads/distribute]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

// GET /api/crm/leads/distribute — returns unassigned lead count + per-agent counts
export async function GET(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const DEV_AGENT   = '00000000-0000-0000-0000-000000000001'
  const isDevBypass = userId === DEV_AGENT

  // Count of unassigned leads
  let countQ = sb.from('leads').select('*', { count: 'exact', head: true }).is('assigned_to', null)
  if (!isDevBypass) countQ = (countQ as any).eq('agent_id', userId)
  const { count: unassigned } = await countQ

  // Count per agent (assigned_to → count)
  let agentQ = sb.from('leads')
    .select('assigned_to')
    .not('assigned_to', 'is', null)
  if (!isDevBypass) agentQ = (agentQ as any).eq('agent_id', userId)
  const { data: assigned } = await agentQ

  const perAgent: Record<string, number> = {}
  for (const r of (assigned ?? [])) {
    const k = r.assigned_to as string
    perAgent[k] = (perAgent[k] ?? 0) + 1
  }

  return NextResponse.json({ unassigned: unassigned ?? 0, perAgent })
}
