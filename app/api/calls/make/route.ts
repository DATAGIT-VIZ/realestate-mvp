import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { initiateCall, exotelConfigured } from '@/lib/exotel'

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  if (!exotelConfigured()) {
    return NextResponse.json({ data: null, error: 'Exotel not configured' }, { status: 503 })
  }

  const { leadId, leadPhone, agentPhone } = await req.json() as {
    leadId:     string
    leadPhone:  string
    agentPhone: string
  }

  if (!leadPhone || !agentPhone || !leadId) {
    return NextResponse.json({ data: null, error: 'leadId, leadPhone and agentPhone are required' }, { status: 400 })
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const callbackUrl = `${appUrl}/api/calls/webhook?leadId=${leadId}`

    const result = await initiateCall({ agentPhone, leadPhone, callbackUrl })
    return NextResponse.json({ data: result, error: null })
  } catch (err) {
    console.error('[POST /api/calls/make]', err)
    return NextResponse.json({ data: null, error: 'Failed to initiate call' }, { status: 500 })
  }
}
