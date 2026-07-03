import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Supabase not configured' }, { status: 503 })

  const { data: sequences, error } = await sb
    .from('sequences')
    .select('*, sequence_steps(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })

  // Attach enrollment counts
  const ids = (sequences ?? []).map((s: Record<string, unknown>) => s.id as string)
  let countMap: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: counts } = await sb
      .from('sequence_enrollments')
      .select('sequence_id')
      .in('sequence_id', ids)
      .eq('status', 'active')
    for (const row of counts ?? []) {
      countMap[row.sequence_id] = (countMap[row.sequence_id] ?? 0) + 1
    }
  }

  const result = (sequences ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    active_enrollments: countMap[s.id as string] ?? 0,
  }))

  return NextResponse.json({ data: { sequences: result }, error: null })
}

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Supabase not configured' }, { status: 503 })

  const { name, description, steps } = await req.json() as {
    name:        string
    description: string
    steps:       { delay_days: number; channel: string; template_name?: string; message_body?: string }[]
  }

  if (!name || !steps?.length) {
    return NextResponse.json({ data: null, error: 'name and steps are required' }, { status: 400 })
  }

  const { data: seq, error: seqErr } = await sb
    .from('sequences')
    .insert([{ name, description }])
    .select()
    .single()

  if (seqErr) return NextResponse.json({ data: null, error: seqErr.message }, { status: 400 })

  const stepRows = steps.map((s, i) => ({
    sequence_id:   seq.id,
    step_order:    i,
    delay_days:    s.delay_days,
    channel:       s.channel,
    template_name: s.template_name ?? null,
    message_body:  s.message_body ?? null,
  }))

  const { error: stepsErr } = await sb.from('sequence_steps').insert(stepRows)
  if (stepsErr) return NextResponse.json({ data: null, error: stepsErr.message }, { status: 400 })

  return NextResponse.json({ data: { sequence: seq }, error: null }, { status: 201 })
}
