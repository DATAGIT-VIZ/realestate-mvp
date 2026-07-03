import { NextResponse } from 'next/server'

export async function GET() {
  const configured = !!(
    process.env.EXOTEL_SID &&
    process.env.EXOTEL_API_KEY &&
    process.env.EXOTEL_API_TOKEN &&
    process.env.EXOTEL_PHONE
  )
  return NextResponse.json({ configured })
}
