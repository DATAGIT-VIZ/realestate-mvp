'use client'

import { useState } from 'react'
import { UserSwitch, X, Check, CircleNotch } from '@phosphor-icons/react'

// ─── Design tokens ──────────────────────────────────────────────────────────────
const BG     = '#FAFAF8'
const BORDER = '#E2E2DC'
const TEXT   = '#0C0C0B'
const MUTED  = '#78889B'
const LABEL  = '#A4B1BE'
const BLUE   = '#1D4ED8'
const BLUE_DIM = 'rgba(29,78,216,0.05)'

// Mock agents — replaced by real team data post-Supabase migration
const DEMO_AGENTS = [
  { id: 'agent_1', name: 'Arjun Nair',     initials: 'AN', role: 'Senior Agent',  color: '#1D4ED8', bg: '#DBEAFE' },
  { id: 'agent_2', name: 'Priya Singh',    initials: 'PS', role: 'Agent',          color: '#059669', bg: '#D1FAE5' },
  { id: 'agent_3', name: 'Meena Kulkarni', initials: 'MK', role: 'Agent',          color: '#D97706', bg: '#FEF3C7' },
  { id: 'agent_4', name: 'Rahul Desai',    initials: 'RD', role: 'Junior Agent',   color: '#7C3AED', bg: '#EDE9FE' },
]

export { DEMO_AGENTS }

export function ReassignModal({
  isOpen,
  onClose,
  leadId,
  leadName,
  onReassigned,
}: {
  isOpen: boolean
  onClose: () => void
  leadId: string
  leadName: string
  onReassigned?: (agentName: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(false)

  if (!isOpen) return null

  const agent = DEMO_AGENTS.find(a => a.id === selected)

  const reset = () => { setSelected(null); setNote(''); setSaving(false); setDone(false) }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!selected || !agent || saving) return
    setSaving(true)
    try {
      await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'Note',
          notes: `Lead reassigned to ${agent.name}${note.trim() ? ` — ${note.trim()}` : ''}`,
          outcome: 'Positive',
        }),
      })
      setDone(true)
      onReassigned?.(agent.name)
      setTimeout(() => { reset(); onClose() }, 1400)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(12,12,11,0.42)' }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div style={{ position: 'relative', background: BG, borderRadius: 2, width: 380, border: `1px solid ${BORDER}`, zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 2, background: BLUE_DIM, border: `1px solid rgba(29,78,216,0.18)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserSwitch size={14} weight="light" style={{ color: BLUE }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Reassign Lead</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{leadName}</div>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={14} weight="light" style={{ color: MUTED }} />
          </button>
        </div>

        {/* Agent list */}
        <div style={{ padding: '14px 20px 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Assign to
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_AGENTS.map(a => {
              const sel = selected === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    borderRadius: 2,
                    border: `1px solid ${sel ? BLUE : BORDER}`,
                    background: sel ? BLUE_DIM : '#FFFFFF',
                    cursor: 'pointer', width: '100%', textAlign: 'left',
                    transition: 'border-color 0.12s, background 0.12s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = '#CBD5E1' }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = BORDER }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 2, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.initials}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{a.role}</div>
                  </div>
                  {sel && <Check size={13} weight="light" style={{ color: BLUE, flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Reason */}
        <div style={{ padding: '12px 20px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Reason (optional)
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Agent on leave, workload redistribution…"
            rows={2}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 2,
              border: `1px solid ${BORDER}`, background: '#FFFFFF',
              color: TEXT, fontSize: 12, resize: 'none', outline: 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
              boxSizing: 'border-box', lineHeight: 1.5,
              transition: 'border-color 0.12s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
            onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
          />
          <p style={{ fontSize: 10, color: LABEL, margin: '6px 0 0', lineHeight: 1.4 }}>
            This will be logged in the lead&apos;s timeline. Lead stays in the system — only ownership changes.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            style={{ padding: '8px 16px', borderRadius: 2, border: `1px solid ${BORDER}`, background: '#FFFFFF', color: MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#CBD5E1')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected || saving || done}
            style={{
              padding: '8px 18px', borderRadius: 2, border: 'none',
              background: done ? '#059669' : selected && !saving ? BLUE : '#CBD5E1',
              color: '#FFFFFF', fontSize: 12, fontWeight: 700,
              cursor: selected && !saving && !done ? 'pointer' : 'default',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background 0.15s',
            }}
          >
            {done ? (
              <><Check size={12} weight="light" /> Reassigned</>
            ) : saving ? (
              <><CircleNotch size={12} weight="light" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
            ) : (
              'Reassign Lead'
            )}
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
