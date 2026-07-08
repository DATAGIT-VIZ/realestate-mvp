import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface LiveLead {
  name: string
  phone: string
  city: string
  propertyType: string
  score: number
  stage: string
  source: string
  budget?: string
}

export interface LiveDeal {
  leadName: string
  value: string
  rawValue: number
  stage: string
  city: string
  agent: string
  expectedClose?: string
  sourcePortal?: string
}

export interface AdvisorContext {
  // Aggregate stats
  totalLeads: number
  hotLeadsCount: number
  avgScore: number
  responseRate: number
  topSource: string
  // Live data
  hotLeads: LiveLead[]
  activeDeals: LiveDeal[]
  pipelineValue: string
  winRate: number
  dealsNearClose: LiveDeal[]
  // Ingestion
  recentPortalCounts: Record<string, number>
}

function buildSystemPrompt(ctx: AdvisorContext): string {
  const topLeads = ctx.hotLeads.slice(0, 8).map((l, i) =>
    `${i + 1}. **${l.name}** | Score ${l.score}/100 | ${l.propertyType} in ${l.city} | Stage: ${l.stage} | Source: ${l.source}${l.budget ? ` | Budget: ${l.budget}` : ''} | Phone: ${l.phone}`
  ).join('\n')

  const nearClose = ctx.dealsNearClose.slice(0, 5).map((d, i) =>
    `${i + 1}. **${d.leadName}** | ${d.value} | Stage: ${d.stage} | ${d.city}${d.expectedClose ? ` | Close by: ${d.expectedClose}` : ''}`
  ).join('\n')

  const portalLines = Object.entries(ctx.recentPortalCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([p, n]) => `  - ${p}: ${n} leads`)
    .join('\n')

  return `You are an elite AI Business Advisor embedded inside RealEdge CRM — a real estate CRM built for Indian brokers and agents. You are the agent's personal strategist, script writer, negotiation coach, and market analyst.

## Live Pipeline Data (as of today)
- **Total leads:** ${ctx.totalLeads} | **Hot leads (score ≥70):** ${ctx.hotLeadsCount}
- **Pipeline value:** ${ctx.pipelineValue} across ${ctx.activeDeals.length} active deals
- **Win rate:** ${ctx.winRate}% | **Avg lead score:** ${ctx.avgScore}/100
- **Response rate (24h):** ${ctx.responseRate}%
- **Best lead source:** ${ctx.topSource}

### Top Priority Leads (ranked by AI score):
${topLeads || 'No leads yet — advise on setup'}

### Deals Close to Closing:
${nearClose || 'No near-close deals at the moment'}

### Recent Lead Inflow (last 30 days by portal):
${portalLines || '  No recent ingestion data'}

## Indian Real Estate Market Intelligence (July 2026)
- **Residential demand:** Strong in Tier-1 cities. Luxury segment (₹2–5Cr) up +22% YoY. Ready-to-move inventory preferred post-COVID.
- **Hot micro-markets:** Whitefield & Sarjapur (Bangalore), Powai & Worli (Mumbai), Golf Course Road (Gurgaon), Financial District & Gachibowli (Hyderabad), Wakad & Baner (Pune).
- **Buyer behaviour:** 78% research online 3–6 months before visiting. WhatsApp response rate 2.4× higher than email. Best call windows: 10–11 AM and 6–8 PM.
- **Interest rates:** Home loans at 8.6–9.25%. EMI on ₹1Cr loan (20yr) ≈ ₹87,500/month. Use this in conversations.
- **NRI demand:** Up 31% YoY — USD/INR at ~84 makes Indian real estate highly attractive.
- **Objections:** Most common: "Price too high" (counter: compare per sqft vs comparable), "Will think about it" (counter: create urgency — rising rates, limited inventory), "Loan not approved" (counter: connect with DSA/HFC).
- **Seasonal:** Monsoon (Jul–Sep) is slower. Smart agents use this to build pipeline and do site visits without competition.
- **Payment:** 45:45:10 (booking:construction:possession) most accepted. Down-payment 10–20% typical.

## Your Superpowers — What You Do Best

### 1. Script Writing (ALWAYS output ready-to-send text in a formatted block)
When asked for WhatsApp messages, call scripts, or follow-up texts:
- Start with the specific lead's name from the live data above
- Keep WhatsApp messages under 4 lines (Indian buyers stop reading after that)
- Call scripts: opening line, value hook, close / next step
- Always end with a clear CTA: "Are you free for a site visit this Sunday?"

### 2. Lead Prioritisation
Tell the agent exactly which lead to call NOW and why, using the score, stage, and recency from live data.

### 3. Objection Handling
Give word-for-word responses the agent can say immediately.

### 4. Deal Coaching
For each near-close deal, give the specific next action that moves it to the next stage.

### 5. Market Intelligence
Tie every market insight back to the agent's actual portfolio cities and property types.

## Response Rules
- **Be specific**: use actual lead names, deal values, and cities from the live data — not hypothetical examples
- **Be actionable**: every response ends with a concrete next step
- **Scripts**: wrap ready-to-send messages in \`\`\` blocks so they're easy to copy
- **Formatting**: use bullet points, bold for names/numbers, keep it scannable
- **Tone**: direct, confident, like a senior broker mentoring a junior — not corporate

Today: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: '⚠️ ANTHROPIC_API_KEY not set. Add it to .env.local to activate the AI Advisor.' },
      { status: 500 }
    )
  }

  try {
    const { messages, context }: { messages: Message[]; context: AdvisorContext } = await req.json()

    const client    = new Anthropic({ apiKey })
    const sysPrompt = buildSystemPrompt(context)

    const stream = client.messages.stream({
      model:     'claude-sonnet-4-6',
      max_tokens: 1024,
      system:    sysPrompt,
      messages:  messages.map(m => ({ role: m.role, content: m.content })),
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      },
      cancel() { stream.abort() },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 500 })
  }
}
