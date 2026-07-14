import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'
import {
  TEMPLATE_HEADERS, parseRow,
  type PreviewRow, type PreviewStats, type PreviewStatus,
} from '@/lib/lead-import'

export { TEMPLATE_HEADERS }
export type { PreviewRow, PreviewStats, PreviewStatus }

// ─── POST /api/crm/leads/import/preview ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await req.json() as { rows: Record<string, string>[] }
  const rawRows = body.rows
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  // Parse + validate every row
  const parsed = rawRows.map((raw, i) => {
    const { parsed: p, errors } = parseRow(raw)
    return { rowIndex: i + 2, raw, parsed: p, errors }
  })

  // Collect valid phones for DB dedup query
  const validPhones = Array.from(new Set(
    parsed.filter(r => r.errors.length === 0 && r.parsed.phone).map(r => r.parsed.phone!)
  ))

  const { data: existingRows } = validPhones.length > 0
    ? await sb.from('leads').select('id, phone, name, email').in('phone', validPhones)
    : { data: [] }

  const phoneToId     = new Map<string, string>()
  const nameEmailToId = new Map<string, string>()
  for (const l of (existingRows ?? [])) {
    if (l.phone) phoneToId.set(l.phone as string, l.id as string)
    if (l.name && l.email) {
      nameEmailToId.set(
        `${(l.name as string).toLowerCase().trim()}|${(l.email as string).toLowerCase().trim()}`,
        l.id as string,
      )
    }
  }

  // Build preview rows with intra-file dupe tracking
  const seenPhones = new Map<string, number>()
  const previewRows: PreviewRow[] = parsed.map(r => {
    if (r.errors.length > 0 || !r.parsed.phone) {
      return { rowIndex: r.rowIndex, raw: r.raw, parsed: r.parsed, status: 'error' as PreviewStatus, errors: r.errors }
    }

    const phone = r.parsed.phone

    if (seenPhones.has(phone)) {
      return { rowIndex: r.rowIndex, raw: r.raw, parsed: r.parsed, status: 'duplicate_phone', errors: [], duplicateReason: `Same phone as row ${seenPhones.get(phone)}` }
    }
    seenPhones.set(phone, r.rowIndex)

    if (phoneToId.has(phone)) {
      return { rowIndex: r.rowIndex, raw: r.raw, parsed: r.parsed, status: 'duplicate_phone', errors: [], duplicateId: phoneToId.get(phone), duplicateReason: 'Phone already in database' }
    }

    if (r.parsed.email) {
      const key = `${r.parsed.name.toLowerCase().trim()}|${r.parsed.email}`
      if (nameEmailToId.has(key)) {
        return { rowIndex: r.rowIndex, raw: r.raw, parsed: r.parsed, status: 'duplicate_name_email', errors: [], duplicateId: nameEmailToId.get(key), duplicateReason: 'Name + email match existing lead' }
      }
    }

    return { rowIndex: r.rowIndex, raw: r.raw, parsed: r.parsed, status: 'new', errors: [] }
  })

  const stats: PreviewStats = {
    total:      previewRows.length,
    new:        previewRows.filter(r => r.status === 'new').length,
    duplicates: previewRows.filter(r => r.status.startsWith('duplicate')).length,
    errors:     previewRows.filter(r => r.status === 'error').length,
  }

  return NextResponse.json({ rows: previewRows, stats })
}
