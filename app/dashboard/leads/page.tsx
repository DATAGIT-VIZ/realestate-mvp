'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { type CRMLead } from '@/lib/twenty'
import { AddLeadModal } from '@/components/AddLeadModal'
import { KanbanBoard } from '@/components/crm/KanbanBoard'
import { CsvUploadModal } from '@/components/crm/CsvUploadModal'
import { EmailParserModal } from '@/components/crm/EmailParserModal'
import { DistributeModal } from '@/components/crm/DistributeModal'
import { LogActivityModal } from '@/components/LogActivityModal'
import {
  Search, Plus, Filter, Eye, Loader2, UserPlus, Clock,
  ChevronDown, LayoutGrid, List, UploadCloud, MailPlus, Phone, Mail, Copy,
  Activity, Shuffle,
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#F8FAFC'
const PANEL   = '#FFFFFF'
const BORDER  = '#E2E8F0'
const AMBER   = '#be2ed6'   // semantic: hot/warm lead status only
const RED_HOT = '#a000c8'   // semantic: hot lead dot
const TEXT    = '#0F172A'
const MUTED   = '#64748B'
const PRIMARY = '#a000c8'                                                    // Vyapulse purple
const PRIMARY_DIM = 'rgba(160,0,200,0.08)'
const PRIMARY_BORDER = 'rgba(160,0,200,0.25)'
const PRIMARY_GRAD = 'linear-gradient(135deg, #7600bc 0%, #b100cd 100%)'

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
  if (score >= 70) return { label: 'High Intent', color: '#a000c8', bg: 'rgba(160,0,200,0.07)', dot: '#a000c8' }
  if (score >= 40) return { label: 'Medium',      color: '#8a00c2', bg: 'rgba(190,46,214,0.07)', dot: '#be2ed6' }
  return               { label: 'Low',          color: '#475569', bg: '#F1F5F9', dot: '#94A3B8' }
}

// Stable CS ID: real one if assigned, else derived from UUID so legacy leads always show one
function getCsId(lead: CRMLead): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
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
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showDistributeModal, setShowDistributeModal] = useState(false)
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [quickLogLeadId, setQuickLogLeadId] = useState<string | null>(null)
  const [showDupsOnly, setShowDupsOnly] = useState(false)
  const [importStatus, setImportStatus] = useState<{ total: number; done: number; label: string } | null>(null)
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

  const fetchUnassigned = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/leads/distribute')
      const json = await res.json()
      setUnassignedCount(json.unassigned ?? 0)
    } catch { /* non-critical */ }
  }, [])

  const fetchLeads = useCallback(async (q?: string, score?: ScoreFilter, status?: string) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '200' })
      if (q) params.set('search', q)
      if (score && score !== 'all') params.set('score', score)
      if (status && status !== 'all') params.set('status', status)
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

  useEffect(() => { fetchLeads(); fetchUnassigned() }, [fetchLeads, fetchUnassigned])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchLeads(val, scoreFilter, statusFilter), 300)
  }

  const handleScoreFilter = (s: ScoreFilter) => {
    setScoreFilter(s)
    setShowFilterMenu(false)
    fetchLeads(search, s, statusFilter)
  }

  const handleStatusFilter = (s: string) => {
    setStatusFilter(s)
    fetchLeads(search, scoreFilter, s)
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

  const handleCsvImport = async (result: { inserted: number; skipped: number; merged: number; failed: number; batchId: string | null; message: string }) => {
    setShowCsvModal(false)
    setImportStatus({ total: result.inserted + result.skipped + result.merged + result.failed, done: result.inserted + result.skipped + result.merged + result.failed, label: result.message })
    await fetchLeads()
    fetchUnassigned()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => setImportStatus(null), 6000)
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
      {/* Import progress toast */}
      {importStatus && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#0F172A', color: '#fff', borderRadius: 12, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', minWidth: 280 }}>
          {importStatus.done < importStatus.total
            ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite', color: '#be2ed6', flexShrink: 0 }} />
            : <span style={{ fontSize: 16 }}>✓</span>}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{importStatus.label}</div>
            {importStatus.done < importStatus.total && (
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Importing {importStatus.total.toLocaleString()} leads…</div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[1280px] mx-auto px-4 pb-24 lg:px-6">

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 18px', borderBottom: `1px solid ${BORDER}`, marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div className="hidden lg:block">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '-0.3px' }}>Leads</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: '4px 0 0' }}>
              {loading ? 'Refreshing…' : `${totalCount} total · sorted by intent score`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
            {unassignedCount > 0 && (
              <button onClick={() => setShowDistributeModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, borderRadius: 10, color: PRIMARY, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <Shuffle style={{ width: 14, height: 14 }} />
                <span className="hidden sm:inline">Distribute</span>
                <span style={{ background: PRIMARY, color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99, marginLeft: 2 }}>{unassignedCount.toLocaleString()}</span>
              </button>
            )}
            <button onClick={() => setShowAddModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: PRIMARY_GRAD, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(160,0,200,0.3)' }}
            >
              <Plus style={{ width: 14, height: 14 }} />New Lead
            </button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
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
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: PANEL, border: `1px solid ${scoreFilter !== 'all' ? PRIMARY_BORDER : BORDER}`, borderRadius: 10, color: scoreFilter !== 'all' ? PRIMARY : TEXT, fontSize: 13, cursor: 'pointer', minWidth: 150 }}
            >
              <Filter style={{ width: 13, height: 13 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{FILTER_LABELS[scoreFilter]}</span>
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>
            {showFilterMenu && (
              <div style={{ position: 'absolute', top: '100%', marginTop: 4, right: 0, minWidth: '100%', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, zIndex: 20, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                {(Object.keys(FILTER_LABELS) as ScoreFilter[]).map(s => (
                  <button key={s} onClick={() => handleScoreFilter(s)}
                    style={{ display: 'block', width: '100%', padding: '9px 14px', background: scoreFilter === s ? PRIMARY_DIM : 'transparent', color: scoreFilter === s ? PRIMARY : TEXT, fontSize: 13, border: 'none', cursor: 'pointer', textAlign: 'left' }}
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
                style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', cursor: 'pointer', background: viewMode === v ? PRIMARY_GRAD : 'transparent', color: viewMode === v ? '#fff' : MUTED }}
              >
                <Icon style={{ width: 14, height: 14 }} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Status tabs ── */}
        {(() => {
          const STATUS_TABS = [
            { id: 'all',          label: 'All',          color: '#64748B' },
            { id: 'New',          label: 'New',          color: '#64748B' },
            { id: 'Cold',         label: 'Cold',         color: '#2563EB' },
            { id: 'Warm',         label: 'Warm',         color: '#be2ed6' },
            { id: 'Hot',          label: 'Hot 🔥',       color: '#a000c8' },
            { id: 'Closed',       label: 'Closed',       color: '#059669' },
            { id: 'Disqualified', label: 'Disqualified', color: '#94A3B8' },
          ]
          const counts: Record<string, number> = { all: leads.length }
          for (const l of leads) {
            const s = l.status ?? 'New'
            counts[s] = (counts[s] ?? 0) + 1
          }
          return (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
              {STATUS_TABS.map(tab => {
                const active = statusFilter === tab.id
                const count  = counts[tab.id] ?? 0
                return (
                  <button key={tab.id} onClick={() => handleStatusFilter(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 9, whiteSpace: 'nowrap', flexShrink: 0,
                      border: `1.5px solid ${active ? tab.color : BORDER}`,
                      background: active ? `${tab.color}10` : PANEL,
                      color: active ? tab.color : MUTED,
                      fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                    {tab.label}
                    {tab.id !== 'all' && (
                      <span style={{ fontSize: 11, fontWeight: 700, background: active ? `${tab.color}20` : '#F1F5F9', color: active ? tab.color : '#94A3B8', padding: '1px 7px', borderRadius: 99 }}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* ── De-dup banner ── */}
        {dupPhones.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Copy style={{ width: 13, height: 13, color: '#8a00c2', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#7600bc', fontWeight: 600 }}>
                {dupPhones.length} duplicate phone number{dupPhones.length > 1 ? 's' : ''} detected
              </span>
              <span style={{ fontSize: 12, color: '#8a00c2' }}>— {dupLeadIds.size} leads share the same number</span>
            </div>
            <button
              onClick={() => setShowDupsOnly(v => !v)}
              style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: `1px solid ${showDupsOnly ? '#8a00c2' : 'rgba(138,0,194,0.3)'}`, background: showDupsOnly ? '#8a00c2' : 'transparent', color: showDupsOnly ? '#fff' : '#8a00c2', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
            <div style={{ width: 56, height: 56, borderRadius: 16, background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <UserPlus style={{ width: 24, height: 24, color: PRIMARY }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: '0 0 8px' }}>
              {search || scoreFilter !== 'all' ? 'No leads match your filters' : 'No leads yet'}
            </h3>
            <p style={{ color: MUTED, fontSize: 13, margin: '0 0 24px' }}>
              {search || scoreFilter !== 'all' ? 'Try adjusting your search or filter' : 'Add your first lead or import from a portal'}
            </p>
            {!search && scoreFilter === 'all' && (
              <button onClick={() => setShowAddModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: PRIMARY_GRAD, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(160,0,200,0.3)' }}
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
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' }}>Name</th>
                  <th className="hidden sm:table-cell" style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' }}>Phone</th>
                  <th className="hidden md:table-cell" style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>Score</th>
                  <th className="hidden lg:table-cell" style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' }}>Budget</th>
                  <th className="hidden lg:table-cell" style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' }}>Source</th>
                  <th className="hidden lg:table-cell" style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right' }}>Updated</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right' }}></th>
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
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0 }}>{getDisplayName(lead)}</p>
                              {isDup && <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(138,0,194,0.1)', color: '#8a00c2', padding: '1px 6px', borderRadius: 6 }}>DUP</span>}
                              <button
                                title="Copy lead ID"
                                onClick={e => { e.stopPropagation(); e.preventDefault(); navigator.clipboard.writeText(getCsId(lead)) }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#64748B', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: 5, fontFamily: 'monospace', letterSpacing: '0.04em', cursor: 'pointer' }}
                              >
                                {getCsId(lead)}<Copy style={{ width: 8, height: 8, opacity: 0.5 }} />
                              </button>
                            </div>
                            {/* Client type badge */}
                            {lead.sourceDetail?.startsWith('[') && (
                              <p style={{ fontSize: 10, color: '#8a00c2', background: 'rgba(160,0,200,0.08)', display: 'inline-block', padding: '0px 5px', borderRadius: 5, margin: '2px 0 0', fontWeight: 600 }}>
                                {lead.sourceDetail.match(/^\[([^\]]+)\]/)?.[1]}
                              </p>
                            )}
                            <p className="sm:hidden" style={{ fontSize: 11, color: MUTED, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Phone style={{ width: 10, height: 10 }} />{getPhone(lead) || '—'}
                            </p>
                            {getEmail(lead) && (
                              <p className="hidden sm:flex" style={{ fontSize: 11, color: MUTED, margin: 0, alignItems: 'center', gap: 3 }}>
                                <Mail style={{ width: 10, height: 10 }} />{getEmail(lead)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell" style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 13, color: MUTED, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Phone style={{ width: 12, height: 12 }} />{getPhone(lead) || '—'}
                        </span>
                      </td>
                      <td className="hidden md:table-cell" style={{ padding: '12px 16px', textAlign: 'center' }}>
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
                      <td className="hidden lg:table-cell" style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: MUTED }}>{formatBudget(lead.budgetMin, lead.budgetMax)}</span>
                      </td>
                      <td className="hidden lg:table-cell" style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 13, color: MUTED }}>{lead.sourcePortal || '—'}</span>
                      </td>
                      <td className="hidden lg:table-cell" style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <Clock style={{ width: 11, height: 11 }} />{timeAgo(lead.updatedAt)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={e => { e.stopPropagation(); e.preventDefault(); setQuickLogLeadId(lead.id) }}
                            title="Log activity"
                            className="hidden sm:inline-flex"
                            style={{ alignItems: 'center', gap: 5, padding: '6px 10px', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 8, color: '#059669', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(5,150,105,0.12)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(5,150,105,0.06)' }}
                          >
                            <Activity style={{ width: 11, height: 11 }} />Log
                          </button>
                          <Link href={`/dashboard/leads/${lead.id}`}
                            onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 12, fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = PRIMARY_BORDER; (e.currentTarget as HTMLAnchorElement).style.color = PRIMARY; (e.currentTarget as HTMLAnchorElement).style.background = PRIMARY_DIM }}
                            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = BORDER; (e.currentTarget as HTMLAnchorElement).style.color = MUTED; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
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
        <CsvUploadModal onClose={() => setShowCsvModal(false)} onSuccess={handleCsvImport} />
      )}
      {showDistributeModal && (
        <DistributeModal
          onClose={() => setShowDistributeModal(false)}
          onDone={() => { setShowDistributeModal(false); fetchLeads(); fetchUnassigned() }}
        />
      )}
      {showEmailModal && (
        <EmailParserModal onClose={() => setShowEmailModal(false)} onSuccess={async (p: any) => {
          setShowEmailModal(false)
          setImportStatus({ total: 1, done: 0, label: 'Importing lead from email…' })
          try {
            const res  = await fetch('/api/crm/leads/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: [p] }) })
            const json = await res.json()
            setImportStatus({ total: 1, done: 1, label: json.message ?? 'Lead imported' })
          } catch { setImportStatus({ total: 1, done: 1, label: 'Import failed' }) }
          await fetchLeads(); fetchUnassigned()
          setTimeout(() => setImportStatus(null), 5000)
        }} />
      )}
      {quickLogLeadId && (
        <LogActivityModal
          leadId={quickLogLeadId}
          isOpen={true}
          onClose={() => setQuickLogLeadId(null)}
          onActivityLogged={() => { setQuickLogLeadId(null); fetchLeads(search, scoreFilter) }}
          currentStatus={leads.find(l => l.id === quickLogLeadId)?.status ?? 'New'}
          existingActivityTypes={[]}
        />
      )}
    </div>
  )
}
