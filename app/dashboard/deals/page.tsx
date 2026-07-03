'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, ChevronRight, ChevronLeft, Trash2,
  IndianRupee, MapPin, Home, Phone, Calendar,
  TrendingUp, Handshake, Trophy, XCircle, Loader2, User
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
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
}

// ─── Stage config ──────────────────────────────────────────────────────────
const STAGES = [
  { id: 'new',         label: 'New Lead',      color: C.label,   bg: '#F8FAFC', icon: '🔵' },
  { id: 'site_visit',  label: 'Site Visit',    color: C.blue,    bg: '#EFF6FF', icon: '🏠' },
  { id: 'negotiation', label: 'Negotiation',   color: C.amber,   bg: '#FFFBEB', icon: '💬' },
  { id: 'token_paid',  label: 'Token Paid',    color: C.violet,  bg: '#F5F3FF', icon: '🏷' },
  { id: 'won',         label: 'Closed Won',    color: C.emerald, bg: '#F0FDF4', icon: '🏆' },
  { id: 'lost',        label: 'Closed Lost',   color: C.red,     bg: '#FFF1F2', icon: '❌' },
] as const

type StageId = typeof STAGES[number]['id']

const STAGE_ORDER: StageId[] = ['new', 'site_visit', 'negotiation', 'token_paid', 'won', 'lost']

const PROP_TYPES = ['1BHK', '2BHK', '3BHK', '4BHK+', 'Villa', 'Plot', 'Commercial', 'Other']
const PORTALS    = ['MagicBricks', '99acres', 'Housing.com', 'Facebook Ads', 'Referral', 'Walk-in', 'Other']
const LOST_REASONS = ['Budget mismatch', 'Location issue', 'Competitor', 'Not serious', 'Property sold', 'No response', 'Other']

// ─── Types ────────────────────────────────────────────────────────────────────
interface Deal {
  id:             string
  lead_name:      string
  lead_phone?:    string
  property_name?: string
  property_type?: string
  locality?:      string
  city?:          string
  deal_value?:    number
  stage:          StageId
  assigned_to?:   string
  expected_close?: string
  source_portal?:  string
  notes?:          string
  lost_reason?:    string
  created_at:      string
  updated_at:      string
}

type DealForm = Omit<Deal, 'id' | 'created_at' | 'updated_at'>

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n?: number) {
  if (!n) return '—'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

function stageOf(id: StageId) {
  return STAGES.find(s => s.id === id) ?? STAGES[0]
}

const BLANK_FORM: DealForm = {
  lead_name: '', lead_phone: '', property_name: '', property_type: '',
  locality: '', city: '', deal_value: undefined, stage: 'new',
  assigned_to: '', expected_close: '', source_portal: '', notes: '', lost_reason: '',
}

// ─── Deal Card ────────────────────────────────────────────────────────────────
function DealCard({
  deal,
  onMove,
  onEdit,
  onDelete,
}: {
  deal: Deal
  onMove: (id: string, dir: 'prev' | 'next') => void
  onEdit: (deal: Deal) => void
  onDelete: (id: string) => void
}) {
  const stageIdx = STAGE_ORDER.indexOf(deal.stage)
  const canPrev  = stageIdx > 0
  const canNext  = stageIdx < STAGE_ORDER.length - 1
  const stage    = stageOf(deal.stage)

  return (
    <div
      onClick={() => onEdit(deal)}
      style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '14px 14px 12px',
        cursor: 'pointer', marginBottom: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
    >
      {/* Lead name + value */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1, lineHeight: 1.3 }}>{deal.lead_name}</span>
        {deal.deal_value ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: stage.color, marginLeft: 8, whiteSpace: 'nowrap' }}>{fmt(deal.deal_value)}</span>
        ) : null}
      </div>

      {/* Property */}
      {(deal.property_type || deal.locality) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <Home style={{ width: 11, height: 11, color: C.label }} />
          <span style={{ fontSize: 12, color: C.muted }}>
            {[deal.property_type, deal.locality, deal.city].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}

      {/* Phone */}
      {deal.lead_phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <Phone style={{ width: 11, height: 11, color: C.label }} />
          <span style={{ fontSize: 12, color: C.muted }}>{deal.lead_phone}</span>
        </div>
      )}

      {/* Expected close */}
      {deal.expected_close && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <Calendar style={{ width: 11, height: 11, color: C.label }} />
          <span style={{ fontSize: 12, color: C.muted }}>
            {new Date(deal.expected_close).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
          </span>
        </div>
      )}

      {/* Source */}
      {deal.source_portal && (
        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, background: '#EFF6FF', color: C.blue, borderRadius: 6, padding: '2px 7px', marginTop: 4 }}>
          {deal.source_portal}
        </span>
      )}

      {/* Actions */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}
      >
        <button
          disabled={!canPrev}
          onClick={() => onMove(deal.id, 'prev')}
          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${C.border}`, background: canPrev ? '#F8FAFC' : '#F1F5F9', color: canPrev ? C.muted : C.label, cursor: canPrev ? 'pointer' : 'not-allowed' }}
        >
          <ChevronLeft style={{ width: 11, height: 11 }} /> Back
        </button>
        <button
          disabled={!canNext}
          onClick={() => onMove(deal.id, 'next')}
          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${C.blue}`, background: canNext ? '#EFF6FF' : '#F1F5F9', color: canNext ? C.blue : C.label, cursor: canNext ? 'pointer' : 'not-allowed', flex: 1, justifyContent: 'center' }}
        >
          Move forward <ChevronRight style={{ width: 11, height: 11 }} />
        </button>
        <button
          onClick={() => onDelete(deal.id)}
          style={{ display: 'flex', padding: '4px 6px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#FFF1F2', color: C.red, cursor: 'pointer' }}
        >
          <Trash2 style={{ width: 11, height: 11 }} />
        </button>
      </div>
    </div>
  )
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
function DealModal({
  deal,
  onClose,
  onSave,
}: {
  deal: Deal | null
  onClose: () => void
  onSave: (data: DealForm) => Promise<void>
}) {
  const [form,    setForm]    = useState<DealForm>(deal ? { ...deal } : { ...BLANK_FORM })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const set = (k: keyof DealForm, v: string | number | undefined) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.lead_name.trim()) { setError('Lead name is required'); return }
    setSaving(true)
    try {
      await onSave({ ...form, deal_value: form.deal_value ? Number(form.deal_value) : undefined })
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`,
    borderRadius: 9, fontSize: 13, color: C.text, outline: 'none',
    background: '#FAFBFC', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block',
  }
  const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.panel, borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>
            {deal ? 'Edit Deal' : 'Add New Deal'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X style={{ width: 20, height: 20 }} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Lead info */}
          <div style={row}>
            <div>
              <label style={lbl}>Lead Name *</label>
              <input style={inp} value={form.lead_name} onChange={e => set('lead_name', e.target.value)} placeholder="Rahul Sharma" />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input style={inp} value={form.lead_phone ?? ''} onChange={e => set('lead_phone', e.target.value)} placeholder="9876543210" />
            </div>
          </div>

          {/* Property */}
          <div style={row}>
            <div>
              <label style={lbl}>Property Type</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.property_type ?? ''} onChange={e => set('property_type', e.target.value)}>
                <option value="">Select type</option>
                {PROP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Deal Value (₹)</label>
              <input style={inp} type="number" value={form.deal_value ?? ''} onChange={e => set('deal_value', e.target.value ? Number(e.target.value) : undefined)} placeholder="2500000" />
            </div>
          </div>

          {/* Location */}
          <div style={row}>
            <div>
              <label style={lbl}>Locality</label>
              <input style={inp} value={form.locality ?? ''} onChange={e => set('locality', e.target.value)} placeholder="Bandra" />
            </div>
            <div>
              <label style={lbl}>City</label>
              <input style={inp} value={form.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="Mumbai" />
            </div>
          </div>

          {/* Property name + source */}
          <div style={row}>
            <div>
              <label style={lbl}>Property / Project</label>
              <input style={inp} value={form.property_name ?? ''} onChange={e => set('property_name', e.target.value)} placeholder="Lodha Palava" />
            </div>
            <div>
              <label style={lbl}>Source Portal</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.source_portal ?? ''} onChange={e => set('source_portal', e.target.value)}>
                <option value="">Select portal</option>
                {PORTALS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Stage + assigned */}
          <div style={row}>
            <div>
              <label style={lbl}>Stage</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.stage} onChange={e => set('stage', e.target.value as StageId)}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Expected Close</label>
              <input style={inp} type="date" value={form.expected_close ?? ''} onChange={e => set('expected_close', e.target.value)} />
            </div>
          </div>

          {/* Assigned agent */}
          <div>
            <label style={lbl}>Assigned Agent</label>
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.label }} />
              <input style={{ ...inp, paddingLeft: 32 }} value={form.assigned_to ?? ''} onChange={e => set('assigned_to', e.target.value)} placeholder="Agent name" />
            </div>
          </div>

          {/* Lost reason (only if lost) */}
          {form.stage === 'lost' && (
            <div>
              <label style={lbl}>Lost Reason</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.lost_reason ?? ''} onChange={e => set('lost_reason', e.target.value)}>
                <option value="">Select reason</option>
                {LOST_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Site visit done, waiting for bank loan approval..." />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 9, padding: '9px 12px', fontSize: 13, color: C.red }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px 0', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, color: C.muted, background: '#F8FAFC', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px 0', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#fff', background: saving ? '#E2E8F0' : C.blue, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              {saving ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> Saving…</> : (deal ? 'Save Changes' : 'Add Deal')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DealsPage() {
  const [deals,       setDeals]       = useState<Deal[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modalDeal,   setModalDeal]   = useState<Deal | 'new' | null>(null)
  const [deleteConf,  setDeleteConf]  = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/deals')
      const j = await r.json()
      setDeals(j.deals ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: DealForm) => {
    if (modalDeal && modalDeal !== 'new') {
      const r = await fetch(`/api/deals/${(modalDeal as Deal).id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Update failed')
    } else {
      const r = await fetch('/api/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Create failed')
    }
    await load()
  }

  const handleMove = async (id: string, dir: 'prev' | 'next') => {
    const deal = deals.find(d => d.id === id)
    if (!deal) return
    const idx    = STAGE_ORDER.indexOf(deal.stage)
    const newIdx = dir === 'next' ? idx + 1 : idx - 1
    if (newIdx < 0 || newIdx >= STAGE_ORDER.length) return

    setDeals(ds => ds.map(d => d.id === id ? { ...d, stage: STAGE_ORDER[newIdx] } : d))
    await fetch(`/api/deals/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: STAGE_ORDER[newIdx] }),
    })
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/deals/${id}`, { method: 'DELETE' })
    setDeals(ds => ds.filter(d => d.id !== id))
    setDeleteConf(null)
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  const activeDeals  = deals.filter(d => d.stage !== 'lost')
  const wonDeals     = deals.filter(d => d.stage === 'won')
  const pipelineVal  = activeDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const wonVal       = wonDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const totalClosed  = deals.filter(d => d.stage === 'won' || d.stage === 'lost').length
  const winRate      = totalClosed ? Math.round((wonDeals.length / totalClosed) * 100) : 0
  const avgDeal      = wonDeals.length ? Math.round(wonVal / wonDeals.length) : 0

  const stats = [
    { label: 'Pipeline Value',  value: fmt(pipelineVal), icon: <TrendingUp style={{ width: 16, height: 16 }} />, color: C.blue },
    { label: 'Active Deals',    value: String(activeDeals.filter(d => d.stage !== 'new').length), icon: <Handshake style={{ width: 16, height: 16 }} />, color: C.violet },
    { label: 'Win Rate',        value: `${winRate}%`,    icon: <Trophy style={{ width: 16, height: 16 }} />,    color: C.emerald },
    { label: 'Avg Deal Size',   value: fmt(avgDeal),     icon: <IndianRupee style={{ width: 16, height: 16 }} />, color: C.amber },
  ]

  return (
    <div style={{ padding: '28px 28px 40px', minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Deals Pipeline</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Track every deal from site visit to registration</p>
        </div>
        <button
          onClick={() => setModalDeal('new')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: C.blue, border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
        >
          <Plus style={{ width: 15, height: 15 }} /> Add Deal
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: C.muted }}>
          <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} /> Loading deals…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, overflowX: 'auto' }}>
          {STAGES.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.id)
            const stageVal   = stageDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0)

            return (
              <div key={stage.id} style={{ minWidth: 220 }}>
                {/* Column header */}
                <div style={{ background: stage.bg, border: `1px solid ${stage.color}30`, borderRadius: 14, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{stage.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: stage.color }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, background: `${stage.color}20`, color: stage.color, borderRadius: 20, padding: '2px 8px' }}>
                      {stageDeals.length}
                    </span>
                  </div>
                  {stageVal > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: stage.color, marginTop: 4 }}>{fmt(stageVal)}</div>
                  )}
                </div>

                {/* Cards */}
                <div style={{ minHeight: 100 }}>
                  {stageDeals.length === 0 ? (
                    <div style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: '20px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12, color: C.label }}>No deals</span>
                    </div>
                  ) : (
                    stageDeals.map(deal => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onMove={handleMove}
                        onEdit={setModalDeal}
                        onDelete={id => setDeleteConf(id)}
                      />
                    ))
                  )}

                  {/* Quick add button */}
                  <button
                    onClick={() => setModalDeal('new')}
                    style={{ width: '100%', padding: '8px 0', border: `1px dashed ${C.border}`, borderRadius: 10, background: 'transparent', color: C.label, fontSize: 12, cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Plus style={{ width: 12, height: 12 }} /> Add deal
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {modalDeal !== null && (
        <DealModal
          deal={modalDeal === 'new' ? null : modalDeal as Deal}
          onClose={() => setModalDeal(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation */}
      {deleteConf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: C.panel, borderRadius: 18, padding: 28, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle style={{ width: 22, height: 22, color: C.red }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Delete deal?</div>
                <div style={{ fontSize: 13, color: C.muted }}>This action cannot be undone.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConf(null)} style={{ flex: 1, padding: '10px 0', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: C.muted, background: '#F8FAFC', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConf)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: C.red, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
