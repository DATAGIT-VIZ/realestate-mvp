'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, X, ChevronLeft, ChevronRight, ExternalLink,
  Mail, Sparkles, CheckCircle, AlertCircle, Upload,
  User, Phone, MapPin, Home, IndianRupee, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { PortalLeadRow, IngestionStatus } from '@/lib/ingestionLog'

const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0', borderDim: '#F1F5F9',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#2563EB', blueDim: '#EFF6FF', blueBorder: '#BFDBFE',
  emerald: '#059669', emeraldDim: '#ECFDF5',
  amber: '#D97706', amberDim: '#FFFBEB',
  red: '#EF4444', redDim: '#FFF1F2',
  violet: '#7C3AED', violetDim: '#F5F3FF',
}

const SOURCES = ['all', 'MagicBricks', '99acres', 'Housing.com', 'Email', 'Facebook']
const STATUSES: (IngestionStatus | 'all')[] = ['all', 'created', 'duplicate', 'failed']

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  created:   { label: 'Created',   bg: C.emeraldDim, color: C.emerald },
  duplicate: { label: 'Duplicate', bg: C.amberDim,   color: C.amber   },
  failed:    { label: 'Failed',    bg: C.redDim,     color: C.red     },
}

const SOURCE_META: Record<string, { bg: string; color: string }> = {
  MagicBricks:  { bg: 'rgba(234,88,12,0.08)',   color: '#EA580C' },
  '99acres':    { bg: C.blueDim,                color: C.blue    },
  'Housing.com':{ bg: C.emeraldDim,             color: C.emerald },
  Email:        { bg: C.violetDim,              color: C.violet  },
  Facebook:     { bg: 'rgba(24,119,242,0.08)',  color: '#1877F2' },
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function fmtBudget(min?: number, max?: number) {
  const f = (n: number) => n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)}Cr` : `₹${(n / 100_000).toFixed(0)}L`
  if (min && max) return `${f(min)} – ${f(max)}`
  if (max) return `Up to ${f(max)}`
  if (min) return `From ${f(min)}`
  return null
}

// ─── Parsed lead preview card ─────────────────────────────────────────────────
interface ParsedPreview {
  firstName: string
  lastName?: string
  phone: string
  email?: string
  city?: string
  budgetMin?: number
  budgetMax?: number
  sourcePortal?: string
  propertyType?: string[]
  timeline?: string
  localities?: string[]
}

function LeadPreviewCard({ data, onConfirm, onDiscard, saving }: {
  data: ParsedPreview
  onConfirm: () => void
  onDiscard: () => void
  saving: boolean
}) {
  const budget = fmtBudget(data.budgetMin, data.budgetMax)
  const chips = [
    data.city && { icon: MapPin, label: data.city },
    data.propertyType?.[0] && { icon: Home, label: data.propertyType[0] },
    budget && { icon: IndianRupee, label: budget },
    data.timeline && { icon: Clock, label: data.timeline },
    data.sourcePortal && { icon: null, label: data.sourcePortal, accent: true },
  ].filter(Boolean) as { icon: React.ComponentType<{size:number}> | null; label: string; accent?: boolean }[]

  return (
    <div style={{ background: C.panel, border: `2px solid ${C.emerald}`, borderRadius: 16, overflow: 'hidden', marginTop: 16 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#ECFDF5,#F0FDF4)', padding: '14px 18px', borderBottom: `1px solid #A7F3D0`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle size={16} color={C.emerald} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.emerald }}>Lead extracted — looks good?</span>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* Name + phone */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#2563EB,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {data.firstName.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 3 }}>
              {data.firstName} {data.lastName ?? ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={12} color={C.blue} />
              <span style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{data.phone}</span>
            </div>
            {data.email && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{data.email}</div>
            )}
          </div>
        </div>

        {/* Chips */}
        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {chips.map((c, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: c.accent ? 700 : 500,
                background: c.accent ? C.blueDim : C.bg,
                color: c.accent ? C.blue : C.muted,
                border: `1px solid ${c.accent ? C.blueBorder : C.border}`,
                borderRadius: 20, padding: '3px 10px',
              }}>
                {c.icon && <c.icon size={11} />}
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* Localities */}
        {data.localities && data.localities.length > 0 && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
            <span style={{ fontWeight: 600 }}>Localities: </span>{data.localities.join(', ')}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onConfirm} disabled={saving}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', background: saving ? C.borderDim : C.emerald, border: 'none', borderRadius: 12, color: saving ? C.label : '#fff', fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 14px rgba(5,150,105,0.25)' }}>
            {saving
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Upload size={14} /> Add to CRM</>
            }
          </button>
          <button onClick={onDiscard} disabled={saving}
            style={{ padding: '11px 18px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Discard
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick import panel ───────────────────────────────────────────────────────
function QuickImportPanel({ onImported }: { onImported: () => void }) {
  const [open,    setOpen]    = useState(true)
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [preview, setPreview] = useState<ParsedPreview | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const parse = async () => {
    if (!body.trim()) return
    setParsing(true)
    setError(null)
    setPreview(null)
    setSuccess(null)
    try {
      const res  = await fetch('/api/leads/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Subject: ${subject}\n\n${body}` }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      if (!json.name && !json.phone) throw new Error('Could not find a name or phone number in this email.')
      // Normalise parse-email response to ParsedPreview shape
      const [firstName, ...rest] = (json.name ?? '').split(' ')
      setPreview({
        firstName: firstName || 'Unknown',
        lastName:  rest.join(' ') || undefined,
        phone:     json.phone ?? '',
        email:     json.email,
        city:      json.city,
        budgetMin: json.budget_min,
        budgetMax: json.budget_max,
        sourcePortal: json.source,
        propertyType: json.property_type ? [json.property_type] : undefined,
        timeline:  json.timeline,
        localities: json.locations,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parsing failed')
    } finally {
      setParsing(false)
    }
  }

  const confirm = async () => {
    if (!preview) return
    setSaving(true)
    setError(null)
    try {
      const res  = await fetch('/api/ingest/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const status = json.data?.status === 'duplicate' ? 'duplicate — already in CRM' : 'added to CRM'
      setSuccess(`${preview.firstName} ${preview.lastName ?? ''} ${status} ✓`)
      setPreview(null)
      setBody('')
      setSubject('')
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save lead')
    } finally {
      setSaving(false)
    }
  }

  const discard = () => { setPreview(null); setError(null) }

  const exampleEmail = `Subject: New Lead - 3BHK in Bandra West from MagicBricks

Name: Priya Sharma
Mobile: 9876543210
Email: priya.sharma@gmail.com
City: Mumbai
Property Type: 3BHK Apartment
Budget: 1.5 Cr - 2 Cr
Preferred Localities: Bandra West, Juhu
Timeline: Immediate
Message: Looking for a ready-to-move flat for end use.`

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>

      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'linear-gradient(135deg,#EFF6FF,#F5F3FF)', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#2563EB,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={16} color="#fff" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Quick Import — Paste Portal Email</div>
            <div style={{ fontSize: 12, color: C.muted }}>Paste any lead email from MagicBricks, 99acres, Housing.com, NoBroker… AI extracts the lead instantly</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, background: C.emeraldDim, color: C.emerald, borderRadius: 20, padding: '3px 10px', border: `1px solid #A7F3D0` }}>
            No setup needed
          </span>
          {open ? <ChevronUp size={16} color={C.label} /> : <ChevronDown size={16} color={C.label} />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: '20px 20px 22px' }}>

          {/* Success banner */}
          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.emeraldDim, border: `1px solid #A7F3D0`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <CheckCircle size={16} color={C.emerald} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.emerald }}>{success}</span>
              <button onClick={() => setSuccess(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: C.emerald, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Error banner */}
          {error && !preview && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.redDim, border: `1px solid #FCA5A5`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <AlertCircle size={16} color={C.red} />
              <span style={{ fontSize: 13, color: C.red }}>{error}</span>
              <button onClick={() => setError(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: C.red, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Left — inputs */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Email subject (optional)
              </label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. New Lead from MagicBricks – 2BHK Pune"
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, background: C.bg, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
              />
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Paste email body *
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={`Paste the portal lead email here…\n\nWorks with MagicBricks, 99acres, Housing.com, NoBroker, Facebook, or any portal email.`}
                style={{ width: '100%', padding: '12px 14px', border: `1px solid ${body ? C.blueBorder : C.border}`, borderRadius: 12, fontSize: 13, color: C.text, background: C.bg, resize: 'vertical', minHeight: 160, outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 0.15s' }}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                <button
                  onClick={parse}
                  disabled={!body.trim() || parsing}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: !body.trim() || parsing ? C.borderDim : 'linear-gradient(135deg,#2563EB,#7C3AED)', border: 'none', borderRadius: 12, color: !body.trim() || parsing ? C.label : '#fff', fontSize: 14, fontWeight: 800, cursor: !body.trim() || parsing ? 'not-allowed' : 'pointer', boxShadow: body.trim() && !parsing ? '0 4px 14px rgba(37,99,235,0.25)' : 'none' }}
                >
                  {parsing
                    ? <><Sparkles size={14} style={{ animation: 'spin 1s linear infinite' }} /> Extracting…</>
                    : <><Sparkles size={14} /> Extract Lead</>
                  }
                </button>
                {body && (
                  <button onClick={() => { setBody(''); setSubject(''); setPreview(null); setError(null); setSuccess(null) }}
                    style={{ padding: '11px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 12, color: C.label, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Right — example + preview */}
            <div>
              {!preview && !parsing && (
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Example email</span>
                    <button
                      onClick={() => { setBody(exampleEmail.split('\n').slice(2).join('\n').trim()); setSubject('New Lead - 3BHK in Bandra West from MagicBricks') }}
                      style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: C.blue, background: C.blueDim, border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                    >
                      Try it →
                    </button>
                  </div>
                  <pre style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {exampleEmail}
                  </pre>
                </div>
              )}

              {parsing && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#EFF6FF,#F5F3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={22} color={C.violet} style={{ animation: 'pulse 1s infinite' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>AI is reading the email…</span>
                  <span style={{ fontSize: 11, color: C.label }}>Extracting name, phone, budget, preferences</span>
                </div>
              )}

              {preview && (
                <LeadPreviewCard
                  data={preview}
                  onConfirm={confirm}
                  onDiscard={discard}
                  saving={saving}
                />
              )}
            </div>
          </div>

          {/* Bottom hint */}
          <div style={{ marginTop: 16, padding: '10px 14px', background: C.blueDim, border: `1px solid ${C.blueBorder}`, borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>💡</span>
            <span style={{ fontSize: 12, color: C.blue, lineHeight: 1.5 }}>
              <strong>Pro tip:</strong> Set up a Gmail filter to auto-forward lead emails from portals to a dedicated inbox, then paste them here in bulk. Once your app is deployed, webhooks will do this automatically — zero manual work.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Raw payload modal ────────────────────────────────────────────────────────
function PayloadModal({ row, onClose }: { row: PortalLeadRow; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Raw Payload</p>
            <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>{row.source_portal} · {new Date(row.created_at).toLocaleString('en-IN')}</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {row.parsed_contact && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Extracted Contact</p>
              <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 12, color: C.text, overflowX: 'auto', margin: 0, fontFamily: 'monospace', lineHeight: 1.6 }}>
                {JSON.stringify(row.parsed_contact, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Raw Payload</p>
            <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 12, color: C.text, overflowX: 'auto', margin: 0, fontFamily: 'monospace', lineHeight: 1.6 }}>
              {JSON.stringify(row.raw_payload, null, 2)}
            </pre>
          </div>
          {row.error_message && (
            <div style={{ background: C.redDim, border: `1px solid #FCA5A5`, borderRadius: 10, padding: '10px 14px' }}>
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
  const [rows,    setRows]    = useState<PortalLeadRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [status,  setStatus]  = useState<IngestionStatus | 'all'>('all')
  const [source,  setSource]  = useState('all')
  const [offset,  setOffset]  = useState(0)
  const [viewing, setViewing] = useState<PortalLeadRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status, source, limit: String(PAGE_SIZE), offset: String(offset) })
      const res  = await fetch(`/api/ingest/log?${params}`)
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
  useEffect(() => { setOffset(0) }, [status, source])

  const totalPages  = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div style={{ padding: '28px 28px 48px', background: C.bg, minHeight: '100vh' }}>
      {viewing && <PayloadModal row={viewing} onClose={() => setViewing(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Ingestion Log</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
            Portal leads flowing in — {total.toLocaleString()} total events
          </p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Quick import panel */}
      <QuickImportPanel onImported={load} />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: status === s ? C.blue : 'transparent', color: status === s ? '#fff' : C.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
          {SOURCES.map(s => (
            <button key={s} onClick={() => setSource(s)}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: source === s ? C.blue : 'transparent', color: source === s ? '#fff' : C.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              {s === 'all' ? 'All Sources' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: C.redDim, border: `1px solid #FCA5A5`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          <p style={{ color: C.red, fontSize: 13, margin: 0 }}>
            {error.includes('SERVICE_ROLE_KEY')
              ? 'Add SUPABASE_SERVICE_ROLE_KEY to .env.local and run scripts/create-portal-leads.sql to enable ingestion logging.'
              : error}
          </p>
        </div>
      )}

      {/* Table */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 110px 130px 90px 70px', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
          {['Source', 'Lead', 'Status', 'Contact ID', 'Time', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.blue}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center' }}>
            <Mail size={32} color={C.label} style={{ display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>No events yet</p>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Use Quick Import above to add your first lead, or configure portal webhooks once deployed.</p>
          </div>
        ) : (
          rows.map((row, idx) => {
            const sm   = STATUS_META[row.ingestion_status]
            const srcm = SOURCE_META[row.source_portal] ?? { bg: C.blueDim, color: C.blue }
            return (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 110px 130px 90px 70px', padding: '13px 20px', borderBottom: idx < rows.length - 1 ? `1px solid ${C.borderDim}` : 'none', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '3px 9px', borderRadius: 6, background: srcm.bg, color: srcm.color, fontSize: 12, fontWeight: 600 }}>
                  {row.source_portal}
                </span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{row.contact_name || '—'}</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: '1px 0 0' }}>{row.contact_phone || row.error_message?.slice(0, 50) || '—'}</p>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '3px 9px', borderRadius: 6, background: sm?.bg, color: sm?.color, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                  {row.ingestion_status}
                </span>
                {row.contact_id ? (
                  <a href={`/dashboard/leads/${row.contact_id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.blue, fontFamily: 'monospace', textDecoration: 'none' }}>
                    {row.contact_id.slice(0, 8)}… <ExternalLink size={10} />
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: C.label }}>—</span>
                )}
                <span style={{ fontSize: 12, color: C.muted }}>{fmtTime(row.created_at)}</span>
                <button onClick={() => setViewing(row)} style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                  View
                </button>
              </div>
            )
          })
        )}
      </div>

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: C.muted }}>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, color: offset === 0 ? C.label : C.text, fontSize: 13, cursor: offset === 0 ? 'default' : 'pointer', opacity: offset === 0 ? 0.5 : 1 }}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.text }}>
              {currentPage} / {totalPages}
            </span>
            <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, color: offset + PAGE_SIZE >= total ? C.label : C.text, fontSize: 13, cursor: offset + PAGE_SIZE >= total ? 'default' : 'pointer', opacity: offset + PAGE_SIZE >= total ? 0.5 : 1 }}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
