import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { gql } from '@/lib/twenty'
import type { CRMLead } from '@/lib/twenty'
import { LEAD_FIELDS } from '@/lib/twenty'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Fetch all leads from Twenty (paginated up to 200)
async function fetchLeads(): Promise<CRMLead[]> {
  const query = /* GraphQL */ `
    query BroadcastLeads {
      people(first: 200, orderBy: { createdAt: DescNullsLast }) {
        edges { node { ${LEAD_FIELDS} } }
      }
    }
  `
  const res = await gql<{ people: { edges: { node: CRMLead }[] } }>(query)
  return res.data?.people.edges.map(e => e.node) ?? []
}

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return null
}

// ─── GET — preview matching leads ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const { searchParams } = new URL(req.url)
  const status      = searchParams.get('status')       // e.g. "Hot"
  const source      = searchParams.get('source')       // e.g. "MagicBricks"
  const city        = searchParams.get('city')
  const minScore    = searchParams.get('minScore')
  const maxScore    = searchParams.get('maxScore')
  const propType    = searchParams.get('propType')

  try {
    const leads = await fetchLeads()

    const filtered = leads.filter(l => {
      if (status   && l.status?.toLowerCase() !== status.toLowerCase()) return false
      if (source   && !l.sourcePortal?.toLowerCase().includes(source.toLowerCase())) return false
      if (city     && l.city?.toLowerCase() !== city.toLowerCase()) return false
      if (minScore && (l.intentScore ?? 0) < Number(minScore)) return false
      if (maxScore && (l.intentScore ?? 0) > Number(maxScore)) return false
      if (propType && !l.propertyType?.some(p => p.toLowerCase().includes(propType.toLowerCase()))) return false
      return true
    })

    // Only include leads with a valid phone
    const reachable = filtered.filter(l => normalisePhone(l.phones?.primaryPhoneNumber))

    return NextResponse.json({
      data: {
        total:     filtered.length,
        reachable: reachable.length,
        leads:     reachable.slice(0, 50).map(l => ({
          id:    l.id,
          name:  `${l.name.firstName} ${l.name.lastName}`.trim(),
          phone: l.phones?.primaryPhoneNumber,
          city:  l.city,
          score: l.intentScore,
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
    filters = {} as Record<string, string>,
    templateName,
    templateLang = 'en',
    bodyParams = [] as string[],
  } = body

  if (!templateName) {
    return NextResponse.json({ data: null, error: 'templateName is required' }, { status: 400 })
  }

  try {
    const leads = await fetchLeads()

    const filtered = leads.filter(l => {
      if (filters.status   && l.status?.toLowerCase() !== filters.status.toLowerCase()) return false
      if (filters.source   && !l.sourcePortal?.toLowerCase().includes(filters.source.toLowerCase())) return false
      if (filters.city     && l.city?.toLowerCase() !== filters.city.toLowerCase()) return false
      if (filters.minScore && (l.intentScore ?? 0) < Number(filters.minScore)) return false
      if (filters.maxScore && (l.intentScore ?? 0) > Number(filters.maxScore)) return false
      if (filters.propType && !l.propertyType?.some(p => p.toLowerCase().includes(filters.propType.toLowerCase()))) return false
      return true
    }).filter(l => normalisePhone(l.phones?.primaryPhoneNumber))

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
        const phone = normalisePhone(lead.phones?.primaryPhoneNumber)
        if (!phone) { failed++; return }

        const firstName = lead.name.firstName || 'there'

        // Resolve body params — supports {{name}} token
        const resolvedParams = bodyParams.map((p: string) =>
          p.replace('{{name}}', firstName)
           .replace('{{city}}', lead.city ?? '')
           .replace('{{budget}}', lead.budgetMax ? `₹${(lead.budgetMax / 100000).toFixed(0)}L` : '')
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
