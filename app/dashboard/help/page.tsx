'use client'

// Help & Support (/dashboard/help): search-first answers about every part of LeadGap, and a way to reach the team.
// The answers live in components/help/help-content.tsx and were checked against how the app works.
// Every answer has its own link (/dashboard/help#<id>) that opens it, so support can send people straight to one.
// Same tokens, cards and buttons as the Leads, Team and Settings pages (components/outreach/OutreachKit).

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import {
  MagnifyingGlass, X, CaretDown, CaretRight, ArrowRight, Envelope, WhatsappLogo, Bug, LinkSimple,
  Lifebuoy, Lightbulb, Warning,
} from '@phosphor-icons/react'
import { getPlan, getRole } from '@/lib/plan'
import {
  CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, MUTED, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, XS, TONE,
  Chip, Toast, useToast, phone10,
} from '@/components/outreach/OutreachKit'
import { TOPICS, QUICK_LINKS, POPULAR, QUICK_ANSWER_IDS, type Block, type Faq, type Topic } from '@/components/help/help-content'

// Where "Contact us" goes. The WhatsApp button only shows once a real number is set.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@leadgap.in'
const SUPPORT_WA = phone10(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP)

const ALL = TOPICS.flatMap(t => t.faqs.map(f => ({ faq: f, topic: t })))
const BY_ID = new Map(ALL.map(x => [x.faq.id, x]))
const QUICK_ANSWERS = QUICK_ANSWER_IDS.map(id => BY_ID.get(id)).filter(x => x != null)

// ─── The open answer lives in the URL hash ───────────────────────────────────
const subscribeHash = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb) }
const hashNow = () => decodeURIComponent(window.location.hash.slice(1))
const hashOnServer = () => ''
/** Scrolls an element to just below the sticky top bar */
function scrollToId(id: string, smooth = true) {
  const el = document.getElementById(id)
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: smooth ? 'smooth' : 'auto' })
}
function setHash(id: string) {
  history.replaceState(null, '', id ? `#${id}` : window.location.pathname + window.location.search)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

// ─── Search ───────────────────────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
const wordsOf = (q: string) => [...new Set(norm(q).split(/[^a-z0-9]+/).filter(w => w.length > 1 || /\d/.test(w)))]
const blockText = (b: Block): string => (typeof b === 'string' ? b : 'list' in b ? b.list.join(' ') : 'steps' in b ? b.steps.join(' ') : b.note)
const plain = (s: string) => s.replace(/\*\*/g, '')
const answerText = (f: Faq) => plain(f.a.map(blockText).join(' '))

type Hit = { faq: Faq; topic: Topic; score: number }
function search(q: string): Hit[] {
  const ws = wordsOf(q)
  if (!ws.length) return []
  const hits: Hit[] = []
  for (const { faq, topic } of ALL) {
    const fields: [string, number][] = [[norm(faq.q), 5], [norm(faq.keywords ?? ''), 3], [norm(topic.title), 1], [norm(answerText(faq)), 1]]
    let score = 0, all = true
    for (const w of ws) {
      let s = 0
      for (const [text, weight] of fields) if (text.includes(w)) s += weight * (new RegExp(`\\b${w}`).test(text) ? 2 : 1)
      if (!s) { all = false; break }
      score += s
    }
    if (all) hits.push({ faq, topic, score })
  }
  return hits.sort((a, b) => b.score - a.score)
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Highlights the searched words and turns **text** into bold */
function Rich({ text, ws }: { text: string; ws: string[] }) {
  const re = ws.length ? new RegExp(`(${ws.map(esc).join('|')})`, 'gi') : null
  const mark = (s: string, key: string) => {
    if (!re) return <Fragment key={key}>{s}</Fragment>
    return <Fragment key={key}>{s.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded-[3px] px-0.5" style={{ background: '#FEF0C7', color: 'inherit' }}>{p}</mark> : p))}</Fragment>
  }
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <strong key={i} style={{ color: TEXT }}>{mark(p.slice(2, -2), `b${i}`)}</strong> : mark(p, `t${i}`)))}</>
}

function snippet(f: Faq, ws: string[]) {
  const text = answerText(f)
  const low = norm(text)
  const at = ws.map(w => low.indexOf(w)).filter(i => i >= 0).sort((a, b) => a - b)[0]
  if (at == null || at < 70) return text.length > 150 ? text.slice(0, 150).replace(/\s+\S*$/, '') + '…' : text
  const start = text.lastIndexOf(' ', at - 50) + 1
  const out = text.slice(start, start + 150)
  return '…' + (start + 150 < text.length ? out.replace(/\s+\S*$/, '') + '…' : out)
}

// ─── Contact ──────────────────────────────────────────────────────────────────
const mailto = (subject: string, body = '') => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`
const waTo = (text: string) => `https://wa.me/91${SUPPORT_WA}?text=${encodeURIComponent(text)}`

function reportProblem() {
  const plan = getPlan() === 'teams' ? `Teams, ${getRole()}` : 'Solo'
  const body = [
    'What happened:', '', '',
    'What I expected:', '', '',
    'Steps to get there (the page, and what I clicked):', '', '',
    'A screenshot helps. If it is about one lead, add its CS ID.', '',
    '--',
    `Plan: ${plan}`,
    `Browser: ${navigator.userAgent}`,
    `Screen: ${window.innerWidth}×${window.innerHeight}`,
  ].join('\n')
  window.location.href = mailto('Problem in LeadGap', body)
}

const cardLink = 'group flex min-w-0 items-start gap-3 rounded-[4px] border bg-white p-4 text-left no-underline transition-colors hover:bg-[#F9FAFB]'

function ContactCards({ query }: { query?: string }) {
  const subject = query ? `LeadGap help: ${query}` : 'LeadGap help'
  const items: { key: string; icon: ReactNode; tint: { bg: string; fg: string }; title: string; sub: string; href?: string; onClick?: () => void; external?: boolean }[] = [
    { key: 'mail', icon: <Envelope size={18} weight="light" />, tint: { bg: BLUE_BG, fg: BLUE }, title: 'Email us', sub: SUPPORT_EMAIL, href: mailto(subject, query ? `I searched Help for "${query}" and couldn't find an answer.\n\n` : '') },
    ...(SUPPORT_WA ? [{ key: 'wa', icon: <WhatsappLogo size={18} weight="fill" />, tint: { bg: '#E7F8EE', fg: '#067647' }, title: 'WhatsApp us', sub: `+91 ${SUPPORT_WA.slice(0, 5)} ${SUPPORT_WA.slice(5)}`, href: waTo(query ? `Hi LeadGap team, I need help with: ${query}` : 'Hi LeadGap team, I need help with '), external: true }] : []),
    { key: 'bug', icon: <Bug size={18} weight="light" />, tint: { bg: TONE.amber.bg, fg: TONE.amber.color }, title: 'Report a problem', sub: 'Opens an email with the details we need', onClick: reportProblem },
  ]
  return (
    <div className={`grid gap-3 ${items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {items.map(it => {
        const inner = (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-[4px]" style={{ background: it.tint.bg, color: it.tint.fg }}>{it.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[14.5px] font-semibold" style={{ color: TEXT }}>{it.title}<ArrowRight size={14} weight="light" className="transition-transform group-hover:translate-x-0.5" /></span>
              <span className="mt-0.5 line-clamp-2 block break-words text-[13px] leading-snug" style={{ color: SUBTLE }}>{it.sub}</span>
            </span>
          </>
        )
        return it.onClick
          ? <button key={it.key} type="button" onClick={it.onClick} className={`${cardLink} w-full cursor-pointer`} style={{ borderColor: BORDER, boxShadow: XS }}>{inner}</button>
          : <a key={it.key} href={it.href} {...(it.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={cardLink} style={{ borderColor: BORDER, boxShadow: XS }}>{inner}</a>
      })}
    </div>
  )
}

// ─── Answers ──────────────────────────────────────────────────────────────────
function Blocks({ blocks, ws }: { blocks: Block[]; ws: string[] }) {
  return (
    <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed" style={{ color: TEXT_2 }}>
      {blocks.map((b, i) => {
        if (typeof b === 'string') return <p key={i} className="m-0"><Rich text={b} ws={ws} /></p>
        if ('list' in b) return (
          <ul key={i} className="m-0 flex list-none flex-col gap-1.5 p-0">
            {b.list.map((x, j) => <li key={j} className="flex gap-2.5"><span className="mt-[9px] size-1.5 shrink-0 rounded-full" style={{ background: BLUE }} /><span className="min-w-0"><Rich text={x} ws={ws} /></span></li>)}
          </ul>
        )
        if ('steps' in b) return (
          <ol key={i} className="m-0 flex list-none flex-col gap-2 p-0">
            {b.steps.map((x, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11.5px] font-bold" style={{ background: BLUE_BG, color: BLUE, boxShadow: `inset 0 0 0 1px ${BLUE_LN}` }}>{j + 1}</span>
                <span className="min-w-0"><Rich text={x} ws={ws} /></span>
              </li>
            ))}
          </ol>
        )
        const t = TONE[b.tone ?? 'blue']
        return (
          <div key={i} className="flex gap-2.5 rounded-[4px] border px-3 py-2.5 text-[13.5px] leading-snug" style={{ background: t.bg, borderColor: t.border }}>
            {b.tone === 'amber' ? <Warning size={15} weight="light" className="mt-0.5 shrink-0" color={t.color} /> : <Lightbulb size={15} weight="light" className="mt-0.5 shrink-0" color={t.color} />}
            <span className="min-w-0"><Rich text={b.note} ws={ws} /></span>
          </div>
        )
      })}
    </div>
  )
}

function FaqItem({ faq, topic, open, onToggle, ws, onCopy, showTopic }: {
  faq: Faq; topic: Topic; open: boolean; onToggle: () => void; ws: string[]; onCopy: (id: string) => void; showTopic?: boolean
}) {
  return (
    <div id={faq.id} className="scroll-mt-24 border-b last:border-b-0" style={{ borderColor: '#F2F4F7' }}>
      <h3 className="m-0">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`${faq.id}-answer`}
          className="flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[#FCFCFD] sm:px-5">
          <span className="min-w-0 flex-1">
            {showTopic && <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}><topic.Icon size={12} weight="light" />{topic.title}</span>}
            <span className="block text-[15px] font-semibold leading-snug" style={{ color: TEXT }}><Rich text={faq.q} ws={ws} /></span>
            {showTopic && !open && <span className="mt-1 block text-[13.5px] leading-snug" style={{ color: SUBTLE }}><Rich text={snippet(faq, ws)} ws={ws} /></span>}
          </span>
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full transition-transform" style={{ background: open ? BLUE_BG : SURFACE, color: open ? BLUE : SUBTLE, transform: open ? 'rotate(180deg)' : undefined }}>
            <CaretDown size={13} weight="light" />
          </span>
        </button>
      </h3>
      {open && (
        <div id={`${faq.id}-answer`} role="region" aria-label={faq.q} className="px-4 pb-5 sm:px-5">
          <Blocks blocks={faq.a} ws={ws} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {faq.links?.map(l => (
              <Link key={l.href + l.label} href={l.href} className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border bg-white px-2.5 text-[13px] font-semibold no-underline transition-colors hover:bg-[#F9FAFB]"
                style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>{l.label}<CaretRight size={12} weight="light" /></Link>
            ))}
            {faq.mail && (
              <a href={mailto(faq.mail.subject, faq.mail.body)} className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border px-2.5 text-[13px] font-semibold no-underline transition-[filter] hover:brightness-95"
                style={{ background: BLUE_BG, borderColor: BLUE_LN, color: BLUE }}><Envelope size={14} weight="light" />{faq.mail.label}</a>
            )}
            <button type="button" onClick={() => onCopy(faq.id)} className="ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[4px] px-2 text-[12.5px] font-semibold transition-colors hover:bg-[#F2F4F7]" style={{ color: SUBTLE }}>
              <LinkSimple size={14} weight="light" />Copy link
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TopicSection({ topic, isOpen, toggle, onCopy }: { topic: Topic; isOpen: (id: string) => boolean; toggle: (id: string) => void; onCopy: (id: string) => void }) {
  return (
    <section id={`topic-${topic.id}`} data-topic={topic.id} className="scroll-mt-24">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[4px] border bg-white" style={{ borderColor: BORDER, color: topic.color, boxShadow: XS }}><topic.Icon size={19} weight="light" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[18px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: TEXT }}>{topic.title}</h2>
          <p className="m-0 mt-0.5 text-[13.5px] leading-snug" style={{ color: SUBTLE }}>{topic.blurb}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[4px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS }}>
        {topic.faqs.map(f => <FaqItem key={f.id} faq={f} topic={topic} open={isOpen(f.id)} onToggle={() => toggle(f.id)} ws={[]} onCopy={onCopy} />)}
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<Set<string>>(() => new Set())
  const [activeTopic, setActiveTopic] = useState(TOPICS[0].id)
  const hash = useSyncExternalStore(subscribeHash, hashNow, hashOnServer)
  const searchRef = useRef<HTMLInputElement>(null)
  const { toast, show, hide } = useToast()

  const ws = useMemo(() => wordsOf(query), [query])
  const hits = useMemo(() => search(query), [query])
  const searching = ws.length > 0

  const isOpen = useCallback((id: string) => opened.has(id) || hash === id, [opened, hash])
  const toggle = useCallback((id: string) => {
    const open = opened.has(id) || hashNow() === id
    setOpened(s => { const n = new Set(s); if (open) n.delete(id); else n.add(id); return n })
    if (open && hashNow() === id) setHash('')
    if (!open) setHash(id)
  }, [opened])

  const copyLink = useCallback(async (id: string) => {
    const url = `${window.location.origin}/dashboard/help#${id}`
    try { await navigator.clipboard.writeText(url); show({ text: 'Link copied. It opens this answer.', tone: 'ok' }) }
    catch { show({ text: 'Couldn\'t copy the link', tone: 'err' }) }
  }, [show])

  // Opening /dashboard/help#<answer> scrolls to it
  useEffect(() => {
    const id = hashNow()
    if (BY_ID.has(id)) requestAnimationFrame(() => scrollToId(id, false))
  }, [])

  // "/" jumps to search from anywhere on the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault(); searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Highlights the topic being read in the side list
  useEffect(() => {
    if (searching || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setActiveTopic((top.target as HTMLElement).dataset.topic ?? TOPICS[0].id)
    }, { rootMargin: '-80px 0px -60% 0px' })
    document.querySelectorAll('[data-topic]').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [searching])

  const openAnswer = (id: string) => {
    setQuery('')
    setOpened(s => new Set(s).add(id))
    setHash(id)
    requestAnimationFrame(() => scrollToId(id))
  }

  const goTopic = (id: string) => {
    setActiveTopic(id)
    scrollToId(`topic-${id}`)
  }

  const total = ALL.length

  return (
    <div className="min-h-screen" style={{ background: CANVAS }}>
      {/* Hero: search first */}
      <section className="border-b" style={{ borderColor: BORDER, background: 'linear-gradient(180deg, #F5F8FF 0%, #FFFFFF 100%)' }}>
        <div className="mx-auto grid max-w-[1400px] gap-6 px-4 pb-8 pt-7 sm:pt-9 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:px-8">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-[4px] border bg-white px-2.5 py-1 text-[12.5px] font-semibold" style={{ borderColor: BLUE_LN, color: BLUE }}>
              <Lifebuoy size={14} weight="light" />Help &amp; Support
            </span>
            <h1 className="m-0 mt-3 text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[38px]" style={{ color: TEXT }}>How can we help?</h1>
            <p className="m-0 mt-1.5 max-w-[620px] text-[15px] leading-snug" style={{ color: SUBTLE }}>
              {total} answers about leads, calling, outreach, your team and your account. Still stuck? Write to the LeadGap team.
            </p>
            <div className="relative mt-5 max-w-[720px]">
              <MagnifyingGlass size={20} weight="light" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: SUBTLE }} />
              <input ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
                placeholder="Search CS ID, NC rule, import…" aria-label="Search help"
                className="h-14 w-full rounded-[4px] border bg-white pl-12 pr-12 text-[16px] sm:pr-24 outline-none transition-[border-color,box-shadow] placeholder:text-[#98A2B3] focus:border-[#84ADFF] focus:shadow-[0_0_0_4px_rgba(29,78,216,0.12)] [&::-webkit-search-cancel-button]:hidden"
                style={{ borderColor: BORDER_2, color: TEXT, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 8px 24px -12px rgba(29,78,216,0.18)' }} />
              <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {query
                  ? <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="Clear search" className="grid size-8 cursor-pointer place-items-center rounded-[4px] transition-colors hover:bg-[#F2F4F7]" style={{ color: SUBTLE }}><X size={16} weight="light" /></button>
                  : <kbd className="hidden h-7 min-w-7 place-items-center rounded-[4px] border px-2 font-sans text-[13px] font-semibold sm:grid" style={{ borderColor: BORDER_2, color: SUBTLE, background: SURFACE }} title="Press / to search">/</kbd>}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] font-medium" style={{ color: SUBTLE }}>Popular</span>
              {POPULAR.map(p => <Chip key={p} on={norm(query) === norm(p)} onClick={() => setQuery(q => (norm(q) === norm(p) ? '' : p))}>{p}</Chip>)}
            </div>
          </div>
          <div className="hidden min-w-0 rounded-[4px] border bg-white p-2 lg:block" style={{ borderColor: BORDER, boxShadow: XS }}>
            <div className="px-3 pb-1.5 pt-2 text-[12.5px] font-semibold uppercase tracking-[0.05em]" style={{ color: LABEL }}>Quick answers</div>
            <ul className="m-0 list-none p-0">
              {QUICK_ANSWERS.map(x => (
                <li key={x.faq.id}>
                  <button type="button" onClick={() => openAnswer(x.faq.id)}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-[4px] px-3 py-2.5 text-left transition-colors hover:bg-[#F9FAFB]">
                    <span className="grid size-8 shrink-0 place-items-center rounded-[4px] border bg-white" style={{ borderColor: BORDER, color: x.topic.color }}><x.topic.Icon size={15} weight="light" /></span>
                    <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug" style={{ color: TEXT_2 }}>{x.faq.q}</span>
                    <CaretRight size={14} weight="light" className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: LABEL }} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-6 lg:px-8">
        {searching ? (
          <div className="mx-auto max-w-[860px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[14px]" style={{ color: MUTED }} aria-live="polite">
                {hits.length ? <><b style={{ color: TEXT }}>{hits.length}</b> {hits.length === 1 ? 'answer' : 'answers'} for &ldquo;{query.trim()}&rdquo;</> : <>No answers for &ldquo;{query.trim()}&rdquo;</>}
              </p>
              <button type="button" onClick={() => setQuery('')} className="cursor-pointer text-[13.5px] font-semibold hover:underline" style={{ color: BLUE }}>Show all topics</button>
            </div>
            {hits.length > 0 ? (
              <div className="overflow-hidden rounded-[4px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS }}>
                {hits.map(h => <FaqItem key={h.faq.id} faq={h.faq} topic={h.topic} open={isOpen(h.faq.id)} onToggle={() => toggle(h.faq.id)} ws={ws} onCopy={copyLink} showTopic />)}
              </div>
            ) : (
              <div className="rounded-[4px] border px-5 py-10 text-center" style={{ borderColor: BORDER, boxShadow: XS }}>
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-[4px] border" style={{ borderColor: BORDER, color: TEXT_2, boxShadow: XS }}><MagnifyingGlass size={22} weight="light" /></div>
                <h2 className="m-0 text-[18px] font-semibold" style={{ color: TEXT }}>Nothing here yet</h2>
                <p className="mx-auto mb-0 mt-1.5 max-w-[440px] text-[14px] leading-relaxed" style={{ color: SUBTLE }}>Try a shorter word, like &ldquo;import&rdquo; or &ldquo;dialer&rdquo;. Or ask us: your search goes into the message for you.</p>
                <div className="mx-auto mt-6 max-w-[640px] text-left"><ContactCards query={query.trim()} /></div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Start here */}
            <div className="mb-8">
              <h2 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.05em]" style={{ color: LABEL }}>Start here</h2>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
                {QUICK_LINKS.map(l => (
                  <Link key={l.href} href={l.href} className={`${cardLink} flex-col gap-2 p-3 sm:flex-row sm:gap-3 sm:p-4`} style={{ borderColor: BORDER, boxShadow: XS }}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-[4px] sm:size-10" style={{ background: TONE[l.tone].bg, color: TONE[l.tone].color }}><l.Icon size={18} weight="light" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[14px] font-semibold leading-snug sm:text-[14.5px]" style={{ color: TEXT }}>{l.label}<ArrowRight size={14} weight="light" className="hidden shrink-0 transition-transform group-hover:translate-x-0.5 sm:block" /></span>
                      <span className="mt-0.5 hidden text-[13px] leading-snug sm:block" style={{ color: SUBTLE }}>{l.sub}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Topics on phones */}
            <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden">
              {TOPICS.map(t => <Chip key={t.id} on={activeTopic === t.id} onClick={() => goTopic(t.id)} count={t.faqs.length}>{t.title}</Chip>)}
            </div>

            <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
              <nav aria-label="Help topics" className="hidden lg:block">
                <div className="sticky top-[72px]">
                  <h2 className="m-0 mb-2 px-3 text-[13px] font-semibold uppercase tracking-[0.05em]" style={{ color: LABEL }}>Topics</h2>
                  <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                    {TOPICS.map(t => {
                      const on = activeTopic === t.id
                      return (
                        <li key={t.id}>
                          <button type="button" onClick={() => goTopic(t.id)} aria-current={on ? 'true' : undefined}
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-[4px] px-3 py-2 text-left text-[14px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                            style={on ? { background: BLUE_BG, color: BLUE } : { color: TEXT_2 }}>
                            <t.Icon size={16} weight="light" style={{ color: on ? BLUE : t.color }} />
                            <span className="min-w-0 flex-1 truncate">{t.title}</span>
                            <span className="text-[12px] font-medium tabular-nums" style={{ color: on ? BLUE : LABEL }}>{t.faqs.length}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </nav>
              <div className="flex min-w-0 flex-col gap-8">
                {TOPICS.map(t => <TopicSection key={t.id} topic={t} isOpen={isOpen} toggle={toggle} onCopy={copyLink} />)}
              </div>
            </div>
          </>
        )}

        {/* Still stuck */}
        <section className="mt-10 rounded-[4px] border p-5 sm:p-6" style={{ borderColor: BORDER, background: SURFACE }}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="m-0 text-[18px] font-semibold" style={{ color: TEXT }}>Still stuck?</h2>
              <p className="m-0 mt-1 text-[14px]" style={{ color: SUBTLE }}>Write to the LeadGap team. A screenshot, and the lead&apos;s CS ID if it&apos;s about one lead, helps us answer faster.</p>
            </div>
          </div>
          <ContactCards query={searching ? query.trim() : undefined} />
        </section>
      </div>
      <Toast toast={toast} onClose={hide} />
    </div>
  )
}
