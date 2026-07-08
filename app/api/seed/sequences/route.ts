import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

const DEMO_SEQUENCES = [
  {
    name: 'New Lead — 7 Day Nurture',
    description: 'Auto follow-up for fresh inbound leads from portals',
    active: true,
    steps: [
      {
        step_order: 0, delay_days: 0, channel: 'whatsapp',
        message_body: `Hi {{name}}! Thank you for your interest in properties in {{city}}. I'm your dedicated advisor from RealEdge. Could you share your preferred configuration (2BHK/3BHK) and exact budget? I'll shortlist the best available options for you right away.`,
      },
      {
        step_order: 1, delay_days: 0, channel: 'call_reminder',
        message_body: 'Intro call — qualify budget, timeline, and preferred localities. Aim to call within 60 minutes of lead arriving.',
      },
      {
        step_order: 2, delay_days: 2, channel: 'whatsapp',
        message_body: `Hi {{name}}, I've shortlisted 3 properties matching your requirements in {{city}}. These are within your budget and ready-to-move. Would you like me to share the details? I can also schedule a site visit this weekend at your convenience.`,
      },
      {
        step_order: 3, delay_days: 3, channel: 'call_reminder',
        message_body: 'Second call — check if they saw shortlist, handle objections, push for site visit booking.',
      },
      {
        step_order: 4, delay_days: 7, channel: 'whatsapp',
        message_body: `Hi {{name}}, quick check-in! Property prices in {{city}} are up 8% this quarter. The units I shortlisted are still available but inventory is moving fast. If you're planning to buy in the next 3-6 months, now is a great time to act. Want me to set up a site visit this weekend?`,
      },
    ],
  },
  {
    name: 'Site Visit Follow-up',
    description: 'Nurture leads after a site visit — push them from visit to token',
    active: true,
    steps: [
      {
        step_order: 0, delay_days: 0, channel: 'whatsapp',
        message_body: `Hi {{name}}, thank you for visiting today! Hope you liked the property. Feel free to share any questions about the unit, pricing, or payment plan — I'm here to help. Looking forward to hearing your thoughts!`,
      },
      {
        step_order: 1, delay_days: 1, channel: 'call_reminder',
        message_body: 'Post-visit call — get feedback, address objections on price/location/size, check family discussion status.',
      },
      {
        step_order: 2, delay_days: 3, channel: 'whatsapp',
        message_body: `Hi {{name}}, following up after your visit! The unit you saw has 2 other serious enquiries. The developer is also offering a special payment plan — 10:20:70 (booking:slab:possession). Shall we discuss over a quick call?`,
      },
      {
        step_order: 3, delay_days: 7, channel: 'whatsapp',
        message_body: `Hi {{name}}, the developer has an early-bird discount valid only until end of this month. Token is just ₹1L and the rest can be spread over 18 months. This is one of the best plans they've offered — I'd love to help you lock this in before it closes!`,
      },
    ],
  },
  {
    name: 'Cold Lead Re-engagement',
    description: 'Win back leads who went silent for 30+ days',
    active: true,
    steps: [
      {
        step_order: 0, delay_days: 0, channel: 'whatsapp',
        message_body: `Hi {{name}}, hope you're doing well! We connected a while back about your property search in {{city}}. The market has moved significantly since then — some of the units I had shortlisted for you have already sold. I have fresh inventory matching your requirements. Would you like me to share?`,
      },
      {
        step_order: 1, delay_days: 7, channel: 'whatsapp',
        message_body: `Hi {{name}}, quick update — home loan rates are at 8.6-9% right now, which means EMI on ₹1Cr is only ₹87,500/month. If you've been waiting for the right time, this is it. I can also connect you with a loan advisor to check eligibility in 15 minutes. Interested?`,
      },
      {
        step_order: 2, delay_days: 7, channel: 'call_reminder',
        message_body: 'Final re-engagement call — offer a no-pressure 10-min consultation. If no answer after this, mark as lost.',
      },
    ],
  },
]

export async function POST() {
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  // Clear existing sequences
  await sb.from('sequence_steps').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await sb.from('sequences').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  let inserted = 0
  for (const seq of DEMO_SEQUENCES) {
    const { steps, ...seqData } = seq
    const { data: newSeq, error } = await sb.from('sequences').insert(seqData).select().single()
    if (error || !newSeq) continue

    await sb.from('sequence_steps').insert(
      steps.map(s => ({ ...s, sequence_id: newSeq.id }))
    )
    inserted++
  }

  return NextResponse.json({ inserted }, { status: 201 })
}
