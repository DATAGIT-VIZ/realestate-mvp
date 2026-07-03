import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb  = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { id } = await params
  const body   = await req.json()

  const { data, error } = await sb
    .from('team_members')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id).eq('manager_id', userId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { id } = await params
  const { error } = await sb.from('team_members').delete().eq('id', id).eq('manager_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
