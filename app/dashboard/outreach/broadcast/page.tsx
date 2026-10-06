'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  WhatsappLogo, UsersThree, PaperPlaneTilt, Check, CaretLeft, CaretRight, CaretDown, CaretUp, ArrowCounterClockwise,
  Buildings, CalendarCheck, Confetti, ChartLineUp, ChatCircleText, NotePencil, CircleNotch, WarningCircle,
  MagnifyingGlass, Info,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import {
  OUTREACH_TABS, CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, XS,
  STAGE, stageOf, type StageId, Avatar, StagePill, Pill, Btn, Chip, Field, Select, inputCls, inputStyle, textareaCls,
  PageHeader, Badge, Panel, Insight, Dialog, Toast, useToast, MergeTagBar, WaPhone, WaBubble, personalise, usesTag,
  SAMPLE_MERGE, pct,
} from '@/components/outreach/OutreachKit'

// ─── Audience ─────────────────────────────────────────────────────────────────
type StageFilter = 'open' | 'New' | 'Cold' | 'Warm' | 'Hot' | 'all'
const STAGE_CHIPS: { id: StageFilter; label: string; hint: string }[] = [
  { id: 'open', label: 'All open leads', hint: 'New, Cold, Warm and Hot' },
  { id: 'New',  label: 'New',  hint: STAGE.New.meaning },
  { id: 'Cold', label: 'Cold', hint: STAGE.Cold.meaning },
  { id: 'Warm', label: 'Warm', hint: STAGE.Warm.meaning },
  { id: 'Hot',  label: 'Hot',  hint: STAGE.Hot.meaning },
  { id: 'all',  label: 'Everyone', hint: 'Includes closed, dropped and on-hold leads' },
]

// value = text the API matches inside the lead's source (case and punctuation ignored)
const SOURCES: [string, string][] = [
  ['', 'All sources'], ['magicbricks', 'MagicBricks'], ['99acres', '99acres'], ['housing', 'Housing.com'],
  ['nobroker', 'NoBroker'], ['facebook', 'Facebook'], ['google', 'Google Ads'], ['channel', 'Channel Partner'],
  ['website', 'Website'], ['referral', 'Referral'], ['walk', 'Walk-in'],
]
const PROPERTY_TYPES = ['1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Villa', 'Plot', 'Penthouse', 'Office', 'Shop']

type Intent = 'any' | 'high' | 'medium' | 'low' | 'custom'
const INTENT: Record<Intent, { label: string; min?: number; max?: number }> = {
  any:    { label: 'Any score' },
  high:   { label: 'High intent (70+)', min: 70 },
  medium: { label: 'Medium (40–69)', min: 40, max: 69 },
  low:    { label: 'Low (under 40)', max: 39 },
  custom: { label: 'Custom range' },
}

type Filters = { stage: StageFilter; source: string; city: string; propType: string; intent: Intent; minScore: string; maxScore: string }
const EMPTY: Filters = { stage: 'open', source: '', city: '', propType: '', intent: 'any', minScore: '', maxScore: '' }

/** What the API filters on (GET preview and POST send use the same shape) */
function apiFilters(f: Filters) {
  const out: Record<string, string> = {}
  if (f.stage !== 'all') out.status = f.stage
  if (f.source) out.source = f.source
  if (f.city.trim()) out.city = f.city.trim()
  if (f.propType.trim()) out.propType = f.propType.trim()
  const min = f.intent === 'custom' ? f.minScore : INTENT[f.intent].min?.toString() ?? ''
  const max = f.intent === 'custom' ? f.maxScore : INTENT[f.intent].max?.toString() ?? ''
  if (min) out.minScore = min
  if (max) out.maxScore = max
  return out
}

function audienceLabel(f: Filters) {
  const parts = [STAGE_CHIPS.find(c => c.id === f.stage)!.label]
  if (f.source) parts.push(SOURCES.find(s => s[0] === f.source)?.[1] ?? f.source)
  if (f.city.trim()) parts.push(f.city.trim())
  if (f.propType.trim()) parts.push(f.propType.trim())
  if (f.intent !== 'any') {
    parts.push(f.intent === 'custom'
      ? `Score ${f.minScore || 0}–${f.maxScore || 100}`
      : INTENT[f.intent].label)
  }
  return parts.join(' · ')
}

type Recipient = { id: string; name: string; phone: string; city: string | null; score: number | null; status: string | null }
type Preview = { total: number; reachable: number; leads: Recipient[]; byStatus?: Record<string, number> }

// ─── Message templates ────────────────────────────────────────────────────────
const TEMPLATES: { label: string; icon: ReactNode; body: string }[] = [
  { label: 'New property alert', icon: <Buildings size={18} />, body: `Hi {{name}}! A new property in {{city}} matches what you're looking for, within your budget. Shall I share the details?` },
  { label: 'Site visit invite',  icon: <CalendarCheck size={18} />, body: `Hi {{name}}, we're organising a site visit this weekend for a project in {{city}}. It's a good chance to see the homes in person. Would you like to join?` },
  { label: 'Festival offer',     icon: <Confetti size={18} />, body: `Hi {{name}}, festive greetings from our team! There are festive offers on select projects in {{city}} this month. Want me to send you the ones that fit your budget?` },
  { label: 'Market update',      icon: <ChartLineUp size={18} />, body: `Hi {{name}}, a quick update on {{city}}: there are new launches and price revisions in the areas you were looking at. Shall I share the latest options within your budget?` },
  { label: 'Checking in',        icon: <ChatCircleText size={18} />, body: `Hi {{name}}, hope you're doing well! Just checking in on your property search in {{city}}. I have some fresh options that might interest you. Want me to share?` },
]
const WA_LIMIT = 1024

const ROUTES = [
  { id: 'all',   label: 'All agents, in turn', hint: 'Replies are shared out evenly across the team' },
  { id: 'top',   label: 'Top performer',       hint: 'The agent with the highest activity score' },
  { id: 'agent', label: 'A specific agent',    hint: 'Name one agent to take every reply' },
]

async function fetchAudience(f: Filters): Promise<{ data: Preview | null; error: string | null }> {
  try {
    const res = await fetch(`/api/outreach/broadcast?${new URLSearchParams(apiFilters(f))}`)
    const json = await res.json()
    if (!res.ok || json.error) return { data: null, error: json.error ?? 'Could not load the audience' }
    return { data: json.data as Preview, error: null }
  } catch {
    return { data: null, error: 'Could not load the audience. Check your connection and try again.' }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BroadcastPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingAud, setLoadingAud] = useState(true)
  const [audError, setAudError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [message, setMessage] = useState(TEMPLATES[0].body)
  const [template, setTemplate] = useState(0)
  const [previewIdx, setPreviewIdx] = useState(0)
  const [routeTo, setRouteTo] = useState('all')
  const [routeAgent, setRouteAgent] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; simulated: boolean } | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const reqId = useRef(0)
  const { toast, show: showToast, hide: hideToast } = useToast()

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setFilters(f => ({ ...f, [k]: v })); setResult(null) }

  // Debounced audience count; only the latest request is applied
  useEffect(() => {
    const id = ++reqId.current
    const t = setTimeout(() => {
      setLoadingAud(true)
      fetchAudience(filters).then(r => {
        if (id !== reqId.current) return
        setLoadingAud(false)
        setAudError(r.error)
        if (r.data) { setPreview(r.data); setPreviewIdx(0) }
      })
    }, 450)
    return () => clearTimeout(t)
  }, [filters, reload])

  const recipients = useMemo(() => preview?.leads ?? [], [preview])
  const reachable = preview?.reachable ?? 0
  const skipped = preview ? preview.total - preview.reachable : 0
  const shown = showAll ? recipients : recipients.slice(0, 8)
  const sample = recipients[previewIdx] ?? null
  const merge = sample ? { name: sample.name, city: sample.city, budget: null } : SAMPLE_MERGE
  const rendered = personalise(message, merge)
  const noCity = recipients.filter(r => !r.city).length
  const tooLong = message.length > WA_LIMIT
  const msgOk = message.trim().length >= 10 && !tooLong
  const canSend = reachable > 0 && msgOk && !sending && !loadingAud && (routeTo !== 'agent' || routeAgent.trim().length > 0)
  const why = loadingAud ? 'Counting your audience…'
    : reachable === 0 ? 'Pick an audience with at least one lead who has a mobile number.'
    : !msgOk ? (tooLong ? `Shorten the message to ${WA_LIMIT.toLocaleString('en-IN')} characters or fewer.` : 'Write a message of at least 10 characters.')
    : routeTo === 'agent' && !routeAgent.trim() ? 'Name the agent who should take the replies.'
    : null

  // Stage counts cover the whole audience (the list below shows up to 50)
  const stageMix = useMemo(() => {
    const m = new Map<StageId, number>()
    if (preview?.byStatus) for (const [st, n] of Object.entries(preview.byStatus)) m.set(stageOf(st), (m.get(stageOf(st)) ?? 0) + n)
    else for (const r of recipients) m.set(stageOf(r.status), (m.get(stageOf(r.status)) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [preview, recipients])

  const pickTemplate = (i: number) => {
    setTemplate(i)
    setMessage(i >= 0 ? TEMPLATES[i].body : '')
    setResult(null)
    if (i < 0) requestAnimationFrame(() => textRef.current?.focus())
  }

  const reset = () => {
    setFilters(EMPTY); setTemplate(0); setMessage(TEMPLATES[0].body); setRouteTo('all'); setRouteAgent('')
    setResult(null); setSendError(null); setShowAll(false)
  }

  const send = useCallback(async () => {
    setConfirm(false); setSending(true); setSendError(null); setResult(null)
    try {
      const res = await fetch('/api/outreach/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: apiFilters(filters),
          templateName: 'custom',
          messageBody: message,
          routing: { mode: routeTo, agent: routeTo === 'agent' ? routeAgent.trim() : null },
        }),
      })
      const json = await res.json().catch(() => ({}))
      const err: string | null = json.error ?? (res.ok ? null : 'Broadcast failed')
      if (err && /interakt|not configured/i.test(err)) {
        // Interakt isn't connected yet: nothing leaves the CRM
        setResult({ sent: reachable, failed: 0, simulated: true })
        showToast({ text: 'Test run finished. Nothing was sent.', tone: 'ok' })
      } else if (err) {
        setSendError(err)
      } else {
        const sent = json.data?.sent ?? 0, failed = json.data?.failed ?? 0
        setResult({ sent, failed, simulated: false })
        showToast({ text: `Sent to ${sent.toLocaleString('en-IN')} lead${sent === 1 ? '' : 's'}`, tone: 'ok' })
      }
    } catch {
      setSendError('Could not reach the server. Nothing was sent, please try again.')
    } finally {
      setSending(false)
    }
  }, [filters, message, routeTo, routeAgent, reachable, showToast])

  const steps = [
    { n: 1, title: 'Audience', done: reachable > 0, status: loadingAud ? 'Counting…' : `${reachable.toLocaleString('en-IN')} lead${reachable === 1 ? '' : 's'}`, target: 'audience' },
    { n: 2, title: 'Message', done: msgOk, status: template >= 0 && message === TEMPLATES[template].body ? TEMPLATES[template].label : msgOk ? 'Your own message' : 'Not written yet', target: 'message' },
    { n: 3, title: 'Send', done: !!result, status: result ? (result.simulated ? 'Test run done' : 'Sent') : canSend ? 'Ready to send' : 'Finish steps 1 and 2', target: 'send' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: CANVAS }}>
      <PageTabBar tabs={OUTREACH_TABS} />
      <PageHeader
        title="Broadcast"
        badge={<Badge tone="green"><WhatsappLogo size={15} weight="fill" />WhatsApp</Badge>}
        sub="Pick who gets it, write one message, and send it to all of them on WhatsApp. Every lead sees their own name and city."
        actions={<Btn onClick={reset}><ArrowCounterClockwise size={18} />Start over</Btn>}
      />

      <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
        {/* ── Progress ── */}
        <ol className="m-0 mb-6 grid list-none grid-cols-3 gap-2 p-0 sm:gap-3">
          {steps.map(s => (
            <li key={s.n} className="min-w-0">
              <button type="button" onClick={() => document.getElementById(s.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors hover:bg-[#F9FAFB] sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3"
                style={{ borderColor: s.done ? '#ABEFC6' : BORDER, background: s.done ? '#F6FEF9' : CANVAS, boxShadow: XS }}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold sm:size-8"
                  style={s.done ? { background: '#17B26A', color: '#fff' } : { background: BLUE_BG, color: BLUE, boxShadow: `inset 0 0 0 1px ${BLUE_LN}` }}>
                  {s.done ? <Check size={14} weight="bold" /> : s.n}
                </span>
                <span className="w-full min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold sm:text-[14px]" style={{ color: TEXT }}>{s.title}</span>
                  <span className="hidden truncate text-[12.5px] sm:block" style={{ color: SUBTLE }}>{s.status}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-6">
            {/* ── 1. Audience ── */}
            <Panel id="audience" step={1} title="Choose who gets it" sub="Leads without a valid mobile number are skipped automatically."
              right={JSON.stringify(filters) !== JSON.stringify(EMPTY) && <Btn variant="ghost" size="sm" onClick={() => { setFilters(EMPTY); setResult(null) }}>Clear filters</Btn>}>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Stage">
                {STAGE_CHIPS.map(c => (
                  <span key={c.id} title={c.hint} className="inline-flex">
                    <Chip on={filters.stage === c.id} onClick={() => set('stage', c.id)}
                      icon={c.id !== 'open' && c.id !== 'all' ? <span className="size-2 rounded-full" style={{ background: STAGE[c.id as StageId].dot }} /> : undefined}>
                      {c.label}
                    </Chip>
                  </span>
                ))}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <Field label="Source" htmlFor="b-source">
                  <Select id="b-source" value={filters.source} onChange={v => set('source', v)}>
                    {SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </Field>
                <Field label="City" htmlFor="b-city">
                  <input id="b-city" value={filters.city} onChange={e => set('city', e.target.value)} placeholder="Any city, e.g. Pune" className={inputCls} style={inputStyle} />
                </Field>
                <Field label="Property type" htmlFor="b-prop">
                  <input id="b-prop" list="b-prop-list" value={filters.propType} onChange={e => set('propType', e.target.value)} placeholder="Any, e.g. 3 BHK" className={inputCls} style={inputStyle} />
                  <datalist id="b-prop-list">{PROPERTY_TYPES.map(p => <option key={p} value={p} />)}</datalist>
                </Field>
                <Field label="Intent score" htmlFor="b-intent">
                  <Select id="b-intent" value={filters.intent} onChange={v => set('intent', v as Intent)}>
                    {(Object.keys(INTENT) as Intent[]).map(k => <option key={k} value={k}>{INTENT[k].label}</option>)}
                  </Select>
                </Field>
              </div>
              {filters.intent === 'custom' && (
                <div className="mt-3 flex items-center gap-2.5">
                  <input type="number" min={0} max={100} inputMode="numeric" aria-label="Lowest score" value={filters.minScore} onChange={e => set('minScore', e.target.value)} placeholder="0" className={`${inputCls} max-w-[110px]`} style={inputStyle} />
                  <span className="text-[13px]" style={{ color: SUBTLE }}>to</span>
                  <input type="number" min={0} max={100} inputMode="numeric" aria-label="Highest score" value={filters.maxScore} onChange={e => set('maxScore', e.target.value)} placeholder="100" className={`${inputCls} max-w-[110px]`} style={inputStyle} />
                </div>
              )}

              {/* Recipients */}
              <div className="-mx-4 mt-5 border-t px-4 pt-5 sm:-mx-5 sm:px-5" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    {loadingAud && !preview
                      ? <span className="block h-8 w-16 animate-pulse rounded-[8px] bg-[#F2F4F7]" />
                      : <span className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: TEXT }}>{reachable.toLocaleString('en-IN')}</span>}
                    <span className="text-[14px]" style={{ color: SUBTLE }}>lead{reachable === 1 ? '' : 's'} will get this</span>
                    {loadingAud && preview && <CircleNotch size={16} className="animate-spin self-center" style={{ color: LABEL }} />}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skipped > 0 && <Pill tone="amber">{skipped} skipped, no valid mobile</Pill>}
                    {stageMix.slice(0, 4).map(([s, n]) => (
                      <span key={s} className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: SUBTLE }}>
                        <span className="size-2 rounded-full" style={{ background: STAGE[s].dot }} />{STAGE[s].label} <b className="font-semibold tabular-nums" style={{ color: TEXT_2 }}>{n}</b>
                      </span>
                    ))}
                  </div>
                </div>

                {audError && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3" style={{ background: '#FEF3F2', borderColor: '#FECDCA' }}>
                    <p className="m-0 text-[14px]" style={{ color: '#B42318' }}>{audError}</p>
                    <Btn size="sm" onClick={() => setReload(n => n + 1)}>Try again</Btn>
                  </div>
                )}

                {!audError && !loadingAud && reachable === 0 && (
                  <div className="mt-4 flex flex-col items-center rounded-[12px] border border-dashed px-4 py-8 text-center" style={{ borderColor: BORDER_2 }}>
                    <MagnifyingGlass size={22} style={{ color: LABEL }} />
                    <p className="m-0 mt-2 text-[14px] font-semibold" style={{ color: TEXT }}>No leads match these filters</p>
                    <p className="m-0 mt-1 text-[13px]" style={{ color: SUBTLE }}>Try a wider stage, another source, or clear the city.</p>
                  </div>
                )}

                {recipients.length > 0 && (
                  <>
                    <ul className={`m-0 mt-4 grid list-none gap-1 p-0 md:grid-cols-2 ${showAll ? 'max-h-[420px] overflow-y-auto pr-1' : ''}`}>
                      {shown.map(r => (
                        <li key={r.id}>
                          <button type="button" onClick={() => setPreviewIdx(recipients.indexOf(r))} title="Preview the message for this lead"
                            className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[#F9FAFB]"
                            style={recipients.indexOf(r) === previewIdx ? { background: SURFACE } : undefined}>
                            <Avatar name={r.name} score={r.score} size={34} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold" style={{ color: TEXT }}>{r.name || 'Unnamed'}</span>
                              <span className="block truncate text-[12.5px]" style={{ color: r.city ? SUBTLE : LABEL }}>{r.city ?? 'No city on file'}</span>
                            </span>
                            <StagePill stage={stageOf(r.status)} small />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {recipients.length > 8 && (
                        <button type="button" onClick={() => setShowAll(v => !v)} className="inline-flex cursor-pointer items-center gap-1 text-[13.5px] font-semibold" style={{ color: BLUE }}>
                          {showAll ? <>Show fewer <CaretUp size={13} weight="bold" /></> : <>Show all {recipients.length} <CaretDown size={13} weight="bold" /></>}
                        </button>
                      )}
                      {reachable > recipients.length && (
                        <span className="text-[12.5px]" style={{ color: LABEL }}>and {(reachable - recipients.length).toLocaleString('en-IN')} more not listed here</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Panel>

            {/* ── 2. Message ── */}
            <Panel id="message" step={2} title="Write the message" sub="Start from a template or write your own. Tags fill in each lead's details.">
              <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                {TEMPLATES.map((t, i) => {
                  const on = template === i
                  return (
                    <button key={t.label} type="button" onClick={() => pickTemplate(i)} aria-pressed={on}
                      className="flex min-w-0 cursor-pointer items-start gap-3 rounded-[12px] border p-3 text-left transition-[border-color,box-shadow,background]"
                      style={on ? { borderColor: BLUE, background: BLUE_BG, boxShadow: '0 0 0 3px rgba(29,78,216,0.10)' } : { borderColor: BORDER, background: CANVAS, boxShadow: XS }}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] border bg-white" style={{ borderColor: on ? BLUE_LN : BORDER, color: on ? BLUE : TEXT_2 }}>{t.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold" style={{ color: on ? BLUE : TEXT }}>{t.label}</span>
                        <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>{personalise(t.body, SAMPLE_MERGE)}</span>
                      </span>
                    </button>
                  )
                })}
                <button type="button" onClick={() => pickTemplate(-1)} aria-pressed={template === -1}
                  className="flex min-w-0 cursor-pointer items-center gap-3 rounded-[12px] border border-dashed p-3 text-left transition-colors hover:bg-[#F9FAFB]"
                  style={template === -1 ? { borderColor: BLUE, background: BLUE_BG } : { borderColor: BORDER_2 }}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-[9px] border bg-white" style={{ borderColor: BORDER, color: TEXT_2 }}><NotePencil size={18} /></span>
                  <span>
                    <span className="block text-[14px] font-semibold" style={{ color: template === -1 ? BLUE : TEXT }}>Write your own</span>
                    <span className="block text-[12.5px]" style={{ color: SUBTLE }}>Start from a blank message</span>
                  </span>
                </button>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="b-msg" className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Message</label>
                  <MergeTagBar targetRef={textRef} value={message} onChange={v => { setMessage(v); setResult(null) }} />
                </div>
                <textarea id="b-msg" ref={textRef} value={message} rows={6}
                  onChange={e => { setMessage(e.target.value); setTemplate(TEMPLATES.findIndex(t => t.body === e.target.value)); setResult(null) }}
                  placeholder="Hi {{name}}, …"
                  className={textareaCls} style={{ ...inputStyle, borderColor: tooLong ? '#FDA29B' : BORDER_2 }} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px]" style={{ color: SUBTLE }}>
                  <span>Use <code className="rounded bg-[#F2F4F7] px-1">*bold*</code> and <code className="rounded bg-[#F2F4F7] px-1">_italic_</code> like in WhatsApp.</span>
                  <span className="tabular-nums" style={{ color: tooLong ? '#B42318' : SUBTLE, fontWeight: tooLong ? 600 : 400 }}>
                    {message.length.toLocaleString('en-IN')} / {WA_LIMIT.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </Panel>
          </div>

          {/* ── Right column ── */}
          <div className="grid min-w-0 items-start gap-6 md:grid-cols-2 xl:sticky xl:top-6 xl:flex xl:flex-col xl:items-stretch">
            <Panel title="Preview" sub={sample ? 'Exactly what this lead will see' : 'Shown with sample details'}
              right={recipients.length > 1 && (
                <div className="flex items-center gap-1">
                  <Btn size="sm" label="Previous lead" onClick={() => setPreviewIdx(i => (i - 1 + recipients.length) % recipients.length)}><CaretLeft size={14} weight="bold" /></Btn>
                  <span className="min-w-[44px] text-center text-[12.5px] tabular-nums" style={{ color: SUBTLE }}>{previewIdx + 1}/{recipients.length}</span>
                  <Btn size="sm" label="Next lead" onClick={() => setPreviewIdx(i => (i + 1) % recipients.length)}><CaretRight size={14} weight="bold" /></Btn>
                </div>
              )}>
              <WaPhone contact={sample?.name || 'Rahul Sharma'}>
                {message.trim()
                  ? <WaBubble text={rendered} />
                  : <p className="m-auto text-[13px]" style={{ color: '#667781' }}>Your message will appear here</p>}
              </WaPhone>
              {message.trim() && usesTag(message, 'city') && noCity > 0 && (
                <p className="m-0 mt-3 flex gap-2 text-[12.5px] leading-snug" style={{ color: '#B54708' }}>
                  <WarningCircle size={16} className="mt-px shrink-0" />
                  {noCity} of these {recipients.length} leads have no city on file, so {'{{city}}'} will be left blank for them.
                </p>
              )}
              {message.trim() && usesTag(message, 'budget') && (
                <p className="m-0 mt-3 flex gap-2 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>
                  <Info size={16} className="mt-px shrink-0" />
                  {'{{budget}}'} is filled from each lead&apos;s maximum budget when it&apos;s sent.
                </p>
              )}
            </Panel>

            <Panel id="send" step={3} title="Review and send">
              <dl className="m-0 grid gap-3 text-[13.5px]">
                <div className="flex items-baseline justify-between gap-3">
                  <dt style={{ color: SUBTLE }}>Recipients</dt>
                  <dd className="m-0 text-right text-[15px] font-semibold tabular-nums" style={{ color: TEXT }}>{loadingAud ? '…' : reachable.toLocaleString('en-IN')}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0" style={{ color: SUBTLE }}>Audience</dt>
                  <dd className="m-0 min-w-0 text-right font-medium" style={{ color: TEXT_2 }}>{audienceLabel(filters)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0" style={{ color: SUBTLE }}>Message</dt>
                  <dd className="m-0 min-w-0 truncate text-right font-medium" style={{ color: TEXT_2 }}>{steps[1].status}</dd>
                </div>
              </dl>

              <div className="mt-4 border-t pt-4" style={{ borderColor: BORDER }}>
                <Field label="Replies go to" htmlFor="b-route" hint={ROUTES.find(r => r.id === routeTo)?.hint}>
                  <Select id="b-route" value={routeTo} onChange={setRouteTo}>
                    {ROUTES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </Select>
                </Field>
                {routeTo === 'agent' && (
                  <input value={routeAgent} onChange={e => setRouteAgent(e.target.value)} placeholder="Agent name or email" aria-label="Agent name or email"
                    className={`${inputCls} mt-2.5`} style={inputStyle} />
                )}
              </div>

              <Btn variant="primary" size="lg" className="mt-5 w-full" disabled={!canSend} onClick={() => setConfirm(true)}>
                {sending
                  ? <><CircleNotch size={18} className="animate-spin" />Sending…</>
                  : <><PaperPlaneTilt size={18} weight="fill" />Send to {reachable.toLocaleString('en-IN')} lead{reachable === 1 ? '' : 's'}</>}
              </Btn>
              {why && !sending && <p className="m-0 mt-2 text-center text-[12.5px]" style={{ color: SUBTLE }}>{why}</p>}

              {sendError && <div className="mt-4"><Insight tone="red" icon={<WarningCircle size={15} weight="bold" />} title="The broadcast didn't go out">{sendError}</Insight></div>}
              {result && (
                <div className="mt-4">
                  {result.simulated
                    ? <Insight tone="amber" icon={<Info size={15} weight="bold" />} title="Test run, nothing was sent">
                        WhatsApp sending isn&apos;t connected yet, so no lead got this message. Once Interakt is set up, the same send reaches {result.sent.toLocaleString('en-IN')} lead{result.sent === 1 ? '' : 's'}.
                      </Insight>
                    : <Insight tone="green" icon={<Check size={15} weight="bold" />} title={`Sent to ${result.sent.toLocaleString('en-IN')} lead${result.sent === 1 ? '' : 's'}`}>
                        {result.failed ? `${result.failed} couldn't be delivered.` : 'Every message was accepted for delivery.'}
                      </Insight>}
                </div>
              )}
              <p className="m-0 mt-4 flex gap-2 text-[12.5px] leading-snug" style={{ color: LABEL }}>
                <UsersThree size={16} className="mt-px shrink-0" />
                Sends go through Interakt. Each send is limited to leads with a valid Indian mobile number, and you can send 5 broadcasts an hour.
              </p>
            </Panel>
          </div>
        </div>
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} width={460}
        icon={<PaperPlaneTilt size={20} />}
        title={`Send this to ${reachable.toLocaleString('en-IN')} lead${reachable === 1 ? '' : 's'}?`}
        sub="Everyone in this audience gets it on WhatsApp straight away. You can't unsend it."
        footer={<>
          <Btn onClick={() => setConfirm(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={send}><PaperPlaneTilt size={16} weight="fill" />Send now</Btn>
        </>}>
        <div className="rounded-[12px] p-3" style={{ background: '#EFEAE2' }}>
          <WaBubble text={rendered} />
        </div>
        <dl className="m-0 mt-4 grid gap-2 text-[13.5px]">
          <div className="flex justify-between gap-3"><dt style={{ color: SUBTLE }}>Audience</dt><dd className="m-0 text-right font-medium" style={{ color: TEXT_2 }}>{audienceLabel(filters)}</dd></div>
          <div className="flex justify-between gap-3"><dt style={{ color: SUBTLE }}>Replies go to</dt><dd className="m-0 text-right font-medium" style={{ color: TEXT_2 }}>{routeTo === 'agent' ? routeAgent : ROUTES.find(r => r.id === routeTo)?.label}</dd></div>
          {skipped > 0 && <div className="flex justify-between gap-3"><dt style={{ color: SUBTLE }}>Skipped</dt><dd className="m-0 text-right font-medium" style={{ color: TEXT_2 }}>{skipped} without a valid mobile ({pct(skipped, preview?.total ?? 0)}%)</dd></div>}
        </dl>
      </Dialog>

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}
