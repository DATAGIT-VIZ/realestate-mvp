'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Users, TrendingUp, IndianRupee, Flame, Plus,
  Upload, Mail, ArrowRight, Loader2, Phone,
  LayoutList, BarChart3,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

type CRMLead = {
  id: string
  name: { firstName: string; lastName: string }
  phones: { primaryPhoneNumber: string | null }
  emails: { primaryEmail: string | null }
  intentScore: number | null
  sourcePortal: string | null
  status: string | null
  budgetMin: number | null
  budgetMax: number | null
  createdAt: string
  updatedAt: string
}

const getName     = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getScore    = (l: CRMLead) => l.intentScore ?? 0
const getInitials = (l: CRMLead) =>
  ((l.name.firstName?.[0] ?? '') + (l.name.lastName?.[0] ?? '')).toUpperCase() || '?'

function formatPipeline(n: number) {
  if (n <= 0) return '—'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)} Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(0)} L`
  return `₹${n.toLocaleString()}`
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function scoreTag(score: number) {
  if (score >= 70) return { label: 'Hot',  bg: '#FFF7ED', color: '#C2410C' }
  if (score >= 40) return { label: 'Warm', bg: '#FEF3C7', color: '#92400E' }
  return null
}

const BG     = '#F8FAFC'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'
const LABEL  = '#94A3B8'
const PURPLE = '#7C3AED'
const PURPLE10 = 'rgba(124,58,237,0.10)'

const STAGE_COLORS: Record<string, string> = {
  New:         '#7C3AED',
  Contacted:   '#6366F1',
  Qualified:   '#F59E0B',
  Negotiation: '#F97316',
  Won:         '#10B981',
  Lost:        '#94A3B8',
}

const SOURCE_COLORS = ['#7C3AED','#6366F1','#3B82F6','#10B981','#F59E0B','#F97316','#EC4899','#64748B']

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string
}) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, marginBottom: 14 }}>
        {icon}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: TEXT, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 13, color: MUTED, marginTop: 5, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: LABEL, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function QuickBtn({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <button style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, background: 'transparent', cursor: 'pointer', color: TEXT, fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'all 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = PURPLE; (e.currentTarget as HTMLButtonElement).style.background = PURPLE10 }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexShrink: 0 }}>
          {icon}
        </div>
        {label}
      </button>
    </Link>
  )
}

export default function DashboardPage() {
  const [leads,   setLeads]   = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/crm/leads?limit=100')
      .then(r => r.json())
      .then(d => { setLeads(d.data?.leads ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refresh])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const dateStr = useMemo(() =>
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), [])

  const metrics = useMemo(() => {
    const now  = Date.now()
    const week = 7 * 86400_000
    const hot  = leads.filter(l => getScore(l) >= 70).length
    const warm = leads.filter(l => getScore(l) >= 40 && getScore(l) < 70).length
    const thisWk = leads.filter(l => now - new Date(l.createdAt).getTime() < week).length
    const pipe   = leads.reduce((s, l) => s + (l.budgetMax ?? 0), 0)
    return { hot, warm, thisWk, pipe }
  }, [leads])

  const stageCounts = useMemo(() => {
    const m: Record<string, number> = { New: 0, Contacted: 0, Qualified: 0, Negotiation: 0, Won: 0, Lost: 0 }
    leads.forEach(l => { const s = l.status ?? 'New'; if (s in m) m[s]++; else m.New++ })
    return m
  }, [leads])

  const sourceData = useMemo(() => {
    const m: Record<string, number> = {}
    leads.forEach(l => {
      const s = l.sourcePortal ?? 'Unknown'
      m[s] = (m[s] ?? 0) + 1
    })
    return Object.entries(m)
      .map(([name, value]) => ({ name: name === 'OPT99ACRES' ? '99acres' : name === 'MAGICBRICKS' ? 'MagicBricks' : name === 'HOUSING_COM' ? 'Housing.com' : name === 'FACEBOOK' ? 'Facebook' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [leads])

  const stageChartData = useMemo(() =>
    Object.entries(stageCounts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0),
    [stageCounts])

  const recent = useMemo(() =>
    [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    [leads])

  const totalLeads = leads.length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: BG }}>
      <Loader2 style={{ width: 24, height: 24, color: PURPLE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '-0.03em' }}>{greeting}</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: '4px 0 0' }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setRefresh(r => r + 1)}
              style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              Refresh
            </button>
            <Link href="/dashboard/leads">
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: `linear-gradient(135deg, ${PURPLE}, #5B21B6)`, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }}>
                <Plus style={{ width: 14, height: 14 }} /> New Lead
              </button>
            </Link>
          </div>
        </div>

        {/* Main two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

          {/* LEFT — KPIs + Recent Leads */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <StatCard icon={<Users size={16} />} label="Total Leads" value={totalLeads}
                sub={metrics.thisWk > 0 ? `+${metrics.thisWk} this week` : 'None this week'} accent={PURPLE} />
              <StatCard icon={<Flame size={16} />} label="Hot Leads" value={metrics.hot}
                sub={metrics.hot > 0 ? 'Score 70+' : 'None yet'} accent="#EA580C" />
              <StatCard icon={<TrendingUp size={16} />} label="Warm Leads" value={metrics.warm}
                sub="Score 40–69" accent="#D97706" />
              <StatCard icon={<IndianRupee size={16} />} label="Total Pipeline"
                value={formatPipeline(metrics.pipe)} sub="Combined budgets" accent="#059669" />
            </div>

            {/* Recent Leads */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 22px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent Leads</span>
                <Link href="/dashboard/leads" style={{ fontSize: 12, color: PURPLE, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                  View all <ArrowRight size={12} />
                </Link>
              </div>

              {recent.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED, fontSize: 13 }}>No leads yet</div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 70px', gap: 10, paddingBottom: 8, borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
                    {['Lead', 'Score', 'Source', 'Added'].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                    ))}
                  </div>
                  {recent.map((lead, i) => (
                    <LeadRow key={lead.id} lead={lead} tag={scoreTag(getScore(lead))} init={getInitials(lead)} isLast={i === recent.length - 1} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Charts + Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Chart 1: Lead Sources donut */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Lead Sources</div>
              {sourceData.length === 0 ? (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LABEL, fontSize: 13 }}>No data yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {sourceData.map((_, i) => (
                          <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={{ borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
                    {sourceData.map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                        <span style={{ color: MUTED }}>{d.name}</span>
                        <span style={{ fontWeight: 700, color: TEXT }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Chart 2: Pipeline stages bar */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Pipeline Stages</div>
              {stageChartData.length === 0 ? (
                <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LABEL, fontSize: 13 }}>No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={stageChartData} margin={{ top: 0, right: 0, bottom: 0, left: -28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: LABEL }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: LABEL }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {stageChartData.map((d, i) => (
                        <Cell key={i} fill={STAGE_COLORS[d.name] ?? PURPLE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Quick Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <QuickBtn icon={<Plus size={13} />}       label="Add New Lead"    href="/dashboard/leads" />
                <QuickBtn icon={<Upload size={13} />}     label="Import CSV"      href="/dashboard/leads" />
                <QuickBtn icon={<Mail size={13} />}       label="Parse Email"     href="/dashboard/leads/ingestion" />
                <QuickBtn icon={<LayoutList size={13} />} label="View All Leads"  href="/dashboard/leads" />
                <QuickBtn icon={<BarChart3 size={13} />}  label="Analytics"       href="/dashboard/analytics" />
              </div>
            </div>

          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function LeadRow({ lead, tag, init, isLast }: {
  lead: CRMLead; tag: { label: string; bg: string; color: string } | null; init: string; isLast: boolean
}) {
  return (
    <Link href={`/dashboard/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 70px', gap: 10, padding: '9px 4px', borderBottom: isLast ? 'none' : `1px solid ${BORDER}`, cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: PURPLE10, color: PURPLE, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{init}</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getName(lead)}</div>
            <div style={{ fontSize: 11, color: LABEL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lead.phones.primaryPhoneNumber ?? lead.emails.primaryEmail ?? '—'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {tag ? <span style={{ padding: '2px 8px', borderRadius: 6, background: tag.bg, color: tag.color, fontSize: 10, fontWeight: 600 }}>{tag.label}</span>
            : <span style={{ fontSize: 12, color: LABEL }}>—</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <span style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.sourcePortal ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: LABEL }}>{timeAgo(lead.createdAt)}</span>
        </div>
      </div>
    </Link>
  )
}
