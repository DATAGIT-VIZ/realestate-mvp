/**
 * POST /api/reports/run
 * Executes a report query against Supabase (deals | portal_leads tables).
 * Aggregates in-process so no raw SQL is exposed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export type ReportSource  = 'deals' | 'portal_leads'
export type ReportMetric  = 'count' | 'sum_value' | 'avg_value' | 'win_rate'
export type ReportGroupBy =
  | 'stage' | 'city' | 'source_portal' | 'property_type' | 'assigned_to' | 'month'
  | 'ingestion_status'

export interface ReportFilters {
  dateFrom?:    string
  dateTo?:      string
  city?:        string
  stage?:       string
  source?:      string
  agent?:       string
}

export interface ReportConfig {
  source:    ReportSource
  groupBy:   ReportGroupBy
  metric:    ReportMetric
  chartType: 'bar' | 'pie' | 'line' | 'table'
  filters?:  ReportFilters
}

export interface ReportRow { label: string; value: number; extra?: number }

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function groupAndAggregate(rows: Record<string, unknown>[], groupBy: ReportGroupBy, metric: ReportMetric): ReportRow[] {
  const grouped: Record<string, { count: number; sumValue: number; won: number; total: number }> = {}

  for (const row of rows) {
    let key: string
    if (groupBy === 'month') {
      const ts = (row.created_at ?? row.updated_at) as string
      key = ts ? monthKey(ts) : 'Unknown'
    } else {
      const raw = row[groupBy]
      if (Array.isArray(raw)) key = (raw[0] as string) ?? 'Unknown'
      else key = (raw as string) ?? 'Unknown'
    }

    if (!grouped[key]) grouped[key] = { count: 0, sumValue: 0, won: 0, total: 0 }
    grouped[key].count   += 1
    grouped[key].sumValue += Number(row.deal_value ?? 0)
    grouped[key].total   += 1
    if ((row.stage as string) === 'won') grouped[key].won += 1
  }

  return Object.entries(grouped)
    .map(([label, g]) => {
      let value: number
      let extra: number | undefined
      if (metric === 'count')     { value = g.count }
      else if (metric === 'sum_value') { value = g.sumValue }
      else if (metric === 'avg_value') { value = g.count ? Math.round(g.sumValue / g.count) : 0 }
      else /* win_rate */         { value = g.total ? Math.round((g.won / g.total) * 100) : 0; extra = g.total }
      return { label, value, extra }
    })
    .filter(r => r.label !== 'Unknown' || r.value > 0)
    .sort((a, b) => b.value - a.value)
}

export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const config: ReportConfig = await req.json()
  const { source, groupBy, metric, filters = {} } = config

  if (source === 'deals') {
    let q = sb.from('deals').select('*').eq('user_id', userId)
    if (filters.dateFrom)  q = q.gte('created_at', filters.dateFrom)
    if (filters.dateTo)    q = q.lte('created_at', filters.dateTo + 'T23:59:59')
    if (filters.city)      q = q.ilike('city', `%${filters.city}%`)
    if (filters.stage)     q = q.eq('stage', filters.stage)
    if (filters.source)    q = q.eq('source_portal', filters.source)
    if (filters.agent)     q = q.ilike('assigned_to', `%${filters.agent}%`)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as Record<string, unknown>[]
    const result = groupAndAggregate(rows, groupBy, metric)
    return NextResponse.json({ data: result, total: rows.length, generatedAt: new Date().toISOString() })
  }

  if (source === 'portal_leads') {
    // portal_leads is not scoped by user_id (ingestion log is workspace-wide)
    let q = sb.from('portal_leads').select('*')
    if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom)
    if (filters.dateTo)   q = q.lte('created_at', filters.dateTo + 'T23:59:59')
    if (filters.source)   q = q.eq('source_portal', filters.source)
    // city is not a column on portal_leads; filter is ignored

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as Record<string, unknown>[]
    const resolvedGroupBy = groupBy === 'stage' ? 'ingestion_status' : groupBy
    const result = groupAndAggregate(rows, resolvedGroupBy as ReportGroupBy, metric)
    return NextResponse.json({ data: result, total: rows.length, generatedAt: new Date().toISOString() })
  }

  return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
}
