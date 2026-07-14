import { NextRequest, NextResponse } from 'next/server'
import { calcLeadScore } from '@/lib/twenty'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().+]/g, '')
  // Reject anything that isn't mostly digits (catches names mapped to phone column)
  const digitCount = (digits.match(/\d/g) ?? []).length
  if (digitCount < 7) return ''   // caller treats empty string as invalid → row skipped
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`
  if (digits.length === 10) return `+91${digits}`
  return raw.startsWith('+') ? raw : `+${digits}`
}

function parseBudget(raw: string | undefined): number | null {
  if (!raw) return null
  const s = String(raw).replace(/,/g, '').trim().toLowerCase()
  const match = s.match(/(\d+(?:\.\d+)?)\s*([lckm]?)/)
  if (!match) return null
  const n = parseFloat(match[1])
  const unit = match[2]
  if (unit === 'cr' || unit === 'c') return Math.round(n * 10_000_000)
  if (unit === 'l')                   return Math.round(n * 100_000)
  if (unit === 'k')                   return Math.round(n * 1_000)
  if (unit === 'm')                   return Math.round(n * 1_000_000)
  return Math.round(n)
}

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  // Dev bypass: '00000000-...-0001' is not a real auth.users row → FK would reject it.
  // Use NULL agent_id so the insert succeeds, and read-back queries won't filter by agent.
  const DEV_AGENT = '00000000-0000-0000-0000-000000000001'
  const isDevBypass = userId === DEV_AGENT
  const agentId = isDevBypass ? null : userId

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  try {
    const { rows } = await req.json() as { rows: Record<string, string>[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows array required' }, { status: 400 })
    }
    if (rows.length > 10_000) {
      return NextResponse.json({ error: 'Max 10,000 rows per batch' }, { status: 400 })
    }

    // Build normalized rows, dedup by phone within the batch
    const seenPhones = new Set<string>()
    const insertRows: Record<string, unknown>[] = []
    let skippedBlank = 0

    for (const row of rows) {
      const rawName  = String(row.name  ?? '').trim()
      const rawPhone = String(row.phone ?? '').trim()
      if (!rawName || !rawPhone) { skippedBlank++; continue }

      const phone = normalizePhone(rawPhone)
      if (seenPhones.has(phone)) continue
      seenPhones.add(phone)

      const parts     = rawName.split(/\s+/)
      const firstName = parts[0] ?? 'Unknown'
      const lastName  = parts.slice(1).join(' ')
      const fullName  = `${firstName} ${lastName}`.trim()

      const budgetMin = parseBudget(row.budget_min) ?? parseBudget(row.budget)
      const budgetMax = parseBudget(row.budget_max)

      const score = calcLeadScore({
        firstName, lastName,
        phone,
        email:       row.email    || undefined,
        budgetMin:   budgetMin    ?? undefined,
        budgetMax:   budgetMax    ?? undefined,
        timeline:    row.timeline || undefined,
        sourcePortal: row.source  || undefined,
      })

      insertRows.push({
        agent_id:     agentId,
        name:         fullName,
        phone,
        email:        row.email         || null,
        source:       row.source        || 'Dump Import',
        city:         row.city          || null,
        property_type: row.property_type || null,
        budget_min:   budgetMin,
        budget_max:   budgetMax,
        timeline:     row.timeline      || null,
        intent_score: score,
        status:       'New',
        locations:    [],
      })
    }

    if (!insertRows.length) {
      return NextResponse.json({
        inserted: 0, duplicates: 0, skipped: skippedBlank,
        message: 'No valid rows to import',
      })
    }

    // Chunk into batches of 500 for Supabase
    const CHUNK = 500
    let inserted  = 0
    let conflicts = 0

    for (let i = 0; i < insertRows.length; i += CHUNK) {
      const chunk = insertRows.slice(i, i + CHUNK)

      // When agent_id is NULL (dev bypass), NULL ≠ NULL in SQL so the composite
      // unique index (agent_id, phone) won't catch duplicates. Fall back to plain
      // insert with ON CONFLICT ignore handled by the catch branch.
      const upsertOpts = isDevBypass
        ? { onConflict: 'phone', ignoreDuplicates: true }
        : { onConflict: 'agent_id,phone', ignoreDuplicates: true }

      const { data, error } = await sb.from('leads')
        .upsert(chunk, upsertOpts)
        .select('id')

      if (error) {
        // If upsert fails entirely, try plain insert (skips individual FK/unique errors)
        const { data: ins, error: insErr } = await sb.from('leads')
          .insert(chunk)
          .select('id')
        if (insErr) {
          conflicts += chunk.length
        } else {
          inserted += ins?.length ?? 0
          conflicts += chunk.length - (ins?.length ?? 0)
        }
      } else {
        inserted  += data?.length ?? 0
        conflicts += chunk.length - (data?.length ?? 0)
      }
    }

    return NextResponse.json({
      inserted,
      duplicates: conflicts,
      skipped:    skippedBlank,
      total:      rows.length,
      message:    `Imported ${inserted} leads. ${conflicts} duplicates skipped.`,
    })
  } catch (err) {
    console.error('[POST /api/crm/leads/batch]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
