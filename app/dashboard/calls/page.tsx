'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  PhoneCall, PhoneX, PhoneDisconnect, ClockClockwise, HandPalm, CheckCircle, Lightning, Sparkle, Fire, Thermometer,
  Snowflake, HourglassMedium, SkipForward, ArrowRight, ArrowSquareOut, ArrowClockwise, ArrowCounterClockwise, X, Copy,
  Check, WhatsappLogo, SignOut, Trophy, Keyboard, Kanban, NotePencil, Warning, CircleNotch, UsersThree, Timer,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import { type CRMLead } from '@/lib/twenty'
import {
  OUTREACH_TABS, CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, MUTED, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, GREEN,
  GREEN_D, RED, XS, MONO, DAY, HOUR, STAGE, stageOf, displayName, phone10, formatPhone, telHref, waHref, getCsId,
  budgetText, durLong, clock, pct, type StageId, type Tone, TONE,
  Btn, Seg, Field, Toggle, Pill, Badge, PageHeader, Panel, StatCard, StackBar, Insight, EmptyState, Dialog, Toast,
  useToast, LeadAvatar, SourceMark, sourceMeta, StagePill, inputCls, inputStyle, textareaCls,
} from '@/components/outreach/OutreachKit'

// ─── Types ────────────────────────────────────────────────────────────────────
type ListId    = 'smart' | 'first' | 'hot' | 'warm' | 'cold' | 'quiet'
type OrderId   = 'priority' | 'intent' | 'newest' | 'waiting'
type SizeId    = '10' | '25' | '50' | 'all'
type Phase     = 'setup' | 'session' | 'done'
type Step      = 'ready' | 'calling' | 'log'
type OutcomeId = 'connected' | 'no_answer' | 'callback' | 'not_interested'
type Done      = { activity?: boolean; task?: boolean; status?: boolean; result?: string }
type LogEntry  = {
  key:         string
  leadId:      string
  name:        string
  phone:       string | null
  outcome:     OutcomeId | 'skipped'
  duration:    number            // seconds
  note:        string
  at:          number
  nc:          number            // unanswered calls before this one
  callbackAt?: string            // ISO
  disqualify?: boolean
  save?:       'saving' | 'saved' | 'failed'
  result?:     string
  error?:      string
  done?:       Done
}
type Saved = {
  v: 1; list: ListId; queue: CRMLead[]; idx: number; log: LogEntry[]
  startedAt: number; endedAt: number | null; phase: 'session' | 'done'
}
type IconT = typeof PhoneCall

// ─── Rules ────────────────────────────────────────────────────────────────────
const OPEN: StageId[] = ['New', 'Cold', 'Warm', 'Hot']
const QUIET_DAYS = 7          // same "gone quiet" rule as the Pipeline page
const NC_LIMIT   = 5          // 5 unanswered calls disqualify a lead (LIFECYCLE_SPEC)
const STORE      = 'leadgap:dialer'

const LISTS: { id: ListId; label: string; desc: string; Icon: IconT; color: string; bg: string }[] = [
  { id: 'smart', label: 'Smart queue', desc: 'Every open lead, most urgent first',       Icon: Lightning,       color: BLUE,             bg: BLUE_BG },
  { id: 'first', label: 'First calls', desc: 'New leads nobody has called yet',          Icon: Sparkle,         color: '#344054',        bg: '#F2F4F7' },
  { id: 'hot',   label: 'Hot',         desc: 'EOI received. Push for the booking',       Icon: Fire,            color: STAGE.Hot.color,  bg: STAGE.Hot.bg },
  { id: 'warm',  label: 'Warm',        desc: 'Requirements confirmed. Book the visit',   Icon: Thermometer,     color: STAGE.Warm.color, bg: STAGE.Warm.bg },
  { id: 'cold',  label: 'Cold',        desc: 'Contact attempted. Try them again',        Icon: Snowflake,       color: STAGE.Cold.color, bg: STAGE.Cold.bg },
  { id: 'quiet', label: 'Gone quiet',  desc: `No update in ${QUIET_DAYS}+ days`,          Icon: HourglassMedium, color: '#5925DC',        bg: '#F4F3FF' },
]
const listOf = (id: ListId) => LISTS.find(l => l.id === id) ?? LISTS[0]

const ORDERS: { id: OrderId; label: string; hint: string }[] = [
  { id: 'priority', label: 'Priority', hint: 'Hot and Warm first, then fresh New leads, weighted by intent score.' },
  { id: 'intent',   label: 'Intent',   hint: 'Highest intent score first.' },
  { id: 'newest',   label: 'Newest',   hint: 'Most recent enquiries first.' },
  { id: 'waiting',  label: 'Waiting',  hint: 'Leads with the oldest last update first.' },
]

const OUTCOMES: { id: OutcomeId; label: string; hint: string; Icon: IconT; tone: Tone; color: string }[] = [
  { id: 'connected',      label: 'Connected',      hint: 'You spoke to them',              Icon: CheckCircle,    tone: 'green', color: GREEN },
  { id: 'no_answer',      label: 'No answer',      hint: 'Busy, switched off or no pickup', Icon: PhoneX,         tone: 'amber', color: '#F79009' },
  { id: 'callback',       label: 'Call back',      hint: 'They asked you to call later',   Icon: ClockClockwise, tone: 'blue',  color: BLUE },
  { id: 'not_interested', label: 'Not interested', hint: 'Not looking any more',           Icon: HandPalm,       tone: 'red',   color: RED },
]
const SKIPPED = { label: 'Skipped', color: '#D0D5DD' }
const outcomeOf = (id: LogEntry['outcome']) => OUTCOMES.find(o => o.id === id)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ms  = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0)
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
const firstName = (name: string) => name.split(' ')[0] || name
let keySeq = 0
const newKey = () => `c${Date.now().toString(36)}${++keySeq}`

function priority(l: CRMLead, now: number) {
  const s = stageOf(l.status)
  let p = (s === 'Hot' ? 60 : s === 'Warm' ? 45 : s === 'New' ? 40 : 20) + (l.intentScore ?? 0) * 0.4
  if (s === 'New' && now - ms(l.createdAt) < DAY) p += 25                 // fresh enquiry
  if (s !== 'New' && now - ms(l.updatedAt) > QUIET_DAYS * DAY) p += 10   // going cold
  return p - (l.failedContactAttempts ?? 0) * 4
}

/** One line on why this lead is worth calling now, from data the lead already has */
function reasonFor(l: CRMLead, now: number): { text: string; tone: Tone } {
  const s = stageOf(l.status)
  const nc = l.failedContactAttempts ?? 0
  const age = now - ms(l.createdAt)
  const idle = now - ms(l.updatedAt)
  if (nc >= 3) return { text: `${nc} unanswered calls so far. Call ${NC_LIMIT} without an answer disqualifies the lead.`, tone: 'red' }
  if (s === 'New') return age < DAY
    ? { text: `New enquiry, came in ${durLong(age)} ago. Call while it's fresh.`, tone: 'blue' }
    : { text: `Not called yet. Waiting ${durLong(age)}.`, tone: 'amber' }
  if (idle > QUIET_DAYS * DAY) return { text: `${STAGE[s].label}, but no update in ${durLong(idle)}.`, tone: 'violet' }
  if (s === 'Hot')  return { text: `EOI received. Last update ${durLong(idle)} ago. Push for the booking.`, tone: 'amber' }
  if (s === 'Warm') return { text: `Requirements confirmed. Last update ${durLong(idle)} ago. Book the site visit.`, tone: 'blue' }
  return { text: `Contact attempted. Last update ${durLong(idle)} ago.`, tone: 'neutral' }
}

function inList(l: CRMLead, list: ListId, now: number) {
  const s = stageOf(l.status)
  switch (list) {
    case 'smart': return true
    case 'first': return s === 'New'
    case 'hot':   return s === 'Hot'
    case 'warm':  return s === 'Warm'
    case 'cold':  return s === 'Cold'
    case 'quiet': return s !== 'New' && now - ms(l.updatedAt) > QUIET_DAYS * DAY
  }
}

function sortLeads(arr: CRMLead[], order: OrderId, now: number) {
  const by: Record<OrderId, (a: CRMLead, b: CRMLead) => number> = {
    priority: (a, b) => priority(b, now) - priority(a, now),
    intent:   (a, b) => (b.intentScore ?? 0) - (a.intentScore ?? 0),
    newest:   (a, b) => ms(b.createdAt) - ms(a.createdAt),
    waiting:  (a, b) => ms(a.updatedAt) - ms(b.updatedAt),
  }
  return [...arr].sort(by[order])
}

/** Quick picks for a callback, worked out from the moment the call was logged */
function callbackPresets(t: number) {
  const at = (base: number, h: number) => { const d = new Date(base); d.setHours(h, 0, 0, 0); return d }
  const list = [{ label: 'In 1 hour', date: new Date(t + HOUR) }]
  const evening = at(t, 18)
  if (evening.getTime() - t > 1.5 * HOUR) list.push({ label: 'This evening, 6 pm', date: evening })
  list.push({ label: 'Tomorrow, 11 am', date: at(t + DAY, 11) })
  list.push({ label: 'In 2 days, 11 am', date: at(t + 2 * DAY, 11) })
  return list
}
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const talkText = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : clock(s))

// ─── Data ─────────────────────────────────────────────────────────────────────
async function fetchLeads(): Promise<CRMLead[]> {
  const r = await fetch('/api/crm/leads?limit=200', { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Could not load leads')
  return j.data?.leads ?? j.data ?? []
}

async function send(url: string, body: unknown, method = 'POST') {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Could not save (${r.status})`)
  return j
}

/** Saves one call on the lead. `done` remembers what already went through, so a retry never logs twice. */
async function saveCall(e: LogEntry, done: Done): Promise<string> {
  if (!done.activity) {
    const base = { type: 'Call Made', duration: e.duration || null, notes: e.note || null, metadata: { via: 'power_dialer' } }
    const payload =
      e.outcome === 'connected' ? { ...base, outcome: 'Connected', callOutcome: 'connected' }
      : e.outcome === 'no_answer' ? { ...base, outcome: 'No Response', callOutcome: 'nca', ncaAttempt: e.nc + 1 }
      : e.outcome === 'callback' ? { ...base, outcome: 'Call Back', callOutcome: 'connected', nextActionDate: e.callbackAt }
      : { ...base, outcome: 'Not Interested', callOutcome: 'connected' }
    const res = await send(`/api/crm/leads/${e.leadId}/activities`, payload)
    done.activity = true
    const to = res.statusAdvancedTo as string | undefined
    done.result = to === 'Disqualified' && e.outcome === 'no_answer' ? `Disqualified after ${NC_LIMIT} unanswered calls`
      : to ? `Moved to ${to}` : 'Saved on the lead'
  }
  if (e.outcome === 'callback' && e.callbackAt && !done.task) {
    await send(`/api/crm/leads/${e.leadId}/tasks`, {
      title: `Call back ${e.name}`, task_type: 'Call Back', due_date: e.callbackAt, priority: 'Medium',
      notes: [`Call back at ${fmtWhen(e.callbackAt)}`, e.note].filter(Boolean).join('. '),
    })
    done.task = true
    done.result = `Callback set for ${fmtWhen(e.callbackAt)}`
  }
  if (e.outcome === 'not_interested' && e.disqualify && !done.status) {
    await send(`/api/crm/leads/${e.leadId}`, { status: 'Disqualified' }, 'PATCH')
    done.status = true
    done.result = 'Marked Disqualified'
  }
  return done.result ?? 'Saved on the lead'
}

function readSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORE)
    if (!raw) return null
    const s = JSON.parse(raw) as Saved
    return s?.v === 1 && Array.isArray(s.queue) && s.queue.length ? s : null
  } catch { return null }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PowerDialerPage() {
  const [leads, setLeads]     = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [now, setNow]         = useState(0)
  const [booted, setBooted]   = useState(false)

  // Setup
  const [list, setList]       = useState<ListId>('smart')
  const [order, setOrder]     = useState<OrderId>('priority')
  const [size, setSize]       = useState<SizeId>('25')
  const [removed, setRemoved] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)

  // Session
  const [phase, setPhase]         = useState<Phase>('setup')
  const [queue, setQueue]         = useState<CRMLead[]>([])
  const [idx, setIdx]             = useState(0)
  const [log, setLog]             = useState<LogEntry[]>([])
  const [startedAt, setStartedAt] = useState(0)
  const [endedAt, setEndedAt]     = useState<number | null>(null)
  const [sessionList, setSessionList] = useState<ListId>('smart')

  // The call in front of you
  const [step, setStep]             = useState<Step>('ready')
  const [callStart, setCallStart]   = useState(0)
  const [tick, setTick]             = useState(0)
  const [duration, setDuration]     = useState(0)
  const [logAt, setLogAt]           = useState(0)
  const [outcome, setOutcome]       = useState<OutcomeId | null>(null)
  const [note, setNote]             = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [disqualify, setDisqualify] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [copied, setCopied]         = useState<string | null>(null)
  const { toast, show, hide } = useToast()

  const callRef = useRef<HTMLAnchorElement>(null)
  const logRef  = useRef<LogEntry[]>([])
  useEffect(() => { logRef.current = log }, [log])

  // First load, and pick up a session that was running before a refresh
  useEffect(() => {
    let alive = true
    fetchLeads().then(
      ls => {
        if (!alive) return
        setLeads(ls); setNow(Date.now()); setLoading(false)
        const saved = readSaved()
        if (saved) {
          setQueue(saved.queue); setIdx(saved.idx); setStartedAt(saved.startedAt); setEndedAt(saved.endedAt)
          setSessionList(saved.list); setPhase(saved.phase)
          setLog(saved.log.map(e => e.save === 'saving'
            ? { ...e, save: 'failed', error: 'The page reloaded before this was confirmed. Check the lead before you retry.' }
            : e))
        }
        setBooted(true)
      },
      e => { if (!alive) return; setError(msg(e)); setLoading(false); setBooted(true) },
    )
    return () => { alive = false }
  }, [])

  // Keep the session through a refresh (this tab only)
  useEffect(() => {
    if (!booted) return
    try {
      if (phase === 'setup') sessionStorage.removeItem(STORE)
      else sessionStorage.setItem(STORE, JSON.stringify({ v: 1, list: sessionList, queue, idx, log, startedAt, endedAt, phase } satisfies Saved))
    } catch { /* storage blocked: the session still works, it just won't survive a refresh */ }
  }, [booted, phase, sessionList, queue, idx, log, startedAt, endedAt])

  // Call timer
  useEffect(() => {
    if (step !== 'calling') return
    const t = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step])

  // ── Setup numbers ──
  const open     = useMemo(() => leads.filter(l => OPEN.includes(stageOf(l.status))), [leads])
  const dialable = useMemo(() => open.filter(l => phone10(l.phones?.primaryPhoneNumber)), [open])
  const noNumber = open.length - dialable.length
  const counts   = useMemo(() => {
    const c = {} as Record<ListId, number>
    for (const x of LISTS) c[x.id] = dialable.filter(l => inList(l, x.id, now)).length
    return c
  }, [dialable, now])
  const candidates = useMemo(() => sortLeads(dialable.filter(l => inList(l, list, now)), order, now), [dialable, list, order, now])
  const pool       = useMemo(() => candidates.filter(l => !removed.includes(l.id)), [candidates, removed])
  const planned    = useMemo(() => (size === 'all' ? pool : pool.slice(0, Number(size))), [pool, size])
  const removedHere = candidates.length - pool.length

  // ── Session numbers ──
  const current   = phase === 'session' ? queue[idx] : undefined
  const calls     = log.filter(e => e.outcome !== 'skipped')
  const connected = calls.filter(e => e.outcome !== 'no_answer').length
  const talk      = calls.filter(e => e.outcome !== 'no_answer').reduce((s, e) => s + e.duration, 0)   // ringing time doesn't count
  const callbacks = log.filter(e => e.outcome === 'callback')
  const failed    = log.filter(e => e.save === 'failed')
  const elapsed   = Math.max(0, Math.floor((tick - callStart) / 1000))

  // ── Actions ──
  function reload() {
    setLoading(true); setError(null)
    fetchLeads().then(
      ls => { setLeads(ls); setNow(Date.now()); setLoading(false) },
      e => { setError(msg(e)); setLoading(false) },
    )
  }
  function resetCall() {
    setStep('ready'); setOutcome(null); setNote(''); setCallbackAt(''); setDisqualify(false); setDuration(0); setFormError(null)
  }
  function start() {
    if (!planned.length) return
    setQueue(planned); setIdx(0); setLog([]); setStartedAt(Date.now()); setEndedAt(null); setSessionList(list)
    resetCall(); setPhase('session')
    window.scrollTo({ top: 0 })
  }
  function advance() {
    resetCall()
    if (idx + 1 >= queue.length) { setEndedAt(Date.now()); setPhase('done') }
    setIdx(i => i + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function startCall() { const t = Date.now(); setCallStart(t); setTick(t); setStep('calling') }
  function endCall(o?: OutcomeId) {
    const t = Date.now()
    setDuration(Math.max(0, Math.round((t - callStart) / 1000))); setLogAt(t); setOutcome(o ?? null); setFormError(null); setStep('log')
  }
  function logWithoutTimer() { setDuration(0); setLogAt(Date.now()); setStep('log') }
  function pickOutcome(o: OutcomeId) { setOutcome(o); setFormError(null) }

  function skip() {
    if (!current) return
    setLog(l => [{
      key: newKey(), leadId: current.id, name: displayName(current), phone: current.phones?.primaryPhoneNumber ?? null,
      outcome: 'skipped', duration: 0, note: '', at: Date.now(), nc: current.failedContactAttempts ?? 0,
    }, ...l])
    advance()
  }

  function persist(entry: LogEntry) {
    const done: Done = { ...(entry.done ?? {}) }
    saveCall(entry, done).then(
      result => setLog(l => l.map(e => (e.key === entry.key ? { ...e, save: 'saved', result, error: undefined, done } : e))),
      err => {
        setLog(l => l.map(e => (e.key === entry.key ? { ...e, save: 'failed', error: msg(err), done } : e)))
        show({ text: `Couldn't save the call with ${firstName(entry.name)}`, tone: 'err', action: { label: 'Retry', run: () => retry(entry.key) } })
      },
    )
  }
  function retry(key: string) {
    const e = logRef.current.find(x => x.key === key)
    if (!e || e.save !== 'failed') return
    setLog(l => l.map(x => (x.key === key ? { ...x, save: 'saving', error: undefined } : x)))
    persist(e)
  }

  function saveAndNext() {
    if (!current) return
    if (!outcome) { setFormError('Pick how the call went.'); return }
    let cbIso: string | undefined
    if (outcome === 'callback') {
      const d = callbackAt ? new Date(callbackAt) : null
      if (!d || Number.isNaN(d.getTime())) { setFormError('Pick when to call back.'); return }
      cbIso = d.toISOString()
    }
    const entry: LogEntry = {
      key: newKey(), leadId: current.id, name: displayName(current), phone: current.phones?.primaryPhoneNumber ?? null,
      outcome, duration, note: note.trim(), at: Date.now(), nc: current.failedContactAttempts ?? 0,
      callbackAt: cbIso, disqualify: outcome === 'not_interested' && disqualify, save: 'saving', done: {},
    }
    setLog(l => [entry, ...l])
    persist(entry)
    advance()
  }

  function endSession() { setConfirmEnd(false); resetCall(); setEndedAt(Date.now()); setPhase('done'); window.scrollTo({ top: 0 }) }
  function newSession() {
    setPhase('setup'); setQueue([]); setIdx(0); setLog([]); setRemoved([]); setShowAll(false); resetCall()
    reload()
    window.scrollTo({ top: 0 })
  }
  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(key); setTimeout(() => setCopied(c => (c === key ? null : c)), 1600) },
      () => show({ text: 'Copy failed. Select the number and copy it instead.', tone: 'err' }),
    )
  }

  // Keyboard: C call · S skip · L log · E end · N no answer · 1–4 outcome · Enter save
  useEffect(() => {
    if (phase !== 'session') return
    const onKey = (e: KeyboardEvent) => {
      if (confirmEnd || e.repeat) return
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if (typing) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && step === 'log') { e.preventDefault(); saveAndNext() }
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'enter' && t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return
      if (step === 'ready') {
        if (k === 'c') { e.preventDefault(); callRef.current?.click() }
        else if (k === 's') { e.preventDefault(); skip() }
        else if (k === 'l') { e.preventDefault(); logWithoutTimer() }
      } else if (step === 'calling') {
        if (k === 'e' || k === 'enter') { e.preventDefault(); endCall() }
        else if (k === 'n') { e.preventDefault(); endCall('no_answer') }
      } else {
        const o = OUTCOMES[Number(k) - 1]
        if (o) { e.preventDefault(); pickOutcome(o.id) }
        else if (k === 'enter') { e.preventDefault(); saveAndNext() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const firstLoad = loading && leads.length === 0 && phase === 'setup'

  return (
    <div style={{ minHeight: '100vh', background: CANVAS }}>
      <PageTabBar tabs={OUTREACH_TABS} />

      {phase === 'setup' && (
        <>
          <PageHeader
            title="Power Dialer"
            badge={!firstLoad && !error ? <Badge tone="green"><span className="size-1.5 rounded-full" style={{ background: GREEN }} />{dialable.length} ready to call</Badge> : undefined}
            sub="Pick who to call, then work through them one after another. Every call is saved on the lead and the next one is ready the moment you log it."
            actions={<Btn onClick={reload} label="Refresh"><ArrowClockwise size={18} className={loading && !firstLoad ? 'animate-spin' : ''} /></Btn>}
          />
          <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
            {error ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3" style={{ background: '#FEF3F2', borderColor: '#FECDCA' }}>
                <p className="m-0 text-[14px]" style={{ color: '#B42318' }}>{error}</p>
                <Btn onClick={reload}>Try again</Btn>
              </div>
            ) : firstLoad ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="h-[420px] animate-pulse rounded-[16px] border" style={{ borderColor: BORDER, background: SURFACE }} />
                <div className="h-[360px] animate-pulse rounded-[18px] border" style={{ borderColor: BORDER, background: SURFACE }} />
              </div>
            ) : dialable.length === 0 ? (
              <EmptyState icon={<PhoneCall size={22} />} title="No leads to call right now"
                actions={<LinkBtn href="/dashboard/leads" primary><UsersThree size={18} />Go to Leads</LinkBtn>}>
                {open.length
                  ? `${open.length} open ${open.length === 1 ? 'lead has' : 'leads have'} no valid mobile number. Add one on the lead's page to call them from here.`
                  : 'Every lead is Closed, Disqualified or on hold. New enquiries show up here as soon as they come in.'}
              </EmptyState>
            ) : (
              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[auto_1fr]">
                {/* Who and how */}
                <div className="flex min-w-0 flex-col gap-6">
                  <Panel step={1} title="Who to call" sub="Only open leads (New, Cold, Warm, Hot) with a valid mobile number.">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {LISTS.map(x => (
                        <ListTile key={x.id} item={x} count={counts[x.id]} on={list === x.id}
                          onClick={() => { setList(x.id); setShowAll(false) }} />
                      ))}
                    </div>
                  </Panel>
                  <Panel step={2} title="Order and size" sub="Leads are called one after another in this order.">
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Call in this order" hint={ORDERS.find(o => o.id === order)?.hint}>
                        <Seg label="Order" value={order} onChange={setOrder} full options={ORDERS.map(o => ({ id: o.id, label: o.label }))} />
                      </Field>
                      <Field label="How many to call" hint={`${pool.length} ${pool.length === 1 ? 'lead' : 'leads'} in ${listOf(list).label}.`}>
                        <Seg label="Session size" value={size} onChange={setSize} full
                          options={[{ id: '10', label: '10' }, { id: '25', label: '25' }, { id: '50', label: '50' }, { id: 'all', label: 'All', count: pool.length }]} />
                      </Field>
                    </div>
                  </Panel>
                </div>

                {/* Summary + start (second on phones, right column on desktop) */}
                <aside className="min-w-0 xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
                  <SessionSummary planned={planned} list={list} order={order} noNumber={noNumber} onStart={start} />
                </aside>

                {/* The queue */}
                <Panel step={3} title="Your call list" className="xl:col-start-1"
                  sub={planned.length ? `${planned.length} ${planned.length === 1 ? 'lead' : 'leads'}, in the order you'll call them. Remove anyone you don't want to call today.` : undefined}
                  right={removedHere > 0 ? (
                    <Btn size="sm" variant="ghost" onClick={() => setRemoved(r => r.filter(id => !candidates.some(c => c.id === id)))}>
                      <ArrowCounterClockwise size={15} />Put back {removedHere}
                    </Btn>
                  ) : undefined}>
                  {planned.length === 0 ? (
                    <div className="rounded-[14px] border border-dashed px-5 py-10 text-center text-[14px]" style={{ borderColor: BORDER_2, color: SUBTLE }}>
                      Nobody in {listOf(list).label} right now.{' '}
                      {list !== 'smart' && <button type="button" onClick={() => setList('smart')} className="cursor-pointer font-semibold" style={{ color: BLUE }}>Use the Smart queue</button>}
                    </div>
                  ) : (
                    <>
                      <ol className="m-0 list-none overflow-hidden rounded-[14px] border p-0" style={{ borderColor: BORDER }}>
                        {(showAll ? planned : planned.slice(0, 8)).map((l, i) => (
                          <QueueRow key={l.id} n={i + 1} lead={l} reason={reasonFor(l, now)} first={i === 0}
                            onRemove={() => setRemoved(r => [...r, l.id])} />
                        ))}
                      </ol>
                      {planned.length > 8 && (
                        <button type="button" onClick={() => setShowAll(v => !v)}
                          className="mt-3 h-10 w-full cursor-pointer rounded-[10px] border text-[14px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                          style={{ borderColor: BORDER, color: TEXT_2 }}>
                          {showAll ? 'Show fewer' : `Show all ${planned.length}`}
                        </button>
                      )}
                    </>
                  )}
                </Panel>
              </div>
            )}
          </div>
        </>
      )}

      {phase === 'session' && current && (
        <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-5 sm:pt-7 lg:px-8">
          <SessionBar list={sessionList} queue={queue} idx={idx} log={log} calls={calls.length} connected={connected}
            talk={talk} callbacks={callbacks.length} onEnd={() => setConfirmEnd(true)} />

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* Lead in front of you */}
            <section key={current.id} className="min-w-0 overflow-hidden rounded-[20px] border bg-white" style={{ borderColor: BORDER, boxShadow: '0 4px 8px -2px rgba(16,24,40,0.06), 0 2px 4px -2px rgba(16,24,40,0.04)' }}>
              <LeadHead lead={current} n={idx + 1} total={queue.length} copied={copied} onCopy={copy} />

              <div className="grid gap-5 px-4 py-5 sm:px-6">
                {(() => { const r = reasonFor(current, now); return <Insight tone={r.tone} title="Why call now">{r.text}</Insight> })()}

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>Mobile</div>
                    <div className="mt-1 select-all text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[32px]" style={{ color: TEXT }}>
                      {formatPhone(current.phones?.primaryPhoneNumber)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Btn size="sm" onClick={() => copy(`+91${phone10(current.phones?.primaryPhoneNumber)}`, 'phone')}>
                      {copied === 'phone' ? <Check size={15} weight="bold" color={GREEN_D} /> : <Copy size={15} />}{copied === 'phone' ? 'Copied' : 'Copy'}
                    </Btn>
                    <a href={waHref(current.phones?.primaryPhoneNumber)} target="_blank" rel="noreferrer"
                      className="inline-flex h-8 items-center gap-2 rounded-[8px] border bg-white px-2.5 text-[13px] font-semibold no-underline transition-colors hover:bg-[#F9FAFB]"
                      style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
                      <WhatsappLogo size={16} weight="fill" color="#25D366" />WhatsApp
                    </a>
                  </div>
                </div>
              </div>

              {/* Call steps */}
              <div className="border-y px-4 py-5 sm:px-6" style={{ borderColor: BORDER, background: SURFACE }}>
                {step === 'ready' && (
                  <div>
                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <a ref={callRef} href={telHref(current.phones?.primaryPhoneNumber)} onClick={startCall}
                        className="inline-flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[14px] border text-[16px] font-semibold text-white no-underline transition-[filter] hover:brightness-110"
                        style={{ background: GREEN_D, borderColor: GREEN_D, boxShadow: '0 1px 2px rgba(16,24,40,0.05), inset 0 -2px 0 rgba(16,24,40,0.12)' }}>
                        <PhoneCall size={20} weight="fill" />Call {firstName(displayName(current))}
                        <Kbd dark>C</Kbd>
                      </a>
                      <div className="flex gap-2.5">
                        <Btn size="lg" onClick={skip} className="h-14 flex-1 sm:flex-none"><SkipForward size={18} />Skip<Kbd>S</Kbd></Btn>
                        <Btn size="lg" onClick={logWithoutTimer} className="h-14 flex-1 sm:flex-none"><NotePencil size={18} />Log a call<Kbd>L</Kbd></Btn>
                      </div>
                    </div>
                    <p className="m-0 mt-3 text-[13px] leading-snug" style={{ color: SUBTLE }}>
                      Call opens your phone&apos;s dialer and starts the timer. Dialled from another phone? Use Log a call.
                    </p>
                  </div>
                )}

                {step === 'calling' && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full" style={{ background: '#DCFAE6' }}>
                        <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: GREEN }} />
                        <PhoneCall size={22} weight="fill" color={GREEN_D} className="relative" />
                      </span>
                      <div>
                        <div className="text-[13px] font-semibold" style={{ color: GREEN_D }}>On call with {firstName(displayName(current))}</div>
                        <div className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: TEXT }} aria-live="off">{clock(elapsed)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <Btn size="lg" onClick={() => endCall('no_answer')} className="flex-1 sm:flex-none"><PhoneX size={18} />No answer<Kbd>N</Kbd></Btn>
                      <Btn size="lg" variant="danger" onClick={() => endCall()} className="flex-1 sm:flex-none"><PhoneDisconnect size={18} weight="fill" />End call<Kbd dark>E</Kbd></Btn>
                    </div>
                  </div>
                )}

                {step === 'log' && (
                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="m-0 text-[16px] font-semibold" style={{ color: TEXT }}>How did it go?</h3>
                      {duration > 0 && <Pill><Timer size={13} weight="bold" />Call time {clock(duration)}</Pill>}
                    </div>
                    <div role="radiogroup" aria-label="Call outcome" className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                      {OUTCOMES.map((o, i) => (
                        <OutcomeTile key={o.id} o={o} n={i + 1} on={outcome === o.id} onClick={() => pickOutcome(o.id)} />
                      ))}
                    </div>

                    {outcome === 'no_answer' && (() => {
                      const n = (current.failedContactAttempts ?? 0) + 1
                      return (
                        <Insight tone={n >= NC_LIMIT ? 'red' : 'amber'} icon={<Warning size={15} weight="bold" />}
                          title={<span className="inline-flex flex-wrap items-center gap-2">Unanswered call {Math.min(n, NC_LIMIT)} of {NC_LIMIT}<NcMeter n={n} /></span>}>
                          {n >= NC_LIMIT
                            ? 'Saving this disqualifies the lead automatically.'
                            : `${NC_LIMIT - n} more unanswered ${NC_LIMIT - n === 1 ? 'call' : 'calls'} and the lead is disqualified automatically.`}
                        </Insight>
                      )
                    })()}

                    {outcome === 'callback' && (
                      <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: BORDER }}>
                        <div className="mb-2.5 text-[13px] font-semibold" style={{ color: TEXT_2 }}>When should you call back?</div>
                        <div className="flex flex-wrap gap-2">
                          {callbackPresets(logAt).map(p => {
                            const v = toLocalInput(p.date)
                            const on = callbackAt === v
                            return (
                              <button key={p.label} type="button" aria-pressed={on} onClick={() => { setCallbackAt(v); setFormError(null) }}
                                className="h-9 cursor-pointer whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                                style={on ? { background: BLUE_BG, borderColor: BLUE_LN, color: BLUE } : { background: CANVAS, borderColor: BORDER, color: TEXT_2 }}>
                                {p.label}
                              </button>
                            )
                          })}
                        </div>
                        <div className="mt-3 grid gap-1.5 sm:max-w-[280px]">
                          <label htmlFor="cb-at" className="text-[12.5px] font-medium" style={{ color: SUBTLE }}>Or pick a date and time</label>
                          <input id="cb-at" type="datetime-local" value={callbackAt} min={toLocalInput(new Date(logAt))}
                            onChange={e => { setCallbackAt(e.target.value); setFormError(null) }} className={inputCls} style={inputStyle} />
                        </div>
                        <p className="m-0 mt-2.5 text-[12.5px]" style={{ color: SUBTLE }}>Saved as a Call Back task on the lead, so it shows up in your tasks.</p>
                      </div>
                    )}

                    {outcome === 'not_interested' && (
                      <div className="flex items-center gap-3 rounded-[14px] border bg-white p-4" style={{ borderColor: BORDER }}>
                        <Toggle on={disqualify} onChange={setDisqualify} label="Also mark as Disqualified" />
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold" style={{ color: TEXT }}>Also mark as Disqualified</div>
                          <div className="text-[13px] leading-snug" style={{ color: SUBTLE }}>Takes the lead out of every call list. Leave it off if they might come back.</div>
                        </div>
                      </div>
                    )}

                    <Field label="Note" htmlFor="call-note" hint={<>Optional. Saved on the lead&apos;s activity. <span className="hidden lg:inline">Ctrl + Enter saves.</span></>}>
                      <textarea id="call-note" rows={2} value={note} onChange={e => setNote(e.target.value)}
                        placeholder={outcome === 'connected' ? 'What did you agree? e.g. site visit on Saturday' : 'Anything worth remembering'}
                        className={textareaCls} style={inputStyle} />
                    </Field>

                    {formError && <p role="alert" className="m-0 text-[13.5px] font-medium" style={{ color: '#B42318' }}>{formError}</p>}

                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <Btn variant="ghost" onClick={() => { setStep('ready'); setFormError(null) }}>Back</Btn>
                      <Btn variant="primary" size="lg" onClick={saveAndNext} className="flex-1 sm:flex-none">
                        {idx + 1 >= queue.length ? 'Save and finish' : 'Save & next'}<ArrowRight size={18} weight="bold" /><Kbd dark>↵</Kbd>
                      </Btn>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 py-5 sm:px-6">
                <LeadFacts lead={current} now={now} />
              </div>
            </section>

            {/* Up next + log */}
            <div className="grid min-w-0 items-start gap-6 md:grid-cols-2 xl:sticky xl:top-6 xl:flex xl:flex-col xl:items-stretch">
              <Panel icon={<UsersThree size={18} />} title="Up next" sub={queue.length - idx - 1 > 0 ? `${queue.length - idx - 1} after this one` : 'This is the last lead'}>
                {queue.length - idx - 1 > 0 ? (
                  <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-1 p-0">
                    {queue.slice(idx + 1, idx + 6).map((l, i) => (
                      <li key={l.id} className="flex items-center gap-3 rounded-[10px] px-1 py-1.5">
                        <span className="w-5 text-right text-[12.5px] font-semibold tabular-nums" style={{ color: LABEL }}>{idx + i + 2}</span>
                        <LeadAvatar lead={l} size={30} badge={false} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold" style={{ color: TEXT }}>{displayName(l)}</div>
                          <div className="truncate text-[12px]" style={{ color: SUBTLE }}>{reasonFor(l, now).text}</div>
                        </div>
                        <StagePill stage={stageOf(l.status)} small />
                      </li>
                    ))}
                    {queue.length - idx - 6 > 0 && <li className="px-1 pt-1 text-[12.5px]" style={{ color: SUBTLE }}>and {queue.length - idx - 6} more</li>}
                  </ol>
                ) : (
                  <p className="m-0 text-[13.5px]" style={{ color: SUBTLE }}>Log this call to finish the session.</p>
                )}
              </Panel>

              <Panel icon={<PhoneCall size={18} />} title="This session" sub={log.length ? `${calls.length} ${calls.length === 1 ? 'call' : 'calls'} logged${log.length - calls.length ? `, ${log.length - calls.length} skipped` : ''}` : 'Calls you log show up here'}>
                {log.length === 0 ? (
                  <p className="m-0 text-[13.5px]" style={{ color: SUBTLE }}>Nothing yet. Your first call is on the left.</p>
                ) : (
                  <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-0 p-0">
                    {log.slice(0, 8).map(e => <LogRow key={e.key} e={e} onRetry={() => retry(e.key)} />)}
                    {log.length > 8 && <li className="pt-2 text-[12.5px]" style={{ color: SUBTLE }}>and {log.length - 8} earlier</li>}
                  </ul>
                )}
              </Panel>

              <Shortcuts />
            </div>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <>
          <PageHeader title="Power Dialer" sub="How the session went, and who to call back." />
          <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
            <section className="flex flex-col gap-5 rounded-[20px] border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"
              style={{ borderColor: '#ABEFC6', background: 'linear-gradient(135deg, #ECFDF3 0%, #FFFFFF 65%)' }}>
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-[14px] border bg-white" style={{ borderColor: '#ABEFC6', color: GREEN_D, boxShadow: XS }}>
                  <Trophy size={24} weight="fill" />
                </span>
                <div className="min-w-0">
                  <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[26px]" style={{ color: TEXT }}>
                    {idx >= queue.length ? 'Call list finished' : 'Session ended'}
                  </h2>
                  <p className="m-0 mt-1 text-[14.5px] leading-snug" style={{ color: MUTED }}>
                    {calls.length
                      ? `You made ${calls.length} ${calls.length === 1 ? 'call' : 'calls'}${endedAt && startedAt ? ` in ${durLong(Math.max(60_000, endedAt - startedAt))}` : ''} and spoke to ${connected} ${connected === 1 ? 'lead' : 'leads'}.`
                      : 'No calls were logged in this session.'}
                    {idx < queue.length && ` ${queue.length - idx} ${queue.length - idx === 1 ? 'lead was' : 'leads were'} left in the list.`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <LinkBtn href="/dashboard/lifecycle"><Kanban size={18} />Open Pipeline</LinkBtn>
                <Btn variant="primary" onClick={newSession}><PhoneCall size={18} weight="fill" />Start a new session</Btn>
              </div>
            </section>

            {failed.length > 0 && (
              <div className="mt-6">
                <Insight tone="red" icon={<Warning size={15} weight="bold" />}
                  title={`${failed.length} ${failed.length === 1 ? 'call was' : 'calls were'} not saved`}>
                  <span className="inline-flex flex-wrap items-center gap-x-2">
                    Retry before you start a new session, or the log for {failed.length === 1 ? 'it' : 'them'} is lost.
                    <button type="button" onClick={() => failed.forEach(f => retry(f.key))} className="cursor-pointer font-semibold underline" style={{ color: '#B42318' }}>Retry all</button>
                  </span>
                </Insight>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={<PhoneCall size={18} />} accent={BLUE} label="Calls made" value={calls.length}
                sub={log.length - calls.length ? `${log.length - calls.length} skipped` : 'None skipped'} />
              <StatCard icon={<CheckCircle size={18} />} accent={GREEN} label="Connected" value={connected}
                pill={calls.length ? <Pill tone="green" small>{pct(connected, calls.length)}%</Pill> : undefined} sub="Spoke to the lead" />
              <StatCard icon={<Timer size={18} />} accent="#B54708" label="Talk time" value={talkText(talk)}
                sub={connected ? `About ${clock(Math.round(talk / Math.max(1, connected)))} a conversation` : 'Timed calls only'} />
              <StatCard icon={<ClockClockwise size={18} />} accent="#5925DC" label="Callbacks" value={callbacks.length} sub="Saved as tasks" />
            </div>

            <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
              <Panel icon={<Lightning size={18} />} title="How the calls went">
                <StackBar parts={[
                  ...OUTCOMES.map(o => ({ label: o.label, value: log.filter(e => e.outcome === o.id).length, color: o.color })),
                  { label: SKIPPED.label, value: log.length - calls.length, color: SKIPPED.color },
                ]} />
                <ul className="m-0 mt-5 grid list-none grid-cols-[minmax(0,1fr)] gap-0 p-0">
                  {log.length === 0
                    ? <li className="text-[13.5px]" style={{ color: SUBTLE }}>Nothing logged.</li>
                    : log.map(e => <LogRow key={e.key} e={e} onRetry={() => retry(e.key)} />)}
                </ul>
              </Panel>
              <Panel icon={<ClockClockwise size={18} />} title="Callbacks to make" sub={callbacks.length ? 'Soonest first' : undefined}>
                {callbacks.length === 0 ? (
                  <p className="m-0 text-[13.5px]" style={{ color: SUBTLE }}>No callbacks booked in this session.</p>
                ) : (
                  <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2 p-0">
                    {[...callbacks].sort((a, b) => ms(a.callbackAt) - ms(b.callbackAt)).map(e => (
                      <li key={e.key} className="flex flex-wrap items-center gap-3 rounded-[12px] border px-3.5 py-3" style={{ borderColor: BORDER }}>
                        <span className="grid size-9 shrink-0 place-items-center rounded-[10px]" style={{ background: BLUE_BG, color: BLUE }}><ClockClockwise size={18} weight="bold" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{e.name}</div>
                          <div className="text-[13px]" style={{ color: SUBTLE }}>{e.callbackAt ? fmtWhen(e.callbackAt) : 'No time set'}</div>
                        </div>
                        <a href={telHref(e.phone)} className="text-[13.5px] font-semibold tabular-nums no-underline" style={{ color: BLUE }}>{formatPhone(e.phone)}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}

      <Dialog open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End this session?" width={440} icon={<SignOut size={20} />}
        sub={`${queue.length - idx} ${queue.length - idx === 1 ? 'lead is' : 'leads are'} still in the list. Calls you already logged stay saved.`}
        footer={<>
          <Btn onClick={() => setConfirmEnd(false)}>Keep calling</Btn>
          <Btn variant="danger" onClick={endSession}>End session</Btn>
        </>}>
        <p className="m-0 text-[14px] leading-relaxed" style={{ color: TEXT_2 }}>
          You&apos;ll see a summary with your callbacks. Start a new session any time to pick up the rest.
        </p>
      </Dialog>

      <Toast toast={toast} onClose={hide} />
    </div>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
function Kbd({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <kbd className="hidden h-5 min-w-5 items-center justify-center rounded-[5px] border px-1 font-sans text-[11px] font-semibold lg:inline-flex"
      style={dark
        ? { borderColor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.12)' }
        : { borderColor: BORDER_2, color: SUBTLE, background: SURFACE }}>
      {children}
    </kbd>
  )
}

function LinkBtn({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link href={href}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-3.5 text-[14px] font-semibold no-underline transition-[background,filter] hover:brightness-[0.98]"
      style={primary
        ? { background: BLUE, borderColor: BLUE, color: '#FFFFFF', boxShadow: '0 1px 2px rgba(16,24,40,0.05), inset 0 -2px 0 rgba(16,24,40,0.12)' }
        : { background: CANVAS, borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
      {children}
    </Link>
  )
}

function ListTile({ item, count, on, onClick }: { item: typeof LISTS[number]; count: number; on: boolean; onClick: () => void }) {
  const { Icon } = item
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="flex min-w-0 cursor-pointer flex-col gap-3 rounded-[16px] border bg-white p-3.5 text-left transition-[border-color,box-shadow] hover:border-[#B2CCFF] sm:p-4"
      style={on ? { borderColor: BLUE, boxShadow: '0 0 0 4px rgba(29,78,216,0.12)' } : { borderColor: BORDER, boxShadow: XS }}>
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-[10px]" style={{ background: item.bg, color: item.color }}><Icon size={18} weight="fill" /></span>
        <span className="grid size-5 place-items-center rounded-full border-[1.5px]" style={{ borderColor: on ? BLUE : BORDER_2, background: on ? BLUE : CANVAS }}>
          {on && <Check size={11} weight="bold" color="#FFFFFF" />}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold leading-tight" style={{ color: TEXT }}>{item.label}</div>
        <p className="m-0 mt-1 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>{item.desc}</p>
      </div>
      <div className="mt-auto flex items-baseline gap-1.5">
        <span className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: count ? TEXT : LABEL }}>{count}</span>
        <span className="text-[13px]" style={{ color: SUBTLE }}>{count === 1 ? 'lead' : 'leads'}</span>
      </div>
    </button>
  )
}

function QueueRow({ n, lead, reason, first, onRemove }: { n: number; lead: CRMLead; reason: { text: string }; first: boolean; onRemove: () => void }) {
  const name = displayName(lead)
  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${first ? '' : 'border-t'}`} style={{ borderColor: BORDER, background: first ? '#F5F8FF' : CANVAS }}>
      <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: first ? BLUE : LABEL }}>{n}</span>
      <LeadAvatar lead={lead} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{name}</span>
          <StagePill stage={stageOf(lead.status)} small />
          {first && <span className="hidden text-[12px] font-semibold sm:inline" style={{ color: BLUE }}>First up</span>}
        </div>
        <div className="truncate text-[12.5px]" style={{ color: SUBTLE }}>{reason.text}</div>
      </div>
      <span className="hidden shrink-0 text-[13px] tabular-nums md:block" style={{ color: TEXT_2 }}>{formatPhone(lead.phones?.primaryPhoneNumber)}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${name} from this session`} title="Remove from this session"
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] transition-colors hover:bg-[#F2F4F7]" style={{ color: LABEL }}>
        <X size={16} weight="bold" />
      </button>
    </li>
  )
}

function SessionSummary({ planned, list, order, noNumber, onStart }: {
  planned: CRMLead[]; list: ListId; order: OrderId; noNumber: number; onStart: () => void
}) {
  const avg = planned.length ? Math.round(planned.reduce((s, l) => s + (l.intentScore ?? 0), 0) / planned.length) : 0
  const L = listOf(list)
  return (
    <section className="rounded-[18px] border bg-white p-5" style={{ borderColor: BORDER, boxShadow: '0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)' }}>
      <div className="text-[12.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>Your session</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums" style={{ color: TEXT }}>{planned.length}</span>
        <span className="text-[15px]" style={{ color: SUBTLE }}>{planned.length === 1 ? 'call' : 'calls'} queued</span>
      </div>
      <dl className="m-0 mt-4 grid gap-2 text-[13.5px]">
        {[
          ['List', <span key="l" className="inline-flex items-center gap-1.5"><L.Icon size={14} weight="fill" color={L.color} />{L.label}</span>],
          ['Order', ORDERS.find(o => o.id === order)?.label],
          ['Average intent', planned.length ? avg : '–'],
        ].map(([k, v]) => (
          <div key={k as string} className="flex items-center justify-between gap-3">
            <dt style={{ color: SUBTLE }}>{k}</dt>
            <dd className="m-0 font-semibold tabular-nums" style={{ color: TEXT_2 }}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border-t pt-4" style={{ borderColor: BORDER }}>
        <div className="mb-2.5 text-[13px] font-semibold" style={{ color: TEXT_2 }}>Stage mix</div>
        <StackBar parts={OPEN.map(s => ({ label: STAGE[s].label, value: planned.filter(l => stageOf(l.status) === s).length, color: STAGE[s].dot }))} />
      </div>
      <Btn variant="call" size="lg" onClick={onStart} disabled={!planned.length} className="mt-5 w-full">
        <PhoneCall size={20} weight="fill" />Start calling
      </Btn>
      {noNumber > 0 && (
        <p className="m-0 mt-3 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>
          {noNumber} open {noNumber === 1 ? 'lead has' : 'leads have'} no valid mobile number and {noNumber === 1 ? 'is' : 'are'} left out.
        </p>
      )}
      <div className="mt-5 hidden border-t pt-4 xl:block" style={{ borderColor: BORDER }}>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: TEXT_2 }}><Keyboard size={16} />Keyboard friendly</div>
        <p className="m-0 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>
          C to call, 1 to 4 to pick how it went, Enter to save and move on. Your hands never leave the keys.
        </p>
      </div>
    </section>
  )
}

function SessionBar({ list, queue, idx, log, calls, connected, talk, callbacks, onEnd }: {
  list: ListId; queue: CRMLead[]; idx: number; log: LogEntry[]; calls: number; connected: number; talk: number; callbacks: number; onEnd: () => void
}) {
  const L = listOf(list)
  const byLead = new Map(log.map(e => [e.leadId, e]))
  const left = queue.length - idx - 1
  return (
    <section className="rounded-[18px] border bg-white p-4 sm:px-5" style={{ borderColor: BORDER, boxShadow: XS }}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px]" style={{ background: L.bg, color: L.color }}><L.Icon size={20} weight="fill" /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5 shrink-0"><span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: GREEN }} /><span className="relative size-2.5 rounded-full" style={{ background: GREEN }} /></span>
              <h1 className="m-0 truncate text-[17px] font-semibold sm:text-[19px]" style={{ color: TEXT }}>Calling {L.label}</h1>
            </div>
            <div className="text-[13px] tabular-nums" style={{ color: SUBTLE }}>Lead {idx + 1} of {queue.length}{left > 0 ? ` · ${left} to go after this` : ' · last one'}</div>
          </div>
        </div>
        <div className="order-last grid w-full grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-2.5 xl:order-none xl:flex xl:w-auto">
          <MiniStat label="Called" value={calls} />
          <MiniStat label="Connected" color={GREEN_D}
            value={<>{connected}{calls > 0 && <span className="ml-1 text-[12px] font-medium sm:hidden" style={{ color: SUBTLE }}>{pct(connected, calls)}%</span>}</>} />
          <MiniStat label="Rate" value={calls ? `${pct(connected, calls)}%` : '–'} className="hidden sm:block" />
          <MiniStat label="Talk time" value={talkText(talk)} className="hidden sm:block" />
          <MiniStat label="Callbacks" value={callbacks} color={BLUE} />
        </div>
        <Btn size="sm" onClick={onEnd} label="End session"><SignOut size={15} /><span className="hidden sm:inline">End session</span></Btn>
      </div>

      <div className={`mt-4 flex h-2 ${queue.length > 60 ? 'gap-px' : 'gap-[3px]'}`} role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={idx} aria-label="Session progress">
        {queue.map((l, i) => {
          const e = i < idx ? byLead.get(l.id) : undefined
          const color = i === idx ? BLUE : e ? (outcomeOf(e.outcome)?.color ?? SKIPPED.color) : '#EAECF0'
          return <span key={l.id} className="h-full min-w-0 flex-1 rounded-full" style={{ background: color }} title={e ? `${e.name}: ${outcomeOf(e.outcome)?.label ?? SKIPPED.label}` : undefined} />
        })}
      </div>
    </section>
  )
}

function MiniStat({ label, value, color = TEXT, className = '' }: { label: string; value: ReactNode; color?: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-[12px] border px-2.5 py-2 sm:px-3.5 xl:min-w-[92px] xl:py-1.5 ${className}`} style={{ background: SURFACE, borderColor: BORDER }}>
      <div className="truncate text-[11px] font-medium sm:text-[12.5px]" style={{ color: SUBTLE }}>{label}</div>
      <div className="mt-0.5 truncate text-[16px] font-semibold tracking-[-0.02em] tabular-nums sm:text-[20px]" style={{ color }}>{value}</div>
    </div>
  )
}

function LeadHead({ lead, n, total, copied, onCopy }: { lead: CRMLead; n: number; total: number; copied: string | null; onCopy: (t: string, k: string) => void }) {
  const cs = getCsId(lead)
  const src = sourceMeta(lead.sourcePortal)
  return (
    <div className="flex items-start gap-3 border-b px-4 py-5 sm:gap-4 sm:px-6" style={{ borderColor: BORDER, background: 'linear-gradient(180deg, #F5F8FF 0%, #FFFFFF 100%)' }}>
      <span className="flex sm:hidden"><LeadAvatar lead={lead} size={46} /></span>
      <span className="hidden sm:flex"><LeadAvatar lead={lead} size={56} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold tabular-nums" style={{ color: LABEL }}>Lead {n} of {total}</div>
        <h2 className="m-0 mt-0.5 break-words text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]" style={{ color: TEXT }}>{displayName(lead)}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StagePill stage={stageOf(lead.status)} />
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-[13px] font-medium" style={{ borderColor: BORDER, color: TEXT_2 }}>
            <SourceMark raw={lead.sourcePortal} size={16} />{src.label}
          </span>
          <button type="button" onClick={() => onCopy(cs, 'cs')} title="Copy CS ID"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-[12.5px] font-semibold tracking-[0.02em] transition-colors hover:bg-[#F9FAFB]"
            style={{ borderColor: BORDER, color: MUTED, fontFamily: MONO }}>
            {cs}{copied === 'cs' ? <Check size={12} weight="bold" color={GREEN_D} /> : <Copy size={12} color={LABEL} />}
          </button>
        </div>
      </div>
      <Link href={`/dashboard/leads/${lead.id}`} target="_blank" rel="noreferrer" aria-label="Open lead in a new tab" title="Open lead in a new tab"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border bg-white px-2.5 text-[13px] font-semibold no-underline transition-colors hover:bg-[#F9FAFB]"
        style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
        <span className="hidden sm:inline">Open lead</span><ArrowSquareOut size={15} />
      </Link>
    </div>
  )
}

function LeadFacts({ lead, now }: { lead: CRMLead; now: number }) {
  const nc = lead.failedContactAttempts ?? 0
  const where = [lead.localities?.filter(Boolean).slice(0, 2).join(', '), lead.city].filter(Boolean).join(', ')
  const facts: { k: string; v: ReactNode; muted?: boolean }[] = [
    { k: 'Budget',      v: budgetText(lead.budgetMin, lead.budgetMax) ?? 'Not shared' },
    { k: 'Looking for', v: lead.propertyType?.filter(Boolean).join(', ') || 'Not shared' },
    { k: 'Location',    v: where || 'Not shared' },
    { k: 'Timeline',    v: lead.timeline || 'Not shared' },
    { k: 'Last update', v: lead.updatedAt ? `${durLong(Math.max(0, now - ms(lead.updatedAt)))} ago` : '–' },
    { k: 'Unanswered calls', v: <span className="inline-flex items-center gap-2">{nc} of {NC_LIMIT}<NcMeter n={nc} /></span> },
  ]
  return (
    <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border sm:grid-cols-3" style={{ borderColor: BORDER, background: BORDER }}>
      {facts.map(f => {
        const empty = f.v === 'Not shared'
        return (
          <div key={f.k} className="min-w-0 bg-white px-3.5 py-3">
            <dt className="text-[12px] font-medium" style={{ color: SUBTLE }}>{f.k}</dt>
            <dd className="m-0 mt-0.5 break-words text-[14px] font-semibold leading-snug" style={{ color: empty ? LABEL : TEXT }}>{f.v}</dd>
          </div>
        )
      })}
    </dl>
  )
}

function NcMeter({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden>
      {Array.from({ length: NC_LIMIT }, (_, i) => (
        <span key={i} className="h-2 w-3 rounded-full" style={{ background: i < n ? (n >= NC_LIMIT - 1 ? RED : '#F79009') : '#E4E7EC' }} />
      ))}
    </span>
  )
}

function OutcomeTile({ o, n, on, onClick }: { o: typeof OUTCOMES[number]; n: number; on: boolean; onClick: () => void }) {
  const t = TONE[o.tone]
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className="flex min-h-[96px] min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-[14px] border p-3 text-left transition-[border-color,box-shadow,background]"
      style={on ? { borderColor: o.color, background: t.bg, boxShadow: `0 0 0 3px ${t.border}` } : { borderColor: BORDER, background: CANVAS, boxShadow: XS }}>
      <span className="flex w-full items-center justify-between">
        <span className="grid size-8 place-items-center rounded-full" style={{ background: on ? CANVAS : t.bg, color: t.color }}><o.Icon size={17} weight="fill" /></span>
        <Kbd>{n}</Kbd>
      </span>
      <span className="text-[14px] font-semibold leading-tight" style={{ color: on ? t.color : TEXT }}>{o.label}</span>
      <span className="text-[12px] leading-snug" style={{ color: SUBTLE }}>{o.hint}</span>
    </button>
  )
}

function LogRow({ e, onRetry }: { e: LogEntry; onRetry: () => void }) {
  const o = outcomeOf(e.outcome)
  const tone: Tone = o?.tone ?? 'neutral'
  return (
    <li className="flex items-start gap-3 border-t py-2.5 first:border-t-0 first:pt-0" style={{ borderColor: BORDER }}>
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full" style={{ background: TONE[tone].bg, color: TONE[tone].color }}>
        {o ? <o.Icon size={14} weight="fill" /> : <SkipForward size={14} weight="fill" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-[13.5px] font-semibold" style={{ color: TEXT }}>{e.name}</span>
          <span className="text-[12.5px]" style={{ color: TONE[tone].color }}>{o?.label ?? SKIPPED.label}</span>
          {e.duration > 0 && <span className="text-[12.5px] tabular-nums" style={{ color: LABEL }}>{clock(e.duration)}</span>}
        </div>
        {e.outcome !== 'skipped' && (
          <div className="mt-0.5 text-[12.5px] leading-snug">
            {e.save === 'saving' && <span className="inline-flex items-center gap-1" style={{ color: SUBTLE }}><CircleNotch size={12} className="animate-spin" />Saving</span>}
            {e.save === 'saved' && <span className="inline-flex items-center gap-1" style={{ color: GREEN_D }}><Check size={12} weight="bold" />{e.result ?? 'Saved'}</span>}
            {e.save === 'failed' && (
              <span className="inline-flex flex-wrap items-center gap-x-2" style={{ color: '#B42318' }}>
                Not saved{e.error ? `: ${e.error}` : ''}
                <button type="button" onClick={onRetry} className="cursor-pointer font-semibold underline" style={{ color: '#B42318' }}>Retry</button>
              </span>
            )}
          </div>
        )}
        {e.note && <div className="mt-0.5 truncate text-[12.5px]" style={{ color: SUBTLE }}>{e.note}</div>}
      </div>
    </li>
  )
}

function Shortcuts() {
  const rows: [string, string][] = [['C', 'Call'], ['S', 'Skip'], ['L', 'Log without calling'], ['E', 'End call'], ['N', 'No answer'], ['1–4', 'Pick how it went'], ['Enter', 'Save and next']]
  return (
    <div className="hidden rounded-[16px] border px-5 py-4 xl:block" style={{ borderColor: BORDER, background: SURFACE }}>
      <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: TEXT_2 }}><Keyboard size={16} />Shortcuts</div>
      <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt><kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border bg-white px-1 font-sans text-[11px] font-semibold" style={{ borderColor: BORDER_2, color: TEXT_2 }}>{k}</kbd></dt>
            <dd className="m-0 text-[12.5px]" style={{ color: SUBTLE }}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
