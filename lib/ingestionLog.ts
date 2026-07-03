/**
 * Ingestion log — records every portal webhook hit to the portal_leads Supabase table.
 *
 * Required one-time setup: run the SQL in /scripts/create-portal-leads.sql in Supabase dashboard.
 * If SUPABASE_SERVICE_ROLE_KEY is missing, logging is silently skipped (lead still creates).
 */
import { getAdminClient } from '@/lib/supabase-admin'

export type IngestionStatus = 'created' | 'duplicate' | 'failed'

export type PortalLeadRow = {
  id: string
  source_portal: string
  raw_payload: Record<string, unknown>
  parsed_contact: Record<string, unknown> | null
  ingestion_status: IngestionStatus
  contact_id: string | null
  contact_name: string | null
  contact_phone: string | null
  error_message: string | null
  created_at: string
}

export type LogIngestionParams = {
  sourcePortal: string
  rawPayload: Record<string, unknown>
  parsedContact?: Record<string, unknown>
  status: IngestionStatus
  contactId?: string
  contactName?: string
  contactPhone?: string
  errorMessage?: string
}

export async function logIngestion(params: LogIngestionParams): Promise<void> {
  const admin = getAdminClient()
  if (!admin) return // SUPABASE_SERVICE_ROLE_KEY not set — skip silently

  await admin.from('portal_leads').insert({
    source_portal:    params.sourcePortal,
    raw_payload:      params.rawPayload,
    parsed_contact:   params.parsedContact ?? null,
    ingestion_status: params.status,
    contact_id:       params.contactId ?? null,
    contact_name:     params.contactName ?? null,
    contact_phone:    params.contactPhone ?? null,
    error_message:    params.errorMessage ?? null,
  })
  // Fire-and-forget — don't let a log failure break the ingest response
}

export type GetLogsParams = {
  status?: IngestionStatus | 'all'
  source?: string
  limit?: number
  offset?: number
}

export async function getLogs(params: GetLogsParams = {}): Promise<{
  rows: PortalLeadRow[]
  total: number
  error: string | null
}> {
  const admin = getAdminClient()
  if (!admin) return { rows: [], total: 0, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }

  let query = admin
    .from('portal_leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50)
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 50) - 1)

  if (params.status && params.status !== 'all') {
    query = query.eq('ingestion_status', params.status)
  }
  if (params.source && params.source !== 'all') {
    query = query.eq('source_portal', params.source)
  }

  const { data, count, error } = await query

  if (error) return { rows: [], total: 0, error: error.message }
  return { rows: (data ?? []) as PortalLeadRow[], total: count ?? 0, error: null }
}
