import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// GET /api/crm/tasks — all tasks, enriched with lead + team member names
// Query params:
//   source=self|assigned   filter by source
//   agent=<uuid>           filter by assigned_to team member UUID
//   status=Pending|Done|Cancelled  (default: omitted = all)
export async function GET(req: NextRequest) {
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const sourceFilter = searchParams.get('source')   // 'self' | 'assigned' | null
  const agentFilter  = searchParams.get('agent')    // team_member UUID | null
  const statusFilter = searchParams.get('status')   // 'Pending' | 'Done' | 'Cancelled' | null

  // Fetch tasks
  let q = sb
    .from('lead_tasks')
    .select('*, leads(id, name, phone)')
    .order('due_date', { ascending: true })

  if (sourceFilter) q = q.eq('source', sourceFilter)
  if (agentFilter)  q = q.eq('assigned_to', agentFilter)
  if (statusFilter) q = q.eq('status', statusFilter)

  const { data: tasks, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fetch team members for name enrichment
  const { data: members } = await sb
    .from('team_members')
    .select('id, name, role')
  const memberMap: Record<string, { name: string; role: string }> =
    Object.fromEntries((members ?? []).map(m => [m.id, { name: m.name, role: m.role }]))

  const enriched = (tasks ?? []).map(t => ({
    ...t,
    assignee: t.assigned_to ? (memberMap[t.assigned_to] ?? null) : null,
    creator:  t.created_by  ? (memberMap[t.created_by]  ?? null) : null,
  }))

  return NextResponse.json({ tasks: enriched, members: members ?? [] })
}

// POST /api/crm/tasks — create a task directly from the task board
// Body: { lead_id, title, task_type, due_date, priority, notes?, assigned_to?, created_by? }
export async function POST(req: NextRequest) {
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const body = await req.json()
  const { lead_id, title, task_type, due_date, priority, notes, assigned_to, created_by } = body

  if (!lead_id)        return NextResponse.json({ error: 'lead_id is required' },  { status: 400 })
  if (!title?.trim())  return NextResponse.json({ error: 'title is required' },     { status: 400 })
  if (!due_date)       return NextResponse.json({ error: 'due_date is required' },  { status: 400 })

  const source = assigned_to ? 'assigned' : 'self'

  const { data, error } = await sb
    .from('lead_tasks')
    .insert({
      lead_id,
      title:       title.trim(),
      task_type:   task_type   ?? 'Follow Up',
      due_date,
      priority:    priority    ?? 'Medium',
      notes:       notes       ?? null,
      assigned_to: assigned_to ?? null,
      created_by:  created_by  ?? null,
      source,
    })
    .select('*, leads(id, name, phone)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ task: data }, { status: 201 })
}
