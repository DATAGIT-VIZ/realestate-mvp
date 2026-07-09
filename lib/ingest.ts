/**
 * Shared lead creation/dedup flow used by all portal ingest routes.
 * Checks for duplicate by normalised phone, creates if new.
 * Writes directly to Supabase leads table — no Twenty.com dependency.
 */

import { calcLeadScore, type CRMLead, type CRMLeadInput } from '@/lib/twenty'
import { getAdminClient } from '@/lib/supabase-admin'
import { normalisePhone } from '@/lib/dedup'
import { createNotification } from '@/lib/notifications'

// ─── DEMO_AGENT_ID — used when DEV_BYPASS_AUTH=true (no real session) ─────────
// Must match the ID returned by requireAuth() in dev mode.
const DEMO_AGENT_ID = '00000000-0000-0000-0000-000000000001'

// ─── Supabase row → CRMLead ───────────────────────────────────────────────────
function rowToCrm(r: Record<string, unknown>): CRMLead {
  const parts = ((r.name as string) ?? '').trim().split(/\s+/)
  const ct = r.client_type as string | null
  const pid = r.portal_lead_id as string | null
  return {
    id:           r.id as string,
    name:         { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') },
    phones:       { primaryPhoneNumber: (r.phone as string) ?? '', primaryPhoneCountryCode: 'IN' },
    emails:       { primaryEmail: (r.email as string) ?? '' },
    city:         (r.city as string)          ?? null,
    intentScore:  (r.intent_score as number)  ?? 0,
    status:       (r.status as string)        ?? 'Fresh',
    leadPortalId: (r.cs_id as string)         ?? null,
    sourcePortal: (r.source as string)        ?? null,
    sourceDetail: [ct ? `[${ct}]` : '', pid ? `[pid:${pid}]` : ''].filter(Boolean).join(' ') || null,
    budgetMin:    (r.budget_min as number)    ?? null,
    budgetMax:    (r.budget_max as number)    ?? null,
    propertyType: (r.property_type as string) ? [(r.property_type as string)] : null,
    timeline:     (r.timeline as string)      ?? null,
    localities:   (r.locations as string[])   ?? null,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
  }
}

export type IngestPayload = Omit<CRMLeadInput, 'phone'> & {
  phone: string
  agentId?: string   // workspace agent to assign the lead to; falls back to DEMO_AGENT_ID
}

export type IngestResult =
  | { status: 'created';   lead: CRMLead }
  | { status: 'duplicate'; lead: CRMLead; existingId: string }
  | { status: 'error';     message: string }

export async function ingestLead(payload: IngestPayload): Promise<IngestResult> {
  const sb = getAdminClient()
  if (!sb) return { status: 'error', message: 'Database not configured' }

  const normPhone = normalisePhone(payload.phone)
  if (!normPhone || normPhone.length !== 10) {
    return { status: 'error', message: `Invalid phone: ${payload.phone}` }
  }

  const e164Phone = `+91${normPhone}`
  const agentId   = payload.agentId ?? DEMO_AGENT_ID

  // ── Dedup: check by normalised phone within this agent's leads ────────────
  const { data: existing } = await sb.from('leads')
    .select('id, name, cs_id, phone, email, city, intent_score, status, source, client_type, portal_lead_id, property_type, locations, budget_min, budget_max, timeline, created_at, updated_at')
    .eq('phone', e164Phone)
    .eq('agent_id', agentId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { status: 'duplicate', lead: rowToCrm(existing as Record<string, unknown>), existingId: existing.id }
  }

  // ── Create new lead ───────────────────────────────────────────────────────
  const score    = payload.intentScore ?? calcLeadScore({ ...payload, phone: normPhone })
  const fullName = `${payload.firstName} ${payload.lastName ?? ''}`.trim()

  // Preserve the portal's own lead ID in portal_lead_id column
  const portalLeadId = payload.leadPortalId ?? null

  const { data: created, error: insertErr } = await sb.from('leads').insert({
    agent_id:       agentId,
    name:           fullName,
    phone:          e164Phone,
    email:          payload.email         ?? null,
    city:           payload.city          ?? null,
    source:         payload.sourcePortal  ?? null,
    client_type:    payload.clientType    ?? null,
    portal_lead_id: portalLeadId,          // original portal ID (MB-2024-00123 etc.)
    property_type:  payload.propertyType?.[0] ?? null,
    locations:      payload.localities    ?? [],
    budget_min:     payload.budgetMin     ?? null,
    budget_max:     payload.budgetMax     ?? null,
    timeline:       payload.timeline      ?? null,
    intent_score:   score,
    status:         payload.status        ?? 'Fresh',
    // cs_id is auto-assigned by Supabase trigger (cs_id_seq) — atomic, no race condition
  }).select().single()

  if (insertErr || !created) {
    return { status: 'error', message: insertErr?.message ?? 'Insert failed' }
  }

  const lead     = rowToCrm(created as Record<string, unknown>)
  const fullName2 = `${created.name}`.trim()
  const csId     = created.cs_id as string

  // Fire new-lead notification (async, fire-and-forget)
  createNotification({
    type:    'new_lead',
    title:   `New lead: ${fullName2}`,
    body:    `${payload.sourcePortal ?? 'Portal'} · ${normPhone}${payload.city ? ` · ${payload.city}` : ''} · ${csId}`,
    leadId:  csId,
  }).catch(() => {})

  return { status: 'created', lead }
}
