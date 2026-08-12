'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Papa from 'papaparse'
import {
  X,
  UploadSimple,
  FileCsv,
  Download,
  CircleNotch,
  CheckCircle,
  WarningCircle,
  Warning,
  CaretLeft,
  ArrowRight,
  Checks,
  Clock,
  Trash,
} from '@phosphor-icons/react'
import { type PreviewRow, type PreviewStats } from '@/lib/lead-import'

// ─── Design tokens — cobalt ───────────────────────────────────────────────────
const PANEL       = '#FFFFFF'
const BORDER      = '#E2E8F0'
const BG          = '#FAFAF8'
const TEXT        = '#0F172A'
const MUTED       = '#64748B'
const LABEL       = '#94A3B8'
const PRIMARY     = '#1D4ED8'
const GRAD        = 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)'
const PRIMARY_DIM = 'rgba(29,78,216,0.08)'
const SUCCESS     = '#059669'
const WARN        = '#D97706'
const DANGER      = '#EF4444'

export interface ImportSuccessPayload {
  inserted: number; skipped: number; merged: number; failed: number
  batchId: string | null; message: string
}

type Step          = 'upload' | 'mapping' | 'analyzing' | 'preview' | 'importing' | 'done'
type DedupStrategy = 'skip' | 'overwrite'
type Filter        = 'all' | 'new' | 'duplicate' | 'error'
type InternalField = 'name' | 'phone' | 'email' | 'source' | 'city' | 'budget' | 'propertyType' | 'timeline' | 'notes'
type FieldMap      = Record<InternalField, string>

interface Props {
  onClose:   () => void
  onSuccess: (result: ImportSuccessPayload) => void
}

interface HistoryBatch {
  id: string
  file_name: string | null
  status: string
  total_rows: number | null
  inserted_rows: number | null
  failed_rows: number | null
  created_at: string
}

// ─── Column mapping config ─────────────────────────────────────────────────────

const FIELD_CONFIG: { key: InternalField; label: string; required: boolean }[] = [
  { key: 'name',         label: 'Client Name',     required: true  },
  { key: 'phone',        label: 'Phone',            required: true  },
  { key: 'email',        label: 'Email',            required: false },
  { key: 'source',       label: 'Lead Source',      required: false },
  { key: 'city',         label: 'Location / City',  required: false },
  { key: 'budget',       label: 'Budget',           required: false },
  { key: 'propertyType', label: 'Property Type',    required: false },
  { key: 'timeline',     label: 'Timeline',         required: false },
  { key: 'notes',        label: 'Notes',            required: false },
]

const CANONICAL: Record<InternalField, string> = {
  name:         'Client Name',
  phone:        'Phone',
  email:        'Email',
  source:       'Lead Source',
  city:         'Location',
  budget:       'Budget',
  propertyType: 'Property Type',
  timeline:     'Timeline',
  notes:        'Notes',
}

const AUTO_MAP: Record<InternalField, string[]> = {
  name:         ['client name', 'buyer name', 'lead name', 'full name', 'full_name', 'name', 'customer name', 'contact name', 'consumer name', 'lead_name'],
  phone:        ['phone', 'mobile', 'contact no', 'contact no.', 'phone number', 'phone_number', 'mobile no', 'mobile number', 'cell', 'contact', 'phone no', 'ph no'],
  email:        ['email', 'email address', 'email id', 'e-mail', 'emailaddress', 'email_id', 'email_address'],
  source:       ['lead source', 'source', 'portal', 'channel', 'utm_source', 'medium', 'lead_source'],
  city:         ['city', 'location', 'area', 'locality', 'preferred location', 'preferred city', 'location preference', 'preferred_location'],
  budget:       ['budget', 'budget range', 'price range', 'price', 'amount', 'property budget', 'budget_range'],
  propertyType: ['property type', 'unit type', 'requirement', 'bhk type', 'flat type', 'property_type', 'config', 'configuration', 'unit_type', 'bhk', 'type'],
  timeline:     ['timeline', 'when to buy', 'purchase timeline', 'time frame', 'purchase time', 'possession timeline'],
  notes:        ['notes', 'remarks', 'comments', 'additional info', 'message', 'description', 'note', 'remark'],
}

function autoDetect(headers: string[]): FieldMap {
  const lc     = headers.map(h => h.trim().toLowerCase())
  const result: FieldMap = { name: '', phone: '', email: '', source: '', city: '', budget: '', propertyType: '', timeline: '', notes: '' }
  for (const { key } of FIELD_CONFIG) {
    const match = AUTO_MAP[key].find(p => lc.includes(p))
    if (match) result[key] = headers[lc.indexOf(match)]
  }
  return result
}

function detectPortal(headers: string[]): string | null {
  const joined = headers.map(h => h.trim().toLowerCase()).join(',')
  if (joined.includes('buyer name') || joined.includes('99acres'))   return '99acres'
  if (joined.includes('lead_name') || joined.includes('phone_number')) return 'Facebook Leads'
  if (joined.includes('consumer name'))                               return 'Housing.com'
  if (joined.includes('contact no'))                                  return 'MagicBricks'
  return null
}

function applyMapping(rows: Record<string, string>[], map: FieldMap): Record<string, string>[] {
  return rows.map(row => {
    const out: Record<string, string> = {}
    for (const { key } of FIELD_CONFIG) {
      if (map[key]) out[CANONICAL[key]] = row[map[key]]?.trim() ?? ''
    }
    return out
  })
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

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
  const bg    = variant === 'primary' ? GRAD : variant === 'danger' ? DANGER : 'transparent'
  const color = variant === 'ghost' ? MUTED : '#fff'
  const bdr   = variant === 'ghost' ? `1px solid ${BORDER}` : 'none'
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: disabled ? '#E2E8F0' : bg, border: bdr, borderRadius: 4, color: disabled ? LABEL : color, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {Icon && <Icon weight="light" size={14} />}{label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CsvUploadModal({ onClose, onSuccess }: Props) {
  const [step, setStep]             = useState<Step>('upload')
  const [dragOver, setDragOver]     = useState(false)
  const [fileName, setFileName]     = useState('')
  const [apiError, setApiError]     = useState<string | null>(null)

  // Pre-mapping
  const [csvHeaders, setCsvHeaders]         = useState<string[]>([])
  const [rawParsed, setRawParsed]           = useState<Record<string, string>[]>([])
  const [fieldMap, setFieldMap]             = useState<FieldMap>({ name: '', phone: '', email: '', source: '', city: '', budget: '', propertyType: '', timeline: '', notes: '' })
  const [detectedPortal, setDetectedPortal] = useState<string | null>(null)

  // Post-mapping
  const [rawRows, setRawRows]           = useState<Record<string, string>[]>([])
  const [previewRows, setPreviewRows]   = useState<PreviewRow[]>([])
  const [stats, setStats]               = useState<PreviewStats | null>(null)
  const [dedup, setDedup]               = useState<DedupStrategy>('skip')
  const [filter, setFilter]             = useState<Filter>('all')
  const [page, setPage]                 = useState(0)
  const [result, setResult]             = useState<{ inserted: number; updated: number; skipped: number; errors: number } | null>(null)
  const [pollingBatchId, setPollingBatchId] = useState<string | null>(null)

  // History
  const [showHistory, setShowHistory]       = useState(false)
  const [history, setHistory]               = useState<HistoryBatch[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deletingId, setDeletingId]         = useState<string | null>(null)

  const fileRef   = useRef<HTMLInputElement>(null)
  const PAGE_SIZE = 50

  // ── Parse ────────────────────────────────────────────────────────────────────
  const parseFile = useCallback((file: File) => {
    setFileName(file.name)
    setApiError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields ?? []
        setCsvHeaders(headers)
        setRawParsed(res.data)
        setDetectedPortal(detectPortal(headers))
        setFieldMap(autoDetect(headers))
        setStep('mapping')
      },
    })
  }, [])

  const handleDrop       = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f) }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = '' }

  // ── Mapping → preview ────────────────────────────────────────────────────────
  const handleProceedMapping = useCallback(async () => {
    const missing = FIELD_CONFIG.filter(f => f.required && !fieldMap[f.key])
    if (missing.length > 0) {
      setApiError(`Required fields not mapped: ${missing.map(f => f.label).join(', ')}`)
      return
    }
    setApiError(null)
    const normalised = applyMapping(rawParsed, fieldMap)
    setRawRows(normalised)
    setStep('analyzing')

    try {
      const res  = await fetch('/api/crm/leads/import/preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows: normalised }),
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
      setStep('mapping')
    }
  }, [rawParsed, fieldMap])

  // ── Commit ───────────────────────────────────────────────────────────────────
  const handleCommit = async () => {
    setStep('importing')
    setPollingBatchId(null)
    try {
      const res  = await fetch('/api/crm/leads/import/commit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows: rawRows, dedupStrategy: dedup }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      if (json.sync === false && json.batchId) {
        setPollingBatchId(json.batchId)
        return
      }

      setResult({ inserted: json.inserted, updated: json.updated, skipped: json.skipped, errors: json.errors })
      setStep('done')
      onSuccess({ inserted: json.inserted, skipped: json.skipped + json.errors, merged: json.updated, failed: json.errors, batchId: json.batchId, message: `Imported ${json.inserted} leads` })
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Import failed')
      setStep('preview')
    }
  }

  // ── Progress polling for async batches ──────────────────────────────────────
  useEffect(() => {
    if (step !== 'importing' || !pollingBatchId) return
    const iv = setInterval(async () => {
      try {
        const res  = await fetch(`/api/crm/leads/import/${pollingBatchId}`)
        const json = await res.json()
        if (json.status === 'complete' || json.status === 'done') {
          clearInterval(iv)
          const ins = json.inserted ?? 0, upd = json.updated ?? json.merged ?? 0, skp = json.skipped ?? 0, fail = json.failed ?? 0
          setResult({ inserted: ins, updated: upd, skipped: skp, errors: fail })
          setStep('done')
          onSuccess({ inserted: ins, skipped: skp, merged: upd, failed: fail, batchId: pollingBatchId, message: `Imported ${ins} leads` })
        } else if (json.status === 'failed') {
          clearInterval(iv)
          setApiError('Import processing failed')
          setStep('preview')
        }
      } catch {}
    }, 2000)
    return () => clearInterval(iv)
  }, [step, pollingBatchId, onSuccess])

  // ── History ──────────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res  = await fetch('/api/crm/leads/import/history')
      const json = await res.json()
      setHistory(json.batches ?? [])
    } catch {}
    setHistoryLoading(false)
  }, [])

  const handleDeleteBatch = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/crm/leads/import/${id}`, { method: 'DELETE' })
      setHistory(h => h.filter(b => b.id !== id))
    } catch {}
    setDeletingId(null)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filtered   = previewRows.filter(r =>
    filter === 'all'       ? true :
    filter === 'new'       ? r.status === 'new' :
    filter === 'duplicate' ? r.status.startsWith('duplicate') :
    r.status === 'error'
  )
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const willImport = (stats?.new ?? 0) + (dedup === 'overwrite' ? (stats?.duplicates ?? 0) : 0)
  const mappedCount = FIELD_CONFIG.filter(f => fieldMap[f.key]).length

  const resetToUpload = () => {
    setStep('upload'); setRawRows([]); setRawParsed([]); setPreviewRows([])
    setStats(null); setFileName(''); setApiError(null); setShowHistory(false)
    setPollingBatchId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: PANEL, borderRadius: 4, border: `1px solid ${BORDER}`, boxShadow: '0 24px 64px rgba(0,0,0,0.16)', width: '100%', maxWidth: step === 'preview' ? 800 : 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'max-width 0.2s ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(step === 'mapping' || step === 'analyzing') && (
              <button onClick={() => { setStep('upload'); setApiError(null) }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                <CaretLeft weight="light" size={14} />Back
              </button>
            )}
            {step === 'preview' && (
              <button onClick={() => setStep('mapping')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                <CaretLeft weight="light" size={14} />Back
              </button>
            )}
            <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: 0 }}>
              {step === 'upload'                      ? 'Import Leads'
               : step === 'mapping' || step === 'analyzing' ? 'Map Columns'
               : step === 'preview'                  ? `Preview — ${stats?.total.toLocaleString()} rows`
               : step === 'importing'                ? 'Importing…'
               : 'Import Complete'}
            </h2>
          </div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 4, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X weight="light" size={12} />
          </button>
        </div>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <div style={{ padding: 24, overflowY: 'auto' }}>
            {apiError && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, marginBottom: 16 }}>
                <WarningCircle weight="light" size={14} color={DANGER} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: DANGER, margin: 0 }}>{apiError}</p>
              </div>
            )}

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? PRIMARY : BORDER}`, borderRadius: 4, padding: '44px 24px', textAlign: 'center', background: dragOver ? PRIMARY_DIM : BG, cursor: 'pointer', transition: 'all 0.15s' }}
            >
              <UploadSimple weight="light" size={36} color={dragOver ? PRIMARY : LABEL} style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: '0 0 4px' }}>Drop CSV here or click to browse</p>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Any portal export works — you'll map columns in the next step</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />

            <div style={{ marginTop: 14, padding: '12px 14px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, margin: '0 0 2px' }}>Vya Pulse template</p>
                <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.7 }}>
                  Client Name · Phone · Email · Lead Source · Location · Budget · Property Type · Timeline · Notes
                </p>
              </div>
              <a href="/templates/lead-import-template.csv" download
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: GRAD, border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Download weight="light" size={12} />Template
              </a>
            </div>

            {/* Import history */}
            <div style={{ marginTop: 14, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
              <button
                onClick={() => { if (!showHistory) loadHistory(); setShowHistory(v => !v) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <Clock weight="light" size={14} />
                {showHistory ? 'Hide recent imports' : 'View recent imports'}
              </button>

              {showHistory && (
                <div style={{ marginTop: 10 }}>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <CircleNotch weight="light" size={20} color={PRIMARY} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                    </div>
                  ) : history.length === 0 ? (
                    <p style={{ fontSize: 12, color: LABEL, textAlign: 'center', padding: '12px 0', margin: 0 }}>No import history yet.</p>
                  ) : (
                    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                      {history.slice(0, 10).map((b, i) => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: i < Math.min(history.length, 10) - 1 ? `1px solid ${BORDER}` : 'none', background: i % 2 === 0 ? 'transparent' : BG }}>
                          <FileCsv weight="light" size={15} color={LABEL} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: TEXT, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.file_name ?? 'Import'}</p>
                            <p style={{ fontSize: 11, color: LABEL, margin: 0 }}>
                              {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {b.inserted_rows != null ? ` · ${b.inserted_rows} added` : ''}
                              {b.total_rows != null ? ` of ${b.total_rows}` : ''}
                            </p>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: b.status === 'complete' ? SUCCESS : WARN, background: b.status === 'complete' ? '#ECFDF5' : '#FFFBEB', padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                            {b.status}
                          </span>
                          <button
                            onClick={() => handleDeleteBatch(b.id)}
                            disabled={deletingId === b.id}
                            title="Undo import — deletes all leads from this batch"
                            style={{ display: 'flex', alignItems: 'center', padding: 4, background: 'none', border: 'none', cursor: deletingId === b.id ? 'wait' : 'pointer', color: LABEL, flexShrink: 0 }}
                          >
                            {deletingId === b.id
                              ? <CircleNotch weight="light" size={14} style={{ animation: 'spin 1s linear infinite' }} />
                              : <Trash weight="light" size={14} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MAPPING ── */}
        {step === 'mapping' && (
          <div style={{ padding: 24, overflowY: 'auto' }}>
            {detectedPortal && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: PRIMARY_DIM, border: `1px solid rgba(29,78,216,0.2)`, borderRadius: 4, marginBottom: 14 }}>
                <Checks weight="light" size={14} color={PRIMARY} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600 }}>Detected: {detectedPortal}</span>
                <span style={{ fontSize: 11, color: MUTED }}>— fields auto-mapped below. Review before continuing.</span>
              </div>
            )}

            <p style={{ fontSize: 12, color: MUTED, margin: '0 0 12px' }}>
              Match each Vya Pulse field to a column in <strong style={{ color: TEXT }}>{fileName}</strong>.
            </p>

            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              {FIELD_CONFIG.map((field, i) => {
                const mapped = !!fieldMap[field.key]
                return (
                  <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < FIELD_CONFIG.length - 1 ? `1px solid ${BORDER}` : 'none', background: i % 2 === 0 ? 'transparent' : BG }}>
                    <div style={{ width: 130, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{field.label}</span>
                      {field.required && <span style={{ fontSize: 10, color: DANGER, marginLeft: 3 }}>*</span>}
                    </div>
                    <select
                      value={fieldMap[field.key]}
                      onChange={e => setFieldMap(m => ({ ...m, [field.key]: e.target.value }))}
                      style={{ flex: 1, padding: '6px 8px', border: `1px solid ${mapped ? 'rgba(29,78,216,0.28)' : BORDER}`, borderRadius: 4, fontSize: 12, color: mapped ? TEXT : LABEL, background: mapped ? PRIMARY_DIM : '#fff', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="">— skip —</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {mapped && <CheckCircle weight="fill" size={14} color={SUCCESS} />}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: 10, padding: '8px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 4 }}>
              <span style={{ fontSize: 11, color: MUTED }}>{mappedCount} of {FIELD_CONFIG.length} fields mapped</span>
              {csvHeaders.length > 0 && <span style={{ fontSize: 11, color: LABEL }}> · {csvHeaders.length} columns · {rawParsed.length.toLocaleString()} rows</span>}
            </div>

            {apiError && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, marginTop: 12 }}>
                <Warning weight="light" size={14} color={DANGER} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: DANGER, margin: 0 }}>{apiError}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Btn label="Preview Import" onClick={handleProceedMapping} icon={ArrowRight} />
            </div>
          </div>
        )}

        {/* ── ANALYZING ── */}
        {step === 'analyzing' && (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <CircleNotch weight="light" size={36} color={PRIMARY} style={{ margin: '0 auto 14px', display: 'block', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: '0 0 6px' }}>Analysing {fileName}</p>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Checking {rawParsed.length.toLocaleString()} rows for duplicates…</p>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === 'preview' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              {[
                { label: 'New leads',  value: stats.new,        color: SUCCESS, f: 'new'       as Filter },
                { label: 'Duplicates', value: stats.duplicates, color: WARN,    f: 'duplicate' as Filter },
                { label: 'Errors',     value: stats.errors,     color: DANGER,  f: 'error'     as Filter },
              ].map((s, i, a) => (
                <button key={s.label} onClick={() => { setFilter(filter === s.f ? 'all' : s.f); setPage(0) }}
                  style={{ padding: '14px 0', textAlign: 'center', border: 'none', borderRight: i < a.length - 1 ? `1px solid ${BORDER}` : 'none', background: filter === s.f ? `${s.color}08` : 'transparent', cursor: 'pointer' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.label}</div>
                </button>
              ))}
            </div>

            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, background: BG }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, flexShrink: 0 }}>Duplicates:</span>
              {([
                { value: 'skip',      label: 'Skip',      desc: 'Keep existing records' },
                { value: 'overwrite', label: 'Overwrite', desc: 'Replace with file data' },
              ] as { value: DedupStrategy; label: string; desc: string }[]).map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="dedup" value={opt.value} checked={dedup === opt.value} onChange={() => setDedup(opt.value)}
                    style={{ accentColor: PRIMARY }} />
                  <span style={{ fontSize: 12, fontWeight: dedup === opt.value ? 700 : 400, color: dedup === opt.value ? TEXT : MUTED }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: LABEL }}>{opt.desc}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              {([
                { key: 'all',       label: `All (${stats.total})` },
                { key: 'new',       label: `New (${stats.new})` },
                { key: 'duplicate', label: `Duplicates (${stats.duplicates})` },
                { key: 'error',     label: `Errors (${stats.errors})` },
              ] as { key: Filter; label: string }[]).map(tab => (
                <button key={tab.key} onClick={() => { setFilter(tab.key); setPage(0) }}
                  style={{ padding: '4px 10px', borderRadius: 2, border: `1px solid ${filter === tab.key ? PRIMARY : BORDER}`, background: filter === tab.key ? PRIMARY_DIM : 'transparent', color: filter === tab.key ? PRIMARY : MUTED, fontSize: 11, fontWeight: filter === tab.key ? 700 : 400, cursor: 'pointer' }}>
                  {tab.label}
                </button>
              ))}
            </div>

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
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '2px 7px', borderRadius: 2 }}>
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
                <div style={{ padding: 32, textAlign: 'center', color: LABEL, fontSize: 13 }}>No rows match this filter.</div>
              )}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 16px', borderTop: `1px solid ${BORDER}`, flexShrink: 0, background: BG }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${BORDER}`, background: 'transparent', color: page === 0 ? LABEL : TEXT, cursor: page === 0 ? 'default' : 'pointer', fontSize: 12 }}>← Prev</button>
                <span style={{ fontSize: 12, color: MUTED }}>Page {page + 1} / {totalPages} · {filtered.length.toLocaleString()} rows</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${BORDER}`, background: 'transparent', color: page === totalPages - 1 ? LABEL : TEXT, cursor: page === totalPages - 1 ? 'default' : 'pointer', fontSize: 12 }}>Next →</button>
              </div>
            )}

            {apiError && (
              <div style={{ padding: '8px 16px', background: '#FEF2F2', flexShrink: 0 }}>
                <p style={{ fontSize: 12, color: DANGER, margin: 0 }}>{apiError}</p>
              </div>
            )}
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: MUTED }}>
                {willImport.toLocaleString()} lead{willImport !== 1 ? 's' : ''} will be added
                {dedup === 'overwrite' && stats.duplicates > 0 ? ` (incl. ${stats.duplicates} overwrites)` : ''}
                {stats.errors > 0 ? ` · ${stats.errors} rows skipped` : ''}
              </span>
              <Btn label={`Import ${willImport.toLocaleString()} leads`} onClick={handleCommit} disabled={willImport === 0} />
            </div>
          </div>
        )}

        {/* ── IMPORTING ── */}
        {step === 'importing' && (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <CircleNotch weight="light" size={36} color={PRIMARY} style={{ margin: '0 auto 16px', display: 'block', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: '0 0 6px' }}>
              {pollingBatchId ? 'Processing in background…' : 'Writing to database…'}
            </p>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
              {pollingBatchId
                ? 'Large import underway — checking progress every 2s…'
                : `Inserting ${willImport.toLocaleString()} leads. Please wait.`}
            </p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && result && (
          <div style={{ padding: 28 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <CheckCircle weight="fill" size={40} color={SUCCESS} style={{ margin: '0 auto 10px', display: 'block' }} />
              <h3 style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: '0 0 4px' }}>Import complete</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Added',   value: result.inserted, color: SUCCESS  },
                { label: 'Updated', value: result.updated,  color: PRIMARY  },
                { label: 'Skipped', value: result.skipped,  color: WARN     },
                { label: 'Errors',  value: result.errors,   color: DANGER   },
              ].map(s => (
                <div key={s.label} style={{ padding: 16, background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn label="Import Another" onClick={resetToUpload} variant="ghost" />
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
