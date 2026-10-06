import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { addDays } from 'date-fns'
import { createNotification } from '@/lib/notifications'

// Same merge tags the Sequences builder offers: {{name}} {{city}} {{budget}}
function personalise(text: string, lead: { name?: string | null; city?: string | null; budget_max?: number | null }) {
  const first  = (lead.name ?? '').trim().split(/\s+/)[0] || 'there'
  const budget = lead.budget_max
    ? lead.budget_max >= 1e7 ? `₹${(lead.budget_max / 1e7).toFixed(1).replace(/\.0$/, '')} Cr` : `₹${Math.round(lead.budget_max / 1e5)} L`
    : 'your budget'
  return text
    .replace(/\{\{\s*name\s*\}\}/gi, first)
    .replace(/\{\{\s*city\s*\}\}/gi, lead.city ?? 'your city')
    .replace(/\{\{\s*budget\s*\}\}/gi, budget)
}

function verifyCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return null
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const authErr = verifyCronSecret(req)
  if (authErr) return authErr

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ fired: 0, error: 'Supabase not configured' })

  // Find all active enrollments whose next_fire_at has passed
  const { data: due, error } = await sb
    .from('sequence_enrollments')
    .select('*, sequences(id, name, active)')
    .eq('status', 'active')
    .lte('next_fire_at', new Date().toISOString())
    .limit(50)

  if (error) return NextResponse.json({ fired: 0, error: error.message })

  let fired = 0

  for (const enrollment of due ?? []) {
    try {
      // A paused sequence holds its enrollments where they are until it is switched back on
      if (enrollment.sequences?.active === false) continue

      // Get the specific step to fire
      const { data: steps } = await sb
        .from('sequence_steps')
        .select('*')
        .eq('sequence_id', enrollment.sequence_id)
        .order('step_order', { ascending: true })

      if (!steps?.length) continue

      const stepToFire = steps[enrollment.current_step]
      if (!stepToFire) {
        // All steps done — mark complete
        await sb.from('sequence_enrollments').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          stopped_reason: 'finished',
        }).eq('id', enrollment.id)
        continue
      }

      // Fire the step
      if (stepToFire.channel === 'whatsapp' && enrollment.lead_phone && process.env.INTERAKT_API_KEY) {
        const phone = enrollment.lead_phone.replace(/\D/g, '').replace(/^0/, '91').replace(/^(?!91)/, '91')
        await fetch('https://api.interakt.ai/v1/public/message/', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(process.env.INTERAKT_API_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            countryCode: '+91',
            phoneNumber: phone,
            callbackData: `seq:${enrollment.id}:step:${enrollment.current_step}`,
            type: 'Template',
            template: { name: stepToFire.template_name, languageCode: 'en' },
          }),
        }).catch(() => {})
      }

      // Email step: subject is stored in template_name, body in message_body
      const resendKey = process.env.RESEND_API_KEY
      if (stepToFire.channel === 'email' && resendKey && resendKey !== 'YOUR_RESEND_API_KEY' && stepToFire.message_body) {
        const { data: lead } = await sb
          .from('leads')
          .select('name, email, city, budget_max, status')
          .eq('id', enrollment.lead_id)
          .single()

        if (lead?.email) {
          const subject  = personalise(stepToFire.template_name || 'Following up', lead)
          const body     = personalise(stepToFire.message_body, lead)
          const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@leadgap.com'
          const fromName  = process.env.RESEND_FROM_NAME  ?? 'LeadGap CRM'
          const { Resend } = await import('resend')
          const { error: sendErr } = await new Resend(resendKey).emails.send({
            from:    `${fromName} <${fromEmail}>`,
            to:      lead.name ? `${lead.name} <${lead.email}>` : lead.email,
            subject,
            html:    body.replace(/\n/g, '<br/>'),
            text:    body,
          })
          if (!sendErr) {
            await sb.from('lead_activities').insert({
              lead_id:       enrollment.lead_id,
              activity_type: 'Email Sent',
              activity_data: { notes: `Sequence: ${enrollment.sequences?.name ?? ''} · ${subject}`, outcome: 'Sent', subject },
            })
            // Same rule as logging an email by hand: a New lead becomes Cold
            if ((lead.status ?? 'New') === 'New') {
              await sb.from('leads').update({ status: 'Cold' }).eq('id', enrollment.lead_id)
            }
          } else {
            console.error(`[seq cron] email for enrollment ${enrollment.id} failed:`, sendErr.message)
          }
        }
      }

      if (stepToFire.channel === 'call_reminder') {
        await createNotification({
          type:   'follow_up_due',
          title:  `Call reminder: ${enrollment.lead_name ?? 'Lead'}`,
          body:   stepToFire.message_body ?? `Time to call ${enrollment.lead_name} — sequence step ${enrollment.current_step + 1}`,
          leadId: enrollment.lead_id,
        }).catch(() => {})
      }

      // Advance to next step
      const nextStepIndex = enrollment.current_step + 1
      const nextStep      = steps[nextStepIndex]

      if (nextStep) {
        const nextFireAt = addDays(new Date(), nextStep.delay_days).toISOString()
        await sb.from('sequence_enrollments').update({
          current_step: nextStepIndex,
          next_fire_at: nextFireAt,
        }).eq('id', enrollment.id)
      } else {
        // Last step just fired — complete
        await sb.from('sequence_enrollments').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          stopped_reason: 'finished',
        }).eq('id', enrollment.id)
      }

      fired++
    } catch (e) {
      console.error(`[seq cron] enrollment ${enrollment.id} failed:`, e)
    }
  }

  return NextResponse.json({ fired, checked: due?.length ?? 0 })
}
