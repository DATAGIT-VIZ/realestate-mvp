'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Trash2, X, Check, Loader2, Play, Pause,
  MessageCircle, Phone, FileText, ChevronDown, ChevronUp,
  Users, Zap, RefreshCw, GripVertical,
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

type Step = {
  delay_days:    number
  channel:       'whatsapp' | 'call_reminder' | 'note'
  template_name?: string
  message_body?: string
}

type Sequence = {
  id:                  string
  name:                string
  description:         string | null
  active:              boolean
  created_at:          string
  sequence_steps:      (Step & { id: string; step_order: number })[]
  active_enrollments:  number
}

const CHANNEL_META = {
  whatsapp:      { label: 'WhatsApp',      icon: MessageCircle, color: C.wa,      bg: 'rgba(37,211,102,0.08)'  },
  call_reminder: { label: 'Call Reminder', icon: Phone,         color: C.blue,    bg: 'rgba(37,99,235,0.08)'   },
  note:          { label: 'Note',          icon: FileText,      color: C.violet,  bg: 'rgba(124,58,237,0.08)'  },
}

const DEFAULT_STEPS: Step[] = [
  { delay_days: 0, channel: 'whatsapp',      template_name: 'welcome_lead'   },
  { delay_days: 1, channel: 'call_reminder', message_body:  'Follow-up call' },
  { delay_days: 3, channel: 'whatsapp',      template_name: 'property_update' },
  { delay_days: 7, channel: 'call_reminder', message_body:  'Week-1 check-in call' },
]

// ─── Step Builder ──────────────────────────────────────────────────────────────
function StepRow({ step, index, onChange, onDelete }: {
  step:     Step
  index:    number
  onChange: (s: Step) => void
  onDelete: () => void
}) {
  const meta = CHANNEL_META[step.channel]
  const Icon = meta.icon

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {/* connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ width: 14, height: 14, color: meta.color }} />
        </div>
      </div>

      <div style={{ flex: 1, background: '#FAFAFA', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          {/* Day offset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Day</span>
            <input
              type="number" min={0}
              value={step.delay_days}
              onChange={e => onChange({ ...step, delay_days: Number(e.target.value) })}
              style={{ width: 52, padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.text, textAlign: 'center', outline: 'none' }}
            />
          </div>

          {/* Channel */}
          <select
            value={step.channel}
            onChange={e => onChange({ ...step, channel: e.target.value as Step['channel'] })}
            style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.text, background: C.panel, outline: 'none' }}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="call_reminder">Call Reminder</option>
            <option value="note">Note</option>
          </select>

          <button onClick={onDelete}
            style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 7, border: `1px solid rgba(239,68,68,0.2)`, background: 'rgba(239,68,68,0.05)', color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 11, height: 11 }} />
          </button>
        </div>

        {step.channel === 'whatsapp' && (
          <input
            value={step.template_name ?? ''}
            onChange={e => onChange({ ...step, template_name: e.target.value })}
            placeholder="Interakt template name (e.g. welcome_lead)"
            style={{ width: '100%', padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.text, outline: 'none', boxSizing: 'border-box' }}
          />
        )}
        {(step.channel === 'call_reminder' || step.channel === 'note') && (
          <input
            value={step.message_body ?? ''}
            onChange={e => onChange({ ...step, message_body: e.target.value })}
            placeholder={step.channel === 'call_reminder' ? 'Reminder label (e.g. Follow-up call)' : 'Note content'}
            style={{ width: '100%', padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.text, outline: 'none', boxSizing: 'border-box' }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────
function SequenceModal({ onSave, onClose, saving }: {
  onSave:  (name: string, desc: string, steps: Step[]) => void
  onClose: () => void
  saving:  boolean
}) {
  const [name,  setName]  = useState('')
  const [desc,  setDesc]  = useState('')
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS)

  const updateStep = (i: number, s: Step) => setSteps(prev => prev.map((p, idx) => idx === i ? s : p))
  const deleteStep = (i: number)            => setSteps(prev => prev.filter((_, idx) => idx !== i))
  const addStep    = ()                     => setSteps(prev => [...prev, { delay_days: (prev.at(-1)?.delay_days ?? 0) + 1, channel: 'whatsapp' }])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, width: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>New Sequence</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sequence Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Lead Nurture — 7 Day"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What is this sequence for?"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Steps ({steps.length})</span>
            <button onClick={addStep}
              style={{ padding: '5px 12px', background: C.blue, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus style={{ width: 12, height: 12 }} /> Add Step
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step, i) => (
              <StepRow key={i} step={step} index={i} onChange={s => updateStep(i, s)} onDelete={() => deleteStep(i)} />
            ))}
          </div>

          {steps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: C.label, fontSize: 13 }}>No steps yet. Add one above.</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(name, desc, steps)} disabled={saving || !name || steps.length === 0}
            style={{ flex: 1, padding: '10px 0', background: saving || !name || steps.length === 0 ? '#E2E8F0' : C.blue, border: 'none', borderRadius: 10, color: saving || !name || steps.length === 0 ? C.label : '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !name || steps.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? 'Saving…' : <><Check style={{ width: 14, height: 14 }} /> Create Sequence</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sequence Card ────────────────────────────────────────────────────────────
function SequenceCard({ seq, onToggle, onDelete, onRefresh }: {
  seq:       Sequence
  onToggle:  () => void
  onDelete:  () => void
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const steps = [...(seq.sequence_steps ?? [])].sort((a, b) => a.step_order - b.step_order)

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Status dot */}
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: seq.active ? C.emerald : C.label, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 3px' }}>{seq.name}</p>
          {seq.description && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{seq.description}</p>}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{steps.length}</p>
            <p style={{ fontSize: 10, color: C.label, margin: 0 }}>Steps</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.blue, margin: 0 }}>{seq.active_enrollments}</p>
            <p style={{ fontSize: 10, color: C.label, margin: 0 }}>Active</p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onToggle} title={seq.active ? 'Pause' : 'Resume'}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: seq.active ? C.amber : C.emerald, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {seq.active ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
          </button>
          <button onClick={onDelete}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid rgba(239,68,68,0.2)`, background: 'rgba(239,68,68,0.05)', color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 style={{ width: 12, height: 12 }} />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {expanded ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
          </button>
        </div>
      </div>

      {/* Step preview */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 20px', background: '#FAFAFA' }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {steps.map((step, i) => {
              const meta = CHANNEL_META[step.channel as keyof typeof CHANNEL_META] ?? CHANNEL_META.note
              const Icon = meta.icon
              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                      <Icon style={{ width: 15, height: 15, color: meta.color }} />
                    </div>
                    <p style={{ fontSize: 9, fontWeight: 600, color: meta.color, margin: '0 0 1px' }}>{meta.label}</p>
                    <p style={{ fontSize: 9, color: C.label, margin: 0 }}>Day {step.delay_days}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ width: 24, height: 2, background: C.border, margin: '0 4px', marginBottom: 16, flexShrink: 0 }} />
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
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading]     = useState(true)
  const [showNew, setShowNew]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteId, setDeleteId]   = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/outreach/sequences')
      const json = await res.json()
      setSequences(json.data?.sequences ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async (name: string, desc: string, steps: Step[]) => {
    setSaving(true)
    try {
      const res  = await fetch('/api/outreach/sequences', {
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
        <Loader2 style={{ width: 22, height: 22, color: C.blue, animation: 'spin 1s linear infinite' }} />
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Outreach Sequences</h1>
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
              style={{ padding: '9px 18px', background: C.blue, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus style={{ width: 14, height: 14 }} /> New Sequence
            </button>
          </div>
        </div>

        {/* How it works banner */}
        <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12 }}>
          <Zap style={{ width: 16, height: 16, color: C.violet, flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            Enroll a lead from their detail page → the sequence fires steps automatically. WhatsApp templates send via Interakt. Call reminders appear as notifications. A lead's sequence stops automatically when they reply.
          </p>
        </div>

        {/* Empty state */}
        {sequences.length === 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Zap style={{ width: 26, height: 26, color: C.blue }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>No sequences yet</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Create a drip sequence and enroll leads to automate your follow-up.</p>
            <button onClick={() => setShowNew(true)}
              style={{ padding: '10px 24px', background: C.blue, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Create First Sequence
            </button>
          </div>
        )}

        {/* Sequence list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sequences.map(seq => (
            <SequenceCard
              key={seq.id}
              seq={seq}
              onToggle={() => handleToggle(seq)}
              onDelete={() => setDeleteId(seq.id)}
              onRefresh={fetchData}
            />
          ))}
        </div>
      </div>

      {showNew && <SequenceModal onSave={handleCreate} onClose={() => setShowNew(false)} saving={saving} />}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, padding: 28, width: 360, textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
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
