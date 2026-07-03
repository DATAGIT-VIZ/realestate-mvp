'use client'

import { useState } from 'react'
import {
  X, Phone, Mail, MessageCircle, Eye, Calendar, Users,
  Bell, FileText, Loader2, Clock, CheckCircle, XCircle,
  MinusCircle, HelpCircle,
} from 'lucide-react'
import { type ActivityType } from '@/app/api/crm/leads/[id]/activities/route'

type Props = {
  leadId: string
  isOpen: boolean
  onClose: () => void
  onActivityLogged: () => void
}

const TYPES: { value: ActivityType; label: string; Icon: React.ElementType }[] = [
  { value: 'Call Made',              label: 'Call Made',              Icon: Phone },
  { value: 'Call Missed',            label: 'Call Missed',            Icon: Phone },
  { value: 'WhatsApp Sent',          label: 'WhatsApp Sent',          Icon: MessageCircle },
  { value: 'WhatsApp Received',      label: 'WhatsApp Received',      Icon: MessageCircle },
  { value: 'Email Sent',             label: 'Email Sent',             Icon: Mail },
  { value: 'Email Received',         label: 'Email Received',         Icon: Mail },
  { value: 'Site Visit Scheduled',   label: 'Site Visit Scheduled',   Icon: Calendar },
  { value: 'Site Visit Done',        label: 'Site Visit Done',        Icon: Eye },
  { value: 'Follow Up Set',          label: 'Follow Up Set',          Icon: Bell },
  { value: 'Note',                   label: 'Note',                   Icon: FileText },
  { value: 'Status Changed',         label: 'Status Changed',         Icon: Users },
]

const OUTCOMES = [
  { value: 'Positive',    Icon: CheckCircle,  color: '#10B981' },
  { value: 'Neutral',     Icon: MinusCircle,  color: '#94A3B8' },
  { value: 'Negative',    Icon: XCircle,      color: '#EF4444' },
  { value: 'No Response', Icon: HelpCircle,   color: '#F59E0B' },
]

// Design tokens (match the rest of the app)
const BG_OVERLAY = 'rgba(15,23,42,0.4)'
const BG_MODAL   = '#FFFFFF'
const BORDER     = '#E2E8F0'
const BLUE       = '#2563EB'
const TEXT       = '#0F172A'
const MUTED      = '#64748B'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  background: '#F8FAFC', border: `1px solid ${BORDER}`,
  borderRadius: 9, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

export function LogActivityModal({ leadId, isOpen, onClose, onActivityLogged }: Props) {
  const [type, setType]         = useState<ActivityType>('Call Made')
  const [outcome, setOutcome]   = useState('')
  const [notes, setNotes]       = useState('')
  const [duration, setDuration] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  if (!isOpen) return null

  const reset = () => {
    setType('Call Made'); setOutcome(''); setNotes('')
    setDuration(''); setNextDate(''); setError(null)
  }

  const close = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          outcome: outcome || undefined,
          notes: notes.trim() || undefined,
          duration: duration ? Number(duration) * 60 : undefined, // mins → secs
          nextActionDate: nextDate || undefined,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      reset()
      onActivityLogged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log activity')
    } finally {
      setLoading(false)
    }
  }

  const isCall = type.toLowerCase().includes('call')

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: BG_OVERLAY, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && close()}
    >
      <div style={{ background: BG_MODAL, border: `1px solid ${BORDER}`, borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: 0 }}>Log Activity</h2>
          <button onClick={close} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '9px 12px' }}>
              <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Activity type pills */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Activity Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TYPES.map(({ value, label, Icon }) => (
                <button key={value} type="button" onClick={() => setType(value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${type === value ? BLUE : BORDER}`, background: type === value ? 'rgba(37,99,235,0.08)' : 'transparent', color: type === value ? BLUE : MUTED, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <Icon style={{ width: 11, height: 11 }} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Outcome</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {OUTCOMES.map(({ value, Icon, color }) => (
                <button key={value} type="button" onClick={() => setOutcome(outcome === value ? '' : value)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 6px', borderRadius: 10, border: `1px solid ${outcome === value ? color : BORDER}`, background: outcome === value ? `${color}18` : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <Icon style={{ width: 14, height: 14, color: outcome === value ? color : MUTED }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: outcome === value ? color : MUTED }}>{value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Call duration (only for calls) */}
          {isCall && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Clock style={{ width: 11, height: 11 }} />Duration (minutes)
              </label>
              <input
                type="number" min="0" placeholder="e.g. 5"
                value={duration} onChange={e => setDuration(e.target.value)}
                style={{ ...inputStyle, width: 120 }}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea
              rows={3} placeholder="What happened? Key points discussed…"
              value={notes} onChange={e => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Next action date */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <Calendar style={{ width: 11, height: 11 }} />Next Follow-up (optional)
            </label>
            <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} style={{ ...inputStyle, width: 'auto', colorScheme: 'light' }} />
          </div>
        </form>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={close}
            style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: loading ? 'rgba(59,130,246,0.5)' : BLUE, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading
              ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />Saving…</>
              : 'Log Activity'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
