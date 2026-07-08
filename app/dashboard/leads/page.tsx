'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { type CRMLead } from '@/lib/twenty'
import { AddLeadModal } from '@/components/AddLeadModal'
import { KanbanBoard } from '@/components/crm/KanbanBoard'
import { CsvUploadModal } from '@/components/crm/CsvUploadModal'
import { EmailParserModal } from '@/components/crm/EmailParserModal'
import {
  Search, Plus, Filter, Eye, Loader2, UserPlus, Clock,
  ChevronDown, LayoutGrid, List, UploadCloud, MailPlus, Phone, Mail, Zap, Copy,
} from 'lucide-react'
import { EnrollSequenceModal } from '@/components/EnrollSequenceModal'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#F8FAFC'
const PANEL   = '#FFFFFF'
const BORDER  = '#E2E8F0'
const AMBER   = '#D97706'
const RED_HOT = '#F97316'
const TEXT    = '#0F172A'
const MUTED   = '#64748B'

// ─── Helpers ──────────────────────────────────────────────────────────────────
type ScoreFilter = 'all' | 'hot' | 'warm' | 'cold'
const FILTER_LABELS: Record<ScoreFilter, string> = {
  all: 'All Leads', hot: 'Hot (70+)', warm: 'Warm (40–69)', cold: 'Cold (<40)',
}

const getDisplayName = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getPhone = (l: CRMLead) => l.phones.primaryPhoneNumber ?? ''
const getEmail = (l: CRMLead) => l.emails.primaryEmail ?? null
const getScore = (l: CRMLead) => l.intentScore ?? 0

function getScoreStyle(score: number) {
  if (score >= 70) return { label: 'High Intent', color: '#EA580C', bg: '#FFF7ED', dot: '#F97316' }
  if (score >= 40) return { label: 'Medium',      color: '#B45309', bg: '#FFFBEB', dot: '#D97706' }
  return               { label: 'Low',          color: '#475569', bg: '#F1F5F9', dot: '#94A3B8' }
}

function formatBudget(min: number | null, max: number | null): string {
  const fmt = (n: number) =>
    n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(1)}Cr` : `${+(n / 100_000).toFixed(1)}L`
  if (min && max) return `₹${fmt(min)}–${fmt(max)}`
  if (min) return `₹${fmt(min)}+`
  if (max) return `Up to ₹${fmt(max)}`
  return '—'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'Just now'
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [enrollTarget, setEnrollTarget] = useState<{ leadId: string; leadName: string; leadPhone: string } | null>(null)
  const [showDupsOnly, setShowDupsOnly] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // De-dup detection — group leads by normalised phone number
  const dupPhones = useMemo(() => {
    const phoneMap: Record<string, string[]> = {}
    for (const l of leads) {
      const ph = (l.phones.primaryPhoneNumber ?? '').replace(/\D/g, '')
      if (!ph || ph.length < 8) continue
      const key = ph.replace(/^(91|0)/, '')
      if (!phoneMap[key]) phoneMap[key] = []
      phoneMap[key].push(l.id)
    }
    return Object.values(phoneMap).filter(ids => ids.length > 1)
  }, [leads])

  const dupLeadIds = useMemo(() => new Set(dupPhones.flat()), [dupPhones])

  const displayLeads = useMemo(
    () => showDupsOnly ? leads.filter(l => dupLeadIds.has(l.id)) : leads,
    [leads, showDupsOnly, dupLeadIds]
  )

  const fetchLeads = useCallback(async (q?: string, score?: ScoreFilter) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (q) params.set('search', q)
      if (score && score !== 'all') params.set('score', score)
      const res = await fetch(`/api/crm/leads?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setLeads(json.data.leads ?? [])
      setTotalCount(json.data.totalCount ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchLeads(val, scoreFilter), 300)
  }

  const handleScoreFilter = (s: ScoreFilter) => {
    setScoreFilter(s)
    setShowFilterMenu(false)
    fetchLeads(search, s)
  }

  const handleLeadUpdate = async (leadId: string, newStatus: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    try {
      await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch { fetchLeads(search, scoreFilter) }
  }

  const handleCsvImport = async (rows: Record<string, string>[]) => {
    setShowCsvModal(false)
    setLoading(true)
    for (const row of rows) {
      const parts = (row.name ?? '').trim().split(' ')
      await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: parts[0] || 'Unknown',
          lastName: parts.slice(1).join(' ') || '',
          phone: row.phone ?? '',
          email: row.email || undefined,
          city: row.city || undefined,
          budgetMin: row.budget_min ? Number(row.budget_min) : undefined,
          budgetMax: row.budget_max ? Number(row.budget_max) : undefined,
          sourcePortal: row.source || 'CSV Import',
          propertyType: row.property_type ? [row.property_type] : undefined,
          timeline: row.timeline || undefined,
          status: 'New',
        }),
      })
    }
    await fetchLeads()
  }

  // Loading state (first load only)
  if (loading && leads.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: 28, height: 28, color: AMBER, animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0 24px', borderBottom: `1px solid ${BORDER}`, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '-0.3px' }}>Leads</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: '4px 0 0' }}>
              {loading ? 'Refreshing…' : `${totalCount} total · sorted by intent score`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setShowEmailModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              <MailPlus style={{ width: 14, height: 14 }} />
              <span className="hidden sm:inline">Parse Email</span>
            </button>
            <button onClick={() => setShowCsvModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              <UploadCloud style={{ width: 14, height: 14 }} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            <button onClick={() => setShowAddModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: AMBER, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus style={{ width: 14, height: 14 }} />New Lead
            </button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search style={{ width: 14, height: 14, color: MUTED, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            {loading && search && (
              <Loader2 style={{ width: 12, height: 12, color: MUTED, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />
            )}
            <input
              type="text" placeholder="Search name, phone, or email…"
              value={search} onChange={e => handleSearchChange(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 36, paddingTop: 9, paddingBottom: 9, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowFilterMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: PANEL, border: `1px solid ${scoreFilter !== 'all' ? AMBER : BORDER}`, borderRadius: 10, color: scoreFilter !== 'all' ? AMBER : TEXT, fontSize: 13, cursor: 'pointer', minWidth: 150 }}
            >
              <Filter style={{ width: 13, height: 13 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{FILTER_LABELS[scoreFilter]}</span>
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>
            {showFilterMenu && (
              <div style={{ position: 'absolute', top: '100%', marginTop: 4, right: 0, minWidth: '100%', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, zIndex: 20, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                {(Object.keys(FILTER_LABELS) as ScoreFilter[]).map(s => (
                  <button key={s} onClick={() => handleScoreFilter(s)}
                    style={{ display: 'block', width: '100%', padding: '9px 14px', background: scoreFilter === s ? '#EFF6FF' : 'transparent', color: scoreFilter === s ? '#1D4ED8' : TEXT, fontSize: 13, border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    {FILTER_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 3, gap: 2 }}>
            {([['list', List], ['board', LayoutGrid]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', cursor: 'pointer', background: viewMode === v ? AMBER : 'transparent', color: viewMode === v ? '#000' : MUTED }}
              >
                <Icon style={{ width: 14, height: 14 }} />
              </button>
            ))}
          </div>
        </div>

        {/* ── De-dup banner ── */}
        {dupPhones.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Copy style={{ width: 13, height: 13, color: '#B45309', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>
                {dupPhones.length} duplicate phone number{dupPhones.length > 1 ? 's' : ''} detected
              </span>
              <span style={{ fontSize: 12, color: '#B45309' }}>— {dupLeadIds.size} leads share the same number</span>
            </div>
            <button
              onClick={() => setShowDupsOnly(v => !v)}
              style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: `1px solid ${showDupsOnly ? '#B45309' : 'rgba(180,83,9,0.3)'}`, background: showDupsOnly ? '#B45309' : 'transparent', color: showDupsOnly ? '#fff' : '#B45309', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {showDupsOnly ? 'Show All' : 'Show Duplicates'}
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Kanban ── */}
        {viewMode === 'board' && <KanbanBoard leads={leads} onLeadUpdate={handleLeadUpdate} />}

        {/* ── Empty state ── */}
        {viewMode === 'list' && !loading && displayLeads.length === 0 && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <UserPlus style={{ width: 24, height: 24, color: AMBER }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: '0 0 8px' }}>
              {search || scoreFilter !== 'all' ? 'No leads match your filters' : 'No leads yet'}
            </h3>
            <p style={{ color: MUTED, fontSize: 13, margin: '0 0 24px' }}>
              {search || scoreFilter !== 'all' ? 'Try adjusting your search or filter' : 'Add your first lead or import from a portal'}
            </p>
            {!search && scoreFilter === 'all' && (
              <button onClick={() => setShowAddModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: AMBER, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus style={{ width: 14, height: 14 }} /> Add Lead
              </button>
            )}
          </div>
        )}

        {/* ── Table ── */}
        {viewMode === 'list' && displayLeads.length > 0 && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Name', 'Phone', 'Score', 'Budget', 'Source', 'Updated', ''].map((h, i) => (
                    <th key={i} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 2 ? 'center' : i >= 5 ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayLeads.map((lead, idx) => {
                  const score = getScore(lead)
                  const { label, color, bg, dot } = getScoreStyle(score)
                  const isDup = dupLeadIds.has(lead.id)
                  return (
                    <tr key={lead.id}
                      style={{ borderBottom: idx < displayLeads.length - 1 ? `1px solid ${BORDER}` : 'none', transition: 'background 0.15s', background: isDup ? 'rgba(234,179,8,0.03)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDup ? 'rgba(234,179,8,0.07)' : '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = isDup ? 'rgba(234,179,8,0.03)' : 'transparent')}
                    >
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0 }}>{getDisplayName(lead)}</p>
                              {isDup && <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(180,83,9,0.1)', color: '#B45309', padding: '1px 6px', borderRadius: 6 }}>DUP</span>}
                            </div>
                            {getEmail(lead) && (
                              <p style={{ fontSize: 11, color: MUTED, margin: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Mail style={{ width: 10, height: 10 }} />{getEmail(lead)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 13, color: MUTED, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Phone style={{ width: 12, height: 12 }} />{getPhone(lead) || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                        {score > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${dot}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: dot }}>{score}</span>
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 600, color, background: bg, padding: '1px 6px', borderRadius: 8 }}>{label}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: '#CBD5E1', fontWeight: 500 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 12, color: MUTED }}>{formatBudget(lead.budgetMin, lead.budgetMax)}</span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 13, color: MUTED }}>{lead.sourcePortal || '—'}</span>
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <Clock style={{ width: 11, height: 11 }} />{timeAgo(lead.updatedAt)}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => setEnrollTarget({ leadId: lead.id, leadName: getDisplayName(lead), leadPhone: getPhone(lead) })}
                            title="Enroll in sequence"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, color: '#7C3AED', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.12)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.06)' }}
                          >
                            <Zap style={{ width: 11, height: 11 }} />Sequence
                          </button>
                          <Link href={`/dashboard/leads/${lead.id}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 12, fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = AMBER; (e.currentTarget as HTMLAnchorElement).style.color = AMBER }}
                            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = BORDER; (e.currentTarget as HTMLAnchorElement).style.color = MUTED }}
                          >
                            <Eye style={{ width: 12, height: 12 }} />View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}


        {leads.length > 0 && (
          <p style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 16 }}>
            {loading ? 'Refreshing…' : `Showing ${leads.length} of ${totalCount} leads`}
          </p>
        )}
      </div>

      {/* ── Modals ── */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchLeads(search, scoreFilter) }}
        />
      )}
      {showCsvModal && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <CsvUploadModal onClose={() => setShowCsvModal(false)} onSuccess={(d: any) => handleCsvImport(d)} />
      )}
      {showEmailModal && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <EmailParserModal onClose={() => setShowEmailModal(false)} onSuccess={(p: any) => handleCsvImport([p])} />
      )}
      {enrollTarget && (
        <EnrollSequenceModal
          isOpen={true}
          onClose={() => setEnrollTarget(null)}
          leadId={enrollTarget.leadId}
          leadName={enrollTarget.leadName}
          leadPhone={enrollTarget.leadPhone}
          onEnrolled={() => setEnrollTarget(null)}
        />
      )}
    </div>
  )
}
