import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getLogs, type IngestionStatus } from '@/lib/ingestionLog'

// GET /api/ingest/log?status=all&source=all&limit=50&offset=0
export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const { searchParams } = req.nextUrl
  const status = (searchParams.get('status') ?? 'all') as IngestionStatus | 'all'
  const source = searchParams.get('source') ?? 'all'
  const limit  = Math.min(Number(searchParams.get('limit')  ?? '50'), 100)
  const offset = Number(searchParams.get('offset') ?? '0')

  const result = await getLogs({ status, source, limit, offset })

  if (result.error && result.rows.length === 0) {
    return NextResponse.json({ data: null, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { rows: result.rows, total: result.total }, error: null })
}
