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
    .from('team_members')
    .select('*')
    .eq('manager_id', userId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const body = await req.json()
  const { name, email, phone, role = 'agent', specialty_cities = [], specialty_types = [], monthly_target = 5 } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await sb
    .from('team_members')
    .insert({ manager_id: userId, name, email, phone, role, specialty_cities, specialty_types, monthly_target })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data }, { status: 201 })
}
