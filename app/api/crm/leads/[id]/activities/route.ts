import { NextRequest, NextResponse } from 'next/server'
import { gql } from '@/lib/twenty'
import { requireAuth } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'

// Activity types we support
export type ActivityType =
  | 'Call Made'
  | 'Call Missed'
  | 'WhatsApp Sent'
  | 'WhatsApp Received'
  | 'Email Sent'
  | 'Email Received'
  | 'Note'
  | 'Status Changed'
  | 'Site Visit Scheduled'
  | 'Site Visit Done'
  | 'Follow Up Set'

export type ActivityPayload = {
  type: ActivityType
  notes?: string
  outcome?: string
  duration?: number        // call duration in seconds
  nextActionDate?: string  // ISO date
  metadata?: Record<string, unknown>
}

// Activities are stored as Notes in Twenty, linked to the Person via NoteTarget
// Title = activity type, body = JSON payload

// ─── GET /api/crm/leads/[id]/activities ──────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const { id } = await params

    const query = /* GraphQL */ `
      query GetLeadActivities($filter: NoteTargetFilterInput) {
        noteTargets(
          filter: $filter
          orderBy: [{ note: { createdAt: DescNullsLast } }]
          first: 100
        ) {
          edges {
            node {
              note {
                id
                title
                body
                createdAt
                updatedAt
              }
            }
          }
          totalCount
        }
      }
    `

    const result = await gql<{
      noteTargets: {
        edges: {
          node: {
            note: {
              id: string
              title: string
              body: string | null
              createdAt: string
              updatedAt: string
            }
          }
        }[]
        totalCount: number
      }
    }>(query, {
      filter: { personId: { eq: id } },
    })

    if (result.errors?.length) {
      return NextResponse.json({ data: null, error: result.errors[0].message }, { status: 400 })
    }

    const activities = result.data?.noteTargets.edges
      .map(e => {
        const note = e.node.note
        let parsed: ActivityPayload | null = null
        try {
          parsed = JSON.parse(note.body ?? '{}')
        } catch {
          parsed = null
        }
        return {
          id: note.id,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          ...(parsed ?? { notes: note.body }),
          type: note.title as ActivityType, // always use the stored title as source of truth
        }
      })
      .filter(Boolean) ?? []

    return NextResponse.json({
      data: { activities, totalCount: result.data?.noteTargets.totalCount ?? 0 },
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/crm/leads/[id]/activities]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch activities' }, { status: 500 })
  }
}

// ─── POST /api/crm/leads/[id]/activities ─────────────────────────────────────
// Logs an activity by creating a Note and linking it to the Person

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const { id } = await params
    const body: ActivityPayload = await req.json()

    if (!body.type) {
      return NextResponse.json({ data: null, error: 'activity type is required' }, { status: 400 })
    }

    // Step 1: Create the Note
    const createNote = /* GraphQL */ `
      mutation CreateNote($data: NoteCreateInput!) {
        createNote(data: $data) {
          id
          title
          body
          createdAt
        }
      }
    `

    const noteResult = await gql<{ createNote: { id: string; title: string; body: string; createdAt: string } }>(
      createNote,
      {
        data: {
          title: body.type,
          body: JSON.stringify({
            notes: body.notes ?? null,
            outcome: body.outcome ?? null,
            duration: body.duration ?? null,
            nextActionDate: body.nextActionDate ?? null,
            ...(body.metadata ?? {}),
          }),
        },
      }
    )

    if (noteResult.errors?.length) {
      return NextResponse.json({ data: null, error: noteResult.errors[0].message }, { status: 400 })
    }

    const noteId = noteResult.data?.createNote.id
    if (!noteId) {
      return NextResponse.json({ data: null, error: 'Note creation failed' }, { status: 500 })
    }

    // Step 2: Link the Note to the Person via NoteTarget
    const createTarget = /* GraphQL */ `
      mutation CreateNoteTarget($data: NoteTargetCreateInput!) {
        createNoteTarget(data: $data) {
          id
          noteId
          personId
        }
      }
    `

    const targetResult = await gql<{ createNoteTarget: { id: string; noteId: string; personId: string } }>(
      createTarget,
      { data: { noteId, personId: id } }
    )

    if (targetResult.errors?.length) {
      return NextResponse.json({ data: null, error: targetResult.errors[0].message }, { status: 400 })
    }

    // Schedule a follow-up reminder notification when a follow-up date is set
    if (body.type === 'Follow Up Set' && body.nextActionDate) {
      const scheduledFor = new Date(body.nextActionDate)
      scheduledFor.setHours(9, 0, 0, 0) // fire at 9 AM on the follow-up day
      if (scheduledFor > new Date()) {
        createNotification({
          type: 'follow_up_due',
          title: `Follow-up: lead`,
          body: body.notes ? `Note: ${body.notes}` : 'Follow-up reminder triggered.',
          leadId: id,
          scheduledFor,
        }).catch(() => {}) // fire-and-forget
      }
    }

    const { type: activityType, ...restBody } = body
    return NextResponse.json(
      {
        data: {
          id: noteId,
          type: activityType,
          createdAt: noteResult.data?.createNote.createdAt,
          ...restBody,
        },
        error: null,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/crm/leads/[id]/activities]', err)
    return NextResponse.json({ data: null, error: 'Failed to log activity' }, { status: 500 })
  }
}
