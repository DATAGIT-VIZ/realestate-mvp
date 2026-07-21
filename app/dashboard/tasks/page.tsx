'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Phone, MessageCircle, Bell, FileText, Eye,
  Building2, CheckCircle2, XCircle, Loader2, ChevronDown,
  AlertTriangle, Flame, Target, Zap, Trophy,
  Plus, X, Search, Edit2, User, Users,
  CornerDownRight,
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG          = '#F5F6FA'
const PANEL       = '#FFFFFF'
const BORDER      = '#E8ECF0'
const TEXT        = '#263238'
const MUTED       = '#78889B'
const LABEL       = '#A4B1BE'
const ORANGE      = '#FF7043'
const ORANGE_DIM  = 'rgba(255,112,67,0.09)'
const ORANGE_GRAD = 'linear-gradient(135deg, #FF7043 0%, #FF8A65 100%)'
const EMERALD     = '#059669'
const AMBER       = '#F59E0B'
const RED         = '#EF4444'
const BLUE        = '#2E66F6'

// ─── Types ────────────────────────────────────────────────────────────────────
type Member = { id: string; name: string; role: string }

type Task = {
  id: string
  lead_id: string
  title: string
  task_type: string
  due_date: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'Pending' | 'Done' | 'Cancelled'
  notes: string | null
  assigned_to: string | null
  created_by: string | null
  source: 'self' | 'assigned'
  leads?: { id: string; name: string; phone: string | null } | null
  assignee?: { name: string; role: string } | null
  creator?: { name: string; role: string } | null
}

type TabKey = 'all' | 'assigned' | 'self'

type TaskFormData = {
  lead_id: string
  title: string
  task_type: string
  due_date: string
  time: string
  priority: 'High' | 'Medium' | 'Low'
  notes: string
  assigned_to: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TASK_TYPES = [
  'Follow Up', 'Call Back', 'Site Visit', 'Send Brochure',
  'Meeting', 'Send Proposal', 'Check In', 'Custom',
]

const TYPE_DEFAULTS: Record<string, string> = {
  'Follow Up':     'Follow up with lead',
  'Call Back':     'Call back lead',
  'Site Visit':    'Site visit scheduled',
  'Send Brochure': 'Send project brochure',
  'Meeting':       'Meeting with lead',
  'Send Proposal': 'Send proposal document',
  'Check In':      'Check in on lead status',
}

const TASK_ICONS: Record<string, React.ElementType> = {
  'Follow Up': Bell, 'Call Back': Phone, 'Site Visit': Eye,
  'Send Brochure': FileText, 'Meeting': Building2, 'Send Proposal': FileText,
  'Check In': MessageCircle, 'Custom': Target,
}

const PRIORITY_CFG = {
  High:   { color: RED,    bg: 'rgba(239,68,68,0.09)',   border: 'rgba(239,68,68,0.22)'   },
  Medium: { color: AMBER,  bg: 'rgba(245,158,11,0.09)',  border: 'rgba(245,158,11,0.22)'  },
  Low:    { color: LABEL,  bg: 'rgba(164,177,190,0.09)', border: 'rgba(164,177,190,0.22)' },
}

const ROLE_COLOR: Record<string, string> = {
  agent: ORANGE, senior_agent: AMBER, manager: EMERALD,
}

const AVATAR_COLORS = [
  { bg: '#FFEDE8', fg: '#C2410C' }, { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#DCFCE7', fg: '#15803D' }, { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#EDE9FE', fg: '#6D28D9' }, { bg: '#FCE7F3', fg: '#BE185D' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function getLeadName(task: Task): string {
  return task.leads?.name || 'Unknown Lead'
}

function formatDue(iso: string) {
  const d     = new Date(iso)
  const now   = new Date()
  const today  = now.toISOString().slice(0, 10)
  const dDay   = d.toISOString().slice(0, 10)
  const time   = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const overdue = d < now && dDay !== today
  const isToday = dDay === today
  const tmr    = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const isSoon = !overdue && !isToday && dDay === tmr

  if (overdue) {
    const hrs = Math.abs(Math.floor((d.getTime() - now.getTime()) / 60000 / 60))
    const lbl = hrs >= 24 ? `${Math.floor(hrs / 24)}d overdue` : `${hrs}h overdue`
    return { label: lbl, detail: time, overdue: true, isToday: false, isSoon: false }
  }
  if (isToday) return { label: 'Today', detail: time, overdue: false, isToday: true, isSoon: false }
  if (isSoon)  return { label: 'Tomorrow', detail: time, overdue: false, isToday: false, isSoon: true }
  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return { label: dateStr, detail: time, overdue: false, isToday: false, isSoon: false }
}

// ─── Mini Avatar ─────────────────────────────────────────────────────────────
function MiniAvatar({ name, size = 20 }: { name: string; size?: number }) {
  const av = avatarColor(name)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size <= 20 ? 8 : 10, fontWeight: 700, color: av.fg }}>{getInitials(name)}</span>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: `1px solid ${BORDER}`, background: '#FAFBFC',
  fontSize: 13, color: TEXT, outline: 'none', boxSizing: 'border-box',
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────
function TaskFormModal({
  mode, initial, leads, members, onClose, onSave,
}: {
  mode: 'create' | 'edit'
  initial?: Partial<TaskFormData> & { id?: string; lead_id?: string; leadName?: string }
  leads: { id: string; name: string }[]
  members: Member[]
  onClose: () => void
  onSave: (data: TaskFormData & { id?: string }) => Promise<void>
}) {
  const [form, setForm] = useState<TaskFormData>({
    lead_id:     initial?.lead_id    ?? '',
    title:       initial?.title      ?? '',
    task_type:   initial?.task_type  ?? 'Follow Up',
    due_date:    initial?.due_date   ? initial.due_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    time:        initial?.time       ?? '10:00',
    priority:    initial?.priority   ?? 'Medium',
    notes:       initial?.notes      ?? '',
    assigned_to: initial?.assigned_to ?? '',
  })
  const [leadSearch, setLeadSearch] = useState(initial?.leadName ?? '')
  const [showLeads, setShowLeads]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState<string | null>(null)
  const leadRef = useRef<HTMLDivElement>(null)

  const set = <K extends keyof TaskFormData>(k: K, v: TaskFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (leadRef.current && !leadRef.current.contains(e.target as Node)) setShowLeads(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filteredLeads = leads
    .filter(l => !leadSearch || l.name.toLowerCase().includes(leadSearch.toLowerCase()))
    .slice(0, 8)

  const canSave = form.lead_id && form.title.trim() && form.due_date

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true); setErr(null)
    try { await onSave({ ...form, id: initial?.id }); onClose() }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: PANEL, borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '-0.03em' }}>
              {mode === 'create' ? 'New Task' : 'Edit Task'}
            </h2>
            <p style={{ fontSize: 12, color: MUTED, margin: '3px 0 0' }}>
              {mode === 'create' ? 'Schedule a task across any lead' : 'Update task details'}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X style={{ width: 13, height: 13, color: MUTED }} />
          </button>
        </div>

        <div style={{ padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Lead */}
          <div ref={leadRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Lead *</label>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: LABEL, pointerEvents: 'none' }} />
              <input style={{ ...inp, paddingLeft: 30 }} placeholder="Search lead..." value={leadSearch}
                onChange={e => { setLeadSearch(e.target.value); setShowLeads(true); if (!e.target.value) set('lead_id', '') }}
                onFocus={() => setShowLeads(true)} />
            </div>
            {showLeads && filteredLeads.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 50, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                {filteredLeads.map(l => (
                  <button key={l.id} onClick={() => { set('lead_id', l.id); setLeadSearch(l.name); setShowLeads(false) }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: 13, color: TEXT }}>
                    <MiniAvatar name={l.name} />
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            {form.lead_id && (
              <div style={{ marginTop: 4, fontSize: 11, color: EMERALD, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 style={{ width: 11, height: 11 }} /> Lead selected
              </div>
            )}
          </div>

          {/* Task type */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Task Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TASK_TYPES.map(t => (
                <button key={t} onClick={() => { set('task_type', t); if (!form.title.trim() || form.title === TYPE_DEFAULTS[form.task_type]) set('title', TYPE_DEFAULTS[t] ?? '') }}
                  style={{ padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.task_type === t ? ORANGE : BORDER}`, background: form.task_type === t ? ORANGE_DIM : '#FAFBFC', color: form.task_type === t ? ORANGE : MUTED }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Title *</label>
            <input style={inp} placeholder="Task description..." value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          {/* Date + time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Due Date *</label>
              <input type="date" style={inp} value={form.due_date} min={new Date().toISOString().slice(0, 10)} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Time</label>
              <input type="time" style={inp} value={form.time} onChange={e => set('time', e.target.value)} />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Priority</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['High', 'Medium', 'Low'] as const).map(p => {
                const pc = PRIORITY_CFG[p]
                const active = form.priority === p
                return (
                  <button key={p} onClick={() => set('priority', p)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active ? pc.color : BORDER}`, background: active ? pc.bg : '#FAFBFC', color: active ? pc.color : MUTED }}>
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Assign to */}
          {members.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
                Assign To Agent
              </label>
              <select style={inp} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">— My task (unassigned) —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} · {m.role.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea rows={2} style={{ ...inp, resize: 'vertical', minHeight: 60 }} placeholder="Any context or details..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {err && <div style={{ fontSize: 12, color: RED, background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '8px 12px' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#F8FAFC', fontSize: 13, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave || saving}
              style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: !canSave || saving ? '#CBD5E1' : ORANGE_GRAD, fontSize: 13, fontWeight: 700, color: '#fff', cursor: !canSave || saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {saving && <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />}
              {mode === 'create' ? 'Create Task' : 'Save Changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task, members, onDone, onCancel, onEdit, busy,
}: {
  task: Task
  members: Member[]
  onDone: (id: string) => void
  onCancel: (id: string) => void
  onEdit: (task: Task) => void
  busy: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const Icon  = TASK_ICONS[task.task_type] ?? Bell
  const pc    = PRIORITY_CFG[task.priority]
  const due   = formatDue(task.due_date)
  const lname = getLeadName(task)
  const av    = avatarColor(lname)

  const isAssigned   = task.source === 'assigned' || !!task.assigned_to
  const assigneeName = task.assignee?.name ?? members.find(m => m.id === task.assigned_to)?.name ?? null

  return (
    <div
      style={{ background: PANEL, borderRadius: 14, border: `1px solid ${BORDER}`, overflow: 'hidden', opacity: busy ? 0.6 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s, transform 0.15s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)'; el.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; el.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '13px 13px 13px 14px' }}>
        {/* Priority bar */}
        <div style={{ width: 3, borderRadius: 99, background: pc.color, alignSelf: 'stretch', flexShrink: 0, minHeight: 36 }} />

        {/* Icon */}
        <div style={{ width: 34, height: 34, borderRadius: 10, background: due.overdue ? 'rgba(239,68,68,0.10)' : due.isToday ? ORANGE_DIM : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <Icon style={{ width: 15, height: 15, color: due.overdue ? RED : due.isToday ? ORANGE : MUTED }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, lineHeight: 1.4, flex: 1 }}>{task.title}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: pc.color, background: pc.bg, border: `1px solid ${pc.border}`, padding: '2px 7px', borderRadius: 99 }}>{task.priority}</span>
              {isAssigned && (
                <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, background: 'rgba(46,102,246,0.09)', border: '1px solid rgba(46,102,246,0.18)', padding: '2px 7px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <CornerDownRight style={{ width: 8, height: 8 }} /> Delegated
                </span>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Link href={`/dashboard/leads/${task.lead_id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              <div style={{ width: 17, height: 17, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: av.fg }}>{getInitials(lname)}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>{lname}</span>
            </Link>

            <span style={{ color: BORDER, fontSize: 12 }}>·</span>
            <span style={{ fontSize: 11, fontWeight: due.overdue || due.isToday ? 700 : 500, color: due.overdue ? RED : due.isToday ? ORANGE : due.isSoon ? AMBER : MUTED }}>
              {due.label}
            </span>
            <span style={{ fontSize: 11, color: LABEL }}>{due.detail}</span>

            {assigneeName && (
              <>
                <span style={{ color: BORDER, fontSize: 12 }}>·</span>
                <span style={{ fontSize: 11, color: BLUE, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                  <User style={{ width: 10, height: 10 }} /> {assigneeName}
                </span>
              </>
            )}
          </div>

          {/* Notes */}
          {task.notes && !expanded && (
            <button onClick={() => setExpanded(true)}
              style={{ fontSize: 11, color: MUTED, marginTop: 5, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', maxWidth: '100%', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.notes}
            </button>
          )}
          {task.notes && expanded && (
            <div style={{ marginTop: 6, fontSize: 11, color: MUTED, lineHeight: 1.5, background: '#F8FAFC', borderRadius: 7, padding: '7px 10px' }}>
              {task.notes}
              <button onClick={() => setExpanded(false)} style={{ display: 'block', marginTop: 4, fontSize: 10, color: LABEL, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                collapse ▲
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          <button onClick={() => onDone(task.id)} disabled={busy} title="Mark done"
            style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${EMERALD}`, background: 'rgba(5,150,105,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? <Loader2 style={{ width: 13, height: 13, color: EMERALD, animation: 'spin 1s linear infinite' }} />
                  : <CheckCircle2 style={{ width: 13, height: 13, color: EMERALD }} />}
          </button>
          <button onClick={() => onEdit(task)} title="Edit"
            style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Edit2 style={{ width: 12, height: 12, color: MUTED }} />
          </button>
          <button onClick={() => onCancel(task.id)} disabled={busy} title="Dismiss"
            style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'wait' : 'pointer' }}>
            <XCircle style={{ width: 13, height: 13, color: LABEL }} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ label, count, color, icon: Icon }: { label: string; count: number; color: string; icon: React.ElementType }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 13, height: 13, color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}14`, padding: '2px 8px', borderRadius: 99 }}>{count}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks]     = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [leads, setLeads]     = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  const [tab, setTab]               = useState<TabKey>('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'High' | 'Medium' | 'Low'>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showDone, setShowDone]     = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Task | null>(null)

  const fetchAll = useCallback(async () => {
    const [tRes, lRes] = await Promise.all([
      fetch('/api/crm/tasks'),
      fetch('/api/crm/leads?limit=300'),
    ])
    const tj = await tRes.json()
    const lj = await lRes.json()
    setTasks(tj.tasks ?? [])
    setMembers(tj.members ?? [])
    setLeads((lj.data?.leads ?? lj.leads ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleStatusChange = async (taskId: string, status: 'Done' | 'Cancelled') => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    setCompleting(taskId)
    await fetch(`/api/crm/leads/${task.lead_id}/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setCompleting(null)
    fetchAll()
  }

  const handleEditSave = async (data: TaskFormData & { id?: string }) => {
    if (!editTarget) return
    const due_date = new Date(`${data.due_date}T${data.time}:00`).toISOString()
    await fetch(`/api/crm/leads/${editTarget.lead_id}/tasks/${editTarget.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: data.title, task_type: data.task_type, due_date, priority: data.priority, notes: data.notes || null, assigned_to: data.assigned_to || null }),
    })
    fetchAll()
  }

  const handleCreateSave = async (data: TaskFormData) => {
    const due_date = new Date(`${data.due_date}T${data.time}:00`).toISOString()
    const res = await fetch('/api/crm/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: data.lead_id, title: data.title, task_type: data.task_type, due_date, priority: data.priority, notes: data.notes || null, assigned_to: data.assigned_to || null }),
    })
    if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Failed to create task') }
    fetchAll()
  }

  // ── Derived ──
  const now      = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  const tabFiltered = tasks.filter(t => {
    if (tab === 'assigned') return t.source === 'assigned' || !!t.assigned_to
    if (tab === 'self')     return !t.assigned_to
    return true
  })
  const agentFiltered  = agentFilter === 'all' ? tabFiltered : tabFiltered.filter(t => t.assigned_to === agentFilter)
  let   filtered       = agentFiltered
  if (priorityFilter !== 'all') filtered = filtered.filter(t => t.priority === priorityFilter)
  if (typeFilter     !== 'all') filtered = filtered.filter(t => t.task_type === typeFilter)

  const pending  = filtered.filter(t => t.status === 'Pending')
  const done     = filtered.filter(t => t.status !== 'Pending')
  const overdue  = pending.filter(t => { const d = new Date(t.due_date); return d < now && d.toISOString().slice(0, 10) !== todayStr })
  const today    = pending.filter(t => new Date(t.due_date).toISOString().slice(0, 10) === todayStr)
  const upcoming = pending.filter(t => { const d = new Date(t.due_date); return d > now && d.toISOString().slice(0, 10) !== todayStr })

  // KPIs from all tasks (unfiltered)
  const allPending   = tasks.filter(t => t.status === 'Pending')
  const todayAll     = tasks.filter(t => new Date(t.due_date).toISOString().slice(0, 10) === todayStr)
  const todayDone    = todayAll.filter(t => t.status === 'Done').length
  const todayPct     = todayAll.length > 0 ? Math.round((todayDone / todayAll.length) * 100) : 0
  const kpiOverdue   = allPending.filter(t => { const d = new Date(t.due_date); return d < now && d.toISOString().slice(0, 10) !== todayStr }).length
  const kpiToday     = allPending.filter(t => new Date(t.due_date).toISOString().slice(0, 10) === todayStr).length
  const kpiDelegate  = allPending.filter(t => !!t.assigned_to).length

  const taskTypes = Array.from(new Set(tasks.map(t => t.task_type))).sort()

  const editInitial = editTarget ? {
    id: editTarget.id, lead_id: editTarget.lead_id, leadName: getLeadName(editTarget),
    title: editTarget.title, task_type: editTarget.task_type,
    due_date: editTarget.due_date.slice(0, 10),
    time: new Date(editTarget.due_date).toTimeString().slice(0, 5),
    priority: editTarget.priority, notes: editTarget.notes ?? '',
    assigned_to: editTarget.assigned_to ?? '',
  } : undefined

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 style={{ width: 28, height: 28, color: ORANGE, animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT, margin: '0 0 4px', letterSpacing: '-0.04em' }}>Tasks</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              {allPending.length === 0 ? 'All caught up 🎉' : `${allPending.length} pending · ${kpiDelegate} delegated to agents`}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: ORANGE_GRAD, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,112,67,0.28)' }}>
            <Plus style={{ width: 14, height: 14 }} /> New Task
          </button>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Overdue',    value: kpiOverdue,  color: RED,     Icon: AlertTriangle },
            { label: 'Due Today',  value: kpiToday,    color: ORANGE,  Icon: Flame },
            { label: 'Done Today', value: todayDone,   color: EMERALD, Icon: Trophy },
            { label: 'Delegated',  value: kpiDelegate, color: BLUE,    Icon: Users },
          ].map(k => (
            <div key={k.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${k.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <k.Icon style={{ width: 13, height: 13, color: k.color }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.value > 0 ? k.color : LABEL, letterSpacing: '-0.04em', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 3, fontWeight: 500 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {todayAll.length > 0 && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '13px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Today's Progress</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: todayPct === 100 ? EMERALD : ORANGE }}>{todayDone} / {todayAll.length} done</span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: todayPct === 100 ? EMERALD : ORANGE_GRAD, width: `${todayPct}%`, transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: todayPct === 100 ? EMERALD : ORANGE, letterSpacing: '-0.04em', minWidth: 44, textAlign: 'right' }}>{todayPct}%</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 4 }}>
          {([
            { key: 'all',      label: 'All Tasks',            count: allPending.length },
            { key: 'assigned', label: 'Delegated to Agents',  count: kpiDelegate },
            { key: 'self',     label: 'My Tasks',             count: allPending.filter(t => !t.assigned_to).length },
          ] as { key: TabKey; label: string; count: number }[]).map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setAgentFilter('all') }}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: 'none', background: tab === t.key ? ORANGE_DIM : 'transparent', color: tab === t.key ? ORANGE : MUTED, fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.12s' }}>
              {t.label}
              <span style={{ fontSize: 10, fontWeight: 700, background: tab === t.key ? ORANGE : '#F1F5F9', color: tab === t.key ? '#fff' : MUTED, padding: '1px 6px', borderRadius: 99 }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Agent chips (Delegated tab) */}
        {tab === 'assigned' && members.length > 0 && (() => {
          const chipsToShow = members.filter(m => allPending.some(t => t.assigned_to === m.id))
          if (chipsToShow.length === 0) return null
          return (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {chipsToShow.map(m => {
                const cnt = allPending.filter(t => t.assigned_to === m.id).length
                const rc  = ROLE_COLOR[m.role] ?? ORANGE
                const sel = agentFilter === m.id
                return (
                  <button key={m.id} onClick={() => setAgentFilter(sel ? 'all' : m.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 99, border: `1px solid ${sel ? rc : BORDER}`, background: sel ? `${rc}10` : PANEL, cursor: 'pointer', fontSize: 12, color: sel ? rc : MUTED, fontWeight: sel ? 700 : 500 }}>
                    <MiniAvatar name={m.name} size={18} />
                    {m.name}
                    <span style={{ fontWeight: 700, color: rc }}>{cnt}</span>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['all', 'High', 'Medium', 'Low'] as const).map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${priorityFilter === p ? ORANGE : BORDER}`, background: priorityFilter === p ? ORANGE_DIM : PANEL, color: priorityFilter === p ? ORANGE : MUTED }}>
              {p === 'all' ? 'All Priorities' : p}
            </button>
          ))}
          {taskTypes.length > 0 && (
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, border: `1px solid ${typeFilter !== 'all' ? ORANGE : BORDER}`, background: typeFilter !== 'all' ? ORANGE_DIM : PANEL, color: typeFilter !== 'all' ? ORANGE : MUTED, cursor: 'pointer', outline: 'none' }}>
              <option value="all">All Types</option>
              {taskTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {members.length > 0 && tab === 'all' && (
            <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, border: `1px solid ${agentFilter !== 'all' ? BLUE : BORDER}`, background: agentFilter !== 'all' ? 'rgba(46,102,246,0.08)' : PANEL, color: agentFilter !== 'all' ? BLUE : MUTED, cursor: 'pointer', outline: 'none' }}>
              <option value="all">All Agents</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>

        {/* Task sections */}
        {pending.length === 0 ? (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '52px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{tab === 'assigned' ? '👥' : '🎉'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: '-0.03em', marginBottom: 6 }}>
              {tab === 'assigned' ? 'No delegated tasks' : tab === 'self' ? 'No personal tasks' : 'All caught up!'}
            </div>
            <div style={{ fontSize: 13, color: MUTED, maxWidth: 260, margin: '0 auto 20px' }}>
              {tab === 'assigned' ? 'Assign tasks to agents from any lead.' : 'You\'re on top of things. Keep closing!'}
            </div>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: ORANGE_GRAD, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + New Task
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {overdue.length > 0 && (
              <div>
                <SectionHead label="Overdue" count={overdue.length} color={RED} icon={AlertTriangle} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {overdue.map(t => <TaskCard key={t.id} task={t} members={members} onDone={id => handleStatusChange(id, 'Done')} onCancel={id => handleStatusChange(id, 'Cancelled')} onEdit={setEditTarget} busy={completing === t.id} />)}
                </div>
              </div>
            )}
            {today.length > 0 && (
              <div>
                <SectionHead label="Due Today" count={today.length} color={ORANGE} icon={Flame} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {today.map(t => <TaskCard key={t.id} task={t} members={members} onDone={id => handleStatusChange(id, 'Done')} onCancel={id => handleStatusChange(id, 'Cancelled')} onEdit={setEditTarget} busy={completing === t.id} />)}
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <SectionHead label="Upcoming" count={upcoming.length} color={BLUE} icon={Zap} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {upcoming.map(t => <TaskCard key={t.id} task={t} members={members} onDone={id => handleStatusChange(id, 'Done')} onCancel={id => handleStatusChange(id, 'Cancelled')} onEdit={setEditTarget} busy={completing === t.id} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completed */}
        {done.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <button onClick={() => setShowDone(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: MUTED, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <CheckCircle2 style={{ width: 13, height: 13, color: EMERALD }} />
              {showDone ? 'Hide' : 'Show'} completed ({done.length})
              <ChevronDown style={{ width: 12, height: 12, transition: 'transform 0.2s', transform: showDone ? 'rotate(180deg)' : 'none' }} />
            </button>
            {showDone && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {done.slice(0, 30).map(t => (
                  <div key={t.id} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', opacity: 0.5 }}>
                    <CheckCircle2 style={{ width: 14, height: 14, color: t.status === 'Done' ? EMERALD : LABEL, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: MUTED, textDecoration: 'line-through', flex: 1 }}>{t.title}</span>
                    <span style={{ fontSize: 11, color: LABEL }}>{getLeadName(t)}</span>
                    {t.assignee && <span style={{ fontSize: 11, color: BLUE, display: 'flex', alignItems: 'center', gap: 3 }}><User style={{ width: 10, height: 10 }} /> {t.assignee.name}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {showCreate && (
        <TaskFormModal mode="create" leads={leads} members={members} onClose={() => setShowCreate(false)} onSave={handleCreateSave} />
      )}
      {editTarget && (
        <TaskFormModal mode="edit" initial={editInitial} leads={leads} members={members} onClose={() => setEditTarget(null)} onSave={handleEditSave} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
