import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { data, error } = await sb
    .from('lead_tasks')
    .select('*')
    .eq('lead_id', id)
    .order('due_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const body = await req.json()
  const { title, task_type, due_date, priority, notes, assigned_to } = body

  if (!title?.trim() || !due_date) {
    return NextResponse.json({ error: 'title and due_date are required' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('lead_tasks')
    .insert({
      lead_id:     id,
      title:       title.trim(),
      task_type:   task_type   ?? 'Follow Up',
      due_date,
      priority:    priority    ?? 'Medium',
      notes:       notes       ?? null,
      assigned_to: assigned_to ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ task: data }, { status: 201 })
}
