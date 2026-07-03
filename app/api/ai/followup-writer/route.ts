import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type LeadContext = {
  name:         string
  city:         string | null
  budget:       string | null
  propertyType: string | null
  timeline:     string | null
  score:        number
  lastActivity: string | null
  status:       string | null
}

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ data: null, error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const { lead, agentContext, outputType } = await req.json() as {
    lead:         LeadContext
    agentContext: string   // what the agent typed: "called yesterday, interested in 3BHK..."
    outputType:   'whatsapp' | 'email'
  }

  if (!agentContext?.trim()) {
    return NextResponse.json({ data: null, error: 'agentContext is required' }, { status: 400 })
  }

  const isWhatsApp = outputType === 'whatsapp'

  const systemPrompt = `You are an expert real estate sales assistant helping Indian real estate agents write follow-up messages to their leads.
You know the Indian real estate market deeply — common localities, typical timelines, INR budgets, builder names, BHK terminology, etc.
Write in a warm, professional, conversational tone. Be personal — use the lead's first name.
For WhatsApp: Keep it under 3 sentences. Casual but professional. End with a clear next step or question. No formal salutations. Use ₹ for currency.
For Email: 3-5 sentences. Subject line first (on its own line prefixed with "Subject: "), then the body. Professional but warm. Close with "Best regards," and a signature placeholder.
Do NOT use generic filler phrases like "Hope this message finds you well" or "As per our conversation".
Write ONLY the message — no explanation, no labels, no markdown.`

  const userPrompt = `Lead Details:
- Name: ${lead.name}
- City: ${lead.city ?? 'Not specified'}
- Budget: ${lead.budget ?? 'Not specified'}
- Property Type: ${lead.propertyType ?? 'Not specified'}
- Timeline: ${lead.timeline ?? 'Not specified'}
- Current Status: ${lead.status ?? 'New'}
- Intent Score: ${lead.score}/100
- Last Activity: ${lead.lastActivity ?? 'No prior contact'}

What the agent says happened / context:
${agentContext}

Write a ${isWhatsApp ? 'WhatsApp' : 'Email'} follow-up message for this lead.`

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: userPrompt }],
      system:     systemPrompt,
    })

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    return NextResponse.json({ data: { message: text, outputType }, error: null })
  } catch (err) {
    console.error('[POST /api/ai/followup-writer]', err)
    return NextResponse.json({ data: null, error: 'AI generation failed' }, { status: 500 })
  }
}
