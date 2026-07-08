/**
 * POST /api/ingest/housing
 *
 * Accepts Housing.com lead webhook payload and creates / deduplicates in Twenty.
 *
 * Sample payload (JSON):
 * {
 *   "lead": {
 *     "name": "Anil Kumar",
 *     "phone": "8765432109",
 *     "email": "anil@example.com",
 *     "city": "Bengaluru",
 *     "budget": "80L-1.2Cr",
 *     "bhk": "2 BHK",
 *     "timeline": "Immediate",
 *     "leadId": "HOU-2024-99001",
 *     "projectName": "Prestige Lakeside"
 *   }
 * }
 *
 * Housing.com also supports a flat object (no nested "lead" key) — both are handled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ingestLead } from '@/lib/ingest'
import { parseBudget } from '@/lib/dedup'
import { logIngestion } from '@/lib/ingestionLog'

export async function POST(req: NextRequest) {

  try {
    const contentType = req.headers.get('content-type') ?? ''
    let body: Record<string, unknown>

    if (contentType.includes('application/json')) {
      body = await req.json()
    } else {
      const text = await req.text()
      body = Object.fromEntries(new URLSearchParams(text))
    }

    // Housing.com wraps in a "lead" key sometimes
    const raw: Record<string, unknown> = (body['lead'] && typeof body['lead'] === 'object')
      ? body['lead'] as Record<string, unknown>
      : body

    const name     = String(raw['name']        ?? raw['full_name']    ?? '').trim()
    const phone    = String(raw['phone']        ?? raw['mobile']       ?? '').trim()
    const email    = String(raw['email']        ?? '').trim() || undefined
    const city     = String(raw['city']         ?? '').trim() || undefined
    const propType = String(raw['bhk']          ?? raw['property_type'] ?? '').trim()
    const timeline = String(raw['timeline']     ?? '').trim() || undefined
    const leadId   = String(raw['leadId']       ?? raw['lead_id']     ?? '').trim() || undefined
    const detail   = String(raw['projectName']  ?? raw['locality']    ?? '').trim() || undefined

    const { budgetMin, budgetMax } = parseBudget(String(raw['budget'] ?? ''))

    if (!name || !phone) {
      return NextResponse.json({ data: null, error: 'name and phone are required' }, { status: 400 })
    }

    const [firstName, ...rest] = name.split(' ')

    const result = await ingestLead({
      firstName,
      lastName: rest.join(' ') || undefined,
      phone,
      email,
      city,
      budgetMin,
      budgetMax,
      sourcePortal: 'Housing.com',
      sourceDetail: detail,
      leadPortalId: leadId,
      propertyType: propType ? [propType] : undefined,
      timeline,
    })

    const parsedContact = { firstName, lastName: rest.join(' ') || undefined, phone, email, city, budgetMin, budgetMax, propertyType: propType || undefined, timeline }

    if (result.status === 'error') {
      await logIngestion({ sourcePortal: 'Housing.com', rawPayload: raw, parsedContact, status: 'failed', errorMessage: result.message })
      return NextResponse.json({ data: null, error: result.message }, { status: 400 })
    }

    await logIngestion({
      sourcePortal: 'Housing.com', rawPayload: raw, parsedContact, status: result.status,
      contactId: result.lead.id,
      contactName: `${result.lead.name.firstName} ${result.lead.name.lastName}`.trim(),
      contactPhone: result.lead.phones.primaryPhoneNumber ?? phone,
    })

    return NextResponse.json({
      data: { id: result.lead.id, status: result.status },
      error: null,
    }, { status: result.status === 'created' ? 201 : 200 })

  } catch (err) {
    console.error('[POST /api/ingest/housing]', err)
    return NextResponse.json({ data: null, error: 'Internal error' }, { status: 500 })
  }
}
