'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  MessageCircle, Users, Filter, Send, CheckCircle,
  AlertCircle, Loader2, RefreshCw, X, ChevronDown,
  Zap, Info,
} from 'lucide-react'

const C = {
  bg:      '#F8FAFC',
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  blue:    '#2563EB',
  emerald: '#059669',
  amber:   '#D97706',
  red:     '#EF4444',
  violet:  '#7C3AED',
  wa:      '#25D366',
}

const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 10, fontSize: 13, color: C.text, outline: 'none',
  background: C.panel, boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
}

type LeadPreview = { id: string; name: string; phone: string; city: string | null; score: number | null; status: string | null }
type Filters     = { status: string; source: string; city: string; minScore: string; maxScore: string; propType: string }

const EMPTY_FILTERS: Filters = { status: '', source: '', city: '', minScore: '', maxScore: '', propType: '' }

const STATUS_OPTIONS  = ['', 'Hot', 'Warm', 'New', 'Cold', 'Closed']
const SOURCE_OPTIONS  = ['', 'MagicBricks', '99acres', 'Housing.com', 'Referral', 'Website', 'Facebook Ads', 'Instagram', 'Walk-in']
const PROPTYPE_OPTIONS = ['', '1BHK Apartment', '2BHK Apartment', '3BHK Apartment', 'Villa', 'Studio', 'Penthouse', 'Plot']

const RESULT_TEMPLATES = [
  { name: 'welcome_lead',      label: 'Welcome / First Touch',   desc: 'Send when lead first enters CRM' },
  { name: 'property_update',   label: 'New Property Alert',       desc: 'Notify about matching properties' },
  { name: 'site_visit_invite', label: 'Site Visit Invite',        desc: 'Invite leads for a site visit' },
  { name: 'follow_up',         label: 'General Follow-up',        desc: 'Re-engage warm/cold leads' },
  { name: 'offer_alert',       label: 'Limited Offer / Discount', desc: 'Share a time-sensitive offer' },
]

function FilterRow({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const sel = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
      {/* Status */}
      <div>
        <label style={label}>Lead Status</label>
        <select value={filters.status} onChange={e => sel('status', e.target.value)} style={input}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
      </div>

      {/* Source */}
      <div>
        <label style={label}>Source Portal</label>
        <select value={filters.source} onChange={e => sel('source', e.target.value)} style={input}>
          {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s || 'All sources'}</option>)}
        </select>
      </div>

      {/* City */}
      <div>
        <label style={label}>City</label>
        <input value={filters.city} onChange={e => sel('city', e.target.value)} placeholder="e.g. Mumbai" style={input} />
      </div>

      {/* Score range */}
      <div>
        <label style={label}>Min Intent Score</label>
        <input type="number" min={0} max={100} value={filters.minScore} onChange={e => sel('minScore', e.target.value)} placeholder="0" style={input} />
      </div>
      <div>
        <label style={label}>Max Intent Score</label>
        <input type="number" min={0} max={100} value={filters.maxScore} onChange={e => sel('maxScore', e.target.value)} placeholder="100" style={input} />
      </div>

      {/* Property type */}
      <div>
        <label style={label}>Property Type</label>
        <select value={filters.propType} onChange={e => sel('propType', e.target.value)} style={input}>
          {PROPTYPE_OPTIONS.map(s => <option key={s} value={s}>{s || 'All types'}</option>)}
        </select>
      </div>
    </div>
  )
}

// Status badge
function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { bg: string; color: string }> = {
    Hot:    { bg: 'rgba(239,68,68,0.1)',    color: C.red     },
    Warm:   { bg: 'rgba(217,119,6,0.1)',    color: C.amber   },
    New:    { bg: 'rgba(37,99,235,0.1)',    color: C.blue    },
    Cold:   { bg: 'rgba(100,116,139,0.1)',  color: C.muted   },
    Closed: { bg: 'rgba(5,150,105,0.1)',    color: C.emerald },
  }
  const s = status ?? 'New'
  const style = map[s] ?? map.New
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: style.bg, color: style.color }}>
      {s}
    </span>
  )
}

export default function BroadcastPage() {
  const [filters,      setFilters]      = useState<Filters>(EMPTY_FILTERS)
  const [preview,      setPreview]      = useState<{ total: number; reachable: number; leads: LeadPreview[] } | null>(null)
  const [previewing,   setPreviewing]   = useState(false)
  const [template,     setTemplate]     = useState(RESULT_TEMPLATES[0])
  const [customName,   setCustomName]   = useState('')
  const [useCustom,    setUseCustom]    = useState(false)
  const [bodyParam1,   setBodyParam1]   = useState('{{name}}')
  const [bodyParam2,   setBodyParam2]   = useState('')
  const [sending,      setSending]      = useState(false)
  const [result,       setResult]       = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [showConfirm,  setShowConfirm]  = useState(false)

  const buildQuery = (f: Filters) => {
    const p = new URLSearchParams()
    if (f.status)   p.set('status',   f.status)
    if (f.source)   p.set('source',   f.source)
    if (f.city)     p.set('city',     f.city)
    if (f.minScore) p.set('minScore', f.minScore)
    if (f.maxScore) p.set('maxScore', f.maxScore)
    if (f.propType) p.set('propType', f.propType)
    return p.toString()
  }

  const handlePreview = useCallback(async () => {
    setPreviewing(true)
    setResult(null)
    setError(null)
    try {
      const res  = await fetch(`/api/outreach/broadcast?${buildQuery(filters)}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPreview(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }, [filters])

  // Auto-preview on filter change (debounced)
  useEffect(() => {
    const t = setTimeout(handlePreview, 600)
    return () => clearTimeout(t)
  }, [handlePreview])

  const handleSend = async () => {
    setShowConfirm(false)
    setSending(true)
    setResult(null)
    setError(null)
    const tplName = useCustom ? customName : template.name
    const params  = [bodyParam1, bodyParam2].filter(Boolean)
    try {
      const res  = await fetch('/api/outreach/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, templateName: tplName, bodyParams: params }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResult(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Broadcast failed')
    } finally {
      setSending(false)
    }
  }

  const activeTplName = useCustom ? customName : template.name
  const canSend = activeTplName && (preview?.reachable ?? 0) > 0 && !sending

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* Header */}
        <div style={{ padding: '28px 0 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Bulk WhatsApp Broadcast</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Segment your leads and send a WhatsApp template in one shot</p>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle style={{ width: 22, height: 22, color: C.wa }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

          {/* ── Left Column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Step 1 — Segment */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Filter style={{ width: 13, height: 13, color: C.blue }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Step 1 — Segment</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Filter which leads receive this broadcast</p>
                </div>
                <button onClick={() => { setFilters(EMPTY_FILTERS) }}
                  style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear
                </button>
              </div>

              <FilterRow filters={filters} onChange={setFilters} />
            </div>

            {/* Step 2 — Template */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MessageCircle style={{ width: 13, height: 13, color: C.wa }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Step 2 — Template</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Select an approved WhatsApp template</p>
                </div>
              </div>

              {/* Preset templates */}
              {!useCustom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {RESULT_TEMPLATES.map(t => {
                    const isActive = template.name === t.name
                    return (
                      <button key={t.name} onClick={() => setTemplate(t)}
                        style={{ padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${isActive ? C.wa : C.border}`, background: isActive ? 'rgba(37,211,102,0.04)' : C.panel, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{t.label}</p>
                          <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{t.name} · {t.desc}</p>
                        </div>
                        {isActive && <CheckCircle style={{ width: 16, height: 16, color: C.wa, flexShrink: 0 }} />}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Custom template toggle */}
              <button onClick={() => setUseCustom(v => !v)}
                style={{ fontSize: 12, color: C.blue, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginBottom: useCustom ? 12 : 0 }}>
                {useCustom ? '← Back to presets' : 'Use custom template name →'}
              </button>

              {useCustom && (
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Custom Template Name (exact Interakt name)</label>
                  <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. monsoon_offer_2026" style={input} />
                </div>
              )}

              {/* Body params */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 10px' }}>Body Variables <span style={{ color: C.label, fontWeight: 400 }}>(optional)</span></p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>{'{{1}}'} Value</label>
                    <input value={bodyParam1} onChange={e => setBodyParam1(e.target.value)} placeholder="e.g. {{name}}" style={input} />
                  </div>
                  <div>
                    <label style={label}>{'{{2}}'} Value</label>
                    <input value={bodyParam2} onChange={e => setBodyParam2(e.target.value)} placeholder="e.g. {{city}}" style={input} />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: C.label, margin: '8px 0 0' }}>
                  Tokens: <code>{'{{name}}'}</code> <code>{'{{city}}'}</code> <code>{'{{budget}}'}</code> — replaced per lead
                </p>
              </div>
            </div>
          </div>

          {/* ── Right Column — Preview + Send ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>

            {/* Audience card */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #064E3B 0%, #059669 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <Users style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.8)' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Audience</span>
                  {previewing && <Loader2 style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.6)', animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />}
                </div>
                <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>
                  {preview?.reachable ?? '—'}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0' }}>
                  leads with a valid WhatsApp number
                  {preview && preview.total !== preview.reachable && (
                    <> · {preview.total - preview.reachable} skipped (no phone)</>
                  )}
                </p>
              </div>

              {/* Lead list preview */}
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {(preview?.leads ?? []).slice(0, 12).map((l, i) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
                      {l.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</p>
                      <p style={{ fontSize: 11, color: C.label, margin: 0 }}>{l.city ?? 'Unknown city'} · Score {l.score ?? '—'}</p>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                ))}
                {(preview?.leads?.length ?? 0) === 0 && !previewing && (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: C.label, fontSize: 12 }}>No matching leads</div>
                )}
                {(preview?.reachable ?? 0) > 12 && (
                  <div style={{ padding: '10px 16px', fontSize: 11, color: C.muted, textAlign: 'center' }}>
                    + {(preview?.reachable ?? 0) - 12} more leads
                  </div>
                )}
              </div>
            </div>

            {/* Template preview pill */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageCircle style={{ width: 14, height: 14, color: C.wa }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, color: C.label, margin: 0 }}>Template</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeTplName || <span style={{ color: C.label }}>Not selected</span>}
                </p>
              </div>
            </div>

            {/* Interakt not configured warning */}
            <div style={{ background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 8 }}>
              <Info style={{ width: 14, height: 14, color: C.amber, flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: C.amber, margin: 0, lineHeight: 1.5 }}>
                Requires <strong>INTERAKT_API_KEY</strong> in .env.local. Messages send via Interakt Business API — template must be approved in Meta.
              </p>
            </div>

            {/* Result */}
            {result && (
              <div style={{ background: 'rgba(5,150,105,0.05)', border: `1px solid rgba(5,150,105,0.2)`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <CheckCircle style={{ width: 18, height: 18, color: C.emerald, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.emerald, margin: 0 }}>Broadcast sent!</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>{result.sent} sent · {result.failed} failed · {result.total} total</p>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.05)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle style={{ width: 14, height: 14, color: C.red, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Send button */}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canSend}
              style={{
                padding: '14px 0', borderRadius: 12, border: 'none',
                background: canSend ? C.wa : '#E2E8F0',
                color: canSend ? '#fff' : C.label,
                fontSize: 14, fontWeight: 700, cursor: canSend ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {sending
                ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Sending…</>
                : <><Send style={{ width: 16, height: 16 }} /> Send to {preview?.reachable ?? 0} Leads</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setShowConfirm(false)}>
          <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, padding: 28, width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Send style={{ width: 22, height: 22, color: C.wa }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Send Broadcast?</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 6px' }}>
              This will send the <strong>{activeTplName}</strong> template to <strong>{preview?.reachable} leads</strong> on WhatsApp.
            </p>
            <p style={{ fontSize: 12, color: C.label, margin: '0 0 24px' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '11px 0', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSend} style={{ flex: 1, padding: '11px 0', background: C.wa, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
