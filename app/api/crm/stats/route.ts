import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

// GET /api/crm/stats
// Returns lightweight aggregate stats that are expensive to derive client-side.
export async function GET() {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: { contacted: 0 }, error: null })

  try {
    // Distinct leads with at least one Call, WhatsApp, or Email activity logged by this agent.
    const { data, error } = await sb
      .from('lead_activities')
      .select('lead_id')
      .eq('agent_id', userId!)
      .in('activity_type', ['Call', 'WhatsApp', 'Email'])

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })

    const contacted = new Set((data ?? []).map(r => r.lead_id)).size

    return NextResponse.json({ data: { contacted }, error: null })
  } catch (err) {
    console.error('[GET /api/crm/stats]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch stats' }, { status: 500 })
  }
}
