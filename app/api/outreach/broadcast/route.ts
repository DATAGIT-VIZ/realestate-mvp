import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Same id requireAuth() returns in dev bypass; imported leads have no agent_id there
const DEV_AGENT = '00000000-0000-0000-0000-000000000001'

type LeadRow = {
  id:            string
  name:          string | null
  phone:         string | null
  city:          string | null
  intent_score:  number | null
  status:        string | null
  source:        string | null
  property_type: string | null
  budget_max:    number | null
}

// Leads live in the Supabase `leads` table (same source as GET /api/crm/leads)
async function fetchLeads(userId: string | null): Promise<LeadRow[]> {
  const sb = getAdminClient()
  if (!sb) throw new Error('Database not configured')
  let q = sb.from('leads')
    .select('id, name, phone, city, intent_score, status, source, property_type, budget_max')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (userId !== DEV_AGENT) q = q.eq('agent_id', userId!)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as LeadRow[]
}

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return null
}

type Filters = { status?: string; source?: string; city?: string; minScore?: string; maxScore?: string; propType?: string }

const OPEN_STATUSES = ['new', 'cold', 'warm', 'hot']
// Compare without case or punctuation, so "housing" matches HOUSING_COM and "3 BHK" matches 3BHK
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

function matches(l: LeadRow, f: Filters) {
  const status = (l.status ?? 'New').toLowerCase()
  if (f.status) {
    // "open" = every lead still in play (New, Cold, Warm, Hot)
    if (f.status.toLowerCase() === 'open') { if (!OPEN_STATUSES.includes(status)) return false }
    else if (status !== f.status.toLowerCase()) return false
  }
  if (f.source   && !norm(l.source).includes(norm(f.source))) return false
  if (f.city     && (l.city ?? '').trim().toLowerCase() !== f.city.trim().toLowerCase()) return false
  if (f.minScore && (l.intent_score ?? 0) < Number(f.minScore)) return false
  if (f.maxScore && (l.intent_score ?? 0) > Number(f.maxScore)) return false
  if (f.propType && !norm(l.property_type).includes(norm(f.propType))) return false
  return true
}

// ─── GET — preview matching leads ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const { searchParams } = new URL(req.url)
  const filters: Filters = {
    status:   searchParams.get('status')   ?? undefined,   // a status, or "open"
    source:   searchParams.get('source')   ?? undefined,   // e.g. "magicbricks"
    city:     searchParams.get('city')     ?? undefined,
    minScore: searchParams.get('minScore') ?? undefined,
    maxScore: searchParams.get('maxScore') ?? undefined,
    propType: searchParams.get('propType') ?? undefined,
  }

  try {
    const leads = await fetchLeads(userId)
    const filtered = leads.filter(l => matches(l, filters))

    // Only include leads with a valid phone
    const reachable = filtered.filter(l => normalisePhone(l.phone))

    // Stage counts for everyone who will get the message, not just the 50 listed
    const byStatus: Record<string, number> = {}
    for (const l of reachable) { const st = l.status ?? 'New'; byStatus[st] = (byStatus[st] ?? 0) + 1 }

    return NextResponse.json({
      data: {
        total:     filtered.length,
        reachable: reachable.length,
        byStatus,
        leads:     reachable.slice(0, 50).map(l => ({
          id:     l.id,
          name:   (l.name ?? '').trim(),
          phone:  l.phone,
          city:   l.city,
          score:  l.intent_score,
          status: l.status,
        })),
      },
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/outreach/broadcast]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch leads' }, { status: 500 })
  }
}

// ─── POST — send broadcast ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  // 5 broadcasts per user per hour (each can hit hundreds of contacts)
  if (!checkRateLimit(`broadcast:${userId}`, 5, 60 * 60_000)) {
    return NextResponse.json({ data: null, error: 'Broadcast limit reached. Max 5 per hour.' }, { status: 429 })
  }

  if (!process.env.INTERAKT_API_KEY) {
    return NextResponse.json({ data: null, error: 'INTERAKT_API_KEY not configured' }, { status: 503 })
  }

  const body = await req.json()
  const {
    filters = {} as Filters,
    templateName,
    templateLang = 'en',
    bodyParams = [] as string[],
  } = body

  if (!templateName) {
    return NextResponse.json({ data: null, error: 'templateName is required' }, { status: 400 })
  }

  try {
    const leads = await fetchLeads(userId)
    const filtered = leads.filter(l => matches(l, filters)).filter(l => normalisePhone(l.phone))

    if (filtered.length === 0) {
      return NextResponse.json({ data: { sent: 0, failed: 0, skipped: 0 }, error: null })
    }

    const authHeader = `Basic ${Buffer.from(process.env.INTERAKT_API_KEY + ':').toString('base64')}`

    let sent = 0, failed = 0

    // Send in batches of 10 with a small delay to avoid rate limits
    const batchSize = 10
    for (let i = 0; i < filtered.length; i += batchSize) {
      const batch = filtered.slice(i, i + batchSize)

      await Promise.all(batch.map(async lead => {
        const phone = normalisePhone(lead.phone)
        if (!phone) { failed++; return }

        const firstName = (lead.name ?? '').trim().split(/\s+/)[0] || 'there'

        // Resolve body params — supports {{name}} token
        const resolvedParams = bodyParams.map((p: string) =>
          p.replace('{{name}}', firstName)
           .replace('{{city}}', lead.city ?? '')
           .replace('{{budget}}', lead.budget_max ? `₹${(lead.budget_max / 100000).toFixed(0)}L` : '')
        )

        try {
          const res = await fetch('https://api.interakt.ai/v1/public/message/', {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              countryCode: '+91',
              phoneNumber: phone,
              callbackData: `broadcast:${templateName}:${lead.id}`,
              type: 'Template',
              template: {
                name:         templateName,
                languageCode: templateLang,
                bodyValues:   resolvedParams,
              },
            }),
          })
          if (res.ok) sent++; else failed++
        } catch { failed++ }
      }))

      // 300ms gap between batches
      if (i + batchSize < filtered.length) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    return NextResponse.json({
      data: { sent, failed, total: filtered.length },
      error: null,
    })
  } catch (err) {
    console.error('[POST /api/outreach/broadcast]', err)
    return NextResponse.json({ data: null, error: 'Broadcast failed' }, { status: 500 })
  }
}
