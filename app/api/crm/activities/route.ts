/**
 * GET /api/crm/activities?since=<ISO>&limit=500
 *
 * Returns all activities (stored as Notes + NoteTargets) across all leads,
 * filtered to those created since `since`. Used by the analytics page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { gql } from '@/lib/twenty'
import { requireAuth } from '@/lib/auth'

type NoteRow = {
  id: string
  personId: string | null
  type: string
  notes: string | null
  outcome: string | null
  createdAt: string
}

export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const { searchParams } = req.nextUrl
    const since = searchParams.get('since') ?? new Date(Date.now() - 90 * 86400000).toISOString()
    const limit = Math.min(Number(searchParams.get('limit') ?? '500'), 1000)

    const query = /* GraphQL */ `
      query GetActivities($filter: NoteTargetFilterInput, $first: Int) {
        noteTargets(
          filter: $filter
          orderBy: [{ note: { createdAt: DescNullsLast } }]
          first: $first
        ) {
          edges {
            node {
              personId
              note {
                id
                title
                body
                createdAt
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
            personId: string | null
            note: { id: string; title: string; body: string | null; createdAt: string }
          }
        }[]
        totalCount: number
      }
    }>(query, {
      filter: { note: { createdAt: { gte: since } } },
      first: limit,
    })

    if (result.errors?.length) {
      return NextResponse.json({ data: null, error: result.errors[0].message }, { status: 400 })
    }

    const activities: NoteRow[] = result.data?.noteTargets.edges.map(e => {
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(e.node.note.body ?? '{}') } catch { /* ignore */ }
      return {
        id: e.node.note.id,
        personId: e.node.personId,
        type: e.node.note.title,
        notes: parsed.notes as string | null ?? null,
        outcome: parsed.outcome as string | null ?? null,
        createdAt: e.node.note.createdAt,
      }
    }) ?? []

    return NextResponse.json({
      data: { activities, total: result.data?.noteTargets.totalCount ?? 0 },
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/crm/activities]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch activities' }, { status: 500 })
  }
}
