'use client'

// Analytics: how leads turn into deals, where they slip, and what to fix first. Every number comes from the
// signed-in user's own leads and the activity logged on them. Nothing on this page is sample data.

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Funnel, Timer, Lightning, ChartBar, Plugs, Target, MapPin, Clock, ArrowRight, Hourglass,
  Gauge, ListChecks, Phone, Trophy, WarningCircle, Sparkle,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import {
  CANVAS, SURFACE, BORDER, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_LN, GREEN, GREEN_D, XS, DAY, HOUR,
  STAGE, type StageId, displayName, inr, sourceMeta, SourceMark, LeadAvatar, StagePill, Pill, Seg, Panel,
  StatCard, StackBar, Insight, EmptyState, Badge, PageHeader,
} from '@/components/outreach/OutreachKit'
import {
  INSIGHTS_TABS, useInsights, type InsightLead, type InsightActivity, type Journey, type StepKey, type RollId, ROLL,
  STEPS, ORDER, buildJourneys, reached, responseMs, kindOf, isCallAttempt, isConnected, stageOfLead, isOpenLead,
  scoreOf, valueOf, ms, created, closedAt, sum, nf, plural, share, median, dur, rollWindow, bucketIndex, cellOf,
  emptyGrid, WEEKDAYS, SLOTS, Delta, MiniBars, Meter, Basis, SortTh, useSort, CallLink, WaLink, BarChart, Legend,
  Heatmap, PageSkeleton, LoadError, RefreshBtn, Figure, KIND, type ActKind,
} from '@/components/insights/InsightsKit'

// ─── Rules ────────────────────────────────────────────────────────────────────
const MIN_GROUP = 5          // a group needs this many leads before the page compares it with another
const MIN_CELL_CALLS = 3     // a heatmap cell needs this many calls before it shows a connect rate
const HOT_SCORE = 70
const SPEED = [
  { label: 'Under 5 min',  max: 5 * 60_000 },
  { label: '5–30 min',     max: 30 * 60_000 },
  { label: '30 min – 1 h', max: HOUR },
  { label: '1–4 hours',    max: 4 * HOUR },
  { label: '4–24 hours',   max: DAY },
  { label: '1–3 days',     max: 3 * DAY },
  { label: '3+ days',      max: Infinity },
]
const SCORE_BANDS = [
  { label: '70–100', sub: 'High intent', min: 70, max: 101, color: BLUE },
  { label: '40–69',  sub: 'Medium',      min: 40, max: 70,  color: '#F79009' },
  { label: '0–39',   sub: 'Low',         min: 0,  max: 40,  color: '#98A2B3' },
]
const BUDGETS = [
  { label: 'Under ₹50 L',  min: 1,   max: 5e6 },
  { label: '₹50 L – 1 Cr', min: 5e6, max: 1e7 },
  { label: '₹1 – 2 Cr',    min: 1e7, max: 2e7 },
  { label: '₹2 – 5 Cr',    min: 2e7, max: 5e7 },
  { label: '₹5 Cr and up', min: 5e7, max: Infinity },
]
const DROP_TEXT: Record<StepKey, string> = {
  in: 'never contacted', contacted: 'never got through', spoke: 'not qualified yet', qualified: 'no EOI yet', eoi: 'not closed yet', won: '',
}
const STALL_TITLE: Record<StepKey, string> = {
  in: 'Never contacted', contacted: 'Contacted, never got through', spoke: 'Spoke, requirements not confirmed',
  qualified: 'Warm, no EOI yet', eoi: 'Hot, not closed yet', won: '',
}
const FLOW_PARTS = [
  { key: 'hour',    label: 'Reached within an hour', color: BLUE },
  { key: 'day',     label: 'Same day',               color: '#528BFF' },
  { key: 'later',   label: 'Later',                  color: '#B2CCFF' },
  { key: 'waiting', label: 'Not contacted yet',      color: '#FEC84B' },
] as const

// ─── Working out the numbers ──────────────────────────────────────────────────
type StepRow = { key: StepKey; label: string; help: string; count: number; prevCount: number; ofIn: number; prevOfIn: number; ofPrev: number }
type SourceRow = {
  label: string; raw: string | null; leads: number; contacted: number; spoke: number; qualified: number; won: number
  response: number | null; avgScore: number; budget: number
}
type Analysis = ReturnType<typeof analyse>

function analyse(leads: InsightLead[], acts: InsightActivity[], period: RollId, now: number) {
  const w = rollWindow(period, now)
  const inWin = (t: number) => t >= w.start && t < w.end
  const cohort = leads.filter(l => inWin(created(l)))
  const prevCohort = leads.filter(l => { const t = created(l); return t >= w.prevStart && t < w.prevEnd })
  const journeys = buildJourneys([...cohort, ...prevCohort], acts)
  const j = (l: InsightLead) => journeys.get(l.id)
  const winActs = acts.filter(a => inWin(ms(a.createdAt)))

  // Journey
  const countAt = (xs: InsightLead[], k: StepKey) => xs.filter(l => reached(j(l), k)).length
  const steps: StepRow[] = STEPS.map((s, i) => {
    const count = countAt(cohort, s.key), prevCount = countAt(prevCohort, s.key)
    const before = i ? countAt(cohort, STEPS[i - 1].key) : count
    return { key: s.key, label: s.label, help: s.help, count, prevCount, ofIn: share(count, cohort.length), prevOfIn: share(prevCount, prevCohort.length), ofPrev: share(count, before) }
  })
  const stalled = {} as Record<StepKey, InsightLead[]>
  STEPS.forEach((s, i) => {
    const next = STEPS[i + 1]
    stalled[s.key] = next ? cohort.filter(l => reached(j(l), s.key) && !reached(j(l), next.key)) : []
  })
  let dropKey: StepKey | null = null, dropN = 0
  STEPS.slice(0, -1).forEach((s, i) => {
    const n = steps[i].count - steps[i + 1].count
    if (n > dropN) { dropN = n; dropKey = s.key }
  })
  const closeDays = cohort.filter(l => stageOfLead(l) === 'Closed').map(l => (closedAt(l) - created(l)) / DAY)
  const nowStages = ORDER.map(st => ({ st, n: cohort.filter(l => stageOfLead(l) === st).length }))

  // Speed to lead
  const resp = (xs: InsightLead[]) => xs.map(l => responseMs(l, j(l))).filter((x): x is number => x != null)
  const respNow = resp(cohort), respPrev = resp(prevCohort)
  const speedRows = SPEED.map((b, i) => {
    const lo = i ? SPEED[i - 1].max : -1
    const xs = cohort.filter(l => { const r = responseMs(l, j(l)); return r != null && r > lo && r <= b.max })
    return { label: b.label, n: xs.length, qualified: xs.filter(l => reached(j(l), 'qualified')).length }
  })
  const unknownTime = cohort.filter(l => j(l)?.contacted && responseMs(l, j(l)) == null)
  const waiting = cohort.filter(l => !j(l)?.contacted && isOpenLead(l) && stageOfLead(l) !== 'Hold')
  const fast = cohort.filter(l => { const r = responseMs(l, j(l)); return r != null && r <= HOUR })
  const slow = cohort.filter(l => { const r = responseMs(l, j(l)); return r != null && r > HOUR })

  // Inflow by how fast leads were reached
  const flow = w.buckets.map(b => ({ b, hour: 0, day: 0, later: 0, waiting: 0, prev: 0 }))
  for (const l of cohort) {
    const i = bucketIndex(w.buckets, created(l))
    if (i < 0) continue
    const r = responseMs(l, j(l))
    if (!j(l)?.contacted) flow[i].waiting++
    else if (r != null && r <= HOUR) flow[i].hour++
    else if (r != null && r <= DAY) flow[i].day++
    else flow[i].later++
  }
  const shift = w.start - w.prevStart
  for (const l of prevCohort) {
    const i = bucketIndex(w.buckets, created(l) + shift)
    if (i >= 0) flow[i].prev++
  }

  // Sources
  const bySource = new Map<string, InsightLead[]>()
  for (const l of cohort) {
    const k = sourceMeta(l.sourcePortal).label
    const xs = bySource.get(k); if (xs) xs.push(l); else bySource.set(k, [l])
  }
  const sources: SourceRow[] = [...bySource.entries()].map(([label, xs]) => ({
    label, raw: xs[0].sourcePortal, leads: xs.length,
    contacted: xs.filter(l => reached(j(l), 'contacted')).length,
    spoke: xs.filter(l => reached(j(l), 'spoke')).length,
    qualified: xs.filter(l => reached(j(l), 'qualified')).length,
    won: xs.filter(l => reached(j(l), 'won')).length,
    response: median(resp(xs)),
    avgScore: Math.round(sum(xs, scoreOf) / xs.length),
    budget: sum(xs, valueOf),
  }))

  // Timing
  const attempts = emptyGrid(), connected = emptyGrid(), arrivals = emptyGrid()
  for (const a of winActs) {
    if (!isCallAttempt(a)) continue
    const c = cellOf(ms(a.createdAt))
    attempts[c.day][c.slot]++
    if (isConnected(a)) connected[c.day][c.slot]++
  }
  for (const l of cohort) { const c = cellOf(created(l)); arrivals[c.day][c.slot]++ }

  // Channels
  const leadById = new Map(leads.map(l => [l.id, l]))
  const firstBy = (k: ActKind) => {
    const m = new Map<string, number>()
    for (const a of winActs) if (kindOf(a.type) === k) { const t = ms(a.createdAt); const x = m.get(a.leadId); if (x == null || t < x) m.set(a.leadId, t) }
    return m
  }
  const actsByLead = new Map<string, InsightActivity[]>()
  for (const x of acts) { const xs = actsByLead.get(x.leadId); if (xs) xs.push(x); else actsByLead.set(x.leadId, [x]) }
  // Leads where one of `k` followed their first `first` activity (within `within`)
  const anyAfter = (k: ActKind[], first: Map<string, number>, within = Infinity) => {
    let n = 0
    for (const [id, t] of first) {
      if ((actsByLead.get(id) ?? []).some(x => k.includes(kindOf(x.type)) && ms(x.createdAt) > t && ms(x.createdAt) - t <= within)) n++
    }
    return n
  }
  const hotNow = (first: Map<string, number>) => [...first.keys()].filter(id => { const l = leadById.get(id); return !!l && ['Hot', 'Closed'].includes(stageOfLead(l)) }).length
  const callActs = winActs.filter(isCallAttempt)
  const talk = callActs.filter(a => isConnected(a) && (a.duration ?? 0) > 0).map(a => a.duration ?? 0)
  const wa = firstBy('whatsapp'), em = firstBy('email'), vb = firstBy('visitBooked'), vd = firstBy('visit'), mt = firstBy('meeting')
  const count = (k: ActKind) => winActs.filter(a => kindOf(a.type) === k).length
  const channels = [
    { kind: 'call' as ActKind, n: callActs.length, leads: new Set(callActs.map(a => a.leadId)).size, rate: share(callActs.filter(isConnected).length, callActs.length),
      rateLabel: 'got through', extra: talk.length ? `median talk ${dur(median(talk)! * 1000)}` : null },
    { kind: 'whatsapp' as ActKind, n: count('whatsapp'), leads: wa.size, rate: share(anyAfter(['reply'], wa, 3 * DAY), wa.size), rateLabel: 'replied within 3 days', extra: null },
    { kind: 'email' as ActKind, n: count('email'), leads: em.size, rate: share(anyAfter(['reply'], em, 7 * DAY), em.size), rateLabel: 'replied within 7 days', extra: null },
    { kind: 'visitBooked' as ActKind, n: count('visitBooked'), leads: vb.size, rate: share(anyAfter(['visit'], vb), vb.size), rateLabel: 'visit happened', extra: null },
    { kind: 'visit' as ActKind, n: count('visit'), leads: vd.size, rate: share(hotNow(vd), vd.size), rateLabel: 'now Hot or Closed', extra: null },
    { kind: 'meeting' as ActKind, n: count('meeting'), leads: mt.size, rate: share(hotNow(mt), mt.size), rateLabel: 'now Hot or Closed', extra: null },
  ]

  // Intent score
  const buckets10 = Array.from({ length: 10 }, (_, i) => ({ min: i * 10, n: cohort.filter(l => { const s = scoreOf(l); return s >= i * 10 && (i === 9 ? s <= 100 : s < i * 10 + 10) }).length }))
  const bands = SCORE_BANDS.map(b => {
    const xs = cohort.filter(l => scoreOf(l) >= b.min && scoreOf(l) < b.max)
    return { ...b, n: xs.length, qualified: xs.filter(l => reached(j(l), 'qualified')).length, won: xs.filter(l => reached(j(l), 'won')).length, budget: sum(xs, valueOf) }
  })
  const hotOpen = leads.filter(l => isOpenLead(l) && stageOfLead(l) !== 'Hold' && (stageOfLead(l) === 'Hot' || scoreOf(l) >= HOT_SCORE))

  // To act on: open leads with the highest intent, any age
  const actOn = leads.filter(l => isOpenLead(l) && stageOfLead(l) !== 'Hold')
    .sort((a, b) => scoreOf(b) - scoreOf(a) || valueOf(b) - valueOf(a)).slice(0, 8)

  return {
    w, cohort, prevCohort, journeys, steps, stalled, dropKey: dropKey as StepKey | null, dropN, closeDays, nowStages,
    respNow, respPrev, speedRows, unknownTime, waiting, fast, slow, flow, sources, attempts, connected, arrivals,
    channels, buckets10, bands, hotOpen, actOn, winActs,
  }
}

function findings(a: Analysis, now: number) {
  const out: { key: string; tone: 'blue' | 'amber' | 'green' | 'red'; icon: ReactNode; title: string; body: string; jump?: StepKey; href?: string; cta?: string }[] = []
  const j = (l: InsightLead) => a.journeys.get(l.id)
  if (a.waiting.length) {
    const oldest = Math.max(...a.waiting.map(l => now - created(l)))
    out.push({ key: 'wait', tone: 'amber', icon: <Hourglass size={15} weight="bold" />, title: `${plural(a.waiting.length, 'lead')} still waiting for a first contact`,
      body: `The longest has waited ${dur(oldest)}. Every hour a new enquiry waits, it cools.`, href: '/dashboard/calls', cta: 'Start calling' })
  }
  if (a.dropKey && a.dropN > 0 && a.cohort.length >= MIN_GROUP) {
    const i = STEPS.findIndex(s => s.key === a.dropKey)
    const from = a.steps[i], to = a.steps[i + 1]
    out.push({ key: 'drop', tone: 'red', icon: <Funnel size={15} weight="bold" />, title: `Biggest drop: ${from.label.toLowerCase()} to ${to.label.toLowerCase()}`,
      body: `${nf(a.dropN)} of ${nf(from.count)} leads (${share(a.dropN, from.count)}%) stopped here.`, jump: a.dropKey, cta: 'See who' })
  }
  if (a.fast.length >= MIN_GROUP && a.slow.length >= MIN_GROUP) {
    const f = share(a.fast.filter(l => reached(j(l), 'qualified')).length, a.fast.length)
    const s = share(a.slow.filter(l => reached(j(l), 'qualified')).length, a.slow.length)
    if (f !== s) out.push({ key: 'speed', tone: f > s ? 'green' : 'blue', icon: <Timer size={15} weight="bold" />,
      title: f > s ? 'Fast replies pay off' : 'Speed isn\'t the bottleneck here',
      body: `${f}% of leads reached within an hour got to Warm, against ${s}% of those reached later (${nf(a.fast.length)} and ${nf(a.slow.length)} leads).` })
  }
  const big = a.sources.filter(s => s.leads >= MIN_GROUP)
  if (big.length >= 2) {
    const best = [...big].sort((x, y) => share(y.qualified, y.leads) - share(x.qualified, x.leads))[0]
    const all = share(a.steps[3].count, a.cohort.length)
    const r = share(best.qualified, best.leads)
    if (r > all) out.push({ key: 'src', tone: 'blue', icon: <Plugs size={15} weight="bold" />, title: `${best.label} leads qualify most often`,
      body: `${r}% reached Warm or better, against ${all}% across all sources (${plural(best.leads, 'lead')}).` })
  }
  const total = sum(a.attempts.flat(), x => x)
  if (total >= 40) {
    let bd = -1, bs = -1, br = -1
    a.attempts.forEach((row, d) => row.forEach((n, s) => { if (n >= 15) { const r = share(a.connected[d][s], n); if (r > br) { br = r; bd = d; bs = s } } }))
    if (bd >= 0) out.push({ key: 'time', tone: 'green', icon: <Clock size={15} weight="bold" />, title: `Calls get through best on ${WEEKDAYS[bd]} ${SLOTS[bs]}`,
      body: `${br}% of calls in that slot connected, against ${share(sum(a.connected.flat(), x => x), total)}% overall.` })
  }
  return out.slice(0, 3)
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [period, setPeriod] = useState<RollId>('30d')
  const [focus, setFocus] = useState<StepKey | null>(null)
  const { data, error, pending, refreshing, refresh } = useInsights(ROLL[period].days * 2 + 2)
  const now = data?.at ?? 0
  const a = useMemo(() => (data && !pending ? analyse(data.leads, data.acts, period, now) : null), [data, pending, period, now])
  const found = useMemo(() => (a ? findings(a, now) : []), [a, now])
  const P = ROLL[period]

  const jump = (k: StepKey) => {
    setFocus(k)
    document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen" style={{ background: CANVAS }}>
      <PageTabBar tabs={INSIGHTS_TABS} />
      <PageHeader title="Analytics" backHref="/dashboard"
        badge={data ? <Badge tone="blue">{plural(data.leads.length, 'lead')}</Badge> : undefined}
        sub="How your leads turn into deals, where they slip, and what to fix first."
        actions={<>
          <Seg label="Period" value={period} onChange={p => { setPeriod(p); setFocus(null) }}
            options={(Object.keys(ROLL) as RollId[]).map(id => ({ id, label: ROLL[id].label }))} />
          <RefreshBtn refreshing={refreshing} onRefresh={refresh} />
        </>}
      />

      <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
        {error && !data ? <LoadError text={error} onRetry={refresh} /> : !a || !data ? <PageSkeleton /> : data.leads.length === 0 ? (
          <EmptyState icon={<ChartBar size={22} />} title="No leads to analyse yet"
            actions={<Link href="/dashboard/leads" className="inline-flex h-10 items-center rounded-[10px] px-3.5 text-[14px] font-semibold text-white no-underline" style={{ background: BLUE }}>Go to Leads</Link>}>
            Once leads come in from your portals or you add them, this page shows how they move from enquiry to deal.
          </EmptyState>
        ) : (
          <>
            {data.demo && (
              <div className="mb-4 flex items-start gap-2.5 rounded-[4px] border px-3.5 py-2.5 text-[13.5px]" style={{ borderColor: '#D0D5DD', background: '#F9FAFB', color: '#344054' }}>
                <Sparkle size={16} className="mt-0.5 shrink-0" style={{ color: '#667085' }} />
                <span>Activity data hasn&apos;t been logged yet, so these charts are showing <strong>sample data</strong> to illustrate the layout. Numbers will update automatically once you start logging calls and activities on your leads.</span>
              </div>
            )}
            {(data.activitiesFailed || data.capped.leads || data.capped.activities) && (
              <div className="mb-4 flex items-start gap-2.5 rounded-[4px] border px-3.5 py-2.5 text-[13.5px]" style={{ borderColor: '#FEDF89', background: '#FFFAEB', color: '#B54708' }}>
                <WarningCircle size={18} weight="bold" className="mt-px shrink-0" />
                <span>{data.activitiesFailed ? 'Activity couldn\'t load, so contact and speed numbers only use lead stages. ' : ''}
                  {data.capped.leads ? 'Only your latest 20,000 leads are counted. ' : ''}{data.capped.activities ? 'Only the latest 40,000 activities are counted.' : ''}</span>
              </div>
            )}

            {found.length > 0 && (
              <div className={`mb-6 grid gap-3 ${found.length >= 3 ? 'lg:grid-cols-3' : found.length === 2 ? 'lg:grid-cols-2' : ''}`}>
                {found.map(f => (
                  <Insight key={f.key} tone={f.tone} icon={f.icon} title={f.title}>
                    <span>{f.body}</span>
                    {f.cta && (
                      <div className="mt-2">
                        {f.href
                          ? <Link href={f.href} className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline" style={{ color: BLUE }}>{f.cta}<ArrowRight size={13} weight="bold" /></Link>
                          : <button type="button" onClick={() => f.jump && jump(f.jump)} className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold" style={{ color: BLUE }}>{f.cta}<ArrowRight size={13} weight="bold" /></button>}
                      </div>
                    )}
                  </Insight>
                ))}
              </div>
            )}

            <Kpis a={a} period={period} />

            <div className="mt-6"><Journey a={a} period={period} now={now} focus={focus} onFocus={setFocus} /></div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <Speed a={a} />
              <Flow a={a} period={period} />
            </div>

            <div className="mt-6"><Sources a={a} long={P.long} /></div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <Timing a={a} long={P.long} />
              <Channels a={a} long={P.long} />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Scores a={a} long={P.long} />
              <Demand cohort={a.cohort} journeys={a.journeys} long={P.long} />
            </div>

            <div className="mt-6"><ActOn a={a} now={now} /></div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── KPI cards ────────────────────────────────────────────────────────────────
function Kpis({ a, period }: { a: Analysis; period: RollId }) {
  const P = ROLL[period]
  const prevUnit = `previous ${P.long.replace('last ', '')}`
  const n = a.cohort.length
  const contacted = a.steps[1].count, prevContacted = a.steps[1].prevCount
  const cRate = share(contacted, n), cPrev = share(prevContacted, a.prevCohort.length)
  const med = median(a.respNow), medPrev = median(a.respPrev)
  const within = share(a.respNow.filter(x => x <= HOUR).length, a.respNow.length)
  const q = a.steps[3].count, won = a.steps[5].count
  const avg = n ? Math.round(sum(a.cohort, scoreOf) / n) : 0
  const counts = a.flow.map(f => f.hour + f.day + f.later + f.waiting)
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard icon={<Sparkle size={16} weight="bold" />} accent={BLUE} label="Leads in" value={nf(n)}
        pill={<Delta cur={n} prev={a.prevCohort.length} unit={prevUnit} />}
        sub={n ? `Average intent ${avg}` : `None in the ${P.long}`}>
        <MiniBars values={counts} label={`Leads per ${P.unit}`} />
      </StatCard>
      <StatCard icon={<Phone size={16} weight="bold" />} accent={GREEN_D} label="Contacted" value={`${cRate}%`}
        pill={a.prevCohort.length ? <Delta cur={cRate} prev={cPrev} unit={prevUnit} points /> : undefined}
        sub={a.waiting.length ? <span style={{ color: '#B54708' }}>{nf(a.waiting.length)} still waiting</span> : n ? 'Every lead reached' : '—'}>
        <div className="flex h-9 items-center"><div className="w-full"><Meter value={contacted} max={n} color={GREEN} height={10} /></div></div>
      </StatCard>
      <StatCard icon={<Timer size={16} weight="bold" />} accent="#7A5AF8" label="Speed to lead" value={med != null ? dur(med) : '—'}
        pill={med != null && medPrev != null && medPrev > 0 ? <Delta cur={Math.round(med / 60_000)} prev={Math.round(medPrev / 60_000)} unit={prevUnit} invert /> : undefined}
        sub={a.respNow.length ? `${within}% reached within an hour` : 'No first contacts logged'}>
        <div className="flex h-9 items-end gap-[3px]" role="img" aria-label="First contact times">
          {a.speedRows.map((r, i) => {
            const max = Math.max(1, ...a.speedRows.map(x => x.n))
            return <span key={r.label} title={`${r.label}: ${r.n}`} className="min-w-0 flex-1 rounded-[2px]"
              style={{ height: r.n ? `${Math.max(12, (r.n / max) * 100)}%` : 2, background: r.n ? (i < 3 ? '#7A5AF8' : '#D9D6FE') : '#EAECF0' }} />
          })}
        </div>
      </StatCard>
      <StatCard icon={<Target size={16} weight="bold" />} accent="#EF6820" label="Reached Warm+" value={`${share(q, n)}%`}
        pill={won ? <Pill tone="green" small><Trophy size={11} weight="bold" />{nf(won)} won</Pill> : undefined}
        sub={n ? `${nf(q)} of ${nf(n)} leads qualified` : '—'}>
        <div className="flex h-9 items-center">
          <div className="w-full">
            <StackBar legend={false} parts={[
              { label: 'Warm', value: a.nowStages.find(x => x.st === 'Warm')!.n, color: STAGE.Warm.dot },
              { label: 'Hot', value: a.nowStages.find(x => x.st === 'Hot')!.n, color: STAGE.Hot.dot },
              { label: 'Closed', value: a.nowStages.find(x => x.st === 'Closed')!.n, color: STAGE.Closed.dot },
              { label: 'Not yet', value: n - q, color: '#EAECF0' },
            ]} />
          </div>
        </div>
      </StatCard>
    </div>
  )
}

// ─── Lead journey ─────────────────────────────────────────────────────────────
const STEP_COLOR = ['#1A2E9E', '#1D4ED8', '#2E6BF0', '#528BFF', '#84ADFF', '#17B26A']

function Journey({ a, period, now, focus, onFocus }: { a: Analysis; period: RollId; now: number; focus: StepKey | null; onFocus: (k: StepKey) => void }) {
  const P = ROLL[period]
  const top = Math.max(1, a.steps[0].count)
  const sel = focus ?? a.dropKey ?? 'in'
  const selIdx = STEPS.findIndex(s => s.key === sel)
  const list = (a.stalled[sel] ?? []).filter(l => isOpenLead(l) && stageOfLead(l) !== 'Hold')
    .sort((x, y) => scoreOf(y) - scoreOf(x) || created(x) - created(y))
  const medClose = median(a.closeDays)
  return (
    <Panel id="journey" icon={<Funnel size={18} weight="bold" />} title="Lead journey"
      sub={`Leads that came in during the ${P.long} and how far each one got. Tap a drop to see who stopped there.`}
      right={<Legend items={[{ label: 'This period', color: BLUE }, { label: 'Period before', color: '#101828', ring: true }]} />}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {a.steps.map((s, i) => {
            const next = a.steps[i + 1]
            const drop = next ? s.count - next.count : 0
            const on = next && s.key === sel
            return (
              <div key={s.key}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[180px_minmax(0,1fr)_96px]">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold" style={{ color: TEXT }} title={s.help}>{s.label}</div>
                    <div className="truncate text-[12.5px] sm:hidden" style={{ color: SUBTLE }}>{s.help}</div>
                  </div>
                  <div className="text-right sm:order-3">
                    <div className="text-[18px] font-semibold leading-none tabular-nums" style={{ color: TEXT }}>{nf(s.count)}</div>
                    <div className="mt-1 text-[12px] tabular-nums" style={{ color: SUBTLE }}>{i ? `${s.ofIn}% of all` : P.label}</div>
                  </div>
                  <div className="relative col-span-2 h-9 sm:order-2 sm:col-span-1" title={`${s.help}. ${s.prevCount} in the period before (${s.prevOfIn}%).`}>
                    <div className="absolute inset-y-0 left-0 rounded-[8px]" style={{ width: '100%', background: '#F5F8FF' }} />
                    <div className="absolute inset-y-0 left-0 rounded-[8px] transition-[width] duration-700"
                      style={{ width: `${Math.max(s.count ? 3 : 0, (s.count / top) * 100)}%`, background: STEP_COLOR[i] }} />
                    {i > 0 && s.ofPrev > 0 && (
                      // Inside the bar when it is wide enough, otherwise just past its end
                      <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[12px] font-semibold"
                        style={s.count / top > 0.45 ? { left: 10, color: 'rgba(255,255,255,0.92)' } : { left: `calc(${Math.max(3, (s.count / top) * 100)}% + 8px)`, color: SUBTLE }}>
                        {s.ofPrev}% of step before
                      </span>
                    )}
                    {a.prevCohort.length > 0 && (
                      <span aria-hidden className="absolute top-0 z-10 size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
                        style={{ left: `${Math.min(100, s.prevOfIn)}%`, borderColor: '#101828' }} />
                    )}
                  </div>
                </div>
                {next && (
                  <div className="flex py-1.5 sm:pl-[196px]">
                    <button type="button" onClick={() => onFocus(s.key)} disabled={drop <= 0} aria-pressed={!!on}
                      className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-semibold tabular-nums transition-colors disabled:cursor-default"
                      style={on ? { background: '#FEF3F2', borderColor: '#FDA29B', color: '#B42318' }
                        : drop > 0 ? { background: CANVAS, borderColor: BORDER, color: SUBTLE } : { background: CANVAS, borderColor: 'transparent', color: LABEL }}>
                      <ArrowRight size={12} weight="bold" className="rotate-90" />
                      {drop > 0 ? `${nf(drop)} ${DROP_TEXT[s.key]} · ${100 - next.ofPrev}%` : 'No drop'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Figure label="Contact to Warm+" value={`${share(a.steps[3].count, a.steps[1].count)}%`} sub="of leads contacted" />
            <Figure label="Warm+ to won" value={`${share(a.steps[5].count, a.steps[3].count)}%`} sub="of qualified leads" />
            <Figure label="Time to close" value={medClose != null ? `${Math.round(medClose)} days` : '—'} sub={a.closeDays.length ? `median of ${plural(a.closeDays.length, 'deal')}` : 'No deals closed yet'} />
          </div>
          <div className="mt-5">
            <div className="mb-2 text-[13px] font-semibold" style={{ color: TEXT_2 }}>Where these leads are now</div>
            <StackBar parts={a.nowStages.filter(x => x.n > 0).map(x => ({ label: STAGE[x.st].label, value: x.n, color: STAGE[x.st].dot }))} />
          </div>
        </div>

        <div className="min-w-0 rounded-[14px] border p-4" style={{ borderColor: BORDER, background: SURFACE }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: LABEL }}>Stopped after step {selIdx + 1}</div>
              <div className="mt-1 text-[15px] font-semibold" style={{ color: TEXT }}>{STALL_TITLE[sel]}</div>
            </div>
            <Pill tone="red">{nf(a.stalled[sel]?.length ?? 0)}</Pill>
          </div>
          <p className="m-0 mt-1.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>
            {list.length ? 'Still open, highest intent first. These are the ones worth another try.' : (a.stalled[sel]?.length ? 'None of them are open any more.' : 'Nobody stopped here.')}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {list.slice(0, 6).map(l => (
              <div key={l.id} className="flex items-center gap-3 rounded-[12px] border bg-white px-3 py-2.5" style={{ borderColor: BORDER, boxShadow: XS }}>
                <Link href={`/dashboard/leads/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                  <LeadAvatar lead={l} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold" style={{ color: TEXT }}>{displayName(l)}</span>
                    <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>
                      {STAGE[stageOfLead(l)].label} · came in {dur(now - created(l))} ago{valueOf(l) ? ` · ${inr(valueOf(l))}` : ''}
                    </span>
                  </span>
                </Link>
                <CallLink phone={l.phones?.primaryPhoneNumber} name={l.name?.firstName || displayName(l)} />
                <WaLink phone={l.phones?.primaryPhoneNumber} name={l.name?.firstName || displayName(l)} />
              </div>
            ))}
          </div>
          {list.length > 6 && (
            <Link href="/dashboard/leads" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold no-underline" style={{ color: BLUE }}>
              {nf(list.length - 6)} more in Leads <ArrowRight size={13} weight="bold" />
            </Link>
          )}
        </div>
      </div>
    </Panel>
  )
}

// ─── Speed to lead ────────────────────────────────────────────────────────────
function Speed({ a }: { a: Analysis }) {
  const max = Math.max(1, ...a.speedRows.map(r => r.n), a.waiting.length)
  const rows = [...a.speedRows.map((r, i) => ({ ...r, color: i < 3 ? '#7A5AF8' : i < 5 ? '#9B8AFB' : '#D9D6FE' })),
    ...(a.unknownTime.length ? [{ label: 'Time not logged', n: a.unknownTime.length, qualified: a.unknownTime.filter(l => reached(a.journeys.get(l.id), 'qualified')).length, color: '#E4E7EC' }] : []),
    { label: 'Not contacted yet', n: a.waiting.length, qualified: 0, color: '#FEC84B' }]
  return (
    <Panel icon={<Timer size={18} weight="bold" />} title="Speed to lead" sub="Time from a lead arriving to the first call, message or email, and how many of each went on to Warm">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[280px] border-collapse">
          <thead>
            <tr className="text-[12px] font-semibold" style={{ color: SUBTLE }}>
              <th className="pb-2 text-left font-semibold">First contact</th>
              <th className="pb-2 text-left font-semibold">Leads</th>
              <th className="pb-2 text-right font-semibold"><span className="sm:hidden">Warm+</span><span className="hidden sm:inline">Reached Warm+</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-t" style={{ borderColor: '#F2F4F7' }}>
                <td className="whitespace-nowrap py-2 pr-3 text-[13.5px]" style={{ color: TEXT_2 }}>{r.label}</td>
                <td className="w-full py-2 pr-3">
                  <div className="flex items-center gap-2.5">
                    <Meter value={r.n} max={max} color={r.color} height={8} className="flex-1" />
                    <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: TEXT }}>{nf(r.n)}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap py-2 text-right text-[13px] tabular-nums" style={{ color: r.n >= MIN_GROUP ? TEXT_2 : LABEL }}
                  title={r.n < MIN_GROUP && r.n > 0 ? 'Too few leads to read much into' : undefined}>
                  {r.label === 'Not contacted yet' ? '—' : r.n ? `${share(r.qualified, r.n)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Basis>Median {dur(median(a.respNow))} across {plural(a.respNow.length, 'lead')} with a logged first contact. Rates in grey come from fewer than {MIN_GROUP} leads.</Basis>
    </Panel>
  )
}

// ─── Inflow chart ─────────────────────────────────────────────────────────────
function Flow({ a, period }: { a: Analysis; period: RollId }) {
  const P = ROLL[period]
  const every: [number, number] = period === '30d' ? [5, 5] : period === '90d' ? [2, 3] : period === '12m' ? [1, 2] : [1, 1]
  const points = a.flow.map(f => ({
    tick: f.b.tick, label: f.b.label, ghost: f.prev,
    parts: FLOW_PARTS.map(p => ({ key: p.key, label: p.label, color: p.color, value: f[p.key] })),
  }))
  return (
    <Panel icon={<ChartBar size={18} weight="bold" />} title="Leads in, and how fast you reached them"
      sub={`New leads per ${P.unit}, split by how soon the first contact happened`} className="h-full"
      right={<Legend items={[...FLOW_PARTS.map(p => ({ label: p.label, color: p.color })), { label: 'Period before', color: '#98A2B3', dashed: true }]} />}>
      <BarChart points={points} every={every} height={240} ghostLabel="Period before" unit={n => plural(n, 'lead')} empty={`No leads in the ${P.long}`} />
    </Panel>
  )
}

// ─── Sources ──────────────────────────────────────────────────────────────────
type SrcKey = 'leads' | 'contacted' | 'spoke' | 'qualified' | 'won' | 'response' | 'avgScore' | 'budget'
function Sources({ a, long }: { a: Analysis; long: string }) {
  const { sort, onSort } = useSort<SrcKey>('leads')
  const val = (r: SourceRow, k: SrcKey) => k === 'contacted' || k === 'spoke' || k === 'qualified' ? share(r[k], r.leads) : k === 'response' ? (r.response ?? Infinity) : r[k]
  const rows = [...a.sources].sort((x, y) => (val(x, sort.key) - val(y, sort.key)) * sort.dir || y.leads - x.leads)
  const tot = {
    leads: a.cohort.length, contacted: a.steps[1].count, spoke: a.steps[2].count, qualified: a.steps[3].count, won: a.steps[5].count,
    response: median(a.respNow), budget: sum(a.cohort, valueOf), avgScore: a.cohort.length ? Math.round(sum(a.cohort, scoreOf) / a.cohort.length) : 0,
  }
  const rate = (n: number, d: number, color: string, small: boolean) => (
    <div className="ml-auto flex w-[104px] items-center gap-2">
      <Meter value={n} max={d} color={color} className="flex-1" />
      <span className="w-9 text-right text-[13px] font-semibold tabular-nums" style={{ color: small ? LABEL : TEXT }}>{share(n, d)}%</span>
    </div>
  )
  return (
    <Panel icon={<Plugs size={18} weight="bold" />} title="Source quality"
      sub={`For each portal and channel: how many of its leads you reached, spoke to, qualified and closed (${long})`}>
      {rows.length === 0 ? <p className="m-0 py-6 text-center text-[14px]" style={{ color: LABEL }}>No leads in this period.</p> : (
        <>
          <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 md:block">
            <table className="w-full min-w-[920px] border-collapse">
              <thead>
                <tr className="border-y" style={{ borderColor: BORDER, background: SURFACE }}>
                  <th className="px-5 py-2.5 text-left text-[12px] font-semibold" style={{ color: SUBTLE }}>Source</th>
                  <SortTh id="leads" sort={sort} onSort={onSort}>Leads</SortTh>
                  <SortTh id="contacted" sort={sort} onSort={onSort}>Contacted</SortTh>
                  <SortTh id="spoke" sort={sort} onSort={onSort}>Spoke</SortTh>
                  <SortTh id="qualified" sort={sort} onSort={onSort}>Warm+</SortTh>
                  <SortTh id="won" sort={sort} onSort={onSort}>Won</SortTh>
                  <SortTh id="response" sort={sort} onSort={onSort}>First contact</SortTh>
                  <SortTh id="avgScore" sort={sort} onSort={onSort}>Avg intent</SortTh>
                  <SortTh id="budget" sort={sort} onSort={onSort} className="pr-5">Budgets</SortTh>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const small = r.leads < MIN_GROUP
                  return (
                    <tr key={r.label} className="border-b transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: '#F2F4F7' }}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5"><SourceMark raw={r.raw} size={24} />
                          <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{r.label}</span></span>
                      </td>
                      <td className="px-3 py-3 text-right text-[14px] font-semibold tabular-nums" style={{ color: TEXT }}>{nf(r.leads)}</td>
                      <td className="px-3 py-3">{rate(r.contacted, r.leads, GREEN, small)}</td>
                      <td className="px-3 py-3">{rate(r.spoke, r.leads, '#0BA5EC', small)}</td>
                      <td className="px-3 py-3">{rate(r.qualified, r.leads, '#F79009', small)}</td>
                      <td className="px-3 py-3 text-right text-[14px] tabular-nums" style={{ color: r.won ? GREEN_D : LABEL, fontWeight: r.won ? 600 : 400 }}>{r.won || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-[13.5px] tabular-nums" style={{ color: TEXT_2 }}>{r.response != null ? dur(r.response) : '—'}</td>
                      <td className="px-3 py-3 text-right text-[13.5px] tabular-nums" style={{ color: TEXT_2 }}>{r.avgScore}</td>
                      <td className="whitespace-nowrap px-3 py-3 pr-5 text-right text-[13.5px] tabular-nums" style={{ color: TEXT_2 }}>{r.budget ? inr(r.budget) : '—'}</td>
                    </tr>
                  )
                })}
                <tr style={{ background: SURFACE }}>
                  <td className="px-5 py-3 text-[13.5px] font-semibold" style={{ color: TEXT }}>All sources</td>
                  <td className="px-3 py-3 text-right text-[14px] font-semibold tabular-nums" style={{ color: TEXT }}>{nf(tot.leads)}</td>
                  <td className="px-3 py-3">{rate(tot.contacted, tot.leads, GREEN, false)}</td>
                  <td className="px-3 py-3">{rate(tot.spoke, tot.leads, '#0BA5EC', false)}</td>
                  <td className="px-3 py-3">{rate(tot.qualified, tot.leads, '#F79009', false)}</td>
                  <td className="px-3 py-3 text-right text-[14px] font-semibold tabular-nums" style={{ color: TEXT }}>{tot.won || '—'}</td>
                  <td className="px-3 py-3 text-right text-[13.5px] font-semibold tabular-nums" style={{ color: TEXT }}>{tot.response != null ? dur(tot.response) : '—'}</td>
                  <td className="px-3 py-3 text-right text-[13.5px] font-semibold tabular-nums" style={{ color: TEXT }}>{tot.avgScore}</td>
                  <td className="whitespace-nowrap px-3 py-3 pr-5 text-right text-[13.5px] font-semibold tabular-nums" style={{ color: TEXT }}>{tot.budget ? inr(tot.budget) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 md:hidden">
            <Seg label="Sort sources" value={sort.key} onChange={k => onSort(k)} full options={[
              { id: 'leads', label: 'Leads' }, { id: 'qualified', label: 'Warm+' }, { id: 'response', label: 'Speed' }, { id: 'budget', label: '₹' },
            ]} />
            {rows.map(r => (
              <div key={r.label} className="rounded-[14px] border p-3.5" style={{ borderColor: BORDER, boxShadow: XS }}>
                <div className="flex items-center gap-2.5">
                  <SourceMark raw={r.raw} size={26} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={{ color: TEXT }}>{r.label}</span>
                  <span className="text-[15px] font-semibold tabular-nums" style={{ color: TEXT }}>{nf(r.leads)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[['Contacted', r.contacted], ['Spoke', r.spoke], ['Warm+', r.qualified]].map(([k, v]) => (
                    <div key={k as string} className="rounded-[10px] py-2" style={{ background: SURFACE }}>
                      <div className="text-[16px] font-semibold tabular-nums" style={{ color: r.leads < MIN_GROUP ? SUBTLE : TEXT }}>{share(v as number, r.leads)}%</div>
                      <div className="text-[11.5px]" style={{ color: SUBTLE }}>{k}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]" style={{ color: SUBTLE }}>
                  <span>First contact <b className="font-semibold" style={{ color: TEXT_2 }}>{r.response != null ? dur(r.response) : '—'}</b></span>
                  <span>Won <b className="font-semibold" style={{ color: TEXT_2 }}>{r.won}</b></span>
                  <span>Intent <b className="font-semibold" style={{ color: TEXT_2 }}>{r.avgScore}</b></span>
                  {r.budget > 0 && <span>{inr(r.budget)}</span>}
                </div>
              </div>
            ))}
          </div>
          <Basis>Sources are grouped by name, so MagicBricks and MAGICBRICKS count once. Rates in grey come from fewer than {MIN_GROUP} leads.</Basis>
        </>
      )}
    </Panel>
  )
}

// ─── Best time to call ────────────────────────────────────────────────────────
type TimingMode = 'connect' | 'calls' | 'arrivals'
function Timing({ a, long }: { a: Analysis; long: string }) {
  const [mode, setMode] = useState<TimingMode>('connect')
  const totalCalls = sum(a.attempts.flat(), x => x)
  const grid = mode === 'arrivals' ? a.arrivals : mode === 'calls' ? a.attempts
    : a.attempts.map((row, d) => row.map((n, s) => (n >= MIN_CELL_CALLS ? share(a.connected[d][s], n) : 0)))
  const best = useMemo(() => {
    let v = -1, d = -1, s = -1
    grid.forEach((row, di) => row.forEach((x, si) => { if (x > v) { v = x; d = di; s = si } }))
    return v > 0 ? { v, d, s } : null
  }, [grid])
  const sub = mode === 'connect' ? `Share of calls that got through, by day and time (${long})`
    : mode === 'calls' ? `Calls made by day and time (${long})` : `When new leads arrived (${long})`
  return (
    <Panel icon={<Clock size={18} weight="bold" />} title="Best time to reach leads" sub={sub}
      right={<Seg label="Show" value={mode} onChange={setMode} options={[
        { id: 'connect', label: 'Got through' }, { id: 'calls', label: 'Calls' }, { id: 'arrivals', label: 'Leads in' },
      ]} />}>
      <Heatmap grid={grid} color={mode === 'arrivals' ? '247,144,9' : mode === 'connect' ? '23,178,106' : '29,78,216'}
        text={mode === 'connect' ? (d, s, v) => (a.attempts[d][s] >= MIN_CELL_CALLS ? `${v}%` : '·') : undefined}
        cellTitle={(d, s, v) => mode === 'connect'
          ? (a.attempts[d][s] >= MIN_CELL_CALLS ? `${WEEKDAYS[d]} ${SLOTS[s]}: ${a.connected[d][s]} of ${a.attempts[d][s]} calls got through` : `${WEEKDAYS[d]} ${SLOTS[s]}: ${a.attempts[d][s]} calls, too few to show a rate`)
          : `${WEEKDAYS[d]} ${SLOTS[s]}: ${plural(v, mode === 'calls' ? 'call' : 'lead')}`} />
      <Basis>
        {best ? <>Best slot: <b className="font-semibold" style={{ color: TEXT_2 }}>{WEEKDAYS[best.d]} {SLOTS[best.s]}</b> ({mode === 'connect' ? `${best.v}% got through` : plural(best.v, mode === 'calls' ? 'call' : 'lead')}). </> : null}
        {mode === 'connect' ? `Based on ${plural(totalCalls, 'call')}. A slot needs ${MIN_CELL_CALLS} calls before it shows a rate.` : 'Times are in your local time.'}
      </Basis>
    </Panel>
  )
}

// ─── Channels ─────────────────────────────────────────────────────────────────
function Channels({ a, long }: { a: Analysis; long: string }) {
  const used = a.channels.filter(c => c.n > 0)
  return (
    <Panel icon={<Gauge size={18} weight="bold" />} title="How each channel performs" sub={`What came of the calls, messages, visits and meetings in the ${long}`} className="h-full">
      {used.length === 0 ? <p className="m-0 py-6 text-center text-[14px]" style={{ color: LABEL }}>No calls, messages or visits logged in this period.</p> : (
        <div className="flex flex-col gap-2.5">
          {used.map(c => {
            const K = KIND[c.kind]
            return (
              <div key={c.kind} className="flex items-center gap-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: BORDER }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px]" style={{ background: `${K.color}18`, color: K.color }}><K.Icon size={17} weight="fill" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{K.plural}</span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums" style={{ color: TEXT }}>{nf(c.n)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <Meter value={c.rate} max={100} color={K.color} className="flex-1" />
                    <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: SUBTLE }}><b className="font-semibold" style={{ color: TEXT_2 }}>{c.rate}%</b> {c.rateLabel}</span>
                  </div>
                  <div className="mt-1 text-[12px]" style={{ color: LABEL }}>{plural(c.leads, 'lead')}{c.extra ? ` · ${c.extra}` : ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <Basis>Each rate only counts that channel&apos;s own leads. A lead often gets several kinds of contact, so this shows what tends to go with progress, not what caused it.</Basis>
    </Panel>
  )
}

// ─── Intent score ─────────────────────────────────────────────────────────────
function Scores({ a, long }: { a: Analysis; long: string }) {
  const max = Math.max(1, ...a.buckets10.map(b => b.n))
  const hi = a.bands[0], lo = a.bands[2]
  const hiR = share(hi.qualified, hi.n), loR = share(lo.qualified, lo.n)
  return (
    <Panel icon={<Lightning size={18} weight="bold" />} title="Does the intent score hold up?" sub={`Score of the leads that came in during the ${long}, and how each band turned out`} className="h-full">
      <div className="grid grid-cols-2 gap-3">
        <Figure label="Hot leads open" value={nf(a.hotOpen.length)} sub="Hot stage or score 70+" />
        <Figure label="Their budgets" value={inr(sum(a.hotOpen, valueOf))} sub="Hot pipeline" />
      </div>
      <div className="mt-5 flex h-[120px] items-end gap-1.5" role="img" aria-label="Leads by intent score">
        {a.buckets10.map(b => {
          const band = SCORE_BANDS.find(x => b.min >= x.min && b.min < x.max)!
          return (
            <div key={b.min} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`Score ${b.min}–${b.min === 90 ? 100 : b.min + 9}: ${plural(b.n, 'lead')}`}>
              <span className="text-center text-[11px] font-semibold tabular-nums" style={{ color: b.n ? TEXT_2 : 'transparent' }}>{b.n}</span>
              <span className="mt-0.5 rounded-t-[4px]" style={{ height: b.n ? `${Math.max(4, (b.n / max) * 82)}%` : 2, background: b.n ? band.color : '#EAECF0', opacity: b.n ? 0.9 : 1 }} />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {a.buckets10.map(b => <span key={b.min} className="min-w-0 flex-1 text-center text-[10.5px] tabular-nums" style={{ color: LABEL }}>{b.min}</span>)}
      </div>
      <div className="mt-5 flex flex-col">
        {a.bands.map(b => (
          <div key={b.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-t py-2.5" style={{ borderColor: '#F2F4F7' }}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
              <span className="truncate text-[13.5px]" style={{ color: TEXT_2 }}><b className="font-semibold" style={{ color: TEXT }}>{b.label}</b> <span className="hidden sm:inline">{b.sub} · </span>{plural(b.n, 'lead')}</span>
            </span>
            <span className="text-right text-[13px] tabular-nums" style={{ color: b.n >= MIN_GROUP ? TEXT_2 : LABEL }}>{b.n ? `${share(b.qualified, b.n)}% Warm+` : '—'}</span>
            <span className="w-16 text-right text-[13px] tabular-nums" style={{ color: b.won ? GREEN_D : LABEL }}>{b.won ? `${b.won} won` : '—'}</span>
          </div>
        ))}
      </div>
      {hi.n >= MIN_GROUP && lo.n >= MIN_GROUP && (
        <div className="mt-3">
          <Insight tone={hiR > loR ? 'green' : 'amber'} title={hiR > loR ? 'The score is pointing the right way' : 'The score isn\'t separating leads well'}>
            {hiR > loR ? `${hiR}% of 70+ leads reached Warm, against ${loR}% of those under 40. Call the high scores first.`
              : `Leads under 40 reached Warm as often as 70+ ones (${loR}% against ${hiR}%). Don't skip low scores.`}
          </Insight>
        </div>
      )}
    </Panel>
  )
}

// ─── Demand ───────────────────────────────────────────────────────────────────
type DemandId = 'city' | 'area' | 'budget' | 'type'
function Demand({ cohort, journeys, long }: { cohort: InsightLead[]; journeys: Map<string, Journey>; long: string }) {
  const [by, setBy] = useState<DemandId>('city')
  const rows = useMemo(() => {
    const groups = new Map<string, InsightLead[]>()
    const add = (k: string, l: InsightLead) => { const xs = groups.get(k); if (xs) xs.push(l); else groups.set(k, [l]) }
    for (const l of cohort) {
      if (by === 'city') add(l.city?.trim() || 'City not set', l)
      else if (by === 'area') { const ls = (l.localities ?? []).filter(Boolean); if (ls.length) ls.forEach(x => add(x.trim(), l)); else add('Locality not set', l) }
      else if (by === 'type') { const ts = (l.propertyType ?? []).filter(Boolean); if (ts.length) ts.forEach(x => add(x, l)); else add('Type not set', l) }
      else { const v = valueOf(l); add(v ? (BUDGETS.find(b => v >= b.min && v < b.max)?.label ?? 'Budget not set') : 'Budget not set', l) }
    }
    const list = [...groups.entries()].map(([label, xs]) => ({
      label, n: xs.length, hot: xs.filter(l => scoreOf(l) >= HOT_SCORE).length,
      qualified: xs.filter(l => reached(journeys.get(l.id), 'qualified')).length,
      budget: median(xs.map(valueOf).filter(v => v > 0)),
    }))
    return by === 'budget'
      ? list.sort((x, y) => { const ix = BUDGETS.findIndex(b => b.label === x.label), iy = BUDGETS.findIndex(b => b.label === y.label); return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy) })
      : list.sort((x, y) => y.n - x.n).slice(0, 8)
  }, [cohort, journeys, by])
  const max = Math.max(1, ...rows.map(r => r.n))
  return (
    <Panel icon={<MapPin size={18} weight="bold" />} title="Where the demand is" sub={`What the leads of the ${long} are asking for, and which asks turn into Warm leads`} className="h-full"
      right={<Seg label="Group by" value={by} onChange={setBy} options={[{ id: 'city', label: 'City' }, { id: 'area', label: 'Locality' }, { id: 'budget', label: 'Budget' }, { id: 'type', label: 'Type' }]} />}>
      {rows.length === 0 ? <p className="m-0 py-6 text-center text-[14px]" style={{ color: LABEL }}>No leads in this period.</p> : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[380px] border-collapse">
            <thead>
              <tr className="text-[12px]" style={{ color: SUBTLE }}>
                <th className="pb-2 text-left font-semibold">{by === 'city' ? 'City' : by === 'area' ? 'Locality' : by === 'budget' ? 'Budget' : 'Property type'}</th>
                <th className="pb-2 text-left font-semibold">Leads</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right font-semibold">Score 70+</th>
                <th className="pb-2 text-right font-semibold">Warm+</th>
                {by !== 'budget' && <th className="pb-2 text-right font-semibold">Typical budget</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.label} className="border-t" style={{ borderColor: '#F2F4F7' }}>
                  <td className="max-w-[160px] truncate py-2.5 pr-3 text-[13.5px] font-medium" style={{ color: r.label.endsWith('not set') ? LABEL : TEXT }}>{r.label}</td>
                  <td className="w-[34%] py-2.5 pr-3">
                    <div className="flex items-center gap-2"><Meter value={r.n} max={max} color={BLUE_LN} height={8} className="flex-1" />
                      <span className="w-7 text-right text-[13px] font-semibold tabular-nums" style={{ color: TEXT }}>{r.n}</span></div>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-[13px] tabular-nums" style={{ color: r.hot ? TEXT_2 : LABEL }}>{r.hot || '—'}</td>
                  <td className="py-2.5 text-right text-[13px] tabular-nums" style={{ color: r.n >= MIN_GROUP ? TEXT_2 : LABEL }}>{share(r.qualified, r.n)}%</td>
                  {by !== 'budget' && <td className="whitespace-nowrap py-2.5 pl-3 text-right text-[13px] tabular-nums" style={{ color: TEXT_2 }}>{r.budget ? inr(r.budget) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Basis>A lead asking for two localities or types counts in both. Typical budget is the median.</Basis>
    </Panel>
  )
}

// ─── Leads to act on ──────────────────────────────────────────────────────────
function nextStep(l: InsightLead, j: Journey | undefined, now: number): { text: string; tone: 'red' | 'amber' | 'blue' | 'green' | 'neutral' } {
  const st = stageOfLead(l)
  const idle = Math.floor((now - ms(l.updatedAt || l.createdAt)) / DAY)
  if (st === 'New' && !j?.contacted) return { text: `First call. Waiting ${dur(now - created(l))}`, tone: 'red' }
  if (st === 'Hot' && idle >= 2) return { text: `Hot, quiet ${idle} days. Call today`, tone: 'red' }
  if (idle >= 7) return { text: `Gone quiet ${idle} days. Re-engage`, tone: 'amber' }
  if (st === 'Hot') return { text: 'Push for the booking', tone: 'green' }
  if (st === 'Warm') return { text: scoreOf(l) >= 80 ? 'Book a site visit' : 'Share a shortlist', tone: 'blue' }
  if (st === 'Cold') return { text: 'Get them on a call', tone: 'blue' }
  return { text: 'Follow up', tone: 'neutral' }
}
function ActOn({ a, now }: { a: Analysis; now: number }) {
  const js = useMemo(() => buildJourneys(a.actOn, a.winActs), [a.actOn, a.winActs])
  return (
    <Panel icon={<ListChecks size={18} weight="bold" />} title="Leads to act on" sub="Open leads with the highest intent, whenever they came in, and the next step for each"
      right={<Link href="/dashboard/leads" className="inline-flex items-center gap-1 text-[13.5px] font-semibold no-underline" style={{ color: BLUE }}>All leads<ArrowRight size={13} weight="bold" /></Link>}>
      {a.actOn.length === 0 ? <p className="m-0 py-6 text-center text-[14px]" style={{ color: LABEL }}>No open leads right now.</p> : (
        <div className="-mx-4 sm:-mx-5">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_110px_minmax(0,1.1fr)_110px_minmax(0,1.6fr)_80px] gap-3 border-y px-5 py-2.5 text-[12px] font-semibold lg:grid" style={{ borderColor: BORDER, background: SURFACE, color: SUBTLE }}>
            <span>Lead</span><span>Stage</span><span>Source</span><span>Last update</span><span>Next step</span><span />
          </div>
          {a.actOn.map(l => {
            const step = nextStep(l, js.get(l.id), now)
            const first = l.name?.firstName || displayName(l)
            return (
              <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b px-4 py-3 last:border-b-0 sm:px-5 lg:grid-cols-[minmax(0,2.2fr)_110px_minmax(0,1.1fr)_110px_minmax(0,1.6fr)_80px]" style={{ borderColor: '#F2F4F7' }}>
                <Link href={`/dashboard/leads/${l.id}`} className="flex min-w-0 items-center gap-3 no-underline">
                  <LeadAvatar lead={l} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold" style={{ color: TEXT }}>{displayName(l)}</span>
                    <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{[valueOf(l) ? inr(valueOf(l)) : null, l.city].filter(Boolean).join(' · ') || '—'}</span>
                  </span>
                </Link>
                <span className="flex items-center gap-1.5 lg:order-last lg:justify-end">
                  <CallLink phone={l.phones?.primaryPhoneNumber} name={first} />
                  <WaLink phone={l.phones?.primaryPhoneNumber} name={first} />
                </span>
                <span className="col-span-2 flex flex-wrap items-center gap-2 lg:contents">
                  <span><StagePill stage={stageOfLead(l) as StageId} small /></span>
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px]" style={{ color: TEXT_2 }}><SourceMark raw={l.sourcePortal} size={18} /><span className="truncate">{sourceMeta(l.sourcePortal).label}</span></span>
                  <span className="text-[13px] tabular-nums" style={{ color: SUBTLE }}>{agoShort(ms(l.updatedAt || l.createdAt), now)}</span>
                  <span className="min-w-0"><Pill tone={step.tone} small>{step.text}</Pill></span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
const agoShort = (t: number, now: number) => { const d = Math.floor((now - t) / DAY); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago` }
