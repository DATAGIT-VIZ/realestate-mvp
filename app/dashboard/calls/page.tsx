'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Phone, PhoneMissed, PhoneOff, PhoneCall,
  Clock, RefreshCw, Loader2, Mic, TrendingUp, X,
} from 'lucide-react'
import { format, subDays, parseISO, getHours } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const C = {
  bg:      '#F8FAFC',
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  emerald: '#059669',
  red:     '#DC2626',
  amber:   '#D97706',
  blue:    '#2563EB',
  orange:  '#EA580C',
}

type CallRow = {
  id:           string
  personId:     string | null
  outcome:      string
  duration:     number
  recordingUrl: string | null
  callSid:      string
  notes:        string
  createdAt:    string
}

type LeadMap = Record<string, { name: string; phone: string }>

const OUTCOME_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'Answered':   { icon: PhoneCall,  color: C.emerald, bg: 'rgba(5,150,105,0.08)'  },
  'No Answer':  { icon: PhoneMissed,color: C.amber,   bg: 'rgba(217,119,6,0.08)' },
  'Busy':       { icon: PhoneOff,   color: C.orange,  bg: 'rgba(234,88,12,0.08)' },
  'Failed':     { icon: X,          color: C.red,     bg: 'rgba(220,38,38,0.08)' },
  'Cancelled':  { icon: X,          color: C.label,   bg: 'rgba(148,163,184,0.1)' },
  'Wrong Num':  { icon: X,          color: C.red,     bg: 'rgba(220,38,38,0.08)' },
  'Call Back':  { icon: Clock,      color: C.blue,    bg: 'rgba(37,99,235,0.08)' },
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return format(parseISO(iso), 'd MMM, h:mm a')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: C.muted, margin: '0 0 4px' }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: 0, color: C.text }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

export default function CallsPage() {
  const router = useRouter()
  const [calls, setCalls]       = useState<CallRow[]>([])
  const [leadMap, setLeadMap]   = useState<LeadMap>({})
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [callsRes, leadsRes] = await Promise.all([
        fetch('/api/calls/history?limit=200').then(r => r.json()),
        fetch('/api/crm/leads?limit=200').then(r => r.json()),
      ])

      setCalls(callsRes.data?.calls ?? [])

      // Build leadId → name+phone map
      const map: LeadMap = {}
      for (const l of (leadsRes.data?.leads ?? [])) {
        map[l.id] = {
          name:  `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unknown',
          phone: l.phones?.primaryPhoneNumber ?? '',
        }
      }
      setLeadMap(map)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const today = calls.filter(c => c.createdAt.startsWith(format(new Date(), 'yyyy-MM-dd')))
    const answered = calls.filter(c => c.outcome === 'Answered')
    const totalDuration = answered.reduce((s, c) => s + c.duration, 0)
    const avgDuration   = answered.length > 0 ? Math.round(totalDuration / answered.length) : 0
    const connectRate   = calls.length > 0 ? Math.round((answered.length / calls.length) * 100) : 0
    return { total: calls.length, today: today.length, connectRate, avgDuration }
  }, [calls])

  // ── Daily volume (last 14 days) ────────────────────────────────────────────────
  const dailyVolume = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d   = subDays(new Date(), 13 - i)
      const str = format(d, 'yyyy-MM-dd')
      const day = calls.filter(c => c.createdAt.startsWith(str))
      return {
        date:      format(d, 'MMM dd'),
        calls:     day.length,
        answered:  day.filter(c => c.outcome === 'Answered').length,
      }
    })
  }, [calls])

  // ── Best time to call (hour histogram) ───────────────────────────────────────
  const hourHistogram = useMemo(() => {
    const answered = calls.filter(c => c.outcome === 'Answered')
    return Array.from({ length: 12 }, (_, i) => {
      const hour  = 8 + i  // 8 AM → 7 PM
      const label = `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`
      const total   = calls.filter(c => getHours(parseISO(c.createdAt)) === hour).length
      const ansCount = answered.filter(c => getHours(parseISO(c.createdAt)) === hour).length
      return { label, total, answered: ansCount, rate: total > 0 ? Math.round((ansCount / total) * 100) : 0 }
    })
  }, [calls])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader2 style={{ width: 22, height: 22, color: C.emerald, animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, color: C.muted }}>Loading call log…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Call Log</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>{kpis.total} calls recorded</p>
          </div>
          <button onClick={() => { setRefreshing(true); fetchData() }} disabled={refreshing}
            style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}
          >
            <RefreshCw style={{ width: 15, height: 15, color: C.muted, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Calls',    value: kpis.total,              icon: <Phone style={{ width: 17, height: 17, color: C.blue }} />,    accent: C.blue    },
            { label: 'Today',          value: kpis.today,              icon: <Clock style={{ width: 17, height: 17, color: C.amber }} />,    accent: C.amber   },
            { label: 'Connect Rate',   value: `${kpis.connectRate}%`,  icon: <TrendingUp style={{ width: 17, height: 17, color: C.emerald }} />, accent: C.emerald },
            { label: 'Avg Duration',   value: fmt(kpis.avgDuration),   icon: <Mic style={{ width: 17, height: 17, color: C.orange }} />,     accent: C.orange  },
          ].map((k, i) => (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${k.accent}80,transparent)` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</span>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${k.accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.5px' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── Charts row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 14, marginBottom: 24 }}>

          {/* Daily volume */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Daily Call Volume</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Last 14 days — total vs answered</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyVolume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.label, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="calls"    name="Total"    fill={`${C.blue}40`}  radius={[4,4,0,0]} />
                <Bar dataKey="answered" name="Answered" fill={C.emerald}       radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Best time to call */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Best Time to Call</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Connect rate by hour of day</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourHistogram} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.label, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.label, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0,100]} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="rate" name="Connect %" radius={[4,4,0,0]}>
                  {hourHistogram.map((h, i) => (
                    <Cell key={i} fill={h.rate >= 60 ? C.emerald : h.rate >= 30 ? C.amber : C.label} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Call log table ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Recent Calls</h2>
          </div>

          {calls.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(5,150,105,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Phone style={{ width: 22, height: 22, color: C.emerald }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>No calls logged yet</h3>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Go to a lead and click the Call button to log your first call.</p>
              <button onClick={() => router.push('/dashboard/leads')}
                style={{ padding: '10px 24px', background: C.blue, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Go to Leads
              </button>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr', gap: 12, padding: '10px 22px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
                {['Lead', 'When', 'Outcome', 'Duration', 'Notes', 'Recording'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>

              {calls.map((call, idx) => {
                const lead   = call.personId ? leadMap[call.personId] : null
                const meta   = OUTCOME_META[call.outcome] ?? { icon: Phone, color: C.label, bg: '#F1F5F9' }
                const Icon   = meta.icon

                return (
                  <div key={call.id}
                    onClick={() => call.personId && router.push(`/dashboard/leads/${call.personId}`)}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr', gap: 12,
                      padding: '14px 22px',
                      borderBottom: idx < calls.length - 1 ? `1px solid ${C.border}` : 'none',
                      cursor: call.personId ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (call.personId) e.currentTarget.style.background = '#F8FAFC' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>
                        {lead?.name ?? 'Unknown Lead'}
                      </p>
                      <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{lead?.phone ?? '—'}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.muted }}>{timeAgo(call.createdAt)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: meta.bg, borderRadius: 20, fontSize: 11, fontWeight: 600, color: meta.color }}>
                        <Icon style={{ width: 10, height: 10 }} />
                        {call.outcome}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: call.duration > 0 ? C.text : C.label }}>
                        {call.duration > 0 ? fmt(call.duration) : '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                        {call.notes || '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {call.recordingUrl ? (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.blue, textDecoration: 'none', fontWeight: 600 }}
                        >
                          <Mic style={{ width: 12, height: 12 }} /> Play
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: C.label }}>—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
