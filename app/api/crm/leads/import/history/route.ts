import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'

// GET /api/crm/leads/import/history — list import batches (newest first)
export async function GET(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const isDevBypass = userId === DEV_AGENT

  let q = sb
    .from('import_batches')
    .select('id,file_name,status,dedup_strategy,total_rows,inserted,skipped,merged,failed,created_at,completed_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!isDevBypass) q = q.eq('user_id', userId!)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ batches: data ?? [] })
}
