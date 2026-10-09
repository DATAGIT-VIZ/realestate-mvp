import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// GET /api/settings/export?what=leads | activities
// Downloads the signed-in user's own leads, or the activity logged on them, as a CSV file.
// Same rule as /api/crm/leads: own leads only (agent_id), and the dev bypass user exports everything.

const DEV_AGENT = '00000000-0000-0000-0000-000000000001'
const PAGE = 1000
const MAX_ROWS = 100_000

// Leads: these columns first, in this order, then any other column the table has (minus internal ids)
const LEAD_FIRST = [
  'cs_id', 'name', 'phone', 'email', 'city', 'locations', 'source', 'property_type', 'budget_min', 'budget_max',
  'timeline', 'intent_score', 'status', 'client_type', 'portal_lead_id', 'assigned_to', 'tags',
  'failed_contact_attempts', 'escalated', 'created_at', 'updated_at',
]
const LEAD_SKIP = new Set(['agent_id', 'twenty_id', 'workspace_id'])

type Row = Record<string, unknown>

/** One CSV cell: quoted when needed, and a leading = + - @ is neutralised so spreadsheets don't run it as a formula */
function cell(v: unknown): string {
  if (v == null) return ''
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const line = (vals: unknown[]) => vals.map(cell).join(',')

export async function GET(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const what = req.nextUrl.searchParams.get('what')
  if (what !== 'leads' && what !== 'activities') return NextResponse.json({ error: 'what must be leads or activities' }, { status: 400 })

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  const isDevBypass = userId === DEV_AGENT

  try {
    const page = (from: number) => {
      if (what === 'leads') {
        const q = sb.from('leads').select('*')
          .order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, from + PAGE - 1)
        return isDevBypass ? q : q.eq('agent_id', userId!)
      }
      const q = sb.from('lead_activities').select('id, lead_id, activity_type, activity_data, created_at, leads!inner ( agent_id, name, cs_id )')
        .order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, from + PAGE - 1)
      return isDevBypass ? q : q.eq('leads.agent_id', userId!)
    }
    const rows: Row[] = []
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await page(from)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      rows.push(...((data ?? []) as unknown as Row[]))
      if (!data || data.length < PAGE) break
    }

    let csv: string
    if (what === 'leads') {
      const seen = new Set<string>()
      rows.forEach(r => Object.keys(r).forEach(k => seen.add(k)))
      const cols = [...LEAD_FIRST.filter(c => seen.has(c)), ...[...seen].filter(c => !LEAD_FIRST.includes(c) && !LEAD_SKIP.has(c) && c !== 'id').sort(), 'id']
      csv = [line(cols), ...rows.map(r => line(cols.map(c => r[c])))].join('\r\n')
    } else {
      const cols = ['created_at', 'lead_cs_id', 'lead_name', 'activity_type', 'outcome', 'call_outcome', 'duration_seconds', 'notes', 'other_details', 'lead_id', 'id']
      csv = [line(cols), ...rows.map(r => {
        const lead = (r.leads ?? {}) as Row
        const d = { ...((r.activity_data ?? {}) as Row) }
        const pick = (k: string) => { const v = d[k]; delete d[k]; return v }
        const outcome = pick('outcome'), callOutcome = pick('callOutcome'), duration = pick('duration'), notes = pick('notes')
        return line([r.created_at, lead.cs_id, lead.name, r.activity_type, outcome, callOutcome, duration, notes, Object.keys(d).length ? d : '', r.lead_id, r.id])
      })].join('\r\n')
    }

    const day = new Date().toISOString().slice(0, 10)
    return new NextResponse('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leadgap-${what}-${day}.csv"`,
        'Cache-Control': 'no-store',
        'X-Row-Count': String(rows.length),
      },
    })
  } catch (err) {
    console.error('[GET /api/settings/export]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
