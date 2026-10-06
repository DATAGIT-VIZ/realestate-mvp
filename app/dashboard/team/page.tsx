'use client'

// Team (Workspace → Team): leaderboard + agent roster.
// Same tokens, cards and buttons as the Leads, Pipeline and Outreach pages (components/outreach/OutreachKit).
// Numbers come from the leads each agent owns (/api/team/stats), plus anything in the Deals table.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Plus, Minus, Trophy, Crown, UsersThree, UserPlus, TrendUp, Fire, Target, Phone, Envelope, WhatsappLogo,
  PencilSimple, Trash, MagnifyingGlass, Warning, ArrowsSplit, PhoneCall, CaretRight, Clock,
  ChartBar, Sparkle,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import {
  CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, MUTED, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, GREEN, RED, XS, DAY,
  STAGE, type StageId, type Tone, TONE,
  Avatar, Pill, Btn, inputCls, inputStyle, Field, Seg, Chip, Toggle, Select, PageHeader, Badge, StatCard, StackBar,
  Insight, EmptyState, Dialog, Toast, useToast, inr, pct, phone10, formatPhone, telHref, waHref,
} from '@/components/outreach/OutreachKit'

const WORKSPACE_TABS = [
  { label: 'Tasks', href: '/dashboard/tasks' },
  { label: 'Team',  href: '/dashboard/team', teamsOnly: true },
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface TeamMember {
  id: string
  name: string
  email?: string
  phone?: string
  role: string
  specialty_cities: string[]
  specialty_types: string[]
  monthly_target: number
  is_active: boolean
  created_at: string
}
interface Deal { id: string; assigned_to?: string | null; stage: string; deal_value?: number | null; updated_at?: string | null }
interface TaskRow { assigned_to: string | null; status: string; due_date: string }
type Period3 = { month: number; d30: number; all: number }
interface AgentAgg {
  leads: number
  byStage: Record<'New' | 'Cold' | 'Warm' | 'Hot' | 'Closed' | 'Disqualified' | 'Hold', number>
  openValue: number
  won: Period3
  lost: Period3
  quiet: number
  calls: { d7: number; d30: number }
  touches: { d7: number; d30: number }
  lastActivity: string | null
}
interface TeamStats { agents: Record<string, AgentAgg>; unassigned: number; totalLeads: number }

type Period = 'month' | 'd30' | 'all'
type Metric = 'won' | 'pipeline' | 'winRate' | 'calls' | 'target'
type View = 'leaderboard' | 'agents'

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES      = ['agent', 'senior_agent', 'manager']
const ROLE_LABEL: Record<string, string> = { agent: 'Agent', senior_agent: 'Sr. Agent', manager: 'Manager' }
const ROLE_TONE:  Record<string, Tone>   = { agent: 'blue', senior_agent: 'amber', manager: 'green' }
const CITIES     = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata', 'Surat', 'Jaipur']
const PROP_TYPES = ['1BHK', '2BHK', '3BHK', '4BHK+', 'Villa', 'Plot', 'Commercial']
const MAX_CAPACITY = 12   // pending tasks that count as a full plate

const PERIOD_LABEL: Record<Period, string> = { month: 'this month', d30: 'last 30 days', all: 'all time' }
const METRIC_LABEL: Record<Metric, string> = { won: 'Deals won', pipeline: 'Open pipeline', winRate: 'Win rate', calls: 'Calls (7 days)', target: 'Target progress' }
const MIX: StageId[] = ['New', 'Cold', 'Warm', 'Hot', 'Closed', 'Disqualified', 'Hold']
const MEDAL = [
  { label: '1st', color: '#B54708', bg: '#FFFAEB', ring: '#FEDF89' },
  { label: '2nd', color: '#475467', bg: '#F2F4F7', ring: '#D0D5DD' },
  { label: '3rd', color: '#932F19', bg: '#FEF6EE', ring: '#F9DBAF' },
]

const BLANK: Partial<TeamMember> = {
  name: '', email: '', phone: '', role: 'agent',
  specialty_cities: [], specialty_types: [], monthly_target: 5, is_active: true,
}

// One row per agent, everything the leaderboard and the cards need
interface Row {
  m: TeamMember
  leads: number
  open: number
  pipeline: number
  won: number
  lost: number
  winRate: number
  wonMonth: number
  target: number
  targetPct: number
  calls7: number
  touches7: number
  quiet: number
  mix: Record<StageId, number>
  dealsActive: number
  tasks: { total: number; today: number; overdue: number }
  lastActivity: string | null
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
// Local calendar day (toISOString would give the UTC day, which is yesterday before 5:30 am in India)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function ago(iso: string | null, now: number) {
  if (!iso || !now) return null
  const ms = now - new Date(iso).getTime()
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))}m ago`
  if (ms < DAY) return `${Math.round(ms / 3_600_000)}h ago`
  const d = Math.round(ms / DAY)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

function Ring({ value, max, size = 56, stroke = 6, color = BLUE, children }: {
  value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode
}) {
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
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  )
}

function Meter({ value, max, color = BLUE, height = 6 }: { value: number; max: number; color?: string; height?: number }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: '#F2F4F7' }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}

function AgentAvatar({ m, size = 40 }: { m: TeamMember; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={m.name} size={size} />
      <span title={m.is_active ? 'Active' : 'Inactive'} className="absolute -bottom-0.5 -right-0.5 rounded-full"
        style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26), background: m.is_active ? GREEN : '#D0D5DD', boxShadow: '0 0 0 2px #fff' }} />
    </span>
  )
}

function RolePill({ role }: { role: string }) {
  return <Pill small tone={ROLE_TONE[role] ?? 'neutral'}>{ROLE_LABEL[role] ?? role}</Pill>
}

const targetColor = (r: Row) => (r.wonMonth >= r.target && r.target > 0 ? GREEN : BLUE)
const winColor = (w: number) => (w >= 50 ? GREEN : w >= 25 ? '#F79009' : w > 0 ? RED : '#D0D5DD')

function metricValue(r: Row, metric: Metric) {
  switch (metric) {
    case 'pipeline': return r.pipeline
    case 'winRate':  return r.winRate
    case 'calls':    return r.calls7
    case 'target':   return r.targetPct
    default:         return r.won
  }
}
function metricText(r: Row, metric: Metric) {
  switch (metric) {
    case 'pipeline': return inr(r.pipeline)
    case 'winRate':  return `${r.winRate}%`
    case 'calls':    return String(r.calls7)
    case 'target':   return `${r.targetPct}%`
    default:         return String(r.won)
  }
}

// ─── Podium (top three) ───────────────────────────────────────────────────────
function Podium({ rows, metric, period }: { rows: Row[]; metric: Metric; period: Period }) {
  if (!rows.length) return null
  return (
    <div className={`grid gap-3 ${rows.length >= 3 ? 'md:grid-cols-3' : rows.length === 2 ? 'md:grid-cols-2' : ''}`}>
      {rows.map((r, i) => {
        const md = MEDAL[i]
        const first = i === 0
        return (
          <div key={r.m.id} className={`relative flex min-w-0 flex-col overflow-hidden rounded-[18px] border bg-white ${first ? 'md:order-2' : i === 1 ? 'md:order-1' : 'md:order-3'}`}
            style={{ borderColor: first ? BLUE_LN : BORDER, boxShadow: first ? '0 12px 24px -12px rgba(29,78,216,0.28), 0 1px 2px rgba(16,24,40,0.05)' : XS }}>
            <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-bold"
                style={{ color: md.color, background: md.bg, borderColor: md.ring }}>
                {first ? <Crown size={13} weight="fill" /> : <Trophy size={13} weight="fill" />}{md.label}
              </span>
              <span className="text-[12.5px] font-medium" style={{ color: SUBTLE }}>{METRIC_LABEL[metric]}</span>
            </div>
            <div className="flex items-center gap-4 px-4 pb-4 pt-3 sm:px-5">
              <AgentAvatar m={r.m} size={first ? 56 : 48} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[17px] font-semibold leading-tight" style={{ color: TEXT }}>{r.m.name}</div>
                <div className="mt-1 flex items-center gap-1.5"><RolePill role={r.m.role} /></div>
              </div>
              <div className="text-right">
                <div className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: first ? BLUE : TEXT }}>{metricText(r, metric)}</div>
                {metric === 'won' && <div className="mt-1 text-[12px]" style={{ color: SUBTLE }}>{PERIOD_LABEL[period]}</div>}
              </div>
            </div>
            <div className="mt-auto grid grid-cols-3 border-t" style={{ borderColor: BORDER, background: SURFACE }}>
              {[
                { k: 'Pipeline', v: inr(r.pipeline) },
                { k: 'Win rate', v: `${r.winRate}%` },
                { k: 'Target', v: `${r.wonMonth}/${r.target}` },
              ].map((s, j) => (
                <div key={s.k} className="px-3 py-2.5 text-center" style={{ borderLeft: j ? `1px solid ${BORDER}` : undefined }}>
                  <div className="text-[14px] font-semibold tabular-nums" style={{ color: TEXT_2 }}>{s.v}</div>
                  <div className="text-[11.5px]" style={{ color: SUBTLE }}>{s.k}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Leaderboard table (desktop) and list (phones) ────────────────────────────
function Leaderboard({ rows, metric, period, onEdit }: { rows: Row[]; metric: Metric; period: Period; onEdit: (m: TeamMember) => void }) {
  const th = 'px-4 py-3 text-left text-[12px] font-semibold whitespace-nowrap'
  const best = Math.max(1, ...rows.map(r => metricValue(r, metric)))
  return (
    <section className="overflow-hidden rounded-[16px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS }}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: BORDER }}>
        <div>
          <h3 className="m-0 text-[16px] font-semibold" style={{ color: TEXT }}>Full ranking</h3>
          <p className="m-0 mt-0.5 text-[13px]" style={{ color: SUBTLE }}>Ranked by {METRIC_LABEL[metric].toLowerCase()}. Won, lost and win rate cover {PERIOD_LABEL[period]}.</p>
        </div>
      </header>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: SURFACE, color: SUBTLE }}>
              <th className={`${th} w-14`}>#</th>
              <th className={th}>Agent</th>
              <th className={`${th} text-right`}>Leads</th>
              <th className={`${th} text-right`}>Active</th>
              <th className={`${th} text-right`}>Pipeline</th>
              <th className={`${th} text-right`}>Won</th>
              <th className={th}>Win rate</th>
              <th className={`${th} hidden text-right xl:table-cell`}>Calls 7d</th>
              <th className={th}>vs Target</th>
              <th className={`${th} w-10`}><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.m.id} className="group border-t transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: BORDER, opacity: r.m.is_active ? 1 : 0.6 }}>
                <td className="px-4 py-3">
                  {i < 3
                    ? <span className="grid size-7 place-items-center rounded-full border text-[12px] font-bold" style={{ color: MEDAL[i].color, background: MEDAL[i].bg, borderColor: MEDAL[i].ring }}>{i + 1}</span>
                    : <span className="grid size-7 place-items-center text-[13px] font-semibold tabular-nums" style={{ color: LABEL }}>{i + 1}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <AgentAvatar m={r.m} size={36} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{r.m.name}</span>
                        {!r.m.is_active && <Pill small>Inactive</Pill>}
                      </div>
                      <div className="text-[12.5px]" style={{ color: SUBTLE }}>{ROLE_LABEL[r.m.role] ?? r.m.role}</div>
                    </div>
                  </div>
                  <div className="mt-2 max-w-[220px]"><Meter value={metricValue(r, metric)} max={best} color={i === 0 ? BLUE : '#84ADFF'} height={3} /></div>
                </td>
                <td className="px-4 py-3 text-right text-[14px] font-medium tabular-nums" style={{ color: TEXT_2 }}>{r.leads}</td>
                <td className="px-4 py-3 text-right text-[14px] font-medium tabular-nums" style={{ color: TEXT_2 }}>{r.open}</td>
                <td className="px-4 py-3 text-right text-[14px] font-semibold tabular-nums" style={{ color: TEXT }}>{inr(r.pipeline)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-[14px] font-semibold tabular-nums" style={{ color: r.won ? '#067647' : LABEL }}>
                    <Trophy size={13} weight="fill" />{r.won}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16"><Meter value={r.winRate} max={100} color={winColor(r.winRate)} /></div>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: TEXT_2 }}>{r.winRate}%</span>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-right text-[14px] font-medium tabular-nums xl:table-cell" style={{ color: r.calls7 ? TEXT_2 : LABEL }}>{r.calls7}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Ring value={r.wonMonth} max={r.target} size={30} stroke={4} color={targetColor(r)} />
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: r.wonMonth >= r.target ? '#067647' : TEXT_2 }}>{r.wonMonth}/{r.target}</span>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <button type="button" onClick={() => onEdit(r.m)} aria-label={`Edit ${r.m.name}`} title="Edit"
                    className="grid size-8 cursor-pointer place-items-center rounded-[8px] opacity-0 transition-opacity hover:bg-[#F2F4F7] focus:opacity-100 group-hover:opacity-100" style={{ color: SUBTLE }}>
                    <PencilSimple size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone list */}
      <ul className="m-0 list-none p-0 md:hidden">
        {rows.map((r, i) => (
          <li key={r.m.id} className="border-t px-4 py-3.5 first:border-t-0" style={{ borderColor: BORDER, opacity: r.m.is_active ? 1 : 0.6 }}>
            <div className="flex items-center gap-3">
              <span className="w-5 text-center text-[13px] font-bold tabular-nums" style={{ color: i < 3 ? MEDAL[i].color : LABEL }}>{i + 1}</span>
              <AgentAvatar m={r.m} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold" style={{ color: TEXT }}>{r.m.name}</div>
                <div className="text-[12.5px]" style={{ color: SUBTLE }}>{ROLE_LABEL[r.m.role] ?? r.m.role} · {r.leads} leads</div>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-semibold tabular-nums" style={{ color: i === 0 ? BLUE : TEXT }}>{metricText(r, metric)}</div>
                <div className="text-[11.5px]" style={{ color: SUBTLE }}>{METRIC_LABEL[metric]}</div>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-2 pl-8 text-center">
              {[
                { k: 'Active', v: r.open },
                { k: 'Pipeline', v: inr(r.pipeline) },
                { k: 'Won', v: r.won },
                { k: 'Target', v: `${r.wonMonth}/${r.target}` },
              ].map(s => (
                <div key={s.k} className="rounded-[8px] px-1 py-1.5" style={{ background: SURFACE }}>
                  <div className="text-[13px] font-semibold tabular-nums" style={{ color: TEXT_2 }}>{s.v}</div>
                  <div className="text-[11px]" style={{ color: SUBTLE }}>{s.k}</div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Agent card ───────────────────────────────────────────────────────────────
function AgentCard({ r, now, onEdit, onRemove, onToggle, onAssign }: {
  r: Row; now: number; onEdit: () => void; onRemove: () => void; onToggle: (v: boolean) => void; onAssign: () => void
}) {
  const { m } = r
  const loadColor = r.tasks.overdue > 0 ? RED : r.tasks.total >= 8 ? '#F79009' : GREEN
  const last = ago(r.lastActivity, now)
  const mixParts = MIX.map(s => ({ label: STAGE[s].label, value: r.mix[s] ?? 0, color: STAGE[s].dot }))
  const ph = phone10(m.phone)
  return (
    <article className="flex min-w-0 flex-col rounded-[18px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS, opacity: m.is_active ? 1 : 0.72 }}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <AgentAvatar m={m} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold leading-tight" style={{ color: TEXT }}>{m.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <RolePill role={m.role} />
            <span className="text-[12.5px]" style={{ color: SUBTLE }}>{last ? `Last active ${last}` : m.is_active ? 'No activity yet' : 'Inactive'}</span>
          </div>
        </div>
        <Toggle on={m.is_active} onChange={onToggle} label={m.is_active ? 'Active: gets new leads' : 'Inactive: no new leads'} />
      </div>

      {/* Target + workload */}
      <div className="mx-4 mt-4 grid grid-cols-[auto_1fr] items-center gap-4 rounded-[14px] border p-3.5 sm:mx-5" style={{ borderColor: BORDER, background: SURFACE }}>
        <Ring value={r.wonMonth} max={r.target} size={62} stroke={6} color={targetColor(r)}>
          <span className="text-center leading-none">
            <span className="block text-[15px] font-bold tabular-nums" style={{ color: TEXT }}>{r.wonMonth}<span className="text-[11px] font-semibold" style={{ color: SUBTLE }}>/{r.target}</span></span>
          </span>
        </Ring>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Task load</span>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: loadColor }}>{r.tasks.total} {r.tasks.total === 1 ? 'task' : 'tasks'}</span>
          </div>
          <div className="mt-1.5"><Meter value={r.tasks.total} max={MAX_CAPACITY} color={loadColor} /></div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[12px]" style={{ color: SUBTLE }}>Target {pct(r.wonMonth, r.target)}% this month</span>
            {r.tasks.today > 0 && <Pill small tone="amber"><Clock size={11} weight="bold" />{r.tasks.today} today</Pill>}
            {r.tasks.overdue > 0 && <Pill small tone="red"><Warning size={11} weight="bold" />{r.tasks.overdue} overdue</Pill>}
          </div>
        </div>
      </div>

      {/* Lead mix */}
      <div className="px-4 pt-4 sm:px-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Lead mix</span>
          <span className="text-[12.5px] tabular-nums" style={{ color: SUBTLE }}>{r.leads} leads{r.quiet ? ` · ${r.quiet} quiet 7d+` : ''}</span>
        </div>
        {r.leads > 0
          ? <StackBar parts={mixParts.filter(p => p.value > 0)} />
          : <div className="rounded-[10px] border border-dashed px-3 py-2.5 text-[13px]" style={{ borderColor: BORDER_2, color: SUBTLE }}>No leads assigned yet.</div>}
      </div>

      {/* Contact + specialties */}
      <div className="flex flex-col gap-2.5 px-4 pt-4 sm:px-5">
        {(m.email || m.phone) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]" style={{ color: MUTED }}>
            {m.email && <a href={`mailto:${m.email}`} className="inline-flex min-w-0 items-center gap-1.5 no-underline hover:underline" style={{ color: MUTED }}><Envelope size={14} className="shrink-0" /><span className="truncate">{m.email}</span></a>}
            {m.phone && <a href={telHref(m.phone)} className="inline-flex items-center gap-1.5 no-underline hover:underline" style={{ color: MUTED }}><Phone size={14} />{formatPhone(m.phone)}</a>}
          </div>
        )}
        {(m.specialty_cities.length > 0 || m.specialty_types.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {m.specialty_cities.map(c => <Pill key={c} small tone="blue">{c}</Pill>)}
            {m.specialty_types.map(t => <Pill key={t} small tone="violet">{t}</Pill>)}
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="mx-4 mt-4 grid grid-cols-5 overflow-hidden rounded-[12px] border sm:mx-5" style={{ borderColor: BORDER }}>
        {[
          { k: 'Leads',  v: r.leads,                    c: TEXT },
          { k: 'Active', v: r.open,                     c: TEXT },
          { k: 'Won',    v: r.won,                      c: r.won ? '#067647' : TEXT },
          { k: 'Target', v: `${r.wonMonth}/${r.target}`, c: r.wonMonth >= r.target ? '#067647' : '#B54708' },
          { k: 'Calls 7d', v: r.calls7,                 c: TEXT },
        ].map((s, j) => (
          <div key={s.k} className="px-1 py-2.5 text-center" style={{ borderLeft: j ? `1px solid ${BORDER}` : undefined }}>
            <div className="text-[15px] font-semibold tabular-nums" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[11px]" style={{ color: SUBTLE }}>{s.k}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 px-4 pb-4 pt-4 sm:px-5">
        <Btn size="sm" onClick={onAssign} disabled={!m.is_active}><ArrowsSplit size={14} weight="bold" />Assign leads</Btn>
        {ph && <a href={waHref(m.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${m.name}`} title="WhatsApp"
          className="grid size-8 place-items-center rounded-[8px] border bg-white no-underline transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: BORDER_2, color: '#079455', boxShadow: XS }}>
          <WhatsappLogo size={16} weight="fill" />
        </a>}
        <span className="flex-1" />
        <Btn size="sm" variant="ghost" onClick={onEdit} label={`Edit ${m.name}`}><PencilSimple size={15} />Edit</Btn>
        <Btn size="sm" variant="ghost" onClick={onRemove} label={`Remove ${m.name}`}><Trash size={15} color={RED} /></Btn>
      </div>
    </article>
  )
}

// ─── Add / edit agent ─────────────────────────────────────────────────────────
function AgentDialog({ member, onClose, onSave }: {
  member: TeamMember | null
  onClose: () => void
  onSave: (data: Partial<TeamMember>) => Promise<void>
}) {
  const [form,   setForm]   = useState<Partial<TeamMember>>(member ?? { ...BLANK })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (k: keyof TeamMember, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const tog = (field: 'specialty_cities' | 'specialty_types', val: string) =>
    set(field, (form[field] ?? []).includes(val)
      ? (form[field] as string[]).filter(x => x !== val)
      : [...((form[field] as string[]) ?? []), val])

  const handleSave = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return }
    setSaving(true)
    try { await onSave({ ...form, name: form.name.trim() }); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setSaving(false) }
  }
  const target = form.monthly_target ?? 5

  return (
    <Dialog open onClose={onClose} width={560}
      icon={member ? <PencilSimple size={18} /> : <UserPlus size={18} />}
      title={member ? `Edit ${member.name}` : 'Add an agent'}
      sub={member ? 'Changes apply to new lead routing straight away.' : 'They show up on the leaderboard and can be given leads right away.'}
      footer={<>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : member ? 'Save changes' : 'Add agent'}</Btn>
      </>}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="ag-name">
            <input id="ag-name" className={inputCls} style={inputStyle} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Rahul Sharma" autoFocus />
          </Field>
          <Field label="Role">
            <Seg full label="Role" value={(form.role ?? 'agent') as string} onChange={v => set('role', v)}
              options={ROLES.map(r => ({ id: r, label: ROLE_LABEL[r] }))} />
          </Field>
          <Field label="Email" htmlFor="ag-email">
            <input id="ag-email" type="email" className={inputCls} style={inputStyle} value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="agent@company.com" />
          </Field>
          <Field label="Phone" htmlFor="ag-phone">
            <input id="ag-phone" type="tel" className={inputCls} style={inputStyle} value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="98765 43210" />
          </Field>
        </div>

        <Field label="Monthly target" hint="Deals you expect them to close each month.">
          <div className="inline-flex items-center overflow-hidden rounded-[10px] border" style={{ borderColor: BORDER_2, boxShadow: XS }}>
            <button type="button" aria-label="Lower target" onClick={() => set('monthly_target', Math.max(1, target - 1))} className="grid h-10 w-10 cursor-pointer place-items-center hover:bg-[#F9FAFB]" style={{ color: TEXT_2 }}><Minus size={14} weight="bold" /></button>
            <input type="number" min={1} value={target} onChange={e => set('monthly_target', Math.max(1, Number(e.target.value) || 1))}
              className="h-10 w-16 border-x text-center text-[15px] font-semibold tabular-nums outline-none" style={{ borderColor: BORDER_2, color: TEXT }} aria-label="Monthly target" />
            <button type="button" aria-label="Raise target" onClick={() => set('monthly_target', target + 1)} className="grid h-10 w-10 cursor-pointer place-items-center hover:bg-[#F9FAFB]" style={{ color: TEXT_2 }}><Plus size={14} weight="bold" /></button>
          </div>
        </Field>

        <Field label="City specialties">
          <div className="flex flex-wrap gap-1.5">
            {CITIES.map(c => <Chip key={c} on={(form.specialty_cities ?? []).includes(c)} onClick={() => tog('specialty_cities', c)}>{c}</Chip>)}
          </div>
        </Field>
        <Field label="Property specialties">
          <div className="flex flex-wrap gap-1.5">
            {PROP_TYPES.map(t => <Chip key={t} on={(form.specialty_types ?? []).includes(t)} onClick={() => tog('specialty_types', t)}>{t}</Chip>)}
          </div>
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-[12px] border px-4 py-3" style={{ borderColor: BORDER, background: SURFACE }}>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: TEXT }}>Active</div>
            <div className="text-[13px]" style={{ color: SUBTLE }}>Available for lead assignment</div>
          </div>
          <Toggle on={form.is_active ?? true} onChange={v => set('is_active', v)} label="Active" />
        </div>

        {error && <div className="rounded-[10px] border px-3 py-2.5 text-[13.5px]" style={{ ...TONE_RED }}>{error}</div>}
      </div>
    </Dialog>
  )
}
const TONE_RED = { background: TONE.red.bg, borderColor: TONE.red.border, color: TONE.red.color }

// ─── Distribute unassigned leads ──────────────────────────────────────────────
function DistributeDialog({ agents, unassigned, focusId, onClose, onDone }: {
  agents: TeamMember[]; unassigned: number; focusId: string | null; onClose: () => void; onDone: (msg: string) => void
}) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    if (focusId) return { [focusId]: Math.min(unassigned, 10) }
    const each = agents.length ? Math.floor(unassigned / agents.length) : 0
    return Object.fromEntries(agents.map(a => [a.id, each]))
  })
  const [priority, setPriority] = useState<'score' | 'newest' | 'oldest'>('score')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0)
  const over = total > unassigned

  const split = () => {
    const each = agents.length ? Math.floor(unassigned / agents.length) : 0
    let rest = unassigned - each * agents.length
    setCounts(Object.fromEntries(agents.map(a => [a.id, each + (rest-- > 0 ? 1 : 0)])))
  }
  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/crm/leads/distribute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority, assignments: agents.filter(a => (counts[a.id] ?? 0) > 0).map(a => ({ agentId: a.id, agentName: a.name, count: counts[a.id] })) }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? `Server error ${res.status}`)
      onDone(j.message ?? `Distributed ${j.distributed ?? total} leads`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed'); setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} width={560} icon={<ArrowsSplit size={18} />}
      title="Assign unassigned leads" sub={<><b style={{ color: TEXT_2 }}>{unassigned}</b> leads have no agent yet. Pick how many each agent gets.</>}
      footer={<>
        <span className="mr-auto text-[13px] tabular-nums" style={{ color: over ? RED : SUBTLE }}>{total} of {unassigned} selected</span>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={busy || total === 0 || over}>{busy ? 'Assigning…' : `Assign ${total} leads`}</Btn>
      </>}>
      <div className="flex flex-col gap-5">
        <Field label="Who goes first">
          <Seg full label="Priority" value={priority} onChange={setPriority}
            options={[{ id: 'score', label: 'Highest intent' }, { id: 'newest', label: 'Newest' }, { id: 'oldest', label: 'Oldest' }]} />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Active agents</span>
            <button type="button" onClick={split} className="cursor-pointer text-[13px] font-semibold hover:underline" style={{ color: BLUE }}>Split evenly</button>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {agents.map(a => {
              const n = counts[a.id] ?? 0
              const setN = (v: number) => setCounts(c => ({ ...c, [a.id]: Math.max(0, Math.min(unassigned, v)) }))
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: a.id === focusId ? BLUE_LN : BORDER, background: a.id === focusId ? BLUE_BG : CANVAS }}>
                  <Avatar name={a.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{a.name}</div>
                    <div className="truncate text-[12px]" style={{ color: SUBTLE }}>{[...a.specialty_cities, ...a.specialty_types].join(' · ') || ROLE_LABEL[a.role]}</div>
                  </div>
                  <div className="inline-flex items-center overflow-hidden rounded-[8px] border" style={{ borderColor: BORDER_2 }}>
                    <button type="button" aria-label="Fewer" onClick={() => setN(n - 1)} className="grid size-8 cursor-pointer place-items-center bg-white hover:bg-[#F9FAFB]" style={{ color: TEXT_2 }}><Minus size={12} weight="bold" /></button>
                    <input type="number" min={0} value={n} onChange={e => setN(Number(e.target.value) || 0)} aria-label={`Leads for ${a.name}`}
                      className="h-8 w-12 border-x bg-white text-center text-[14px] font-semibold tabular-nums outline-none" style={{ borderColor: BORDER_2, color: TEXT }} />
                    <button type="button" aria-label="More" onClick={() => setN(n + 1)} className="grid size-8 cursor-pointer place-items-center bg-white hover:bg-[#F9FAFB]" style={{ color: TEXT_2 }}><Plus size={12} weight="bold" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        {error && <div className="rounded-[10px] border px-3 py-2.5 text-[13.5px]" style={TONE_RED}>{error}</div>}
      </div>
    </Dialog>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-[148px] rounded-[18px]" style={{ background: '#F2F4F7' }} />)}
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map(i => <div key={i} className="h-[172px] rounded-[18px]" style={{ background: '#F2F4F7' }} />)}
      </div>
      <div className="mt-6 h-[280px] rounded-[16px]" style={{ background: '#F2F4F7' }} />
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
type Json = { [k: string]: unknown }
async function safe<T>(url: string, pick: (j: Json) => T, fallback: T): Promise<T> {
  try {
    const r = await fetch(url)
    if (!r.ok) return fallback
    return pick(await r.json())
  } catch { return fallback }
}

async function fetchTeam() {
  const [members, deals, dist, tasks, stats] = await Promise.all([
    safe('/api/team', j => (j.members ?? []) as TeamMember[], []),
    safe('/api/deals', j => (j.deals ?? j.data ?? []) as Deal[], []),
    safe('/api/crm/leads/distribute', j => ({ perAgent: (j.perAgent ?? {}) as Record<string, number>, unassigned: (j.unassigned ?? 0) as number }), { perAgent: {}, unassigned: 0 }),
    safe('/api/crm/tasks', j => (j.tasks ?? []) as TaskRow[], []),
    safe('/api/team/stats', j => j as unknown as TeamStats, null as TeamStats | null),
  ])
  return {
    members, deals, tasks, perAgent: dist.perAgent,
    stats: stats ?? { agents: {}, unassigned: dist.unassigned, totalLeads: 0 },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [members,  setMembers]  = useState<TeamMember[]>([])
  const [deals,    setDeals]    = useState<Deal[]>([])
  const [tasks,    setTasks]    = useState<TaskRow[]>([])
  const [stats,    setStats]    = useState<TeamStats>({ agents: {}, unassigned: 0, totalLeads: 0 })
  const [perAgent, setPerAgent] = useState<Record<string, number>>({})
  const [loading,  setLoading]  = useState(true)
  const [now,      setNow]      = useState(0)

  const [view,     setView]     = useState<View>('leaderboard')
  const [period,   setPeriod]   = useState<Period>('month')
  const [metric,   setMetric]   = useState<Metric>('won')
  const [query,    setQuery]    = useState('')
  const [status,   setStatus]   = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy,   setSortBy]   = useState<'load' | 'leads' | 'won' | 'name'>('load')

  const [modal,      setModal]      = useState<TeamMember | 'new' | null>(null)
  const [deleting,   setDeleting]   = useState<TeamMember | null>(null)
  const [distribute, setDistribute] = useState<{ focus: string | null } | null>(null)
  const { toast, show, hide } = useToast()

  const load = useCallback(() => fetchTeam().then(b => {
    setMembers(b.members)
    setDeals(b.deals)
    setTasks(b.tasks)
    setPerAgent(b.perAgent)
    setStats(b.stats)
    setNow(new Date().getTime())
    setLoading(false)
  }), [])

  useEffect(() => { load() }, [load])

  // ── Per-agent rows ──
  const rows: Row[] = useMemo(() => {
    if (!now) return []
    const today = new Date(now)
    const todayStr = ymd(today)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
    const inPeriod = (iso?: string | null) => {
      if (period === 'all') return true
      const t = iso ? new Date(iso).getTime() : 0
      return period === 'month' ? t >= monthStart : now - t <= 30 * DAY
    }
    return members.map(m => {
      const a = stats.agents[m.id]
      const mine = deals.filter(d => d.assigned_to && (d.assigned_to === m.id || d.assigned_to.toLowerCase() === m.name.toLowerCase()))
      const dActive = mine.filter(d => !['won', 'lost'].includes(d.stage))
      const dWon  = mine.filter(d => d.stage === 'won' && inPeriod(d.updated_at)).length
      const dLost = mine.filter(d => d.stage === 'lost' && inPeriod(d.updated_at)).length
      const dWonMonth = mine.filter(d => d.stage === 'won' && (d.updated_at ? new Date(d.updated_at).getTime() >= monthStart : false)).length
      const won  = (a?.won[period] ?? 0) + dWon
      const lost = (a?.lost[period] ?? 0) + dLost
      const wonMonth = (a?.won.month ?? 0) + dWonMonth
      const target = Math.max(1, m.monthly_target || 1)
      const mix: Record<StageId, number> = a?.byStage ? { ...a.byStage } : { New: 0, Cold: 0, Warm: 0, Hot: 0, Closed: 0, Disqualified: 0, Hold: 0 }
      const open = mix.New + mix.Cold + mix.Warm + mix.Hot + mix.Hold + dActive.length
      const pending = tasks.filter(t => t.assigned_to === m.id && t.status === 'Pending')
      const dueDay = (t: TaskRow) => (t.due_date.length === 10 ? t.due_date : ymd(new Date(t.due_date)))
      return {
        m,
        leads: a?.leads ?? perAgent[m.id] ?? 0,
        open,
        pipeline: (a?.openValue ?? 0) + dActive.reduce((s, d) => s + (d.deal_value ?? 0), 0),
        won, lost,
        winRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
        wonMonth, target,
        targetPct: pct(wonMonth, target),
        calls7: a?.calls.d7 ?? 0,
        touches7: a?.touches.d7 ?? 0,
        quiet: a?.quiet ?? 0,
        mix,
        dealsActive: dActive.length,
        tasks: {
          total: pending.length,
          today: pending.filter(t => dueDay(t) === todayStr).length,
          overdue: pending.filter(t => new Date(t.due_date).getTime() < now && dueDay(t) !== todayStr).length,
        },
        lastActivity: a?.lastActivity ?? null,
      }
    })
  }, [members, deals, tasks, stats, perAgent, period, now])

  const ranked = useMemo(() =>
    [...rows].sort((a, b) =>
      Number(b.m.is_active) - Number(a.m.is_active)
      || metricValue(b, metric) - metricValue(a, metric)
      || b.won - a.won || b.pipeline - a.pipeline || a.m.name.localeCompare(b.m.name)),
  [rows, metric])

  // ── Team totals ──
  const active        = members.filter(m => m.is_active)
  const totalPipeline = rows.reduce((s, r) => s + r.pipeline, 0)
  const totalWon      = rows.reduce((s, r) => s + r.won, 0)
  const totalLost     = rows.reduce((s, r) => s + r.lost, 0)
  const wonMonth      = rows.reduce((s, r) => s + r.wonMonth, 0)
  const teamTarget    = rows.filter(r => r.m.is_active).reduce((s, r) => s + r.target, 0)
  const assigned      = rows.reduce((s, r) => s + r.leads, 0)
  const warm          = rows.reduce((s, r) => s + (r.mix.Warm ?? 0), 0)
  const hot           = rows.reduce((s, r) => s + (r.mix.Hot ?? 0), 0)
  const dealsActive   = deals.filter(d => !['won', 'lost'].includes(d.stage)).length
  const quiet         = rows.reduce((s, r) => s + r.quiet, 0)
  const unassigned    = stats.unassigned

  const pipeParts = useMemo(() => {
    const sorted = [...rows].filter(r => r.pipeline > 0).sort((a, b) => b.pipeline - a.pipeline)
    const palette = ['#1D4ED8', '#528BFF', '#84ADFF', '#B2CCFF']
    const top = sorted.slice(0, 3).map((r, i) => ({ label: r.m.name, value: r.pipeline, color: palette[i] }))
    const rest = sorted.slice(3).reduce((s, r) => s + r.pipeline, 0)
    return rest ? [...top, { label: 'Others', value: rest, color: palette[3] }] : top
  }, [rows])

  // ── Things worth a look (computed from the team's own numbers) ──
  const insights = useMemo(() => {
    if (!now) return []
    const d = new Date(now)
    const pace = d.getDate() / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const out: { key: string; tone: Tone; sev: number; icon: ReactNode; title: string; body: string; action?: ReactNode }[] = []
    if (unassigned > 0 && active.length) out.push({
      key: 'unassigned', tone: 'blue', sev: 60, icon: <ArrowsSplit size={15} weight="bold" />,
      title: `${unassigned} ${unassigned === 1 ? 'lead has' : 'leads have'} no agent`,
      body: 'Nobody will call them until they are assigned.',
      action: <Btn size="sm" variant="primary" onClick={() => setDistribute({ focus: null })}>Assign now</Btn>,
    })
    // Overdue tasks: one card for the whole team, naming whoever has the most
    const late = rows.filter(x => x.m.is_active && x.tasks.overdue > 0).sort((x, y) => y.tasks.overdue - x.tasks.overdue)
    if (late.length) {
      const n = late.reduce((t, x) => t + x.tasks.overdue, 0)
      const w = late[0]
      out.push({
        key: 'overdue', tone: 'red', sev: 80 + n, icon: <Warning size={15} weight="bold" />,
        title: late.length === 1
          ? `${w.m.name} has ${n} overdue ${n === 1 ? 'task' : 'tasks'}`
          : `${n} overdue tasks across ${late.length} agents`,
        body: late.length === 1
          ? (w.tasks.total >= 8 ? `${w.tasks.total} tasks open. Consider moving some to a teammate.` : 'Check in before these leads go cold.')
          : `${w.m.name} has the most (${w.tasks.overdue}). Check in before these leads go cold.`,
        action: <Link href="/dashboard/tasks" className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline" style={{ color: TONE.red.color }}>Open tasks<CaretRight size={12} weight="bold" /></Link>,
      })
    }
    for (const r of rows.filter(x => x.m.is_active)) {
      const expected = Math.round(r.target * pace)
      if (pace >= 0.3 && r.wonMonth < expected) out.push({
        key: `pace-${r.m.id}`, tone: 'amber', sev: 50 + (expected - r.wonMonth) * 5, icon: <Target size={15} weight="bold" />,
        title: `${r.m.name} is behind target pace`,
        body: `${r.wonMonth} of ${r.target} won so far. About ${expected} would be on pace by today.`,
      })
      if (r.quiet >= 3) out.push({
        key: `quiet-${r.m.id}`, tone: 'amber', sev: 40 + r.quiet, icon: <Clock size={15} weight="bold" />,
        title: `${r.quiet} of ${r.m.name}'s leads have gone quiet`,
        body: 'Cold, Warm or Hot leads with no update in 7+ days.',
      })
      if (r.leads > 0 && r.calls7 === 0 && r.touches7 === 0 && stats.totalLeads > 0) out.push({
        key: `idle-${r.m.id}`, tone: 'neutral', sev: 30, icon: <PhoneCall size={15} weight="bold" />,
        title: `No calls logged by ${r.m.name} this week`,
        body: `${r.leads} leads assigned, but no calls, WhatsApps or notes in the last 7 days.`,
      })
    }
    const top = ranked.find(r => r.m.is_active && r.wonMonth >= r.target && r.target > 0)
    if (top) out.push({
      key: 'hit', tone: 'green', sev: 20, icon: <Sparkle size={15} weight="bold" />,
      title: `${top.m.name} hit this month's target`,
      body: `${top.wonMonth} won against a target of ${top.target}.`,
    })
    // At most one card of each kind, so one busy agent can't fill the row
    const seen = new Set<string>()
    return out.sort((a, b) => b.sev - a.sev).filter(x => {
      const kind = x.key.split('-')[0]
      if (seen.has(kind)) return false
      seen.add(kind); return true
    }).slice(0, 3)
  }, [rows, ranked, unassigned, active.length, now, stats.totalLeads])

  // ── Agents view filters ──
  const roster = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(r =>
      (status === 'all' || (status === 'active' ? r.m.is_active : !r.m.is_active))
      && (!q || [r.m.name, r.m.email, r.m.phone, ...r.m.specialty_cities, ...r.m.specialty_types].some(x => x?.toLowerCase().includes(q))))
    const by: Record<typeof sortBy, (a: Row, b: Row) => number> = {
      load:  (a, b) => b.tasks.overdue - a.tasks.overdue || b.tasks.total - a.tasks.total,
      leads: (a, b) => b.leads - a.leads,
      won:   (a, b) => b.won - a.won,
      name:  (a, b) => a.m.name.localeCompare(b.m.name),
    }
    return list.sort((a, b) => Number(b.m.is_active) - Number(a.m.is_active) || by[sortBy](a, b))
  }, [rows, query, status, sortBy])

  // ── Actions ──
  const handleSave = async (data: Partial<TeamMember>) => {
    const isEdit = modal && modal !== 'new'
    const res = isEdit
      ? await fetch(`/api/team/${(modal as TeamMember).id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      : await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`)
    // POST /api/team ignores is_active, so switch it off afterwards when asked
    if (!isEdit && data.is_active === false && json.member?.id) {
      await fetch(`/api/team/${json.member.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false }) })
    }
    show({ text: isEdit ? `Saved ${data.name}` : `${data.name} added to the team`, tone: 'ok' })
    await load()
  }

  const handleDelete = async (m: TeamMember) => {
    setDeleting(null)
    const res = await fetch(`/api/team/${m.id}`, { method: 'DELETE' })
    if (!res.ok) { show({ text: `Couldn't remove ${m.name}`, tone: 'err' }); return }
    setMembers(ms => ms.filter(x => x.id !== m.id))
    show({ text: `${m.name} removed from the team`, tone: 'ok' })
  }

  const toggleActive = async (m: TeamMember, on: boolean) => {
    setMembers(ms => ms.map(x => (x.id === m.id ? { ...x, is_active: on } : x)))
    const res = await fetch(`/api/team/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: on }) })
    if (!res.ok) {
      setMembers(ms => ms.map(x => (x.id === m.id ? { ...x, is_active: !on } : x)))
      show({ text: `Couldn't update ${m.name}`, tone: 'err' })
      return
    }
    show({ text: on ? `${m.name} is active and can get new leads` : `${m.name} is paused: no new leads`, tone: 'ok', action: { label: 'Undo', run: () => toggleActive({ ...m, is_active: on }, !on) } })
  }

  const podium = ranked.filter(r => r.m.is_active).slice(0, 3)

  return (
    <div className="min-h-screen" style={{ background: CANVAS }}>
      <PageTabBar tabs={WORKSPACE_TABS} />
      <PageHeader
        title="Team"
        backHref="/dashboard/tasks" backLabel="Back to tasks"
        badge={!loading && <Badge tone="blue"><span className="size-1.5 rounded-full" style={{ background: GREEN }} />{active.length} active</Badge>}
        sub="Who is closing, who is stretched, and where the next lead should go."
        actions={<>
          {unassigned > 0 && active.length > 0 && <Btn onClick={() => setDistribute({ focus: null })}><ArrowsSplit size={16} weight="bold" />Assign {unassigned} leads</Btn>}
          <Btn variant="primary" onClick={() => setModal('new')}><Plus size={16} weight="bold" />Add agent</Btn>
        </>}
      />

      <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
        {loading ? <Skeleton /> : members.length === 0 ? (
          <EmptyState icon={<UsersThree size={22} />} title="Build your team"
            actions={<Btn variant="primary" onClick={() => setModal('new')}><UserPlus size={16} weight="bold" />Add your first agent</Btn>}>
            Add the agents who work your leads. You will see who is closing, who has too much on their plate, and you can split new leads between them in one click.
          </EmptyState>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard icon={<UsersThree size={16} weight="bold" />} accent={BLUE} label="Team" value={active.length} unit="active"
                sub={<>{members.length - active.length > 0 ? `${members.length - active.length} inactive · ` : ''}{assigned} leads assigned{unassigned ? ` · ${unassigned} waiting` : ''}</>}>
                <div className="flex -space-x-1.5">
                  {active.slice(0, 6).map(m => <span key={m.id} title={m.name} className="rounded-full" style={{ boxShadow: '0 0 0 2px #fff' }}><Avatar name={m.name} size={32} /></span>)}
                  {active.length > 6 && <span className="grid size-8 place-items-center rounded-full text-[11px] font-semibold" style={{ background: '#F2F4F7', color: MUTED, boxShadow: '0 0 0 2px #fff' }}>+{active.length - 6}</span>}
                </div>
              </StatCard>
              <StatCard icon={<TrendUp size={16} weight="bold" />} accent={BLUE} label="Open pipeline" value={inr(totalPipeline)}
                sub={`Budgets of open leads${dealsActive ? ' and active deals' : ''}`}>
                {pipeParts.length > 0 ? <StackBar parts={pipeParts} format={inr} legend={false} /> : <Meter value={0} max={1} />}
              </StatCard>
              <StatCard icon={<Trophy size={16} weight="bold" />} accent={GREEN} label={period === 'month' ? 'Won this month' : `Won, ${PERIOD_LABEL[period]}`} value={totalWon}
                pill={period === 'month' && teamTarget > 0 ? <Pill tone={wonMonth >= teamTarget ? 'green' : 'neutral'}>{pct(wonMonth, teamTarget)}% of target</Pill> : undefined}
                sub={`${totalLost} lost · ${totalWon + totalLost ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0}% win rate`}>
                {period === 'month' ? (
                  <div>
                    <Meter value={wonMonth} max={teamTarget} color={GREEN} />
                    <div className="mt-1.5 text-[12px] tabular-nums" style={{ color: SUBTLE }}>{wonMonth} of {teamTarget} team target</div>
                  </div>
                ) : undefined}
              </StatCard>
              <StatCard icon={<Fire size={16} weight="bold" />} accent="#EF6820" label="In play" value={warm + hot + dealsActive}
                pill={quiet > 0 ? <Pill tone="amber">{quiet} quiet</Pill> : undefined}
                sub={quiet > 0 ? `${quiet} with no update in 7+ days` : 'Warm and Hot leads, plus active deals'}>
                <StackBar legend={false} parts={[
                  { label: 'Warm', value: warm, color: STAGE.Warm.dot },
                  { label: 'Hot', value: hot, color: STAGE.Hot.dot },
                  { label: 'Active deals', value: dealsActive, color: BLUE },
                ]} />
              </StatCard>
            </div>

            {/* Worth a look */}
            {insights.length > 0 && (
              <div className={`mt-4 grid gap-3 ${insights.length >= 3 ? 'lg:grid-cols-3' : insights.length === 2 ? 'lg:grid-cols-2' : ''}`}>
                {insights.map(x => (
                  <Insight key={x.key} tone={x.tone} icon={x.icon} title={x.title}>
                    <span>{x.body}</span>
                    {x.action && <div className="mt-2">{x.action}</div>}
                  </Insight>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <Seg label="View" value={view} onChange={setView} options={[
                { id: 'leaderboard', label: <><Trophy size={14} weight="bold" />Leaderboard</> },
                { id: 'agents', label: <><UsersThree size={14} weight="bold" />Agents</>, count: members.length },
              ]} />
              {view === 'leaderboard' ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <Seg label="Period" value={period} onChange={setPeriod} options={[
                    { id: 'month', label: 'This month' }, { id: 'd30', label: '30 days' }, { id: 'all', label: 'All time' },
                  ]} />
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[13px] font-medium sm:inline" style={{ color: SUBTLE }}>Rank by</span>
                    <Select value={metric} onChange={v => setMetric(v as Metric)} className="w-[170px]">
                      {(Object.keys(METRIC_LABEL) as Metric[]).map(k => <option key={k} value={k}>{METRIC_LABEL[k]}</option>)}
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
                  <div className="relative min-w-0 flex-1 md:w-[240px] md:flex-none">
                    <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: LABEL }} />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, city, type" aria-label="Search agents"
                      className={`${inputCls} pl-9`} style={inputStyle} />
                  </div>
                  <Select value={sortBy} onChange={v => setSortBy(v as typeof sortBy)} className="w-[150px]">
                    <option value="load">Busiest first</option>
                    <option value="leads">Most leads</option>
                    <option value="won">Most won</option>
                    <option value="name">Name A–Z</option>
                  </Select>
                </div>
              )}
            </div>

            {view === 'leaderboard' ? (
              <div className="mt-4 flex flex-col gap-4">
                <Podium rows={podium} metric={metric} period={period} />
                <Leaderboard rows={ranked} metric={metric} period={period} onEdit={m => setModal(m)} />
                {stats.totalLeads === 0 && (
                  <p className="m-0 text-[12.5px]" style={{ color: SUBTLE }}>
                    <ChartBar size={13} className="mr-1 inline align-[-2px]" />Lead numbers appear once leads are assigned to agents.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Chip on={status === 'all'} onClick={() => setStatus('all')} count={members.length}>All</Chip>
                  <Chip on={status === 'active'} onClick={() => setStatus('active')} count={active.length}>Active</Chip>
                  <Chip on={status === 'inactive'} onClick={() => setStatus('inactive')} count={members.length - active.length}>Inactive</Chip>
                </div>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {roster.map(r => (
                    <AgentCard key={r.m.id} r={r} now={now}
                      onEdit={() => setModal(r.m)}
                      onRemove={() => setDeleting(r.m)}
                      onToggle={v => toggleActive(r.m, v)}
                      onAssign={() => setDistribute({ focus: r.m.id })} />
                  ))}
                  <button type="button" onClick={() => setModal('new')}
                    className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-dashed bg-white transition-colors hover:bg-[#F9FAFB]"
                    style={{ borderColor: BORDER_2, color: SUBTLE }}>
                    <span className="grid size-11 place-items-center rounded-full" style={{ background: BLUE_BG, color: BLUE }}><UserPlus size={20} weight="bold" /></span>
                    <span className="text-[14px] font-semibold" style={{ color: TEXT_2 }}>Add an agent</span>
                    <span className="max-w-[240px] text-center text-[13px]">Set their cities, property types and monthly target.</span>
                  </button>
                </div>
                {roster.length === 0 && (
                  <p className="m-0 mt-4 text-[14px]" style={{ color: SUBTLE }}>No agents match that search.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {modal !== null && (
        <AgentDialog member={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {deleting && (
        <Dialog open onClose={() => setDeleting(null)} width={420} icon={<Trash size={18} color={RED} />}
          title={`Remove ${deleting.name}?`} sub="Their deal assignments will not be affected."
          footer={<>
            <Btn onClick={() => setDeleting(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => handleDelete(deleting)}>Remove</Btn>
          </>}>
          <p className="m-0 text-[14px] leading-relaxed" style={{ color: MUTED }}>
            Leads already assigned to {deleting.name} keep their assignment. To stop new leads without removing them, switch them to inactive instead.
          </p>
        </Dialog>
      )}

      {distribute && (
        <DistributeDialog agents={active} unassigned={unassigned} focusId={distribute.focus}
          onClose={() => setDistribute(null)}
          onDone={msg => { setDistribute(null); show({ text: msg, tone: 'ok' }); load() }} />
      )}

      <Toast toast={toast} onClose={hide} />
    </div>
  )
}
