import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  // Fetch file name to delete from storage
  const { data: brochure } = await sb.from('brochures').select('file_name').eq('id', id).single()

  if (brochure?.file_name) {
    await sb.storage.from('brochures').remove([brochure.file_name])
  }

  const { error } = await sb.from('brochures').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ deleted: id })
}
