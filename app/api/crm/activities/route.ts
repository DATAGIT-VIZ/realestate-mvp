/**
 * GET /api/crm/activities?since=<ISO>&limit=500
 *
 * Returns all activities across all leads since `since`.
 * Used by team analytics and the activity feed.
 * Reads from Supabase lead_activities (agent-attributed) instead of Twenty.com Notes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

type ActivityRow = {
  id: string
  personId: string | null
  type: string
  notes: string | null
  outcome: string | null
  createdAt: string
}

export async function GET(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: { activities: [], total: 0 }, error: null })

  try {
    const { searchParams } = req.nextUrl
    const since = searchParams.get('since') ?? new Date(Date.now() - 90 * 86400000).toISOString()
    const limit = Math.min(Number(searchParams.get('limit') ?? '500'), 1000)

    // Join lead_activities → leads so we only return activities for this user's leads
    const { data, count, error } = await sb
      .from('lead_activities')
      .select(`
        id, activity_type, activity_data, created_at, lead_id,
        leads!inner ( agent_id )
      `, { count: 'exact' })
      .eq('leads.agent_id', userId!)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })

    const activities: ActivityRow[] = (data ?? []).map(row => {
      const d = (row.activity_data as Record<string, unknown>) ?? {}
      return {
        id:        row.id,
        personId:  row.lead_id,
        type:      row.activity_type,
        notes:     (d.notes as string)   ?? null,
        outcome:   (d.outcome as string) ?? null,
        createdAt: row.created_at,
      }
    })

    return NextResponse.json({ data: { activities, total: count ?? activities.length }, error: null })
  } catch (err) {
    console.error('[GET /api/crm/activities]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch activities' }, { status: 500 })
  }
}
