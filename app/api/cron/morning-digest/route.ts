/**
 * POST /api/cron/morning-digest
 *
 * Vercel cron — runs daily at 8 AM IST (2:30 AM UTC).
 * Queries today's follow-ups and new leads, creates a single digest notification.
 */

import { NextRequest, NextResponse } from 'next/server'
import { gql, LEAD_FIELDS, type CRMLead } from '@/lib/twenty'
import { createNotification } from '@/lib/notifications'
import { getAdminClient } from '@/lib/supabase-admin'

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // 1. Count new leads added since yesterday
    const newLeadResult = await gql<{ people: { totalCount: number } }>(`
      query {
        people(filter: { createdAt: { gte: "${yesterday}" } }) {
          totalCount
        }
      }
    `)
    const newLeadCount = newLeadResult.data?.people.totalCount ?? 0

    // 2. Count hot leads
    const hotResult = await gql<{ people: { totalCount: number } }>(`
      query {
        people(filter: { intentScore: { gte: 70 }, status: { neq: "Won" } }) {
          totalCount
        }
      }
    `)
    const hotCount = hotResult.data?.people.totalCount ?? 0

    // 3. Count follow-ups due today from notifications table
    const admin = getAdminClient()
    let followUpCount = 0
    if (admin) {
      const tomorrowStart = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
      const { count } = await admin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'follow_up_due')
        .eq('read', false)
        .gte('scheduled_for', todayISO)
        .lt('scheduled_for', tomorrowStart)
      followUpCount = count ?? 0
    }

    // Build digest body
    const parts: string[] = []
    if (followUpCount > 0) parts.push(`📅 ${followUpCount} follow-up${followUpCount > 1 ? 's' : ''} due today`)
    if (newLeadCount > 0)  parts.push(`🆕 ${newLeadCount} new lead${newLeadCount > 1 ? 's' : ''} since yesterday`)
    if (hotCount > 0)      parts.push(`🔥 ${hotCount} hot lead${hotCount > 1 ? 's' : ''} in pipeline`)

    const body = parts.length > 0
      ? parts.join('\n')
      : 'All caught up! No pending follow-ups or new leads today.'

    await createNotification({
      type: 'morning_digest',
      title: `Good morning — here's your day`,
      body,
    })

    return NextResponse.json({
      data: { newLeads: newLeadCount, hotLeads: hotCount, followUps: followUpCount },
      error: null,
    })
  } catch (err) {
    console.error('[cron/morning-digest]', err)
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}

// GET for manual trigger
export async function GET(req: NextRequest) {
  return POST(req)
}
