/**
 * POST /api/ingest/magicbricks
 *
 * Accepts MagicBricks lead webhook payload and creates / deduplicates in Twenty.
 * MagicBricks sends a form-encoded or JSON POST.
 *
 * Sample payload (JSON mode):
 * {
 *   "Name": "Rahul Sharma",
 *   "Mobile": "9876543210",
 *   "Email": "rahul@example.com",
 *   "City": "Pune",
 *   "Budget": "50L-80L",
 *   "Property Type": "Apartment",
 *   "Timeline": "3 Months",
 *   "Lead Id": "MB-2024-00123",
 *   "Project Name": "Lodha Palava"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireWebhookSecret } from '@/lib/auth'
import { ingestLead } from '@/lib/ingest'
import { parseBudget } from '@/lib/dedup'
import { logIngestion } from '@/lib/ingestionLog'

export async function POST(req: NextRequest) {
  const authError = requireWebhookSecret(req)
  if (authError) return authError

  try {
    const contentType = req.headers.get('content-type') ?? ''
    let raw: Record<string, string>

    if (contentType.includes('application/json')) {
      raw = await req.json()
    } else {
      // form-encoded fallback
      const text = await req.text()
      raw = Object.fromEntries(new URLSearchParams(text))
    }

    const name  = (raw['Name'] ?? raw['name'] ?? '').trim()
    const phone = (raw['Mobile'] ?? raw['mobile'] ?? raw['Phone'] ?? '').trim()
    const email = (raw['Email'] ?? raw['email'] ?? '').trim() || undefined
    const city  = (raw['City'] ?? raw['city'] ?? '').trim() || undefined
    const budget = raw['Budget'] ?? raw['budget']
    const propType = (raw['Property Type'] ?? raw['property_type'] ?? '').trim()
    const timeline = (raw['Timeline'] ?? raw['timeline'] ?? '').trim() || undefined
    const leadId = (raw['Lead Id'] ?? raw['lead_id'] ?? raw['LeadId'] ?? '').trim() || undefined
    const detail = (raw['Project Name'] ?? raw['project_name'] ?? raw['Locality'] ?? '').trim() || undefined

    if (!name || !phone) {
      return NextResponse.json({ data: null, error: 'Name and Mobile are required' }, { status: 400 })
    }

    const [firstName, ...rest] = name.split(' ')
    const { budgetMin, budgetMax } = parseBudget(budget)

    const result = await ingestLead({
      firstName,
      lastName: rest.join(' ') || undefined,
      phone,
      email,
      city,
      budgetMin,
      budgetMax,
      sourcePortal: 'MagicBricks',
      sourceDetail: detail,
      leadPortalId: leadId,
      propertyType: propType ? [propType] : undefined,
      timeline,
    })

    const parsedContact = { firstName, lastName: rest.join(' ') || undefined, phone, email, city, budgetMin, budgetMax, propertyType: propType || undefined, timeline }

    if (result.status === 'error') {
      await logIngestion({ sourcePortal: 'MagicBricks', rawPayload: raw, parsedContact, status: 'failed', errorMessage: result.message })
      return NextResponse.json({ data: null, error: result.message }, { status: 400 })
    }

    await logIngestion({
      sourcePortal: 'MagicBricks', rawPayload: raw, parsedContact, status: result.status,
      contactId: result.lead.id,
      contactName: `${result.lead.name.firstName} ${result.lead.name.lastName}`.trim(),
      contactPhone: result.lead.phones.primaryPhoneNumber ?? phone,
    })

    return NextResponse.json({
      data: { id: result.lead.id, status: result.status },
      error: null,
    }, { status: result.status === 'created' ? 201 : 200 })

  } catch (err) {
    console.error('[POST /api/ingest/magicbricks]', err)
    return NextResponse.json({ data: null, error: 'Internal error' }, { status: 500 })
  }
}
