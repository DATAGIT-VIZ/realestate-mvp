import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getNotifications, createNotification, type NotificationType } from '@/lib/notifications'

// GET /api/notifications — fetch recent notifications (scheduled_for <= now)
export async function GET(_req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const { rows, unreadCount, error } = await getNotifications(30)

  if (error && rows.length === 0) {
    return NextResponse.json({ data: null, error }, { status: 500 })
  }

  return NextResponse.json({ data: { notifications: rows, unreadCount }, error: null })
}

// POST /api/notifications — create a notification (for testing or internal use)
export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const body = await req.json() as {
      type: NotificationType
      title: string
      body: string
      leadId?: string
      scheduledFor?: string
    }

    if (!body.type || !body.title || !body.body) {
      return NextResponse.json({ data: null, error: 'type, title, and body are required' }, { status: 400 })
    }

    await createNotification({
      type: body.type,
      title: body.title,
      body: body.body,
      leadId: body.leadId,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    })

    return NextResponse.json({ data: { created: true }, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/notifications]', err)
    return NextResponse.json({ data: null, error: 'Failed to create notification' }, { status: 500 })
  }
}
