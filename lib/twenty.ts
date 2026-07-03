// Twenty.com GraphQL client — all CRM data flows through here
// Never import this in client components — server-side only

const TWENTY_API_URL = process.env.TWENTY_API_URL ?? 'https://api.twenty.com'
const TWENTY_API_KEY = process.env.TWENTY_API_KEY

// ─── GraphQL executor ─────────────────────────────────────────────────────────

type GQLError = { message: string; path?: string[] }

type GQLResponse<T> = {
  data: T | null
  errors?: GQLError[]
}

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<GQLResponse<T>> {
  if (!TWENTY_API_KEY) throw new Error('TWENTY_API_KEY is not set')

  const res = await fetch(`${TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TWENTY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Twenty API ${res.status}: ${body}`)
  }

  return res.json() as Promise<GQLResponse<T>>
}

// ─── CRM Types ────────────────────────────────────────────────────────────────

export type LeadName = { firstName: string; lastName: string }
export type LeadPhones = { primaryPhoneNumber: string | null; primaryPhoneCountryCode: string | null }
export type LeadEmails = { primaryEmail: string | null }

export type CRMLead = {
  id: string
  name: LeadName
  phones: LeadPhones
  emails: LeadEmails
  city: string | null
  budgetMin: number | null
  budgetMax: number | null
  intentScore: number | null
  sourcePortal: string | null
  sourceDetail: string | null
  leadPortalId: string | null
  propertyType: string[] | null
  timeline: string | null
  status: string | null
  localities: string[] | null
  createdAt: string
  updatedAt: string
}

export type CRMLeadInput = {
  firstName: string
  lastName?: string
  phone: string
  email?: string
  city?: string
  budgetMin?: number
  budgetMax?: number
  sourcePortal?: string
  sourceDetail?: string
  leadPortalId?: string
  propertyType?: string[]
  timeline?: string
  status?: string
  localities?: string[]
  intentScore?: number
}

export type CRMActivity = {
  id: string
  title: string
  body: string | null
  createdAt: string
}

export type CRMDeal = {
  id: string
  name: string
  stage: string | null
  dealValue: number | null
  probability: number | null
  expectedDateClose: string | null
  notes: string | null
  createdAt: string
}

export type CRMProperty = {
  id: string
  name: string
  type: string | null
  city: string | null
  locality: string | null
  areaSqft: number | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  status: string | null
  reraNumber: string | null
  createdAt: string
}

// ─── GraphQL fragments ────────────────────────────────────────────────────────

export const LEAD_FIELDS = /* GraphQL */ `
  id
  name { firstName lastName }
  phones { primaryPhoneNumber primaryPhoneCountryCode }
  emails { primaryEmail }
  city
  budgetMin
  budgetMax
  intentScore
  sourcePortal
  sourceDetail
  leadPortalId
  propertyType
  timeline
  status
  localities
  createdAt
  updatedAt
`

export const ACTIVITY_FIELDS = /* GraphQL */ `
  id
  title
  body
  createdAt
`

// ─── Score helper (pure — no DB calls) ───────────────────────────────────────

export function calcLeadScore(lead: Partial<CRMLeadInput>): number {
  let score = 0

  // Contact completeness (30pts)
  if (lead.phone) score += 20
  if (lead.email) score += 10

  // Budget (25pts)
  if (lead.budgetMin && lead.budgetMax) score += 25
  else if (lead.budgetMin || lead.budgetMax) score += 15

  // Timeline urgency (25pts)
  const t = (lead.timeline ?? '').toLowerCase()
  if (t.includes('immediate') || t.includes('1 month')) score += 25
  else if (t.includes('1–3') || t.includes('3 month')) score += 15
  else if (t.includes('6 month')) score += 5

  // Source quality (20pts)
  const s = (lead.sourcePortal ?? '').toLowerCase()
  if (s.includes('website') || s.includes('referral')) score += 20
  else if (s.includes('magicbricks') || s.includes('99acres') || s.includes('housing')) score += 15
  else if (s.includes('facebook') || s.includes('google')) score += 10
  else score += 5

  return Math.min(100, score)
}
