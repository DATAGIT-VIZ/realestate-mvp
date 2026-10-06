'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode, type ElementType } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { type CRMLead } from '@/lib/twenty'
import { LogActivityModal } from '@/components/LogActivityModal'
import { WhatsAppModal } from '@/components/WhatsAppModal'
import { CallModal } from '@/components/CallModal'
// import { FollowUpWriter } from '@/components/FollowUpWriter'   // frozen — park until inventory is wired
// import { PropertyMatcher } from '@/components/PropertyMatcher' // frozen — park until inventory is wired
import { ReassignModal } from '@/components/ReassignModal'
import { EnrollSequenceModal } from '@/components/EnrollSequenceModal'
import {
  Phone, Envelope, MapPin, Clock, Tag, TrendUp, CalendarBlank, Trash, CircleNotch, Pulse,
  Warning, Plus, ChatCircle, CheckCircle, XCircle, MinusCircle, Question, CaretDown, CaretLeft,
  PhoneSlash, Copy, PaperPlaneTilt, Lightning, Bell, Medal, ClipboardText, Snowflake, SunDim, Flame,
  Check, X, ArrowFatUp, ArrowFatDown, CheckSquare, UserSwitch, WhatsappLogo, DotsThree, Gauge, Wallet,
  ClockCounterClockwise, HourglassMedium, Receipt, Handshake, Buildings, UsersThree, NotePencil,
  Globe, FacebookLogo, GoogleLogo, Megaphone, House,
} from '@phosphor-icons/react'

// ─── Design tokens (same as the leads list) ───────────────────────────────────
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
const GREEN    = '#067647'
const RED      = '#B42318'
const WA_GRN   = '#16A34A'
const XS       = '0 1px 2px rgba(16,24,40,0.05)'
const MONO     = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const FIELD    = 'w-full rounded-[10px] border bg-white px-3.5 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-[#98A2B3] focus:border-[#84ADFF] focus:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]'

// Status colours, shared with the list page
const STATUS_PILL: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  New:          { color: '#344054', bg: '#F9FAFB', border: '#D0D5DD', dot: '#98A2B3' },
  Cold:         { color: '#026AA2', bg: '#F0F9FF', border: '#B9E6FE', dot: '#0BA5EC' },
  Warm:         { color: '#B54708', bg: '#FFFAEB', border: '#FEDF89', dot: '#F79009' },
  Hot:          { color: '#C4320A', bg: '#FFF6ED', border: '#F9DBAF', dot: '#EF6820' },
  Closed:       { color: '#067647', bg: '#ECFDF3', border: '#ABEFC6', dot: '#17B26A' },
  Disqualified: { color: '#C01048', bg: '#FFF1F3', border: '#FECDD6', dot: '#F63D68' },
}

const ACT_COLORS: Record<string, { icon: string; bg: string; ring: string }> = {
  'Call Made':            { icon: '#067647', bg: '#ECFDF3', ring: '#ABEFC6' },
  'Call Missed':          { icon: '#B42318', bg: '#FEF3F2', ring: '#FECDCA' },
  'WhatsApp Sent':        { icon: '#15803D', bg: '#F0FDF4', ring: '#BBF7D0' },
  'WhatsApp Received':    { icon: '#15803D', bg: '#F0FDF4', ring: '#BBF7D0' },
  'Email Sent':           { icon: BLUE,      bg: BLUE_BG,   ring: BLUE_LN   },
  'Email Received':       { icon: BLUE,      bg: BLUE_BG,   ring: BLUE_LN   },
  'Site Visit Scheduled': { icon: '#B54708', bg: '#FFFAEB', ring: '#FEDF89' },
  'Site Visit Done':      { icon: '#3538CD', bg: '#EEF4FF', ring: '#C7D7FE' },
  'VM Done':              { icon: '#3538CD', bg: '#EEF4FF', ring: '#C7D7FE' },
  'OBM Done':             { icon: '#3538CD', bg: '#EEF4FF', ring: '#C7D7FE' },
  'EOI Received':         { icon: '#C4320A', bg: '#FFF6ED', ring: '#F9DBAF' },
  'Deal Closed':          { icon: '#067647', bg: '#ECFDF3', ring: '#ABEFC6' },
  'Follow Up Set':        { icon: '#B54708', bg: '#FFFAEB', ring: '#FEDF89' },
  'Note':                 { icon: '#475467', bg: '#F9FAFB', ring: '#EAECF0' },
  'Status Changed':       { icon: BLUE,      bg: BLUE_BG,   ring: BLUE_LN   },
  'Escalated':            { icon: '#B54708', bg: '#FFFAEB', ring: '#FEDF89' },
  'Escalation Removed':   { icon: '#667085', bg: '#F9FAFB', ring: '#EAECF0' },
}
const ACT_DEFAULT = { icon: '#475467', bg: '#F9FAFB', ring: '#EAECF0' }

// ─── Types ────────────────────────────────────────────────────────────────────
type LeadActivity = {
  id: string; type: string; createdAt: string
  notes?: string | null; outcome?: string | null
  duration?: number | null; nextActionDate?: string | null
}
type LeadTask = {
  id: string; lead_id: string; title: string; task_type: string
  due_date: string; priority: 'High' | 'Medium' | 'Low'
  status: 'Pending' | 'Done' | 'Cancelled'
  notes?: string | null; assigned_to?: string | null; created_at: string
}
type TLFilter = 'all' | 'calls' | 'whatsapp' | 'email' | 'notes' | 'tasks'
type TLItem   = { kind: 'activity'; data: LeadActivity } | { kind: 'task'; data: LeadTask }
type LeftTab  = 'info' | 'requirements'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCsId(lead: CRMLead): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
}
const getDisplayName = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed Lead'
const getInitials    = (l: CRMLead) => [l.name.firstName[0], l.name.lastName[0]].filter(Boolean).join('').toUpperCase() || '?'
const getPhone       = (l: CRMLead) => l.phones.primaryPhoneNumber ?? ''
const getEmail       = (l: CRMLead) => l.emails.primaryEmail ?? ''
const getScore       = (l: CRMLead) => l.intentScore ?? 0

// Demo avatar map — CS ID → public image path (add more as needed)
const AVATAR_MAP: Record<string, string> = {
  'CS01689': '/avatars/adi.png',
}
function getAvatarImg(csId: string): string | null {
  return AVATAR_MAP[csId] ?? null
}

// Avatar: soft two-tone gradient, cycles deterministically by name (same as the list)
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

// Source → label + portal logo (public/portals) or icon (same as the list)
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
function sourceMeta(raw: string): SourceMeta {
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (SOURCE_META[key]) return SOURCE_META[key]
  const label = raw.length > 3 && raw === raw.toUpperCase()
    ? raw.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : raw
  return { label, Icon: Globe, color: SUBTLE }
}
function SourceMark({ raw, size = 20 }: { raw: string; size?: number }) {
  const m = sourceMeta(raw)
  if (m.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.logo} alt="" width={size} height={size} className="shrink-0 rounded-[6px]" style={{ width: size, height: size }} />
  }
  const Icon = m.Icon ?? Globe
  return (
    <span className="grid shrink-0 place-items-center rounded-[6px] border bg-white" style={{ width: size, height: size, borderColor: BORDER }}>
      <Icon size={size * 0.62} weight="fill" color={m.color} />
    </span>
  )
}

function formatBudget(min: number | null, max: number | null): string {
  const fmt = (n: number) => n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(1)}Cr` : `${+(n / 100_000).toFixed(1)}L`
  if (min && max) return `₹${fmt(min)} – ₹${fmt(max)}`
  if (min) return `₹${fmt(min)}+`
  if (max) return `Up to ₹${fmt(max)}`
  return '—'
}
function formatBudgetShort(min: number | null, max: number | null): string {
  const fmt = (n: number) => n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(1)}Cr` : `${+(n / 100_000).toFixed(1)}L`
  if (min && max) return `₹${fmt(min)}–${fmt(max)}`
  if (min) return `₹${fmt(min)}+`
  if (max) return `≤ ₹${fmt(max)}`
  return '—'
}
function timeAgo(d: string) {
  const s = Date.now() - new Date(d).getTime()
  const m = Math.floor(s / 60_000), h = Math.floor(m / 60), dy = Math.floor(h / 24)
  if (dy > 0) return `${dy}d ago`; if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`; return 'Just now'
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatShortDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function dayLabel(iso: string) {
  const d = new Date(iso), t = new Date()
  if (d.toDateString() === t.toDateString()) return 'Today'
  const y = new Date(t); y.setDate(t.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' })
}
function scoreStyle(score: number) {
  if (score >= 70) return { label: 'High intent',   color: BLUE,      bg: BLUE_BG,   border: BLUE_LN   }
  if (score >= 40) return { label: 'Medium intent', color: '#B54708', bg: '#FFFAEB', border: '#FEDF89' }
  return               { label: 'Low intent',      color: MUTED,     bg: SURFACE,   border: BORDER_2  }
}
function scoreBreakdown(l: CRMLead) {
  const ph = getPhone(l), em = getEmail(l)
  const t = (l.timeline ?? '').toLowerCase()
  const urgency = t.includes('immediate') || t.includes('1 month') ? 'Immediate'
    : t.includes('1–3') || t.includes('3 month') ? 'Within 3m'
    : t.includes('6') ? 'Within 6m' : t ? 'Long-term' : 'Unknown'
  const s = (l.sourcePortal ?? '').toLowerCase()
  const srcQ = s.includes('website') || s.includes('referral') ? 'Premium'
    : s.includes('magicbricks') || s.includes('99acres') || s.includes('housing') ? 'Portal'
    : s.includes('facebook') || s.includes('google') ? 'Paid Ads' : s ? 'Other' : 'Unknown'
  return [
    { label: 'Phone',    value: ph ? 'Provided'  : 'Missing', pos: !!ph },
    { label: 'Email',    value: em ? 'Provided'  : 'Missing', pos: !!em },
    { label: 'Budget',   value: (l.budgetMin || l.budgetMax) ? formatBudget(l.budgetMin, l.budgetMax) : 'Not set', pos: !!(l.budgetMin || l.budgetMax) },
    { label: 'Timeline', value: urgency,                      pos: urgency !== 'Unknown' && urgency !== 'Long-term' },
    { label: 'Source',   value: srcQ,                         pos: srcQ === 'Premium' || srcQ === 'Portal' },
  ]
}

const OUTCOME_CFG: Record<string, { Icon: ElementType; color: string; bg: string; border: string }> = {
  'Positive':    { Icon: CheckCircle, color: '#067647', bg: '#ECFDF3', border: '#ABEFC6' },
  'Neutral':     { Icon: MinusCircle, color: '#475467', bg: '#F9FAFB', border: '#EAECF0' },
  'Negative':    { Icon: XCircle,     color: '#B42318', bg: '#FEF3F2', border: '#FECDCA' },
  'No Response': { Icon: Question,    color: BLUE,      bg: BLUE_BG,   border: BLUE_LN   },
}
const ACT_ICON: Record<string, ElementType> = {
  'Call Made': Phone, 'Call Missed': PhoneSlash, 'WhatsApp Sent': WhatsappLogo,
  'WhatsApp Received': WhatsappLogo, 'Email Sent': Envelope, 'Email Received': Envelope,
  'Site Visit Scheduled': CalendarBlank, 'Site Visit Done': MapPin, 'Follow Up Set': Clock,
  'Note': NotePencil, 'Status Changed': TrendUp, 'VM Done': Buildings, 'OBM Done': UsersThree,
  'EOI Received': Receipt, 'Deal Closed': Handshake, 'Escalated': ArrowFatUp, 'Escalation Removed': ArrowFatDown,
}

const PRIORITY_CFG: Record<string, { color: string; bg: string; border: string }> = {
  High:   { color: '#B42318', bg: '#FEF3F2', border: '#FECDCA' },
  Medium: { color: '#B54708', bg: '#FFFAEB', border: '#FEDF89' },
  Low:    { color: '#475467', bg: '#F9FAFB', border: '#EAECF0' },
}
const TASK_TYPES = ['Follow Up', 'Call Back', 'Site Visit', 'Send Brochure', 'Meeting', 'Send Proposal', 'Check In', 'Custom']

const TL_FILTER_CFG: { key: TLFilter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'calls',    label: 'Calls'    },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email',    label: 'Email'    },
  { key: 'notes',    label: 'Notes'    },
  { key: 'tasks',    label: 'Tasks'    },
]

// Lifecycle
const PIPELINE = ['New', 'Cold', 'Warm', 'Hot', 'Closed'] as const
const STAGE_CFG: Record<string, { Icon: ElementType; desc: string }> = {
  New:          { Icon: ClipboardText, desc: 'Unworked — just assigned' },
  Cold:         { Icon: Snowflake,     desc: 'Calls / WA only' },
  Warm:         { Icon: SunDim,        desc: 'VM / OBM / SV done' },
  Hot:          { Icon: Flame,         desc: 'EOI received' },
  Closed:       { Icon: Handshake,     desc: 'Deals — EOI paid' },
  Disqualified: { Icon: X,             desc: 'NC / not proceeding' },
}
// Which activity type drives each stage
const STAGE_TRIGGER: Record<string, string[]> = {
  Cold:   ['Call Made', 'Call Missed', 'WhatsApp Sent', 'WhatsApp Received', 'Email Sent'],
  Warm:   ['VM Done', 'OBM Done', 'Site Visit Done', 'Site Visit Scheduled'],
  Hot:    ['EOI Received'],
  Closed: ['Deal Closed'],
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

/** Popover anchored under its trigger. Closes on outside click or Escape, stays inside the viewport. */
function Popover({ open, onOpenChange, trigger, children, align = 'left', width = 240 }: {
  open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactNode; children: ReactNode
  align?: 'left' | 'right'; width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
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
          className={`absolute top-[calc(100%+8px)] z-40 rounded-[12px] border bg-white p-1.5 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)] ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ borderColor: BORDER, width, maxWidth: 'calc(100vw - 24px)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function MenuAction({ icon, label, hint, onClick, disabled, tone }: {
  icon: ReactNode; label: string; hint?: string; onClick: () => void; disabled?: boolean; tone?: string
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled}
      className="flex w-full cursor-pointer items-start gap-3 rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-[#F9FAFB] disabled:cursor-wait disabled:opacity-60">
      <span className="mt-0.5 shrink-0" style={{ color: tone ?? MUTED }}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold" style={{ color: TEXT_2 }}>{label}</span>
        {hint && <span className="block text-[12.5px]" style={{ color: SUBTLE }}>{hint}</span>}
      </span>
    </button>
  )
}

/** Outlined button used across the page. */
function Btn({ onClick, children, label, className = '', disabled }: {
  onClick: () => void; children: ReactNode; label?: string; className?: string; disabled?: boolean
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled}
      className={`inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border bg-white px-3.5 text-[14px] font-semibold transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
      {children}
    </button>
  )
}

function StatusPill({ status, size = 'md' }: { status: string; size?: 'md' | 'lg' }) {
  const p = STATUS_PILL[status] ?? STATUS_PILL.New
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${size === 'lg' ? 'px-3 py-1 text-[14px]' : 'px-2.5 py-0.5 text-[13px]'}`}
      style={{ background: p.bg, borderColor: p.border, color: p.color }}>
      <span className="size-1.5 rounded-full" style={{ background: p.dot }} />
      {status}
    </span>
  )
}

function Chip({ children, color = TEXT_2, bg = CANVAS, border = BORDER_2, className = '' }: {
  children: ReactNode; color?: string; bg?: string; border?: string; className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[7px] border px-2 py-0.5 text-[12.5px] font-medium ${className}`}
      style={{ color, background: bg, borderColor: border }}>
      {children}
    </span>
  )
}

/** KPI card — outer tinted shell with an inner white panel, like the reference. */
function KpiCard({ icon, accent, title, value, unit, pill, children }: {
  icon: ReactNode; accent: string; title: string; value: ReactNode; unit?: string; pill?: ReactNode; children: ReactNode
}) {
  return (
    <div className="flex flex-col rounded-[18px] border p-1.5" style={{ background: SURFACE, borderColor: BORDER, boxShadow: XS }}>
      <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-1.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] border bg-white" style={{ borderColor: BORDER, color: accent, boxShadow: XS }}>
          {icon}
        </span>
        <span className="truncate text-[14px] font-semibold" style={{ color: TEXT_2 }}>{title}</span>
      </div>
      <div className="flex flex-1 flex-col rounded-[13px] border bg-white px-3 pb-3 pt-3.5 min-[520px]:px-4 min-[520px]:pb-3.5 min-[520px]:pt-4" style={{ borderColor: BORDER, boxShadow: XS }}>
        <div className="flex flex-col items-start gap-2 min-[520px]:flex-row min-[520px]:justify-between">
          <div className="flex min-w-0 max-w-full items-baseline gap-1.5">
            <span className="truncate text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums min-[520px]:text-[26px] sm:text-[30px]" style={{ color: TEXT }}>{value}</span>
            {unit && <span className="shrink-0 text-[13px] min-[520px]:text-[14px]" style={{ color: SUBTLE }}>{unit}</span>}
          </div>
          {pill}
        </div>
        <div className="mt-auto pt-3.5">{children}</div>
      </div>
    </div>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[16px] border bg-white ${className}`} style={{ borderColor: BORDER, boxShadow: XS }}>
      {children}
    </section>
  )
}

function LeadAvatar({ lead, size = 64 }: { lead: CRMLead; size?: number }) {
  const name = getDisplayName(lead)
  const photo = getAvatarImg(getCsId(lead))
  const av = avatarColor(name)
  const ring = '0 0 0 3px #fff, 0 0 0 4px #EAECF0, 0 4px 8px -2px rgba(16,24,40,0.10)'
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, boxShadow: ring }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold tracking-[-0.02em]"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(140deg, ${av.from} 0%, ${av.to} 100%)`, color: av.fg, boxShadow: ring }}>
      {getInitials(lead)}
    </span>
  )
}

// ─── Lifecycle track ──────────────────────────────────────────────────────────
function LifecycleTrack({ status, activities }: { status: string; activities: LeadActivity[] }) {
  const isDisqualified = status === 'Disqualified'
  const currentIdx     = PIPELINE.indexOf(status as typeof PIPELINE[number])

  // Build stage history from activities — what activity first reached each stage
  const stageHistory: Record<string, { type: string; date: string }> = {}
  const chrono = [...activities].reverse()
  for (const act of chrono) {
    for (const [stage, triggers] of Object.entries(STAGE_TRIGGER)) {
      if (triggers.includes(act.type) && !stageHistory[stage]) {
        stageHistory[stage] = { type: act.type, date: act.createdAt }
      }
    }
  }

  return (
    <Card>
      <style>{`
        @keyframes lc-ripple {
          0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--lc) 45%, transparent); }
          70%  { box-shadow: 0 0 0 10px color-mix(in srgb, var(--lc) 0%, transparent); }
          100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--lc) 0%, transparent); }
        }
        .lc-current { animation: lc-ripple 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .lc-current { animation: none; } }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <h2 className="m-0 text-[16px] font-semibold" style={{ color: TEXT }}>Lead lifecycle</h2>
        <span className="text-[13px]" style={{ color: SUBTLE }}>
          {isDisqualified ? 'Off the pipeline' : currentIdx >= 0 ? `Stage ${currentIdx + 1} of ${PIPELINE.length}` : status}
        </span>
      </div>
      <div className="px-5 pb-5 pt-4 sm:overflow-x-auto sm:[scrollbar-width:thin]">
        <ol className="m-0 flex list-none flex-col p-0 sm:min-w-[720px] sm:flex-row sm:items-start">
          {PIPELINE.map((stage, idx) => {
            const cfg    = STAGE_CFG[stage]
            const pill   = STATUS_PILL[stage]
            const isDone = !isDisqualified && currentIdx > idx
            const isCur  = status === stage
            const hist   = stageHistory[stage]
            const reached = isDone || isCur
            const linked  = !isDisqualified && currentIdx > idx
            const next    = idx < PIPELINE.length - 1 ? STATUS_PILL[PIPELINE[idx + 1]].dot : pill.dot
            return (
              <li key={stage} className="flex min-w-0 gap-3.5 sm:flex-1 sm:flex-col sm:gap-0">
                <div className="flex flex-col items-center sm:flex-row">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full border-2 ${isCur ? 'lc-current' : ''}`}
                    style={{
                      ['--lc' as string]: pill.dot,
                      background: isCur ? pill.dot : isDone ? pill.bg : CANVAS,
                      borderColor: reached ? pill.dot : BORDER,
                      color: isCur ? '#fff' : isDone ? pill.color : LABEL,
                    }}>
                    {isDone ? <Check size={17} weight="bold" /> : <cfg.Icon size={17} weight={isCur ? 'fill' : 'regular'} />}
                  </span>
                  {idx < PIPELINE.length - 1 && (
                    <>
                      <span className="my-1.5 min-h-5 w-[3px] flex-1 rounded-full sm:hidden"
                        style={{ background: linked ? `linear-gradient(180deg, ${pill.dot}, ${next})` : BORDER }} />
                      <span className="mx-2 hidden h-[3px] flex-1 rounded-full sm:block"
                        style={{ background: linked ? `linear-gradient(90deg, ${pill.dot}, ${next})` : BORDER }} />
                    </>
                  )}
                </div>
                <div className="min-w-0 pb-4 pt-2 sm:pb-0 sm:pr-3 sm:pt-2.5">
                  <div className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: reached ? TEXT : LABEL }}>
                    {stage}
                    {isCur && <span className="rounded-full border px-1.5 text-[11px] font-semibold" style={{ color: pill.color, background: pill.bg, borderColor: pill.border }}>Current</span>}
                  </div>
                  <div className="mt-0.5 text-[12.5px] sm:truncate" style={{ color: reached ? SUBTLE : LABEL }}>
                    {hist ? `${hist.type} · ${formatShortDate(hist.date)}` : cfg.desc}
                  </div>
                </div>
              </li>
            )
          })}
          {/* Off-ramp */}
          <li className="flex gap-3.5 border-t border-dashed pt-4 sm:ml-1 sm:w-[170px] sm:shrink-0 sm:flex-col sm:gap-0 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0" style={{ borderColor: BORDER_2 }}>
            <span className={`grid size-10 shrink-0 place-items-center rounded-full border-2 ${isDisqualified ? 'lc-current' : ''}`}
              style={{
                ['--lc' as string]: STATUS_PILL.Disqualified.dot,
                background: isDisqualified ? STATUS_PILL.Disqualified.dot : CANVAS,
                borderColor: isDisqualified ? STATUS_PILL.Disqualified.dot : BORDER,
                color: isDisqualified ? '#fff' : LABEL,
              }}>
              <X size={17} weight="bold" />
            </span>
            <div className="pt-2 sm:pt-2.5">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: isDisqualified ? TEXT : LABEL }}>
                Disqualified
                {isDisqualified && <span className="rounded-full border px-1.5 text-[11px] font-semibold" style={{ color: STATUS_PILL.Disqualified.color, background: STATUS_PILL.Disqualified.bg, borderColor: STATUS_PILL.Disqualified.border }}>Current</span>}
              </div>
              <div className="mt-0.5 text-[12.5px]" style={{ color: LABEL }}>{STAGE_CFG.Disqualified.desc}</div>
            </div>
          </li>
        </ol>
      </div>
    </Card>
  )
}

// ─── Timeline rows ────────────────────────────────────────────────────────────
function ActivityTLRow({ act, advancedTo, last }: { act: LeadActivity; advancedTo?: string; last: boolean }) {
  const AIcon = ACT_ICON[act.type] ?? Pulse
  const ac    = ACT_COLORS[act.type] ?? ACT_DEFAULT
  const oc    = act.outcome ? OUTCOME_CFG[act.outcome] : null
  const adv   = advancedTo ? (STATUS_PILL[advancedTo] ?? STATUS_PILL.New) : null
  return (
    <li className="relative flex gap-3.5 pb-5">
      {!last && <span aria-hidden className="absolute bottom-0 left-[17.5px] top-10 w-px" style={{ background: BORDER }} />}
      <span className="relative grid size-9 shrink-0 place-items-center rounded-full border" style={{ background: ac.bg, borderColor: ac.ring, color: ac.icon }}>
        <AIcon size={16} weight="bold" />
      </span>
      <div className="min-w-0 flex-1 pt-[7px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{act.type}</span>
          {oc && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-px text-[12px] font-medium" style={{ color: oc.color, background: oc.bg, borderColor: oc.border }}>
              <oc.Icon size={12} weight="bold" />{act.outcome}
            </span>
          )}
          {act.duration != null && act.duration > 0 && (
            <span className="inline-flex items-center gap-1 text-[12.5px] tabular-nums" style={{ color: SUBTLE }}>
              <Clock size={13} />{Math.floor(act.duration / 60)}m {act.duration % 60}s
            </span>
          )}
          <span className="ml-auto shrink-0 text-[12.5px]" style={{ color: LABEL }} title={new Date(act.createdAt).toLocaleString('en-IN')}>{timeAgo(act.createdAt)}</span>
        </div>
        {act.nextActionDate && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: BLUE }}>
            <Bell size={13} weight="bold" />Follow-up · {new Date(act.nextActionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        )}
        {act.notes && (
          <p className="m-0 mt-2 rounded-[10px] border px-3.5 py-2.5 text-[13.5px] leading-[1.6]" style={{ background: SURFACE, borderColor: BORDER, color: TEXT_2 }}>
            {act.notes}
          </p>
        )}
        {adv && (
          <div className="mt-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold" style={{ color: adv.color, background: adv.bg, borderColor: adv.border }}>
              <TrendUp size={12} weight="bold" />Moved to {advancedTo}
            </span>
          </div>
        )}
      </div>
    </li>
  )
}

function TaskTLRow({ task, last, onUpdate }: { task: LeadTask; last: boolean; onUpdate: (id: string, status: 'Done' | 'Cancelled') => void }) {
  const now2 = new Date()
  const todayStr2 = now2.toISOString().slice(0, 10)
  const dueDate = new Date(task.due_date)
  const isOverdue = dueDate < now2 && dueDate.toISOString().slice(0, 10) !== todayStr2
  const pc = PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.Low
  const isDone = task.status === 'Done'
  const isCancelled = task.status === 'Cancelled'
  const dueLabel = (() => {
    const dDay = dueDate.toISOString().slice(0, 10)
    if (dDay === todayStr2) return 'Today'
    if (dDay === new Date(now2.getTime() + 86400000).toISOString().slice(0, 10)) return 'Tomorrow'
    if (isOverdue) return 'Overdue'
    return dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  })()
  const node = isDone
    ? { bg: '#ECFDF3', ring: '#ABEFC6', color: GREEN }
    : isCancelled ? { bg: SURFACE, ring: BORDER, color: LABEL } : { bg: pc.bg, ring: pc.border, color: pc.color }
  return (
    <li className="relative flex gap-3.5 pb-5" style={{ opacity: isCancelled ? 0.55 : 1 }}>
      {!last && <span aria-hidden className="absolute bottom-0 left-[17.5px] top-10 w-px" style={{ background: BORDER }} />}
      <span className="relative grid size-9 shrink-0 place-items-center rounded-[10px] border" style={{ background: node.bg, borderColor: node.ring, color: node.color }}>
        <CheckSquare size={17} weight="bold" />
      </span>
      <div className="min-w-0 flex-1 rounded-[12px] border px-3.5 py-3" style={{ borderColor: isOverdue && !isDone && !isCancelled ? '#FECDCA' : BORDER, background: CANVAS }}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[14px] font-semibold leading-snug" style={{ color: isDone ? SUBTLE : TEXT, textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</span>
          <span className="shrink-0 text-[12.5px]" style={{ color: LABEL }}>{timeAgo(task.created_at)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip><CheckSquare size={12} color={SUBTLE} />{task.task_type}</Chip>
          {isDone ? <Chip color={GREEN} bg="#ECFDF3" border="#ABEFC6"><Check size={12} weight="bold" />Done</Chip>
            : isCancelled ? <Chip color={SUBTLE}>Cancelled</Chip>
            : <Chip color={isOverdue ? RED : TEXT_2} bg={isOverdue ? '#FEF3F2' : CANVAS} border={isOverdue ? '#FECDCA' : BORDER_2}><CalendarBlank size={12} />Due {dueLabel}</Chip>}
          <Chip color={pc.color} bg={pc.bg} border={pc.border}>{task.priority}</Chip>
        </div>
        {task.notes && <p className="m-0 mt-2 text-[13px] leading-[1.55]" style={{ color: MUTED }}>{task.notes}</p>}
        {task.status === 'Pending' && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => onUpdate(task.id, 'Done')}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-semibold transition-colors hover:bg-[#DCFAE6]"
              style={{ color: GREEN, background: '#ECFDF3', borderColor: '#ABEFC6' }}>
              <Check size={13} weight="bold" />Mark done
            </button>
            <button type="button" onClick={() => onUpdate(task.id, 'Cancelled')}
              className="inline-flex h-8 cursor-pointer items-center rounded-[8px] border bg-white px-3 text-[13px] font-semibold transition-colors hover:bg-[#F9FAFB]"
              style={{ color: MUTED, borderColor: BORDER_2 }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LeadDetailPage() {
  const router = useRouter()
  const { id: leadId } = useParams() as { id: string }

  const [lead, setLead]             = useState<CRMLead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showCallModal, setShowCallModal]         = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [stageChanging, setStageChanging] = useState(false)
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [callAttempts, setCallAttempts]   = useState<string[]>([])
  const [showNCSuggest, setShowNCSuggest] = useState(false)
  const [tlFilter, setTlFilter]     = useState<TLFilter>('all')
  const [leftTab, setLeftTab]       = useState<LeftTab>('info')
  const [quickNote, setQuickNote]   = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [showMore, setShowMore]     = useState(false)

  // ── Email compose state ────────────────────────────────────────────────────
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent]     = useState(false)
  const [emailError, setEmailError]   = useState<string | null>(null)

  // ── Escalation state ───────────────────────────────────────────────────────
  const [escalating, setEscalating] = useState(false)

  // ── Reassign state ─────────────────────────────────────────────────────────
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(null)

  // ── Sequence enroll state ──────────────────────────────────────────────────
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  // ── Tasks state ────────────────────────────────────────────────────────────
  const [tasks,       setTasks]       = useState<LeadTask[]>([])
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [savingTask,  setSavingTask]  = useState(false)
  const [taskForm, setTaskForm] = useState({
    task_type: 'Follow Up', title: '', date: '', time: '10:00',
    priority: 'Medium' as 'High' | 'Medium' | 'Low', notes: '',
  })

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetch(`/api/crm/leads/${leadId}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setLead(json.data.lead); setActivities(json.data.activities ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load lead') }
    finally { setLoading(false) }
  }, [leadId])

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/crm/leads/${leadId}/tasks`)
    if (res.ok) { const d = await res.json(); setTasks(d.tasks ?? []) }
  }, [leadId])

  const updateTask = useCallback(async (taskId: string, status: 'Done' | 'Cancelled') => {
    await fetch(`/api/crm/leads/${leadId}/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchTasks()
  }, [leadId, fetchTasks])

  const handleCreateTask = useCallback(async () => {
    if (!taskForm.title.trim() || !taskForm.date) return
    setSavingTask(true)
    const due_date = new Date(`${taskForm.date}T${taskForm.time}:00`).toISOString()
    await fetch(`/api/crm/leads/${leadId}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: taskForm.title, task_type: taskForm.task_type, due_date, priority: taskForm.priority, notes: taskForm.notes }),
    })
    setSavingTask(false); setShowTaskForm(false)
    setTaskForm({ task_type: 'Follow Up', title: '', date: '', time: '10:00', priority: 'Medium', notes: '' })
    fetchTasks()
  }, [leadId, taskForm, fetchTasks])

  useEffect(() => { fetchLead(); fetchTasks() }, [fetchLead, fetchTasks])
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const handleEscalate = async () => {
    if (!lead || escalating) return
    setEscalating(true)
    const next = !lead.escalated
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalated: next }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // Refresh lead + activity log (escalation logs an activity server-side)
      await fetchLead()
      toast.success(next ? 'Lead escalated — visible in admin Priority Follow Up' : 'Escalation removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update escalation')
    } finally {
      setEscalating(false)
    }
  }

  const handleStageChange = async (stage: string) => {
    if (!lead) return
    setShowStageMenu(false); setStageChanging(true)
    try {
      await fetch(`/api/crm/leads/${leadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: stage }) })
      setLead(p => p ? { ...p, status: stage } : p)
    } finally { setStageChanging(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await fetch(`/api/crm/leads/${leadId}`, { method: 'DELETE' }); router.push('/dashboard/leads') }
    catch { setDeleting(false) }
  }

  useEffect(() => {
    try { const s = localStorage.getItem(`call_attempts_${leadId}`); if (s) setCallAttempts(JSON.parse(s)) } catch {}
  }, [leadId])

  const logCallAttempt = () => {
    const u = [...callAttempts, new Date().toISOString()]; setCallAttempts(u)
    try { localStorage.setItem(`call_attempts_${leadId}`, JSON.stringify(u)) } catch {}
    if (u.length >= 5) setShowNCSuggest(true)
  }
  const clearCallAttempts = () => {
    setCallAttempts([]); setShowNCSuggest(false)
    try { localStorage.removeItem(`call_attempts_${leadId}`) } catch {}
  }
  const handleSendEmail = async () => {
    if (!emailForm.subject.trim() || !emailForm.body.trim() || sendingEmail) return
    setSendingEmail(true); setEmailError(null)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email, toName: name,
          subject: emailForm.subject.trim(),
          body: emailForm.body.trim(),
          leadId,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Send failed')
      setEmailSent(true)
      setTimeout(() => {
        setShowEmailModal(false); setEmailSent(false)
        setEmailForm({ subject: '', body: '' })
        fetchLead()
      }, 1800)
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Could not send email')
    } finally { setSendingEmail(false) }
  }

  const saveQuickNote = async () => {
    if (!quickNote.trim() || savingNote) return
    setSavingNote(true)
    try {
      await fetch(`/api/crm/leads/${leadId}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'Note', notes: quickNote.trim() }) })
      setQuickNote(''); await fetchLead()
    } catch {} finally { setSavingNote(false) }
  }
  const copyCsId = () => {
    if (!lead) return
    navigator.clipboard.writeText(getCsId(lead)).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  // ── Loading: page-shaped skeleton ────────────────────────────────────────────
  if (loading && !lead) return (
    <div style={{ minHeight: '100vh', background: CANVAS }} aria-busy="true" aria-label="Loading lead">
      <div className="mx-auto max-w-[1400px] px-4 pt-7 lg:px-8">
        <div className="flex items-center gap-4">
          <span className="size-11 animate-pulse rounded-[12px] bg-[#F2F4F7]" />
          <span className="size-16 animate-pulse rounded-full bg-[#F2F4F7]" />
          <div className="flex flex-col gap-2.5">
            <span className="h-8 w-56 animate-pulse rounded-[8px] bg-[#F2F4F7]" />
            <span className="h-4 w-80 max-w-[60vw] animate-pulse rounded-[6px] bg-[#F9FAFB]" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => <span key={i} className="h-[150px] animate-pulse rounded-[18px] bg-[#F9FAFB]" />)}
        </div>
        <span className="mt-6 block h-[130px] animate-pulse rounded-[16px] bg-[#F9FAFB]" />
      </div>
    </div>
  )
  if (error || !lead) return (
    <div style={{ minHeight: '100vh', background: CANVAS }} className="grid place-items-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[12px] border" style={{ borderColor: '#FECDCA', background: '#FEF3F2', color: RED }}>
          <Warning size={22} weight="bold" />
        </div>
        <h2 className="m-0 mb-1 text-[18px] font-semibold" style={{ color: TEXT }}>{error || 'Lead not found'}</h2>
        <p className="m-0 mb-5 text-[14px]" style={{ color: SUBTLE }}>It may have been removed, or the link is out of date.</p>
        <Link href="/dashboard/leads"
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border bg-white px-4 text-[14px] font-semibold no-underline hover:bg-[#F9FAFB]"
          style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
          <CaretLeft size={15} weight="bold" /> Back to leads
        </Link>
      </div>
    </div>
  )

  const score   = getScore(lead)
  const ss      = scoreStyle(score)
  const name    = getDisplayName(lead)
  const phone   = getPhone(lead)
  const email   = getEmail(lead)
  const bdown   = scoreBreakdown(lead)
  const status  = lead.status ?? 'New'

  const TYPE_DEFAULTS: Record<string, string> = {
    'Follow Up':     `Follow up with ${lead.name.firstName}`,
    'Call Back':     `Call ${lead.name.firstName} back`,
    'Site Visit':    `Site visit with ${lead.name.firstName}`,
    'Send Brochure': `Send brochure to ${lead.name.firstName}`,
    'Meeting':       `Meeting with ${lead.name.firstName}`,
    'Send Proposal': `Send proposal to ${lead.name.firstName}`,
    'Check In':      `Check in with ${lead.name.firstName}`,
    'Custom':        '',
  }

  const lastAct    = activities[0] ?? null
  const nextFU     = activities.find(a => a.nextActionDate)?.nextActionDate ?? null
  const futureFU   = nextFU && new Date(nextFU) > new Date() ? nextFU : null
  const daysInPipe = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86_400_000)
  const daysSince  = lastAct ? Math.floor((Date.now() - new Date(lastAct.createdAt).getTime()) / 86_400_000) : null

  // ── Last-achieved milestone ──────────────────────────────────────────────────
  const activityTypes = activities.map(a => a.type)
  const topMilestone  = ['Deal Closed', 'EOI Received', 'Site Visit Done', 'OBM Done', 'VM Done']
    .find(m => activityTypes.includes(m)) ?? null

  // ── Status transition markers (simulate lifecycle engine client-side) ─────────
  const STATUS_ADV_CLIENT: Record<string, string> = {
    'Call Made': 'Cold', 'Call Missed': 'Cold', 'WhatsApp Sent': 'Cold',
    'WhatsApp Received': 'Cold', 'Email Sent': 'Cold',
    'VM Done': 'Warm', 'OBM Done': 'Warm', 'Site Visit Done': 'Warm',
    'EOI Received': 'Hot', 'Deal Closed': 'Closed',
  }
  const SIM_ORDER = ['New', 'Cold', 'Warm', 'Hot', 'Closed']
  const statusMarkers = new Map<string, string>()
  {
    let sim = 'New'
    const chrono = [...activities].reverse()
    for (const act of chrono) {
      const target = STATUS_ADV_CLIENT[act.type]
      if (target) {
        const ci = SIM_ORDER.indexOf(sim), ti = SIM_ORDER.indexOf(target)
        if (ti > ci) { statusMarkers.set(act.id, target); sim = target }
      }
    }
  }

  // ── Timeline data ────────────────────────────────────────────────────────────
  const callActs   = activities.filter(a => a.type.toLowerCase().includes('call'))
  const waActs     = activities.filter(a => a.type.toLowerCase().includes('whatsapp'))
  const noteActs   = activities.filter(a => a.type === 'Note')
  const emailActs  = activities.filter(a => a.type.toLowerCase().includes('email'))

  const allTLItems: TLItem[] = [
    ...activities.map(a => ({ kind: 'activity' as const, data: a })),
    ...tasks.map(t => ({ kind: 'task' as const, data: t })),
  ].sort((a, b) => {
    const da = a.kind === 'activity' ? a.data.createdAt : a.data.created_at
    const db = b.kind === 'activity' ? b.data.createdAt : b.data.created_at
    return new Date(db).getTime() - new Date(da).getTime()
  })

  const visibleTLItems = tlFilter === 'all' ? allTLItems : allTLItems.filter(item => {
    if (item.kind === 'task') return tlFilter === 'tasks'
    const t = item.data.type.toLowerCase()
    if (tlFilter === 'calls')    return t.includes('call')
    if (tlFilter === 'whatsapp') return t.includes('whatsapp')
    if (tlFilter === 'email')    return t.includes('email')
    if (tlFilter === 'notes')    return item.data.type === 'Note'
    return true
  })

  // Group the feed by day
  const tlGroups: { label: string; items: TLItem[] }[] = []
  for (const item of visibleTLItems) {
    const label = dayLabel(item.kind === 'activity' ? item.data.createdAt : item.data.created_at)
    const g = tlGroups[tlGroups.length - 1]
    if (g && g.label === label) g.items.push(item)
    else tlGroups.push({ label, items: [item] })
  }

  const tlCounts: Record<TLFilter, number> = {
    all:      allTLItems.length,
    calls:    callActs.length,
    whatsapp: waActs.length,
    email:    emailActs.length,
    notes:    noteActs.length,
    tasks:    tasks.length,
  }
  const callStats = {
    total:      callActs.length,
    connected:  callActs.filter(a => a.outcome === 'Positive').length,
    missed:     callActs.filter(a => a.type === 'Call Missed').length,
    noResponse: callActs.filter(a => a.outcome === 'No Response').length,
  }
  const openTasks = tasks.filter(t => t.status === 'Pending').length

  // ── Smart nudge ─────────────────────────────────────────────────────────────
  type NudgeType = { icon: ElementType; color: string; bg: string; border: string; text: string; sub: string; actionLabel: string; onAction: () => void }
  let nudge: NudgeType | null = null
  if (!nudgeDismissed) {
    if (futureFU) {
      const daysUntil = Math.ceil((new Date(futureFU).getTime() - Date.now()) / 86_400_000)
      if (daysUntil <= 2) nudge = { icon: Bell, color: '#B54708', bg: '#FFFAEB', border: '#FEDF89', text: `Follow-up ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : 'in 2 days'}`, sub: `Scheduled on ${formatShortDate(futureFU)} — log the outcome when done`, actionLabel: 'Log Outcome', onAction: () => setShowActivityModal(true) }
    } else if (activities.length === 0) {
      nudge = { icon: Lightning, color: BLUE, bg: BLUE_BG, border: BLUE_LN, text: 'Make your first move', sub: 'This lead hasn\'t been contacted yet — a quick call increases conversion by 3×', actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (score >= 70 && ['Fresh', 'Cold', 'Attempting'].includes(lead.status || 'Fresh')) {
      nudge = { icon: Lightning, color: BLUE, bg: BLUE_BG, border: BLUE_LN, text: 'High intent — move fast', sub: `Score ${score}/100 but still in early stage. Don't let a hot lead go cold`, actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (callAttempts.length >= 2 && lastAct?.type.includes('Call') && lastAct?.outcome === 'No Response') {
      nudge = { icon: ChatCircle, color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', text: 'Switch to WhatsApp', sub: `${callAttempts.length} calls with no answer — leads respond 4× faster to messages`, actionLabel: 'Send WA', onAction: () => setShowWhatsAppModal(true) }
    } else if (daysSince !== null && daysSince >= 7) {
      nudge = { icon: Warning, color: RED, bg: '#FEF3F2', border: '#FECDCA', text: `No contact in ${daysSince} days`, sub: 'Lead is going cold — reach out now before they look elsewhere', actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (daysSince !== null && daysSince >= 3) {
      nudge = { icon: Bell, color: '#B54708', bg: '#FFFAEB', border: '#FEDF89', text: `${daysSince} days since last contact`, sub: 'A quick touchpoint now keeps the lead warm and moving', actionLabel: 'Log Activity', onAction: () => setShowActivityModal(true) }
    }
  }

  // ── KPI values ───────────────────────────────────────────────────────────────
  const strongSignals = bdown.filter(b => b.pos).length
  const contactTone = daysSince === null
    ? { label: 'Not contacted', color: TEXT_2, bg: SURFACE, border: BORDER_2 }
    : daysSince >= 7 ? { label: 'Going cold', color: RED, bg: '#FEF3F2', border: '#FECDCA' }
    : daysSince >= 3 ? { label: 'Follow up', color: '#B54708', bg: '#FFFAEB', border: '#FEDF89' }
    : { label: 'Active', color: GREEN, bg: '#ECFDF3', border: '#ABEFC6' }
  const LastIcon = lastAct ? (ACT_ICON[lastAct.type] ?? Pulse) : Pulse
  const lastColor = lastAct ? (ACT_COLORS[lastAct.type] ?? ACT_DEFAULT) : ACT_DEFAULT
  const budgetSet = formatBudget(lead.budgetMin, lead.budgetMax) !== '—'

  return (
    <div style={{ minHeight: '100vh', background: CANVAS }}>

      {/* ══ Header ══ */}
      <div className="border-b" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-[1400px] px-4 pb-6 pt-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-[13px]" style={{ color: SUBTLE }}>
            <Link href="/dashboard/leads" className="no-underline transition-colors hover:text-[#101828]" style={{ color: SUBTLE }}>Leads</Link>
            <span style={{ color: BORDER_2 }}>/</span>
            <span className="truncate font-medium" style={{ color: TEXT_2 }}>{name}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <Link href="/dashboard/leads" aria-label="Back to all leads" title="Back to all leads"
                className="mt-2.5 hidden size-11 shrink-0 place-items-center rounded-[12px] border bg-white no-underline transition-colors hover:bg-[#F9FAFB] sm:grid"
                style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
                <CaretLeft size={18} weight="bold" />
              </Link>
              <LeadAvatar lead={lead} size={64} />
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h1 className="m-0 text-[26px] font-bold leading-tight tracking-[-0.03em] sm:text-[32px]" style={{ color: TEXT }}>{name}</h1>
                  <StatusPill status={status} size="lg" />
                  {lead.escalated && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold" style={{ color: '#B54708', background: '#FFFAEB', borderColor: '#FEDF89' }}>
                      <ArrowFatUp size={13} weight="fill" />Escalated
                    </span>
                  )}
                  {topMilestone && (
                    <span className="hidden items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-medium sm:inline-flex" style={{ color: TEXT_2, background: CANVAS, borderColor: BORDER_2 }}>
                      <Medal size={13} weight="fill" color="#F79009" />{topMilestone}
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]" style={{ color: SUBTLE }}>
                  <button type="button" onClick={copyCsId} title="Copy CS ID"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] border px-2 py-0.5 text-[12.5px] font-medium transition-colors hover:border-[#D0D5DD]"
                    style={{ fontFamily: MONO, color: copied ? GREEN : TEXT_2, background: copied ? '#ECFDF3' : SURFACE, borderColor: copied ? '#ABEFC6' : BORDER }}>
                    {copied ? <><Check size={12} weight="bold" />Copied</> : <>{getCsId(lead)}<Copy size={12} color={LABEL} /></>}
                  </button>
                  <span className="inline-flex items-center gap-1.5">
                    {lead.sourcePortal ? <><SourceMark raw={lead.sourcePortal} size={18} />{sourceMeta(lead.sourcePortal).label}</> : <><Globe size={16} />Direct</>}
                  </span>
                  {lead.city && <span className="inline-flex items-center gap-1.5"><MapPin size={16} />{lead.city}</span>}
                  <span className="inline-flex items-center gap-1.5"><CalendarBlank size={16} />Added {formatDate(lead.createdAt)}</span>
                  {assignedTo && <span className="inline-flex items-center gap-1.5"><UserSwitch size={16} />Assigned to <span className="font-semibold" style={{ color: TEXT_2 }}>{assignedTo}</span></span>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
              {phone && (
                <Btn onClick={() => setShowCallModal(true)} label="Call">
                  <Phone size={18} weight="bold" color={GREEN} /><span className="hidden sm:inline">Call</span>
                </Btn>
              )}
              {phone && (
                <Btn onClick={() => setShowWhatsAppModal(true)} label="WhatsApp">
                  <WhatsappLogo size={18} weight="bold" color={WA_GRN} /><span className="hidden sm:inline">WhatsApp</span>
                </Btn>
              )}
              {email && (
                <Btn onClick={() => { setShowEmailModal(true); setEmailSent(false); setEmailError(null) }} label="Email">
                  <Envelope size={18} weight="bold" color={BLUE} /><span className="hidden sm:inline">Email</span>
                </Btn>
              )}
              <Popover open={showMore} onOpenChange={setShowMore} align="right" width={280}
                trigger={
                  <Btn onClick={() => setShowMore(v => !v)} label="More actions" className="px-2.5">
                    <DotsThree size={20} weight="bold" />
                  </Btn>
                }>
                <MenuAction icon={<ArrowFatUp size={18} weight={lead.escalated ? 'fill' : 'regular'} />} tone={lead.escalated ? '#B54708' : undefined}
                  label={escalating ? 'Updating…' : lead.escalated ? 'Remove escalation' : 'Escalate to admin'}
                  hint={lead.escalated ? 'Currently in admin Priority Follow Up' : 'Flag for admin Priority Follow Up'}
                  disabled={escalating} onClick={() => { setShowMore(false); handleEscalate() }} />
                <MenuAction icon={<UserSwitch size={18} />} label="Reassign"
                  hint={assignedTo ? `Assigned to ${assignedTo}` : 'Hand this lead to another agent'}
                  onClick={() => { setShowMore(false); setShowReassignModal(true) }} />
                <MenuAction icon={<Lightning size={18} />} label="Add to sequence" hint="Automated follow-up messages"
                  onClick={() => { setShowMore(false); setShowEnrollModal(true) }} />
              </Popover>
              <button type="button" onClick={() => setShowActivityModal(true)}
                className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#1A43BF] sm:flex-none"
                style={{ background: BLUE, borderColor: BLUE, boxShadow: `${XS}, inset 0 1px 0 rgba(255,255,255,0.18)` }}>
                <Plus size={18} weight="bold" />Log activity
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pb-16 pt-6 lg:px-8">

        {/* ══ KPI cards ══ */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard icon={<Gauge size={16} weight="bold" />} accent={ss.color} title="Intent score" value={score} unit="/ 100"
            pill={<Chip color={ss.color} bg={ss.bg} border={ss.border} className="rounded-full">{ss.label}</Chip>}>
            <div className="flex items-center gap-3">
              <span className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ background: '#F2F4F7' }}>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, score)}%`, background: score >= 70 ? `linear-gradient(90deg, #528BFF, ${BLUE})` : ss.color }} />
              </span>
              <span className="hidden shrink-0 text-[13px] min-[520px]:inline" style={{ color: SUBTLE }}>{strongSignals} of {bdown.length} signals</span>
            </div>
          </KpiCard>

          <KpiCard icon={<Wallet size={16} weight="bold" />} accent={GREEN} title="Budget" value={formatBudgetShort(lead.budgetMin, lead.budgetMax)}>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {lead.propertyType?.slice(0, 2).map(pt => <Chip key={pt}><House size={12} color={SUBTLE} />{pt}</Chip>)}
              {lead.timeline && <Chip><Clock size={12} color={SUBTLE} />{lead.timeline}</Chip>}
              {!lead.timeline && !(lead.propertyType && lead.propertyType.length > 0) && (
                <span className="text-[13px]" style={{ color: SUBTLE }}>{budgetSet ? 'No property type yet' : 'Budget not captured yet'}</span>
              )}
            </div>
          </KpiCard>

          <KpiCard icon={<ClockCounterClockwise size={16} weight="bold" />} accent={contactTone.color === TEXT_2 ? MUTED : contactTone.color} title="Last contact"
            value={daysSince === null ? '—' : daysSince === 0 ? 'Today' : daysSince}
            unit={daysSince === null ? 'never' : daysSince === 0 ? undefined : daysSince === 1 ? 'day ago' : 'days ago'}
            pill={<Chip color={contactTone.color} bg={contactTone.bg} border={contactTone.border} className="rounded-full">{contactTone.label}</Chip>}>
            {lastAct ? (
              <div className="flex min-w-0 items-center gap-2 text-[13px]" style={{ color: SUBTLE }}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full border" style={{ background: lastColor.bg, borderColor: lastColor.ring, color: lastColor.icon }}>
                  <LastIcon size={12} weight="bold" />
                </span>
                <span className="truncate"><span className="font-semibold" style={{ color: TEXT_2 }}>{lastAct.type}</span>{lastAct.outcome ? ` · ${lastAct.outcome}` : ''}</span>
              </div>
            ) : <span className="text-[13px]" style={{ color: SUBTLE }}>No calls, messages or notes yet</span>}
          </KpiCard>

          <KpiCard icon={<HourglassMedium size={16} weight="bold" />} accent={BLUE} title="In pipeline"
            value={daysInPipe > 0 ? daysInPipe : 'Today'} unit={daysInPipe > 0 ? (daysInPipe === 1 ? 'day' : 'days') : undefined}
            pill={openTasks > 0
              ? <Chip color="#B54708" bg="#FFFAEB" border="#FEDF89" className="rounded-full tabular-nums">{openTasks} open {openTasks === 1 ? 'task' : 'tasks'}</Chip>
              : <Chip className="rounded-full tabular-nums">{activities.length} {activities.length === 1 ? 'touch' : 'touches'}</Chip>}>
            <div className="flex min-w-0 items-center gap-2 text-[13px]" style={{ color: SUBTLE }}>
              <Bell size={15} weight="bold" color={futureFU ? BLUE : LABEL} className="shrink-0" />
              <span className="truncate">
                {futureFU ? <>Next follow-up <span className="font-semibold" style={{ color: TEXT_2 }}>{formatShortDate(futureFU)}</span></> : 'No follow-up scheduled'}
              </span>
            </div>
          </KpiCard>
        </div>

        {/* ══ Lifecycle ══ */}
        <LifecycleTrack status={status} activities={activities} />

        {/* ══ Main: activity + details ══ */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">

          {/* ── Activity ── */}
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
              <div className="flex items-center gap-2.5">
                <h2 className="m-0 text-[16px] font-semibold" style={{ color: TEXT }}>Activity</h2>
                <span className="rounded-full border px-2 text-[12px] font-semibold tabular-nums" style={{ borderColor: BORDER, color: MUTED, background: SURFACE }}>{allTLItems.length}</span>
              </div>
              {tlFilter === 'tasks' && !showTaskForm && (
                <Btn onClick={() => { setShowTaskForm(true); setTaskForm(f => ({ ...f, title: TYPE_DEFAULTS['Follow Up'] })) }}>
                  <Plus size={16} weight="bold" />Add task
                </Btn>
              )}
            </div>

            {/* Filters */}
            <div className="px-5">
              <div role="tablist" aria-label="Filter activity" className="flex gap-0.5 overflow-x-auto rounded-[10px] border p-[3px] [scrollbar-width:none]" style={{ background: SURFACE, borderColor: BORDER }}>
                {TL_FILTER_CFG.map(f => {
                  const count = tlCounts[f.key]
                  const active = tlFilter === f.key
                  return (
                    <button key={f.key} type="button" role="tab" aria-selected={active} onClick={() => setTlFilter(f.key)}
                      className="flex h-8 flex-1 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-[13.5px] font-semibold transition-colors"
                      style={active
                        ? { background: CANVAS, color: TEXT, boxShadow: '0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)' }
                        : { background: 'transparent', color: SUBTLE }}>
                      {f.label}
                      {count > 0 && <span className="text-[12px] font-medium tabular-nums" style={{ color: active ? MUTED : LABEL }}>{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 px-5 pt-4">
              {/* Smart nudge */}
              {nudge && tlFilter === 'all' && (
                <div className="flex flex-wrap items-center gap-3 rounded-[12px] border p-3 sm:flex-nowrap" style={{ background: nudge.bg, borderColor: nudge.border }}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border bg-white" style={{ borderColor: nudge.border, color: nudge.color }}>
                    <nudge.icon size={18} weight="bold" />
                  </span>
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <div className="text-[14px] font-semibold" style={{ color: TEXT }}>{nudge.text}</div>
                    <div className="text-[13px] leading-snug" style={{ color: MUTED }}>{nudge.sub}</div>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <button type="button" onClick={nudge.onAction}
                      className="inline-flex h-9 cursor-pointer items-center rounded-[9px] px-3.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: nudge.color, boxShadow: XS }}>
                      {nudge.actionLabel}
                    </button>
                    <button type="button" onClick={() => setNudgeDismissed(true)} aria-label="Dismiss suggestion"
                      className="grid size-9 cursor-pointer place-items-center rounded-[9px] transition-colors hover:bg-black/5" style={{ color: SUBTLE }}>
                      <X size={15} weight="bold" />
                    </button>
                  </div>
                </div>
              )}

              {/* Call stats (calls filter) */}
              {tlFilter === 'calls' && (
                <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border sm:grid-cols-4" style={{ borderColor: BORDER }}>
                  {[
                    { label: 'Total',     value: callStats.total,      color: TEXT      },
                    { label: 'Connected', value: callStats.connected,  color: GREEN     },
                    { label: 'No answer', value: callStats.noResponse, color: '#B54708' },
                    { label: 'Missed',    value: callStats.missed,     color: RED       },
                  ].map((s, i) => (
                    <div key={s.label} className={`px-4 py-3 ${i % 2 === 0 ? 'border-r' : 'sm:border-r'} ${i < 2 ? 'border-b sm:border-b-0' : ''} ${i === 3 ? 'sm:border-r-0' : ''}`} style={{ borderColor: BORDER }}>
                      <div className="text-[12.5px] font-medium" style={{ color: SUBTLE }}>{s.label}</div>
                      <div className="mt-0.5 text-[24px] font-semibold leading-tight tabular-nums" style={{ color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Task form (tasks filter) */}
              {tlFilter === 'tasks' && showTaskForm && (
                <div className="rounded-[12px] border p-4" style={{ background: SURFACE, borderColor: BORDER }}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium" style={{ color: TEXT_2 }}>Task type</span>
                      <span className="relative block">
                        <select value={taskForm.task_type}
                          onChange={e => { const t = e.target.value; setTaskForm(f => ({ ...f, task_type: t, title: TYPE_DEFAULTS[t] ?? f.title })) }}
                          className={`${FIELD} h-10 cursor-pointer appearance-none pr-9`} style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS }}>
                          {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <CaretDown size={14} weight="bold" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" color={SUBTLE} />
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium" style={{ color: TEXT_2 }}>Title</span>
                      <input type="text" value={taskForm.title} placeholder="Task title…"
                        onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                        className={`${FIELD} h-10`} style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS }} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium" style={{ color: TEXT_2 }}>Due date</span>
                      <input type="date" value={taskForm.date} min={new Date().toISOString().slice(0, 10)}
                        onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))}
                        className={`${FIELD} h-10`} style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS, colorScheme: 'light' }} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium" style={{ color: TEXT_2 }}>Time</span>
                      <input type="time" value={taskForm.time}
                        onChange={e => setTaskForm(f => ({ ...f, time: e.target.value }))}
                        className={`${FIELD} h-10`} style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS, colorScheme: 'light' }} />
                    </label>
                  </div>
                  <div className="mt-3">
                    <span className="mb-1.5 block text-[13px] font-medium" style={{ color: TEXT_2 }}>Priority</span>
                    <div className="flex gap-1 rounded-[10px] border bg-white p-[3px]" style={{ borderColor: BORDER_2 }}>
                      {(['High', 'Medium', 'Low'] as const).map(p => {
                        const pc = PRIORITY_CFG[p]; const isAct = taskForm.priority === p
                        return (
                          <button key={p} type="button" onClick={() => setTaskForm(f => ({ ...f, priority: p }))} aria-pressed={isAct}
                            className="h-8 flex-1 cursor-pointer rounded-[7px] border text-[13px] font-semibold transition-colors"
                            style={isAct ? { color: pc.color, background: pc.bg, borderColor: pc.border } : { color: SUBTLE, background: 'transparent', borderColor: 'transparent' }}>
                            {p}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-[13px] font-medium" style={{ color: TEXT_2 }}>Notes <span className="font-normal" style={{ color: LABEL }}>(optional)</span></span>
                    <textarea rows={2} value={taskForm.notes} placeholder="Additional context…"
                      onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
                      className={`${FIELD} resize-y py-2.5 font-[inherit]`} style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS }} />
                  </label>
                  <div className="mt-4 flex justify-end gap-2">
                    <Btn onClick={() => setShowTaskForm(false)}>Cancel</Btn>
                    <button type="button" onClick={handleCreateTask} disabled={savingTask || !taskForm.title.trim() || !taskForm.date}
                      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#1A43BF] disabled:cursor-not-allowed disabled:bg-[#B2CCFF]"
                      style={{ background: !taskForm.title.trim() || !taskForm.date ? undefined : BLUE, boxShadow: XS }}>
                      {savingTask ? <CircleNotch size={15} weight="bold" className="animate-spin" /> : <Plus size={15} weight="bold" />}
                      {savingTask ? 'Saving…' : 'Add task'}
                    </button>
                  </div>
                </div>
              )}

              {/* Quick note (all / notes) */}
              {(tlFilter === 'all' || tlFilter === 'notes') && (
                <div className="rounded-[12px] border bg-white transition-[border-color,box-shadow] focus-within:border-[#84ADFF] focus-within:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]" style={{ borderColor: BORDER_2, boxShadow: XS }}>
                  <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} aria-label="Quick note"
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveQuickNote() }}
                    placeholder={`Add a note about ${lead.name.firstName}…`}
                    rows={quickNote ? 3 : 2}
                    className="block w-full resize-none border-0 bg-transparent px-3.5 pt-3 text-[14px] outline-none placeholder:text-[#98A2B3]"
                    style={{ color: TEXT, fontFamily: 'inherit' }} />
                  <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1">
                    <span className="hidden items-center gap-1 text-[12px] sm:inline-flex" style={{ color: LABEL }}>
                      <kbd className="rounded-[5px] border px-1.5 font-sans text-[11px]" style={{ borderColor: BORDER, background: SURFACE }}>⌘</kbd>
                      <kbd className="rounded-[5px] border px-1.5 font-sans text-[11px]" style={{ borderColor: BORDER, background: SURFACE }}>Enter</kbd>
                      to save
                    </span>
                    <button type="button" onClick={saveQuickNote} disabled={savingNote || !quickNote.trim()}
                      className="ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#1A43BF] disabled:cursor-not-allowed disabled:bg-[#D0D5DD]"
                      style={{ background: quickNote.trim() ? BLUE : undefined }}>
                      {savingNote ? <CircleNotch size={13} weight="bold" className="animate-spin" /> : <PaperPlaneTilt size={13} weight="bold" />}
                      Save note
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Feed */}
            <div className="px-5 pb-3 pt-5">
              {visibleTLItems.length === 0 ? (
                <div className="flex flex-col items-center px-5 pb-8 pt-4 text-center">
                  <div className="mb-3 grid size-12 place-items-center rounded-[12px] border" style={{ borderColor: BORDER, boxShadow: XS, color: TEXT_2 }}>
                    <Clock size={22} />
                  </div>
                  <p className="m-0 mb-1 text-[15px] font-semibold" style={{ color: TEXT }}>{tlFilter === 'tasks' ? 'No tasks yet' : 'No activity yet'}</p>
                  <p className="m-0 mb-4 max-w-[260px] text-[13.5px]" style={{ color: SUBTLE }}>
                    {tlFilter === 'tasks' ? 'Add a task to remind yourself of the next step' : 'Log a call, note, or WhatsApp to start the timeline'}
                  </p>
                  {tlFilter === 'tasks'
                    ? (!showTaskForm && <Btn onClick={() => { setShowTaskForm(true); setTaskForm(f => ({ ...f, title: TYPE_DEFAULTS['Follow Up'] })) }}><Plus size={16} weight="bold" />Add task</Btn>)
                    : <Btn onClick={() => setShowActivityModal(true)}><Plus size={16} weight="bold" />Log activity</Btn>}
                </div>
              ) : (
                tlGroups.map(group => (
                  <div key={group.label}>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>{group.label}</span>
                      <span className="h-px flex-1" style={{ background: BORDER }} />
                    </div>
                    <ol className="m-0 list-none p-0">
                      {group.items.map((item, i) => {
                        const last = i === group.items.length - 1
                        return item.kind === 'activity'
                          ? <ActivityTLRow key={item.data.id} act={item.data} advancedTo={statusMarkers.get(item.data.id)} last={last} />
                          : <TaskTLRow key={`task-${item.data.id}`} task={item.data} last={last} onUpdate={updateTask} />
                      })}
                    </ol>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* ── Right column ── */}
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-1">

            {/* Details */}
            <Card>
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
                <h2 className="m-0 text-[16px] font-semibold" style={{ color: TEXT }}>Details</h2>
                <div role="tablist" aria-label="Lead details" className="flex gap-0.5 rounded-[10px] border p-[3px]" style={{ background: SURFACE, borderColor: BORDER }}>
                  {(['info', 'requirements'] as LeftTab[]).map(tab => (
                    <button key={tab} type="button" role="tab" aria-selected={leftTab === tab} onClick={() => setLeftTab(tab)}
                      className="h-7 cursor-pointer rounded-[7px] px-2.5 text-[13px] font-semibold transition-colors"
                      style={leftTab === tab
                        ? { background: CANVAS, color: TEXT, boxShadow: '0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)' }
                        : { background: 'transparent', color: SUBTLE }}>
                      {tab === 'info' ? 'Lead info' : 'Requirements'}
                    </button>
                  ))}
                </div>
              </div>

              {leftTab === 'info' && (
                <dl className="m-0 px-5 pb-2">
                  {[
                    { icon: Envelope,      label: 'Email',  value: email || null, href: email ? `mailto:${email}` : undefined },
                    { icon: Phone,         label: 'Phone',  value: phone || null, href: phone ? `tel:${phone}` : undefined },
                    { icon: MapPin,        label: 'City',   value: lead.city },
                    { icon: Tag,           label: 'Source', value: lead.sourcePortal ? sourceMeta(lead.sourcePortal).label : null, logo: lead.sourcePortal },
                    { icon: CalendarBlank, label: 'Added',  value: formatDate(lead.createdAt) },
                  ].map(row => {
                    const RowIcon = row.icon
                    return (
                      <div key={row.label} className="flex items-start justify-between gap-4 border-t py-3" style={{ borderColor: BORDER }}>
                        <dt className="flex shrink-0 items-center gap-2 text-[13.5px]" style={{ color: SUBTLE }}>
                          <RowIcon size={16} />{row.label}
                        </dt>
                        <dd className="m-0 min-w-0 text-right text-[14px] font-medium" style={{ color: row.value ? TEXT_2 : LABEL }}>
                          {row.href
                            ? <a href={row.href} className="break-all no-underline hover:underline" style={{ color: BLUE }}>{row.value}</a>
                            : row.logo
                              ? <span className="inline-flex items-center gap-1.5"><SourceMark raw={row.logo} size={18} />{row.value}</span>
                              : row.value || '—'}
                        </dd>
                      </div>
                    )
                  })}
                  {lead.localities && lead.localities.length > 0 && (
                    <div className="border-t py-3" style={{ borderColor: BORDER }}>
                      <dt className="mb-2 flex items-center gap-2 text-[13.5px]" style={{ color: SUBTLE }}><MapPin size={16} />Localities</dt>
                      <dd className="m-0 flex flex-wrap gap-1.5">
                        {lead.localities.map(l => <Chip key={l} color={BLUE} bg={BLUE_BG} border={BLUE_LN}>{l}</Chip>)}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {leftTab === 'requirements' && (
                <div className="px-5 pb-4">
                  <div className="rounded-[12px] border px-4 py-3.5" style={{ background: SURFACE, borderColor: BORDER }}>
                    <div className="text-[13px] font-medium" style={{ color: SUBTLE }}>Budget</div>
                    <div className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] tabular-nums" style={{ color: budgetSet ? TEXT : LABEL }}>
                      {formatBudget(lead.budgetMin, lead.budgetMax)}
                    </div>
                  </div>
                  <dl className="m-0 mt-2">
                    <div className="flex items-start justify-between gap-4 py-3">
                      <dt className="text-[13.5px]" style={{ color: SUBTLE }}>Property assigned</dt>
                      <dd className="m-0 flex flex-wrap justify-end gap-1.5">
                        {lead.propertyType && lead.propertyType.length > 0
                          ? lead.propertyType.map(pt => <Chip key={pt} color={BLUE} bg={BLUE_BG} border={BLUE_LN}><House size={12} />{pt}</Chip>)
                          : <span className="text-[14px]" style={{ color: LABEL }}>—</span>}
                      </dd>
                    </div>
                    {[{ label: 'Timeline', value: lead.timeline }, { label: 'Status', value: lead.status }].map(r => (
                      <div key={r.label} className="flex items-center justify-between gap-4 border-t py-3" style={{ borderColor: BORDER }}>
                        <dt className="text-[13.5px]" style={{ color: SUBTLE }}>{r.label}</dt>
                        <dd className="m-0 text-[14px] font-medium" style={{ color: r.value ? TEXT_2 : LABEL }}>
                          {r.label === 'Status' && r.value ? <StatusPill status={r.value} /> : r.value || '—'}
                        </dd>
                      </div>
                    ))}
                    {lead.localities && lead.localities.length > 0 && (
                      <div className="border-t py-3" style={{ borderColor: BORDER }}>
                        <dt className="mb-2 text-[13.5px]" style={{ color: SUBTLE }}>Preferred areas</dt>
                        <dd className="m-0 flex flex-wrap gap-1.5">
                          {lead.localities.map(l => <Chip key={l} color={BLUE} bg={BLUE_BG} border={BLUE_LN}>{l}</Chip>)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </Card>

            {/* Intent signals */}
            <Card>
              <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
                <h2 className="m-0 text-[16px] font-semibold" style={{ color: TEXT }}>Intent signals</h2>
                <span className="text-[13px] font-medium tabular-nums" style={{ color: SUBTLE }}>{strongSignals}/{bdown.length} strong</span>
              </div>
              <ul className="m-0 list-none px-5 pb-3 pt-2">
                {bdown.map(b => (
                  <li key={b.label} className="flex items-center gap-3 py-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border"
                      style={b.pos ? { background: '#ECFDF3', borderColor: '#ABEFC6', color: GREEN } : { background: SURFACE, borderColor: BORDER, color: LABEL }}>
                      {b.pos ? <Check size={12} weight="bold" /> : <X size={11} weight="bold" />}
                    </span>
                    <span className="text-[14px]" style={{ color: TEXT_2 }}>{b.label}</span>
                    <span className="ml-auto truncate text-right text-[13.5px] font-medium" style={{ color: b.pos ? TEXT_2 : LABEL }}>{b.value}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* <PropertyMatcher … /> — frozen until own inventory is wired */}
            {/* <FollowUpWriter … /> — frozen until inventory + AI config is ready */}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <LogActivityModal
        leadId={leadId}
        leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()}
        leadEmail={lead.emails.primaryEmail || undefined}
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        currentStatus={lead.status ?? 'New'}
        failedContactAttempts={lead.failedContactAttempts ?? 0}
        existingActivityTypes={activities.map(a => a.type)}
        onActivityLogged={(result) => {
          setShowActivityModal(false)
          if (result?.statusAdvancedTo) setLead(p => p ? { ...p, status: result.statusAdvancedTo! } : p)
          fetchLead(); fetchTasks()
        }}
      />
      <WhatsAppModal isOpen={showWhatsAppModal} onClose={() => { setShowWhatsAppModal(false); fetchLead() }} leadId={leadId} leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()} leadPhone={lead.phones.primaryPhoneNumber ?? ''} city={lead.city ?? ''} />
      <CallModal isOpen={showCallModal} onClose={() => setShowCallModal(false)} leadId={leadId} leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()} leadPhone={lead.phones.primaryPhoneNumber ?? ''} onLogged={fetchLead} />
      <ReassignModal
        isOpen={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        leadId={leadId}
        leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()}
        onReassigned={agentName => { setAssignedTo(agentName); setShowReassignModal(false) }}
      />
      <EnrollSequenceModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        leadId={leadId}
        leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()}
        leadPhone={lead.phones.primaryPhoneNumber ?? ''}
        onEnrolled={() => toast.success('Lead enrolled in sequence')}
      />

      {/* ── Email Compose Modal ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(16,24,40,0.55)' }}
          onClick={e => e.target === e.currentTarget && !sendingEmail && setShowEmailModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="New email" className="w-full max-w-[540px] overflow-hidden rounded-[16px] bg-white shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)]">
            <div className="flex items-start justify-between gap-3 border-b px-6 pb-4 pt-5" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-[10px] border" style={{ borderColor: BORDER, color: BLUE, boxShadow: XS }}>
                  <Envelope size={18} weight="bold" />
                </span>
                <div>
                  <div className="text-[16px] font-semibold" style={{ color: TEXT }}>New email</div>
                  <div className="text-[13px]" style={{ color: SUBTLE }}>To: {name} &lt;{email}&gt;</div>
                </div>
              </div>
              <button type="button" onClick={() => !sendingEmail && setShowEmailModal(false)} aria-label="Close"
                className="grid size-9 cursor-pointer place-items-center rounded-[8px] transition-colors hover:bg-[#F9FAFB]" style={{ color: SUBTLE }}>
                <X size={18} weight="bold" />
              </button>
            </div>

            {emailSent ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto mb-3.5 grid size-14 place-items-center rounded-full" style={{ background: '#ECFDF3', color: GREEN }}>
                  <CheckCircle size={28} weight="fill" />
                </div>
                <div className="mb-1 text-[16px] font-semibold" style={{ color: TEXT }}>Email sent!</div>
                <div className="text-[14px]" style={{ color: SUBTLE }}>Activity logged on this lead&apos;s timeline.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium" style={{ color: TEXT_2 }}>Subject</span>
                  <input value={emailForm.subject}
                    onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. Following up on your enquiry"
                    className={`${FIELD} h-10`} style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS }} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium" style={{ color: TEXT_2 }}>Message</span>
                  <textarea value={emailForm.body}
                    onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
                    placeholder={`Hi ${lead.name.firstName},\n\nThank you for your interest in…`}
                    rows={8}
                    className={`${FIELD} resize-y py-2.5 leading-[1.6]`} style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS, fontFamily: 'inherit' }} />
                </label>

                {emailError && (
                  <div className="flex items-center gap-2 rounded-[10px] border px-3 py-2.5" style={{ background: '#FEF3F2', borderColor: '#FECDCA' }}>
                    <Warning size={15} weight="bold" color={RED} className="shrink-0" />
                    <span className="text-[13px]" style={{ color: RED }}>{emailError}</span>
                  </div>
                )}

                <div className="mt-1 flex gap-3">
                  <Btn onClick={() => setShowEmailModal(false)} className="flex-1">Cancel</Btn>
                  <button type="button" onClick={handleSendEmail} disabled={sendingEmail || !emailForm.subject.trim() || !emailForm.body.trim()}
                    className="inline-flex h-10 flex-[2] cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold text-white transition-[background-color,opacity] hover:bg-[#1A43BF] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: BLUE, boxShadow: XS }}>
                    {sendingEmail
                      ? <><CircleNotch size={15} weight="bold" className="animate-spin" /> Sending…</>
                      : <><PaperPlaneTilt size={15} weight="bold" /> Send email</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(16,24,40,0.6)' }}
          onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
          <div role="dialog" aria-modal="true" aria-label="Delete lead" className="w-full max-w-[400px] rounded-[16px] bg-white p-6 text-center shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)]">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full" style={{ background: '#FEE4E2', color: RED }}>
              <Trash size={22} weight="bold" />
            </div>
            <h3 className="m-0 mb-2 text-[18px] font-semibold" style={{ color: TEXT }}>Delete lead?</h3>
            <p className="m-0 mb-6 text-[14px]" style={{ color: SUBTLE }}>Permanently delete <strong style={{ color: TEXT }}>{name}</strong> and all activity history.</p>
            <div className="flex gap-3">
              <Btn onClick={() => setShowDeleteConfirm(false)} className="flex-1">Cancel</Btn>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: '#D92D20', boxShadow: XS }}>
                {deleting ? <CircleNotch size={15} weight="bold" className="animate-spin" /> : null}
                {deleting ? 'Deleting…' : 'Delete lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
