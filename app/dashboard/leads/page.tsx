'use client'

import { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type CRMLead } from '@/lib/twenty'
import { AddLeadModal } from '@/components/AddLeadModal'
import { CsvUploadModal } from '@/components/crm/CsvUploadModal'
import { EmailParserModal } from '@/components/crm/EmailParserModal'
import { DistributeModal } from '@/components/crm/DistributeModal'
import { LogActivityModal } from '@/components/LogActivityModal'
import { PageTabBar } from '@/components/layout/PageTabBar'
import {
  MagnifyingGlass, Plus, CircleNotch, UserPlus, Clock, CaretDown, SquaresFour, ListBullets,
  CloudArrowUp, EnvelopeSimple, Copy, Pulse, Shuffle, House, UsersThree, Sparkle, Fire, Handshake,
  ArrowUp, ArrowDown, CaretLeft, CaretRight, ArrowsDownUp, Check, ArrowUpRight, X, Funnel,
  CalendarBlank, DownloadSimple, Globe, FacebookLogo, GoogleLogo, Megaphone,
} from '@phosphor-icons/react'

const LEADS_TABS = [
  { label: 'All Leads', href: '/dashboard/leads', exact: true },
  { label: 'Pipeline',  href: '/dashboard/lifecycle' },
]

// ─── Design tokens ────────────────────────────────────────────────────────────
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
const XS       = '0 1px 2px rgba(16,24,40,0.05)'
const MONO     = 'ui-monospace, SFMono-Regular, Menlo, monospace'

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

// Demo photos, CS ID → public image path (same map as the lead detail page)
const AVATAR_MAP: Record<string, string> = {
  'CS01689': '/avatars/adi.png',
}

// Status pill — outlined and tinted, like the reference
const STATUS_PILL: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  New:          { color: '#344054', bg: '#F9FAFB', border: '#D0D5DD', dot: '#98A2B3' },
  Cold:         { color: '#026AA2', bg: '#F0F9FF', border: '#B9E6FE', dot: '#0BA5EC' },
  Warm:         { color: '#B54708', bg: '#FFFAEB', border: '#FEDF89', dot: '#F79009' },
  Hot:          { color: '#C4320A', bg: '#FFF6ED', border: '#F9DBAF', dot: '#EF6820' },
  Closed:       { color: '#067647', bg: '#ECFDF3', border: '#ABEFC6', dot: '#17B26A' },
  Disqualified: { color: '#C01048', bg: '#FFF1F3', border: '#FECDD6', dot: '#F63D68' },
}
const STATUS_ORDER = ['New', 'Cold', 'Warm', 'Hot', 'Closed', 'Disqualified']

// ─── Helpers ──────────────────────────────────────────────────────────────────
type ScoreFilter = 'all' | 'hot' | 'warm' | 'cold'
const FILTER_LABELS: Record<ScoreFilter, string> = {
  all: 'All Leads', hot: 'Hot (70+)', warm: 'Warm (40–69)', cold: 'Cold (<40)',
}

type SortBy = 'score' | 'newest' | 'oldest' | 'budget_high' | 'budget_low' | 'name'
const SORT_LABELS: Record<SortBy, string> = {
  score:       'Intent Score',
  newest:      'Newest First',
  oldest:      'Oldest First',
  budget_high: 'Budget: High → Low',
  budget_low:  'Budget: Low → High',
  name:        'Name A–Z',
}

type DateRange = 'all' | '7d' | '30d' | 'month' | '90d'
const DATE_LABELS: Record<DateRange, string> = {
  all: 'All time', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', '90d': 'Last 3 months',
}
function inRange(iso: string, range: DateRange, now: number) {
  if (range === 'all') return true
  const t = new Date(iso).getTime()
  if (range === 'month') { const d = new Date(now); return t >= new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  return t >= now - days * 86_400_000
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100]

// Table columns appear as the leads card gets wider (container queries, so a collapsed sidebar shows more)
const COL = {
  sel:     'hidden @md:table-cell',
  phone:   'hidden @3xl:table-cell',
  source:  'hidden @4xl:table-cell',
  intent:  'hidden @min-[940px]:table-cell',
  budget:  'hidden @min-[1060px]:table-cell',
  created: 'hidden @6xl:table-cell',
  prop:    'hidden @min-[1400px]:table-cell',
  act:     'hidden @md:table-cell',
}
const WEEK_MS = 7 * 86_400_000

const getDisplayName = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getInitials    = (l: CRMLead) => ((l.name.firstName?.[0] ?? '') + (l.name.lastName?.[0] ?? '')).toUpperCase() || '?'
const getPhone       = (l: CRMLead) => l.phones.primaryPhoneNumber ?? ''
const getEmail       = (l: CRMLead) => l.emails.primaryEmail ?? null

// Stable CS ID: real one if assigned, else derived from UUID so legacy leads always show one
function getCsId(lead: CRMLead): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
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
  const fmt = (n: number) =>
    n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(1)}Cr` : `${+(n / 100_000).toFixed(1)}L`
  if (min && max) return `₹${fmt(min)}–${fmt(max)}`
  if (min) return `₹${fmt(min)}+`
  if (max) return `Up to ₹${fmt(max)}`
  return '—'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'Just now'
}

function scoreTone(score: number) {
  if (score >= 70) return { bg: BLUE, fg: '#FFFFFF', label: 'High intent' }
  if (score >= 40) return { bg: '#F79009', fg: '#FFFFFF', label: 'Medium intent' }
  return { bg: '#E4E7EC', fg: MUTED, label: 'Low intent' }
}

function csvCell(v: string | number | null | undefined) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

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

/** Split button, like the reference's "Sort | ⌄" and "Filter | ⌄". */
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

function TrendPill({ tone, children }: { tone: 'up' | 'down' | 'flat'; children: ReactNode }) {
  const s = tone === 'up'
    ? { color: '#067647', background: '#ECFDF3', borderColor: '#ABEFC6' }
    : tone === 'down'
      ? { color: '#B42318', background: '#FEF3F2', borderColor: '#FECDCA' }
      : { color: TEXT_2, background: SURFACE, borderColor: BORDER }
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 text-[12px] font-semibold tabular-nums" style={s}>
      {tone === 'up' && <ArrowUp size={11} weight="bold" />}
      {tone === 'down' && <ArrowDown size={11} weight="bold" />}
      {children}
    </span>
  )
}

/** 14 daily bars, oldest → today. Today's bar is solid, the rest tinted. */
function Sparkbars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data)
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {data.map((v, i) => (
        <span key={i} className="min-w-0 flex-1 rounded-[3px]"
          style={{ height: v ? `${Math.max(14, Math.round((v / max) * 100))}%` : 3, background: color, opacity: i === data.length - 1 ? 1 : v ? 0.3 : 0.12 }} />
      ))}
    </div>
  )
}

function StatCard({ icon, title, value, pill, sub, bars, accent, active, loading, onClick, period = '14 days' }: {
  icon: ReactNode; title: string; value: number; pill?: ReactNode; sub: ReactNode; bars: number[]; accent: string
  active: boolean; loading: boolean; onClick: () => void; period?: string
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className="group cursor-pointer rounded-[18px] border p-1.5 text-left transition-[box-shadow,border-color,transform] hover:-translate-y-px"
      style={{
        background: SURFACE,
        borderColor: active ? BLUE_LN : BORDER,
        boxShadow: active ? '0 0 0 4px rgba(29,78,216,0.10)' : XS,
      }}>
      <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-1.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] border bg-white"
          style={{ borderColor: BORDER, color: accent, boxShadow: XS }}>
          {icon}
        </span>
        <span className="truncate text-[14px] font-semibold" style={{ color: TEXT_2 }}>{title}</span>
        <span className="ml-auto hidden text-[12px] font-medium sm:inline" style={{ color: LABEL }}>{period}</span>
      </div>
      <div className="rounded-[13px] border bg-white px-4 pb-3.5 pt-4" style={{ borderColor: BORDER, boxShadow: XS }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            {loading
              ? <span className="block h-9 w-16 animate-pulse rounded-[8px] bg-[#F2F4F7]" />
              : <span className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[38px]" style={{ color: TEXT }}>{value.toLocaleString('en-IN')}</span>}
            <span className="text-[14px]" style={{ color: SUBTLE }}>leads</span>
          </div>
          {!loading && pill}
        </div>
        <div className="mt-4 hidden sm:block">
          {loading ? <span className="block h-8 animate-pulse rounded-[6px] bg-[#F9FAFB]" /> : <Sparkbars data={bars} color={accent} />}
        </div>
        <div className="mt-3 truncate text-[13px]" style={{ color: SUBTLE }}>{loading ? '\u00a0' : sub}</div>
      </div>
    </button>
  )
}

function IntentMeter({ score }: { score: number | null }) {
  if (score == null) return <span className="text-[14px]" style={{ color: LABEL }}>—</span>
  const color = score >= 70 ? BLUE : score >= 40 ? '#F79009' : '#98A2B3'
  return (
    <span className="inline-flex items-center gap-2.5" title={scoreTone(score).label}>
      <span className="w-6 text-right text-[14px] font-semibold tabular-nums" style={{ color: TEXT }}>{score}</span>
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full" style={{ background: '#F2F4F7' }}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, score)}%`, background: color }} />
      </span>
    </span>
  )
}

function LeadAvatar({ lead, size = 40, badge = false }: { lead: CRMLead; size?: number; badge?: boolean }) {
  const name = getDisplayName(lead)
  const av = avatarColor(name)
  const photo = AVATAR_MAP[getCsId(lead)]
  const score = lead.intentScore ?? 0
  const tone = scoreTone(score)
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="size-full rounded-full object-cover" style={{ boxShadow: '0 0 0 2px #fff, 0 0 0 3px #EAECF0' }} />
      ) : (
        <span className="grid size-full place-items-center rounded-full text-[14px] font-semibold"
          style={{ background: `linear-gradient(140deg, ${av.from} 0%, ${av.to} 100%)`, color: av.fg, boxShadow: '0 0 0 2px #fff, 0 0 0 3px #EAECF0' }}>
          {getInitials(lead)}
        </span>
      )}
      {badge && lead.intentScore != null && (
        <span title={`Intent score ${score} · ${tone.label}`}
          className="absolute -bottom-1 -right-1.5 grid h-[17px] min-w-[21px] place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums"
          style={{ background: tone.bg, color: tone.fg, boxShadow: '0 0 0 2px #fff' }}>
          {score}
        </span>
      )}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const p = STATUS_PILL[status] ?? STATUS_PILL.New
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[13px] font-medium"
      style={{ background: p.bg, borderColor: p.border, color: p.color }}>
      <span className="size-1.5 rounded-full" style={{ background: p.dot }} />
      {status}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [totalCount, setTotalCount] = useState(0)
  // Unfiltered snapshot, so the stat cards and tab counts don't change while you filter
  const [baseLeads, setBaseLeads] = useState<CRMLead[]>([])
  const [baseTotal, setBaseTotal] = useState(0)
  const [loadedAt, setLoadedAt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showDistributeModal, setShowDistributeModal] = useState(false)
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [quickLogLeadId, setQuickLogLeadId] = useState<string | null>(null)
  const [showDupsOnly, setShowDupsOnly] = useState(false)
  const [importStatus, setImportStatus] = useState<{ total: number; done: number; label: string } | null>(null)
  const [sortBy, setSortBy]             = useState<SortBy>('score')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showStuck, setShowStuck]       = useState(false)
  const [dateRange, setDateRange]       = useState<DateRange>('all')
  const [openMenu, setOpenMenu]         = useState<null | 'sort' | 'filter' | 'date' | 'perPage'>(null)
  const [page, setPage]                 = useState(0)
  const [perPage, setPerPage]           = useState(10)
  const [copiedId, setCopiedId]         = useState<string | null>(null)
  const [selected, setSelected]         = useState<Set<string>>(() => new Set())
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const menu = (key: 'sort' | 'filter' | 'date' | 'perPage') => ({
    open: openMenu === key,
    onOpenChange: (o: boolean) => setOpenMenu(o ? key : null),
    toggle: () => setOpenMenu(m => (m === key ? null : key)),
  })
  const sortMenu = menu('sort'), filterMenu = menu('filter'), dateMenu = menu('date'), perPageMenu = menu('perPage')

  // De-dup detection — group leads by normalised phone number
  const dupPhones = useMemo(() => {
    const phoneMap: Record<string, string[]> = {}
    for (const l of leads) {
      const ph = (l.phones.primaryPhoneNumber ?? '').replace(/\D/g, '')
      if (!ph || ph.length < 8) continue
      const key = ph.replace(/^(91|0)/, '')
      if (!phoneMap[key]) phoneMap[key] = []
      phoneMap[key].push(l.id)
    }
    return Object.values(phoneMap).filter(ids => ids.length > 1)
  }, [leads])

  const dupLeadIds = useMemo(() => new Set(dupPhones.flat()), [dupPhones])

  const displayLeads = useMemo(
    () => showDupsOnly ? leads.filter(l => dupLeadIds.has(l.id)) : leads,
    [leads, showDupsOnly, dupLeadIds]
  )

  // Unique sources for the filter
  const uniqueSources = useMemo(() => {
    const s = new Set(baseLeads.concat(leads).map(l => l.sourcePortal).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [baseLeads, leads])

  // Client-side source / stuck / date filters + sort
  const filteredSortedLeads = useMemo(() => {
    const STUCK_DAYS = 7
    const now = Date.now()
    let list = [...displayLeads]
    if (sourceFilter !== 'all') list = list.filter(l => l.sourcePortal === sourceFilter)
    if (showStuck) {
      const cutoff = now - STUCK_DAYS * 86_400_000
      list = list.filter(l => !['Closed', 'Disqualified'].includes(l.status ?? '') && new Date(l.updatedAt ?? l.createdAt).getTime() < cutoff)
    }
    if (dateRange !== 'all') list = list.filter(l => inRange(l.createdAt, dateRange, now))
    list.sort((a, b) => {
      switch (sortBy) {
        case 'score':       return (b.intentScore ?? 0) - (a.intentScore ?? 0)
        case 'newest':      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'budget_high': return (b.budgetMax ?? b.budgetMin ?? 0) - (a.budgetMax ?? a.budgetMin ?? 0)
        case 'budget_low':  return (a.budgetMin ?? a.budgetMax ?? 0) - (b.budgetMin ?? b.budgetMax ?? 0)
        case 'name':        return getDisplayName(a).localeCompare(getDisplayName(b))
        default:            return 0
      }
    })
    return list
  }, [displayLeads, sourceFilter, showStuck, dateRange, sortBy])

  // Stat cards + tab counts, from the unfiltered snapshot (scoped by the date range)
  const stats = useMemo(() => {
    const scoped = dateRange === 'all' ? baseLeads : baseLeads.filter(l => inRange(l.createdAt, dateRange, loadedAt))
    const byStatus: Record<string, number> = {}
    const week: Record<string, [number, number]> = {}
    const days: Record<string, number[]> = {}

    // Adaptive bucket: span from the oldest lead to today across 14 bars.
    // Falls back to 1-day buckets if all leads are within the last 14 days.
    const tMin = scoped.length
      ? Math.min(...scoped.map(l => new Date(l.createdAt).getTime()))
      : loadedAt - 14 * 86_400_000
    const totalSpan = Math.max(loadedAt - tMin, 14 * 86_400_000)
    const bucketMs = Math.ceil(totalSpan / 14)
    // Human-readable label for the period the bars cover
    const spanDays = Math.ceil(totalSpan / 86_400_000)
    const sparkPeriod = spanDays <= 14 ? '14 days'
      : spanDays <= 60  ? `${Math.ceil(spanDays / 7)} wks`
      : spanDays <= 180 ? `${Math.ceil(spanDays / 30)} mo`
      : '1 yr+'

    for (const l of scoped) {
      const s = l.status ?? 'New'
      byStatus[s] = (byStatus[s] ?? 0) + 1
      for (const k of ['all', s]) {
        // Closed counts from the last update (when it closed); everything else from when it came in
        const at = k === 'Closed' ? (l.updatedAt ?? l.createdAt) : l.createdAt
        const age = loadedAt - new Date(at).getTime()
        if (!week[k]) week[k] = [0, 0]
        if (!days[k]) days[k] = Array(14).fill(0)
        if (age < WEEK_MS) week[k][0]++
        else if (age < 2 * WEEK_MS) week[k][1]++
        const d = Math.floor(age / bucketMs)
        if (d >= 0 && d < 14) days[k][13 - d]++
      }
    }
    const bars = (k: string) => days[k] ?? Array(14).fill(0)
    const total = dateRange === 'all' ? baseTotal : scoped.length
    const share = (n: number) => (scoped.length ? Math.round((n / scoped.length) * 100) : 0)
    const trend = (k: string) => {
      const [now, prev] = week[k] ?? [0, 0]
      return { diff: now - prev, pct: prev > 0 ? Math.round(((now - prev) / prev) * 100) : null }
    }
    return { byStatus, total, share, trend, bars, sparkPeriod }
  }, [baseLeads, baseTotal, loadedAt, dateRange])

  // Pagination (client-side, over the loaded leads)
  const pageCount = Math.max(1, Math.ceil(filteredSortedLeads.length / perPage))
  const curPage   = Math.min(page, pageCount - 1)
  const pageStart = curPage * perPage
  const pageLeads = filteredSortedLeads.slice(pageStart, pageStart + perPage)

  const fetchUnassigned = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/leads/distribute')
      const json = await res.json()
      setUnassignedCount(json.unassigned ?? 0)
    } catch { /* non-critical */ }
  }, [])

  const fetchLeads = useCallback(async (q?: string, score?: ScoreFilter, status?: string) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '200' })
      if (q) params.set('search', q)
      if (score && score !== 'all') params.set('score', score)
      if (status && status !== 'all') params.set('status', status)
      const res = await fetch(`/api/crm/leads?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const list: CRMLead[] = json.data.leads ?? []
      const total: number = json.data.totalCount ?? 0
      setLeads(list)
      setTotalCount(total)
      if (!q && (!score || score === 'all') && (!status || status === 'all')) {
        setBaseLeads(list)
        setBaseTotal(total)
        setLoadedAt(Date.now())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLeads(); fetchUnassigned() }, [fetchLeads, fetchUnassigned])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(0)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchLeads(val, scoreFilter, statusFilter), 300)
  }

  const handleScoreFilter = (s: ScoreFilter) => {
    setScoreFilter(s)
    setPage(0)
    fetchLeads(search, s, statusFilter)
  }

  const handleStatusFilter = (s: string) => {
    setStatusFilter(s)
    setPage(0)
    fetchLeads(search, scoreFilter, s)
  }

  const clearFilters = () => {
    setSourceFilter('all'); setShowStuck(false); setShowDupsOnly(false); setDateRange('all'); setPage(0)
    if (scoreFilter !== 'all') handleScoreFilter('all')
  }

  const handleCsvImport = async (result: { inserted: number; skipped: number; merged: number; failed: number; batchId: string | null; message: string }) => {
    setShowCsvModal(false)
    setImportStatus({ total: result.inserted + result.skipped + result.merged + result.failed, done: result.inserted + result.skipped + result.merged + result.failed, label: result.message })
    await fetchLeads()
    fetchUnassigned()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => setImportStatus(null), 6000)
  }

  const copyCsId = (lead: CRMLead) => {
    navigator.clipboard.writeText(getCsId(lead)).catch(() => {})
    setCopiedId(lead.id)
    setTimeout(() => setCopiedId(c => (c === lead.id ? null : c)), 1400)
  }

  const exportCsv = (list: CRMLead[] = filteredSortedLeads) => {
    const head = ['CS ID', 'Name', 'Email', 'Phone', 'Source', 'Status', 'Intent Score', 'Budget Min', 'Budget Max', 'Property Type', 'City', 'Created']
    const rows = list.map(l => [
      getCsId(l), getDisplayName(l), getEmail(l), getPhone(l), l.sourcePortal ? sourceMeta(l.sourcePortal).label : '',
      l.status ?? 'New', l.intentScore, l.budgetMin, l.budgetMax, (l.propertyType ?? []).join(' / '), l.city, l.createdAt.slice(0, 10),
    ])
    const csv = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const firstLoad = loading && baseLeads.length === 0
  const filterCount = (scoreFilter !== 'all' ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0) + (showStuck ? 1 : 0) + (showDupsOnly ? 1 : 0)

  const trendPill = (k: string) => {
    const t = stats.trend(k)
    if (t.pct === null) return t.diff > 0 ? <TrendPill tone="up">{t.diff} new</TrendPill> : <TrendPill tone="flat">0%</TrendPill>
    return <TrendPill tone={t.pct > 0 ? 'up' : t.pct < 0 ? 'down' : 'flat'}>{Math.abs(t.pct)}%</TrendPill>
  }
  const statCards = [
    { key: 'all', title: 'Total Leads', icon: <UsersThree size={16} weight="bold" />, accent: BLUE, value: stats.total, pill: trendPill('all'),
      sub: <><span style={{ color: TEXT_2, fontWeight: 600 }}>{stats.trend('all').diff >= 0 ? '+' : ''}{stats.trend('all').diff}</span> vs last week</> },
    { key: 'New', title: 'New Leads', icon: <Sparkle size={16} weight="bold" />, accent: '#0BA5EC', value: stats.byStatus.New ?? 0, pill: trendPill('New'),
      sub: <>{stats.share(stats.byStatus.New ?? 0)}% not contacted yet</> },
    { key: 'Hot', title: 'Hot Leads', icon: <Fire size={16} weight="bold" />, accent: '#EF6820', value: stats.byStatus.Hot ?? 0, pill: trendPill('Hot'),
      sub: <>{stats.share(stats.byStatus.Hot ?? 0)}% of all leads</> },
    { key: 'Closed', title: 'Closed Deals', icon: <Handshake size={16} weight="bold" />, accent: '#17B26A', value: stats.byStatus.Closed ?? 0, pill: trendPill('Closed'),
      sub: <>{stats.share(stats.byStatus.Closed ?? 0)}% conversion</> },
  ]

  const pageAllSelected = pageLeads.length > 0 && pageLeads.every(l => selected.has(l.id))
  const toggleRow = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const togglePage = () => setSelected(prev => {
    const next = new Set(prev)
    for (const l of pageLeads) { if (pageAllSelected) next.delete(l.id); else next.add(l.id) }
    return next
  })
  const selectedLeads = leads.filter(l => selected.has(l.id))

  const chips: { key: string; label: string; clear: () => void }[] = []
  if (scoreFilter !== 'all') chips.push({ key: 'score', label: `Intent: ${FILTER_LABELS[scoreFilter]}`, clear: () => handleScoreFilter('all') })
  if (sourceFilter !== 'all') chips.push({ key: 'source', label: `Source: ${sourceMeta(sourceFilter).label}`, clear: () => { setSourceFilter('all'); setPage(0) } })
  if (showStuck) chips.push({ key: 'stuck', label: 'Stuck 7d+', clear: () => { setShowStuck(false); setPage(0) } })
  if (showDupsOnly) chips.push({ key: 'dups', label: 'Duplicates only', clear: () => { setShowDupsOnly(false); setPage(0) } })
  if (dateRange !== 'all') chips.push({ key: 'date', label: `Created: ${DATE_LABELS[dateRange]}`, clear: () => { setDateRange('all'); setPage(0) } })

  return (
    <div style={{ minHeight: '100vh', background: CANVAS }}>
      <PageTabBar tabs={LEADS_TABS} />

      {/* Import toast */}
      {importStatus && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[200] flex min-w-[280px] -translate-x-1/2 items-center gap-3 rounded-[12px] bg-[#101828] px-5 py-3 text-white shadow-[0_20px_24px_-4px_rgba(16,24,40,0.18)]">
          {importStatus.done < importStatus.total
            ? <CircleNotch size={16} weight="bold" className="shrink-0 animate-spin text-[#84ADFF]" />
            : <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#17B26A]"><Check size={11} weight="bold" /></span>}
          <span className="text-[14px] font-medium">{importStatus.label}</span>
        </div>
      )}

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
            <h1 className="m-0 text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px]" style={{ color: TEXT }}>Leads</h1>
            {!firstLoad && (
              <span className="rounded-full border px-2.5 py-0.5 text-[13px] font-semibold tabular-nums" style={{ background: BLUE_BG, borderColor: BLUE_LN, color: BLUE }}>
                {totalCount.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <p className="m-0 mt-1 text-[15px]" style={{ color: SUBTLE }}>Every enquiry from every portal, ranked by intent.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Btn onClick={() => setShowEmailModal(true)} label="Parse Email"><EnvelopeSimple size={18} /><span className="hidden xl:inline">Parse Email</span></Btn>
          <Btn onClick={() => setShowCsvModal(true)} label="Import CSV"><CloudArrowUp size={18} /><span className="hidden xl:inline">Import CSV</span></Btn>
          {unassignedCount > 0 && (
            <Btn onClick={() => setShowDistributeModal(true)} label={`Distribute ${unassignedCount} unassigned leads`} active>
              <Shuffle size={18} /><span className="hidden xl:inline">Distribute</span>
              <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: BLUE }}>{unassignedCount}</span>
            </Btn>
          )}
          <button type="button" onClick={() => setShowAddModal(true)}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#1A43BF]"
            style={{ background: BLUE, borderColor: BLUE, boxShadow: `${XS}, inset 0 1px 0 rgba(255,255,255,0.18)` }}>
            <Plus size={18} weight="bold" />Create lead
          </button>
        </div>
      </div>

      {/* ── Action bar: status segments + date scope + view ── */}
      <div className="border-y" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:flex-nowrap lg:px-8">
          <div role="tablist" aria-label="Lead status" className="-mx-1 flex min-w-0 max-w-full gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
            {['all', ...STATUS_ORDER].map(id => {
              const active = statusFilter === id
              const count = id === 'all' ? stats.total : (stats.byStatus[id] ?? 0)
              return (
                <button key={id} type="button" role="tab" aria-selected={active} onClick={() => handleStatusFilter(id)}
                  className="flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[8px] border px-2.5 text-[14px] font-semibold transition-colors hover:bg-[#F9FAFB] xl:px-3"
                  style={active
                    ? { background: CANVAS, borderColor: BORDER_2, color: TEXT, boxShadow: XS }
                    : { background: 'transparent', borderColor: 'transparent', color: SUBTLE }}>
                  {id !== 'all' && <span className="size-2 rounded-full" style={{ background: STATUS_PILL[id].dot }} />}
                  {id === 'all' ? 'All leads' : id}
                  {!firstLoad && (
                    <span className="rounded-full px-1.5 text-[12px] font-medium tabular-nums" style={{ background: active ? '#F2F4F7' : 'transparent', color: active ? TEXT_2 : LABEL }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Popover open={dateMenu.open} onOpenChange={dateMenu.onOpenChange} align="right" width={200}
              trigger={
                <Btn onClick={dateMenu.toggle} active={dateRange !== 'all'}>
                  <CalendarBlank size={18} />{DATE_LABELS[dateRange]}<CaretDown size={13} weight="bold" />
                </Btn>
              }>
              <MenuLabel>Created</MenuLabel>
              {(Object.keys(DATE_LABELS) as DateRange[]).map(r => (
                <MenuItem key={r} active={dateRange === r} onClick={() => { setDateRange(r); setPage(0); setOpenMenu(null) }}>{DATE_LABELS[r]}</MenuItem>
              ))}
            </Popover>
            <div className="flex gap-0.5 rounded-[10px] border p-[3px]" style={{ background: SURFACE, borderColor: BORDER }}>
              {([['list', ListBullets, 'List view'], ['board', SquaresFour, 'Board view']] as const).map(([v, Icon, label]) => (
                <button key={v} type="button" onClick={() => setViewMode(v)} aria-label={label} aria-pressed={viewMode === v} title={label}
                  className="grid size-8 cursor-pointer place-items-center rounded-[7px] transition-colors"
                  style={viewMode === v
                    ? { background: CANVAS, color: TEXT, boxShadow: '0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)' }
                    : { background: 'transparent', color: LABEL }}>
                  <Icon size={17} weight={viewMode === v ? 'bold' : 'regular'} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6 lg:px-8">

        {/* ── Stat cards ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {statCards.map(c => (
            <StatCard key={c.key} icon={c.icon} title={c.title} value={c.value} pill={c.pill} sub={c.sub}
              bars={stats.bars(c.key)} accent={c.accent} loading={firstLoad} active={statusFilter === c.key} onClick={() => handleStatusFilter(c.key)} period={stats.sparkPeriod} />
          ))}
        </div>

        {/* ── Leads card ── */}
        <div className="@container rounded-[16px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS }}>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <div className="relative w-full @2xl:w-auto @2xl:min-w-[220px] @2xl:max-w-[340px] @2xl:flex-1">
              <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: LABEL }} />
              {loading && search && <CircleNotch size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: LABEL }} />}
              <input type="text" placeholder="Search name, phone, email…" value={search} aria-label="Search leads"
                onChange={e => handleSearchChange(e.target.value)}
                className="h-10 w-full rounded-[10px] border bg-white pl-10 pr-9 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-[#98A2B3] focus:border-[#84ADFF] focus:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]"
                style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS }} />
            </div>

            <Popover open={sortMenu.open} onOpenChange={sortMenu.onOpenChange} width={220}
              trigger={
                <SplitBtn icon={<ArrowsDownUp size={18} />} onClick={sortMenu.toggle} active={sortBy !== 'score'}>
                  <span className="hidden md:inline">{sortBy === 'score' ? 'Sort' : SORT_LABELS[sortBy]}</span>
                </SplitBtn>
              }>
              <MenuLabel>Sort by</MenuLabel>
              {(Object.keys(SORT_LABELS) as SortBy[]).map(s => (
                <MenuItem key={s} active={sortBy === s} onClick={() => { setSortBy(s); setOpenMenu(null); setPage(0) }}>{SORT_LABELS[s]}</MenuItem>
              ))}
            </Popover>

            <Popover open={filterMenu.open} onOpenChange={filterMenu.onOpenChange} width={300}
              trigger={
                <SplitBtn icon={<Funnel size={18} />} onClick={filterMenu.toggle} active={filterCount > 0} badge={filterCount}>
                  <span className="hidden md:inline">Filter</span>
                </SplitBtn>
              }>
              <MenuLabel>Intent score</MenuLabel>
              <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                {(Object.keys(FILTER_LABELS) as ScoreFilter[]).map(s => (
                  <button key={s} type="button" onClick={() => handleScoreFilter(s)}
                    className="cursor-pointer rounded-[8px] border px-2 py-1.5 text-[13px] font-semibold transition-colors"
                    style={scoreFilter === s
                      ? { background: BLUE_BG, borderColor: BLUE_LN, color: BLUE }
                      : { background: CANVAS, borderColor: BORDER, color: TEXT_2 }}>
                    {s === 'all' ? 'Any score' : FILTER_LABELS[s]}
                  </button>
                ))}
              </div>
              {uniqueSources.length > 0 && (
                <>
                  <div className="mx-1 my-1.5 border-t" style={{ borderColor: BORDER }} />
                  <MenuLabel>Source</MenuLabel>
                  <div className="max-h-[200px] overflow-y-auto">
                    <MenuItem active={sourceFilter === 'all'} onClick={() => { setSourceFilter('all'); setPage(0) }}>
                      <Globe size={18} color={SUBTLE} />All sources
                    </MenuItem>
                    {uniqueSources.map(s => (
                      <MenuItem key={s} active={sourceFilter === s} onClick={() => { setSourceFilter(s); setPage(0) }}>
                        <SourceMark raw={s} size={18} /><span className="truncate">{sourceMeta(s).label}</span>
                      </MenuItem>
                    ))}
                  </div>
                </>
              )}
              <div className="mx-1 my-1.5 border-t" style={{ borderColor: BORDER }} />
              <MenuItem active={showStuck} onClick={() => { setShowStuck(v => !v); setPage(0) }}>
                <Clock size={18} color="#B54708" />Stuck for 7+ days
              </MenuItem>
              {dupPhones.length > 0 && (
                <MenuItem active={showDupsOnly} onClick={() => { setShowDupsOnly(v => !v); setPage(0) }}>
                  <Copy size={18} color="#B54708" />Duplicates only
                </MenuItem>
              )}
              {filterCount > 0 && (
                <>
                  <div className="mx-1 my-1.5 border-t" style={{ borderColor: BORDER }} />
                  <button type="button" onClick={() => { clearFilters(); setOpenMenu(null) }}
                    className="w-full cursor-pointer rounded-[8px] px-2.5 py-2 text-left text-[14px] font-semibold hover:bg-[#F9FAFB]" style={{ color: BLUE }}>
                    Clear all filters
                  </button>
                </>
              )}
            </Popover>

            <div className="ml-auto flex items-center gap-2.5">
              {dupPhones.length > 0 && !showDupsOnly && (
                <button type="button" onClick={() => { setShowDupsOnly(true); setPage(0) }}
                  className="hidden h-10 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-[13px] font-semibold transition-colors hover:bg-[#FEF0C7] lg:inline-flex"
                  style={{ background: '#FFFAEB', borderColor: '#FEDF89', color: '#B54708' }}>
                  <Copy size={16} />{dupLeadIds.size} possible duplicates
                </button>
              )}
              <Btn onClick={() => exportCsv()} label="Export CSV"><DownloadSimple size={18} /><span className="hidden sm:inline">Export CSV</span></Btn>
            </div>
          </div>

          {/* Active filters */}
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
              <button type="button" onClick={clearFilters} className="cursor-pointer px-1 text-[13px] font-semibold" style={{ color: BLUE }}>Clear all</button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mb-4 rounded-[10px] border px-4 py-3" style={{ background: '#FEF3F2', borderColor: '#FECDCA' }}>
              <p className="m-0 text-[14px]" style={{ color: '#B42318' }}>{error}</p>
            </div>
          )}

          {/* Board */}
          {viewMode === 'board' && (
            <div className="border-t p-4" style={{ borderColor: BORDER }}>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {STATUS_ORDER.map(st => {
                  const col = filteredSortedLeads.filter(l => (l.status ?? 'New') === st)
                  const p = STATUS_PILL[st]
                  return (
                    <div key={st} className="flex w-[264px] shrink-0 flex-col rounded-[14px] border" style={{ background: SURFACE, borderColor: BORDER }}>
                      <div className="flex items-center justify-between px-3.5 py-3">
                        <span className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: TEXT }}>
                          <span className="size-2 rounded-full" style={{ background: p.dot }} />{st}
                        </span>
                        <span className="rounded-full border bg-white px-2 text-[12px] font-semibold tabular-nums" style={{ borderColor: BORDER, color: MUTED }}>{col.length}</span>
                      </div>
                      <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
                        {col.length === 0 && <div className="rounded-[10px] border border-dashed px-3 py-6 text-center text-[13px]" style={{ borderColor: BORDER_2, color: LABEL }}>No leads</div>}
                        {col.map(l => (
                          <Link key={l.id} href={`/dashboard/leads/${l.id}`}
                            className="block rounded-[12px] border bg-white p-3 no-underline transition-[box-shadow,border-color] hover:border-[#D0D5DD] hover:shadow-[0_4px_8px_-2px_rgba(16,24,40,0.1)]"
                            style={{ borderColor: BORDER, boxShadow: XS }}>
                            <div className="flex items-center gap-2.5">
                              <LeadAvatar lead={l} size={32} badge />
                              <div className="min-w-0">
                                <div className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{getDisplayName(l)}</div>
                                <div className="truncate text-[12px] tabular-nums" style={{ color: SUBTLE }}>{getPhone(l) || '—'}</div>
                              </div>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between gap-2 text-[12px]" style={{ color: MUTED }}>
                              <span className="flex min-w-0 items-center gap-1.5">
                                {l.sourcePortal && <SourceMark raw={l.sourcePortal} size={16} />}
                                <span className="truncate">{l.sourcePortal ? sourceMeta(l.sourcePortal).label : 'Direct'}</span>
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums" style={{ color: TEXT_2 }}>{formatBudget(l.budgetMin, l.budgetMax)}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {viewMode === 'list' && !loading && filteredSortedLeads.length === 0 && (
            <div className="border-t px-6 py-14 text-center" style={{ borderColor: BORDER }}>
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[10px] border" style={{ borderColor: BORDER, boxShadow: XS }}>
                <UserPlus size={22} style={{ color: TEXT_2 }} />
              </div>
              <h3 className="m-0 mb-1 text-[16px] font-semibold" style={{ color: TEXT }}>
                {search || scoreFilter !== 'all' || filterCount > 0 ? 'No leads match your filters' : 'No leads yet'}
              </h3>
              <p className="m-0 mb-5 text-[14px]" style={{ color: SUBTLE }}>
                {search || scoreFilter !== 'all' || filterCount > 0 ? 'Try adjusting your search or filters' : 'Add your first lead or import from a portal'}
              </p>
              {!search && scoreFilter === 'all' && filterCount === 0 ? (
                <button type="button" onClick={() => setShowAddModal(true)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold text-white" style={{ background: BLUE, boxShadow: XS }}>
                  <Plus size={16} weight="bold" /> Add Lead
                </button>
              ) : (
                <Btn onClick={clearFilters}>Clear filters</Btn>
              )}
            </div>
          )}

          {/* Table */}
          {viewMode === 'list' && (pageLeads.length > 0 || firstLoad) && (
            <>
              <div className="overflow-x-auto border-t" style={{ borderColor: BORDER }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: SURFACE }}>
                      <th scope="col" className={`w-[52px] py-3 pl-6 pr-0 text-left ${COL.sel}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <input type="checkbox" aria-label="Select all leads on this page" checked={pageAllSelected} onChange={togglePage}
                          className="size-4 cursor-pointer align-middle accent-[#1D4ED8]" />
                      </th>
                      {([
                        ['Lead', 'pl-4 pr-3 @md:pl-3'],
                        ['Phone', `px-3 ${COL.phone}`],
                        ['Source', `px-3 ${COL.source}`],
                        ['Budget', `px-3 ${COL.budget}`],
                        ['Intent', `px-3 ${COL.intent}`],
                        ['Property', `px-3 ${COL.prop}`],
                        ['Status', 'px-3'],
                        ['Created', `px-3 ${COL.created}`],
                        ['', `pl-2 pr-6 ${COL.act}`],
                      ]).map(([h, cls], i) => (
                        <th key={i} scope="col" className={`whitespace-nowrap py-3 text-left text-[12px] font-medium ${cls}`}
                          style={{ color: SUBTLE, borderBottom: `1px solid ${BORDER}` }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {firstLoad && Array.from({ length: 6 }, (_, i) => (
                      <tr key={`sk-${i}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td className={`py-5 pl-6 ${COL.sel}`}><span className="block size-4 animate-pulse rounded-[4px] bg-[#F2F4F7]" /></td>
                        <td className="py-4 pl-4 pr-4 @md:pl-3">
                          <div className="flex items-center gap-3">
                            <span className="size-10 shrink-0 animate-pulse rounded-full bg-[#F2F4F7]" />
                            <div className="flex flex-col gap-1.5">
                              <span className="block h-3.5 w-32 animate-pulse rounded bg-[#F2F4F7]" />
                              <span className="block h-3 w-40 animate-pulse rounded bg-[#F9FAFB]" />
                            </div>
                          </div>
                        </td>
                        <td className={`px-3 ${COL.phone}`}><span className="block h-3 w-28 animate-pulse rounded bg-[#F2F4F7]" /></td>
                        <td className={`px-3 ${COL.source}`}><span className="block h-3 w-24 animate-pulse rounded bg-[#F2F4F7]" /></td>
                        <td className={`px-3 ${COL.budget}`}><span className="block h-3 w-20 animate-pulse rounded bg-[#F2F4F7]" /></td>
                        <td className={`px-3 ${COL.intent}`}><span className="block h-2 w-20 animate-pulse rounded-full bg-[#F2F4F7]" /></td>
                        <td className={`px-3 ${COL.prop}`}><span className="block h-5 w-20 animate-pulse rounded-full bg-[#F2F4F7]" /></td>
                        <td className="px-3"><span className="block h-6 w-20 animate-pulse rounded-full bg-[#F2F4F7]" /></td>
                        <td className={`px-3 ${COL.created}`}><span className="block h-3 w-24 animate-pulse rounded bg-[#F2F4F7]" /></td>
                        <td className={`pl-2 pr-6 ${COL.act}`} />
                      </tr>
                    ))}

                    {pageLeads.map((lead, idx) => {
                      const name   = getDisplayName(lead)
                      const csId   = getCsId(lead)
                      const status = lead.status ?? 'New'
                      const isDup  = dupLeadIds.has(lead.id)
                      const email  = getEmail(lead)
                      const phone  = getPhone(lead)
                      const href   = `/dashboard/leads/${lead.id}`
                      const isSel  = selected.has(lead.id)
                      return (
                        <tr key={lead.id} onClick={() => router.push(href)}
                          className={`group cursor-pointer transition-colors ${isSel ? '' : 'hover:bg-[#F9FAFB]'}`}
                          style={{ borderBottom: idx < pageLeads.length - 1 ? `1px solid ${BORDER}` : 'none', background: isSel ? '#F5F8FF' : undefined }}>

                          {/* Select */}
                          <td className={`py-4 pl-6 pr-0 align-middle ${COL.sel}`} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Select ${name}`} checked={isSel} onChange={() => toggleRow(lead.id)}
                              className="size-4 cursor-pointer align-middle accent-[#1D4ED8]" />
                          </td>

                          {/* Lead */}
                          <td className="py-4 pl-4 pr-3 align-middle @md:pl-3">
                            <div className="flex items-center gap-3.5">
                              <LeadAvatar lead={lead} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Link href={href} onClick={e => e.stopPropagation()}
                                    className="truncate text-[14px] font-semibold no-underline outline-none hover:text-[#1D4ED8] focus-visible:underline"
                                    style={{ color: TEXT }}>
                                    {name}
                                  </Link>
                                  {isDup && <span className="shrink-0 rounded-full border px-1.5 text-[11px] font-semibold" style={{ background: '#FFFAEB', borderColor: '#FEDF89', color: '#B54708' }}>Duplicate</span>}
                                </div>
                                <div className="mt-0.5 flex max-w-[230px] items-center gap-1.5 text-[13px]" style={{ color: SUBTLE }}>
                                  <button type="button" title="Copy CS ID" onClick={e => { e.stopPropagation(); copyCsId(lead) }}
                                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[5px] border px-1.5 text-[11.5px] font-medium leading-[18px] transition-colors hover:border-[#D0D5DD] hover:text-[#344054]"
                                    style={{ color: copiedId === lead.id ? '#067647' : MUTED, borderColor: copiedId === lead.id ? '#ABEFC6' : BORDER, background: copiedId === lead.id ? '#ECFDF3' : SURFACE, fontFamily: MONO }}>
                                    {copiedId === lead.id ? <><Check size={11} weight="bold" />Copied</> : csId}
                                  </button>
                                  {email && <span className="hidden truncate @md:inline">{email}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className={`whitespace-nowrap px-3 py-4 align-middle text-[14px] tabular-nums ${COL.phone}`} style={{ color: phone ? TEXT_2 : LABEL }}>
                            {phone || '—'}
                          </td>

                          {/* Source */}
                          <td className={`whitespace-nowrap px-3 py-4 align-middle text-[14px] ${COL.source}`} style={{ color: TEXT_2 }}>
                            {lead.sourcePortal ? (
                              <span className="inline-flex items-center gap-2"><SourceMark raw={lead.sourcePortal} />{sourceMeta(lead.sourcePortal).label}</span>
                            ) : <span style={{ color: LABEL }}>—</span>}
                          </td>

                          {/* Budget */}
                          <td className={`whitespace-nowrap px-3 py-4 align-middle text-[14px] font-medium tabular-nums ${COL.budget}`} style={{ color: TEXT }}>
                            {formatBudget(lead.budgetMin, lead.budgetMax)}
                          </td>

                          {/* Intent */}
                          <td className={`whitespace-nowrap px-3 py-4 align-middle ${COL.intent}`}>
                            <IntentMeter score={lead.intentScore ?? null} />
                          </td>

                          {/* Property */}
                          <td className={`px-3 py-4 align-middle ${COL.prop}`}>
                            {lead.propertyType && lead.propertyType.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {lead.propertyType.map(pt => (
                                  <span key={pt} className="inline-flex items-center gap-1 whitespace-nowrap rounded-[6px] border px-1.5 py-0.5 text-[12px] font-medium"
                                    style={{ background: CANVAS, borderColor: BORDER_2, color: TEXT_2 }}>
                                    <House size={12} color={SUBTLE} />{pt}
                                  </span>
                                ))}
                              </div>
                            ) : <span className="text-[14px]" style={{ color: LABEL }}>—</span>}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-4 align-middle"><StatusPill status={status} /></td>

                          {/* Created */}
                          <td className={`whitespace-nowrap px-3 py-4 align-middle ${COL.created}`}>
                            <div className="text-[14px] tabular-nums" style={{ color: TEXT_2 }}>{formatDate(lead.createdAt)}</div>
                            <div className="mt-0.5 text-[12px]" style={{ color: LABEL }}>Updated {timeAgo(lead.updatedAt)}</div>
                          </td>

                          {/* Actions */}
                          <td className={`py-4 pl-2 pr-6 align-middle ${COL.act}`}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" title="Log activity" aria-label={`Log activity for ${name}`}
                                onClick={e => { e.stopPropagation(); setQuickLogLeadId(lead.id) }}
                                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border bg-white px-2.5 text-[13px] font-semibold transition-colors hover:border-[#ABEFC6] hover:bg-[#ECFDF3] hover:text-[#067647]"
                                style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
                                <Pulse size={15} /><span className="hidden @min-[1300px]:inline">Log</span>
                              </button>
                              <Link href={href} onClick={e => e.stopPropagation()} title="Open lead" aria-label={`Open ${name}`}
                                className="hidden size-9 place-items-center @min-[1300px]:grid rounded-[8px] border bg-white no-underline transition-colors group-hover:border-[#B2CCFF] group-hover:bg-[#EFF4FF] group-hover:text-[#1D4ED8]"
                                style={{ borderColor: BORDER_2, color: SUBTLE, boxShadow: XS }}>
                                <ArrowUpRight size={16} weight="bold" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer: count + pagination */}
              {!firstLoad && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3.5 sm:px-6" style={{ borderColor: BORDER }}>
                  <span className="text-[14px]" style={{ color: SUBTLE }}>
                    {loading ? 'Refreshing…' : `Showing ${filteredSortedLeads.length.toLocaleString('en-IN')} of ${totalCount.toLocaleString('en-IN')} leads`}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <Popover open={perPageMenu.open} onOpenChange={perPageMenu.onOpenChange} align="right" width={160}
                      trigger={
                        <button type="button" onClick={perPageMenu.toggle}
                          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border bg-white px-3.5 text-[14px] transition-colors hover:bg-[#F9FAFB]"
                          style={{ borderColor: BORDER_2, color: SUBTLE, boxShadow: XS }}>
                          <span className="font-semibold tabular-nums" style={{ color: TEXT }}>{perPage}</span> per page
                          <CaretDown size={13} weight="bold" />
                        </button>
                      }>
                      {PER_PAGE_OPTIONS.map(n => (
                        <MenuItem key={n} active={perPage === n} onClick={() => { setPerPage(n); setPage(0); setOpenMenu(null) }}>{n} per page</MenuItem>
                      ))}
                    </Popover>
                    <div className="inline-flex h-10 items-center gap-1 rounded-[10px] border bg-white pl-3.5 pr-1 text-[14px] tabular-nums" style={{ borderColor: BORDER_2, color: SUBTLE, boxShadow: XS }}>
                      <span className="mr-1.5">
                        <span className="font-semibold" style={{ color: TEXT }}>
                          {filteredSortedLeads.length ? `${pageStart + 1}–${Math.min(pageStart + perPage, filteredSortedLeads.length)}` : '0'}
                        </span>{' '}of {filteredSortedLeads.length}
                      </span>
                      <button type="button" aria-label="Previous page" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}
                        className="grid size-8 cursor-pointer place-items-center rounded-[7px] transition-colors hover:bg-[#F2F4F7] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
                        style={{ color: TEXT }}>
                        <CaretLeft size={14} weight="bold" />
                      </button>
                      <button type="button" aria-label="Next page" disabled={curPage >= pageCount - 1} onClick={() => setPage(curPage + 1)}
                        className="grid size-8 cursor-pointer place-items-center rounded-[7px] transition-colors hover:bg-[#F2F4F7] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
                        style={{ color: TEXT }}>
                        <CaretRight size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Bulk selection bar ── */}
      {selected.size > 0 && (
        <div role="region" aria-label="Selected leads"
          className="fixed bottom-6 left-1/2 z-[150] flex -translate-x-1/2 items-center gap-1 rounded-[14px] bg-[#101828] p-1.5 pl-4 text-white shadow-[0_20px_24px_-4px_rgba(16,24,40,0.18),0_8px_8px_-4px_rgba(16,24,40,0.08)]">
          <span className="mr-2 whitespace-nowrap text-[14px] font-semibold tabular-nums">{selected.size} selected</span>
          <button type="button" onClick={() => exportCsv(selectedLeads)}
            className="inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[9px] px-3 text-[14px] font-semibold transition-colors hover:bg-white/10">
            <DownloadSimple size={17} />Export
          </button>
          {selected.size === 1 && (
            <button type="button" onClick={() => setQuickLogLeadId([...selected][0])}
              className="inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[9px] px-3 text-[14px] font-semibold transition-colors hover:bg-white/10">
              <Pulse size={17} />Log activity
            </button>
          )}
          <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" title="Clear selection"
            className="grid size-9 cursor-pointer place-items-center rounded-[9px] text-[#98A2B3] transition-colors hover:bg-white/10 hover:text-white">
            <X size={16} weight="bold" />
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchLeads(search, scoreFilter) }}
        />
      )}
      {showCsvModal && (
        <CsvUploadModal onClose={() => setShowCsvModal(false)} onSuccess={handleCsvImport} />
      )}
      {showDistributeModal && (
        <DistributeModal
          onClose={() => setShowDistributeModal(false)}
          onDone={() => { setShowDistributeModal(false); fetchLeads(); fetchUnassigned() }}
        />
      )}
      {showEmailModal && (
        <EmailParserModal onClose={() => setShowEmailModal(false)} onSuccess={async p => {
          setShowEmailModal(false)
          setImportStatus({ total: 1, done: 0, label: 'Importing lead from email…' })
          try {
            const res  = await fetch('/api/crm/leads/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: [p] }) })
            const json = await res.json()
            setImportStatus({ total: 1, done: 1, label: json.message ?? 'Lead imported' })
          } catch { setImportStatus({ total: 1, done: 1, label: 'Import failed' }) }
          await fetchLeads(); fetchUnassigned()
          setTimeout(() => setImportStatus(null), 5000)
        }} />
      )}
      {quickLogLeadId && (
        <LogActivityModal
          leadId={quickLogLeadId}
          isOpen={true}
          onClose={() => setQuickLogLeadId(null)}
          onActivityLogged={() => { setQuickLogLeadId(null); fetchLeads(search, scoreFilter) }}
          currentStatus={leads.find(l => l.id === quickLogLeadId)?.status ?? 'New'}
          existingActivityTypes={[]}
        />
      )}
    </div>
  )
}
