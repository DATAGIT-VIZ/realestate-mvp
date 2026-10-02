'use client'

/* ─────────────────────────────────────────────────────────────────────────────
 * ProblemStory · "You're not short of leads. You're losing them."
 *
 * The Problem chapter of the landing page story (intro → problem → solution →
 * how it works → CTA), sized to fit one screen on desktop. Visitors pick who
 * they are (agent, broker or developer) and see their four pain points play
 * out live in one stage: leads scattered across sources, the late first call,
 * the follow-up that slips, and a pipeline nobody can see. It ends on a
 * hand-off that scrolls to the next section on the page.
 *
 * Same look as HowItWorksSteps: Plus Jakarta Sans, cobalt, motion/react, lucide.
 * Stack: React 19 · TypeScript · Tailwind CSS v4 · motion (motion/react) · lucide-react
 * Usage:  <ProblemStory />            (every prop is optional)
 * ──────────────────────────────────────────────────────────────────────────── */

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, MotionConfig, motion, useInView } from 'motion/react'
import {
  ArrowDown,
  BellRing,
  Building2,
  Check,
  Eye,
  FileSpreadsheet,
  Pause,
  Play,
  Square,
  TrendingDown,
  UserMinus,
  UserRound,
  Users,
} from 'lucide-react'

export type ProblemStoryProps = {
  /** Section anchor. */
  id?: string
  /** Where the closing link goes. By default it smooth-scrolls to the next section on the page. */
  nextHref?: string
  nextLabel?: string
  className?: string
}

/* ─── Brand tokens (same as HowItWorksSteps) ───────────────────────────────── */
const FONT_SANS =
  "var(--font-jakarta, 'Plus Jakarta Sans'), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
const FONT_MONO =
  "var(--font-geist-mono, 'Geist Mono'), 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const MONO = { fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' } as const
const PRI = '#2B59E0'
const GREEN = '#059669'
const RED = '#DC2626'
const AMBER = '#B45309'
const SLATE = '#64748B'
const BORDER = '#E8EAF0'
const RED_BG = 'rgba(220,38,38,0.08)'
const AMBER_BG = 'rgba(245,158,11,0.12)'
const EASE = [0.22, 1, 0.36, 1] as const

/* ─── Who is reading ─────────────────────────────────────────────────────────── */
const AUDS = [
  { key: 'agents', label: 'Agents', icon: UserRound },
  { key: 'brokers', label: 'Brokers', icon: Users },
  { key: 'developers', label: 'Developers', icon: Building2 },
] as const
type Aud = (typeof AUDS)[number]['key']
const START_AUD = 1

const PAINS: Record<Aud, { title: string; desc: string }[]> = {
  agents: [
    {
      title: 'Leads are everywhere.',
      desc: 'Portal apps, WhatsApp and missed calls. Numbers get scribbled down between site visits.',
    },
    {
      title: "The first call wins. You're late.",
      desc: "The hot enquiry lands while you're showing a flat. By the time you call back, they've booked with someone else.",
    },
    {
      title: 'Follow-ups slip.',
      desc: 'Ten site visits a week, and nothing reminds you about the buyer who wanted to come back on Sunday.',
    },
    {
      title: 'Nobody sees your work.',
      desc: 'Your calls and visits live on your phone, so "whose client is this?" gets settled by argument.',
    },
  ],
  brokers: [
    {
      title: 'Leads are everywhere.',
      desc: 'Five portals, ads and WhatsApp, each with its own inbox. The spreadsheet catches up tomorrow.',
    },
    {
      title: "The first call wins. You're late.",
      desc: 'Enquiries sit unassigned for hours, and nobody knows which one to call first.',
    },
    {
      title: 'Follow-ups slip.',
      desc: 'The site visit went well. Nobody called back. The buyer went quiet.',
    },
    {
      title: "You can't see your own pipeline.",
      desc: 'Who called whom gets settled on WhatsApp. When an agent leaves, their leads leave too.',
    },
  ],
  developers: [
    {
      title: 'Launch leads scatter.',
      desc: 'Ads, portals and channel partners each send leads to a different sheet during launch week.',
    },
    {
      title: 'Paid leads go cold.',
      desc: "Your sales team can't call a launch-week surge fast enough. Leads you paid for wait for days.",
    },
    {
      title: "Site visits don't convert.",
      desc: 'Families visit the sample flat, then nobody follows up before they book another project.',
    },
    {
      title: "No idea what's working.",
      desc: 'Which campaign or channel partner brought the booking? Nobody can say for sure.',
    },
  ],
}
const TAGS = ['Scattered', 'Slow', 'Forgotten', 'Invisible']
const STAGE_LABEL: Record<Aud, string> = {
  agents: 'Your phone · Monday',
  brokers: 'Skyline Realty · Monday',
  developers: 'Tower B launch · week 1',
}

/* ─── Script (ms) ────────────────────────────────────────────────────────────── */
// Each pain point plays for DUR ms, rests HOLD ms, then the next one starts.
// After the fourth, the audience rotates until a visitor picks one.
const DUR = [5600, 5800, 5600, 6200]
const HOLD = 1800

const DOTS: Record<string, string> = {
  '99acres': '#F59E0B',
  MagicBricks: '#DC2626',
  'Housing.com': '#059669',
  Facebook: '#1D4ED8',
  'Meta ads': '#1D4ED8',
  'Google ads': '#EA580C',
  WhatsApp: '#0D9488',
  'Missed calls': SLATE,
  'Missed call': SLATE,
  'Walk-ins': AMBER,
  'Walk-in': AMBER,
  'Channel partners': '#7C8CF8',
  'Channel partner': '#7C8CF8',
  'CP · Rathi': '#7C8CF8',
}

// 01 · Scattered
type Row = { name: string; phone: string; src: string }
const SCATTER: Record<
  Aud,
  { sources: [string, number][]; toasts: [string, string, string][]; file: string; rows: Row[] }
> = {
  agents: {
    sources: [
      ['99acres', 6],
      ['MagicBricks', 4],
      ['WhatsApp', 11],
      ['Missed calls', 7],
      ['Walk-ins', 2],
    ],
    toasts: [
      ['MagicBricks', 'Vikram Iyer', '2BHK · Baner'],
      ['Missed call', '+91 99230 1••••', 'Called twice · no message'],
      ['WhatsApp', 'Neel Desai', '"Can we see it on Sunday?"'],
      ['99acres', 'Ananya Rao', '3BHK · Powai'],
      ['Walk-in', 'Mr. Kulkarni', 'Left his card at the site'],
      ['WhatsApp', 'Priyanka D.', '"Any 1BHK under 60 L?"'],
    ],
    file: 'Notes · my leads',
    rows: [
      { name: 'Vikram Iyer', phone: '99230 18844', src: 'MagicBricks' },
      { name: 'Neel Desai', phone: '98220 55102', src: 'WhatsApp' },
      { name: 'Vikram I.', phone: '99230 18844', src: '99acres' },
    ],
  },
  brokers: {
    sources: [
      ['99acres', 12],
      ['MagicBricks', 8],
      ['Housing.com', 5],
      ['Facebook', 17],
      ['WhatsApp', 23],
    ],
    toasts: [
      ['99acres', 'Ananya Rao', '3BHK · Powai'],
      ['WhatsApp', '+91 98201 4••••', '"Is the Thane flat available?"'],
      ['MagicBricks', 'Rohan Mehta', '2BHK · Andheri West'],
      ['Facebook', 'Kunal Shah', 'Lead form · Wakad'],
      ['Housing.com', 'Rohan M.', '2BHK · Andheri'],
      ['WhatsApp', 'Priyanka D.', '"Please send the brochure"'],
    ],
    file: 'leads_FINAL_v3.xlsx',
    rows: [
      { name: 'Rohan Mehta', phone: '98765 43210', src: 'MagicBricks' },
      { name: 'Ananya Rao', phone: '99887 76655', src: '99acres' },
      { name: 'Rohan M.', phone: '98765 43210', src: 'Housing.com' },
    ],
  },
  developers: {
    sources: [
      ['Meta ads', 184],
      ['Google ads', 96],
      ['99acres', 58],
      ['Channel partners', 41],
      ['Walk-ins', 23],
    ],
    toasts: [
      ['Meta ads', 'Farah Khan', 'Tower B · 3BHK'],
      ['Google ads', 'Amit Joshi', 'Searched "Tower B price"'],
      ['Channel partner', 'Rathi Associates', 'Registered 3 clients'],
      ['99acres', 'Ananya Rao', 'Tower B · 2BHK'],
      ['Meta ads', 'Farah K.', 'Tower B · 3BHK'],
      ['Walk-in', 'The Mehta family', 'Sample flat visit'],
    ],
    file: 'TowerB_launch_leads.xlsx',
    rows: [
      { name: 'Farah Khan', phone: '98190 22417', src: 'Meta ads' },
      { name: 'Ananya Rao', phone: '99887 76655', src: '99acres' },
      { name: 'Farah K.', phone: '98190 22417', src: 'CP · Rathi' },
    ],
  },
}
const TOAST_AT = [250, 800, 1350, 1900, 2450, 3000]
const ROW_AT = [1500, 2500, 3500]
const DUP_AT = 4200
const UNTOUCHED_AT = 4700

// 02 · Slow
type Ev = [time: string, text: string, kind: 'in' | 'them' | 'you']
const SLOW: Record<
  Aud,
  {
    name: string
    need: string
    src: string
    wait: number
    events: Ev[]
    reply: string
    lost: string
  }
> = {
  agents: {
    name: 'Vikram Iyer',
    need: '2BHK · Baner · ₹95 L',
    src: 'MagicBricks',
    wait: 226,
    events: [
      ['10:02', "Enquiry lands while you're at a site visit", 'in'],
      ['10:06', 'Another agent calls him', 'them'],
      ['11:15', 'He books their visit for Sunday', 'them'],
      ['1:48', 'You call back after your visit', 'you'],
    ],
    reply: 'Sorry, already fixed a visit with another agent.',
    lost: 'Your commission on a ₹95 L deal, gone.',
  },
  brokers: {
    name: 'Ananya Rao',
    need: '3BHK · Powai · ₹2.1 Cr',
    src: '99acres',
    wait: 252,
    events: [
      ['10:02', 'Enquiry lands on 99acres, unassigned', 'in'],
      ['10:09', 'Another broker calls her', 'them'],
      ['11:40', 'She books their site visit', 'them'],
      ['2:14', 'Your team calls back', 'you'],
    ],
    reply: 'Already booked a site visit with another broker. Thanks!',
    lost: 'A ₹2.1 Cr deal went to another broker.',
  },
  developers: {
    name: 'Farah Khan',
    need: 'Tower B · 3BHK · ₹1.8 Cr',
    src: 'Meta ads',
    wait: 2690,
    events: [
      ['Day 1', 'Paid lead from your launch ad', 'in'],
      ['Day 1', "A competing project's team calls her", 'them'],
      ['Day 2', 'She visits their sample flat', 'them'],
      ['Day 3', 'Your sales team reaches her', 'you'],
    ],
    reply: "We've already booked at another project. Thanks.",
    lost: 'A ₹1.8 Cr booking you paid to acquire, gone.',
  },
}
const EV_AT = [400, 1500, 2700, 4000]
const TOO_LATE_AT = 4400
const REPLY_AT = 4700
const LOST_AT = 5200

// 03 · Forgotten
const FOLLOW: Record<
  Aud,
  { name: string; need: string; note: string; todo: string; alert: string }
> = {
  agents: {
    name: 'Neel Desai',
    need: '3BHK · Kharadi',
    note: 'Wants to come back on Sunday with his wife.',
    todo: 'Call Neel back · Mon',
    alert: 'Neel saved 3 listings from other agents this week.',
  },
  brokers: {
    name: 'Sana Qureshi',
    need: '2BHK · Lodha Amara',
    note: 'Loved the 2BHK. Bringing her parents next weekend.',
    todo: 'Call Sana back · Mon',
    alert: 'Sana viewed 4 other projects this week.',
  },
  developers: {
    name: 'The Mehta family',
    need: 'Tower B sample flat',
    note: 'Liked the 3BHK view. Waiting on home loan approval.',
    todo: 'Share loan partner list · Mon',
    alert: 'They visited 2 competing projects this week.',
  },
}
const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY0 = 800
const DAY_MS = 520
const ALERT_AT = 4600

// 04 · Invisible
type Msg = { who: string; text: string; color: string }
type Panel =
  | { kind: 'leads'; title: string; rows: [string, string][]; more: number }
  | { kind: 'record'; title: string; fields: [string, string][] }
const BLIND: Record<
  Aud,
  {
    group: string
    members: [number, number]
    chat: Msg[]
    system: string
    loss: string
    panel: Panel
  }
> = {
  agents: {
    group: 'Skyline Realty · Agents',
    members: [6, 6],
    chat: [
      {
        who: 'You',
        text: 'Who called my Kharadi lead? He says our office rang him twice.',
        color: PRI,
      },
      { who: 'Neha', text: 'He was in my sheet too.', color: '#1D4ED8' },
      { who: 'Arjun', text: 'I took him for the Sunday visit.', color: AMBER },
      { who: 'Neha', text: 'So whose client is he?', color: '#1D4ED8' },
    ],
    system: 'No call log found',
    loss: 'No call log, no visit record. Credit goes to whoever claims it.',
    panel: {
      kind: 'record',
      title: 'Neel Desai · Kharadi',
      fields: [
        ['Owner', '?'],
        ['Calls logged', '0'],
        ['Site visit', 'not logged'],
        ['Notes', 'none'],
      ],
    },
  },
  brokers: {
    group: 'Skyline Realty · Team',
    members: [6, 5],
    chat: [
      { who: 'You', text: 'Who spoke to the Thane 3BHK lead yesterday?', color: PRI },
      { who: 'Arjun', text: 'Not me', color: AMBER },
      { who: 'Neha', text: 'Priya, I think?', color: '#1D4ED8' },
      { who: 'Priya', text: 'Which Thane lead?', color: GREEN },
    ],
    system: 'Vikas left the group',
    loss: 'His 41 leads and their call notes were on his phone.',
    panel: {
      kind: 'leads',
      title: "Vikas's leads",
      rows: [
        ['Kiran Patil', 'Site visit'],
        ['Meera Nair', 'Negotiation'],
        ['Arvind Rao', 'Warm'],
        ['Sneha Kulkarni', 'New'],
        ['Javed Khan', 'Follow-up'],
      ],
      more: 36,
    },
  },
  developers: {
    group: 'Tower B · Sales',
    members: [9, 8],
    chat: [
      { who: 'You', text: 'Which channel partner brought the Patel booking?', color: PRI },
      { who: 'Arjun', text: 'Walk-in, I think?', color: AMBER },
      { who: 'Rathi Associates', text: 'Our client. Registered him last month.', color: '#0D9488' },
      { who: 'Neha', text: 'He filled the Meta ad form too.', color: '#1D4ED8' },
    ],
    system: 'Vikas left the group',
    loss: 'Nobody can say which ad or partner earned this booking.',
    panel: {
      kind: 'record',
      title: 'Patel booking',
      fields: [
        ['Campaign', '?'],
        ['Channel partner', 'disputed'],
        ['Sales owner', 'Vikas · left'],
        ['Call notes', 'on his phone'],
      ],
    },
  },
}
const MSG_AT = [300, 1350, 2250, 3150]
const TYPING_MS = 600
const SYSTEM_AT = 4000
const GHOST_AT = 4300
const LOSS_AT = 5000

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
const typed = (s: string, t: number, start: number, msPerChar = 45) =>
  s.slice(0, Math.max(0, Math.min(s.length, Math.floor((t - start) / msPerChar))))
const initials = (s: string) =>
  s
    .replace(/^The /, '')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => (w[0] ?? '').toUpperCase())
    .join('')
const waitLabel = (mins: number) =>
  mins >= 1440
    ? `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
    : `${Math.floor(mins / 60)}h ${String(Math.floor(mins % 60)).padStart(2, '0')}m`

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.6, ease: EASE, delay },
  }
}

// Media queries that read `false` during SSR and hydration, so the server HTML
// always matches, then switch to the real value on the client.
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    useCallback(
      (onChange: () => void) => {
        const mq = window.matchMedia(query)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
      },
      [query]
    ),
    () => window.matchMedia(query).matches,
    () => false
  )
}

/* ─── Clock ──────────────────────────────────────────────────────────────────── */
// One rAF clock drives the stage, so every moment is deterministic and can pause,
// loop and jump. Everything on screen is derived from (aud, pain, t).
type Clock = { aud: number; pain: number; t: number }
const CLOCK_START: Clock = { aud: START_AUD, pain: 0, t: 0 }

function useProblemClock(playing: boolean, rotateAudience: boolean) {
  const live = useRef<Clock>(CLOCK_START)
  const [clock, setClock] = useState<Clock>(CLOCK_START)
  const rotate = useRef(rotateAudience)
  useEffect(() => {
    rotate.current = rotateAudience
  }, [rotateAudience])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 64) : 0
      last = now
      let { aud, pain, t } = live.current
      t += dt
      if (t >= DUR[pain] + HOLD) {
        t = 0
        pain = (pain + 1) % DUR.length
        if (pain === 0 && rotate.current) aud = (aud + 1) % AUDS.length
      }
      live.current = { aud, pain, t }
      setClock(live.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const jump = useCallback((patch: Partial<Omit<Clock, 't'>>) => {
    live.current = { ...live.current, ...patch, t: 0 }
    setClock(live.current)
  }, [])

  return [clock, jump] as const
}

/* ─── Section ────────────────────────────────────────────────────────────────── */
export function ProblemStory({
  id = 'problem',
  nextHref,
  nextLabel = 'See how LeadGap fixes it',
  className = '',
}: ProblemStoryProps) {
  const uid = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { amount: 0.35 })
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [paused, setPaused] = useState(false)
  const [picked, setPicked] = useState(false)

  const [{ aud: audIndex, pain, t: clockT }, jump] = useProblemClock(
    inView && !paused && !reduce,
    !picked
  )
  // With reduced motion there is no autoplay: each moment shows its finished state.
  const t = reduce ? DUR[pain] : Math.min(clockT, DUR[pain])
  const aud = AUDS[audIndex].key
  const pains = PAINS[aud]
  const progress = (i: number) => (i === pain ? (reduce ? 1 : clamp01(clockT / DUR[i])) : 0)

  const pickAudience = (i: number) => {
    setPicked(true)
    jump({ aud: i, pain: 0 })
  }

  const goNext = (e: MouseEvent<HTMLAnchorElement>) => {
    if (nextHref) return
    const next = sectionRef.current?.nextElementSibling
    if (!next) return
    e.preventDefault()
    next.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <MotionConfig reducedMotion="user">
      <section
        id={id}
        ref={sectionRef}
        aria-labelledby={`${uid}-title`}
        className={`relative isolate overflow-hidden bg-white py-16 text-[#0F1729] antialiased lg:py-14 ${className}`}
        style={{ fontFamily: FONT_SANS, wordSpacing: '0.03em' }}
      >
        <Backdrop />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          {/* ── Header ── */}
          <motion.div
            {...rise(0)}
            className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-[#2B59E0]"
            style={MONO}
          >
            <span className="h-[2px] w-7 rounded-full bg-[#2B59E0]" />
            The problem
          </motion.div>
          <h2
            id={`${uid}-title`}
            className="mt-4 text-[34px] font-extrabold leading-[1.06] tracking-[-0.035em] sm:text-[44px] lg:text-[40px] xl:text-[46px]"
          >
            {[
              ["You're", 'not', 'short', 'of', 'leads.'],
              ["You're", 'losing', 'them.'],
            ].map((line, l) => (
              <Fragment key={l}>
                <span className="block [text-wrap:balance] lg:inline">
                  {line.map((word, w) => (
                    <Fragment key={word + w}>
                      <motion.span
                        className="inline-block"
                        style={{ color: l ? PRI : undefined }}
                        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ duration: 0.7, ease: EASE, delay: 0.06 + (l * 5 + w) * 0.06 }}
                      >
                        {word}
                      </motion.span>
                      {w < line.length - 1 && ' '}
                    </Fragment>
                  ))}
                </span>
                {l === 0 && ' '}
              </Fragment>
            ))}
          </h2>
          <motion.p
            {...rise(0.3)}
            className="mt-3 max-w-3xl text-[16px] leading-relaxed text-[#5C6479] sm:text-[17px]"
          >
            Agent, broker or developer, the leaks look the same. Pick yours and watch where the
            deals go.
          </motion.p>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
            {/* ── Left: who you are, then the four pain points ── */}
            <div className="flex min-w-0 flex-col">
              <motion.div
                {...rise(0.35)}
                role="radiogroup"
                aria-label="Show pain points for"
                className="grid grid-cols-3 gap-1 rounded-[14px] border border-[#E6EAF3] bg-[#F4F6FB] p-1"
              >
                {AUDS.map((a, i) => {
                  const on = i === audIndex
                  const Icon = a.icon
                  return (
                    <button
                      key={a.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pickAudience(i)}
                      className="relative flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[13.5px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
                      style={{ color: on ? '#0F1729' : '#5C6479' }}
                    >
                      {on && (
                        <motion.span
                          layoutId={`${uid}-aud`}
                          className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_2px_rgba(15,23,41,0.06),0_6px_16px_rgba(20,36,90,0.08)]"
                          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                        />
                      )}
                      <Icon
                        className="relative size-4 shrink-0 max-[379px]:hidden"
                        strokeWidth={2.25}
                        style={{ color: on ? PRI : undefined }}
                      />
                      <span className="relative">{a.label}</span>
                    </button>
                  )
                })}
              </motion.div>

              {/* desktop: the four pain points as an accordion */}
              <div
                role="tablist"
                aria-label="Pain points"
                aria-orientation="vertical"
                className="mt-4 hidden flex-col gap-1.5 lg:flex"
              >
                {pains.map((p, i) => {
                  const active = i === pain
                  return (
                    <motion.button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`${uid}-stage`}
                      onClick={() => jump({ pain: i })}
                      {...rise(0.4 + i * 0.06)}
                      className="relative w-full cursor-pointer rounded-[16px] border p-3.5 text-left outline-none transition-[background-color,border-color,box-shadow] duration-500 focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
                      style={{
                        background: active ? '#FFFFFF' : 'rgba(255,255,255,0)',
                        borderColor: active ? '#DCE3F5' : 'rgba(220,227,245,0)',
                        boxShadow: active
                          ? '0 1px 2px rgba(15,23,41,0.04), 0 16px 40px rgba(20,36,90,0.10)'
                          : '0 1px 2px rgba(15,23,41,0), 0 16px 40px rgba(20,36,90,0)',
                      }}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-[12px] font-semibold transition-colors duration-300"
                          style={{
                            ...MONO,
                            background: active ? '#FDECEC' : '#F1F3F8',
                            color: active ? RED : '#7A839A',
                          }}
                        >
                          0{i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={aud + i}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.2 }}
                              className="block truncate text-[16px] font-extrabold tracking-[-0.01em]"
                              style={{ color: active ? '#0F1729' : '#3B4A6B' }}
                            >
                              {p.title}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                        <span
                          className="shrink-0 text-[10.5px] uppercase tracking-[0.14em] text-[#9AA2B8]"
                          style={MONO}
                        >
                          {TAGS[i]}
                        </span>
                      </span>
                      <AnimatePresence initial={false}>
                        {active && (
                          <motion.span
                            key="desc"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: EASE }}
                            className="block overflow-hidden pl-11"
                          >
                            <span className="block pt-1.5 text-[14px] leading-relaxed text-[#5C6479]">
                              {p.desc}
                            </span>
                            <span className="mt-3 block h-[3px] overflow-hidden rounded-full bg-[#E6EBF6]">
                              <span
                                className="block h-full origin-left rounded-full bg-[#2B59E0]"
                                style={{ transform: `scaleX(${progress(i)})` }}
                              />
                            </span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  )
                })}
              </div>

              {/* desktop: the hand-off closes the left column */}
              <motion.div {...rise(0.6)} className="mt-auto hidden pt-4 lg:block">
                <HandOff href={nextHref} label={nextLabel} onClick={goNext} compact />
              </motion.div>

              {/* phones and tablets: pager plus the active pain point */}
              <div className="mt-5 lg:hidden">
                <div className="grid grid-cols-4 gap-1.5">
                  {pains.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => jump({ pain: i })}
                      aria-label={`Show pain point ${i + 1}: ${p.title}`}
                      className="flex h-6 cursor-pointer flex-col justify-center outline-none"
                    >
                      <span className="block h-1.5 overflow-hidden rounded-full bg-[#E6EBF6]">
                        <span
                          className="block h-full origin-left rounded-full"
                          style={{
                            transform: `scaleX(${i < pain ? 1 : progress(i)})`,
                            background: i === pain ? PRI : '#AFC0EA',
                          }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 min-h-[104px]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={aud + pain}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div
                        className="text-[11px] font-medium uppercase tracking-[0.14em]"
                        style={{ ...MONO, color: RED }}
                      >
                        0{pain + 1} · {TAGS[pain]}
                      </div>
                      <div className="mt-1 text-[20px] font-extrabold tracking-[-0.02em] [text-wrap:balance]">
                        {pains[pain].title}
                      </div>
                      <p className="mt-1 text-[14.5px] leading-relaxed text-[#5C6479]">
                        {pains[pain].desc}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* ── Right: the stage ── */}
            <motion.div
              {...rise(0.2)}
              id={`${uid}-stage`}
              role="tabpanel"
              aria-label={pains[pain].title}
              className="relative min-w-0 overflow-hidden rounded-[22px] border border-[#E2E7F2] bg-white shadow-[0_1px_2px_rgba(15,23,41,0.04),0_30px_70px_-20px_rgba(20,36,90,0.22)]"
            >
              <div className="flex h-11 items-center gap-3 border-b border-[#EEF0F5] bg-[#FBFCFE] pl-4 pr-2">
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#DC2626] opacity-50 motion-reduce:hidden" />
                  <span className="relative size-2 rounded-full bg-[#DC2626]" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[#5C6479]" style={MONO}>
                  {STAGE_LABEL[aud]}
                </span>
                <span className="shrink-0 text-[11px] text-[#9AA2B8]" style={MONO}>
                  0{pain + 1} / 04
                </span>
                {!reduce && (
                  <button
                    type="button"
                    onClick={() => setPaused(p => !p)}
                    aria-label={paused ? 'Play' : 'Pause'}
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-[#5C6479] outline-none transition-colors hover:bg-[#EEF1F6] focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
                  >
                    {paused ? (
                      <Play className="size-3.5" fill="currentColor" strokeWidth={2} />
                    ) : (
                      <Pause className="size-3.5" fill="currentColor" strokeWidth={2} />
                    )}
                  </button>
                )}
              </div>

              <div
                aria-hidden
                className="@container relative h-[468px] bg-[#F7F8FC] sm:h-[420px] lg:h-[452px]"
              >
                <AnimatePresence initial={false}>
                  <motion.div
                    key={aud + pain}
                    className="absolute inset-0 p-3 sm:p-5"
                    initial={{ opacity: 0, x: 24, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -24, filter: 'blur(6px)' }}
                    transition={{ duration: 0.45, ease: EASE }}
                  >
                    {pain === 0 ? (
                      <ScatterScene t={t} aud={aud} />
                    ) : pain === 1 ? (
                      <SlowScene t={t} aud={aud} />
                    ) : pain === 2 ? (
                      <ForgottenScene t={t} aud={aud} />
                    ) : (
                      <InvisibleScene t={t} aud={aud} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* phones and tablets: the hand-off sits under the stage */}
          <motion.div {...rise(0.1)} className="mt-5 lg:hidden">
            <HandOff href={nextHref} label={nextLabel} onClick={goNext} />
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  )
}

export default ProblemStory

/* ─── Pieces ─────────────────────────────────────────────────────────────────── */
// "It's not your team. It's the tools." The bridge into the Solution section.
function HandOff({
  href,
  label,
  onClick,
  compact = false,
}: {
  href?: string
  label: string
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void
  compact?: boolean
}) {
  return (
    <div
      className={`flex rounded-[18px] bg-[#0B1433] text-white shadow-[0_20px_50px_-12px_rgba(11,20,51,0.45)] ${
        compact
          ? 'items-center justify-between gap-4 p-4 pl-5'
          : 'flex-col items-start gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7'
      }`}
    >
      <div
        className={`min-w-0 font-extrabold leading-tight tracking-[-0.02em] [text-wrap:balance] ${
          compact ? 'text-[17px]' : 'text-[19px] sm:text-[21px]'
        }`}
      >
        It&apos;s not your team. <span className="text-[#8FB0FF]">It&apos;s the tools.</span>
      </div>
      <a
        href={href ?? '#'}
        onClick={onClick}
        className={`group flex shrink-0 items-center gap-2 rounded-[11px] bg-[#2B59E0] font-bold text-white shadow-[0_10px_28px_rgba(43,89,224,0.45)] outline-none transition-colors hover:bg-[#3A66EA] focus-visible:ring-2 focus-visible:ring-white/60 ${
          compact ? 'h-10 px-4 text-[13.5px]' : 'h-11 px-5 text-[14.5px]'
        }`}
      >
        {label}
        <ArrowDown
          className="size-4 transition-transform duration-300 group-hover:translate-y-0.5"
          strokeWidth={2.5}
        />
      </a>
    </div>
  )
}

function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,23,41,0.07) 1px, transparent 1.2px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, #000 25%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, #000 25%, transparent 75%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/3 -z-10 size-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.06), transparent 65%)' }}
      />
    </>
  )
}

function Avatar({
  name,
  fg = '#3B4A6B',
  bg = '#EEF1F6',
  size = 32,
}: {
  name: string
  fg?: string
  bg?: string
  size?: number
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold"
      style={{ color: fg, background: bg, width: size, height: size }}
    >
      {initials(name)}
    </span>
  )
}

function Pill({ children, fg, bg }: { children: ReactNode; fg: string; bg: string }) {
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-[5px] px-1.5 py-[1px] text-[10px] font-bold tracking-[0.04em]"
      style={{ color: fg, background: bg }}
    >
      {children}
    </span>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[12px] border border-[#E8EAF0] bg-white shadow-[0_1px_2px_rgba(15,23,41,0.03)] ${className}`}
    >
      {children}
    </div>
  )
}

/* ─── 01 · Leads are everywhere ──────────────────────────────────────────────── */
function ScatterScene({ t, aud }: { t: number; aud: Aud }) {
  const d = SCATTER[aud]
  const counts = d.sources.map(([, n], i) => Math.round(n * easeOut(prog(t, 200 + i * 160, 4300))))
  const total = counts.reduce((a, b) => a + b, 0)
  const copied = ROW_AT.filter(at => t >= at).length
  const dup = t >= DUP_AT
  const toasts = d.toasts
    .map((x, i) => ({ x, i }))
    .filter(({ i }) => t >= TOAST_AT[i])
    .reverse()
    .slice(0, 3)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 @[560px]:grid-cols-[172px_minmax(0,1fr)]">
        {/* every source is its own inbox */}
        <div className="flex flex-wrap content-start gap-1.5 @[560px]:flex-col @[560px]:flex-nowrap">
          <div
            className="hidden text-[10.5px] uppercase tracking-[0.14em] text-[#9AA2B8] @[560px]:block"
            style={MONO}
          >
            {d.sources.length} inboxes
          </div>
          {d.sources.map(([name], i) => {
            const bump = counts[i] > 0 && Math.floor(t / 180) % d.sources.length === i
            return (
              <motion.span
                key={name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: 0.05 * i }}
                className="flex h-8 items-center gap-1.5 rounded-[9px] border border-[#E8EAF0] bg-white pl-2 pr-1 text-[12px] font-semibold text-[#3B4A6B] @[560px]:h-9 @[560px]:pl-2.5"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: DOTS[name] }}
                />
                <span className="@[560px]:flex-1">{name}</span>
                <motion.span
                  animate={{ scale: bump && t < 4300 ? 1.12 : 1 }}
                  transition={{ duration: 0.15 }}
                  className="min-w-[26px] rounded-[6px] px-1 text-center text-[11px] font-bold leading-5"
                  style={{ ...MONO, color: RED, background: RED_BG }}
                >
                  {counts[i]}
                </motion.span>
              </motion.span>
            )
          })}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {/* new enquiries keep landing */}
          <div className="relative h-[104px] overflow-hidden @[560px]:h-[156px]">
            <AnimatePresence initial={false}>
              {toasts.map(({ x: [src, name, need], i }, k) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: -18, scale: 0.95 }}
                  animate={{ opacity: k === 2 ? 0.55 : 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  className={`mb-1.5 items-center gap-2.5 rounded-[11px] border border-[#E8EAF0] bg-white px-2.5 py-1.5 shadow-[0_8px_20px_rgba(20,36,90,0.08)] ${
                    k === 2 ? 'hidden @[560px]:flex' : 'flex'
                  }`}
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: DOTS[src] }}
                  >
                    <BellRing className="size-3.5" strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-bold">{name}</span>
                      <span className="shrink-0 text-[10px] text-[#9AA2B8]" style={MONO}>
                        {k === 0 ? 'now' : `${k * 2}m`}
                      </span>
                    </div>
                    <div className="truncate text-[11.5px] text-[#5C6479]">
                      <span className="font-semibold" style={{ color: DOTS[src] }}>
                        {src}
                      </span>{' '}
                      · {need}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* the sheet that never keeps up */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[#EEF0F5] px-3 py-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold">
                <FileSpreadsheet className="size-3.5 shrink-0 text-[#059669]" strokeWidth={2} />
                <span className="truncate" style={MONO}>
                  {d.file}
                </span>
              </span>
              <span
                className="hidden shrink-0 text-[10.5px] text-[#9AA2B8] @[400px]:inline"
                style={MONO}
              >
                edited yesterday
              </span>
            </div>
            {d.rows.map((r, i) => {
              const on = t >= ROW_AT[i]
              const flagged = dup && i !== 1
              const filled = t >= ROW_AT[i] + 500
              return (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{
                    backgroundColor: flagged ? 'rgba(245,158,11,0.09)' : 'rgba(255,255,255,0)',
                  }}
                  transition={{ duration: 0.4 }}
                  className="grid h-8 grid-cols-[minmax(0,1fr)_84px] items-center gap-2 border-b border-[#F1F3F8] px-3 text-[12px] @[400px]:grid-cols-[minmax(0,1fr)_90px_92px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-semibold">
                      {on ? typed(r.name, t, ROW_AT[i]) : ''}
                    </span>
                    {i === 2 && (
                      <motion.span
                        initial={false}
                        animate={{ opacity: dup ? 1 : 0, scale: dup ? 1 : 0.8 }}
                        transition={{ duration: 0.3, ease: EASE }}
                      >
                        <Pill fg={AMBER} bg={AMBER_BG}>
                          DUPLICATE
                        </Pill>
                      </motion.span>
                    )}
                  </span>
                  <span className="text-[11px] text-[#5C6479]" style={MONO}>
                    {filled ? r.phone : ''}
                  </span>
                  <span className="hidden truncate text-[11px] text-[#5C6479] @[400px]:block">
                    {filled ? r.src : ''}
                  </span>
                </motion.div>
              )
            })}
            <div className="h-7 px-3 text-[12px] leading-7 text-[#C9CFDC]" style={MONO}>
              …
            </div>
          </Card>
        </div>
      </div>

      {/* the tally */}
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="font-bold">
          <span style={MONO}>{total}</span> new enquiries
        </span>
        <span className="text-[#C9CFDC]">·</span>
        <span className="font-semibold text-[#5C6479]">
          <span style={MONO}>{copied}</span> in the sheet
        </span>
        <motion.span
          initial={false}
          animate={{ opacity: t >= UNTOUCHED_AT ? 1 : 0, scale: t >= UNTOUCHED_AT ? 1 : 0.9 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="ml-auto rounded-[7px] px-2 py-0.5 font-bold"
          style={{ color: RED, background: RED_BG }}
        >
          <span style={MONO}>{total - copied}</span> nobody touched
        </motion.span>
      </div>
    </div>
  )
}

/* ─── 02 · The first call wins ───────────────────────────────────────────────── */
function SlowScene({ t, aud }: { t: number; aud: Aud }) {
  const d = SLOW[aud]
  const answered = t >= EV_AT[3]
  const mins = d.wait * easeOut(prog(t, EV_AT[0], EV_AT[3]) ** 0.9)
  const late = mins >= 120
  const ring = prog(t, EV_AT[0], EV_AT[3])
  const line = prog(t, EV_AT[0], EV_AT[3])

  return (
    <div className="flex h-full flex-col justify-between gap-2">
      {/* the lead and how long it has waited */}
      <Card className="flex items-center gap-3 px-3 py-2.5">
        <span className="hidden @[300px]:contents">
          <Avatar name={d.name} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-bold">{d.name}</span>
            <span className="hidden @[400px]:inline">
              <Pill fg={DOTS[d.src] ?? SLATE} bg="#F1F3F8">
                {d.src}
              </Pill>
            </span>
          </div>
          <div className="truncate text-[12px] text-[#5C6479]">{d.need}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <svg viewBox="0 0 36 36" className="hidden size-9 -rotate-90 @[440px]:block">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#EEF1F6" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke={late ? RED : AMBER}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${ring * 94.2} 94.2`}
            />
          </svg>
          <div className="text-right leading-tight">
            <div className="text-[9.5px] uppercase tracking-[0.12em] text-[#9AA2B8]" style={MONO}>
              {answered ? 'answered after' : 'waiting'}
            </div>
            <div
              className="text-[18px] font-semibold"
              style={{ ...MONO, color: late ? RED : AMBER }}
            >
              {waitLabel(mins)}
            </div>
          </div>
        </div>
      </Card>

      {/* what happened meanwhile */}
      <div className="relative flex flex-col gap-1.5 pl-6">
        <span className="absolute bottom-4 left-[9px] top-4 w-[2px] rounded-full bg-[#E6EAF3]" />
        <span
          className="absolute left-[9px] top-4 w-[2px] origin-top rounded-full"
          style={{
            bottom: 16,
            transform: `scaleY(${line})`,
            background: `linear-gradient(${PRI}, ${AMBER}, ${RED})`,
          }}
        />
        {d.events.map(([time, text, kind], i) => {
          const on = t >= EV_AT[i]
          const color = kind === 'in' ? PRI : kind === 'them' ? AMBER : RED
          return (
            <motion.div
              key={i}
              initial={false}
              animate={{ opacity: on ? 1 : 0.25, x: on ? 0 : 6 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="relative flex min-h-[46px] items-center gap-2.5 rounded-[11px] border bg-white px-3 py-1.5"
              style={{
                borderColor:
                  on && kind === 'you' && t >= TOO_LATE_AT ? 'rgba(220,38,38,0.35)' : BORDER,
              }}
            >
              <motion.span
                initial={false}
                animate={{ scale: on ? 1 : 0.4, backgroundColor: on ? color : '#D5DAE5' }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute -left-[21px] size-3 rounded-full ring-4 ring-[#F7F8FC]"
              />
              <span className="w-[42px] shrink-0 text-[11px] text-[#9AA2B8]" style={MONO}>
                {time}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug">
                {text}
              </span>
              {kind === 'them' && (
                <span className="hidden @[420px]:inline">
                  <Pill fg={AMBER} bg={AMBER_BG}>
                    COMPETITOR
                  </Pill>
                </span>
              )}
              {kind === 'you' && (
                <motion.span
                  initial={false}
                  animate={{ opacity: t >= TOO_LATE_AT ? 1 : 0, scale: t >= TOO_LATE_AT ? 1 : 0.7 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 18 }}
                >
                  <Pill fg="#FFFFFF" bg={RED}>
                    TOO LATE
                  </Pill>
                </motion.span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* and the buyer's answer */}
      <motion.div
        initial={false}
        animate={{ opacity: t >= REPLY_AT ? 1 : 0, y: t >= REPLY_AT ? 0 : 10 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="ml-6 rounded-[13px] rounded-tl-[4px] border border-[#F3D2D2] bg-white px-3 py-2 shadow-[0_8px_22px_rgba(220,38,38,0.10)]"
      >
        <div className="text-[10.5px] font-bold" style={{ color: RED }}>
          {d.name} replied
        </div>
        <div className="text-[13px] leading-snug">{d.reply}</div>
      </motion.div>

      <motion.div
        initial={false}
        animate={{ opacity: t >= LOST_AT ? 1 : 0, y: t >= LOST_AT ? 0 : 8 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex items-center gap-2.5 rounded-[12px] border px-3 py-2"
        style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.05)' }}
      >
        <TrendingDown className="size-4 shrink-0" style={{ color: RED }} strokeWidth={2.25} />
        <span className="min-w-0 text-[12.5px] font-semibold leading-snug">{d.lost}</span>
      </motion.div>
    </div>
  )
}

/* ─── 03 · Follow-ups slip ───────────────────────────────────────────────────── */
const TEMPS = [
  { label: 'HOT', fg: RED, bg: RED_BG },
  { label: 'WARM', fg: AMBER, bg: AMBER_BG },
  { label: 'COLD', fg: SLATE, bg: '#EEF1F6' },
]

function ForgottenScene({ t, aud }: { t: number; aud: Aud }) {
  const d = FOLLOW[aud]
  const day = t < DAY0 ? 0 : Math.min(DAYS.length - 1, Math.floor((t - DAY0) / DAY_MS) + 1)
  const temp = TEMPS[day <= 1 ? 0 : day <= 3 ? 1 : 2]
  const overdue = Math.max(0, day - 2)
  const cool = prog(t, DAY0, DAY0 + DAY_MS * (DAYS.length - 1))

  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <Card className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={d.name} fg="#1D4ED8" bg="rgba(29,78,216,0.08)" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold">{d.name}</div>
            <div className="truncate text-[12px] text-[#5C6479]">{d.need}</div>
          </div>
          <motion.span
            initial={false}
            animate={{ color: temp.fg, backgroundColor: temp.bg }}
            transition={{ duration: 0.4 }}
            className="shrink-0 rounded-[6px] px-2 py-0.5 text-[11px] font-bold tracking-[0.06em]"
          >
            {temp.label}
          </motion.span>
        </div>
        {/* interest cooling off */}
        <div className="relative mt-3 h-2 rounded-full bg-[linear-gradient(90deg,#DC2626,#F59E0B_45%,#CBD5E1)]">
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white shadow-[0_2px_6px_rgba(15,23,41,0.2)]"
            style={{ left: `${4 + cool * 92}%`, borderColor: temp.fg }}
          />
        </div>
        <div className="mt-2.5 border-t border-[#EEF0F5] pt-2 text-[12px] leading-snug text-[#3B4A6B]">
          <span className="font-medium text-[#059669]" style={MONO}>
            visit note{' '}
          </span>
          {d.note}
        </div>
      </Card>

      <div>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((label, k) => {
            const reached = k <= day
            const today = k === day
            return (
              <div key={label} className="flex min-w-0 flex-col items-center gap-1">
                <span
                  className="text-[9.5px] uppercase tracking-[0.06em]"
                  style={{ ...MONO, color: today ? PRI : '#9AA2B8' }}
                >
                  {label}
                </span>
                <motion.span
                  initial={false}
                  animate={{
                    backgroundColor:
                      k === 0 ? 'rgba(5,150,105,0.1)' : reached ? '#FFFFFF' : '#EEF1F6',
                    borderColor: k === 0 ? 'rgba(5,150,105,0.4)' : reached ? '#D5DAE5' : '#EEF1F6',
                    boxShadow: today
                      ? '0 0 0 2px rgba(43,89,224,0.35)'
                      : '0 0 0 0px rgba(43,89,224,0)',
                    scale: today ? 1.04 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className="flex h-9 w-full items-center justify-center rounded-[8px] border"
                  style={{ borderStyle: k === 0 ? 'solid' : 'dashed' }}
                >
                  {k === 0 ? (
                    <Check className="size-3.5 text-[#059669]" strokeWidth={3} />
                  ) : reached ? (
                    <span className="text-[11px] text-[#C9CFDC]" style={MONO}>
                      <span className="@[480px]:hidden">–</span>
                      <span className="hidden @[480px]:inline">no call</span>
                    </span>
                  ) : null}
                </motion.span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-2 @[440px]:grid-cols-[auto_minmax(0,1fr)] @[440px]:gap-2.5">
        <Card className="flex items-center justify-between gap-3 px-3 py-1.5 @[440px]:flex-col @[440px]:items-start @[440px]:justify-center @[440px]:gap-0 @[440px]:py-2">
          <div className="text-[9.5px] uppercase tracking-[0.12em] text-[#9AA2B8]" style={MONO}>
            since last call
          </div>
          <div
            className="text-[22px] font-semibold leading-tight"
            style={{ ...MONO, color: day >= 4 ? RED : '#0F1729' }}
          >
            {day}
            <span className="text-[13px]"> {day === 1 ? 'day' : 'days'}</span>
          </div>
        </Card>
        <Card className="flex items-center gap-2.5 px-3 py-2">
          <Square className="size-4 shrink-0 text-[#9AA2B8]" strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{d.todo}</span>
          <motion.span
            initial={false}
            animate={{ opacity: overdue ? 1 : 0, scale: overdue ? 1 : 0.8 }}
            transition={{ duration: 0.3 }}
            className="shrink-0 whitespace-nowrap rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-bold"
            style={{ ...MONO, color: RED, background: RED_BG }}
          >
            {Math.max(overdue, 1)}d<span className="hidden @[420px]:inline"> overdue</span>
          </motion.span>
        </Card>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: t >= ALERT_AT ? 1 : 0, y: t >= ALERT_AT ? 0 : 8 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex items-center gap-2.5 rounded-[12px] border px-3 py-2"
        style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.05)' }}
      >
        <Eye className="size-4 shrink-0" style={{ color: RED }} strokeWidth={2.25} />
        <span className="min-w-0 text-[12.5px] font-semibold leading-snug">{d.alert}</span>
      </motion.div>
    </div>
  )
}

/* ─── 04 · You can't see your own pipeline ───────────────────────────────────── */
function InvisibleScene({ t, aud }: { t: number; aud: Aud }) {
  const d = BLIND[aud]
  const system = t >= SYSTEM_AT
  const loss = t >= LOSS_AT

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 @[560px]:grid-cols-[minmax(0,1fr)_200px]">
        {/* the team chat */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-[#EEF0F5] px-3 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EEF2FD] text-[#2B59E0]">
              <Users className="size-3.5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-bold">{d.group}</div>
              <div className="text-[10.5px] text-[#9AA2B8]" style={MONO}>
                {system ? d.members[1] : d.members[0]} members
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-1.5 p-2.5">
            {d.chat.map((m, i) => {
              const me = m.who === 'You'
              const typing = !me && t >= MSG_AT[i] - TYPING_MS && t < MSG_AT[i]
              const shown = t >= MSG_AT[i] || typing
              return (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 8 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={`flex ${me ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-[12px] px-2.5 py-1.5 text-[12.5px] leading-snug ${
                      me
                        ? 'rounded-br-[4px] bg-[#2B59E0] text-white'
                        : 'rounded-bl-[4px] border border-[#EDF0F6] bg-[#F7F8FC]'
                    }`}
                  >
                    {!me && (
                      <div className="text-[10.5px] font-bold" style={{ color: m.color }}>
                        {m.who}
                      </div>
                    )}
                    {typing ? <TypingDots t={t} /> : m.text}
                  </div>
                </motion.div>
              )
            })}
            <motion.div
              initial={false}
              animate={{ opacity: system ? 1 : 0 }}
              transition={{ duration: 0.35 }}
              className="mt-0.5 self-center rounded-full bg-[#EEF1F6] px-2.5 py-0.5 text-[10.5px] text-[#5C6479]"
              style={MONO}
            >
              {d.system}
            </motion.div>
          </div>
        </Card>

        {/* what the business actually knows */}
        <Card className="hidden min-h-0 flex-col overflow-hidden @[560px]:flex">
          <div
            className="border-b border-[#EEF0F5] px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] text-[#9AA2B8]"
            style={MONO}
          >
            {d.panel.title}
          </div>
          {d.panel.kind === 'leads' ? (
            <div className="flex flex-col gap-1 p-2">
              {d.panel.rows.map(([name, stage], i) => {
                const gone = t >= GHOST_AT + i * 140
                return (
                  <motion.div
                    key={name}
                    initial={false}
                    animate={{
                      opacity: gone ? 0.28 : 1,
                      scale: gone ? 0.97 : 1,
                      filter: gone ? 'grayscale(1)' : 'grayscale(0)',
                    }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="flex items-center gap-2 rounded-[8px] px-1.5 py-1"
                  >
                    <Avatar name={name} size={24} fg="#1D4ED8" bg="rgba(29,78,216,0.08)" />
                    <span
                      className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${gone ? 'line-through' : ''}`}
                    >
                      {name}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#9AA2B8]" style={MONO}>
                      {stage}
                    </span>
                  </motion.div>
                )
              })}
              <motion.div
                initial={false}
                animate={{ opacity: t >= GHOST_AT + 700 ? 0.28 : 1 }}
                className="px-1.5 pt-0.5 text-[11px] text-[#9AA2B8]"
                style={MONO}
              >
                + {d.panel.more} more
              </motion.div>
            </div>
          ) : (
            <div className="flex flex-col p-2">
              {d.panel.fields.map(([label, value], i) => {
                const flag = t >= GHOST_AT + i * 160
                return (
                  <motion.div
                    key={label}
                    initial={false}
                    animate={{
                      backgroundColor: flag ? 'rgba(220,38,38,0.06)' : 'rgba(255,255,255,0)',
                    }}
                    transition={{ duration: 0.35 }}
                    className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-2"
                  >
                    <span className="text-[11.5px] text-[#5C6479]">{label}</span>
                    <span
                      className="truncate text-[11.5px] font-bold"
                      style={{ ...MONO, color: flag ? RED : '#0F1729' }}
                    >
                      {value}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: loss ? 1 : 0, y: loss ? 0 : 8 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex items-center gap-2.5 rounded-[12px] border px-3 py-2.5"
        style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.05)' }}
      >
        <UserMinus className="size-4 shrink-0" style={{ color: RED }} strokeWidth={2.25} />
        <span className="min-w-0 text-[12.5px] font-semibold leading-snug">{d.loss}</span>
      </motion.div>
    </div>
  )
}

function TypingDots({ t }: { t: number }) {
  return (
    <span className="flex h-[18px] items-center gap-1">
      {[0, 1, 2].map(k => (
        <span
          key={k}
          className="size-1.5 rounded-full bg-[#9AA2B8]"
          style={{ opacity: 0.35 + 0.65 * ((Math.sin(t / 110 - k * 0.9) + 1) / 2) }}
        />
      ))}
    </span>
  )
}
