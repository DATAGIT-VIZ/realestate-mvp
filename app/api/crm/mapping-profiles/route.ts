import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'

// GET /api/crm/mapping-profiles — list saved mapping profiles
export async function GET() {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const isDevBypass = userId === DEV_AGENT

  let q = sb.from('mapping_profiles').select('id,name,mapping,created_at').order('created_at', { ascending: false })
  if (!isDevBypass) q = q.eq('user_id', userId!)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data ?? [] })
}

// POST /api/crm/mapping-profiles — save a new mapping profile
export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const isDevBypass = userId === DEV_AGENT

  const { name, mapping } = await req.json() as { name: string; mapping: Record<string, string> }
  if (!name || !mapping) return NextResponse.json({ error: 'name and mapping required' }, { status: 400 })

  const { data, error } = await sb.from('mapping_profiles').insert({
    user_id: isDevBypass ? null : userId,
    name,
    mapping,
  }).select('id,name,mapping,created_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/crm/mapping-profiles?id=<uuid>
export async function DELETE(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await sb.from('mapping_profiles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
