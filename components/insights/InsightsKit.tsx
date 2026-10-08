'use client'

// Shared pieces for the Insights pages (Analytics, Team analytics, Reports, Calculators):
// the data hook, how activities and lead journeys are read, period maths and the charts.
// Same tokens and cards as the Leads, Pipeline, Outreach and Dashboard pages (OutreachKit).

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Phone, PhoneX, WhatsappLogo, EnvelopeSimple, ChatCircleDots, CalendarCheck, MapPin, VideoCamera, Handshake,
  Trophy, Bell, NotePencil, Lightning, CaretUp, CaretDown, WarningCircle, ArrowClockwise, ArrowUpRight, ArrowDownRight,
} from '@phosphor-icons/react'
import { type CRMLead } from '@/lib/twenty'
import { supabase } from '@/lib/supabase'
import {
  CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, GREEN_D, XS, DAY, HOUR,
  type StageId, type Tone, stageOf, phone10, telHref, waHref, formatPhone, Pill, Btn,
} from '@/components/outreach/OutreachKit'

export const INSIGHTS_TABS = [
  { label: 'Analytics',      href: '/dashboard/analytics', exact: true },
  { label: 'Team Analytics', href: '/dashboard/team/analytics', teamsOnly: true },
  { label: 'Reports',        href: '/dashboard/reports' },
  { label: 'Calculators',    href: '/dashboard/calculators' },
]

// ─── Data ─────────────────────────────────────────────────────────────────────
export type InsightLead = CRMLead & { assignedTo: string | null }
export type InsightActivity = {
  id: string; leadId: string; type: string; outcome: string | null; callOutcome: string | null
  duration: number | null; notes: string | null; createdAt: string
}
export type InsightsData = {
  leads: InsightLead[]; acts: InsightActivity[]; days: number
  capped: { leads: boolean; activities: boolean }; activitiesFailed: boolean; at: number
  demo?: boolean
}
export type Member = { id: string; name: string; role: string; email?: string | null; phone?: string | null; is_active: boolean; monthly_target?: number | null }

async function getJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Could not load (${r.status})`)
  return j
}
export const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

export async function fetchInsights(days: number): Promise<InsightsData> {
  const j = await getJson(`/api/insights?days=${Math.ceil(days)}`)
  return {
    leads: (j.leads ?? []) as InsightLead[],
    acts: (j.activities ?? []) as InsightActivity[],
    days: Number(j.days ?? days),
    capped: { leads: !!j.capped?.leads, activities: !!j.capped?.activities },
    activitiesFailed: !!j.activitiesFailed,
    demo: !!j.demo,
    at: Date.now(),
  }
}
export async function fetchMembers(): Promise<Member[]> {
  try { return ((await getJson('/api/team')).members ?? []) as Member[] } catch { return [] }
}
/** The signed-in user's name from their profile, if they set one */
export async function fetchMyName(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const meta = (data.session?.user?.user_metadata ?? {}) as Record<string, unknown>
    const v = [meta.full_name, meta.name, meta.first_name].find(x => typeof x === 'string' && x.trim()) as string | undefined
    return v?.trim() ?? null
  } catch { return null }
}

/**
 * Loads leads plus the activity of the last `days` days. Keeps what it has when a shorter window is asked for,
 * and fetches again only when a longer one is needed. `pending` is true while the data doesn't cover `days` yet.
 */
export function useInsights(days: number) {
  const [store, setStore] = useState<{ data: InsightsData | null; days: number; error: string | null }>({ data: null, days: 0, error: null })
  const [refreshing, setRefreshing] = useState(false)
  const seq = useRef(0)
  const pull = useCallback((d: number) => {
    const id = ++seq.current
    return fetchInsights(d)
      .then(data => { if (id === seq.current) setStore({ data, days: d, error: null }) })
      .catch(e => { if (id === seq.current) setStore(s => ({ ...s, days: d, error: errText(e) })) })
  }, [])
  useEffect(() => { if (store.days < days) pull(days) }, [store.days, days, pull])
  const refresh = useCallback(() => {
    setRefreshing(true)
    pull(Math.max(days, store.days)).finally(() => setRefreshing(false))
  }, [pull, days, store.days])
  return { data: store.data, error: store.error, pending: store.days < days, refreshing, refresh }
}

export function useMembers(enabled = true) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const pull = useCallback(() => fetchMembers().then(setMembers), [])
  useEffect(() => { if (enabled) pull() }, [enabled, pull])
  return { members: enabled ? members : [], loading: enabled && members === null, reload: pull }
}

// ─── Activities ───────────────────────────────────────────────────────────────
// Activity types come from the app ('Call Made', 'Site Visit Done'…) and from older imports ('call', 'site_visit'…)
export type ActKind = 'call' | 'missed' | 'whatsapp' | 'email' | 'reply' | 'visitBooked' | 'visit' | 'meeting'
  | 'eoi' | 'closed' | 'followUp' | 'note' | 'other'
const KIND_OF: Record<string, ActKind> = {
  'call made': 'call', call: 'call', negotiation_call: 'call',
  'call missed': 'missed',
  'whatsapp sent': 'whatsapp', whatsapp: 'whatsapp', whatsapp_message: 'whatsapp',
  'email sent': 'email', email: 'email',
  'whatsapp received': 'reply', 'email received': 'reply',
  'site visit scheduled': 'visitBooked',
  'site visit done': 'visit', site_visit: 'visit',
  'vm done': 'meeting', 'obm done': 'meeting',
  'eoi received': 'eoi', 'deal closed': 'closed',
  'follow up set': 'followUp', follow_up: 'followUp',
  note: 'note',
}
export const kindOf = (type: string): ActKind => KIND_OF[type.trim().toLowerCase()] ?? 'other'

type IconT = typeof Phone
export const KIND: Record<ActKind, { label: string; plural: string; Icon: IconT; color: string; tone: Tone }> = {
  call:        { label: 'Call',               plural: 'Calls',              Icon: Phone,          color: '#1D4ED8', tone: 'blue' },
  missed:      { label: 'Unanswered call',    plural: 'Unanswered calls',   Icon: PhoneX,         color: '#84ADFF', tone: 'amber' },
  whatsapp:    { label: 'WhatsApp',           plural: 'WhatsApp messages',  Icon: WhatsappLogo,   color: '#17B26A', tone: 'green' },
  email:       { label: 'Email',              plural: 'Emails',             Icon: EnvelopeSimple, color: '#7A5AF8', tone: 'violet' },
  reply:       { label: 'Reply received',     plural: 'Replies received',   Icon: ChatCircleDots, color: '#0BA5EC', tone: 'blue' },
  visitBooked: { label: 'Site visit booked',  plural: 'Site visits booked', Icon: CalendarCheck,  color: '#FDB022', tone: 'amber' },
  visit:       { label: 'Site visit done',    plural: 'Site visits done',   Icon: MapPin,         color: '#F79009', tone: 'amber' },
  meeting:     { label: 'Meeting done',       plural: 'Meetings done',      Icon: VideoCamera,    color: '#EE46BC', tone: 'violet' },
  eoi:         { label: 'EOI received',       plural: 'EOIs received',      Icon: Handshake,      color: '#EF6820', tone: 'amber' },
  closed:      { label: 'Deal closed',        plural: 'Deals closed',       Icon: Trophy,         color: '#079455', tone: 'green' },
  followUp:    { label: 'Follow-up set',      plural: 'Follow-ups set',     Icon: Bell,           color: '#98A2B3', tone: 'neutral' },
  note:        { label: 'Note',               plural: 'Notes',              Icon: NotePencil,     color: '#D0D5DD', tone: 'neutral' },
  other:       { label: 'Update',             plural: 'Updates',            Icon: Lightning,      color: '#E4E7EC', tone: 'neutral' },
}
/** Readable label for one logged activity, using its exact type */
const TYPE_LABEL: Record<string, string> = {
  'Call Made': 'Call', 'Call Missed': 'Unanswered call', 'VM Done': 'Video meeting done', 'OBM Done': 'Builder meeting done',
  'Status Changed': 'Stage changed', 'Lead Created': 'Lead added', Escalated: 'Flagged for priority', 'Escalation Removed': 'Priority flag removed',
  Hold: 'Put on hold', property_viewed: 'Viewed a property',
}
export const typeLabel = (type: string) => TYPE_LABEL[type] ?? (kindOf(type) === 'other' ? type.replace(/_/g, ' ') : KIND[kindOf(type)].label)

/** Things an agent does to reach the lead. Notes, follow-ups set and system updates don't count. */
export const OUTREACH = new Set<ActKind>(['call', 'missed', 'whatsapp', 'email', 'visitBooked', 'visit', 'meeting'])
export const isOutreach = (a: InsightActivity) => OUTREACH.has(kindOf(a.type))
export const isCallAttempt = (a: InsightActivity) => { const k = kindOf(a.type); return k === 'call' || k === 'missed' }
const NO_ANSWER = /no response|no answer|not answer|busy|wrong|invalid|voicemail|not reachable|unreachable|switched off|not picked/i
/** A call where the agent got through (LIFECYCLE_SPEC §5: 'No Response' is a no-contact attempt) */
export function isConnected(a: InsightActivity) {
  if (kindOf(a.type) !== 'call') return false
  if (a.callOutcome === 'nca' || a.callOutcome === 'invalid_number') return false
  return !(a.outcome && NO_ANSWER.test(a.outcome))
}

// ─── Lead journeys ────────────────────────────────────────────────────────────
export const OPEN: StageId[] = ['New', 'Cold', 'Warm', 'Hot', 'Hold']
export const ORDER: StageId[] = ['New', 'Cold', 'Warm', 'Hot', 'Hold', 'Closed', 'Disqualified']
export const stageOfLead = (l: CRMLead) => stageOf(l.status)
export const isOpenLead = (l: CRMLead) => OPEN.includes(stageOfLead(l))
export const scoreOf = (l: CRMLead) => l.intentScore ?? 0
export const valueOf = (l: CRMLead) => Number(l.budgetMax ?? l.budgetMin ?? 0) || 0
export const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0)
export const created = (l: CRMLead) => ms(l.createdAt)
/** Won and dropped leads are dated by their last update: the leads table has no closed_at column */
export const closedAt = (l: CRMLead) => ms(l.updatedAt || l.createdAt)

export type Journey = {
  contacted: boolean; spoke: boolean; qualified: boolean; eoi: boolean; won: boolean; dropped: boolean
  firstTouch: number | null; touches: number; calls: number; connected: number
}
export const STEPS = [
  { key: 'in',        label: 'Came in',                short: 'Came in',   help: 'Leads that arrived' },
  { key: 'contacted', label: 'Contacted',              short: 'Contacted', help: 'Called, messaged or emailed at least once' },
  { key: 'spoke',     label: 'Spoke to them',          short: 'Spoke',     help: 'A call got through, they replied, or met you' },
  { key: 'qualified', label: 'Requirements confirmed', short: 'Warm+',     help: 'Reached Warm: budget, location and intent checked' },
  { key: 'eoi',       label: 'EOI received',           short: 'Hot+',      help: 'Reached Hot: expression of interest or booking intent' },
  { key: 'won',       label: 'Deal closed',            short: 'Won',       help: 'Reached Closed' },
] as const
export type StepKey = (typeof STEPS)[number]['key']

/**
 * How far each lead got. Status only moves forward (LIFECYCLE_SPEC §3), so a lead counts as having reached a step
 * if its stage is at or past it, or if an activity shows it (useful for leads that were later dropped).
 * Only activities inside the loaded window are seen, so use this for leads that came in inside that window.
 */
export function buildJourneys(leads: CRMLead[], acts: InsightActivity[]): Map<string, Journey> {
  const byLead = new Map<string, InsightActivity[]>()
  for (const a of acts) { const xs = byLead.get(a.leadId); if (xs) xs.push(a); else byLead.set(a.leadId, [a]) }
  const out = new Map<string, Journey>()
  for (const l of leads) {
    const st = stageOfLead(l)
    const own = byLead.get(l.id) ?? []
    let firstTouch: number | null = null, touches = 0, calls = 0, connected = 0
    let spoke = false, qualified = false, eoi = false, won = false
    for (const a of own) {
      const k = kindOf(a.type)
      if (OUTREACH.has(k)) {
        touches++
        const t = ms(a.createdAt)
        if (firstTouch == null || t < firstTouch) firstTouch = t
      }
      if (k === 'call' || k === 'missed') calls++
      if (isConnected(a)) { connected++; spoke = true }
      if (k === 'reply' || k === 'visit' || k === 'meeting') spoke = true
      if (k === 'visit' || k === 'meeting') qualified = true
      if (k === 'eoi') { eoi = true; qualified = true; spoke = true }
      if (k === 'closed') { won = true; eoi = true; qualified = true; spoke = true }
    }
    if (st === 'Warm' || st === 'Hot' || st === 'Closed') { qualified = true; spoke = true }
    if (st === 'Hot' || st === 'Closed') eoi = true
    if (st === 'Closed') won = true
    const contacted = firstTouch != null || spoke || st === 'Cold' || st === 'Disqualified' || (l.failedContactAttempts ?? 0) > 0
    out.set(l.id, { contacted, spoke, qualified, eoi, won, dropped: st === 'Disqualified', firstTouch, touches, calls, connected })
  }
  return out
}
export function reached(j: Journey | undefined, step: StepKey) {
  if (!j) return step === 'in'
  return step === 'in' ? true : j[step]
}
/** Time from a lead arriving to the first time someone reached out, if it was reached out to */
export function responseMs(l: CRMLead, j: Journey | undefined) {
  if (!j?.firstTouch) return null
  return Math.max(0, j.firstTouch - created(l))
}

// ─── Numbers and text ─────────────────────────────────────────────────────────
export const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + (f(x) || 0), 0)
export const nf = (n: number) => Math.round(n).toLocaleString('en-IN')
export const plural = (n: number, one: string, many = `${one}s`) => `${nf(n)} ${n === 1 ? one : many}`
export const share = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
export function median(xs: number[]) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
/** "4 min", "2.5 h", "3 days" */
export function dur(msv: number | null | undefined) {
  if (msv == null) return '—'
  if (msv < 60_000) return 'under a minute'
  if (msv < HOUR) return `${Math.round(msv / 60_000)} min`
  if (msv < DAY) { const h = msv / HOUR; return `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)} h` }
  const d = msv / DAY
  return `${d < 10 ? Math.round(d * 10) / 10 : Math.round(d)} ${d < 1.05 ? 'day' : 'days'}`
}
export function niceMax(x: number) {
  if (x <= 2) return 2
  const p = 10 ** Math.floor(Math.log10(x))
  return ([1, 2, 4, 6, 8, 10].map(f => f * p).find(v => v >= x)) ?? 10 * p
}
export function startOfDay(t: number) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
export function ago(t: number, now: number) {
  const s = Math.max(0, now - t)
  if (s < 60_000) return 'just now'
  if (s < HOUR) return `${Math.floor(s / 60_000)}m ago`
  if (s < DAY) return `${Math.floor(s / HOUR)}h ago`
  if (s < 30 * DAY) return `${Math.floor(s / DAY)}d ago`
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
export const dayName = (t: number) => new Date(t).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
export const shortDate = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
export const timeText = (t: number) => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

// ─── Rolling periods (same buckets as the Dashboard) ──────────────────────────
export type RollId = '7d' | '30d' | '90d' | '12m'
export const ROLL: Record<RollId, { label: string; long: string; unit: string; days: number }> = {
  '7d':  { label: '7D',  long: 'last 7 days',    unit: 'day',   days: 7 },
  '30d': { label: '30D', long: 'last 30 days',   unit: 'day',   days: 30 },
  '90d': { label: '90D', long: 'last 13 weeks',  unit: 'week',  days: 91 },
  '12m': { label: '12M', long: 'last 12 months', unit: 'month', days: 366 },
}
export type Bucket = { start: number; end: number; tick: string; label: string }
export function rollBuckets(p: RollId, now: number): Bucket[] {
  const d = new Date(now)
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate()
  const fmt = (t: Date, o: Intl.DateTimeFormatOptions) => t.toLocaleDateString('en-IN', o)
  if (p === '12m') return Array.from({ length: 12 }, (_, i) => {
    const s = new Date(y, m - 11 + i, 1), e = new Date(y, m - 10 + i, 1)
    return { start: s.getTime(), end: e.getTime(), tick: fmt(s, { month: 'short' }), label: fmt(s, { month: 'long', year: 'numeric' }) }
  })
  if (p === '90d') return Array.from({ length: 13 }, (_, i) => {
    const s = new Date(y, m, day + 1 - 7 * (13 - i)), e = new Date(y, m, day + 1 - 7 * (12 - i)), last = new Date(y, m, day - 7 * (12 - i))
    return { start: s.getTime(), end: e.getTime(), tick: fmt(s, { day: 'numeric', month: 'short' }),
      label: `${fmt(s, { day: 'numeric', month: 'short' })} – ${fmt(last, { day: 'numeric', month: 'short' })}` }
  })
  const n = p === '7d' ? 7 : 30
  return Array.from({ length: n }, (_, i) => {
    const s = new Date(y, m, day - (n - 1) + i), e = new Date(y, m, day - n + 2 + i)
    return { start: s.getTime(), end: e.getTime(), tick: p === '7d' ? fmt(s, { weekday: 'short' }) : String(s.getDate()),
      label: fmt(s, { weekday: 'short', day: 'numeric', month: 'short' }) }
  })
}
/** Start and end of the rolling window and the one before it */
export function rollWindow(p: RollId, now: number) {
  const b = rollBuckets(p, now)
  const start = b[0].start, end = b[b.length - 1].end
  const len = end - start
  return { start, end, prevStart: p === '12m' ? new Date(new Date(start).setFullYear(new Date(start).getFullYear() - 1)).getTime() : start - len, prevEnd: start, buckets: b }
}
export const bucketIndex = (b: Bucket[], t: number) => {
  if (!b.length || t < b[0].start || t >= b[b.length - 1].end) return -1
  for (let i = 0; i < b.length; i++) if (t < b[i].end) return i
  return -1
}

// ─── Small UI ─────────────────────────────────────────────────────────────────
export function Delta({ cur, prev, unit, invert, suffix = '%', points }: {
  cur: number; prev: number; unit: string; invert?: boolean; suffix?: string; points?: boolean
}) {
  if (!cur && !prev) return null
  const title = points ? `${cur}% against ${prev}% in the ${unit}` : `${nf(cur)} against ${nf(prev)} in the ${unit}`
  if (!prev && !points) return <span title={title}><Pill tone="green" small><ArrowUpRight size={11} weight="bold" />New</Pill></span>
  const d = points ? Math.round(cur - prev) : Math.round(((cur - prev) / prev) * 100)
  if (d === 0) return <span title={title}><Pill tone="neutral" small>Level</Pill></span>
  const good = invert ? d < 0 : d > 0
  return (
    <span title={title}>
      <Pill tone={good ? 'green' : 'red'} small>
        {d > 0 ? <ArrowUpRight size={11} weight="bold" /> : <ArrowDownRight size={11} weight="bold" />}{Math.abs(d)}{points ? ' pts' : suffix}
      </Pill>
    </span>
  )
}

export function MiniBars({ values, label, color = BLUE, soft = '#B2CCFF' }: { values: number[]; label: string; color?: string; soft?: string }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-9 items-end gap-[2px]" role="img" aria-label={label}>
      {values.map((v, i) => (
        <span key={i} className="min-w-0 flex-1 rounded-[2px]"
          style={{ height: v ? `${Math.max(12, (v / max) * 100)}%` : 2, background: v ? (i === values.length - 1 ? color : soft) : '#EAECF0' }} />
      ))}
    </div>
  )
}

/** A thin bar with a value, for table cells and rows */
export function Meter({ value, max, color = BLUE, height = 6, className = '' }: { value: number; max: number; color?: string; height?: number; className?: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <span className={`block overflow-hidden rounded-full ${className}`} style={{ height, background: '#F2F4F7' }}>
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${w}%`, minWidth: value > 0 ? 4 : 0, background: color }} />
    </span>
  )
}

/** Caption under a chart or table, saying what the numbers are based on */
export function Basis({ children }: { children: ReactNode }) {
  return <p className="m-0 mt-3 text-[12.5px] leading-snug" style={{ color: LABEL }}>{children}</p>
}

/** Sortable table header cell */
export function SortTh<K extends string>({ id, sort, onSort, children, align = 'right', className = '', wrap = false }: {
  id: K; sort: { key: K; dir: 1 | -1 }; onSort: (k: K) => void; children: ReactNode; align?: 'left' | 'right'; className?: string
  /** Lets a long label break onto two lines when the table is tight */
  wrap?: boolean
}) {
  const on = sort.key === id
  return (
    <th className={`${wrap ? 'px-2 align-bottom leading-tight' : 'whitespace-nowrap px-3'} py-2.5 text-[12px] font-semibold ${align === 'right' ? 'text-right' : 'text-left'} ${className}`} style={{ color: on ? TEXT : SUBTLE }}
      aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(id)} className={`inline-flex cursor-pointer gap-1 ${wrap ? 'items-end' : 'items-center'} ${align === 'right' ? `${wrap ? '' : 'flex-row-reverse'} text-right` : 'text-left'}`}>
        {children}
        <span className="flex flex-col leading-none" style={{ color: on ? BLUE : '#D0D5DD' }}>
          <CaretUp size={8} weight="fill" style={{ opacity: on && sort.dir === 1 ? 1 : 0.45 }} />
          <CaretDown size={8} weight="fill" style={{ opacity: on && sort.dir === -1 ? 1 : 0.45 }} />
        </span>
      </button>
    </th>
  )
}
export function useSort<K extends string>(initial: K, dir: 1 | -1 = -1) {
  const [sort, setSort] = useState<{ key: K; dir: 1 | -1 }>({ key: initial, dir })
  const onSort = useCallback((k: K) => setSort(s => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: -1 })), [])
  return { sort, onSort }
}

// ─── Link buttons ─────────────────────────────────────────────────────────────
export function CallLink({ phone, name, size = 34 }: { phone: string | null | undefined; name: string; size?: number }) {
  if (!phone10(phone)) return null
  return (
    <a href={telHref(phone)} aria-label={`Call ${name}`} title={`Call ${formatPhone(phone)}`}
      className="grid shrink-0 place-items-center rounded-[10px] border no-underline transition-colors hover:bg-[#ECFDF3]"
      style={{ width: size, height: size, borderColor: '#ABEFC6', color: GREEN_D, background: '#F6FEF9' }}>
      <Phone size={15} weight="fill" />
    </a>
  )
}
export function WaLink({ phone, name, size = 34 }: { phone: string | null | undefined; name: string; size?: number }) {
  if (!phone10(phone)) return null
  return (
    <a href={waHref(phone, `Hi ${name}, `)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${name}`} title="WhatsApp"
      className="grid shrink-0 place-items-center rounded-[10px] border no-underline transition-colors hover:bg-[#ECFDF3]"
      style={{ width: size, height: size, borderColor: BORDER_2, color: '#079455', background: CANVAS }}>
      <WhatsappLogo size={16} weight="fill" />
    </a>
  )
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
export type BarPart = { key: string; label: string; value: number; color: string }
export type BarPoint = { tick: string; label: string; parts: BarPart[]; ghost?: number; dot?: number | null }

/**
 * Vertical bars (stacked when a point has several parts). A dashed outline (`ghost`) can show a comparison, and a
 * dot (`dot`) a second measure on the same scale. Hover, tap or focus a bar to read it in the strip underneath.
 */
export function BarChart({ points, format = nf, height = 220, every = [1, 1], ghostLabel, dotLabel, unit, empty }: {
  points: BarPoint[]; format?: (n: number) => string; height?: number; every?: [number, number]
  ghostLabel?: string; dotLabel?: string; unit?: (n: number) => string; empty?: string
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const tot = (p: BarPoint) => sum(p.parts, x => x.value)
  // Before anything is picked, the strip shows the latest bar that has something in it
  const lastFilled = points.reduce((k, p, i) => (tot(p) > 0 ? i : k), points.length - 1)
  const active = Math.min(picked ?? lastFilled, points.length - 1)
  const top = niceMax(Math.max(1, ...points.map(tot), ...points.map(p => p.ghost ?? 0), ...points.map(p => p.dot ?? 0)))
  const a = points[active]
  const [sm, xs] = every
  const hasData = points.some(p => tot(p) > 0 || (p.ghost ?? 0) > 0)
  if (!points.length) return null
  return (
    <div>
      <div className="flex gap-2" style={{ height }}>
        <div className="flex w-9 shrink-0 flex-col" aria-hidden>
          <div className="relative flex-1 text-right text-[11px] tabular-nums" style={{ color: LABEL }}>
            {[1, 0.5, 0].map(f => (
              <span key={f} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(1 - f) * 100}%` }}>
                {f ? format(top * f).replace('₹', '') : '0'}
              </span>
            ))}
          </div>
          <div className="h-6 shrink-0" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex-1">
            {[0, 0.5, 1].map(f => (
              <span key={f} aria-hidden className="absolute inset-x-0 border-t" style={{ top: `${f * 100}%`, borderColor: f === 1 ? BORDER_2 : '#F2F4F7' }} />
            ))}
            {!hasData && empty && (
              <div className="absolute inset-0 grid place-items-center text-[13px]" style={{ color: LABEL }}>{empty}</div>
            )}
            <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-1">
              {points.map((p, i) => {
                const v = tot(p), on = i === active
                return (
                  <button key={i} type="button" onMouseEnter={() => setPicked(i)} onFocus={() => setPicked(i)} onClick={() => setPicked(i)}
                    aria-label={`${p.label}: ${format(v)}`} aria-pressed={on}
                    className="relative flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center rounded-t-[6px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#84ADFF]"
                    style={{ background: on ? 'rgba(29,78,216,0.07)' : 'transparent' }}>
                    {(p.ghost ?? 0) > 0 && (
                      <span aria-hidden className="absolute bottom-0 rounded-t-[4px] border-[1.5px] border-b-0 border-dashed"
                        style={{ height: `${((p.ghost ?? 0) / top) * 100}%`, left: '12%', right: '12%', borderColor: '#98A2B3' }} />
                    )}
                    <span className="relative flex w-[72%] flex-col-reverse overflow-hidden rounded-t-[4px]"
                      style={{ height: v ? `${Math.max(1.5, (v / top) * 100)}%` : 2, background: v ? undefined : '#EAECF0' }}>
                      {v > 0 && p.parts.map(x => x.value > 0 ? <span key={x.key} style={{ flexGrow: x.value, flexBasis: 0, background: x.color }} /> : null)}
                    </span>
                    {p.dot != null && p.dot > 0 && (
                      <span aria-hidden className="absolute left-1/2 size-[9px] -translate-x-1/2 translate-y-1/2 rounded-full border-2 bg-white"
                        style={{ bottom: `${(p.dot / top) * 100}%`, borderColor: '#101828' }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex h-6 shrink-0 gap-[2px] pt-2 sm:gap-1" aria-hidden>
            {points.map((p, i) => {
              const k = points.length - 1 - i
              const showXs = k % xs === 0, showSm = k % sm === 0
              const on = i === active
              return (
                <span key={i} className="relative min-w-0 flex-1">
                  {(showXs || showSm) && (
                    <span className={`absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none ${!showXs ? 'hidden sm:block' : ''} ${!showSm ? 'sm:hidden' : ''}`}
                      style={{ color: on ? TEXT : LABEL, fontWeight: on ? 600 : 500 }}>
                      {p.tick}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      </div>
      {a && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: BORDER, background: SURFACE }}>
          <span className="text-[13.5px] font-semibold" style={{ color: TEXT }}>{a.label}</span>
          <span className="text-[13.5px] tabular-nums" style={{ color: TEXT_2 }}>{unit ? unit(tot(a)) : format(tot(a))}</span>
          {a.parts.length > 1 && a.parts.filter(x => x.value > 0).map(x => (
            <span key={x.key} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]" style={{ color: SUBTLE }}>
              <span className="size-2 rounded-full" style={{ background: x.color }} />{x.label}
              <span className="font-semibold tabular-nums" style={{ color: TEXT_2 }}>{format(x.value)}</span>
            </span>
          ))}
          {dotLabel && a.dot != null && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]" style={{ color: SUBTLE }}>
              <span className="size-[9px] rounded-full border-2 bg-white" style={{ borderColor: '#101828' }} />{dotLabel}
              <span className="font-semibold tabular-nums" style={{ color: TEXT_2 }}>{format(a.dot)}</span>
            </span>
          )}
          {ghostLabel && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] sm:ml-auto" style={{ color: SUBTLE }}>
              <span className="h-2.5 w-3 rounded-t-[2px] border-[1.5px] border-b-0 border-dashed" style={{ borderColor: '#98A2B3' }} />
              {ghostLabel} <span className="font-semibold tabular-nums" style={{ color: TEXT_2 }}>{format(a.ghost ?? 0)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Legend row for charts */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; ring?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
      {items.map(x => (
        <span key={x.label} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]" style={{ color: SUBTLE }}>
          {x.dashed ? <span className="h-2.5 w-3 rounded-t-[2px] border-[1.5px] border-b-0 border-dashed" style={{ borderColor: x.color }} />
            : x.ring ? <span className="size-[9px] rounded-full border-2 bg-white" style={{ borderColor: x.color }} />
            : <span className="size-2 rounded-full" style={{ background: x.color }} />}
          {x.label}
        </span>
      ))}
    </div>
  )
}

// ─── Heatmap (day of week × time of day) ──────────────────────────────────────
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const SLOTS = ['12–3 am', '3–6 am', '6–9 am', '9–12 noon', '12–3 pm', '3–6 pm', '6–9 pm', '9–12 pm']
/** Monday-first weekday and 3-hour slot of a local time */
export function cellOf(t: number) {
  const d = new Date(t)
  return { day: (d.getDay() + 6) % 7, slot: Math.floor(d.getHours() / 3) }
}
export function Heatmap({ grid, color = '29,78,216', format = nf, cellTitle, text }: {
  grid: number[][]; color?: string; format?: (n: number) => string
  cellTitle?: (day: number, slot: number, v: number) => string
  /** Overrides what a cell shows ('·' for none) */
  text?: (day: number, slot: number, v: number) => string
}) {
  const max = Math.max(1, ...grid.flat())
  return (
    <div className="@container overflow-x-auto [scrollbar-width:thin]">
      <table className="w-full min-w-[296px] border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="w-8 @md:w-10" />
            {SLOTS.map((s, i) => (
              <th key={s} className="px-0.5 pb-1 text-center text-[11px] font-medium" style={{ color: LABEL }}>
                <span className="hidden @xl:inline">{s}</span><span className="@xl:hidden">{['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'][i]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((d, di) => (
            <tr key={d}>
              <th className="pr-1 text-left text-[11px] font-semibold @md:text-[12px]" style={{ color: SUBTLE }}>{d}</th>
              {SLOTS.map((s, si) => {
                const v = grid[di]?.[si] ?? 0
                const f = v / max
                return (
                  <td key={s} title={cellTitle ? cellTitle(di, si, v) : `${d} ${s}: ${format(v)}`}
                    className="h-8 rounded-[6px] text-center text-[10px] font-semibold tabular-nums @md:text-[11.5px]"
                    style={{ background: v ? `rgba(${color},${0.08 + f * 0.84})` : '#F9FAFB', color: f > 0.55 ? '#FFFFFF' : v ? TEXT_2 : '#D0D5DD' }}>
                    {text ? text(di, si, v) : v ? format(v) : '·'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export const emptyGrid = () => WEEKDAYS.map(() => SLOTS.map(() => 0))

// ─── Donut ────────────────────────────────────────────────────────────────────
export function Donut({ parts, size = 140, stroke = 18, center, sub }: {
  parts: { label: string; value: number; color: string }[]; size?: number; stroke?: number; center: ReactNode; sub?: ReactNode
}) {
  const total = sum(parts, x => x.value)
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const gap = parts.filter(x => x.value > 0).length > 1 ? 3 : 0
  const arcs = parts.reduce<{ label: string; color: string; len: number; off: number }[]>((acc, x) => {
    const off = acc.length ? acc[acc.length - 1].off + acc[acc.length - 1].len + gap : 0
    const len = total ? Math.max(0, (x.value / total) * c - gap) : 0
    return [...acc, { label: x.label, color: x.color, len, off }]
  }, [])
  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }} role="img" aria-label={parts.map(p => `${p.label} ${p.value}`).join(', ')}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F2F4F7" strokeWidth={stroke} />
        {arcs.filter(x => x.len > 0).map(x => (
          <circle key={x.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={x.color} strokeWidth={stroke}
            strokeDasharray={`${x.len} ${c - x.len}`} strokeDashoffset={-x.off} />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[22px] font-semibold leading-none tabular-nums" style={{ color: TEXT }}>{center}</div>
          {sub && <div className="mt-1 text-[12px]" style={{ color: SUBTLE }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── States ───────────────────────────────────────────────────────────────────
export function PageSkeleton({ cards = 4, panels = 4 }: { cards?: number; panels?: number }) {
  const bar = (w: string, h = 12) => <span className="block animate-pulse rounded-full" style={{ width: w, height: h, background: '#F2F4F7' }} />
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${cards >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="rounded-[18px] border p-1.5" style={{ background: SURFACE, borderColor: BORDER }}>
            <div className="px-2.5 pb-2.5 pt-2">{bar('50%')}</div>
            <div className="rounded-[13px] border bg-white px-4 py-4" style={{ borderColor: BORDER }}>{bar('60%', 26)}<div className="h-4" />{bar('100%', 28)}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {Array.from({ length: panels }, (_, i) => (
          <div key={i} className="h-[320px] rounded-[16px] border p-5" style={{ borderColor: BORDER }}>{bar('40%', 16)}<div className="h-3" />{bar('70%')}</div>
        ))}
      </div>
    </div>
  )
}
export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3.5" style={{ borderColor: '#FECDCA', background: '#FEF3F2' }}>
      <WarningCircle size={20} weight="bold" color="#B42318" />
      <span className="min-w-0 flex-1 text-[14px]" style={{ color: '#B42318' }}>Couldn&apos;t load your numbers: {text}</span>
      <Btn size="sm" onClick={onRetry}><ArrowClockwise size={14} weight="bold" />Try again</Btn>
    </div>
  )
}
export function RefreshBtn({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <Btn onClick={onRefresh} disabled={refreshing} label="Refresh" title="Refresh">
      <ArrowClockwise size={16} weight="bold" className={refreshing ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span>
    </Btn>
  )
}

/** A number with a label, for compact stat grids inside panels */
export function Figure({ label, value, sub, tone, style }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string; style?: CSSProperties }) {
  return (
    <div className="min-w-0 rounded-[12px] border px-3.5 py-3" style={{ borderColor: BORDER, background: CANVAS, boxShadow: XS, ...style }}>
      <div className="truncate text-[12.5px] font-medium" style={{ color: SUBTLE }}>{label}</div>
      <div className="mt-1 truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] tabular-nums" style={{ color: tone ?? TEXT }}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[12.5px]" style={{ color: SUBTLE }}>{sub}</div>}
    </div>
  )
}

// ─── Printing ─────────────────────────────────────────────────────────────────
export const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

/** Keeps colours and gradients when printed. Add the `lg-report` class to the element you print. */
export const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
}
.lg-report * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`

/**
 * Prints one element on its own (the browser's "Save as PDF" makes the file). Opens it in a new window with the
 * page's styles, so the sidebar and tabs stay out. Nodes marked `data-fill="key"` get `fill[key]`;
 * `data-fill="date"` gets today's date.
 */
export function printElement(id: string, title: string, fill: Record<string, string> = {}) {
  const el = document.getElementById(id)
  if (!el) return
  const w = window.open('', '_blank', 'width=1000,height=760')
  if (!w) { window.print(); return }
  const clone = el.cloneNode(true) as HTMLElement
  const values: Record<string, string> = { date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), ...fill }
  clone.querySelectorAll<HTMLElement>('[data-fill]').forEach(n => { const v = values[n.dataset.fill ?? '']; if (v != null) n.textContent = v })
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(n => n.outerHTML).join('')
  w.document.open()
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${styles}
    <style>body{background:#fff;margin:0;padding:24px;font-family:inherit} .no-print{display:none!important} @page{margin:12mm} section{break-inside:avoid}</style></head>
    <body class="lg-report">${clone.outerHTML}</body></html>`)
  w.document.close()
  w.addEventListener('load', () => setTimeout(() => { w.focus(); w.print() }, 250))
}
