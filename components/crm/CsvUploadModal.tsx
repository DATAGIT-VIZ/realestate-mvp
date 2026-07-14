'use client'

import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import {
  X, UploadCloud, FileText, Download, Loader2,
  CheckCircle, AlertCircle, AlertTriangle, ChevronLeft,
  ArrowRight, SkipForward,
} from 'lucide-react'
import { TEMPLATE_HEADERS, type PreviewRow, type PreviewStats } from '@/lib/lead-import'

// ─── Design tokens ────────────────────────────────────────────────────────────
const PANEL   = '#FFFFFF'
const BORDER  = '#E2E8F0'
const BG      = '#FAFAFA'
const TEXT    = '#0F172A'
const MUTED   = '#64748B'
const LABEL   = '#94A3B8'
const PRIMARY = '#a000c8'
const GRAD    = 'linear-gradient(135deg,#7600bc 0%,#b100cd 100%)'
const SUCCESS = '#059669'
const WARN    = '#D97706'
const DANGER  = '#EF4444'

export interface ImportSuccessPayload {
  inserted: number; skipped: number; merged: number; failed: number
  batchId: string | null; message: string
}

type Step = 'upload' | 'analyzing' | 'preview' | 'importing' | 'done'
type DedupStrategy = 'skip' | 'overwrite'
type Filter = 'all' | 'new' | 'duplicate' | 'error'

interface Props {
  onClose: () => void
  onSuccess: (result: ImportSuccessPayload) => void
}

const STATUS_CFG = {
  new:                  { label: 'New',       color: SUCCESS, bg: '#ECFDF5', border: '#A7F3D0' },
  duplicate_phone:      { label: 'Dup phone', color: WARN,    bg: '#FFFBEB', border: '#FDE68A' },
  duplicate_name_email: { label: 'Dup email', color: WARN,    bg: '#FFFBEB', border: '#FDE68A' },
  error:                { label: 'Error',     color: DANGER,  bg: '#FEF2F2', border: '#FECACA' },
}

function Btn({ label, onClick, disabled, variant = 'primary', icon: Icon }: {
  label: string; onClick?: () => void; disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
  icon?: React.ElementType
}) {
  const bg = variant === 'primary' ? GRAD : variant === 'danger' ? DANGER : 'transparent'
  const color = variant === 'ghost' ? MUTED : '#fff'
  const border = variant === 'ghost' ? `1px solid ${BORDER}` : 'none'
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: disabled ? '#E2E8F0' : bg, border, borderRadius: 10, color: disabled ? LABEL : color, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {Icon && <Icon style={{ width: 14, height: 14 }} />}{label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CsvUploadModal({ onClose, onSuccess }: Props) {
  const [step, setStep]           = useState<Step>('upload')
  const [dragOver, setDragOver]   = useState(false)
  const [fileName, setFileName]   = useState('')
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [rawRows, setRawRows]     = useState<Record<string, string>[]>([])
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [stats, setStats]         = useState<PreviewStats | null>(null)
  const [dedup, setDedup]         = useState<DedupStrategy>('skip')
  const [filter, setFilter]       = useState<Filter>('all')
  const [page, setPage]           = useState(0)
  const [result, setResult]       = useState<{ inserted: number; updated: number; skipped: number; errors: number } | null>(null)
  const [apiError, setApiError]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const PAGE_SIZE = 50

  // ── Header validation ──────────────────────────────────────────────────────
  const validateHeaders = (headers: string[]): boolean => {
    const normalised = headers.map(h => h.trim())
    const missing = TEMPLATE_HEADERS.filter(
      th => !normalised.some(h => h.toLowerCase() === th.toLowerCase())
    )
    const extra = normalised.filter(
      h => h && !TEMPLATE_HEADERS.some(th => th.toLowerCase() === h.toLowerCase())
    )
    if (missing.length > 0 || extra.length > 0) {
      const parts: string[] = []
      if (missing.length) parts.push(`Missing: ${missing.join(', ')}`)
      if (extra.length)   parts.push(`Unknown: ${extra.join(', ')}`)
      setHeaderError(parts.join(' · '))
      return false
    }
    setHeaderError(null)
    return true
  }

  // ── Parse file ─────────────────────────────────────────────────────────────
  const parseFile = useCallback((file: File) => {
    setFileName(file.name)
    setHeaderError(null)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const headers = result.meta.fields ?? []
        if (!validateHeaders(headers)) { setStep('upload'); return }

        // Normalise header keys to match TEMPLATE_HEADERS casing exactly
        const normalisedRows = result.data.map(row => {
          const out: Record<string, string> = {}
          for (const [k, v] of Object.entries(row)) {
            const canonical = TEMPLATE_HEADERS.find(th => th.toLowerCase() === k.trim().toLowerCase())
            if (canonical) out[canonical] = (v as string) ?? ''
          }
          return out
        })

        setRawRows(normalisedRows)
        setStep('analyzing')

        try {
          const res  = await fetch('/api/crm/leads/import/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: normalisedRows }),
          })
          const json = await res.json()
          if (json.error) throw new Error(json.error)
          setPreviewRows(json.rows)
          setStats(json.stats)
          setFilter('all')
          setPage(0)
          setStep('preview')
        } catch (e) {
          setApiError(e instanceof Error ? e.message : 'Preview failed')
          setStep('upload')
        }
      },
    })
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
    e.target.value = ''
  }

  // ── Commit ─────────────────────────────────────────────────────────────────
  const handleCommit = async () => {
    setStep('importing')
    try {
      const res  = await fetch('/api/crm/leads/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rawRows, dedupStrategy: dedup }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResult({ inserted: json.inserted, updated: json.updated, skipped: json.skipped, errors: json.errors })
      setStep('done')
      onSuccess({ inserted: json.inserted, skipped: json.skipped + json.errors, merged: json.updated, failed: json.errors, batchId: json.batchId, message: `Imported ${json.inserted} leads` })
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Import failed')
      setStep('preview')
    }
  }

  // ── Derived display rows ───────────────────────────────────────────────────
  const filtered = previewRows.filter(r =>
    filter === 'all'       ? true :
    filter === 'new'       ? r.status === 'new' :
    filter === 'duplicate' ? r.status.startsWith('duplicate') :
    r.status === 'error'
  )
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const willImport = (stats?.new ?? 0) + (dedup === 'overwrite' ? (stats?.duplicates ?? 0) : 0)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: PANEL, borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', width: '100%', maxWidth: step === 'preview' ? 780 : 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 'preview' && (
              <button onClick={() => setStep('upload')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                <ChevronLeft style={{ width: 14, height: 14 }} />Back
              </button>
            )}
            <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: 0 }}>
              {step === 'upload' || step === 'analyzing' ? 'Import Leads'
                : step === 'preview' ? `Preview — ${stats?.total.toLocaleString()} rows`
                : step === 'importing' ? 'Importing…'
                : 'Import Complete'}
            </h2>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* ── UPLOAD ── */}
        {(step === 'upload' || step === 'analyzing') && (
          <div style={{ padding: 24, overflowY: 'auto' }}>

            {apiError && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginBottom: 16 }}>
                <AlertCircle style={{ width: 14, height: 14, color: DANGER, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: DANGER, margin: 0 }}>{apiError}</p>
              </div>
            )}

            {/* Dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => step === 'upload' && fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? PRIMARY : headerError ? DANGER : BORDER}`, borderRadius: 14, padding: '36px 20px', textAlign: 'center', background: dragOver ? 'rgba(160,0,200,0.04)' : BG, cursor: step === 'analyzing' ? 'default' : 'pointer', transition: 'all 0.15s' }}
            >
              {step === 'analyzing' ? (
                <>
                  <Loader2 style={{ width: 32, height: 32, color: PRIMARY, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: '0 0 4px' }}>Analysing {fileName}</p>
                  <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Checking {rawRows.length.toLocaleString()} rows for duplicates…</p>
                </>
              ) : (
                <>
                  <UploadCloud style={{ width: 32, height: 32, color: dragOver ? PRIMARY : LABEL, margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: '0 0 4px' }}>Drop your CSV here or click to browse</p>
                  <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Only files matching the locked template are accepted</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />

            {/* Header error */}
            {headerError && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginTop: 12 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: DANGER, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: DANGER, margin: '0 0 2px' }}>Header mismatch — file rejected</p>
                  <p style={{ fontSize: 11, color: '#991B1B', margin: 0 }}>{headerError}</p>
                </div>
              </div>
            )}

            {/* Template download */}
            <div style={{ marginTop: 16, padding: '12px 14px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, margin: '0 0 2px' }}>Required column order (exact)</p>
                <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.6 }}>
                  {TEMPLATE_HEADERS.map((h, i) => (
                    <span key={h}><strong style={{ color: TEXT }}>{h}</strong>{i < TEMPLATE_HEADERS.length - 1 ? ' · ' : ''}</span>
                  ))}
                </p>
              </div>
              <a href="/templates/lead-import-template.csv" download
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: PRIMARY, border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Download style={{ width: 12, height: 12 }} />Template
              </a>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === 'preview' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

            {/* Stats strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              {[
                { label: 'New leads',   value: stats.new,        color: SUCCESS, filter: 'new'       as Filter },
                { label: 'Duplicates',  value: stats.duplicates, color: WARN,    filter: 'duplicate' as Filter },
                { label: 'Errors',      value: stats.errors,     color: DANGER,  filter: 'error'     as Filter },
              ].map((s, i, a) => (
                <button key={s.label} onClick={() => { setFilter(filter === s.filter ? 'all' : s.filter); setPage(0) }}
                  style={{ padding: '14px 0', textAlign: 'center', borderRight: i < a.length - 1 ? `1px solid ${BORDER}` : 'none', background: filter === s.filter ? `${s.color}08` : 'transparent', border: 'none', cursor: 'pointer', outline: filter === s.filter ? `2px solid ${s.color}30` : 'none' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.label}</div>
                </button>
              ))}
            </div>

            {/* Dedup strategy */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, background: BG }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, flexShrink: 0 }}>Duplicates:</span>
              {([
                { value: 'skip',      label: 'Skip',      Icon: SkipForward, desc: 'Keep existing records unchanged' },
                { value: 'overwrite', label: 'Overwrite', Icon: ArrowRight,  desc: 'Replace existing records with file data' },
              ] as { value: DedupStrategy; label: string; Icon: React.ElementType; desc: string }[]).map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="dedup" value={opt.value} checked={dedup === opt.value} onChange={() => setDedup(opt.value)}
                    style={{ accentColor: PRIMARY }} />
                  <span style={{ fontSize: 12, fontWeight: dedup === opt.value ? 700 : 400, color: dedup === opt.value ? TEXT : MUTED }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: LABEL }}>{opt.desc}</span>
                </label>
              ))}
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              {([
                { key: 'all',       label: `All (${stats.total})` },
                { key: 'new',       label: `New (${stats.new})` },
                { key: 'duplicate', label: `Duplicates (${stats.duplicates})` },
                { key: 'error',     label: `Errors (${stats.errors})` },
              ] as { key: Filter; label: string }[]).map(tab => (
                <button key={tab.key} onClick={() => { setFilter(tab.key); setPage(0) }}
                  style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${filter === tab.key ? PRIMARY : BORDER}`, background: filter === tab.key ? 'rgba(160,0,200,0.08)' : 'transparent', color: filter === tab.key ? PRIMARY : MUTED, fontSize: 11, fontWeight: filter === tab.key ? 700 : 400, cursor: 'pointer' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Row table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: BG, zIndex: 1 }}>
                  <tr>
                    {['Row', 'Client Name', 'Phone', 'Lead Source', 'Budget', 'Status / Issue'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => {
                    const cfg = STATUS_CFG[row.status]
                    return (
                      <tr key={row.rowIndex} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '7px 12px', color: LABEL, fontWeight: 600 }}>{row.rowIndex}</td>
                        <td style={{ padding: '7px 12px', color: TEXT, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.parsed.name || <em style={{ color: LABEL }}>—</em>}
                        </td>
                        <td style={{ padding: '7px 12px', color: MUTED, fontFamily: 'monospace', fontSize: 11 }}>
                          {row.parsed.phone ?? <span style={{ color: DANGER }}>{row.raw['Phone'] || '—'}</span>}
                        </td>
                        <td style={{ padding: '7px 12px', color: MUTED }}>{row.parsed.source || '—'}</td>
                        <td style={{ padding: '7px 12px', color: MUTED }}>
                          {row.parsed.budgetMin || row.parsed.budgetMax
                            ? formatBudget(row.parsed.budgetMin, row.parsed.budgetMax)
                            : '—'}
                        </td>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '2px 7px', borderRadius: 99 }}>
                            {cfg.label}
                          </span>
                          {(row.errors.length > 0 || row.duplicateReason) && (
                            <span style={{ display: 'block', fontSize: 10, color: LABEL, marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.errors[0] ?? row.duplicateReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: LABEL, fontSize: 13 }}>No rows match this filter.</div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 16px', borderTop: `1px solid ${BORDER}`, flexShrink: 0, background: BG }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: page === 0 ? LABEL : TEXT, cursor: page === 0 ? 'default' : 'pointer', fontSize: 12 }}>← Prev</button>
                <span style={{ fontSize: 12, color: MUTED }}>Page {page + 1} / {totalPages} · {filtered.length.toLocaleString()} rows</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: page === totalPages - 1 ? LABEL : TEXT, cursor: page === totalPages - 1 ? 'default' : 'pointer', fontSize: 12 }}>Next →</button>
              </div>
            )}

            {/* Footer CTA */}
            {apiError && (
              <div style={{ padding: '8px 16px', background: '#FEF2F2', flexShrink: 0 }}>
                <p style={{ fontSize: 12, color: DANGER, margin: 0 }}>{apiError}</p>
              </div>
            )}
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: PANEL }}>
              <span style={{ fontSize: 12, color: MUTED }}>
                {willImport.toLocaleString()} lead{willImport !== 1 ? 's' : ''} will be added
                {dedup === 'overwrite' && stats.duplicates > 0 ? ` (incl. ${stats.duplicates} overwrites)` : ''}
                {stats.errors > 0 ? ` · ${stats.errors} rows skipped due to errors` : ''}
              </span>
              <Btn label={`Import ${willImport.toLocaleString()} leads`} onClick={handleCommit} disabled={willImport === 0} />
            </div>
          </div>
        )}

        {/* ── IMPORTING ── */}
        {step === 'importing' && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader2 style={{ width: 36, height: 36, color: PRIMARY, margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: '0 0 6px' }}>Writing to database…</p>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Inserting {willImport.toLocaleString()} leads. Please wait.</p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && result && (
          <div style={{ padding: 28 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <CheckCircle style={{ width: 40, height: 40, color: SUCCESS, margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: '0 0 4px' }}>Import complete</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Added',     value: result.inserted, color: SUCCESS },
                { label: 'Updated',   value: result.updated,  color: '#2563EB' },
                { label: 'Skipped',   value: result.skipped,  color: WARN    },
                { label: 'Errors',    value: result.errors,   color: DANGER  },
              ].map(s => (
                <div key={s.label} style={{ padding: '16px', background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn label="Import Another" onClick={() => { setStep('upload'); setRawRows([]); setPreviewRows([]); setStats(null); setFileName(''); setApiError(null) }} variant="ghost" />
              <Btn label="Done" onClick={onClose} />
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

function formatBudget(min: number | null, max: number | null): string {
  const fmt = (n: number) => n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(1)}Cr` : `${+(n / 100_000).toFixed(1)}L`
  if (min && max) return `${fmt(min)}–${fmt(max)}`
  if (min) return `${fmt(min)}+`
  if (max) return fmt(max)
  return '—'
}
