/**
 * POST /api/ingest/facebook
 * GET  /api/ingest/facebook   (Meta hub verification)
 *
 * Receives Facebook Lead Ads webhook, fetches lead data from Graph API,
 * then runs through the same ingestLead flow as MagicBricks / 99acres.
 *
 * Setup in Meta:
 *  1. Go to Developers Console → Your App → Webhooks
 *  2. Subscribe to "leadgen" events on your Page
 *  3. Set callback URL: https://yourdomain.com/api/ingest/facebook
 *  4. Set verify token = META_VERIFY_TOKEN env var value
 *  5. Set META_APP_SECRET for payload signature verification
 *  6. Set META_PAGE_ACCESS_TOKEN (Page token with leads_retrieval permission)
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ingestLead } from '@/lib/ingest'
import { parseBudget } from '@/lib/dedup'
import { logIngestion } from '@/lib/ingestionLog'

const GRAPH_API = 'https://graph.facebook.com/v19.0'

// ─── Signature verification ───────────────────────────────────────────────────
function verifySignature(rawBody: string, sig: string | null): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret) return true // skip in dev if not set
  if (!sig?.startsWith('sha256=')) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return `sha256=${expected}` === sig
}

// ─── Fetch lead details from Graph API ───────────────────────────────────────
async function fetchLeadData(leadgenId: string): Promise<Record<string, string>> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN not set')

  const url = `${GRAPH_API}/${leadgenId}?fields=field_data,created_time,ad_name,form_id&access_token=${token}`
  const res  = await fetch(url)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph API error ${res.status}: ${err}`)
  }

  const json = await res.json() as { field_data?: { name: string; values: string[] }[] }
  const fields: Record<string, string> = {}
  for (const f of json.field_data ?? []) {
    fields[f.name.toLowerCase().replace(/\s+/g, '_')] = f.values[0] ?? ''
  }
  return fields
}

// ─── Parse budget string like "50L-80L" or "1Cr-2Cr" ────────────────────────
function parseFbBudget(raw: string | undefined): { budgetMin?: number; budgetMax?: number } {
  if (!raw) return {}
  return parseBudget(raw)
}

// ─── GET — Meta hub verification ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ─── POST — Lead notification ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify signature
  const sig = req.headers.get('x-hub-signature-256')
  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  let body: {
    object: string
    entry: {
      id: string
      time: number
      changes: { field: string; value: { leadgen_id: string; page_id: string; form_id: string; ad_id?: string } }[]
    }[]
  }

  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.object !== 'page') {
    return NextResponse.json({ ok: true }) // ignore non-page events
  }

  const results: { leadgenId: string; status: string }[] = []

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue

      const leadgenId = change.value.leadgen_id
      let fields: Record<string, string> = {}

      try {
        fields = await fetchLeadData(leadgenId)
      } catch (e) {
        console.error(`[fb ingest] Failed to fetch leadgen ${leadgenId}:`, e)
        results.push({ leadgenId, status: 'fetch_error' })
        continue
      }

      // Normalise field names — Facebook forms use various naming conventions
      const fullName   = fields.full_name ?? fields.name ?? fields.first_name ?? ''
      const phone      = fields.phone_number ?? fields.phone ?? fields.mobile_number ?? ''
      const email      = fields.email ?? fields.email_address ?? undefined
      const city       = fields.city ?? fields.location ?? undefined
      const budget     = fields.budget ?? fields.price_range ?? undefined
      const propType   = fields.property_type ?? fields.looking_for ?? fields.bhk_type ?? undefined
      const timeline   = fields.timeline ?? fields.when_to_buy ?? fields.move_in_timeline ?? undefined
      const adName     = change.value.ad_id ?? undefined

      if (!phone) {
        results.push({ leadgenId, status: 'no_phone' })
        continue
      }

      const [firstName, ...rest] = fullName.trim().split(' ')
      const { budgetMin, budgetMax } = parseFbBudget(budget)

      const parsedContact = {
        firstName: firstName || 'Facebook Lead',
        lastName:  rest.join(' ') || undefined,
        phone, email, city,
        budgetMin, budgetMax,
        propertyType: propType ? [propType] : undefined,
        timeline,
      }

      const result = await ingestLead({
        ...parsedContact,
        sourcePortal: 'Facebook Ads',
        sourceDetail: adName,
        leadPortalId: leadgenId,
        localities:   [],
      })

      await logIngestion({
        sourcePortal: 'Facebook Ads',
        rawPayload:   { leadgenId, ...fields },
        parsedContact,
        status:       result.status === 'error' ? 'failed' : result.status === 'duplicate' ? 'duplicate' : 'created',
        errorMessage: result.status === 'error' ? result.message : undefined,
      })

      results.push({ leadgenId, status: result.status })
    }
  }

  return NextResponse.json({ ok: true, results })
}
