import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { to, toName, subject, body, leadId } = await req.json()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey === 'YOUR_RESEND_API_KEY') {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@vyapulse.com'
  const fromName  = process.env.RESEND_FROM_NAME  ?? 'Vya Pulse CRM'

  let resendId: string | null = null
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to:   toName ? `${toName} <${to}>` : to,
      subject,
      html: body.replace(/\n/g, '<br/>'),
      text: body,
    })
    if (error) throw new Error(error.message)
    resendId = data?.id ?? null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Send failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Log activity on the lead (non-fatal if it fails)
  if (leadId) {
    try {
      const supabase = getAdminClient()
      if (supabase) {
        await supabase.from('crm_activities').insert({
          lead_id:        leadId,
          type:           'Email Sent',
          notes:          `Subject: ${subject}`,
          outcome:        'Sent',
          follow_up_date: null,
          metadata:       { resend_id: resendId, to, subject },
        })
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ success: true, resendId })
}
