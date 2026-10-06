'use client'

import { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo, type ReactNode, type SyntheticEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type CRMLead } from '@/lib/twenty'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  Phone, WhatsappLogo, MagnifyingGlass, X, Funnel, CaretDown, CaretLeft, CaretRight,
  ArrowRight, ArrowDown, UserSwitch, Check, DownloadSimple, CalendarBlank, ArrowsDownUp, Info, Fire,
  PhoneSlash, HourglassMedium, Sparkle, CurrencyInr, Warning, Clock, Lightbulb, Wallet, Trophy,
  Globe, FacebookLogo, GoogleLogo, Megaphone, Handshake, ChartBar, House, Kanban, Target, ArrowClockwise,
  UsersThree,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import { ReassignModal } from '@/components/ReassignModal'

const LEADS_TABS = [
  { label: 'All Leads', href: '/dashboard/leads', exact: true },
  { label: 'Pipeline',  href: '/dashboard/lifecycle' },
]

// ─── Design tokens (shared with the Leads pages) ──────────────────────────────
const CANVAS   = '#FFFFFF'
const SURFACE  = '#F9FAFB'
const BORDER   = '#EAECF0'
const BORDER_2 = '#D0D5DD'
const TEXT     = '#101828'
const TEXT_2   = '#344054'
const MUTED    = '#475467'
const SUBTLE   = '#667085'
const LABEL    = '#98A2B3'
const BLUE     = '#1D4ED8'
const BLUE_BG  = '#EFF4FF'
const BLUE_LN  = '#B2CCFF'
const GREEN    = '#17B26A'
const XS       = '0 1px 2px rgba(16,24,40,0.05)'
const MONO     = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const DAY      = 86_400_000
const HOUR     = 3_600_000

// ─── Stages (LIFECYCLE_SPEC §2) ───────────────────────────────────────────────
type StageId = 'New' | 'Cold' | 'Warm' | 'Hot' | 'Closed' | 'Disqualified' | 'Hold'
type StageDef = { label: string; meaning: string; color: string; bg: string; border: string; dot: string }
const STAGE: Record<StageId, StageDef> = {
  New:          { label: 'New',          meaning: 'Not contacted yet',       color: '#344054', bg: '#F9FAFB', border: '#D0D5DD', dot: '#98A2B3' },
  Cold:         { label: 'Cold',         meaning: 'Contact attempted',       color: '#026AA2', bg: '#F0F9FF', border: '#B9E6FE', dot: '#0BA5EC' },
  Warm:         { label: 'Warm',         meaning: 'Requirements confirmed',  color: '#B54708', bg: '#FFFAEB', border: '#FEDF89', dot: '#F79009' },
  Hot:          { label: 'Hot',          meaning: 'EOI received',            color: '#C4320A', bg: '#FFF6ED', border: '#F9DBAF', dot: '#EF6820' },
  Closed:       { label: 'Closed',       meaning: 'Deal done',               color: '#067647', bg: '#ECFDF3', border: '#ABEFC6', dot: '#17B26A' },
  Disqualified: { label: 'Disqualified', meaning: 'Dropped or unreachable',  color: '#C01048', bg: '#FFF1F3', border: '#FECDD6', dot: '#F63D68' },
  Hold:         { label: 'On hold',      meaning: 'Paused until a set date', color: '#5925DC', bg: '#F4F3FF', border: '#D9D6FE', dot: '#7A5AF8' },
}
const BOARD_ORDER: StageId[] = ['New', 'Cold', 'Warm', 'Hot', 'Closed', 'Disqualified', 'Hold']
const NEXT: Partial<Record<StageId, StageId>> = { New: 'Cold', Cold: 'Warm', Warm: 'Hot', Hot: 'Closed' }
const OPEN    = new Set<StageId>(['New', 'Cold', 'Warm', 'Hot', 'Hold'])
const MOVING  = new Set<StageId>(['Cold', 'Warm', 'Hot'])                                   // contacted and still in play
const MOVABLE = new Set<StageId>(['New', 'Cold', 'Warm', 'Hot', 'Closed', 'Disqualified'])   // what PATCH /api/crm/leads/[id] accepts
// How far a lead got. Dropped and on-hold leads were contacted at least once.
const REACH: Record<StageId, number> = { New: 0, Cold: 1, Hold: 1, Disqualified: 1, Warm: 2, Hot: 3, Closed: 4 }

// Older boards wrote sub-stage names; read them into the six real statuses
const LEGACY: Record<string, StageId> = {
  fresh: 'New', attempting: 'Cold', 'vm done': 'Cold', connected: 'Warm', 'virtual meeting': 'Warm',
  'site visit': 'Hot', negotiation: 'Hot', won: 'Closed', lost: 'Disqualified', nc: 'Disqualified', 'on hold': 'Hold',
}
function stageOf(l: CRMLead): StageId {
  const k = (l.status ?? 'New').trim().toLowerCase()
  return (Object.keys(STAGE) as StageId[]).find(id => id.toLowerCase() === k) ?? LEGACY[k] ?? 'New'
}

// Activity types that count as reaching out (LIFECYCLE_SPEC §4), plus older lowercase ones
const CONTACT_TYPES = new Set([
  'call made', 'call missed', 'whatsapp sent', 'whatsapp received', 'email sent', 'email received',
  'vm done', 'obm done', 'site visit done', 'call', 'whatsapp', 'email',
])

// ─── Helpers ──────────────────────────────────────────────────────────────────
type DateRange = 'all' | '7d' | '30d' | 'month' | '90d'
const DATE_LABELS: Record<DateRange, string> = {
  all: 'All time', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', '90d': 'Last 3 months',
}
function inRange(iso: string, range: DateRange, now: number) {
  if (range === 'all') return true
  const t = new Date(iso).getTime()
  if (range === 'month') { const d = new Date(now); return t >= new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  return t >= now - days * DAY
}

type Focus = 'none' | 'open' | 'uncontacted' | 'quiet' | 'outcomes'
const FOCUS_LABELS: Record<Focus, string> = {
  none: 'All', open: 'Open', uncontacted: 'Not contacted', quiet: 'Gone quiet', outcomes: 'Won & lost',
}

type IntentFilter = 'all' | 'high' | 'medium' | 'low'
const INTENT_LABELS: Record<IntentFilter, string> = { all: 'Any score', high: 'High (70+)', medium: 'Medium (40–69)', low: 'Low (<40)' }

type SortBy = 'priority' | 'intent' | 'value' | 'idle' | 'newest'
const SORT_LABELS: Record<SortBy, string> = {
  priority: 'Priority', intent: 'Intent score', value: 'Deal value', idle: 'Longest without update', newest: 'Newest first',
}

const displayName = (l: CRMLead) => `${l.name?.firstName ?? ''} ${l.name?.lastName ?? ''}`.trim() || 'Unnamed'
const getInitials = (l: CRMLead) => ((l.name?.firstName?.[0] ?? '') + (l.name?.lastName?.[0] ?? '')).toUpperCase() || '?'
const dealValue   = (l: CRMLead) => l.budgetMax ?? l.budgetMin ?? 0
const pct         = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
function phone10(l: CRMLead): string | null {
  const d = (l.phones?.primaryPhoneNumber ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : null
}

// Stable CS ID: real one if assigned, else derived from UUID so legacy leads always show one
function getCsId(lead: CRMLead): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
}

/** ₹ in lakh / crore, the way Indian real estate reads it */
function inr(n: number) {
  if (!n) return '₹0'
  const fx = (x: number) => (x >= 100 ? Math.round(x).toLocaleString('en-IN') : String(+x.toFixed(1)))
  if (n >= 1e7) return `₹${fx(n / 1e7)} Cr`
  if (n >= 1e5) return `₹${fx(n / 1e5)} L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
/** Shorter ₹ for tight legends: no decimals from ₹10 Cr / ₹10 L up */
function inrCompact(n: number) {
  if (n >= 1e8) return `₹${Math.round(n / 1e7).toLocaleString('en-IN')} Cr`
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(1)} Cr`
  if (n >= 1e6) return `₹${Math.round(n / 1e5)} L`
  return inr(n)
}
function durShort(ms: number) {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))}m`
  if (ms < 2 * DAY) return `${Math.round(ms / HOUR)}h`
  return `${Math.round(ms / DAY)}d`
}
function durLong(ms: number) {
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  if (ms < HOUR) return plural(Math.max(1, Math.round(ms / 60_000)), 'minute')
  if (ms < 2 * DAY) return plural(Math.round(ms / HOUR), 'hour')
  return plural(Math.round(ms / DAY), 'day')
}

function csvCell(v: string | number | null | undefined) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Avatar: soft two-tone gradient, cycles deterministically by name
const AVATAR_PALETTE = [
  { from: '#E0EAFF', to: '#C7D7FE', fg: '#2D31A6' },
  { from: '#FEF0C7', to: '#FEDF89', fg: '#93370D' },
  { from: '#DCFAE6', to: '#ABEFC6', fg: '#085D3A' },
  { from: '#F4EBFF', to: '#E9D7FE', fg: '#53389E' },
  { from: '#FDF2FA', to: '#FCCEEE', fg: '#9E165F' },
  { from: '#E0F2FE', to: '#B9E6FE', fg: '#065986' },
  { from: '#FEF6EE', to: '#F9DBAF', fg: '#932F19' },
  { from: '#F0F9FF', to: '#D1E9FF', fg: '#1849A9' },
]
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[Math.abs(h)]
}
// Demo photos, CS ID → public image path (same map as the Leads pages)
const AVATAR_MAP: Record<string, string> = {
  'CS01689': '/avatars/adi.png',
}

// Source → label + portal logo (public/portals) or icon
type SourceMeta = { label: string; logo?: string; Icon?: typeof Globe; color?: string }
const SOURCE_META: Record<string, SourceMeta> = {
  OPT99ACRES:     { label: '99acres', logo: '/portals/99acres.png' },
  '99ACRES':      { label: '99acres', logo: '/portals/99acres.png' },
  MAGICBRICKS:    { label: 'MagicBricks', logo: '/portals/magicbricks.png' },
  HOUSINGCOM:     { label: 'Housing.com', logo: '/portals/housing.png' },
  HOUSING:        { label: 'Housing.com', logo: '/portals/housing.png' },
  MAKAAN:         { label: 'Makaan', logo: '/portals/makaan.png' },
  NOBROKER:       { label: 'NoBroker', logo: '/portals/nobroker.png' },
  PROPTIGER:      { label: 'PropTiger', logo: '/portals/proptiger.png' },
  SQUAREYARDS:    { label: 'Square Yards', logo: '/portals/squareyards.png' },
  COMMONFLOOR:    { label: 'CommonFloor', logo: '/portals/commonfloor.png' },
  FACEBOOK:       { label: 'Facebook', Icon: FacebookLogo, color: '#1877F2' },
  GOOGLE:         { label: 'Google Ads', Icon: GoogleLogo, color: '#EA4335' },
  CHANNELPARTNER: { label: 'Channel Partner', Icon: Handshake, color: '#7A5AF8' },
  MARKETING:      { label: 'Marketing', Icon: Megaphone, color: '#DD2590' },
}
function sourceMeta(raw: string | null): SourceMeta {
  if (!raw) return { label: 'Direct', Icon: Globe, color: SUBTLE }
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (SOURCE_META[key]) return SOURCE_META[key]
  const label = raw.length > 3 && raw === raw.toUpperCase()
    ? raw.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : raw
  return { label, Icon: Globe, color: SUBTLE }
}

function SourceMark({ raw, size = 20 }: { raw: string | null; size?: number }) {
  const m = sourceMeta(raw)
  if (m.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.logo} alt="" width={size} height={size} className="shrink-0 rounded-[5px]" style={{ width: size, height: size }} />
  }
  const Icon = m.Icon ?? Globe
  return (
    <span className="grid shrink-0 place-items-center rounded-[5px] border bg-white" style={{ width: size, height: size, borderColor: BORDER }}>
      <Icon size={size * 0.62} weight="fill" color={m.color} />
    </span>
  )
}

// Demand buckets, same bands as the main dashboard
const BUDGET_BANDS = [
  { label: 'Under ₹50 L', max: 5e6 }, { label: '₹50 L – 1 Cr', max: 1e7 }, { label: '₹1 – 2 Cr', max: 2e7 },
  { label: '₹2 – 5 Cr', max: 5e7 }, { label: '₹5 Cr +', max: Infinity },
]
function budgetBand(v: number) {
  if (!v) return 'Not shared'
  return BUDGET_BANDS.find(b => v < b.max)!.label
}
function propLabel(raw: string) {
  const m = raw.match(/(\d)\s*BHK/i)
  if (m) return `${m[1]} BHK`
  const t = raw.trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const TIMELINE_ORDER = ['Immediate', 'Within 3 months', 'Within 6 months', 'Later', 'Not shared']
function timelineBucket(t: string | null) {
  if (!t) return 'Not shared'
  const s = t.toLowerCase()
  if (/immediate|asap|ready|this month|1 month/.test(s)) return 'Immediate'
  if (/(^|\D)(1\s*[-–]\s*3|3)\s*month/.test(s)) return 'Within 3 months'
  if (/6\s*month/.test(s) && !/\+|more|later|beyond/.test(s)) return 'Within 6 months'
  return 'Later'
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
type Activity = { id: string; personId: string | null; type: string; createdAt: string }

type ReasonKey = 'hot-quiet' | 'near-dq' | 'first-call' | 'fresh' | 'escalated' | 'warm-quiet' | 'big-stuck' | 'quiet'
type Reason = { key: ReasonKey; text: string; sev: number }

type PLead = {
  lead: CRMLead
  id: string
  name: string
  stage: StageId
  value: number
  intent: number
  ageMs: number        // since the lead came in
  idleD: number        // days since the last update or logged activity
  nc: number           // unanswered calls in a row (5 = auto-disqualified)
  firstMs: number | null
  reason: Reason | null
  priority: number
}

/** Why this lead needs a touch today, most urgent first. null = nothing pressing. */
function reasonFor(p: Omit<PLead, 'reason' | 'priority'>, bigTicket: number): Reason | null {
  const d = Math.floor(p.idleD)
  const live = OPEN.has(p.stage) && p.stage !== 'Hold'
  if (p.stage === 'Hot' && p.idleD >= 3) return { key: 'hot-quiet', text: `Hot deal, no update for ${d} days`, sev: 100 }
  if (live && p.nc >= 3) return { key: 'near-dq', text: `${p.nc} of 5 calls unanswered. Try WhatsApp`, sev: 88 }
  if (p.stage === 'New' && p.ageMs >= DAY) return { key: 'first-call', text: `Waiting ${durLong(p.ageMs)} for a first call`, sev: 82 }
  if (p.stage === 'New') return { key: 'fresh', text: `New enquiry, ${durLong(p.ageMs)} ago`, sev: 76 }
  if (live && p.lead.escalated) return { key: 'escalated', text: 'Escalated for priority follow-up', sev: 78 }
  if (p.stage === 'Warm' && p.idleD >= 5) return { key: 'warm-quiet', text: `Warm, no update for ${d} days`, sev: 72 }
  if (p.stage === 'Cold' && p.value >= bigTicket && p.idleD >= 7) return { key: 'big-stuck', text: `${inr(p.value)} budget, stuck in Cold for ${d} days`, sev: 66 }
  if (p.stage === 'Cold' && p.idleD >= 7) return { key: 'quiet', text: `No update for ${d} days`, sev: 45 }
  return null
}

type Row = { label: string; raw?: string | null; n: number; contacted: number; q: number; closed: number; intent: number; value: number }
function tally(items: PLead[], keyOf: (p: PLead) => string, rawOf?: (p: PLead) => string | null) {
  const m = new Map<string, Row>()
  for (const p of items) {
    const k = keyOf(p)
    const r = m.get(k) ?? { label: k, raw: rawOf?.(p) ?? null, n: 0, contacted: 0, q: 0, closed: 0, intent: 0, value: 0 }
    r.n++
    if (REACH[p.stage] >= 1) r.contacted++
    if (REACH[p.stage] >= 2) r.q++
    if (p.stage === 'Closed') r.closed++
    r.intent += p.intent
    if (OPEN.has(p.stage)) r.value += p.value
    m.set(k, r)
  }
  return m
}

function analyse(all: CRMLead[], acts: Activity[], now: number, range: DateRange) {
  const lastAct = new Map<string, number>()
  const firstContact = new Map<string, number>()
  for (const a of acts) {
    if (!a.personId) continue
    const t = new Date(a.createdAt).getTime()
    if (!Number.isFinite(t)) continue
    if (t > (lastAct.get(a.personId) ?? 0)) lastAct.set(a.personId, t)
    if (CONTACT_TYPES.has((a.type ?? '').toLowerCase()) && t < (firstContact.get(a.personId) ?? Infinity)) firstContact.set(a.personId, t)
  }

  const base = (now ? all.filter(l => inRange(l.createdAt, range, now)) : []).map(l => {
    const created = new Date(l.createdAt).getTime()
    const touched = Math.max(new Date(l.updatedAt ?? l.createdAt).getTime(), lastAct.get(l.id) ?? 0)
    const fc = firstContact.get(l.id)
    return {
      lead: l, id: l.id, name: displayName(l), stage: stageOf(l), value: dealValue(l), intent: l.intentScore ?? 0,
      ageMs: Math.max(0, now - created), idleD: Math.max(0, (now - touched) / DAY), nc: l.failedContactAttempts ?? 0,
      firstMs: fc != null && fc >= created ? fc - created : null,
    }
  })

  // "Big ticket" = top quarter of open budgets, never below ₹1 Cr
  const openVals = base.filter(p => OPEN.has(p.stage) && p.value > 0).map(p => p.value).sort((a, b) => a - b)
  const bigTicket = Math.max(1e7, openVals.length ? openVals[Math.floor(openVals.length * 0.75)] : 0)

  const items: PLead[] = base.map(p => {
    const reason = reasonFor(p, bigTicket)
    const priority = (reason?.sev ?? 0) + p.intent * 0.35 + Math.min(20, (p.value / 1e7) * 4) + (OPEN.has(p.stage) ? Math.min(15, p.idleD * 0.5) : 0)
    return { ...p, reason, priority }
  })
  const by = (s: StageId) => items.filter(p => p.stage === s)
  const sum = (list: PLead[]) => list.reduce((s, p) => s + p.value, 0)

  // KPI 1 · open pipeline
  const open = items.filter(p => OPEN.has(p.stage))
  const openValue = sum(open)
  const valueBy = (['New', 'Cold', 'Warm', 'Hot', 'Hold'] as StageId[]).map(s => ({ stage: s, value: sum(by(s)) }))
  const lateShare = pct(sum(by('Warm')) + sum(by('Hot')), openValue)

  // KPI 2 · speed to lead
  const news = by('New')
  const newBuckets = [
    { label: 'Under 1 hour', n: news.filter(p => p.ageMs < HOUR).length, color: '#17B26A' },
    { label: '1 – 24 hours', n: news.filter(p => p.ageMs >= HOUR && p.ageMs < DAY).length, color: '#F79009' },
    { label: '1 – 3 days', n: news.filter(p => p.ageMs >= DAY && p.ageMs < 3 * DAY).length, color: '#EF6820' },
    { label: 'Over 3 days', n: news.filter(p => p.ageMs >= 3 * DAY).length, color: '#F04438' },
  ]
  const over24 = news.filter(p => p.ageMs >= DAY).length
  const oldestNew = news.reduce((m, p) => Math.max(m, p.ageMs), 0)
  const firsts = items.map(p => p.firstMs).filter((x): x is number => x != null).sort((a, b) => a - b)
  const medianFirst = firsts.length >= 3 ? firsts[Math.floor(firsts.length / 2)] : null

  // KPI 3 · contacted, then gone quiet
  const quiet = items.filter(p => MOVING.has(p.stage) && p.idleD >= 7)
  const quietBy = (['Cold', 'Warm', 'Hot'] as StageId[]).map(s => ({ stage: s, n: quiet.filter(p => p.stage === s).length }))

  // KPI 4 · outcomes
  const closed = by('Closed'), dropped = by('Disqualified')
  const winRate = closed.length + dropped.length ? pct(closed.length, closed.length + dropped.length) : null
  const closeDays = closed.map(p => (new Date(p.lead.updatedAt).getTime() - new Date(p.lead.createdAt).getTime()) / DAY).filter(d => d >= 0)
  const avgClose = closeDays.length ? Math.round(closeDays.reduce((a, b) => a + b, 0) / closeDays.length) : null

  // Funnel: how many reached each step
  const reached = (r: number) => items.filter(p => REACH[p.stage] >= r).length
  const steps = [
    { key: 'in',        label: 'Leads in',     hint: 'All enquiries',          n: items.length, dot: STAGE.New.dot },
    { key: 'contacted', label: 'Contacted',    hint: 'Called or messaged',     n: reached(1),   dot: STAGE.Cold.dot },
    { key: 'qualified', label: 'Qualified',    hint: 'Requirements confirmed', n: reached(2),   dot: STAGE.Warm.dot },
    { key: 'eoi',       label: 'EOI received', hint: 'Ready to book',          n: reached(3),   dot: STAGE.Hot.dot },
    { key: 'closed',    label: 'Closed',       hint: 'Deal done',              n: reached(4),   dot: STAGE.Closed.dot },
  ].map((s, i, arr) => ({ ...s, share: pct(s.n, arr[0].n), conv: i ? pct(s.n, arr[i - 1].n) : 100 }))
  let leakIdx = -1
  steps.forEach((s, i) => {
    if (i === 0 || steps[i - 1].n < 3) return
    if (leakIdx < 0 || s.conv < steps[leakIdx].conv) leakIdx = i
  })

  // Aging of open work (on-hold leads are paused on purpose, so they're left out)
  const AGE = [
    { label: '0–2', min: 0, max: 3 }, { label: '3–7', min: 3, max: 8 }, { label: '8–14', min: 8, max: 15 },
    { label: '15–30', min: 15, max: 31 }, { label: '30+', min: 31, max: Infinity },
  ]
  const live = open.filter(p => p.stage !== 'Hold')
  const aging = AGE.map(b => {
    const inB = live.filter(p => p.idleD >= b.min && p.idleD < b.max)
    return { label: b.label, total: inB.length, by: (['New', 'Cold', 'Warm', 'Hot'] as StageId[]).map(s => ({ stage: s, n: inB.filter(p => p.stage === s).length })) }
  })
  const staleShare = pct(live.filter(p => p.idleD >= 15).length, live.length)
  const stalest = [...live].sort((x, y) => y.idleD - x.idleD).slice(0, 3)

  // Sources, merged by label so MAGICBRICKS and MagicBricks are one row
  const sources = [...tally(items, p => sourceMeta(p.lead.sourcePortal).label, p => p.lead.sourcePortal).values()].sort((a, b) => b.n - a.n)

  // What buyers want
  const ordered = (m: Map<string, Row>, order?: string[]) =>
    order ? order.map(k => m.get(k)).filter((r): r is Row => !!r) : [...m.values()].sort((a, b) => b.n - a.n).slice(0, 6)
  const demand = {
    budget:   ordered(tally(items, p => budgetBand(p.value)), [...BUDGET_BANDS.map(b => b.label), 'Not shared']),
    location: ordered(tally(items, p => p.lead.localities?.[0] ?? p.lead.city ?? 'Not shared')),
    property: ordered(tally(items, p => (p.lead.propertyType?.[0] ? propLabel(p.lead.propertyType[0]) : 'Not shared'))),
    timeline: ordered(tally(items, p => timelineBucket(p.lead.timeline)), TIMELINE_ORDER),
  }

  // Weekly flow, last 8 weeks across all leads (ignores the date filter)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const w = 7 - i
    const end = now - w * 7 * DAY, start = end - 7 * DAY
    const inW = (iso: string) => { const t = new Date(iso).getTime(); return t >= start && t < end }
    return {
      label: w === 0 ? 'This wk' : new Date(start + DAY).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      added: all.filter(l => inW(l.createdAt)).length,
      closed: all.filter(l => stageOf(l) === 'Closed' && inW(l.updatedAt)).length,
    }
  })

  const queue = items.filter(p => p.reason).sort((a, b) => b.priority - a.priority)

  return {
    items, bigTicket, queue,
    kpi: {
      openCount: open.length, openValue, valueBy, lateShare,
      newCount: news.length, newBuckets, over24, oldestNew, medianFirst,
      quietCount: quiet.length, quietValue: sum(quiet), quietBy, hotQuiet: quiet.filter(p => p.stage === 'Hot').length,
      closedCount: closed.length, droppedCount: dropped.length, winRate, avgClose,
    },
    funnel: { steps, leakIdx, dropped: dropped.length, hold: by('Hold').length },
    aging, staleShare, stalest, liveCount: live.length,
    sources, demand, weeks,
  }
}
type Analysis = ReturnType<typeof analyse>

// ─── Small UI pieces ──────────────────────────────────────────────────────────
type Tone = 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'neutral'
const TONE: Record<Tone, { color: string; bg: string; border: string }> = {
  blue:    { color: BLUE,      bg: BLUE_BG,   border: BLUE_LN },
  green:   { color: '#067647', bg: '#ECFDF3', border: '#ABEFC6' },
  red:     { color: '#B42318', bg: '#FEF3F2', border: '#FECDCA' },
  amber:   { color: '#B54708', bg: '#FFFAEB', border: '#FEDF89' },
  violet:  { color: '#5925DC', bg: '#F4F3FF', border: '#D9D6FE' },
  neutral: { color: TEXT_2,    bg: SURFACE,   border: BORDER },
}

function Pill({ tone = 'neutral', small, children }: { tone?: Tone; small?: boolean; children: ReactNode }) {
  const t = TONE[tone]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-semibold tabular-nums ${small ? 'px-1.5 py-px text-[11.5px]' : 'px-2 py-0.5 text-[12px]'}`}
      style={{ color: t.color, background: t.bg, borderColor: t.border }}>
      {children}
    </span>
  )
}

function StagePill({ stage, small }: { stage: StageId; small?: boolean }) {
  const s = STAGE[stage]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${small ? 'px-2 py-px text-[12px]' : 'px-2.5 py-0.5 text-[13px]'}`}
      style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      <span className="size-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

function scoreTone(score: number) {
  if (score >= 70) return { bg: BLUE, fg: '#FFFFFF', label: 'High intent' }
  if (score >= 40) return { bg: '#F79009', fg: '#FFFFFF', label: 'Medium intent' }
  return { bg: '#E4E7EC', fg: MUTED, label: 'Low intent' }
}

function LeadAvatar({ lead, size = 36, badge = true }: { lead: CRMLead; size?: number; badge?: boolean }) {
  const name = displayName(lead)
  const av = avatarColor(name)
  const photo = AVATAR_MAP[getCsId(lead)]
  const score = lead.intentScore
  const tone = scoreTone(score ?? 0)
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="size-full rounded-full object-cover" style={{ boxShadow: '0 0 0 2px #fff, 0 0 0 3px #EAECF0' }} />
      ) : (
        <span className="grid size-full place-items-center rounded-full font-semibold"
          style={{ fontSize: Math.round(size * 0.36), background: `linear-gradient(140deg, ${av.from} 0%, ${av.to} 100%)`, color: av.fg, boxShadow: '0 0 0 2px #fff, 0 0 0 3px #EAECF0' }}>
          {getInitials(lead)}
        </span>
      )}
      {badge && score != null && (
        <span title={`Intent score ${score} · ${tone.label}`}
          className="absolute -bottom-1 -right-1.5 grid h-[16px] min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums"
          style={{ background: tone.bg, color: tone.fg, boxShadow: '0 0 0 2px #fff' }}>
          {score}
        </span>
      )}
    </span>
  )
}

/** Popover anchored under its trigger. Closes on outside click or Escape. */
function Popover({
  open, onOpenChange, trigger, children, align = 'left', width = 220,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  width?: number
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
        <div ref={panelRef}
          className={`absolute top-[calc(100%+8px)] z-40 rounded-[12px] border bg-white p-1.5 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)] ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ borderColor: BORDER, width, maxWidth: 'calc(100vw - 24px)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function MenuItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={active} onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[14px] transition-colors hover:bg-[#F9FAFB]"
      style={{ color: active ? TEXT : TEXT_2, fontWeight: active ? 600 : 500 }}>
      <span className="flex min-w-0 items-center gap-2">{children}</span>
      {active && <Check size={15} weight="bold" color={BLUE} />}
    </button>
  )
}

function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1.5 pt-2 text-[12px] font-semibold" style={{ color: SUBTLE }}>{children}</div>
}

/** Outlined button used across the page. */
function Btn({ onClick, children, label, active, className = '' }: {
  onClick: () => void; children: ReactNode; label?: string; active?: boolean; className?: string
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active}
      className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border px-3.5 text-[14px] font-semibold transition-colors ${active ? '' : 'hover:bg-[#F9FAFB]'} ${className}`}
      style={active
        ? { background: BLUE_BG, borderColor: BLUE_LN, color: BLUE, boxShadow: XS }
        : { background: CANVAS, borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
      {children}
    </button>
  )
}

/** Split button, like "Sort | ⌄" on the Leads page. */
function SplitBtn({ icon, children, onClick, active, badge }: {
  icon: ReactNode; children: ReactNode; onClick: () => void; active?: boolean; badge?: number
}) {
  return (
    <button type="button" onClick={onClick} aria-haspopup="menu"
      className="inline-flex h-10 shrink-0 cursor-pointer items-stretch overflow-hidden rounded-[10px] border text-[14px] font-semibold transition-colors hover:bg-[#F9FAFB]"
      style={{ background: active ? BLUE_BG : CANVAS, borderColor: active ? BLUE_LN : BORDER_2, color: active ? BLUE : TEXT_2, boxShadow: XS }}>
      <span className="flex items-center gap-2 px-3.5">
        {icon}
        {children}
        {badge ? <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: BLUE }}>{badge}</span> : null}
      </span>
      <span className="flex items-center border-l px-2.5" style={{ borderColor: active ? BLUE_LN : BORDER_2 }}>
        <CaretDown size={13} weight="bold" />
      </span>
    </button>
  )
}

/** Small segmented control. */
function Seg<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[]; label: string
}) {
  return (
    <div role="tablist" aria-label={label}
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] border p-[3px] [scrollbar-width:none]"
      style={{ background: SURFACE, borderColor: BORDER }}>
      {options.map(o => {
        const on = o.id === value
        return (
          <button key={o.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.id)}
            className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 text-[13px] font-semibold transition-colors"
            style={on
              ? { background: CANVAS, color: TEXT, boxShadow: '0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)' }
              : { background: 'transparent', color: SUBTLE }}>
            {o.label}
            {o.count != null && <span className="text-[12px] font-medium tabular-nums" style={{ color: on ? SUBTLE : LABEL }}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** One thin bar split into parts, with a legend under it. */
function StackBar({ parts, format }: { parts: { label: string; value: number; color: string }[]; format: (n: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div>
      <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full" style={{ background: total ? 'transparent' : '#F2F4F7' }}>
        {parts.filter(p => p.value > 0).map(p => (
          <span key={p.label} title={`${p.label}: ${format(p.value)}`} className="h-full rounded-full"
            style={{ flexGrow: p.value, flexBasis: 0, minWidth: 6, background: p.color }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {parts.map(p => (
          <span key={p.label} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]">
            <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span style={{ color: SUBTLE }}>{p.label}</span>
            <span className="font-semibold tabular-nums" style={{ color: TEXT_2 }}>{format(p.value)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function KpiCard({ icon, accent, title, info, value, unit, pill, viz, sub, active, loading, onClick }: {
  icon: ReactNode; accent: string; title: string; info: string; value: string; unit?: string; pill?: ReactNode
  viz: ReactNode; sub: ReactNode; active: boolean; loading: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className="flex min-w-0 cursor-pointer flex-col rounded-[18px] border p-1.5 text-left transition-[box-shadow,border-color,transform] hover:-translate-y-px"
      style={{ background: SURFACE, borderColor: active ? BLUE_LN : BORDER, boxShadow: active ? '0 0 0 4px rgba(29,78,216,0.10)' : XS }}>
      <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-1.5">
        <span className="hidden size-8 shrink-0 place-items-center rounded-[9px] border bg-white sm:grid" style={{ borderColor: BORDER, color: accent, boxShadow: XS }}>
          {icon}
        </span>
        <span className="truncate text-[14px] font-semibold" style={{ color: TEXT_2 }}>{title}</span>
        <span title={info} aria-label={info} className="ml-auto hidden shrink-0 sm:inline-flex" style={{ color: LABEL }}><Info size={16} /></span>
      </div>
      <div className="flex flex-1 flex-col rounded-[13px] border bg-white px-4 pb-3.5 pt-4" style={{ borderColor: BORDER, boxShadow: XS }}>
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 items-baseline gap-1.5">
            {loading
              ? <span className="block h-9 w-24 animate-pulse rounded-[8px] bg-[#F2F4F7]" />
              : <span className="whitespace-nowrap text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[32px] 2xl:text-[34px]" style={{ color: TEXT }}>{value}</span>}
            {unit && !loading && <span className="text-[14px]" style={{ color: SUBTLE }}>{unit}</span>}
          </div>
          {!loading && pill}
        </div>
        <div className="mt-4 hidden sm:block">
          {loading ? <span className="block h-12 animate-pulse rounded-[8px] bg-[#F9FAFB]" /> : viz}
        </div>
        <div className="mt-auto pt-3 text-[13px] leading-snug" style={{ color: SUBTLE }}>{loading ? ' ' : sub}</div>
      </div>
    </button>
  )
}

function Panel({ icon, title, sub, right, children, className = '' }: {
  icon: ReactNode; title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`flex h-full min-w-0 flex-col rounded-[16px] border bg-white ${className}`} style={{ borderColor: BORDER, boxShadow: XS }}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border" style={{ borderColor: BORDER, color: TEXT_2, boxShadow: XS }}>{icon}</span>
          <div className="min-w-0">
            <h3 className="m-0 text-[16px] font-semibold leading-tight" style={{ color: TEXT }}>{title}</h3>
            {sub && <p className="m-0 mt-1 text-[13px] leading-snug" style={{ color: SUBTLE }}>{sub}</p>}
          </div>
        </div>
        {right}
      </header>
      <div className="flex flex-1 flex-col px-4 pb-5 sm:px-5">{children}</div>
    </section>
  )
}

function Insight({ tone = 'blue', title, children }: { tone?: Tone; title: ReactNode; children?: ReactNode }) {
  const t = TONE[tone]
  return (
    <div className="flex gap-3 rounded-[12px] border p-3.5" style={{ background: t.bg, borderColor: t.border }}>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white" style={{ color: t.color, boxShadow: XS }}>
        <Lightbulb size={15} weight="bold" />
      </span>
      <div className="min-w-0 text-[13.5px] leading-snug" style={{ color: TEXT_2 }}>
        <div className="font-semibold" style={{ color: t.color }}>{title}</div>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
    </div>
  )
}

function SectionHead({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]" style={{ color: TEXT }}>{title}</h2>
        <p className="m-0 mt-1 text-[14px]" style={{ color: SUBTLE }}>{sub}</p>
      </div>
      {right}
    </div>
  )
}

// Stops a click on a card's buttons from also starting a drag or opening the lead
const stopDrag = {
  onMouseDown: (e: SyntheticEvent) => e.stopPropagation(),
  onTouchStart: (e: SyntheticEvent) => e.stopPropagation(),
  onKeyDown: (e: SyntheticEvent) => e.stopPropagation(),
  onClick: (e: SyntheticEvent) => e.stopPropagation(),
}

// ─── Stage conversion ─────────────────────────────────────────────────────────
const LEAK_COPY: Record<string, (c: number) => string> = {
  contacted: c => `Only ${c}% of your leads have been contacted. Call or WhatsApp new enquiries the same day, before they speak to another broker.`,
  qualified: c => `Only ${c}% of contacted leads have confirmed their requirements. Book video meetings or site visits to confirm budget, location and intent.`,
  eoi:       c => `Only ${c}% of qualified leads have given an EOI. Share matching inventory and ask for an expression of interest.`,
  closed:    c => `Only ${c}% of leads with an EOI have closed. Chase documents, loan approval and booking to get them over the line.`,
}

function FunnelPanel({ f, loading }: { f: Analysis['funnel']; loading: boolean }) {
  const max = Math.max(1, f.steps[0].n)
  const leak = f.leakIdx > 0 ? f.steps[f.leakIdx] : null
  return (
    <Panel icon={<Funnel size={18} />} title="Stage conversion" sub="How far your leads get, and where they stop"
      right={!loading && f.steps[0].n > 0 ? <Pill tone="green">{f.steps[4].share}% lead to close</Pill> : undefined}>
      <ol className="m-0 flex list-none flex-col p-0">
        {f.steps.map((s, i) => (
          <li key={s.key}>
            {i > 0 && (
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 sm:grid-cols-[176px_minmax(0,1fr)]">
                <span />
                <span className="flex items-center gap-1.5 whitespace-nowrap py-1 text-[12px] font-semibold tabular-nums"
                  style={{ color: i === f.leakIdx ? '#B42318' : SUBTLE }}>
                  <ArrowDown size={12} weight="bold" />
                  {loading ? '…' : `${s.conv}% moved on`}
                  {i === f.leakIdx && !loading && <Pill tone="red" small>Biggest drop</Pill>}
                </span>
              </div>
            )}
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[176px_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: TEXT }}>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: s.dot }} />
                  <span className="truncate">{s.label}</span>
                </div>
                <div className="pl-3.5 text-[12px] leading-snug sm:truncate" style={{ color: SUBTLE }}>{s.hint}</div>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-8 min-w-0 flex-1 overflow-hidden rounded-[8px]" style={{ background: '#F2F4F7' }}>
                  {!loading && (
                    <span className="absolute inset-y-0 left-0 rounded-[8px] transition-[width] duration-500"
                      style={{ width: `${s.n ? Math.max(1.5, (s.n / max) * 100) : 0}%`, background: s.key === 'closed' ? GREEN : BLUE, opacity: s.key === 'in' ? 0.9 : 1 }} />
                  )}
                </div>
                <div className="w-[52px] shrink-0 text-right">
                  <div className="text-[15px] font-semibold leading-tight tabular-nums" style={{ color: TEXT }}>{loading ? '–' : s.n.toLocaleString('en-IN')}</div>
                  <div className="text-[12px] tabular-nums" style={{ color: LABEL }}>{loading ? '' : `${s.share}%`}</div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-auto pt-5">
        {leak && !loading
          ? <Insight tone="red" title={`Biggest drop: ${f.steps[f.leakIdx - 1].label} → ${leak.label}`}>{LEAK_COPY[leak.key](leak.conv)}</Insight>
          : !loading && <Insight title="Not enough leads to spot a drop yet">Conversion shows once a few leads have moved through each stage.</Insight>}
        <p className="m-0 mt-3 text-[12px]" style={{ color: LABEL }}>
          Disqualified and on-hold leads count as contacted. {f.dropped} disqualified · {f.hold} on hold.
        </p>
      </div>
    </Panel>
  )
}

// ─── Call next ────────────────────────────────────────────────────────────────
const REASON_META: Record<ReasonKey, { Icon: typeof Globe; color: string }> = {
  'hot-quiet':  { Icon: Fire,            color: '#C4320A' },
  'near-dq':    { Icon: PhoneSlash,      color: '#B42318' },
  'first-call': { Icon: HourglassMedium, color: '#B54708' },
  fresh:        { Icon: Sparkle,         color: BLUE },
  escalated:    { Icon: Warning,         color: '#B42318' },
  'warm-quiet': { Icon: Clock,           color: '#B54708' },
  'big-stuck':  { Icon: CurrencyInr,     color: '#5925DC' },
  quiet:        { Icon: Clock,           color: SUBTLE },
}
type QueueFilter = 'all' | 'first' | 'cooling' | 'unanswered' | 'big'
const QUEUE_MATCH: Record<QueueFilter, (p: PLead, big: number) => boolean> = {
  all:        () => true,
  first:      p => p.reason?.key === 'first-call' || p.reason?.key === 'fresh',
  cooling:    p => ['hot-quiet', 'warm-quiet', 'quiet', 'big-stuck', 'escalated'].includes(p.reason?.key ?? ''),
  unanswered: p => p.reason?.key === 'near-dq',
  big:        (p, big) => p.value >= big,
}

function ContactBtns({ lead, name }: { lead: CRMLead; name: string }) {
  const ph = phone10(lead)
  if (!ph) return null
  return (
    <span className="flex items-center gap-1.5" {...stopDrag}>
      <a href={`tel:+91${ph}`} title={`Call ${name}`} aria-label={`Call ${name}`}
        className="grid size-8 place-items-center rounded-[8px] border bg-white transition-colors hover:border-[#ABEFC6] hover:bg-[#ECFDF3]"
        style={{ borderColor: BORDER_2, color: '#067647', boxShadow: XS }}>
        <Phone size={15} weight="bold" />
      </a>
      <a href={`https://wa.me/91${ph}`} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${name}`} aria-label={`WhatsApp ${name}`}
        className="grid size-8 place-items-center rounded-[8px] border bg-white transition-colors hover:border-[#A6EFC2] hover:bg-[#EDFCF2]"
        style={{ borderColor: BORDER_2, color: '#16A34A', boxShadow: XS }}>
        <WhatsappLogo size={16} weight="bold" />
      </a>
    </span>
  )
}

function CallNextPanel({ a, loading, onOpen }: { a: Analysis; loading: boolean; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [expanded, setExpanded] = useState(false)
  const count = (f: QueueFilter) => a.queue.filter(p => QUEUE_MATCH[f](p, a.bigTicket)).length
  const opts = ([['all', 'All'], ['first', 'First call'], ['cooling', 'Going cold'], ['unanswered', 'No answer'], ['big', 'Big ticket']] as [QueueFilter, string][])
    .map(([id, label]) => ({ id, label, count: count(id) }))
    .filter(o => o.id === 'all' || o.id === filter || o.count > 0)
  const list = a.queue.filter(p => QUEUE_MATCH[filter](p, a.bigTicket))
  const shown = list.slice(0, expanded ? 50 : 6)

  return (
    <Panel icon={<Target size={18} />} title="Call next"
      sub="Ranked by urgency, intent score and deal size"
      right={!loading && a.queue.length > 0 ? <Pill tone="blue">{a.queue.length} need a touch</Pill> : undefined}>
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="size-9 shrink-0 animate-pulse rounded-full bg-[#F2F4F7]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="block h-3.5 w-36 animate-pulse rounded bg-[#F2F4F7]" />
                <span className="block h-3 w-48 animate-pulse rounded bg-[#F9FAFB]" />
              </div>
            </div>
          ))}
        </div>
      ) : a.queue.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-[12px] border border-dashed px-4 py-10 text-center" style={{ borderColor: BORDER_2 }}>
          <div>
            <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full" style={{ background: '#ECFDF3', color: '#067647' }}><Check size={18} weight="bold" /></div>
            <div className="text-[14px] font-semibold" style={{ color: TEXT }}>Nothing urgent right now</div>
            <div className="mt-1 text-[13px]" style={{ color: SUBTLE }}>Every lead has been contacted and updated recently.</div>
          </div>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Filter the call list" className="flex flex-wrap gap-1.5">
            {opts.map(o => {
              const on = o.id === filter
              return (
                <button key={o.id} type="button" aria-pressed={on} onClick={() => { setFilter(o.id); setExpanded(false) }}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                  style={on ? { background: BLUE_BG, borderColor: BLUE_LN, color: BLUE } : { background: CANVAS, borderColor: BORDER, color: TEXT_2 }}>
                  {o.label}<span className="text-[12px] font-medium tabular-nums" style={{ color: on ? BLUE : LABEL }}>{o.count}</span>
                </button>
              )
            })}
          </div>
          <ul className={`m-0 mt-3 flex list-none flex-col p-0 ${expanded ? 'max-h-[520px] overflow-y-auto' : ''}`}>
            {shown.map(p => {
              const meta = REASON_META[p.reason!.key]
              return (
                <li key={p.id} onClick={() => onOpen(p.id)}
                  className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] px-2 py-2.5 transition-colors hover:bg-[#F9FAFB]">
                  <LeadAvatar lead={p.lead} size={36} />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link href={`/dashboard/leads/${p.id}`} onClick={e => e.stopPropagation()}
                        className="truncate text-[14px] font-semibold no-underline hover:text-[#1D4ED8]" style={{ color: TEXT }}>{p.name}</Link>
                      <StagePill stage={p.stage} small />
                      {p.value > 0 && <span className="hidden shrink-0 text-[12.5px] font-semibold tabular-nums sm:inline" style={{ color: SUBTLE }}>{inr(p.value)}</span>}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-start gap-1.5 text-[12.5px] font-medium leading-snug sm:items-center" style={{ color: meta.color }}>
                      <meta.Icon size={13} weight="bold" className="mt-[2px] shrink-0 sm:mt-0" />
                      <span className="min-w-0 sm:truncate">{p.reason!.text}</span>
                    </div>
                  </div>
                  <ContactBtns lead={p.lead} name={p.name} />
                </li>
              )
            })}
          </ul>
          {list.length > 6 && (
            <button type="button" onClick={() => setExpanded(v => !v)}
              className="mt-auto inline-flex cursor-pointer items-center justify-center gap-1.5 self-start rounded-[8px] px-2 pt-3 text-[13px] font-semibold"
              style={{ color: BLUE }}>
              {expanded ? 'Show fewer' : `Show all ${list.length}`}
              <CaretDown size={12} weight="bold" style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
            </button>
          )}
        </>
      )}
    </Panel>
  )
}

// ─── Board ────────────────────────────────────────────────────────────────────
function PipeCard({ p, overlay, highlighted, onMove, onReassign, onOpen }: {
  p: PLead; overlay?: boolean; highlighted?: boolean
  onMove?: (id: string, to: StageId) => void; onReassign?: (id: string) => void; onOpen?: (id: string) => void
}) {
  const locked = p.stage === 'Hold'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id, disabled: overlay || locked })
  const next = NEXT[p.stage]
  const src = sourceMeta(p.lead.sourcePortal)
  const quiet = MOVING.has(p.stage) && p.idleD >= 7
  const idle = p.stage === 'New'
    ? { tone: (p.ageMs >= DAY ? 'red' : 'blue') as Tone, text: `Waiting ${durShort(p.ageMs)}` }
    : p.stage === 'Closed' || p.stage === 'Disqualified'
      ? { tone: 'neutral' as Tone, text: `${p.stage === 'Closed' ? 'Closed' : 'Dropped'} ${durShort(p.idleD * DAY)} ago` }
      : { tone: (p.idleD >= 14 && quiet ? 'red' : quiet ? 'amber' : 'neutral') as Tone, text: p.idleD < 1 ? 'Updated today' : `Updated ${Math.floor(p.idleD)}d ago` }

  return (
    <div ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)} {...(overlay ? {} : listeners)}
      aria-roledescription={locked ? undefined : 'Draggable lead card'}
      onClick={() => onOpen?.(p.id)}
      className={`rounded-[12px] border bg-white p-3 outline-none transition-[box-shadow,border-color] focus-visible:border-[#84ADFF] focus-visible:shadow-[0_0_0_4px_rgba(29,78,216,0.12)] ${overlay ? 'w-[264px] rotate-[1.5deg] cursor-grabbing' : locked ? 'cursor-pointer' : 'cursor-grab hover:border-[#D0D5DD] hover:shadow-[0_4px_8px_-2px_rgba(16,24,40,0.1)]'}`}
      style={{
        borderColor: highlighted ? BLUE : BORDER,
        boxShadow: overlay ? '0 20px 24px -4px rgba(16,24,40,0.14), 0 8px 8px -4px rgba(16,24,40,0.06)' : highlighted ? '0 0 0 4px rgba(29,78,216,0.15)' : XS,
        opacity: isDragging ? 0.4 : 1, touchAction: 'manipulation',
      }}>
      <div className="flex items-start gap-2.5">
        <LeadAvatar lead={p.lead} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[14px] font-semibold leading-snug" style={{ color: TEXT }}>{p.name}</span>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: p.value ? TEXT : LABEL }}>{p.value ? inr(p.value) : '—'}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px]" style={{ color: SUBTLE }}>
            <span className="shrink-0" style={{ fontFamily: MONO, fontSize: 11 }}>{getCsId(p.lead)}</span>
            {p.lead.city && <span className="truncate">· {p.lead.city}</span>}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex max-w-[130px] items-center gap-1 rounded-[6px] border px-1.5 py-[2px] text-[11.5px] font-medium" style={{ borderColor: BORDER, color: TEXT_2 }}>
          <SourceMark raw={p.lead.sourcePortal} size={14} /><span className="truncate">{src.label}</span>
        </span>
        <Pill tone={idle.tone} small><Clock size={11} weight="bold" />{idle.text}</Pill>
        {p.nc > 0 && OPEN.has(p.stage) && (
          <Pill tone={p.nc >= 3 ? 'red' : 'neutral'} small><PhoneSlash size={11} weight="bold" />{p.nc}/5</Pill>
        )}
        {locked && <Pill tone="violet" small>Resume from the lead page</Pill>}
      </div>
      {!overlay && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5" style={{ borderColor: BORDER }} {...stopDrag}>
          <ContactBtns lead={p.lead} name={p.name} />
          <span className="flex-1" />
          {next && !locked && onMove && (
            <button type="button" onClick={() => onMove(p.id, next)} title={`Move to ${STAGE[next].label}`}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[8px] border bg-white px-2 text-[12.5px] font-semibold transition-colors hover:border-[#B2CCFF] hover:bg-[#EFF4FF] hover:text-[#1D4ED8]"
              style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
              {STAGE[next].label}<ArrowRight size={13} weight="bold" />
            </button>
          )}
          {onReassign && (
            <button type="button" onClick={() => onReassign(p.id)} title="Reassign" aria-label={`Reassign ${p.name}`}
              className="grid size-8 cursor-pointer place-items-center rounded-[8px] border bg-white transition-colors hover:bg-[#F9FAFB]"
              style={{ borderColor: BORDER_2, color: SUBTLE, boxShadow: XS }}>
              <UserSwitch size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function BoardColumn({ stage, items, dragging, highlightId, collapsed, onToggle, onMove, onReassign, onOpen }: {
  stage: StageId; items: PLead[]; dragging: boolean; highlightId: string | null
  collapsed?: boolean; onToggle?: () => void
  onMove: (id: string, to: StageId) => void; onReassign: (id: string) => void; onOpen: (id: string) => void
}) {
  const droppable = MOVABLE.has(stage)
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !droppable })
  const st = STAGE[stage]
  const value = items.reduce((s, p) => s + p.value, 0)
  const quietN = MOVING.has(stage) ? items.filter(p => p.idleD >= 7).length : 0
  const over = isOver && droppable

  if (collapsed) {
    return (
      <div ref={setNodeRef} className="flex w-[48px] shrink-0 flex-col items-center rounded-[14px] border transition-colors"
        style={{ background: over ? '#F5F8FF' : SURFACE, borderColor: over ? BLUE_LN : BORDER }}>
        <button type="button" onClick={onToggle} aria-label={`Show the ${st.label} column`} title={`Show ${st.label}`}
          className="flex w-full cursor-pointer flex-col items-center gap-2.5 py-3.5">
          <CaretRight size={14} weight="bold" style={{ color: SUBTLE }} />
          <span className="size-2 rounded-full" style={{ background: st.dot }} />
          <span className="text-[13px] font-semibold" style={{ color: TEXT_2, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{st.label}</span>
          <span className="rounded-full border bg-white px-1.5 text-[12px] font-semibold tabular-nums" style={{ borderColor: BORDER, color: MUTED }}>{items.length}</span>
        </button>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} className="flex w-[84vw] max-w-[300px] shrink-0 snap-start flex-col rounded-[14px] border transition-colors sm:w-auto sm:max-w-[380px] sm:flex-[1_0_236px]"
      style={{ background: over ? '#F5F8FF' : SURFACE, borderColor: over ? BLUE_LN : BORDER }}>
      <div className="px-3.5 pb-2.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold" style={{ color: TEXT }}>
            <span className="size-2 shrink-0 rounded-full" style={{ background: st.dot }} />{st.label}
            <span className="rounded-full border bg-white px-2 text-[12px] font-semibold tabular-nums" style={{ borderColor: BORDER, color: MUTED }}>{items.length}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {quietN > 0 && <Pill tone="amber" small>{quietN} quiet</Pill>}
            {onToggle && (
              <button type="button" onClick={onToggle} aria-label={`Collapse the ${st.label} column`} title="Collapse"
                className="grid size-7 cursor-pointer place-items-center rounded-[7px] transition-colors hover:bg-[#F2F4F7]" style={{ color: SUBTLE }}>
                <CaretLeft size={14} weight="bold" />
              </button>
            )}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[12.5px]">
          <span className="truncate" style={{ color: SUBTLE }}>{st.meaning}</span>
          <span className="shrink-0 font-semibold tabular-nums" style={{ color: TEXT_2 }}>{value ? inr(value) : ''}</span>
        </div>
      </div>
      <div className="flex max-h-[620px] min-h-[132px] flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
        {items.length === 0 && (
          <div className="rounded-[10px] border border-dashed px-3 py-7 text-center text-[13px]" style={{ borderColor: over ? BLUE_LN : BORDER_2, color: over ? BLUE : LABEL }}>
            {dragging && droppable ? 'Drop here' : 'No leads'}
          </div>
        )}
        {items.map(p => (
          <PipeCard key={p.id} p={p} highlighted={p.id === highlightId} onMove={onMove} onReassign={onReassign} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function SourcePanel({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const total = rows.reduce((s, r) => s + r.n, 0)
  const minN = Math.max(3, Math.ceil(total * 0.05))
  const ranked = rows.filter(r => r.n >= minN)
  const best = [...ranked].sort((a, b) => b.q / b.n - a.q / a.n)[0]
  const weakest = [...ranked].sort((a, b) => a.q / a.n - b.q / b.n)[0]
  const top = rows[0]
  return (
    <Panel icon={<ChartBar size={18} />} title="Source performance" sub="Which portals bring leads that actually move" className="@container">
      {!loading && rows.length > 0 && (
        <div className="mb-4 grid gap-2 @xl:grid-cols-2">
          {best && <Insight tone="green" title={`${best.label} converts best`}>{pct(best.q, best.n)}% of its leads reach Warm or beyond.</Insight>}
          {top && weakest && weakest.label !== best?.label
            ? <Insight tone="amber" title={`${weakest.label} qualifies least`}>{weakest.n} leads, only {pct(weakest.q, weakest.n)}% reach Warm. Worth checking what you pay for it.</Insight>
            : top && <Insight title={`${top.label} brings the most leads`}>{top.n} of {total} leads in this period.</Insight>}
        </div>
      )}
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: SURFACE }}>
              {[
                ['Source', 'pl-4 pr-3 text-left sm:pl-5'],
                ['Leads', 'px-2 text-right @md:px-3'],
                ['Contacted', 'hidden px-3 text-right @lg:table-cell'],
                ['Qualified', 'px-2 text-left @md:px-3'],
                ['Closed', 'pl-2 pr-4 text-right sm:pr-5 @md:pl-3 @2xl:pr-3'],
                ['Avg intent', 'hidden px-3 text-right @xl:table-cell'],
                ['Open value', 'hidden pl-3 pr-5 text-right @2xl:table-cell'],
              ].map(([h, cls]) => (
                <th key={h} scope="col" className={`whitespace-nowrap py-2.5 text-[12px] font-medium ${cls}`}
                  style={{ color: SUBTLE, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }, (_, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td className="py-3.5 pl-4 sm:pl-5" colSpan={7}><span className="block h-4 w-full animate-pulse rounded bg-[#F2F4F7]" /></td>
              </tr>
            ))}
            {!loading && rows.map((r, i) => {
              const q = pct(r.q, r.n)
              return (
                <tr key={r.label} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  <td className="py-3 pl-4 pr-3 sm:pl-5">
                    <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium" style={{ color: TEXT }}>
                      <SourceMark raw={r.raw ?? null} size={20} /><span className="leading-snug @md:truncate">{r.label}</span>
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right text-[14px] font-semibold tabular-nums @md:px-3" style={{ color: TEXT }}>{r.n}</td>
                  <td className="hidden px-3 py-3 text-right text-[14px] tabular-nums @lg:table-cell" style={{ color: TEXT_2 }}>{pct(r.contacted, r.n)}%</td>
                  <td className="px-2 py-3 @md:px-3">
                    <span className="flex items-center gap-2">
                      <span className="w-9 text-right text-[14px] font-semibold tabular-nums" style={{ color: TEXT }}>{q}%</span>
                      <span className="relative hidden h-1.5 w-16 overflow-hidden rounded-full @md:block" style={{ background: '#F2F4F7' }}>
                        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${q}%`, background: q >= 30 ? GREEN : q >= 15 ? '#F79009' : '#F04438' }} />
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pl-2 pr-4 text-right text-[14px] tabular-nums sm:pr-5 @md:pl-3 @2xl:pr-3" style={{ color: TEXT_2 }}>{r.closed}</td>
                  <td className="hidden px-3 py-3 text-right text-[14px] tabular-nums @xl:table-cell" style={{ color: TEXT_2 }}>{Math.round(r.intent / r.n)}</td>
                  <td className="hidden py-3 pl-3 pr-5 text-right text-[14px] font-medium tabular-nums @2xl:table-cell" style={{ color: TEXT }}>{inr(r.value)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 && <p className="m-0 py-6 text-center text-[13px]" style={{ color: LABEL }}>No leads in this period.</p>}
    </Panel>
  )
}

function AgingPanel({ a, loading, onOpen }: { a: Analysis; loading: boolean; onOpen: (id: string) => void }) {
  const max = Math.max(1, ...a.aging.map(b => b.total))
  const BAR_H = 172
  return (
    <Panel icon={<HourglassMedium size={18} />} title="Pipeline aging" sub="Open leads by days since their last update">
      <div className="flex items-end gap-2 sm:gap-4" style={{ height: BAR_H + 28 }}>
        {a.aging.map((b, i) => (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: i >= 3 && b.total ? '#B42318' : TEXT }} title={`${b.total} open leads, ${b.label} days since the last update`}>{loading ? '' : b.total}</span>
            <div className="flex w-full max-w-[56px] flex-col-reverse gap-[2px] overflow-hidden rounded-[8px]"
              style={{ height: loading ? 40 + i * 12 : b.total ? Math.max(8, Math.round((b.total / max) * BAR_H)) : 3, background: loading || !b.total ? '#F2F4F7' : 'transparent' }}>
              {!loading && b.by.filter(s => s.n > 0).map(s => (
                <span key={s.stage} title={`${STAGE[s.stage].label}: ${s.n}`} style={{ flexGrow: s.n, flexBasis: 0, background: STAGE[s.stage].dot }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t pt-2 sm:gap-4" style={{ borderColor: BORDER }}>
        {a.aging.map(b => <span key={b.label} className="min-w-0 flex-1 text-center text-[12px] font-medium tabular-nums" style={{ color: SUBTLE }}>{b.label}</span>)}
      </div>
      <div className="mt-0.5 text-center text-[11.5px]" style={{ color: LABEL }}>Days since last update</div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {(['New', 'Cold', 'Warm', 'Hot'] as StageId[]).map(s => (
          <span key={s} className="flex items-center gap-1.5 text-[12.5px]" style={{ color: SUBTLE }}>
            <span className="size-2 rounded-full" style={{ background: STAGE[s].dot }} />{STAGE[s].label}
          </span>
        ))}
      </div>
      {!loading && a.stalest.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: BORDER }}>
          <div className="mb-1 text-[12px] font-semibold" style={{ color: SUBTLE }}>Longest without an update</div>
          <ul className="m-0 flex list-none flex-col p-0">
            {a.stalest.map(p => (
              <li key={p.id} onClick={() => onOpen(p.id)}
                className="-mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-[#F9FAFB]">
                <LeadAvatar lead={p.lead} size={28} badge={false} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium" style={{ color: TEXT }}>{p.name}</span>
                <StagePill stage={p.stage} small />
                <span className="w-[40px] shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: p.idleD >= 15 ? '#B42318' : TEXT_2 }}>{Math.floor(p.idleD)}d</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!loading && a.liveCount > 0 && (
        <div className="mt-auto pt-4">
          <Insight tone={a.staleShare >= 30 ? 'amber' : 'green'}
            title={a.staleShare >= 30 ? `${a.staleShare}% of open leads are going stale` : 'Most open leads are being worked'}>
            {a.staleShare >= 30
              ? 'They have had no update for over two weeks. Clear the oldest first or disqualify the ones that will not move.'
              : `Only ${a.staleShare}% of open leads have gone more than two weeks without an update.`}
          </Insight>
        </div>
      )}
    </Panel>
  )
}

type DemandTab = 'budget' | 'location' | 'property' | 'timeline'
function DemandPanel({ a, loading }: { a: Analysis; loading: boolean }) {
  const [tab, setTab] = useState<DemandTab>('budget')
  const rows = a.demand[tab]
  const total = a.items.length
  const max = Math.max(1, ...rows.map(r => r.n))
  const top = [...rows].filter(r => r.label !== 'Not shared').sort((x, y) => y.n - x.n)[0]
  const best = [...rows].filter(r => r.label !== 'Not shared' && r.n >= 3).sort((x, y) => y.q / y.n - x.q / x.n)[0]
  const share: Record<DemandTab, string> = { budget: 'are in this budget', location: 'want this area', property: 'want this property type', timeline: 'plan to buy on this timeline' }
  return (
    <Panel icon={<House size={18} />} title="What buyers want" sub="Budget, location, property type and timeline across your leads">
      <Seg label="Demand by" value={tab} onChange={setTab}
        options={[{ id: 'budget', label: 'Budget' }, { id: 'location', label: 'Location' }, { id: 'property', label: 'Property' }, { id: 'timeline', label: 'Timeline' }]} />
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 text-[12px] font-medium" style={{ color: LABEL }}>
        <span /><span className="w-[52px] text-right">Leads</span><span className="w-[64px] text-right">Qualified</span>
      </div>
      <div className="mt-1.5 flex flex-col gap-2.5">
        {loading && Array.from({ length: 5 }, (_, i) => <span key={i} className="block h-8 animate-pulse rounded-[8px] bg-[#F9FAFB]" />)}
        {!loading && rows.map(r => (
          <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 text-[13.5px]">
                <span className="truncate font-medium" style={{ color: r.label === 'Not shared' ? LABEL : TEXT }}>{r.label}</span>
                <span className="shrink-0 text-[12px] tabular-nums" style={{ color: LABEL }}>{pct(r.n, total)}%</span>
              </div>
              <div className="relative mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: '#F2F4F7' }}>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: r.label === 'Not shared' ? BORDER_2 : BLUE }} />
              </div>
            </div>
            <span className="w-[52px] text-right text-[14px] font-semibold tabular-nums" style={{ color: TEXT }}>{r.n}</span>
            <span className="w-[64px] text-right text-[14px] tabular-nums" style={{ color: TEXT_2 }}>{pct(r.q, r.n)}%</span>
          </div>
        ))}
      </div>
      {!loading && top && (
        <div className="mt-auto pt-4">
          <Insight title={`Most asked for: ${top.label}`}>
            {pct(top.n, total)}% of leads {share[tab]}.
            {best && best.label !== top.label && <> {best.label} qualifies best, with {pct(best.q, best.n)}% reaching Warm or beyond.</>}
          </Insight>
        </div>
      )}
    </Panel>
  )
}

function FlowPanel({ a, loading }: { a: Analysis; loading: boolean }) {
  const max = Math.max(1, ...a.weeks.flatMap(w => [w.added, w.closed]))
  const H = 128
  const thisWeek = a.weeks[a.weeks.length - 1]
  const avg = Math.round(a.weeks.reduce((s, w) => s + w.added, 0) / a.weeks.length)
  return (
    <Panel icon={<ArrowsDownUp size={18} />} title="Weekly flow" sub="New leads against closed deals, last 8 weeks"
      right={!loading ? <Pill tone="blue">{thisWeek.added} new this week</Pill> : undefined}>
      <div className="flex items-end gap-1.5 sm:gap-3" style={{ height: H + 22 }}>
        {a.weeks.map(w => (
          <div key={w.label} className="flex min-w-0 flex-1 items-end justify-center gap-[3px]" title={`${w.label}: ${w.added} new, ${w.closed} closed`}>
            {([[w.added, BLUE], [w.closed, GREEN]] as const).map(([v, c], k) => (
              <div key={k} className="flex w-full max-w-[18px] flex-col items-center justify-end gap-1">
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: k ? '#067647' : TEXT_2 }}>{loading || !v ? '' : v}</span>
                <span className="w-full rounded-[4px]" style={{ height: loading ? 20 : v ? Math.max(4, Math.round((v / max) * H)) : 2, background: loading ? '#F2F4F7' : v ? c : '#EAECF0' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 border-t pt-2 sm:gap-3" style={{ borderColor: BORDER }}>
        {a.weeks.map((w, i) => (
          <span key={w.label}
            className={`min-w-0 flex-1 whitespace-nowrap text-[11px] font-medium ${i === a.weeks.length - 1 ? 'text-right' : 'text-center'} ${i % 2 && i !== a.weeks.length - 1 ? 'invisible' : ''} ${i === a.weeks.length - 2 ? 'max-sm:invisible' : ''}`}
            style={{ color: SUBTLE }}>{w.label}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: SUBTLE }}><span className="size-2 rounded-full" style={{ background: BLUE }} />New leads</span>
        <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: SUBTLE }}><span className="size-2 rounded-full" style={{ background: GREEN }} />Closed deals</span>
      </div>
      {!loading && (
        <div className="mt-auto pt-4">
          <Insight tone={thisWeek.added >= avg ? 'green' : 'amber'}
            title={thisWeek.added >= avg ? 'Lead flow is at or above your average' : 'Lead flow is below your average'}>
            This week brought {thisWeek.added} new {thisWeek.added === 1 ? 'lead' : 'leads'} and {thisWeek.closed} closed {thisWeek.closed === 1 ? 'deal' : 'deals'}, against an average of {avg} new leads a week.
          </Insight>
        </div>
      )}
    </Panel>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type PipelineData = { leads: CRMLead[] | null; totalCount: number; activities: Activity[]; error: string; at: number }

async function fetchPipeline(): Promise<PipelineData> {
  const since = new Date(Date.now() - 90 * DAY).toISOString()
  const [leadsRes, actsRes] = await Promise.allSettled([
    fetch('/api/crm/leads?limit=200').then(r => r.json()),
    // Optional: sharpens first-response time and "last touch". The page works without it.
    fetch(`/api/crm/activities?since=${encodeURIComponent(since)}&limit=1000`).then(r => r.json()),
  ])
  const ok = leadsRes.status === 'fulfilled' && !leadsRes.value?.error
  const list: CRMLead[] | null = ok ? (leadsRes.value?.data?.leads ?? []) : null
  return {
    leads: list,
    totalCount: ok ? (leadsRes.value?.data?.totalCount ?? list!.length) : 0,
    activities: actsRes.status === 'fulfilled' ? (actsRes.value?.data?.activities ?? []) : [],
    error: leadsRes.status === 'fulfilled' ? String(leadsRes.value?.error ?? '') : 'Could not load your pipeline',
    at: Date.now(),
  }
}

type Toast = { text: string; tone: 'ok' | 'error'; undo?: () => void }

export default function PipelinePage() {
  const router = useRouter()
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [acts, setActs] = useState<Activity[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const [range, setRange] = useState<DateRange>('all')
  const [focus, setFocus] = useState<Focus>('none')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('all')
  const [intent, setIntent] = useState<IntentFilter>('all')
  const [quietOnly, setQuietOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('priority')
  const [openMenu, setOpenMenu] = useState<null | 'date' | 'sort' | 'filter'>(null)
  const [collapsed, setCollapsed] = useState<Set<StageId>>(() => new Set<StageId>(['Closed', 'Disqualified']))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [reassignId, setReassignId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastDragEnd = useRef(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const menu = (key: 'date' | 'sort' | 'filter') => ({
    open: openMenu === key,
    onOpenChange: (o: boolean) => setOpenMenu(o ? key : null),
    toggle: () => setOpenMenu(m => (m === key ? null : key)),
  })
  const dateMenu = menu('date'), sortMenu = menu('sort'), filterMenu = menu('filter')

  const apply = useCallback((r: PipelineData) => {
    if (r.leads) {
      setError(null)
      setLeads(r.leads)
      setTotalCount(r.totalCount)
    } else {
      setError(r.error)
    }
    setActs(r.activities)
    setNow(r.at)
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    fetchPipeline().then(r => { if (alive) apply(r) })
    return () => { alive = false }
  }, [apply])
  const refresh = () => { setLoading(true); fetchPipeline().then(apply) }
  // Keep "waiting 3h" and "updated today" honest while the page stays open
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const a = useMemo(() => analyse(leads, acts, now, range), [leads, acts, now, range])
  const firstLoad = loading && leads.length === 0

  // Source filter options, one per label
  const sourceOptions = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const l of leads) { const k = sourceMeta(l.sourcePortal).label; if (!m.has(k)) m.set(k, l.sourcePortal) }
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]))
  }, [leads])

  // Board: focus (from the KPI cards) → filters → search → sort
  const boardItems = useMemo(() => {
    let list = a.items
    if (focus === 'open')        list = list.filter(p => OPEN.has(p.stage))
    if (focus === 'uncontacted') list = list.filter(p => p.stage === 'New')
    if (focus === 'quiet')       list = list.filter(p => MOVING.has(p.stage) && p.idleD >= 7)
    if (focus === 'outcomes')    list = list.filter(p => p.stage === 'Closed' || p.stage === 'Disqualified')
    if (source !== 'all') list = list.filter(p => sourceMeta(p.lead.sourcePortal).label === source)
    if (intent === 'high')   list = list.filter(p => p.intent >= 70)
    if (intent === 'medium') list = list.filter(p => p.intent >= 40 && p.intent < 70)
    if (intent === 'low')    list = list.filter(p => p.intent < 40)
    if (quietOnly) list = list.filter(p => OPEN.has(p.stage) && p.stage !== 'Hold' && p.idleD >= 7)
    const q = search.trim().toLowerCase()
    if (q) {
      const digits = q.replace(/\D/g, '')
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || getCsId(p.lead).toLowerCase().includes(q) ||
        (digits.length >= 4 && (p.lead.phones?.primaryPhoneNumber ?? '').replace(/\D/g, '').includes(digits)))
    }
    const sorted = [...list]
    sorted.sort((x, y) => {
      switch (sortBy) {
        case 'intent': return y.intent - x.intent
        case 'value':  return y.value - x.value
        case 'idle':   return y.idleD - x.idleD
        case 'newest': return x.ageMs - y.ageMs
        default:       return y.priority - x.priority
      }
    })
    return sorted
  }, [a.items, focus, source, intent, quietOnly, search, sortBy])

  const columns = useMemo(() => {
    const g = new Map<StageId, PLead[]>(BOARD_ORDER.map(s => [s, []]))
    for (const p of boardItems) g.get(p.stage)!.push(p)
    return g
  }, [boardItems])
  const hasHold = a.items.some(p => p.stage === 'Hold')
  const highlightId = search.trim() && boardItems.length === 1 ? boardItems[0].id : null
  const activeItem = activeId ? a.items.find(p => p.id === activeId) ?? null : null

  const showToast = useCallback((t: Toast) => {
    clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), 6000)
  }, [])

  const patchStatus = async (id: string, status: StageId) => {
    const res = await fetch(`/api/crm/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error(`PATCH ${res.status}`)
  }

  const moveLead = async (id: string, to: StageId) => {
    const prev = leads.find(l => l.id === id)
    if (!prev) return
    const from = stageOf(prev)
    if (from === to || !MOVABLE.has(to) || !MOVABLE.has(from)) return
    const name = displayName(prev)
    setLeads(ls => ls.map(l => (l.id === id ? { ...l, status: to, updatedAt: new Date().toISOString() } : l)))
    try {
      await patchStatus(id, to)
      showToast({
        text: `Moved ${name} to ${STAGE[to].label}`, tone: 'ok',
        undo: async () => {
          setToast(null)
          setLeads(ls => ls.map(l => (l.id === id ? prev : l)))
          try { await patchStatus(id, from) } catch { showToast({ text: `Couldn't undo the move for ${name}.`, tone: 'error' }) }
        },
      })
    } catch {
      setLeads(ls => ls.map(l => (l.id === id ? prev : l)))
      showToast({ text: `Couldn't move ${name}. Nothing was changed, please try again.`, tone: 'error' })
    }
  }

  const openLead = (id: string) => {
    if (Date.now() - lastDragEnd.current < 300) return
    router.push(`/dashboard/leads/${id}`)
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    lastDragEnd.current = Date.now()
    if (over) moveLead(String(active.id), over.id as StageId)
  }

  const applyFocus = (f: Focus) => {
    const on = focus !== f
    setFocus(on ? f : 'none')
    if (on && f === 'outcomes') setCollapsed(c => { const n = new Set(c); n.delete('Closed'); n.delete('Disqualified'); return n })
    if (on) requestAnimationFrame(() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const pickFocus = (f: Focus) => {
    setFocus(f)
    if (f === 'outcomes') setCollapsed(c => { const n = new Set(c); n.delete('Closed'); n.delete('Disqualified'); return n })
  }
  const toggleCollapse = (s: StageId) => setCollapsed(c => { const n = new Set(c); if (n.has(s)) n.delete(s); else n.add(s); return n })

  const filterCount = (source !== 'all' ? 1 : 0) + (intent !== 'all' ? 1 : 0) + (quietOnly ? 1 : 0)
  const clearFilters = () => { setSource('all'); setIntent('all'); setQuietOnly(false); setSearch(''); setFocus('none') }
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (focus !== 'none') chips.push({ key: 'focus', label: `Showing: ${focus === 'open' ? 'Open deals' : FOCUS_LABELS[focus]}`, clear: () => setFocus('none') })
  if (source !== 'all') chips.push({ key: 'source', label: `Source: ${source}`, clear: () => setSource('all') })
  if (intent !== 'all') chips.push({ key: 'intent', label: `Intent: ${INTENT_LABELS[intent]}`, clear: () => setIntent('all') })
  if (quietOnly) chips.push({ key: 'quiet', label: 'No update in 7+ days', clear: () => setQuietOnly(false) })

  const exportCsv = () => {
    const head = ['CS ID', 'Name', 'Phone', 'Stage', 'Intent score', 'Deal value (INR)', 'Source', 'City', 'Days since update', 'Created', 'Next step']
    const rows = boardItems.map(p => [
      getCsId(p.lead), p.name, p.lead.phones?.primaryPhoneNumber ?? '', STAGE[p.stage].label, p.lead.intentScore, p.value || '',
      sourceMeta(p.lead.sourcePortal).label, p.lead.city, Math.floor(p.idleD), p.lead.createdAt.slice(0, 10), p.reason?.text ?? '',
    ])
    const csv = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const el = document.createElement('a')
    el.href = url
    el.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(el)
    el.click()
    el.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const k = a.kpi
  const empty = !loading && !error && leads.length === 0

  return (
    <div style={{ minHeight: '100vh', background: CANVAS }}>
      <PageTabBar tabs={LEADS_TABS} />

      {/* ── Page header ── */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-4 pb-6 pt-7 lg:px-8">
        <div className="flex items-start gap-4">
          <Link href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard"
            className="mt-1 hidden size-11 shrink-0 place-items-center rounded-[12px] border bg-white no-underline transition-colors hover:bg-[#F9FAFB] sm:grid"
            style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
            <CaretLeft size={18} weight="bold" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="m-0 text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px]" style={{ color: TEXT }}>Pipeline</h1>
              {!firstLoad && (
                <span className="rounded-full border px-2.5 py-0.5 text-[13px] font-semibold tabular-nums" style={{ background: BLUE_BG, borderColor: BLUE_LN, color: BLUE }}>
                  {k.openCount.toLocaleString('en-IN')} open
                </span>
              )}
            </div>
            <p className="m-0 mt-1 text-[15px]" style={{ color: SUBTLE }}>
              Where every deal stands, where leads drop off, and who to call next.
              {totalCount > leads.length && !firstLoad && <span style={{ color: LABEL }}> Based on your latest {leads.length} of {totalCount.toLocaleString('en-IN')} leads.</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Popover open={dateMenu.open} onOpenChange={dateMenu.onOpenChange} align="right" width={210}
            trigger={
              <Btn onClick={dateMenu.toggle} active={range !== 'all'}>
                <CalendarBlank size={18} /><span className="hidden sm:inline">Leads from:</span> {DATE_LABELS[range]}<CaretDown size={13} weight="bold" />
              </Btn>
            }>
            <MenuLabel>Leads created</MenuLabel>
            {(Object.keys(DATE_LABELS) as DateRange[]).map(r => (
              <MenuItem key={r} active={range === r} onClick={() => { setRange(r); setOpenMenu(null) }}>{DATE_LABELS[r]}</MenuItem>
            ))}
          </Popover>
          <Btn onClick={refresh} label="Refresh"><ArrowClockwise size={18} className={loading && !firstLoad ? 'animate-spin' : ''} /></Btn>
          <Btn onClick={exportCsv} label="Export CSV"><DownloadSimple size={18} /><span className="hidden sm:inline">Export</span></Btn>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-16 lg:px-8">
        {error && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3" style={{ background: '#FEF3F2', borderColor: '#FECDCA' }}>
            <p className="m-0 text-[14px]" style={{ color: '#B42318' }}>{error}</p>
            <Btn onClick={refresh}>Try again</Btn>
          </div>
        )}

        {empty ? (
          <div className="rounded-[16px] border px-6 py-16 text-center" style={{ borderColor: BORDER, boxShadow: XS }}>
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[12px] border" style={{ borderColor: BORDER, boxShadow: XS, color: TEXT_2 }}><Kanban size={22} /></div>
            <h2 className="m-0 mb-1 text-[16px] font-semibold" style={{ color: TEXT }}>Your pipeline is empty</h2>
            <p className="m-0 mb-5 text-[14px]" style={{ color: SUBTLE }}>Add or import leads and they will show up here, sorted by stage.</p>
            <Link href="/dashboard/leads" className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold text-white no-underline" style={{ background: BLUE, boxShadow: XS }}>
              <UsersThree size={16} weight="bold" />Go to Leads
            </Link>
          </div>
        ) : (
          <>
            {/* ── KPI cards: each one also filters the board ── */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <KpiCard icon={<Wallet size={16} weight="bold" />} accent={BLUE} title="Open pipeline" loading={firstLoad}
                info="Total budget of every open lead (New, Cold, Warm, Hot and on hold), using the top of each budget range."
                value={inr(k.openValue)}
                viz={<StackBar format={inrCompact} parts={k.valueBy.filter(v => v.stage !== 'Hold' || v.value > 0).map((v, i) => ({ label: STAGE[v.stage].label, value: v.value, color: ['#D1E0FF','#84ADFF','#528BFF','#1D4ED8','#B2CCFF'][i] ?? '#D1E0FF' }))} />}
                sub={k.openValue ? <><span style={{ color: TEXT_2, fontWeight: 600 }}>{k.lateShare}%</span> is Warm or Hot, closest to closing</> : 'No open deals in this period'}
                active={focus === 'open'} onClick={() => applyFocus('open')} />
              <KpiCard icon={<HourglassMedium size={16} weight="bold" />} accent={BLUE} title="Awaiting first call" loading={firstLoad}
                info="Leads still in New: nobody has called, messaged or emailed them yet. Portal enquiries often go to several brokers, so the first call matters."
                value={String(k.newCount)} unit="leads"
                pill={k.newCount === 0 ? <Pill tone="green">All contacted</Pill> : k.over24 > 0 ? <Pill tone="red">{k.over24} over 24h</Pill> : <Pill tone="green">All under 24h</Pill>}
                viz={<StackBar format={n => String(n)} parts={k.newBuckets.map((b, i) => ({ label: b.label, value: b.n, color: ['#D1E0FF','#84ADFF','#528BFF','#1D4ED8'][i] ?? '#D1E0FF' }))} />}
                sub={k.medianFirst != null
                  ? <>Median first response <span style={{ color: TEXT_2, fontWeight: 600 }}>{durLong(k.medianFirst)}</span></>
                  : k.newCount ? <>Oldest has waited <span style={{ color: TEXT_2, fontWeight: 600 }}>{durLong(k.oldestNew)}</span></> : 'Every lead has been reached'}
                active={focus === 'uncontacted'} onClick={() => applyFocus('uncontacted')} />
              <KpiCard icon={<Clock size={16} weight="bold" />} accent={BLUE} title="Gone quiet" loading={firstLoad}
                info="Leads in Cold, Warm or Hot with no update or activity for 7 days or more. These are the deals most likely to slip."
                value={String(k.quietCount)} unit="deals"
                pill={k.quietValue ? <Pill tone="amber">{inr(k.quietValue)} at risk</Pill> : undefined}
                viz={<StackBar format={n => String(n)} parts={k.quietBy.map((q, i) => ({ label: STAGE[q.stage].label, value: q.n, color: ['#84ADFF','#528BFF','#1D4ED8'][i] ?? '#84ADFF' }))} />}
                sub={k.hotQuiet > 0
                  ? <><span style={{ color: TEXT_2, fontWeight: 600 }}>{k.hotQuiet} Hot {k.hotQuiet === 1 ? 'deal' : 'deals'}</span> among them</>
                  : 'Contacted, then no update for 7+ days'}
                active={focus === 'quiet'} onClick={() => applyFocus('quiet')} />
              <KpiCard icon={<Trophy size={16} weight="bold" />} accent={BLUE} title="Win rate" loading={firstLoad}
                info="Closed ÷ (Closed + Disqualified) for leads created in this period. Shows how well leads are qualified and followed through."
                value={k.winRate == null ? '—' : `${k.winRate}%`}
                pill={<Pill tone="green">{k.closedCount} won</Pill>}
                viz={<StackBar format={n => String(n)} parts={[{ label: 'Closed', value: k.closedCount, color: '#1D4ED8' }, { label: 'Disqualified', value: k.droppedCount, color: '#E0EAFF' }]} />}
                sub={k.avgClose != null ? <>Avg <span style={{ color: TEXT_2, fontWeight: 600 }}>{k.avgClose} days</span> from enquiry to close</> : 'No closed deals in this period'}
                active={focus === 'outcomes'} onClick={() => applyFocus('outcomes')} />
            </div>

            {/* ── Conversion + call list ── */}
            <div className="mt-4 grid gap-4 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-7"><FunnelPanel f={a.funnel} loading={firstLoad} /></div>
              <div className="min-w-0 xl:col-span-5"><CallNextPanel a={a} loading={firstLoad} onOpen={openLead} /></div>
            </div>

            {/* ── Board ── */}
            <div ref={boardRef} className="scroll-mt-16 pt-10">
              <SectionHead title="Board" sub="Drag a card to another stage to move it. On a phone, press and hold first." />
              <div className="rounded-[16px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS }}>
                <div className="flex flex-wrap items-center gap-2.5 p-4">
                  <Seg label="Show" value={focus} onChange={pickFocus}
                    options={(Object.keys(FOCUS_LABELS) as Focus[]).map(f => ({ id: f, label: FOCUS_LABELS[f] }))} />
                  <div className="ml-auto flex w-full flex-wrap items-center gap-2.5 md:w-auto">
                    <div className="relative w-full min-w-0 md:w-[210px] 2xl:w-[240px]">
                      <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: LABEL }} />
                      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone or CS ID" aria-label="Search the board"
                        className={`h-10 w-full rounded-[10px] border bg-white pl-10 text-[14px] outline-none ${search ? 'pr-8' : 'pr-3'} transition-[border-color,box-shadow] placeholder:text-[#98A2B3] focus:border-[#84ADFF] focus:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]`}
                        style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS }} />
                      {search && (
                        <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
                          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-[6px] hover:bg-[#F2F4F7]" style={{ color: LABEL }}>
                          <X size={13} weight="bold" />
                        </button>
                      )}
                    </div>
                    <Popover open={sortMenu.open} onOpenChange={sortMenu.onOpenChange} align="right" width={240}
                      trigger={
                        <SplitBtn icon={<ArrowsDownUp size={18} />} onClick={sortMenu.toggle} active={sortBy !== 'priority'}>
                          <span className="hidden lg:inline">{sortBy === 'priority' ? 'Sort' : SORT_LABELS[sortBy]}</span>
                        </SplitBtn>
                      }>
                      <MenuLabel>Sort cards by</MenuLabel>
                      {(Object.keys(SORT_LABELS) as SortBy[]).map(s => (
                        <MenuItem key={s} active={sortBy === s} onClick={() => { setSortBy(s); setOpenMenu(null) }}>{SORT_LABELS[s]}</MenuItem>
                      ))}
                    </Popover>
                    <Popover open={filterMenu.open} onOpenChange={filterMenu.onOpenChange} align="right" width={290}
                      trigger={
                        <SplitBtn icon={<Funnel size={18} />} onClick={filterMenu.toggle} active={filterCount > 0} badge={filterCount}>
                          <span className="hidden lg:inline">Filter</span>
                        </SplitBtn>
                      }>
                      <MenuLabel>Intent score</MenuLabel>
                      <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                        {(Object.keys(INTENT_LABELS) as IntentFilter[]).map(s => (
                          <button key={s} type="button" onClick={() => setIntent(s)}
                            className="cursor-pointer rounded-[8px] border px-2 py-1.5 text-[13px] font-semibold transition-colors"
                            style={intent === s ? { background: BLUE_BG, borderColor: BLUE_LN, color: BLUE } : { background: CANVAS, borderColor: BORDER, color: TEXT_2 }}>
                            {INTENT_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      {sourceOptions.length > 0 && (
                        <>
                          <div className="mx-1 my-1.5 border-t" style={{ borderColor: BORDER }} />
                          <MenuLabel>Source</MenuLabel>
                          <div className="max-h-[200px] overflow-y-auto">
                            <MenuItem active={source === 'all'} onClick={() => setSource('all')}><Globe size={18} color={SUBTLE} />All sources</MenuItem>
                            {sourceOptions.map(([label, raw]) => (
                              <MenuItem key={label} active={source === label} onClick={() => setSource(label)}>
                                <SourceMark raw={raw} size={18} /><span className="truncate">{label}</span>
                              </MenuItem>
                            ))}
                          </div>
                        </>
                      )}
                      <div className="mx-1 my-1.5 border-t" style={{ borderColor: BORDER }} />
                      <MenuItem active={quietOnly} onClick={() => setQuietOnly(v => !v)}><Clock size={18} color="#B54708" />No update in 7+ days</MenuItem>
                    </Popover>
                  </div>
                </div>

                {chips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
                    {chips.map(c => (
                      <span key={c.key} className="inline-flex items-center gap-1 rounded-[8px] border py-1 pl-2.5 pr-1 text-[13px] font-medium" style={{ borderColor: BORDER_2, color: TEXT_2 }}>
                        {c.label}
                        <button type="button" onClick={c.clear} aria-label={`Remove ${c.label}`}
                          className="grid size-5 cursor-pointer place-items-center rounded-[5px] transition-colors hover:bg-[#F2F4F7]" style={{ color: LABEL }}>
                          <X size={12} weight="bold" />
                        </button>
                      </span>
                    ))}
                    <span className="text-[13px] tabular-nums" style={{ color: SUBTLE }}>{boardItems.length} of {a.items.length} leads</span>
                    <button type="button" onClick={clearFilters} className="cursor-pointer px-1 text-[13px] font-semibold" style={{ color: BLUE }}>Clear all</button>
                  </div>
                )}

                <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
                  <div className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto border-t px-4 pb-4 pt-4 [scroll-padding-inline:16px] sm:snap-none" style={{ borderColor: BORDER }}>
                    {firstLoad
                      ? Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className="flex w-[84vw] max-w-[300px] shrink-0 flex-col gap-2 rounded-[14px] border p-2.5 sm:w-auto sm:max-w-[380px] sm:flex-[1_0_236px]" style={{ background: SURFACE, borderColor: BORDER }}>
                            <span className="m-1 block h-4 w-24 animate-pulse rounded bg-[#EAECF0]" />
                            {Array.from({ length: 3 - (i % 2) }, (_, j) => <span key={j} className="block h-[118px] animate-pulse rounded-[12px] bg-white" />)}
                          </div>
                        ))
                      : BOARD_ORDER.filter(s => s !== 'Hold' || hasHold).map(s => (
                          <BoardColumn key={s} stage={s} items={columns.get(s) ?? []} dragging={!!activeId} highlightId={highlightId}
                            collapsed={collapsed.has(s)} onToggle={s === 'Disqualified' || s === 'Closed' ? () => toggleCollapse(s) : undefined}
                            onMove={moveLead} onReassign={setReassignId} onOpen={openLead} />
                        ))}
                  </div>
                  <DragOverlay dropAnimation={null}>
                    {activeItem ? <PipeCard p={activeItem} overlay /> : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>

            {/* ── Lead analytics ── */}
            <div className="pt-10">
              <SectionHead title="Lead analytics" sub="Where your leads come from, how fast they age, and what they are looking for." />
              <div className="grid gap-4 xl:grid-cols-12">
                <div className="min-w-0 xl:col-span-7"><SourcePanel rows={a.sources} loading={firstLoad} /></div>
                <div className="min-w-0 xl:col-span-5"><AgingPanel a={a} loading={firstLoad} onOpen={openLead} /></div>
                <div className="min-w-0 xl:col-span-7"><DemandPanel a={a} loading={firstLoad} /></div>
                <div className="min-w-0 xl:col-span-5"><FlowPanel a={a} loading={firstLoad} /></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[200] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-[12px] bg-[#101828] py-2 pl-4 pr-2 text-white shadow-[0_20px_24px_-4px_rgba(16,24,40,0.18)]">
          {toast.tone === 'ok'
            ? <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#17B26A]"><Check size={11} weight="bold" /></span>
            : <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#F04438]"><X size={11} weight="bold" /></span>}
          <span className="min-w-0 text-[14px] font-medium">{toast.text}</span>
          {toast.undo && (
            <button type="button" onClick={toast.undo} className="h-8 shrink-0 cursor-pointer rounded-[8px] px-2.5 text-[14px] font-semibold text-[#84ADFF] transition-colors hover:bg-white/10">Undo</button>
          )}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] text-[#98A2B3] transition-colors hover:bg-white/10 hover:text-white">
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      {/* ── Reassign ── */}
      {reassignId && (() => {
        const rl = leads.find(l => l.id === reassignId)
        if (!rl) return null
        return (
          <ReassignModal
            isOpen
            onClose={() => setReassignId(null)}
            leadId={reassignId}
            leadName={displayName(rl)}
            onReassigned={name => showToast({ text: `${displayName(rl)} reassigned to ${name}`, tone: 'ok' })}
          />
        )
      })()}
    </div>
  )
}
