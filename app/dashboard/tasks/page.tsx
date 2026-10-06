'use client'

// Tasks (Workspace → Tasks): every follow-up, call back and site visit across your leads.
// Same tokens, cards and buttons as the Leads, Pipeline, Outreach, Today and Team pages (components/outreach/OutreachKit).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Bell, Phone, Eye, FileText, Buildings, ChatCircle, Target, Plus, Check, X, MagnifyingGlass, PencilSimple,
  Warning, CalendarBlank, CalendarDots, Clock, ClockClockwise, ArrowCounterClockwise, ArrowBendDownRight,
  UsersThree, WhatsappLogo, ListChecks, Kanban, Rows, CaretDown, CaretRight, Trophy, Fire, User,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import {
  CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, MUTED, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, GREEN, RED, XS, DAY, HOUR,
  type Tone, TONE,
  Avatar, Pill, Btn, inputCls, textareaCls, inputStyle, Field, Seg, Chip, Select, PageHeader, Badge, StatCard, StackBar,
  EmptyState, Dialog, Toast, useToast, pct, formatPhone, telHref, waHref,
} from '@/components/outreach/OutreachKit'

const WORKSPACE_TABS = [
  { label: 'Tasks', href: '/dashboard/tasks' },
  { label: 'Team',  href: '/dashboard/team', teamsOnly: true },
]

// ─── Types ────────────────────────────────────────────────────────────────────
type Member = { id: string; name: string; role: string }
type Priority = 'High' | 'Medium' | 'Low'
type Status = 'Pending' | 'Done' | 'Cancelled'

type Task = {
  id: string
  lead_id: string
  title: string
  task_type: string
  due_date: string
  priority: Priority
  status: Status
  notes: string | null
  assigned_to: string | null
  created_by: string | null
  source: 'self' | 'assigned'
  created_at?: string | null
  updated_at?: string | null
  leads?: { id: string; name: string; phone: string | null } | null
  assignee?: { name: string; role: string } | null
  creator?: { name: string; role: string } | null
}

type LeadOption = { id: string; name: string; phone: string | null; city: string | null }

type Owner = 'all' | 'self' | 'assigned'
type View = 'list' | 'board'
type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later'

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

const TYPE_META: Record<string, { Icon: typeof Bell; color: string; bg: string }> = {
  'Follow Up':     { Icon: Bell,       color: '#1D4ED8', bg: '#EFF4FF' },
  'Call Back':     { Icon: Phone,      color: '#067647', bg: '#ECFDF3' },
  'Site Visit':    { Icon: Eye,        color: '#B54708', bg: '#FFFAEB' },
  'Send Brochure': { Icon: FileText,   color: '#5925DC', bg: '#F4F3FF' },
  'Meeting':       { Icon: Buildings,  color: '#C11574', bg: '#FDF2FA' },
  'Send Proposal': { Icon: FileText,   color: '#026AA2', bg: '#F0F9FF' },
  'Check In':      { Icon: ChatCircle, color: '#344054', bg: '#F2F4F7' },
  'Custom':        { Icon: Target,     color: '#344054', bg: '#F2F4F7' },
}
const typeMeta = (t: string) => TYPE_META[t] ?? TYPE_META.Custom

const PRIORITY_TONE: Record<Priority, Tone> = { High: 'red', Medium: 'amber', Low: 'neutral' }
const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }
const ROLE_LABEL: Record<string, string> = { agent: 'Agent', senior_agent: 'Sr. Agent', manager: 'Manager' }

const BUCKETS: { id: Bucket; label: string; dot: string; empty: string }[] = [
  { id: 'overdue',  label: 'Overdue',   dot: RED,       empty: 'Nothing overdue' },
  { id: 'today',    label: 'Today',     dot: BLUE,      empty: 'Nothing due today' },
  { id: 'tomorrow', label: 'Tomorrow',  dot: '#7A5AF8', empty: 'Nothing due tomorrow' },
  { id: 'week',     label: 'This week', dot: '#F79009', empty: 'Nothing else this week' },
  { id: 'later',    label: 'Later',     dot: LABEL,     empty: 'Nothing scheduled later' },
]
// Where a card dropped on a board column lands, in days from today (time of day is kept)
const DROP_DAYS: Partial<Record<Bucket, number>> = { today: 0, tomorrow: 1, week: 2, later: 7 }

// ─── Dates ────────────────────────────────────────────────────────────────────
// Local calendar day (toISOString would give the UTC day, which is yesterday before 5:30 am in India)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const midnight = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const dayDiff = (a: number, b: number) => Math.round((midnight(a) - midnight(b)) / DAY)
const timeText = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
const dateText = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

/** Same clock time, n days from today */
function onDay(task: Task, days: number, now: number) {
  const due = new Date(task.due_date)
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(due.getHours(), due.getMinutes(), 0, 0)
  return d.toISOString()
}
function at(now: number, days: number, h: number, m = 0) {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function bucketOf(t: Task, now: number): Bucket {
  const due = new Date(t.due_date).getTime()
  const days = dayDiff(due, now)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 6) return 'week'
  return 'later'
}

function dueInfo(t: Task, now: number): { text: string; tone: Tone; late?: string } {
  const d = new Date(t.due_date)
  const days = dayDiff(d.getTime(), now)
  if (t.status !== 'Pending') return { text: `${dateText(d)}, ${timeText(d)}`, tone: 'neutral' }
  if (days < 0) {
    const n = -days
    return { text: n === 1 ? 'Yesterday' : `${n} days overdue`, tone: 'red', late: `was due ${dateText(d)}` }
  }
  if (days === 0) {
    const late = now > d.getTime() ? Math.round((now - d.getTime()) / HOUR) : 0
    return { text: `Today, ${timeText(d)}`, tone: late >= 1 ? 'red' : 'blue', late: late >= 1 ? `${late}h late` : undefined }
  }
  if (days === 1) return { text: `Tomorrow, ${timeText(d)}`, tone: 'violet' }
  return { text: `${dateText(d)}, ${timeText(d)}`, tone: 'neutral' }
}

function snoozeOptions(t: Task, now: number) {
  const opts: { id: string; label: string; hint: string; iso: string }[] = []
  const inHour = new Date(Math.ceil((now + HOUR) / (15 * 60_000)) * 15 * 60_000)
  opts.push({ id: 'hour', label: 'In 1 hour', hint: timeText(inHour), iso: inHour.toISOString() })
  if (new Date(now).getHours() < 17) opts.push({ id: 'evening', label: 'This evening', hint: '6:00 pm', iso: at(now, 0, 18) })
  opts.push({ id: 'tomorrow', label: 'Tomorrow morning', hint: dateText(new Date(at(now, 1, 10))) + ', 10:00 am', iso: at(now, 1, 10) })
  opts.push({ id: 'three', label: 'In 3 days', hint: dateText(new Date(onDay(t, 3, now))), iso: onDay(t, 3, now) })
  const dow = new Date(now).getDay()
  const toMon = ((8 - dow) % 7) || 7
  opts.push({ id: 'monday', label: 'Next Monday', hint: dateText(new Date(at(now, toMon, 10))) + ', 10:00 am', iso: at(now, toMon, 10) })
  return opts
}

const leadName = (t: Task) => t.leads?.name?.trim() || 'Unknown lead'
const isDelegated = (t: Task) => t.source === 'assigned' || !!t.assigned_to

// ─── Data ─────────────────────────────────────────────────────────────────────
async function fetchTasks(): Promise<{ tasks: Task[]; members: Member[] }> {
  const r = await fetch('/api/crm/tasks')
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? `Could not load tasks (${r.status})`)
  return { tasks: (j.tasks ?? []) as Task[], members: (j.members ?? []) as Member[] }
}

type CrmLeadRow = { id: string; name?: { firstName?: string; lastName?: string } | string; phones?: { primaryPhoneNumber?: string }; city?: string | null }
async function searchLeads(q: string): Promise<LeadOption[]> {
  const r = await fetch(`/api/crm/leads?limit=8${q ? `&search=${encodeURIComponent(q)}` : ''}`)
  if (!r.ok) return []
  const j = await r.json().catch(() => ({}))
  const rows = (j.data?.leads ?? j.leads ?? []) as CrmLeadRow[]
  return rows.map(l => ({
    id: l.id,
    // /api/crm/leads returns { firstName, lastName }, not a string
    name: typeof l.name === 'string' ? l.name : `${l.name?.firstName ?? ''} ${l.name?.lastName ?? ''}`.trim() || 'Unnamed',
    phone: l.phones?.primaryPhoneNumber || null,
    city: l.city ?? null,
  }))
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
/** Popover anchored under its trigger. Closes on outside click or Escape. */
function Popover({ open, onOpenChange, trigger, children, align = 'left', width = 240 }: {
  open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactNode; children: ReactNode; align?: 'left' | 'right'; width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Keep the panel inside the viewport on narrow screens
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!open || !el) return
    el.style.transform = ''
    const r = el.getBoundingClientRect()
    const over = r.right - (document.documentElement.clientWidth - 12)
    if (over > 0) el.style.transform = `translateX(${-Math.min(over, r.left - 12)}px)`
    else if (r.left < 12) el.style.transform = `translateX(${12 - r.left}px)`
  }, [open])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, onOpenChange])
  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div ref={panelRef} role="menu"
          className={`absolute top-[calc(100%+6px)] z-40 rounded-[12px] border bg-white p-1.5 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)] ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ borderColor: BORDER, width, maxWidth: 'calc(100vw - 24px)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function MenuButton({ onClick, children, hint, tone }: { onClick: () => void; children: ReactNode; hint?: string; tone?: 'red' }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[14px] font-medium transition-colors hover:bg-[#F9FAFB]"
      style={{ color: tone === 'red' ? TONE.red.color : TEXT_2 }}>
      <span className="flex min-w-0 items-center gap-2">{children}</span>
      {hint && <span className="shrink-0 text-[12.5px] font-normal" style={{ color: SUBTLE }}>{hint}</span>}
    </button>
  )
}

function IconBtn({ label, onClick, children, href, tone }: { label: string; onClick?: () => void; children: ReactNode; href?: string; tone?: string }) {
  const cls = 'grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] border bg-white no-underline transition-colors hover:bg-[#F9FAFB]'
  const style = { borderColor: BORDER, color: tone ?? TEXT_2, boxShadow: XS }
  if (href) return <a href={href} aria-label={label} title={label} className={cls} style={style} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{children}</a>
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={cls} style={style}>{children}</button>
}

function TypeTile({ type, size = 36, dim }: { type: string; size?: number; dim?: boolean }) {
  const m = typeMeta(type)
  return (
    <span className="grid shrink-0 place-items-center rounded-[10px]" title={type}
      style={{ width: size, height: size, background: dim ? '#F2F4F7' : m.bg, color: dim ? LABEL : m.color }}>
      <m.Icon size={Math.round(size * 0.47)} weight="bold" />
    </span>
  )
}

/** The round checkbox that completes a task */
function DoneCircle({ onClick, busy, done, size = 24 }: { onClick: () => void; busy?: boolean; done?: boolean; size?: number }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-label={done ? 'Reopen task' : 'Mark done'} title={done ? 'Reopen' : 'Mark done'}
      className="group/done grid shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors disabled:cursor-wait"
      style={{ width: size, height: size, borderColor: done ? GREEN : BORDER_2, background: done ? GREEN : CANVAS }}>
      <Check size={Math.round(size * 0.55)} weight="bold"
        className={done ? '' : 'opacity-0 transition-opacity group-hover/done:opacity-100'} style={{ color: done ? '#fff' : GREEN }} />
    </button>
  )
}

function Meter({ value, max, color = BLUE, height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: '#F2F4F7' }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}

function Ring({ value, max, size = 92, stroke = 9, color = BLUE, children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const p = max > 0 ? Math.min(value / max, 1) : 0
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EAECF0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">{children}</span>
    </span>
  )
}

/** Seven small columns: tasks due on each of the next 7 days */
function WeekBars({ days }: { days: { key: string; label: string; short: string; count: number; today: boolean }[] }) {
  const max = Math.max(1, ...days.map(d => d.count))
  return (
    <div className="grid grid-cols-7 items-end gap-1.5" style={{ height: 64 }}>
      {days.map(d => (
        <div key={d.key} className="flex h-full min-w-0 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.count}`}>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: d.count ? TEXT_2 : LABEL }}>{d.count || ''}</span>
          <span className="w-full rounded-[4px]" style={{ height: `${Math.max(6, (d.count / max) * 34)}px`, background: d.count ? (d.today ? BLUE : '#84ADFF') : '#F2F4F7' }} />
          <span className="text-[11px] font-medium" style={{ color: d.today ? BLUE : SUBTLE }}>
            <span className="sm:hidden">{d.short}</span><span className="hidden sm:inline">{d.label}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Task row (list view) ─────────────────────────────────────────────────────
function TaskRow({ task, now, selected, busy, onSelect, onDone, onSnooze, onEdit, onDismiss, assigneeName }: {
  task: Task; now: number; selected: boolean; busy: boolean; assigneeName: string | null
  onSelect: (on: boolean) => void; onDone: () => void; onSnooze: (iso: string, label: string) => void; onEdit: () => void; onDismiss: () => void
}) {
  const [notesOpen, setNotesOpen] = useState(false)
  // Phone and desktop each get their own menu state: the hidden copy must stay closed,
  // or its outside-click handler would close the visible one before a choice registers
  const [menuPhone, setMenuPhone] = useState(false)
  const [menuDesk, setMenuDesk] = useState(false)
  const due = dueInfo(task, now)
  const name = leadName(task)
  const phone = task.leads?.phone ?? null
  return (
    <li className={`group relative flex gap-3 px-3 py-3.5 transition-colors last:rounded-b-[16px] sm:px-4 ${selected ? 'bg-[#F5F8FF]' : 'hover:bg-[#FCFCFD]'}`}
      style={{ opacity: busy ? 0.55 : 1 }}>
      {task.priority === 'High' && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: RED }} aria-hidden />}
      <input type="checkbox" checked={selected} onChange={e => onSelect(e.target.checked)} aria-label={`Select ${task.title}`}
        className="mt-[11px] hidden size-4 shrink-0 cursor-pointer accent-[#1D4ED8] sm:block" />
      <div className="mt-1.5"><DoneCircle onClick={onDone} busy={busy} /></div>
      <div className="hidden sm:block"><TypeTile type={task.task_type} /></div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-[15px] font-semibold leading-snug" style={{ color: TEXT }}>{task.title}</span>
          <Pill small tone={PRIORITY_TONE[task.priority]}>{task.priority}</Pill>
          {isDelegated(task) && <Pill small tone="blue"><ArrowBendDownRight size={11} weight="bold" />Delegated</Pill>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
          <Link href={`/dashboard/leads/${task.lead_id}`} className="inline-flex min-w-0 items-center gap-1.5 font-semibold no-underline hover:underline" style={{ color: BLUE }}>
            <Avatar name={name} size={20} />
            <span className="truncate">{name}</span>
          </Link>
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: TONE[due.tone].color }}>
            <Clock size={13} weight="bold" />{due.text}
            {due.late && <span className="font-normal" style={{ color: SUBTLE }}>· {due.late}</span>}
          </span>
          <span className="inline-flex items-center gap-1 sm:hidden" style={{ color: SUBTLE }}>{task.task_type}</span>
          {assigneeName && (
            <span className="inline-flex items-center gap-1.5" style={{ color: TEXT_2 }}>
              <Avatar name={assigneeName} size={18} />{assigneeName}
            </span>
          )}
        </div>
        {task.notes && (
          <button type="button" onClick={() => setNotesOpen(o => !o)}
            className={`mt-2 block max-w-full cursor-pointer rounded-[8px] px-2.5 py-1.5 text-left text-[13px] leading-relaxed ${notesOpen ? '' : 'truncate'}`}
            style={{ background: SURFACE, color: MUTED }} title={notesOpen ? 'Show less' : 'Show all'}>
            {task.notes}
          </button>
        )}
        {/* Phone: actions under the task */}
        <div className="mt-2.5 flex items-center gap-1.5 sm:hidden">
          {phone && <IconBtn label="Call" href={telHref(phone)} tone="#067647"><Phone size={15} weight="bold" /></IconBtn>}
          {phone && <IconBtn label="WhatsApp" href={waHref(phone)} tone="#25D366"><WhatsappLogo size={16} weight="fill" /></IconBtn>}
          <SnoozeMenu task={task} now={now} open={menuPhone} setOpen={setMenuPhone} onPick={onSnooze} onCustom={onEdit} align="left" />
          <IconBtn label="Edit" onClick={onEdit}><PencilSimple size={15} weight="bold" /></IconBtn>
          <IconBtn label="Dismiss" onClick={onDismiss}><X size={15} weight="bold" /></IconBtn>
        </div>
      </div>

      {/* Desktop: actions on the right */}
      <div className="hidden shrink-0 items-start gap-1.5 sm:flex">
        {phone && <IconBtn label={`Call ${formatPhone(phone)}`} href={telHref(phone)} tone="#067647"><Phone size={15} weight="bold" /></IconBtn>}
        {phone && <IconBtn label="WhatsApp" href={waHref(phone)} tone="#25D366"><WhatsappLogo size={16} weight="fill" /></IconBtn>}
        <SnoozeMenu task={task} now={now} open={menuDesk} setOpen={setMenuDesk} onPick={onSnooze} onCustom={onEdit} />
        <IconBtn label="Edit" onClick={onEdit}><PencilSimple size={15} weight="bold" /></IconBtn>
        <IconBtn label="Dismiss" onClick={onDismiss}><X size={15} weight="bold" /></IconBtn>
      </div>
    </li>
  )
}

function SnoozeMenu({ task, now, open, setOpen, onPick, onCustom, align = 'right' }: {
  task: Task; now: number; open: boolean; setOpen: (o: boolean) => void; onPick: (iso: string, label: string) => void; onCustom: () => void; align?: 'left' | 'right'
}) {
  return (
    <Popover open={open} onOpenChange={setOpen} align={align} width={270}
      trigger={<IconBtn label="Reschedule" onClick={() => setOpen(!open)}><ClockClockwise size={15} weight="bold" /></IconBtn>}>
      <div className="px-2.5 pb-1.5 pt-1.5 text-[12px] font-semibold" style={{ color: SUBTLE }}>Move to</div>
      {snoozeOptions(task, now).map(o => (
        <MenuButton key={o.id} hint={o.hint} onClick={() => { setOpen(false); onPick(o.iso, o.label.toLowerCase()) }}>{o.label}</MenuButton>
      ))}
      <div className="my-1 h-px" style={{ background: BORDER }} />
      <MenuButton onClick={() => { setOpen(false); onCustom() }}><CalendarBlank size={15} weight="bold" />Pick a date and time</MenuButton>
    </Popover>
  )
}

// ─── Board card ───────────────────────────────────────────────────────────────
function BoardCard({ task, now, busy, assigneeName, onDone, onSnooze, onEdit, onDismiss, onDragStart }: {
  task: Task; now: number; busy: boolean; assigneeName: string | null
  onDone: () => void; onSnooze: (iso: string, label: string) => void; onEdit: () => void; onDismiss: () => void; onDragStart: (e: DragEvent) => void
}) {
  const [menu, setMenu] = useState(false)
  const due = dueInfo(task, now)
  const name = leadName(task)
  return (
    <li draggable onDragStart={onDragStart}
      className="cursor-grab rounded-[12px] border bg-white p-3 active:cursor-grabbing"
      style={{ borderColor: BORDER, boxShadow: XS, opacity: busy ? 0.55 : 1, borderLeft: task.priority === 'High' ? `3px solid ${RED}` : undefined }}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5"><DoneCircle onClick={onDone} busy={busy} size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-snug" style={{ color: TEXT }}>{task.title}</div>
          <Link href={`/dashboard/leads/${task.lead_id}`} className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-[13px] font-semibold no-underline hover:underline" style={{ color: BLUE }}>
            <Avatar name={name} size={18} /><span className="truncate">{name}</span>
          </Link>
        </div>
        <TypeTile type={task.task_type} size={28} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Pill small tone={due.tone}><Clock size={11} weight="bold" />{due.text}</Pill>
        {task.priority !== 'Low' && <Pill small tone={PRIORITY_TONE[task.priority]}>{task.priority}</Pill>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5" style={{ borderColor: '#F2F4F7' }}>
        {assigneeName
          ? <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px]" style={{ color: TEXT_2 }}><Avatar name={assigneeName} size={18} /><span className="truncate">{assigneeName}</span></span>
          : <span className="text-[12.5px]" style={{ color: LABEL }}>Your task</span>}
        <div className="flex items-center gap-1">
          <SnoozeMenu task={task} now={now} open={menu} setOpen={setMenu} onPick={onSnooze} onCustom={onEdit} />
          <IconBtn label="Edit" onClick={onEdit}><PencilSimple size={14} weight="bold" /></IconBtn>
          <IconBtn label="Dismiss" onClick={onDismiss}><X size={14} weight="bold" /></IconBtn>
        </div>
      </div>
    </li>
  )
}

// ─── Create / edit dialog ─────────────────────────────────────────────────────
type FormData = { lead: LeadOption | null; title: string; task_type: string; date: string; time: string; priority: Priority; notes: string; assigned_to: string }

function TaskDialog({ task, members, now, onClose, onSaved }: {
  task: Task | null; members: Member[]; now: number; onClose: () => void; onSaved: (msg: string) => void
}) {
  const editing = !!task
  const start = task ? new Date(task.due_date) : null
  const [f, setF] = useState<FormData>(() => ({
    lead: task ? { id: task.lead_id, name: leadName(task), phone: task.leads?.phone ?? null, city: null } : null,
    title: task?.title ?? TYPE_DEFAULTS['Follow Up'],
    task_type: task?.task_type ?? 'Follow Up',
    date: start ? ymd(start) : ymd(new Date(now)),
    time: start ? hhmm(start) : '10:00',
    priority: task?.priority ?? 'Medium',
    notes: task?.notes ?? '',
    assigned_to: task?.assigned_to ?? '',
  }))
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setF(p => ({ ...p, [k]: v }))
  const [q, setQ] = useState('')
  const [results, setResults] = useState<LeadOption[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lead search, debounced, straight from /api/crm/leads (so it covers every lead, not just the first few hundred)
  useEffect(() => {
    if (editing || f.lead) return
    let live = true
    const timer = setTimeout(() => {
      setSearching(true)
      searchLeads(q.trim()).then(r => { if (live) { setResults(r); setSearching(false) } })
    }, q ? 250 : 0)
    return () => { live = false; clearTimeout(timer) }
  }, [q, editing, f.lead])

  const pickType = (t: string) => setF(p => ({
    ...p, task_type: t,
    title: !p.title.trim() || p.title === TYPE_DEFAULTS[p.task_type] ? (TYPE_DEFAULTS[t] ?? '') : p.title,
  }))

  const quick = [
    { label: 'Today', days: 0 },
    { label: 'Tomorrow', days: 1 },
    { label: 'In 3 days', days: 3 },
    { label: 'Next week', days: 7 },
  ].map(x => { const d = new Date(now); d.setDate(d.getDate() + x.days); return { ...x, date: ymd(d) } })

  const canSave = !!f.lead && !!f.title.trim() && !!f.date && !!f.time
  const save = async () => {
    if (!canSave || !f.lead) return
    setSaving(true); setError(null)
    const body = {
      title: f.title.trim(), task_type: f.task_type, priority: f.priority,
      due_date: new Date(`${f.date}T${f.time}:00`).toISOString(),
      notes: f.notes.trim() || null, assigned_to: f.assigned_to || null,
    }
    try {
      const res = task
        ? await fetch(`/api/crm/leads/${task.lead_id}/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/crm/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, lead_id: f.lead.id }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? `Server error ${res.status}`)
      onSaved(task ? 'Task updated' : `Task added for ${f.lead.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the task'); setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} width={560} icon={editing ? <PencilSimple size={18} /> : <ListChecks size={18} />}
      title={editing ? 'Edit task' : 'New task'}
      sub={editing ? 'Change what, when, or who does it.' : 'Pick a lead, then say what needs doing and when.'}
      footer={<>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={save} disabled={!canSave || saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create task'}</Btn>
      </>}>
      <div className="flex flex-col gap-5">
        {/* Lead */}
        <Field label="Lead" htmlFor="task-lead" hint={editing ? 'A task stays with the lead it was made for.' : undefined}>
          {f.lead ? (
            <div className="flex items-center gap-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: BLUE_LN, background: BLUE_BG }}>
              <Avatar name={f.lead.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{f.lead.name}</div>
                {(f.lead.phone || f.lead.city) && <div className="truncate text-[12.5px]" style={{ color: SUBTLE }}>{[f.lead.phone && formatPhone(f.lead.phone), f.lead.city].filter(Boolean).join(' · ')}</div>}
              </div>
              {!editing && <Btn size="sm" onClick={() => { set('lead', null); setQ('') }}>Change</Btn>}
            </div>
          ) : (
            <div>
              <div className="relative">
                <MagnifyingGlass size={16} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: LABEL }} />
                <input id="task-lead" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone or CS ID"
                  className={`${inputCls} pl-9`} style={inputStyle} autoComplete="off" />
              </div>
              <ul className="m-0 mt-2 max-h-[220px] list-none overflow-y-auto rounded-[12px] border p-1" style={{ borderColor: BORDER }}>
                {results.map(l => (
                  <li key={l.id}>
                    <button type="button" onClick={() => set('lead', l)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-[#F9FAFB]">
                      <Avatar name={l.name} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold" style={{ color: TEXT }}>{l.name}</span>
                        <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{[l.phone && formatPhone(l.phone), l.city].filter(Boolean).join(' · ') || 'No phone saved'}</span>
                      </span>
                      <CaretRight size={14} weight="bold" style={{ color: LABEL }} />
                    </button>
                  </li>
                ))}
                {!results.length && (
                  <li className="px-3 py-4 text-center text-[13px]" style={{ color: SUBTLE }}>{searching ? 'Searching…' : q ? `No leads match "${q}"` : 'No leads yet'}</li>
                )}
              </ul>
            </div>
          )}
        </Field>

        {/* Type */}
        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {TASK_TYPES.map(t => {
              const m = typeMeta(t)
              return <Chip key={t} on={f.task_type === t} onClick={() => pickType(t)} icon={<m.Icon size={14} weight="bold" />}>{t}</Chip>
            })}
          </div>
        </Field>

        <Field label="What needs doing" htmlFor="task-title">
          <input id="task-title" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Call back about the 3BHK in Baner" className={inputCls} style={inputStyle} />
        </Field>

        {/* When */}
        <Field label="When">
          <div className="mb-2 flex flex-wrap gap-2">
            {quick.map(x => <Chip key={x.label} on={f.date === x.date} onClick={() => set('date', x.date)}>{x.label}</Chip>)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input id="task-date" type="date" aria-label="Date" value={f.date} min={editing ? undefined : ymd(new Date(now))} onChange={e => set('date', e.target.value)} className={inputCls} style={inputStyle} />
            <input id="task-time" type="time" aria-label="Time" value={f.time} onChange={e => set('time', e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Priority">
            <Seg label="Priority" full value={f.priority} onChange={v => set('priority', v)}
              options={(['High', 'Medium', 'Low'] as const).map(p => ({ id: p, label: p }))} />
          </Field>
          <Field label="Who does it" htmlFor="task-owner">
            <Select id="task-owner" value={f.assigned_to} onChange={v => set('assigned_to', v)}>
              <option value="">Me (not delegated)</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name} · {ROLE_LABEL[m.role] ?? m.role}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Notes" htmlFor="task-notes">
          <textarea id="task-notes" rows={3} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything to remember before you call" className={textareaCls} style={inputStyle} />
        </Field>

        {error && <div className="rounded-[10px] border px-3 py-2.5 text-[13.5px]" style={{ color: TONE.red.color, background: TONE.red.bg, borderColor: TONE.red.border }}>{error}</div>}
      </div>
    </Dialog>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-[160px] rounded-[18px]" style={{ background: '#F2F4F7' }} />)}
      </div>
      <div className="mt-6 h-[52px] rounded-[12px]" style={{ background: '#F2F4F7' }} />
      <div className="mt-4 h-[420px] rounded-[16px]" style={{ background: '#F2F4F7' }} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [now,     setNow]     = useState(0)

  const [view,     setView]     = useState<View>('list')
  const [owner,    setOwner]    = useState<Owner>('all')
  const [agent,    setAgent]    = useState('all')
  const [priority, setPriority] = useState<'all' | Priority>('all')
  const [type,     setType]     = useState('all')
  const [query,    setQuery]    = useState('')
  const [day,      setDay]      = useState<string | null>(null)   // 'overdue' or a yyyy-mm-dd from the week strip
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy,     setBusy]     = useState<Set<string>>(new Set())
  const [showDone, setShowDone] = useState(false)
  const [editing,  setEditingRaw] = useState<Task | 'new' | null>(null)
  const [dragOver, setDragOver] = useState<Bucket | null>(null)
  const [bulkMenu, setBulkMenu] = useState(false)
  const { toast, show, hide } = useToast()
  const setEditing = (t: Task | 'new' | null) => { if (t) hide(); setEditingRaw(t) }

  const load = useCallback(() => fetchTasks()
    .then(d => { setTasks(d.tasks); setMembers(d.members); setLoadErr(null) })
    .catch((e: Error) => setLoadErr(e.message || 'Could not load tasks'))
    .finally(() => { setNow(new Date().getTime()); setLoading(false) }), [])

  useEffect(() => { load() }, [load])
  // Keep "overdue" and "late" honest while the page stays open
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date().getTime()), 60_000)
    return () => clearInterval(tick)
  }, [])

  const memberName = useCallback((t: Task) =>
    t.assigned_to ? (t.assignee?.name ?? members.find(m => m.id === t.assigned_to)?.name ?? 'Agent') : null, [members])

  // ── Changing tasks (optimistic, with Undo) ──
  const patchTask = useCallback(async (t: Task, body: Partial<Pick<Task, 'status' | 'due_date' | 'assigned_to'>>) => {
    const stamp = new Date().toISOString()
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, ...body, updated_at: stamp, ...(body.assigned_to !== undefined ? { source: body.assigned_to ? 'assigned' : 'self', assignee: null } : {}) } : x))
    setBusy(b => new Set(b).add(t.id))
    try {
      const res = await fetch(`/api/crm/leads/${t.lead_id}/tasks/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Server error ${res.status}`)
      return true
    } catch (e) {
      setTasks(ts => ts.map(x => x.id === t.id ? t : x))
      show({ text: e instanceof Error ? e.message : 'Could not update the task', tone: 'err' })
      return false
    } finally {
      setBusy(b => { const n = new Set(b); n.delete(t.id); return n })
    }
  }, [show])

  const restore = useCallback((list: Task[]) => {
    list.forEach(t => patchTask(t, { status: t.status, due_date: t.due_date, assigned_to: t.assigned_to }))
  }, [patchTask])

  const complete = async (t: Task) => {
    if (await patchTask(t, { status: 'Done' })) show({ text: `Done: ${t.title}`, tone: 'ok', action: { label: 'Undo', run: () => restore([t]) } })
  }
  const reopen = async (t: Task) => {
    if (await patchTask(t, { status: 'Pending' })) show({ text: 'Task reopened', tone: 'ok' })
  }
  const dismiss = async (t: Task) => {
    if (await patchTask(t, { status: 'Cancelled' })) show({ text: 'Task dismissed', tone: 'ok', action: { label: 'Undo', run: () => restore([t]) } })
  }
  const snooze = async (t: Task, iso: string, label: string) => {
    if (await patchTask(t, { due_date: iso })) show({ text: `Moved to ${label}`, tone: 'ok', action: { label: 'Undo', run: () => restore([t]) } })
  }

  const runBulk = async (list: Task[], body: (t: Task) => Partial<Pick<Task, 'status' | 'due_date' | 'assigned_to'>>, text: string) => {
    setSelected(new Set())
    const ok = await Promise.all(list.map(t => patchTask(t, body(t))))
    const done = list.filter((_, i) => ok[i])
    if (done.length) show({ text: text.replace('{n}', String(done.length)).replace('{s}', done.length === 1 ? '' : 's'), tone: 'ok', action: { label: 'Undo', run: () => restore(done) } })
  }

  // ── Derived ──
  const open = useMemo(() => tasks.filter(t => t.status === 'Pending'), [tasks])
  const closed = useMemo(() => tasks.filter(t => t.status !== 'Pending')
    .sort((a, b) => (b.updated_at ?? b.due_date).localeCompare(a.updated_at ?? a.due_date)), [tasks])

  const counts = useMemo(() => ({
    all: open.length,
    self: open.filter(t => !isDelegated(t)).length,
    assigned: open.filter(isDelegated).length,
  }), [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return open.filter(t =>
      (owner === 'all' || (owner === 'self' ? !isDelegated(t) : isDelegated(t)))
      && (agent === 'all' || t.assigned_to === agent)
      && (priority === 'all' || t.priority === priority)
      && (type === 'all' || t.task_type === type)
      && (!q || [t.title, leadName(t), t.notes ?? '', t.leads?.phone ?? '', memberName(t) ?? ''].some(x => x.toLowerCase().includes(q))))
  }, [open, owner, agent, priority, type, query, memberName])

  const grouped = useMemo(() => {
    const g: Record<Bucket, Task[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [] }
    if (!now) return g
    for (const t of filtered) {
      if (day && (day === 'overdue' ? bucketOf(t, now) !== 'overdue' : ymd(new Date(t.due_date)) !== day)) continue
      g[bucketOf(t, now)].push(t)
    }
    for (const k of Object.keys(g) as Bucket[]) {
      g[k].sort((a, b) => k === 'overdue' || k === 'today'
        ? a.due_date.localeCompare(b.due_date) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        : a.due_date.localeCompare(b.due_date))
    }
    return g
  }, [filtered, now, day])
  const shown = BUCKETS.reduce((s, b) => s + grouped[b.id].length, 0)

  // KPIs are always for every open task, whatever the filters
  const kpi = useMemo(() => {
    if (!now) return null
    const overdue = open.filter(t => bucketOf(t, now) === 'overdue')
    const ages = overdue.map(t => -dayDiff(new Date(t.due_date).getTime(), now))
    const dueToday = open.filter(t => bucketOf(t, now) === 'today')
    const todayStr = ymd(new Date(now))
    const doneToday = tasks.filter(t => t.status === 'Done' && t.updated_at && ymd(new Date(t.updated_at)) === todayStr)
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() + i)
      const key = ymd(d)
      const wd = d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 3)
      return { key, label: i === 0 ? 'Today' : wd, short: wd.charAt(0), today: i === 0, count: open.filter(t => ymd(new Date(t.due_date)) === key).length }
    })
    const doneWeek = tasks.filter(t => t.status === 'Done' && t.updated_at && now - new Date(t.updated_at).getTime() <= 7 * DAY)
    const onTime = doneWeek.filter(t => dayDiff(new Date(t.updated_at!).getTime(), new Date(t.due_date).getTime()) <= 0).length
    const busiest = week.slice(1).reduce((a, b) => (b.count > a.count ? b : a), { key: '', label: '', short: '', today: false, count: 0 })
    return {
      overdue: overdue.length,
      highOverdue: overdue.filter(t => t.priority === 'High').length,
      oldest: ages.length ? Math.max(...ages) : 0,
      ageParts: [
        { label: '1–3 days', value: ages.filter(a => a <= 3).length, color: '#FDA29B' },
        { label: '4–7 days', value: ages.filter(a => a > 3 && a <= 7).length, color: '#F97066' },
        { label: '8–30 days', value: ages.filter(a => a > 7 && a <= 30).length, color: RED },
        { label: '30+ days', value: ages.filter(a => a > 30).length, color: '#B42318' },
      ],
      dueToday: dueToday.length,
      lateToday: dueToday.filter(t => new Date(t.due_date).getTime() < now).length,
      doneToday: doneToday.length,
      week, busiest,
      next7: week.slice(1).reduce((s, d) => s + d.count, 0),
      doneWeek: doneWeek.length,
      onTimePct: pct(onTime, doneWeek.length),
    }
  }, [open, tasks, now])

  // Workload by person (side panel), from every open task
  const workload = useMemo(() => {
    if (!now) return []
    const rows = [{ id: 'self', name: 'You', role: 'Not delegated' }, ...members.map(m => ({ id: m.id, name: m.name, role: ROLE_LABEL[m.role] ?? m.role }))]
      .map(p => {
        const mine = open.filter(t => (p.id === 'self' ? !isDelegated(t) : t.assigned_to === p.id))
        return { ...p, open: mine.length, overdue: mine.filter(t => bucketOf(t, now) === 'overdue').length, today: mine.filter(t => bucketOf(t, now) === 'today').length }
      })
      .filter(p => p.open > 0 || p.id === 'self')
    return rows.sort((a, b) => (a.id === 'self' ? -1 : b.id === 'self' ? 1 : b.open - a.open))
  }, [open, members, now])
  const maxLoad = Math.max(1, ...workload.map(w => w.open))

  const typeCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const t of open) c.set(t.task_type, (c.get(t.task_type) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => b[1] - a[1])
  }, [open])
  const allTypes = useMemo(() => Array.from(new Set([...TASK_TYPES, ...tasks.map(t => t.task_type)])), [tasks])

  const filtersOn = owner !== 'all' || agent !== 'all' || priority !== 'all' || type !== 'all' || !!query || !!day
  const clearFilters = () => { setOwner('all'); setAgent('all'); setPriority('all'); setType('all'); setQuery(''); setDay(null) }

  const selectedTasks = open.filter(t => selected.has(t.id))
  const toggle = (id: string, on: boolean) => setSelected(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })

  const onDrop = (bucket: Bucket, e: DragEvent) => {
    e.preventDefault(); setDragOver(null)
    const id = e.dataTransfer.getData('text/plain')
    const t = open.find(x => x.id === id)
    const days = DROP_DAYS[bucket]
    if (!t || days == null || bucketOf(t, now) === bucket) return
    snooze(t, onDay(t, days, now), BUCKETS.find(b => b.id === bucket)!.label.toLowerCase())
  }

  const rowProps = (t: Task) => ({
    task: t, now, busy: busy.has(t.id), assigneeName: memberName(t),
    onDone: () => complete(t),
    onSnooze: (iso: string, label: string) => snooze(t, iso, label),
    onEdit: () => setEditing(t),
    onDismiss: () => dismiss(t),
  })

  return (
    <div className="min-h-screen" style={{ background: CANVAS }}>
      <PageTabBar tabs={WORKSPACE_TABS} />
      <PageHeader
        title="Tasks"
        badge={!loading && <Badge tone={kpi?.overdue ? 'red' : 'blue'}>{counts.all} open{kpi?.overdue ? ` · ${kpi.overdue} overdue` : ''}</Badge>}
        sub="Every follow-up, call back and site visit across your leads, in the order they need doing."
        actions={<Btn variant="primary" onClick={() => setEditing('new')}><Plus size={16} weight="bold" />New task</Btn>}
      />

      <div className="mx-auto max-w-[1400px] px-4 pb-28 lg:px-8">
        {loading ? <Skeleton /> : loadErr ? (
          <EmptyState icon={<Warning size={22} />} title="Tasks didn't load" actions={<Btn onClick={() => { setLoading(true); load() }}>Try again</Btn>}>{loadErr}</EmptyState>
        ) : tasks.length === 0 ? (
          <EmptyState icon={<ListChecks size={22} />} title="No tasks yet"
            actions={<Btn variant="primary" onClick={() => setEditing('new')}><Plus size={16} weight="bold" />Add your first task</Btn>}>
            Tasks are the follow-ups, call backs and site visits on your leads. Add one here or from any lead, and it shows up on this page and on Today when it&apos;s due.
          </EmptyState>
        ) : kpi && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard icon={<Warning size={16} weight="bold" />} accent={RED} label="Overdue" value={kpi.overdue}
                pill={kpi.overdue > 0 && <Pill small tone="red">Oldest {kpi.oldest}d</Pill>}
                sub={kpi.overdue ? `${kpi.highOverdue} high priority. Move them to today or dismiss what no longer matters.` : 'Nothing overdue. Nice work.'}>
                <StackBar parts={kpi.ageParts} legend={false} />
              </StatCard>
              <StatCard icon={<Fire size={16} weight="bold" />} accent={BLUE} label="Due today" value={kpi.dueToday} unit="left"
                pill={<Pill small tone={kpi.doneToday ? 'green' : 'neutral'}><Check size={11} weight="bold" />{kpi.doneToday} done</Pill>}
                sub={kpi.lateToday ? `${kpi.lateToday} past their time already` : kpi.dueToday ? 'All still on time' : 'Your day is clear'}>
                <Meter value={kpi.doneToday} max={kpi.doneToday + kpi.dueToday} color={GREEN} />
              </StatCard>
              <StatCard icon={<CalendarDots size={16} weight="bold" />} accent="#7A5AF8" label="Next 7 days" value={kpi.next7}
                sub={kpi.busiest.count ? `Busiest: ${kpi.busiest.label} (${kpi.busiest.count})` : 'Nothing scheduled yet'}>
                <WeekBars days={kpi.week} />
              </StatCard>
              <StatCard icon={<Trophy size={16} weight="bold" />} accent={GREEN} label="Done this week" value={kpi.doneWeek}
                pill={kpi.doneWeek > 0 && <Pill small tone={kpi.onTimePct >= 70 ? 'green' : 'amber'}>{kpi.onTimePct}% on time</Pill>}
                sub={`${counts.assigned} open ${counts.assigned === 1 ? 'task is' : 'tasks are'} delegated to agents`}>
                <Meter value={kpi.doneWeek} max={kpi.doneWeek + kpi.overdue + kpi.dueToday} color={GREEN} />
              </StatCard>
            </div>

            {/* Toolbar */}
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Seg label="View" value={view} onChange={v => { setView(v); setDay(null) }}
                options={[{ id: 'list', label: <><Rows size={15} weight="bold" />List</> }, { id: 'board', label: <><Kanban size={15} weight="bold" />Board</> }]} />
              <Seg label="Whose tasks" value={owner} onChange={v => { setOwner(v); if (v === 'self') setAgent('all') }}
                options={[{ id: 'all', label: 'All', count: counts.all }, { id: 'self', label: 'Mine', count: counts.self }, { id: 'assigned', label: 'Delegated', count: counts.assigned }]} />
              <div className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
                <MagnifyingGlass size={16} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: LABEL }} />
                <input id="task-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search task, lead, phone or note"
                  className={`${inputCls} pl-9`} style={inputStyle} />
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {(['all', 'High', 'Medium', 'Low'] as const).map(p => (
                <Chip key={p} on={priority === p} onClick={() => setPriority(p)} count={p === 'all' ? undefined : open.filter(t => t.priority === p).length}
                  icon={p === 'all' ? undefined : <span className="size-2 rounded-full" style={{ background: TONE[PRIORITY_TONE[p]].color }} />}>
                  {p === 'all' ? 'All priorities' : p}
                </Chip>
              ))}
              <Select id="task-type" value={type} onChange={setType} className="w-[calc(50%-4px)] sm:w-[170px]">
                <option value="all">All types</option>
                {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              {members.length > 0 && owner !== 'self' && (
                <Select id="task-agent" value={agent} onChange={v => { setAgent(v); if (v !== 'all') setOwner('assigned') }} className="w-[calc(50%-4px)] sm:w-[180px]">
                  <option value="all">All agents</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              )}
              {filtersOn && <Btn variant="ghost" size="sm" onClick={clearFilters}><X size={14} weight="bold" />Clear filters</Btn>}
            </div>

            {/* Week strip: jump to a day (list view) */}
            {view === 'list' && (
              <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
                {[{ key: 'overdue', top: 'Overdue', bottom: '', count: filtered.filter(t => bucketOf(t, now) === 'overdue').length, red: true },
                  ...kpi.week.map((d, i) => {
                    const dt = new Date(now); dt.setDate(dt.getDate() + i)
                    return { key: d.key, top: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dt.toLocaleDateString('en-IN', { weekday: 'short' }), bottom: dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), count: filtered.filter(t => ymd(new Date(t.due_date)) === d.key).length, red: false }
                  })].map(d => {
                  const on = day === d.key
                  return (
                    <button key={d.key} type="button" onClick={() => setDay(on ? null : d.key)} aria-pressed={on}
                      className="flex min-w-[92px] shrink-0 cursor-pointer flex-col items-start rounded-[12px] border px-3 py-2 text-left transition-colors hover:bg-[#F9FAFB]"
                      style={on ? { background: d.red ? TONE.red.bg : BLUE_BG, borderColor: d.red ? TONE.red.border : BLUE_LN } : { background: CANVAS, borderColor: BORDER, boxShadow: XS }}>
                      <span className="text-[13px] font-semibold" style={{ color: on ? (d.red ? TONE.red.color : BLUE) : TEXT_2 }}>{d.top}</span>
                      <span className="mt-0.5 flex w-full items-center justify-between gap-2">
                        <span className="text-[12px]" style={{ color: SUBTLE }}>{d.bottom || 'Past due'}</span>
                        <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-bold tabular-nums"
                          style={d.count ? { background: d.red ? RED : BLUE, color: '#fff' } : { background: '#F2F4F7', color: LABEL }}>{d.count}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className={`mt-5 grid gap-6 ${view === 'list' ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
              {/* Main column */}
              <div className="min-w-0">
                {view === 'list' ? (
                  shown === 0 ? (
                    <EmptyState icon={<Check size={22} />} title={filtersOn ? 'No tasks match' : 'All caught up'}
                      actions={filtersOn ? <Btn onClick={clearFilters}>Clear filters</Btn> : <Btn variant="primary" onClick={() => setEditing('new')}><Plus size={16} weight="bold" />New task</Btn>}>
                      {filtersOn ? 'Try another day, priority or agent.' : 'Nothing open right now. Add a follow-up for your next hot lead.'}
                    </EmptyState>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {BUCKETS.filter(b => grouped[b.id].length).map(b => {
                        const list = grouped[b.id]
                        const allOn = list.every(t => selected.has(t.id))
                        return (
                          <section key={b.id} className="rounded-[16px] border bg-white" style={{ borderColor: b.id === 'overdue' ? TONE.red.border : BORDER, boxShadow: XS }}>
                            <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-[16px] border-b px-3 py-2.5 sm:px-4" style={{ borderColor: BORDER, background: b.id === 'overdue' ? '#FFFBFA' : SURFACE }}>
                              <div className="flex items-center gap-2.5">
                                <input type="checkbox" checked={allOn} onChange={e => setSelected(s => { const n = new Set(s); list.forEach(t => (e.target.checked ? n.add(t.id) : n.delete(t.id))); return n })}
                                  aria-label={`Select all ${b.label}`} className="hidden size-4 cursor-pointer accent-[#1D4ED8] sm:block" />
                                <span className="size-2.5 rounded-full" style={{ background: b.dot }} />
                                <h2 className="m-0 text-[15px] font-semibold" style={{ color: b.id === 'overdue' ? TONE.red.color : TEXT }}>{b.label}</h2>
                                <span className="text-[13px] font-medium tabular-nums" style={{ color: SUBTLE }}>{list.length}</span>
                              </div>
                              {b.id === 'overdue' && list.length > 1 && (
                                <Btn size="sm" onClick={() => runBulk(list, t => ({ due_date: onDay(t, 0, now) }), 'Moved {n} task{s} to today')}>
                                  <ArrowCounterClockwise size={14} weight="bold" />Move all to today
                                </Btn>
                              )}
                            </header>
                            <ul className="m-0 list-none divide-y p-0" style={{ borderColor: '#F2F4F7' }}>
                              {list.map(t => <TaskRow key={t.id} {...rowProps(t)} selected={selected.has(t.id)} onSelect={on => toggle(t.id, on)} />)}
                            </ul>
                          </section>
                        )
                      })}
                    </div>
                  )
                ) : (
                  /* Board */
                  <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:snap-none lg:px-0 min-[1760px]:grid min-[1760px]:grid-cols-5 min-[1760px]:overflow-visible">
                    {BUCKETS.map(b => {
                      const list = grouped[b.id]
                      const droppable = DROP_DAYS[b.id] != null
                      return (
                        <section key={b.id} className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-[16px] border p-2 transition-colors sm:w-[290px] min-[1760px]:w-auto min-[1760px]:max-w-none"
                          style={{ background: dragOver === b.id ? BLUE_BG : SURFACE, borderColor: dragOver === b.id ? BLUE_LN : BORDER }}
                          onDragOver={droppable ? e => { e.preventDefault(); setDragOver(b.id) } : undefined}
                          onDragLeave={droppable ? () => setDragOver(d => (d === b.id ? null : d)) : undefined}
                          onDrop={droppable ? e => onDrop(b.id, e) : undefined}>
                          <header className="flex items-center justify-between gap-2 px-2 pb-2.5 pt-1.5">
                            <span className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full" style={{ background: b.dot }} />
                              <span className="text-[14px] font-semibold" style={{ color: b.id === 'overdue' ? TONE.red.color : TEXT }}>{b.label}</span>
                            </span>
                            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-2 text-[12px] font-semibold tabular-nums" style={{ color: TEXT_2, boxShadow: XS }}>{list.length}</span>
                          </header>
                          <ul className="m-0 flex min-h-[120px] list-none flex-col gap-2 p-0">
                            {list.map(t => (
                              <BoardCard key={t.id} {...rowProps(t)} onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move' }} />
                            ))}
                            {!list.length && (
                              <li className="grid flex-1 place-items-center rounded-[12px] border border-dashed px-3 py-6 text-center text-[13px]" style={{ borderColor: BORDER_2, color: LABEL }}>
                                {droppable ? `${b.empty}. Drag a task here.` : b.empty}
                              </li>
                            )}
                          </ul>
                        </section>
                      )
                    })}
                  </div>
                )}

                {/* Completed and dismissed */}
                {closed.length > 0 && (
                  <div className="mt-6">
                    <button type="button" onClick={() => setShowDone(s => !s)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] px-1 py-1 text-[14px] font-semibold" style={{ color: TEXT_2 }}>
                      <span className="grid size-5 place-items-center rounded-full" style={{ background: GREEN, color: '#fff' }}><Check size={11} weight="bold" /></span>
                      Completed and dismissed
                      <span className="font-medium tabular-nums" style={{ color: SUBTLE }}>{closed.length}</span>
                      <CaretDown size={14} weight="bold" className="transition-transform" style={{ transform: showDone ? 'rotate(180deg)' : 'none', color: SUBTLE }} />
                    </button>
                    {showDone && (
                      <ul className="m-0 mt-3 list-none divide-y overflow-hidden rounded-[16px] border p-0" style={{ borderColor: BORDER }}>
                        {closed.slice(0, 40).map(t => (
                          <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4" style={{ borderColor: '#F2F4F7' }}>
                            <DoneCircle done={t.status === 'Done'} busy={busy.has(t.id)} size={22} onClick={() => reopen(t)} />
                            <TypeTile type={t.task_type} size={28} dim />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] line-through" style={{ color: SUBTLE }}>{t.title}</div>
                              <div className="truncate text-[12.5px]" style={{ color: LABEL }}>
                                {leadName(t)}{memberName(t) ? ` · ${memberName(t)}` : ''} · {t.status === 'Done' ? 'Done' : 'Dismissed'}{t.updated_at ? ` ${dateText(new Date(t.updated_at))}` : ''}
                              </div>
                            </div>
                            <Btn size="sm" variant="ghost" onClick={() => reopen(t)}><ArrowCounterClockwise size={14} weight="bold" /><span className="hidden sm:inline">Reopen</span></Btn>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Side panel (list view) */}
              {view === 'list' && (
                <aside className="flex min-w-0 flex-col gap-4">
                  <section className="rounded-[16px] border p-4" style={{ borderColor: BORDER, boxShadow: XS }}>
                    <h3 className="m-0 text-[15px] font-semibold" style={{ color: TEXT }}>Today&apos;s progress</h3>
                    <div className="mt-3 flex items-center gap-4">
                      <Ring value={kpi.doneToday} max={kpi.doneToday + kpi.dueToday + kpi.overdue} color={GREEN}>
                        <span className="text-[20px] font-bold tabular-nums" style={{ color: TEXT }}>{pct(kpi.doneToday, kpi.doneToday + kpi.dueToday + kpi.overdue)}%</span>
                      </Ring>
                      <ul className="m-0 flex min-w-0 list-none flex-col gap-1.5 p-0 text-[13.5px]">
                        <li className="flex items-center gap-2" style={{ color: TEXT_2 }}><span className="size-2 rounded-full" style={{ background: GREEN }} /><b className="tabular-nums">{kpi.doneToday}</b> done today</li>
                        <li className="flex items-center gap-2" style={{ color: TEXT_2 }}><span className="size-2 rounded-full" style={{ background: BLUE }} /><b className="tabular-nums">{kpi.dueToday}</b> still due today</li>
                        <li className="flex items-center gap-2" style={{ color: TEXT_2 }}><span className="size-2 rounded-full" style={{ background: RED }} /><b className="tabular-nums">{kpi.overdue}</b> carried over</li>
                      </ul>
                    </div>
                  </section>

                  {workload.length > 1 && (
                    <section className="rounded-[16px] border p-4" style={{ borderColor: BORDER, boxShadow: XS }}>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="m-0 text-[15px] font-semibold" style={{ color: TEXT }}>Who has what</h3>
                        <Link href="/dashboard/team" className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline" style={{ color: BLUE }}>Team<CaretRight size={12} weight="bold" /></Link>
                      </div>
                      <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
                        {workload.map(w => {
                          const on = w.id === 'self' ? owner === 'self' : agent === w.id
                          return (
                            <li key={w.id}>
                              <button type="button" aria-pressed={on}
                                onClick={() => { if (w.id === 'self') { setAgent('all'); setOwner(on ? 'all' : 'self') } else { setAgent(on ? 'all' : w.id); setOwner(on ? 'all' : 'assigned') } }}
                                className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[#F9FAFB]"
                                style={{ background: on ? BLUE_BG : undefined }}>
                                {w.id === 'self'
                                  ? <span className="grid size-7 shrink-0 place-items-center rounded-full" style={{ background: '#F2F4F7', color: TEXT_2 }}><User size={14} weight="bold" /></span>
                                  : <Avatar name={w.name} size={28} />}
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="truncate text-[13.5px] font-semibold" style={{ color: TEXT }}>{w.name}</span>
                                    <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: SUBTLE }}>
                                      {w.overdue > 0 && <b style={{ color: TONE.red.color }}>{w.overdue} late · </b>}{w.open} open
                                    </span>
                                  </span>
                                  <span className="mt-1 block"><Meter value={w.open} max={maxLoad} height={5} color={w.overdue ? '#F97066' : '#84ADFF'} /></span>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )}

                  {typeCounts.length > 0 && (
                    <section className="rounded-[16px] border p-4" style={{ borderColor: BORDER, boxShadow: XS }}>
                      <h3 className="m-0 text-[15px] font-semibold" style={{ color: TEXT }}>By type</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {typeCounts.map(([t, n]) => {
                          const m = typeMeta(t)
                          return (
                            <Chip key={t} on={type === t} onClick={() => setType(type === t ? 'all' : t)} count={n} icon={<m.Icon size={14} weight="bold" style={{ color: type === t ? undefined : m.color }} />}>{t}</Chip>
                          )
                        })}
                      </div>
                    </section>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bulk bar */}
      {selectedTasks.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-[205] mx-auto flex w-fit max-w-[calc(100vw-32px)] flex-wrap items-center gap-2 rounded-[14px] bg-[#101828] p-2 pl-4 text-white shadow-[0_20px_24px_-4px_rgba(16,24,40,0.18)] lg:bottom-6">
          <span className="text-[14px] font-semibold tabular-nums">{selectedTasks.length} selected</span>
          <span className="mx-1 h-5 w-px bg-white/20" />
          <button type="button" onClick={() => runBulk(selectedTasks, () => ({ status: 'Done' }), 'Marked {n} task{s} done')}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[13.5px] font-semibold hover:bg-white/10"><Check size={14} weight="bold" />Done</button>
          <button type="button" onClick={() => runBulk(selectedTasks, t => ({ due_date: onDay(t, 0, now) }), 'Moved {n} task{s} to today')}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[13.5px] font-semibold hover:bg-white/10"><Fire size={14} weight="bold" />Today</button>
          <button type="button" onClick={() => runBulk(selectedTasks, () => ({ due_date: at(now, 1, 10) }), 'Moved {n} task{s} to tomorrow')}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[13.5px] font-semibold hover:bg-white/10"><ClockClockwise size={14} weight="bold" />Tomorrow</button>
          {members.length > 0 && (
            <Popover open={bulkMenu} onOpenChange={setBulkMenu} align="right" width={240}
              trigger={<button type="button" onClick={() => setBulkMenu(o => !o)} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[13.5px] font-semibold hover:bg-white/10"><UsersThree size={14} weight="bold" />Assign<CaretDown size={12} weight="bold" /></button>}>
              <div className="px-2.5 pb-1.5 pt-1.5 text-[12px] font-semibold" style={{ color: SUBTLE }}>Give these tasks to</div>
              <MenuButton onClick={() => { setBulkMenu(false); runBulk(selectedTasks, () => ({ assigned_to: null }), 'Took back {n} task{s}') }}><User size={15} weight="bold" />Me (not delegated)</MenuButton>
              {members.map(m => (
                <MenuButton key={m.id} hint={ROLE_LABEL[m.role] ?? m.role} onClick={() => { setBulkMenu(false); runBulk(selectedTasks, () => ({ assigned_to: m.id }), `Gave {n} task{s} to ${m.name}`) }}>
                  <Avatar name={m.name} size={20} />{m.name}
                </MenuButton>
              ))}
            </Popover>
          )}
          <button type="button" onClick={() => runBulk(selectedTasks, () => ({ status: 'Cancelled' }), 'Dismissed {n} task{s}')}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[13.5px] font-semibold text-[#FDA29B] hover:bg-white/10"><X size={14} weight="bold" />Dismiss</button>
          <button type="button" aria-label="Clear selection" onClick={() => setSelected(new Set())}
            className="grid size-8 cursor-pointer place-items-center rounded-[8px] text-[#98A2B3] hover:bg-white/10 hover:text-white"><X size={14} weight="bold" /></button>
        </div>
      )}

      {editing && (
        <TaskDialog task={editing === 'new' ? null : editing} members={members} now={now || new Date().getTime()}
          onClose={() => setEditing(null)}
          onSaved={msg => { setEditing(null); show({ text: msg, tone: 'ok' }); load() }} />
      )}
      <Toast toast={toast} onClose={hide} />
    </div>
  )
}
