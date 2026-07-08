/**
 * POST /api/ingest/99acres
 *
 * Accepts 99acres lead webhook payload and creates / deduplicates in Twenty.
 *
 * Sample payload (JSON):
 * {
 *   "sender_name": "Priya Mehta",
 *   "sender_phone": "9123456789",
 *   "sender_email": "priya@example.com",
 *   "city": "Mumbai",
 *   "budget_min": 5000000,
 *   "budget_max": 8000000,
 *   "property_type": "Flat",
 *   "possession": "Within 6 months",
 *   "unique_id": "99A-XYZ987",
 *   "property_name": "Hiranandani Estate"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { ingestLead } from '@/lib/ingest'
import { parseBudget } from '@/lib/dedup'
import { logIngestion } from '@/lib/ingestionLog'

export async function POST(req: NextRequest) {

  try {
    const contentType = req.headers.get('content-type') ?? ''
    let raw: Record<string, unknown>

    if (contentType.includes('application/json')) {
      raw = await req.json()
    } else {
      const text = await req.text()
      raw = Object.fromEntries(new URLSearchParams(text))
    }

    const name  = String(raw['sender_name'] ?? raw['name'] ?? '').trim()
    const phone = String(raw['sender_phone'] ?? raw['mobile'] ?? raw['phone'] ?? '').trim()
    const email = String(raw['sender_email'] ?? raw['email'] ?? '').trim() || undefined
    const city  = String(raw['city'] ?? '').trim() || undefined
    const propType = String(raw['property_type'] ?? '').trim()
    const timeline = String(raw['possession'] ?? raw['timeline'] ?? '').trim() || undefined
    const leadId   = String(raw['unique_id'] ?? raw['lead_id'] ?? '').trim() || undefined
    const detail   = String(raw['property_name'] ?? raw['locality'] ?? '').trim() || undefined

    // 99acres can send budget as numbers (rupees) or strings
    let budgetMin: number | undefined
    let budgetMax: number | undefined
    if (typeof raw['budget_min'] === 'number') budgetMin = raw['budget_min'] as number
    if (typeof raw['budget_max'] === 'number') budgetMax = raw['budget_max'] as number
    if (!budgetMin && raw['budget']) {
      const parsed = parseBudget(String(raw['budget']))
      budgetMin = parsed.budgetMin
      budgetMax = parsed.budgetMax
    }

    if (!name || !phone) {
      return NextResponse.json({ data: null, error: 'sender_name and sender_phone are required' }, { status: 400 })
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
      sourcePortal: '99acres',
      sourceDetail: detail,
      leadPortalId: leadId,
      propertyType: propType ? [propType] : undefined,
      timeline,
    })

    const parsedContact = { firstName, lastName: rest.join(' ') || undefined, phone, email, city, budgetMin, budgetMax, propertyType: propType || undefined, timeline }

    if (result.status === 'error') {
      await logIngestion({ sourcePortal: '99acres', rawPayload: raw as Record<string, unknown>, parsedContact, status: 'failed', errorMessage: result.message })
      return NextResponse.json({ data: null, error: result.message }, { status: 400 })
    }

    await logIngestion({
      sourcePortal: '99acres', rawPayload: raw as Record<string, unknown>, parsedContact, status: result.status,
      contactId: result.lead.id,
      contactName: `${result.lead.name.firstName} ${result.lead.name.lastName}`.trim(),
      contactPhone: result.lead.phones.primaryPhoneNumber ?? phone,
    })

    return NextResponse.json({
      data: { id: result.lead.id, status: result.status },
      error: null,
    }, { status: result.status === 'created' ? 201 : 200 })

  } catch (err) {
    console.error('[POST /api/ingest/99acres]', err)
    return NextResponse.json({ data: null, error: 'Internal error' }, { status: 500 })
  }
}
