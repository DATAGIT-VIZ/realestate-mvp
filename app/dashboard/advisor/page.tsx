'use client'

// AI Advisor: a calm, centred chat that knows the agent's leads. Every answer
// can turn into an action (send the WhatsApp, call the lead, log it).

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Sparkle, WhatsappLogo, PhoneCall, ShieldCheck, EnvelopeSimple, ClockCounterClockwise, BookmarkSimple,
  UserPlus, CaretDown, Microphone, ArrowUp, Stop, Copy, Check, ArrowClockwise, MagnifyingGlass, Trash,
  Phone, ArrowSquareOut, Fire, CurrencyInr, HourglassMedium, Warning, ArrowUpRight, ChatCircleText, X,
  NotePencil, type Icon,
} from '@phosphor-icons/react'
import type { AdvisorContext, AdvisorMode, LiveDeal, LiveLead } from '@/app/api/ai-assistant/route'
import type { CRMLead } from '@/lib/twenty'
import { PageTabBar } from '@/components/layout/PageTabBar'
import { supabase } from '@/lib/supabase'
import {
  BORDER, BORDER_2, TEXT, TEXT_2, MUTED, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, GREEN_D, WA, DAY,
  STAGE, stageOf, displayName, getCsId, phone10, telHref, waHref, budgetText, inr, sourceMeta,
  LeadAvatar, StagePill, type StageId,
} from '@/components/outreach/OutreachKit'

const ADVISOR_TABS = [
  { label: 'AI Chat',   href: '/dashboard/advisor' },
  { label: 'Workflows', href: '/dashboard/advisor/workflows' },
]

// Same storage keys as before, so existing chats and saved scripts carry over
const STORAGE_KEY   = 'ai_advisor_v5'
const TEMPLATES_KEY = 'ai_advisor_templates_v1'
const MAX_CONVOS    = 20
const MAX_SAVED     = 50
const QUIET_DAYS    = 7
const NEXT_MARK     = '[[NEXT]]'
const ERROR_MARK    = '[[ERROR]]'

const BRAND   = 'linear-gradient(135deg, #1D4ED8 0%, #4F46E5 55%, #2563EB 100%)'
const RING    = 'linear-gradient(120deg, #C7D7FE 0%, #D5D9FB 40%, #E4DCFD 70%, #CFE0FE 100%)'
const RING_ON = 'linear-gradient(120deg, #6E9BFF 0%, #7C83F5 45%, #A78BFA 72%, #5B8DEF 100%)'
const SOFT    = '#F7F8FB'
const BUBBLE  = '#EEF2FB'

// ─── Types ────────────────────────────────────────────────────────────────────
type BlockKind = 'whatsapp' | 'call' | 'email' | 'text'
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  tokens?: number
  leadId?: string
  leadName?: string
  leadCs?: string
  mode?: AdvisorMode
  next?: string[]
  error?: string
  stopped?: boolean
}
interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number; totalTokens: number; leadId?: string; updatedAt?: number }
interface SavedTemplate { id: string; content: string; savedAt: number; kind?: BlockKind; leadName?: string }
type DealRow = { stage: string; deal_value: number; lead_name: string; city: string; assigned_to: string; expected_close?: string; source_portal?: string }
type Loaded = { leads: CRMLead[]; total: number; deals: DealRow[]; name: string | null; at: number }
type Live = { cid: string; text: string; leadName?: string }
type Notice = { text: string; tone: 'ok' | 'err'; action?: { label: string; run: () => void } }
type Starter = { text: string; mode: AdvisorMode; leadId?: string }

const MODES: { id: AdvisorMode; label: string; hint: string; Icon: Icon; color: string; placeholder: string }[] = [
  { id: 'advice',    label: 'Strategy',    hint: 'Advice on what to do next',           Icon: Sparkle,        color: BLUE,      placeholder: 'Ask about a lead or your pipeline…' },
  { id: 'whatsapp',  label: 'WhatsApp',    hint: 'A message ready to send',             Icon: WhatsappLogo,   color: GREEN_D,   placeholder: 'Who should I message, and about what?' },
  { id: 'call',      label: 'Call script', hint: 'What to say on the call',             Icon: PhoneCall,      color: '#026AA2', placeholder: 'Who are you calling, and why?' },
  { id: 'objection', label: 'Objection',   hint: 'The exact words for a pushback',      Icon: ShieldCheck,    color: '#B54708', placeholder: 'What did the client say? e.g. "Too expensive"' },
  { id: 'email',     label: 'Email',       hint: 'Subject line and body',               Icon: EnvelopeSimple, color: '#5925DC', placeholder: 'Who is the email for, and what is it about?' },
]
const modeOf = (id: AdvisorMode | undefined) => MODES.find(m => m.id === id) ?? MODES[0]

const BLOCK: Record<BlockKind, { label: string; Icon: Icon; color: string }> = {
  whatsapp: { label: 'WhatsApp message', Icon: WhatsappLogo,   color: GREEN_D },
  call:     { label: 'Call script',      Icon: PhoneCall,      color: '#026AA2' },
  email:    { label: 'Email',            Icon: EnvelopeSimple, color: '#5925DC' },
  text:     { label: 'Ready to use',     Icon: ChatCircleText, color: BLUE },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId      = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const shortTitle = (s: string) => (s.length > 52 ? `${s.slice(0, 52).trimEnd()}…` : s)
const firstName  = (l: CRMLead) => l.name?.firstName?.trim() || displayName(l)
const CS_RE      = /\bCS\s?-?\s?(\d{3,8})\b/gi
const normCs     = (digits: string) => `CS${digits.padStart(5, '0')}`

function readLS<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback } catch { return fallback }
}
function writeLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}
function ago(ms: number, now: number) {
  const m = Math.max(0, Math.round((now - ms) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
const daysSince = (iso: string | null | undefined, now: number) => {
  const t = iso ? new Date(iso).getTime() : NaN
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : undefined
}

/** Splits a raw reply into the answer, the follow-up suggestions and any error */
function splitReply(raw: string, streaming = false) {
  let body = raw
  let error: string | undefined
  const ei = body.indexOf(ERROR_MARK)
  if (ei >= 0) { error = body.slice(ei + ERROR_MARK.length).trim() || 'Something went wrong.'; body = body.slice(0, ei) }
  let next: string[] = []
  const ni = body.indexOf(NEXT_MARK)
  if (ni >= 0) {
    next = body.slice(ni + NEXT_MARK.length).split('|').map(s => s.replace(/^[\s\-•*"]+|[\s"]+$/g, '')).filter(Boolean).slice(0, 3)
    body = body.slice(0, ni)
  }
  // Hide a marker that is still arriving
  if (streaming) body = body.replace(/\[\[?[A-Z]{0,6}\]?$/, '')
  return { body: body.trimEnd(), next, error }
}

type Block = { type: 'md'; body: string } | { type: 'code'; lang: string; body: string; open: boolean }
function splitBlocks(text: string): Block[] {
  const out: Block[] = []
  const re = /```([\w-]*)[^\n]*\n?([\s\S]*?)(```|$)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: 'md', body: text.slice(last, m.index) })
    out.push({ type: 'code', lang: m[1].toLowerCase(), body: m[2].replace(/\s+$/, ''), open: m[3] !== '```' })
    last = re.lastIndex
    if (m[3] !== '```') break
  }
  if (last < text.length) out.push({ type: 'md', body: text.slice(last) })
  return out.filter(b => b.type === 'code' || b.body.trim())
}
const kindOf = (lang: string): BlockKind => (lang === 'whatsapp' || lang === 'call' || lang === 'email' ? lang : 'text')
const plain = (s: string) => s.replace(/```[\w-]*\n?/g, '').replace(/\*\*/g, '').trim()
/** What "Save" keeps: the first ready-to-send block if there is one, else the whole reply */
function primaryScript(body: string): { content: string; kind?: BlockKind } {
  const code = splitBlocks(body).find((b): b is Extract<Block, { type: 'code' }> => b.type === 'code')
  return code ? { content: code.body, kind: kindOf(code.lang) } : { content: plain(body) }
}
/** Mode for a tapped suggestion: what it asks for, else the mode of the answer it follows */
function inferMode(text: string, fallback: AdvisorMode = 'advice'): AdvisorMode {
  if (/whats\s?app|message|text him|text her/i.test(text)) return 'whatsapp'
  if (/call script|on the call|opener|opening line/i.test(text)) return 'call'
  if (/email|e-mail/i.test(text)) return 'email'
  if (/follow[- ]?ups?|who should|pipeline|plan my/i.test(text)) return 'advice'
  return fallback
}
const FALLBACK_NEXT: Record<AdvisorMode, string[]> = {
  advice:    ['Write the WhatsApp for this', 'Give me a call script', 'What should I do after that?'],
  whatsapp:  ['Make it shorter', 'Add a site visit invite', 'Write it in Hindi'],
  call:      ['What if they say they are busy?', 'Write the follow-up WhatsApp', 'Make the opener shorter'],
  objection: ['What if they push back again?', 'Write it as a WhatsApp', 'Give me two more ways to say it'],
  email:     ['Make it shorter', 'Write the WhatsApp version', 'Make it more personal'],
}

// ─── Data ─────────────────────────────────────────────────────────────────────
async function fetchFirstName(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const meta = (data.session?.user?.user_metadata ?? {}) as Record<string, unknown>
    const full = [meta.first_name, meta.full_name, meta.name].find(v => typeof v === 'string' && v.trim()) as string | undefined
    return full ? full.trim().split(/\s+/)[0] : null
  } catch { return null }
}
async function loadAll(): Promise<Loaded> {
  const [lr, deals, name] = await Promise.all([
    fetch('/api/crm/leads?limit=200').then(r => r.json()),
    // /api/deals answers { deals }, the old page read { data } and always got nothing
    fetch('/api/deals').then(r => (r.ok ? r.json() : {})).then((j: { deals?: DealRow[]; data?: DealRow[] }) => j.deals ?? j.data ?? []).catch(() => [] as DealRow[]),
    fetchFirstName(),
  ])
  const leads = (lr?.data?.leads ?? lr?.data ?? []) as CRMLead[]
  if (!Array.isArray(leads)) throw new Error(lr?.error || 'Could not load your leads')
  return { leads, total: Number(lr?.data?.totalCount) || leads.length, deals: Array.isArray(deals) ? deals : [], name, at: Date.now() }
}

const OPEN_RANK: Partial<Record<StageId, number>> = { Hot: 0, Warm: 1, New: 2, Cold: 3 }

function toLive(l: CRMLead, now: number): LiveLead {
  return {
    id: l.id, csId: getCsId(l), name: displayName(l), phone: l.phones?.primaryPhoneNumber ?? '',
    city: l.city ?? '', propertyType: l.propertyType?.[0] ?? '', score: l.intentScore ?? 0,
    stage: stageOf(l.status), source: sourceMeta(l.sourcePortal).label,
    budget: budgetText(l.budgetMin, l.budgetMax) ?? undefined, timeline: l.timeline ?? undefined,
    localities: l.localities ?? undefined, addedDaysAgo: daysSince(l.createdAt, now),
    daysSinceUpdate: daysSince(l.updatedAt, now), unansweredCalls: l.failedContactAttempts ?? 0,
  }
}

/** Pipeline numbers, from the leads themselves (stage = status, money = open budgets) */
function buildModel(d: Loaded) {
  const now = d.at
  const stageCounts: Record<StageId, number> = { New: 0, Cold: 0, Warm: 0, Hot: 0, Closed: 0, Disqualified: 0, Hold: 0 }
  for (const l of d.leads) stageCounts[stageOf(l.status)]++
  const open = d.leads.filter(l => OPEN_RANK[stageOf(l.status)] != null)
  const quiet = open.filter(l => stageOf(l.status) !== 'New' && (daysSince(l.updatedAt, now) ?? 0) >= QUIET_DAYS)
  const pipeline = open.reduce((s, l) => s + (l.budgetMax ?? l.budgetMin ?? 0), 0)
  const decided = stageCounts.Closed + stageCounts.Disqualified
  const scores = d.leads.map(l => l.intentScore ?? 0).filter(Boolean)
  const portals: Record<string, number> = {}
  for (const l of d.leads) { const s = sourceMeta(l.sourcePortal).label; portals[s] = (portals[s] ?? 0) + 1 }

  const priority = [...open].sort((a, b) =>
    (OPEN_RANK[stageOf(a.status)]! - OPEN_RANK[stageOf(b.status)]!)
    || ((b.intentScore ?? 0) - (a.intentScore ?? 0))
    || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))

  const active = d.deals.filter(x => !['won', 'lost'].includes(x.stage))
  const toDeal = (x: DealRow): LiveDeal => ({ leadName: x.lead_name, value: inr(x.deal_value), rawValue: x.deal_value, stage: x.stage, city: x.city, agent: x.assigned_to, expectedClose: x.expected_close, sourcePortal: x.source_portal })
  const nearClose = active.filter(x => ['negotiation', 'token_paid'].includes(x.stage))
    .sort((a, b) => (a.expected_close ? new Date(a.expected_close).getTime() : Infinity) - (b.expected_close ? new Date(b.expected_close).getTime() : Infinity))

  const ctx: AdvisorContext = {
    totalLeads: d.total, stageCounts, hotLeadsCount: stageCounts.Hot, newLeadsCount: stageCounts.New,
    goneQuietCount: quiet.length,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    topSource: Object.entries(portals).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'Unknown',
    pipelineValue: inr(pipeline), winRate: decided ? Math.round((stageCounts.Closed / decided) * 100) : null,
    leads: priority.slice(0, 40).map(l => toLive(l, now)),
    activeDeals: active.slice(0, 10).map(toDeal), dealsNearClose: nearClose.slice(0, 6).map(toDeal),
    recentPortalCounts: portals,
  }
  const newest = open.filter(l => stageOf(l.status) === 'New').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return { ctx, priority, stats: { hot: stageCounts.Hot, fresh: stageCounts.New, quiet: quiet.length, pipeline }, topHot: priority.find(l => stageOf(l.status) === 'Hot') ?? priority[0], newest: newest[0] }
}

/** Leads the next answer should know in full: the attached one, CS IDs and names in recent messages */
function focusLeads(history: ChatMessage[], attached: string | undefined, leads: CRMLead[], byId: Map<string, CRMLead>) {
  const ids: string[] = []
  const add = (id?: string) => { if (id && byId.has(id) && !ids.includes(id)) ids.push(id) }
  const users = history.filter(m => m.role === 'user')
  add(users[users.length - 1]?.leadId)
  const recent = users.slice(-3).map(m => m.content).join('\n')
  for (const hit of recent.matchAll(CS_RE)) add(leads.find(l => getCsId(l).toUpperCase() === normCs(hit[1]))?.id)
  const lower = recent.toLowerCase()
  for (const l of leads) {
    const n = displayName(l)
    if (n.includes(' ') && n.length >= 6 && lower.includes(n.toLowerCase())) add(l.id)
    if (ids.length >= 5) break
  }
  add(attached)
  for (const m of [...users].reverse()) add(m.leadId)
  return ids.slice(0, 5).map(id => byId.get(id)!)
}

/** The lead a question is about when none is attached: a CS ID, a full name, or a first name from the last few answers */
function impliedLead(text: string, history: ChatMessage[], leads: CRMLead[]): CRMLead | undefined {
  const cs = [...text.matchAll(CS_RE)].map(h => normCs(h[1]))
  if (cs.length) return leads.find(l => getCsId(l).toUpperCase() === cs[0])
  const lower = text.toLowerCase()
  const full = leads.find(l => { const n = displayName(l); return n.includes(' ') && n.length >= 6 && lower.includes(n.toLowerCase()) })
  if (full) return full
  const recent = history.slice(-4).map(m => m.content).join('\n')
  const seen = new Set([...recent.matchAll(CS_RE)].map(h => normCs(h[1])))
  for (const m of history.slice(-4)) if (m.leadCs) seen.add(m.leadCs.toUpperCase())
  const named = leads.filter(l => seen.has(getCsId(l).toUpperCase()) && new RegExp(`\\b${firstName(l).replace(/[^\w]/g, '')}\\b`, 'i').test(text))
  return named.length === 1 ? named[0] : undefined
}

const noopSubscribe = () => () => {}
type SpeechCtor = new () => {
  lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null; onerror: (() => void) | null
}
const speechCtor = (): SpeechCtor | null => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdvisorPage() {
  const [data, setData]           = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [convos, setConvos]       = useState<Conversation[]>([])
  const [saved, setSaved]         = useState<SavedTemplate[]>([])
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [input, setInput]         = useState('')
  const [mode, setMode]           = useState<AdvisorMode>('advice')
  const [leadId, setLeadId]       = useState<string | null>(null)
  const [live, setLive]           = useState<Live | null>(null)
  const [menu, setMenu]           = useState<'lead' | 'mode' | null>(null)
  const [drawer, setDrawer]       = useState<'history' | 'saved' | null>(null)
  const [drawerNow, setDrawerNow] = useState(0)
  const [focused, setFocused]     = useState(false)
  const [listening, setListening] = useState(false)
  const [copied, setCopied]       = useState<string | null>(null)
  const [notice, setNotice]       = useState<Notice | null>(null)

  const hydrated  = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef  = useRef<AbortController | null>(null)
  const stickRef  = useRef(true)
  const recogRef  = useRef<InstanceType<SpeechCtor> | null>(null)
  const noticeT   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canListen = useSyncExternalStore(noopSubscribe, () => speechCtor() != null, () => false)

  const load = useCallback(() => loadAll()
    .then(d => { setData(d); setLoadError(null) })
    .catch((e: Error) => setLoadError(e.message || 'Could not load your leads')), [])
  useEffect(() => { load() }, [load])

  // Chats and saved scripts live in this browser, under the same keys as before
  useEffect(() => {
    Promise.resolve().then(() => {
      hydrated.current = true
      setConvos(readLS<Conversation[]>(STORAGE_KEY, []).filter(c => c && Array.isArray(c.messages)))
      setSaved(readLS<SavedTemplate[]>(TEMPLATES_KEY, []))
      // "Draft a message" on AI Workflows opens here with the lead, mode and question filled in
      const q = new URLSearchParams(window.location.search)
      const ask = q.get('ask')?.trim()
      if (!ask) return
      const m = q.get('mode')
      if (MODES.some(x => x.id === m)) setMode(m as AdvisorMode)
      const lid = q.get('lead')
      if (lid) setLeadId(lid)
      setInput(ask.slice(0, 2000))
      window.history.replaceState(null, '', window.location.pathname)
      setTimeout(() => inputRef.current?.focus(), 60)
    })
  }, [])
  useEffect(() => { if (hydrated.current) writeLS(STORAGE_KEY, convos.slice(0, MAX_CONVOS)) }, [convos])
  useEffect(() => { if (hydrated.current) writeLS(TEMPLATES_KEY, saved.slice(0, MAX_SAVED)) }, [saved])
  useEffect(() => () => { abortRef.current?.abort(); recogRef.current?.stop(); if (noticeT.current) clearTimeout(noticeT.current) }, [])

  const model  = useMemo(() => (data ? buildModel(data) : null), [data])
  const byId   = useMemo(() => new Map((data?.leads ?? []).map(l => [l.id, l])), [data])
  const active = convos.find(c => c.id === activeId) ?? null
  const lead   = leadId ? byId.get(leadId) ?? null : null
  const streamingHere = !!live && live.cid === activeId

  const flash = useCallback((n: Notice) => {
    if (noticeT.current) clearTimeout(noticeT.current)
    setNotice(n)
    noticeT.current = setTimeout(() => setNotice(null), 6000)
  }, [])

  // Follow the answer while it streams, unless the reader scrolled up
  const lastLen = active?.messages.length ?? 0
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!activeId) { el.scrollTop = 0; return }
    if (stickRef.current) el.scrollTo({ top: el.scrollHeight, behavior: live ? 'auto' : 'smooth' })
  }, [live, lastLen, activeId])
  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140
  }

  // Grow the composer with its text
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [input])

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 30)

  // ── Asking ──────────────────────────────────────────────────────────────────
  const run = useCallback(async (convo: Conversation, history: ChatMessage[], askMode: AdvisorMode) => {
    const cid = convo.id
    const leads = data?.leads ?? []
    const focus = focusLeads(history, convo.leadId, leads, byId)
    const now = data?.at ?? 0
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLive({ cid, text: '', leadName: focus[0] ? firstName(focus[0]) : undefined })

    const commit = (msg: ChatMessage) => setConvos(p => p.map(c => (c.id !== cid ? c : { ...c, messages: [...c.messages, msg], updatedAt: Date.now() })))
    let acc = ''
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: history.filter(m => m.content && !m.error && !/^Failed — /.test(m.content)).map(m => ({ role: m.role, content: m.content })),
          context: model?.ctx ?? {},
          mode: askMode,
          focusIds: focus.map(l => l.id),
          focusLeads: focus.map(l => toLive(l, now)),
        }),
      })
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `The Advisor couldn't answer just now (error ${res.status}).`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setLive(l => (l && l.cid === cid ? { ...l, text: acc } : l))
      }
      acc += decoder.decode()
      const r = splitReply(acc)
      commit(r.body
        ? { role: 'assistant', content: r.body, mode: askMode, next: r.error ? undefined : (r.next.length ? r.next : FALLBACK_NEXT[askMode]), error: r.error }
        : { role: 'assistant', content: '', mode: askMode, error: r.error ?? "The Advisor didn't send a reply." })
    } catch (e) {
      const r = splitReply(acc)
      if (ctrl.signal.aborted) commit({ role: 'assistant', content: r.body, mode: askMode, stopped: true, error: r.body ? undefined : 'Stopped.' })
      else commit({ role: 'assistant', content: r.body, mode: askMode, error: e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'No connection. Check your internet and try again.' })
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
      setLive(null)
    }
  }, [data, byId, model])

  const send = useCallback((text: string, opts?: { mode?: AdvisorMode; leadId?: string | null }) => {
    const q = text.trim()
    if (!q || live) return
    const askMode = opts?.mode ?? mode
    const lid = opts && 'leadId' in opts ? opts.leadId : leadId
    const base = convos.find(c => c.id === activeId) ?? { id: genId(), title: shortTitle(q), messages: [], createdAt: Date.now(), totalTokens: 0 }
    // A question that names a lead ("Write the WhatsApp for Arjun") is about that lead
    const l = impliedLead(q, base.messages, data?.leads ?? []) ?? (lid ? byId.get(lid) : undefined)
    const userMsg: ChatMessage = {
      role: 'user', content: q, mode: askMode === 'advice' ? undefined : askMode,
      leadId: l?.id, leadName: l ? displayName(l) : undefined, leadCs: l ? getCsId(l) : undefined,
    }
    const history = [...base.messages, userMsg]
    const convo: Conversation = { ...base, title: base.messages.length ? base.title : shortTitle(q), messages: history, leadId: l?.id ?? base.leadId, updatedAt: Date.now() }
    setConvos(p => [convo, ...p.filter(c => c.id !== convo.id)].slice(0, MAX_CONVOS))
    setActiveId(convo.id)
    if (l) setLeadId(l.id)
    setInput('')
    setMenu(null)
    stickRef.current = true
    run(convo, history, askMode)
  }, [live, mode, leadId, byId, convos, activeId, run, data])

  const retry = useCallback(() => {
    if (!active || live) return
    const msgs = [...active.messages]
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop()
    const lastUser = msgs[msgs.length - 1]
    if (!lastUser) return
    setConvos(p => p.map(c => (c.id === active.id ? { ...c, messages: msgs } : c)))
    stickRef.current = true
    run({ ...active, messages: msgs }, msgs, lastUser.mode ?? 'advice')
  }, [active, live, run])

  const stop = () => abortRef.current?.abort()

  const newChat = () => {
    if (live) stop()
    setActiveId(null); setLeadId(null); setInput(''); setMenu(null); setDrawer(null)
    focusInput()
  }
  const openConvo = (c: Conversation) => {
    setActiveId(c.id); setLeadId(c.leadId ?? null); setDrawer(null)
    stickRef.current = true
  }
  const deleteConvo = (id: string) => {
    setConvos(p => p.filter(c => c.id !== id))
    if (id === activeId) { setActiveId(null); setLeadId(null) }
  }
  const openDrawer = (tab: 'history' | 'saved') => { setDrawerNow(Date.now()); setDrawer(tab); setMenu(null) }

  const pickLead = (id: string | null) => {
    setLeadId(id); setMenu(null)
    if (active && id) setConvos(p => p.map(c => (c.id === active.id ? { ...c, leadId: id } : c)))
    focusInput()
  }
  const startWith = (s: Starter) => {
    if (s.leadId) setLeadId(s.leadId)
    setMode(s.mode)
    send(s.text, { mode: s.mode, leadId: s.leadId ?? null })
  }

  // ── Actions on answers ──────────────────────────────────────────────────────
  const copyText = (text: string, key: string) => {
    const done = () => { setCopied(key); setTimeout(() => setCopied(k => (k === key ? null : k)), 1800) }
    if (!navigator.clipboard) { flash({ tone: 'err', text: 'Copying is blocked in this browser.' }); return }
    navigator.clipboard.writeText(text).then(done).catch(() => flash({ tone: 'err', text: 'Copying is blocked in this browser.' }))
  }
  const saveScript = (content: string, kind: BlockKind | undefined, leadName: string | undefined, key: string) => {
    if (saved.some(s => s.content === content)) { flash({ tone: 'ok', text: 'Already in your saved scripts.' }); return }
    setSaved(p => [{ id: genId(), content: content.slice(0, 4000), savedAt: Date.now(), kind, leadName }, ...p].slice(0, MAX_SAVED))
    setCopied(key); setTimeout(() => setCopied(k => (k === key ? null : k)), 1800)
    flash({ tone: 'ok', text: 'Saved to your scripts.', action: { label: 'View', run: () => openDrawer('saved') } })
  }
  const logActivity = (l: CRMLead, type: 'WhatsApp Sent' | 'Email Sent', notes: string) => {
    fetch(`/api/crm/leads/${l.id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, notes: notes.slice(0, 1000) }),
    })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || 'Could not log it') })
      .then(() => flash({ tone: 'ok', text: `Logged on ${firstName(l)}'s timeline.` }))
      .catch((e: Error) => flash({ tone: 'err', text: e.message || 'Could not log it' }))
  }
  const afterSend = (l: CRMLead, kind: BlockKind, text: string) => {
    if (kind === 'call') return
    const type = kind === 'email' ? 'Email Sent' : 'WhatsApp Sent'
    flash({ tone: 'ok', text: `Opened ${kind === 'email' ? 'your email app' : 'WhatsApp'} for ${firstName(l)}. Log it once it's sent?`, action: { label: 'Log it', run: () => logActivity(l, type, text) } })
  }

  const toggleVoice = () => {
    if (listening) { recogRef.current?.stop(); setListening(false); return }
    const Ctor = speechCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = 'en-IN'; r.continuous = false; r.interimResults = true
    const before = input ? `${input.trimEnd()} ` : ''
    r.onresult = e => setInput(before + Array.from(e.results).map(x => x[0].transcript).join(''))
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recogRef.current = r
    r.start(); setListening(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(null); setDrawer(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const starters: Starter[] = useMemo(() => {
    const out: Starter[] = []
    if (model?.topHot) out.push({ text: `Write a WhatsApp to book a site visit with ${firstName(model.topHot)}`, mode: 'whatsapp', leadId: model.topHot.id })
    if (model?.newest && model.newest.id !== model.topHot?.id) out.push({ text: `Give me a call script for ${firstName(model.newest)}, my newest lead`, mode: 'call', leadId: model.newest.id })
    out.push({ text: 'Who should I call first today, and why?', mode: 'advice' })
    out.push({ text: 'How do I answer "the price is too high"?', mode: 'objection' })
    return out.slice(0, 4)
  }, [model])

  const curMode = modeOf(mode)
  const convoLead = active?.leadId ? byId.get(active.leadId) ?? null : null

  return (
    <div className="flex h-[calc(100dvh-56px-64px)] min-h-[520px] flex-col bg-white lg:h-[calc(100dvh-56px)]" style={{ color: TEXT }}>
      <PageTabBar tabs={ADVISOR_TABS} />

      {/* ── Title and pill nav ─────────────────────────────────────────────── */}
      <header className="shrink-0">
        <div className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] sm:text-[24px]">
              AI <em className="bg-clip-text pr-1 font-semibold text-transparent" style={{ backgroundImage: BRAND }}>Advisor</em>
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px]" style={{ color: SUBTLE }}>
              <span className={`size-1.5 shrink-0 rounded-full ${data ? 'bg-[#17B26A]' : loadError ? 'bg-[#F04438]' : 'bg-[#D0D5DD]'}`} />
              {data ? `Knows your ${data.total.toLocaleString('en-IN')} leads` : loadError ? 'Lead data unavailable' : 'Reading your leads…'}
            </p>
          </div>
          <nav className="flex shrink-0 items-center gap-1.5" aria-label="Advisor">
            <NavPill icon={ClockCounterClockwise} label="History" count={convos.length} onClick={() => openDrawer('history')} />
            <NavPill icon={BookmarkSimple} label="Saved" count={saved.length} onClick={() => openDrawer('saved')} />
            <button type="button" onClick={newChat}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.55)] transition-[filter] hover:brightness-110"
              style={{ backgroundImage: BRAND }}>
              <Sparkle size={15} weight="fill" />New chat
            </button>
          </nav>
        </div>
      </header>

      {/* ── Conversation ───────────────────────────────────────────────────── */}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        <div className="mx-auto w-full max-w-[800px] px-4 pb-8 pt-2 sm:px-6">
          {active ? (
            <div className="flex flex-col gap-6 pt-3">
              {convoLead && <LeadBar lead={convoLead} now={data?.at ?? 0} />}
              {active.messages.map((m, i) => {
                const last = i === active.messages.length - 1 && !streamingHere
                if (m.role === 'user') return <UserTurn key={i} m={m} />
                const ask = [...active.messages.slice(0, i)].reverse().find(x => x.role === 'user')
                const l = (ask?.leadId && byId.get(ask.leadId)) || convoLead || undefined
                return (
                  <AssistantTurn key={i} id={`${active.id}:${i}`} m={m} last={last} lead={l ?? undefined}
                    copied={copied} onCopy={copyText} onSave={saveScript} onRetry={retry} onSent={afterSend}
                    onPickLead={() => setMenu('lead')}
                    onAsk={s => send(s, { mode: inferMode(s, m.mode), leadId: active.leadId ?? null })} />
                )
              })}
              {streamingHere && live && (
                <AssistantTurn id={`${live.cid}:live`} streaming raw={live.text} thinkingAbout={live.leadName}
                  m={{ role: 'assistant', content: '' }} last={false} lead={convoLead ?? undefined}
                  copied={copied} onCopy={copyText} onSave={saveScript} onRetry={retry} onSent={afterSend}
                  onPickLead={() => setMenu('lead')} onAsk={() => {}} />
              )}
            </div>
          ) : (
            <Welcome name={data?.name ?? null} total={data?.total ?? null} model={model} loading={!data && !loadError}
              loadError={loadError} onReload={load} starters={starters} onStart={startWith}
              onPickLead={id => pickLead(id)} />
          )}
        </div>
      </div>

      {/* ── Composer ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pb-3 pt-1 sm:px-6 sm:pb-4">
        <div className="relative mx-auto w-full max-w-[760px]">
          {menu && <button type="button" aria-label="Close menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenu(null)} />}
          {menu === 'lead' && (
            <LeadPicker leads={data?.leads ?? []} priority={model?.priority ?? []} selected={leadId}
              onPick={id => pickLead(id)} onClose={() => setMenu(null)} />
          )}
          {menu === 'mode' && (
            <div role="menu" className="absolute bottom-full left-0 z-30 mb-2 w-[300px] max-w-full overflow-hidden rounded-[16px] border bg-white p-1.5 shadow-[0_20px_40px_-12px_rgba(16,24,40,0.22)]" style={{ borderColor: BORDER }}>
              <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>Answer as</p>
              {MODES.map(m => (
                <button key={m.id} type="button" role="menuitemradio" aria-checked={m.id === mode}
                  onClick={() => { setMode(m.id); setMenu(null); focusInput() }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-[#F5F7FB]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[9px]" style={{ background: `${m.color}12`, color: m.color }}><m.Icon size={16} weight="duotone" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold" style={{ color: TEXT }}>{m.label}</span>
                    <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{m.hint}</span>
                  </span>
                  {m.id === mode && <Check size={15} weight="bold" style={{ color: BLUE }} />}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-[20px] p-[1.5px] shadow-[0_14px_36px_-14px_rgba(29,78,216,0.28)] transition-[background-image] duration-300"
            style={{ backgroundImage: focused ? RING_ON : RING }}>
            <div className="rounded-[18.5px] bg-white px-3 pb-2.5 pt-2.5 sm:px-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => setMenu(menu === 'lead' ? null : 'lead')} aria-expanded={menu === 'lead'}
                  className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] font-medium transition-colors hover:bg-[#F2F4F7]"
                  style={{ color: MUTED }}>
                  <UserPlus size={14} />{lead ? 'Change lead' : 'Add lead'}
                </button>
                {lead && (
                  <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border pl-1 pr-1.5 text-[12.5px] font-medium" style={{ borderColor: BLUE_LN, color: BLUE, background: BLUE_BG }}>
                    <LeadAvatar lead={lead} size={20} badge={false} />
                    <span className="truncate">{displayName(lead)}</span>
                    <span className="shrink-0 tabular-nums opacity-70">{getCsId(lead)}</span>
                    <button type="button" aria-label="Remove lead" onClick={() => pickLead(null)} className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-white">
                      <X size={11} weight="bold" />
                    </button>
                  </span>
                )}
              </div>
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={e => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } }}
                placeholder={lead && mode === 'advice' ? `Ask anything about ${firstName(lead)}…` : curMode.placeholder}
                aria-label="Ask the Advisor"
                className="mt-1 block max-h-[168px] min-h-[48px] w-full resize-none bg-transparent px-1 py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-[#98A2B3]"
                style={{ color: TEXT }}
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <button type="button" onClick={() => setMenu(menu === 'mode' ? null : 'mode')} aria-expanded={menu === 'mode'} aria-haspopup="menu"
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[9px] px-2 text-[13px] font-semibold transition-colors hover:bg-[#F2F4F7]"
                    style={{ color: TEXT_2 }}>
                    <curMode.Icon size={16} weight="duotone" style={{ color: curMode.color }} />
                    {curMode.label}
                    <CaretDown size={12} weight="bold" style={{ color: LABEL }} />
                  </button>
                  {canListen && (
                    <button type="button" onClick={toggleVoice} aria-label={listening ? 'Stop dictation' : 'Dictate'} aria-pressed={listening}
                      className={`grid size-8 cursor-pointer place-items-center rounded-[9px] transition-colors ${listening ? 'bg-[#FEF3F2] text-[#D92D20]' : 'text-[#667085] hover:bg-[#F2F4F7]'}`}>
                      <Microphone size={16} weight={listening ? 'fill' : 'regular'} className={listening ? 'animate-pulse' : ''} />
                    </button>
                  )}
                </div>
                {live ? (
                  <button type="button" onClick={stop}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[11px] border px-3 text-[13.5px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                    style={{ borderColor: BORDER_2, color: TEXT_2 }}>
                    <Stop size={14} weight="fill" />Stop
                  </button>
                ) : (
                  <button type="button" onClick={() => send(input)} disabled={!input.trim()}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[11px] px-3.5 text-[13.5px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.6)] transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    style={{ backgroundImage: BRAND }}>
                    <span className="max-sm:hidden">Ask Advisor</span><ArrowUp size={15} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11.5px] leading-snug max-sm:hidden" style={{ color: LABEL }}>
            Answers use your CRM data and can be wrong. Check names and numbers before you send.
          </p>
        </div>
      </div>

      {drawer && (
        <Drawer tab={drawer} onTab={setDrawer} onClose={() => setDrawer(null)} now={drawerNow}
          convos={convos} activeId={activeId} onOpen={openConvo} onDelete={deleteConvo}
          saved={saved} copied={copied} onCopy={copyText}
          onUse={t => { setInput(`Adapt this saved ${t.kind === 'call' ? 'script' : 'message'} for ${lead ? firstName(lead) : 'my lead'}:\n\n${t.content}`); setDrawer(null); focusInput() }}
          onDeleteSaved={id => setSaved(p => p.filter(s => s.id !== id))} />
      )}

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
        @keyframes adv-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
        @keyframes adv-shine { from { background-position: 200% 0 } to { background-position: -200% 0 } }
        @keyframes adv-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes adv-caret { 50% { opacity: 0 } }
        .adv-in { animation: adv-in .28s ease-out both }
        .adv-dot { animation: adv-dot 1.2s ease-in-out infinite }
        .adv-shine { background: linear-gradient(90deg, #667085 0%, #667085 40%, #1D4ED8 50%, #667085 60%, #667085 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: adv-shine 2.4s linear infinite }
        .adv-caret { animation: adv-caret 1s step-end infinite }
        @media (prefers-reduced-motion: reduce) { .adv-in, .adv-dot, .adv-shine, .adv-caret { animation: none } .adv-shine { color: #667085 } }
      `}</style>
    </div>
  )
}

// ─── Header pill ──────────────────────────────────────────────────────────────
function NavPill({ icon: I, label, count, onClick }: { icon: Icon; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border px-2.5 text-[13.5px] font-medium transition-colors hover:bg-[#F2F4F7] sm:px-3"
      style={{ borderColor: BORDER, background: '#FAFBFC', color: TEXT_2 }}>
      <I size={16} style={{ color: SUBTLE }} />
      <span className="max-sm:hidden">{label}</span>
      {!!count && <span className="rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums max-sm:hidden" style={{ background: '#EEF1F6', color: SUBTLE }}>{count}</span>}
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function Welcome({ name, total, model, loading, loadError, onReload, starters, onStart, onPickLead }: {
  name: string | null
  total: number | null
  model: ReturnType<typeof buildModel> | null
  loading: boolean
  loadError: string | null
  onReload: () => void
  starters: Starter[]
  onStart: (s: Starter) => void
  onPickLead: (id: string) => void
}) {
  const s = model?.stats
  const tiles: { icon: Icon; tone: string; value: string; label: string; ask: string; off: boolean }[] = s ? [
    { icon: Fire, tone: '#EF6820', value: String(s.hot), label: 'Hot leads to close', off: !s.hot,
      ask: `Which of my ${s.hot} Hot leads should I push first today, and what exactly should I say to each?` },
    { icon: UserPlus, tone: BLUE, value: String(s.fresh), label: 'New leads to call', off: !s.fresh,
      ask: `I have ${s.fresh} New leads. Who should I call first, and what's my opening line?` },
    { icon: HourglassMedium, tone: '#B54708', value: String(s.quiet), label: `Quiet for ${QUIET_DAYS}+ days`, off: !s.quiet,
      ask: `${s.quiet} of my leads have had no update in ${QUIET_DAYS}+ days. Which are worth reviving, and what should I send them?` },
    { icon: CurrencyInr, tone: '#067647', value: inr(s.pipeline), label: 'Open pipeline', off: !s.pipeline,
      ask: 'Where is the most money in my open pipeline, and what moves it forward this week?' },
  ] : []
  const picks = (model?.priority ?? []).slice(0, 5)

  return (
    <section className="adv-in flex flex-col items-center pt-6 text-center sm:pt-[5vh]">
      <h2 className="max-w-[560px] text-balance text-[27px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[32px]">
        {name ? `Hi ${name}, what` : 'What'} are we <em className="bg-clip-text pr-1 text-transparent" style={{ backgroundImage: BRAND }}>closing</em> today?
      </h2>
      <p className="mt-2.5 max-w-[520px] text-pretty text-[15px] leading-relaxed" style={{ color: MUTED }}>
        I can see {total != null ? `all ${total.toLocaleString('en-IN')} of your leads` : 'your leads'}: stage, budget and history. Ask about anyone by name or CS ID, or start from one of these.
      </p>

      {loadError && (
        <div className="mt-6 flex w-full max-w-[560px] items-center gap-3 rounded-[14px] border px-4 py-3 text-left text-[13.5px]" style={{ borderColor: '#FECDCA', background: '#FEF3F2', color: '#B42318' }}>
          <Warning size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">Your leads didn&apos;t load, so answers won&apos;t use your data yet.</span>
          <button type="button" onClick={onReload} className="shrink-0 cursor-pointer font-semibold underline-offset-2 hover:underline">Try again</button>
        </div>
      )}

      {(loading || tiles.length > 0) && (
        <div className="mt-7 grid w-full grid-cols-2 gap-2.5 md:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[66px] animate-pulse rounded-[14px]" style={{ background: SOFT }} />)
            : tiles.map(t => (
              <button key={t.label} type="button" disabled={t.off} onClick={() => onStart({ text: t.ask, mode: 'advice' })} title={t.off ? undefined : t.ask}
                className="group relative flex cursor-pointer items-center gap-3 rounded-[14px] border bg-white px-3 py-3 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-[#B2CCFF] hover:shadow-[0_10px_24px_-14px_rgba(29,78,216,0.45)] disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:border-[#EAECF0] disabled:hover:shadow-none sm:px-3.5"
                style={{ borderColor: BORDER }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px]" style={{ background: `${t.tone}14`, color: t.tone }}><t.icon size={17} weight="duotone" /></span>
                <span className="min-w-0">
                  <span className="block text-[18px] font-semibold leading-tight tabular-nums tracking-[-0.02em]" style={{ color: TEXT }}>{t.value}</span>
                  <span className="block text-[12.5px] leading-snug" style={{ color: SUBTLE }}>{t.label}</span>
                </span>
                <ArrowUpRight size={13} className="absolute right-2.5 top-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-0" style={{ color: BLUE }} />
              </button>
            ))}
        </div>
      )}

      <div className="mt-6 w-full text-left">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>Try asking</p>
        <div className="flex flex-col items-start gap-1.5">
          {starters.map(s => <Suggestion key={s.text} text={s.text} onClick={() => onStart(s)} />)}
        </div>
      </div>

      {picks.length > 0 && (
        <div className="mt-6 w-full text-left">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>Or ask about a lead</p>
          <div className="flex flex-wrap gap-2">
            {picks.map(l => (
              <button key={l.id} type="button" onClick={() => onPickLead(l.id)}
                className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2.5 text-[13px] font-medium transition-colors hover:border-[#B2CCFF] hover:bg-[#F5F8FF]"
                style={{ borderColor: BORDER, color: TEXT_2 }}>
                <LeadAvatar lead={l} size={24} badge={false} />
                <span className="truncate">{displayName(l)}</span>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: STAGE[stageOf(l.status)].dot }} title={STAGE[stageOf(l.status)].label} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Suggestion({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex max-w-full cursor-pointer items-start gap-2 rounded-[10px] px-3 py-2 text-left text-[14px] font-medium leading-snug transition-colors hover:bg-[#EAF0FF]"
      style={{ background: SOFT, color: BLUE }}>
      <Sparkle size={15} className="mt-[2px] shrink-0" />
      <span className="min-w-0">{text}</span>
    </button>
  )
}

// ─── Lead attached to the conversation ────────────────────────────────────────
function LeadBar({ lead, now }: { lead: CRMLead; now: number }) {
  const phone = phone10(lead.phones?.primaryPhoneNumber)
  const meta = [budgetText(lead.budgetMin, lead.budgetMax), lead.propertyType?.[0], lead.city].filter(Boolean).join(' · ')
  const upd = now ? daysSince(lead.updatedAt, now) : undefined
  return (
    <div className="adv-in flex items-center gap-3 rounded-[16px] border bg-white px-3 py-2.5 sm:px-3.5" style={{ borderColor: BORDER }}>
      <LeadAvatar lead={lead} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14.5px] font-semibold" style={{ color: TEXT }}>{displayName(lead)}</span>
          <span className="shrink-0 text-[12px] tabular-nums max-sm:hidden" style={{ color: LABEL }}>{getCsId(lead)}</span>
          <span className="max-sm:hidden"><StagePill stage={stageOf(lead.status)} small /></span>
        </div>
        <p className="truncate text-[12.5px]" style={{ color: SUBTLE }}>
          {meta || 'Needs not recorded yet'}{upd != null && <> · updated {upd === 0 ? 'today' : upd === 1 ? 'yesterday' : `${upd}d ago`}</>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {phone && (
          <>
            <a href={telHref(phone)} aria-label={`Call ${firstName(lead)}`} className="grid size-9 place-items-center rounded-[10px] border transition-colors hover:bg-[#F5F8FF]" style={{ borderColor: BORDER, color: BLUE }}>
              <Phone size={16} weight="fill" />
            </a>
            <a href={waHref(phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${firstName(lead)}`} className="grid size-9 place-items-center rounded-[10px] border transition-colors hover:bg-[#F0FBF4]" style={{ borderColor: BORDER, color: WA }}>
              <WhatsappLogo size={17} weight="fill" />
            </a>
          </>
        )}
        <Link href={`/dashboard/leads/${lead.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-2.5 text-[13px] font-semibold transition-colors hover:bg-[#F9FAFB] max-sm:w-9 max-sm:justify-center max-sm:px-0" style={{ borderColor: BORDER, color: TEXT_2 }} aria-label="Open lead">
          <ArrowSquareOut size={15} /><span className="max-sm:hidden">Open lead</span>
        </Link>
      </div>
    </div>
  )
}

// ─── Turns ────────────────────────────────────────────────────────────────────
function UserTurn({ m }: { m: ChatMessage }) {
  const md = m.mode ? modeOf(m.mode) : null
  return (
    <div className="adv-in flex flex-col items-end gap-1.5">
      <div className="max-w-[86%] whitespace-pre-wrap break-words rounded-[18px] rounded-br-[6px] px-4 py-2.5 text-[14.5px] leading-relaxed" style={{ background: BUBBLE, color: TEXT }}>
        {m.content}
      </div>
      {(m.leadName || md) && (
        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 pr-1 text-[12px] font-medium">
          {m.leadName && <span className="inline-flex items-center gap-1" style={{ color: BLUE }}><UserPlus size={13} />{m.leadName}{m.leadCs && <span className="opacity-60">· {m.leadCs}</span>}</span>}
          {md && <span className="inline-flex items-center gap-1" style={{ color: md.color }}><md.Icon size={13} weight="duotone" />{md.label}</span>}
        </div>
      )}
    </div>
  )
}

function AssistantTurn({ id, m, raw, streaming, thinkingAbout, last, lead, copied, onCopy, onSave, onRetry, onSent, onPickLead, onAsk }: {
  id: string
  m: ChatMessage
  raw?: string
  streaming?: boolean
  thinkingAbout?: string
  last: boolean
  lead?: CRMLead
  copied: string | null
  onCopy: (text: string, key: string) => void
  onSave: (content: string, kind: BlockKind | undefined, leadName: string | undefined, key: string) => void
  onRetry: () => void
  onSent: (lead: CRMLead, kind: BlockKind, text: string) => void
  onPickLead: () => void
  onAsk: (text: string) => void
}) {
  const parsed = streaming ? splitReply(raw ?? '', true) : null
  const body = parsed ? parsed.body : m.content
  const legacyFail = !streaming && /^Failed — /.test(m.content)
  const error = parsed?.error ?? (legacyFail ? m.content.replace(/^Failed — /, '') : m.error ?? (!streaming && !m.content ? 'No reply came back.' : undefined))
  const text = legacyFail ? '' : body
  const next = !streaming && last && !error ? (m.next?.length ? m.next : []) : []
  const thinking = streaming && !text
  const script = text ? primaryScript(text) : null

  return (
    <div className="adv-in relative flex flex-col gap-2 sm:pr-12">
      <div className="rounded-[18px] px-4 py-3.5 sm:px-5 sm:py-4" style={{ background: SOFT }}>
        {thinking ? (
          <div className="flex items-center gap-2 py-0.5 text-[14px]">
            <Sparkle size={15} weight="fill" style={{ color: BLUE }} />
            <span className="adv-shine font-medium">{thinkingAbout ? `Reading ${thinkingAbout}'s history` : 'Looking through your pipeline'}</span>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map(i => <span key={i} className="adv-dot size-1 rounded-full" style={{ background: BLUE, animationDelay: `${i * 0.15}s` }} />)}
            </span>
          </div>
        ) : (
          text && (
            <Rich text={text} streaming={!!streaming} renderScript={(b, i) => (
              <ScriptCard key={i} k={`${id}:b${i}`} kind={kindOf(b.lang)} text={b.body} open={b.open && !!streaming} lead={lead}
                copied={copied} onCopy={onCopy} onSave={onSave} onSent={onSent} onPickLead={onPickLead} />
            )} />
          )
        )}
        {m.stopped && <p className="mt-2 text-[12.5px]" style={{ color: LABEL }}>Stopped</p>}
        {error && !streaming && (
          <div className={`flex items-start gap-2.5 text-[13.5px] ${text ? 'mt-3 border-t pt-3' : ''}`} style={{ borderColor: BORDER, color: '#B42318' }}>
            <Warning size={17} className="mt-px shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            {last && (
              <button type="button" onClick={onRetry} className="inline-flex shrink-0 cursor-pointer items-center gap-1 font-semibold underline-offset-2 hover:underline" style={{ color: BLUE }}>
                <ArrowClockwise size={14} />Try again
              </button>
            )}
          </div>
        )}
      </div>

      {!streaming && text && script && (
        <>
          {/* Floating on wide screens, inline on phones */}
          <div className="absolute right-0 top-1 hidden flex-col gap-1.5 sm:flex">
            <IconBtn label={copied === `${id}:all` ? 'Copied' : 'Copy answer'} onClick={() => onCopy(plain(text), `${id}:all`)}>
              {copied === `${id}:all` ? <Check size={15} weight="bold" style={{ color: GREEN_D }} /> : <Copy size={15} />}
            </IconBtn>
            <IconBtn label={copied === `${id}:save` ? 'Saved' : 'Save script'} onClick={() => onSave(script.content, script.kind, lead ? displayName(lead) : undefined, `${id}:save`)}>
              <BookmarkSimple size={15} weight={copied === `${id}:save` ? 'fill' : 'regular'} style={copied === `${id}:save` ? { color: BLUE } : undefined} />
            </IconBtn>
            {last && !error && <IconBtn label="Write it again" onClick={onRetry}><ArrowClockwise size={15} /></IconBtn>}
          </div>
          <div className="flex items-center gap-1 sm:hidden">
            <SmallBtn onClick={() => onCopy(plain(text), `${id}:all`)}>{copied === `${id}:all` ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === `${id}:all` ? 'Copied' : 'Copy'}</SmallBtn>
            <SmallBtn onClick={() => onSave(script.content, script.kind, lead ? displayName(lead) : undefined, `${id}:save`)}><BookmarkSimple size={13} />Save</SmallBtn>
            {last && !error && <SmallBtn onClick={onRetry}><ArrowClockwise size={13} />Again</SmallBtn>}
          </div>
        </>
      )}

      {next.length > 0 && (
        <div className="flex flex-col items-start gap-1.5 pt-1">
          {next.map(s => <Suggestion key={s} text={s} onClick={() => onAsk(s)} />)}
        </div>
      )}
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="grid size-8 cursor-pointer place-items-center rounded-full border bg-white transition-colors hover:bg-[#F5F8FF]"
      style={{ borderColor: BORDER, color: SUBTLE }}>
      {children}
    </button>
  )
}
function SmallBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[#F2F4F7]" style={{ color: SUBTLE }}>
      {children}
    </button>
  )
}

// ─── Ready-to-send block ──────────────────────────────────────────────────────
function ScriptCard({ k, kind, text, open, lead, copied, onCopy, onSave, onSent, onPickLead }: {
  k: string
  kind: BlockKind
  text: string
  open: boolean
  lead?: CRMLead
  copied: string | null
  onCopy: (text: string, key: string) => void
  onSave: (content: string, kind: BlockKind | undefined, leadName: string | undefined, key: string) => void
  onSent: (lead: CRMLead, kind: BlockKind, text: string) => void
  onPickLead: () => void
}) {
  const b = BLOCK[kind]
  const phone = lead ? phone10(lead.phones?.primaryPhoneNumber) : null
  const email = lead?.emails?.primaryEmail?.trim() || ''
  const subjectLine = kind === 'email' ? text.match(/^\s*subject:\s*(.*)$/im) : null
  const emailBody = subjectLine ? text.replace(subjectLine[0], '').trim() : text
  const isCopied = copied === k

  let action: ReactNode = null
  if (!open && lead && kind !== 'call' && kind !== 'email' && phone) {
    action = (
      <a href={waHref(phone, text)} target="_blank" rel="noopener noreferrer" onClick={() => onSent(lead, 'whatsapp', text)}
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold text-white transition-[filter] hover:brightness-105"
        style={{ background: WA }}>
        <WhatsappLogo size={16} weight="fill" />Send to {firstName(lead)}
      </a>
    )
  } else if (!open && lead && kind === 'call' && phone) {
    action = (
      <a href={telHref(phone)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold text-white transition-[filter] hover:brightness-110" style={{ background: BLUE }}>
        <Phone size={15} weight="fill" />Call {firstName(lead)}
      </a>
    )
  } else if (!open && lead && kind === 'email' && email) {
    action = (
      <a href={`mailto:${email}?subject=${encodeURIComponent(subjectLine?.[1] ?? '')}&body=${encodeURIComponent(emailBody)}`} onClick={() => onSent(lead, 'email', text)}
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold text-white transition-[filter] hover:brightness-110" style={{ background: '#5925DC' }}>
        <EnvelopeSimple size={15} weight="fill" />Email {firstName(lead)}
      </a>
    )
  } else if (!open && !lead && (kind === 'whatsapp' || kind === 'call')) {
    action = (
      <button type="button" onClick={onPickLead} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-semibold transition-colors hover:bg-[#F5F8FF]" style={{ color: BLUE }}>
        <UserPlus size={15} />Add a lead to {kind === 'call' ? 'call' : 'send'} it in one tap
      </button>
    )
  }

  return (
    <div className="my-3 overflow-hidden rounded-[14px] border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2" style={{ borderColor: BORDER }}>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: b.color }}>
          <b.Icon size={15} weight="duotone" />{b.label}
        </span>
        {!open && (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => onSave(text, kind, lead ? displayName(lead) : undefined, `${k}:s`)} aria-label="Save"
              className="grid size-7 cursor-pointer place-items-center rounded-[7px] transition-colors hover:bg-[#F2F4F7]" style={{ color: copied === `${k}:s` ? BLUE : SUBTLE }}>
              <BookmarkSimple size={14} weight={copied === `${k}:s` ? 'fill' : 'regular'} />
            </button>
            <button type="button" onClick={() => onCopy(text, k)}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[7px] px-2 text-[12.5px] font-semibold transition-colors hover:bg-[#F2F4F7]" style={{ color: isCopied ? GREEN_D : TEXT_2 }}>
              {isCopied ? <Check size={13} weight="bold" /> : <Copy size={13} />}{isCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
      <div className="whitespace-pre-wrap break-words px-4 py-3 text-[14px] leading-[1.65]" style={{ color: TEXT }}>
        {subjectLine ? <><span className="font-semibold">Subject: {subjectLine[1]}</span>{'\n\n'}{emailBody}</> : text}
        {open && <span className="adv-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] rounded-full" style={{ background: BLUE }} />}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: BORDER, background: '#FCFCFD' }}>{action}</div>}
    </div>
  )
}

// ─── Light markdown ───────────────────────────────────────────────────────────
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).filter(Boolean).map((p, i) => {
    if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold" style={{ color: TEXT }}>{p.slice(2, -2)}</strong>
    if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded-[5px] px-1 py-px text-[0.92em]" style={{ background: '#EAEEF5', color: TEXT }}>{p.slice(1, -1)}</code>
    return <Fragment key={i}>{p}</Fragment>
  })
}
const Caret = () => <span className="adv-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] rounded-full" style={{ background: BLUE }} />

function MdText({ text, caret }: { text: string; caret: boolean }) {
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n')
  const out: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    const end = caret && i === lines.length - 1 ? <Caret /> : null
    if (!t) { out.push(<div key={i} className="h-1.5" />); continue }
    if (t.startsWith('|') && t.endsWith('|')) {
      const rows: string[][] = []
      let j = i
      for (; j < lines.length && lines[j].trim().startsWith('|'); j++) {
        const cells = lines[j].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells)
      }
      out.push(
        <div key={i} className="my-1 overflow-x-auto rounded-[10px] border bg-white" style={{ borderColor: BORDER }}>
          <table className="w-full text-left text-[13.5px]">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri ? 'border-t' : ''} style={{ borderColor: BORDER }}>
                  {r.map((c, ci) => ri === 0
                    ? <th key={ci} className="px-3 py-2 font-semibold" style={{ color: TEXT, background: '#FAFBFC' }}>{inline(c)}</th>
                    : <td key={ci} className="px-3 py-2 align-top" style={{ color: TEXT_2 }}>{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      i = j - 1
      continue
    }
    const h = t.match(/^#{1,4}\s+(.*)$/)
    if (h) { out.push(<p key={i} className="mt-2 text-[15px] font-semibold first:mt-0" style={{ color: TEXT }}>{inline(h[1].replace(/\*\*/g, ''))}{end}</p>); continue }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { out.push(<hr key={i} className="my-2" style={{ borderColor: BORDER }} />); continue }
    const b = line.match(/^(\s*)[-*•]\s+(.*)$/)
    if (b) {
      out.push(
        <div key={i} className="flex gap-2.5" style={{ paddingLeft: b[1].length >= 2 ? 18 : 0 }}>
          <span className="mt-[10px] size-[5px] shrink-0 rounded-full" style={{ background: BLUE }} />
          <span className="min-w-0">{inline(b[2])}{end}</span>
        </div>,
      )
      continue
    }
    const n = t.match(/^(\d+)[.)]\s+(.*)$/)
    if (n) {
      out.push(
        <div key={i} className="flex gap-2">
          <span className="min-w-[18px] shrink-0 font-semibold tabular-nums" style={{ color: BLUE }}>{n[1]}.</span>
          <span className="min-w-0">{inline(n[2])}{end}</span>
        </div>,
      )
      continue
    }
    out.push(<p key={i}>{inline(line)}{end}</p>)
  }
  return <div className="flex flex-col gap-1">{out}</div>
}

function Rich({ text, streaming, renderScript }: { text: string; streaming: boolean; renderScript: (b: Extract<Block, { type: 'code' }>, i: number) => ReactNode }) {
  const blocks = splitBlocks(text)
  return (
    <div className="break-words text-[14.5px] leading-[1.7]" style={{ color: TEXT_2 }}>
      {blocks.map((b, i) => (b.type === 'code'
        ? renderScript(b, i)
        : <MdText key={i} text={b.body} caret={streaming && i === blocks.length - 1} />))}
    </div>
  )
}

// ─── Lead picker ──────────────────────────────────────────────────────────────
function LeadPicker({ leads, priority, selected, onPick, onClose }: {
  leads: CRMLead[]
  priority: CRMLead[]
  selected: string | null
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const digits = query.replace(/\D/g, '')
  const results = query
    ? leads.filter(l => displayName(l).toLowerCase().includes(query)
        || getCsId(l).toLowerCase().includes(query.replace(/\s/g, ''))
        || (digits.length >= 4 && (l.phones?.primaryPhoneNumber ?? '').replace(/\D/g, '').includes(digits))).slice(0, 30)
    : priority.slice(0, 8)
  const csLike = /^cs\s?-?\s?\d{3,8}$/i.test(query)

  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-[440px] overflow-hidden rounded-[16px] border bg-white shadow-[0_20px_40px_-12px_rgba(16,24,40,0.22)]" style={{ borderColor: BORDER }}>
      <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: BORDER }}>
        <MagnifyingGlass size={16} style={{ color: LABEL }} />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, CS ID or phone"
          onKeyDown={e => { if (e.key === 'Enter' && results[0]) onPick(results[0].id); if (e.key === 'Escape') onClose() }}
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#98A2B3]" style={{ color: TEXT }} aria-label="Search leads" />
      </div>
      <div className="max-h-[320px] overflow-y-auto p-1.5 [scrollbar-width:thin]">
        {!query && results.length > 0 && <p className="px-2.5 pb-1 pt-1 text-[11.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>Worth a conversation</p>}
        {results.map(l => (
          <button key={l.id} type="button" onClick={() => onPick(l.id)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-[#F5F7FB]"
            style={l.id === selected ? { background: BLUE_BG } : undefined}>
            <LeadAvatar lead={l} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold" style={{ color: TEXT }}>{displayName(l)}</span>
              <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{getCsId(l)}{l.city ? ` · ${l.city}` : ''}{l.propertyType?.[0] ? ` · ${l.propertyType[0]}` : ''}</span>
            </span>
            <StagePill stage={stageOf(l.status)} small />
          </button>
        ))}
        {query && results.length === 0 && (
          <p className="px-3 py-4 text-center text-[13.5px] leading-relaxed" style={{ color: SUBTLE }}>
            No lead matches &ldquo;{q.trim()}&rdquo; in your latest {leads.length} leads.
            {csLike && <><br />Type <span className="font-semibold" style={{ color: TEXT }}>{q.trim().toUpperCase()}</span> in your question and I&apos;ll look it up.</>}
          </p>
        )}
        {!query && results.length === 0 && <p className="px-3 py-4 text-center text-[13.5px]" style={{ color: SUBTLE }}>No open leads yet.</p>}
      </div>
    </div>
  )
}

// ─── History and saved scripts ────────────────────────────────────────────────
function Drawer({ tab, onTab, onClose, now, convos, activeId, onOpen, onDelete, saved, copied, onCopy, onUse, onDeleteSaved }: {
  tab: 'history' | 'saved'
  onTab: (t: 'history' | 'saved') => void
  onClose: () => void
  now: number
  convos: Conversation[]
  activeId: string | null
  onOpen: (c: Conversation) => void
  onDelete: (id: string) => void
  saved: SavedTemplate[]
  copied: string | null
  onCopy: (text: string, key: string) => void
  onUse: (t: SavedTemplate) => void
  onDeleteSaved: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const chats = [...convos]
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .filter(c => !query || c.title.toLowerCase().includes(query) || c.messages.some(m => m.content.toLowerCase().includes(query)))
  const scripts = saved.filter(s => !query || s.content.toLowerCase().includes(query) || (s.leadName ?? '').toLowerCase().includes(query))
  const sod = new Date(now); sod.setHours(0, 0, 0, 0)
  const groups = [
    { label: 'Today', items: chats.filter(c => (c.updatedAt ?? c.createdAt) >= sod.getTime()) },
    { label: 'Earlier', items: chats.filter(c => (c.updatedAt ?? c.createdAt) < sod.getTime()) },
  ].filter(g => g.items.length)

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true" aria-label={tab === 'history' ? 'Chat history' : 'Saved scripts'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-[#101828]/25" />
      <aside className="adv-in relative flex h-full w-full max-w-[400px] flex-col bg-white shadow-[-20px_0_40px_-16px_rgba(16,24,40,0.25)]">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: BORDER }}>
          <div className="flex rounded-[10px] p-0.5" style={{ background: '#F2F4F7' }}>
            {(['history', 'saved'] as const).map(t => (
              <button key={t} type="button" onClick={() => onTab(t)} aria-pressed={tab === t}
                className={`h-8 cursor-pointer rounded-[8px] px-3 text-[13.5px] font-semibold transition-colors ${tab === t ? 'bg-white shadow-[0_1px_2px_rgba(16,24,40,0.08)]' : ''}`}
                style={{ color: tab === t ? TEXT : SUBTLE }}>
                {t === 'history' ? `Chats · ${convos.length}` : `Saved · ${saved.length}`}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 cursor-pointer place-items-center rounded-[10px] transition-colors hover:bg-[#F2F4F7]" style={{ color: SUBTLE }}>
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pb-1 pt-3">
          <div className="flex h-10 items-center gap-2 rounded-[10px] border px-3" style={{ borderColor: BORDER_2 }}>
            <MagnifyingGlass size={16} style={{ color: LABEL }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'history' ? 'Search chats' : 'Search saved scripts'}
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#98A2B3]" style={{ color: TEXT }} aria-label="Search" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2 [scrollbar-width:thin]">
          {tab === 'history' ? (
            groups.length ? groups.map(g => (
              <div key={g.label} className="mb-2">
                <p className="px-2.5 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: LABEL }}>{g.label}</p>
                {g.items.map(c => {
                  const leadName = [...c.messages].reverse().find(m => m.leadName)?.leadName
                  return (
                    <div key={c.id} className="group flex items-center gap-1 rounded-[10px] transition-colors hover:bg-[#F5F7FB]" style={c.id === activeId ? { background: BLUE_BG } : undefined}>
                      <button type="button" onClick={() => onOpen(c)} className="min-w-0 flex-1 cursor-pointer px-2.5 py-2 text-left">
                        <span className="block truncate text-[14px] font-medium" style={{ color: c.id === activeId ? BLUE : TEXT }}>{c.title}</span>
                        <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>
                          {ago(c.updatedAt ?? c.createdAt, now)}{leadName ? ` · ${leadName}` : ''} · {c.messages.filter(m => m.role === 'user').length} {c.messages.filter(m => m.role === 'user').length === 1 ? 'question' : 'questions'}
                        </span>
                      </button>
                      <button type="button" onClick={() => onDelete(c.id)} aria-label={`Delete ${c.title}`}
                        className="mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] opacity-60 transition-[opacity,background-color] hover:bg-[#FEF3F2] hover:text-[#D92D20] hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        style={{ color: SUBTLE }}>
                        <Trash size={15} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )) : (
              <Empty icon={<ClockCounterClockwise size={20} />} text={query ? 'No chats match that search.' : 'Your chats will show up here.'} />
            )
          ) : (
            scripts.length ? (
              <div className="flex flex-col gap-2 px-2">
                {scripts.map(s => {
                  const b = BLOCK[s.kind ?? 'text']
                  const key = `saved:${s.id}`
                  return (
                    <div key={s.id} className="rounded-[14px] border p-3" style={{ borderColor: BORDER }}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                        <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold" style={{ color: b.color }}>
                          <b.Icon size={14} weight="duotone" /><span className="truncate">{b.label}{s.leadName ? ` · ${s.leadName}` : ''}</span>
                        </span>
                        <span className="shrink-0" style={{ color: LABEL }}>{ago(s.savedAt, now)}</span>
                      </div>
                      <p className="line-clamp-4 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: TEXT_2 }}>{s.content}</p>
                      <div className="mt-2 flex items-center gap-1">
                        <SmallBtn onClick={() => onCopy(s.content, key)}>{copied === key ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === key ? 'Copied' : 'Copy'}</SmallBtn>
                        <SmallBtn onClick={() => onUse(s)}><NotePencil size={13} />Adapt</SmallBtn>
                        <span className="flex-1" />
                        <button type="button" onClick={() => onDeleteSaved(s.id)} aria-label="Delete saved script"
                          className="grid size-8 cursor-pointer place-items-center rounded-[8px] transition-colors hover:bg-[#FEF3F2] hover:text-[#D92D20]" style={{ color: LABEL }}>
                          <Trash size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty icon={<BookmarkSimple size={20} />} text={query ? 'Nothing saved matches that search.' : 'Tap the bookmark on any answer to keep a script here.'} />
            )
          )}
        </div>
      </aside>
    </div>
  )
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-full" style={{ background: SOFT, color: LABEL }}>{icon}</span>
      <p className="text-[13.5px]" style={{ color: SUBTLE }}>{text}</p>
    </div>
  )
}
