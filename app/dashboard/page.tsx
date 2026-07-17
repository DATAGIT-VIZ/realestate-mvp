'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, TrendingUp, IndianRupee, Flame,
  ArrowRight, Loader2, ArrowUpRight,
  Newspaper, MapPin, Receipt, Landmark, Home, ChevronRight, ChevronLeft, ExternalLink,
} from 'lucide-react'

// ─── Design tokens (Vya Pulse palette) ────────────────────────────────────────
const BG      = '#F5F6FA'
const PANEL   = '#FFFFFF'
const BORDER  = '#E8ECF0'
const TEXT    = '#263238'
const MUTED   = '#78889B'
const LABEL   = '#A4B1BE'
const ORANGE  = '#FF7043'
const ORANGE_DIM   = 'rgba(255,112,67,0.09)'
const ORANGE_GRAD  = 'linear-gradient(135deg, #FF7043 0%, #FF8A65 100%)'
const ACCENT  = '#2E66F6'
const EMERALD = '#059669'
const AMBER   = '#F59E0B'
const RED     = '#EF4444'

// ─── Avatar palette (deterministic warm colors) ────────────────────────────────
const PALETTE = [
  { bg: '#FFEDE8', fg: '#C2410C' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#FCE7F3', fg: '#BE185D' },
  { bg: '#E0F2FE', fg: '#0369A1' },
  { bg: '#FFF7ED', fg: '#C2410C' },
]
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % PALETTE.length
  return PALETTE[Math.abs(h)]
}

type CRMLead = {
  id: string
  name: { firstName: string; lastName: string }
  phones: { primaryPhoneNumber: string | null }
  emails: { primaryEmail: string | null }
  intentScore: number | null
  sourcePortal: string | null
  status: string | null
  budgetMin: number | null
  budgetMax: number | null
  leadPortalId: string | null
  createdAt: string
  updatedAt: string
}

const getName     = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getInitials = (l: CRMLead) => ((l.name.firstName?.[0] ?? '') + (l.name.lastName?.[0] ?? '')).toUpperCase() || '?'
const getScore    = (l: CRMLead) => l.intentScore ?? 0

function formatPipeline(n: number) {
  if (n <= 0) return '—'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)} Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(0)} L`
  return `₹${n.toLocaleString()}`
}
function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function sourceLabel(raw: string | null) {
  if (!raw) return 'Unknown'
  const m: Record<string, string> = {
    OPT99ACRES: '99acres', MAGICBRICKS: 'MagicBricks',
    HOUSING_COM: 'Housing.com', FACEBOOK: 'Facebook', GOOGLE: 'Google Ads',
    CHANNEL_PARTNER: 'Channel Partner', MARKETING: 'Campaigns',
  }
  return m[raw] ?? raw
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, accent, trend }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent: string; trend?: { up: boolean; label: string }
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.35)', border: `1px solid rgba(255,255,255,0.60)`, borderRadius: 16, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 18, height: 18, color: accent }} />
        </div>
        {trend && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: trend.up ? EMERALD : RED, background: trend.up ? 'rgba(5,150,105,0.09)' : 'rgba(239,68,68,0.09)', padding: '3px 8px', borderRadius: 20 }}>
            <ArrowUpRight style={{ width: 10, height: 10, transform: trend.up ? 'none' : 'rotate(90deg)' }} />
            {trend.label}
          </span>
        )}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: TEXT, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: MUTED, marginTop: 6, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: LABEL, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

const SOURCE_COLORS = [ORANGE, ACCENT, EMERALD, AMBER, '#A78BFA', '#F472B6', '#22D3EE']

function LeadSourceDonut({ data }: { data: Array<{ name: string; value: number }> }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LABEL, fontSize: 13 }}>No data</div>
  )
  const CX = 72, CY = 72, OR = 63, IR = 43
  const GAP = 2.8
  const toRad = (deg: number) => (deg * Math.PI) / 180
  let cum = -90
  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * 360
    const s = cum + GAP / 2
    const e = cum + sweep - GAP / 2
    cum += sweep
    const large = sweep - GAP > 180 ? 1 : 0
    const p = (deg: number, r: number) => [CX + r * Math.cos(toRad(deg)), CY + r * Math.sin(toRad(deg))] as [number, number]
    const [ox1, oy1] = p(s, OR), [ox2, oy2] = p(e, OR)
    const [ix1, iy1] = p(e, IR), [ix2, iy2] = p(s, IR)
    const path = `M ${ox1.toFixed(2)} ${oy1.toFixed(2)} A ${OR} ${OR} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} L ${ix1.toFixed(2)} ${iy1.toFixed(2)} A ${IR} ${IR} 0 ${large} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)} Z`
    return { ...d, path, color: SOURCE_COLORS[i % SOURCE_COLORS.length], pct: Math.round((d.value / total) * 100) }
  })
  const active = hovered !== null ? slices[hovered] : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <div style={{ flexShrink: 0 }}>
        <svg width={144} height={144} viewBox="0 0 144 144">
          {slices.map((s, i) => (
            <path key={i} d={s.path} fill={s.color}
              opacity={hovered === null ? 1 : hovered === i ? 1 : 0.2}
              style={{ cursor: 'pointer', transition: 'opacity 0.18s ease', filter: hovered === i ? `drop-shadow(0 2px 8px ${s.color}60)` : 'none' }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            />
          ))}
          {active ? (
            <>
              <text x={CX} y={CY - 9} textAnchor="middle" fontSize="20" fontWeight="800" fill={TEXT}>{active.value}</text>
              <text x={CX} y={CY + 8} textAnchor="middle" fontSize="11" fontWeight="700" fill={active.color}>{active.pct}%</text>
              <text x={CX} y={CY + 21} textAnchor="middle" fontSize="10" fill={MUTED}>of total</text>
            </>
          ) : (
            <>
              <text x={CX} y={CY - 5} textAnchor="middle" fontSize="24" fontWeight="800" fill={TEXT}>{total}</text>
              <text x={CX} y={CY + 13} textAnchor="middle" fontSize="11" fill={MUTED}>total leads</text>
            </>
          )}
        </svg>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {slices.map((s, i) => (
          <div key={i}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', opacity: hovered === null ? 1 : hovered === i ? 1 : 0.3, transition: 'opacity 0.18s' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          >
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: TEXT, flex: 1, fontWeight: 500 }}>{s.name}</span>
            <div style={{ width: 50, height: 4, background: '#F0F2F5', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, minWidth: 18, textAlign: 'right' }}>{s.value}</span>
            <span style={{ fontSize: 11, color: MUTED, minWidth: 32, textAlign: 'right' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const FUNNEL_CFG: Record<string, { top: string; bot: string; order: number }> = {
  New:    { top: '#7C3AED', bot: '#5B21B6', order: 0 },
  Cold:   { top: '#818CF8', bot: '#6366F1', order: 1 },
  Warm:   { top: '#A78BFA', bot: '#7C3AED', order: 2 },
  Hot:    { top: '#C4B5FD', bot: '#A78BFA', order: 3 },
  Closed: { top: '#6EE7B7', bot: '#10B981', order: 4 },
}

function PipelineFunnelChart({ stages }: {
  stages: Array<{ name: string; count: number; budget: number; topColor: string; botColor: string }>
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const active = stages.filter(s => s.count > 0)
  if (active.length === 0) return (
    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LABEL, fontSize: 13 }}>
      No pipeline data yet
    </div>
  )

  const W = 600, H = 150, MAX_H = 118, FLOOR = H
  const colW = W / active.length
  const maxCount = Math.max(...active.map(s => s.count))
  const heights = active.map(s => Math.max((s.count / maxCount) * MAX_H, 14))
  const totalCount = active.reduce((s, a) => s + a.count, 0)

  const paths = active.map((s, i) => {
    const xi = i * colW
    const hi = heights[i]
    const hn = i < active.length - 1 ? heights[i + 1] : hi
    return [
      `M ${xi} ${FLOOR}`,
      `L ${xi} ${FLOOR - hi}`,
      `L ${xi + colW * 0.62} ${FLOOR - hi}`,
      `C ${xi + colW * 0.82} ${FLOOR - hi} ${xi + colW * 0.82} ${FLOOR - hn} ${xi + colW} ${FLOOR - hn}`,
      `L ${xi + colW} ${FLOOR}`,
      'Z',
    ].join(' ')
  })

  const hoveredStage = hovered !== null ? active[hovered] : null

  return (
    <div style={{ position: 'relative' }}>
      {/* Tooltip */}
      {hoveredStage !== null && hovered !== null && (
        <div style={{
          position: 'absolute',
          top: -12,
          left: `${((hovered + 0.5) / active.length) * 100}%`,
          transform: 'translateX(-50%) translateY(-100%)',
          background: '#0F172A',
          borderRadius: 10,
          padding: '8px 12px',
          pointerEvents: 'none',
          zIndex: 20,
          minWidth: 110,
          textAlign: 'center',
          boxShadow: `0 6px 20px rgba(0,0,0,0.24), 0 0 0 1px ${hoveredStage.topColor}30`,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: hoveredStage.topColor, marginBottom: 4, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {hoveredStage.name}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 1 }}>
            {formatPipeline(hoveredStage.budget)}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>pipeline value</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{hoveredStage.count} leads</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: hoveredStage.topColor }}>{Math.round((hoveredStage.count / totalCount) * 100)}%</span>
          </div>
          {/* Arrow */}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: '6px solid #0F172A',
          }} />
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 150, display: 'block' }}
        preserveAspectRatio="none"
      >
        <defs>
          {active.map((s, i) => (
            <linearGradient key={i} id={`pfg-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.topColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={s.botColor} stopOpacity="0.5" />
            </linearGradient>
          ))}
          {/* Sweep sheen gradient */}
          <linearGradient id="pfg-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="white" stopOpacity="0"    />
            <stop offset="50%"  stopColor="white" stopOpacity="0.20" />
            <stop offset="100%" stopColor="white" stopOpacity="0"    />
          </linearGradient>
          {/* Clip path = union of all funnel segments */}
          <clipPath id="pfg-clip">
            {paths.map((d, i) => <path key={i} d={d} />)}
          </clipPath>
        </defs>

        {/* Stage segments */}
        {active.map((s, i) => (
          <path
            key={i}
            d={paths[i]}
            fill={`url(#pfg-${i})`}
            opacity={hovered === null ? 1 : hovered === i ? 1 : 0.28}
            style={{
              cursor: 'pointer',
              transition: 'opacity 0.22s ease, filter 0.22s ease',
              filter: hovered === i ? `drop-shadow(0 3px 14px ${s.topColor}70)` : 'none',
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        {/* Flowing sheen — sweeps left to right continuously when nothing is hovered */}
        <rect
          x="-200" y="0" width="200" height={H}
          fill="url(#pfg-sheen)"
          clipPath="url(#pfg-clip)"
          style={{ pointerEvents: 'none', opacity: hovered === null ? 1 : 0, transition: 'opacity 0.2s' }}
        >
          <animate attributeName="x" from="-200" to={String(W)} dur="2.6s" repeatCount="indefinite" />
        </rect>
      </svg>
    </div>
  )
}

// ─── Revenue Analytics (quarterly dot-matrix + AI projection) ─────────────────
const Q_COLORS = [ORANGE, AMBER, EMERALD, '#8B5CF6']

type MetricKey = 'pipeline' | 'count' | 'avg'
type PeriodKey = 'year' | 'q1' | 'q2' | 'q3' | 'q4'
const METRIC_OPTS: { key: MetricKey; label: string }[] = [
  { key: 'pipeline', label: 'Pipeline Value' },
  { key: 'count',    label: 'Lead Count' },
  { key: 'avg',      label: 'Avg Deal Size' },
]

function RevenueAnalytics({ leads }: { leads: CRMLead[] }) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null)
  const [animated, setAnimated]         = useState(false)
  const [openMenu, setOpenMenu]         = useState<'metric' | 'period' | null>(null)
  const [metric, setMetric]             = useState<MetricKey>('pipeline')
  const [period, setPeriod]             = useState<PeriodKey>('year')
  const [showReasoning, setShowReasoning] = useState(false)
  const menuRef     = useRef<HTMLDivElement>(null)
  const year        = new Date().getFullYear()
  const curMonthIdx = new Date().getMonth()
  const curDay      = new Date().getDate()

  useEffect(() => { const t = setTimeout(() => setAnimated(true), 120); return () => clearTimeout(t) }, [])
  useEffect(() => { setHoveredMonth(null) }, [period])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const periodOpts = [
    { key: 'year' as PeriodKey, label: `Full Year ${year}`, focus: [0,1,2,3,4,5,6,7,8,9,10,11] },
    { key: 'q1'   as PeriodKey, label: `Q1 · Jan–Mar`,      focus: [0,1,2] },
    { key: 'q2'   as PeriodKey, label: `Q2 · Apr–Jun`,      focus: [3,4,5] },
    { key: 'q3'   as PeriodKey, label: `Q3 · Jul–Sep`,      focus: [6,7,8] },
    { key: 'q4'   as PeriodKey, label: `Q4 · Oct–Dec`,      focus: [9,10,11] },
  ]
  const activePeriod = periodOpts.find(p => p.key === period)!
  const focusSet     = new Set(activePeriod.focus)
  const metricLabel  = METRIC_OPTS.find(m => m.key === metric)!.label

  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => {
    const start = new Date(year, m, 1).getTime()
    const end   = new Date(year, m + 1, 0, 23, 59, 59).getTime()
    const ml    = leads.filter(l => { const t = new Date(l.createdAt).getTime(); return t >= start && t <= end })
    return {
      label: new Date(year, m, 1).toLocaleDateString('en-IN', { month: 'short' }),
      value: ml.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0),
      count: ml.length,
    }
  }), [leads, year])

  // AI projection: velocity from data months → project forward with 3.5% monthly growth
  const { projPipeline, projCount, reasoning } = useMemo(() => {
    const daysInCur      = new Date(year, curMonthIdx + 1, 0).getDate()
    const fraction       = Math.max(curDay / daysInCur, 0.01)
    const withData       = months.filter((m, i) => m.value > 0 && i <= curMonthIdx)
    const avgPipe        = withData.length > 0 ? withData.reduce((s, m) => s + m.value, 0) / withData.length : 0
    const avgCnt         = withData.length > 0 ? withData.reduce((s, m) => s + m.count, 0) / withData.length : 0
    const curMonthPace   = months[curMonthIdx].value / fraction
    const pipeBase       = curMonthPace * 0.6 + avgPipe * 0.4
    const cntBase        = months[curMonthIdx].count / fraction * 0.6 + avgCnt  * 0.4
    return {
      projPipeline: Array.from({ length: 12 }, (_, m) => m <= curMonthIdx ? 0 : Math.round(pipeBase * Math.pow(1.035, m - curMonthIdx))),
      projCount:    Array.from({ length: 12 }, (_, m) => m <= curMonthIdx ? 0 : Math.round(cntBase  * Math.pow(1.03,  m - curMonthIdx))),
      reasoning: { avgPipe, avgCnt: Math.round(avgCnt), curMonthPace, pipeBase, fraction, daysInCur, monthsWithData: withData.length },
    }
  }, [months, curMonthIdx, curDay, year])

  const getMonthVal = (m: { value: number; count: number }) => {
    if (metric === 'count') return m.count
    if (metric === 'avg')   return m.count > 0 ? Math.round(m.value / m.count) : 0
    return m.value
  }
  const getProjVal = (pipe: number, cnt: number) => {
    if (metric === 'count') return cnt
    if (metric === 'avg')   return cnt > 0 ? Math.round(pipe / cnt) : 0
    return pipe
  }
  const formatVal = (v: number) => metric === 'count' ? `${v}` : formatPipeline(v)

  const maxVal = Math.max(
    ...months.map(m => getMonthVal(m)),
    ...Array.from({ length: 12 }, (_, i) => getProjVal(projPipeline[i], projCount[i])),
    1
  )

  const quarters = useMemo(() => [0, 1, 2, 3].map(q => {
    const slice  = months.slice(q * 3, q * 3 + 3)
    const projP  = projPipeline.slice(q * 3, q * 3 + 3).reduce((s, v) => s + v, 0)
    const projC  = projCount.slice(q * 3, q * 3 + 3).reduce((s, v) => s + v, 0)
    const mv = (m: { value: number; count: number }) => metric === 'count' ? m.count : metric === 'avg' ? (m.count > 0 ? Math.round(m.value / m.count) : 0) : m.value
    const actual = slice.reduce((s, m) => s + mv(m), 0)
    const proj   = metric === 'count' ? projC : metric === 'avg' ? (projC > 0 ? Math.round(projP / projC) : 0) : projP
    return {
      label: `Q${q + 1}`, color: Q_COLORS[q],
      value: actual, projected: proj,
      count: slice.reduce((s, m) => s + m.count, 0),
      isFuture: actual === 0 && proj > 0,
    }
  }), [months, projPipeline, projCount, metric])

  const peakMonth   = months.reduce((b, m, i) => getMonthVal(m) > getMonthVal(months[b]) ? i : b, 0)
  const focusArr    = [...focusSet]
  const peakInFocus = focusArr.reduce((b, i) => getMonthVal(months[i]) > getMonthVal(months[b]) ? i : b, focusArr[0])
  const activeMonth = hoveredMonth ?? (period === 'year'
    ? (getMonthVal(months[curMonthIdx]) > 0 ? curMonthIdx : peakMonth)
    : peakInFocus
  )

  // Year-end projection summary (always in ₹ for banner impact)
  const actualTotal   = months.slice(0, curMonthIdx + 1).reduce((s, m) => s + m.value, 0)
  const projRemainder = projPipeline.reduce((s, v) => s + v, 0)
  const yearEnd       = actualTotal + projRemainder
  const hotLeads       = leads.filter(l => (l.intentScore ?? 0) >= 70)
  const closedLeads    = leads.filter(l => l.status === 'Closed')
  const closeRate      = leads.length > 0 ? closedLeads.length / leads.length : 0
  const projClosures   = Math.round(hotLeads.length * Math.max(closeRate, 0.15))
  const projCloseVal   = hotLeads.slice(0, projClosures).reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0)

  const ROWS = 10, DOT_R = 8, ROW_H = 20, COL_W = 80
  const CHART_H = ROWS * ROW_H + DOT_R * 2
  const CHART_W = 12 * COL_W

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '22px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Revenue Analytics</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{metricLabel} · {activePeriod.label}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[{ label: 'Actual', dashed: false }, { label: 'AI Projected', dashed: true }].map(({ label, dashed }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUTED, fontWeight: 500 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dashed ? 'transparent' : ORANGE, border: dashed ? `1.5px dashed ${ORANGE}` : 'none', display: 'inline-block', flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
          {/* Functional dropdowns */}
          <div ref={menuRef} style={{ display: 'flex', gap: 8 }}>
            {/* Metric dropdown */}
            <div style={{ position: 'relative' }}>
              <div onClick={() => setOpenMenu(openMenu === 'metric' ? null : 'metric')}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${openMenu === 'metric' ? ORANGE : BORDER}`, background: openMenu === 'metric' ? `${ORANGE}0A` : 'transparent', fontSize: 11, color: openMenu === 'metric' ? ORANGE : MUTED, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, userSelect: 'none' }}>
                {metricLabel} ▾
              </div>
              {openMenu === 'metric' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 4, zIndex: 50, minWidth: 152, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}>
                  {METRIC_OPTS.map(opt => (
                    <div key={opt.key} onClick={() => { setMetric(opt.key); setOpenMenu(null) }}
                      style={{ padding: '8px 11px', borderRadius: 7, fontSize: 12, fontWeight: metric === opt.key ? 700 : 500, color: metric === opt.key ? ORANGE : TEXT, background: metric === opt.key ? `${ORANGE}08` : 'transparent', cursor: 'pointer' }}>
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Period dropdown */}
            <div style={{ position: 'relative' }}>
              <div onClick={() => setOpenMenu(openMenu === 'period' ? null : 'period')}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${openMenu === 'period' ? ORANGE : BORDER}`, background: openMenu === 'period' ? `${ORANGE}0A` : 'transparent', fontSize: 11, color: openMenu === 'period' ? ORANGE : MUTED, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, userSelect: 'none' }}>
                {activePeriod.label} ▾
              </div>
              {openMenu === 'period' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 4, zIndex: 50, minWidth: 168, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}>
                  {periodOpts.map(opt => (
                    <div key={opt.key} onClick={() => { setPeriod(opt.key); setOpenMenu(null) }}
                      style={{ padding: '8px 11px', borderRadius: 7, fontSize: 12, fontWeight: period === opt.key ? 700 : 500, color: period === opt.key ? ORANGE : TEXT, background: period === opt.key ? `${ORANGE}08` : 'transparent', cursor: 'pointer' }}>
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quarter summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 22 }}>
        {quarters.map(q => (
          <div key={q.label} style={{ background: `${q.color}08`, border: `1px solid ${q.color}22`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: q.color, letterSpacing: '0.06em' }}>{q.label}</span>
              {q.isFuture && <span style={{ fontSize: 8, fontWeight: 700, color: q.color, background: `${q.color}18`, padding: '1px 5px', borderRadius: 99, letterSpacing: '0.05em' }}>AI</span>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: q.isFuture ? MUTED : TEXT, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {q.isFuture ? (q.projected > 0 ? formatVal(q.projected) : '—') : (q.value > 0 ? formatVal(q.value) : '—')}
            </div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
              {q.isFuture ? 'projected' : `${q.count} ${q.count === 1 ? 'lead' : 'leads'}`}
            </div>
          </div>
        ))}
      </div>

      {/* Dot-matrix chart — viewBox fills full width */}
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H + 50}`} style={{ width: '100%', display: 'block' }}>
        {/* Quarter background bands */}
        {[0, 1, 2, 3].map(qi => (
          <rect key={qi} x={qi * 3 * COL_W} y={0} width={3 * COL_W} height={CHART_H}
            fill={Q_COLORS[qi]} opacity={0.04} rx={6} />
        ))}

        {/* Dots */}
        {months.map((m, col) => {
          const isProj   = col > curMonthIdx
          const val      = isProj ? getProjVal(projPipeline[col], projCount[col]) : getMonthVal(m)
          const filled   = Math.round((val / maxVal) * ROWS)
          const isActive   = col === activeMonth
          const inFocus    = focusSet.has(col)
          const outOfFocus = !inFocus && period !== 'year'
          const qColor     = Q_COLORS[Math.floor(col / 3)]
          const cx       = col * COL_W + COL_W / 2

          return (
            <g key={col} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredMonth(col)}
              onMouseLeave={() => setHoveredMonth(null)}>
              {isActive && (
                <rect x={col * COL_W + 5} y={0} width={COL_W - 10} height={CHART_H}
                  rx={8} fill={qColor} opacity={0.13} />
              )}

              {Array.from({ length: ROWS }, (_, row) => {
                const cy    = CHART_H - row * ROW_H - DOT_R
                const isFill = row < filled
                const delay  = (ROWS - row) * 0.03 + col * 0.012
                return (
                  <circle key={row} cx={cx} cy={cy} r={DOT_R}
                    fill={isFill ? qColor : '#EEF2F5'}
                    opacity={animated
                      ? (outOfFocus ? (isFill ? 0.12 : 0.25) : (isFill ? (isProj ? 0.38 : (isActive ? 1 : 0.8)) : (isProj ? 0.45 : 0.9)))
                      : 0}
                    style={{ transition: `opacity 0.42s ease ${delay}s` }}
                  />
                )
              })}

              {/* Pip label — flip below dot when near top edge to avoid clipping */}
              {isActive && val > 0 && (() => {
                const topY   = CHART_H - filled * ROW_H - DOT_R
                const flip   = topY < 34
                const rectY  = flip ? topY + DOT_R + 4 : topY - 26
                const textY  = flip ? topY + DOT_R + 17 : topY - 12
                const txt    = isProj ? `~${formatVal(val)}` : formatVal(val)
                const lblW   = txt.length * 7.5 + 16
                const lblX   = Math.min(Math.max(cx - lblW / 2, 2), CHART_W - lblW - 2)
                return (
                  <>
                    <rect x={lblX} y={rectY} width={lblW} height={22} rx={6}
                      fill={isProj ? 'none' : qColor}
                      stroke={isProj ? qColor : 'none'}
                      strokeWidth={isProj ? 1.5 : 0}
                      strokeDasharray={isProj ? '4 2' : 'none'}
                    />
                    <text x={lblX + lblW / 2} y={textY} textAnchor="middle"
                      fontSize="11" fontWeight="700" fill={isProj ? qColor : 'white'}>
                      {txt}
                    </text>
                  </>
                )
              })()}

              {/* Month label */}
              <text x={cx} y={CHART_H + 20} textAnchor="middle" fontSize="13"
                fill={isActive ? TEXT : (isProj ? LABEL : MUTED)}
                fontWeight={isActive ? '700' : '500'}
                opacity={outOfFocus ? 0.3 : (isProj ? 0.65 : 1)}>
                {m.label}
              </text>
            </g>
          )
        })}

        {/* Quarter labels */}
        {[0, 1, 2, 3].map(qi => (
          <text key={qi} x={qi * 3 * COL_W + (3 * COL_W) / 2} y={CHART_H + 40}
            textAnchor="middle" fontSize="11" fontWeight="800"
            fill={Q_COLORS[qi]} letterSpacing="0.08em">
            {`Q${qi + 1}`}
          </text>
        ))}

        {/* AI Projected divider */}
        {curMonthIdx < 11 && (() => {
          const x = (curMonthIdx + 1) * COL_W
          return (
            <>
              <line x1={x} y1={4} x2={x} y2={CHART_H - 4}
                stroke={ORANGE} strokeWidth={1} strokeDasharray="4 3" opacity={0.35} />
              <rect x={x - 24} y={CHART_H / 2 - 8} width={48} height={16} rx={4}
                fill={ORANGE} opacity={0.1} />
              <text x={x} y={CHART_H / 2 + 2} textAnchor="middle"
                fontSize="7" fontWeight="800" fill={ORANGE} letterSpacing="0.08em">
                AI PROJ
              </text>
            </>
          )
        })()}
      </svg>

      {/* AI Projection banner */}
      {yearEnd > 0 && (
        <div style={{ marginTop: 16, background: `${ORANGE}07`, border: `1px solid ${ORANGE}1E`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: ORANGE_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingUp style={{ width: 15, height: 15, color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>AI Year-End Projection</div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Based on current pipeline velocity &amp; stage conversion rates</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 28 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: ORANGE, letterSpacing: '-0.03em', lineHeight: 1 }}>{formatPipeline(yearEnd)}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>Projected pipeline</div>
                </div>
                <div style={{ width: 1, background: BORDER }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: EMERALD, letterSpacing: '-0.03em', lineHeight: 1 }}>{projClosures} deals</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>Est. closures · {formatPipeline(projCloseVal)}</div>
                </div>
              </div>
              <button
                onClick={() => setShowReasoning(r => !r)}
                style={{ padding: '6px 11px', borderRadius: 8, border: `1px solid ${ORANGE}40`, background: showReasoning ? `${ORANGE}14` : 'transparent', color: ORANGE, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13 }}>✦</span>
                {showReasoning ? 'Hide reasoning' : 'How is this calculated?'}
              </button>
            </div>
          </div>

          {/* AI Reasoning breakdown */}
          {showReasoning && (() => {
            const daysLeft  = reasoning.daysInCur - Math.floor(reasoning.fraction * reasoning.daysInCur)
            const hotCount  = hotLeads.length
            const cr        = Math.max(closeRate, 0.15)
            return (
              <div style={{ borderTop: `1px solid ${ORANGE}1A`, padding: '14px 18px', background: `${ORANGE}04` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE, marginBottom: 10, letterSpacing: '0.06em' }}>HOW AI ARRIVES AT THIS NUMBER</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  {[
                    {
                      label: 'Current month pace',
                      value: formatPipeline(reasoning.curMonthPace),
                      note: `${Math.round(reasoning.fraction * 100)}% of the month elapsed — extrapolated to full month`,
                    },
                    {
                      label: 'Historical monthly avg',
                      value: formatPipeline(reasoning.avgPipe),
                      note: `Average across ${reasoning.monthsWithData} month${reasoning.monthsWithData !== 1 ? 's' : ''} with actual data`,
                    },
                    {
                      label: 'Blended base (60/40)',
                      value: formatPipeline(reasoning.pipeBase),
                      note: '60% current month pace + 40% historical avg — reduces recency bias',
                    },
                    {
                      label: 'Monthly growth applied',
                      value: '+3.5% / month',
                      note: `${daysLeft} days left this month · projected ${11 - curMonthIdx} more month${11 - curMonthIdx !== 1 ? 's' : ''} compounding`,
                    },
                    {
                      label: 'Hot leads in pipeline',
                      value: `${hotCount} lead${hotCount !== 1 ? 's' : ''}`,
                      note: 'Leads with intent score ≥ 70 — used for closure estimate',
                    },
                    {
                      label: 'Estimated close rate',
                      value: `${Math.round(cr * 100)}%`,
                      note: closeRate < 0.15
                        ? `Historical rate ${Math.round(closeRate * 100)}% — floored at 15% minimum`
                        : `Based on your historical ${Math.round(closeRate * 100)}% close rate`,
                    },
                  ].map(row => (
                    <div key={row.label} style={{ background: `${ORANGE}06`, border: `1px solid ${ORANGE}18`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: MUTED, fontWeight: 500, marginBottom: 3 }}>{row.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>{row.value}</div>
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>{row.note}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 10, color: MUTED, lineHeight: 1.5 }}>
                  <span style={{ color: ORANGE, fontWeight: 600 }}>Formula: </span>
                  Blended base × (1.035)^months remaining + actual pipeline to date = <span style={{ fontWeight: 700, color: TEXT }}>{formatPipeline(yearEnd)}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Animated ring KPI ────────────────────────────────────────────────────────
function AnimatedRing({ value, max = 100, color, label, display }: {
  value: number; max?: number; color: string; label: string; display?: string
}) {
  const [go, setGo] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGo(true), 180); return () => clearTimeout(t) }, [])
  const SIZE = 92, R = 34
  const C = 2 * Math.PI * R
  const pct = Math.min(value / Math.max(max, 1), 1)
  const offset = C * (1 - (go ? pct : 0))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={`${color}1A`} strokeWidth={9} />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={color} strokeWidth={9}
            strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <span style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{display ?? value}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textAlign: 'center', maxWidth: 74, lineHeight: 1.35 }}>{label}</span>
    </div>
  )
}

// ─── 7-day lead sparkline ──────────────────────────────────────────────────────
function WeekSparkline({ days }: { days: Array<{ label: string; count: number }> }) {
  const [go, setGo] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGo(true), 380); return () => clearTimeout(t) }, [])
  const peak = Math.max(...days.map(d => d.count), 1)
  const BAR_H = 48
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
      {days.map((d, i) => {
        const targetH = d.count > 0 ? Math.max((d.count / peak) * BAR_H, 8) : 4
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: d.count > 0 ? ORANGE : 'transparent', minHeight: 14, transition: `opacity 0.4s ${i * 0.07 + 0.6}s`, opacity: go && d.count > 0 ? 1 : 0 }}>
              {d.count || ''}
            </span>
            <div style={{ width: '100%', height: BAR_H, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', height: targetH,
                background: d.count > 0 ? ORANGE : '#EEF2F5',
                borderRadius: 5,
                transform: `scaleY(${go ? 1 : 0.04})`,
                transformOrigin: 'bottom',
                transition: `transform 0.8s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s`,
              }} />
            </div>
            <span style={{ fontSize: 9, color: LABEL, fontWeight: 600 }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Lead Age chart ───────────────────────────────────────────────────────────
const AGE_BUCKETS = [
  { label: 'Fresh',   min: 0,  max: 1,   color: '#059669', bg: 'rgba(5,150,105,0.10)',   desc: 'Today'       },
  { label: 'Recent',  min: 1,  max: 7,   color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  desc: '1–7 days'    },
  { label: 'Ageing',  min: 7,  max: 30,  color: '#FF7043', bg: 'rgba(255,112,67,0.10)',  desc: '8–30 days'   },
  { label: 'Stale',   min: 30, max: 90,  color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   desc: '31–90 days'  },
  { label: 'Cold',    min: 90, max: Infinity, color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)', desc: '90+ days' },
]

function useCountUp(target: number, duration = 900, delay = 0) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf: number
    let start: number | null = null
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts
        const p = Math.min((ts - start) / duration, 1)
        const ease = 1 - Math.pow(1 - p, 3) // ease-out cubic
        setVal(Math.round(ease * target))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf) }
  }, [target, duration, delay])
  return val
}

function LeadAge({ leads }: { leads: CRMLead[] }) {
  const [animated, setAnimated] = useState(false)
  const now = Date.now()

  useEffect(() => { const t = setTimeout(() => setAnimated(true), 80); return () => clearTimeout(t) }, [])

  const buckets = useMemo(() => AGE_BUCKETS.map(b => {
    const items = leads.filter(l => {
      const days = (now - new Date(l.createdAt).getTime()) / 86_400_000
      return days >= b.min && days < b.max && l.status !== 'Closed'
    })
    const pipe = items.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0)
    return { ...b, count: items.length, pipe }
  }), [leads])

  const total    = buckets.reduce((s, b) => s + b.count, 0)
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  const allLeads = leads.filter(l => l.status !== 'Closed')
  const avgAge   = allLeads.length
    ? Math.round(allLeads.reduce((s, l) => s + (now - new Date(l.createdAt).getTime()) / 86_400_000, 0) / allLeads.length)
    : 0

  const avgAgeAnim = useCountUp(avgAge, 800, 100)

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Lead Age</span>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>How long leads have been in pipeline</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: avgAge > 30 ? '#EF4444' : avgAge > 7 ? ORANGE : EMERALD, letterSpacing: '-0.03em', transition: 'color 0.4s' }}>
            {avgAgeAnim}d
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>avg age</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {buckets.map((b, i) => {
          const targetW = b.count > 0 ? (b.count / maxCount) * 100 : 0
          return (
            <div key={b.label} style={{ opacity: animated ? 1 : 0, transform: animated ? 'translateX(0)' : 'translateX(-8px)', transition: `opacity 0.35s ease ${i * 0.07}s, transform 0.35s ease ${i * 0.07}s` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, flexShrink: 0,
                    boxShadow: b.count > 0 ? `0 0 0 3px ${b.color}25` : 'none',
                    transition: `box-shadow 0.3s ease ${i * 0.07 + 0.2}s` }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{b.label}</span>
                  <span style={{ fontSize: 10, color: MUTED }}>{b.desc}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {b.pipe > 0 && <span style={{ fontSize: 10, color: MUTED }}>{formatPipeline(b.pipe)}</span>}
                  <span style={{ fontSize: 11, fontWeight: 700,
                    color: b.count > 0 ? b.color : MUTED,
                    background: b.count > 0 ? b.bg : 'transparent',
                    padding: '1px 7px', borderRadius: 99, minWidth: 22, textAlign: 'center',
                    transition: `transform 0.2s ease ${i * 0.07 + 0.3}s`,
                    transform: animated && b.count > 0 ? 'scale(1)' : 'scale(0.7)',
                  }}>
                    {b.count}
                  </span>
                </div>
              </div>
              {/* Bar track */}
              <div style={{ height: 6, background: '#F0F2F5', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: `linear-gradient(90deg, ${b.color}cc, ${b.color})`,
                  width: animated ? `${targetW}%` : '0%',
                  transition: `width 0.75s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.09 + 0.15}s`,
                  boxShadow: b.count > 0 ? `0 1px 4px ${b.color}50` : 'none',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: MUTED }}>{total} open leads tracked</span>
        <Link href="/dashboard/leads" style={{ fontSize: 11, fontWeight: 600, color: ORANGE, textDecoration: 'none' }}>View all →</Link>
      </div>
    </div>
  )
}

// ─── Market Pulse strip ───────────────────────────────────────────────────────
interface NewsItem { title: string; link: string; pubDate: string; tag: string | null; source: string }

const TAG_CFG: Record<string, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  stamp_duty:     { label: 'Stamp Duty',         color: '#EF4444', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)',   Icon: Receipt    },
  property_stats: { label: 'Property Stats',     color: '#6366F1', bg: 'rgba(99,102,241,0.07)',  border: 'rgba(99,102,241,0.2)',  Icon: IndianRupee },
  rental:         { label: 'Rental Market',      color: '#14B8A6', bg: 'rgba(20,184,166,0.07)',  border: 'rgba(20,184,166,0.2)',  Icon: Home       },
  policy:         { label: 'Policy Update',      color: '#3B82F6', bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.2)',  Icon: Landmark   },
  sales_jump:     { label: 'Sales Jump',         color: '#059669', bg: 'rgba(5,150,105,0.07)',   border: 'rgba(5,150,105,0.2)',   Icon: TrendingUp },
  demand_surge:   { label: 'Enquiries Spike',    color: '#F59E0B', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)',  Icon: TrendingUp },
  new_launch:     { label: 'New Project Launch', color: '#8B5CF6', bg: 'rgba(139,92,246,0.07)',  border: 'rgba(139,92,246,0.2)',  Icon: MapPin     },
  micro_market:   { label: 'Micro Market Trend', color: '#FF7043', bg: 'rgba(255,112,67,0.07)',  border: 'rgba(255,112,67,0.2)',  Icon: MapPin     },
}

const REFRESH_MS = 3 * 60 * 60 * 1000 // 3 hours

function MarketPulse() {
  const [items, setItems]     = useState<NewsItem[]>([])
  const [idx, setIdx]         = useState(0)
  const [fade, setFade]       = useState(true)
  const [hovered, setHovered] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [refreshing, setRefreshing]   = useState(false)

  const loadNews = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const d: NewsItem[] = await fetch('/api/market-news', { cache: 'no-store' }).then(r => r.json())
      setItems(d)
      setIdx(0)
      setLastFetched(new Date())
    } catch { /* keep existing items */ } finally {
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => { loadNews() }, [loadNews])

  // Auto-refresh every 3 hours
  useEffect(() => {
    const t = setInterval(() => loadNews(true), REFRESH_MS)
    return () => clearInterval(t)
  }, [loadNews])

  // Auto-cycle every 6s, pause on hover
  useEffect(() => {
    if (items.length < 2 || hovered) return
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => { setIdx(i => (i + 1) % items.length); setFade(true) }, 280)
    }, 6000)
    return () => clearInterval(t)
  }, [items.length, hovered])

  const go = (dir: 1 | -1) => {
    setFade(false)
    setTimeout(() => { setIdx(i => (i + dir + items.length) % items.length); setFade(true) }, 280)
  }

  // Deduplicate insight chips — one per tag category, max 3
  const insights = Object.entries(
    items.reduce<Record<string, NewsItem>>((acc, it) => {
      if (it.tag && !acc[it.tag]) acc[it.tag] = it
      return acc
    }, {})
  ).slice(0, 3)

  const current = items[idx]

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '13px 18px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>

      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.25)', animation: refreshing ? 'none' : 'pulse-dot 2s ease infinite' }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Pulse</span>
        {lastFetched && (
          <span style={{ fontSize: 9, color: LABEL, fontWeight: 500 }}>
            · {lastFetched.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={() => loadNews()}
          title="Refresh news"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', color: MUTED, display: 'flex', borderRadius: 4, opacity: refreshing ? 0.4 : 0.7 }}>
          <Newspaper style={{ width: 11, height: 11, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: BORDER, flexShrink: 0 }} />

      {/* Headline ticker */}
      <div
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}>
        {items.length === 0 ? (
          <span style={{ fontSize: 12, color: MUTED }}>Loading market news…</span>
        ) : (
          <>
            <a
              href={current?.link ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.color = ORANGE
                el.style.textDecoration = 'underline'
                el.style.textDecorationColor = `${ORANGE}60`
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.color = TEXT
                el.style.textDecoration = 'none'
              }}
              style={{
                fontSize: 12.5, fontWeight: 500, color: TEXT,
                textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                opacity: fade ? 1 : 0, transition: 'opacity 0.28s ease',
                cursor: 'pointer',
              }}>
              {current?.title}
            </a>
            {current?.link && current.link !== '#' && (
              <a href={current.link} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexShrink: 0, color: MUTED, opacity: fade ? 0.7 : 0, transition: 'opacity 0.28s ease' }}>
                <ExternalLink style={{ width: 11, height: 11 }} />
              </a>
            )}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => go(-1)} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: MUTED }}>
                <ChevronLeft style={{ width: 12, height: 12 }} />
              </button>
              <button onClick={() => go(1)} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: MUTED }}>
                <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            </div>
            <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>{idx + 1}/{items.length}</span>
          </>
        )}
      </div>

      {/* Insight chips */}
      {insights.length > 0 && (
        <>
          <div style={{ width: 1, height: 22, background: BORDER, flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {insights.map(([tag, item]) => {
              const cfg = TAG_CFG[tag]
              if (!cfg) return null
              return (
                <a
                  key={tag}
                  href={item.link !== '#' ? item.link : undefined}
                  target={item.link !== '#' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, cursor: 'pointer' }}>
                    <cfg.Icon style={{ width: 11, height: 11, color: cfg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
                  </div>
                </a>
              )
            })}
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 3px rgba(239,68,68,0.25); }
          50%       { box-shadow: 0 0 0 5px rgba(239,68,68,0.08); }
        }
      `}</style>
    </div>
  )
}

export default function DashboardPage() {
  const [leads,   setLeads]   = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/crm/leads?limit=200')
      .then(r => r.json())
      .then(d => { setLeads(d.data?.leads ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const dateStr = useMemo(() =>
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }), [])

  const metrics = useMemo(() => {
    const now   = Date.now()
    const week  = 7 * 86400_000
    const month = 30 * 86400_000
    const total  = leads.length
    const hot    = leads.filter(l => getScore(l) >= 70)
    const warm   = leads.filter(l => getScore(l) >= 40 && getScore(l) < 70)
    const thisWk = leads.filter(l => now - new Date(l.createdAt).getTime() < week)
    const thisMo = leads.filter(l => now - new Date(l.createdAt).getTime() < month)
    const pipe   = leads.reduce((s, l) => s + (l.budgetMax ?? 0), 0)
    const closed = leads.filter(l => l.status === 'Closed')
    const avgIntent     = total > 0 ? Math.round(leads.reduce((s, l) => s + getScore(l), 0) / total) : 0
    const closedRate    = total > 0 ? Math.round((closed.length / total) * 100) : 0
    const contactedPct  = total > 0 ? Math.round((leads.filter(l => l.phones.primaryPhoneNumber).length / total) * 100) : 0
    return { total, hot: hot.length, warm: warm.length, thisWk: thisWk.length, thisMo: thisMo.length, pipe, closed: closed.length, avgIntent, closedRate, contactedPct }
  }, [leads])

  const funnelStages = useMemo(() => {
    return Object.entries(FUNNEL_CFG)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([stage, cfg]) => {
        const sl = leads.filter(l => (l.status ?? 'New') === stage)
        return {
          name: stage,
          count: sl.length,
          budget: sl.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0),
          topColor: cfg.top,
          botColor: cfg.bot,
        }
      })
  }, [leads])

  const sourceData = useMemo(() => {
    const m: Record<string, number> = {}
    leads.forEach(l => { const s = sourceLabel(l.sourcePortal); m[s] = (m[s] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value]) => ({ name, value }))
  }, [leads])

  const weeklyLeads = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    const count = leads.filter(l => {
      const t = new Date(l.createdAt).getTime()
      return t >= d.getTime() && t < next.getTime()
    }).length
    return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }), count }
  }), [leads])

  const hotLeads = useMemo(() =>
    [...leads].filter(l => getScore(l) >= 60).sort((a, b) => getScore(b) - getScore(a)).slice(0, 5),
    [leads])

  // Live Pulse — follow-up overdue: hot leads created 48h+ ago, not closed
  const overdueHot = useMemo(() =>
    leads.filter(l =>
      getScore(l) >= 70 &&
      l.status !== 'Closed' &&
      Date.now() - new Date(l.createdAt).getTime() > 48 * 3600_000
    ), [leads])

  // Top priority: highest-scoring open lead
  const topPriority = useMemo(() =>
    [...leads]
      .filter(l => getScore(l) >= 60 && l.status !== 'Closed')
      .sort((a, b) => getScore(b) - getScore(a))[0] ?? null,
    [leads])

  const recent = useMemo(() =>
    [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4),
    [leads])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: BG, gap: 12 }}>
      <Loader2 style={{ width: 20, height: 20, color: ORANGE, animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14, color: MUTED }}>Loading dashboard…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '-0.04em' }}>{greeting}, Abhishek 👋</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: '5px 0 0', fontWeight: 400 }}>{dateStr} · Here&apos;s your pipeline overview</p>
          </div>

          {/* ── Live Pulse chips ──────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* 1 — Follow-up overdue */}
            {overdueHot.length > 0 && (
              <Link href="/dashboard/leads" style={{ textDecoration: 'none' }}>
                <div
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = `${ORANGE}16` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = `${ORANGE}09` }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', background: `${ORANGE}09`, border: `1px solid ${ORANGE}28`, borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: ORANGE, boxShadow: `0 0 0 3px ${ORANGE}30`, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE, whiteSpace: 'nowrap' }}>
                    {overdueHot.length} hot {overdueHot.length === 1 ? 'lead' : 'leads'} need follow-up
                  </span>
                </div>
              </Link>
            )}

            {/* 2 — Top priority lead */}
            {topPriority && (
              <Link href={`/dashboard/leads/${topPriority.id}`} style={{ textDecoration: 'none' }}>
                <div
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${ORANGE}40`; (e.currentTarget as HTMLDivElement).style.background = `${ORANGE}06` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = BORDER; (e.currentTarget as HTMLDivElement).style.background = PANEL }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: AMBER, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap' }}>{getName(topPriority)}</span>
                  <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>· {getScore(topPriority)} score · {formatPipeline(topPriority.budgetMax ?? topPriority.budgetMin ?? 0)}</span>
                </div>
              </Link>
            )}

            {/* 3 — Weekly momentum */}
            {metrics.thisWk > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 12 }}>
                <TrendingUp style={{ width: 13, height: 13, color: EMERALD, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: EMERALD, whiteSpace: 'nowrap' }}>+{metrics.thisWk} leads this week</span>
              </div>
            )}

          </div>
        </div>

        {/* ── Market Pulse ────────────────────────────────────────────────────── */}
        <MarketPulse />

        {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
        <div style={{
          borderRadius: 20, border: '1px solid #E8ECF0', padding: '20px', marginBottom: 24,
          background: [
            'radial-gradient(ellipse 55% 80% at 95% 10%, rgba(255,200,180,0.55) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 70% at 5%  90%, rgba(255,230,160,0.50) 0%, transparent 70%)',
            'radial-gradient(ellipse 55% 70% at 50% 50%, rgba(190,215,255,0.65) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 55% at 75% 95%, rgba(170,230,210,0.40) 0%, transparent 65%)',
            '#ffffff',
          ].join(', '),
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}
            className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard icon={Users}       label="Total Leads"     value={metrics.total}  sub={`+${metrics.thisWk} this week`}          accent={ACCENT}  trend={metrics.thisWk > 0 ? { up: true, label: `+${metrics.thisWk} this wk` } : undefined} />
            <KPICard icon={Flame}       label="Hot Leads"       value={metrics.hot}    sub="Intent score 70+"                         accent={ORANGE}  trend={metrics.hot > 0 ? { up: true, label: 'High priority' } : undefined} />
            <KPICard icon={IndianRupee} label="Pipeline Value"  value={formatPipeline(metrics.pipe)} sub="Combined budgets"           accent={EMERALD} />
            <KPICard icon={TrendingUp}  label="Deals"    value={metrics.closed} sub={`${metrics.thisMo} leads this month`}     accent={AMBER}   trend={metrics.closed > 0 ? { up: true, label: `${metrics.closed} won` } : undefined} />
          </div>
        </div>

        {/* ── Sales Pipeline Funnel ───────────────────────────────────────────── */}
        <div style={{
          borderRadius: 16, border: '1px solid #E8ECF0', padding: '22px 24px', marginBottom: 20,
          background: [
            'radial-gradient(ellipse 50% 90% at 0%   0%,  rgba(255,200,180,0.50) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 80% at 100% 100%, rgba(170,230,210,0.45) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 70% at 60%  0%,  rgba(190,215,255,0.40) 0%, transparent 65%)',
            'radial-gradient(ellipse 35% 60% at 20%  100%, rgba(255,230,160,0.40) 0%, transparent 65%)',
            '#ffffff',
          ].join(', '),
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Pipeline Funnel</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{leads.length} leads across all stages</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: '-0.04em', lineHeight: 1 }}>{formatPipeline(metrics.pipe)}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>Total pipeline value</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: '-0.03em', marginTop: 8, lineHeight: 1 }}>{leads.length}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Total leads</div>
            </div>
          </div>

          <PipelineFunnelChart stages={funnelStages} />

          {/* Stage labels */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${funnelStages.filter(s => s.count > 0).length || 1}, 1fr)`, marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
            {funnelStages.filter(s => s.count > 0).map((s, i, arr) => (
              <div key={s.name} style={{ padding: '0 12px', borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.topColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{s.name}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>{formatPipeline(s.budget)}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{s.count} {s.count === 1 ? 'lead' : 'leads'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Analytical Insight Strip ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
          {[
            { label: 'Avg Intent Score', value: metrics.avgIntent, unit: '/100', sub: 'Lead quality index', accent: ORANGE },
            { label: 'Active Pipeline',  value: metrics.warm + metrics.hot, unit: ' leads', sub: 'Warm + Hot combined', accent: ACCENT },
            { label: 'Conversion Rate',  value: `${metrics.closedRate}%`, unit: '', sub: 'New → Closed', accent: EMERALD },
            { label: 'Contact Coverage', value: `${metrics.contactedPct}%`, unit: '', sub: 'Leads with phone', accent: AMBER },
          ].map((item, i, arr) => (
            <div key={i} style={{ padding: '20px 22px', borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: item.accent, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {item.value}<span style={{ fontSize: 14, fontWeight: 500, color: MUTED, letterSpacing: 0 }}>{item.unit}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginTop: 7 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* ── 2-column grid ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

          {/* Left column — stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Lead Sources */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Lead Sources</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Where your leads come from</div>
              </div>
              <LeadSourceDonut data={sourceData} />
            </div>

          </div>{/* end left column */}

          {/* Right column — Quick Actions + Today's Priority */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <LeadAge leads={leads} />
          </div>
        </div>

        {/* ── Revenue Analytics — full width ──────────────────────────────────── */}
        <div style={{ marginTop: 20 }}>
          <RevenueAnalytics leads={leads} />
        </div>

        {/* ── Hot Leads — Priority Follow-ups ─────────────────────────────────── */}
        {hotLeads.length > 0 && (
          <div style={{ marginTop: 20, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ORANGE, boxShadow: `0 0 0 3px ${ORANGE_DIM}` }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Priority Follow-ups</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: ORANGE, background: ORANGE_DIM, padding: '2px 8px', borderRadius: 99 }}>{hotLeads.length} hot</span>
              </div>
              <Link href="/dashboard/leads" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: ORANGE, fontWeight: 600, textDecoration: 'none' }}>
                View all <ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 100px 120px', gap: 0, padding: '10px 24px', background: '#FAFBFC', borderBottom: `1px solid ${BORDER}` }}>
              {['Lead', 'Contact', 'Source', 'Score', 'Status'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>

            {hotLeads.map((lead, i) => {
              const av    = avatarColor(getName(lead))
              const score = getScore(lead)
              const status = lead.status ?? 'New'
              const STATUS_CFG: Record<string, { bg: string; color: string }> = {
                New:          { bg: '#EEF2FF', color: '#4338CA' },
                Cold:         { bg: '#E0F2FE', color: '#0369A1' },
                Warm:         { bg: '#FFF7ED', color: '#C2410C' },
                Hot:          { bg: '#FFEDE8', color: '#C2410C' },
                Closed:       { bg: '#ECFDF5', color: '#059669' },
                Disqualified: { bg: '#F3F4F6', color: '#6B7280' },
              }
              const pill = STATUS_CFG[status] ?? STATUS_CFG.New
              return (
                <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 100px 120px', gap: 0, padding: '14px 24px', borderBottom: i < hotLeads.length - 1 ? `1px solid ${BORDER}` : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = BG)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {/* Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: av.fg }}>{getInitials(lead)}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{getName(lead)}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>{timeAgo(lead.createdAt)}</div>
                      </div>
                    </div>
                    {/* Contact */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                      <span style={{ fontSize: 12, color: TEXT }}>{lead.emails.primaryEmail || '—'}</span>
                      <span style={{ fontSize: 11, color: MUTED }}>{lead.phones.primaryPhoneNumber || '—'}</span>
                    </div>
                    {/* Source */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: MUTED }}>{sourceLabel(lead.sourcePortal)}</span>
                    </div>
                    {/* Score */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: '#F0F2F5', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${score}%`, height: '100%', background: score >= 70 ? ORANGE : score >= 40 ? AMBER : ACCENT, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: score >= 70 ? ORANGE : MUTED, minWidth: 24, textAlign: 'right' }}>{score}</span>
                    </div>
                    {/* Status */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: pill.color, background: pill.bg, padding: '4px 10px', borderRadius: 99 }}>
                        {status}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
