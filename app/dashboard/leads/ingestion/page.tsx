'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import type { PortalLeadRow, IngestionStatus } from '@/lib/ingestionLog'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#2563EB', blue10: 'rgba(37,99,235,0.08)',
  green: '#059669', green10: 'rgba(5,150,105,0.08)',
  amber: '#D97706', amber10: 'rgba(217,119,6,0.08)',
  red: '#EF4444', red10: 'rgba(239,68,68,0.08)',
}

const SOURCES = ['all', 'MagicBricks', '99acres', 'Housing.com', 'Email']
const STATUSES: (IngestionStatus | 'all')[] = ['all', 'created', 'duplicate', 'failed']

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  created:   { label: 'Created',   bg: C.green10,  color: C.green  },
  duplicate: { label: 'Duplicate', bg: C.amber10,  color: C.amber  },
  failed:    { label: 'Failed',    bg: C.red10,    color: C.red    },
}

const SOURCE_META: Record<string, { bg: string; color: string }> = {
  MagicBricks: { bg: 'rgba(234,88,12,0.08)',  color: '#EA580C' },
  '99acres':   { bg: 'rgba(37,99,235,0.08)',  color: '#2563EB' },
  'Housing.com': { bg: 'rgba(16,185,129,0.08)', color: '#059669' },
  Email:       { bg: 'rgba(124,58,237,0.08)', color: '#7C3AED' },
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60)   return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ─── Raw payload modal ────────────────────────────────────────────────────────
function PayloadModal({ row, onClose }: { row: PortalLeadRow; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Raw Payload</p>
            <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>{row.source_portal} · {new Date(row.created_at).toLocaleString('en-IN')}</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Contact extracted */}
          {row.parsed_contact && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Extracted Contact</p>
              <pre style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 12, color: C.text, overflowX: 'auto', margin: 0, fontFamily: 'monospace', lineHeight: 1.6 }}>
                {JSON.stringify(row.parsed_contact, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw payload */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Raw Payload</p>
            <pre style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 12, color: C.text, overflowX: 'auto', margin: 0, fontFamily: 'monospace', lineHeight: 1.6 }}>
              {JSON.stringify(row.raw_payload, null, 2)}
            </pre>
          </div>

          {/* Error */}
          {row.error_message && (
            <div style={{ background: C.red10, border: `1px solid ${C.red}22`, borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Error</p>
              <p style={{ fontSize: 13, color: C.red, margin: 0 }}>{row.error_message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50

export default function IngestionLogPage() {
  const [rows, setRows]       = useState<PortalLeadRow[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [status, setStatus]   = useState<IngestionStatus | 'all'>('all')
  const [source, setSource]   = useState('all')
  const [offset, setOffset]   = useState(0)
  const [viewing, setViewing] = useState<PortalLeadRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status, source, limit: String(PAGE_SIZE), offset: String(offset) })
      const res = await fetch(`/api/ingest/log?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setRows(json.data?.rows ?? [])
      setTotal(json.data?.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }, [status, source, offset])

  useEffect(() => { load() }, [load])

  // Reset offset on filter change
  useEffect(() => { setOffset(0) }, [status, source])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div style={{ padding: '28px 28px 48px', background: C.bg, minHeight: '100vh' }}>
      {viewing && <PayloadModal row={viewing} onClose={() => setViewing(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Ingestion Log</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
            Every portal webhook hit — {total.toLocaleString()} total events
          </p>
        </div>
        <button
          onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          <RefreshCw style={{ width: 13, height: 13, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Status filter */}
        <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: status === s ? C.blue : 'transparent', color: status === s ? '#fff' : C.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' }}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
          {SOURCES.map(s => (
            <button key={s} onClick={() => setSource(s)}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: source === s ? C.blue : 'transparent', color: source === s ? '#fff' : C.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              {s === 'all' ? 'All Sources' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: C.red10, border: `1px solid ${C.red}33`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          <p style={{ color: C.red, fontSize: 13, margin: 0 }}>
            {error.includes('SERVICE_ROLE_KEY')
              ? 'Add SUPABASE_SERVICE_ROLE_KEY to .env.local and run the SQL in scripts/create-portal-leads.sql to enable ingestion logging.'
              : error}
          </p>
        </div>
      )}

      {/* Table */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 110px 140px 90px 80px', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: '#F8FAFC' }}>
          {['Source', 'Lead', 'Status', 'Contact ID', 'Time', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.blue}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Loading logs…</p>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>No events yet</p>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Portal webhooks will appear here once leads start flowing in.</p>
          </div>
        ) : (
          rows.map((row, idx) => {
            const sm = STATUS_META[row.ingestion_status]
            const srcm = SOURCE_META[row.source_portal] ?? { bg: C.blue10, color: C.blue }
            return (
              <div key={row.id}
                style={{ display: 'grid', gridTemplateColumns: '160px 1fr 110px 140px 90px 80px', padding: '13px 20px', borderBottom: idx < rows.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}
              >
                {/* Source */}
                <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '3px 9px', borderRadius: 6, background: srcm.bg, color: srcm.color, fontSize: 12, fontWeight: 600 }}>
                  {row.source_portal}
                </span>

                {/* Lead info */}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>
                    {row.contact_name || '—'}
                  </p>
                  <p style={{ fontSize: 12, color: C.muted, margin: '1px 0 0' }}>
                    {row.contact_phone || row.error_message?.slice(0, 50) || '—'}
                  </p>
                </div>

                {/* Status */}
                <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '3px 9px', borderRadius: 6, background: sm?.bg, color: sm?.color, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                  {row.ingestion_status}
                </span>

                {/* Contact ID */}
                {row.contact_id ? (
                  <a href={`/dashboard/leads/${row.contact_id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.blue, fontFamily: 'monospace', textDecoration: 'none' }}
                  >
                    {row.contact_id.slice(0, 8)}…
                    <ExternalLink style={{ width: 10, height: 10 }} />
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: C.label }}>—</span>
                )}

                {/* Time */}
                <span style={{ fontSize: 12, color: C.muted }}>{fmtTime(row.created_at)}</span>

                {/* View button */}
                <button onClick={() => setViewing(row)}
                  style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                >
                  View
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: C.muted }}>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, color: offset === 0 ? C.label : C.text, fontSize: 13, cursor: offset === 0 ? 'default' : 'pointer', opacity: offset === 0 ? 0.5 : 1 }}
            >
              <ChevronLeft style={{ width: 14, height: 14 }} /> Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.text }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, color: offset + PAGE_SIZE >= total ? C.label : C.text, fontSize: 13, cursor: offset + PAGE_SIZE >= total ? 'default' : 'pointer', opacity: offset + PAGE_SIZE >= total ? 0.5 : 1 }}
            >
              Next <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
