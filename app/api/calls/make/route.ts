/**
 * POST /api/calls/make
 * Initiates a click-to-call via Exotel.
 * Exotel dials EXOTEL_PHONE (agent's number) first, then connects to the lead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const { to, leadName } = await req.json()
  if (!to) return NextResponse.json({ error: 'to is required' }, { status: 400 })

  const sid      = process.env.EXOTEL_SID?.trim()
  const apiKey   = process.env.EXOTEL_API_KEY?.trim()
  const apiToken = process.env.EXOTEL_API_TOKEN?.trim()
  const from     = process.env.EXOTEL_PHONE?.trim()

  if (!sid || !apiKey || !apiToken || !from) {
    // Dev simulation — Exotel not configured yet
    console.log(`[calls/make] SIMULATED call to ${leadName} (${to})`)
    return NextResponse.json({ ok: true, simulated: true, to, leadName })
  }

  // Exotel uses 0xxxxxxxxxx format for Indian numbers
  const digits = to.replace(/\D/g, '')
  const exoNum = digits.length === 10 ? `0${digits}` : digits

  const body = new URLSearchParams({
    From:           from,
    To:             exoNum,
    CallerId:       from,
    StatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/webhook`,
  })

  const auth = Buffer.from(`${apiKey}:${apiToken}`).toString('base64')
  const url  = `https://api.exotel.com/v1/Accounts/${sid}/Calls/connect`

  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[calls/make] Exotel error:', err)
    return NextResponse.json({ error: 'Exotel call failed', detail: err }, { status: 502 })
  }

  return NextResponse.json({ ok: true, to: exoNum, leadName })
}
