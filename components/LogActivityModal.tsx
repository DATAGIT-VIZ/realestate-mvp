'use client'

import { useState } from 'react'
import {
  X, Phone, Mail, MessageCircle, Eye, Calendar, FileText,
  Loader2, Clock, CheckCircle, XCircle, MinusCircle, HelpCircle,
  Video, Building2, Handshake, TrendingUp, Bell,
} from 'lucide-react'
import { type ActivityType } from '@/app/api/crm/leads/[id]/activities/route'

type Props = {
  leadId: string
  isOpen: boolean
  onClose: () => void
  onActivityLogged: (result?: { statusAdvancedTo?: string; newFailedAttempts?: number }) => void
  currentStatus?: string
  existingActivityTypes?: string[]
}

// ─── Activity type config ─────────────────────────────────────────────────────
type TypeConfig = {
  value: ActivityType
  label: string
  Icon: React.ElementType
  advances?: string     // which status this unlocks
  milestone?: boolean   // can only be logged once
  group: string
}

const TYPE_CONFIG: TypeConfig[] = [
  // Contact attempts
  { value: 'Call Made',          label: 'Call Made',          Icon: Phone,        advances: 'Cold', group: 'Contact' },
  { value: 'Call Missed',        label: 'Call Missed',        Icon: Phone,        advances: 'Cold', group: 'Contact' },
  { value: 'WhatsApp Sent',      label: 'WhatsApp Sent',      Icon: MessageCircle,advances: 'Cold', group: 'Contact' },
  { value: 'WhatsApp Received',  label: 'WhatsApp Received',  Icon: MessageCircle,advances: 'Cold', group: 'Contact' },
  { value: 'Email Sent',         label: 'Email Sent',         Icon: Mail,         advances: 'Cold', group: 'Contact' },
  { value: 'Email Received',     label: 'Email Received',     Icon: Mail,         advances: 'Cold', group: 'Contact' },
  // Milestones
  { value: 'VM Done',            label: 'VM Done',            Icon: Video,        advances: 'Warm', milestone: true, group: 'Milestone' },
  { value: 'OBM Done',           label: 'OBM Done',           Icon: Building2,    advances: 'Warm', milestone: true, group: 'Milestone' },
  { value: 'Site Visit Done',    label: 'Site Visit Done',    Icon: Eye,          advances: 'Warm', milestone: true, group: 'Milestone' },
  { value: 'EOI Received',       label: 'EOI Received',       Icon: Handshake,    advances: 'Hot',  milestone: true, group: 'Milestone' },
  { value: 'Deal Closed',        label: 'Deal Closed',        Icon: TrendingUp,   advances: 'Closed', milestone: true, group: 'Milestone' },
  // Admin
  { value: 'Site Visit Scheduled', label: 'SV Scheduled',    Icon: Calendar,     group: 'Admin' },
  { value: 'Follow Up Set',      label: 'Follow Up Set',      Icon: Bell,         group: 'Admin' },
  { value: 'Note',               label: 'Note',               Icon: FileText,     group: 'Admin' },
]

const GROUPS = ['Contact', 'Milestone', 'Admin']

const OUTCOMES = [
  { value: 'Positive',    Icon: CheckCircle,  color: '#059669', label: 'Positive' },
  { value: 'Neutral',     Icon: MinusCircle,  color: '#94A3B8', label: 'Neutral' },
  { value: 'No Response', Icon: HelpCircle,   color: '#D97706', label: 'No Response' },
  { value: 'Negative',    Icon: XCircle,      color: '#EF4444', label: 'Negative' },
]

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG_MODAL   = '#FFFFFF'
const BORDER     = '#E2E8F0'
const PRIMARY    = '#a000c8'
const PRIMARY_DIM = 'rgba(160,0,200,0.08)'
const TEXT       = '#0F172A'
const MUTED      = '#64748B'
const LABEL      = '#94A3B8'
const GRAD       = 'linear-gradient(135deg, #7600bc 0%, #b100cd 100%)'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  background: '#F8FAFC', border: `1px solid ${BORDER}`,
  borderRadius: 9, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

const STATUS_ORDER = ['New', 'Cold', 'Warm', 'Hot', 'Closed']
const STATUS_COLOR: Record<string, string> = {
  New: '#64748B', Cold: '#2563EB', Warm: '#be2ed6', Hot: '#a000c8', Closed: '#059669', Disqualified: '#94A3B8',
}

export function LogActivityModal({ leadId, isOpen, onClose, onActivityLogged, currentStatus = 'New', existingActivityTypes = [] }: Props) {
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

  const selected    = TYPE_CONFIG.find(t => t.value === type)!
  const isCall      = type === 'Call Made' || type === 'Call Missed'
  const isBlocked   = selected?.milestone && existingActivityTypes.includes(type)
  const advancesTo  = selected?.advances
  const currentIdx  = STATUS_ORDER.indexOf(currentStatus)
  const advancesIdx = advancesTo ? STATUS_ORDER.indexOf(advancesTo) : -1
  const willAdvance = advancesTo && advancesIdx > currentIdx && currentStatus !== 'Disqualified' && currentStatus !== 'Closed'

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isBlocked) { setError(`${type} has already been logged for this lead.`); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          outcome:        outcome     || undefined,
          notes:          notes.trim()|| undefined,
          duration:       duration    ? Number(duration) * 60 : undefined,
          nextActionDate: nextDate    || undefined,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      reset()
      onActivityLogged({ statusAdvancedTo: json.statusAdvancedTo, newFailedAttempts: json.newFailedAttempts })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log activity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && close()}
    >
      <div style={{ background: BG_MODAL, border: `1px solid ${BORDER}`, borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: 0 }}>Log Activity</h2>
            <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>
              Status: <span style={{ fontWeight: 700, color: STATUS_COLOR[currentStatus] ?? MUTED }}>{currentStatus}</span>
            </p>
          </div>
          <button onClick={close} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '9px 12px' }}>
              <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Activity type — grouped */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Activity Type</label>
            {GROUPS.map(group => {
              const groupTypes = TYPE_CONFIG.filter(t => t.group === group)
              return (
                <div key={group} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>{group}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {groupTypes.map(({ value, label, Icon, advances, milestone }) => {
                      const active   = type === value
                      const blocked  = milestone && existingActivityTypes.includes(value)
                      return (
                        <button key={value} type="button" onClick={() => !blocked && setType(value)} disabled={blocked}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '6px 10px', borderRadius: 8,
                            border: `1px solid ${active ? PRIMARY : blocked ? '#E2E8F0' : BORDER}`,
                            background: active ? PRIMARY_DIM : blocked ? '#F8FAFC' : 'transparent',
                            color: active ? PRIMARY : blocked ? LABEL : MUTED,
                            fontSize: 12, fontWeight: active ? 600 : 400,
                            cursor: blocked ? 'not-allowed' : 'pointer',
                            opacity: blocked ? 0.5 : 1,
                            position: 'relative',
                          }}
                          title={blocked ? `${label} already logged` : advances ? `→ ${advances}` : ''}
                        >
                          <Icon style={{ width: 11, height: 11 }} />
                          {label}
                          {advances && !blocked && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[advances] ?? MUTED, background: `${STATUS_COLOR[advances]}15`, padding: '1px 4px', borderRadius: 4 }}>→{advances}</span>
                          )}
                          {blocked && <span style={{ fontSize: 9, color: LABEL }}>✓done</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Status advance banner */}
          {willAdvance && (
            <div style={{ padding: '9px 12px', background: `${STATUS_COLOR[advancesTo!]}10`, border: `1px solid ${STATUS_COLOR[advancesTo!]}30`, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp style={{ width: 13, height: 13, color: STATUS_COLOR[advancesTo!], flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: STATUS_COLOR[advancesTo!], fontWeight: 600, margin: 0 }}>
                Logging this will move lead to <strong>{advancesTo}</strong>
              </p>
            </div>
          )}

          {/* Outcome */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Outcome</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
              {OUTCOMES.map(({ value, Icon, color, label }) => (
                <button key={value} type="button" onClick={() => setOutcome(outcome === value ? '' : value)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 10, border: `1px solid ${outcome === value ? color : BORDER}`, background: outcome === value ? `${color}12` : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <Icon style={{ width: 14, height: 14, color: outcome === value ? color : MUTED }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: outcome === value ? color : MUTED }}>{label}</span>
                </button>
              ))}
            </div>
            {outcome === 'No Response' && isCall && (
              <p style={{ fontSize: 11, color: '#D97706', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠ Failed contact attempt — auto-disqualifies after 5
              </p>
            )}
          </div>

          {/* Duration (calls only) */}
          {isCall && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Clock style={{ width: 11, height: 11 }} />Duration (minutes)
              </label>
              <input type="number" min="0" placeholder="e.g. 5" value={duration} onChange={e => setDuration(e.target.value)} style={{ ...inputStyle, width: 120 }} />
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea rows={3} placeholder="What happened? Key points discussed…"
              value={notes} onChange={e => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          {/* Next follow-up */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <Calendar style={{ width: 11, height: 11 }} />Next Follow-up (optional)
            </label>
            <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} style={{ ...inputStyle, width: 'auto', colorScheme: 'light' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#FAFAFA' }}>
          <button type="button" onClick={close}
            style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading || isBlocked}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: (loading || isBlocked) ? 'rgba(160,0,200,0.3)' : GRAD, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: (loading || isBlocked) ? 'not-allowed' : 'pointer' }}>
            {loading
              ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />Saving…</>
              : willAdvance
                ? `Log & Move to ${advancesTo}`
                : 'Log Activity'}
          </button>
        </div>
      </div>
    </div>
  )
}
