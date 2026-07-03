import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET() {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { data, error } = await sb
    .from('routing_rules')
    .select('*, agent:team_members(id, name)')
    .eq('user_id', userId)
    .order('priority')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const body = await req.json()
  const { rule_type, match_value, agent_id, priority = 0, is_active = true } = body

  if (!rule_type) return NextResponse.json({ error: 'rule_type is required' }, { status: 400 })

  const { data, error } = await sb
    .from('routing_rules')
    .insert({ user_id: userId, rule_type, match_value, agent_id, priority, is_active })
    .select('*, agent:team_members(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data }, { status: 201 })
}
