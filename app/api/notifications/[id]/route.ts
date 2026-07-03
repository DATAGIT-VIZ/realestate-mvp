import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { markRead } from '@/lib/notifications'

// PATCH /api/notifications/[id] — mark a single notification as read
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  const { id } = await params
  await markRead(id)
  return NextResponse.json({ data: { id, read: true }, error: null })
}
