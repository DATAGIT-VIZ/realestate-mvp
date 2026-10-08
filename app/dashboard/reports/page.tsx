'use client'

// Reports: a ready-to-share report for a week, month or quarter. "My report" covers every lead in your account.
// "Team reports" (Teams plan, admins) is the same report for one agent's leads (leads.assigned_to).
// Every figure comes from real leads and logged activity. There is no sample data on this page.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import {
  User, UsersThree, Lock, CaretLeft, CaretRight, Printer, EnvelopeSimple, WhatsappLogo, Copy, Check, DownloadSimple,
  ChartLineUp, Plugs, CalendarDots, Funnel, Trophy, Phone, ChatCircleDots, MapPin, VideoCamera, Percent, Wallet,
  Sparkle, Fire, WarningCircle, FileText, Info,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import { getPlan, getRole } from '@/lib/plan'
import {
  CANVAS, SURFACE, BORDER, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, GREEN_D, XS, DAY,
  STAGE, type StageId, displayName, inr, sourceMeta, SourceMark, Avatar, StagePill, Pill, Seg, Select,
  StackBar, EmptyState, PageHeader, Btn, useToast, Toast,
} from '@/components/outreach/OutreachKit'
import {
  INSIGHTS_TABS, useInsights, useMembers, type InsightLead, type InsightActivity, type Member, type Bucket, type ActKind, type Journey,
  buildJourneys, reached, responseMs, kindOf, isOutreach, isCallAttempt, isConnected, stageOfLead, isOpenLead, scoreOf,
  valueOf, ms, created, closedAt, sum, nf, plural, share, median, dur, bucketIndex, startOfDay, WEEKDAYS, ORDER,
  Meter, Basis, BarChart, Legend, PageSkeleton, LoadError, KIND, typeLabel, shortDate, fetchMyName, printElement, PRINT_CSS,
} from '@/components/insights/InsightsKit'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'mine' | 'team'
type ReportType = 'productivity' | 'source' | 'seasonal' | 'pipeline'
type CalKind = 'week' | 'month' | 'quarter' | 'all'
type Deal = { id: string; lead_name: string; deal_value?: number | null; stage: string; city?: string | null; assigned_to?: string | null; expected_close?: string | null; updated_at?: string | null }
type Cal = { kind: CalKind; start: number; end: number; label: string; tag: string | null; buckets: Bucket[]; partial: boolean }

const REPORTS: { id: ReportType; label: string; title: string; blurb: string; Icon: typeof User }[] = [
  { id: 'productivity', label: 'Productivity', title: 'Productivity report',   blurb: 'Effort and what it produced', Icon: ChartLineUp },
  { id: 'source',       label: 'By source',    title: 'Lead source report',    blurb: 'Which portals pay off',      Icon: Plugs },
  { id: 'seasonal',     label: 'Seasonal',     title: 'Seasonal report',       blurb: 'Month by month, last 12',    Icon: CalendarDots },
  { id: 'pipeline',     label: 'Pipeline',     title: 'Pipeline report',       blurb: 'What is open and closing',   Icon: Funnel },
]
const KINDS: { id: CalKind; label: string }[] = [
  { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'quarter', label: 'Quarter' }, { id: 'all', label: 'All time' },
]
const HOT_SCORE = 70
const MIN_GROUP = 5
const DEAL_STAGE: Record<string, string> = { new: 'New', site_visit: 'Site visit', negotiation: 'Negotiation', token_paid: 'Token paid', won: 'Won', lost: 'Lost' }
const CH: { key: string; label: string; kinds: ActKind[]; color: string }[] = [
  { key: 'call',     label: 'Calls',       kinds: ['call', 'missed'],       color: KIND.call.color },
  { key: 'message',  label: 'Messages',    kinds: ['whatsapp', 'email'],    color: KIND.whatsapp.color },
  { key: 'visit',    label: 'Site visits', kinds: ['visitBooked', 'visit'], color: KIND.visit.color },
  { key: 'meeting',  label: 'Meetings',    kinds: ['meeting'],              color: KIND.meeting.color },
]

// ─── Calendar periods ─────────────────────────────────────────────────────────
const fmtD = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString('en-IN', o)
function fyQuarter(d: Date) {
  // Indian financial year starts in April: Apr–Jun is Q1
  const m = d.getMonth(), y = d.getFullYear()
  const fy = m >= 3 ? y : y - 1
  return `Q${Math.floor(((m + 9) % 12) / 3) + 1} FY ${fy}-${String((fy + 1) % 100).padStart(2, '0')}`
}
function calPeriod(kind: CalKind, offset: number, now: number, first: number): Cal {
  const d = new Date(now)
  if (kind === 'week') {
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 7 * offset)
    const start = mon.getTime(), end = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7).getTime()
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const s = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i), e = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i + 1)
      return { start: s.getTime(), end: e.getTime(), tick: fmtD(s.getTime(), { weekday: 'short' }), label: fmtD(s.getTime(), { weekday: 'long', day: 'numeric', month: 'short' }) }
    })
    return { kind, start, end, buckets, partial: now < end, tag: offset === 0 ? 'This week' : offset === -1 ? 'Last week' : null,
      label: `${fmtD(start, { day: 'numeric', month: 'short' })} – ${fmtD(end - DAY, { day: 'numeric', month: 'short', year: 'numeric' })}` }
  }
  if (kind === 'month') {
    const s = new Date(d.getFullYear(), d.getMonth() + offset, 1), e = new Date(d.getFullYear(), d.getMonth() + offset + 1, 1)
    const n = Math.round((e.getTime() - s.getTime()) / DAY)
    const buckets = Array.from({ length: n }, (_, i) => {
      const a = new Date(s.getFullYear(), s.getMonth(), 1 + i), b = new Date(s.getFullYear(), s.getMonth(), 2 + i)
      return { start: a.getTime(), end: b.getTime(), tick: String(i + 1), label: fmtD(a.getTime(), { weekday: 'short', day: 'numeric', month: 'short' }) }
    })
    return { kind, start: s.getTime(), end: e.getTime(), buckets, partial: now < e.getTime(), tag: offset === 0 ? 'This month' : offset === -1 ? 'Last month' : null,
      label: fmtD(s.getTime(), { month: 'long', year: 'numeric' }) }
  }
  if (kind === 'quarter') {
    const q0 = Math.floor(d.getMonth() / 3) * 3
    const s = new Date(d.getFullYear(), q0 + 3 * offset, 1), e = new Date(d.getFullYear(), q0 + 3 * offset + 3, 1)
    const buckets: Bucket[] = []
    for (let t = s.getTime(), i = 0; t < e.getTime(); i++) {
      const a = new Date(s.getFullYear(), s.getMonth(), 1 + 7 * i), b = new Date(s.getFullYear(), s.getMonth(), 8 + 7 * i)
      const bEnd = Math.min(b.getTime(), e.getTime())
      buckets.push({ start: a.getTime(), end: bEnd, tick: fmtD(a.getTime(), { day: 'numeric', month: 'short' }), label: `${fmtD(a.getTime(), { day: 'numeric', month: 'short' })} – ${fmtD(bEnd - DAY, { day: 'numeric', month: 'short' })}` })
      t = bEnd
    }
    return { kind, start: s.getTime(), end: e.getTime(), buckets, partial: now < e.getTime(), tag: fyQuarter(s),
      label: `${fmtD(s.getTime(), { month: 'short' })} – ${fmtD(e.getTime() - DAY, { month: 'short', year: 'numeric' })}` }
  }
  // All time: monthly buckets from the first lead, at most the last 24 months
  const f = new Date(Math.min(first || now, now))
  const startM = new Date(f.getFullYear(), f.getMonth(), 1)
  const months = Math.min(24, (d.getFullYear() - startM.getFullYear()) * 12 + d.getMonth() - startM.getMonth() + 1)
  const buckets = Array.from({ length: months }, (_, i) => {
    const a = new Date(d.getFullYear(), d.getMonth() - months + 1 + i, 1), b = new Date(d.getFullYear(), d.getMonth() - months + 2 + i, 1)
    return { start: a.getTime(), end: b.getTime(), tick: fmtD(a.getTime(), { month: 'short' }), label: fmtD(a.getTime(), { month: 'long', year: 'numeric' }) }
  })
  return { kind, start: startM.getTime(), end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(), buckets, partial: true, tag: null, label: 'All time' }
}
/** Days of activity a period needs (this one and the one before), worked out without knowing today's date */
function daysNeeded(kind: CalKind, offset: number, type: ReportType) {
  const back = Math.abs(offset) + 2
  const base = kind === 'week' ? 7 * back + 1 : kind === 'month' ? 31 * back + 1 : kind === 'quarter' ? 92 * back + 1 : 800
  return Math.min(800, Math.max(base, type === 'seasonal' ? 400 : 0))
}

// ─── Plan and role (stored in the browser by lib/plan) ────────────────────────
const subscribePlan = (f: () => void) => {
  window.addEventListener('plan-changed', f); window.addEventListener('storage', f)
  return () => { window.removeEventListener('plan-changed', f); window.removeEventListener('storage', f) }
}
const planKey = () => `${getPlan()}:${getRole()}`
const usePlanRole = () => useSyncExternalStore(subscribePlan, planKey, () => 'solo:admin')

async function fetchDeals(): Promise<Deal[]> {
  try {
    const r = await fetch('/api/deals', { cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return (j.deals ?? j.data ?? []) as Deal[]
  } catch { return [] }
}

// ─── Report maths ─────────────────────────────────────────────────────────────
type Scope = { leads: InsightLead[]; acts: InsightActivity[]; name: string; role: string | null; deals: Deal[] }
type Ctx = Scope & { cal: Cal; prevStart: number; prevEnd: number; cmpEnd: number; now: number }

function figures(c: Ctx, from: number, to: number) {
  const inR = (t: number) => t >= from && t < to
  const added = c.leads.filter(l => inR(created(l)))
  const acts = c.acts.filter(a => inR(ms(a.createdAt)))
  const j = buildJourneys(added, c.acts)
  const k = (x: ActKind) => acts.filter(a => kindOf(a.type) === x).length
  const calls = acts.filter(isCallAttempt)
  const won = c.leads.filter(l => stageOfLead(l) === 'Closed' && inR(closedAt(l)))
  const dropped = c.leads.filter(l => stageOfLead(l) === 'Disqualified' && inR(closedAt(l)))
  const resp = added.map(l => responseMs(l, j.get(l.id))).filter((x): x is number => x != null)
  return {
    added, acts, j,
    hot: added.filter(l => scoreOf(l) >= HOT_SCORE).length,
    calls: calls.length, connected: calls.filter(isConnected).length,
    messages: k('whatsapp') + k('email'), replies: k('reply'),
    visits: k('visit'), booked: k('visitBooked'), meetings: k('meeting'),
    won, wonValue: sum(won, valueOf), dropped,
    winRate: won.length + dropped.length ? share(won.length, won.length + dropped.length) : null,
    contacted: added.filter(l => reached(j.get(l.id), 'contacted')).length,
    qualified: added.filter(l => reached(j.get(l.id), 'qualified')).length,
    response: median(resp),
    outreach: acts.filter(isOutreach).length,
  }
}
type Fig = ReturnType<typeof figures>

function sourceRows(leads: InsightLead[], j: Map<string, Journey>) {
  const by = new Map<string, InsightLead[]>()
  for (const l of leads) { const k = sourceMeta(l.sourcePortal).label; const xs = by.get(k); if (xs) xs.push(l); else by.set(k, [l]) }
  return [...by.entries()].map(([label, xs]) => ({
    label, raw: xs[0].sourcePortal, leads: xs.length,
    hot: xs.filter(l => scoreOf(l) >= HOT_SCORE).length,
    avgScore: Math.round(sum(xs, scoreOf) / xs.length),
    contacted: xs.filter(l => reached(j.get(l.id), 'contacted')).length,
    qualified: xs.filter(l => reached(j.get(l.id), 'qualified')).length,
    won: xs.filter(l => reached(j.get(l.id), 'won')).length,
    budget: sum(xs, valueOf),
  })).sort((a, b) => b.leads - a.leads)
}

function seasonal(c: Ctx) {
  const d = new Date(c.now)
  const months = Array.from({ length: 12 }, (_, i) => {
    const s = new Date(d.getFullYear(), d.getMonth() - 11 + i, 1), e = new Date(d.getFullYear(), d.getMonth() - 10 + i, 1)
    return { start: s.getTime(), end: e.getTime(), tick: fmtD(s.getTime(), { month: 'short' }), label: fmtD(s.getTime(), { month: 'long', year: 'numeric' }) }
  })
  const j = buildJourneys(c.leads.filter(l => created(l) >= months[0].start), c.acts)
  const rows = months.map(m => {
    const inM = (t: number) => t >= m.start && t < m.end
    const added = c.leads.filter(l => inM(created(l)))
    return {
      m, leads: added.length, outreach: c.acts.filter(a => isOutreach(a) && inM(ms(a.createdAt))).length,
      qualified: added.filter(l => reached(j.get(l.id), 'qualified')).length,
      won: c.leads.filter(l => stageOfLead(l) === 'Closed' && inM(closedAt(l))).length,
      budget: sum(added, valueOf),
    }
  })
  const weekday = WEEKDAYS.map(() => 0)
  for (const l of c.leads) if (created(l) >= months[0].start) weekday[(new Date(created(l)).getDay() + 6) % 7]++
  return { rows, weekday }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [plan, role] = usePlanRole().split(':')
  const teamsAdmin = plan === 'teams' && role === 'admin'
  const [tab, setTab] = useState<Tab>('mine')
  const [type, setType] = useState<ReportType>('productivity')
  const [kind, setKind] = useState<CalKind>('month')
  const [offset, setOffset] = useState(0)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [myName, setMyName] = useState<string | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const { data, error, pending, refresh } = useInsights(daysNeeded(kind, offset, type))
  const { members } = useMembers(teamsAdmin)
  const team = tab === 'team' && teamsAdmin

  const loadExtras = useCallback(() => { fetchMyName().then(setMyName); fetchDeals().then(setDeals) }, [])
  useEffect(() => { loadExtras() }, [loadExtras])

  const now = data?.at ?? 0
  const first = useMemo(() => (data?.leads.length ? Math.min(...data.leads.map(created).filter(Boolean)) : 0), [data])
  const cal = useMemo(() => (now ? calPeriod(kind, offset, now, first) : null), [kind, offset, now, first])
  const active = (members ?? []).filter(m => m.is_active)
  const agent: Member | null = team ? ((members ?? []).find(m => m.id === agentId) ?? active[0] ?? (members ?? [])[0] ?? null) : null

  const ctx = useMemo<Ctx | null>(() => {
    if (!data || pending || !cal) return null
    const scoped = team ? data.leads.filter(l => agent && l.assignedTo === agent.id) : data.leads
    const ids = new Set(scoped.map(l => l.id))
    const len = cal.end - cal.start
    const prev = kind === 'all' ? null : kind === 'week' ? { s: cal.start - 7 * DAY, e: cal.start } : kind === 'month'
      ? { s: new Date(new Date(cal.start).getFullYear(), new Date(cal.start).getMonth() - 1, 1).getTime(), e: cal.start }
      : { s: new Date(new Date(cal.start).getFullYear(), new Date(cal.start).getMonth() - 3, 1).getTime(), e: cal.start }
    // A period still running is compared with the same number of days of the one before
    const elapsed = Math.min(now, cal.end) - cal.start
    return {
      leads: scoped, acts: data.acts.filter(a => ids.has(a.leadId)),
      name: team ? (agent?.name ?? 'Agent') : (myName ?? 'My account'), role: team ? (agent?.role ?? null) : null,
      deals: team ? deals.filter(d => agent && (d.assigned_to ?? '').trim().toLowerCase() === agent.name.trim().toLowerCase()) : deals,
      cal, now, prevStart: prev?.s ?? 0, prevEnd: prev?.e ?? 0, cmpEnd: prev ? Math.min(prev.e, prev.s + (cal.partial ? elapsed : len)) : 0,
    }
  }, [data, pending, cal, team, agent, myName, deals, kind, now])

  const pickKind = (k: CalKind) => { setKind(k); setOffset(0) }

  return (
    <div className="min-h-screen" style={{ background: CANVAS }}>
      <style>{PRINT_CSS}</style>
      <PageTabBar tabs={INSIGHTS_TABS} />
      <PageHeader title="Reports" backHref="/dashboard"
        sub="A ready-to-share report for any week, month or quarter. Download it as a PDF or send it on."
        actions={
          <div role="tablist" aria-label="Whose report" className="flex gap-0.5 rounded-[12px] border p-[3px]" style={{ background: SURFACE, borderColor: BORDER }}>
            <TabBtn on={tab === 'mine'} onClick={() => setTab('mine')}><User size={15} weight="bold" />My report</TabBtn>
            {teamsAdmin
              ? <TabBtn on={tab === 'team'} onClick={() => { setTab('team'); if (kind === 'week' || kind === 'all') pickKind('month') }}><UsersThree size={15} weight="bold" />Team reports</TabBtn>
              : <span title="Team reports are on the Teams plan, for admins" className="flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13.5px] font-semibold" style={{ color: LABEL }}>
                  <Lock size={13} weight="bold" />Team reports<Pill tone="violet" small>Teams</Pill>
                </span>}
          </div>
        }
      />

      <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
        <div className="no-print">
          <TypePicker value={type} onChange={setType} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Seg label="Period length" value={kind} onChange={pickKind} options={(team ? KINDS.filter(k => k.id === 'month' || k.id === 'quarter') : KINDS).map(k => ({ id: k.id, label: k.label }))} />
              {kind !== 'all' && cal && (
                <div className="flex items-center gap-1 rounded-[10px] border bg-white p-[3px]" style={{ borderColor: BORDER, boxShadow: XS }}>
                  <button type="button" onClick={() => setOffset(o => o - 1)} aria-label="Earlier period" className="grid size-8 cursor-pointer place-items-center rounded-[7px] hover:bg-[#F2F4F7]" style={{ color: TEXT_2 }}><CaretLeft size={14} weight="bold" /></button>
                  <span className="min-w-[150px] px-1 text-center text-[13.5px] font-semibold tabular-nums" style={{ color: TEXT }}>{cal.tag && kind !== 'quarter' ? cal.tag : cal.label}</span>
                  <button type="button" onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0} aria-label="Later period"
                    className="grid size-8 cursor-pointer place-items-center rounded-[7px] hover:bg-[#F2F4F7] disabled:cursor-default disabled:opacity-35" style={{ color: TEXT_2 }}><CaretRight size={14} weight="bold" /></button>
                </div>
              )}
              {type === 'seasonal' && <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: SUBTLE }}><Info size={14} weight="bold" />Seasonal always covers the last 12 months</span>}
            </div>
            {team && (members ?? []).length > 0 && (
              <div className="w-full sm:w-[240px] xl:hidden">
                <Select value={agent?.id ?? ''} onChange={setAgentId}>
                  {(members ?? []).map(m => <option key={m.id} value={m.id}>{m.name}{m.is_active ? '' : ' (inactive)'}</option>)}
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          {error && !data ? <LoadError text={error} onRetry={refresh} /> : team && members && members.length === 0 ? (
            <EmptyState icon={<UsersThree size={22} />} title="No agents yet"
              actions={<Link href="/dashboard/team" className="inline-flex h-10 items-center rounded-[10px] px-3.5 text-[14px] font-semibold text-white no-underline" style={{ background: BLUE }}>Add agents</Link>}>
              Add the agents who work your leads on the Team page. Each one then gets a monthly and quarterly report here.
            </EmptyState>
          ) : !ctx ? <PageSkeleton cards={3} panels={2} /> : (
            <div className={team ? 'grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]' : ''}>
              {team && <AgentRail members={members ?? []} leads={data?.leads ?? []} selected={agent?.id ?? null} onSelect={setAgentId} />}
              <Report ctx={ctx} type={type} team={team} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={on} onClick={onClick}
      className="flex h-9 cursor-pointer items-center gap-1.5 rounded-[9px] px-3 text-[13.5px] font-semibold transition-colors"
      style={on ? { background: BLUE, color: '#FFFFFF', boxShadow: '0 1px 2px rgba(16,24,40,0.1)' } : { background: 'transparent', color: SUBTLE }}>
      {children}
    </button>
  )
}

function TypePicker({ value, onChange }: { value: ReportType; onChange: (t: ReportType) => void }) {
  return (
    <div role="tablist" aria-label="Report" className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
      {REPORTS.map(r => {
        const on = r.id === value
        return (
          <button key={r.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(r.id)}
            className="flex min-w-[200px] cursor-pointer items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors sm:min-w-0"
            style={on ? { background: BLUE_BG, borderColor: BLUE_LN, boxShadow: '0 0 0 3px rgba(29,78,216,0.08)' } : { background: CANVAS, borderColor: BORDER, boxShadow: XS }}>
            <span className="grid size-10 shrink-0 place-items-center rounded-[11px]" style={on ? { background: BLUE, color: '#FFFFFF' } : { background: SURFACE, color: TEXT_2, border: `1px solid ${BORDER}` }}>
              <r.Icon size={19} weight="bold" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-semibold" style={{ color: on ? BLUE : TEXT }}>{r.label}</span>
              <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{r.blurb}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function AgentRail({ members, leads, selected, onSelect }: { members: Member[]; leads: InsightLead[]; selected: string | null; onSelect: (id: string) => void }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of leads) if (l.assignedTo && isOpenLead(l)) m.set(l.assignedTo, (m.get(l.assignedTo) ?? 0) + 1)
    return m
  }, [leads])
  return (
    <div className="no-print hidden xl:block">
      <div className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: LABEL }}>Agent</div>
      <div className="flex flex-col gap-1.5">
        {members.map(m => {
          const on = m.id === selected
          return (
            <button key={m.id} type="button" onClick={() => onSelect(m.id)} aria-pressed={on}
              className="flex cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors hover:bg-[#F9FAFB]"
              style={on ? { borderColor: BLUE_LN, background: BLUE_BG } : { borderColor: BORDER, background: CANVAS }}>
              <Avatar name={m.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold" style={{ color: on ? BLUE : TEXT }}>{m.name}</span>
                <span className="block truncate text-[12px]" style={{ color: SUBTLE }}>{plural(counts.get(m.id) ?? 0, 'open lead')}{m.is_active ? '' : ' · inactive'}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Report document ──────────────────────────────────────────────────────────

function Report({ ctx, type, team }: { ctx: Ctx; type: ReportType; team: boolean }) {
  const R = REPORTS.find(r => r.id === type)!
  const { toast, show, hide } = useToast()
  const [copied, setCopied] = useState(false)
  const fig = useMemo(() => figures(ctx, ctx.cal.start, ctx.cal.end), [ctx])
  const prev = useMemo(() => (ctx.prevStart ? figures(ctx, ctx.prevStart, ctx.cmpEnd) : null), [ctx])
  const period = type === 'seasonal' ? 'Last 12 months' : `${ctx.cal.label}${ctx.cal.tag && ctx.cal.kind === 'quarter' ? ` (${ctx.cal.tag})` : ''}${ctx.cal.partial && ctx.cal.kind !== 'all' ? ', so far' : ''}`
  const summary = useMemo(() => summaryText(ctx, type, fig, period), [ctx, type, fig, period])
  const id = `report-${type}`

  const printIt = () => printElement(id, `${R.title} · ${ctx.name} · ${period}`)
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { show({ text: 'Couldn\'t copy. Select the text and copy it instead.', tone: 'err' }) }
  }
  const mail = () => window.open(`mailto:?subject=${encodeURIComponent(`${R.title}: ${ctx.name}, ${period}`)}&body=${encodeURIComponent(summary)}`)
  const wa = () => window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank', 'noopener')
  const csv = () => {
    const rows = csvRows(ctx, type, fig)
    const text = rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${R.title.replace(/\s+/g, '-').toLowerCase()}-${ctx.name.replace(/\s+/g, '-').toLowerCase()}-${period.replace(/[^\w]+/g, '-').toLowerCase()}.csv`
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="min-w-0">
      <div className="no-print mb-3 flex flex-wrap items-center gap-2 sm:justify-end">
        <Btn size="sm" onClick={copy}>{copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}{copied ? 'Copied' : 'Copy summary'}</Btn>
        <Btn size="sm" onClick={wa}><WhatsappLogo size={15} weight="fill" color="#079455" />WhatsApp</Btn>
        <Btn size="sm" onClick={mail}><EnvelopeSimple size={14} weight="bold" />Email</Btn>
        <Btn size="sm" onClick={csv}><DownloadSimple size={14} weight="bold" />CSV</Btn>
        <Btn size="sm" variant="primary" onClick={printIt}><Printer size={14} weight="bold" />Download PDF</Btn>
      </div>

      <article id={id} className="lg-report overflow-hidden rounded-[20px] border bg-white" style={{ borderColor: BORDER, boxShadow: '0 12px 32px -12px rgba(16,24,40,0.14)' }}>
        <header className="relative overflow-hidden px-5 py-6 text-white sm:px-8" style={{ background: 'linear-gradient(135deg, #0E1A5A 0%, #1A2E9E 55%, #1D4ED8 100%)' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: '#C7D7FE' }}><FileText size={15} weight="bold" />LeadGap · {R.label}</div>
              <h2 className="m-0 mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">{R.title}</h2>
              <div className="mt-2 text-[15px]" style={{ color: 'rgba(255,255,255,0.86)' }}>
                <b className="font-semibold text-white">{ctx.name}</b>{ctx.role ? ` · ${ctx.role.replace(/_/g, ' ')}` : team ? '' : ' · all leads in the account'}
              </div>
            </div>
            <div className="text-[13px] sm:text-right" style={{ color: 'rgba(255,255,255,0.78)' }}>
              <div className="text-[12px] uppercase tracking-[0.1em]" style={{ color: '#C7D7FE' }}>Period</div>
              <div className="mt-0.5 text-[15px] font-semibold text-white">{period}</div>
              <div className="mt-2">Generated {shortDate(ctx.now)}</div>
            </div>
          </div>
        </header>
        <div className="px-4 py-6 sm:px-8">
          {type === 'productivity' && <Productivity ctx={ctx} fig={fig} prev={prev} />}
          {type === 'source' && <BySource fig={fig} />}
          {type === 'seasonal' && <Seasonal ctx={ctx} />}
          {type === 'pipeline' && <Pipeline ctx={ctx} fig={fig} />}
        </div>
        <footer className="flex flex-wrap justify-between gap-2 border-t px-5 py-3.5 text-[12px] sm:px-8" style={{ borderColor: BORDER, color: LABEL }}>
          <span>Worked out from leads and logged activity in LeadGap. Won and dropped leads are dated by their last update.</span>
          <span>Confidential</span>
        </footer>
      </article>
      <Toast toast={toast} onClose={hide} />
    </div>
  )
}

function Section({ title, sub, children, icon }: { title: string; sub?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="mt-8 min-w-0 first:mt-0">
      <div className="mb-3 flex items-center gap-2.5 border-b pb-2.5" style={{ borderColor: BORDER }}>
        {icon && <span className="grid size-7 place-items-center rounded-[8px]" style={{ background: BLUE_BG, color: BLUE }}>{icon}</span>}
        <div className="min-w-0">
          <h3 className="m-0 text-[15px] font-semibold" style={{ color: TEXT }}>{title}</h3>
          {sub && <p className="m-0 text-[12.5px]" style={{ color: SUBTLE }}>{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}
function Kpi({ icon, label, value, sub, cur, prev, invert, points, unit }: {
  icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; cur?: number | null; prev?: number | null; invert?: boolean; points?: boolean; unit?: string
}) {
  let delta: ReactNode = null
  if (cur != null && prev != null && (cur || prev)) {
    const d = points ? Math.round(cur - prev) : prev ? Math.round(((cur - prev) / prev) * 100) : null
    if (d == null) delta = <span className="text-[12px] font-semibold" style={{ color: GREEN_D }}>New</span>
    else if (d === 0) delta = <span className="text-[12px] font-semibold" style={{ color: SUBTLE }}>Level</span>
    else {
      const good = invert ? d < 0 : d > 0
      delta = <span className="text-[12px] font-semibold tabular-nums" style={{ color: good ? GREEN_D : '#B42318' }} title={unit}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{points ? ' pts' : '%'}</span>
    }
  }
  return (
    <div className="min-w-0 rounded-[14px] border px-4 py-3.5" style={{ borderColor: BORDER, background: CANVAS }}>
      <div className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: SUBTLE }}>
        <span style={{ color: BLUE }}>{icon}</span><span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[24px] font-semibold leading-tight tracking-[-0.02em] tabular-nums" style={{ color: TEXT }}>{value}</span>
        {delta}
      </div>
      {sub && <div className="mt-0.5 truncate text-[12.5px]" style={{ color: SUBTLE }}>{sub}</div>}
    </div>
  )
}
function Table({ head, rows, align, foot }: { head: ReactNode[]; rows: ReactNode[][]; align?: ('left' | 'right')[]; foot?: ReactNode[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className={`w-full border-collapse overflow-hidden rounded-[12px] border ${head.length >= 5 ? 'min-w-[560px]' : head.length === 4 ? 'min-w-[420px]' : ''}`} style={{ borderColor: BORDER }}>
        <thead>
          <tr style={{ background: SURFACE }}>
            {head.map((h, i) => <th key={i} className={`border-b px-3 py-2.5 text-[12px] font-semibold ${align?.[i] === 'right' ? 'text-right' : 'text-left'}`} style={{ borderColor: BORDER, color: SUBTLE }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-b-0" style={{ borderColor: '#F2F4F7' }}>
              {r.map((c, k) => <td key={k} className={`px-3 py-2.5 text-[13.5px] tabular-nums ${align?.[k] === 'right' ? 'text-right' : 'text-left'}`} style={{ color: k === 0 ? TEXT : TEXT_2 }}>{c}</td>)}
            </tr>
          ))}
          {foot && (
            <tr style={{ background: SURFACE }}>
              {foot.map((c, k) => <td key={k} className={`border-t px-3 py-2.5 text-[13.5px] font-semibold tabular-nums ${align?.[k] === 'right' ? 'text-right' : 'text-left'}`} style={{ borderColor: BORDER, color: TEXT }}>{c}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
const Bar = ({ v, max, color = BLUE }: { v: number; max: number; color?: string }) => (
  <div className="flex items-center gap-2"><Meter value={v} max={max} color={color} className="min-w-[60px] flex-1" /><span className="w-9 text-right text-[12.5px] tabular-nums">{share(v, max)}%</span></div>
)
const Empty = ({ children }: { children: ReactNode }) => <p className="m-0 rounded-[12px] border border-dashed px-4 py-6 text-center text-[13.5px]" style={{ borderColor: BORDER, color: LABEL }}>{children}</p>

// ─── Productivity ─────────────────────────────────────────────────────────────
function Productivity({ ctx, fig, prev }: { ctx: Ctx; fig: Fig; prev: Fig | null }) {
  const cmp = prev ? (ctx.cal.partial ? 'against the same days of the period before' : 'against the period before') : undefined
  const openNow = ctx.leads.filter(isOpenLead)
  const series = ctx.cal.buckets.map(b => {
    const xs = fig.acts.filter(a => isOutreach(a) && bucketIndex([b], ms(a.createdAt)) === 0)
    return { tick: b.tick, label: b.label, parts: CH.map(c => ({ key: c.key, label: c.label, color: c.color, value: xs.filter(a => c.kinds.includes(kindOf(a.type))).length })) }
  })
  const every: [number, number] = ctx.cal.kind === 'month' ? [5, 7] : ctx.cal.kind === 'quarter' ? [2, 3] : ctx.cal.kind === 'all' ? [2, 4] : [1, 1]
  const types = new Map<string, number>()
  for (const a of fig.acts) types.set(typeLabel(a.type), (types.get(typeLabel(a.type)) ?? 0) + 1)
  const typeRows = [...types.entries()].sort((a, b) => b[1] - a[1])
  const srcs = sourceRows(fig.added, fig.j)
  const cities = new Map<string, number>()
  for (const l of fig.added) { const c = l.city?.trim(); if (c) cities.set(c, (cities.get(c) ?? 0) + 1) }
  const stageNow = ORDER.map(st => ({ st, n: fig.added.filter(l => stageOfLead(l) === st).length })).filter(x => x.n > 0)
  return (
    <>
      <Section title="Performance snapshot" sub={cmp ? `Arrows compare ${cmp}` : undefined} icon={<ChartLineUp size={15} weight="bold" />}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Sparkle size={14} weight="bold" />} label="Leads added" value={nf(fig.added.length)} cur={fig.added.length} prev={prev?.added.length} unit={cmp} sub={`${nf(fig.hot)} hot (score 70+)`} />
          <Kpi icon={<Phone size={14} weight="bold" />} label="Calls made" value={nf(fig.calls)} cur={fig.calls} prev={prev?.calls} unit={cmp} sub={`${nf(fig.connected)} got through (${share(fig.connected, fig.calls)}%)`} />
          <Kpi icon={<ChatCircleDots size={14} weight="bold" />} label="Messages sent" value={nf(fig.messages)} cur={fig.messages} prev={prev?.messages} unit={cmp} sub={`${plural(fig.replies, 'reply', 'replies')} received`} />
          <Kpi icon={<MapPin size={14} weight="bold" />} label="Site visits done" value={nf(fig.visits)} cur={fig.visits} prev={prev?.visits} unit={cmp} sub={`${nf(fig.booked)} booked · ${plural(fig.meetings, 'meeting')}`} />
          <Kpi icon={<Trophy size={14} weight="bold" />} label="Deals won" value={nf(fig.won.length)} cur={fig.won.length} prev={prev?.won.length} unit={cmp} sub={fig.wonValue ? inr(fig.wonValue) : 'No value recorded'} />
          <Kpi icon={<Percent size={14} weight="bold" />} label="Win rate" value={fig.winRate != null ? `${fig.winRate}%` : '—'} cur={fig.winRate} prev={prev?.winRate} points unit={cmp} sub={`${nf(fig.won.length)} won · ${nf(fig.dropped.length)} dropped`} />
          <Kpi icon={<Phone size={14} weight="bold" />} label="Response rate" value={`${share(fig.contacted, fig.added.length)}%`} cur={share(fig.contacted, fig.added.length)} prev={prev ? share(prev.contacted, prev.added.length) : null} points unit={cmp} sub="New leads contacted" />
          <Kpi icon={<VideoCamera size={14} weight="bold" />} label="First contact" value={fig.response != null ? dur(fig.response) : '—'}
            cur={fig.response != null ? Math.round(fig.response / 60_000) : null} prev={prev?.response != null ? Math.round(prev.response / 60_000) : null} invert unit={cmp} sub="Median, new leads" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3.5" style={{ borderColor: BLUE_LN, background: BLUE_BG }}>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: BLUE }}>Active pipeline today</div>
            <div className="mt-0.5 text-[22px] font-semibold tabular-nums" style={{ color: TEXT }}>{inr(sum(openNow, valueOf))}</div>
          </div>
          <div className="text-[13px] sm:text-right" style={{ color: TEXT_2 }}>{plural(openNow.length, 'open lead')}<br /><span style={{ color: SUBTLE }}>budgets of New, Cold, Warm, Hot and On hold</span></div>
        </div>
      </Section>

      <Section title="Outreach over the period" sub="Calls, messages, site visits and meetings" icon={<Phone size={15} weight="bold" />}>
        <div className="mb-3"><Legend items={CH.map(c => ({ label: c.label, color: c.color }))} /></div>
        <BarChart points={series} every={every} height={190}
          unit={n => plural(n, 'activity', 'activities')} empty="Nothing logged in this period" />
      </Section>

      <div className="mt-8 grid gap-x-8 gap-y-8 lg:grid-cols-2 [&>section]:mt-0">
        <Section title="Activity breakdown" icon={<ChatCircleDots size={15} weight="bold" />}>
          {typeRows.length ? <Table head={['Activity', 'Count']} align={['left', 'right']} rows={typeRows.map(([t, n]) => [t, nf(n)])} foot={['Total', nf(fig.acts.length)]} /> : <Empty>No activity logged in this period.</Empty>}
        </Section>
        <Section title="Where the new leads are now" icon={<Funnel size={15} weight="bold" />}>
          {stageNow.length ? (
            <>
              <StackBar parts={stageNow.map(x => ({ label: STAGE[x.st].label, value: x.n, color: STAGE[x.st].dot }))} />
              <div className="mt-4"><Table head={['Stage', 'Leads', 'Share']} align={['left', 'right', 'right']}
                rows={stageNow.map(x => [<StagePill key={x.st} stage={x.st} small />, nf(x.n), `${share(x.n, fig.added.length)}%`])} /></div>
            </>
          ) : <Empty>No leads came in during this period.</Empty>}
        </Section>
      </div>

      <div className="mt-8 grid gap-x-8 gap-y-8 lg:grid-cols-2 [&>section]:mt-0">
        <Section title="Lead sources" icon={<Plugs size={15} weight="bold" />}>
          {srcs.length ? <Table head={['Source', 'Leads', 'Share']} align={['left', 'right', 'right']}
            rows={srcs.map(s => [<span key={s.label} className="flex items-center gap-2"><SourceMark raw={s.raw} size={20} />{s.label}</span>, nf(s.leads), <Bar key="b" v={s.leads} max={fig.added.length} />])} /> : <Empty>No leads came in during this period.</Empty>}
        </Section>
        <Section title="City focus" icon={<MapPin size={15} weight="bold" />}>
          {cities.size ? (
            <div className="flex flex-wrap gap-2">
              {[...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => (
                <span key={c} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium" style={{ borderColor: BORDER, color: TEXT }}>
                  {c}<span className="rounded-full px-1.5 text-[12px] font-semibold tabular-nums" style={{ background: BLUE_BG, color: BLUE }}>{n}</span>
                </span>
              ))}
            </div>
          ) : <Empty>No cities recorded on this period&apos;s leads.</Empty>}
        </Section>
      </div>
    </>
  )
}

// ─── By source ────────────────────────────────────────────────────────────────
function BySource({ fig }: { fig: Fig }) {
  const rows = sourceRows(fig.added, fig.j)
  const big = rows.filter(r => r.leads >= MIN_GROUP)
  const best = big.length ? [...big].sort((a, b) => share(b.qualified, b.leads) - share(a.qualified, a.leads) || b.won - a.won)[0] : null
  const types = new Map<string, number>()
  for (const l of fig.added) for (const t of (l.propertyType ?? []).filter(Boolean)) types.set(t, (types.get(t) ?? 0) + 1)
  const typeRows = [...types.entries()].sort((a, b) => b[1] - a[1])
  const typeTotal = sum(typeRows, r => r[1])
  return (
    <>
      <Section title="Summary" icon={<Plugs size={15} weight="bold" />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi icon={<Sparkle size={14} weight="bold" />} label="Leads analysed" value={nf(fig.added.length)} sub={`From ${plural(rows.length, 'source')}`} />
          <Kpi icon={<Trophy size={14} weight="bold" />} label="Best converting source" value={best ? best.label : '—'}
            sub={best ? `${share(best.qualified, best.leads)}% reached Warm+ · ${plural(best.leads, 'lead')}` : `Needs ${MIN_GROUP}+ leads from a source`} />
          <Kpi icon={<Wallet size={14} weight="bold" />} label="Budgets brought in" value={inr(sum(fig.added, valueOf))} sub="Sum of max budgets" />
        </div>
      </Section>
      <Section title="Source and portal breakdown" sub="Each lead's journey so far. Conversion is leads closed out of leads received." icon={<Funnel size={15} weight="bold" />}>
        {rows.length ? <Table head={['Source', 'Leads', 'Hot', 'Avg score', 'Contacted', 'Warm+', 'Won', 'Conversion', 'Budgets']}
          align={['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right']}
          rows={rows.map(r => [
            <span key={r.label} className="flex items-center gap-2 font-semibold"><SourceMark raw={r.raw} size={20} />{r.label}</span>,
            nf(r.leads), r.hot || '—', r.avgScore, `${share(r.contacted, r.leads)}%`, `${share(r.qualified, r.leads)}%`, r.won || '—', `${share(r.won, r.leads)}%`, r.budget ? inr(r.budget) : '—',
          ])}
          foot={['All sources', nf(fig.added.length), nf(fig.hot), fig.added.length ? Math.round(sum(fig.added, scoreOf) / fig.added.length) : 0,
            `${share(fig.contacted, fig.added.length)}%`, `${share(fig.qualified, fig.added.length)}%`, nf(sum(rows, r => r.won)), `${share(sum(rows, r => r.won), fig.added.length)}%`, inr(sum(fig.added, valueOf))]} />
          : <Empty>No leads came in during this period.</Empty>}
        <Basis>Sources are grouped by name, so the same portal spelt two ways counts once.</Basis>
      </Section>
      <Section title="Property type mix" icon={<MapPin size={15} weight="bold" />}>
        {typeRows.length ? <Table head={['Property type', 'Leads', 'Mix']} align={['left', 'right', 'right']}
          rows={typeRows.map(([t, n]) => [t, nf(n), <Bar key="b" v={n} max={typeTotal} />])} /> : <Empty>No property types recorded on this period&apos;s leads.</Empty>}
      </Section>
    </>
  )
}

// ─── Seasonal ─────────────────────────────────────────────────────────────────
function Seasonal({ ctx }: { ctx: Ctx }) {
  const s = useMemo(() => seasonal(ctx), [ctx])
  const withLeads = s.rows.filter(r => r.leads > 0)
  const best = withLeads.length ? [...withLeads].sort((a, b) => b.leads - a.leads)[0] : null
  const slow = withLeads.length > 1 ? [...withLeads].sort((a, b) => a.leads - b.leads)[0] : null
  const conv = s.rows.filter(r => r.leads >= MIN_GROUP).sort((a, b) => share(b.qualified, b.leads) - share(a.qualified, a.leads))[0]
  const maxL = Math.max(1, ...s.rows.map(r => r.leads))
  const maxW = Math.max(1, ...s.weekday)
  const topDay = s.weekday.indexOf(Math.max(...s.weekday))
  return (
    <>
      <Section title="Highlights" icon={<CalendarDots size={15} weight="bold" />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi icon={<Fire size={14} weight="bold" />} label="Busiest month" value={best ? best.m.label : '—'} sub={best ? `${plural(best.leads, 'lead')} · ${plural(best.won, 'deal')} won` : 'No leads yet'} />
          <Kpi icon={<WarningCircle size={14} weight="bold" />} label="Slowest month" value={slow ? slow.m.label : '—'} sub={slow ? plural(slow.leads, 'lead') : 'Needs two months with leads'} />
          <Kpi icon={<Percent size={14} weight="bold" />} label="Best month for quality" value={conv ? conv.m.label : '—'}
            sub={conv ? `${share(conv.qualified, conv.leads)}% of its leads reached Warm+` : `Needs a month with ${MIN_GROUP}+ leads`} />
        </div>
      </Section>
      <Section title="Month by month" sub="Bars are leads added, dots are deals won" icon={<ChartLineUp size={15} weight="bold" />}>
        <BarChart height={200} every={[1, 2]} dotLabel="Deals won" unit={n => plural(n, 'lead')}
          points={s.rows.map(r => ({ tick: r.m.tick, label: r.m.label, dot: r.won, parts: [{ key: 'l', label: 'Leads', color: BLUE, value: r.leads }] }))} />
      </Section>
      <Section title="Monthly performance" icon={<CalendarDots size={15} weight="bold" />}>
        <Table head={['Month', 'Leads added', 'Trend', 'Outreach', 'Reached Warm+', 'Deals won', 'Budgets']} align={['left', 'right', 'left', 'right', 'right', 'right', 'right']}
          rows={[...s.rows].reverse().map(r => [r.m.label, nf(r.leads), <Meter key="m" value={r.leads} max={maxL} className="min-w-[80px]" />, nf(r.outreach),
            r.leads ? `${share(r.qualified, r.leads)}%` : '—', r.won || '—', r.budget ? inr(r.budget) : '—'])}
          foot={['12 months', nf(sum(s.rows, r => r.leads)), '', nf(sum(s.rows, r => r.outreach)), `${share(sum(s.rows, r => r.qualified), sum(s.rows, r => r.leads))}%`, nf(sum(s.rows, r => r.won)), inr(sum(s.rows, r => r.budget))]} />
      </Section>
      <Section title="Which days leads come in" sub="Leads added in the last 12 months, by day of the week" icon={<CalendarDots size={15} weight="bold" />}>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <div className="flex h-[90px] w-full items-end justify-center rounded-[8px]" style={{ background: SURFACE }}>
                <span className="w-[60%] rounded-t-[4px]" style={{ height: `${Math.max(3, (s.weekday[i] / maxW) * 100)}%`, background: i === topDay ? BLUE : BLUE_LN }} />
              </div>
              <span className="text-[12px] font-semibold" style={{ color: i === topDay ? BLUE : SUBTLE }}>{d}</span>
              <span className="text-[12px] tabular-nums" style={{ color: TEXT_2 }}>{s.weekday[i]}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
function Pipeline({ ctx, fig }: { ctx: Ctx; fig: Fig }) {
  const open = ctx.leads.filter(isOpenLead)
  const hot = open.filter(l => stageOfLead(l) === 'Hot').sort((a, b) => valueOf(b) - valueOf(a))
  const byStage = (['New', 'Cold', 'Warm', 'Hot', 'Hold'] as StageId[]).map(st => {
    const xs = open.filter(l => stageOfLead(l) === st)
    return { st, n: xs.length, v: sum(xs, valueOf), age: median(xs.map(l => (ctx.now - created(l)) / DAY)) }
  })
  const openValue = sum(open, valueOf)
  const biggest = [...open].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 15)
  const deals = ctx.deals
  const age = (l: InsightLead) => Math.max(0, Math.floor((ctx.now - created(l)) / DAY))
  const idle = (l: InsightLead) => Math.max(0, Math.floor((ctx.now - startOfDay(ms(l.updatedAt || l.createdAt))) / DAY))
  return (
    <>
      <Section title="Pipeline summary" sub="Open pipeline is as of today. Won and dropped are for the period." icon={<Funnel size={15} weight="bold" />}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Wallet size={14} weight="bold" />} label="Open pipeline" value={inr(openValue)} sub={plural(open.length, 'open lead')} />
          <Kpi icon={<Fire size={14} weight="bold" />} label="Near closing (Hot)" value={inr(sum(hot, valueOf))} sub={plural(hot.length, 'lead')} />
          <Kpi icon={<Trophy size={14} weight="bold" />} label="Won in period" value={inr(fig.wonValue)} sub={plural(fig.won.length, 'deal')} />
          <Kpi icon={<WarningCircle size={14} weight="bold" />} label="Dropped in period" value={nf(fig.dropped.length)} sub={`${inr(sum(fig.dropped, valueOf))} in budgets`} />
        </div>
      </Section>
      <Section title="Open pipeline by stage" icon={<Funnel size={15} weight="bold" />}>
        <StackBar format={inr} parts={byStage.filter(x => x.v > 0).map(x => ({ label: STAGE[x.st].label, value: x.v, color: STAGE[x.st].dot }))} />
        <div className="mt-4"><Table head={['Stage', 'Leads', 'Budgets', 'Share of ₹', 'Typical age']} align={['left', 'right', 'right', 'right', 'right']}
          rows={byStage.map(x => [<StagePill key={x.st} stage={x.st} small />, nf(x.n), x.v ? inr(x.v) : '—', `${share(x.v, openValue)}%`, x.age != null ? `${Math.round(x.age)} days` : '—'])}
          foot={['All open', nf(open.length), inr(openValue), '100%', '']} /></div>
      </Section>
      <Section title="Near closing" sub="Hot leads (EOI received), biggest budgets first" icon={<Fire size={15} weight="bold" />}>
        {hot.length ? <Table head={['Lead', 'City', 'Budget', 'Last update']} align={['left', 'left', 'right', 'right']}
          rows={hot.slice(0, 10).map(l => [<Link key={l.id} href={`/dashboard/leads/${l.id}`} className="font-semibold no-underline" style={{ color: TEXT }}>{displayName(l)}</Link>, l.city ?? '—', valueOf(l) ? inr(valueOf(l)) : '—', idle(l) === 0 ? 'Today' : `${idle(l)} days ago`])} />
          : <Empty>No Hot leads right now.</Empty>}
      </Section>
      <Section title="Biggest open leads" icon={<Wallet size={15} weight="bold" />}>
        {biggest.length ? <Table head={['#', 'Lead', 'Stage', 'City', 'Budget', 'In pipeline']} align={['left', 'left', 'left', 'left', 'right', 'right']}
          rows={biggest.map((l, i) => [i + 1, <Link key={l.id} href={`/dashboard/leads/${l.id}`} className="font-semibold no-underline" style={{ color: TEXT }}>{displayName(l)}</Link>,
            <StagePill key="s" stage={stageOfLead(l)} small />, l.city ?? '—', valueOf(l) ? inr(valueOf(l)) : '—', `${age(l)} days`])} />
          : <Empty>No open leads.</Empty>}
      </Section>
      {deals.length > 0 && (
        <Section title="Deals you are tracking" sub="From the Deals list" icon={<Trophy size={15} weight="bold" />}>
          <Table head={['Deal', 'Stage', 'City', 'Expected close', 'Value']} align={['left', 'left', 'left', 'left', 'right']}
            rows={deals.slice(0, 25).map(d => [d.lead_name, DEAL_STAGE[d.stage] ?? d.stage, d.city ?? '—', d.expected_close ? shortDate(ms(d.expected_close)) : '—', d.deal_value ? inr(d.deal_value) : '—'])}
            foot={['Total', '', '', '', inr(sum(deals, d => Number(d.deal_value ?? 0)))]} />
        </Section>
      )}
    </>
  )
}

// ─── Sharing ──────────────────────────────────────────────────────────────────
function summaryText(ctx: Ctx, type: ReportType, f: Fig, period: string) {
  const R = REPORTS.find(r => r.id === type)!
  const head = `${R.title}: ${ctx.name}\n${period}\n`
  const open = ctx.leads.filter(isOpenLead)
  if (type === 'productivity') return `${head}
• Leads added: ${nf(f.added.length)} (${nf(f.hot)} hot)
• Calls made: ${nf(f.calls)}, ${share(f.connected, f.calls)}% got through
• Messages sent: ${nf(f.messages)}, ${plural(f.replies, 'reply', 'replies')}
• Site visits done: ${nf(f.visits)} (${nf(f.booked)} booked), meetings: ${nf(f.meetings)}
• Deals won: ${nf(f.won.length)}${f.wonValue ? ` worth ${inr(f.wonValue)}` : ''}${f.winRate != null ? `, win rate ${f.winRate}%` : ''}
• New leads contacted: ${share(f.contacted, f.added.length)}%${f.response != null ? `, median first contact ${dur(f.response)}` : ''}
• Open pipeline today: ${inr(sum(open, valueOf))} across ${plural(open.length, 'lead')}`
  if (type === 'source') return `${head}
${sourceRows(f.added, f.j).slice(0, 8).map(r => `• ${r.label}: ${plural(r.leads, 'lead')}, ${share(r.qualified, r.leads)}% Warm+, ${r.won} won`).join('\n') || '• No leads in this period'}`
  if (type === 'seasonal') {
    const s = seasonal(ctx)
    return `${head}
${s.rows.slice(-6).map(r => `• ${r.m.label}: ${plural(r.leads, 'lead')}, ${r.won} won`).join('\n')}
• 12 months: ${plural(sum(s.rows, r => r.leads), 'lead')}, ${plural(sum(s.rows, r => r.won), 'deal')} won`
  }
  const hot = open.filter(l => stageOfLead(l) === 'Hot')
  return `${head}
• Open pipeline: ${inr(sum(open, valueOf))} across ${plural(open.length, 'lead')}
• Near closing (Hot): ${inr(sum(hot, valueOf))} across ${plural(hot.length, 'lead')}
• Won in period: ${plural(f.won.length, 'deal')}${f.wonValue ? `, ${inr(f.wonValue)}` : ''}
• Dropped in period: ${nf(f.dropped.length)}`
}

function csvRows(ctx: Ctx, type: ReportType, f: Fig): (string | number)[][] {
  if (type === 'productivity') {
    const types = new Map<string, number>()
    for (const a of f.acts) types.set(typeLabel(a.type), (types.get(typeLabel(a.type)) ?? 0) + 1)
    return [['Measure', 'Value'], ['Leads added', f.added.length], ['Hot leads added', f.hot], ['Calls made', f.calls], ['Calls got through', f.connected],
      ['Messages sent', f.messages], ['Replies received', f.replies], ['Site visits booked', f.booked], ['Site visits done', f.visits], ['Meetings done', f.meetings],
      ['Deals won', f.won.length], ['Won value', f.wonValue], ['Dropped', f.dropped.length], ['Win rate %', f.winRate ?? ''],
      ['New leads contacted %', share(f.contacted, f.added.length)], ['Median first contact (minutes)', f.response != null ? Math.round(f.response / 60_000) : ''],
      [], ['Activity', 'Count'], ...[...types.entries()].sort((a, b) => b[1] - a[1])]
  }
  if (type === 'source') return [['Source', 'Leads', 'Hot', 'Avg score', 'Contacted', 'Warm+', 'Won', 'Budgets'],
    ...sourceRows(f.added, f.j).map(r => [r.label, r.leads, r.hot, r.avgScore, r.contacted, r.qualified, r.won, r.budget])]
  if (type === 'seasonal') return [['Month', 'Leads added', 'Outreach', 'Reached Warm+', 'Deals won', 'Budgets'],
    ...seasonal(ctx).rows.map(r => [r.m.label, r.leads, r.outreach, r.qualified, r.won, r.budget])]
  return [['Lead', 'Stage', 'City', 'Budget', 'Days in pipeline', 'Phone'],
    ...ctx.leads.filter(isOpenLead).sort((a, b) => valueOf(b) - valueOf(a)).map(l => [displayName(l), STAGE[stageOfLead(l)].label, l.city ?? '', valueOf(l), Math.floor((ctx.now - created(l)) / DAY), l.phones?.primaryPhoneNumber ?? ''])]
}
