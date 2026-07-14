import { NextRequest, NextResponse } from 'next/server'
import { calcLeadScore } from '@/lib/twenty'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'
const SYNC_LIMIT = 1000   // rows — above this we process async

// ─── Normalisation helpers ────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = (raw ?? '').replace(/[\s\-().+]/g, '')
  if ((digits.match(/\d/g) ?? []).length < 7) return ''
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0')  && digits.length === 11) return `+91${digits.slice(1)}`
  if (digits.length === 10) return `+91${digits}`
  return raw.startsWith('+') ? raw : `+${digits}`
}

function toTitleCase(s: string) {
  return s.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
}

function normalizeEmail(raw: string): string {
  const e = raw.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ''
}

function parseBudget(raw?: string): number | null {
  if (!raw) return null
  const s = String(raw).replace(/,/g, '').trim().toLowerCase()
  const m = s.match(/(\d+(?:\.\d+)?)\s*(cr|c|l|k|m)?/)
  if (!m) return null
  const n = parseFloat(m[1]), u = m[2] ?? ''
  if (u === 'cr' || u === 'c') return Math.round(n * 10_000_000)
  if (u === 'l')               return Math.round(n * 100_000)
  if (u === 'k')               return Math.round(n * 1_000)
  if (u === 'm')               return Math.round(n * 1_000_000)
  return Math.round(n)
}

// ─── Row-level processing ─────────────────────────────────────────────────────

interface MappedRow { [field: string]: string }
interface ImportDefaults {
  source?: string
  assigned_to?: string
  tags?: string[]
}
type DedupStrategy = 'skip' | 'overwrite' | 'merge'

interface ProcessResult {
  inserted: number
  skipped: number
  merged: number
  failed: number
  errors: Array<{ row: number; column: string; reason: string }>
}

async function processRows(
  sb: ReturnType<typeof getAdminClient>,
  rows: MappedRow[],
  mapping: Record<string, string>,
  defaults: ImportDefaults,
  strategy: DedupStrategy,
  agentId: string | null,
  batchId: string,
  isDevBypass: boolean,
): Promise<ProcessResult> {
  const result: ProcessResult = { inserted: 0, skipped: 0, merged: 0, failed: 0, errors: [] }

  // Pre-fetch existing phones for dedup
  const rawPhones = rows
    .map((r, i) => ({ raw: String(r[mapping.phone] ?? ''), i }))
    .filter(x => x.raw)
  const normalised = rawPhones.map(x => ({ ...x, phone: normalizePhone(x.raw) })).filter(x => x.phone)

  const existingMap = new Map<string, { id: string; [k: string]: unknown }>()
  if (normalised.length > 0) {
    const chunks = chunk(normalised.map(x => x.phone), 500)
    for (const c of chunks) {
      let q = sb!.from('leads').select('id,phone,name,email,city,source,budget_min,budget_max,timeline,tags')
        .in('phone', c)
      if (!isDevBypass) q = (q as any).eq('agent_id', agentId)
      const { data } = await q
      for (const r of (data ?? [])) existingMap.set(r.phone, r as any)
    }
  }

  // Dedup within the file itself (keep first occurrence per phone)
  const seenInFile = new Set<string>()

  const toInsert: Record<string, unknown>[] = []
  const toOverwrite: Array<{ id: string; update: Record<string, unknown> }> = []
  const toMerge:    Array<{ id: string; update: Record<string, unknown> }> = []

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i]
    const rowN = i + 2   // 1-indexed + header row

    const rawName  = String(row[mapping.name]  ?? '').trim()
    const rawPhone = String(row[mapping.phone] ?? '').trim()

    if (!rawName) {
      result.errors.push({ row: rowN, column: 'name',  reason: 'Missing name' })
      result.failed++; continue
    }
    if (!rawPhone) {
      result.errors.push({ row: rowN, column: 'phone', reason: 'Missing phone' })
      result.failed++; continue
    }

    const phone = normalizePhone(rawPhone)
    if (!phone) {
      result.errors.push({ row: rowN, column: 'phone', reason: `Invalid phone: "${rawPhone}"` })
      result.failed++; continue
    }

    // Intra-file dedup
    if (seenInFile.has(phone)) {
      result.errors.push({ row: rowN, column: 'phone', reason: `Duplicate in file: ${phone}` })
      result.skipped++; continue
    }
    seenInFile.add(phone)

    const name       = toTitleCase(rawName)
    const parts      = name.split(/\s+/)
    const email      = normalizeEmail(String(row[mapping.email] ?? ''))
    const city       = toTitleCase(String(row[mapping.city] ?? ''))
    const source     = String(row[mapping.source] ?? defaults.source ?? 'Import')
    const propType   = String(row[mapping.property_type] ?? '').trim()
    const budgetMin  = parseBudget(row[mapping.budget_min] ?? row[mapping.budget])
    const budgetMax  = parseBudget(row[mapping.budget_max])
    const timeline   = String(row[mapping.timeline] ?? '').trim()
    const notes      = String(row[mapping.notes] ?? '').trim()
    const tags       = [...(defaults.tags ?? []), ...(notes ? ['has-notes'] : [])]

    const score = calcLeadScore({ firstName: parts[0], lastName: parts.slice(1).join(' '), phone, email: email || undefined, budgetMin: budgetMin ?? undefined, budgetMax: budgetMax ?? undefined, timeline: timeline || undefined, sourcePortal: source })

    const existing = existingMap.get(phone)

    if (existing) {
      if (strategy === 'skip') {
        result.errors.push({ row: rowN, column: 'phone', reason: `Duplicate (skip): ${phone}` })
        result.skipped++; continue
      }
      if (strategy === 'overwrite') {
        toOverwrite.push({ id: existing.id as string, update: { name, phone, email: email || null, city: city || null, source, property_type: propType || null, budget_min: budgetMin, budget_max: budgetMax, timeline: timeline || null, intent_score: score, tags, import_batch_id: batchId } })
      } else {
        // merge: fill only empty fields
        const u: Record<string, unknown> = { import_batch_id: batchId }
        if (!existing.name  && name)      u.name       = name
        if (!existing.email && email)     u.email      = email
        if (!existing.city  && city)      u.city       = city
        if (!existing.source && source)   u.source     = source
        if (!existing.budget_min && budgetMin) u.budget_min = budgetMin
        if (!existing.budget_max && budgetMax) u.budget_max = budgetMax
        if (!existing.timeline && timeline)    u.timeline   = timeline
        const mergedTags = [...new Set([...(existing.tags as string[] ?? []), ...tags])]
        if (mergedTags.length) u.tags = mergedTags
        toMerge.push({ id: existing.id as string, update: u })
      }
    } else {
      toInsert.push({
        agent_id: agentId, name, phone,
        email:         email      || null,
        city:          city       || null,
        source,
        property_type: propType   || null,
        budget_min:    budgetMin,
        budget_max:    budgetMax,
        timeline:      timeline   || null,
        intent_score:  score,
        status:        'New',
        locations:     [],
        tags,
        import_batch_id: batchId,
        assigned_to:   defaults.assigned_to ?? null,
        assigned_at:   defaults.assigned_to ? new Date().toISOString() : null,
      })
    }
  }

  // Commit inserts in 500-row chunks
  for (const c of chunk(toInsert, 500)) {
    const { data, error } = await sb!.from('leads').insert(c).select('id')
    if (error) {
      result.failed += c.length
      result.errors.push({ row: -1, column: 'batch', reason: error.message })
    } else {
      result.inserted += data?.length ?? 0
    }
  }

  // Commit overwrites
  for (const { id, update } of toOverwrite) {
    const { error } = await sb!.from('leads').update(update).eq('id', id)
    if (error) { result.failed++; result.errors.push({ row: -1, column: id, reason: error.message }) }
    else result.inserted++
  }

  // Commit merges
  for (const { id, update } of toMerge) {
    const { error } = await sb!.from('leads').update(update).eq('id', id)
    if (error) { result.failed++; result.errors.push({ row: -1, column: id, reason: error.message }) }
    else result.merged++
  }

  return result
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── POST /api/crm/leads/import ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const isDevBypass = userId === DEV_AGENT
  const agentId     = isDevBypass ? null : userId

  try {
    const body = await req.json() as {
      rows:     MappedRow[]
      mapping:  Record<string, string>
      defaults: ImportDefaults
      strategy: DedupStrategy
      fileName: string
    }

    const { rows, mapping, defaults, strategy = 'skip', fileName } = body

    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ error: 'rows array required' }, { status: 400 })
    }
    if (rows.length > 50_000) {
      return NextResponse.json({ error: 'Max 50,000 rows per import' }, { status: 400 })
    }

    // Create batch record
    const { data: batch, error: batchErr } = await sb.from('import_batches').insert({
      user_id:        agentId,
      file_name:      fileName,
      status:         rows.length > SYNC_LIMIT ? 'processing' : 'pending',
      dedup_strategy: strategy,
      total_rows:     rows.length,
      mapping,
      defaults,
    }).select('id').single()

    if (batchErr || !batch) {
      // Fallback: process without batch tracking if table doesn't exist yet
      const r = await processRows(sb, rows, mapping, defaults, strategy, agentId, 'no-batch', isDevBypass)
      return NextResponse.json({ batchId: null, sync: true, ...r, message: `Imported ${r.inserted} leads. ${r.skipped} skipped. ${r.failed} failed.` })
    }

    const batchId = batch.id

    if (rows.length <= SYNC_LIMIT) {
      // Synchronous path
      const r = await processRows(sb, rows, mapping, defaults, strategy, agentId, batchId, isDevBypass)
      await sb.from('import_batches').update({
        status:       r.failed === rows.length ? 'failed' : 'done',
        inserted:     r.inserted,
        skipped:      r.skipped,
        merged:       r.merged,
        failed:       r.failed,
        error_report: r.errors,
        completed_at: new Date().toISOString(),
      }).eq('id', batchId)

      return NextResponse.json({
        batchId,
        sync: true,
        inserted: r.inserted,
        skipped:  r.skipped,
        merged:   r.merged,
        failed:   r.failed,
        errors:   r.errors,
        message:  `Imported ${r.inserted} leads. ${r.skipped} skipped. ${r.merged} merged. ${r.failed} failed.`,
      })
    }

    // Async path — return batchId immediately, process in background
    setImmediate(async () => {
      try {
        const r = await processRows(sb, rows, mapping, defaults, strategy, agentId, batchId, isDevBypass)
        await sb.from('import_batches').update({
          status:       r.failed === rows.length ? 'failed' : 'done',
          inserted:     r.inserted,
          skipped:      r.skipped,
          merged:       r.merged,
          failed:       r.failed,
          error_report: r.errors,
          completed_at: new Date().toISOString(),
        }).eq('id', batchId)
      } catch (err) {
        await sb.from('import_batches').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', batchId)
      }
    })

    return NextResponse.json({ batchId, sync: false, total: rows.length, message: `Processing ${rows.length.toLocaleString()} rows in background…` })

  } catch (err) {
    console.error('[POST /api/crm/leads/import]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
