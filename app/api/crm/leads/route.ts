import { NextRequest, NextResponse } from 'next/server'
import { gql, calcLeadScore, LEAD_FIELDS, type CRMLead, type CRMLeadInput } from '@/lib/twenty'
import { requireAuth } from '@/lib/auth'

// ─── GET /api/crm/leads ───────────────────────────────────────────────────────
// Query params:
//   search    — name or phone substring
//   status    — pipeline status (New, Contacted, Qualified, etc.)
//   score     — hot | warm | cold
//   source    — source portal name
//   limit     — number of results (default 50)
//   after     — cursor for pagination

export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response
  try {
    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status')
    const score = searchParams.get('score')
    const source = searchParams.get('source')
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
    const after = searchParams.get('after')

    // Build filter object
    const filters: Record<string, unknown>[] = []

    if (status) {
      filters.push({ status: { eq: status } })
    }

    if (source) {
      filters.push({ sourcePortal: { eq: source } })
    }

    // Score range filter
    if (score === 'hot') filters.push({ intentScore: { gte: 70 } })
    else if (score === 'warm') filters.push({ intentScore: { gte: 40, lt: 70 } })
    else if (score === 'cold') filters.push({ intentScore: { lt: 40 } })

    // Name/phone search via OR
    if (search) {
      filters.push({
        or: [
          { name: { firstName: { like: `%${search}%` } } },
          { name: { lastName: { like: `%${search}%` } } },
          { phones: { primaryPhoneNumber: { like: `%${search}%` } } },
          { emails: { primaryEmail: { like: `%${search}%` } } },
        ],
      })
    }

    const filter = filters.length > 0 ? { and: filters } : {}

    const query = /* GraphQL */ `
      query GetLeads(
        $filter: PersonFilterInput
        $first: Int
        $after: String
      ) {
        people(
          filter: $filter
          orderBy: [{ intentScore: DescNullsLast }, { createdAt: DescNullsLast }]
          first: $first
          after: $after
        ) {
          edges {
            node { ${LEAD_FIELDS} }
            cursor
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }
    `

    const result = await gql<{ people: { edges: { node: CRMLead; cursor: string }[]; pageInfo: { hasNextPage: boolean; endCursor: string }; totalCount: number } }>(
      query,
      { filter, first: limit, after: after ?? undefined }
    )

    if (result.errors?.length) {
      return NextResponse.json({ data: null, error: result.errors[0].message }, { status: 400 })
    }

    const leads = result.data?.people.edges.map(e => e.node) ?? []
    const pageInfo = result.data?.people.pageInfo
    const totalCount = result.data?.people.totalCount ?? 0

    return NextResponse.json({ data: { leads, pageInfo, totalCount }, error: null })
  } catch (err) {
    console.error('[GET /api/crm/leads]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch leads' }, { status: 500 })
  }
}

// ─── POST /api/crm/leads ──────────────────────────────────────────────────────
// Body: CRMLeadInput

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    const body: CRMLeadInput = await req.json()

    if (!body.firstName || !body.phone) {
      return NextResponse.json(
        { data: null, error: 'firstName and phone are required' },
        { status: 400 }
      )
    }

    // Calculate initial intent score
    const intentScore = body.intentScore ?? calcLeadScore(body)

    // Check for duplicate by phone number
    const dedupeQuery = /* GraphQL */ `
      query FindByPhone($phone: StringFilter) {
        people(filter: { phones: { primaryPhoneNumber: $phone } }, first: 1) {
          edges { node { id name { firstName lastName } } }
          totalCount
        }
      }
    `
    const dupeResult = await gql<{ people: { edges: { node: CRMLead }[]; totalCount: number } }>(
      dedupeQuery,
      { phone: { eq: body.phone } }
    )

    if ((dupeResult.data?.people.totalCount ?? 0) > 0) {
      const existing = dupeResult.data!.people.edges[0].node
      return NextResponse.json(
        {
          data: null,
          error: `Lead already exists: ${existing.name.firstName} ${existing.name.lastName}`,
          existingId: existing.id,
          duplicate: true,
        },
        { status: 409 }
      )
    }

    const mutation = /* GraphQL */ `
      mutation CreateLead($data: PersonCreateInput!) {
        createPerson(data: $data) { ${LEAD_FIELDS} }
      }
    `

    const data: Record<string, unknown> = {
      name: { firstName: body.firstName, lastName: body.lastName ?? '' },
      phones: { primaryPhoneNumber: body.phone, primaryPhoneCountryCode: '+91' },
      city: body.city ?? null,
      intentScore,
      status: body.status ?? 'New',
    }

    if (body.email) data.emails = { primaryEmail: body.email }
    if (body.budgetMin != null) data.budgetMin = body.budgetMin
    if (body.budgetMax != null) data.budgetMax = body.budgetMax
    if (body.sourcePortal) data.sourcePortal = body.sourcePortal
    if (body.sourceDetail) data.sourceDetail = body.sourceDetail
    if (body.leadPortalId) data.leadPortalId = body.leadPortalId
    if (body.propertyType?.length) data.propertyType = body.propertyType
    if (body.timeline) data.timeline = body.timeline
    if (body.localities?.length) data.localities = body.localities

    const result = await gql<{ createPerson: CRMLead }>(mutation, { data })

    if (result.errors?.length) {
      return NextResponse.json({ data: null, error: result.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ data: result.data?.createPerson, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/crm/leads]', err)
    return NextResponse.json({ data: null, error: 'Failed to create lead' }, { status: 500 })
  }
}
