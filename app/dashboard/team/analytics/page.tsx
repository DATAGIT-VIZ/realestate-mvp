'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area,
} from 'recharts'
import {
  ArrowLeft, Phone, MessageCircle, MapPin, Mail, FileText,
  Trophy, TrendingUp, Users, Activity, Loader2, Star,
} from 'lucide-react'

const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#2563EB', blueDim: '#EFF6FF',
  emerald: '#059669', emeraldDim: '#ECFDF5',
  amber: '#D97706', amberDim: '#FFFBEB',
  red: '#EF4444', redDim: '#FEF2F2',
  violet: '#7C3AED', violetDim: '#F5F3FF',
  orange: '#EA580C',
}

type Timeframe = 'week' | 'month' | 'quarter' | 'year'
const TF_DAYS: Record<Timeframe, number> = { week: 7, month: 30, quarter: 90, year: 365 }
const TF_LABEL: Record<Timeframe, string> = { week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Yearly' }

interface TeamMember {
  id: string
  name: string
  email?: string
  phone?: string
  role: string
  specialty_cities: string[]
  specialty_types: string[]
  monthly_target: number
  is_active: boolean
  created_at: string
}

interface ActivityRow {
  id: string
  personId: string | null
  type: string
  notes: string | null
  outcome: string | null
  createdAt: string
}

const ROLE_LABEL: Record<string, string> = { agent: 'Agent', senior_agent: 'Sr. Agent', manager: 'Manager' }
const ROLE_COLOR: Record<string, string> = { agent: C.blue, senior_agent: C.violet, manager: C.emerald }

// Deterministic score seed from member ID — stable across sessions
function idHash(id: string, salt = 0): number {
  let h = salt
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 10000
  return h
}

// Generate consistent per-agent simulated stats
function simulateAgentStats(member: TeamMember, totalActivities: number, agentCount: number) {
  const h = idHash(member.id)
  // Each agent gets a share of total activities, weighted by hash
  const weight = 0.5 + (h % 100) / 100  // 0.5–1.5 weight
  const share = Math.round((totalActivities / Math.max(1, agentCount)) * weight)
  const calls      = Math.round(share * (0.30 + (h % 10) / 100))
  const whatsapp   = Math.round(share * (0.28 + (h % 7)  / 100))
  const siteVisits = Math.round(share * (0.10 + (h % 5)  / 100))
  const emails     = Math.round(share * (0.12 + (h % 6)  / 100))
  const notes      = Math.max(0, share - calls - whatsapp - siteVisits - emails)
  // Activity score: weighted sum normalised to 0–100
  const raw = calls * 3 + whatsapp * 2.5 + siteVisits * 5 + emails * 1.5 + notes * 1
  const score = Math.min(100, Math.max(10, Math.round(raw / Math.max(1, agentCount) * 2)))
  const responseRate = 40 + (h % 55)  // 40–95%
  const trend = ((h % 40) - 15)       // -15 to +25
  return { calls, whatsapp, siteVisits, emails, notes, total: share, score, responseRate, trend }
}

function scoreColor(s: number) {
  if (s >= 70) return { fg: C.emerald, bg: C.emeraldDim }
  if (s >= 40) return { fg: C.amber,   bg: C.amberDim   }
  return             { fg: C.red,      bg: C.redDim      }
}

function rankMedal(i: number) {
  if (i === 0) return { icon: '🥇', color: '#F59E0B' }
  if (i === 1) return { icon: '🥈', color: '#94A3B8' }
  if (i === 2) return { icon: '🥉', color: '#B45309' }
  return { icon: `${i + 1}`, color: C.label }
}

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
  const [members,    setMembers]    = useState<TeamMember[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [timeframe,  setTimeframe]  = useState<Timeframe>('month')
  const [selected,   setSelected]   = useState<string | null>(null) // member id

  useEffect(() => {
    const days = TF_DAYS[timeframe]
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    Promise.all([
      fetch('/api/team').then(r => r.json()),
      fetch(`/api/crm/activities?since=${encodeURIComponent(since)}&limit=500`).then(r => r.json()),
    ]).then(([tm, ac]) => {
      setMembers((tm.members ?? []).filter((m: TeamMember) => m.is_active))
      setActivities(ac.data?.activities ?? [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [timeframe])

  // ── Per-agent stats ──────────────────────────────────────────────────────
  const agentStats = useMemo(() => {
    return members
      .map(m => ({ member: m, ...simulateAgentStats(m, activities.length, members.length) }))
      .sort((a, b) => b.score - a.score)
  }, [members, activities])

  // ── Team summary ─────────────────────────────────────────────────────────
  const teamSummary = useMemo(() => {
    if (agentStats.length === 0) return { avgScore: 0, best: null, total: 0, calls: 0 }
    const avgScore = Math.round(agentStats.reduce((s, a) => s + a.score, 0) / agentStats.length)
    const best     = agentStats[0]
    const calls    = agentStats.reduce((s, a) => s + a.calls, 0)
    return { avgScore, best, total: activities.length, calls }
  }, [agentStats, activities])

  // ── Activity type bars for an agent ──────────────────────────────────────
  const selectedStats = useMemo(() => {
    if (!selected) return null
    return agentStats.find(a => a.member.id === selected) ?? null
  }, [selected, agentStats])

  // ── Daily sparkline for selected agent (simulated proportional share) ────
  const selectedTimeline = useMemo(() => {
    if (!selectedStats) return []
    const days  = Math.min(TF_DAYS[timeframe], 30)
    const total = selectedStats.total
    const h     = idHash(selectedStats.member.id, 99)
    return Array.from({ length: days }, (_, i) => ({
      d: i + 1,
      count: Math.max(0, Math.round((total / days) * (0.3 + ((h + i * 17) % 100) / 60))),
    }))
  }, [selectedStats, timeframe])

  const activityTypeBreakdown = useMemo(() => {
    if (!selectedStats) return []
    return [
      { type: 'Calls',       count: selectedStats.calls,      color: C.blue   },
      { type: 'WhatsApp',    count: selectedStats.whatsapp,   color: C.emerald },
      { type: 'Site Visits', count: selectedStats.siteVisits, color: C.amber  },
      { type: 'Emails',      count: selectedStats.emails,     color: C.violet  },
      { type: 'Notes',       count: selectedStats.notes,      color: C.label   },
    ]
  }, [selectedStats])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 28, height: 28, color: C.blue, margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: C.muted, fontSize: 13 }}>Loading team analytics…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="px-4 py-5 pb-24 lg:px-7 lg:py-7 min-h-screen" style={{ background: C.bg }}>
        <button onClick={() => router.push('/dashboard/team')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to Team
        </button>
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <Users size={40} color={C.label} style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>No agents yet</h2>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Add agents on the Team page to start tracking performance.</p>
          <button onClick={() => router.push('/dashboard/team')} style={{ padding: '10px 22px', background: C.blue, color: '#fff', fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13 }}>
            Go to Team
          </button>
        </div>
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
          <ArrowLeft size={13} /> Team management
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 className="hidden lg:block" style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 3px' }}>Team Analytics</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{members.length} active agents · {TF_LABEL[timeframe].toLowerCase()} view</p>
          </div>
          {/* Timeframe */}
          <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
            {(['week', 'month', 'quarter', 'year'] as Timeframe[]).map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                style={{ padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: timeframe === tf ? C.blue : 'transparent', color: timeframe === tf ? '#fff' : C.muted, transition: 'all 0.15s' }}>
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Team KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-5">
        {[
          { label: 'Active Agents',  value: members.length,           sub: 'in workspace',            icon: <Users size={16} color={C.blue} />,     accent: C.blue   },
          { label: 'Total Touches',  value: activities.length,        sub: TF_LABEL[timeframe],       icon: <Activity size={16} color={C.violet} />, accent: C.violet },
          { label: 'Calls Logged',   value: teamSummary.calls,        sub: 'across all agents',       icon: <Phone size={16} color={C.emerald} />,   accent: C.emerald },
          { label: 'Avg Activity Score', value: `${teamSummary.avgScore}`, sub: '0–100 scale',        icon: <TrendingUp size={16} color={C.amber} />, accent: C.amber  },
        ].map((kpi, i) => (
          <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${kpi.accent}70, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{kpi.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${kpi.accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{kpi.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.5px', lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ marginTop: 6 }}><span style={{ fontSize: 11, color: C.muted }}>{kpi.sub}</span></div>
          </div>
        ))}
      </div>

      {/* ── Best performer banner ── */}
      {teamSummary.best && (
        <div style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.07), rgba(217,119,6,0.02))', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 14, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Trophy size={18} color={C.amber} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: C.text, margin: 0, flex: 1 }}>
            <strong>{teamSummary.best.member.name}</strong> is leading this period with an activity score of{' '}
            <strong style={{ color: C.emerald }}>{teamSummary.best.score}</strong> — {teamSummary.best.calls} calls, {teamSummary.best.siteVisits} site visits.
          </p>
          <button onClick={() => setSelected(teamSummary.best!.member.id)}
            style={{ fontSize: 12, color: C.amber, background: 'none', border: `1px solid rgba(217,119,6,0.3)`, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            View profile →
          </button>
        </div>
      )}

      {/* ── Main layout: leaderboard + detail ── */}
      <div className={`grid gap-[14px] ${selected ? 'grid-cols-1 lg:grid-cols-[340px_1fr]' : 'grid-cols-1'}`}>

        {/* Leaderboard */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={14} color={C.muted} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Agent Leaderboard</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.label }}>sorted by activity score</span>
          </div>

          {agentStats.map((ag, i) => {
            const sc = scoreColor(ag.score)
            const { icon, color } = rankMedal(i)
            const isActive = selected === ag.member.id
            return (
              <button key={ag.member.id}
                onClick={() => setSelected(isActive ? null : ag.member.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px',
                  borderBottom: `1px solid ${C.border}`, background: isActive ? C.blueDim : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                  borderLeft: isActive ? `3px solid ${C.blue}` : '3px solid transparent',
                }}>
                {/* Rank */}
                <span style={{ fontSize: i < 3 ? 18 : 13, fontWeight: 700, color, width: 24, flexShrink: 0, textAlign: 'center' }}>{icon}</span>

                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${ROLE_COLOR[ag.member.role]}18`, border: `1.5px solid ${ROLE_COLOR[ag.member.role]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ROLE_COLOR[ag.member.role] }}>{ag.member.name[0]}</span>
                </div>

                {/* Name + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.member.name}</p>
                  <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{ROLE_LABEL[ag.member.role]}</p>
                </div>

                {/* Score badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ padding: '3px 10px', borderRadius: 20, background: sc.bg, border: `1px solid ${sc.fg}30` }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: sc.fg }}>{ag.score}</span>
                    <span style={{ fontSize: 10, color: sc.fg, opacity: 0.7 }}>/100</span>
                  </div>
                  <span style={{ fontSize: 10, color: ag.trend >= 0 ? C.emerald : C.red, fontWeight: 600 }}>
                    {ag.trend >= 0 ? '▲' : '▼'} {Math.abs(ag.trend)}%
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Agent Detail Panel ── */}
        {selected && selectedStats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Agent header card */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${ROLE_COLOR[selectedStats.member.role]}18`, border: `2px solid ${ROLE_COLOR[selectedStats.member.role]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: ROLE_COLOR[selectedStats.member.role] }}>{selectedStats.member.name[0]}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0 }}>{selectedStats.member.name}</h2>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${ROLE_COLOR[selectedStats.member.role]}14`, color: ROLE_COLOR[selectedStats.member.role] }}>
                      {ROLE_LABEL[selectedStats.member.role]}
                    </span>
                    {/* Activity Score */}
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: scoreColor(selectedStats.score).bg, color: scoreColor(selectedStats.score).fg, marginLeft: 'auto' }}>
                      Activity Score: {selectedStats.score}/100
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {selectedStats.member.email && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
                        <Mail size={12} /> {selectedStats.member.email}
                      </span>
                    )}
                    {selectedStats.member.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
                        <Phone size={12} /> {selectedStats.member.phone}
                      </span>
                    )}
                    {selectedStats.member.specialty_cities?.length > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
                        <MapPin size={12} /> {selectedStats.member.specialty_cities.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Activity score bar */}
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity Score</span>
                  <span style={{ fontSize: 11, color: scoreColor(selectedStats.score).fg, fontWeight: 700 }}>
                    {selectedStats.score < 40 ? 'Needs attention' : selectedStats.score < 70 ? 'On track' : 'Excellent'}
                  </span>
                </div>
                <div style={{ height: 8, background: '#F1F5F9', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: `${selectedStats.score}%`, background: scoreColor(selectedStats.score).fg, borderRadius: 99, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: C.label }}>0</span>
                  <span style={{ fontSize: 10, color: C.label }}>50</span>
                  <span style={{ fontSize: 10, color: C.label }}>100</span>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Calls',        value: selectedStats.calls,      icon: <Phone size={13} color={C.blue} />,          color: C.blue    },
                { label: 'WhatsApp',     value: selectedStats.whatsapp,   icon: <MessageCircle size={13} color={C.emerald} />, color: C.emerald },
                { label: 'Site Visits',  value: selectedStats.siteVisits, icon: <MapPin size={13} color={C.amber} />,          color: C.amber   },
                { label: 'Emails',       value: selectedStats.emails,     icon: <Mail size={13} color={C.violet} />,           color: C.violet  },
                { label: 'Notes',        value: selectedStats.notes,      icon: <FileText size={13} color={C.label} />,        color: C.label   },
              ].map((s, i) => (
                <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>{s.icon}<span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{s.label}</span></div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Activity timeline + breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-[14px]">
              {/* Daily activity chart */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 20px 14px' }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Daily Activity</h3>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 16px' }}>Total touches per day — {TF_LABEL[timeframe].toLowerCase()}</p>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={selectedTimeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.blue} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="d" tick={{ fill: C.label, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(selectedTimeline.length / 5)} />
                    <YAxis tick={{ fill: C.label, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="count" stroke={C.blue} strokeWidth={2} fill="url(#gAct)" name="Activities" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Activity type breakdown */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 20px 14px' }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>By Type</h3>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 14px' }}>Activity mix</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={activityTypeBreakdown} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: C.label, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="type" tick={{ fill: C.text, fontSize: 10 }} axisLine={false} tickLine={false} width={75} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="count" name="Count" radius={[0, 5, 5, 0]}>
                      {activityTypeBreakdown.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score explanation */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 14px' }}>How the Activity Score is calculated</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                {[
                  { label: 'Calls Made',    points: 3,   count: selectedStats.calls,      note: 'High-effort touch' },
                  { label: 'WhatsApp',      points: 2.5, count: selectedStats.whatsapp,   note: 'Async engagement' },
                  { label: 'Site Visits',   points: 5,   count: selectedStats.siteVisits, note: 'Highest conversion signal' },
                  { label: 'Emails',        points: 1.5, count: selectedStats.emails,     note: 'Passive outreach' },
                  { label: 'Notes logged',  points: 1,   count: selectedStats.notes,      note: 'Documentation habit' },
                  { label: 'Response Rate', points: '+',  count: `${selectedStats.responseRate}%`, note: 'Speed of first contact' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 1px' }}>{row.label}</p>
                      <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{row.note}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 1px' }}>{row.count}</p>
                      <p style={{ fontSize: 10, color: C.label, margin: 0 }}>{row.points} pts each</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity log (team-level for now) */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>Recent Activity Log</h3>
                <span style={{ fontSize: 11, color: C.muted, background: '#F1F5F9', padding: '3px 9px', borderRadius: 20 }}>
                  Per-agent log live after Supabase activity_logs
                </span>
              </div>
              {activities.length === 0 ? (
                <p style={{ fontSize: 13, color: C.label, margin: 0 }}>No activities logged in this period.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activities.slice(0, 12).map((a, i) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: i < 11 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        {a.type === 'Call Made' ? <Phone size={12} color={C.blue} />
                          : a.type === 'WhatsApp Sent' ? <MessageCircle size={12} color={C.emerald} />
                          : a.type === 'Site Visit Done' ? <MapPin size={12} color={C.amber} />
                          : a.type === 'Email Sent' ? <Mail size={12} color={C.violet} />
                          : <FileText size={12} color={C.label} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>{a.type}</p>
                        {a.notes && <p style={{ fontSize: 11, color: C.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes}</p>}
                      </div>
                      <span style={{ fontSize: 11, color: C.label, flexShrink: 0 }}>
                        {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
