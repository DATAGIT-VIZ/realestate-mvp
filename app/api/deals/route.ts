import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')

  let query = sb.from('deals').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  if (stage) query = query.eq('stage', stage)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deals: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const body = await req.json()
  const {
    lead_name, lead_phone, twenty_lead_id,
    property_name, property_type, locality, city,
    deal_value, stage = 'new', assigned_to, expected_close,
    source_portal, notes,
  } = body

  if (!lead_name) return NextResponse.json({ error: 'lead_name is required' }, { status: 400 })

  const { data, error } = await sb.from('deals').insert({
    user_id: userId,
    lead_name, lead_phone, twenty_lead_id,
    property_name, property_type, locality, city,
    deal_value: deal_value ? Number(deal_value) : null,
    stage, assigned_to, expected_close: expected_close || null,
    source_portal, notes,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deal: data }, { status: 201 })
}
