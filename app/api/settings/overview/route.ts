import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// GET /api/settings/overview
// What the Settings pages show about the account, without exposing any secret:
// - services: which connections are set up on the server. true / false only, never a key or a number.
// - sources: how many of the user's leads came from each source, and when the newest one arrived.
// - totals: the user's lead and activity counts, for Data & privacy.
// - deliveries: webhook deliveries per portal from the ingest log (portal_leads). That table has no account
//   column, so these count deliveries for every account on this server.
// Same rule as /api/crm/leads: own leads only (agent_id), and the dev bypass user sees everything.

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'
const PAGE = 1000            // Supabase returns at most 1000 rows per request
const MAX_LEADS = 50_000
const MAX_DELIVERIES = 20_000

const has = (...names: string[]) => names.every(n => !!process.env[n]?.trim())

type Delivery = { created: number; duplicate: number; failed: number; last: string | null }

export async function GET() {
  const { userId, response } = await requireAuth()
  if (response) return response

  const services = {
    calling:  has('EXOTEL_SID', 'EXOTEL_API_KEY', 'EXOTEL_API_TOKEN', 'EXOTEL_PHONE'),
    whatsapp: has('INTERAKT_API_KEY'),
    email:    has('RESEND_API_KEY'),
    payments: has('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'),
    ai:       has('ANTHROPIC_API_KEY'),
  }

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ services, sources: [], totals: { leads: 0, activities: null }, deliveries: null, capped: false })
  const isDevBypass = userId === DEV_AGENT

  try {
    // Leads per source
    const bySource = new Map<string, { leads: number; last: string | null }>()
    let leadCount = 0
    let capped = false
    for (let from = 0; from < MAX_LEADS; from += PAGE) {
      let q = sb.from('leads').select('source, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (!isDevBypass) q = q.eq('agent_id', userId!)
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      for (const r of (data ?? []) as { source: string | null; created_at: string }[]) {
        leadCount++
        const key = r.source?.trim() || ''
        const s = bySource.get(key) ?? { leads: 0, last: null }
        s.leads++
        if (!s.last || r.created_at > s.last) s.last = r.created_at
        bySource.set(key, s)
      }
      if (!data || data.length < PAGE) break
      if (from + PAGE >= MAX_LEADS) capped = true
    }

    // Activity count (on the user's own leads)
    let aq = sb.from('lead_activities').select('id, leads!inner(agent_id)', { count: 'exact', head: true })
    if (!isDevBypass) aq = aq.eq('leads.agent_id', userId!)
    const { count: activityCount, error: aErr } = await aq
    if (aErr) console.error('[GET /api/settings/overview] activities', aErr.message)

    // Webhook deliveries per portal (every account; see the note at the top)
    let deliveries: Record<string, Delivery> | null = {}
    for (let from = 0; from < MAX_DELIVERIES; from += PAGE) {
      const { data, error } = await sb.from('portal_leads').select('source_portal, ingestion_status, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      // The log is optional (scripts/create-portal-leads.sql); without it the page just leaves these out
      if (error) { deliveries = null; break }
      for (const r of (data ?? []) as { source_portal: string; ingestion_status: string; created_at: string }[]) {
        const d = deliveries[r.source_portal] ?? { created: 0, duplicate: 0, failed: 0, last: null }
        if (r.ingestion_status === 'created') d.created++
        else if (r.ingestion_status === 'duplicate') d.duplicate++
        else if (r.ingestion_status === 'failed') d.failed++
        if (!d.last || r.created_at > d.last) d.last = r.created_at
        deliveries[r.source_portal] = d
      }
      if (!data || data.length < PAGE) break
    }

    return NextResponse.json({
      services,
      sources: [...bySource.entries()]
        .map(([source, s]) => ({ source: source || null, leads: s.leads, last: s.last }))
        .sort((a, b) => b.leads - a.leads),
      totals: { leads: leadCount, activities: aErr ? null : activityCount ?? 0 },
      deliveries,
      capped,
    })
  } catch (err) {
    console.error('[GET /api/settings/overview]', err)
    return NextResponse.json({ error: 'Failed to load settings overview' }, { status: 500 })
  }
}
