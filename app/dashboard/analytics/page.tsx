'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { CRMLead } from '@/lib/twenty'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  Flame, Clock, DollarSign, Phone, RefreshCw, Loader2,
  ChevronRight, BarChart3, Sparkles,
} from 'lucide-react'
import { format, subDays, differenceInDays, differenceInHours } from 'date-fns'
import AIAdvisor from '@/components/AIAdvisor'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0',
  amber: '#D97706', amberDim: 'rgba(217,119,6,0.10)',
  emerald: '#059669', red: '#EF4444', blue: '#2563EB',
  orange: '#EA580C', purple: '#7C3AED',
  muted: '#64748B', label: '#94A3B8', text: '#0F172A',
}

// ─── Activity row shape (from /api/crm/activities) ───────────────────────────
type ActivityRow = {
  id: string
  personId: string | null
  type: string
  notes: string | null
  outcome: string | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function displayName(l: CRMLead) {
  return `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
}

function formatINR(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <p style={{ color: C.muted, marginBottom: 4 }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? C.amber }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter()
  const [leads, setLeads]           = useState<CRMLead[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dateRange, setDateRange]   = useState<'7d' | '30d' | '90d'>('30d')

  const since = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    return subDays(new Date(), days).toISOString()
  }, [dateRange])

  const fetchData = useCallback(async () => {
    try {
      const [leadsRes, actsRes] = await Promise.all([
        fetch('/api/crm/leads?limit=200').then(r => r.json()),
        fetch(`/api/crm/activities?since=${encodeURIComponent(since)}&limit=500`).then(r => r.json()),
      ])
      setLeads(leadsRes.data?.leads ?? [])
      setActivities(actsRes.data?.activities ?? [])
    } catch (e) {
      console.error('Analytics fetch error', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [since])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = () => { setRefreshing(true); fetchData() }

  // ── KPI summary ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const now = new Date()
    const sevenAgo = subDays(now, 7)
    const hot = leads.filter(l => (l.intentScore ?? 0) >= 70)
    const hotOld = hot.filter(l => new Date(l.createdAt) < sevenAgo)
    const hotTrend = hotOld.length > 0
      ? Math.round(((hot.length - hotOld.length) / hotOld.length) * 100)
      : hot.length > 0 ? 100 : 0
    const hotPipeline = hot.reduce((s, l) => s + (l.budgetMax ?? 0), 0)
    const avgScore = leads.length > 0
      ? Math.round(leads.reduce((s, l) => s + (l.intentScore ?? 0), 0) / leads.length)
      : 0
    // Response rate: leads that have at least one activity within 24h of creation
    const quickResp = leads.filter(l => {
      const cutoff = new Date(new Date(l.createdAt).getTime() + 86_400_000).toISOString()
      return activities.some(a => a.personId === l.id && a.createdAt <= cutoff)
    })
    const responseRate = leads.length > 0 ? Math.round((quickResp.length / leads.length) * 100) : 0
    return {
      total: leads.length, hotCount: hot.length, hotTrend,
      hotPipeline, avgScore, responseRate,
      totalActivities: activities.length,
    }
  }, [leads, activities])

  // ── Timeline (leads + activities per day) ────────────────────────────────────
  const timeline = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const now = new Date()
    return Array.from({ length: days }, (_, i) => {
      const d = subDays(now, days - 1 - i)
      const label = format(d, days <= 7 ? 'EEE' : 'MMM dd')
      const dayStr = format(d, 'yyyy-MM-dd')
      const dayLeads = leads.filter(l => l.createdAt.startsWith(dayStr))
      const dayActs  = activities.filter(a => a.createdAt.startsWith(dayStr))
      return {
        date: label,
        leads: dayLeads.length,
        hot: dayLeads.filter(l => (l.intentScore ?? 0) >= 70).length,
        activities: dayActs.length,
      }
    })
  }, [leads, activities, dateRange])

  // ── Portal breakdown (NEW) ───────────────────────────────────────────────────
  const portalBreakdown = useMemo(() => {
    const map: Record<string, { count: number; hot: number }> = {}
    for (const l of leads) {
      const src = l.sourcePortal || 'Unknown'
      if (!map[src]) map[src] = { count: 0, hot: 0 }
      map[src].count++
      if ((l.intentScore ?? 0) >= 70) map[src].hot++
    }
    return Object.entries(map)
      .map(([portal, d]) => ({
        portal,
        count: d.count,
        hot: d.hot,
        conversion: d.count > 0 ? Math.round((d.hot / d.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [leads])

  // ── Response-time histogram (NEW) ────────────────────────────────────────────
  const responseHistogram = useMemo(() => {
    const buckets = [
      { label: '< 1h',   min: 0,   max: 1 },
      { label: '1–4h',   min: 1,   max: 4 },
      { label: '4–24h',  min: 4,   max: 24 },
      { label: '1–3d',   min: 24,  max: 72 },
      { label: '3d+',    min: 72,  max: Infinity },
      { label: 'No resp',min: -1,  max: -1 },   // sentinel for no activity
    ]

    const counts = buckets.map(b => ({ label: b.label, count: 0 }))

    for (const lead of leads) {
      const firstAct = activities
        .filter(a => a.personId === lead.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]

      if (!firstAct) {
        counts[5].count++
        continue
      }

      const hours = differenceInHours(new Date(firstAct.createdAt), new Date(lead.createdAt))
      const idx = buckets.findIndex(b => b.min >= 0 && hours >= b.min && hours < b.max)
      if (idx >= 0) counts[idx].count++
      else counts[5].count++
    }

    return counts
  }, [leads, activities])

  // ── Source performance ────────────────────────────────────────────────────────
  const sourcePerformance = useMemo(() => {
    const map: Record<string, { count: number; hot: number; totalScore: number }> = {}
    for (const l of leads) {
      const src = l.sourcePortal || 'Direct'
      if (!map[src]) map[src] = { count: 0, hot: 0, totalScore: 0 }
      map[src].count++
      map[src].totalScore += l.intentScore ?? 0
      if ((l.intentScore ?? 0) >= 70) map[src].hot++
    }
    return Object.entries(map)
      .map(([source, d]) => ({
        source, count: d.count,
        avgScore: d.count > 0 ? Math.round(d.totalScore / d.count) : 0,
        conversionRate: d.count > 0 ? Math.round((d.hot / d.count) * 100) : 0,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate)
  }, [leads])

  // ── Lead funnel ───────────────────────────────────────────────────────────────
  const funnel = useMemo(() => {
    const total = leads.length
    const contacted = leads.filter(l => activities.some(a => a.personId === l.id)).length
    const warm = leads.filter(l => (l.intentScore ?? 0) >= 40 && (l.intentScore ?? 0) < 70).length
    const hot  = leads.filter(l => (l.intentScore ?? 0) >= 70).length
    const toP = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
    return [
      { stage: 'Total Leads', count: total,     pct: 100 },
      { stage: 'Contacted',   count: contacted, pct: toP(contacted) },
      { stage: 'Warm+',       count: warm + hot, pct: toP(warm + hot) },
      { stage: 'Hot 🔥',      count: hot,        pct: toP(hot) },
    ]
  }, [leads, activities])

  // ── Activity effectiveness ────────────────────────────────────────────────────
  const activityEffectiveness = useMemo(() => {
    const types = ['Call Made', 'WhatsApp Sent', 'Email Sent', 'Site Visit Done', 'Follow Up Set', 'Note']
    return types.map(type => {
      const actsOfType = activities.filter(a => a.type === type)
      const hotConversions = actsOfType.filter(a => {
        const lead = leads.find(l => l.id === a.personId)
        return lead && (lead.intentScore ?? 0) >= 70
      }).length
      return {
        type,
        count: actsOfType.length,
        conversionRate: actsOfType.length > 0 ? Math.round((hotConversions / actsOfType.length) * 100) : 0,
      }
    }).sort((a, b) => b.conversionRate - a.conversionRate)
  }, [leads, activities])

  // ── Score distribution ────────────────────────────────────────────────────────
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: '0–9',   min: 0  }, { range: '10–19', min: 10 },
      { range: '20–29', min: 20 }, { range: '30–39', min: 30 },
      { range: '40–49', min: 40 }, { range: '50–59', min: 50 },
      { range: '60–69', min: 60 }, { range: '70–79', min: 70 },
      { range: '80–89', min: 80 }, { range: '90–100', min: 90 },
    ]
    return buckets.map(b => ({
      range: b.range,
      count: leads.filter(l => {
        const s = l.intentScore ?? 0
        return s >= b.min && s < b.min + 10
      }).length,
      bucket: b.min >= 70 ? 'hot' : b.min >= 40 ? 'warm' : 'cold',
    }))
  }, [leads])

  // ── Top 10 leads by score ─────────────────────────────────────────────────────
  const topLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => (b.intentScore ?? 0) - (a.intentScore ?? 0))
      .slice(0, 10)
      .map(l => {
        const score = l.intentScore ?? 0
        const lastAct = activities
          .filter(a => a.personId === l.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        const hoursSinceAct = lastAct ? differenceInHours(new Date(), new Date(lastAct.createdAt)) : 9999
        let nextAction = 'Schedule follow-up call'
        if (score >= 80) nextAction = 'Schedule site visit — high intent'
        else if (score >= 60) nextAction = 'Share property shortlist'
        if (hoursSinceAct > 72) nextAction = `Inactive ${Math.round(hoursSinceAct / 24)}d — reach out now`
        return { lead: l, score, nextAction, hoursSinceAct }
      })
  }, [leads, activities])

  // ── Insight strip ─────────────────────────────────────────────────────────────
  const insight = useMemo(() => {
    const top = topLeads[0]
    if (!top) return { text: 'Add more leads to unlock insights.', cta: 'Add leads', href: '/dashboard/leads' }
    if (top.hoursSinceAct > 72) return {
      text: `${displayName(top.lead)} (score ${top.score}) hasn't been touched in ${Math.round(top.hoursSinceAct / 24)} days — act now.`,
      cta: 'View lead', href: `/dashboard/leads/${top.lead.id}`,
    }
    if (summary.hotCount === 0) return {
      text: 'No hot leads yet. Call leads faster — first response time is your biggest lever.',
      cta: 'View leads', href: '/dashboard/leads',
    }
    const best = sourcePerformance[0]
    if (best && best.conversionRate > 0) return {
      text: `${best.source} is your best-converting source at ${best.conversionRate}% — consider getting more leads from there.`,
      cta: 'See sources', href: '#sources',
    }
    return {
      text: `You have ${summary.hotCount} hot leads worth ${formatINR(summary.hotPipeline)} in pipeline. Keep the momentum going.`,
      cta: 'View leads', href: '/dashboard/leads',
    }
  }, [topLeads, summary, sourcePerformance])

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 32, height: 32, color: C.amber, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: C.muted, fontSize: 14 }}>Loading insights…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ─── Empty state ──────────────────────────────────────────────────────────────
  if (leads.length < 3) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <BarChart3 style={{ width: 32, height: 32, color: C.amber }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Not enough data yet</h1>
          <p style={{ color: C.muted, marginBottom: 32, lineHeight: 1.6 }}>Add at least 3 leads and log some activities to unlock analytics.</p>
          <button onClick={() => router.push('/dashboard/leads')}
            style={{ padding: '12px 28px', background: C.amber, color: '#fff', fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            Go to Leads
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.3px' }}>Insights</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
              {summary.total} leads · {summary.totalActivities} activities
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Date range tabs */}
            <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
              {(['7d', '30d', '90d'] as const).map(r => (
                <button key={r} onClick={() => setDateRange(r)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: dateRange === r ? C.blue : 'transparent', color: dateRange === r ? '#fff' : C.muted, transition: 'all 0.15s' }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button onClick={handleRefresh} disabled={refreshing}
              style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}
            >
              <RefreshCw style={{ width: 15, height: 15, color: C.muted, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* ── AI insight strip ── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.07) 0%, rgba(217,119,6,0.02) 100%)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 14, padding: '14px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.amberDim, border: '1px solid rgba(217,119,6,0.3)', borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Sparkles style={{ width: 12, height: 12, color: C.amber }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Insight</span>
          </div>
          <p style={{ fontSize: 13.5, color: C.text, margin: 0, lineHeight: 1.5, flex: 1 }}>{insight.text}</p>
          <button onClick={() => router.push(insight.href)}
            style={{ padding: '6px 16px', background: C.amber, color: '#fff', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {insight.cta} →
          </button>
        </div>

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Leads',    value: summary.total,                  sub: `${dateRange} window`,         icon: <BarChart3 style={{ width: 17, height: 17, color: C.blue }} />,    accent: C.blue  },
            { label: 'Hot Leads',      value: summary.hotCount,               sub: 'score ≥ 70',                  icon: <Flame style={{ width: 17, height: 17, color: C.orange }} />,       accent: C.orange, trend: summary.hotTrend },
            { label: 'Hot Pipeline',   value: formatINR(summary.hotPipeline), sub: 'total max budget',            icon: <DollarSign style={{ width: 17, height: 17, color: C.emerald }} />, accent: C.emerald },
            { label: 'Response Rate',  value: `${summary.responseRate}%`,     sub: 'first touch within 24h',      icon: <Phone style={{ width: 17, height: 17, color: C.purple }} />,       accent: C.purple },
          ].map((kpi, i) => (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${kpi.accent}70, transparent)` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{kpi.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${kpi.accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {kpi.icon}
                </div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.text, letterSpacing: '-0.5px', lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: C.muted }}>{kpi.sub}</span>
                {'trend' in kpi && kpi.trend !== undefined && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: kpi.trend >= 0 ? C.emerald : C.red, background: kpi.trend >= 0 ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 20 }}>
                    {kpi.trend >= 0 ? '↑' : '↓'} {Math.abs(kpi.trend)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 1: Lead volume + Portal breakdown ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 14, marginBottom: 14 }}>

          {/* Lead volume area chart */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Lead Volume</h2>
                <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Leads & activities over time</p>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                {[{ label: 'Leads', color: C.blue }, { label: 'Hot', color: C.orange }, { label: 'Activities', color: C.emerald }].map(l => (
                  <span key={l.label} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: C.muted }}>
                    <span style={{ width: 10, height: 2, background: l.color, display: 'inline-block', borderRadius: 4 }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.blue} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.emerald} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.floor(timeline.length / 6)} />
                <YAxis tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="leads"      stroke={C.blue}    strokeWidth={2} fill="url(#gBlue)"  name="Leads"      dot={false} />
                <Area type="monotone" dataKey="activities" stroke={C.emerald} strokeWidth={2} fill="url(#gGreen)" name="Activities" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Portal breakdown (NEW) */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Portal Breakdown</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 16px' }}>Leads per source · bar = count, line = hot%</p>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={portalBreakdown} margin={{ top: 4, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="portal" tick={{ fill: C.label, fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={40} />
                <YAxis tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]}>
                  {portalBreakdown.map((_, i) => {
                    const colors = [C.blue, C.orange, C.emerald, C.purple, C.amber, '#0EA5E9', '#EC4899', '#14B8A6']
                    return <Cell key={i} fill={colors[i % colors.length]} fillOpacity={0.8} />
                  })}
                </Bar>
                <Bar dataKey="hot" name="Hot leads" radius={[6, 6, 0, 0]}>
                  {portalBreakdown.map((_, i) => {
                    const colors = [C.blue, C.orange, C.emerald, C.purple, C.amber, '#0EA5E9', '#EC4899', '#14B8A6']
                    return <Cell key={i} fill={colors[i % colors.length]} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Row 2: Funnel + Response-time histogram ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14, marginBottom: 14 }}>

          {/* Funnel */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Lead Funnel</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Conversion by stage</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {funnel.map((s, i) => {
                const colors = [C.label, C.blue, C.amber, C.orange]
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: C.text }}>{s.stage}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors[i] }}>{s.count} <span style={{ color: C.muted, fontWeight: 400 }}>({s.pct}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99 }}>
                      <div style={{ height: '100%', width: `${s.pct}%`, background: colors[i], borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Response-time histogram (NEW) */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>First Response Time</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>How fast leads receive their first touch</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={responseHistogram} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]}>
                  {responseHistogram.map((b, i) => {
                    const fill = b.label === '< 1h' ? C.emerald
                      : b.label === '1–4h' ? '#10B981'
                      : b.label === '4–24h' ? C.amber
                      : b.label === '1–3d' ? C.orange
                      : b.label === 'No resp' ? C.red
                      : '#94A3B8'
                    return <Cell key={i} fill={fill} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Row 3: Source performance + Activity effectiveness ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Source performance */}
          <div id="sources" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Source Conversion Rate</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>% of leads that became hot</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {sourcePerformance.slice(0, 6).map((s, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{s.source}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>{s.count} leads</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.conversionRate >= 30 ? C.emerald : s.conversionRate >= 15 ? C.amber : C.muted }}>
                        {s.conversionRate}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: '#F1F5F9', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, s.conversionRate)}%`, background: s.conversionRate >= 30 ? C.emerald : s.conversionRate >= 15 ? C.amber : C.label, borderRadius: 99, transition: 'width 0.6s' }} />
                  </div>
                </div>
              ))}
              {sourcePerformance.length === 0 && (
                <p style={{ fontSize: 13, color: C.label }}>No leads with source data yet.</p>
              )}
            </div>
          </div>

          {/* Activity effectiveness */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Activity Effectiveness</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Hot lead rate per activity type</p>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={activityEffectiveness} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="type" tick={{ fill: C.text, fontSize: 11 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="conversionRate" name="Hot conversion %" radius={[0, 6, 6, 0]}>
                  {activityEffectiveness.map((e, i) => (
                    <Cell key={i} fill={e.conversionRate >= 40 ? C.emerald : e.conversionRate >= 20 ? C.amber : C.label} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Score distribution ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Score Distribution</h2>
              <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Intent score buckets across all leads</p>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[{ label: 'Cold', color: C.label }, { label: 'Warm', color: C.amber }, { label: 'Hot', color: C.orange }].map(l => (
                <span key={l.label} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: C.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={scoreDistribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="range" tick={{ fill: C.label, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]}>
                {scoreDistribution.map((b, i) => (
                  <Cell key={i} fill={b.bucket === 'hot' ? C.orange : b.bucket === 'warm' ? C.amber : C.label} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Top leads table ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Top Leads to Act On</h2>
              <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Ranked by intent score</p>
            </div>
            <button onClick={() => router.push('/dashboard/leads')}
              style={{ fontSize: 12, color: C.blue, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              View all <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 12, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
            {['Lead', 'Score', 'Portal', 'Next Action'].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>

          {topLeads.map(({ lead, score, nextAction }) => {
            const dotColor = score >= 70 ? C.orange : score >= 40 ? C.amber : C.label
            return (
              <div key={lead.id}
                onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{displayName(lead)}</p>
                    <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{lead.phones.primaryPhoneNumber ?? '—'}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: dotColor }}>{score}</span>
                  <span style={{ fontSize: 11, color: C.label, marginLeft: 3 }}>/100</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{lead.sourcePortal ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{nextAction}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── AI Advisor ── */}
        <AIAdvisor context={{
          totalLeads:        summary.total,
          hotLeadsCount:     summary.hotCount,
          hotPipelineValue:  formatINR(summary.hotPipeline),
          avgConversionDays: 0,
          responseRate:      summary.responseRate,
          activityDensity:   summary.total > 0 ? (summary.totalActivities / summary.total).toFixed(1) : '0',
          totalActivities:   summary.totalActivities,
          topSource:         sourcePerformance[0]?.source ?? 'N/A',
          topSourceRate:     sourcePerformance[0]?.conversionRate ?? 0,
          bestActivity:      activityEffectiveness[0]?.type ?? 'N/A',
          bestActivityRate:  activityEffectiveness[0]?.conversionRate ?? 0,
          hotTrend:          summary.hotTrend,
        }} />

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
