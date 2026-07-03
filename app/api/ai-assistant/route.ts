import { NextRequest, NextResponse } from 'next/server'
import Bytez from 'bytez.js'

// Use Node.js runtime (bytez.js is not edge-compatible)
export const runtime = 'nodejs'

interface Message {
    role: 'user' | 'assistant' | 'system'
    content: string
}

interface BusinessContext {
    totalLeads: number
    hotLeadsCount: number
    hotPipelineValue: string
    avgConversionDays: number
    responseRate: number
    activityDensity: string
    totalActivities: number
    topSource: string
    topSourceRate: number
    bestActivity: string
    bestActivityRate: number
    hotTrend: number
}

function buildSystemPrompt(ctx: BusinessContext): string {
    return `You are an expert real estate business advisor and market analyst, specializing in the Indian real estate market. You are embedded inside a real estate CRM dashboard and have full access to the agent's live business metrics.

## Your Agent's Live Business Data
- **Total Leads:** ${ctx.totalLeads}
- **Hot Leads (score ≥ 70):** ${ctx.hotLeadsCount}
- **Hot Pipeline Value:** ${ctx.hotPipelineValue}
- **Hot Lead Trend (vs last week):** ${ctx.hotTrend >= 0 ? '+' : ''}${ctx.hotTrend}%
- **Average Days to Convert (first contact → hot):** ${ctx.avgConversionDays} days
- **Response Rate (within 24h):** ${ctx.responseRate}%
- **Activity Density:** ${ctx.activityDensity} activities per lead
- **Total Activities Logged:** ${ctx.totalActivities}
- **Best Lead Source:** ${ctx.topSource} (${ctx.topSourceRate}% conversion)
- **Most Effective Activity:** ${ctx.bestActivity} (${ctx.bestActivityRate}% hot conversion rate)

## Indian Real Estate Market Intelligence (March 2026)
- **Residential market:** Demand remains strong in Tier-1 cities (Mumbai, Bangalore, Delhi NCR, Hyderabad, Pune). Luxury segment (₹2–5Cr) is surging +22% YoY.
- **Key micro-markets performing well:** Whitefield & Sarjapur (Bangalore), Powai & Thane (Mumbai), Gurgaon Golf Course Road, Hyderabad's Financial District and Gachibowli.
- **Buyer behavior:** 78% of buyers research online 3–6 months before visiting. WhatsApp is 2x more effective than email for follow-ups in India.
- **Interest rates:** RBI policy repo rate steady at 6.5%. Most banks offering home loans at 8.6–9.25% for salaried buyers.
- **NRI demand:** Up 31% YoY, driven by favorable INR exchange rate and upcoming RERA compliance push.
- **Emerging trend:** Co-living and compact apartments (under ₹60L) seeing strong demand from IT workforce in Bangalore and Hyderabad.
- **Commercial real estate:** Grade-A office absorption recovering; warehousing/logistics booming with 18% YoY growth driven by e-commerce.
- **Regulatory:** RERA compliance now mandatory across all states. Developers with RERA-registered projects seeing 40% faster sales cycles.
- **Seasonal patterns:** Q1 (Jan–Mar) historically strong due to year-end bonuses and tax-saving investments. Q3 (Jul–Sep) tends to be slower due to monsoon.
- **Payment plan trends:** Flexi-payment and construction-linked plans are most preferred by buyers; 45:45:10 (booking:during:possession) is the most accepted structure.

## How to Answer
- **Reference the user's actual data** whenever relevant (hot leads count, pipeline, conversion rate, top source, etc.)
- **Be specific and actionable** — give concrete next steps, not generic advice
- **Use INR formatting** (₹ symbol, L for lakhs, Cr for crores)
- **Keep answers concise but complete** — use bullet points for action items
- **Real estate expertise**: You know buyer psychology, negotiation tactics, objection handling, and market timing deeply
- **If asked about trends**, always tie them back to what the agent should do differently

Today's date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

export async function POST(req: NextRequest) {
    try {
        const { messages, context }: { messages: Message[]; context: BusinessContext } = await req.json()

        const apiKey = process.env.BYTEZ_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Bytez API key not configured. Add BYTEZ_API_KEY to .env.local' },
                { status: 500 }
            )
        }

        // Build the full message list with the system prompt injected as first message
        const systemPrompt = buildSystemPrompt(context)
        const fullMessages: Message[] = [
            { role: 'system', content: systemPrompt },
            ...messages,
        ]

        // Initialize Bytez SDK and run the model
        // NOTE: openai/gpt-4o-mini is CLOSED on Bytez free tier
        // openai/gpt-oss-20b is OPEN on free tier
        const sdk = new Bytez(apiKey)
        const model = sdk.model('openai/gpt-oss-20b')

        const { error, output } = await model.run(fullMessages)

        if (error) {
            console.error('Bytez API error:', error)
            return NextResponse.json(
                { error: `AI model error: ${JSON.stringify(error)}` },
                { status: 500 }
            )
        }

        // Extract the text reply from the output
        // Bytez returns output as an array or string depending on the model
        let replyText = ''
        if (typeof output === 'string') {
            replyText = output
        } else if (Array.isArray(output)) {
            // Chat completion style: output[0].message.content or output[0].generated_text
            const first = output[0]
            if (first?.message?.content) {
                replyText = first.message.content
            } else if (first?.generated_text) {
                replyText = first.generated_text
            } else {
                replyText = JSON.stringify(first)
            }
        } else if (output && typeof output === 'object') {
            // Sometimes returned as { message: { content: '...' } }
            const o = output as Record<string, unknown>
            if (o.message && typeof (o.message as Record<string, unknown>).content === 'string') {
                replyText = (o.message as Record<string, unknown>).content as string
            } else if (typeof o.content === 'string') {
                replyText = o.content as string
            } else {
                replyText = JSON.stringify(output)
            }
        }

        return NextResponse.json({ content: replyText })
    } catch (err) {
        console.error('AI assistant error:', err)
        return NextResponse.json(
            { error: `Internal server error: ${err instanceof Error ? err.message : String(err)}` },
            { status: 500 }
        )
    }
}
