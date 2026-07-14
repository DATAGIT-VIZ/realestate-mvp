import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/crm/leads/import/[batchId] — poll batch status
export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { batchId } = await params

  const { data, error } = await sb
    .from('import_batches')
    .select('id,file_name,status,total_rows,inserted,skipped,merged,failed,error_report,created_at,completed_at')
    .eq('id', batchId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE /api/crm/leads/import/[batchId] — undo a batch
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { batchId } = await params

  const { data: batch, error: batchErr } = await sb
    .from('import_batches')
    .select('id,status,inserted')
    .eq('id', batchId)
    .single()

  if (batchErr || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  if (batch.status === 'undone') return NextResponse.json({ error: 'Already undone' }, { status: 400 })

  const { error: delErr, count } = await sb
    .from('leads')
    .delete({ count: 'exact' })
    .eq('import_batch_id', batchId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  await sb.from('import_batches').update({ status: 'undone', completed_at: new Date().toISOString() }).eq('id', batchId)

  return NextResponse.json({ deleted: count ?? 0, message: `Undone — removed ${count ?? 0} leads from this import` })
}
