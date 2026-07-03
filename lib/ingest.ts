/**
 * Shared lead creation/dedup flow used by all portal ingest routes.
 * Checks for duplicate by normalised phone, creates if new.
 * Returns { status, lead, existingId? }
 */

import { gql, calcLeadScore, LEAD_FIELDS, type CRMLead, type CRMLeadInput } from '@/lib/twenty'
import { normalisePhone } from '@/lib/dedup'
import { createNotification } from '@/lib/notifications'

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

  // Create new lead
  const score = payload.intentScore ?? calcLeadScore({ ...payload, phone: normPhone })

  const data: Record<string, unknown> = {
    name: { firstName: payload.firstName, lastName: payload.lastName ?? '' },
    phones: { primaryPhoneNumber: normPhone, primaryPhoneCountryCode: '+91' },
    intentScore: score,
    status: payload.status ?? 'New',
  }

  if (payload.email)               data.emails       = { primaryEmail: payload.email }
  if (payload.city)                data.city         = payload.city
  if (payload.budgetMin != null)   data.budgetMin    = payload.budgetMin
  if (payload.budgetMax != null)   data.budgetMax    = payload.budgetMax
  if (payload.sourcePortal)        data.sourcePortal = payload.sourcePortal
  if (payload.sourceDetail)        data.sourceDetail = payload.sourceDetail
  if (payload.leadPortalId)        data.leadPortalId = payload.leadPortalId
  if (payload.propertyType?.length) data.propertyType = payload.propertyType
  if (payload.timeline)            data.timeline     = payload.timeline
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
