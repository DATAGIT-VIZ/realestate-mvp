'use client'

import { useState, useEffect } from 'react'
import {
  X, Phone, Mail, MessageCircle, Eye, Calendar, FileText,
  Loader2, Clock, Bell, CheckSquare, Square,
  ChevronLeft, ChevronRight, ChevronDown, Check,
  PhoneOff, PhoneMissed, Handshake, TrendingDown,
} from 'lucide-react'
import { type ActivityType } from '@/app/api/crm/leads/[id]/activities/route'

// ─── Props ───────────────────────────────────────────────────────────────────
type Props = {
  leadId: string
  leadName?: string
  leadEmail?: string
  currentStatus?: string
  failedContactAttempts?: number
  existingActivityTypes?: string[]
  isOpen: boolean
  onClose: () => void
  onActivityLogged: (result?: { statusAdvancedTo?: string; newFailedAttempts?: number }) => void
}

// ─── Types ───────────────────────────────────────────────────────────────────
type ActivityTab  = 'Call Made' | 'WhatsApp Sent' | 'Email Sent' | 'Site Visit Done' | 'Note'
type CallOutcome  = 'connected' | 'nca' | null
type Disposition  = string | null

type Checklist = {
  contactMade:      boolean
  requirements:     boolean
  detailsShared:    boolean
  brochure:         boolean
  propertyAssigned: boolean
  svBooked:         boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Disposition → suggested stage
const DISPOSITION_STAGE: Record<string, string> = {
  'SVS':                    'Hot',
  'VM':                     'Hot',
  'EOI / Token':            'Hot',
  'Financing Pending':      'Warm',
  'Callback':               'Warm',
  'Budget Constraint':      'Cold',
  'Timeline Horizon':       'Cold',
  'Decision Maker Absent':  'Cold',
  'Deal Won':               'Closed',
}

// Disposition → task type (for auto-creating follow-up task)
const DISPOSITION_TASK_TYPE: Record<string, string> = {
  'SVS':                    'Site Visit',
  'VM':                     'Meeting',
  'EOI / Token':            'Follow Up',
  'Financing Pending':      'Follow Up',
  'Callback':               'Call Back',
  'Budget Constraint':      'Follow Up',
  'Timeline Horizon':       'Follow Up',
  'Decision Maker Absent':  'Follow Up',
  'Deal Won':               'Follow Up',
}

// Disposition → task title prefix
const DISPOSITION_TASK_PREFIX: Record<string, string> = {
  'SVS':                    'Confirm site visit with',
  'VM':                     'Video meeting with',
  'EOI / Token':            'Follow up on EOI with',
  'Financing Pending':      'Follow up on financing with',
  'Callback':               'Call back',
  'Budget Constraint':      'Follow up (budget discussion) with',
  'Timeline Horizon':       'Follow up on timeline with',
  'Decision Maker Absent':  'Schedule meeting with decision maker for',
  'Deal Won':               'Deal won — onboard',
}

// NCA config: which attempt → how many days ahead + what task
const NCA_CONFIG: Record<number, { days: number; description: string; sendWhatsApp: boolean; taskTitle: (name: string) => string }> = {
  1: { days: 1, description: 'Auto +24h follow-up task',          sendWhatsApp: false, taskTitle: n => `Call back ${n} (NCA 1)` },
  2: { days: 1, description: 'Auto +24h follow-up task',          sendWhatsApp: false, taskTitle: n => `Call back ${n} (NCA 2)` },
  3: { days: 2, description: 'Auto +48h task + WhatsApp Intro',   sendWhatsApp: true,  taskTitle: n => `Call back ${n} (NCA 3)` },
  4: { days: 2, description: 'Auto +48h follow-up task',          sendWhatsApp: false, taskTitle: n => `Call back ${n} (NCA 4)` },
  5: { days: 3, description: 'Final retry',                       sendWhatsApp: false, taskTitle: n => `Final call attempt — ${n} (NCA 5)` },
}

const DEAL_LOST_REASONS = [
  'Lost - Purchased Elsewhere',
  'Lost - Priced Out',
  'Lost - Location Mismatch',
  'Lost - Not Interested',
  'Lost - Do Not Contact (DNC)',
]

const STATUS_ORDER = ['New', 'Cold', 'Warm', 'Hot', 'Closed']
const STATUS_COLOR: Record<string, string> = {
  New: '#64748B', Cold: '#2563EB', Warm: '#9333EA', Hot: '#FF7043',
  Closed: '#059669', Disqualified: '#94A3B8',
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG        = '#FFFFFF'
const BORDER    = '#E8ECF0'
const TEXT      = '#0F172A'
const MUTED     = '#64748B'
const LABEL     = '#94A3B8'
const PRIMARY   = '#FF7043'
const P_DIM     = 'rgba(255,112,67,0.09)'
const P_GRAD    = 'linear-gradient(135deg, #FF7043 0%, #FF8A65 100%)'
const EMERALD   = '#059669'
const RED       = '#EF4444'
const BLUE      = '#2563EB'

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#F8FAFC',
  border: `1px solid ${BORDER}`, borderRadius: 9,
  color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ num, title, sub }: { num: number; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: P_GRAD, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</span>
      <div>
        <span style={{ fontSize: 11, fontWeight: 800, color: TEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
        {sub && <span style={{ fontSize: 10, color: LABEL, marginLeft: 6, fontWeight: 500 }}>{sub}</span>}
      </div>
    </div>
  )
}

// ─── Checkbox row ─────────────────────────────────────────────────────────────
function CheckRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 9, border: `1px solid ${checked ? PRIMARY : BORDER}`, background: checked ? P_DIM : '#FAFBFC', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? PRIMARY : LABEL}`, background: checked ? PRIMARY : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {checked && <Check style={{ width: 10, height: 10, color: '#fff' }} />}
      </div>
      <div>
        <span style={{ fontSize: 12, fontWeight: 600, color: checked ? PRIMARY : TEXT }}>{label}</span>
        {sub && <div style={{ fontSize: 10, color: LABEL, marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function LogActivityModal({
  leadId, leadName, leadEmail, currentStatus = 'New',
  failedContactAttempts = 0, existingActivityTypes = [],
  isOpen, onClose, onActivityLogged,
}: Props) {
  // Section 1
  const [actTab, setActTab] = useState<ActivityTab>('Call Made')

  // Section 2 — checklist (Call Made only)
  const [cl, setCl] = useState<Checklist>({ contactMade: false, requirements: false, detailsShared: false, brochure: false, propertyAssigned: false, svBooked: false })
  const toggleCl = (k: keyof Checklist) => setCl(c => ({ ...c, [k]: !c[k] }))

  // Section 3 — disposition (Call Made only)
  const [callOutcome, setCallOutcome]   = useState<CallOutcome>(null)
  const [disposition, setDisposition]   = useState<Disposition>(null)
  const [showLostPicker, setShowLostPicker] = useState(false)
  const [lostReason, setLostReason]     = useState<string | null>(null)
  const [manualStage, setManualStage]   = useState(currentStatus)
  const [manualNcaAttempt, setManualNcaAttempt] = useState<number | 'invalid'>(Math.min(failedContactAttempts + 1, 5))

  // Section 4 — follow-up
  const [nextDate, setNextDate]     = useState('')
  const [nextTime, setNextTime]     = useState('10:00')
  const [taskTitle, setTaskTitle]   = useState('')
  const [notes, setNotes]           = useState('')
  const [calOpen, setCalOpen]       = useState(false)
  const [calYear, setCalYear]       = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth]     = useState(() => new Date().getMonth())

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // ── NCA level ──
  const autoNcaAttempt = Math.min(failedContactAttempts + 1, 5)
  const ncaAttempt     = manualNcaAttempt === 'invalid' ? autoNcaAttempt : (manualNcaAttempt as number)
  const ncaCfg         = NCA_CONFIG[ncaAttempt] ?? NCA_CONFIG[5]
  const isInvalidNCA   = manualNcaAttempt === 'invalid'

  // ── Auto-effects ──
  // When disposition changes → update stage + task title
  useEffect(() => {
    if (!disposition) return
    const stage = DISPOSITION_STAGE[disposition]
    if (stage) setManualStage(stage)
    const prefix = DISPOSITION_TASK_PREFIX[disposition]
    if (prefix && !taskTitle) setTaskTitle(`${prefix} ${leadName ?? 'lead'}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disposition])

  // When lostReason changes → Disqualified
  useEffect(() => {
    if (lostReason) setManualStage('Disqualified')
  }, [lostReason])

  // When NCA selected or level changes → auto-set date + task title
  useEffect(() => {
    if (callOutcome !== 'nca' || isInvalidNCA) return
    const cfg = NCA_CONFIG[ncaAttempt] ?? NCA_CONFIG[5]
    const d = new Date()
    d.setDate(d.getDate() + cfg.days)
    setNextDate(d.toISOString().slice(0, 10))
    setNextTime('10:00')
    setTaskTitle(cfg.taskTitle(leadName ?? 'lead'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callOutcome, manualNcaAttempt])

  if (!isOpen) return null

  const reset = () => {
    setActTab('Call Made'); setCl({ contactMade: false, requirements: false, detailsShared: false, brochure: false, propertyAssigned: false, svBooked: false })
    setCallOutcome(null); setDisposition(null); setShowLostPicker(false); setLostReason(null)
    setManualStage(currentStatus); setManualNcaAttempt(autoNcaAttempt)
    setNextDate(''); setNextTime('10:00'); setTaskTitle(''); setNotes('')
    setCalOpen(false); setError(null)
  }
  const close = () => { reset(); onClose() }

  // Quick date helper
  const setQuickDate = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days)
    setNextDate(d.toISOString().slice(0, 10))
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setCalOpen(false)
  }

  // ── Submit ──
  const handleSubmit = async () => {
    // Validation
    if (actTab === 'Call Made' && !callOutcome) { setError('Select call outcome: Connected or Not Connected'); return }
    if (actTab === 'Call Made' && callOutcome === 'connected' && !disposition && !lostReason) { setError('Select a disposition for this call'); return }
    if (!nextDate && actTab !== 'Note') { setError('Select a follow-up date (mandatory)'); return }
    if (!taskTitle.trim() && actTab !== 'Note') { setError('Add a follow-up task description'); return }

    setLoading(true); setError(null)
    try {
      const followUpISO = nextDate ? new Date(`${nextDate}T${nextTime}:00`).toISOString() : undefined

      // Determine API activity type
      let apiType: ActivityType = actTab as ActivityType
      let apiOutcome: string | undefined

      if (actTab === 'Call Made') {
        if (callOutcome === 'nca') {
          apiOutcome = isInvalidNCA ? 'Invalid Number' : 'No Response'
        } else if (lostReason) {
          apiOutcome = lostReason
        } else if (disposition) {
          apiOutcome = disposition
        }
      }

      // Post activity
      const res = await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:           apiType,
          notes:          notes.trim() || undefined,
          outcome:        apiOutcome,
          nextActionDate: followUpISO,
          callOutcome:    actTab === 'Call Made' ? (isInvalidNCA ? 'invalid_number' : callOutcome) : undefined,
          disposition:    disposition ?? undefined,
          ncaAttempt:     callOutcome === 'nca' && !isInvalidNCA ? ncaAttempt : undefined,
          checklist:      actTab === 'Call Made' ? cl : undefined,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      // Manual stage override (if different from current + lifecycle engine didn't already set it)
      let finalStatus = json.statusAdvancedTo as string | undefined
      const stageTarget = lostReason ? 'Disqualified' : (manualStage !== currentStatus ? manualStage : undefined)
      if (stageTarget && stageTarget !== json.statusAdvancedTo) {
        const sr = await fetch(`/api/crm/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: stageTarget }),
        })
        const sj = await sr.json()
        if (sj.error) throw new Error(sj.error)
        finalStatus = stageTarget
      }

      // Create follow-up task
      if (followUpISO && taskTitle.trim()) {
        const taskType = callOutcome === 'nca' ? 'Call Back'
          : disposition ? (DISPOSITION_TASK_TYPE[disposition] ?? 'Follow Up')
          : actTab === 'Site Visit Done' ? 'Site Visit'
          : 'Follow Up'
        const priority = disposition === 'SVS' || disposition === 'VM' ? 'High'
          : callOutcome === 'nca' ? 'Medium'
          : lostReason ? 'Low' : 'Medium'
        await fetch(`/api/crm/leads/${leadId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: taskTitle.trim(), task_type: taskType, due_date: followUpISO, priority, notes: notes.trim() || null }),
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

  // ── Calendar cells ──
  const firstDay     = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate()
  const calCells     = Array.from({ length: 42 }, (_, i) => { const d = i - firstDay + 1; return (d > 0 && d <= daysInMonth) ? d : null })
  const todayISO     = new Date().toISOString().slice(0, 10)

  // ── Suggested stage banner ──
  const suggestedStage = lostReason ? 'Disqualified' : (disposition ? (DISPOSITION_STAGE[disposition] ?? null) : null)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && close()}
    >
      <div style={{ background: BG, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '94vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.16)' }}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: TEXT, margin: '0 0 3px', letterSpacing: '-0.02em' }}>Log Activity</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>
                  {leadName}{leadEmail && <span style={{ color: LABEL, fontWeight: 400 }}> ({leadEmail})</span>}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[currentStatus] ?? MUTED, background: `${STATUS_COLOR[currentStatus] ?? MUTED}14`, border: `1px solid ${STATUS_COLOR[currentStatus] ?? MUTED}30`, padding: '2px 8px', borderRadius: 99 }}>
                  Status: {currentStatus}
                </span>
              </div>
            </div>
            <button onClick={close} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X style={{ width: 13, height: 13, color: MUTED }} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, padding: '9px 12px', fontSize: 12, color: RED, fontWeight: 500 }}>
              {error}
            </div>
          )}

          {/* ── SECTION 1: Activity type ── */}
          <div>
            <SectionLabel num={1} title="Activity Logging" sub="What did you do?" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {([
                { tab: 'Call Made',       icon: Phone,        label: 'Call Made'    },
                { tab: 'WhatsApp Sent',   icon: MessageCircle,label: 'WhatsApp Sent'},
                { tab: 'Email Sent',      icon: Mail,         label: 'Email Sent'   },
                { tab: 'Site Visit Done', icon: Eye,          label: 'Site Visit Done'},
                { tab: 'Note',            icon: FileText,     label: 'General Note' },
              ] as { tab: ActivityTab; icon: React.ElementType; label: string }[]).map(({ tab, icon: Icon, label }) => {
                const active = actTab === tab
                return (
                  <button key={tab} type="button"
                    onClick={() => { setActTab(tab); setCallOutcome(null); setDisposition(null); setLostReason(null); setManualStage(currentStatus) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: `1.5px solid ${active ? PRIMARY : BORDER}`, background: active ? P_DIM : 'transparent', color: active ? PRIMARY : MUTED, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.1s' }}>
                    <Icon style={{ width: 13, height: 13 }} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── SECTION 2: Call Progress Checklist (Call Made only) ── */}
          {actTab === 'Call Made' && (
            <div>
              <SectionLabel num={2} title="Call Progress Checklist" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                <CheckRow label="Contact Made" checked={cl.contactMade} onChange={() => toggleCl('contactMade')} />
                <CheckRow label="Requirements Gathered" sub="Property type, budget" checked={cl.requirements} onChange={() => toggleCl('requirements')} />
                <CheckRow label="Details Shared" sub="Project overview" checked={cl.detailsShared} onChange={() => toggleCl('detailsShared')} />
                <CheckRow label="Brochure Shared" sub="Sent via WhatsApp/email" checked={cl.brochure} onChange={() => toggleCl('brochure')} />
                <CheckRow label="Property Assigned" sub="Project / unit mapped" checked={cl.propertyAssigned} onChange={() => toggleCl('propertyAssigned')} />
                <CheckRow label="Site Visit / VM Booked" checked={cl.svBooked} onChange={() => toggleCl('svBooked')} />
              </div>
            </div>
          )}

          {/* ── SECTION 3: Outcome & Status (Call Made only) ── */}
          {actTab === 'Call Made' && (
            <div>
              <SectionLabel num={3} title="Outcome & Lead Status" sub="Auto-Calculated" />

              {/* Connected vs NCA toggle */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 7px' }}>Disposition</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button"
                    onClick={() => { setCallOutcome('connected'); setLostReason(null) }}
                    style={{ padding: '10px 12px', borderRadius: 11, border: `2px solid ${callOutcome === 'connected' ? EMERALD : BORDER}`, background: callOutcome === 'connected' ? 'rgba(5,150,105,0.08)' : '#FAFBFC', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: callOutcome === 'connected' ? 'rgba(5,150,105,0.12)' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Phone style={{ width: 13, height: 13, color: callOutcome === 'connected' ? EMERALD : MUTED }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: callOutcome === 'connected' ? EMERALD : TEXT }}>Connected</div>
                      <div style={{ fontSize: 10, color: LABEL }}>Call was answered</div>
                    </div>
                    {callOutcome === 'connected' && <Check style={{ width: 13, height: 13, color: EMERALD, marginLeft: 'auto' }} />}
                  </button>
                  <button type="button"
                    onClick={() => { setCallOutcome('nca'); setDisposition(null); setLostReason(null); setShowLostPicker(false); setManualNcaAttempt(autoNcaAttempt) }}
                    style={{ padding: '10px 12px', borderRadius: 11, border: `2px solid ${callOutcome === 'nca' ? RED : BORDER}`, background: callOutcome === 'nca' ? 'rgba(239,68,68,0.07)' : '#FAFBFC', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: callOutcome === 'nca' ? 'rgba(239,68,68,0.10)' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PhoneMissed style={{ width: 13, height: 13, color: callOutcome === 'nca' ? RED : MUTED }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: callOutcome === 'nca' ? RED : TEXT }}>Not Connected</div>
                      <div style={{ fontSize: 10, color: LABEL }}>No answer / busy</div>
                    </div>
                    {callOutcome === 'nca' && <Check style={{ width: 13, height: 13, color: RED, marginLeft: 'auto' }} />}
                  </button>
                </div>
              </div>

              {/* CONNECTED → disposition categories */}
              {callOutcome === 'connected' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px', background: '#F8FAFC', borderRadius: 12, border: `1px solid ${BORDER}` }}>

                  {/* Category A */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: EMERALD, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>🔥</span> Moving Forward
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['SVS', 'VM', 'EOI / Token', 'Financing Pending'].map(d => (
                        <button key={d} type="button"
                          onClick={() => { setDisposition(d); setLostReason(null); setShowLostPicker(false) }}
                          style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${disposition === d ? EMERALD : BORDER}`, background: disposition === d ? 'rgba(5,150,105,0.10)' : '#fff', color: disposition === d ? EMERALD : MUTED, transition: 'all 0.1s' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category B */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>⏳</span> Delayed / Deferred
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Callback', 'Budget Constraint', 'Timeline Horizon', 'Decision Maker Absent'].map(d => (
                        <button key={d} type="button"
                          onClick={() => { setDisposition(d); setLostReason(null); setShowLostPicker(false) }}
                          style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${disposition === d ? '#F59E0B' : BORDER}`, background: disposition === d ? 'rgba(245,158,11,0.09)' : '#fff', color: disposition === d ? '#B45309' : MUTED, transition: 'all 0.1s' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category C */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>⛔</span> Closed
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button type="button"
                        onClick={() => { setDisposition('Deal Won'); setLostReason(null); setShowLostPicker(false) }}
                        style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${disposition === 'Deal Won' ? EMERALD : BORDER}`, background: disposition === 'Deal Won' ? 'rgba(5,150,105,0.10)' : '#fff', color: disposition === 'Deal Won' ? EMERALD : MUTED }}>
                        ✅ Deal Won
                      </button>
                      <button type="button"
                        onClick={() => { setShowLostPicker(s => !s); setDisposition(null) }}
                        style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${lostReason ? RED : BORDER}`, background: lostReason ? 'rgba(239,68,68,0.08)' : '#fff', color: lostReason ? RED : MUTED }}>
                        ❌ {lostReason ? lostReason.replace('Lost - ', '') : 'Deal Lost'}
                      </button>
                    </div>
                    {showLostPicker && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, padding: '10px', background: '#fff', borderRadius: 10, border: `1px solid rgba(239,68,68,0.2)` }}>
                        {DEAL_LOST_REASONS.map(r => (
                          <button key={r} type="button"
                            onClick={() => { setLostReason(r); setShowLostPicker(false); setDisposition(null) }}
                            style={{ textAlign: 'left', padding: '6px 10px', borderRadius: 7, border: `1px solid ${lostReason === r ? RED : BORDER}`, background: lostReason === r ? 'rgba(239,68,68,0.07)' : 'transparent', fontSize: 12, fontWeight: lostReason === r ? 700 : 500, color: lostReason === r ? RED : MUTED, cursor: 'pointer' }}>
                            {r.replace('Lost - ', '')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NCA → dropdown + dot tracker */}
              {callOutcome === 'nca' && (
                <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: 12, border: `1px solid rgba(239,68,68,0.18)` }}>
                  {/* NC level dropdown */}
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                      NC Level
                      <span style={{ marginLeft: 6, fontWeight: 500, color: LABEL, textTransform: 'none', letterSpacing: 'normal', fontSize: 9 }}>
                        Auto-detected: NC{autoNcaAttempt}
                      </span>
                    </p>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={manualNcaAttempt}
                        onChange={e => setManualNcaAttempt(e.target.value === 'invalid' ? 'invalid' : Number(e.target.value))}
                        style={{ ...inp, appearance: 'none', WebkitAppearance: 'none', paddingRight: 32, borderColor: 'rgba(239,68,68,0.35)', background: '#fff', color: TEXT, fontWeight: 600, cursor: 'pointer' }}
                      >
                        <optgroup label="Not Connected">
                          <option value={1}>NC1 — No Answer / Busy (+24h task)</option>
                          <option value={2}>NC2 — No Answer / Busy (+24h task)</option>
                          <option value={3}>NC3 — No Answer / Busy (+48h + WhatsApp)</option>
                          <option value={4}>NC4 — No Answer / Busy (+48h task)</option>
                          <option value={5}>NC5 — Final Retry (+72h task)</option>
                        </optgroup>
                        <optgroup label="Other">
                          <option value="invalid">Invalid Number — Disqualify lead</option>
                        </optgroup>
                      </select>
                      <ChevronDown style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: RED, pointerEvents: 'none' }} />
                    </div>
                  </div>

                  {/* NC quick chips */}
                  <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button"
                        onClick={() => setManualNcaAttempt(n)}
                        style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, border: `1.5px solid ${manualNcaAttempt === n ? RED : BORDER}`, background: manualNcaAttempt === n ? RED : '#fff', color: manualNcaAttempt === n ? '#fff' : n <= autoNcaAttempt ? RED : LABEL, cursor: 'pointer', transition: 'all 0.1s' }}>
                        NC{n}
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => setManualNcaAttempt('invalid')}
                      style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, border: `1.5px solid ${manualNcaAttempt === 'invalid' ? RED : BORDER}`, background: manualNcaAttempt === 'invalid' ? RED : '#fff', color: manualNcaAttempt === 'invalid' ? '#fff' : MUTED, cursor: 'pointer', transition: 'all 0.1s' }}>
                      Invalid
                    </button>
                  </div>

                  {/* Description + dot tracker / warning */}
                  {isInvalidNCA ? (
                    <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: RED, margin: '0 0 3px' }}>⚠️ Invalid Number selected</p>
                      <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>This lead will be marked as Disqualified.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>{ncaCfg.description}</p>
                        <p style={{ fontSize: 10, color: LABEL, margin: '3px 0 0' }}>
                          {failedContactAttempts} previous failed attempt{failedContactAttempts !== 1 ? 's' : ''}
                          {ncaCfg.sendWhatsApp && (
                            <span style={{ marginLeft: 6, color: BLUE, fontWeight: 600 }}>+ WhatsApp Intro</span>
                          )}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <span key={n} style={{ width: 22, height: 22, borderRadius: '50%', background: n === ncaAttempt ? RED : n < ncaAttempt ? 'rgba(239,68,68,0.25)' : '#F1F5F9', color: n === ncaAttempt ? '#fff' : n < ncaAttempt ? RED : LABEL, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stage auto-suggest + override */}
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Move to Stage</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[...STATUS_ORDER, 'Disqualified'].map(stage => {
                    const isSel  = manualStage === stage
                    const isAuto = suggestedStage === stage
                    const color  = STATUS_COLOR[stage] ?? MUTED
                    return (
                      <button key={stage} type="button"
                        onClick={() => setManualStage(stage)}
                        style={{ padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: isSel ? 700 : 500, border: `1.5px solid ${isSel ? color : BORDER}`, background: isSel ? `${color}15` : 'transparent', color: isSel ? color : MUTED, cursor: 'pointer', position: 'relative' }}>
                        {stage}
                        {isAuto && !isSel && <span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: color, border: '1.5px solid #fff' }} />}
                      </button>
                    )
                  })}
                </div>
                {suggestedStage && manualStage !== currentStatus && (
                  <p style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[manualStage] ?? MUTED, margin: '6px 0 0' }}>
                    Lead will move to <strong>{manualStage}</strong> on save
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── SECTION 4: Next Follow-Up ── */}
          <div>
            <SectionLabel
              num={actTab === 'Call Made' ? 4 : 2}
              title="Next Follow-Up"
              sub={actTab === 'Note' ? undefined : 'Mandatory'}
            />

            {/* Quick date chips */}
            <p style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 7px' }}>Mandatory Action</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {([{ label: 'Today', days: 0 }, { label: 'Tomorrow', days: 1 }, { label: '+3 Days', days: 3 }, { label: '+1 Week', days: 7 }] as { label: string; days: number }[]).map(({ label, days }) => {
                const d = new Date(); d.setDate(d.getDate() + days)
                const val = d.toISOString().slice(0, 10)
                const active = nextDate === val
                return (
                  <button key={label} type="button"
                    onClick={() => { if (active) { setNextDate(''); setCalOpen(false) } else { setNextDate(val); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setCalOpen(false) } }}
                    style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${active ? PRIMARY : BORDER}`, background: active ? PRIMARY : 'transparent', color: active ? '#fff' : MUTED, cursor: 'pointer', transition: 'all 0.12s' }}>
                    {label}
                  </button>
                )
              })}

              {/* Custom date picker trigger */}
              <button type="button"
                onClick={() => { if (nextDate) { const d = new Date(`${nextDate}T12:00`); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) } setCalOpen(o => !o) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${calOpen ? PRIMARY : BORDER}`, background: 'transparent', color: calOpen ? PRIMARY : MUTED, cursor: 'pointer' }}>
                <Calendar style={{ width: 11, height: 11 }} />
                {nextDate && !['0','1','3','7'].some(d => { const dt = new Date(); dt.setDate(dt.getDate() + Number(d)); return dt.toISOString().slice(0,10) === nextDate })
                  ? new Date(`${nextDate}T12:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : 'Pick a date & time'
                }
              </button>
            </div>

            {/* Calendar panel */}
            {calOpen && (
              <div style={{ marginBottom: 10, border: `1px solid rgba(255,112,67,0.25)`, borderRadius: 12, overflow: 'hidden', maxWidth: 280, boxShadow: '0 4px 16px rgba(255,112,67,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: P_GRAD }}>
                  <button type="button" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
                    style={{ width: 24, height: 24, border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft style={{ width: 12, height: 12 }} />
                  </button>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{MONTHS[calMonth]} {calYear}</span>
                  <button type="button" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
                    style={{ width: 24, height: 24, border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight style={{ width: 12, height: 12 }} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '6px 8px 2px', background: 'rgba(255,112,67,0.03)' }}>
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: PRIMARY }}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '2px 8px 6px', background: '#fff' }}>
                  {calCells.map((day, i) => {
                    if (!day) return <div key={i} style={{ height: 28 }} />
                    const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const sel = iso === nextDate; const past = iso < todayISO; const today = iso === todayISO
                    return (
                      <button key={i} type="button" disabled={past} onClick={() => { setNextDate(iso); setCalOpen(false) }}
                        style={{ height: 28, border: today && !sel ? `2px solid ${PRIMARY}` : '2px solid transparent', borderRadius: '50%', background: sel ? PRIMARY : 'transparent', color: sel ? '#fff' : past ? '#CBD5E1' : TEXT, fontSize: 11, fontWeight: sel || today ? 700 : 400, cursor: past ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {day}
                      </button>
                    )
                  })}
                </div>
                <div style={{ padding: '7px 12px', borderTop: `1px solid rgba(255,112,67,0.12)`, background: 'rgba(255,112,67,0.02)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock style={{ width: 11, height: 11, color: PRIMARY, flexShrink: 0 }} />
                  <input type="time" value={nextTime} onChange={e => setNextTime(e.target.value)}
                    style={{ ...inp, flex: 1, background: '#fff', padding: '4px 8px', accentColor: PRIMARY }} />
                </div>
              </div>
            )}

            {/* Task hint */}
            {nextDate && (
              <div style={{ marginBottom: 8, padding: '7px 10px', background: P_DIM, border: '1px solid rgba(255,112,67,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bell style={{ width: 11, height: 11, color: PRIMARY, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: PRIMARY, margin: 0, fontWeight: 600 }}>
                  Task created for{' '}
                  <strong>{new Date(`${nextDate}T${nextTime}:00`).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                </p>
              </div>
            )}

            {/* Mandatory task title */}
            {actTab !== 'Note' && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Mandatory Task</p>
                <input
                  style={{ ...inp, borderColor: taskTitle ? BORDER : nextDate ? 'rgba(255,112,67,0.35)' : BORDER }}
                  placeholder="e.g. Schedule 2nd Site Visit / Send pricing breakdown"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Notes</p>
              <textarea rows={3}
                placeholder="Add specific conversation details and context..."
                value={notes} onChange={e => setNotes(e.target.value)}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.55 }} />
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#FAFAFA' }}>
          <button type="button" onClick={close}
            style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: loading ? 'rgba(255,112,67,0.3)' : P_GRAD, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 12px rgba(255,112,67,0.28)' }}>
            {loading
              ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />Saving…</>
              : manualStage !== currentStatus
                ? `Log & Move to ${manualStage}`
                : 'Save Activity'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
