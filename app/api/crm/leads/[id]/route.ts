import { NextRequest, NextResponse } from 'next/server'
import { gql, calcLeadScore, LEAD_FIELDS, type CRMLead } from '@/lib/twenty'
import { requireAuth } from '@/lib/auth'

// ─── GET /api/crm/leads/[id] ──────────────────────────────────────────────────
// Returns full lead profile + linked notes (activities)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const { id } = await params

    // Twenty Cloud uses people(filter) not person(id:)
    const query = /* GraphQL */ `
      query GetLead($filter: PersonFilterInput) {
        people(filter: $filter, first: 1) {
          edges {
            node {
              ${LEAD_FIELDS}
              noteTargets {
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
              }
            }
          }
        }
      }
    `

    const result = await gql<{
      people: {
        edges: {
          node: CRMLead & {
            noteTargets: {
              edges: { node: { note: { id: string; title: string; body: string | null; createdAt: string; updatedAt: string } } }[]
            }
          }
        }[]
      }
    }>(query, { filter: { id: { eq: id } } })

    if (result.errors?.length) {
      return NextResponse.json({ data: null, error: result.errors[0].message }, { status: 400 })
    }

    const personNode = result.data?.people.edges[0]?.node
    if (!personNode) {
      return NextResponse.json({ data: null, error: 'Lead not found' }, { status: 404 })
    }

    // Extract notes as activities, parse JSON body, sort newest first
    const activities = personNode.noteTargets.edges
      .map(e => e.node.note)
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const { noteTargets: _, ...lead } = personNode

    return NextResponse.json({ data: { lead, activities }, error: null })
  } catch (err) {
    console.error('[GET /api/crm/leads/[id]]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch lead' }, { status: 500 })
  }
}

// ─── PATCH /api/crm/leads/[id] ────────────────────────────────────────────────
// Partial update — only sends fields that are provided

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const { id } = await params
    const body: Record<string, unknown> = await req.json()

    const updateData: Record<string, unknown> = {}

    // Map incoming fields to Twenty schema
    if (body.firstName !== undefined || body.lastName !== undefined) {
      updateData.name = {
        firstName: body.firstName as string,
        lastName: (body.lastName as string) ?? '',
      }
    }
    if (body.phone !== undefined) {
      updateData.phones = {
        primaryPhoneNumber: body.phone as string,
        primaryPhoneCountryCode: '+91',
      }
    }
    if (body.email !== undefined) {
      updateData.emails = { primaryEmail: body.email as string }
    }

    // Pass through custom fields directly
    const directFields = [
      'city', 'budgetMin', 'budgetMax', 'sourcePortal', 'sourceDetail',
      'leadPortalId', 'propertyType', 'timeline', 'status', 'localities',
    ]
    for (const field of directFields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    // Recalculate score if relevant fields changed
    if (
      body.phone !== undefined ||
      body.email !== undefined ||
      body.budgetMin !== undefined ||
      body.budgetMax !== undefined ||
      body.timeline !== undefined ||
      body.sourcePortal !== undefined
    ) {
      // Fetch current lead to merge with updates for accurate score
      const currentResult = await gql<{ people: { edges: { node: CRMLead }[] } }>(`
        query { people(filter: { id: { eq: "${id}" } }, first: 1) { edges { node { ${LEAD_FIELDS} } } } }
      `)
      const currentPerson = currentResult.data?.people.edges[0]?.node
      if (currentPerson) {
        const merged = { ...currentPerson, ...body }
        updateData.intentScore = calcLeadScore({
          phone: merged.phones?.primaryPhoneNumber ?? (body.phone as string),
          email: merged.emails?.primaryEmail ?? (body.email as string),
          budgetMin: merged.budgetMin as number,
          budgetMax: merged.budgetMax as number,
          timeline: merged.timeline as string,
          sourcePortal: merged.sourcePortal as string,
        })
      }
    }

    if (body.intentScore !== undefined) {
      updateData.intentScore = body.intentScore
    }

    const mutation = /* GraphQL */ `
      mutation UpdateLead($id: UUID!, $data: PersonUpdateInput!) {
        updatePerson(id: $id, data: $data) { ${LEAD_FIELDS} }
      }
    `

    const result = await gql<{ updatePerson: CRMLead }>(mutation, { id, data: updateData })

    if (result.errors?.length) {
      return NextResponse.json({ data: null, error: result.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ data: result.data?.updatePerson, error: null })
  } catch (err) {
    console.error('[PATCH /api/crm/leads/[id]]', err)
    return NextResponse.json({ data: null, error: 'Failed to update lead' }, { status: 500 })
  }
}

// ─── DELETE /api/crm/leads/[id] ───────────────────────────────────────────────
// Soft delete — sets status to Archived rather than destroying the record

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const { id } = await params

    const mutation = /* GraphQL */ `
      mutation DeleteLead($id: UUID!) {
        deletePerson(id: $id) { id }
      }
    `

    const result = await gql<{ deletePerson: { id: string } }>(mutation, { id })

    if (result.errors?.length) {
      return NextResponse.json({ data: null, error: result.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[DELETE /api/crm/leads/[id]]', err)
    return NextResponse.json({ data: null, error: 'Failed to delete lead' }, { status: 500 })
  }
}
