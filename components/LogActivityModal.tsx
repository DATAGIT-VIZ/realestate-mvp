'use client'

import { useState } from 'react'
import {
  X, Phone, Mail, MessageCircle, Eye, Calendar, FileText,
  Loader2, Clock, Video, Building2, Handshake, TrendingUp, Bell,
  ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react'
import { type ActivityType } from '@/app/api/crm/leads/[id]/activities/route'

type Props = {
  leadId: string
  leadName?: string
  isOpen: boolean
  onClose: () => void
  onActivityLogged: (result?: { statusAdvancedTo?: string; newFailedAttempts?: number }) => void
  currentStatus?: string
  existingActivityTypes?: string[]
}

const ACTIVITY_TO_TASK: Record<string, { taskType: string; verb: string }> = {
  'Follow Up Set':        { taskType: 'Follow Up',  verb: 'Follow up with' },
  'Site Visit Scheduled': { taskType: 'Site Visit', verb: 'Site visit with' },
  'Call Made':            { taskType: 'Call Back',  verb: 'Call back'      },
  'Call Missed':          { taskType: 'Call Back',  verb: 'Call back'      },
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
  { value: 'WhatsApp Sent',      label: 'WhatsApp Sent',      Icon: MessageCircle,advances: 'Cold', group: 'Contact' },
  { value: 'Email Sent',         label: 'Email Sent',         Icon: Mail,         advances: 'Cold', group: 'Contact' },
  // Milestones
  { value: 'VM Done',            label: 'VM Done',            Icon: Video,        advances: 'Warm', milestone: true, group: 'Milestone' },
  { value: 'OBM Done',           label: 'OBM Done',           Icon: Building2,    advances: 'Warm', milestone: true, group: 'Milestone' },
  { value: 'Site Visit Done',    label: 'Site Visit Done',    Icon: Eye,          advances: 'Warm', milestone: true, group: 'Milestone' },
  { value: 'EOI Received',       label: 'EOI Received',       Icon: Handshake,    advances: 'Hot',  milestone: true, group: 'Milestone' },
  { value: 'Deal Closed',        label: 'Deals',              Icon: TrendingUp,   advances: 'Closed', milestone: true, group: 'Milestone' },
  // Admin
  { value: 'Site Visit Scheduled', label: 'SV Scheduled',    Icon: Calendar,     group: 'Admin' },
  { value: 'Follow Up Set',      label: 'Follow Up Set',      Icon: Bell,         group: 'Admin' },
  { value: 'Note',               label: 'Note',               Icon: FileText,     group: 'Admin' },
]

const GROUPS = ['Contact', 'Milestone', 'Admin']

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG_MODAL   = '#FFFFFF'
const BORDER     = '#E2E8F0'
const PRIMARY    = '#FF7043'
const PRIMARY_DIM = 'rgba(255,112,67,0.09)'
const TEXT       = '#0F172A'
const MUTED      = '#64748B'
const LABEL      = '#94A3B8'
const GRAD       = 'linear-gradient(135deg, #FF7043 0%, #FF8A65 100%)'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  background: '#F8FAFC', border: `1px solid ${BORDER}`,
  borderRadius: 9, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_ORDER = ['New', 'Cold', 'Warm', 'Hot', 'Closed']
const STATUS_COLOR: Record<string, string> = {
  New: '#64748B', Cold: '#2563EB', Warm: '#be2ed6', Hot: '#FF7043', Closed: '#059669', Disqualified: '#94A3B8',
}

export function LogActivityModal({ leadId, leadName, isOpen, onClose, onActivityLogged, currentStatus = 'New', existingActivityTypes = [] }: Props) {
  const [type, setType]             = useState<ActivityType>('Call Made')
  const [notes, setNotes]           = useState('')
  const [manualStage, setManualStage] = useState(currentStatus)
  const [nextDate, setNextDate]     = useState('')
  const [nextTime, setNextTime]     = useState('10:00')
  const [calOpen, setCalOpen]       = useState(false)
  const [calYear, setCalYear]       = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth]     = useState(() => new Date().getMonth())
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  if (!isOpen) return null

  const reset = () => {
    setType('Call Made'); setNotes('')
    setManualStage(currentStatus); setNextDate(''); setNextTime('10:00')
    setCalOpen(false); setError(null)
  }

  const close = () => { reset(); onClose() }

  const selected    = TYPE_CONFIG.find(t => t.value === type)!
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
      const followUpISO = nextDate ? new Date(`${nextDate}T${nextTime}:00`).toISOString() : undefined

      const res = await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          notes:          notes.trim() || undefined,
          nextActionDate: followUpISO,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      // Manual stage override
      let finalStatus = json.statusAdvancedTo as string | undefined
      if (manualStage !== currentStatus) {
        const stageRes = await fetch(`/api/crm/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: manualStage }),
        })
        const stageJson = await stageRes.json()
        if (stageJson.error) throw new Error(stageJson.error)
        finalStatus = manualStage
      }

      // Auto-create a task when a follow-up date is set
      if (followUpISO) {
        const mapping = ACTIVITY_TO_TASK[type] ?? { taskType: 'Follow Up', verb: 'Follow up with' }
        const title = leadName
          ? `${mapping.verb} ${leadName}`
          : mapping.taskType
        await fetch(`/api/crm/leads/${leadId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            task_type: mapping.taskType,
            due_date:  followUpISO,
            priority:  'Medium',
            notes:     notes.trim() || null,
          }),
        })
      }

      reset()
      onActivityLogged({ statusAdvancedTo: finalStatus, newFailedAttempts: json.newFailedAttempts })
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

          {/* Move to Stage */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Move to Stage</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_ORDER.map(stage => {
                const stageIdx   = STATUS_ORDER.indexOf(stage)
                const curIdx     = STATUS_ORDER.indexOf(currentStatus)
                const isPast     = stageIdx < curIdx
                const isCurrent  = stage === currentStatus
                const isSelected = manualStage === stage
                const color      = STATUS_COLOR[stage] ?? MUTED
                return (
                  <button key={stage} type="button" disabled={isPast}
                    onClick={() => setManualStage(stage)}
                    style={{
                      padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${isSelected ? color : BORDER}`,
                      background: isSelected ? `${color}18` : 'transparent',
                      color: isSelected ? color : isPast ? '#CBD5E1' : MUTED,
                      cursor: isPast ? 'not-allowed' : 'pointer',
                      opacity: isPast ? 0.45 : 1,
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {stage}
                    {isCurrent && <span style={{ fontSize: 8, opacity: 0.6 }}>●</span>}
                  </button>
                )
              })}
            </div>
            {manualStage !== currentStatus && (
              <p style={{ fontSize: 11, color: STATUS_COLOR[manualStage] ?? MUTED, margin: '6px 0 0', fontWeight: 600 }}>
                Lead will be moved to <strong>{manualStage}</strong> on save
              </p>
            )}
          </div>

          {/* Next follow-up — custom calendar */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: nextDate ? PRIMARY : LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
              <Calendar style={{ width: 11, height: 11 }} />Next Follow-up Date &amp; Time
            </label>

            {/* Quick chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {([
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: '+3 Days', days: 3 },
                { label: '+1 Week', days: 7 },
                { label: '+1 Month', days: 30 },
              ] as { label: string; days: number }[]).map(({ label, days }) => {
                const d = new Date(); d.setDate(d.getDate() + days)
                const val = d.toISOString().slice(0, 10)
                const active = nextDate === val
                return (
                  <button key={label} type="button"
                    onClick={() => {
                      if (active) { setNextDate(''); setCalOpen(false); return }
                      setNextDate(val); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setCalOpen(false)
                    }}
                    style={{ padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1px solid ${active ? PRIMARY : BORDER}`, background: active ? PRIMARY : 'transparent', color: active ? '#fff' : MUTED, cursor: 'pointer', transition: 'all 0.15s' }}
                  >{label}</button>
                )
              })}
            </div>

            {/* Trigger button */}
            <button type="button"
              onClick={() => {
                if (nextDate) { const d = new Date(`${nextDate}T12:00:00`); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }
                setCalOpen(o => !o)
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: nextDate ? 'rgba(255,112,67,0.05)' : '#F8FAFC', border: `1px solid ${calOpen || nextDate ? PRIMARY : BORDER}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}
            >
              <Calendar style={{ width: 13, height: 13, color: nextDate ? PRIMARY : MUTED, flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: nextDate ? TEXT : LABEL }}>
                {nextDate
                  ? new Date(`${nextDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Pick a date'}
              </span>
              {nextDate && (
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); setNextDate(''); setNextTime('10:00'); setCalOpen(false) }}
                  style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,112,67,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <X style={{ width: 9, height: 9, color: PRIMARY }} />
                </span>
              )}
              <ChevronDown style={{ width: 13, height: 13, color: MUTED, transform: calOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>

            {/* Custom calendar panel */}
            {calOpen && (() => {
              const firstDay = new Date(calYear, calMonth, 1).getDay()
              const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
              const cells = Array.from({ length: 42 }, (_, i) => {
                const day = i - firstDay + 1
                return (day > 0 && day <= daysInMonth) ? day : null
              })
              const todayISO = new Date().toISOString().slice(0, 10)
              return (
                <div style={{ marginTop: 6, border: `1px solid rgba(255,112,67,0.3)`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 16px rgba(255,112,67,0.1)', maxWidth: 280 }}>
                  {/* Month nav */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: GRAD }}>
                    <button type="button"
                      onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
                      style={{ width: 22, height: 22, border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: 5, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    ><ChevronLeft style={{ width: 11, height: 11 }} /></button>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{MONTHS[calMonth]} {calYear}</span>
                    <button type="button"
                      onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
                      style={{ width: 22, height: 22, border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: 5, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    ><ChevronRight style={{ width: 11, height: 11 }} /></button>
                  </div>
                  {/* Day headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '5px 8px 2px', background: 'rgba(255,112,67,0.04)' }}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: PRIMARY }}>{d}</div>
                    ))}
                  </div>
                  {/* Day grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '2px 8px 6px', background: '#fff' }}>
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} style={{ height: 28 }} />
                      const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const isSelected = iso === nextDate
                      const isToday = iso === todayISO
                      const isPast = iso < todayISO
                      return (
                        <button key={i} type="button" disabled={isPast}
                          onClick={() => { setNextDate(iso); setCalOpen(false) }}
                          style={{
                            width: '100%', height: 28, border: isToday && !isSelected ? `2px solid ${PRIMARY}` : '2px solid transparent',
                            borderRadius: '50%', background: isSelected ? PRIMARY : 'transparent',
                            color: isSelected ? '#fff' : isPast ? '#CBD5E1' : TEXT,
                            fontSize: 11, fontWeight: isSelected || isToday ? 700 : 400,
                            cursor: isPast ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.1s',
                          }}
                        >{day}</button>
                      )
                    })}
                  </div>
                  {/* Time picker */}
                  <div style={{ padding: '7px 10px', borderTop: `1px solid rgba(255,112,67,0.12)`, background: 'rgba(255,112,67,0.02)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock style={{ width: 11, height: 11, color: PRIMARY, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>Time</span>
                    <input type="time" value={nextTime} onChange={e => setNextTime(e.target.value)}
                      style={{ ...inputStyle, flex: 1, background: '#fff', padding: '4px 8px', colorScheme: 'light', accentColor: PRIMARY }} />
                  </div>
                </div>
              )
            })()}

            {/* Auto-task hint */}
            {nextDate && (
              <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(255,112,67,0.08)', border: '1px solid rgba(255,112,67,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bell style={{ width: 11, height: 11, color: PRIMARY, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: PRIMARY, margin: 0, fontWeight: 600 }}>
                  Task auto-created for&nbsp;
                  <span style={{ fontWeight: 700 }}>
                    {new Date(`${nextDate}T${nextTime}:00`).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea rows={3}
              placeholder="e.g. Called Priya — very interested in 2BHK, asked about possession timeline. Positive tone, will send brochure."
              value={notes} onChange={e => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#FAFAFA' }}>
          <button type="button" onClick={close}
            style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading || isBlocked}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: (loading || isBlocked) ? 'rgba(255,112,67,0.3)' : GRAD, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: (loading || isBlocked) ? 'not-allowed' : 'pointer' }}>
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
