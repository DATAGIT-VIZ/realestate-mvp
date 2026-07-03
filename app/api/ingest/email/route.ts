/**
 * POST /api/ingest/email
 *
 * Accepts a forwarded portal email (plain text or HTML body) and extracts
 * lead fields using Claude Haiku, then creates / deduplicates in Twenty.
 *
 * Body (JSON):
 * {
 *   "subject": "New Lead from NoBroker - Flat in Pune",
 *   "body": "<full email text or HTML>"
 * }
 *
 * Can also be called from the EmailParserModal component with the same shape.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ingestLead } from '@/lib/ingest'
import { logIngestion } from '@/lib/ingestionLog'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type ParsedLead = {
  firstName: string
  lastName?: string
  phone: string
  email?: string
  city?: string
  budgetMin?: number
  budgetMax?: number
  sourcePortal?: string
  propertyType?: string[]
  timeline?: string
  localities?: string[]
}

async function extractLeadFromEmail(subject: string, body: string): Promise<ParsedLead | null> {
  const prompt = `You are a data extraction assistant for a real estate CRM.

Extract lead information from this forwarded real estate portal email.

EMAIL SUBJECT: ${subject}

EMAIL BODY:
${body.slice(0, 4000)}

Return a JSON object with ONLY these fields (omit any field if not found):
{
  "firstName": "string (required)",
  "lastName": "string",
  "phone": "10-digit Indian mobile number, no spaces (required)",
  "email": "string",
  "city": "string (Indian city name)",
  "budgetMin": number (in rupees, e.g. 5000000 for 50L),
  "budgetMax": number (in rupees),
  "sourcePortal": "string (e.g. NoBroker, MagicBricks, 99acres, Housing.com, etc.)",
  "propertyType": ["string"] (e.g. ["Apartment"], ["Villa"], ["Plot"]),
  "timeline": "string (e.g. Immediate, 3 Months, 6 Months)",
  "localities": ["string"] (list of preferred localities if mentioned)
}

Return ONLY valid JSON, no markdown, no explanation.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  if (!text) return null

  try {
    const json = JSON.parse(text)
    if (!json.firstName || !json.phone) return null
    return json as ParsedLead
  } catch {
    // Claude sometimes wraps in ```json ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]+?)```/)
    if (match) {
      try {
        return JSON.parse(match[1]) as ParsedLead
      } catch {
        return null
      }
    }
    return null
  }
}

export async function POST(req: NextRequest) {
  // Allow both authenticated users (from UI) — no webhook secret needed for email route
  const { response } = await requireAuth()
  if (response) return response

  try {
    const { subject = '', body } = await req.json() as { subject?: string; body: string }

    if (!body?.trim()) {
      return NextResponse.json({ data: null, error: 'Email body is required' }, { status: 400 })
    }

    // Strip HTML tags for cleaner extraction
    const plainText = body.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ')

    const parsed = await extractLeadFromEmail(subject, plainText)

    if (!parsed) {
      await logIngestion({ sourcePortal: 'Email', rawPayload: { subject, body: body.slice(0, 500) }, status: 'failed', errorMessage: 'AI extraction failed' })
      return NextResponse.json(
        { data: null, error: 'Could not extract lead information from email. Please check the email content.' },
        { status: 422 }
      )
    }

    const result = await ingestLead(parsed)

    if (result.status === 'error') {
      await logIngestion({ sourcePortal: parsed.sourcePortal ?? 'Email', rawPayload: { subject, body: body.slice(0, 500) }, parsedContact: parsed as Record<string, unknown>, status: 'failed', errorMessage: result.message })
      return NextResponse.json({ data: null, error: result.message }, { status: 400 })
    }

    await logIngestion({
      sourcePortal: parsed.sourcePortal ?? 'Email',
      rawPayload: { subject, body: body.slice(0, 500) },
      parsedContact: parsed as Record<string, unknown>,
      status: result.status,
      contactId: result.lead.id,
      contactName: `${result.lead.name.firstName} ${result.lead.name.lastName}`.trim(),
      contactPhone: result.lead.phones.primaryPhoneNumber ?? parsed.phone,
    })

    return NextResponse.json({
      data: { id: result.lead.id, status: result.status, parsed },
      error: null,
    }, { status: result.status === 'created' ? 201 : 200 })

  } catch (err) {
    console.error('[POST /api/ingest/email]', err)
    return NextResponse.json({ data: null, error: 'Internal error' }, { status: 500 })
  }
}
