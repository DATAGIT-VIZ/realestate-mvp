/**
 * POST /api/whatsapp/send
 *
 * Sends a WhatsApp template message via Interakt, then logs it as an Activity in Twenty.
 *
 * Body:
 * {
 *   leadId: string              — Twenty contact ID (for activity logging)
 *   to: string                  — recipient phone (10-digit or +91…)
 *   templateName: string        — Interakt template name (must exist in your Interakt account)
 *   variables?: string[]        — ordered list of variable values for the template body
 *   headerVariables?: string[]  — variables for the header (if template has one)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { gql } from '@/lib/twenty'
import { normalisePhone } from '@/lib/dedup'

const INTERAKT_BASE = 'https://api.interakt.ai/v1/public/message/'

export type WASendBody = {
  leadId: string
  to: string
  templateName: string
  variables?: string[]
  headerVariables?: string[]
  brochureUrl?: string
  brochureName?: string
}

async function sendViaInterakt(to: string, templateName: string, variables: string[], headerVariables: string[]) {
  const apiKey = process.env.INTERAKT_API_KEY
  if (!apiKey) throw new Error('INTERAKT_API_KEY is not configured')

  const phone = normalisePhone(to)
  if (phone.length !== 10) throw new Error(`Invalid phone number: ${to}`)

  const body: Record<string, unknown> = {
    countryCode: '+91',
    phoneNumber: phone,
    callbackData: 'vyapulse-crm',
    type: 'Template',
    template: {
      name: templateName,
      languageCode: 'en',
      ...(headerVariables.length > 0 && {
        headerValues: headerVariables,
      }),
      ...(variables.length > 0 && {
        bodyValues: variables,
      }),
    },
  }

  const res = await fetch(INTERAKT_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Interakt API ${res.status}: ${text}`)
  }

  return res.json()
}

async function logActivityInTwenty(leadId: string, templateName: string, to: string, variables: string[]) {
  const createNote = /* GraphQL */ `
    mutation CreateNote($data: NoteCreateInput!) {
      createNote(data: $data) { id createdAt }
    }
  `
  const noteResult = await gql<{ createNote: { id: string; createdAt: string } }>(createNote, {
    data: {
      title: 'WhatsApp Sent',
      body: JSON.stringify({
        notes: `Sent template: ${templateName}`,
        outcome: 'Positive',
        metadata: { templateName, to, variables },
      }),
    },
  })

  if (noteResult.errors?.length || !noteResult.data?.createNote.id) return

  const noteId = noteResult.data.createNote.id
  await gql(`
    mutation CreateNoteTarget($data: NoteTargetCreateInput!) {
      createNoteTarget(data: $data) { id }
    }
  `, { data: { noteId, personId: leadId } })
}

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const body: WASendBody = await req.json()
    const { leadId, to, templateName, variables = [], headerVariables = [], brochureUrl, brochureName } = body

    if (!leadId || !to || !templateName) {
      return NextResponse.json({ data: null, error: 'leadId, to, and templateName are required' }, { status: 400 })
    }

    const interaktResponse = await sendViaInterakt(to, templateName, variables, headerVariables)

    // If brochure attached, send it as a document message after the template
    if (brochureUrl) {
      const phone = normalisePhone(to)
      const apiKey = process.env.INTERAKT_API_KEY
      if (apiKey && phone.length === 10) {
        await fetch(INTERAKT_BASE, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            countryCode: '+91',
            phoneNumber: phone,
            callbackData: 'brochure',
            type: 'document',
            data: {
              url: brochureUrl,
              caption: brochureName ?? 'Property Brochure',
              filename: (brochureName ?? 'brochure').replace(/\s+/g, '_') + '.pdf',
            },
          }),
        }).catch(err => console.error('[WhatsApp brochure send]', err))
      }
    }

    // Log activity (fire-and-forget)
    logActivityInTwenty(leadId, templateName, to, variables).catch(err =>
      console.error('[WhatsApp activity log]', err)
    )

    return NextResponse.json({
      data: { sent: true, interaktResponse },
      error: null,
    })
  } catch (err) {
    console.error('[POST /api/whatsapp/send]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Failed to send WhatsApp message' },
      { status: 500 }
    )
  }
}
