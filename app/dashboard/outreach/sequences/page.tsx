'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Plus, Trash, Lightning, WhatsappLogo, EnvelopeSimple, PhoneCall, NotePencil, CaretDown, ArrowUp, ArrowDown,
  ArrowClockwise, CopySimple, MagnifyingGlass, UsersThree, ListNumbers, CalendarBlank, PauseCircle, Eye, EyeSlash,
  CircleNotch, Sparkle, X,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import {
  OUTREACH_TABS, CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, XS, GREEN,
  Btn, Chip, Field, Seg, Badge, PageHeader, StatCard, StackBar, EmptyState, Dialog, Toast, useToast,
  MergeTagBar, WaBubble, EmailCard, personalise, SAMPLE_MERGE, inputCls, inputStyle, textareaCls,
} from '@/components/outreach/OutreachKit'

// ─── Types ────────────────────────────────────────────────────────────────────
type Channel = 'whatsapp' | 'email' | 'call_reminder' | 'note'
type SavedStep = { id: string; step_order: number; delay_days: number; channel: string; message_body: string | null; template_name: string | null }
type Sequence = {
  id: string
  name: string
  description: string | null
  active: boolean
  created_at: string
  sequence_steps: SavedStep[]
  active_enrollments: number
}
// delay_days = days to wait after the step before (the first step: after enrolling). That's how the sequence runner counts.
type DraftStep = { key: string; channel: Channel; delay_days: number; subject: string; body: string }

const CH: Record<Channel, { label: string; short: string; Icon: typeof Plus; color: string; bg: string; border: string; placeholder: string }> = {
  whatsapp:      { label: 'WhatsApp',      short: 'WhatsApp', Icon: WhatsappLogo,   color: '#067647', bg: '#ECFDF3', border: '#ABEFC6', placeholder: 'Hi {{name}}, …' },
  email:         { label: 'Email',         short: 'Email',    Icon: EnvelopeSimple, color: BLUE,      bg: BLUE_BG,   border: BLUE_LN,   placeholder: 'Hi {{name}},\n\n…' },
  call_reminder: { label: 'Call reminder', short: 'Call',     Icon: PhoneCall,      color: '#B54708', bg: '#FFFAEB', border: '#FEDF89', placeholder: 'What this call is for, e.g. confirm budget and book a site visit' },
  note:          { label: 'Note',          short: 'Note',     Icon: NotePencil,     color: TEXT_2,    bg: SURFACE,   border: BORDER,    placeholder: 'An internal note for this step' },
}
const chOf = (c: string): Channel => (c in CH ? c as Channel : 'note')
const CH_ORDER: Channel[] = ['whatsapp', 'email', 'call_reminder', 'note']

let keySeq = 0
const newKey = () => `s${++keySeq}`
const step = (channel: Channel, delay_days: number, body: string, subject = ''): DraftStep => ({ key: newKey(), channel, delay_days, body, subject })

// Starting points. Waits are days after the step before.
const STARTERS: { id: string; name: string; description: string; steps: () => DraftStep[] }[] = [
  {
    id: 'nurture', name: 'New lead nurture', description: 'First week of follow-up for fresh portal enquiries',
    steps: () => [
      step('whatsapp', 0, `Hi {{name}}! Thank you for your interest in properties in {{city}}. I'm your property advisor. Could you share your preferred configuration and budget? I'll shortlist the best options for you right away.`),
      step('call_reminder', 0, 'Intro call. Confirm budget, timeline and preferred localities. Try to call within the hour.'),
      step('email', 1, `Hi {{name}},\n\nThanks for your enquiry. I'm putting together a shortlist of homes in {{city}} that fit what you're looking for. Reply with anything that matters to you, like possession date, floor or facing, and I'll factor it in.\n\nSpeak soon`, 'Your property shortlist for {{city}}'),
      step('whatsapp', 1, `Hi {{name}}, I've shortlisted a few properties in {{city}} that match your requirements. Want me to share the details, or set up a site visit this weekend?`),
      step('call_reminder', 1, 'Second call. Check they saw the shortlist, answer questions and push for a site visit.'),
      step('whatsapp', 4, `Hi {{name}}, just checking in. The options I shared are still available. If you'd like to see any of them, I can arrange a visit at a time that suits you.`),
    ],
  },
  {
    id: 'visit', name: 'Site visit follow-up', description: 'Move leads from a site visit to a booking',
    steps: () => [
      step('whatsapp', 0, `Hi {{name}}, thank you for visiting today! I hope you liked the property. Send me any questions about the unit, pricing or payment plan and I'll get you answers.`),
      step('call_reminder', 1, 'Post-visit call. Get feedback, handle objections on price, location or size, and check where the family discussion stands.'),
      step('email', 2, `Hi {{name}},\n\nThanks again for visiting. As promised, here's a summary of the unit, price and payment options we discussed. Let me know if you'd like a second visit or a call with the developer's team.`, 'Following up on your site visit'),
      step('whatsapp', 4, `Hi {{name}}, following up after your visit. Shall we go over the payment plan options on a quick call this week?`),
    ],
  },
  {
    id: 'reengage', name: 'Cold lead re-engagement', description: 'Win back leads who have gone quiet',
    steps: () => [
      step('whatsapp', 0, `Hi {{name}}, hope you're doing well! We spoke a while back about your property search in {{city}}. I have fresh options that match your requirements. Would you like me to share them?`),
      step('email', 3, `Hi {{name}},\n\nIt's been a while since we spoke about your search in {{city}}. If your plans have changed, no problem at all. If you're still looking, reply to this email and I'll send you a fresh shortlist.`, 'Still looking for a home in {{city}}?'),
      step('whatsapp', 4, `Hi {{name}}, if it helps, I can also connect you with a home loan advisor to check your eligibility. Interested?`),
      step('call_reminder', 7, 'Final re-engagement call. Offer a no-pressure 10-minute consultation. If there is no answer, mark the lead as lost.'),
    ],
  },
]

function toDraft(s: SavedStep): DraftStep {
  const channel = chOf(s.channel)
  return { key: newKey(), channel, delay_days: s.delay_days ?? 0, body: s.message_body ?? '', subject: channel === 'email' ? s.template_name ?? '' : '' }
}
const sortSteps = (seq: Sequence) => [...(seq.sequence_steps ?? [])].sort((a, b) => a.step_order - b.step_order)
/** Day each step runs on, counting from the day the lead is enrolled */
function runDays(delays: number[]) {
  let d = 0
  return delays.map(x => (d += Math.max(0, x || 0)))
}
const dayLabel = (d: number) => (d === 0 ? 'Day 0' : `Day ${d}`)

async function fetchSequences(): Promise<{ list: Sequence[] | null; error: string | null }> {
  try {
    const res = await fetch('/api/outreach/sequences')
    const json = await res.json()
    if (!res.ok || json.error) return { list: null, error: json.error ?? 'Could not load sequences' }
    return { list: json.data?.sequences ?? [], error: null }
  } catch {
    return { list: null, error: 'Could not load sequences. Check your connection and try again.' }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'active' | 'paused'

export default function SequencesPage() {
  const [list, setList] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [builder, setBuilder] = useState<{ title: string; name: string; description: string; steps: DraftStep[]; starter: string | null } | null>(null)
  const [deleting, setDeleting] = useState<Sequence | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast, show: showToast, hide: hideToast } = useToast()

  const apply = useCallback((r: { list: Sequence[] | null; error: string | null }) => {
    setLoading(false)
    setError(r.error)
    if (r.list) setList(r.list)
  }, [])
  useEffect(() => {
    let alive = true
    fetchSequences().then(r => { if (alive) apply(r) })
    return () => { alive = false }
  }, [apply])
  const refresh = () => { setLoading(true); fetchSequences().then(apply) }

  const active = list.filter(s => s.active)
  const enrolled = list.reduce((n, s) => n + (s.active_enrollments ?? 0), 0)
  const channelCount = useMemo(() => {
    const m: Record<Channel, number> = { whatsapp: 0, email: 0, call_reminder: 0, note: 0 }
    for (const s of list) for (const st of s.sequence_steps ?? []) m[chOf(st.channel)]++
    return m
  }, [list])
  const totalSteps = CH_ORDER.reduce((n, c) => n + channelCount[c], 0)

  const shown = list
    .filter(s => filter === 'all' || (filter === 'active' ? s.active : !s.active))
    .filter(s => !search.trim() || `${s.name} ${s.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))

  const openNew = (starter?: string) => {
    const st = STARTERS.find(s => s.id === starter)
    setBuilder({ title: 'New sequence', name: st?.name ?? '', description: st?.description ?? '', steps: st ? st.steps() : [step('whatsapp', 0, '')], starter: st?.id ?? 'blank' })
  }
  const openCopy = (seq: Sequence) => {
    setBuilder({ title: `Copy of ${seq.name}`, name: `${seq.name} (copy)`, description: seq.description ?? '', steps: sortSteps(seq).map(toDraft), starter: null })
  }

  const toggle = async (seq: Sequence, on: boolean) => {
    setBusyId(seq.id)
    setList(l => l.map(s => (s.id === seq.id ? { ...s, active: on } : s)))
    try {
      const res = await fetch(`/api/outreach/sequences/${seq.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: on }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error)
      showToast({ text: on ? `${seq.name} is running again` : `${seq.name} is paused. Its leads won't get new steps.`, tone: 'ok' })
    } catch {
      setList(l => l.map(s => (s.id === seq.id ? { ...s, active: !on } : s)))
      showToast({ text: `Couldn't ${on ? 'resume' : 'pause'} ${seq.name}. Nothing changed.`, tone: 'err' })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (seq: Sequence) => {
    setDeleting(null)
    setBusyId(seq.id)
    try {
      const res = await fetch(`/api/outreach/sequences/${seq.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error)
      setList(l => l.filter(s => s.id !== seq.id))
      showToast({ text: `${seq.name} deleted`, tone: 'ok' })
    } catch {
      showToast({ text: `Couldn't delete ${seq.name}. Please try again.`, tone: 'err' })
    } finally {
      setBusyId(null)
    }
  }

  const firstLoad = loading && list.length === 0

  return (
    <div style={{ minHeight: '100vh', background: CANVAS }}>
      <PageTabBar tabs={OUTREACH_TABS} />
      <PageHeader
        title="Sequences"
        badge={!firstLoad && list.length > 0 ? <Badge tone="green"><span className="size-1.5 rounded-full" style={{ background: GREEN }} />{active.length} running</Badge> : undefined}
        sub="Follow-ups that run by themselves. Enroll a lead and each WhatsApp, email and call reminder goes out on the day you set."
        actions={<>
          <Btn onClick={refresh} label="Refresh"><ArrowClockwise size={18} className={loading && !firstLoad ? 'animate-spin' : ''} /></Btn>
          <Btn variant="primary" onClick={() => openNew()}><Plus size={18} weight="bold" />New sequence</Btn>
        </>}
      />

      <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
        {error && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3" style={{ background: '#FEF3F2', borderColor: '#FECDCA' }}>
            <p className="m-0 text-[14px]" style={{ color: '#B42318' }}>{error}</p>
            <Btn onClick={refresh}>Try again</Btn>
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Lightning size={18} weight="fill" />} accent={GREEN} label="Running" value={firstLoad ? '–' : active.length} unit={list.length ? `of ${list.length}` : undefined}
            sub={list.length - active.length > 0 ? `${list.length - active.length} paused. Paused sequences hold their leads where they are.` : 'Every sequence is running.'} />
          <StatCard icon={<UsersThree size={18} />} accent={BLUE} label="Leads enrolled" value={firstLoad ? '–' : enrolled.toLocaleString('en-IN')}
            sub="Leads that still have steps to go. Enroll more from any lead's page." />
          <StatCard icon={<ListNumbers size={18} />} accent="#B54708" label="Steps by channel" value={firstLoad ? '–' : totalSteps} unit="steps">
            <StackBar parts={CH_ORDER.map(c => ({ label: CH[c].short, value: channelCount[c], color: CH[c].color === TEXT_2 ? '#98A2B3' : c === 'whatsapp' ? '#17B26A' : c === 'email' ? BLUE : '#F79009' }))} />
          </StatCard>
        </div>

        {/* ── How it works ── */}
        <ol className="m-0 mt-6 grid list-none gap-0 overflow-hidden rounded-[16px] border p-0 md:grid-cols-3" style={{ borderColor: BORDER, background: SURFACE }}>
          {[
            { icon: <UsersThree size={18} />, title: 'Enroll a lead', text: "Open a lead and choose Add to sequence. They start on Day 0." },
            { icon: <CalendarBlank size={18} />, title: 'Steps go out on schedule', text: 'Each step waits the days you set after the one before. Call steps arrive as reminders.' },
            { icon: <PauseCircle size={18} />, title: 'Pause any time', text: 'Pausing a sequence holds every lead in it until you turn it back on.' },
          ].map((s, i) => (
            <li key={s.title} className={`flex gap-3 px-5 py-4 ${i ? 'border-t md:border-l md:border-t-0' : ''}`} style={{ borderColor: BORDER }}>
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border bg-white" style={{ borderColor: BORDER, color: BLUE, boxShadow: XS }}>{s.icon}</span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: TEXT }}><span style={{ color: LABEL }}>{i + 1}.</span> {s.title}</div>
                <p className="m-0 mt-0.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* ── List ── */}
        <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
          <Seg label="Show" value={filter} onChange={setFilter}
            options={[{ id: 'all', label: 'All', count: list.length }, { id: 'active', label: 'Running', count: active.length }, { id: 'paused', label: 'Paused', count: list.length - active.length }]} />
          <div className="relative w-full sm:w-[260px]">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: LABEL }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sequences" aria-label="Search sequences"
              className={`${inputCls} pl-10`} style={inputStyle} />
          </div>
        </div>

        {firstLoad ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {[0, 1].map(i => <div key={i} className="h-[260px] animate-pulse rounded-[16px] border" style={{ borderColor: BORDER, background: SURFACE }} />)}
          </div>
        ) : list.length === 0 && !error ? (
          <EmptyState icon={<Lightning size={22} />} title="No sequences yet"
            actions={<>
              <Btn variant="primary" onClick={() => openNew('nurture')}><Sparkle size={18} weight="fill" />Start from a template</Btn>
              <Btn onClick={() => openNew()}><Plus size={18} />Build from scratch</Btn>
            </>}>
            Start with a ready-made sequence for new leads, site visit follow-up or cold leads, then make it your own.
          </EmptyState>
        ) : shown.length === 0 ? (
          <div className="rounded-[16px] border border-dashed px-6 py-10 text-center text-[14px]" style={{ borderColor: BORDER_2, color: SUBTLE }}>
            No sequences match. <button type="button" onClick={() => { setFilter('all'); setSearch('') }} className="cursor-pointer font-semibold" style={{ color: BLUE }}>Show all</button>
          </div>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {shown.map(seq => (
              <SequenceCard key={seq.id} seq={seq} busy={busyId === seq.id}
                onToggle={on => toggle(seq, on)} onCopy={() => openCopy(seq)} onDelete={() => setDeleting(seq)} />
            ))}
          </div>
        )}
      </div>

      {builder && (
        <Builder key={builder.title + builder.starter} init={builder} onClose={() => setBuilder(null)}
          onCreated={name => { setBuilder(null); showToast({ text: `${name} created`, tone: 'ok' }); refresh() }} />
      )}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} width={420} icon={<Trash size={20} />}
        title={`Delete ${deleting?.name ?? 'this sequence'}?`}
        sub={deleting?.active_enrollments
          ? `${deleting.active_enrollments} enrolled lead${deleting.active_enrollments === 1 ? '' : 's'} will stop getting its steps. This can't be undone.`
          : "This can't be undone."}
        footer={<>
          <Btn onClick={() => setDeleting(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => deleting && remove(deleting)}><Trash size={16} />Delete</Btn>
        </>}>
        <p className="m-0 text-[14px] leading-relaxed" style={{ color: TEXT_2 }}>
          If you only want it to stop for now, pause it instead. Pausing keeps every lead where they are.
        </p>
      </Dialog>

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

// ─── Sequence card ────────────────────────────────────────────────────────────
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const joinAnd = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`)

/** "2 WhatsApp messages and 1 email to the lead, plus 1 call reminder for you, over 7 days." */
function planSentence(steps: SavedStep[], span: number) {
  const n = (c: Channel) => steps.filter(s => chOf(s.channel) === c).length
  const toLead = [
    n('whatsapp') && plural(n('whatsapp'), 'WhatsApp message'),
    n('email') && plural(n('email'), 'email'),
  ].filter(Boolean) as string[]
  const forYou = [
    n('call_reminder') && plural(n('call_reminder'), 'call reminder'),
    n('note') && plural(n('note'), 'note'),
  ].filter(Boolean) as string[]
  const when = span ? `over ${plural(span, 'day')}` : 'all on the day they join'
  if (!toLead.length) return `${joinAnd(forYou)} for you, ${when}.`
  return `${joinAnd(toLead)} to the lead${forYou.length ? `, plus ${joinAnd(forYou)} for you` : ''}, ${when}.`
}

function SequenceCard({ seq, busy, onToggle, onCopy, onDelete }: {
  seq: Sequence; busy: boolean; onToggle: (on: boolean) => void; onCopy: () => void; onDelete: () => void
}) {
  const steps = sortSteps(seq)
  const days = runDays(steps.map(s => s.delay_days))
  const span = days.at(-1) ?? 0
  const [sel, setSel] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  // Steps that run on the same day sit together on the journey line
  const groups: { day: number; idx: number[] }[] = []
  steps.forEach((_, i) => {
    const g = groups.at(-1)
    if (g && g.day === days[i]) g.idx.push(i)
    else groups.push({ day: days[i], idx: [i] })
  })
  const listed = showAll || steps.length <= 4 ? steps : steps.slice(0, 3)
  const pick = (i: number) => { setSel(s => (s === i ? null : i)); if (i >= 3) setShowAll(true) }
  const on = seq.active

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border bg-white transition-shadow hover:shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)]"
      style={{ borderColor: on ? '#D1FADF' : BORDER, boxShadow: XS, opacity: busy ? 0.7 : 1 }}>

      {/* ── Name, plain-language plan and the on/off switch ── */}
      <header className="px-4 pb-4 pt-5 sm:px-5" style={{ background: on ? 'linear-gradient(180deg, #F6FEF9 0%, #FFFFFF 100%)' : 'linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 100%)' }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-[17px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: TEXT }}>{seq.name}</h3>
            {seq.description && <p className="m-0 mt-1 text-[13px] leading-snug" style={{ color: SUBTLE }}>{seq.description}</p>}
          </div>
          <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={() => onToggle(!on)}
            title={on ? 'Pause this sequence' : 'Turn this sequence back on'}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border py-1 pl-3 pr-1 text-[13px] font-semibold transition-colors disabled:cursor-wait"
            style={on ? { background: '#ECFDF3', borderColor: '#ABEFC6', color: '#067647' } : { background: CANVAS, borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
            {on
              ? <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: GREEN }} /><span className="relative size-2 rounded-full" style={{ background: GREEN }} /></span>
              : <PauseCircle size={15} weight="fill" color={LABEL} />}
            {on ? 'Running' : 'Paused'}
            <span className="relative h-6 w-10 rounded-full transition-colors" style={{ background: on ? GREEN : '#D0D5DD' }}>
              <span className="absolute top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,0.15)] transition-[left]" style={{ left: on ? 18 : 2 }} />
            </span>
          </button>
        </div>

        <p className="m-0 mt-3 text-[14px] leading-snug" style={{ color: TEXT_2 }}>{planSentence(steps, span)}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[12.5px] font-medium" style={{ borderColor: BORDER, color: TEXT_2 }}>
            <UsersThree size={14} weight="bold" color={BLUE} /><b className="font-semibold tabular-nums">{seq.active_enrollments}</b>{seq.active_enrollments === 1 ? 'lead' : 'leads'} in it now
          </span>
          {!on && seq.active_enrollments > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium" style={{ background: '#FFFAEB', borderColor: '#FEDF89', color: '#B54708' }}>
              On hold until you turn it back on
            </span>
          )}
        </div>
      </header>

      {/* ── Journey: when each step goes out, with the wait in between ── */}
      <div className="border-y px-3 py-3 sm:px-4" style={{ borderColor: BORDER, background: SURFACE }}>
        {/* Padding keeps the selected ring and hover lift inside the scroll box */}
        <div className="overflow-x-auto p-1 [scrollbar-width:thin]">
          <div className="flex min-w-max items-start sm:min-w-0">
            {groups.map((g, gi) => (
              <Fragment key={g.day}>
                <div className="flex shrink-0 flex-col items-center">
                  <div className="flex items-center">
                    {g.idx.map((i, k) => {
                      const ch = chOf(steps[i].channel)
                      const c = CH[ch]
                      const active = sel === i
                      return (
                        <button key={steps[i].id} type="button" onClick={() => pick(i)} aria-pressed={active}
                          title={`${c.label} on ${dayLabel(g.day)}`} aria-label={`Step ${i + 1}: ${c.label} on ${dayLabel(g.day)}`}
                          className={`relative grid size-10 cursor-pointer place-items-center rounded-full border-2 transition-transform hover:z-10 hover:-translate-y-0.5 ${k ? '-ml-2.5' : ''}`}
                          style={{ background: c.bg, borderColor: active ? c.color : '#FFFFFF', color: c.color, zIndex: active ? 10 : g.idx.length - k, boxShadow: active ? `0 0 0 3px ${c.border}` : '0 1px 2px rgba(16,24,40,0.08)' }}>
                          <c.Icon size={17} weight={ch === 'whatsapp' ? 'fill' : 'bold'} />
                        </button>
                      )
                    })}
                  </div>
                  <span className="mt-1.5 text-[12px] font-semibold tabular-nums" style={{ color: TEXT_2 }}>{dayLabel(g.day)}</span>
                </div>
                {gi < groups.length - 1 && (() => {
                  const gap = groups[gi + 1].day - g.day
                  return (
                    <div className="relative mx-1 mt-5 h-px min-w-[44px] self-start" style={{ flexGrow: gap, borderTop: `1.5px dashed ${BORDER_2}` }}>
                      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border bg-white px-1.5 text-[11px] font-medium tabular-nums" style={{ borderColor: BORDER, color: SUBTLE }}>
                        {plural(gap, 'day')}
                      </span>
                    </div>
                  )
                })()}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Steps, each opening to what the lead (or you) will see ── */}
      <ol className="m-0 flex list-none flex-col gap-0.5 p-2">
        {listed.map(s => {
          const i = steps.indexOf(s)
          const ch = chOf(s.channel)
          const c = CH[ch]
          const open = sel === i
          const forYou = ch === 'call_reminder' || ch === 'note'
          const title = ch === 'email' ? personalise(s.template_name || 'Email', SAMPLE_MERGE) : ch === 'whatsapp' ? 'WhatsApp message' : `${c.label} for you`
          const body = personalise(s.message_body ?? '', SAMPLE_MERGE)
          return (
            <li key={s.id} className="rounded-[14px] transition-colors" style={{ background: open ? c.bg : 'transparent' }}>
              <button type="button" onClick={() => pick(i)} aria-expanded={open}
                className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-[#F9FAFB]"
                style={open ? { background: 'transparent' } : undefined}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full border" style={{ background: c.bg, borderColor: c.border, color: c.color }}>
                  <c.Icon size={15} weight={ch === 'whatsapp' ? 'fill' : 'bold'} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold" style={{ color: TEXT }}>{title}</span>
                    <span className="shrink-0 text-[12px] font-medium tabular-nums" style={{ color: LABEL }}>{dayLabel(days[i])}</span>
                  </span>
                  {!open && <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{body || 'No text yet'}</span>}
                </span>
                <CaretDown size={14} weight="bold" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: LABEL }} />
              </button>
              {open && (
                <div className="px-2.5 pb-3 sm:pl-[52px]">
                  {ch === 'whatsapp' && (
                    <div className="rounded-[12px] p-3" style={{ background: '#EFEAE2' }}>
                      {body ? <WaBubble text={body} /> : <p className="m-0 text-center text-[13px]" style={{ color: '#667781' }}>No text yet</p>}
                    </div>
                  )}
                  {ch === 'email' && <EmailCard to="rahul.sharma@gmail.com" subject={title} body={body} />}
                  {forYou && (
                    <div className="rounded-[12px] border bg-white p-3.5 text-[13.5px] leading-relaxed" style={{ borderColor: c.border, color: TEXT_2 }}>
                      <div className="mb-1 text-[12px] font-semibold" style={{ color: c.color }}>
                        {ch === 'call_reminder' ? 'You get a reminder to call the lead' : 'Saved on the lead for your team'}
                      </div>
                      {body || 'No text yet'}
                    </div>
                  )}
                  {!forYou && <p className="m-0 mt-2 text-[12px]" style={{ color: SUBTLE }}>Shown for a sample lead, Rahul from Mumbai. Each lead sees their own details.</p>}
                </div>
              )}
            </li>
          )
        })}
        {listed.length < steps.length && (
          <li>
            <button type="button" onClick={() => setShowAll(true)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left text-[13px] font-semibold transition-colors hover:bg-[#F9FAFB]" style={{ color: BLUE }}>
              <span className="grid size-8 place-items-center rounded-full border border-dashed" style={{ borderColor: BLUE_LN }}><Plus size={13} weight="bold" /></span>
              {plural(steps.length - listed.length, 'more step')}
            </button>
          </li>
        )}
      </ol>

      <footer className="mt-auto flex flex-wrap items-center gap-1 border-t px-3 py-2.5 sm:px-4" style={{ borderColor: BORDER }}>
        <Link href="/dashboard/leads" className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold no-underline transition-colors hover:bg-[#EFF4FF]" style={{ color: BLUE }}>
          <UsersThree size={15} weight="bold" />Enroll leads
        </Link>
        <span className="ml-auto" />
        <Btn variant="ghost" size="sm" onClick={onCopy}><CopySimple size={15} />Duplicate</Btn>
        <Btn variant="ghost" size="sm" onClick={onDelete} label={`Delete ${seq.name}`}><Trash size={15} color="#D92D20" /><span className="hidden sm:inline" style={{ color: '#B42318' }}>Delete</span></Btn>
      </footer>
    </article>
  )
}

// ─── Builder ──────────────────────────────────────────────────────────────────
function Builder({ init, onClose, onCreated }: {
  init: { title: string; name: string; description: string; steps: DraftStep[]; starter: string | null }
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const [name, setName] = useState(init.name)
  const [description, setDescription] = useState(init.description)
  const [steps, setSteps] = useState<DraftStep[]>(init.steps)
  const [starter, setStarter] = useState(init.starter)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listEnd = useRef<HTMLDivElement>(null)

  const days = runDays(steps.map(s => s.delay_days))
  const problem = !name.trim() ? 'Give the sequence a name.'
    : steps.length === 0 ? 'Add at least one step.'
    : (() => {
        const i = steps.findIndex(s => !s.body.trim() || (s.channel === 'email' && !s.subject.trim()))
        if (i < 0) return null
        return steps[i].channel === 'email' && !steps[i].subject.trim() ? `Step ${i + 1} needs a subject.` : `Step ${i + 1} needs some text.`
      })()

  const update = (key: string, patch: Partial<DraftStep>) => setSteps(l => l.map(s => (s.key === key ? { ...s, ...patch } : s)))
  const move = (i: number, d: -1 | 1) => setSteps(l => {
    const j = i + d
    if (j < 0 || j >= l.length) return l
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n
  })
  const add = (channel: Channel) => {
    setSteps(l => [...l, step(channel, l.length ? 1 : 0, '')])
    requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
  }
  const pickStarter = (id: string) => {
    const st = STARTERS.find(s => s.id === id)
    setStarter(id)
    if (!st) { setSteps([step('whatsapp', 0, '')]); return }
    const fromStarter = !name.trim() || STARTERS.some(s => s.name === name)
    if (fromStarter) { setName(st.name); setDescription(st.description) }
    setSteps(st.steps())
  }

  const save = async () => {
    if (problem) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/outreach/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          steps: steps.map(s => ({
            delay_days: Math.max(0, Math.round(s.delay_days || 0)),
            channel: s.channel,
            message_body: s.body.trim(),
            // Email subject is stored in template_name; WhatsApp steps leave it for the Interakt template
            template_name: s.channel === 'email' ? s.subject.trim() : undefined,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error ?? 'Could not save the sequence')
      onCreated(name.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the sequence')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} width={780} full icon={<Lightning size={20} />} title={init.title}
      sub="Each step waits the number of days you set after the one before."
      footer={<>
        <span className="mr-auto text-[13px]" style={{ color: error ? '#B42318' : SUBTLE }}>
          {error ?? problem ?? `${steps.length} step${steps.length === 1 ? '' : 's'} over ${days.at(-1) ?? 0} day${(days.at(-1) ?? 0) === 1 ? '' : 's'}`}
        </span>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!!problem || saving} onClick={save}>
          {saving ? <><CircleNotch size={16} className="animate-spin" />Saving…</> : 'Create sequence'}
        </Btn>
      </>}>
      {init.starter && (
        <div className="mb-5">
          <div className="mb-2 text-[13px] font-semibold" style={{ color: TEXT_2 }}>Start from</div>
          <div className="flex flex-wrap gap-2">
            <Chip on={starter === 'blank'} onClick={() => pickStarter('blank')}>Blank</Chip>
            {STARTERS.map(s => <Chip key={s.id} on={starter === s.id} onClick={() => pickStarter(s.id)}>{s.name}</Chip>)}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="q-name">
          <input id="q-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New lead, first week" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Description" htmlFor="q-desc">
          <input id="q-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is it for?" className={inputCls} style={inputStyle} />
        </Field>
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h3 className="m-0 text-[15px] font-semibold" style={{ color: TEXT }}>Steps</h3>
        <span className="text-[13px]" style={{ color: SUBTLE }}>Day 0 is the day the lead is enrolled</span>
      </div>

      <ol className="m-0 flex list-none flex-col p-0">
        {steps.map((s, i) => (
          <StepEditor key={s.key} s={s} index={i} day={days[i]} last={i === steps.length - 1} count={steps.length}
            onChange={p => update(s.key, p)} onMove={d => move(i, d)} onRemove={() => setSteps(l => l.filter(x => x.key !== s.key))} />
        ))}
      </ol>
      <div ref={listEnd} />

      <div className="mt-3 rounded-[12px] border border-dashed p-3" style={{ borderColor: BORDER_2 }}>
        <div className="mb-2 text-[13px] font-semibold" style={{ color: TEXT_2 }}>Add a step</div>
        <div className="flex flex-wrap gap-2">
          {CH_ORDER.map(c => {
            const m = CH[c]
            return (
              <button key={c} type="button" onClick={() => add(c)}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border bg-white px-3 text-[13.5px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
                <m.Icon size={16} color={m.color} weight={c === 'whatsapp' ? 'fill' : 'regular'} />{m.label}
              </button>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}

function StepEditor({ s, index, day, last, count, onChange, onMove, onRemove }: {
  s: DraftStep; index: number; day: number; last: boolean; count: number
  onChange: (p: Partial<DraftStep>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void
}) {
  const [preview, setPreview] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const c = CH[s.channel]
  const canPreview = s.channel === 'whatsapp' || s.channel === 'email'
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)] gap-3">
      <div className="flex flex-col items-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border" style={{ background: c.bg, borderColor: c.border, color: c.color }}>
          <c.Icon size={16} weight={s.channel === 'whatsapp' ? 'fill' : 'regular'} />
        </span>
        {!last && <span className="w-px flex-1" style={{ background: BORDER_2 }} />}
      </div>
      <div className="mb-3 min-w-0 rounded-[12px] border bg-white p-3.5" style={{ borderColor: BORDER, boxShadow: XS }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[6px] px-1.5 py-0.5 text-[12px] font-bold tabular-nums" style={{ background: '#F2F4F7', color: TEXT_2 }}>Step {index + 1} · {dayLabel(day)}</span>
          <div className="ml-auto flex items-center gap-0.5">
            <Btn variant="ghost" size="sm" label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={15} /></Btn>
            <Btn variant="ghost" size="sm" label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={15} /></Btn>
            <Btn variant="ghost" size="sm" label="Remove step" onClick={onRemove}><X size={15} /></Btn>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Seg label="Channel" value={s.channel} onChange={v => onChange({ channel: v })}
            options={CH_ORDER.map(k => ({ id: k, label: CH[k].short }))} />
          <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: SUBTLE }}>
            Wait
            <input type="number" min={0} max={90} inputMode="numeric" value={s.delay_days}
              onChange={e => onChange({ delay_days: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })}
              className="h-8 w-14 rounded-[8px] border bg-white px-2 text-center text-[13.5px] font-semibold tabular-nums outline-none focus:border-[#84ADFF]"
              style={{ borderColor: BORDER_2, color: TEXT }} />
            day{s.delay_days === 1 ? '' : 's'} {index === 0 ? 'after enrolling' : 'after the step before'}
          </label>
        </div>

        {s.channel === 'email' && (
          <input value={s.subject} onChange={e => onChange({ subject: e.target.value })} placeholder="Subject, e.g. Your shortlist for {{city}}" aria-label="Email subject"
            className={`${inputCls} mt-3`} style={inputStyle} />
        )}
        <textarea ref={ref} value={s.body} onChange={e => onChange({ body: e.target.value })} rows={s.channel === 'email' ? 5 : 3}
          placeholder={c.placeholder} aria-label={`${c.label} text`} className={`${textareaCls} mt-3`} style={inputStyle} />

        {canPreview && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <MergeTagBar targetRef={ref} value={s.body} onChange={v => onChange({ body: v })} />
            <Btn variant="ghost" size="sm" onClick={() => setPreview(v => !v)}>{preview ? <EyeSlash size={15} /> : <Eye size={15} />}{preview ? 'Hide preview' : 'Preview'}</Btn>
          </div>
        )}
        {preview && s.channel === 'whatsapp' && (
          <div className="mt-3 rounded-[12px] p-3" style={{ background: '#EFEAE2' }}>
            {s.body.trim() ? <WaBubble text={personalise(s.body, SAMPLE_MERGE)} /> : <p className="m-0 text-center text-[13px]" style={{ color: '#667781' }}>Write the message to see it here</p>}
          </div>
        )}
        {preview && s.channel === 'email' && (
          <div className="mt-3"><EmailCard to="rahul.sharma@gmail.com" subject={personalise(s.subject, SAMPLE_MERGE)} body={personalise(s.body, SAMPLE_MERGE)} /></div>
        )}
      </div>
    </li>
  )
}

