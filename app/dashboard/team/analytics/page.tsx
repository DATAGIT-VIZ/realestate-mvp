'use client'

// Team analytics: how each agent works their leads. How fast they reach new leads, how much outreach they do,
// what gets through, and what it turns into. Leads belong to the agent they are assigned to (leads.assigned_to),
// and an activity counts for the agent who owns the lead, the same rule as the Team page.

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  UsersThree, Pulse, Timer, PhoneCall, Trophy, ChartBar, Clock, ListBullets, MagnifyingGlass, Hourglass, Snowflake,
  UserCirclePlus, ArrowRight, Lock, Medal, ArrowsSplit, CalendarBlank, Tray,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import { getPlan } from '@/lib/plan'
import {
  CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, GREEN, GREEN_D, XS, DAY, HOUR,
  STAGE, displayName, inr, Avatar, Pill, Seg, Select, Panel, StatCard, StackBar, Insight, EmptyState, Badge, PageHeader, Chip,
  inputCls, inputStyle, Btn,
} from '@/components/outreach/OutreachKit'
import {
  INSIGHTS_TABS, useInsights, useMembers, type InsightLead, type InsightActivity, type Member, type RollId, ROLL,
  buildJourneys, reached, responseMs, kindOf, isOutreach, isCallAttempt, isConnected, stageOfLead, isOpenLead, valueOf,
  ms, created, closedAt, sum, nf, plural, share, median, dur, rollWindow, bucketIndex, cellOf, emptyGrid, WEEKDAYS, SLOTS,
  Delta, MiniBars, Meter, Basis, SortTh, useSort, BarChart, Legend, Heatmap, PageSkeleton, LoadError, RefreshBtn,
  KIND, typeLabel, timeText, startOfDay, type ActKind,
} from '@/components/insights/InsightsKit'

// ─── Rules ────────────────────────────────────────────────────────────────────
type TeamRoll = Exclude<RollId, '12m'>
const PERIOD_IDS: TeamRoll[] = ['7d', '30d', '90d']
const NONE = 'none'
const QUIET = 7 * DAY
const MIN_GROUP = 5
const AGENT_COLORS = [BLUE, '#7A5AF8', '#F79009', '#17B26A', '#0BA5EC', '#EE46BC', '#EF6820', '#98A2B3']
const CHANNELS: { key: string; label: string; kinds: ActKind[]; color: string }[] = [
  { key: 'call',     label: 'Calls',              kinds: ['call', 'missed'],          color: KIND.call.color },
  { key: 'whatsapp', label: 'WhatsApp',           kinds: ['whatsapp'],                color: KIND.whatsapp.color },
  { key: 'email',    label: 'Email',              kinds: ['email'],                   color: KIND.email.color },
  { key: 'visit',    label: 'Site visits',        kinds: ['visitBooked', 'visit'],    color: KIND.visit.color },
  { key: 'meeting',  label: 'Meetings',           kinds: ['meeting'],                 color: KIND.meeting.color },
]
const channelOf = (a: InsightActivity) => CHANNELS.find(c => c.kinds.includes(kindOf(a.type)))?.key ?? null
const LOG_FILTERS: { id: string; label: string; kinds: ActKind[] | null }[] = [
  { id: 'all',      label: 'All',          kinds: null },
  { id: 'call',     label: 'Calls',        kinds: ['call', 'missed'] },
  { id: 'whatsapp', label: 'WhatsApp',     kinds: ['whatsapp'] },
  { id: 'email',    label: 'Email',        kinds: ['email'] },
  { id: 'reply',    label: 'Replies',      kinds: ['reply'] },
  { id: 'visit',    label: 'Site visits',  kinds: ['visitBooked', 'visit'] },
  { id: 'meeting',  label: 'Meetings',     kinds: ['meeting'] },
  { id: 'deal',     label: 'EOI and deals', kinds: ['eoi', 'closed'] },
  { id: 'followUp', label: 'Follow-ups',   kinds: ['followUp'] },
  { id: 'note',     label: 'Notes',        kinds: ['note'] },
  { id: 'other',    label: 'Stage changes', kinds: ['other'] },
]
const LOG_PAGE = 40

// Plan comes from the browser (lib/plan), so read it as an outside store
const subscribePlan = (f: () => void) => {
  window.addEventListener('plan-changed', f); window.addEventListener('storage', f)
  return () => { window.removeEventListener('plan-changed', f); window.removeEventListener('storage', f) }
}
const usePlan = () => useSyncExternalStore(subscribePlan, getPlan, () => 'solo' as const)

// ─── Working out the numbers ──────────────────────────────────────────────────
type AgentRow = {
  id: string; name: string; role: string | null; active: boolean; color: string
  open: number; newLeads: number; contacted: number; waiting: number; response: number | null; responses: number[]
  touches: number; prevTouches: number; calls: number; connected: number; messages: number; visits: number; meetings: number
  qualified: number; won: number; wonValue: number; dropped: number; quiet: number; activeDays: number; last: number | null
  byChannel: Record<string, number>
}
type TeamA = ReturnType<typeof analyse>

function analyse(leads: InsightLead[], acts: InsightActivity[], members: Member[], period: TeamRoll, now: number) {
  const w = rollWindow(period, now)
  const inWin = (t: number) => t >= w.start && t < w.end
  const inPrev = (t: number) => t >= w.prevStart && t < w.prevEnd
  const leadById = new Map(leads.map(l => [l.id, l]))
  const ownerOf = (l: InsightLead | undefined) => l?.assignedTo ?? NONE
  const known = new Set(members.map(m => m.id))

  const cohort = leads.filter(l => inWin(created(l)))
  const prevCohort = leads.filter(l => inPrev(created(l)))
  const journeys = buildJourneys([...cohort, ...prevCohort], acts)

  // One row per member, plus former members who still own leads, plus "Not assigned"
  const ids = new Set<string>(members.map(m => m.id))
  for (const l of leads) ids.add(ownerOf(l))
  const rows = new Map<string, AgentRow>()
  let ci = 0
  for (const id of ids) {
    const m = members.find(x => x.id === id)
    rows.set(id, {
      id, name: m?.name ?? (id === NONE ? 'Not assigned' : 'Former member'), role: m?.role ?? null, active: m ? m.is_active : false,
      color: id === NONE ? '#D0D5DD' : AGENT_COLORS[ci++ % (AGENT_COLORS.length - 1)],
      open: 0, newLeads: 0, contacted: 0, waiting: 0, response: null, responses: [], touches: 0, prevTouches: 0, calls: 0, connected: 0,
      messages: 0, visits: 0, meetings: 0, qualified: 0, won: 0, wonValue: 0, dropped: 0, quiet: 0, activeDays: 0, last: null,
      byChannel: Object.fromEntries(CHANNELS.map(c => [c.key, 0])),
    })
  }
  for (const l of leads) {
    const r = rows.get(ownerOf(l))!
    const st = stageOfLead(l)
    if (isOpenLead(l)) r.open++
    if ((st === 'Cold' || st === 'Warm' || st === 'Hot') && now - ms(l.updatedAt || l.createdAt) >= QUIET) r.quiet++
    if (inWin(closedAt(l)) && st === 'Closed') { r.won++; r.wonValue += valueOf(l) }
    if (inWin(closedAt(l)) && st === 'Disqualified') r.dropped++
  }
  for (const l of cohort) {
    const r = rows.get(ownerOf(l))!, j = journeys.get(l.id)
    r.newLeads++
    if (reached(j, 'contacted')) r.contacted++
    else if (isOpenLead(l) && stageOfLead(l) !== 'Hold') r.waiting++
    if (reached(j, 'qualified')) r.qualified++
    const rt = responseMs(l, j)
    if (rt != null) r.responses.push(rt)
  }
  const days = new Map<string, Set<number>>()
  const winActs: InsightActivity[] = []
  for (const a of acts) {
    const t = ms(a.createdAt)
    const owner = ownerOf(leadById.get(a.leadId))
    const r = rows.get(owner)
    if (!r) continue
    if (inPrev(t) && isOutreach(a)) r.prevTouches++
    if (!inWin(t)) continue
    winActs.push(a)
    if (!isOutreach(a)) continue
    r.touches++
    const ch = channelOf(a)
    if (ch) r.byChannel[ch]++
    if (isCallAttempt(a)) { r.calls++; if (isConnected(a)) r.connected++ }
    const k = kindOf(a.type)
    if (k === 'whatsapp' || k === 'email') r.messages++
    if (k === 'visit') r.visits++
    if (k === 'meeting') r.meetings++
    if (r.last == null || t > r.last) r.last = t
    const ds = days.get(owner) ?? new Set<number>(); ds.add(startOfDay(t)); days.set(owner, ds)
  }
  for (const r of rows.values()) { r.response = median(r.responses); r.activeDays = days.get(r.id)?.size ?? 0 }

  const agentRows = [...rows.values()]
    .filter(r => r.id === NONE ? r.open + r.newLeads + r.touches > 0 : known.has(r.id) || r.open + r.newLeads + r.touches > 0)
    .sort((x, y) => Number(y.id !== NONE) - Number(x.id !== NONE) || Number(y.active) - Number(x.active) || y.touches - x.touches)

  return { w, cohort, prevCohort, journeys, rows: agentRows, winActs, leadById, ownerOf }
}

/** Team-wide (or one agent's) series and grids for the charts */
function chartData(t: TeamA, agent: string) {
  const pick = (a: InsightActivity) => agent === 'all' || t.ownerOf(t.leadById.get(a.leadId)) === agent
  const acts = t.winActs.filter(a => isOutreach(a) && pick(a))
  const series = t.w.buckets.map(b => ({ b, ch: Object.fromEntries(CHANNELS.map(c => [c.key, 0])) as Record<string, number>, ag: {} as Record<string, number> }))
  const grid = emptyGrid()
  for (const a of acts) {
    const tm = ms(a.createdAt)
    const i = bucketIndex(t.w.buckets, tm)
    if (i >= 0) {
      const ch = channelOf(a)
      if (ch) series[i].ch[ch]++
      const o = t.ownerOf(t.leadById.get(a.leadId))
      series[i].ag[o] = (series[i].ag[o] ?? 0) + 1
    }
    const c = cellOf(tm)
    grid[c.day][c.slot]++
  }
  return { acts, series, grid }
}

function insightsOf(t: TeamA, team: { response: number | null }) {
  const out: { key: string; tone: 'amber' | 'red' | 'blue' | 'green'; icon: React.ReactNode; title: string; body: string; href?: string; cta?: string }[] = []
  const agents = t.rows.filter(r => r.id !== NONE)
  const none = t.rows.find(r => r.id === NONE)
  if (none && none.waiting > 0 && agents.length) out.push({ key: 'none', tone: 'amber', icon: <ArrowsSplit size={15} weight="bold" />,
    title: `${plural(none.waiting, 'new lead')} with no agent`, body: 'They came in during this period, nobody owns them and nobody has contacted them yet.', href: '/dashboard/team', cta: 'Assign them' })
  const waiting = [...agents].sort((a, b) => b.waiting - a.waiting)[0]
  if (waiting && waiting.waiting >= 3) out.push({ key: 'wait', tone: 'red', icon: <Hourglass size={15} weight="bold" />,
    title: `${waiting.name} has ${plural(waiting.waiting, 'new lead')} not contacted`, body: `That's ${share(waiting.waiting, waiting.newLeads)}% of the leads they got in this period.` })
  if (team.response != null) {
    const slow = agents.filter(r => r.responses.length >= MIN_GROUP && r.response != null && r.response >= team.response! * 2 && r.response > HOUR)
      .sort((a, b) => (b.response ?? 0) - (a.response ?? 0))[0]
    if (slow) out.push({ key: 'slow', tone: 'amber', icon: <Timer size={15} weight="bold" />, title: `${slow.name} takes longest to reach new leads`,
      body: `Median first contact ${dur(slow.response)}, against ${dur(team.response)} for the team (${plural(slow.responses.length, 'lead')}).` })
  }
  const quiet = [...agents].sort((a, b) => b.quiet - a.quiet)[0]
  if (quiet && quiet.quiet >= 5) out.push({ key: 'quiet', tone: 'blue', icon: <Snowflake size={15} weight="bold" />,
    title: `${quiet.name} has ${plural(quiet.quiet, 'lead')} gone quiet`, body: 'Cold, Warm or Hot leads with no update in 7 days or more.' })
  const best = [...agents].filter(r => r.newLeads >= MIN_GROUP).sort((a, b) => share(b.qualified, b.newLeads) - share(a.qualified, a.newLeads))[0]
  if (best && best.qualified > 0 && out.length < 3) out.push({ key: 'best', tone: 'green', icon: <Medal size={15} weight="bold" />,
    title: `${best.name} qualifies the most new leads`, body: `${share(best.qualified, best.newLeads)}% of their new leads reached Warm or better.` })
  return out.slice(0, 3)
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TeamAnalyticsPage() {
  const plan = usePlan()
  const teams = plan === 'teams'
  const [period, setPeriod] = useState<TeamRoll>('30d')
  const [agent, setAgent] = useState('all')
  const { data, error, pending, refreshing, refresh } = useInsights(ROLL[period].days * 2 + 2)
  const { members, loading: membersLoading } = useMembers(teams)
  const now = data?.at ?? 0
  const t = useMemo(() => (data && !pending && members ? analyse(data.leads, data.acts, members, period, now) : null), [data, pending, members, period, now])
  const P = ROLL[period]

  const header = (
    <PageHeader title="Team analytics" backHref="/dashboard/team" backLabel="Back to team"
      badge={members && members.length ? <Badge tone="blue"><span className="size-1.5 rounded-full" style={{ background: GREEN }} />{plural(members.filter(m => m.is_active).length, 'active agent')}</Badge> : undefined}
      sub="How each agent works their leads: how fast, how much, what gets through and what it turns into."
      actions={teams ? <>
        <Seg label="Period" value={period} onChange={setPeriod} options={PERIOD_IDS.map(id => ({ id, label: ROLL[id].label }))} />
        {t && t.rows.length > 1 && (
          <Select value={agent} onChange={setAgent} className="w-[180px]">
            <option value="all">All agents</option>
            {t.rows.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        )}
        <RefreshBtn refreshing={refreshing} onRefresh={refresh} />
      </> : undefined}
    />
  )

  if (!teams) {
    return (
      <div className="min-h-screen" style={{ background: CANVAS }}>
        <PageTabBar tabs={INSIGHTS_TABS} />
        {header}
        <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
          <EmptyState icon={<Lock size={22} />} title="Team analytics is part of the Teams plan"
            actions={<Link href="/dashboard/settings/billing" className="inline-flex h-10 items-center rounded-[10px] px-3.5 text-[14px] font-semibold text-white no-underline" style={{ background: BLUE }}>See plans</Link>}>
            With a team, this page shows how fast each agent reaches new leads, how much outreach they do and how many leads they qualify and close. Your own numbers are on Analytics and Reports.
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: CANVAS }}>
      <PageTabBar tabs={INSIGHTS_TABS} />
      {header}
      <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
        {error && !data ? <LoadError text={error} onRetry={refresh} /> : !t || !data || membersLoading ? <PageSkeleton /> : members && members.length === 0 ? (
          <EmptyState icon={<UserCirclePlus size={22} />} title="Add your agents first"
            actions={<Link href="/dashboard/team" className="inline-flex h-10 items-center rounded-[10px] px-3.5 text-[14px] font-semibold text-white no-underline" style={{ background: BLUE }}>Go to Team</Link>}>
            Team analytics compares the agents who work your leads. Add them on the Team page and assign leads to them, and their numbers show up here.
          </EmptyState>
        ) : (
          <Body t={t} agent={agent} onAgent={setAgent} period={period} now={now} long={P.long} />
        )}
      </div>
    </div>
  )
}

function Body({ t, agent, onAgent, period, now, long }: { t: TeamA; agent: string; onAgent: (a: string) => void; period: TeamRoll; now: number; long: string }) {
  const P = ROLL[period]
  const rows = agent === 'all' ? t.rows : t.rows.filter(r => r.id === agent)
  const tot = {
    touches: sum(rows, r => r.touches), prevTouches: sum(rows, r => r.prevTouches), calls: sum(rows, r => r.calls), connected: sum(rows, r => r.connected),
    messages: sum(rows, r => r.messages), newLeads: sum(rows, r => r.newLeads), qualified: sum(rows, r => r.qualified),
    won: sum(rows, r => r.won), wonValue: sum(rows, r => r.wonValue), response: median(rows.flatMap(r => r.responses)),
    within: rows.flatMap(r => r.responses),
  }
  // Same numbers for the period before, for the arrows on the cards
  const prev = useMemo(() => {
    const keep = (l: InsightLead | undefined) => agent === 'all' || t.ownerOf(l) === agent
    const pc = t.prevCohort.filter(keep)
    const resp = pc.map(l => responseMs(l, t.journeys.get(l.id))).filter((x): x is number => x != null)
    return { response: median(resp) }
  }, [t, agent])
  const cd = useMemo(() => chartData(t, agent), [t, agent])
  const found = useMemo(() => (agent === 'all' ? insightsOf(t, { response: tot.response }) : []), [t, agent, tot.response])
  const unit = `previous ${P.long.replace('last ', '')}`
  const agentName = rows[0]?.name

  return (
    <>
      {agent !== 'all' && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: '#B2CCFF', background: '#EFF4FF' }}>
          <Avatar name={agentName ?? '?'} size={28} />
          <span className="min-w-0 flex-1 text-[14px]" style={{ color: TEXT_2 }}>Showing <b style={{ color: TEXT }}>{agentName}</b> only</span>
          <Btn size="sm" onClick={() => onAgent('all')}>Show whole team</Btn>
        </div>
      )}

      {found.length > 0 && (
        <div className={`mb-6 grid gap-3 ${found.length >= 3 ? 'lg:grid-cols-3' : found.length === 2 ? 'lg:grid-cols-2' : ''}`}>
          {found.map(f => (
            <Insight key={f.key} tone={f.tone} icon={f.icon} title={f.title}>
              <span>{f.body}</span>
              {f.href && <div className="mt-2"><Link href={f.href} className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline" style={{ color: BLUE }}>{f.cta}<ArrowRight size={13} weight="bold" /></Link></div>}
            </Insight>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={<Pulse size={16} weight="bold" />} accent={BLUE} label="Outreach" value={nf(tot.touches)}
          pill={<Delta cur={tot.touches} prev={tot.prevTouches} unit={unit} />}
          sub={`${nf(tot.calls)} calls · ${nf(tot.messages)} messages`}>
          <MiniBars values={cd.series.map(s => sum(Object.values(s.ch), x => x))} label={`Outreach per ${P.unit}`} />
        </StatCard>
        <StatCard icon={<Timer size={16} weight="bold" />} accent="#7A5AF8" label="Speed to lead" value={tot.response != null ? dur(tot.response) : '—'}
          pill={tot.response != null && prev.response ? <Delta cur={Math.round(tot.response / 60_000)} prev={Math.round(prev.response / 60_000)} unit={unit} invert /> : undefined}
          sub={tot.within.length ? `${share(tot.within.filter(x => x <= HOUR).length, tot.within.length)}% within an hour` : 'No first contacts logged'}>
          <div className="flex h-9 items-center"><div className="w-full"><Meter value={tot.within.filter(x => x <= HOUR).length} max={tot.within.length} color="#7A5AF8" height={10} /></div></div>
        </StatCard>
        <StatCard icon={<PhoneCall size={16} weight="bold" />} accent={GREEN_D} label="Calls answered" value={`${share(tot.connected, tot.calls)}%`}
          sub={`${nf(tot.connected)} of ${plural(tot.calls, 'call')}`}>
          <div className="flex h-9 items-center"><div className="w-full"><StackBar legend={false} parts={[
            { label: 'Got through', value: tot.connected, color: GREEN }, { label: 'No answer', value: tot.calls - tot.connected, color: '#FEC84B' },
          ]} /></div></div>
        </StatCard>
        <StatCard icon={<Trophy size={16} weight="bold" />} accent="#EF6820" label="Deals won" value={nf(tot.won)}
          pill={tot.wonValue ? <Pill tone="green" small>{inr(tot.wonValue)}</Pill> : undefined}
          sub={`${nf(tot.qualified)} of ${plural(tot.newLeads, 'new lead')} reached Warm+`}>
          <div className="flex h-9 items-center"><div className="w-full"><Meter value={tot.qualified} max={tot.newLeads} color="#F79009" height={10} /></div></div>
        </StatCard>
      </div>

      <div className="mt-6"><Scorecard rows={t.rows} agent={agent} onAgent={onAgent} long={long} now={now} /></div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Activity t={t} cd={cd} period={period} agent={agent} />
        <Rhythm grid={cd.grid} total={cd.acts.length} long={long} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Mix rows={rows} long={long} />
        <Results t={t} agent={agent} long={long} />
      </div>

      <div className="mt-6"><Log t={t} agent={agent} now={now} long={long} /></div>
    </>
  )
}

// ─── Scorecard ────────────────────────────────────────────────────────────────
type ColKey = 'newLeads' | 'contacted' | 'response' | 'touches' | 'connect' | 'visits' | 'qualified' | 'won' | 'quiet' | 'activeDays'
const COLS: { key: ColKey; label: string; short?: string; help: string; low?: boolean }[] = [
  { key: 'newLeads',   label: 'New leads',     help: 'Leads assigned to them that came in during the period' },
  { key: 'contacted',  label: 'Contacted',     help: 'Share of their new leads that got a call, message or email' },
  { key: 'response',   label: 'First contact', short: 'Speed', help: 'Median time from a new lead arriving to the first contact', low: true },
  { key: 'touches',    label: 'Outreach',      help: 'Calls, messages, emails, visits and meetings on their leads' },
  { key: 'connect',    label: 'Got through',   help: 'Share of their calls that connected' },
  { key: 'visits',     label: 'Visits, meetings', help: 'Site visits and video or builder meetings done' },
  { key: 'qualified',  label: 'Warm+',         help: 'Share of their new leads that reached Warm or better' },
  { key: 'won',        label: 'Won',           help: 'Leads closed during the period' },
  { key: 'quiet',      label: 'Gone quiet',    help: 'Cold, Warm or Hot leads with no update in 7+ days', low: true },
  { key: 'activeDays', label: 'Active days',   help: 'Days with at least one call, message or visit' },
]
function colValue(r: AgentRow, k: ColKey): number | null {
  switch (k) {
    case 'contacted': return r.newLeads ? share(r.contacted, r.newLeads) : null
    case 'response': return r.response
    case 'connect': return r.calls ? share(r.connected, r.calls) : null
    case 'visits': return r.visits + r.meetings
    case 'qualified': return r.newLeads ? share(r.qualified, r.newLeads) : null
    default: return r[k]
  }
}
function colText(r: AgentRow, k: ColKey) {
  const v = colValue(r, k)
  if (v == null) return '—'
  if (k === 'contacted' || k === 'connect' || k === 'qualified') return `${v}%`
  if (k === 'response') return dur(v)
  if (k === 'won') return r.won ? `${r.won}${r.wonValue ? ` · ${inr(r.wonValue)}` : ''}` : '0'
  return nf(v)
}

function Scorecard({ rows, agent, onAgent, long, now }: { rows: AgentRow[]; agent: string; onAgent: (a: string) => void; long: string; now: number }) {
  const { sort, onSort } = useSort<ColKey>('touches')
  const agents = rows.filter(r => r.id !== NONE)
  const best = useMemo(() => {
    const out = {} as Record<ColKey, string | null>
    for (const c of COLS) {
      const vals = agents.map(r => ({ id: r.id, v: colValue(r, c.key) })).filter((x): x is { id: string; v: number } => x.v != null)
      if (vals.length < 2) { out[c.key] = null; continue }
      vals.sort((a, b) => (c.low ? a.v - b.v : b.v - a.v))
      out[c.key] = vals[0].v !== vals[1].v ? vals[0].id : null
    }
    return out
  }, [agents])
  const sorted = [...rows].sort((x, y) => {
    if ((x.id === NONE) !== (y.id === NONE)) return x.id === NONE ? 1 : -1
    const a = colValue(x, sort.key), b = colValue(y, sort.key)
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    return (a - b) * sort.dir
  })
  return (
    <Panel icon={<UsersThree size={18} weight="bold" />} title="Agent scorecard"
      sub={`Every agent side by side for the ${long}. A green mark is the best on the team. Tap an agent to see only their numbers.`}>
      <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 lg:block">
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr className="border-y" style={{ borderColor: BORDER, background: SURFACE }}>
              <th className="py-2.5 pl-5 pr-3 text-left text-[12px] font-semibold" style={{ color: SUBTLE }}>Agent</th>
              {COLS.map(c => <SortTh key={c.key} id={c.key} sort={sort} onSort={onSort} wrap className={c.key === 'activeDays' ? 'pr-5' : ''}><span title={c.help}>{c.label}</span></SortTh>)}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const on = agent === r.id
              return (
                <tr key={r.id} onClick={() => onAgent(on ? 'all' : r.id)} className="cursor-pointer border-b transition-colors hover:bg-[#F9FAFB]"
                  style={{ borderColor: '#F2F4F7', background: on ? '#F5F8FF' : undefined }}>
                  <td className="py-3 pl-5 pr-3">
                    <span className="flex items-center gap-3">
                      {r.id === NONE ? <span className="grid size-9 place-items-center rounded-full" style={{ background: '#F2F4F7', color: SUBTLE }}><Tray size={16} weight="bold" /></span> : <Avatar name={r.name} size={36} />}
                      <span className="min-w-0 max-w-[170px]">
                        <span className="block truncate text-[14px] font-semibold" style={{ color: TEXT }}>{r.name}</span>
                        <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>
                          {r.id === NONE ? 'Leads nobody owns' : `${plural(r.open, 'open lead')}${!r.active ? ' · inactive' : ''}${r.last ? ` · last ${agoText(r.last, now)}` : ''}`}
                        </span>
                      </span>
                    </span>
                  </td>
                  {COLS.map(c => {
                    const isBest = best[c.key] === r.id
                    const warn = c.key === 'quiet' && r.quiet >= 5 || (c.key === 'contacted' && r.newLeads >= MIN_GROUP && share(r.contacted, r.newLeads) < 50)
                    return (
                      <td key={c.key} className={`whitespace-nowrap px-2.5 py-3 text-right text-[13.5px] tabular-nums ${c.key === 'activeDays' ? 'pr-5' : ''}`}
                        style={{ color: warn ? '#B54708' : colValue(r, c.key) == null ? LABEL : TEXT_2, fontWeight: isBest ? 600 : 400 }}>
                        <span className="inline-flex items-center gap-1.5">
                          {isBest && <span className="size-1.5 rounded-full" style={{ background: GREEN }} title="Best on the team" />}
                          {c.key === 'won' && r.won && r.wonValue
                            ? <span className="flex flex-col items-end leading-tight">{r.won}<span className="text-[11.5px] font-normal" style={{ color: SUBTLE }}>{inr(r.wonValue)}</span></span>
                            : colText(r, c.key)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2.5 lg:hidden">
        <Seg label="Sort agents" value={sort.key} onChange={k => onSort(k)} full options={[
          { id: 'touches', label: 'Outreach' }, { id: 'response', label: 'Speed' }, { id: 'qualified', label: 'Warm+' }, { id: 'won', label: 'Won' },
        ]} />
        {sorted.map(r => {
          const on = agent === r.id
          return (
            <button key={r.id} type="button" onClick={() => onAgent(on ? 'all' : r.id)} className="cursor-pointer rounded-[14px] border p-3.5 text-left"
              style={{ borderColor: on ? '#84ADFF' : BORDER, background: on ? '#F5F8FF' : CANVAS, boxShadow: XS }}>
              <span className="flex items-center gap-3">
                {r.id === NONE ? <span className="grid size-9 place-items-center rounded-full" style={{ background: '#F2F4F7', color: SUBTLE }}><Tray size={16} weight="bold" /></span> : <Avatar name={r.name} size={36} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold" style={{ color: TEXT }}>{r.name}</span>
                  <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{r.id === NONE ? 'Leads nobody owns' : plural(r.open, 'open lead')}</span>
                </span>
                {r.won > 0 && <Pill tone="green" small><Trophy size={11} weight="bold" />{r.won}</Pill>}
              </span>
              <span className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                {(['newLeads', 'contacted', 'response', 'qualified'] as ColKey[]).map(k => (
                  <span key={k} className="rounded-[10px] px-1 py-2" style={{ background: SURFACE }}>
                    <span className="block truncate text-[14px] font-semibold tabular-nums" style={{ color: best[k] === r.id ? GREEN_D : TEXT }}>{colText(r, k)}</span>
                    <span className="block truncate text-[11px]" style={{ color: SUBTLE }}>{(c => c.short ?? c.label)(COLS.find(c => c.key === k)!)}</span>
                  </span>
                ))}
              </span>
              <span className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]" style={{ color: SUBTLE }}>
                <span>Outreach <b className="font-semibold" style={{ color: TEXT_2 }}>{nf(r.touches)}</b></span>
                <span>Got through <b className="font-semibold" style={{ color: TEXT_2 }}>{colText(r, 'connect')}</b></span>
                <span>Quiet <b className="font-semibold" style={{ color: r.quiet >= 5 ? '#B54708' : TEXT_2 }}>{r.quiet}</b></span>
              </span>
            </button>
          )
        })}
      </div>
      <Basis>Activity counts for the agent the lead is assigned to. Rates from fewer than {MIN_GROUP} leads are shown but not marked best.</Basis>
    </Panel>
  )
}
const agoText = (t: number, now: number) => {
  const s = now - t
  return s < HOUR ? 'just now' : s < DAY ? `${Math.floor(s / HOUR)}h ago` : `${Math.floor(s / DAY)}d ago`
}

// ─── Activity over time ───────────────────────────────────────────────────────
function Activity({ t, cd, period, agent }: { t: TeamA; cd: ReturnType<typeof chartData>; period: TeamRoll; agent: string }) {
  const [by, setBy] = useState<'channel' | 'agent'>('channel')
  const P = ROLL[period]
  const every: [number, number] = period === '30d' ? [5, 5] : period === '90d' ? [2, 3] : [1, 1]
  const view = agent === 'all' ? by : 'channel'
  const agentsShown = t.rows.slice(0, 7)
  const points = cd.series.map(s => ({
    tick: s.b.tick, label: s.b.label,
    parts: view === 'channel'
      ? CHANNELS.map(c => ({ key: c.key, label: c.label, color: c.color, value: s.ch[c.key] }))
      : agentsShown.map(r => ({ key: r.id, label: r.name, color: r.color, value: s.ag[r.id] ?? 0 })),
  }))
  return (
    <Panel icon={<ChartBar size={18} weight="bold" />} title="Outreach over time" sub={`Calls, messages, visits and meetings per ${P.unit}`} className="h-full"
      right={agent === 'all' ? <Seg label="Split by" value={by} onChange={setBy} options={[{ id: 'channel', label: 'By channel' }, { id: 'agent', label: 'By agent' }]} /> : undefined}>
      <div className="mb-3"><Legend items={view === 'channel' ? CHANNELS.map(c => ({ label: c.label, color: c.color })) : agentsShown.map(r => ({ label: r.name, color: r.color }))} /></div>
      <BarChart points={points} every={every} height={230} unit={n => plural(n, 'activity', 'activities')} empty={`Nothing logged in the ${P.long}`} />
    </Panel>
  )
}

// ─── Work rhythm ──────────────────────────────────────────────────────────────
function Rhythm({ grid, total, long }: { grid: number[][]; total: number; long: string }) {
  let v = 0, d = 0, s = 0
  grid.forEach((row, di) => row.forEach((x, si) => { if (x > v) { v = x; d = di; s = si } }))
  const weekend = sum(grid.slice(5).flat(), x => x)
  return (
    <Panel icon={<Clock size={18} weight="bold" />} title="When the team works" sub={`Outreach by day and time of day (${long})`} className="h-full">
      <Heatmap grid={grid} />
      <Basis>{total ? <>Busiest: <b className="font-semibold" style={{ color: TEXT_2 }}>{WEEKDAYS[d]} {SLOTS[s]}</b>. {share(weekend, total)}% of outreach happens on Saturdays and Sundays.</> : 'Nothing logged in this period.'}</Basis>
    </Panel>
  )
}

// ─── Channel mix ──────────────────────────────────────────────────────────────
function Mix({ rows, long }: { rows: AgentRow[]; long: string }) {
  const shown = rows.filter(r => r.touches > 0)
  const max = Math.max(1, ...shown.map(r => r.touches))
  return (
    <Panel icon={<CalendarBlank size={18} weight="bold" />} title="How each agent reaches leads" sub={`Mix of channels per agent (${long})`} className="h-full">
      <div className="mb-3"><Legend items={CHANNELS.map(c => ({ label: c.label, color: c.color }))} /></div>
      {shown.length === 0 ? <p className="m-0 py-6 text-center text-[14px]" style={{ color: LABEL }}>No outreach logged in this period.</p> : (
        <div className="flex flex-col gap-3.5">
          {shown.map(r => (
            <div key={r.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[13.5px]">
                <span className="truncate font-semibold" style={{ color: TEXT }}>{r.name}</span>
                <span className="shrink-0 tabular-nums" style={{ color: SUBTLE }}>{nf(r.touches)}</span>
              </div>
              <div style={{ width: `${Math.max(12, (r.touches / max) * 100)}%` }}>
                <StackBar legend={false} parts={CHANNELS.map(c => ({ label: c.label, value: r.byChannel[c.key], color: c.color }))} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

// ─── Results ──────────────────────────────────────────────────────────────────
type ResultTab = 'new' | 'won' | 'dropped'
function Results({ t, agent, long }: { t: TeamA; agent: string; long: string }) {
  const [tab, setTab] = useState<ResultTab>('new')
  const [more, setMore] = useState(false)
  const keep = (l: InsightLead) => agent === 'all' || t.ownerOf(l) === agent
  const all = [...t.leadById.values()].filter(keep)
  const inWin = (x: number) => x >= t.w.start && x < t.w.end
  const lists: Record<ResultTab, InsightLead[]> = {
    new: t.cohort.filter(keep).sort((a, b) => created(b) - created(a)),
    won: all.filter(l => stageOfLead(l) === 'Closed' && inWin(closedAt(l))).sort((a, b) => closedAt(b) - closedAt(a)),
    dropped: all.filter(l => stageOfLead(l) === 'Disqualified' && inWin(closedAt(l))).sort((a, b) => closedAt(b) - closedAt(a)),
  }
  const list = lists[tab]
  const nameOf = (l: InsightLead) => t.rows.find(r => r.id === t.ownerOf(l))?.name ?? 'Not assigned'
  return (
    <Panel icon={<Trophy size={18} weight="bold" />} title="Results" sub={`New leads, deals won and leads dropped in the ${long}`} className="h-full"
      right={<Seg label="Show" value={tab} onChange={v => { setTab(v); setMore(false) }} options={[
        { id: 'new', label: 'New', count: lists.new.length }, { id: 'won', label: 'Won', count: lists.won.length }, { id: 'dropped', label: 'Dropped', count: lists.dropped.length },
      ]} />}>
      {list.length === 0 ? <p className="m-0 py-8 text-center text-[14px]" style={{ color: LABEL }}>{tab === 'new' ? 'No new leads' : tab === 'won' ? 'No deals closed' : 'No leads dropped'} in this period.</p> : (
        <div className="flex flex-col">
          {list.slice(0, more ? 60 : 8).map(l => {
            const when = tab === 'new' ? created(l) : closedAt(l)
            return (
              <Link key={l.id} href={`/dashboard/leads/${l.id}`} className="flex items-center gap-3 border-t py-2.5 no-underline first:border-t-0" style={{ borderColor: '#F2F4F7' }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold" style={{ color: TEXT }}>{displayName(l)}</span>
                  <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{nameOf(l)}{l.city ? ` · ${l.city}` : ''}{tab === 'new' ? ` · ${STAGE[stageOfLead(l)].label} now` : ''}</span>
                </span>
                {valueOf(l) > 0 && <span className="shrink-0 text-[13.5px] font-semibold tabular-nums" style={{ color: tab === 'won' ? GREEN_D : TEXT_2 }}>{inr(valueOf(l))}</span>}
                <span className="w-[74px] shrink-0 text-right text-[12.5px] tabular-nums" style={{ color: SUBTLE }}>{new Date(when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </Link>
            )
          })}
          {list.length > 8 && !more && <div className="pt-2"><Btn size="sm" variant="ghost" onClick={() => setMore(true)}>Show {Math.min(list.length, 60) - 8} more</Btn></div>}
        </div>
      )}
      {tab !== 'new' && <Basis>Won and dropped leads are dated by their last update, because leads don&apos;t store a closing date.</Basis>}
    </Panel>
  )
}

// ─── Activity log ─────────────────────────────────────────────────────────────
function Log({ t, agent, now, long }: { t: TeamA; agent: string; now: number; long: string }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(LOG_PAGE)
  const f = LOG_FILTERS.find(x => x.id === filter)!
  const base = useMemo(() => t.winActs.filter(a => agent === 'all' || t.ownerOf(t.leadById.get(a.leadId)) === agent), [t, agent])
  const counts = useMemo(() => Object.fromEntries(LOG_FILTERS.map(x => [x.id, x.kinds ? base.filter(a => x.kinds!.includes(kindOf(a.type))).length : base.length])), [base])
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return base
      .filter(a => !f.kinds || f.kinds.includes(kindOf(a.type)))
      .filter(a => {
        if (!needle) return true
        const l = t.leadById.get(a.leadId)
        return (l ? displayName(l).toLowerCase().includes(needle) : false) || (a.notes ?? '').toLowerCase().includes(needle)
      })
      .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
  }, [base, f, q, t.leadById])
  const groups: { day: number; items: InsightActivity[] }[] = []
  for (const a of list.slice(0, shown)) {
    const d = startOfDay(ms(a.createdAt))
    const g = groups[groups.length - 1]
    if (g && g.day === d) g.items.push(a); else groups.push({ day: d, items: [a] })
  }
  const today = startOfDay(now)
  const dayLabel = (d: number) => d === today ? 'Today' : d === today - DAY ? 'Yesterday' : new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const nameOf = (a: InsightActivity) => t.rows.find(r => r.id === t.ownerOf(t.leadById.get(a.leadId)))?.name ?? 'Not assigned'

  return (
    <Panel icon={<ListBullets size={18} weight="bold" />} title="Activity log" sub={`Everything logged on the team's leads in the ${long}, newest first`}
      right={<div className="relative w-full sm:w-[260px]">
        <MagnifyingGlass size={15} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: SUBTLE }} />
        <input value={q} onChange={e => { setQ(e.target.value); setShown(LOG_PAGE) }} placeholder="Search lead or note" aria-label="Search the log"
          className={`${inputCls} pl-9`} style={inputStyle} />
      </div>}>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5">
        {LOG_FILTERS.filter(x => x.id === 'all' || counts[x.id] > 0).map(x => (
          <Chip key={x.id} on={filter === x.id} onClick={() => { setFilter(x.id); setShown(LOG_PAGE) }} count={counts[x.id]}>{x.label}</Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="m-0 py-10 text-center text-[14px]" style={{ color: LABEL }}>{base.length ? 'Nothing matches.' : 'Calls, messages, notes and stage changes show up here once they are logged.'}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(g => (
            <div key={g.day}>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: LABEL }}>{dayLabel(g.day)}</div>
              <div className="flex flex-col">
                {g.items.map(a => {
                  const K = KIND[kindOf(a.type)]
                  const l = t.leadById.get(a.leadId)
                  const got = isCallAttempt(a) ? (isConnected(a) ? 'Got through' : 'No answer') : null
                  return (
                    <div key={a.id} className="flex gap-3 border-t py-3 first:border-t-0" style={{ borderColor: '#F2F4F7' }}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-[10px]" style={{ background: `${K.color}1A`, color: K.color === '#D0D5DD' || K.color === '#E4E7EC' ? SUBTLE : K.color }}>
                        <K.Icon size={16} weight="fill" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{typeLabel(a.type)}</span>
                          {got && <Pill tone={got === 'Got through' ? 'green' : 'amber'} small>{got}</Pill>}
                          {a.outcome && !got && <Pill small>{a.outcome}</Pill>}
                          {a.duration ? <span className="text-[12.5px] tabular-nums" style={{ color: SUBTLE }}>{dur(a.duration * 1000)}</span> : null}
                        </div>
                        <div className="mt-0.5 truncate text-[13px]" style={{ color: SUBTLE }}>
                          {l ? <Link href={`/dashboard/leads/${l.id}`} className="font-medium no-underline hover:underline" style={{ color: TEXT_2 }}>{displayName(l)}</Link> : 'Lead removed'}
                          {' · '}{nameOf(a)}
                        </div>
                        {a.notes && <p className="m-0 mt-1 text-[13px] leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden" style={{ color: TEXT_2 }}>{a.notes}</p>}
                      </div>
                      <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: LABEL }}>{timeText(ms(a.createdAt))}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {list.length > shown && (
            <div className="flex items-center justify-center gap-3 border-t pt-4" style={{ borderColor: BORDER_2 }}>
              <span className="text-[13px] tabular-nums" style={{ color: SUBTLE }}>Showing {nf(shown)} of {nf(list.length)}</span>
              <Btn size="sm" onClick={() => setShown(s => s + LOG_PAGE * 2)}>Show more</Btn>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
