/**
 * Dynamic intent score recalculator.
 * Called after every activity log so the score reflects real engagement.
 */
import { getAdminClient } from '@/lib/supabase-admin'

// Activity type → points awarded (capped per type below)
const ACTIVITY_POINTS: Record<string, number> = {
  'Call Made':            5,
  'Call Missed':          2,
  'WhatsApp Sent':        3,
  'WhatsApp Received':    12,
  'Email Sent':           3,
  'Email Received':       8,
  'VM Done':              10,
  'OBM Done':             15,
  'Site Visit Scheduled': 20,
  'Site Visit Done':      30,
  'EOI Received':         40,
  'Deal Closed':          50,
  'Follow Up Set':        4,
  'Note':                 1,
}

// Max contribution per activity type (prevent score-farming)
const ACTIVITY_CAPS: Record<string, number> = {
  'Call Made':            15,  // max +15 (3 calls)
  'Call Missed':          4,   // max +4 (2 misses count)
  'WhatsApp Sent':        9,   // max +9 (3 msgs)
  'WhatsApp Received':    12,  // single strong signal, full credit
  'Email Sent':           6,
  'Email Received':       8,
  'VM Done':              10,
  'OBM Done':             15,
  'Site Visit Scheduled': 20,
  'Site Visit Done':      30,
  'EOI Received':         40,
  'Deal Closed':          50,
  'Follow Up Set':        8,
  'Note':                 3,
}

export async function recalcLeadScore(leadId: string): Promise<number | null> {
  const sb = getAdminClient()
  if (!sb) return null

  const [{ data: lead }, { data: acts }] = await Promise.all([
    sb.from('leads')
      .select('phone, email, budget_min, budget_max, timeline, source')
      .eq('id', leadId)
      .single(),
    sb.from('lead_activities')
      .select('activity_type')
      .eq('lead_id', leadId),
  ])

  if (!lead) return null

  // ── Static component (same as calcLeadScore) ─────────────────────────
  let score = 0

  if (lead.phone) score += 20
  if (lead.email) score += 10

  if (lead.budget_min && lead.budget_max) score += 25
  else if (lead.budget_min || lead.budget_max) score += 15

  const t = (lead.timeline ?? '').toLowerCase()
  if (t.includes('immediate') || t.includes('1 month')) score += 25
  else if (t.includes('1–3') || t.includes('3 month') || t.includes('1-3')) score += 15
  else if (t.includes('6 month')) score += 5

  const s = (lead.source ?? '').toLowerCase()
  if (s.includes('website') || s.includes('referral')) score += 20
  else if (s.includes('magicbricks') || s.includes('99acres') || s.includes('housing')) score += 15
  else if (s.includes('facebook') || s.includes('google')) score += 10
  else score += 5

  // ── Activity component ────────────────────────────────────────────────
  const typeCounts: Record<string, number> = {}
  for (const a of acts ?? []) {
    typeCounts[a.activity_type] = (typeCounts[a.activity_type] ?? 0) + 1
  }

  for (const [type, count] of Object.entries(typeCounts)) {
    const perUnit = ACTIVITY_POINTS[type] ?? 0
    const cap     = ACTIVITY_CAPS[type]   ?? perUnit
    score += Math.min(perUnit * count, cap)
  }

  const newScore = Math.min(100, score)

  await sb.from('leads').update({ intent_score: newScore }).eq('id', leadId)

  return newScore
}
