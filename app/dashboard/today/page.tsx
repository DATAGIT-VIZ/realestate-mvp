'use client'

// Today: the page people open first. A plan for the day built from their own
// follow-ups, new leads and leads going quiet, worked through one tap at a time.

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Phone, PhoneX, WhatsappLogo, ClockClockwise, HandPalm, Check, CheckCircle, CaretRight, ArrowRight, ArrowClockwise,
  Lightning, Sun, SunHorizon, MoonStars, CalendarCheck, UserPlus, Hourglass, SkipForward, Confetti, CircleNotch,
  MapPin, Buildings, Wallet, CalendarBlank, Quotes, ChatCircleText, X,
} from '@phosphor-icons/react'
import { type CRMLead } from '@/lib/twenty'
import { supabase } from '@/lib/supabase'
import {
  CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, GREEN, GREEN_D, WA, XS, DAY, HOUR,
  TONE, type Tone, stageOf, displayName, getCsId, formatPhone, phone10, telHref, waHref, budgetText, durLong, sourceMeta,
  LeadAvatar, StagePill, SourceMark, Pill, Btn, Chip, Panel, EmptyState, Insight, Toast, useToast,
} from '@/components/outreach/OutreachKit'

// ─── Types ────────────────────────────────────────────────────────────────────
type Task = {
  id: string; lead_id: string; title: string; task_type: string | null; due_date: string; priority: string | null
  status: string | null; notes: string | null; updated_at?: string | null
}
type Activity = { id: string; personId: string | null; type: string; notes: string | null; outcome: string | null; createdAt: string }
type DayData = { leads: CRMLead[]; tasks: Task[]; acts: Activity[]; name: string | null }

type LaneId = 'followups' | 'new' | 'quiet'
type Item = { key: string; lane: LaneId; lead: CRMLead; task?: Task; rank: number }
type DoneEntry = { key: string; lead: CRMLead; what: string; tone: Tone; at: number }
type OutcomeId = 'connected' | 'no_answer' | 'callback' | 'not_interested' | 'whatsapp'
type LogInput = { outcome: OutcomeId; when: string; note: string }

// ─── Rules ────────────────────────────────────────────────────────────────────
// A lead "goes quiet" after this many days without an update, by stage
const QUIET_AFTER: Record<string, number> = { Hot: 1, Warm: 2, Cold: 4 }
const NEW_CAP = 10    // newest uncalled leads on today's list
const QUIET_CAP = 12  // most urgent quiet leads on today's list
const PREVIEW_ROWS = 5 // rows per list in the All view
// Activities that count as working a lead today (a missed call from them still needs a call back)
const WORKED = new Set(['Call Made', 'WhatsApp Sent', 'Email Sent', 'VM Done', 'OBM Done', 'Site Visit Scheduled', 'Site Visit Done', 'EOI Received', 'Deal Closed'])

const LANES: Record<LaneId, { title: string; short: string; desc: string; Icon: typeof Phone; tone: Tone }> = {
  followups: { title: 'Follow-ups due', short: 'Follow-ups', desc: 'Callbacks and tasks due today, plus any that slipped past their time.', Icon: ClockClockwise, tone: 'blue' },
  new:       { title: 'New leads',      short: 'New leads',  desc: 'Not called yet. Newest first, while the enquiry is fresh.', Icon: UserPlus, tone: 'green' },
  quiet:     { title: 'Going quiet',    short: 'Going quiet', desc: 'Hot, Warm and Cold leads with no update for a while.', Icon: Hourglass, tone: 'violet' },
}

const OUTCOMES: { id: OutcomeId; label: string; Icon: typeof Phone; color: string; tone: Tone }[] = [
  { id: 'connected',      label: 'Spoke to them',   Icon: Phone,          color: GREEN_D,   tone: 'green' },
  { id: 'no_answer',      label: 'No answer',       Icon: PhoneX,         color: '#DC6803', tone: 'amber' },
  { id: 'callback',       label: 'Call back later', Icon: ClockClockwise, color: BLUE,      tone: 'blue' },
  { id: 'not_interested', label: 'Not interested',  Icon: HandPalm,       color: '#D92D20', tone: 'red' },
  { id: 'whatsapp',       label: 'Sent a WhatsApp', Icon: WhatsappLogo,   color: '#079455', tone: 'green' },
]

// ─── Small helpers ────────────────────────────────────────────────────────────
const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const joinAnd = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`)
const firstName = (l: CRMLead) => l.name?.firstName?.trim() || displayName(l)
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const timeText = (t: number) => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
const dateText = (t: number) => new Date(t).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtWhen = (t: number) => new Date(t).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const typeText = (t: Task) => {
  const s = (t.task_type || 'Follow up').trim().toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function dayWord(t: number, now: number) {
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY)
  if (days === 1) return 'yesterday'
  if (days < 7) return new Date(t).toLocaleDateString('en-IN', { weekday: 'long' })
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function callbackPresets(t: number) {
  const at = (base: number, h: number) => { const d = new Date(base); d.setHours(h, 0, 0, 0); return d }
  const list = [{ label: 'In 2 hours', date: new Date(t + 2 * HOUR) }]
  const evening = at(t, 18)
  if (evening.getTime() - t > 2.5 * HOUR) list.push({ label: 'This evening, 6 pm', date: evening })
  list.push({ label: 'Tomorrow, 11 am', date: at(t + DAY, 11) })
  return list
}

/** Same weighting the old Today page used: stage, how long it's been quiet, intent */
function rescue(l: CRMLead, now: number) {
  const s = stageOf(l.status)
  const idle = (now - ms(l.updatedAt)) / DAY
  const weight = s === 'Hot' ? 1 : s === 'Warm' ? 0.7 : 0.4
  const limit = s === 'Hot' ? 2 : s === 'Warm' ? 4 : 7
  return weight * 40 + Math.min(1, idle / limit) * 35 + (l.intentScore ?? 0) * 0.25
}

/** Higher goes first. Missed follow-ups, then fresh enquiries, then hot leads going quiet. */
function rankOf(lane: LaneId, lead: CRMLead, task: Task | undefined, now: number) {
  if (task) {
    const due = ms(task.due_date)
    if (due < startOfDay(now)) return 900 + Math.min(30, (startOfDay(now) - due) / DAY)
    if (due <= now) return 860
    if (due - now <= HOUR) return 830
    return 500 - (due - now) / HOUR
  }
  if (lane === 'new') {
    const age = now - ms(lead.createdAt)
    const nc = lead.failedContactAttempts ?? 0
    return (age < DAY ? 800 - age / HOUR : 600 - Math.min(60, age / DAY)) - nc * 20 + (lead.intentScore ?? 0) * 0.05
  }
  const s = stageOf(lead.status)
  return (s === 'Hot' ? 700 : s === 'Warm' ? 560 : 400) + rescue(lead, now) * 0.5
}

/** One line on why this lead is on today's list, from data the lead already has */
function reasonFor(it: Item, now: number): { text: string; tone: Tone } {
  const l = it.lead
  if (it.task) {
    const due = ms(it.task.due_date)
    const what = typeText(it.task)
    if (due < startOfDay(now)) return { text: `${what} was due ${dayWord(due, now)} at ${timeText(due)}.`, tone: 'red' }
    if (due <= now) return { text: `${what} was due at ${timeText(due)}, ${durLong(now - due)} ago.`, tone: 'amber' }
    return { text: `${what} at ${timeText(due)}, in ${durLong(due - now)}.`, tone: 'blue' }
  }
  const nc = l.failedContactAttempts ?? 0
  if (it.lane === 'new') {
    const age = now - ms(l.createdAt)
    const src = sourceMeta(l.sourcePortal).label
    if (nc > 0) return { text: `${plural(nc, 'call')} with no answer so far. Try a WhatsApp.`, tone: 'amber' }
    if (age < DAY) return { text: `Came in ${durLong(age)} ago from ${src}. Call while it's fresh.`, tone: 'green' }
    return { text: `Waiting ${durLong(age)} for a first call. Came in from ${src}.`, tone: 'amber' }
  }
  const s = stageOf(l.status)
  const idle = durLong(now - ms(l.updatedAt))
  if (nc >= 3) return { text: `${nc} unanswered calls in a row. A WhatsApp may get a reply.`, tone: 'red' }
  if (s === 'Hot') return { text: `Hot lead with no update in ${idle}. Push for the booking.`, tone: 'red' }
  if (s === 'Warm') return { text: `Warm, but quiet for ${idle}. Book the site visit.`, tone: 'amber' }
  return { text: `No update in ${idle}. A quick follow-up keeps it alive.`, tone: 'violet' }
}

function doneText(a: Activity): { what: string; tone: Tone } {
  if (a.type === 'Call Made') {
    const o = (a.outcome ?? '').toLowerCase()
    if (o === 'no response' || o === 'invalid number') return { what: 'Called, no answer', tone: 'amber' }
    if (o === 'call back') return { what: 'Called, callback set', tone: 'blue' }
    if (o === 'not interested') return { what: 'Called, not interested', tone: 'red' }
    return { what: o ? 'Called and spoke' : 'Called', tone: 'green' }
  }
  if (a.type === 'Call Missed') return { what: 'Missed call', tone: 'amber' }
  if (a.type === 'WhatsApp Sent') return { what: 'WhatsApp sent', tone: 'green' }
  if (a.type === 'Email Sent') return { what: 'Email sent', tone: 'blue' }
  return { what: a.type, tone: 'violet' }
}
const spoke = (a: Activity) => a.type === 'Call Made' && !!a.outcome && !['no response', 'invalid number'].includes(a.outcome.toLowerCase())

// ─── Data ─────────────────────────────────────────────────────────────────────
async function getJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Could not load (${r.status})`)
  return j
}
async function send(url: string, body: unknown, method = 'POST') {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || `Could not save (${r.status})`)
  return j
}
async function fetchFirstName(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const meta = (data.session?.user?.user_metadata ?? {}) as Record<string, unknown>
    const full = [meta.first_name, meta.full_name, meta.name].find(v => typeof v === 'string' && v.trim()) as string | undefined
    return full ? full.trim().split(/\s+/)[0] : null
  } catch { return null }
}
async function fetchDay(): Promise<DayData> {
  const since = new Date(); since.setHours(0, 0, 0, 0)
  const [leads, tasks, acts, name] = await Promise.all([
    getJson('/api/crm/leads?limit=200').then(j => (j.data?.leads ?? j.data ?? []) as CRMLead[]),
    // Follow-ups and today's log fill in the plan, but the page still works without them
    getJson('/api/crm/tasks').then(j => (j.tasks ?? []) as Task[]).catch(() => [] as Task[]),
    getJson(`/api/crm/activities?since=${encodeURIComponent(since.toISOString())}&limit=500`)
      .then(j => (j.data?.activities ?? []) as Activity[]).catch(() => [] as Activity[]),
    fetchFirstName(),
  ])
  return { leads, tasks, acts, name }
}

/** Turns leads, tasks and today's activity into today's lists */
function buildPlan(d: DayData, now: number) {
  const sod = startOfDay(now), eod = sod + DAY
  const byId = new Map(d.leads.map(l => [l.id, l]))

  // Who has been worked today, latest touch per lead
  const touched = new Map<string, Activity>()
  for (const a of d.acts) {
    if (!a.personId || !WORKED.has(a.type) || ms(a.createdAt) < sod) continue
    const prev = touched.get(a.personId)
    if (!prev || ms(a.createdAt) > ms(prev.createdAt)) touched.set(a.personId, a)
  }
  const todayActs = d.acts.filter(a => ms(a.createdAt) >= sod)

  // Tasks only for this person's own leads
  const mine = d.tasks.filter(t => byId.has(t.lead_id))
  const pending = mine.filter(t => (t.status ?? 'Pending') === 'Pending')
  const dueTasks = pending.filter(t => ms(t.due_date) < eod).sort((a, b) => ms(a.due_date) - ms(b.due_date))
  const withTask = new Set(dueTasks.map(t => t.lead_id))

  const followups: Item[] = dueTasks.map(t => {
    const lead = byId.get(t.lead_id)!
    return { key: `t:${t.id}`, lane: 'followups', lead, task: t, rank: rankOf('followups', lead, t, now) }
  })
  const free = (l: CRMLead) => !touched.has(l.id) && !withTask.has(l.id)
  const newAll: Item[] = d.leads
    .filter(l => stageOf(l.status) === 'New' && free(l))
    .map(l => ({ key: `l:${l.id}`, lane: 'new' as const, lead: l, rank: rankOf('new', l, undefined, now) }))
    .sort((a, b) => b.rank - a.rank)
  const quietAll: Item[] = d.leads
    .filter(l => {
      const s = stageOf(l.status)
      return s in QUIET_AFTER && free(l) && Math.floor((now - ms(l.updatedAt)) / DAY) >= QUIET_AFTER[s]
    })
    .map(l => ({ key: `l:${l.id}`, lane: 'quiet' as const, lead: l, rank: rankOf('quiet', l, undefined, now) }))
    .sort((a, b) => b.rank - a.rank)

  const lanes: Record<LaneId, Item[]> = { followups, new: newAll.slice(0, NEW_CAP), quiet: quietAll.slice(0, QUIET_CAP) }
  const more: Record<LaneId, number> = { followups: 0, new: newAll.length - lanes.new.length, quiet: quietAll.length - lanes.quiet.length }

  // Done today: leads worked today, and follow-ups ticked off today
  const done: DoneEntry[] = []
  for (const [id, a] of touched) {
    const lead = byId.get(id)
    if (lead) done.push({ key: `a:${id}`, lead, ...doneText(a), at: ms(a.createdAt) })
  }
  for (const t of mine) {
    if (t.status !== 'Done' || ms(t.updated_at) < sod || touched.has(t.lead_id)) continue
    done.push({ key: `d:${t.id}`, lead: byId.get(t.lead_id)!, what: `${typeText(t)} done`, tone: 'green', at: ms(t.updated_at) })
  }
  done.sort((a, b) => b.at - a.at)

  const schedule = mine
    .filter(t => t.status !== 'Cancelled' && ms(t.due_date) >= sod && ms(t.due_date) < eod)
    .sort((a, b) => ms(a.due_date) - ms(b.due_date))
  const carried = followups.filter(f => ms(f.task!.due_date) < sod).length
  const tomorrow = pending.filter(t => ms(t.due_date) >= eod && ms(t.due_date) < eod + DAY).length
  const open = [...lanes.followups, ...lanes.new, ...lanes.quiet]
  const queue = [...open].sort((a, b) => b.rank - a.rank)

  return {
    lanes, more, done, schedule, carried, tomorrow, open, queue, byId,
    stats: {
      calls: todayActs.filter(a => a.type === 'Call Made').length,
      spoke: todayActs.filter(spoke).length,
      messages: todayActs.filter(a => a.type === 'WhatsApp Sent' || a.type === 'Email Sent').length,
    },
    totals: { overdue: carried, dueToday: followups.length - carried, new: lanes.new.length, quiet: lanes.quiet.length, newAll: newAll.length },
  }
}
type Plan = ReturnType<typeof buildPlan>

// ─── Time-of-day theme ────────────────────────────────────────────────────────
type Period = 'morning' | 'afternoon' | 'evening' | 'night'
const periodOf = (h: number): Period => (h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night')
type Theme = {
  greeting: string; Icon: typeof Sun; dark: boolean; bg: string; border: string; title: string; body: string; eyebrow: string
  card: string; cardBorder: string; ring: string; track: string; orb: string; fill: string
}
const THEMES: Record<Period, Theme> = {
  morning: {
    greeting: 'Good morning', Icon: SunHorizon, dark: false,
    bg: 'radial-gradient(70% 120% at 100% 0%, rgba(253,176,34,0.30) 0%, rgba(253,176,34,0) 60%), linear-gradient(135deg, #EEF4FF 0%, #F5F8FF 55%, #FFFBF2 100%)',
    border: '#DCE6FF', title: TEXT, body: TEXT_2, eyebrow: '#B54708', card: 'rgba(255,255,255,0.82)', cardBorder: '#E4EBFF',
    ring: BLUE, track: '#E0EAFF', orb: '#F79009', fill: 'linear-gradient(90deg, #FDB022, #1D4ED8)',
  },
  afternoon: {
    greeting: 'Good afternoon', Icon: Sun, dark: false,
    bg: 'radial-gradient(60% 110% at 95% 0%, rgba(254,200,75,0.28) 0%, rgba(254,200,75,0) 60%), linear-gradient(135deg, #E0EAFF 0%, #EEF4FF 50%, #FFFFFF 100%)',
    border: '#D1E0FF', title: TEXT, body: TEXT_2, eyebrow: BLUE, card: 'rgba(255,255,255,0.85)', cardBorder: '#E0EAFF',
    ring: BLUE, track: '#E0EAFF', orb: '#FDB022', fill: 'linear-gradient(90deg, #FDB022, #1D4ED8)',
  },
  evening: {
    greeting: 'Good evening', Icon: SunHorizon, dark: true,
    bg: 'radial-gradient(70% 120% at 100% 100%, rgba(247,144,9,0.38) 0%, rgba(247,144,9,0) 60%), linear-gradient(135deg, #1A2466 0%, #2B39A8 55%, #4E46DC 100%)',
    border: '#2B39A8', title: '#FFFFFF', body: 'rgba(255,255,255,0.84)', eyebrow: '#FEC84B', card: 'rgba(255,255,255,0.10)', cardBorder: 'rgba(255,255,255,0.18)',
    ring: '#FFFFFF', track: 'rgba(255,255,255,0.20)', orb: '#FDB022', fill: 'linear-gradient(90deg, #FEC84B, #FFFFFF)',
  },
  night: {
    greeting: 'Working late', Icon: MoonStars, dark: true,
    bg: 'radial-gradient(60% 100% at 90% 0%, rgba(132,173,255,0.22) 0%, rgba(132,173,255,0) 60%), linear-gradient(135deg, #0B1438 0%, #132063 55%, #22308C 100%)',
    border: '#1A2A78', title: '#FFFFFF', body: 'rgba(255,255,255,0.80)', eyebrow: '#C7D7FE', card: 'rgba(255,255,255,0.08)', cardBorder: 'rgba(255,255,255,0.16)',
    ring: '#FFFFFF', track: 'rgba(255,255,255,0.18)', orb: '#E0EAFF', fill: 'linear-gradient(90deg, #84ADFF, #FFFFFF)',
  },
}
// A few fixed stars for the dark themes, kept to the edges so they never sit behind text
const STARS = [[3, 9], [12, 5], [21, 93], [30, 6], [41, 95], [50, 4], [59, 93], [68, 6], [77, 95], [86, 4], [95, 94], [1.5, 55]]

// ─── Buttons that are links ───────────────────────────────────────────────────
type LinkTone = 'primary' | 'call' | 'secondary' | 'wa' | 'onDark' | 'glass'
const LINK_TONE: Record<LinkTone, CSSProperties> = {
  primary:   { background: BLUE, borderColor: BLUE, color: '#FFFFFF', boxShadow: '0 1px 2px rgba(16,24,40,0.05), inset 0 -2px 0 rgba(16,24,40,0.12)' },
  call:      { background: GREEN_D, borderColor: GREEN_D, color: '#FFFFFF', boxShadow: '0 1px 2px rgba(16,24,40,0.05), inset 0 -2px 0 rgba(16,24,40,0.12)' },
  secondary: { background: CANVAS, borderColor: BORDER_2, color: TEXT_2, boxShadow: XS },
  wa:        { background: '#F0FDF4', borderColor: '#ABEFC6', color: '#067647', boxShadow: XS },
  onDark:    { background: '#FFFFFF', borderColor: '#FFFFFF', color: '#1A2466', boxShadow: '0 1px 2px rgba(16,24,40,0.12)' },
  glass:     { background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.28)', color: '#FFFFFF' },
}
const linkCls = (size: 'md' | 'lg' = 'md') =>
  `inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border font-semibold no-underline transition-[filter,background] hover:brightness-105 ${size === 'lg' ? 'h-12 rounded-[12px] px-5 text-[15px]' : 'h-10 rounded-[10px] px-3.5 text-[14px]'}`

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TodayPage() {
  const [data, setData]       = useState<DayData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [now, setNow]         = useState(0)
  const [lane, setLane]       = useState<'all' | LaneId>('all')
  const [skipped, setSkipped] = useState<string[]>([])
  const [logging, setLogging] = useState<{ key: string; preset: OutcomeId | null } | null>(null)
  const [busy, setBusy]       = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { toast, show, hide } = useToast()

  const load = useCallback(() => fetchDay()
    .then(d => { setData(d); setError(null); setNow(Date.now()) })
    .catch((e: Error) => setError(e.message || 'Could not load your day'))
    .finally(() => setRefreshing(false)), [])

  useEffect(() => { load() }, [load])
  // Keep the clock moving, and pick up calls logged elsewhere when the tab comes back
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    const onShow = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onShow)
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onShow) }
  }, [load])

  const plan = useMemo(() => (data && now ? buildPlan(data, now) : null), [data, now])
  const upNext = useMemo(() => {
    if (!plan) return null
    const left = plan.queue.filter(i => !skipped.includes(i.key))
    return left[0] ?? plan.queue[0] ?? null
  }, [plan, skipped])

  const refresh = () => { setRefreshing(true); load() }
  const openLog = (key: string, preset: OutcomeId | null = null) => setLogging(l => (l?.key === key && !preset ? null : { key, preset }))

  /** Ticks a follow-up off, with undo */
  const completeTask = async (task: Task, lead: CRMLead) => {
    setBusy(`t:${task.id}`)
    try {
      await send(`/api/crm/leads/${task.lead_id}/tasks/${task.id}`, { status: 'Done' }, 'PATCH')
      const at = new Date().toISOString()
      setData(d => d && { ...d, tasks: d.tasks.map(t => (t.id === task.id ? { ...t, status: 'Done', updated_at: at } : t)) })
      show({
        tone: 'ok', text: `${typeText(task)} for ${firstName(lead)} marked done.`,
        action: { label: 'Undo', run: () => {
          send(`/api/crm/leads/${task.lead_id}/tasks/${task.id}`, { status: 'Pending' }, 'PATCH')
            .then(() => setData(d => d && { ...d, tasks: d.tasks.map(t => (t.id === task.id ? { ...t, status: 'Pending' } : t)) }))
            .catch(() => show({ tone: 'err', text: 'Could not undo. Reopen it from Workspace.' }))
        } },
      })
    } catch (e) {
      show({ tone: 'err', text: (e as Error).message })
    } finally { setBusy(null) }
  }

  /** Logs what happened on the lead, then sets a callback or closes the follow-up where it applies */
  const saveLog = async (it: Item, input: LogInput) => {
    const lead = it.lead
    const note = input.note.trim() || null
    const base = { notes: note, metadata: { via: 'today' } }
    const payload =
      input.outcome === 'whatsapp' ? { ...base, type: 'WhatsApp Sent' }
      : input.outcome === 'connected' ? { ...base, type: 'Call Made', outcome: 'Connected', callOutcome: 'connected' }
      : input.outcome === 'no_answer' ? { ...base, type: 'Call Made', outcome: 'No Response', callOutcome: 'nca', ncaAttempt: (lead.failedContactAttempts ?? 0) + 1 }
      : input.outcome === 'callback' ? { ...base, type: 'Call Made', outcome: 'Call Back', callOutcome: 'connected', nextActionDate: input.when }
      : { ...base, type: 'Call Made', outcome: 'Not Interested', callOutcome: 'connected' }
    setBusy(it.key)
    try {
      const res = await send(`/api/crm/leads/${lead.id}/activities`, payload)
      const at = new Date().toISOString()
      const to = res.statusAdvancedTo as string | undefined
      const nc = res.newFailedAttempts as number | undefined
      setData(d => d && {
        ...d,
        acts: [{ id: res.data?.id ?? `local-${at}`, personId: lead.id, type: payload.type, notes: note, outcome: 'outcome' in payload ? payload.outcome : null, createdAt: at }, ...d.acts],
        leads: d.leads.map(l => (l.id === lead.id ? { ...l, status: to ?? l.status, failedContactAttempts: nc ?? l.failedContactAttempts, updatedAt: at } : l)),
      })
      setLogging(null)
      const parts = [`Saved for ${firstName(lead)}.`]
      if (to) parts.push(`Moved to ${to}.`)

      // Follow-on steps: a callback task, and closing the follow-up this came from
      const problems: string[] = []
      if (input.outcome === 'callback') {
        try {
          const j = await send(`/api/crm/leads/${lead.id}/tasks`, {
            title: `Call back ${displayName(lead)}`, task_type: 'Call Back', due_date: input.when, priority: 'Medium',
            notes: [`Call back at ${fmtWhen(ms(input.when))}`, note].filter(Boolean).join('. '),
          })
          const t: Task = j.task ?? { id: `local-${at}`, lead_id: lead.id, title: `Call back ${displayName(lead)}`, task_type: 'Call Back', due_date: input.when, priority: 'Medium', status: 'Pending', notes: null }
          setData(d => d && { ...d, tasks: [...d.tasks, { ...t, status: t.status ?? 'Pending' }] })
          parts.push(`Callback set for ${fmtWhen(ms(input.when))}.`)
        } catch { problems.push('the callback') }
      }
      if (it.task && input.outcome !== 'no_answer') {
        try {
          await send(`/api/crm/leads/${lead.id}/tasks/${it.task.id}`, { status: 'Done' }, 'PATCH')
          setData(d => d && { ...d, tasks: d.tasks.map(t => (t.id === it.task!.id ? { ...t, status: 'Done', updated_at: at } : t)) })
        } catch { problems.push('closing the follow-up') }
      }
      show(problems.length
        ? { tone: 'err', text: `Saved the ${payload.type === 'WhatsApp Sent' ? 'WhatsApp' : 'call'}, but ${joinAnd(problems)} didn't go through. Finish it from the lead's page.` }
        : { tone: 'ok', text: parts.join(' ') })
    } catch (e) {
      show({ tone: 'err', text: (e as Error).message })
    } finally { setBusy(null) }
  }

  const skip = (key: string) => {
    setLogging(null)
    setSkipped(s => {
      const next = [...s.filter(k => k !== key), key]
      // Once everything has been skipped, start the round again
      return plan && next.length >= plan.queue.length ? [] : next
    })
  }

  // ── Render ──
  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS }}>
        <div className="mx-auto max-w-[1400px] px-4 pt-8 lg:px-8">
          <EmptyState icon={<CalendarCheck size={22} weight="bold" />} title="Couldn't load your day"
            actions={<Btn variant="primary" onClick={refresh}><ArrowClockwise size={16} weight="bold" />Try again</Btn>}>
            {error}
          </EmptyState>
        </div>
      </div>
    )
  }
  if (!data || !plan || !now) return <TodaySkeleton />

  const theme = THEMES[periodOf(new Date(now).getHours())]
  const shown = (Object.keys(LANES) as LaneId[]).filter(id => (lane === 'all' || lane === id) && plan.lanes[id].length > 0)

  return (
    <div style={{ minHeight: '100vh', background: CANVAS }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 lg:px-8">
        <DayHero theme={theme} now={now} name={data.name} plan={plan} refreshing={refreshing} onRefresh={refresh} />

        {data.leads.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={<UserPlus size={22} weight="bold" />} title="No leads yet"
              actions={<Link href="/dashboard/leads/ingestion" className={linkCls()} style={LINK_TONE.primary}>Import leads<ArrowRight size={15} weight="bold" /></Link>}>
              Once leads come in from your portals, ads or an import, today&apos;s calls and follow-ups will be planned here.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* ── The plan ── */}
            <div className="flex min-w-0 flex-col gap-6">
              {upNext
                ? <UpNext item={upNext} now={now} position={plan.queue.indexOf(upNext) + 1} total={plan.queue.length}
                    busy={busy} logging={logging} onLog={openLog} onSave={saveLog} onSkip={skip} onComplete={completeTask} />
                : <AllClear done={plan.done.length} />}

              {plan.open.length > 0 && (
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="toolbar" aria-label="Show">
                    <Chip on={lane === 'all'} onClick={() => setLane('all')} count={plan.open.length}>All</Chip>
                    {(Object.keys(LANES) as LaneId[]).map(id => {
                      const L = LANES[id]
                      return (
                        <Chip key={id} on={lane === id} onClick={() => setLane(id)} count={plan.lanes[id].length}
                          icon={<L.Icon size={14} weight="bold" color={lane === id ? BLUE : TONE[L.tone].color} />}>
                          {L.short}
                        </Chip>
                      )
                    })}
                  </div>
                  {shown.length === 0 && (
                    <div className="rounded-[16px] border px-5 py-8 text-center text-[14px]" style={{ borderColor: BORDER, color: SUBTLE }}>
                      Nothing here right now.
                    </div>
                  )}
                  {shown.map(id => (
                    <LaneCard key={id} id={id} items={plan.lanes[id]} more={plan.more[id]} carried={id === 'followups' ? plan.carried : 0}
                      limit={lane === 'all' ? PREVIEW_ROWS : undefined} onShowAll={() => setLane(id)}
                      now={now} busy={busy} logging={logging} onLog={openLog} onSave={saveLog} onComplete={completeTask} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Side: schedule and what's done ── */}
            <div className="grid min-w-0 content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
              <SchedulePanel plan={plan} now={now} />
              <DonePanel plan={plan} />
            </div>
          </div>
        )}
      </div>
      <Toast toast={toast} onClose={hide} />
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function DayHero({ theme, now, name, plan, refreshing, onRefresh }: {
  theme: Theme; now: number; name: string | null; plan: Plan; refreshing: boolean; onRefresh: () => void
}) {
  const t = plan.totals
  const parts: string[] = []
  if (t.overdue) parts.push(plural(t.overdue, 'overdue follow-up'))
  if (t.dueToday) parts.push(`${plural(t.dueToday, 'follow-up')} due today`)
  if (t.new) parts.push(`${plural(t.new, 'new lead')} to call`)
  if (t.quiet) parts.push(`${plural(t.quiet, 'lead')} going quiet`)
  const sentence = parts.length
    ? `On your list: ${joinAnd(parts)}.`
    : plan.done.length ? "You've worked through everything on today's list." : 'Nothing is waiting on you right now.'
  const done = plan.done.length
  const total = plan.open.length + done
  const Icon = theme.Icon

  return (
    <section className="relative overflow-hidden rounded-[24px] border px-5 py-6 sm:px-8 sm:py-8" style={{ background: theme.bg, borderColor: theme.border }}>
      {theme.dark && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {STARS.map(([x, y], i) => (
            <span key={i} className="absolute rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3, opacity: i % 2 ? 0.35 : 0.6 }} />
          ))}
        </div>
      )}
      <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: theme.eyebrow }}>
            <Icon size={18} weight="fill" />{dateText(now)}
          </div>
          <h1 className="m-0 mt-2 text-[30px] font-bold leading-[1.1] tracking-[-0.03em] [text-wrap:balance] sm:text-[40px]" style={{ color: theme.title }}>
            {theme.greeting}{name ? `, ${name}` : ''}
          </h1>
          <p className="m-0 mt-3 max-w-[620px] text-[15px] leading-relaxed sm:text-[16px]" style={{ color: theme.body }}>{sentence}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link href="/dashboard/calls" className={`${linkCls('lg')} flex-1 sm:flex-none`} style={theme.dark ? LINK_TONE.onDark : LINK_TONE.primary}>
              <Phone size={17} weight="fill" />Start calling
            </Link>
            <Link href="/dashboard/tasks" className={`${linkCls('lg')} flex-1 sm:flex-none`} style={theme.dark ? LINK_TONE.glass : LINK_TONE.secondary}>
              <CalendarCheck size={17} weight="bold" />Open Workspace
            </Link>
            <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh" title="Refresh"
              className="grid size-12 cursor-pointer place-items-center rounded-[12px] border transition-colors disabled:cursor-wait"
              style={theme.dark ? LINK_TONE.glass : LINK_TONE.secondary}>
              <ArrowClockwise size={18} weight="bold" className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Progress on today's plan, and where the working day is */}
        <div className="rounded-[20px] border p-4 sm:p-5" style={{ background: theme.card, borderColor: theme.cardBorder, boxShadow: theme.dark ? 'none' : XS }}>
          <div className="flex items-center gap-4">
            <ProgressRing done={done} total={total} color={theme.ring} track={theme.track} text={theme.title} sub={theme.body} />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold leading-snug" style={{ color: theme.title }}>
                {total === 0 ? 'Nothing planned yet' : done >= total ? 'Plan done for today' : `${total - done} left on today's plan`}
              </div>
              <div className="mt-1 text-[13px] leading-snug" style={{ color: theme.body }}>
                {done ? `${plural(done, 'lead')} worked so far today.` : 'Log a call or message to tick one off.'}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[['Calls', plan.stats.calls], ['Spoke to', plan.stats.spoke], ['Messages', plan.stats.messages]].map(([label, n]) => (
              <div key={label} className="min-w-0 rounded-[12px] border px-3 py-2.5" style={{ borderColor: theme.cardBorder, background: theme.dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }}>
                <div className="text-[20px] font-semibold leading-none tabular-nums" style={{ color: theme.title }}>{n}</div>
                <div className="mt-1 truncate text-[12px]" style={{ color: theme.body }}>{label}</div>
              </div>
            ))}
          </div>
          <DayTrack now={now} theme={theme} />
        </div>
      </div>
    </section>
  )
}

function ProgressRing({ done, total, color, track, text, sub }: { done: number; total: number; color: string; track: string; text: string; sub: string }) {
  const size = 96, stroke = 9, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const p = total ? Math.min(1, done / total) : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} done today`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[24px] font-bold leading-none tabular-nums" style={{ color: text }}>
            {done}<span className="text-[14px] font-semibold" style={{ color: sub }}>/{total}</span>
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: sub }}>done</div>
        </div>
      </div>
    </div>
  )
}

/** Where now sits in an 8 am to 8 pm working day */
function DayTrack({ now, theme }: { now: number; theme: Theme }) {
  const d = new Date(now)
  const h = d.getHours() + d.getMinutes() / 60
  const p = Math.max(0, Math.min(1, (h - 8) / 12))
  const after = h >= 20, before = h < 8
  const Icon = theme.Icon === MoonStars ? MoonStars : Sun
  return (
    <div className="mt-5">
      <div className="relative h-2 rounded-full" style={{ background: theme.track }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p * 100}%`, background: theme.fill }} />
        <span className="absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2"
          style={{ left: `${p * 100}%`, background: theme.orb, borderColor: theme.dark ? 'rgba(255,255,255,0.9)' : '#FFFFFF', color: theme.dark && Icon === MoonStars ? '#132063' : '#FFFFFF', boxShadow: `0 0 0 6px ${theme.dark ? 'rgba(255,255,255,0.10)' : 'rgba(253,176,34,0.18)'}` }}>
          <Icon size={12} weight="fill" />
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[12px] tabular-nums" style={{ color: theme.body }}>
        <span>8 am</span>
        <span className="font-semibold" style={{ color: theme.title }}>
          {before ? `Day starts in ${durLong(new Date(now).setHours(8, 0, 0, 0) - now)}` : after ? 'Working day is over' : `Now ${timeText(now)}`}
        </span>
        <span>8 pm</span>
      </div>
    </div>
  )
}

// ─── Up next ──────────────────────────────────────────────────────────────────
type RowProps = {
  now: number; busy: string | null; logging: { key: string; preset: OutcomeId | null } | null
  onLog: (key: string, preset?: OutcomeId | null) => void; onSave: (it: Item, input: LogInput) => void
  onComplete: (task: Task, lead: CRMLead) => void
}

function UpNext({ item, position, total, onSkip, ...p }: RowProps & { item: Item; position: number; total: number; onSkip: (key: string) => void }) {
  const l = item.lead
  const reason = reasonFor(item, p.now)
  const L = LANES[item.lane]
  const overdue = item.task && ms(item.task.due_date) < startOfDay(p.now)
  const facts = [
    budgetText(l.budgetMin, l.budgetMax) && { Icon: Wallet, text: budgetText(l.budgetMin, l.budgetMax)! },
    l.propertyType?.[0] && { Icon: Buildings, text: l.propertyType[0] },
    (l.localities?.[0] || l.city) && { Icon: MapPin, text: [l.localities?.[0], l.city].filter(Boolean).join(', ') },
    l.timeline && { Icon: CalendarBlank, text: l.timeline },
  ].filter(Boolean) as { Icon: typeof Phone; text: string }[]
  const dial = !!phone10(l.phones?.primaryPhoneNumber)
  // Its own key, so logging here doesn't also open the same lead's row in the list
  const logKey = `next:${item.key}`
  const isLogging = p.logging?.key === logKey

  return (
    <section aria-label="Up next" className="relative overflow-hidden rounded-[20px] border bg-white"
      style={{ borderColor: BLUE_LN, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 16px 32px -16px rgba(29,78,216,0.25)' }}>
      <div aria-hidden className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #1D4ED8, #6172F3, #FDB022)' }} />
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ background: BLUE, color: '#FFFFFF' }}>
            <Lightning size={13} weight="fill" />Up next
          </span>
          <Pill tone={overdue ? 'red' : L.tone}><L.Icon size={13} weight="bold" />{overdue ? 'Overdue follow-up' : item.lane === 'followups' ? 'Follow-up' : L.short.replace(/s$/, '')}</Pill>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[13px] tabular-nums" style={{ color: SUBTLE }}>{position} of {total}</span>
          {total > 1 && <Btn variant="ghost" size="sm" onClick={() => onSkip(item.key)}><SkipForward size={14} weight="bold" />Skip</Btn>}
          <Link href={`/dashboard/leads/${l.id}`} className="h-8 items-center gap-1 rounded-[8px] px-2.5 text-[13px] font-semibold no-underline transition-colors hover:bg-[#EFF4FF] max-sm:hidden sm:inline-flex" style={{ color: BLUE }}>
            Open lead<CaretRight size={13} weight="bold" />
          </Link>
        </div>
      </header>

      <div className="flex gap-4 px-4 pb-5 pt-4 sm:px-6">
        <Link href={`/dashboard/leads/${l.id}`} className="shrink-0 no-underline" aria-label={`Open ${displayName(l)}`}>
          <span className="sm:hidden"><LeadAvatar lead={l} size={48} /></span>
          <span className="hidden sm:inline-flex"><LeadAvatar lead={l} size={60} /></span>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link href={`/dashboard/leads/${l.id}`} className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.01em] no-underline hover:underline sm:text-[22px]" style={{ color: TEXT }}>
              {displayName(l)}
            </Link>
            <StagePill stage={stageOf(l.status)} small />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] tabular-nums" style={{ color: SUBTLE }}>
            <span className="select-all">{formatPhone(l.phones?.primaryPhoneNumber)}</span>
            <span aria-hidden>·</span><span>{getCsId(l)}</span>
            <span aria-hidden>·</span><span className="inline-flex items-center gap-1.5"><SourceMark raw={l.sourcePortal} size={16} />{sourceMeta(l.sourcePortal).label}</span>
          </div>
          {facts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {facts.map(f => (
                <span key={f.text} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[12.5px] font-medium" style={{ borderColor: BORDER, background: SURFACE, color: TEXT_2 }}>
                  <f.Icon size={13} weight="bold" color={SUBTLE} className="shrink-0" /><span className="truncate">{f.text}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6">
        <Insight tone={reason.tone} icon={<L.Icon size={15} weight="bold" />} title={reason.text}>
          {item.task?.notes ? <span className="inline-flex gap-1.5"><Quotes size={14} weight="fill" className="mt-0.5 shrink-0" style={{ color: LABEL }} />{item.task.notes}</span> : null}
        </Insight>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 px-4 pb-5 pt-4 sm:px-6">
        {dial && (
          <a href={telHref(l.phones?.primaryPhoneNumber)} onClick={() => p.onLog(logKey, 'connected')} className={`${linkCls('lg')} flex-1 sm:flex-none`} style={LINK_TONE.call}>
            <Phone size={17} weight="fill" />Call {firstName(l)}
          </a>
        )}
        {dial && (
          <a href={waHref(l.phones?.primaryPhoneNumber, `Hi ${firstName(l)}, `)} target="_blank" rel="noopener noreferrer" onClick={() => p.onLog(logKey, 'whatsapp')}
            className={`${linkCls('lg')} flex-1 sm:flex-none`} style={LINK_TONE.wa}>
            <WhatsappLogo size={18} weight="fill" color={WA} />WhatsApp
          </a>
        )}
        {item.task && (
          <Btn size="lg" disabled={p.busy === `t:${item.task.id}`} onClick={() => p.onComplete(item.task!, l)}>
            <Check size={16} weight="bold" />Mark done
          </Btn>
        )}
        <Btn size="lg" variant="ghost" active={isLogging} onClick={() => p.onLog(logKey)}><ChatCircleText size={16} weight="bold" />Log</Btn>
      </div>
      {isLogging && (
        <div className="px-4 pb-5 sm:px-6">
          <QuickLog key={`${logKey}:${p.logging?.preset}`} item={item} now={p.now} preset={p.logging?.preset ?? null} busy={p.busy === item.key}
            onCancel={() => p.onLog(logKey)} onSave={input => p.onSave(item, input)} />
        </div>
      )}
    </section>
  )
}

function AllClear({ done }: { done: number }) {
  return (
    <section className="rounded-[20px] border px-6 py-10 text-center" style={{ borderColor: '#ABEFC6', background: 'linear-gradient(180deg, #F6FEF9 0%, #FFFFFF 100%)', boxShadow: XS }}>
      <span className="mx-auto grid size-14 place-items-center rounded-full" style={{ background: '#DCFAE6', color: GREEN_D }}><Confetti size={26} weight="fill" /></span>
      <h2 className="m-0 mt-4 text-[22px] font-semibold tracking-[-0.01em]" style={{ color: TEXT }}>You&apos;re all caught up</h2>
      <p className="mx-auto mb-0 mt-2 max-w-[460px] text-[14.5px] leading-relaxed" style={{ color: SUBTLE }}>
        {done ? `You worked ${plural(done, 'lead')} today. ` : ''}Nothing is due and no lead is waiting. New enquiries and follow-ups will show up here as they come in.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Link href="/dashboard/tasks" className={linkCls()} style={LINK_TONE.secondary}><CalendarCheck size={16} weight="bold" />Plan tomorrow</Link>
        <Link href="/dashboard/lifecycle" className={linkCls()} style={LINK_TONE.primary}>Open Pipeline<ArrowRight size={15} weight="bold" /></Link>
      </div>
    </section>
  )
}

// ─── Lists ────────────────────────────────────────────────────────────────────
function LaneCard({ id, items, more, carried, limit, onShowAll, ...p }: RowProps & {
  id: LaneId; items: Item[]; more: number; carried: number; limit?: number; onShowAll: () => void
}) {
  const L = LANES[id]
  const t = TONE[carried ? 'red' : L.tone]
  const moreHref = id === 'new' ? '/dashboard/leads' : '/dashboard/lifecycle'
  // Keep a row that's being logged on screen even when the list is trimmed
  const open = p.logging ? items.findIndex(i => i.key === p.logging!.key) : -1
  const cut = limit && items.length > limit ? Math.max(limit, open + 1) : items.length
  const hidden = items.length - cut
  return (
    <section className="overflow-hidden rounded-[16px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border" style={{ background: t.bg, borderColor: t.border, color: t.color }}>
            <L.Icon size={17} weight="bold" />
          </span>
          <div className="min-w-0">
            <h2 className="m-0 flex items-center gap-2 text-[16px] font-semibold" style={{ color: TEXT }}>
              {L.title}<span className="text-[13px] font-medium tabular-nums" style={{ color: LABEL }}>{items.length}</span>
              {carried > 0 && <Pill tone="red" small>{carried} overdue</Pill>}
            </h2>
            <p className="m-0 mt-0.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>{L.desc}</p>
          </div>
        </div>
        {id === 'new' && (
          <Link href="/dashboard/calls" className="inline-flex items-center gap-1.5 text-[13px] font-semibold no-underline hover:underline" style={{ color: BLUE }}>
            Call in the Power Dialer<ArrowRight size={13} weight="bold" />
          </Link>
        )}
      </header>
      <ul className="m-0 list-none p-0">
        {items.slice(0, cut).map((it, i) => <PlanRow key={it.key} item={it} first={i === 0} {...p} />)}
      </ul>
      {hidden > 0 ? (
        <button type="button" onClick={onShowAll}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t px-4 py-3 text-[13.5px] font-semibold transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: BORDER, color: BLUE }}>
          Show all {items.length}<CaretRight size={13} weight="bold" />
        </button>
      ) : more > 0 && (
        <Link href={moreHref} className="flex items-center justify-center gap-1.5 border-t px-4 py-3 text-[13.5px] font-semibold no-underline transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: BORDER, color: BLUE }}>
          {id === 'new' ? `${plural(more, 'more new lead')} not called yet` : `${plural(more, 'more lead')} going quiet`}<ArrowRight size={13} weight="bold" />
        </Link>
      )}
    </section>
  )
}

function PlanRow({ item, first, ...p }: RowProps & { item: Item; first: boolean }) {
  const l = item.lead
  const reason = reasonFor(item, p.now)
  const tone = TONE[reason.tone]
  const isLogging = p.logging?.key === item.key
  const dial = !!phone10(l.phones?.primaryPhoneNumber)
  const taskBusy = item.task && p.busy === `t:${item.task.id}`

  return (
    <li className={`px-3 py-3 transition-colors sm:px-4 ${first ? '' : 'border-t'}`} style={{ borderColor: BORDER, background: isLogging ? '#FCFCFD' : undefined }}>
      <div className="flex items-center gap-3">
        {/* Tick: closes a follow-up, or asks what happened on a lead */}
        <button type="button" disabled={!!taskBusy}
          onClick={() => (item.task ? p.onComplete(item.task, l) : p.onLog(item.key))}
          aria-label={item.task ? `Mark ${typeText(item.task).toLowerCase()} for ${displayName(l)} done` : `Log what happened with ${displayName(l)}`}
          title={item.task ? 'Mark done' : 'Log what happened'}
          className="group grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors hover:border-[#17B26A] hover:bg-[#ECFDF3] disabled:cursor-wait"
          style={{ borderColor: BORDER_2, background: '#FFFFFF' }}>
          {taskBusy ? <CircleNotch size={13} weight="bold" className="animate-spin" color={LABEL} />
            : <Check size={13} weight="bold" className="opacity-0 transition-opacity group-hover:opacity-100" color={GREEN} />}
        </button>
        <Link href={`/dashboard/leads/${l.id}`} className="hidden shrink-0 no-underline sm:inline-flex" aria-hidden tabIndex={-1}>
          <LeadAvatar lead={l} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Link href={`/dashboard/leads/${l.id}`} className="min-w-0 truncate text-[14.5px] font-semibold no-underline hover:underline" style={{ color: TEXT }}>
              {displayName(l)}
            </Link>
            <StagePill stage={stageOf(l.status)} small />
          </div>
          <div className="mt-0.5 flex min-w-0 items-start gap-1.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>
            <span className="mt-[5px] size-1.5 shrink-0 rounded-full" style={{ background: tone.color }} />
            <span className="line-clamp-2 sm:line-clamp-1">{reason.text}</span>
          </div>
        </div>
        <RowMeta item={item} now={p.now} />
        <div className="flex shrink-0 items-center gap-1.5">
          {dial && (
            <a href={telHref(l.phones?.primaryPhoneNumber)} onClick={() => p.onLog(item.key, 'connected')} aria-label={`Call ${displayName(l)}`} title="Call"
              className="grid size-9 place-items-center rounded-[10px] border transition-colors hover:brightness-95" style={{ background: '#ECFDF3', borderColor: '#ABEFC6', color: GREEN_D }}>
              <Phone size={16} weight="fill" />
            </a>
          )}
          {dial && (
            <a href={waHref(l.phones?.primaryPhoneNumber, `Hi ${firstName(l)}, `)} target="_blank" rel="noopener noreferrer" onClick={() => p.onLog(item.key, 'whatsapp')}
              aria-label={`WhatsApp ${displayName(l)}`} title="WhatsApp"
              className="hidden size-9 place-items-center rounded-[10px] border transition-colors hover:bg-[#F9FAFB] min-[360px]:grid" style={{ borderColor: BORDER_2, color: WA, boxShadow: XS }}>
              <WhatsappLogo size={17} weight="fill" />
            </a>
          )}
          <Link href={`/dashboard/leads/${l.id}`} aria-label={`Open ${displayName(l)}`} title="Open lead"
            className="hidden size-9 place-items-center rounded-[10px] no-underline transition-colors hover:bg-[#F2F4F7] md:grid" style={{ color: LABEL }}>
            <CaretRight size={16} weight="bold" />
          </Link>
        </div>
      </div>
      {isLogging && (
        <div className="mt-3 sm:pl-[92px]">
          <QuickLog key={`${item.key}:${p.logging?.preset}`} item={item} now={p.now} preset={p.logging?.preset ?? null} busy={p.busy === item.key}
            onCancel={() => p.onLog(item.key)} onSave={input => p.onSave(item, input)} />
        </div>
      )}
    </li>
  )
}

function RowMeta({ item, now }: { item: Item; now: number }) {
  const l = item.lead
  let body: ReactNode
  if (item.task) {
    const due = ms(item.task.due_date)
    const overdue = due < startOfDay(now)
    const late = !overdue && due <= now
    body = <Pill tone={overdue ? 'red' : late ? 'amber' : 'blue'}><ClockClockwise size={12} weight="bold" />{overdue ? dayWord(due, now) : timeText(due)}</Pill>
  } else if (item.lane === 'new') {
    body = <span className="inline-flex items-center gap-1.5 text-[12.5px] tabular-nums" style={{ color: SUBTLE }}><SourceMark raw={l.sourcePortal} size={18} />{durLong(now - ms(l.createdAt))} ago</span>
  } else {
    body = <Pill tone="violet"><Hourglass size={12} weight="bold" />{durLong(now - ms(l.updatedAt))}</Pill>
  }
  return <div className="hidden shrink-0 lg:block">{body}</div>
}

// ─── Quick log ────────────────────────────────────────────────────────────────
function QuickLog({ item, now, preset, busy, onSave, onCancel }: {
  item: Item; now: number; preset: OutcomeId | null; busy: boolean; onSave: (input: LogInput) => void; onCancel: () => void
}) {
  const [outcome, setOutcome] = useState<OutcomeId | null>(preset === 'whatsapp' ? 'whatsapp' : null)
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const presets = callbackPresets(now)
  const asked = preset === 'whatsapp' ? 'Did you send the WhatsApp?' : preset ? `How did the call with ${firstName(item.lead)} go?` : `What happened with ${firstName(item.lead)}?`
  const ready = !!outcome && (outcome !== 'callback' || !!when) && !busy
  const closes = item.task && outcome && outcome !== 'no_answer'

  return (
    <div className="rounded-[14px] border p-3.5 sm:p-4" style={{ borderColor: BLUE_LN, background: '#F8FAFF' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[14px] font-semibold" style={{ color: TEXT }}>{asked}</div>
        <button type="button" onClick={onCancel} aria-label="Close" className="-m-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] transition-colors hover:bg-[#EEF2F6]" style={{ color: SUBTLE }}>
          <X size={15} weight="bold" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Outcome">
        {OUTCOMES.map(o => {
          const on = outcome === o.id
          const t = TONE[o.tone]
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setOutcome(o.id)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors"
              style={on ? { background: t.bg, borderColor: t.color, color: t.color, boxShadow: `0 0 0 3px ${t.border}` } : { background: '#FFFFFF', borderColor: BORDER_2, color: TEXT_2 }}>
              <o.Icon size={15} weight={o.id === 'whatsapp' ? 'fill' : 'bold'} color={on ? t.color : o.color} />{o.label}
            </button>
          )
        })}
      </div>
      {outcome === 'callback' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {presets.map(pr => {
            const iso = pr.date.toISOString()
            const on = when === iso
            return (
              <button key={pr.label} type="button" onClick={() => setWhen(iso)} aria-pressed={on}
                className="h-8 cursor-pointer rounded-[8px] border px-2.5 text-[13px] font-medium transition-colors"
                style={on ? { background: BLUE_BG, borderColor: BLUE, color: BLUE } : { background: '#FFFFFF', borderColor: BORDER_2, color: TEXT_2 }}>
                {pr.label}
              </button>
            )
          })}
          <input type="datetime-local" aria-label="Callback time" min={toLocalInput(new Date(now))}
            value={when && !presets.some(pr => pr.date.toISOString() === when) ? toLocalInput(new Date(when)) : ''}
            onChange={e => setWhen(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="h-8 min-w-0 rounded-[8px] border bg-white px-2 text-[13px] outline-none focus:border-[#84ADFF]" style={{ borderColor: BORDER_2, color: TEXT_2 }} />
        </div>
      )}
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note (optional)" aria-label="Note"
        onKeyDown={e => { if (e.key === 'Enter' && ready && outcome) onSave({ outcome, when, note }) }}
        className="mt-3 h-10 w-full min-w-0 rounded-[10px] border bg-white px-3 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-[#98A2B3] focus:border-[#84ADFF] focus:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]"
        style={{ borderColor: BORDER_2, color: TEXT }} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px]" style={{ color: SUBTLE }}>
          {closes ? 'Saves on the lead and closes this follow-up.' : outcome === 'callback' ? 'Saves on the lead and adds the callback to your list.' : 'Saves on the lead.'}
        </span>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" disabled={!ready} onClick={() => outcome && onSave({ outcome, when, note })}>
            {busy ? <><CircleNotch size={15} weight="bold" className="animate-spin" />Saving</> : <><Check size={15} weight="bold" />Save</>}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Side panels ──────────────────────────────────────────────────────────────
function SchedulePanel({ plan, now }: { plan: Plan; now: number }) {
  const rows = plan.schedule
  const nowAt = rows.findIndex(t => ms(t.due_date) > now)
  const marker = (
    <li key="now" className="relative flex items-center gap-3 py-1.5" aria-label={`Now, ${timeText(now)}`}>
      <span className="w-[72px] shrink-0 whitespace-nowrap text-right text-[11.5px] font-bold uppercase tracking-[0.06em]" style={{ color: BLUE }}>Now</span>
      <span className="relative z-10 size-2.5 shrink-0 rounded-full" style={{ background: BLUE, boxShadow: '0 0 0 4px #EFF4FF' }} />
      <span className="h-px flex-1" style={{ background: BLUE_LN }} />
    </li>
  )
  return (
    <Panel icon={<CalendarCheck size={17} weight="bold" />} title="Today's schedule" sub="Follow-ups with a time on them.">
      {plan.carried > 0 && (
        <div className="mb-3 rounded-[10px] border px-3 py-2 text-[13px] font-medium" style={{ ...toneStyle('red') }}>
          {plural(plan.carried, 'follow-up')} carried over from earlier days
        </div>
      )}
      {rows.length === 0 ? (
        <p className="m-0 rounded-[12px] border border-dashed px-4 py-6 text-center text-[13.5px] leading-relaxed" style={{ borderColor: BORDER_2, color: SUBTLE }}>
          No follow-ups set for today. Callbacks you set from a call or a lead&apos;s page show up here.
        </p>
      ) : (
        <ol className="relative m-0 list-none p-0">
          <span aria-hidden className="absolute bottom-3 top-3 w-px" style={{ left: 88, background: BORDER }} />
          {rows.map((t, i) => {
            const lead = plan.byId.get(t.lead_id)!
            const due = ms(t.due_date)
            const isDone = t.status === 'Done'
            const late = !isDone && due <= now
            const dot = isDone ? GREEN : late ? '#F04438' : BLUE
            return [
              i === nowAt ? marker : null,
              <li key={t.id} className="relative flex items-start gap-3 py-2">
                <span className="w-[72px] shrink-0 whitespace-nowrap pt-px text-right text-[12.5px] font-semibold tabular-nums" style={{ color: isDone ? LABEL : TEXT_2 }}>{timeText(due)}</span>
                <span className="relative z-10 mt-1 grid size-2.5 shrink-0 place-items-center rounded-full border-2 bg-white" style={{ borderColor: dot, background: isDone ? dot : '#FFFFFF' }} />
                <Link href={`/dashboard/leads/${lead.id}`} className="min-w-0 flex-1 no-underline">
                  <span className={`block truncate text-[13.5px] font-semibold ${isDone ? 'line-through' : ''}`} style={{ color: isDone ? LABEL : TEXT }}>{displayName(lead)}</span>
                  <span className="block truncate text-[12.5px]" style={{ color: late ? '#B42318' : SUBTLE }}>
                    {typeText(t)}{isDone ? ', done' : late ? ', late' : ''}
                  </span>
                </Link>
              </li>,
            ]
          })}
          {nowAt === -1 && marker}
        </ol>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[13px]" style={{ borderColor: BORDER, color: SUBTLE }}>
        <span>Tomorrow: {plan.tomorrow ? plural(plan.tomorrow, 'follow-up') : 'nothing set yet'}</span>
        <Link href="/dashboard/tasks" className="inline-flex items-center gap-1 font-semibold no-underline hover:underline" style={{ color: BLUE }}>
          Workspace<ArrowRight size={12} weight="bold" />
        </Link>
      </div>
    </Panel>
  )
}

function DonePanel({ plan }: { plan: Plan }) {
  const [all, setAll] = useState(false)
  const list = all ? plan.done : plan.done.slice(0, 6)
  return (
    <Panel icon={<CheckCircle size={17} weight="bold" color={GREEN_D} />} title="Done today"
      sub={plan.done.length ? `${plural(plan.done.length, 'lead')} worked so far. Nice going.` : 'Calls and messages you log today land here.'}>
      {plan.done.length === 0 ? (
        <p className="m-0 rounded-[12px] border border-dashed px-4 py-6 text-center text-[13.5px] leading-relaxed" style={{ borderColor: BORDER_2, color: SUBTLE }}>
          Nothing logged yet today. Tap a lead&apos;s call button and log how it went.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {list.map(e => (
            <li key={e.key}>
              <Link href={`/dashboard/leads/${e.lead.id}`} className="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-1.5 no-underline transition-colors hover:bg-[#F9FAFB]">
                <span className="relative shrink-0">
                  <LeadAvatar lead={e.lead} size={30} badge={false} />
                  <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full text-white" style={{ background: GREEN, boxShadow: '0 0 0 2px #fff' }}>
                    <Check size={8} weight="bold" />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold" style={{ color: TEXT }}>{displayName(e.lead)}</span>
                  <span className="block truncate text-[12.5px]" style={{ color: TONE[e.tone].color }}>{e.what}</span>
                </span>
                <span className="shrink-0 text-[12px] tabular-nums" style={{ color: LABEL }}>{timeText(e.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {plan.done.length > 6 && (
        <button type="button" onClick={() => setAll(a => !a)} className="mt-2 cursor-pointer self-start text-[13px] font-semibold hover:underline" style={{ color: BLUE }}>
          {all ? 'Show fewer' : `Show all ${plan.done.length}`}
        </button>
      )}
    </Panel>
  )
}

const toneStyle = (t: Tone): CSSProperties => ({ background: TONE[t].bg, borderColor: TONE[t].border, color: TONE[t].color })

// ─── Loading ──────────────────────────────────────────────────────────────────
function TodaySkeleton() {
  const bar = (w: string, h = 12) => <span className="block animate-pulse rounded-full" style={{ width: w, height: h, background: '#EEF2F6' }} />
  return (
    <div style={{ minHeight: '100vh', background: CANVAS }} aria-busy="true" aria-label="Loading your day">
      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 lg:px-8">
        <div className="rounded-[24px] border px-5 py-8 sm:px-8" style={{ borderColor: BORDER, background: 'linear-gradient(135deg, #F5F8FF, #FFFFFF)' }}>
          <div className="flex flex-col gap-4">{bar('180px')}{bar('min(420px, 80%)', 34)}{bar('min(560px, 90%)')}</div>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 rounded-[16px] border px-4 py-4" style={{ borderColor: BORDER }}>
                <span className="size-10 animate-pulse rounded-full" style={{ background: '#EEF2F6' }} />
                <div className="flex flex-1 flex-col gap-2">{bar('40%')}{bar('70%', 10)}</div>
              </div>
            ))}
          </div>
          <div className="hidden h-[320px] animate-pulse rounded-[16px] xl:block" style={{ background: SURFACE }} />
        </div>
      </div>
    </div>
  )
}
