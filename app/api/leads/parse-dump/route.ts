import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  try {
    const { headers, sampleRows } = await req.json()
    if (!headers?.length || !sampleRows?.length) {
      return NextResponse.json({ error: 'headers and sampleRows required' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const sampleText = [
      headers.join(' | '),
      ...sampleRows.slice(0, 8).map((r: any[]) => r.map(v => String(v ?? '')).join(' | ')),
    ].join('\n')

    const { content } = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are an expert at parsing messy real estate lead dump data from Indian brokers and developers.
Your job: given column headers and sample rows, identify which column best represents each lead field.
Return ONLY a JSON object with these keys (value = exact column header string, or null if not found):
{
  "name": "<header>",
  "phone": "<header>",
  "email": "<header>",
  "source": "<header>",
  "property_type": "<header>",
  "budget_min": "<header>",
  "budget_max": "<header>",
  "city": "<header>",
  "timeline": "<header>"
}

Rules:
- Indian phone numbers may be in columns labelled "Mobile", "Contact", "No", "Mob", "Phone No", "WhatsApp", "Cell", etc.
- Name may be "Client Name", "Prospect", "Customer", "Lead Name", "Full Name", "Person", etc.
- If a single column seems to contain both first and last name, map it to "name".
- Budget may be in lakhs (e.g., "50L", "50,00,000") — pick the column, do not convert values.
- If budget is one column, map to budget_min, leave budget_max null.
- If you're unsure, make your best guess from the data sample.
- Return ONLY valid JSON. No markdown, no extra text.`,
      messages: [{ role: 'user', content: `Columns and sample data:\n${sampleText}` }],
    })

    const raw = content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .replace(/```json?/g, '').replace(/```/g, '').trim()

    try {
      const mapping = JSON.parse(raw)
      // Only return headers that actually exist in the file
      const cleaned: Record<string, string | null> = {}
      for (const [k, v] of Object.entries(mapping)) {
        cleaned[k] = headers.includes(v as string) ? (v as string) : null
      }
      return NextResponse.json({ mapping: cleaned })
    } catch {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 422 })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
