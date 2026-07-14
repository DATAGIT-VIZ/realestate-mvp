import { NextResponse } from 'next/server'

export async function GET() {
  const configured = !!(
    process.env.EXOTEL_SID?.trim() &&
    process.env.EXOTEL_API_KEY?.trim() &&
    process.env.EXOTEL_API_TOKEN?.trim() &&
    process.env.EXOTEL_PHONE?.trim()
  )
  return NextResponse.json({ configured })
}
