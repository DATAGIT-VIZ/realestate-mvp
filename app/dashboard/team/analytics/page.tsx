'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  ArrowLeft, Phone, MessageCircle, Mail, Eye, Bell, Tag,
  Activity, Loader2, Users, TrendingUp, Flame, Trophy,
  CheckCircle2, XCircle, PlusCircle, Calendar, Filter,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import type { CRMLead } from '@/lib/twenty'

const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#a000c8', blueDim: 'rgba(160,0,200,0.07)',
  emerald: '#059669', emeraldDim: '#ECFDF5',
  amber: '#be2ed6', amberDim: 'rgba(190,46,214,0.07)',
  red: '#EF4444', redDim: '#FEF2F2',
  violet: '#a000c8', violetDim: 'rgba(160,0,200,0.07)',
  orange: '#a000c8',
}

type Timeframe = 'week' | 'month' | 'quarter'
const TF_DAYS:  Record<Timeframe, number> = { week: 7, month: 30, quarter: 90 }
const TF_LABEL: Record<Timeframe, string> = { week: 'This week', month: 'This month', quarter: 'This quarter' }

type ActivityRow = {
  id: string
  personId: string | null
  type: string
  notes: string | null
  outcome: string | null
  createdAt: string
}

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  'Call Made': Phone, 'Call Missed': Phone,
  'WhatsApp Sent': MessageCircle, 'WhatsApp Received': MessageCircle,
  'Email Sent': Mail, 'Email Received': Mail,
  'Site Visit Scheduled': Calendar, 'Site Visit Done': Eye,
  'Follow Up Set': Bell, 'Note': Tag,
  'Status Changed': Activity, 'Lead Created': PlusCircle,
}
const ACTIVITY_COLOR: Record<string, string> = {
  'Call Made': C.blue, 'Call Missed': C.red,
  'WhatsApp Sent': C.emerald, 'WhatsApp Received': C.emerald,
  'Email Sent': C.violet, 'Email Received': C.violet,
  'Site Visit Scheduled': C.amber, 'Site Visit Done': C.orange,
  'Follow Up Set': C.blue, 'Note': C.label,
  'Status Changed': C.muted, 'Lead Created': C.emerald,
}
const OUTCOME_COLOR: Record<string, string> = {
  Positive: C.emerald, Neutral: C.label, Negative: C.red, 'No Response': C.amber,
}

const FEED_FILTERS = ['All', 'Call Made', 'WhatsApp Sent', 'Site Visit Done', 'Email Sent', 'Note', 'Follow Up Set']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <p style={{ color: C.muted, marginBottom: 4 }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => <p key={i} style={{ color: p.fill ?? C.blue }}>{p.name}: <strong>{p.value}</strong></p>)}
    </div>
  )
}

export default function TeamAnalyticsPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [leads,      setLeads]      = useState<CRMLead[]>([])
  const [loading,    setLoading]    = useState(true)
  const [timeframe,  setTimeframe]  = useState<Timeframe>('month')
  const [typeFilter, setTypeFilter] = useState('All')

  useEffect(() => {
    const since = subDays(new Date(), TF_DAYS[timeframe]).toISOString()
    Promise.all([
      fetch(`/api/crm/activities?since=${encodeURIComponent(since)}&limit=500`).then(r => r.json()),
      fetch('/api/crm/leads?limit=500').then(r => r.json()),
    ]).then(([ac, ld]) => {
      setActivities(ac.data?.activities ?? [])
      setLeads(ld.data?.leads ?? [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [timeframe])

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const since = useMemo(() => subDays(new Date(), TF_DAYS[timeframe]), [timeframe])

  const kpis = useMemo(() => {
    const newLeads   = leads.filter(l => new Date(l.createdAt) >= since)
    const wonLeads   = leads.filter(l => l.status === 'Won')
    const hotLeads   = leads.filter(l => (l.intentScore ?? 0) >= 70)
    const contacted  = leads.filter(l => activities.some(a => a.personId === l.id))
    const responseRate = leads.length > 0 ? Math.round((contacted.length / leads.length) * 100) : 0
    return {
      totalLeads:    leads.length,
      newLeads:      newLeads.length,
      wonLeads:      wonLeads.length,
      hotLeads:      hotLeads.length,
      totalActivities: activities.length,
      responseRate,
    }
  }, [leads, activities, since])

  // ── Daily activity timeline ──────────────────────────────────────────────
  const timeline = useMemo(() => {
    const days = Math.min(TF_DAYS[timeframe], 30)
    return Array.from({ length: days }, (_, i) => {
      const d      = subDays(new Date(), days - 1 - i)
      const dStr   = format(d, 'yyyy-MM-dd')
      const label  = format(d, days <= 7 ? 'EEE' : 'MMM d')
      const acts   = activities.filter(a => a.createdAt.startsWith(dStr)).length
      const newL   = leads.filter(l => l.createdAt.startsWith(dStr)).length
      return { date: label, activities: acts, newLeads: newL }
    })
  }, [activities, leads, timeframe])

  // ── Activity type breakdown ──────────────────────────────────────────────
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of activities) map[a.type] = (map[a.type] ?? 0) + 1
    return Object.entries(map)
      .map(([type, count]) => ({ type, count, color: ACTIVITY_COLOR[type] ?? C.label }))
      .sort((a, b) => b.count - a.count)
  }, [activities])

  // ── Lead lookup ──────────────────────────────────────────────────────────
  const leadById = useMemo(() => {
    const m: Record<string, CRMLead> = {}
    for (const l of leads) m[l.id] = l
    return m
  }, [leads])
  const leadName = (personId: string | null) => {
    if (!personId) return 'Unknown lead'
    const l = leadById[personId]
    return l ? `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed' : 'Unknown lead'
  }

  // ── New leads log ────────────────────────────────────────────────────────
  const newLeadsLog = useMemo(() =>
    [...leads]
      .filter(l => new Date(l.createdAt) >= since)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
  , [leads, since])

  // ── Won deals log ────────────────────────────────────────────────────────
  const wonDeals = useMemo(() =>
    leads.filter(l => l.status === 'Won').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  , [leads])

  // ── Lost deals ───────────────────────────────────────────────────────────
  const lostDeals = useMemo(() =>
    leads.filter(l => l.status === 'Lost')
  , [leads])

  // ── Activity feed ────────────────────────────────────────────────────────
  const activityFeed = useMemo(() =>
    activities.filter(a => typeFilter === 'All' || a.type === typeFilter).slice(0, 80)
  , [activities, typeFilter])

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: 28, height: 28, color: C.blue, animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 pb-24 lg:px-7 lg:py-7 min-h-screen" style={{ background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.push('/dashboard/team')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10 }}>
          <ArrowLeft size={13} /> Team
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 className="hidden lg:block" style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 3px' }}>Team Analytics</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Full activity log · {TF_LABEL[timeframe].toLowerCase()}</p>
          </div>
          <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
            {(['week', 'month', 'quarter'] as Timeframe[]).map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                style={{ padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: timeframe === tf ? C.blue : 'transparent', color: timeframe === tf ? '#fff' : C.muted, transition: 'all 0.15s' }}>
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-[14px] mb-5">
        {[
          { label: 'New Leads',       value: kpis.newLeads,       sub: TF_LABEL[timeframe], icon: <PlusCircle size={17} color={C.blue}    />, accent: C.blue,    dim: C.blueDim    },
          { label: 'Deals Won',        value: kpis.wonLeads,       sub: 'all time',          icon: <Trophy     size={17} color={C.emerald} />, accent: C.emerald, dim: C.emeraldDim },
          { label: 'Hot Leads',        value: kpis.hotLeads,       sub: 'score ≥ 70',        icon: <Flame      size={17} color={C.orange}  />, accent: C.orange,  dim: 'rgba(160,0,200,0.07)'    },
          { label: 'Total Activities', value: kpis.totalActivities, sub: TF_LABEL[timeframe], icon: <Activity   size={17} color={C.violet}  />, accent: C.violet,  dim: C.violetDim  },
          { label: 'Response Rate',    value: `${kpis.responseRate}%`, sub: 'leads contacted',icon: <TrendingUp size={17} color={C.amber}   />, accent: C.amber,   dim: C.amberDim   },
          { label: 'Total Leads',      value: kpis.totalLeads,     sub: 'in system',         icon: <Users      size={17} color={C.label}   />, accent: C.label,   dim: '#F8FAFC'    },
        ].map((k, i) => (
          <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${k.accent}80, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: k.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.5px', lineHeight: 1 }}>{k.value}</div>
            <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Activity Timeline + Type Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-[14px] mb-[14px]">
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 20px 14px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Activity Timeline</h2>
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 16px' }}>Activities logged + new leads per day</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gBlue2"    x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor={C.blue}    stopOpacity={0.18} /><stop offset="95%" stopColor={C.blue}    stopOpacity={0} /></linearGradient>
                <linearGradient id="gEmerald2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor={C.emerald} stopOpacity={0.18} /><stop offset="95%" stopColor={C.emerald} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.floor(timeline.length / 6)} />
              <YAxis tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="activities" stroke={C.blue}    strokeWidth={2} fill="url(#gBlue2)"    name="Activities" dot={false} />
              <Area type="monotone" dataKey="newLeads"   stroke={C.emerald} strokeWidth={2} fill="url(#gEmerald2)" name="New leads"  dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Activity Breakdown</h2>
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 16px' }}>By type · {TF_LABEL[timeframe].toLowerCase()}</p>
          {typeBreakdown.length === 0 ? (
            <p style={{ fontSize: 13, color: C.label, padding: '20px 0', textAlign: 'center' }}>No activities logged yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={typeBreakdown.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: C.label, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="type" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={95} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                  {typeBreakdown.slice(0, 6).map((b, i) => <Cell key={i} fill={b.color} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── New Leads Log + Won / Lost ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-[14px] mb-[14px]">

        {/* New leads added */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <PlusCircle size={16} color={C.blue} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>New Leads Added</h2>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: C.blue, background: C.blueDim, padding: '2px 8px', borderRadius: 20 }}>{newLeadsLog.length}</span>
          </div>
          {newLeadsLog.length === 0 ? (
            <p style={{ fontSize: 13, color: C.label, textAlign: 'center', padding: '20px 0' }}>No new leads {TF_LABEL[timeframe].toLowerCase()}.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {newLeadsLog.map(l => (
                <div key={l.id} onClick={() => router.push(`/dashboard/leads/${l.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: C.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>
                      {l.name.firstName.charAt(0)}{l.name.lastName?.charAt(0) ?? ''}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.name.firstName} {l.name.lastName}
                    </p>
                    <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{l.sourcePortal ?? 'Manual'} · {l.city ?? '—'}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.blue, fontFamily: 'monospace' }}>{l.leadPortalId}</span>
                    <p style={{ fontSize: 10, color: C.label, margin: '2px 0 0' }}>{format(new Date(l.createdAt), 'MMM d, HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Won + Lost summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Won */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CheckCircle2 size={16} color={C.emerald} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Deals Won</h2>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: C.emerald, background: C.emeraldDim, padding: '2px 8px', borderRadius: 20 }}>{wonDeals.length}</span>
            </div>
            {wonDeals.length === 0 ? (
              <p style={{ fontSize: 12, color: C.label, textAlign: 'center', padding: '8px 0' }}>No closed deals yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wonDeals.slice(0, 5).map(l => (
                  <div key={l.id} onClick={() => router.push(`/dashboard/leads/${l.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <Trophy size={13} color={C.emerald} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name.firstName} {l.name.lastName}</p>
                      {l.budgetMax && <p style={{ fontSize: 11, color: C.emerald, margin: 0, fontWeight: 600 }}>₹{(l.budgetMax / 100000).toFixed(0)}L</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lost */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <XCircle size={16} color={C.red} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Deals Lost</h2>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: C.red, background: C.redDim, padding: '2px 8px', borderRadius: 20 }}>{lostDeals.length}</span>
            </div>
            {lostDeals.length === 0 ? (
              <p style={{ fontSize: 12, color: C.label, textAlign: 'center', padding: '8px 0' }}>No lost deals yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lostDeals.slice(0, 5).map(l => (
                  <div key={l.id} onClick={() => router.push(`/dashboard/leads/${l.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <XCircle size={13} color={C.red} />
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name.firstName} {l.name.lastName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Full Activity Feed (boss audit log) ── */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 3px' }}>Full Activity Log</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Every action logged · {TF_LABEL[timeframe].toLowerCase()} · {activityFeed.length} entries</p>
          </div>
          {/* Type filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Filter size={12} color={C.label} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FEED_FILTERS.map(f => (
                <button key={f} onClick={() => setTypeFilter(f)}
                  style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${typeFilter === f ? C.blue : C.border}`, background: typeFilter === f ? C.blueDim : 'transparent', color: typeFilter === f ? C.blue : C.muted, fontSize: 11, fontWeight: typeFilter === f ? 600 : 400, cursor: 'pointer', transition: 'all 0.12s' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activityFeed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Activity size={32} color={C.label} style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>No activities logged yet</p>
            <p style={{ fontSize: 13, color: C.muted }}>Activities appear here when calls are logged, notes are added, and statuses change.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activityFeed.map((a, i) => {
              const Icon  = ACTIVITY_ICON[a.type] ?? Activity
              const color = ACTIVITY_COLOR[a.type] ?? C.label
              const name  = leadName(a.personId)
              const notes = a.notes ? (a.notes.length > 80 ? a.notes.slice(0, 80) + '…' : a.notes) : null
              const outcomeColor = a.outcome ? (OUTCOME_COLOR[a.outcome] ?? C.label) : null
              return (
                <div key={a.id}
                  style={{ display: 'flex', gap: 12, padding: '11px 8px', borderBottom: i < activityFeed.length - 1 ? `1px solid ${C.border}` : 'none', cursor: a.personId ? 'pointer' : 'default', transition: 'background 0.1s', borderRadius: 8 }}
                  onClick={() => a.personId && router.push(`/dashboard/leads/${a.personId}`)}
                  onMouseEnter={e => { if (a.personId) e.currentTarget.style.background = C.bg }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  {/* Icon bubble */}
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Icon size={14} color={color} />
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.type}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>on</span>
                      <span style={{ fontSize: 13, color: C.blue, fontWeight: 500 }}>{name}</span>
                      {a.outcome && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: outcomeColor ?? C.label, background: `${outcomeColor}18`, padding: '1px 8px', borderRadius: 20 }}>{a.outcome}</span>
                      )}
                    </div>
                    {notes && <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0', lineHeight: 1.4 }}>{notes}</p>}
                  </div>
                  {/* Timestamp */}
                  <span style={{ fontSize: 11, color: C.label, flexShrink: 0, paddingTop: 2 }}>
                    {format(new Date(a.createdAt), 'MMM d, HH:mm')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
