import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Supabase not configured' }, { status: 503 })

  const { enrollmentId, reason } = await req.json() as {
    enrollmentId: string
    reason:       'manual' | 'replied'
  }

  const { error } = await sb
    .from('sequence_enrollments')
    .update({ status: 'stopped', stopped_reason: reason ?? 'manual', completed_at: new Date().toISOString() })
    .eq('id', enrollmentId)

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })
  return NextResponse.json({ data: { stopped: true }, error: null })
}
