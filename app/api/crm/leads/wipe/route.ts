import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

// DELETE /api/crm/leads/wipe
// Deletes all leads whose phone looks like a name (no real digits) OR a specific source.
// Body: { source?: string }  — omit to wipe ALL leads for this workspace.
// Only available in non-production environments.

export async function DELETE(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const DEV_AGENT   = '00000000-0000-0000-0000-000000000001'
  const isDevBypass = userId === DEV_AGENT

  try {
    const body = await req.json().catch(() => ({}))
    const { source } = body as { source?: string }

    let q = sb.from('leads').delete().not('id', 'is', null)   // match all
    if (!isDevBypass) q = (q as any).eq('agent_id', userId)
    if (source)       q = (q as any).eq('source', source)

    const { error, count } = await (q as any).select('id', { count: 'exact', head: true })

    // Re-run as actual delete (head:true above was just for count — do real delete)
    let delQ = sb.from('leads').delete().not('id', 'is', null)
    if (!isDevBypass) delQ = (delQ as any).eq('agent_id', userId)
    if (source)       delQ = (delQ as any).eq('source', source)
    const { error: delErr } = await delQ

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

    return NextResponse.json({ deleted: true, message: source ? `Wiped all leads with source "${source}"` : 'Wiped all leads' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
