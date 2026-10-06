'use client'

// AI Workflows: the AI watches the pipeline, WhatsApp replies and call notes and
// lines up the next move for each lead. Nothing changes until the agent taps
// Apply, and every applied change can be undone from the log on this page.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Lightning, WhatsappLogo, PhoneCall, ShieldCheck, Sparkle, ArrowClockwise, CalendarPlus, CalendarCheck,
  TrendUp, Prohibit, CurrencyInr, NotePencil, X, Phone, ArrowUpRight, Check, ArrowCounterClockwise,
  Warning, ClockCounterClockwise, Checks, type Icon,
} from '@phosphor-icons/react'
import type { CRMLead } from '@/lib/twenty'
import type { WorkflowRead } from '@/app/api/ai/workflows/route'
import { PageTabBar } from '@/components/layout/PageTabBar'
import {
  BORDER, TEXT, TEXT_2, MUTED, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, GREEN_D, DAY,
  STAGE, stageOf, displayName, getCsId, telHref, waHref, budgetText, Avatar, StagePill, Toggle, Chip,
  type StageId,
} from '@/components/outreach/OutreachKit'

const ADVISOR_TABS = [
  { label: 'AI Chat',   href: '/dashboard/advisor' },
  { label: 'Workflows', href: '/dashboard/advisor/workflows' },
]

const PREFS_KEY  = 'ai_workflows_prefs_v1'
const READS_KEY  = 'ai_workflows_reads_v1'   // what the AI made of each reply or call note
const DONE_KEY   = 'ai_workflows_done_v1'    // suggestions applied or dismissed
const LOG_KEY    = 'ai_workflows_log_v1'
const READ_DAYS  = 14
const MAX_READS  = 16
const BATCH      = 8
const SHOW_FIRST = 8

const BRAND   = 'linear-gradient(135deg, #1D4ED8 0%, #4F46E5 55%, #2563EB 100%)'
const RING_ON = 'linear-gradient(120deg, #6E9BFF 0%, #7C83F5 45%, #A78BFA 72%, #5B8DEF 100%)'
const SOFT    = '#F7F8FB'

// ─── Types ────────────────────────────────────────────────────────────────────
type FlowId = 'coach' | 'whatsapp' | 'calls'
type Act  = { id: string; personId: string | null; type: string; notes: string | null; outcome: string | null; createdAt: string }
type Task = { id: string; lead_id: string; title: string; task_type: string | null; due_date: string; status: string }
type Loaded = { leads: CRMLead[]; total: number; acts: Act[]; tasks: Task[]; at: number }
type Prefs = Record<FlowId, boolean>
type Empty = { id: string; empty: true; at: string }
type ReadMap = Record<string, WorkflowRead | Empty>

type LeadLite = { id: string; name: string; first: string; phone: string; status: StageId; csId: string; budgetMin: number | null; budgetMax: number | null; score: number | null }
type Change =
  | { kind: 'task'; title: string; taskType: string; due: string; why?: string }
  | { kind: 'move'; taskId: string; title: string; from: string; due: string }
  | { kind: 'stage'; from: StageId; to: StageId; why?: string }
  | { kind: 'budget'; from: [number | null, number | null]; to: [number | null, number | null]; why?: string }
  | { kind: 'note'; text: string }
type Suggestion = {
  key: string
  flow: FlowId
  rank: number
  lead: LeadLite
  at: number
  title: string
  detail: string
  quote?: string
  signals?: string[]
  changes: Change[]
  draft: string
}
type Undo =
  | { kind: 'task'; leadId: string; taskId: string }
  | { kind: 'due'; leadId: string; taskId: string; due: string }
  | { kind: 'stage'; leadId: string; to: StageId }
  | { kind: 'budget'; leadId: string; min: number | null; max: number | null }
type LogEntry = { id: string; at: number; flow: FlowId; key: string; kind: Change['kind']; leadId: string; leadName: string; text: string; undo?: Undo; undone?: boolean }
type Notice = { text: string; tone: 'ok' | 'err'; action?: { label: string; run: () => void } }

const FLOWS: Record<FlowId, { name: string; Icon: Icon; color: string; tint: string; desc: string; watches: string }> = {
  coach: {
    name: 'Deal Coach', Icon: Lightning, color: '#B54708', tint: '#FEF6EE',
    desc: 'Spots leads slipping away and lines up the follow-up.',
    watches: 'Missed calls with no call-back, overdue follow-ups, new leads not called yet, Hot and Warm leads gone quiet',
  },
  whatsapp: {
    name: 'WhatsApp replies', Icon: WhatsappLogo, color: GREEN_D, tint: '#ECFDF3',
    desc: 'Reads what leads reply and suggests the stage, follow-up or budget it points to.',
    watches: 'Confirmed budget, wants a site visit, not interested, "call me tomorrow at 5"',
  },
  calls: {
    name: 'Call notes', Icon: PhoneCall, color: '#026AA2', tint: '#F0F9FF',
    desc: 'Turns your call notes into a short summary and the follow-ups you agreed on.',
    watches: 'Calls you log with notes, call-back times, next steps agreed',
  },
}
const FLOW_IDS: FlowId[] = ['coach', 'whatsapp', 'calls']

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
function readLS<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback } catch { return fallback }
}
function writeLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}
const isEmpty = (r: WorkflowRead | Empty): r is Empty => 'empty' in r

function ago(ms: number, now: number) {
  const m = Math.max(0, Math.round((now - ms) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
const time12 = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).replace(' ', ' ').toLowerCase()
function when(iso: string, now: number) {
  const d = new Date(iso)
  const day = (x: number) => new Date(x).toDateString()
  if (day(d.getTime()) === day(now)) return `today, ${time12(d)}`
  if (day(d.getTime()) === day(now + DAY)) return `tomorrow, ${time12(d)}`
  if (day(d.getTime()) === day(now - DAY)) return `yesterday, ${time12(d)}`
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time12(d)}`
}
/** Today at 5 pm while there's time, otherwise tomorrow at 11 am */
function nextSlot(now: number) {
  const d = new Date(now)
  if (d.getHours() < 16) { d.setHours(17, 0, 0, 0); return d.toISOString() }
  return tomorrow11(now)
}
function tomorrow11(now: number) {
  const d = new Date(now + DAY)
  d.setHours(11, 0, 0, 0)
  return d.toISOString()
}
const startOfDay = (now: number) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() }
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function lite(l: CRMLead): LeadLite {
  return {
    id: l.id, name: displayName(l), first: l.name?.firstName?.trim() || displayName(l),
    phone: l.phones?.primaryPhoneNumber ?? '', status: stageOf(l.status), csId: getCsId(l),
    budgetMin: l.budgetMin ?? null, budgetMax: l.budgetMax ?? null, score: l.intentScore ?? null,
  }
}
function liteFromRead(r: WorkflowRead): LeadLite {
  const first = r.lead.name.trim().split(/\s+/)[0] || 'the lead'
  return { id: r.lead.id, name: r.lead.name || 'Unnamed', first, phone: r.lead.phone, status: stageOf(r.lead.status), csId: r.lead.csId, budgetMin: r.lead.budgetMin, budgetMax: r.lead.budgetMax, score: null }
}

async function jfetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const j = await res.json().catch(() => null)
  if (!res.ok || j?.error) throw new Error(j?.error || `Request failed (${res.status})`)
  return j
}

// ─── Loading ──────────────────────────────────────────────────────────────────
async function loadAll(): Promise<Loaded> {
  const since = new Date(Date.now() - 30 * DAY).toISOString()
  const leadsQ = (q: string) => fetch(`/api/crm/leads?limit=200${q}`).then(r => r.json())
  const [all, hot, warm, acts, tasks] = await Promise.all([
    leadsQ(''),
    // Hot and Warm leads are always watched, even when they're older than the newest 200
    leadsQ('&status=Hot').catch(() => null),
    leadsQ('&status=Warm').catch(() => null),
    fetch(`/api/crm/activities?since=${encodeURIComponent(since)}&limit=1000`).then(r => r.json()).catch(() => null),
    fetch('/api/crm/tasks?status=Pending').then(r => (r.ok ? r.json() : null)).catch(() => null),
  ])
  const base = all?.data?.leads
  if (!Array.isArray(base)) throw new Error(all?.error || 'Could not load your leads')
  const byId = new Map<string, CRMLead>()
  for (const l of [...base, ...(hot?.data?.leads ?? []), ...(warm?.data?.leads ?? [])] as CRMLead[]) byId.set(l.id, l)
  const own = new Set(byId.keys())
  return {
    leads: [...byId.values()],
    total: Number(all.data.totalCount) || byId.size,
    acts: Array.isArray(acts?.data?.activities) ? acts.data.activities : [],
    // /api/crm/tasks isn't scoped to the agent, so keep only tasks on their own leads
    tasks: (Array.isArray(tasks?.tasks) ? (tasks.tasks as Task[]) : []).filter(t => own.has(t.lead_id) && t.status === 'Pending'),
    at: Date.now(),
  }
}

const AUTO_NOTE = /^(answered|no answer|busy|failed|cancelled)\s*·/i
const NO_ANSWER = /no (response|answer)|busy|not reachable|switched off|unreachable|failed/i
const CALL_TYPES = new Set(['Call Made', 'Call Missed'])

/** Replies and call notes the AI hasn't read yet, newest first */
function unread(d: Loaded, reads: ReadMap, prefs: Prefs) {
  const cutoff = d.at - READ_DAYS * DAY
  return d.acts.filter(a => {
    if (reads[a.id] || !a.personId || new Date(a.createdAt).getTime() < cutoff) return false
    const notes = a.notes?.trim() ?? ''
    if (a.type === 'WhatsApp Received') return prefs.whatsapp && notes.length > 0
    if (a.type === 'Call Made') return prefs.calls && notes.length >= 12 && !AUTO_NOTE.test(notes) && !NO_ANSWER.test(a.outcome ?? '')
    return false
  }).slice(0, MAX_READS)
}

// ─── Deal Coach rules ─────────────────────────────────────────────────────────
// Only the leads with money close to the table count as quiet, so the list stays short
const QUIET_AFTER: Partial<Record<StageId, number>> = { Hot: 3, Warm: 5 }
const STAGE_RANK: Partial<Record<StageId, number>> = { Hot: 0, Warm: 1, New: 2, Cold: 3 }
const TOUCH: Record<string, string> = {
  'Call Made': 'call', 'Call Missed': 'missed call', 'WhatsApp Sent': 'WhatsApp sent', 'WhatsApp Received': 'WhatsApp reply',
  'Email Sent': 'email sent', 'Email Received': 'email reply', 'Site Visit Done': 'site visit', 'Site Visit Scheduled': 'site visit booked',
  'VM Done': 'virtual meeting', 'OBM Done': 'office meeting', 'Note': 'note', 'Follow Up Set': 'follow-up set', 'Status Changed': 'stage change',
}

function coach(d: Loaded): Suggestion[] {
  const now = d.at
  const actsBy = new Map<string, Act[]>()
  for (const a of d.acts) if (a.personId) actsBy.set(a.personId, [...(actsBy.get(a.personId) ?? []), a])
  const tasksBy = new Map<string, Task[]>()
  for (const t of d.tasks) tasksBy.set(t.lead_id, [...(tasksBy.get(t.lead_id) ?? []), t])
  const today = startOfDay(now)
  const out: Suggestion[] = []

  for (const l of d.leads) {
    const stage = stageOf(l.status)
    if (STAGE_RANK[stage] == null) continue
    const lead = lite(l)
    const acts = (actsBy.get(l.id) ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const tasks = tasksBy.get(l.id) ?? []
    const last = acts[0]
    const base = (STAGE_RANK[stage] ?? 3) * 10 - Math.min(9, Math.floor((l.intentScore ?? 0) / 12))

    const overdue = tasks.filter(t => new Date(t.due_date).getTime() < today).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
    if (overdue) {
      const late = Math.max(1, Math.round((today - new Date(overdue.due_date).getTime()) / DAY))
      out.push({
        key: `overdue:${overdue.id}:${overdue.due_date}`, flow: 'coach', rank: base - 6, lead, at: new Date(overdue.due_date).getTime(),
        title: `Follow-up overdue by ${plural(late, 'day')}`,
        detail: `“${overdue.title}” was due ${when(overdue.due_date, now)} and is still open.`,
        changes: [{ kind: 'move', taskId: overdue.id, title: overdue.title, from: overdue.due_date, due: tomorrow11(now) }],
        draft: `Write a short WhatsApp to ${lead.name} (${lead.csId}). I owe them a follow-up: "${overdue.title}". Keep it warm and suggest a time to talk.`,
      })
      continue
    }
    if (tasks.length) continue // a follow-up is already planned

    const sinceLast = last ? now - new Date(last.createdAt).getTime() : Infinity
    if (last && CALL_TYPES.has(last.type) && NO_ANSWER.test(`${last.outcome ?? ''} ${last.type === 'Call Missed' ? 'no answer' : ''}`)
        && sinceLast > 2 * 3_600_000 && sinceLast < 7 * DAY) {
      out.push({
        key: `missed:${last.id}`, flow: 'coach', rank: base - 5, lead, at: new Date(last.createdAt).getTime(),
        title: 'Missed call, no call-back set',
        detail: `You called ${when(last.createdAt, now)} and couldn't get through. Nothing is scheduled to try again.`,
        changes: [{ kind: 'task', title: `Call ${lead.first} back`, taskType: 'Call Back', due: nextSlot(now) }],
        draft: `Write a short WhatsApp to ${lead.name} (${lead.csId}): I tried calling and couldn't get through. Ask for a good time to talk.`,
      })
      continue
    }

    if (stage === 'New' && !acts.length) {
      const age = now - new Date(l.createdAt).getTime()
      if (age < 3_600_000 || age > 3 * DAY) continue
      out.push({
        key: `fresh:${l.id}`, flow: 'coach', rank: base - 4, lead, at: new Date(l.createdAt).getTime(),
        title: 'New lead, not contacted yet',
        detail: `Added ${ago(new Date(l.createdAt).getTime(), now)}${l.sourcePortal ? ` from ${l.sourcePortal}` : ''}. No call or message logged so far.`,
        changes: [{ kind: 'task', title: `First call to ${lead.first}`, taskType: 'Call Back', due: nextSlot(now) }],
        draft: `Write a first WhatsApp to ${lead.name} (${lead.csId}), a new enquiry. Introduce me and ask when they're free for a quick call.`,
      })
      continue
    }

    const lastAt = Math.max(last ? new Date(last.createdAt).getTime() : 0, new Date(l.createdAt).getTime())
    const quiet = Math.floor((now - lastAt) / DAY)
    const after = QUIET_AFTER[stage]
    if (after != null && quiet >= after) {
      const span = !last && quiet >= 30 ? '30+ days' : plural(quiet, 'day')
      out.push({
        key: `quiet:${l.id}:${last?.id ?? l.createdAt}`, flow: 'coach', rank: base, lead, at: lastAt,
        title: `${STAGE[stage].label} lead quiet for ${span}`,
        detail: last ? `Last touch: ${TOUCH[last.type] ?? last.type.toLowerCase()} (${when(last.createdAt, now)}). No follow-up is planned.` : 'No activity in the last 30 days and no follow-up planned.',
        changes: [{ kind: 'task', title: `Follow up with ${lead.first}`, taskType: 'Follow Up', due: nextSlot(now) }],
        draft: `Write a short WhatsApp to restart the conversation with ${lead.name} (${lead.csId}). We last spoke ${quiet} days ago.`,
      })
    }
  }
  return out
}

// ─── Suggestions from the AI's reads ──────────────────────────────────────────
function fromReads(d: Loaded, reads: ReadMap, prefs: Prefs): Suggestion[] {
  const byId = new Map(d.leads.map(l => [l.id, l]))
  const out: Suggestion[] = []
  for (const r of Object.values(reads)) {
    if (isEmpty(r)) continue
    const flow: FlowId = r.kind === 'whatsapp' ? 'whatsapp' : 'calls'
    if (!prefs[flow] || d.at - new Date(r.at).getTime() > READ_DAYS * DAY) continue
    const known = byId.get(r.lead.id)
    const lead = known ? lite(known) : liteFromRead(r)
    const changes: Change[] = []
    const terminal = lead.status === 'Closed' || lead.status === 'Disqualified'
    if (r.stage && !terminal && r.stage.to !== lead.status) changes.push({ kind: 'stage', from: lead.status, to: stageOf(r.stage.to), why: r.stage.why })
    if (r.task) changes.push({ kind: 'task', title: r.task.title, taskType: r.task.type, due: r.task.due, why: r.task.why })
    if (r.budget && (r.budget.min !== lead.budgetMin || r.budget.max !== lead.budgetMax)) {
      changes.push({ kind: 'budget', from: [lead.budgetMin, lead.budgetMax], to: [r.budget.min ?? lead.budgetMin, r.budget.max ?? lead.budgetMax], why: r.budget.why })
    }
    if (flow === 'calls' && r.summary) changes.push({ kind: 'note', text: r.summary })
    if (!changes.length || (flow === 'calls' && changes.length === 1)) continue

    const rank = (STAGE_RANK[lead.status] ?? 3) * 10 - (r.stage?.to === 'Hot' ? 12 : 8)
    out.push({
      key: `${flow}:${r.id}`, flow, rank, lead, at: new Date(r.at).getTime(),
      title: flow === 'whatsapp' ? `${lead.first} replied on WhatsApp` : `Call notes with ${lead.first}`,
      detail: r.summary, quote: r.text, signals: r.signals, changes,
      draft: flow === 'whatsapp'
        ? `Write my WhatsApp reply to ${lead.name} (${lead.csId}). They wrote: "${r.text.slice(0, 300)}"`
        : `Write a WhatsApp to ${lead.name} (${lead.csId}) confirming what we agreed on our call: ${r.summary}`,
    })
  }
  return out
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
  const [data, setData]           = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [prefs, setPrefs]         = useState<Prefs>({ coach: true, whatsapp: true, calls: true })
  const [reads, setReads]         = useState<ReadMap>({})
  const [done, setDone]           = useState<Record<string, number>>({})
  const [log, setLog]             = useState<LogEntry[]>([])
  const [reading, setReading]     = useState<{ whatsapp: number; calls: number } | null>(null)
  const [aiError, setAiError]     = useState<string | null>(null)
  const [filter, setFilter]       = useState<FlowId | 'all'>('all')
  const [showAll, setShowAll]     = useState(false)
  const [busy, setBusy]           = useState<string | null>(null)
  const [notice, setNotice]       = useState<Notice | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const hydrated = useRef(false)
  const noticeT  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flash = useCallback((n: Notice) => {
    if (noticeT.current) clearTimeout(noticeT.current)
    setNotice(n)
    noticeT.current = setTimeout(() => setNotice(null), 6000)
  }, [])

  /** Sends new replies and call notes to the AI, a few at a time */
  const readNew = useCallback(async (d: Loaded) => {
    const p = readLS<Prefs>(PREFS_KEY, { coach: true, whatsapp: true, calls: true })
    let cache = readLS<ReadMap>(READS_KEY, {})
    const todo = unread(d, cache, p)
    if (!todo.length) return
    setAiError(null)
    setReading({ whatsapp: todo.filter(a => a.type === 'WhatsApp Received').length, calls: todo.filter(a => a.type === 'Call Made').length })
    try {
      for (let i = 0; i < todo.length; i += BATCH) {
        const ids = todo.slice(i, i + BATCH).map(a => a.id)
        const j = await jfetch('/api/ai/workflows', 'POST', { ids })
        const got: WorkflowRead[] = j?.data?.reads ?? []
        const next: ReadMap = { ...readLS<ReadMap>(READS_KEY, {}) }
        for (const id of ids) {
          const r = got.find(x => x.id === id)
          next[id] = r ?? { id, empty: true, at: todo.find(a => a.id === id)!.createdAt }
        }
        // Keep the newest reads only
        cache = Object.fromEntries(Object.entries(next).sort(([, a], [, b]) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 200))
        writeLS(READS_KEY, cache)
        setReads(cache)
      }
    } catch (e) {
      setAiError(e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'No connection. Check your internet and try again.')
    } finally {
      setReading(null)
    }
  }, [])

  const load = useCallback((manual?: boolean) => {
    if (manual) setRefreshing(true)
    return loadAll()
      .then(d => { setData(d); setLoadError(null); return readNew(d) })
      .catch((e: Error) => setLoadError(e.message || 'Could not load your leads'))
      .finally(() => setRefreshing(false))
  }, [readNew])

  useEffect(() => {
    Promise.resolve().then(() => {
      hydrated.current = true
      setPrefs(readLS<Prefs>(PREFS_KEY, { coach: true, whatsapp: true, calls: true }))
      setReads(readLS<ReadMap>(READS_KEY, {}))
      const fresh = Date.now() - 60 * DAY
      setDone(Object.fromEntries(Object.entries(readLS<Record<string, number>>(DONE_KEY, {})).filter(([, at]) => at > fresh)))
      setLog(readLS<LogEntry[]>(LOG_KEY, []))
    }).then(() => load())
    return () => { if (noticeT.current) clearTimeout(noticeT.current) }
  }, [load])
  useEffect(() => { if (hydrated.current) writeLS(PREFS_KEY, prefs) }, [prefs])
  useEffect(() => { if (hydrated.current) writeLS(DONE_KEY, done) }, [done])
  useEffect(() => { if (hydrated.current) writeLS(LOG_KEY, log.slice(0, 60)) }, [log])

  const now = data?.at ?? 0
  const all = useMemo(() => {
    if (!data) return []
    // After an undo the suggestion comes back, minus the parts that are still applied
    const kept = new Map<string, Set<string>>()
    for (const e of log) if (!e.undone) kept.set(e.key, (kept.get(e.key) ?? new Set()).add(e.kind))
    const list = [...(prefs.coach ? coach(data) : []), ...fromReads(data, reads, prefs)]
      .filter(s => !done[s.key])
      .map(s => (kept.has(s.key) ? { ...s, changes: s.changes.filter(c => !kept.get(s.key)!.has(c.kind)) } : s))
      .filter(s => s.changes.length)
    return list.sort((a, b) => a.rank - b.rank || b.at - a.at)
  }, [data, reads, prefs, done, log])
  const counts = useMemo(() => {
    const c: Record<FlowId, number> = { coach: 0, whatsapp: 0, calls: 0 }
    for (const s of all) c[s.flow]++
    return c
  }, [all])
  // Replies and call notes get full cards; Deal Coach nudges sit in a compact list under them
  const readsShown = all.filter(s => s.flow !== 'coach' && (filter === 'all' || s.flow === filter))
  const coachShown = filter === 'all' || filter === 'coach' ? all.filter(s => s.flow === 'coach') : []
  const coachVisible = showAll ? coachShown : coachShown.slice(0, SHOW_FIRST)

  const applied7 = useMemo(() => {
    const c: Record<FlowId, number> = { coach: 0, whatsapp: 0, calls: 0 }
    for (const e of log) if (!e.undone && now - e.at < 7 * DAY) c[e.flow]++
    return c
  }, [log, now])
  const replies = data?.acts.filter(a => a.type === 'WhatsApp Received').length ?? 0
  const notes = data?.acts.filter(a => a.type === 'Call Made' && (a.notes?.trim().length ?? 0) >= 12 && !AUTO_NOTE.test(a.notes ?? '')).length ?? 0

  // ── Applying ────────────────────────────────────────────────────────────────
  const patchLead = (id: string, fn: (l: CRMLead) => CRMLead) =>
    setData(d => (d ? { ...d, leads: d.leads.map(l => (l.id === id ? fn(l) : l)) } : d))

  const applyOne = useCallback(async (s: Suggestion, c: Change): Promise<{ text: string; undo?: Undo }> => {
    const id = s.lead.id
    if (c.kind === 'task') {
      const j = await jfetch(`/api/crm/leads/${id}/tasks`, 'POST', {
        title: c.title, task_type: c.taskType, due_date: c.due, priority: s.lead.status === 'Hot' ? 'High' : 'Medium',
        notes: `Suggested by AI Workflows: ${s.title}`,
      })
      const task = j?.task as Task | undefined
      if (task?.id) setData(d => (d ? { ...d, tasks: [...d.tasks, { ...task, status: 'Pending' }] } : d))
      return { text: `Added “${c.title}” for ${when(c.due, now)}`, undo: task?.id ? { kind: 'task', leadId: id, taskId: task.id } : undefined }
    }
    if (c.kind === 'move') {
      await jfetch(`/api/crm/leads/${id}/tasks/${c.taskId}`, 'PATCH', { due_date: c.due })
      setData(d => (d ? { ...d, tasks: d.tasks.map(t => (t.id === c.taskId ? { ...t, due_date: c.due } : t)) } : d))
      return { text: `Moved “${c.title}” to ${when(c.due, now)}`, undo: { kind: 'due', leadId: id, taskId: c.taskId, due: c.from } }
    }
    if (c.kind === 'stage') {
      await jfetch(`/api/crm/leads/${id}`, 'PATCH', { status: c.to })
      // On the lead's timeline too, with the reason
      jfetch(`/api/crm/leads/${id}/activities`, 'POST', {
        type: 'Status Changed', reason: `AI Workflows: ${c.why || s.title}`, notes: `Moved from ${STAGE[c.from].label} to ${STAGE[c.to].label}`,
      }).catch(() => {})
      patchLead(id, l => ({ ...l, status: c.to }))
      return { text: `Moved to ${STAGE[c.to].label}`, undo: { kind: 'stage', leadId: id, to: c.from } }
    }
    if (c.kind === 'budget') {
      await jfetch(`/api/crm/leads/${id}`, 'PATCH', { budgetMin: c.to[0], budgetMax: c.to[1] })
      patchLead(id, l => ({ ...l, budgetMin: c.to[0], budgetMax: c.to[1] }))
      return { text: `Budget set to ${budgetText(c.to[0], c.to[1]) ?? 'not set'}`, undo: { kind: 'budget', leadId: id, min: c.from[0], max: c.from[1] } }
    }
    await jfetch(`/api/crm/leads/${id}/activities`, 'POST', { type: 'Note', notes: `Call summary (AI): ${c.text}` })
    return { text: 'Saved the call summary to the timeline' }
  }, [now])

  const apply = useCallback(async (s: Suggestion, changes: Change[], quiet?: boolean) => {
    if (!changes.length) return false
    setBusy(s.key)
    const entries: LogEntry[] = []
    let failed: string | null = null
    for (const c of changes) {
      try {
        const r = await applyOne(s, c)
        entries.push({ id: genId(), at: Date.now(), flow: s.flow, key: s.key, kind: c.kind, leadId: s.lead.id, leadName: s.lead.name, ...r })
      } catch (e) {
        failed = e instanceof Error ? e.message : 'Something went wrong'
        break
      }
    }
    setBusy(null)
    if (entries.length) {
      const newest = [...entries].reverse()
      setLog(p => [...newest, ...p].slice(0, 60))
      setDone(p => ({ ...p, [s.key]: Date.now() }))
    }
    if (!quiet) {
      if (failed) flash({ text: entries.length ? `Applied ${entries.length} of ${changes.length}. ${failed}` : `Couldn't apply: ${failed}`, tone: 'err' })
      else flash({ text: `Done for ${s.lead.first}: ${entries.map(e => e.text.charAt(0).toLowerCase() + e.text.slice(1)).join(', ')}`, tone: 'ok', action: entries.some(e => e.undo) ? { label: 'Undo', run: () => entries.forEach(e => undoRef.current(e)) } : undefined })
    }
    return !failed
  }, [applyOne, flash])

  const applyAll = async () => {
    const list = coachShown.slice(0, 20)
    let ok = 0
    for (const s of list) if (await apply(s, s.changes, true)) ok++
    flash(ok === list.length
      ? { text: `Lined up ${plural(ok, 'follow-up')}. Each one shows on your Today page when it's due.`, tone: 'ok' }
      : { text: `Lined up ${ok} of ${list.length}. Some couldn't be saved, try again.`, tone: 'err' })
  }

  const undo = useCallback(async (e: LogEntry) => {
    const u = e.undo
    if (!u || e.undone) return
    try {
      if (u.kind === 'task') {
        await jfetch(`/api/crm/leads/${u.leadId}/tasks/${u.taskId}`, 'PATCH', { status: 'Cancelled' })
        setData(d => (d ? { ...d, tasks: d.tasks.filter(t => t.id !== u.taskId) } : d))
      } else if (u.kind === 'due') {
        await jfetch(`/api/crm/leads/${u.leadId}/tasks/${u.taskId}`, 'PATCH', { due_date: u.due })
        setData(d => (d ? { ...d, tasks: d.tasks.map(t => (t.id === u.taskId ? { ...t, due_date: u.due } : t)) } : d))
      } else if (u.kind === 'stage') {
        await jfetch(`/api/crm/leads/${u.leadId}`, 'PATCH', { status: u.to })
        jfetch(`/api/crm/leads/${u.leadId}/activities`, 'POST', { type: 'Status Changed', reason: 'AI Workflows: change undone', notes: `Moved back to ${STAGE[u.to].label}` }).catch(() => {})
        patchLead(u.leadId, l => ({ ...l, status: u.to }))
      } else {
        await jfetch(`/api/crm/leads/${u.leadId}`, 'PATCH', { budgetMin: u.min, budgetMax: u.max })
        patchLead(u.leadId, l => ({ ...l, budgetMin: u.min, budgetMax: u.max }))
      }
      setLog(p => p.map(x => (x.id === e.id ? { ...x, undone: true } : x)))
      setDone(p => { const n = { ...p }; delete n[e.key]; return n })
      flash({ text: `Undone: ${e.text.charAt(0).toLowerCase()}${e.text.slice(1)}`, tone: 'ok' })
    } catch (err) {
      flash({ text: `Couldn't undo: ${err instanceof Error ? err.message : 'try again'}`, tone: 'err' })
    }
  }, [flash])
  const undoRef = useRef(undo)
  useEffect(() => { undoRef.current = undo }, [undo])

  const dismiss = (s: Suggestion) => {
    setDone(p => ({ ...p, [s.key]: Date.now() }))
    flash({ text: `Hidden for ${s.lead.first}. It comes back if something changes.`, tone: 'ok', action: { label: 'Show again', run: () => setDone(p => { const n = { ...p }; delete n[s.key]; return n }) } })
  }

  const setFlow = (id: FlowId, on: boolean) => {
    setPrefs(p => ({ ...p, [id]: on }))
    if (!on && filter === id) setFilter('all')
    if (on && data && id !== 'coach') Promise.resolve().then(() => readNew(data))
  }

  const loading = !data && !loadError
  const total = all.length

  return (
    <div className="flex min-h-[calc(100dvh-56px-64px)] flex-col bg-white lg:min-h-[calc(100dvh-56px)]" style={{ color: TEXT }}>
      <PageTabBar tabs={ADVISOR_TABS} />

      {/* ── Title ──────────────────────────────────────────────────────────── */}
      <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] sm:text-[24px]">
            AI <em className="bg-clip-text pr-1 font-semibold text-transparent" style={{ backgroundImage: BRAND }}>Workflows</em>
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px]" style={{ color: SUBTLE }}>
            <span className={`size-1.5 shrink-0 rounded-full ${data ? 'bg-[#17B26A]' : loadError ? 'bg-[#F04438]' : 'bg-[#D0D5DD]'}`} />
            {data ? `Watching ${data.total.toLocaleString('en-IN')} leads · checked ${ago(data.at, data.at)}` : loadError ? 'Lead data unavailable' : 'Checking your leads…'}
          </p>
        </div>
        <button type="button" onClick={() => load(true)} disabled={refreshing || loading}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.55)] transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-70"
          style={{ backgroundImage: BRAND }}>
          <ArrowClockwise size={15} weight="bold" className={refreshing ? 'animate-spin' : ''} />
          <span className="max-sm:hidden">{refreshing ? 'Checking…' : 'Check now'}</span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 pb-16 sm:px-6">
        {/* ── Headline ─────────────────────────────────────────────────────── */}
        <section className="wf-in flex flex-col gap-4 pt-5 sm:flex-row sm:items-end sm:justify-between sm:pt-7">
          <div className="min-w-0">
            <h2 className="text-balance text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[30px]">
              {loading ? 'Checking your pipeline…'
                : total ? <>{plural(total, 'move')} waiting for your <em className="bg-clip-text pr-1 text-transparent" style={{ backgroundImage: BRAND }}>OK</em></>
                  : <>You&apos;re all <em className="bg-clip-text pr-1 text-transparent" style={{ backgroundImage: BRAND }}>caught up</em></>}
            </h2>
            <p className="mt-2 max-w-[600px] text-pretty text-[15px] leading-relaxed" style={{ color: MUTED }}>
              The AI watches your leads, WhatsApp replies and call notes, and lines up the next step for each one. Nothing changes until you tap Apply, and you can undo anything from the log below.
            </p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium" style={{ borderColor: BLUE_LN, background: BLUE_BG, color: BLUE }}>
            <ShieldCheck size={15} weight="fill" />You approve every change
          </span>
        </section>

        {loadError && (
          <div className="mt-6 flex items-center gap-3 rounded-[14px] border px-4 py-3 text-[13.5px]" style={{ borderColor: '#FECDCA', background: '#FEF3F2', color: '#B42318' }}>
            <Warning size={18} className="shrink-0" />
            <span className="min-w-0 flex-1">Your leads didn&apos;t load, so there&apos;s nothing to check yet.</span>
            <button type="button" onClick={() => load(true)} className="shrink-0 cursor-pointer font-semibold underline-offset-2 hover:underline">Try again</button>
          </div>
        )}

        {/* ── The three workflows ──────────────────────────────────────────── */}
        <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Workflows">
          {FLOW_IDS.map(id => {
            const f = FLOWS[id]
            const on = prefs[id]
            const selected = filter === id
            const isReading = !!reading && id !== 'coach' && reading[id] > 0
            const status: { dot: string; text: string } =
              !on ? { dot: '#D0D5DD', text: 'Off' }
              : loading ? { dot: '#D0D5DD', text: 'Starting…' }
              : isReading ? { dot: BLUE, text: `Reading ${plural(reading![id as 'whatsapp' | 'calls'], id === 'whatsapp' ? 'reply' : 'call note', id === 'whatsapp' ? 'replies' : 'call notes')}…` }
              : id !== 'coach' && aiError ? { dot: '#F04438', text: 'AI unavailable' }
              : id === 'whatsapp' && !replies ? { dot: '#F79009', text: 'No replies yet' }
              : id === 'calls' && !notes ? { dot: '#F79009', text: 'No call notes yet' }
              : { dot: '#17B26A', text: 'Live' }
            return (
              <div key={id} className="relative rounded-[16px] p-px transition-[background]" style={{ background: selected ? RING_ON : BORDER }}>
                <div className={`flex h-full flex-col rounded-[15px] bg-white p-4 ${on ? '' : 'opacity-70'}`}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[12px]" style={{ background: f.tint, color: f.color }}>
                      <f.Icon size={20} weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold tracking-[-0.01em] md:invisible">{f.name}</span>
                    <Toggle on={on} onChange={v => setFlow(id, v)} label={`${on ? 'Turn off' : 'Turn on'} ${f.name}`} />
                  </div>
                  <h3 className="mt-3 text-[15.5px] font-semibold tracking-[-0.01em] max-md:sr-only">{f.name}</h3>
                  <p className="mt-1 text-[13.5px] leading-snug max-md:hidden" style={{ color: MUTED }}>{f.desc}</p>
                  <p className="mt-2 text-[12.5px] leading-snug max-md:hidden" style={{ color: LABEL }}>Watches: {f.watches}</p>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-4 max-md:pt-3">
                    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium" style={{ color: SUBTLE }}>
                      <span className={`size-1.5 shrink-0 rounded-full ${isReading ? 'animate-pulse' : ''}`} style={{ background: status.dot }} />
                      <span className="truncate">{status.text}</span>
                    </span>
                    {on && !loading && (counts[id] > 0 || applied7[id] > 0) && (
                      <button type="button" onClick={() => { setFilter(selected ? 'all' : id); setShowAll(false) }} aria-pressed={selected}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition-colors hover:bg-[#EFF4FF]"
                        style={{ color: counts[id] ? BLUE : SUBTLE }}>
                        {counts[id] ? `${counts[id]} to review` : `${applied7[id]} applied this week`}
                        {counts[id] > 0 && <ArrowUpRight size={12} weight="bold" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        {aiError && (prefs.whatsapp || prefs.calls) && (
          <div className="mt-3 flex items-center gap-3 rounded-[12px] border px-4 py-2.5 text-[13.5px]" style={{ borderColor: '#FEDF89', background: '#FFFAEB', color: '#93370D' }}>
            <Warning size={17} className="shrink-0" />
            <span className="min-w-0 flex-1">New replies and call notes weren&apos;t read: {aiError}</span>
            {data && <button type="button" onClick={() => readNew(data)} className="shrink-0 cursor-pointer font-semibold underline-offset-2 hover:underline">Try again</button>}
          </div>
        )}

        {/* ── To review ────────────────────────────────────────────────────── */}
        <section className="mt-8" aria-label="Suggestions to review">
          <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <Chip on={filter === 'all'} onClick={() => { setFilter('all'); setShowAll(false) }} count={total}>All</Chip>
            {FLOW_IDS.filter(id => prefs[id]).map(id => {
              const F = FLOWS[id].Icon
              return <Chip key={id} on={filter === id} onClick={() => { setFilter(id); setShowAll(false) }} count={counts[id]} icon={<F size={15} weight="fill" style={{ color: filter === id ? BLUE : FLOWS[id].color }} />}>{FLOWS[id].name}</Chip>
            })}
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {loading && Array.from({ length: 2 }, (_, i) => <div key={i} className="h-[168px] animate-pulse rounded-[16px]" style={{ background: SOFT }} />)}
            {!loading && reading && filter !== 'coach' && (
              <div className="flex items-center gap-3 rounded-[16px] border border-dashed px-4 py-3.5 text-[13.5px]" style={{ borderColor: BLUE_LN, color: BLUE }}>
                <Sparkle size={16} weight="fill" className="wf-pulse shrink-0" />
                Reading {plural(reading.whatsapp + reading.calls, 'new message')} from your leads…
              </div>
            )}
            {readsShown.map(s => (
              <SuggestionCard key={s.key} s={s} now={now} busy={busy === s.key} locked={!!busy && busy !== s.key}
                onApply={cs => apply(s, cs)} onDismiss={() => dismiss(s)} />
            ))}
          </div>

          {coachShown.length > 0 && (
            <div className={readsShown.length || reading ? 'mt-7' : 'mt-1'}>
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-[15.5px] font-semibold tracking-[-0.01em]">
                    <Lightning size={16} weight="fill" style={{ color: FLOWS.coach.color }} />Deal Coach nudges
                    <span className="rounded-full px-1.5 text-[12px] font-semibold tabular-nums" style={{ background: '#FEF6EE', color: FLOWS.coach.color }}>{coachShown.length}</span>
                  </h3>
                  <p className="mt-0.5 text-[13px]" style={{ color: SUBTLE }}>Apply adds the follow-up, and it shows on your Today page when it&apos;s due.</p>
                </div>
                {coachShown.length > 1 && (
                  <button type="button" onClick={applyAll} disabled={!!busy}
                    className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 text-[13.5px] font-semibold transition-colors hover:bg-[#EFF4FF] disabled:cursor-default disabled:opacity-60"
                    style={{ borderColor: BLUE_LN, color: BLUE }}>
                    <Checks size={16} weight="bold" />Line up all {Math.min(coachShown.length, 20)}
                  </button>
                )}
              </div>
              <div className="mt-3 overflow-hidden rounded-[16px] border bg-white" style={{ borderColor: BORDER }}>
                {coachVisible.map((s, i) => (
                  <CoachRow key={s.key} s={s} now={now} first={i === 0} busy={busy === s.key} locked={!!busy && busy !== s.key}
                    onApply={() => apply(s, s.changes)} onDismiss={() => dismiss(s)} />
                ))}
                {coachShown.length > coachVisible.length && (
                  <button type="button" onClick={() => setShowAll(true)}
                    className="flex w-full cursor-pointer items-center justify-center gap-1 border-t py-3 text-[13.5px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                    style={{ borderColor: BORDER, color: BLUE }}>
                    Show {coachShown.length - coachVisible.length} more
                  </button>
                )}
              </div>
            </div>
          )}

          {!loading && !loadError && !readsShown.length && !coachShown.length && !reading && (
            <div className="mt-1 flex flex-col items-center rounded-[16px] border px-6 py-10 text-center" style={{ borderColor: BORDER, background: SOFT }}>
              <span className="grid size-11 place-items-center rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)]" style={{ color: GREEN_D }}><Check size={20} weight="bold" /></span>
              <p className="mt-3 text-[15px] font-semibold">{filter === 'all' ? 'Nothing needs you right now' : `Nothing from ${FLOWS[filter].name} right now`}</p>
              <p className="mt-1 max-w-[420px] text-[13.5px] leading-relaxed" style={{ color: SUBTLE }}>
                Every open lead has a next step planned. The next lead that needs you shows up here.
              </p>
            </div>
          )}
        </section>

        {/* ── Log ──────────────────────────────────────────────────────────── */}
        <section className="mt-10" aria-label="Activity log">
          <div className="flex items-center gap-2">
            <ClockCounterClockwise size={17} style={{ color: SUBTLE }} />
            <h2 className="text-[15.5px] font-semibold tracking-[-0.01em]">Activity log</h2>
          </div>
          <p className="mt-0.5 text-[13px]" style={{ color: SUBTLE }}>Everything you applied from here, newest first. Undo puts it back the way it was.</p>
          <div className="mt-3 overflow-hidden rounded-[14px] border" style={{ borderColor: BORDER }}>
            {log.length ? log.slice(0, 15).map((e, i) => {
              const F = FLOWS[e.flow]
              return (
                <div key={e.id} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t' : ''}`} style={{ borderColor: BORDER }}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-[9px]" style={{ background: F.tint, color: F.color }}><F.Icon size={15} weight="fill" /></span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[13.5px] ${e.undone ? 'line-through decoration-[#98A2B3]' : ''}`} style={{ color: e.undone ? LABEL : TEXT_2 }}>
                      <Link href={`/dashboard/leads/${e.leadId}`} className="font-semibold hover:underline" style={{ color: e.undone ? LABEL : TEXT }}>{e.leadName}</Link>
                      <span className="mx-1.5" style={{ color: LABEL }}>·</span>{e.text}
                    </p>
                    <p className="text-[12px]" style={{ color: LABEL }}>{F.name} · {ago(e.at, now || e.at)}</p>
                  </div>
                  {e.undone ? <span className="shrink-0 text-[12.5px] font-medium" style={{ color: LABEL }}>Undone</span>
                    : e.undo ? (
                      <button type="button" onClick={() => undo(e)}
                        className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-[8px] px-2.5 text-[13px] font-semibold transition-colors hover:bg-[#F2F4F7]" style={{ color: TEXT_2 }}>
                        <ArrowCounterClockwise size={14} weight="bold" />Undo
                      </button>
                    ) : null}
                </div>
              )
            }) : (
              <p className="px-4 py-6 text-center text-[13.5px]" style={{ color: LABEL }}>Nothing applied yet. What you apply shows up here, with Undo.</p>
            )}
          </div>
        </section>
      </main>

      {notice && (
        <div role="status" className="fixed inset-x-4 top-[72px] z-[230] mx-auto flex w-fit max-w-[560px] items-center gap-3 rounded-[12px] bg-[#101828] py-2 pl-4 pr-2 text-white shadow-[0_20px_24px_-4px_rgba(16,24,40,0.18)]">
          <span className={`grid size-5 shrink-0 place-items-center rounded-full ${notice.tone === 'ok' ? 'bg-[#17B26A]' : 'bg-[#F04438]'}`}>
            {notice.tone === 'ok' ? <Check size={11} weight="bold" /> : <X size={11} weight="bold" />}
          </span>
          <span className="min-w-0 text-[14px] font-medium">{notice.text}</span>
          {notice.action && (
            <button type="button" onClick={() => { notice.action!.run(); setNotice(null) }} className="h-8 shrink-0 cursor-pointer rounded-[8px] px-2.5 text-[14px] font-semibold text-[#84ADFF] transition-colors hover:bg-white/10">{notice.action.label}</button>
          )}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] text-[#98A2B3] transition-colors hover:bg-white/10 hover:text-white">
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      <style>{`
        @keyframes wf-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes wf-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
        .wf-in { animation: wf-in .35s cubic-bezier(.2,.7,.3,1) both }
        .wf-pulse { animation: wf-pulse 1.4s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .wf-in, .wf-pulse { animation: none } }
      `}</style>
    </div>
  )
}

const draftHref = (s: Suggestion) => `/dashboard/advisor?lead=${encodeURIComponent(s.lead.id)}&mode=whatsapp&ask=${encodeURIComponent(s.draft)}`
const ICON_BTN = 'grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] border bg-white transition-colors hover:bg-[#F9FAFB]'

// ─── Deal Coach row ───────────────────────────────────────────────────────────
function CoachRow({ s, now, first, busy, locked, onApply, onDismiss }: {
  s: Suggestion
  now: number
  first: boolean
  busy: boolean
  locked: boolean
  onApply: () => void
  onDismiss: () => void
}) {
  const c = s.changes[0]
  const next = c.kind === 'move' ? `Move “${c.title}” to ${when(c.due, now)}` : c.kind === 'task' ? `“${c.title}”, ${when(c.due, now)}` : ''
  return (
    <div className={`wf-in flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-[#FCFCFD] sm:flex-row sm:items-center sm:gap-4 ${first ? '' : 'border-t'}`} style={{ borderColor: BORDER }}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={s.lead.name} score={s.lead.score} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link href={`/dashboard/leads/${s.lead.id}`} className="min-w-0 truncate text-[14.5px] font-semibold hover:underline">{s.lead.name}</Link>
            <StagePill stage={s.lead.status} small />
            <span className="text-[12.5px] font-semibold" style={{ color: FLOWS.coach.color }}>{s.title}</span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>{s.detail}</p>
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium leading-snug" style={{ color: TEXT_2 }}>
            {c.kind === 'move' ? <CalendarCheck size={15} weight="bold" className="mt-px shrink-0" style={{ color: BLUE }} /> : <CalendarPlus size={15} weight="bold" className="mt-px shrink-0" style={{ color: BLUE }} />}
            <span className="min-w-0">{next}</span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pl-12 sm:pl-0">
        <button type="button" onClick={onApply} disabled={busy || locked}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-50"
          style={{ backgroundImage: BRAND }}>
          {busy ? <ArrowClockwise size={14} weight="bold" className="animate-spin" /> : <Check size={14} weight="bold" />}
          {busy ? 'Saving…' : c.kind === 'move' ? 'Reschedule' : 'Add follow-up'}
        </button>
        {s.lead.phone && (
          <>
            <a href={telHref(s.lead.phone)} aria-label={`Call ${s.lead.first}`} title={`Call ${s.lead.first}`} className={ICON_BTN} style={{ borderColor: BORDER }}>
              <Phone size={15} weight="fill" style={{ color: BLUE }} />
            </a>
            <a href={waHref(s.lead.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${s.lead.first}`} title={`WhatsApp ${s.lead.first}`} className={ICON_BTN} style={{ borderColor: BORDER }}>
              <WhatsappLogo size={15} weight="fill" style={{ color: GREEN_D }} />
            </a>
          </>
        )}
        <Link href={draftHref(s)} aria-label="Draft a message with AI Advisor" title="Draft a message with AI Advisor" className={ICON_BTN} style={{ borderColor: BORDER }}>
          <Sparkle size={15} weight="fill" style={{ color: '#4F46E5' }} />
        </Link>
        <button type="button" onClick={onDismiss} aria-label="Not now" title="Not now" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] transition-colors hover:bg-[#F2F4F7]" style={{ color: LABEL }}>
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  )
}

// ─── Suggestion card ──────────────────────────────────────────────────────────
function SuggestionCard({ s, now, busy, locked, onApply, onDismiss }: {
  s: Suggestion
  now: number
  busy: boolean
  locked: boolean
  onApply: (changes: Change[]) => void
  onDismiss: () => void
}) {
  const [off, setOff] = useState<number[]>([])
  const f = FLOWS[s.flow]
  const picked = s.changes.filter((_, i) => !off.includes(i))
  const many = s.changes.length > 1
  const budget = budgetText(s.lead.budgetMin, s.lead.budgetMax)
  const ask = draftHref(s)

  return (
    <article className="wf-in rounded-[16px] border bg-white p-4 transition-shadow hover:shadow-[0_12px_28px_-18px_rgba(16,24,40,0.28)] sm:p-5" style={{ borderColor: BORDER }}>
      <div className="flex items-start gap-3">
        <Avatar name={s.lead.name} score={s.lead.score} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/dashboard/leads/${s.lead.id}`} className="min-w-0 truncate text-[15px] font-semibold hover:underline">{s.lead.name}</Link>
            <StagePill stage={s.lead.status} small />
            <span className="text-[12.5px] tabular-nums" style={{ color: LABEL }}>{s.lead.csId}{budget ? ` · ${budget}` : ''}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: f.color }}><f.Icon size={14} weight="fill" />{s.title}</span>
            <span className="whitespace-nowrap" style={{ color: LABEL }}>{ago(s.at, now)}</span>
          </p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" title="Not now"
          className="-mr-1.5 -mt-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] transition-colors hover:bg-[#F2F4F7]" style={{ color: LABEL }}>
          <X size={15} weight="bold" />
        </button>
      </div>

      <div className="mt-3 sm:pl-[52px]">
        {s.quote ? (
          <figure className="rounded-[12px] px-3.5 py-2.5 text-[14px] leading-relaxed" style={{ background: s.flow === 'whatsapp' ? '#ECFDF3' : SOFT, color: TEXT_2 }}>
            <blockquote className="line-clamp-4 whitespace-pre-line break-words">{s.flow === 'whatsapp' ? `“${s.quote}”` : s.quote}</blockquote>
            {s.detail && <figcaption className="mt-1.5 flex gap-1.5 text-[13px]" style={{ color: MUTED }}><Sparkle size={13} weight="fill" className="mt-[3px] shrink-0" style={{ color: '#7C83F5' }} />{s.detail}</figcaption>}
          </figure>
        ) : (
          <p className="text-[14px] leading-relaxed" style={{ color: MUTED }}>{s.detail}</p>
        )}
        {!!s.signals?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.signals.map(x => <span key={x} className="rounded-full border px-2 py-0.5 text-[12px] font-medium" style={{ borderColor: BORDER, color: TEXT_2 }}>{x}</span>)}
          </div>
        )}

        <div className="mt-3 rounded-[12px] border" style={{ borderColor: BORDER, background: SOFT }}>
          <p className="px-3.5 pt-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>Suggested</p>
          <ul className="pb-1.5">
            {s.changes.map((c, i) => {
              const on = !off.includes(i)
              return (
                <li key={i}>
                  <label className={`flex items-start gap-2.5 px-3.5 py-2 ${many ? 'cursor-pointer' : ''}`}>
                    {many && (
                      <input type="checkbox" checked={on} onChange={() => setOff(p => (on ? [...p, i] : p.filter(x => x !== i)))}
                        className="mt-[3px] size-4 shrink-0 cursor-pointer accent-[#1D4ED8]" />
                    )}
                    <ChangeRow c={c} now={now} dim={!on} />
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onApply(picked)} disabled={!picked.length || busy || locked}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(79,70,229,0.6)] transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-50"
            style={{ backgroundImage: BRAND }}>
            {busy ? <ArrowClockwise size={15} weight="bold" className="animate-spin" /> : <Check size={15} weight="bold" />}
            {busy ? 'Applying…' : many && picked.length > 1 ? `Apply ${picked.length} changes` : 'Apply'}
          </button>
          {s.lead.phone && (
            <>
              <a href={telHref(s.lead.phone)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border bg-white px-3 text-[13.5px] font-semibold transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: BORDER, color: TEXT_2 }}>
                <Phone size={15} weight="fill" style={{ color: BLUE }} />Call
              </a>
              <a href={waHref(s.lead.phone)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border bg-white px-3 text-[13.5px] font-semibold transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: BORDER, color: TEXT_2 }}>
                <WhatsappLogo size={15} weight="fill" style={{ color: GREEN_D }} />WhatsApp
              </a>
            </>
          )}
          <Link href={ask} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13.5px] font-semibold transition-colors hover:bg-[#EFF4FF]" style={{ color: BLUE }}>
            <Sparkle size={15} weight="fill" />Draft a message
          </Link>
        </div>
      </div>
    </article>
  )
}

function ChangeRow({ c, now, dim }: { c: Change; now: number; dim: boolean }) {
  const row = (icon: ReactNode, label: ReactNode, right?: ReactNode, why?: string) => (
    <span className={`flex min-w-0 flex-1 flex-col gap-0.5 transition-opacity ${dim ? 'opacity-45' : ''}`}>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[14px]" style={{ color: TEXT }}>
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">{icon}<span className="min-w-0">{label}</span></span>
        {right && <span className="text-[13px]" style={{ color: SUBTLE }}>{right}</span>}
      </span>
      {why && <span className="text-[12.5px] leading-snug" style={{ color: LABEL }}>{why}</span>}
    </span>
  )
  const ic = (I: Icon, color = BLUE) => <I size={15} weight="bold" className="shrink-0" style={{ color }} />
  switch (c.kind) {
    case 'task':   return row(ic(CalendarPlus), <>Add “{c.title}”</>, when(c.due, now), c.why)
    case 'move':   return row(ic(CalendarCheck), <>Move “{c.title}” to {when(c.due, now)}</>, `was ${when(c.from, now)}`)
    case 'stage':  return row(ic(c.to === 'Disqualified' ? Prohibit : TrendUp, c.to === 'Disqualified' ? '#D92D20' : BLUE), <>Move to {STAGE[c.to].label}</>,
      <span className="inline-flex items-center gap-1"><StagePill stage={c.from} small />→<StagePill stage={c.to} small /></span>, c.why)
    case 'budget': return row(ic(CurrencyInr, '#067647'), 'Update budget', `${budgetText(c.from[0], c.from[1]) ?? 'Not set'} → ${budgetText(c.to[0], c.to[1]) ?? 'Not set'}`, c.why)
    case 'note':   return row(ic(NotePencil, MUTED), 'Save this summary to the lead’s timeline')
  }
}
