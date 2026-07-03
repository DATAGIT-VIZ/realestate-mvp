import { NextRequest, NextResponse } from 'next/server'
import Bytez from 'bytez.js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Text content is required' },
                { status: 400 }
            )
        }

        const apiKey = process.env.BYTEZ_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Bytez API key not configured' },
                { status: 500 }
            )
        }

        const systemPrompt = `You are a real estate CRM data extraction assistant. Your job is to extract lead information from the provided email, SMS, or WhatsApp message and return ONLY a structured JSON object.

Extract the following fields if they exist in the text:
- name: Full name of the person (string)
- phone: Phone number (string)
- email: Email address (string)
- source: Where the message seems to come from (e.g. "Email", "WhatsApp", "SMS", "Direct")
- property_type: What kind of property they want (e.g. "2BHK", "Villa", "Commercial")
- budget_min: Minimum budget in raw numbers (e.g., if they say "1Cr", it means 10000000) (number or null)
- budget_max: Maximum budget in raw numbers (e.g., if they say "2.5Cr", it means 25000000) (number or null)
- timeline: When they are looking to buy (e.g., "Immediate", "1-3 months", "Next year") (string or null)
- locations: Only specific locations mentioned (array of strings or null)

If a field is not found in the text, omit it or set it to null.
DO NOT include any markdown formatting like \`\`\`json. Return ONLY valid JSON. Return at most one JSON object.`

        const sdk = new Bytez(apiKey)
        const model = sdk.model('openai/gpt-oss-20b')

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
        ]

        const { error, output } = await model.run(messages)

        if (error) {
            console.error('Bytez AI Error:', error)
            return NextResponse.json(
                { error: 'Failed to process AI request' },
                { status: 500 }
            )
        }

        let replyText = ''
        if (typeof output === 'string') {
            replyText = output
        } else if (Array.isArray(output)) {
            const first = output[0]
            replyText = first?.message?.content || first?.generated_text || ''
        } else if (output && typeof output === 'object') {
            const o = output as any
            replyText = o.message?.content || o.content || ''
        }

        // Clean up markdown code blocks if the AI ignored the instruction
        replyText = replyText.replace(/```json/g, '').replace(/```/g, '').trim()

        try {
            const parsedJson = JSON.parse(replyText)
            return NextResponse.json(parsedJson)
        } catch (parseError) {
            console.error('Failed to parse AI output as JSON:', replyText)
            return NextResponse.json(
                { error: 'AI returned invalid data format' },
                { status: 500 }
            )
        }

    } catch (err: any) {
        console.error('Email Parse Error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
