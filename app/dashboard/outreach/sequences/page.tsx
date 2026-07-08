'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Trash2, X, Check, Loader2, Play, Pause,
  MessageCircle, Phone, FileText, ChevronDown, ChevronUp,
  Zap, RefreshCw, Sparkles, ArrowRight,
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

type Step = {
  delay_days:   number
  channel:      'whatsapp' | 'call_reminder' | 'note'
  message_body: string
}

type Sequence = {
  id:                 string
  name:               string
  description:        string | null
  active:             boolean
  created_at:         string
  sequence_steps:     (Step & { id: string; step_order: number })[]
  active_enrollments: number
}

const CHANNEL_META = {
  whatsapp:      { label: 'WhatsApp',      icon: MessageCircle, color: C.wa,     bg: 'rgba(37,211,102,0.08)' },
  call_reminder: { label: 'Call Reminder', icon: Phone,         color: '#2563EB', bg: 'rgba(37,99,235,0.08)'  },
  note:          { label: 'Note',          icon: FileText,      color: C.violet,  bg: 'rgba(124,58,237,0.08)' },
}

const DEFAULT_STEPS: Step[] = [
  { delay_days: 0, channel: 'whatsapp',      message_body: 'Hi {{name}}, thank you for your interest! I\'m your dedicated property advisor. Could you share your preferred configuration and budget? I\'ll shortlist the best options in {{city}} for you.' },
  { delay_days: 0, channel: 'call_reminder', message_body: 'Intro call — qualify budget, timeline, and preferred area. Call within 60 minutes.' },
  { delay_days: 2, channel: 'whatsapp',      message_body: 'Hi {{name}}, I\'ve shortlisted 3 properties matching your requirements. These are ready-to-move and within your budget. Want me to share details or schedule a site visit this weekend?' },
  { delay_days: 7, channel: 'call_reminder', message_body: 'Week 1 follow-up call — check interest, push for site visit.' },
]

// ─── WhatsApp Phone Preview ────────────────────────────────────────────────────
function WAPreview({ message }: { message: string }) {
  const preview = message
    .replace(/\{\{name\}\}/g, 'Rahul')
    .replace(/\{\{city\}\}/g, 'Mumbai')
    .replace(/\{\{budget\}\}/g, '₹1.2Cr')

  return (
    <div style={{ background: '#E5DDD5', borderRadius: 12, padding: '10px 8px 8px', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 4px' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.waDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>R</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>Rahul</span>
        <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>10:02 AM</span>
      </div>
      <div style={{ background: '#DCF8C6', borderRadius: '10px 10px 0 10px', padding: '8px 10px', maxWidth: '90%', marginLeft: 'auto', position: 'relative' }}>
        <p style={{ fontSize: 11.5, color: '#0F172A', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, gap: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, color: '#8B9B8B' }}>10:02 AM</span>
          <span style={{ fontSize: 11, color: C.waDark }}>✓✓</span>
        </div>
      </div>
    </div>
  )
}

// ─── Step Row ─────────────────────────────────────────────────────────────────
function StepRow({ step, index, onChange, onDelete }: {
  step: Step; index: number; onChange: (s: Step) => void; onDelete: () => void
}) {
  const meta = CHANNEL_META[step.channel]
  const Icon = meta.icon
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* Step icon */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ width: 14, height: 14, color: meta.color }} />
        </div>
        {index >= 0 && <div style={{ width: 2, height: 12, background: C.border, marginTop: 4 }} />}
      </div>

      <div style={{ flex: 1, background: '#FAFBFC', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 2 }}>
        {/* Controls row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px' }}>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Day</span>
            <input
              type="number" min={0}
              value={step.delay_days}
              onChange={e => onChange({ ...step, delay_days: Number(e.target.value) })}
              style={{ width: 44, border: 'none', fontSize: 12, color: C.text, textAlign: 'center', outline: 'none', background: 'transparent', fontWeight: 700 }}
            />
          </div>

          <select
            value={step.channel}
            onChange={e => onChange({ ...step, channel: e.target.value as Step['channel'] })}
            style={{ padding: '5px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text, background: C.panel, outline: 'none', fontWeight: 600 }}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="call_reminder">Call Reminder</option>
            <option value="note">Note</option>
          </select>

          {step.channel === 'whatsapp' && step.message_body && (
            <button onClick={() => setShowPreview(v => !v)}
              style={{ fontSize: 11, color: C.wa, background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
              {showPreview ? 'Hide preview' : 'Preview'}
            </button>
          )}

          <button onClick={onDelete}
            style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 11, height: 11 }} />
          </button>
        </div>

        {/* Message body — all channels */}
        <textarea
          value={step.message_body}
          onChange={e => onChange({ ...step, message_body: e.target.value })}
          placeholder={
            step.channel === 'whatsapp'
              ? 'Write your WhatsApp message… Use {{name}}, {{city}}, {{budget}} for personalisation'
              : step.channel === 'call_reminder'
              ? 'What to do on this call (e.g. Qualify budget, push for site visit)'
              : 'Internal note for this step'
          }
          rows={step.channel === 'whatsapp' ? 3 : 2}
          style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12.5, color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.55, background: C.panel }}
        />

        {/* Token hint for WhatsApp */}
        {step.channel === 'whatsapp' && (
          <p style={{ fontSize: 10.5, color: C.label, margin: '5px 0 0' }}>
            Use <code style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: 4 }}>{'{{name}}'}</code>{' '}
            <code style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: 4 }}>{'{{city}}'}</code>{' '}
            <code style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: 4 }}>{'{{budget}}'}</code> — replaced per lead
          </p>
        )}

        {/* WhatsApp preview */}
        {step.channel === 'whatsapp' && showPreview && step.message_body && (
          <div style={{ marginTop: 10 }}>
            <WAPreview message={step.message_body} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function SequenceModal({ onSave, onClose, saving }: {
  onSave: (name: string, desc: string, steps: Step[]) => void
  onClose: () => void
  saving: boolean
}) {
  const [name,  setName]  = useState('')
  const [desc,  setDesc]  = useState('')
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS)

  const updateStep = (i: number, s: Step) => setSteps(prev => prev.map((p, idx) => idx === i ? s : p))
  const deleteStep = (i: number)            => setSteps(prev => prev.filter((_, idx) => idx !== i))
  const addStep    = ()                     => setSteps(prev => [...prev, { delay_days: (prev.at(-1)?.delay_days ?? 0) + 1, channel: 'whatsapp', message_body: '' }])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, width: 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>New Sequence</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sequence Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Lead — 7 Day Nurture"
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What is this sequence for?"
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Steps ({steps.length})</span>
            <button onClick={addStep}
              style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus style={{ width: 12, height: 12 }} /> Add Step
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((step, i) => (
              <StepRow key={i} step={step} index={i} onChange={s => updateStep(i, s)} onDelete={() => deleteStep(i)} />
            ))}
          </div>
          {steps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: C.label, fontSize: 13 }}>No steps yet. Add one above.</div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(name, desc, steps)} disabled={saving || !name || steps.length === 0}
            style={{ flex: 1, padding: '10px 0', background: saving || !name || steps.length === 0 ? '#E2E8F0' : 'linear-gradient(135deg,#7C3AED,#5B21B6)', border: 'none', borderRadius: 10, color: saving || !name || steps.length === 0 ? C.label : '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !name || steps.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? 'Saving…' : <><Check style={{ width: 14, height: 14 }} /> Create Sequence</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sequence Card ────────────────────────────────────────────────────────────
function SequenceCard({ seq, onToggle, onDelete }: {
  seq: Sequence; onToggle: () => void; onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const steps = [...(seq.sequence_steps ?? [])].sort((a, b) => a.step_order - b.step_order)

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>

      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Status */}
        <div style={{ width: 38, height: 38, borderRadius: 11, background: seq.active ? 'rgba(5,150,105,0.1)' : 'rgba(100,116,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Zap style={{ width: 16, height: 16, color: seq.active ? C.emerald : C.label }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{seq.name}</p>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: seq.active ? 'rgba(5,150,105,0.1)' : 'rgba(100,116,139,0.08)', color: seq.active ? C.emerald : C.label }}>
              {seq.active ? 'Active' : 'Paused'}
            </span>
          </div>
          {seq.description && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{seq.description}</p>}
        </div>

        <div style={{ display: 'flex', gap: 20, flexShrink: 0, paddingRight: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>{steps.length}</p>
            <p style={{ fontSize: 10, color: C.label, margin: 0 }}>Steps</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: C.violet, margin: 0 }}>{seq.active_enrollments}</p>
            <p style={{ fontSize: 10, color: C.label, margin: 0 }}>Enrolled</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onToggle} title={seq.active ? 'Pause' : 'Resume'}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: seq.active ? C.amber : C.emerald, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {seq.active ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
          </button>
          <button onClick={onDelete}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 style={{ width: 12, height: 12 }} />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {expanded ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
          </button>
        </div>
      </div>

      {/* Step timeline */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, background: '#FAFBFC', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
            {steps.map((step, i) => {
              const meta = CHANNEL_META[step.channel as keyof typeof CHANNEL_META] ?? CHANNEL_META.note
              const Icon = meta.icon
              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center', minWidth: 90 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', border: `1px solid ${meta.color}25` }}>
                      <Icon style={{ width: 16, height: 16, color: meta.color }} />
                    </div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: meta.color, margin: '0 0 2px' }}>{meta.label}</p>
                    <p style={{ fontSize: 10, color: C.label, margin: '0 0 4px' }}>Day {step.delay_days}</p>
                    {step.message_body && (
                      <p style={{ fontSize: 10, color: C.muted, margin: 0, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                        title={step.message_body}>
                        {step.message_body.slice(0, 30)}…
                      </p>
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight style={{ width: 14, height: 14, color: C.border, margin: '0 2px', flexShrink: 0, marginBottom: 20 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SequencesPage() {
  const [sequences,  setSequences]  = useState<Sequence[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showNew,    setShowNew]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [seeding,    setSeeding]    = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteId,   setDeleteId]   = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/outreach/sequences')
      const json = await res.json()
      setSequences(json.data?.sequences ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSeedDemo = async () => {
    setSeeding(true)
    try {
      await fetch('/api/seed/sequences', { method: 'POST' })
      await fetchData()
    } finally { setSeeding(false) }
  }

  const handleCreate = async (name: string, desc: string, steps: Step[]) => {
    setSaving(true)
    try {
      const res = await fetch('/api/outreach/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc, steps }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setShowNew(false)
      fetchData()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleToggle = async (seq: Sequence) => {
    await fetch(`/api/outreach/sequences/${seq.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !seq.active }),
    })
    fetchData()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/outreach/sequences/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    fetchData()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader2 style={{ width: 22, height: 22, color: C.violet, animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, color: C.muted }}>Loading sequences…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Outreach Sequences</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
              {sequences.length} sequence{sequences.length !== 1 ? 's' : ''} · {sequences.reduce((s, q) => s + q.active_enrollments, 0)} active enrollments
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setRefreshing(true); fetchData() }}
              style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}>
              <RefreshCw style={{ width: 15, height: 15, color: C.muted, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button onClick={() => setShowNew(true)}
              style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(124,58,237,0.3)' }}>
              <Plus style={{ width: 14, height: 14 }} /> New Sequence
            </button>
          </div>
        </div>

        {/* How it works */}
        <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.04),rgba(91,33,182,0.06))', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Zap style={{ width: 18, height: 18, color: C.violet, flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.violet, margin: '0 0 4px' }}>How sequences work</p>
            <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.6 }}>
              Enroll any lead from their profile page → the sequence fires steps automatically on the schedule you set. WhatsApp messages are personalised with the lead's name, city, and budget. Call reminders appear as tasks. A lead's sequence pauses automatically when they respond.
            </p>
          </div>
        </div>

        {/* Empty state */}
        {sequences.length === 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(91,33,182,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Zap style={{ width: 28, height: 28, color: C.violet }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>No sequences yet</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Start with 3 pre-built sequences for Indian real estate — new lead nurture, post site-visit follow-up, and cold lead re-engagement.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleSeedDemo} disabled={seeding}
                style={{ padding: '11px 22px', background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', border: 'none', borderRadius: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: seeding ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: seeding ? 0.7 : 1, boxShadow: '0 2px 12px rgba(124,58,237,0.3)' }}>
                {seeding ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
                {seeding ? 'Loading…' : 'Load Demo Sequences'}
              </button>
              <button onClick={() => setShowNew(true)}
                style={{ padding: '11px 22px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Plus style={{ width: 14, height: 14 }} /> Build from Scratch
              </button>
            </div>
          </div>
        )}

        {/* Sequence list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sequences.map(seq => (
            <SequenceCard key={seq.id} seq={seq} onToggle={() => handleToggle(seq)} onDelete={() => setDeleteId(seq.id)} />
          ))}
        </div>
      </div>

      {showNew && <SequenceModal onSave={handleCreate} onClose={() => setShowNew(false)} saving={saving} />}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, padding: 28, width: 360, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 style={{ width: 20, height: 20, color: C.red }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Delete Sequence?</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>All active enrollments will be cancelled. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '10px 0', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: '10px 0', background: C.red, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
