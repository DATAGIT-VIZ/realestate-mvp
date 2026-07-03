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
    .from('saved_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { name, config } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await sb
    .from('saved_reports')
    .insert({ user_id: userId, name, config })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: data }, { status: 201 })
}
