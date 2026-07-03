import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'
import { addDays } from 'date-fns'

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Supabase not configured' }, { status: 503 })

  const { sequenceId, leadId, leadName, leadPhone } = await req.json() as {
    sequenceId: string
    leadId:     string
    leadName:   string
    leadPhone:  string
  }

  if (!sequenceId || !leadId) {
    return NextResponse.json({ data: null, error: 'sequenceId and leadId required' }, { status: 400 })
  }

  // Check for existing active enrollment
  const { data: existing } = await sb
    .from('sequence_enrollments')
    .select('id, status')
    .eq('sequence_id', sequenceId)
    .eq('lead_id', leadId)
    .in('status', ['active', 'paused'])
    .single()

  if (existing) {
    return NextResponse.json({ data: null, error: 'Lead already enrolled in this sequence' }, { status: 409 })
  }

  // Get first step to compute next_fire_at
  const { data: firstStep } = await sb
    .from('sequence_steps')
    .select('delay_days')
    .eq('sequence_id', sequenceId)
    .order('step_order', { ascending: true })
    .limit(1)
    .single()

  const nextFireAt = firstStep
    ? addDays(new Date(), firstStep.delay_days).toISOString()
    : new Date().toISOString()

  const { data, error } = await sb
    .from('sequence_enrollments')
    .insert([{
      sequence_id:  sequenceId,
      lead_id:      leadId,
      lead_name:    leadName,
      lead_phone:   leadPhone,
      current_step: 0,
      status:       'active',
      next_fire_at: nextFireAt,
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })
  return NextResponse.json({ data: { enrollment: data }, error: null }, { status: 201 })
}
