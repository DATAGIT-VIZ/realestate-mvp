'use client'

/* ─────────────────────────────────────────────────────────────────────────────
 * SolutionBento · "One CRM. Every leak closed."
 *
 * The Solution chapter of the landing page story (intro → problem → solution →
 * how it works → CTA). Five cards answer the Problem section point by point:
 * one inbox for scattered leads, an intent score and dialer for the late first
 * call, the Today view for slipping follow-ups, a live pipeline for what nobody
 * could see, and the tools that come built in. Each illustration animates in
 * once as it scrolls into view and then holds still, so the copy stays the
 * focus. It ends on a link that scrolls to the next section (How it works).
 *
 * Same look as ProblemStory and HowItWorksSteps: Plus Jakarta Sans, cobalt, lucide.
 * Stack: React 19 · TypeScript · Tailwind CSS v4 · motion (motion/react) · lucide-react
 * Usage:  <SolutionBento />            (every prop is optional)
 * ──────────────────────────────────────────────────────────────────────────── */

import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import {
  MotionConfig,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from 'motion/react'
import {
  ArrowDown,
  BellRing,
  Building2,
  CalendarCheck,
  Check,
  FileUp,
  Gauge,
  Handshake,
  History,
  Megaphone,
  PhoneCall,
  Sparkles,
  TriangleAlert,
  UserX,
  type LucideIcon,
} from 'lucide-react'

export type SolutionBentoProps = {
  /** Section anchor. */
  id?: string
  /** Where the closing link goes. By default it smooth-scrolls to the next section on the page. */
  nextHref?: string
  nextLabel?: string
  className?: string
}

/* ─── Brand tokens (same as ProblemStory and HowItWorksSteps) ──────────────── */
const FONT_SANS =
  "var(--font-jakarta, 'Plus Jakarta Sans'), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
const FONT_MONO =
  "var(--font-geist-mono, 'Geist Mono'), 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const MONO = { fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' } as const

const PRI = '#2B59E0'
const GREEN = '#059669'
const AMBER = '#B45309'
const RED = '#DC2626'
const EASE = [0.22, 1, 0.36, 1] as const

const TILE_BG = 'linear-gradient(150deg, #5B86F6 0%, #2B59E0 52%, #1C3FB4 100%)'
const CARD_BG = 'linear-gradient(180deg, #F7F9FF 0%, #EEF3FE 100%)'
const CHIP = 'border border-[#E3E9F6] bg-white shadow-[0_10px_24px_-14px_rgba(15,23,41,0.28)]'

/* ─── Copy ─────────────────────────────────────────────────────────────────── */
// Each card answers one pain from ProblemStory, whose tags are crossed out here.
const CARDS = [
  {
    n: '01',
    tag: 'Scattered',
    title: 'Every lead in one inbox.',
    desc: 'Portal, ad and WhatsApp enquiries land in one list. No copy-paste, no duplicates.',
  },
  {
    n: '02',
    tag: 'Slow',
    title: 'Call the hottest lead first.',
    desc: 'Every enquiry gets an intent score, and the dialer lines up who to call next.',
  },
  {
    n: '03',
    tag: 'Forgotten',
    title: "Follow-ups that don't slip.",
    desc: "Today shows who's slipping, who's due and who's new, every morning.",
  },
  {
    n: '04',
    tag: 'Invisible',
    title: 'Your whole pipeline, live.',
    desc: "Every lead, stage and agent on one board. See what's stuck at a glance.",
  },
  {
    n: '+',
    tag: 'Built in',
    title: 'Everything else, built in.',
    desc: 'Broadcasts, imports, deals and an AI advisor. No extra tools.',
  },
] as const

const SOURCES = ['99acres', 'MagicBricks', 'Housing.com', 'NoBroker', 'Facebook', 'WhatsApp']
const DOTS: Record<string, string> = {
  '99acres': '#F59E0B',
  MagicBricks: '#DC2626',
  'Housing.com': '#059669',
  NoBroker: '#7C3AED',
  Facebook: '#1D4ED8',
  WhatsApp: '#0D9488',
}
// The same people who got lost in ProblemStory's spreadsheet, now in one list.
const INBOX = [
  { name: 'Priya D.', src: 'WhatsApp', note: '2BHK · brochure', score: 92 },
  { name: 'Rohan Mehta', src: 'MagicBricks', note: '+ Housing.com', merged: true },
  { name: 'Ananya Rao', src: '99acres', note: '3BHK · Baner', score: 71 },
  { name: 'Kunal Shah', src: 'Facebook', note: 'Lead form · Wakad', score: 64 },
]
const TODAY = [
  { label: 'Slipping', n: 3, color: AMBER, bg: 'rgba(245,158,11,0.12)' },
  { label: 'Due today', n: 5, color: PRI, bg: 'rgba(43,89,224,0.08)' },
  { label: 'Fresh', n: 4, color: GREEN, bg: 'rgba(5,150,105,0.09)' },
]
const STAGES = [
  { label: 'New', n: 24, color: '#8FB0FF' },
  { label: 'Cold', n: 18, color: '#5B86F6' },
  { label: 'Warm', n: 11, color: PRI, stuck: true },
  { label: 'Hot', n: 6, color: '#1C3FB4' },
  { label: 'NC', n: 4, color: '#C3CAD9' },
]
const EXTRAS: [LucideIcon, string][] = [
  [Megaphone, 'WhatsApp broadcast'],
  [Sparkles, 'AI advisor'],
  [FileUp, 'CSV import'],
  [Building2, 'Properties'],
  [Handshake, 'Deals'],
  [History, 'Lead timeline'],
  [UserX, 'Auto-disqualify'],
]

/* ─── Motion helpers ───────────────────────────────────────────────────────── */
// With reduced motion every reveal lands instantly. Only the transition changes,
// so the server HTML is the same either way.
const Calm = createContext(false)

type From = { x?: number; y?: number; scale?: number }
const REST = { x: 0, y: 0, scale: 1 }

function enter(calm: boolean, delay: number, from: From = { y: 14 }, duration = 0.6): Variants {
  const to: From = {}
  for (const k of Object.keys(from) as (keyof From)[]) to[k] = REST[k]
  return {
    hidden: { opacity: 0, ...from },
    show: {
      opacity: 1,
      ...to,
      transition: calm ? { duration: 0 } : { duration, ease: EASE, delay },
    },
  }
}

function grow(calm: boolean, delay: number, to = 1): Variants {
  return {
    hidden: { scaleX: 0 },
    show: { scaleX: to, transition: calm ? { duration: 0 } : { duration: 0.9, ease: EASE, delay } },
  }
}

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.6, ease: EASE, delay },
  }
}

/* ─── Section ──────────────────────────────────────────────────────────────── */
export function SolutionBento({
  id = 'solution',
  nextHref,
  nextLabel = 'See how it works',
  className = '',
}: SolutionBentoProps) {
  const uid = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const calm = !!useReducedMotion()

  const goNext = (e: MouseEvent<HTMLAnchorElement>) => {
    if (nextHref) return
    const next = sectionRef.current?.nextElementSibling
    if (!next) return
    e.preventDefault()
    next.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  }

  const arts = [
    <InboxArt key="a" />,
    <ScoreArt key="b" />,
    <TodayArt key="c" />,
    <PipelineArt key="d" />,
    <ExtrasArt key="e" />,
  ]

  return (
    <MotionConfig reducedMotion="user">
      <Calm.Provider value={calm}>
        <section
          id={id}
          ref={sectionRef}
          aria-labelledby={`${uid}-title`}
          className={`relative isolate overflow-hidden bg-white py-16 text-[#0F1729] antialiased sm:py-20 ${className}`}
          style={{ fontFamily: FONT_SANS, wordSpacing: '0.03em' }}
        >
          <Backdrop />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            {/* ── Header ── */}
            <div className="flex flex-col gap-4">
              <motion.div
                {...rise(0)}
                className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-[#2B59E0]"
                style={MONO}
              >
                <span className="h-[2px] w-7 rounded-full bg-[#2B59E0]" />
                The solution
              </motion.div>
              <h2
                id={`${uid}-title`}
                className="text-[34px] font-extrabold leading-[1.06] tracking-[-0.035em] sm:text-[44px] lg:text-[46px]"
              >
                <motion.span
                  className="inline-block"
                  initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.06 }}
                >
                  One CRM.
                </motion.span>
                {' '}
                <motion.span
                  className="inline-block"
                  style={{ color: PRI }}
                  initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
                >
                  Every leak closed.
                </motion.span>
              </h2>
              <motion.p
                {...rise(0.3)}
                className="max-w-xl text-[16px] leading-relaxed text-[#5C6479] sm:text-[17px]"
              >
                LeadGap catches every enquiry, tells your team who to call first and keeps every
                follow-up and deal in view.
              </motion.p>
            </div>

            {/* ── Cards ── */}
            <div className="mt-10 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:mt-12 lg:grid-cols-3">
              {CARDS.map((c, i) => (
                <Card
                  key={c.n}
                  {...c}
                  wide={i === 0}
                  fluid={i === CARDS.length - 1}
                  art={arts[i]}
                  delay={(i < 2 ? i : i - 2) * 0.08}
                />
              ))}
            </div>

            {/* ── Hand-off to How it works ── */}
            <motion.p
              {...rise(0.1)}
              className="mt-9 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[15px] text-[#5C6479]"
            >
              <span>Live in under 3 minutes.</span>
              <a
                href={nextHref ?? '#'}
                onClick={goNext}
                className="group inline-flex items-center gap-1.5 rounded-[6px] font-bold text-[#2B59E0] outline-none transition-colors hover:text-[#1C3FB4] focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
              >
                {nextLabel}
                <ArrowDown
                  className="size-4 transition-transform duration-300 group-hover:translate-y-0.5"
                  strokeWidth={2.5}
                />
              </a>
            </motion.p>
          </div>
        </section>
      </Calm.Provider>
    </MotionConfig>
  )
}

export default SolutionBento

/* ─── Card ─────────────────────────────────────────────────────────────────── */
function Card({
  n,
  tag,
  title,
  desc,
  art,
  wide = false,
  fluid = false,
  delay = 0,
}: {
  n: string
  tag: string
  title: string
  desc: string
  art: ReactNode
  wide?: boolean
  fluid?: boolean
  delay?: number
}) {
  const calm = useContext(Calm)
  const isFix = n !== '+'
  return (
    <motion.article
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35 }}
      variants={enter(calm, delay, { y: 28 }, 0.7)}
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#DCE4F5] transition-[border-color,box-shadow] duration-500 hover:border-[#C3D2F4] hover:shadow-[0_30px_60px_-36px_rgba(43,89,224,0.5)] ${
        wide ? 'md:col-span-2 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : ''
      }`}
      style={{ background: CARD_BG }}
    >
      <div
        aria-hidden
        className={`relative transition-transform duration-500 ease-out group-hover:-translate-y-1 ${
          wide
            ? 'h-[264px] md:order-2 md:h-auto md:min-h-[310px]'
            : fluid
              ? 'min-h-[232px]'
              : 'h-[232px]'
        }`}
      >
        {art}
      </div>
      <div
        className={`flex flex-col px-6 pb-6 sm:px-7 sm:pb-7 ${wide ? 'pt-1 md:order-1 md:justify-end md:pt-7' : 'pt-1'}`}
      >
        <div
          aria-hidden
          className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em]"
          style={MONO}
        >
          <span className="text-[#2B59E0]">{n}</span>
          {isFix ? (
            <span className="relative text-[#8A93AB]">
              {tag}
              <motion.span
                className="absolute -inset-x-[3px] top-[calc(50%-0.75px)] h-[1.5px] origin-left rounded-full"
                style={{ background: RED }}
                variants={grow(calm, 0.75 + delay)}
              />
            </span>
          ) : (
            <span className="text-[#8A93AB]">{tag}</span>
          )}
        </div>
        <h3 className="mt-2.5 text-[21px] font-extrabold leading-tight tracking-[-0.025em] [text-wrap:balance] sm:text-[22px]">
          {isFix && (
            <span className="sr-only">
              Fixes problem {n}, {tag.toLowerCase()}:{' '}
            </span>
          )}
          {title}
        </h3>
        <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-[#5C6479]">{desc}</p>
      </div>
    </motion.article>
  )
}

/* ─── 01 · One inbox ───────────────────────────────────────────────────────── */
type Geo = { w: number; h: number; x0: number; ys: number[]; x1: number; mid: number }

function InboxArt() {
  const calm = useContext(Calm)
  const wrap = useRef<HTMLDivElement>(null)
  const tiles = useRef<(HTMLDivElement | null)[]>([])
  const inbox = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<Geo | null>(null)
  const inView = useInView(wrap, { once: true, amount: 0.4 })

  // Layout offsets ignore the reveal transforms, so the lines meet the tiles exactly.
  useEffect(() => {
    const el = wrap.current
    const box = inbox.current
    if (!el || !box) return
    const measure = () => {
      const first = tiles.current[0]
      if (!first) return
      setGeo({
        w: el.offsetWidth,
        h: el.offsetHeight,
        x0: first.offsetLeft + first.offsetWidth,
        ys: tiles.current.map(t => (t ? t.offsetTop + t.offsetHeight / 2 : 0)),
        x1: box.offsetLeft,
        mid: box.offsetTop + box.offsetHeight / 2,
      })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="@container h-full px-5 py-6 sm:px-7 md:py-8 md:pl-0">
      <div ref={wrap} className="relative flex h-full items-center justify-center">
        {geo && (
          <motion.svg
            className="pointer-events-none absolute inset-0"
            width={geo.w}
            height={geo.h}
            viewBox={`0 0 ${geo.w} ${geo.h}`}
            fill="none"
            initial="hidden"
            animate={inView ? 'show' : 'hidden'}
          >
            {geo.ys.map((y, i) => {
              const ye = geo.mid + (i - (geo.ys.length - 1) / 2) * 11
              const dx = (geo.x1 - geo.x0) * 0.55
              const d = `M${geo.x0} ${y} C${geo.x0 + dx} ${y} ${geo.x1 - dx} ${ye} ${geo.x1} ${ye}`
              return (
                <g key={i}>
                  <motion.path
                    d={d}
                    stroke="#C3D2F4"
                    strokeWidth={1.4}
                    variants={{
                      hidden: { pathLength: 0, opacity: 0 },
                      show: {
                        pathLength: 1,
                        opacity: 1,
                        transition: calm
                          ? { duration: 0 }
                          : { duration: 0.8, ease: EASE, delay: 0.35 + i * 0.05 },
                      },
                    }}
                  />
                  {!calm && (
                    <motion.path
                      d={d}
                      stroke={PRI}
                      strokeWidth={2}
                      strokeLinecap="round"
                      variants={{
                        hidden: { pathLength: 0.2, pathOffset: 0, opacity: 0 },
                        show: {
                          pathLength: 0.2,
                          pathOffset: 1,
                          opacity: [0, 1, 1, 0],
                          transition: { duration: 1, ease: 'easeInOut', delay: 0.9 + i * 0.09 },
                        },
                      }}
                    />
                  )}
                  <circle
                    cx={geo.x0}
                    cy={y}
                    r={2.2}
                    fill="#fff"
                    stroke="#AFC2F1"
                    strokeWidth={1.2}
                  />
                </g>
              )
            })}
          </motion.svg>
        )}

        <div className="flex h-full w-[110px] shrink-0 flex-col justify-around @[340px]:w-[118px]">
          {SOURCES.map((s, i) => (
            <motion.div
              key={s}
              ref={el => {
                tiles.current[i] = el
              }}
              variants={enter(calm, 0.15 + i * 0.05, { x: -10 })}
              className={`relative flex h-[30px] items-center gap-1.5 rounded-[9px] px-2 text-[11.5px] font-semibold text-[#2A3350] @[340px]:text-[12px] ${CHIP}`}
            >
              <span className="size-[7px] shrink-0 rounded-full" style={{ background: DOTS[s] }} />
              <span className="truncate">{s}</span>
            </motion.div>
          ))}
        </div>

        <div className="w-4 shrink-0 @[300px]:w-6 @[400px]:w-10 @[560px]:w-14" />

        <motion.div
          ref={inbox}
          variants={enter(calm, 0.4, { y: 16 })}
          className="@container/inbox relative min-w-0 max-w-[300px] flex-1 rounded-[16px] border border-[#E3E9F6] bg-white p-2.5 shadow-[0_24px_48px_-24px_rgba(43,89,224,0.38)] @[340px]:p-3 @[460px]:p-3.5"
        >
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="text-[13.5px] font-extrabold">Inbox</span>
              <span
                className="hidden truncate text-[10px] uppercase tracking-[0.12em] text-[#8A93AB] @min-[210px]/inbox:inline"
                style={MONO}
              >
                6 sources
              </span>
            </div>
            <span
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[#059669]"
              style={MONO}
            >
              <span className="relative flex size-[7px]">
                <span className="absolute inline-flex size-full rounded-full bg-[#059669] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-[7px] rounded-full bg-[#059669]" />
              </span>
              Live
            </span>
          </div>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {INBOX.map((r, i) => (
              <motion.div
                key={r.name}
                variants={enter(calm, 0.75 + i * 0.12, { x: 12 })}
                className={`flex items-center gap-2 rounded-[10px] px-1.5 py-1.5 @min-[200px]/inbox:gap-2.5 @min-[200px]/inbox:px-2 ${r.merged ? 'bg-[#F0FAF6]' : 'bg-[#F7F8FC]'}`}
              >
                <span
                  className="hidden size-7 shrink-0 items-center justify-center rounded-[8px] text-[10.5px] font-bold @min-[200px]/inbox:flex"
                  style={{ color: '#2B3A66', background: '#E6ECFB' }}
                >
                  {r.name
                    .split(' ')
                    .map(p => p[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold leading-tight">
                    {r.name}
                  </span>
                  <span
                    className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] leading-tight text-[#7A8399]"
                    style={MONO}
                  >
                    <span
                      className="size-[6px] shrink-0 rounded-full"
                      style={{ background: DOTS[r.src] }}
                    />
                    <span className="truncate">
                      {r.src}
                      <span className="hidden @min-[240px]/inbox:inline"> · {r.note}</span>
                    </span>
                  </span>
                </span>
                {r.merged ? (
                  <motion.span
                    variants={enter(calm, 1.45, { scale: 0.6 })}
                    className="flex shrink-0 items-center gap-1 rounded-[6px] bg-[#059669]/12 px-1 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#047857] @min-[210px]/inbox:px-1.5"
                    style={MONO}
                  >
                    <Check className="size-3 @min-[210px]/inbox:hidden" strokeWidth={3} />
                    <span className="hidden @min-[210px]/inbox:inline">Merged</span>
                  </motion.span>
                ) : (
                  <span
                    className="shrink-0 rounded-[6px] px-1.5 py-[2px] text-[11px] font-bold"
                    style={{ ...MONO, color: PRI, background: 'rgba(43,89,224,0.09)' }}
                  >
                    {r.score}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ─── 02 · Intent score + dialer ───────────────────────────────────────────── */
function ScoreArt() {
  const calm = useContext(Calm)
  return (
    <div className="@container flex h-full items-center justify-center px-6 pb-12 pt-4">
      <div className="flex w-full max-w-[300px] items-center">
        <SideTile icon={Gauge} label="Intent score" delay={0.3} />
        <motion.span
          variants={grow(calm, 0.5)}
          className="h-[2px] min-w-3 flex-1 origin-left rounded-full"
          style={{ background: 'linear-gradient(90deg, #BCD0FA, #6E93F2)' }}
        />
        <motion.div
          variants={enter(calm, 0.15, { scale: 0.85 })}
          className="relative flex size-[104px] shrink-0 items-center justify-center rounded-[28px] shadow-[0_26px_50px_-18px_rgba(43,89,224,0.65)] @[300px]:size-[118px] @[300px]:rounded-[32px] @[340px]:size-[128px]"
          style={{ background: TILE_BG }}
        >
          <span className="absolute inset-[1px] rounded-[31px] bg-gradient-to-b from-white/25 to-transparent opacity-60" />
          <svg
            viewBox="0 0 100 100"
            className="absolute size-[82px] -rotate-90 @[300px]:size-[92px] @[340px]:size-[100px]"
          >
            <circle
              cx={50}
              cy={50}
              r={42}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={6.5}
            />
            <motion.circle
              cx={50}
              cy={50}
              r={42}
              fill="none"
              stroke="#fff"
              strokeWidth={6.5}
              strokeLinecap="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                show: {
                  pathLength: 0.92,
                  opacity: 1,
                  transition: calm ? { duration: 0 } : { duration: 1.3, ease: EASE, delay: 0.5 },
                },
              }}
            />
          </svg>
          <span className="relative flex flex-col items-center leading-none text-white">
            <CountUp to={92} className="text-[30px] font-extrabold tracking-[-0.03em]" />
            <span
              className="mt-1 text-[9px] uppercase tracking-[0.16em] text-white/75"
              style={MONO}
            >
              Hot
            </span>
          </span>
          <motion.span
            variants={enter(calm, 1.2, { y: 8 })}
            className={`absolute left-1/2 top-[calc(100%+14px)] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3 text-[12px] font-semibold text-[#2A3350] ${CHIP}`}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-[#059669] text-white">
              <PhoneCall className="size-3" strokeWidth={2.5} />
            </span>
            Call next: Priya D.
          </motion.span>
        </motion.div>
        <motion.span
          variants={grow(calm, 0.5)}
          className="h-[2px] min-w-3 flex-1 origin-right rounded-full"
          style={{ background: 'linear-gradient(90deg, #6E93F2, #BCD0FA)' }}
        />
        <SideTile icon={PhoneCall} label="Power dialer" delay={0.3} />
      </div>
    </div>
  )
}

function SideTile({
  icon: Icon,
  label,
  delay,
}: {
  icon: LucideIcon
  label: string
  delay: number
}) {
  const calm = useContext(Calm)
  return (
    <motion.div variants={enter(calm, delay, { y: 10 })} className="relative shrink-0">
      <span
        className="flex size-11 items-center justify-center rounded-[13px] text-white shadow-[0_14px_28px_-14px_rgba(43,89,224,0.7)] @[300px]:size-12 @[340px]:size-[52px]"
        style={{ background: TILE_BG }}
      >
        <Icon className="size-[22px]" strokeWidth={2} />
      </span>
      <span className="absolute left-1/2 top-[calc(100%+8px)] -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-[#2A3350] @[300px]:text-[12px]">
        {label}
      </span>
    </motion.div>
  )
}

function CountUp({ to, className }: { to: number; className?: string }) {
  const calm = useContext(Calm)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.8 })
  const value = useMotionValue(0)
  const text = useTransform(value, v => String(Math.round(v)))
  useEffect(() => {
    if (!inView) return
    if (calm) {
      value.set(to)
      return
    }
    const run = animate(value, to, { duration: 1.3, ease: EASE, delay: 0.5 })
    return () => run.stop()
  }, [inView, calm, value, to])
  return (
    <motion.span ref={ref} className={className} style={MONO}>
      {text}
    </motion.span>
  )
}

/* ─── 03 · Today view ──────────────────────────────────────────────────────── */
function TodayArt() {
  const calm = useContext(Calm)
  return (
    <div className="relative h-full">
      <motion.div
        variants={enter(calm, 0.2, { y: 18 })}
        className="absolute bottom-[9%] left-[7%] w-[76%] max-w-[270px] rounded-[16px] border border-[#E3E9F6] bg-white p-3.5 shadow-[0_24px_48px_-24px_rgba(43,89,224,0.38)]"
      >
        <div className="flex items-center gap-2">
          <span
            className="flex size-6 items-center justify-center rounded-[7px] text-white"
            style={{ background: TILE_BG }}
          >
            <CalendarCheck className="size-3.5" strokeWidth={2.4} />
          </span>
          <span className="text-[13.5px] font-extrabold">Today</span>
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {TODAY.map((b, i) => (
            <motion.div
              key={b.label}
              variants={enter(calm, 0.5 + i * 0.12, { x: 10 })}
              className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px]"
              style={{ background: b.bg }}
            >
              <span className="size-[7px] shrink-0 rounded-full" style={{ background: b.color }} />
              <span
                className="flex-1 text-[12.5px] font-bold"
                style={{ color: i === 0 ? '#92400E' : '#2A3350' }}
              >
                {b.label}
              </span>
              <span className="text-[12px] font-bold" style={{ ...MONO, color: b.color }}>
                {b.n}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        variants={enter(calm, 0.95, { y: -10, scale: 0.94 })}
        className={`absolute right-[5%] top-[8%] w-[52%] max-w-[200px] rounded-[14px] p-3 ${CHIP}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#B45309]">
            <BellRing className="size-4" strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-bold leading-tight">
              Mehta family
            </span>
            <span
              className="mt-0.5 block truncate text-[10px] leading-tight text-[#7A8399]"
              style={MONO}
            >
              Due 5:00 PM
            </span>
          </span>
        </div>
      </motion.div>
    </div>
  )
}

/* ─── 04 · Pipeline ────────────────────────────────────────────────────────── */
function PipelineArt() {
  const calm = useContext(Calm)
  const max = STAGES[0].n
  return (
    <div className="relative h-full">
      <motion.div
        variants={enter(calm, 0.2, { y: 18 })}
        className="absolute inset-x-[7%] bottom-[9%] rounded-[16px] border border-[#E3E9F6] bg-white p-3.5 shadow-[0_24px_48px_-24px_rgba(43,89,224,0.38)]"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-extrabold">Pipeline</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#8A93AB]" style={MONO}>
            All agents
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-[9px]">
          {STAGES.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2.5">
              <span
                className="w-9 shrink-0 text-[10.5px] font-medium"
                style={{ ...MONO, color: s.stuck ? AMBER : '#7A8399' }}
              >
                {s.label}
              </span>
              <span className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-[#EEF2FB]">
                <motion.span
                  variants={grow(calm, 0.45 + i * 0.08)}
                  className="absolute inset-y-0 left-0 origin-left rounded-full"
                  style={{ width: `${(s.n / max) * 100}%`, background: s.color }}
                />
              </span>
              <span
                className="w-5 shrink-0 text-right text-[11px] font-bold text-[#2A3350]"
                style={MONO}
              >
                {s.n}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        variants={enter(calm, 1.15, { y: -8, scale: 0.94 })}
        className={`absolute right-[5%] top-[7%] flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12px] font-semibold text-[#2A3350] ${CHIP}`}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-[#FEF3C7] text-[#B45309]">
          <TriangleAlert className="size-3.5" strokeWidth={2.4} />
        </span>
        3 stuck in Warm
      </motion.div>
    </div>
  )
}

/* ─── + · Built in ─────────────────────────────────────────────────────────── */
function ExtrasArt() {
  const calm = useContext(Calm)
  const pop: Variants = {
    hidden: { opacity: 0, scale: 0.35 },
    show: {
      opacity: 1,
      scale: 1,
      transition: calm
        ? { duration: 0 }
        : { type: 'spring', stiffness: 520, damping: 14, delay: 0.28 },
    },
  }
  return (
    <div className="@container flex h-full min-h-[232px] flex-wrap content-center items-center justify-center gap-1.5 px-6 py-5 @[300px]:gap-2">
      {EXTRAS.map(([Icon, label]) => (
        <motion.span
          key={label}
          variants={pop}
          className={`flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-semibold text-[#2A3350] @[300px]:h-9 @[300px]:gap-2 @[300px]:px-3 @[300px]:text-[13px] ${CHIP}`}
        >
          <Icon className="size-4 text-[#2B59E0]" strokeWidth={2.2} />
          {label}
        </motion.span>
      ))}
    </div>
  )
}

/* ─── Backdrop ─────────────────────────────────────────────────────────────── */
function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,23,41,0.06) 1px, transparent 1.2px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 20%, transparent 75%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-48 top-1/4 -z-10 size-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(43,89,224,0.08), transparent 65%)' }}
      />
    </>
  )
}
