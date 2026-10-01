'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  CircleNotch, CaretRight, CaretLeft,
  Newspaper, MapPin, Receipt, Bank, House, TrendUp, CurrencyInr,
} from '@phosphor-icons/react'
import { getRole } from '@/lib/plan'
import { LiveActivityFeed } from '@/components/LiveActivityFeed'

// ─── Design tokens ──────────────────────────────────────────────────────────────
const BG     = '#eef0f6'
const PANEL  = '#ffffff'
const BORDER = '#dfe2ed'
const TEXT   = '#0f1729'
const MUTED  = '#5c6479'
const LABEL  = '#9aa2b8'
const MONO   = "'JetBrains Mono', monospace"

const BLUE     = '#1D4ED8'
const BLUE_L   = '#3B82F6'
const BLUE_DIM = 'rgba(29,78,216,0.08)'
const EMERALD  = '#10b981'
const AMBER    = '#f59e0b'
const RED_C    = '#f43f5e'

// ─── Avatar palette ─────────────────────────────────────────────────────────────
const PALETTE = [
  { bg: '#dbeafe', fg: '#1D4ED8' }, { bg: '#fef3c7', fg: '#B45309' },
  { bg: '#dcfce7', fg: '#15803d' }, { bg: '#ede9fe', fg: '#6D28D9' },
  { bg: '#fce7f3', fg: '#BE185D' }, { bg: '#e0f2fe', fg: '#0369A1' },
  { bg: '#fff7ed', fg: '#C2410C' }, { bg: '#f3e8ff', fg: '#7C3AED' },
]
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % PALETTE.length
  return PALETTE[Math.abs(h)]
}

// ─── CRM types & helpers ────────────────────────────────────────────────────────
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
  escalated: boolean
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

function useCountUp(target: number, duration = 900, delay = 0) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf: number, start: number | null = null
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts
        const p = Math.min((ts - start) / duration, 1)
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf) }
  }, [target, duration, delay])
  return val
}

// ─── Card shell ──────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: '0 1px 2px rgba(15,23,41,.04)', ...style }}>
      {children}
    </div>
  )
}

// ─── Section title helper ────────────────────────────────────────────────────────
function CardTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 13, fontWeight: 600, color: TEXT, lineHeight: 1 }}>{children}</div>
      {sub && <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11, fontWeight: 400, color: MUTED, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

// ─── KPI cards ───────────────────────────────────────────────────────────────────
function KPISparkline({ vals }: { vals: number[] }) {
  if (vals.length < 2) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const W = 120, H = 24
  const x = (i: number) => (i / (vals.length - 1)) * W
  const y = (v: number) => H - ((v - min) / Math.max(max - min, 1)) * (H - 4) - 2
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block', marginTop: 12 }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function KPIMicroBars({ vals, color }: { vals: number[]; color: string }) {
  const max = Math.max(...vals, 1)
  return (
    <div style={{ display: 'flex', gap: 3, height: 24, alignItems: 'flex-end', marginTop: 12 }}>
      {vals.map((v, i) => (
        <div key={i} style={{ flex: 1, height: `${Math.max((v / max) * 100, 12)}%`, background: color, borderRadius: 2, opacity: 0.7 + (v / max) * 0.3 }} />
      ))}
    </div>
  )
}

function KPICard({
  title, value, sub, badge, badgeColor, badgeBg,
  accent, accentBg, dark, children,
}: {
  title: string; value: string | number; sub?: string
  badge?: string; badgeColor?: string; badgeBg?: string
  accent?: string; accentBg?: string; dark?: boolean
  children?: React.ReactNode
}) {
  return (
    <div style={{ background: dark ? 'linear-gradient(150deg,#101832 0%,#1c2750 100%)' : PANEL, border: dark ? 'none' : `1px solid ${BORDER}`, borderRadius: 16, padding: 16, boxShadow: dark ? 'none' : '0 1px 2px rgba(15,23,41,.04)', position: 'relative', overflow: 'hidden' }}>
      {dark && <div style={{ position: 'absolute', right: -40, top: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(29,78,216,.55),transparent 70%)', pointerEvents: 'none' }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: accentBg ?? BLUE_DIM, display: 'grid', placeItems: 'center' }}>
          {dark && <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 14, color: '#a8b1cc' }}>₹</span>}
        </div>
        {badge && (
          <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, fontWeight: 600, color: badgeColor, background: badgeBg, padding: '4px 7px', borderRadius: 99 }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ marginTop: 14, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 26, fontWeight: 700, letterSpacing: -.8, color: dark ? '#fff' : TEXT, lineHeight: 1, position: 'relative' }}>
        {value}
      </div>
      <div style={{ marginTop: 5, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11.5, fontWeight: 500, color: dark ? '#a8b1cc' : MUTED, position: 'relative' }}>
        {title}{sub && <span style={{ color: dark ? '#7f89a8' : LABEL, fontWeight: 400 }}>{sub}</span>}
      </div>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

// ─── Pipeline area chart ─────────────────────────────────────────────────────────
type RangeKey = '1W' | '1M' | '6M' | '1Y'

function smooth(pts: Array<{ x: number; y: number }>) {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function PipelineChart({ leads }: { leads: CRMLead[] }) {
  const [range, setRange] = useState<RangeKey>('1Y')
  const [hover, setHover] = useState(9)
  const year = new Date().getFullYear()

  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => {
    const start = new Date(year, m, 1).getTime(), end = new Date(year, m + 1, 0, 23, 59, 59).getTime()
    const ml = leads.filter(l => { const t = new Date(l.createdAt).getTime(); return t >= start && t <= end })
    return { label: new Date(year, m, 1).toLocaleDateString('en-IN', { month: 'short' }), value: ml.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0) }
  }), [leads, year])

  const { labels, vals } = useMemo(() => {
    if (range === '1Y') return { labels: months.map(m => m.label), vals: months.map(m => m.value || 15_000_000 + Math.random() * 40_000_000) }
    if (range === '6M') { const s = months.slice(6); return { labels: s.map(m => m.label), vals: s.map(m => m.value || 20_000_000 + Math.random() * 60_000_000) } }
    if (range === '1M') return { labels: ['W1','W2','W3','W4'], vals: Array.from({length:4}, () => 10_000_000 + Math.random() * 40_000_000) }
    return { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], vals: Array.from({length:7}, () => 5_000_000 + Math.random() * 25_000_000) }
  }, [range, months])

  const totalVal = vals.reduce((s, v) => s + v, 0)
  const hi = Math.min(hover, vals.length - 1)
  const W = 760, bot = 196, top = 14
  const max = Math.max(...vals) * 1.08, min = Math.min(...vals) * 0.7
  const step = vals.length > 1 ? W / (vals.length - 1) : W
  const yFn = (v: number) => bot - ((v - min) / Math.max(max - min, 1)) * (bot - top)
  const pts  = vals.map((v, i) => ({ x: i * step, y: yFn(v) }))
  const fpts = vals.map((v, i) => ({ x: i * step, y: yFn(v * 0.93 * (1 + (i - vals.length / 2) * 0.012)) }))
  const hx = pts[hi]?.x ?? 0, hy = pts[hi]?.y ?? 0

  return (
    <Card style={{ padding: '18px 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <CardTitle>Pipeline movement</CardTitle>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 22, fontWeight: 700, letterSpacing: -.6, color: TEXT }}>{formatPipeline(totalVal)}</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11, fontWeight: 600, color: EMERALD }}>+22%</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11, color: LABEL }}>vs prior {range === '1Y' ? 'year' : range === '6M' ? '6 mo' : range === '1M' ? 'month' : 'week'}</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, background: '#f1f3f9', border: '1px solid #e5e8f1', borderRadius: 9, padding: 3 }}>
          {(['1W','1M','6M','1Y'] as RangeKey[]).map(r => (
            <button key={r} onClick={() => { setRange(r); setHover(99) }}
              style={{ border: 0, cursor: 'pointer', padding: '5px 10px', borderRadius: 7, fontFamily: MONO, fontSize: 10.5, fontWeight: 600, background: range === r ? '#fff' : 'transparent', color: range === r ? TEXT : LABEL, boxShadow: range === r ? '0 1px 3px rgba(15,23,41,.1)' : 'none' }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 12 }}>
        <svg viewBox="0 0 760 236" style={{ width: '100%', height: 210, display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="lgcArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={BLUE} stopOpacity=".22" />
              <stop offset="1" stopColor={BLUE} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g stroke="#eef0f6" strokeWidth="1">
            {[10,62,114,166,200].map(y => <line key={y} x1="0" y1={y} x2="760" y2={y} />)}
          </g>
          <path d={smooth(pts) + ` L${W},200 L0,200 Z`} fill="url(#lgcArea)" />
          <path d={smooth(pts)} fill="none" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={smooth(fpts)} fill="none" stroke="#c8d0e8" strokeWidth="1.8" strokeDasharray="5 5" strokeLinecap="round" />
          <line x1={hx.toFixed(1)} y1="0" x2={hx.toFixed(1)} y2="200" stroke={BLUE} strokeWidth="1" strokeDasharray="3 4" opacity=".4" />
          <circle cx={hx.toFixed(1)} cy={hy.toFixed(1)} r="5.5" fill="#fff" stroke={BLUE} strokeWidth="2.5" />
          {vals.map((_, i) => (
            <rect key={i} x={(i * step - step / 2).toFixed(1)} y="0" width={step.toFixed(1)} height="200"
              fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHover(i)} />
          ))}
          {vals.map((_, i) => (
            <text key={i} x={(i * step).toFixed(1)} y="224" textAnchor="middle" fill={LABEL} style={{ font: `500 10px ${MONO}` }}>
              {labels[i]}
            </text>
          ))}
        </svg>
        {/* Tooltip */}
        <div style={{ position: 'absolute', left: `${(hx / W * 100).toFixed(2)}%`, top: `${(hy / 236 * 100).toFixed(2)}%`, transform: 'translate(-50%,-115%)', background: '#0f1729', color: '#fff', borderRadius: 10, padding: '8px 12px', boxShadow: '0 8px 24px rgba(15,23,41,.28)', pointerEvents: 'none' }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: '#8b94b3', letterSpacing: '.06em' }}>{labels[hi]?.toUpperCase()}</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 14, fontWeight: 700, marginTop: 4 }}>{formatPipeline(vals[hi] ?? 0)}</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 9.5, color: '#6ee7b7', marginTop: 4 }}>trending up</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 12, marginTop: 4, borderTop: '1px solid #eef0f6' }}>
        {[{ label: 'Created pipeline', color: BLUE, dashed: false }, { label: 'Forecast', color: '#c8d0e8', dashed: false }].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 500, color: MUTED }}>
            <span style={{ width: 14, height: 2.5, borderRadius: 2, background: l.color, display: 'block' }} />
            {l.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <Link href="/dashboard/analytics" style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>Open report →</Link>
      </div>
    </Card>
  )
}

// ─── Calendar widget ─────────────────────────────────────────────────────────────
const DEMO_DAYS = [
  { dow: 'Sun', n: 24 }, { dow: 'Mon', n: 25 }, { dow: 'Tue', n: 26 },
  { dow: 'Wed', n: 27 }, { dow: 'Thu', n: 28 }, { dow: 'Fri', n: 29 }, { dow: 'Sat', n: 30 },
]
const DEMO_EVENTS: Record<number, Array<{ hour: string; title?: string; range?: string; tone?: string; people?: string[]; action?: string; free?: boolean }>> = {
  27: [
    { hour: '9 am', title: 'Pipeline stand-up', range: '9.00 – 9.30 am', tone: BLUE, people: ['AR','NK','SM','+4'], action: 'Google Meet' },
    { hour: '10 am', free: true },
    { hour: '11 am', title: 'Site visit — Priya Sharma', range: '11.30 am – 12.30 pm', tone: AMBER, people: ['PS','AR'], action: 'Sobha Neopolis' },
    { hour: '12 pm', title: 'Callback — Rohit Mehra', range: '12.45 – 1.15 pm', tone: BLUE },
  ],
  26: [
    { hour: '9 am', free: true },
    { hour: '10 am', title: 'Builder review — DLF', range: '10.00 – 11.00 am', tone: BLUE, people: ['AR','VG'], action: 'On Slack' },
    { hour: '11 am', title: 'Docs due — Aditi Nair', range: '11.15 – 11.45 am', tone: RED_C },
    { hour: '12 pm', free: true },
  ],
}
const FALLBACK_EVENTS = [
  { hour: '9 am', free: true },
  { hour: '10 am', title: 'Follow-up block', range: '10.00 – 11.00 am', tone: BLUE },
  { hour: '11 am', free: true },
  { hour: '12 pm', title: 'Team forecast lock', range: '12.00 – 12.45 pm', tone: '#7c5cfc', people: ['AR','NK'], action: 'On Slack' },
]
const MONTHS_LIST = ['January','February','March','April','May','June','July','August','September','October','November','December']

function CalendarWidget() {
  const today = new Date().getDate()
  const [day, setDay] = useState(today)
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth())
  const events = DEMO_EVENTS[day] ?? FALLBACK_EVENTS

  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, width: 332 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <CardTitle>Calendar</CardTitle>
        <button onClick={() => setMonthIdx(m => (m + 1) % 12)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 10px', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11, fontWeight: 500, color: '#3c4459', cursor: 'pointer' }}>
          {MONTHS_LIST[monthIdx]} <span style={{ color: LABEL, fontSize: 9 }}>▾</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 2, paddingBottom: 6, borderBottom: '1px solid #eef0f6' }}>
        {DEMO_DAYS.map(d => {
          const on = d.n === day
          return (
            <button key={d.n} onClick={() => setDay(d.n)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: '4px 0 0', cursor: 'pointer', borderRadius: 6 }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 9.5, fontWeight: 500, color: LABEL }}>{d.dow}</span>
              <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? TEXT : LABEL }}>{d.n}</span>
              <span style={{ width: 18, height: 2, borderRadius: 2, background: on ? BLUE : 'transparent', display: 'block' }} />
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'stretch', minHeight: e.free ? 44 : (e.people ? 94 : 60) }}>
            <div style={{ width: 38, flexShrink: 0, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, color: LABEL, paddingTop: 2 }}>{e.hour}</div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
              {e.free ? (
                <div style={{ height: '100%', border: '1px dashed #e2e6f2', borderRadius: 9, display: 'flex', alignItems: 'center', padding: '0 10px', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 500, color: '#a8afc2', cursor: 'pointer' }}>
                  Available · book slot
                </div>
              ) : (
                <div style={{ border: '1px solid #e8ebf4', borderLeft: `2.5px solid ${e.tone ?? BLUE}`, borderRadius: 9, padding: '9px 11px', background: '#fbfcfe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.tone ?? BLUE, flexShrink: 0, display: 'block' }} />
                    <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11.5, fontWeight: 600, flex: 1, color: TEXT }}>{e.title}</span>
                  </div>
                  {e.range && <div style={{ fontFamily: MONO, fontSize: 10, color: '#7c8499', marginTop: 5, paddingLeft: 12 }}>{e.range}</div>}
                  {e.people && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, paddingLeft: 12 }}>
                      <div style={{ display: 'flex' }}>
                        {e.people.map((p, pi) => (
                          <span key={pi} style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 8.5, fontWeight: 700, color: '#3c4459', background: ['#e3e9fb','#fdeacd','#e7e2fb','#f1f3f9'][pi % 4], border: '2px solid #fff', marginLeft: pi ? -7 : 0 }}>{p}</span>
                        ))}
                      </div>
                      <div style={{ flex: 1 }} />
                      <span style={{ border: `1px solid ${BORDER}`, background: '#fff', borderRadius: 7, padding: '4px 8px', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, fontWeight: 600, color: '#3c4459', cursor: 'pointer', whiteSpace: 'nowrap' }}>{e.action} ›</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Pipeline funnel (horizontal bars, tabbed) ────────────────────────────────────
type FunnelTab = 'Status' | 'Source' | 'Budget'
const STAGE_COLORS: Record<string, string> = {
  New: BLUE, Cold: BLUE_L, Warm: AMBER, Hot: '#1D4ED8', Closed: EMERALD,
  '< ₹50 L': '#94a3b8', '₹50 L – 1 Cr': BLUE, '₹1 – 2 Cr': BLUE_L, '₹2 – 5 Cr': AMBER, '₹5 Cr +': EMERALD,
}

function FunnelCard({ leads }: { leads: CRMLead[] }) {
  const [tab, setTab] = useState<FunnelTab>('Status')

  const stages = useMemo(() => {
    if (tab === 'Status') {
      return ['New','Cold','Warm','Hot','Closed'].map(name => {
        const sl = leads.filter(l => (l.status ?? 'New') === name)
        return { name, count: sl.length, pipeline: sl.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0) }
      }).filter(s => s.count > 0)
    }
    if (tab === 'Source') {
      const m: Record<string, { count: number; pipeline: number }> = {}
      leads.forEach(l => {
        const s = sourceLabel(l.sourcePortal)
        if (!m[s]) m[s] = { count: 0, pipeline: 0 }
        m[s].count++; m[s].pipeline += l.budgetMax ?? l.budgetMin ?? 0
      })
      return Object.entries(m).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([name, v]) => ({ name, ...v }))
    }
    const buckets = [
      { name: '< ₹50 L',      filter: (l: CRMLead) => (l.budgetMax ?? 0) < 5_000_000 },
      { name: '₹50 L – 1 Cr', filter: (l: CRMLead) => { const b = l.budgetMax ?? 0; return b >= 5_000_000 && b < 10_000_000 } },
      { name: '₹1 – 2 Cr',    filter: (l: CRMLead) => { const b = l.budgetMax ?? 0; return b >= 10_000_000 && b < 20_000_000 } },
      { name: '₹2 – 5 Cr',    filter: (l: CRMLead) => { const b = l.budgetMax ?? 0; return b >= 20_000_000 && b < 50_000_000 } },
      { name: '₹5 Cr +',      filter: (l: CRMLead) => (l.budgetMax ?? 0) >= 50_000_000 },
    ]
    return buckets.map(b => {
      const sl = leads.filter(b.filter)
      return { name: b.name, count: sl.length, pipeline: sl.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0) }
    }).filter(s => s.count > 0)
  }, [leads, tab])

  const max = Math.max(...stages.map(s => s.count), 1)

  return (
    <Card style={{ padding: '18px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CardTitle>Pipeline funnel</CardTitle>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, background: '#f1f3f9', border: '1px solid #e5e8f1', borderRadius: 9, padding: 3 }}>
          {(['Status','Source','Budget'] as FunnelTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ border: 0, cursor: 'pointer', padding: '5px 11px', borderRadius: 7, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11, fontWeight: 600, background: tab === t ? '#fff' : 'transparent', color: tab === t ? TEXT : LABEL, boxShadow: tab === t ? '0 1px 3px rgba(15,23,41,.1)' : 'none' }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11, fontWeight: 400, color: MUTED, marginTop: 5 }}>{leads.length} leads across stages</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
        {stages.map(s => {
          const w = Math.max(12, (s.count / max) * 100)
          const inside = w > 42
          const color = STAGE_COLORS[s.name] ?? BLUE
          return (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 96, flexShrink: 0, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11.5, fontWeight: 500, color: '#3c4459' }}>{s.name}</div>
              <div style={{ flex: 1, height: 30, borderRadius: 8, background: '#f4f5f9', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: 30, width: `${w}%`, borderRadius: 8, background: `linear-gradient(90deg,${color},${color}cc)`, transition: 'width .35s cubic-bezier(.4,0,.2,1)' }} />
                <span style={{ position: 'absolute', top: 0, height: 30, left: inside ? 0 : `calc(${w}% + 10px)`, width: inside ? `${w}%` : undefined, display: 'flex', alignItems: 'center', justifyContent: inside ? 'flex-end' : 'flex-start', paddingRight: inside ? 10 : 0, fontFamily: MONO, fontSize: 10, color: inside ? 'rgba(255,255,255,.9)' : '#7c8499' }}>
                  {formatPipeline(s.pipeline)}
                </span>
              </div>
              <div style={{ width: 40, flexShrink: 0, textAlign: 'right', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 12, fontWeight: 600, color: TEXT }}>{s.count}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Lead sources donut ───────────────────────────────────────────────────────────
const DONUT_COLORS = [BLUE, '#7c5cfc', AMBER, EMERALD, RED_C, '#94a3b8']

function LeadSourceDonut({ leads }: { leads: CRMLead[] }) {
  const data = useMemo(() => {
    const m: Record<string, number> = {}
    leads.forEach(l => { const s = sourceLabel(l.sourcePortal); m[s] = (m[s] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, value]) => ({ name, value }))
  }, [leads])

  const total = data.reduce((s, d) => s + d.value, 0)
  const C = 2 * Math.PI * 38
  let acc = 0
  const slices = data.map((d, i) => {
    const len = (d.value / Math.max(total, 1)) * C
    const item = { name: d.name, pct: total > 0 ? Math.round((d.value / total) * 100) : 0, color: DONUT_COLORS[i % DONUT_COLORS.length], dash: `${len.toFixed(1)} ${(C - len).toFixed(1)}`, offset: (-acc).toFixed(1) }
    acc += len; return item
  })

  return (
    <Card style={{ padding: 16, width: 332, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CardTitle>Lead sources</CardTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f3f9" strokeWidth="16" />
          {slices.map((s, i) => (
            <circle key={i} cx="50" cy="50" r="38" fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={s.dash} strokeDashoffset={s.offset} strokeLinecap="butt" />
          ))}
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0, display: 'block' }} />
              <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11.5, fontWeight: 500, color: '#3c4459', flex: 1 }}>{s.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: TEXT }}>{s.pct}%</span>
            </div>
          ))}
          {slices.length === 0 && <span style={{ fontSize: 11, color: LABEL }}>No data yet</span>}
        </div>
      </div>
      <div style={{ paddingTop: 12, borderTop: '1px solid #eef0f6' }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, color: MUTED, lineHeight: 1.5 }}>
          Portals drive most leads, but referrals convert 2× better.
        </span>
      </div>
    </Card>
  )
}

// ─── Retention rate chart ─────────────────────────────────────────────────────────
const RETENTION_DATA = {
  labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul'],
  series: [
    { name: 'Sub-₹1 Cr', color: '#5fb3f5' },
    { name: '₹1–3 Cr',   color: BLUE },
    { name: '₹3 Cr +',   color: '#132a63' },
  ],
  vals: [[82,58,32],[95,72,40],[68,45,26],[86,55,34],[92,50,22],[74,48,30],[97,70,42]],
}

function RetentionChart() {
  const [hiGroup, setHiGroup] = useState(6)
  const R = RETENTION_DATA
  const gw = 700 / R.labels.length
  const bars: Array<{ x: string; y: string; h: string; color: string; opacity: number }> = []
  const groups: Array<{ label: string; cx: string; zx: string; zw: string; zoneFill: string; labelFill: string }> = []

  R.vals.forEach((trio, g) => {
    const base = g * gw + gw / 2 - 14
    trio.forEach((v, s) => {
      const h = (v / 100) * 140
      bars.push({ x: (base + s * 10).toFixed(1), y: (156 - h).toFixed(1), h: h.toFixed(1), color: R.series[s].color, opacity: g === hiGroup ? 1 : 0.35 })
    })
    groups.push({
      label: R.labels[g], cx: (g * gw + gw / 2).toFixed(1),
      zx: (g * gw + 2).toFixed(1), zw: (gw - 4).toFixed(1),
      zoneFill: g === hiGroup ? '#f6f8fd' : 'transparent',
      labelFill: g === hiGroup ? '#0f1729' : '#9aa2b8',
    })
  })

  const focusTrio = R.vals[hiGroup]
  const headline = `${focusTrio[0]}%`

  return (
    <Card style={{ padding: '18px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <CardTitle>Retention rate</CardTitle>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 22, fontWeight: 700, letterSpacing: -.6, color: TEXT }}>{headline}</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11, fontWeight: 600, color: EMERALD }}>+12%</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11, color: LABEL }}>vs last month</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingTop: 2 }}>
          {R.series.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 500, color: MUTED }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'block', flexShrink: 0 }} />
              {s.name}
            </div>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 700 176" style={{ width: '100%', height: 160, display: 'block' }}>
        <g stroke="#f1f3f9" strokeWidth="1">
          {[20,60,100,140].map(y => <line key={y} x1="0" y1={y} x2="700" y2={y} />)}
        </g>
        {groups.map((g, gi) => (
          <rect key={gi} x={g.zx} y="0" width={g.zw} height="156" rx="6" fill={g.zoneFill}
            style={{ cursor: 'pointer' }} onMouseEnter={() => setHiGroup(gi)} />
        ))}
        {bars.map((b, bi) => (
          <rect key={bi} x={b.x} y={b.y} width="8" height={b.h} rx="4" fill={b.color} opacity={b.opacity}
            style={{ pointerEvents: 'none', transition: 'opacity .2s' }} />
        ))}
        {groups.map((g, gi) => (
          <text key={gi} x={g.cx} y="172" textAnchor="middle" fill={g.labelFill}
            style={{ font: `500 10px ${MONO}`, pointerEvents: 'none' }}>
            {g.label}
          </text>
        ))}
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid #eef0f6', marginTop: 4, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: LABEL, letterSpacing: '.06em', textTransform: 'uppercase' }}>{R.labels[hiGroup]} retention</span>
        {R.series.map((s, i) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 500, color: TEXT }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'block', flexShrink: 0 }} />
            {s.name} <span style={{ fontFamily: MONO, fontWeight: 600 }}>{focusTrio[i]}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Top customer locations ───────────────────────────────────────────────────────
const LOCATIONS = [
  { rank: 1, name: 'Gurugram',           meta: '51 leads · ₹109 Cr', pct: 48, hue: BLUE },
  { rank: 2, name: 'Noida Extension',    meta: '33 leads · ₹71 Cr',  pct: 31, hue: '#7c5cfc' },
  { rank: 3, name: 'Dwarka Expressway',  meta: '15 leads · ₹32 Cr',  pct: 21, hue: AMBER },
  { rank: 4, name: 'Greater Faridabad',  meta: '7 leads · ₹16 Cr',   pct: 9,  hue: EMERALD },
]

function TopLocations() {
  return (
    <Card style={{ padding: 16, width: 332, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CardTitle>Top customer locations</CardTitle>

      {/* Map placeholder */}
      <div style={{ position: 'relative', borderRadius: 10, border: `1px solid #e8ebf4`, background: 'repeating-linear-gradient(135deg,#f4f6fb 0 8px,#eaeef7 8px 16px)', height: 130, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 16px' }}>
          <div>
            <MapPin size={20} weight="light" color={LABEL} />
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: '#8d95ab', letterSpacing: '.06em', marginTop: 6, lineHeight: 1.5 }}>NCR HEAT MAP<br />connect map asset here</div>
          </div>
        </div>
        {/* Zoom controls */}
        <div style={{ position: 'absolute', left: 8, top: 8, display: 'flex', flexDirection: 'column', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
          {['+','−'].map((s, i) => (
            <span key={i} style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 13, fontWeight: 600, color: '#3c4459', cursor: 'pointer', borderBottom: i === 0 ? `1px solid #eef0f6` : 'none' }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Location list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {LOCATIONS.map(l => (
          <div key={l.rank} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: LABEL, width: 12, flexShrink: 0 }}>{l.rank}</span>
            <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, background: `${l.hue}1f`, border: `1px solid ${l.hue}55`, display: 'block' }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 12, fontWeight: 600, color: TEXT }}>{l.name}</span>
              <span style={{ display: 'block', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, color: LABEL, marginTop: 2 }}>{l.meta}</span>
            </span>
            <span style={{ width: 52, height: 5, borderRadius: 5, background: '#f1f3f9', overflow: 'hidden', flexShrink: 0 }}>
              <span style={{ display: 'block', height: 5, width: `${l.pct * 2}%`, maxWidth: '100%', borderRadius: 5, background: l.hue }} />
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: TEXT, width: 30, textAlign: 'right' }}>{l.pct}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Hot leads table ──────────────────────────────────────────────────────────────
const STAGE_TONE: Record<string, [string, string]> = {
  New: ['#eef1ff','#3547b8'], Cold: ['#eef1ff','#3547b8'],
  Warm: ['#fff4e2','#b45309'], Hot: ['#fff4e2','#b45309'],
  Negotiation: ['#f3edff','#5b3bd1'], Closed: ['#e2fbef','#047857'],
}

function HotLeadsTable({ leads }: { leads: CRMLead[] }) {
  const hotLeads = useMemo(() =>
    [...leads].filter(l => getScore(l) >= 60).sort((a, b) => getScore(b) - getScore(a)).slice(0, 5), [leads])
  if (hotLeads.length === 0) return null
  const pendingCount = leads.filter(l => getScore(l) >= 70 && l.status !== 'Closed').length

  return (
    <Card style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        <CardTitle>Hot leads needing follow-up</CardTitle>
        <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, fontWeight: 600, color: '#b45309', background: '#fef3c7', padding: '4px 7px', borderRadius: 99 }}>{pendingCount} pending</span>
        <div style={{ flex: 1 }} />
        <Link href="/dashboard/leads" style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>View all leads →</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.4fr .9fr .9fr 1fr .8fr', padding: '0 20px 8px', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: LABEL }}>
        {['LEAD','PROJECT','BUDGET','INTENT','STAGE','LAST TOUCH'].map(h => <span key={h}>{h}</span>)}
      </div>

      {hotLeads.map((lead, i) => {
        const av    = avatarColor(getName(lead))
        const score = getScore(lead)
        const stage = lead.status ?? 'New'
        const tone  = STAGE_TONE[stage] ?? ['#f1f3f9','#3c4459']
        const budget = lead.budgetMax ?? lead.budgetMin ?? 0
        const scoreColor = score >= 85 ? RED_C : score >= 75 ? AMBER : BLUE

        return (
          <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.4fr .9fr .9fr 1fr .8fr', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #f1f3f9', cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fd')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: av.bg, color: av.fg, display: 'grid', placeItems: 'center', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 700 }}>
                  {getInitials(lead)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 12, fontWeight: 600, color: TEXT }}>{getName(lead)}</span>
                  <span style={{ display: 'block', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, color: LABEL, marginTop: 2 }}>{lead.phones.primaryPhoneNumber ?? '—'}</span>
                </span>
              </div>
              <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11.5, fontWeight: 500, color: '#3c4459' }}>{sourceLabel(lead.sourcePortal)}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: TEXT }}>{budget > 0 ? formatPipeline(budget) : '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 36, height: 5, borderRadius: 5, background: '#f1f3f9', overflow: 'hidden', display: 'block' }}>
                  <span style={{ display: 'block', height: 5, width: `${score}%`, borderRadius: 5, background: scoreColor }} />
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: TEXT }}>{score}</span>
              </span>
              <span style={{ justifySelf: 'start', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 600, background: tone[0], color: tone[1], padding: '5px 9px', borderRadius: 99 }}>
                {stage}
              </span>
              <span style={{ textAlign: 'right', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, color: MUTED }}>
                {timeAgo(lead.updatedAt || lead.createdAt)}
              </span>
            </div>
          </Link>
        )
      })}
    </Card>
  )
}

// ─── Market Pulse (dark banner) ───────────────────────────────────────────────────
const TAG_CFG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  stamp_duty:     { label: 'Stamp Duty',    color: RED_C,    Icon: Receipt  },
  property_stats: { label: 'Property',      color: BLUE_L,   Icon: CurrencyInr },
  rental:         { label: 'Rental',        color: '#14B8A6',Icon: House    },
  policy:         { label: 'Policy',        color: BLUE_L,   Icon: Bank     },
  sales_jump:     { label: 'Sales',         color: EMERALD,  Icon: TrendUp  },
  demand_surge:   { label: 'Enquiries',     color: AMBER,    Icon: TrendUp  },
  new_launch:     { label: 'New Launch',    color: '#8B5CF6',Icon: MapPin   },
  micro_market:   { label: 'Micro Market',  color: BLUE,     Icon: MapPin   },
}

interface NewsItem { title: string; link: string; pubDate: string; tag: string | null; source: string }

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
      setItems(d); setIdx(0); setLastFetched(new Date())
    } catch { /* keep existing */ } finally { setRefreshing(false) }
  }, [])

  useEffect(() => { loadNews() }, [loadNews])
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

  const insights = Object.entries(
    items.reduce<Record<string, NewsItem>>((acc, it) => { if (it.tag && !acc[it.tag]) acc[it.tag] = it; return acc }, {})
  ).slice(0, 2)

  const current = items[idx]
  if (items.length === 0 && !refreshing) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(90deg,#101832 0%,#1a2447 55%,#20305e 100%)', borderRadius: 12, padding: '13px 16px', color: '#fff', overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED_C, animation: 'lgcpulse 1.4s ease-in-out infinite', display: 'block' }} />
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.12em' }}>MARKET PULSE</span>
        {lastFetched && <span style={{ fontFamily: MONO, fontSize: 10, color: '#8b94b3' }}>{lastFetched.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
        <button onClick={() => loadNews()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b94b3', display: 'flex', opacity: refreshing ? 0.4 : 0.8 }}>
          <Newspaper size={10} weight="light" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.16)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        {items.length === 0
          ? <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 12, color: '#8b94b3' }}>Loading…</span>
          : <a href={current?.link ?? '#'} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 12.5, fontWeight: 500, color: '#fff', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', opacity: fade ? 1 : 0, transition: 'opacity .28s ease' }}>
              {current?.title}
            </a>
        }
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button onClick={() => go(-1)} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <CaretLeft size={10} weight="light" />
        </button>
        <span style={{ fontFamily: MONO, fontSize: 10, color: '#8b94b3', minWidth: 28, textAlign: 'center' }}>{idx + 1}/{items.length}</span>
        <button onClick={() => go(1)} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <CaretRight size={10} weight="light" />
        </button>
        {insights.map(([tag, item]) => {
          const cfg = TAG_CFG[tag]; if (!cfg) return null
          return (
            <a key={tag} href={item.link !== '#' ? item.link : undefined} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', background: 'rgba(59,92,255,.28)', border: '1px solid rgba(122,146,255,.5)', color: '#c7d2ff', borderRadius: 7, whiteSpace: 'nowrap' }}>
                <cfg.Icon size={10} weight="light" />
                <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, fontWeight: 600 }}>{cfg.label}</span>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ─── Action queue ─────────────────────────────────────────────────────────────────
const ACTION_BUCKETS: { label: string; desc: string; color: string; bg: string; filter: (l: CRMLead) => boolean }[] = [
  { label: 'Unattended', desc: 'First contact needed', color: AMBER, bg: 'rgba(245,158,11,0.09)', filter: l => l.status === 'New' || !l.status },
  { label: 'Cold',       desc: 'Not responding',       color: '#64748B', bg: 'rgba(100,116,139,0.09)', filter: l => l.status === 'Cold' },
  { label: 'Follow Up',  desc: 'Warm or hot — act now',color: BLUE, bg: BLUE_DIM, filter: l => l.status === 'Warm' || l.status === 'Hot' || l.escalated === true },
]

function ActionQueue({ leads, escalatedCount }: { leads: CRMLead[]; escalatedCount: number }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 80); return () => clearTimeout(t) }, [])

  const buckets = useMemo(() => {
    const open = leads.filter(l => l.status !== 'Closed' && l.status !== 'Disqualified')
    return ACTION_BUCKETS.map(b => {
      const items = open.filter(b.filter)
      return { ...b, count: items.length, pipe: items.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0) }
    })
  }, [leads])

  const total = buckets.reduce((s, b) => s + b.count, 0)
  const max   = Math.max(...buckets.map(b => b.count), 1)
  const totalAnim = useCountUp(total, 800, 100)

  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <CardTitle sub="Leads that need attention">Action Queue</CardTitle>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: total > 20 ? RED_C : total > 5 ? BLUE : EMERALD, letterSpacing: '-.03em' }}>{totalAnim}</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, color: MUTED }}>need action</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {buckets.map((b, i) => (
          <div key={b.label} style={{ opacity: animated ? 1 : 0, transform: animated ? 'none' : 'translateX(-8px)', transition: `opacity .35s ease ${i * .07}s, transform .35s ease ${i * .07}s` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color, boxShadow: b.count > 0 ? `0 0 0 2.5px ${b.color}25` : 'none' }} />
                <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11.5, fontWeight: 500, color: TEXT }}>{b.label}</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10, color: MUTED }}>{b.desc}</span>
                {b.label === 'Follow Up' && escalatedCount > 0 && (
                  <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 9, fontWeight: 600, color: '#D97706', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', padding: '1px 5px', borderRadius: 2, letterSpacing: '.03em', textTransform: 'uppercase' }}>
                    {escalatedCount} from team
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {b.pipe > 0 && <span style={{ fontFamily: MONO, fontSize: 9.5, color: MUTED }}>{formatPipeline(b.pipe)}</span>}
                <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: b.count > 0 ? b.color : MUTED, background: b.count > 0 ? b.bg : 'transparent', padding: '1px 6px', borderRadius: 99, minWidth: 20, textAlign: 'center' }}>{b.count}</span>
              </div>
            </div>
            <div style={{ height: 5, background: '#f4f5f9', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg,${b.color}cc,${b.color})`, width: animated ? `${(b.count / max) * 100}%` : '0%', transition: `width .75s cubic-bezier(.34,1.56,.64,1) ${i * .09 + .15}s` }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, color: MUTED }}>{total} leads need action</span>
        <Link href="/dashboard/leads" style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>View all →</Link>
      </div>
    </Card>
  )
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [leads,   setLeads]   = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [role,    setRole]    = useState<string>('admin')

  useEffect(() => {
    const sync = () => setRole(getRole())
    sync(); window.addEventListener('plan-changed', sync)
    return () => window.removeEventListener('plan-changed', sync)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = role === 'admin' ? '?limit=200&include_escalated=true' : '?limit=200'
    fetch(`/api/crm/leads${params}`)
      .then(r => r.json())
      .then(d => { setLeads(d.data?.leads ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [role])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }, [])

  const dateStr = useMemo(() =>
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase(), [])

  const metrics = useMemo(() => {
    const now = Date.now(), week = 7 * 86400_000, month = 30 * 86400_000
    const total  = leads.length
    const hot    = leads.filter(l => getScore(l) >= 70).length
    const thisWk = leads.filter(l => now - new Date(l.createdAt).getTime() < week).length
    const pipe   = leads.reduce((s, l) => s + (l.budgetMax ?? 0), 0)
    const closed = leads.filter(l => l.status === 'Closed').length
    return { total, hot, thisWk, pipe, closed }
  }, [leads])

  const escalatedCount = useMemo(() => leads.filter(l => l.escalated === true).length, [leads])

  const overdueHot = useMemo(() =>
    leads.filter(l => getScore(l) >= 70 && l.status !== 'Closed' && Date.now() - new Date(l.createdAt).getTime() > 48 * 3600_000), [leads])

  const topPriority = useMemo(() =>
    [...leads].filter(l => getScore(l) >= 60 && l.status !== 'Closed').sort((a, b) => getScore(b) - getScore(a))[0] ?? null, [leads])

  const weeklyVals = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    return leads.filter(l => { const t = new Date(l.createdAt).getTime(); return t >= d.getTime() && t < next.getTime() }).length
  }), [leads])

  const hotBarVals = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    return leads.filter(l => getScore(l) >= 70 && (() => { const t = new Date(l.createdAt).getTime(); return t >= d.getTime() && t < next.getTime() })()).length
  }), [leads])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: BG, gap: 10, flexDirection: 'column' }}>
      <CircleNotch size={24} weight="light" color={BLUE} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 12, color: MUTED }}>Loading dashboard…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '22px 24px 48px' }}>

        {/* ── Greeting ───────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', color: '#7c8499', marginBottom: 7 }}>{dateStr}</div>
            <h1 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 26, fontWeight: 700, letterSpacing: -.8, color: TEXT, lineHeight: 1.15 }}>
              {greeting}, Abhishek
            </h1>
            <p style={{ margin: '6px 0 0', fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 12.5, color: MUTED, fontWeight: 400 }}>
              {overdueHot.length > 0 ? `${overdueHot.length} hot leads need follow-up` : 'Your pipeline is healthy'}
              {metrics.closed > 0 ? ` · ${metrics.closed} deal${metrics.closed !== 1 ? 's' : ''} closed` : ''}
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {overdueHot.length > 0 && (
              <Link href="/dashboard/leads" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', background: BLUE_DIM, border: `1px solid rgba(29,78,216,.25)`, borderRadius: 10, cursor: 'pointer' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE, flexShrink: 0, boxShadow: `0 0 0 2.5px rgba(29,78,216,.25)` }} />
                  <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11.5, fontWeight: 600, color: BLUE, whiteSpace: 'nowrap' }}>
                    {overdueHot.length} hot {overdueHot.length === 1 ? 'lead' : 'leads'} need follow-up
                  </span>
                </div>
              </Link>
            )}
            {topPriority && (
              <Link href={`/dashboard/leads/${topPriority.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px', boxShadow: '0 1px 2px rgba(15,23,41,.04)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: AMBER, display: 'block' }} />
                  <div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 11.5, fontWeight: 600, color: TEXT }}>{getName(topPriority)}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: LABEL }}>{getScore(topPriority)} score · {formatPipeline(topPriority.budgetMax ?? topPriority.budgetMin ?? 0)}</div>
                  </div>
                  <span style={{ marginLeft: 4, fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: 10.5, fontWeight: 600, color: BLUE }}>Call →</span>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* ── Market Pulse ────────────────────────────────────────────────────────── */}
        <MarketPulse />

        {/* ── KPI Row ─────────────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
          <KPICard title="Total leads" value={metrics.total} badge={`+${metrics.thisWk} wk`} badgeColor={MUTED} badgeBg="#f1f3f9" accentBg="#dbeafe" accent={BLUE}>
            <KPISparkline vals={weeklyVals} />
          </KPICard>
          <KPICard title="Hot leads " sub="· intent 70+" value={metrics.hot} badge="High priority" badgeColor="#b45309" badgeBg="#fef3c7" accentBg="#fff0e4" accent={AMBER}>
            <KPIMicroBars vals={hotBarVals} color={AMBER} />
          </KPICard>
          <KPICard title="Pipeline value " sub="· combined budgets" value={formatPipeline(metrics.pipe)} badge={metrics.pipe > 0 ? "active" : undefined} badgeColor="#6ee7b7" badgeBg="rgba(16,185,129,.16)" dark>
            <div style={{ marginTop: 14, height: 24, display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 5, background: 'rgba(255,255,255,.14)', overflow: 'hidden' }}>
                <div style={{ width: '74%', height: '100%', background: 'linear-gradient(90deg,#6ee7b7,#3b5cff)', borderRadius: 5 }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 10, color: '#a8b1cc' }}>74% weighted</span>
            </div>
          </KPICard>
          <KPICard title="Deals closed " sub="· this month" value={metrics.closed} badge={metrics.closed > 0 ? `+${metrics.closed} won` : undefined} badgeColor="#047857" badgeBg="#e2fbef" accentBg="#e2fbef" accent={EMERALD}>
            <div style={{ display: 'flex', gap: 4, marginTop: 12, height: 24, alignItems: 'center' }}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < Math.min(metrics.closed, 10) ? EMERALD : '#e5e8f1', display: 'block' }} />
              ))}
            </div>
          </KPICard>
        </div>

        {/* ── Pipeline chart + Calendar ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 332px', gap: 16, marginBottom: 16 }}>
          <PipelineChart leads={leads} />
          <CalendarWidget />
        </div>

        {/* ── Pipeline funnel + Lead sources ────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 332px', gap: 16, marginBottom: 16 }}>
          <FunnelCard leads={leads} />
          <LeadSourceDonut leads={leads} />
        </div>

        {/* ── Retention rate + Top locations ────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 332px', gap: 16, marginBottom: 16 }}>
          <RetentionChart />
          <TopLocations />
        </div>

        {/* ── Action Queue ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <ActionQueue leads={leads} escalatedCount={escalatedCount} />
        </div>

        {/* ── Hot Leads + Live Feed ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
          <HotLeadsTable leads={leads} />
          <LiveActivityFeed maxItems={20} />
        </div>

      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes lgcpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.8)} }
      `}</style>
    </div>
  )
}
