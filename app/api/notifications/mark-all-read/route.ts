import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { markAllRead } from '@/lib/notifications'

// POST /api/notifications/mark-all-read
export async function POST(_req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  await markAllRead()
  return NextResponse.json({ data: { ok: true }, error: null })
}
