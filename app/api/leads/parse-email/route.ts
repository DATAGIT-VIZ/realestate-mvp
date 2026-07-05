import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const { content } = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are a real estate CRM data extraction assistant. Extract lead information from the provided text and return ONLY a valid JSON object with no markdown wrapping.

Fields to extract (omit or set null if not found):
- name: Full name (string)
- phone: Phone number (string)
- email: Email address (string)
- source: Message source (e.g. "Email", "WhatsApp", "MagicBricks", "99acres")
- property_type: Property type wanted (e.g. "2BHK", "Villa", "Plot", "Commercial")
- budget_min: Min budget in raw numbers — "1Cr" = 10000000 (number or null)
- budget_max: Max budget in raw numbers (number or null)
- timeline: Buying timeline (e.g. "Immediate", "1-3 months") (string or null)
- locations: Specific locations mentioned (string[] or null)

Return ONLY valid JSON. No markdown, no explanation.`,
      messages: [{ role: 'user', content: text }],
    })

    const raw = content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('').replace(/```json?/g, '').replace(/```/g, '').trim()

    try {
      return NextResponse.json(JSON.parse(raw))
    } catch {
      return NextResponse.json({ error: 'Could not parse lead data from text' }, { status: 422 })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
