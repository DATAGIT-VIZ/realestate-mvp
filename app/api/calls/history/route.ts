import { NextRequest, NextResponse } from 'next/server'
import { gql } from '@/lib/twenty'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const { searchParams } = req.nextUrl
  const limit  = Math.min(Number(searchParams.get('limit')  ?? '100'), 500)
  const leadId = searchParams.get('leadId') ?? null   // optional — filter by lead

  try {
    const filter = leadId
      ? { personId: { eq: leadId }, note: { title: { eq: 'Call Made' } } }
      : { note: { title: { eq: 'Call Made' } } }

    const result = await gql<{
      noteTargets: {
        edges: {
          node: {
            personId: string | null
            note: { id: string; title: string; body: string | null; createdAt: string }
          }
        }[]
        totalCount: number
      }
    }>(/* GraphQL */`
      query GetCallHistory($filter: NoteTargetFilterInput, $first: Int) {
        noteTargets(
          filter: $filter
          orderBy: [{ note: { createdAt: DescNullsLast } }]
          first: $first
        ) {
          edges {
            node {
              personId
              note { id title body createdAt }
            }
          }
          totalCount
        }
      }
    `, { filter, first: limit })

    if (result.errors?.length) {
      return NextResponse.json({ data: null, error: result.errors[0].message }, { status: 400 })
    }

    const calls = (result.data?.noteTargets.edges ?? []).map(e => {
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(e.node.note.body ?? '{}') } catch { /* ignore */ }
      return {
        id:           e.node.note.id,
        personId:     e.node.personId,
        outcome:      (parsed.outcome as string) ?? 'Unknown',
        duration:     (parsed.duration as number) ?? 0,
        recordingUrl: (parsed.recordingUrl as string | null) ?? null,
        callSid:      (parsed.callSid as string) ?? '',
        notes:        (parsed.notes as string) ?? '',
        createdAt:    e.node.note.createdAt,
      }
    })

    return NextResponse.json({
      data: { calls, total: result.data?.noteTargets.totalCount ?? 0 },
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/calls/history]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch call history' }, { status: 500 })
  }
}
