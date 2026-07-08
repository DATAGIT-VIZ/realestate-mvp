import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

// GET /api/outreach/enrollments?leadId=xxx
export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Supabase not configured' }, { status: 503 })

  const leadId = req.nextUrl.searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ data: null, error: 'leadId required' }, { status: 400 })

  const { data, error } = await sb
    .from('sequence_enrollments')
    .select(`
      id, status, current_step, next_fire_at, created_at,
      sequences ( id, name, description, sequence_steps ( id, step_order, channel, delay_days, message_body ) )
    `)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })
  return NextResponse.json({ data: { enrollments: data ?? [] }, error: null })
}

// DELETE /api/outreach/enrollments?id=xxx  — cancel a single enrollment
export async function DELETE(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Supabase not configured' }, { status: 503 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ data: null, error: 'id required' }, { status: 400 })

  const { error } = await sb
    .from('sequence_enrollments')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })
  return NextResponse.json({ data: { ok: true }, error: null })
}
