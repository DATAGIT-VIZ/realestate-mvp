import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { addDays } from 'date-fns'
import { createNotification } from '@/lib/notifications'

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
    .select('*, sequences(id, name), sequence_steps!inner(*)')
    .eq('status', 'active')
    .lte('next_fire_at', new Date().toISOString())
    .limit(50)

  if (error) return NextResponse.json({ fired: 0, error: error.message })

  let fired = 0

  for (const enrollment of due ?? []) {
    try {
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
