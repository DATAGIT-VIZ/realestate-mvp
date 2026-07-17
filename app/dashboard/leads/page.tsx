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
  Activity, Shuffle, MessageCircle,
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#F5F6FA'
const PANEL   = '#FFFFFF'
const BORDER  = '#E8ECF0'
const TEXT    = '#263238'
const MUTED   = '#78889B'
const LABEL   = '#A4B1BE'
const PRIMARY = '#FF7043'
const PRIMARY_DIM = 'rgba(255,112,67,0.09)'
const PRIMARY_BORDER = 'rgba(255,112,67,0.22)'
const PRIMARY_GRAD = 'linear-gradient(135deg, #FF7043 0%, #FF8A65 100%)'

// Warm avatar palette — cycles deterministically by name
const AVATAR_PALETTE = [
  { bg: '#FFEDE8', fg: '#C2410C' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#FCE7F3', fg: '#BE185D' },
  { bg: '#CFFAFE', fg: '#0E7490' },
  { bg: '#FFF7ED', fg: '#C2410C' },
]
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[Math.abs(h)]
}

// Status pill config — "+" prefix style matching reference
const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  New:          { bg: '#EEF2FF', color: '#4338CA',  label: '+ New' },
  Cold:         { bg: '#E0F2FE', color: '#0369A1',  label: '+ Cold' },
  Warm:         { bg: '#FFF3E0', color: '#E65100',  label: '+ Warm' },
  Hot:          { bg: '#FFEDE8', color: '#C2410C',  label: '+ Hot 🔥' },
  Closed:       { bg: '#ECFDF5', color: '#059669',  label: '+ Closed' },
  Disqualified: { bg: '#F3F4F6', color: '#78889B',  label: '+ Disqualified' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type ScoreFilter = 'all' | 'hot' | 'warm' | 'cold'
const FILTER_LABELS: Record<ScoreFilter, string> = {
  all: 'All Leads', hot: 'Hot (70+)', warm: 'Warm (40–69)', cold: 'Cold (<40)',
}

type SortBy = 'score' | 'newest' | 'oldest' | 'budget_high' | 'budget_low' | 'name'
const SORT_LABELS: Record<SortBy, string> = {
  score:       'Intent Score',
  newest:      'Newest First',
  oldest:      'Oldest First',
  budget_high: 'Budget: High → Low',
  budget_low:  'Budget: Low → High',
  name:        'Name A–Z',
}

const getDisplayName = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getPhone = (l: CRMLead) => l.phones.primaryPhoneNumber ?? ''
const getEmail = (l: CRMLead) => l.emails.primaryEmail ?? null
const getScore = (l: CRMLead) => l.intentScore ?? 0

function getScoreStyle(score: number) {
  if (score >= 70) return { label: 'High Intent', color: '#FF7043', bg: 'rgba(255,112,67,0.09)', dot: '#FF7043' }
  if (score >= 40) return { label: 'Medium',      color: '#F59E0B', bg: 'rgba(245,158,11,0.09)', dot: '#F59E0B' }
  return               { label: 'Low',            color: '#78889B', bg: '#F0F2F5',               dot: '#A4B1BE' }
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

function touchedStyle(dateStr: string) {
  const days = (Date.now() - new Date(dateStr).getTime()) / 86_400_000
  if (days < 3)  return { dot: '#059669', color: '#059669', bg: '#ECFDF5' } // green
  if (days < 7)  return { dot: '#F59E0B', color: '#B45309', bg: '#FFFBEB' } // amber
  return              { dot: '#EF4444', color: '#B91C1C', bg: '#FEF2F2' }   // red
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^(91|0)/, '')
  return `https://wa.me/91${digits}`
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
  const [sortBy, setSortBy]             = useState<SortBy>('score')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showSourceMenu, setShowSourceMenu] = useState(false)
  const [showStuck, setShowStuck]       = useState(false)
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

  // Unique sources for dropdown
  const uniqueSources = useMemo(() => {
    const s = new Set(leads.map(l => l.sourcePortal).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [leads])

  // Client-side source filter + stuck filter + sort
  const filteredSortedLeads = useMemo(() => {
    const STUCK_DAYS = 7
    let list = [...displayLeads]
    if (sourceFilter !== 'all') list = list.filter(l => l.sourcePortal === sourceFilter)
    if (showStuck) {
      const cutoff = Date.now() - STUCK_DAYS * 86_400_000
      list = list.filter(l => !['Closed', 'Disqualified'].includes(l.status ?? '') && new Date(l.updatedAt ?? l.createdAt).getTime() < cutoff)
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'score':       return (b.intentScore ?? 0) - (a.intentScore ?? 0)
        case 'newest':      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'budget_high': return (b.budgetMax ?? b.budgetMin ?? 0) - (a.budgetMax ?? a.budgetMin ?? 0)
        case 'budget_low':  return (a.budgetMin ?? a.budgetMax ?? 0) - (b.budgetMin ?? b.budgetMax ?? 0)
        case 'name':        return getDisplayName(a).localeCompare(getDisplayName(b))
        default:            return 0
      }
    })
    return list
  }, [displayLeads, sourceFilter, showStuck, sortBy])

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

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Import toast */}
      {importStatus && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#111827', color: '#fff', borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', minWidth: 280 }}>
          {importStatus.done < importStatus.total
            ? <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite', color: '#E879F9', flexShrink: 0 }} />
            : <span style={{ fontSize: 15 }}>✓</span>}
          <span style={{ fontSize: 13, fontWeight: 500 }}>{importStatus.label}</span>
        </div>
      )}

      <div className="max-w-[1320px] mx-auto px-4 pb-8 lg:px-8">

        {/* ── Page heading ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0 20px', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '-0.4px' }}>
              {loading && leads.length === 0 ? 'Leads' : `${totalCount.toLocaleString()} Leads`}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowEmailModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <MailPlus style={{ width: 14, height: 14 }} />
              <span className="hidden sm:inline">Parse Email</span>
            </button>
            <button onClick={() => setShowCsvModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <UploadCloud style={{ width: 14, height: 14 }} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            {unassignedCount > 0 && (
              <button onClick={() => setShowDistributeModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, borderRadius: 8, color: PRIMARY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Shuffle style={{ width: 14, height: 14 }} />
                <span className="hidden sm:inline">Distribute</span>
                <span style={{ background: PRIMARY, color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99, marginLeft: 2 }}>{unassignedCount}</span>
              </button>
            )}
            <button onClick={() => setShowAddModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: PRIMARY_GRAD, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus style={{ width: 14, height: 14 }} />Create lead
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Status filter chips */}
          {(() => {
            const STATUS_TABS = [
              { id: 'all',          label: 'All leads' },
              { id: 'New',          label: 'New' },
              { id: 'Cold',         label: 'Cold' },
              { id: 'Warm',         label: 'Warm' },
              { id: 'Hot',          label: 'Hot 🔥' },
              { id: 'Closed',       label: 'Closed' },
              { id: 'Disqualified', label: 'Disqualified' },
            ]
            const counts: Record<string, number> = { all: leads.length }
            for (const l of leads) { const s = l.status ?? 'New'; counts[s] = (counts[s] ?? 0) + 1 }
            return STATUS_TABS.map(tab => {
              const active = statusFilter === tab.id
              return (
                <button key={tab.id} onClick={() => handleStatusFilter(tab.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0, border: `1px solid ${active ? PRIMARY_BORDER : BORDER}`, background: active ? PRIMARY_DIM : PANEL, color: active ? PRIMARY : MUTED, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.12s' }}>
                  {tab.label}
                  {tab.id !== 'all' && counts[tab.id] ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: active ? PRIMARY : LABEL }}>{counts[tab.id]}</span>
                  ) : null}
                </button>
              )
            })
          })()}

          {/* Intent score filter */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setShowFilterMenu(v => !v); setShowSortMenu(false); setShowSourceMenu(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', background: scoreFilter !== 'all' ? PRIMARY_DIM : PANEL, border: `1px solid ${scoreFilter !== 'all' ? PRIMARY_BORDER : BORDER}`, borderRadius: 99, color: scoreFilter !== 'all' ? PRIMARY : MUTED, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Filter style={{ width: 12, height: 12 }} />
              {scoreFilter !== 'all' ? FILTER_LABELS[scoreFilter] : 'Intent score'}
              <ChevronDown style={{ width: 11, height: 11 }} />
            </button>
            {showFilterMenu && (
              <div style={{ position: 'absolute', top: '110%', left: 0, minWidth: 180, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, zIndex: 30, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                {(Object.keys(FILTER_LABELS) as ScoreFilter[]).map(s => (
                  <button key={s} onClick={() => handleScoreFilter(s)}
                    style={{ display: 'block', width: '100%', padding: '9px 14px', background: scoreFilter === s ? PRIMARY_DIM : 'transparent', color: scoreFilter === s ? PRIMARY : TEXT, fontSize: 13, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    {FILTER_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Source filter */}
          {uniqueSources.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowSourceMenu(v => !v); setShowFilterMenu(false); setShowSortMenu(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', background: sourceFilter !== 'all' ? PRIMARY_DIM : PANEL, border: `1px solid ${sourceFilter !== 'all' ? PRIMARY_BORDER : BORDER}`, borderRadius: 99, color: sourceFilter !== 'all' ? PRIMARY : MUTED, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Eye style={{ width: 12, height: 12 }} />
                {sourceFilter !== 'all'
                  ? sourceFilter.replace('OPT99ACRES','99acres').replace('MAGICBRICKS','MagicBricks').replace('HOUSING_COM','Housing.com').replace('FACEBOOK','Facebook').replace('MARKETING','Marketing')
                  : 'Source'}
                <ChevronDown style={{ width: 11, height: 11 }} />
              </button>
              {showSourceMenu && (
                <div style={{ position: 'absolute', top: '110%', left: 0, minWidth: 190, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, zIndex: 30, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                  {['all', ...uniqueSources].map(s => {
                    const label = s === 'all' ? 'All Sources'
                      : s.replace('OPT99ACRES','99acres').replace('MAGICBRICKS','MagicBricks').replace('HOUSING_COM','Housing.com').replace('FACEBOOK','Facebook').replace('MARKETING','Marketing')
                    return (
                      <button key={s} onClick={() => { setSourceFilter(s); setShowSourceMenu(false) }}
                        style={{ display: 'block', width: '100%', padding: '9px 14px', background: sourceFilter === s ? PRIMARY_DIM : 'transparent', color: sourceFilter === s ? PRIMARY : TEXT, fontSize: 13, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Stuck filter chip */}
          <button onClick={() => setShowStuck(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 99, border: `1px solid ${showStuck ? '#F59E0B' : BORDER}`, background: showStuck ? 'rgba(245,158,11,0.1)' : PANEL, color: showStuck ? '#B45309' : MUTED, fontSize: 13, fontWeight: showStuck ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
            <Clock style={{ width: 12, height: 12 }} />
            Stuck 7d+
          </button>

          {/* Right side controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Sort */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowSortMenu(v => !v); setShowFilterMenu(false); setShowSourceMenu(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', background: sortBy !== 'score' ? PRIMARY_DIM : PANEL, border: `1px solid ${sortBy !== 'score' ? PRIMARY_BORDER : BORDER}`, borderRadius: 8, color: sortBy !== 'score' ? PRIMARY : MUTED, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Activity style={{ width: 12, height: 12 }} />
                {SORT_LABELS[sortBy]}
                <ChevronDown style={{ width: 11, height: 11 }} />
              </button>
              {showSortMenu && (
                <div style={{ position: 'absolute', top: '110%', right: 0, minWidth: 200, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, zIndex: 30, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                  {(Object.keys(SORT_LABELS) as SortBy[]).map(s => (
                    <button key={s} onClick={() => { setSortBy(s); setShowSortMenu(false) }}
                      style={{ display: 'block', width: '100%', padding: '9px 14px', background: sortBy === s ? PRIMARY_DIM : 'transparent', color: sortBy === s ? PRIMARY : TEXT, fontSize: 13, border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: sortBy === s ? 600 : 400 }}>
                      {SORT_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search style={{ width: 13, height: 13, color: LABEL, position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              {loading && search && <Loader2 style={{ width: 11, height: 11, color: LABEL, position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />}
              <input type="text" placeholder="Search…" value={search} onChange={e => handleSearchChange(e.target.value)}
                style={{ paddingLeft: 30, paddingRight: 30, paddingTop: 7, paddingBottom: 7, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13, outline: 'none', width: 200 }} />
            </div>
            {/* View toggle */}
            <div style={{ display: 'flex', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 2, gap: 1 }}>
              {([['list', List], ['board', LayoutGrid]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setViewMode(v)}
                  style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: viewMode === v ? PRIMARY_GRAD : 'transparent', color: viewMode === v ? '#fff' : LABEL }}>
                  <Icon style={{ width: 13, height: 13 }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── De-dup banner ── */}
        {dupPhones.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Copy style={{ width: 13, height: 13, color: '#B45309', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#92400E', fontWeight: 500 }}>
                {dupPhones.length} duplicate phone{dupPhones.length > 1 ? 's' : ''} detected — {dupLeadIds.size} leads affected
              </span>
            </div>
            <button onClick={() => setShowDupsOnly(v => !v)}
              style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8, border: '1px solid #D97706', background: showDupsOnly ? '#D97706' : 'transparent', color: showDupsOnly ? '#fff' : '#B45309', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {showDupsOnly ? 'Show all' : 'Show duplicates'}
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 16px', marginBottom: 14 }}>
            <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Kanban ── */}
        {viewMode === 'board' && <KanbanBoard leads={leads} onLeadUpdate={handleLeadUpdate} />}

        {/* ── Empty state ── */}
        {viewMode === 'list' && !loading && filteredSortedLeads.length === 0 && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: PRIMARY_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <UserPlus style={{ width: 22, height: 22, color: PRIMARY }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: '0 0 6px' }}>
              {search || scoreFilter !== 'all' ? 'No leads match your filters' : 'No leads yet'}
            </h3>
            <p style={{ color: MUTED, fontSize: 13, margin: '0 0 22px' }}>
              {search || scoreFilter !== 'all' ? 'Try adjusting your search or filters' : 'Add your first lead or import from a portal'}
            </p>
            {!search && scoreFilter === 'all' && (
              <button onClick={() => setShowAddModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: PRIMARY_GRAD, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus style={{ width: 14, height: 14 }} /> Add Lead
              </button>
            )}
          </div>
        )}

        {/* ── Table ── */}
        {viewMode === 'list' && filteredSortedLeads.length > 0 && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {(['Lead name','Contact','Lead source','Lead status','Budget','Last touched',''] as const).map((h, i) => (
                    <th key={i}
                      className={i === 1 ? 'hidden sm:table-cell' : i === 2 ? 'hidden md:table-cell' : i === 4 ? 'hidden lg:table-cell' : i === 5 ? 'hidden md:table-cell' : ''}
                      style={{ padding: `10px ${i === 0 || i === 6 ? '20px' : '16px'}`, fontSize: 11, fontWeight: 500, color: '#C1C7D0', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', background: '#FAFBFC', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSortedLeads.map((lead, idx) => {
                  const name    = getDisplayName(lead)
                  const av      = avatarColor(name)
                  const initial = name.charAt(0).toUpperCase()
                  const status  = lead.status ?? 'New'
                  const pill    = STATUS_PILL[status] ?? STATUS_PILL['New']
                  const isDup   = dupLeadIds.has(lead.id)
                  const email   = getEmail(lead)
                  const phone   = getPhone(lead)
                  const ts      = touchedStyle(lead.updatedAt ?? lead.createdAt)
                  return (
                    <tr key={lead.id}
                      style={{ borderBottom: idx < filteredSortedLeads.length - 1 ? `1px solid ${BORDER}` : 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFD')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Lead name */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: av.fg }}>{initial}</span>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{name}</span>
                              {isDup && <span style={{ fontSize: 9, fontWeight: 700, background: '#FEF9C3', color: '#854D0E', padding: '1px 5px', borderRadius: 5 }}>DUP</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                              <button title="Copy CS ID" onClick={e => { e.stopPropagation(); e.preventDefault(); navigator.clipboard.writeText(getCsId(lead)) }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: LABEL, background: 'transparent', border: 'none', padding: 0, fontFamily: 'monospace', cursor: 'pointer' }}>
                                {getCsId(lead)}
                              </button>
                              <span style={{ color: BORDER }}>·</span>
                              <span style={{ fontSize: 11, color: LABEL }}>{timeAgo(lead.updatedAt)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact — email on top, phone below */}
                      <td className="hidden sm:table-cell" style={{ padding: '16px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 12, color: MUTED }}>{email || '—'}</span>
                          <span style={{ fontSize: 12, color: LABEL }}>{phone || '—'}</span>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="hidden md:table-cell" style={{ padding: '16px 16px' }}>
                        {lead.sourcePortal
                          ? <span style={{ fontSize: 12, color: MUTED }}>{lead.sourcePortal}</span>
                          : <span style={{ fontSize: 12, color: BORDER }}>—</span>}
                      </td>

                      {/* Status — "+" prefix pill, no dot */}
                      <td style={{ padding: '16px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: pill.bg, fontSize: 12, fontWeight: 500, color: pill.color, whiteSpace: 'nowrap' }}>
                          {pill.label}
                        </span>
                      </td>

                      {/* Budget */}
                      <td className="hidden lg:table-cell" style={{ padding: '16px 16px' }}>
                        <span style={{ fontSize: 12, color: MUTED }}>{formatBudget(lead.budgetMin, lead.budgetMax)}</span>
                      </td>

                      {/* Last touched */}
                      <td className="hidden md:table-cell" style={{ padding: '16px 16px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99, background: ts.bg }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: ts.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: ts.color, whiteSpace: 'nowrap' }}>
                            {timeAgo(lead.updatedAt ?? lead.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                          {/* Call */}
                          {phone && (
                            <a href={`tel:${phone}`} onClick={e => e.stopPropagation()}
                              title={`Call ${phone}`}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', textDecoration: 'none', flexShrink: 0, transition: 'all 0.12s' }}
                              onMouseEnter={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.background = '#059669'; a.style.color = '#fff'; a.style.borderColor = '#059669' }}
                              onMouseLeave={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.background = '#ECFDF5'; a.style.color = '#059669'; a.style.borderColor = '#A7F3D0' }}>
                              <Phone style={{ width: 12, height: 12 }} />
                            </a>
                          )}
                          {/* WhatsApp */}
                          {phone && (
                            <a href={waLink(phone)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              title="Open WhatsApp"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: '#F0FDF4', border: '1px solid #86EFAC', color: '#16A34A', textDecoration: 'none', flexShrink: 0, transition: 'all 0.12s' }}
                              onMouseEnter={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.background = '#25D366'; a.style.color = '#fff'; a.style.borderColor = '#25D366' }}
                              onMouseLeave={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.background = '#F0FDF4'; a.style.color = '#16A34A'; a.style.borderColor = '#86EFAC' }}>
                              <MessageCircle style={{ width: 12, height: 12 }} />
                            </a>
                          )}
                          {/* Log */}
                          <button onClick={e => { e.stopPropagation(); e.preventDefault(); setQuickLogLeadId(lead.id) }}
                            className="hidden sm:inline-flex"
                            style={{ alignItems: 'center', gap: 4, padding: '5px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, color: LABEL, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s' }}
                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = '#86EFAC'; b.style.color = '#15803D'; b.style.background = '#F0FDF4' }}
                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = BORDER; b.style.color = LABEL; b.style.background = 'transparent' }}>
                            <Activity style={{ width: 11, height: 11 }} />Log
                          </button>
                          {/* View */}
                          <Link href={`/dashboard/leads/${lead.id}`} onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, color: LABEL, fontSize: 12, textDecoration: 'none', transition: 'all 0.12s' }}
                            onMouseEnter={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.borderColor = PRIMARY_BORDER; a.style.color = PRIMARY; a.style.background = PRIMARY_DIM }}
                            onMouseLeave={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.borderColor = BORDER; a.style.color = LABEL; a.style.background = 'transparent' }}>
                            <Eye style={{ width: 11, height: 11 }} />View
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
          <p style={{ fontSize: 12, color: LABEL, textAlign: 'center', marginTop: 16 }}>
            {loading ? 'Refreshing…' : `Showing ${filteredSortedLeads.length} of ${totalCount} leads`}
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
