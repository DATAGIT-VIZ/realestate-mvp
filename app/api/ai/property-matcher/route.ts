import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function formatINR(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ data: null, error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const { lead } = await req.json() as {
    lead: {
      name:        string
      city:        string | null
      budgetMin:   number | null
      budgetMax:   number | null
      propertyType: string[] | null
      timeline:    string | null
      localities:  string[] | null
    }
  }

  // Fetch available properties from Supabase
  const sb = getAdminClient()
  let properties: Record<string, unknown>[] = []
  if (sb) {
    const { data } = await sb
      .from('properties')
      .select('*')
      .eq('status', 'Available')
      .order('price', { ascending: true })
      .limit(50)
    properties = data ?? []
  }

  // If no inventory, have Claude give generic recommendations
  const hasInventory = properties.length > 0

  const systemPrompt = `You are an expert Indian real estate consultant embedded in a CRM.
Given a lead's requirements and a list of available properties (or no inventory), rank or suggest the best matches.
Return ONLY valid JSON — no markdown, no explanation. Format:
{
  "matches": [
    {
      "id": "property_id_or_null",
      "title": "property title",
      "price": "₹XXL",
      "city": "city",
      "locality": "locality",
      "type": "Apartment/Villa/etc",
      "bedrooms": 2,
      "matchScore": 85,
      "matchReasons": ["Budget fits exactly", "Preferred locality"],
      "concern": "Possession 18 months away — may be too late for their timeline",
      "whatsappSnippet": "I found a great 2BHK in Baner at ₹85L — matches your budget perfectly. Possession in Dec 2026."
    }
  ],
  "summary": "2 strong matches found based on budget and preferred city"
}`

  const propertyList = hasInventory
    ? properties.map((p, i) => `[${i + 1}] ID:${p.id} | ${p.title} | ${p.type ?? ''} ${p.bedrooms ?? ''}BHK | ${p.locality ?? ''}, ${p.city ?? ''} | ${formatINR(p.price as number)} | ${p.area_sqft ?? '?'} sqft | ${p.status}`).join('\n')
    : 'No properties in inventory yet — suggest 3 hypothetical property types that would fit this lead.'

  const userPrompt = `Lead Requirements:
- Name: ${lead.name}
- City preference: ${lead.city ?? 'Not specified'}
- Localities: ${lead.localities?.join(', ') ?? 'Not specified'}
- Budget: ${lead.budgetMin ? formatINR(lead.budgetMin) : '?'} – ${lead.budgetMax ? formatINR(lead.budgetMax) : '?'}
- Property Type: ${lead.propertyType?.join(', ') ?? 'Any'}
- Timeline: ${lead.timeline ?? 'Not specified'}

Available Properties:
${propertyList}

${hasInventory ? `Rank up to 5 best matches with scores and WhatsApp snippets. Set id to the property ID.` : `Suggest 3 hypothetical properties. Set id to null.`}`

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages:   [{ role: 'user', content: userPrompt }],
      system:     systemPrompt,
    })

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(raw)
    return NextResponse.json({ data: { ...parsed, hasInventory }, error: null })
  } catch (err) {
    console.error('[POST /api/ai/property-matcher]', err)
    return NextResponse.json({ data: null, error: 'Matching failed' }, { status: 500 })
  }
}
