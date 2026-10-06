import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'

// Only the lead's own agent can change its tasks (dev bypass skips the check, same as /api/crm/leads)
async function ownsLead(sb: SupabaseClient, leadId: string, userId: string) {
  if (userId === DEV_AGENT) return true
  const { data } = await sb.from('leads').select('id').eq('id', leadId).eq('agent_id', userId).maybeSingle()
  return !!data
}

// PATCH — update task status or any editable fields
// Body may include: status, title, task_type, due_date, priority, notes, assigned_to
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const { id, taskId } = await params
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  if (!(await ownsLead(sb, id, userId!))) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    const allowed = ['Pending', 'Done', 'Cancelled']
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (body.title       !== undefined) patch.title       = body.title.trim()
  if (body.task_type   !== undefined) patch.task_type   = body.task_type
  if (body.due_date    !== undefined) patch.due_date    = body.due_date
  if (body.priority    !== undefined) patch.priority    = body.priority
  if (body.notes       !== undefined) patch.notes       = body.notes ?? null
  if (body.assigned_to !== undefined) {
    patch.assigned_to = body.assigned_to || null
    patch.source      = body.assigned_to ? 'assigned' : 'self'
  }

  const { data, error } = await sb
    .from('lead_tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('lead_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ task: data })
}

// DELETE — remove a task
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const { id, taskId } = await params
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  if (!(await ownsLead(sb, id, userId!))) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const { error } = await sb
    .from('lead_tasks')
    .delete()
    .eq('id', taskId)
    .eq('lead_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
