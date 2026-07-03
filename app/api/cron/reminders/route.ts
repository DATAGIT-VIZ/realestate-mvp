/**
 * POST /api/cron/reminders
 *
 * Vercel cron — runs every 15 minutes.
 * Finds follow-up reminders that have just become due and updates their title
 * so the user sees them as "DUE NOW" in the notification panel.
 *
 * Vercel automatically adds: Authorization: Bearer {CRON_SECRET}
 * Configure in vercel.json + set CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { gql, LEAD_FIELDS, type CRMLead } from '@/lib/twenty'
import { createNotification } from '@/lib/notifications'

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // not configured — allow in dev
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ data: { skipped: true, reason: 'No service role key' }, error: null })
  }

  try {
    const now = new Date()
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000).toISOString()
    const windowEnd   = now.toISOString()

    // Find scheduled follow_up_due notifications that just became due
    const { data: dueRows } = await admin
      .from('notifications')
      .select('*')
      .eq('type', 'follow_up_due')
      .eq('read', false)
      .gte('scheduled_for', windowStart)
      .lte('scheduled_for', windowEnd)

    const rows = dueRows ?? []

    // For each due reminder, update the title to highlight it's now due
    for (const row of rows) {
      await admin
        .from('notifications')
        .update({ title: `⏰ Follow-up due now — ${row.title.replace('Follow-up: ', '')}` })
        .eq('id', row.id)
    }

    // Also scan Twenty for hot leads with no activity in 24h and create notifications
    const { hotLeadsWithoutActivity } = await checkHotLeadInactivity()
    for (const lead of hotLeadsWithoutActivity) {
      const name = `${lead.name.firstName} ${lead.name.lastName}`.trim()
      await createNotification({
        type: 'hot_lead_inactive',
        title: `Hot lead inactive 24h`,
        body: `${name} scored ${lead.intentScore}/100 but has had no activity in 24 hours. Follow up now.`,
        leadId: lead.id,
      })
    }

    return NextResponse.json({
      data: {
        remindersTriggered: rows.length,
        hotLeadAlerts: hotLeadsWithoutActivity.length,
      },
      error: null,
    })
  } catch (err) {
    console.error('[cron/reminders]', err)
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}

// GET for manual trigger from browser
export async function GET(req: NextRequest) {
  return POST(req)
}

async function checkHotLeadInactivity(): Promise<{ hotLeadsWithoutActivity: CRMLead[] }> {
  try {
    // Fetch hot leads (score >= 70)
    const result = await gql<{ people: { edges: { node: CRMLead }[] } }>(`
      query {
        people(
          filter: { intentScore: { gte: 70 } }
          first: 50
          orderBy: [{ intentScore: DescNullsLast }]
        ) {
          edges { node { ${LEAD_FIELDS} } }
        }
      }
    `)

    const hotLeads = result.data?.people.edges.map(e => e.node) ?? []
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Filter: last activity (updatedAt) was before the 24h cutoff
    const inactive = hotLeads.filter(l => new Date(l.updatedAt) < new Date(cutoff))

    // Deduplicate: don't re-alert if we already created a hot_lead_inactive notification today
    const admin = getAdminClient()
    if (!admin) return { hotLeadsWithoutActivity: inactive }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: existing } = await admin
      .from('notifications')
      .select('lead_id')
      .eq('type', 'hot_lead_inactive')
      .gte('created_at', todayStart.toISOString())

    const alreadyAlerted = new Set((existing ?? []).map((r: { lead_id: string }) => r.lead_id))
    const toAlert = inactive.filter(l => !alreadyAlerted.has(l.id))

    return { hotLeadsWithoutActivity: toAlert }
  } catch {
    return { hotLeadsWithoutActivity: [] }
  }
}
