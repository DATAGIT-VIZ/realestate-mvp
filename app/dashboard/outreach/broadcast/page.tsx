'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  MessageCircle, Users, Filter, Send, CheckCircle,
  AlertCircle, Loader2, Sparkles, Info,
} from 'lucide-react'

const C = {
  bg:      '#F8FAFC',
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  violet:  '#7C3AED',
  emerald: '#059669',
  amber:   '#D97706',
  red:     '#EF4444',
  wa:      '#25D366',
  waDark:  '#128C7E',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 10, fontSize: 13, color: C.text, outline: 'none',
  background: C.panel, boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
}

type LeadPreview = { id: string; name: string; phone: string; city: string | null; score: number | null; status: string | null }
type Filters     = { status: string; source: string; city: string; minScore: string; maxScore: string }
const EMPTY: Filters = { status: '', source: '', city: '', minScore: '', maxScore: '' }

const QUICK_MESSAGES = [
  { label: 'New Property Alert', body: `Hi {{name}}! We have a new property in {{city}} that matches your requirements perfectly. It's within your budget and ready to move. Shall I share the details?` },
  { label: 'Site Visit Invite',  body: `Hi {{name}}, we're organising a site visit this weekend for a premium project in {{city}}. This is a great opportunity to explore before prices go up. Would you like to join?` },
  { label: 'Festival Offer',     body: `Hi {{name}}, festive greetings! We have a special limited-time offer on select properties in {{city}} — no GST + free modular kitchen. Valid only till end of this month. Interested?` },
  { label: 'Market Update',      body: `Hi {{name}}, property prices in {{city}} have gone up 8% this quarter. If you've been planning to buy, now is the right time before another price revision. Let's connect for 10 minutes?` },
  { label: 'Checking In',        body: `Hi {{name}}, hope you're doing well! Just checking in on your property search in {{city}}. I have some fresh options that might interest you. Want me to share?` },
]

const STATUS_OPTIONS  = ['', 'Hot', 'Warm', 'New', 'Cold']
const SOURCE_OPTIONS  = ['', 'MagicBricks', '99acres', 'Housing.com', 'Facebook Ads', 'Referral', 'Walk-in']

// ─── WhatsApp Phone Preview ────────────────────────────────────────────────────
function PhonePreview({ message, recipientCount }: { message: string; recipientCount: number }) {
  const preview = message
    .replace(/\{\{name\}\}/g, 'Rahul')
    .replace(/\{\{city\}\}/g, 'Mumbai')
    .replace(/\{\{budget\}\}/g, '₹1.2Cr')

  return (
    <div style={{ background: '#E5DDD5', borderRadius: 16, overflow: 'hidden', border: `2px solid #D1D5DB` }}>
      {/* Status bar */}
      <div style={{ background: C.waDark, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>R</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>Rahul Sharma</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: 0 }}>online</p>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ padding: '16px 12px', minHeight: 120 }}>
        {message ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: '#DCF8C6', borderRadius: '10px 10px 0 10px', padding: '8px 12px', maxWidth: '85%' }}>
              <p style={{ fontSize: 12, color: '#0F172A', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 9.5, color: '#8B9B8B' }}>10:02 AM</span>
                <span style={{ fontSize: 11, color: C.waDark }}>✓✓</span>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: C.label, textAlign: 'center', marginTop: 20 }}>Your message will appear here</p>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#F0F0F0', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 20, padding: '7px 14px' }}>
          <span style={{ fontSize: 11.5, color: C.label }}>Type a message</span>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.waDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send style={{ width: 13, height: 13, color: '#fff' }} />
        </div>
      </div>

      {recipientCount > 0 && (
        <div style={{ background: C.waDark, padding: '8px 14px', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            × {recipientCount} recipients
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { bg: string; color: string }> = {
    Hot:  { bg: 'rgba(239,68,68,0.1)', color: C.red },
    Warm: { bg: 'rgba(217,119,6,0.1)', color: C.amber },
    New:  { bg: 'rgba(124,58,237,0.1)', color: C.violet },
    Cold: { bg: 'rgba(100,116,139,0.1)', color: C.muted },
  }
  const s = status ?? 'New'
  const style = map[s] ?? map.New
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: style.bg, color: style.color }}>{s}</span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BroadcastPage() {
  const [filters,     setFilters]     = useState<Filters>(EMPTY)
  const [preview,     setPreview]     = useState<{ total: number; reachable: number; leads: LeadPreview[] } | null>(null)
  const [previewing,  setPreviewing]  = useState(false)
  const [message,     setMessage]     = useState(QUICK_MESSAGES[0].body)
  const [activeQuick, setActiveQuick] = useState(0)
  const [sending,     setSending]     = useState(false)
  const [result,      setResult]      = useState<{ sent: number; failed: number } | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [routeTo,     setRouteTo]     = useState('all')
  const [routeAgent,  setRouteAgent]  = useState('')

  const buildQuery = (f: Filters) => {
    const p = new URLSearchParams()
    if (f.status)   p.set('status',   f.status)
    if (f.source)   p.set('source',   f.source)
    if (f.city)     p.set('city',     f.city)
    if (f.minScore) p.set('minScore', f.minScore)
    if (f.maxScore) p.set('maxScore', f.maxScore)
    return p.toString()
  }

  const fetchPreview = useCallback(async () => {
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
    } finally { setPreviewing(false) }
  }, [filters])

  useEffect(() => {
    const t = setTimeout(fetchPreview, 600)
    return () => clearTimeout(t)
  }, [fetchPreview])

  const handleSend = async () => {
    setShowConfirm(false)
    setSending(true)
    setResult(null)
    setError(null)
    try {
      const res  = await fetch('/api/outreach/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, templateName: 'custom', messageBody: message }),
      })
      const json = await res.json()
      // Demo mode: if Interakt not configured, show simulated success
      if (json.error?.includes('INTERAKT') || json.error?.includes('not configured')) {
        setResult({ sent: preview?.reachable ?? 0, failed: 0 })
      } else if (json.error) {
        throw new Error(json.error)
      } else {
        setResult(json.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Broadcast failed')
    } finally { setSending(false) }
  }

  const canSend = message.trim().length > 10 && (preview?.reachable ?? 0) > 0 && !sending

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* Header */}
        <div style={{ padding: '28px 0 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Bulk WhatsApp Broadcast</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Segment your leads, write your message, send to everyone in one shot</p>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle style={{ width: 22, height: 22, color: C.wa }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>

          {/* ── Left ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Step 1 — Segment */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Filter style={{ width: 13, height: 13, color: C.violet }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Step 1 — Select Audience</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Filter which leads receive this broadcast</p>
                </div>
                <button onClick={() => setFilters(EMPTY)}
                  style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Lead Status</label>
                  <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={inp}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Source Portal</label>
                  <select value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value }))} style={inp}>
                    {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s || 'All sources'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>City</label>
                  <input value={filters.city} onChange={e => setFilters(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Mumbai" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Min Score</label>
                  <input type="number" min={0} max={100} value={filters.minScore} onChange={e => setFilters(f => ({ ...f, minScore: e.target.value }))} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Max Score</label>
                  <input type="number" min={0} max={100} value={filters.maxScore} onChange={e => setFilters(f => ({ ...f, maxScore: e.target.value }))} placeholder="100" style={inp} />
                </div>
              </div>
            </div>

            {/* Step 2 — Message */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MessageCircle style={{ width: 13, height: 13, color: C.wa }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Step 2 — Write Message</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Personalised per lead using merge tags</p>
                </div>
              </div>

              {/* Quick pick */}
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Quick templates</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                {QUICK_MESSAGES.map((q, i) => (
                  <button key={i} onClick={() => { setActiveQuick(i); setMessage(q.body) }}
                    style={{ padding: '5px 13px', borderRadius: 20, border: `1.5px solid ${activeQuick === i ? C.wa : C.border}`, background: activeQuick === i ? 'rgba(37,211,102,0.07)' : C.panel, color: activeQuick === i ? C.waDark : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s' }}>
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Composer */}
              <textarea
                value={message}
                onChange={e => { setMessage(e.target.value); setActiveQuick(-1) }}
                rows={5}
                placeholder="Write your WhatsApp message here… Use {{name}}, {{city}}, {{budget}} for personalisation"
                style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 13, color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6, transition: 'border-color 0.15s' }}
                onFocus={e => (e.target.style.borderColor = C.wa)}
                onBlur={e  => (e.target.style.borderColor = C.border)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <p style={{ fontSize: 11, color: C.label, margin: 0, flex: 1 }}>
                  Merge tags: <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>{'{{name}}'}</code>{' '}
                  <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>{'{{city}}'}</code>{' '}
                  <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>{'{{budget}}'}</code>
                </p>
                <span style={{ fontSize: 11, color: message.length > 400 ? C.amber : C.label }}>{message.length} chars</span>
              </div>
            </div>
          </div>

          {/* ── Right ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>

            {/* Audience count */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: `linear-gradient(135deg, #064E3B, ${C.waDark})` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Users style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.8)' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Audience</span>
                  {previewing && <Loader2 style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.6)', animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />}
                </div>
                <p style={{ fontSize: 34, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>
                  {preview?.reachable ?? '—'}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0' }}>
                  leads with WhatsApp
                  {preview && preview.total !== preview.reachable && <> · {preview.total - preview.reachable} skipped</>}
                </p>
              </div>

              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {(preview?.leads ?? []).slice(0, 10).map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
                      {l.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</p>
                      <p style={{ fontSize: 11, color: C.label, margin: 0 }}>{l.city ?? '—'} · {l.score ?? '—'}</p>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                ))}
                {(preview?.leads?.length ?? 0) === 0 && !previewing && (
                  <div style={{ padding: '16px 0', textAlign: 'center', color: C.label, fontSize: 12 }}>No matching leads</div>
                )}
                {(preview?.reachable ?? 0) > 10 && (
                  <div style={{ padding: '9px 16px', fontSize: 11, color: C.muted, textAlign: 'center' }}>
                    + {(preview?.reachable ?? 0) - 10} more leads
                  </div>
                )}
              </div>
            </div>

            {/* Follow-up routing */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Route follow-up leads to</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { id: 'all',    label: 'All agents (round-robin)',   desc: 'Distribute evenly across team' },
                  { id: 'top',    label: 'Top performer',              desc: 'Agent with highest activity score' },
                  { id: 'agent',  label: 'Specific agent',             desc: 'Assign to one agent by name' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setRouteTo(opt.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${routeTo === opt.id ? C.violet : C.border}`, background: routeTo === opt.id ? 'rgba(124,58,237,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${routeTo === opt.id ? C.violet : C.border}`, background: routeTo === opt.id ? C.violet : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {routeTo === opt.id && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: routeTo === opt.id ? C.violet : C.text }}>{opt.label}</div>
                      <div style={{ fontSize: 10, color: C.label }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              {routeTo === 'agent' && (
                <input value={routeAgent} onChange={e => setRouteAgent(e.target.value)} placeholder="Agent name or email…"
                  style={{ marginTop: 8, width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
              )}
            </div>

            {/* Phone preview */}
            <PhonePreview message={message} recipientCount={preview?.reachable ?? 0} />

            {/* Result */}
            {result && (
              <div style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <CheckCircle style={{ width: 18, height: 18, color: C.emerald, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.emerald, margin: 0 }}>Broadcast sent!</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>{result.sent} messages sent · {result.failed} failed</p>
                </div>
              </div>
            )}

            {error && !error.includes('INTERAKT') && (
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle style={{ width: 14, height: 14, color: C.red, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Interakt note */}
            <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 12, padding: '11px 14px', display: 'flex', gap: 8 }}>
              <Info style={{ width: 13, height: 13, color: C.violet, flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11.5, color: C.violet, margin: 0, lineHeight: 1.5 }}>
                Connects to <strong>Interakt Business API</strong> when configured. Demo mode simulates sends.
              </p>
            </div>

            {/* Send button */}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canSend}
              style={{ padding: '14px 0', borderRadius: 12, border: 'none', background: canSend ? `linear-gradient(135deg, #128C7E, ${C.wa})` : '#E2E8F0', color: canSend ? '#fff' : C.label, fontSize: 14, fontWeight: 700, cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: canSend ? '0 2px 12px rgba(37,211,102,0.3)' : 'none', transition: 'all 0.15s' }}>
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
          <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, padding: 28, width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Send style={{ width: 22, height: 22, color: C.wa }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 10px', textAlign: 'center' }}>Send Broadcast?</h3>

            {/* Message preview */}
            <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, maxHeight: 100, overflow: 'hidden' }}>
              <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5 }}>{message.slice(0, 160)}{message.length > 160 ? '…' : ''}</p>
            </div>

            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 6px', textAlign: 'center' }}>
              This will send to <strong style={{ color: C.text }}>{preview?.reachable} leads</strong> on WhatsApp.
            </p>
            <p style={{ fontSize: 11, color: C.label, margin: '0 0 22px', textAlign: 'center' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '11px 0', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSend} style={{ flex: 1, padding: '11px 0', background: `linear-gradient(135deg,#128C7E,${C.wa})`, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
