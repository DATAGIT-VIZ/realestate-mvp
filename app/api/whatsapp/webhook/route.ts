/**
 * POST /api/whatsapp/webhook
 *
 * Interakt fires this webhook on message events:
 *   - sent, delivered, read (delivery status updates)
 *   - user reply received
 *
 * Interakt webhook docs: https://developers.interakt.ai/reference/webhooks
 *
 * Configure in Interakt: Settings → Webhooks → URL = https://yourapp.com/api/whatsapp/webhook
 */

import { NextRequest, NextResponse } from 'next/server'
import { gql } from '@/lib/twenty'
import { normalisePhone } from '@/lib/dedup'
import { LEAD_FIELDS, type CRMLead } from '@/lib/twenty'

type InteraktEvent = {
  type: 'message_status' | 'user_message'
  data: {
    message?: {
      id: string
      status?: 'sent' | 'delivered' | 'read' | 'failed'
    }
    customer?: {
      phone_number: string
      name?: string
    }
    // User reply fields
    text?: string
    type?: string
  }
}

async function findLeadByPhone(phone: string): Promise<string | null> {
  const norm = normalisePhone(phone)
  const result = await gql<{ people: { edges: { node: CRMLead }[] } }>(`
    query FindByPhone($phone: StringFilter) {
      people(filter: { phones: { primaryPhoneNumber: $phone } }, first: 1) {
        edges { node { ${LEAD_FIELDS} } }
      }
    }
  `, { phone: { eq: norm } })

  return result.data?.people.edges[0]?.node.id ?? null
}

async function logReplyActivity(leadId: string, replyText: string, from: string) {
  const createNote = /* GraphQL */ `
    mutation CreateNote($data: NoteCreateInput!) {
      createNote(data: $data) { id }
    }
  `
  const noteResult = await gql<{ createNote: { id: string } }>(createNote, {
    data: {
      title: 'WhatsApp Received',
      body: JSON.stringify({
        notes: replyText,
        outcome: 'Positive',
        metadata: { from, channel: 'whatsapp', type: 'reply' },
      }),
    },
  })

  const noteId = noteResult.data?.createNote.id
  if (!noteId) return

  await gql(`
    mutation CreateNoteTarget($data: NoteTargetCreateInput!) {
      createNoteTarget(data: $data) { id }
    }
  `, { data: { noteId, personId: leadId } })
}

export async function POST(req: NextRequest) {
  try {
    const event: InteraktEvent = await req.json()

    // Interakt sends a GET for webhook verification — return 200 with the token
    if (!event || !event.type) {
      return NextResponse.json({ ok: true })
    }

    if (event.type === 'user_message') {
      const phone = event.data.customer?.phone_number
      const text  = event.data.text

      if (phone && text) {
        const leadId = await findLeadByPhone(phone)
        if (leadId) {
          await logReplyActivity(leadId, text, phone)
        }
        // If lead not found, no action — we don't auto-create from a WhatsApp reply
      }
    }

    // message_status events (sent/delivered/read/failed) — no action needed right now
    // Future: update last known delivery status on the activity record

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/whatsapp/webhook]', err)
    // Always return 200 to Interakt so it doesn't keep retrying
    return NextResponse.json({ ok: true })
  }
}

// Interakt webhook verification: GET with ?hub.challenge=<token>
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new Response(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}
