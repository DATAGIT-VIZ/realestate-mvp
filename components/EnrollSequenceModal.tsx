'use client'

import { useEffect, useState } from 'react'
import { Zap, X, Check, AlertCircle, Loader2 } from 'lucide-react'

const C = {
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  blue:    '#a000c8',
  emerald: '#059669',
  red:     '#EF4444',
}

type Sequence = { id: string; name: string; description: string | null; sequence_steps: unknown[] }

type Props = {
  isOpen:    boolean
  onClose:   () => void
  leadId:    string
  leadName:  string
  leadPhone: string
  onEnrolled?: () => void
}

export function EnrollSequenceModal({ isOpen, onClose, leadId, leadName, leadPhone, onEnrolled }: Props) {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setSelected(null)
    setError(null)
    fetch('/api/outreach/sequences')
      .then(r => r.json())
      .then(j => setSequences((j.data?.sequences ?? []).filter((s: Sequence & { active?: boolean }) => s.active !== false)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen])

  const handleEnroll = async () => {
    if (!selected) return
    setEnrolling(true)
    setError(null)
    try {
      const res  = await fetch('/api/outreach/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId: selected, leadId, leadName, leadPhone }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      onEnrolled?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrollment failed')
    } finally {
      setEnrolling(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, width: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(160,0,200,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap style={{ width: 15, height: 15, color: C.blue }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Enroll in Sequence</p>
              <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{leadName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', justifyContent: 'center' }}>
              <Loader2 style={{ width: 16, height: 16, color: C.blue, animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: C.muted }}>Loading sequences…</span>
            </div>
          )}

          {!loading && sequences.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>No active sequences yet.</p>
              <a href="/dashboard/outreach/sequences" style={{ fontSize: 13, color: C.blue, fontWeight: 600, textDecoration: 'none' }}>Create a sequence →</a>
            </div>
          )}

          {!loading && sequences.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sequences.map(seq => {
                const isSelected = selected === seq.id
                return (
                  <button key={seq.id} onClick={() => setSelected(seq.id)}
                    style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${isSelected ? C.blue : C.border}`, borderRadius: 12, background: isSelected ? 'rgba(160,0,200,0.04)' : C.panel, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{seq.name}</p>
                      <span style={{ fontSize: 11, color: C.muted }}>{(seq.sequence_steps as unknown[]).length} steps</span>
                    </div>
                    {seq.description && (
                      <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>{seq.description}</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12 }}>
              <AlertCircle style={{ width: 13, height: 13, color: C.red }} />
              <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{error}</p>
            </div>
          )}

          {!loading && sequences.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={onClose} style={{ padding: '10px 20px', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleEnroll} disabled={enrolling || !selected}
                style={{ flex: 1, padding: '10px 0', background: enrolling || !selected ? '#E2E8F0' : C.blue, border: 'none', borderRadius: 10, color: enrolling || !selected ? C.label : '#fff', fontSize: 13, fontWeight: 700, cursor: enrolling || !selected ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {enrolling ? 'Enrolling…' : <><Check style={{ width: 14, height: 14 }} /> Enroll Lead</>}
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
