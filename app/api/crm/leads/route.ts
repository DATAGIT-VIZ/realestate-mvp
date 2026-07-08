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

    // CS-ID exact lookup (e.g. "CS00003") — bypasses name/phone search
    if (search) {
      if (/^CS\d+$/i.test(search.trim())) {
        filters.push({ leadPortalId: { eq: search.trim().toUpperCase() } })
      } else {
        filters.push({
          or: [
            { name: { firstName: { like: `%${search}%` } } },
            { name: { lastName: { like: `%${search}%` } } },
            { phones: { primaryPhoneNumber: { like: `%${search}%` } } },
            { emails: { primaryEmail: { like: `%${search}%` } } },
          ],
        })
      }
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
    // Return mock data when Twenty API is not configured (local dev / demo)
    if (!process.env.TWENTY_API_KEY) {
      return NextResponse.json({ data: { leads: DEMO_LEADS, pageInfo: null, totalCount: DEMO_LEADS.length }, error: null })
    }
    return NextResponse.json({ data: null, error: 'Failed to fetch leads' }, { status: 500 })
  }
}

// ─── Demo fallback leads (shown when TWENTY_API_KEY is not set) ───────────────
const mk = (n: string) => ({ primaryPhoneNumber: n, primaryPhoneCountryCode: 'IN' as const })
const me = (e: string) => ({ primaryEmail: e })
const NF2 = { budgetMin: null, budgetMax: null, sourceDetail: null, propertyType: null, timeline: null, localities: null }

const DEMO_LEADS: CRMLead[] = [
  { ...NF2, id: 'm1',  name: { firstName: 'Rahul',   lastName: 'Mehta'   }, phones: mk('+919820001111'), emails: me('rahul@example.in'),   city: 'Mumbai',    intentScore: 88, sourcePortal: 'MagicBricks', leadPortalId: 'CS00001', sourceDetail: '[Individual]',        status: 'Fresh',           updatedAt: new Date(Date.now() - 1*3600000).toISOString(),    createdAt: new Date(Date.now() - 1*3600000).toISOString()     },
  { ...NF2, id: 'm2',  name: { firstName: 'Priya',   lastName: 'Sharma'  }, phones: mk('+919820002222'), emails: me('priya@example.in'),   city: 'Pune',      intentScore: 72, sourcePortal: '99acres',     leadPortalId: 'CS00002', sourceDetail: '[Channel Partner]',   status: 'Attempting',      updatedAt: new Date(Date.now() - 3*3600000).toISOString(),    createdAt: new Date(Date.now() - 3*3600000).toISOString()     },
  { ...NF2, id: 'm3',  name: { firstName: 'Arjun',   lastName: 'Kapoor'  }, phones: mk('+919820003333'), emails: me('arjun@example.in'),   city: 'Bangalore', intentScore: 55, sourcePortal: 'Housing.com', leadPortalId: 'CS00003', sourceDetail: '[Agent]',             status: 'Connected',       updatedAt: new Date(Date.now() - 2*24*3600000).toISOString(), createdAt: new Date(Date.now() - 2*24*3600000).toISOString()  },
  { ...NF2, id: 'm4',  name: { firstName: 'Sneha',   lastName: 'Nair'    }, phones: mk('+919820004444'), emails: me('sneha@example.in'),   city: 'Mumbai',    intentScore: 65, sourcePortal: 'NoBroker',    leadPortalId: 'CS00004', sourceDetail: '[Individual]',        status: 'VM Done',         updatedAt: new Date(Date.now() - 3*24*3600000).toISOString(), createdAt: new Date(Date.now() - 3*24*3600000).toISOString()  },
  { ...NF2, id: 'm5',  name: { firstName: 'Aditya',  lastName: 'Joshi'   }, phones: mk('+919820005555'), emails: me('aditya@example.in'),  city: 'Mumbai',    intentScore: 91, sourcePortal: 'MagicBricks', leadPortalId: 'CS00005', sourceDetail: '[Channel Partner]',   status: 'Virtual Meeting', updatedAt: new Date(Date.now() - 6*24*3600000).toISOString(), createdAt: new Date(Date.now() - 6*24*3600000).toISOString()  },
  { ...NF2, id: 'm6',  name: { firstName: 'Meera',   lastName: 'Pillai'  }, phones: mk('+919820006666'), emails: me('meera@example.in'),   city: 'Chennai',   intentScore: 93, sourcePortal: 'MagicBricks', leadPortalId: 'CS00006', sourceDetail: '[Individual]',        status: 'Negotiation',     updatedAt: new Date(Date.now() - 10*24*3600000).toISOString(),createdAt: new Date(Date.now() - 10*24*3600000).toISOString() },
  { ...NF2, id: 'm7',  name: { firstName: 'Karthik', lastName: 'Balan'   }, phones: mk('+919820007777'), emails: me('karthik@example.in'), city: 'Bangalore', intentScore: 95, sourcePortal: '99acres',     leadPortalId: 'CS00007', sourceDetail: '[Agent]',             status: 'Won',             updatedAt: new Date(Date.now() - 14*24*3600000).toISOString(),createdAt: new Date(Date.now() - 14*24*3600000).toISOString() },
  { ...NF2, id: 'm8',  name: { firstName: 'Divya',   lastName: 'Iyer'    }, phones: mk('+919820008888'), emails: me('divya@example.in'),   city: 'Pune',      intentScore: 74, sourcePortal: '99acres',     leadPortalId: 'CS00008', sourceDetail: '[Interior Designer]', status: 'Site Visit',      updatedAt: new Date(Date.now() - 7*24*3600000).toISOString(), createdAt: new Date(Date.now() - 7*24*3600000).toISOString()  },
  { ...NF2, id: 'm9',  name: { firstName: 'Vikram',  lastName: 'Singh'   }, phones: mk('+919820009999'), emails: me('vikram@example.in'),  city: 'Hyderabad', intentScore: 40, sourcePortal: 'MagicBricks', leadPortalId: 'CS00009', sourceDetail: '[Individual]',        status: 'Lost',            updatedAt: new Date(Date.now() - 4*24*3600000).toISOString(), createdAt: new Date(Date.now() - 4*24*3600000).toISOString()  },
  { ...NF2, id: 'm10', name: { firstName: 'Anjali',  lastName: 'Desai'   }, phones: mk('+919820010000'), emails: me('anjali@example.in'),  city: 'Pune',      intentScore: 78, sourcePortal: '99acres',     leadPortalId: 'CS00010', sourceDetail: '[Interior Designer]', status: 'Fresh',           updatedAt: new Date(Date.now() - 60*3600000).toISOString(),   createdAt: new Date(Date.now() - 60*3600000).toISOString()    },
]

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

    // Always generate a CS ID — universal identifier for every lead regardless of source
    const countQuery = /* GraphQL */ `
      query CountCsLeads {
        people(filter: { leadPortalId: { like: "CS%" } }) { totalCount }
      }
    `
    const countResult = await gql<{ people: { totalCount: number } }>(countQuery)
    const nextNum = (countResult.data?.people.totalCount ?? 0) + 1
    const csId = `CS${String(nextNum).padStart(5, '0')}`

    const mutation = /* GraphQL */ `
      mutation CreateLead($data: PersonCreateInput!) {
        createPerson(data: $data) { ${LEAD_FIELDS} }
      }
    `

    // Encode clientType into sourceDetail: "[ClientType] originalDetail"
    const sourceDetail = body.clientType
      ? `[${body.clientType}]${body.sourceDetail ? ` ${body.sourceDetail}` : ''}`
      : body.sourceDetail

    const data: Record<string, unknown> = {
      name: { firstName: body.firstName, lastName: body.lastName ?? '' },
      phones: { primaryPhoneNumber: body.phone.startsWith('+') ? body.phone : `+91${body.phone.replace(/^0/,'')}`, primaryPhoneCountryCode: 'IN' },
      city: body.city ?? null,
      intentScore,
      status: body.status ?? 'Fresh',
      leadPortalId: csId,
    }

    if (body.email) data.emails = { primaryEmail: body.email }
    if (body.budgetMin != null) data.budgetMin = body.budgetMin
    if (body.budgetMax != null) data.budgetMax = body.budgetMax
    if (body.sourcePortal) data.sourcePortal = body.sourcePortal
    if (sourceDetail) data.sourceDetail = sourceDetail
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
