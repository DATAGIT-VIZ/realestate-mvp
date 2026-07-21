import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// PATCH — update task status or any editable fields
// Body may include: status, title, task_type, due_date, priority, notes, assigned_to
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

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
  const { id, taskId } = await params
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { error } = await sb
    .from('lead_tasks')
    .delete()
    .eq('id', taskId)
    .eq('lead_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
