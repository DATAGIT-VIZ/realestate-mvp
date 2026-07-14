import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'
import { calcLeadScore } from '@/lib/twenty'
import { parseRow } from '@/lib/lead-import'

type DedupStrategy = 'skip' | 'overwrite'

// ─── POST /api/crm/leads/import/commit ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await req.json() as {
    rows: Record<string, string>[]
    dedupStrategy: DedupStrategy
  }

  const { rows: rawRows, dedupStrategy = 'skip' } = body
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  // Create import batch record
  let batchId: string | null = null
  try {
    const { data: batch } = await sb
      .from('import_batches')
      .insert({ status: 'processing', total_rows: rawRows.length, source: 'csv_template' })
      .select('id')
      .single()
    batchId = batch?.id ?? null
  } catch {}

  // Parse + validate all rows (re-validate server-side, never trust client)
  const parsed = rawRows.map((raw, i) => {
    const { parsed: p, errors } = parseRow(raw)
    return { rowIndex: i + 2, raw, parsed: p, errors }
  })

  const validRows = parsed.filter(r => r.errors.length === 0 && r.parsed.phone !== null)

  // Fetch existing leads for dedup
  const phones = validRows.map(r => r.parsed.phone!)
  const { data: existingRows } = phones.length > 0
    ? await sb.from('leads').select('id, phone').in('phone', phones)
    : { data: [] }

  const phoneToId = new Map<string, string>()
  for (const l of (existingRows ?? [])) {
    if (l.phone) phoneToId.set(l.phone as string, l.id as string)
  }

  let inserted = 0, updated = 0, skipped = 0, errors = parsed.length - validRows.length

  // Intra-file dedup: keep only first occurrence per phone
  const seenInFile = new Set<string>()
  const toInsert: typeof validRows = []
  const toUpdate: typeof validRows = []

  for (const r of validRows) {
    const phone = r.parsed.phone!
    if (seenInFile.has(phone)) { skipped++; continue }
    seenInFile.add(phone)

    if (phoneToId.has(phone)) {
      if (dedupStrategy === 'overwrite') toUpdate.push(r)
      else { skipped++; continue }
    } else {
      toInsert.push(r)
    }
  }

  // Bulk insert new leads
  if (toInsert.length > 0) {
    const insertPayload = toInsert.map(r => {
      const p = r.parsed
      const score = calcLeadScore({
        phone:        p.phone   ?? '',
        email:        p.email   ?? '',
        budgetMin:    p.budgetMin  ?? undefined,
        budgetMax:    p.budgetMax  ?? undefined,
        timeline:     p.timeline   ?? '',
        sourcePortal: p.source     ?? '',
      })
      return {
        name:         p.name,
        phone:        p.phone,
        email:        p.email,
        city:         p.city,
        source:       p.source,
        budget_min:   p.budgetMin,
        budget_max:   p.budgetMax,
        timeline:     p.timeline,
        status:       'New',
        intent_score: score,
        import_batch_id: batchId,
        failed_contact_attempts: 0,
        agent_id:     userId,
      }
    })

    // Insert in chunks of 500
    const CHUNK = 500
    for (let i = 0; i < insertPayload.length; i += CHUNK) {
      const chunk = insertPayload.slice(i, i + CHUNK)
      const { error: insErr } = await sb.from('leads').insert(chunk)
      if (insErr) { errors += chunk.length; console.error('[import/commit insert]', insErr.message) }
      else inserted += chunk.length
    }
  }

  // Update existing leads (overwrite strategy)
  for (const r of toUpdate) {
    const p = r.parsed
    const existingId = phoneToId.get(p.phone!)!
    const { error: upErr } = await sb.from('leads').update({
      name:       p.name,
      email:      p.email   ?? undefined,
      city:       p.city    ?? undefined,
      source:     p.source  ?? undefined,
      budget_min: p.budgetMin ?? undefined,
      budget_max: p.budgetMax ?? undefined,
      timeline:   p.timeline  ?? undefined,
    }).eq('id', existingId)
    if (upErr) errors++
    else updated++
  }

  // Mark batch complete
  if (batchId) {
    await sb.from('import_batches').update({
      status:        'complete',
      inserted_rows: inserted,
      failed_rows:   errors,
    }).eq('id', batchId)
  }

  return NextResponse.json({ inserted, updated, skipped, errors, batchId }, { status: 201 })
}
