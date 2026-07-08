/**
 * Shared lead creation/dedup flow used by all portal ingest routes.
 * Checks for duplicate by normalised phone, creates if new.
 * Returns { status, lead, existingId? }
 */

import { gql, calcLeadScore, LEAD_FIELDS, type CRMLead, type CRMLeadInput } from '@/lib/twenty'
import { normalisePhone } from '@/lib/dedup'
import { createNotification } from '@/lib/notifications'

// Twenty CRM status enum — only valid uppercase values
const STATUS_MAP: Record<string, string> = {
  new: 'NEW', contacted: 'CONTACTED', qualified: 'QUALIFIED',
  visit_scheduled: 'VISIT_SCHEDULED', visit_done: 'VISIT_DONE',
  negotiation: 'NEGOTIATION', won: 'WON', lost: 'LOST', stale: 'STALE',
  hot: 'NEW', warm: 'NEW', cold: 'NEW',
}
function toTwentyStatus(s?: string): string {
  if (!s) return 'NEW'
  const key = s.toLowerCase().replace(/\s+/g, '_')
  return STATUS_MAP[key] ?? 'NEW'
}

// Twenty CRM propertyType multi-select enum
const PROPERTY_TYPE_MAP: Record<string, string> = {
  apartment: 'APARTMENT', flat: 'APARTMENT', '2bhk': 'APARTMENT', '3bhk': 'APARTMENT',
  '1bhk': 'APARTMENT', '4bhk': 'APARTMENT', 'bhk': 'APARTMENT',
  villa: 'VILLA', bungalow: 'VILLA', duplex: 'VILLA', rowhouse: 'VILLA', 'row house': 'VILLA',
  plot: 'PLOT', land: 'PLOT', 'residential plot': 'PLOT',
  commercial: 'COMMERCIAL', shop: 'COMMERCIAL', showroom: 'COMMERCIAL', 'commercial space': 'COMMERCIAL',
  office: 'OFFICE', 'office space': 'OFFICE',
  penthouse: 'PENTHOUSE',
}
function toTwentyPropertyTypes(arr?: string[]): string[] | undefined {
  if (!arr?.length) return undefined
  const mapped = arr
    .map(v => {
      const key = v.toLowerCase().trim()
      // match by exact key or by checking if any token in the value matches
      if (PROPERTY_TYPE_MAP[key]) return PROPERTY_TYPE_MAP[key]
      for (const [k, val] of Object.entries(PROPERTY_TYPE_MAP)) {
        if (key.includes(k)) return val
      }
      return null
    })
    .filter(Boolean) as string[]
  const unique = [...new Set(mapped)]
  return unique.length ? unique : undefined
}

// Twenty CRM timeline enum
const TIMELINE_MAP: Record<string, string> = {
  immediate: 'IMMEDIATE', 'asap': 'IMMEDIATE', 'urgent': 'IMMEDIATE',
  'within 1 month': 'WITHIN_1_MONTH', '1 month': 'WITHIN_1_MONTH',
  '1-3 months': 'OPT1_3_MONTH', '1 to 3 months': 'OPT1_3_MONTH', '3 months': 'OPT1_3_MONTH',
  '3-6 months': 'OPT3_6_MONTHS', '3 to 6 months': 'OPT3_6_MONTHS', '6 months': 'OPT3_6_MONTHS',
  '6-12 months': 'OPT6_12_MONTHS', '6 to 12 months': 'OPT6_12_MONTHS', '12 months': 'OPT6_12_MONTHS',
  exploring: 'JUST_EXPLORING', 'just exploring': 'JUST_EXPLORING', flexible: 'JUST_EXPLORING',
}
function toTwentyTimeline(s?: string): string | undefined {
  if (!s) return undefined
  const key = s.toLowerCase().trim()
  return TIMELINE_MAP[key] ?? undefined
}

// Twenty CRM sourcePortal enum — maps human-readable names to enum values
const PORTAL_MAP: Record<string, string> = {
  magicbricks: 'MAGICBRICKS', 'magic bricks': 'MAGICBRICKS',
  '99acres': 'OPT99ACRES', '99 acres': 'OPT99ACRES',
  'housing.com': 'HOUSING_COM', housing: 'HOUSING_COM',
  nobroker: 'NOBROKER', 'no broker': 'NOBROKER',
  facebook: 'FACEBOOK', 'facebook ads': 'FACEBOOK', 'fb': 'FACEBOOK',
  google: 'GOOGLE', 'google ads': 'GOOGLE',
  referral: 'REFERRAL',
  manual: 'MANUAL',
  website: 'WEBSITES', websites: 'WEBSITES',
}
function toTwentyPortal(s?: string): string | undefined {
  if (!s) return undefined
  const key = s.toLowerCase().trim()
  return PORTAL_MAP[key] ?? 'MANUAL'
}

export type IngestPayload = Omit<CRMLeadInput, 'phone'> & { phone: string }

export type IngestResult =
  | { status: 'created'; lead: CRMLead }
  | { status: 'duplicate'; lead: CRMLead; existingId: string }
  | { status: 'error'; message: string }

export async function ingestLead(payload: IngestPayload): Promise<IngestResult> {
  const normPhone = normalisePhone(payload.phone)
  if (!normPhone || normPhone.length !== 10) {
    return { status: 'error', message: `Invalid phone: ${payload.phone}` }
  }

  // Dedup check — query by normalised 10-digit phone
  const dedupeQ = /* GraphQL */ `
    query FindByPhone($phone: StringFilter) {
      people(filter: { phones: { primaryPhoneNumber: $phone } }, first: 1) {
        edges { node { ${LEAD_FIELDS} } }
        totalCount
      }
    }
  `
  const dupeRes = await gql<{ people: { edges: { node: CRMLead }[]; totalCount: number } }>(
    dedupeQ, { phone: { eq: normPhone } }
  )

  if ((dupeRes.data?.people.totalCount ?? 0) > 0) {
    const existing = dupeRes.data!.people.edges[0].node
    return { status: 'duplicate', lead: existing, existingId: existing.id }
  }

  // Generate CS ID — all leads regardless of source get a CS ID
  const csCountQ = /* GraphQL */ `
    query CountCsLeads { people(filter: { leadPortalId: { like: "CS%" } }) { totalCount } }
  `
  const csCountRes = await gql<{ people: { totalCount: number } }>(csCountQ)
  const nextNum = (csCountRes.data?.people.totalCount ?? 0) + 1
  const csId = `CS${String(nextNum).padStart(5, '0')}`

  // Create new lead
  const score = payload.intentScore ?? calcLeadScore({ ...payload, phone: normPhone })

  // Preserve portal's own ID in sourceDetail as metadata when provided
  const sourceDetailWithPortalId = payload.leadPortalId
    ? (payload.sourceDetail ? `${payload.sourceDetail} [pid:${payload.leadPortalId}]` : `[pid:${payload.leadPortalId}]`)
    : payload.sourceDetail

  const data: Record<string, unknown> = {
    name: { firstName: payload.firstName, lastName: payload.lastName ?? '' },
    phones: { primaryPhoneNumber: normPhone.startsWith('+') ? normPhone : `+91${normPhone.replace(/^0/,'')}`, primaryPhoneCountryCode: 'IN' },
    intentScore: score,
    // Always use 'Fresh' as the initial lifecycle stage — matches UI lifecycle stages
    status: payload.status ?? 'Fresh',
    leadPortalId: csId,
  }

  if (payload.email)               data.emails       = { primaryEmail: payload.email }
  if (payload.city)                data.city         = payload.city
  if (payload.budgetMin != null)   data.budgetMin    = payload.budgetMin
  if (payload.budgetMax != null)   data.budgetMax    = payload.budgetMax
  if (payload.sourcePortal)        data.sourcePortal = toTwentyPortal(payload.sourcePortal)
  if (sourceDetailWithPortalId)    data.sourceDetail = sourceDetailWithPortalId
  const mappedPropTypes = toTwentyPropertyTypes(payload.propertyType)
  if (mappedPropTypes?.length)    data.propertyType = mappedPropTypes
  const mappedTimeline = toTwentyTimeline(payload.timeline)
  if (mappedTimeline)             data.timeline     = mappedTimeline
  if (payload.localities?.length)  data.localities   = payload.localities

  const mutation = /* GraphQL */ `
    mutation CreateLead($data: PersonCreateInput!) {
      createPerson(data: $data) { ${LEAD_FIELDS} }
    }
  `
  const result = await gql<{ createPerson: CRMLead }>(mutation, { data })

  if (result.errors?.length) {
    return { status: 'error', message: result.errors[0].message }
  }

  const created = result.data!.createPerson
  const fullName = `${created.name.firstName} ${created.name.lastName}`.trim()

  createNotification({
    type: 'new_lead',
    title: `New lead: ${fullName}`,
    body: `${payload.sourcePortal ?? 'Portal'} — ${normPhone}${payload.city ? ` · ${payload.city}` : ''}`,
    leadId: created.id,
  }).catch(() => {})

  return { status: 'created', lead: created }
}
