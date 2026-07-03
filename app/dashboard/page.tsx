'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Users, TrendingUp, IndianRupee, Zap, Plus, Upload,
  Mail, ArrowRight, Loader2, Phone, MessageCircle,
  LayoutList, BarChart3,
} from 'lucide-react'

// ─── types ─────────────────────────────────────────────────────────────────────
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
  propertyType: string[] | null
  localities: string[] | null
  timeline: string | null
  createdAt: string
  updatedAt: string
}

// ─── helpers ───────────────────────────────────────────────────────────────────
const getName  = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getScore = (l: CRMLead) => l.intentScore ?? 0
const getInitials = (l: CRMLead) =>
  ((l.name.firstName?.[0] ?? '') + (l.name.lastName?.[0] ?? '')).toUpperCase() || '?'

function formatPipeline(n: number) {
  if (n <= 0) return '—'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)} Cr`
  if (n >= 100_000)   return `₹${(n / 100_000).toFixed(0)} L`
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
  if (score >= 40) return { label: 'Warm', bg: '#FFFBEB', color: '#92400E' }
  if (score >   0) return { label: 'Cold', bg: '#F1F5F9', color: '#475569' }
  return null
}

// ─── design tokens ─────────────────────────────────────────────────────────────
const BG      = '#F8FAFC'
const PANEL   = '#FFFFFF'
const BORDER  = '#E2E8F0'
const TEXT    = '#0F172A'
const MUTED   = '#64748B'
const LABEL   = '#94A3B8'
const BLUE    = '#2563EB'
const BLUE10  = 'rgba(37,99,235,0.10)'

const STAGE_COLORS: Record<string, string> = {
  New:         '#3B82F6',
  Contacted:   '#6366F1',
  Qualified:   '#F59E0B',
  Negotiation: '#F97316',
  Won:         '#10B981',
  Lost:        '#94A3B8',
}

// ─── sub-components ────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode; label: string; value: string | number
  sub?: string; accent: string
}) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16,
      padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 700, color: TEXT, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value}
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 5, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: LABEL, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function QuickBtn({
  icon, label, href,
}: {
  icon: React.ReactNode; label: string; href: string
}) {
  const [hover, setHover] = useState(false)
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 14px', border: `1px solid ${hover ? BLUE : BORDER}`,
          borderRadius: 10, background: hover ? BLUE10 : 'transparent',
          cursor: 'pointer', color: TEXT, fontSize: 13, fontWeight: 500,
          textAlign: 'left', transition: 'all 0.15s',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: hover ? BLUE10 : '#F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: hover ? BLUE : MUTED, flexShrink: 0,
          transition: 'all 0.15s',
        }}>
          {icon}
        </div>
        <span style={{ color: hover ? BLUE : TEXT, transition: 'color 0.15s' }}>{label}</span>
      </button>
    </Link>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [leads, setLeads]   = useState<CRMLead[]>([])
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
    new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }), [])

  const metrics = useMemo(() => {
    const now    = Date.now()
    const week   = 7 * 86400_000
    const hot    = leads.filter(l => getScore(l) >= 70).length
    const warm   = leads.filter(l => getScore(l) >= 40 && getScore(l) < 70).length
    const thisWk = leads.filter(l => now - new Date(l.createdAt).getTime() < week).length
    const pipe   = leads.reduce((s, l) => s + (l.budgetMax ?? 0), 0)
    return { hot, warm, thisWk, pipe }
  }, [leads])

  const stageCounts = useMemo(() => {
    const m: Record<string, number> = {
      New: 0, Contacted: 0, Qualified: 0, Negotiation: 0, Won: 0, Lost: 0,
    }
    leads.forEach(l => {
      const s = l.status ?? 'New'
      if (s in m) m[s]++; else m.New++
    })
    return m
  }, [leads])

  const recent = useMemo(() =>
    [...leads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 7),
    [leads])

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: BG,
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{
            width: 24, height: 24, color: BLUE, margin: '0 auto 12px',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  const totalLeads = leads.length

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '36px 32px' }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 32,
        }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '-0.02em' }}>
              {greeting}
            </h1>
            <p style={{ fontSize: 13, color: MUTED, margin: '5px 0 0' }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setRefresh(r => r + 1)}
              style={{
                padding: '9px 14px', background: 'transparent', border: `1px solid ${BORDER}`,
                borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer', fontWeight: 500,
              }}
            >
              Refresh
            </button>
            <Link href="/dashboard/leads">
              <button style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                background: BLUE, border: 'none', borderRadius: 10,
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 1px 6px rgba(37,99,235,0.25)',
              }}>
                <Plus style={{ width: 14, height: 14 }} />
                New Lead
              </button>
            </Link>
          </div>
        </div>

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14, marginBottom: 18,
        }}>
          <StatCard
            icon={<Users style={{ width: 17, height: 17 }} />}
            label="Total Leads" value={totalLeads}
            sub={metrics.thisWk > 0 ? `+${metrics.thisWk} this week` : 'None this week'}
            accent={BLUE}
          />
          <StatCard
            icon={<Zap style={{ width: 17, height: 17 }} />}
            label="Hot Leads" value={metrics.hot}
            sub={metrics.hot > 0 ? 'Score ≥ 70' : 'None yet'}
            accent="#EA580C"
          />
          <StatCard
            icon={<TrendingUp style={{ width: 17, height: 17 }} />}
            label="Warm Leads" value={metrics.warm}
            sub="Score 40–69"
            accent="#D97706"
          />
          <StatCard
            icon={<IndianRupee style={{ width: 17, height: 17 }} />}
            label="Total Pipeline"
            value={formatPipeline(metrics.pipe)}
            sub="Combined max budgets"
            accent="#059669"
          />
        </div>

        {/* ── Pipeline Bar ───────────────────────────────────────────────── */}
        <div style={{
          background: PANEL, border: `1px solid ${BORDER}`,
          borderRadius: 16, padding: '20px 24px', marginBottom: 18,
        }}>
          <h2 style={{
            fontSize: 11, fontWeight: 700, color: LABEL, margin: '0 0 14px',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Pipeline Overview
          </h2>

          {/* segmented bar */}
          <div style={{
            display: 'flex', height: 8, borderRadius: 6,
            overflow: 'hidden', gap: 1.5, background: '#F1F5F9', marginBottom: 16,
          }}>
            {totalLeads === 0 ? (
              <div style={{ flex: 1, background: '#E2E8F0' }} />
            ) : (
              Object.entries(stageCounts).map(([stage, count]) =>
                count === 0 ? null : (
                  <div
                    key={stage}
                    title={`${stage}: ${count}`}
                    style={{
                      flex: count,
                      background: STAGE_COLORS[stage] ?? '#94A3B8',
                      minWidth: 4,
                    }}
                  />
                )
              )
            )}
          </div>

          {/* stage labels */}
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            {Object.entries(stageCounts).map(([stage, count]) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: STAGE_COLORS[stage] ?? '#94A3B8',
                }} />
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>{stage}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? TEXT : LABEL }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Grid ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 256px', gap: 16 }}>

          {/* Recent Leads */}
          <div style={{
            background: PANEL, border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: '20px 24px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16,
            }}>
              <h2 style={{
                fontSize: 11, fontWeight: 700, color: LABEL, margin: 0,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Recent Leads
              </h2>
              <Link href="/dashboard/leads" style={{
                fontSize: 12, color: BLUE, fontWeight: 600, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                View all <ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Users style={{ width: 36, height: 36, color: LABEL, margin: '0 auto 14px' }} />
                <p style={{ fontSize: 14, color: MUTED, margin: 0, fontWeight: 600 }}>No leads yet</p>
                <p style={{ fontSize: 12, color: LABEL, margin: '5px 0 16px' }}>
                  Add your first lead to get started
                </p>
                <Link href="/dashboard/leads">
                  <button style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', background: BLUE, border: 'none',
                    borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    <Plus style={{ width: 14, height: 14 }} />Add Lead
                  </button>
                </Link>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 70px 110px 75px',
                  gap: 12, paddingBottom: 8,
                  borderBottom: `1px solid ${BORDER}`, marginBottom: 2,
                }}>
                  {['Lead', 'Score', 'Source', 'Added'].map(h => (
                    <span key={h} style={{
                      fontSize: 11, fontWeight: 600, color: LABEL,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {recent.map((lead, i) => {
                  const score = getScore(lead)
                  const tag   = scoreTag(score)
                  const init  = getInitials(lead)

                  return (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      tag={tag}
                      init={init}
                      isLast={i === recent.length - 1}
                    />
                  )
                })}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Quick Actions */}
            <div style={{
              background: PANEL, border: `1px solid ${BORDER}`,
              borderRadius: 16, padding: '20px',
            }}>
              <h2 style={{
                fontSize: 11, fontWeight: 700, color: LABEL, margin: '0 0 14px',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Quick Actions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <QuickBtn
                  icon={<Plus style={{ width: 14, height: 14 }} />}
                  label="Add New Lead"
                  href="/dashboard/leads"
                />
                <QuickBtn
                  icon={<Upload style={{ width: 14, height: 14 }} />}
                  label="Import CSV"
                  href="/dashboard/leads"
                />
                <QuickBtn
                  icon={<Mail style={{ width: 14, height: 14 }} />}
                  label="Parse Email Lead"
                  href="/dashboard/leads"
                />
                <QuickBtn
                  icon={<LayoutList style={{ width: 14, height: 14 }} />}
                  label="View All Leads"
                  href="/dashboard/leads"
                />
                <QuickBtn
                  icon={<BarChart3 style={{ width: 14, height: 14 }} />}
                  label="Analytics"
                  href="/dashboard/analytics"
                />
              </div>
            </div>

            {/* Lead Quality */}
            <div style={{
              background: PANEL, border: `1px solid ${BORDER}`,
              borderRadius: 16, padding: '20px',
            }}>
              <h2 style={{
                fontSize: 11, fontWeight: 700, color: LABEL, margin: '0 0 16px',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Lead Quality
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Hot', sub: 'Score ≥ 70', count: metrics.hot,  color: '#EA580C', bg: '#FFF7ED' },
                  { label: 'Warm', sub: 'Score 40–69', count: metrics.warm, color: '#D97706', bg: '#FFFBEB' },
                  {
                    label: 'Cold / Unscored', sub: 'Score < 40',
                    count: totalLeads - metrics.hot - metrics.warm,
                    color: '#94A3B8', bg: '#F8FAFC',
                  },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'baseline', marginBottom: 5,
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{row.label}</span>
                        <span style={{ fontSize: 11, color: LABEL, marginLeft: 5 }}>{row.sub}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>
                        {row.count}
                      </span>
                    </div>
                    <div style={{
                      height: 4, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', background: row.color, borderRadius: 3,
                        width: `${totalLeads > 0 ? (row.count / totalLeads) * 100 : 0}%`,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── lead row (extracted to avoid hook-in-loop) ────────────────────────────────
function LeadRow({
  lead, tag, init, isLast,
}: {
  lead: CRMLead
  tag: { label: string; bg: string; color: string } | null
  init: string
  isLast: boolean
}) {
  const [hover, setHover] = useState(false)

  return (
    <Link href={`/dashboard/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr 70px 110px 75px', gap: 12,
          padding: '10px 6px', borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
          background: hover ? '#F8FAFC' : 'transparent',
          cursor: 'pointer', transition: 'background 0.1s',
          borderRadius: 6, margin: '0 -6px',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Name + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: BLUE10, color: '#2563EB',
            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            {init}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#0F172A',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {getName(lead)}
            </div>
            <div style={{
              fontSize: 11, color: LABEL,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {lead.phones.primaryPhoneNumber ?? lead.emails.primaryEmail ?? '—'}
            </div>
          </div>
        </div>

        {/* Score tag */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {tag ? (
            <span style={{
              padding: '2px 9px', borderRadius: 6,
              background: tag.bg, color: tag.color,
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {tag.label}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: LABEL }}>—</span>
          )}
        </div>

        {/* Source */}
        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <span style={{
            fontSize: 12, color: MUTED,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {lead.sourcePortal ?? '—'}
          </span>
        </div>

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: LABEL }}>{timeAgo(lead.createdAt)}</span>
        </div>
      </div>
    </Link>
  )
}
