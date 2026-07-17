import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const body = await req.json()
  const allowed = ['Pending', 'Done', 'Cancelled']
  if (!allowed.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('lead_tasks')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('lead_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ task: data })
}
