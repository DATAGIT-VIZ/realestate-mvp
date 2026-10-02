'use client'

/* ─────────────────────────────────────────────────────────────────────────────
 * HowItWorksSteps · "Live in 3 minutes"
 *
 * The three setup steps from the LeadGap launch video (name your workspace,
 * invite your team, import your pipeline) as an auto-playing demo that
 * visitors can also click through and type into. It ends on the Today view
 * ("who to call first"), then "Start your workspace" opens the main dashboard
 * with a "Get started" CTA.
 *
 * Stack: React 19 · TypeScript · Tailwind CSS v4 · motion (motion/react) · lucide-react
 * Usage:  <HowItWorksSteps />            (every prop is optional)
 * ──────────────────────────────────────────────────────────────────────────── */

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useInView,
  useMotionValue,
} from 'motion/react'
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarCheck,
  ChartColumn,
  Check,
  Clock3,
  FileSpreadsheet,
  House,
  LoaderCircle,
  Pause,
  PhoneCall,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  SquareCheckBig,
  Upload,
  Users,
} from 'lucide-react'

export type HowItWorksStepsProps = {
  /** Section anchor, so the nav's "How it works" link scrolls here. */
  id?: string
  /** Where the CTAs go. A workspace name the visitor typed is appended as ?workspace=… */
  ctaHref?: string
  ctaLabel?: string
  /** LeadGap mark shown in the demo window (the site already serves /lgc-icon.svg). */
  logoSrc?: string
  className?: string
}

/* ─── Brand tokens (LeadGap app + launch video) ─────────────────────────────── */
const FONT_SANS =
  "var(--font-jakarta, 'Plus Jakarta Sans'), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
const FONT_MONO =
  "var(--font-geist-mono, 'Geist Mono'), 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const MONO = { fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' } as const
const PRI = '#2B59E0'
const GREEN = '#059669'
const BORDER = '#E8EAF0'
const EASE = [0.22, 1, 0.36, 1] as const

/* ─── Script ─────────────────────────────────────────────────────────────────── */
// Phases 0–2 are the three steps, 3 is "you're live", 4 is the main dashboard. Times are in ms.
const STEP_MS = [4600, 5400, 7000, 4000, 8400]
const SETUP_SECS = [0, 41, 92, 167] // the setup timer at each phase boundary (2:47 total)
const DEFAULT_NAME = 'Skyline Realty'

const STEPS = [
  {
    title: 'Name your workspace',
    short: 'Workspace',
    time: '~40 sec',
    desc: 'Your brokerage gets its own private workspace. Type your name into the demo to try it.',
  },
  {
    title: 'Invite your team',
    short: 'Team',
    time: '~50 sec',
    desc: 'Agents join from an email invite, and new enquiries are routed to them automatically.',
  },
  {
    title: 'Import your pipeline',
    short: 'Import',
    time: '~75 sec',
    desc: 'Drop a CSV from any portal and fix bad rows inline. Every lead lands scored and sorted.',
  },
]

const HEADLINE: [string, boolean][] = [
  ['Live', false],
  ['in', false],
  ['3', true],
  ['minutes.', true],
]

// Step 1
const TYPE_AT = 400
const CONTINUE_AT = 3000
const SAVED_AT = 3650
// Step 2
const TEAM = [
  { first: 'Priya', initials: 'PS', bg: '#EEF2FD', fg: '#2B59E0' },
  { first: 'Arjun', initials: 'AN', bg: 'rgba(16,185,129,0.12)', fg: '#059669' },
  { first: 'Neha', initials: 'NK', bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
]
const INVITE_AT = [250, 900, 1550]
const ROUTE_AT = 2700
const SEND_AT = 4100
// Step 3
const ROWS = [
  { name: 'Rohan Mehta', phone: '98765 43210', fix: '', source: 'MagicBricks', budget: '₹1.4 Cr' },
  { name: 'Ananya Rao', phone: '99887 76655', fix: '', source: '99acres', budget: '₹95 L' },
  { name: 'Karan Shah', phone: '98765 4321', fix: '9', source: 'Housing.com', budget: '₹2.1 Cr' },
  { name: 'Sana Qureshi', phone: '90000 12345', fix: '', source: 'Facebook', budget: '₹80 L' },
]
const SOURCE_DOT: Record<string, string> = {
  MagicBricks: '#E63946',
  '99acres': '#FF6B35',
  'Housing.com': '#2D9B6F',
  Facebook: '#1877F2',
}
const LAND_AT = 850
const TABLE_AT = 1250
const FLAG_AT = 2250
const FIX_AT = 2950
const FIXED_AT = 3250
const IMPORT_AT = 3900
const IMPORTED_AT = 5800
const LEAD_COUNT = 248
// Live
const TODAY = [
  {
    name: 'Rohan Mehta',
    bucket: 'Slipping',
    note: '4 days silent · 3BHK, Thane',
    tag: 'HOT',
    score: 86,
    fg: '#DC2626',
    bg: 'rgba(239,68,68,0.08)',
  },
  {
    name: 'Ananya Rao',
    bucket: 'Due today',
    note: 'Site visit follow-up · Powai',
    tag: 'WARM',
    score: 74,
    fg: '#B45309',
    bg: 'rgba(245,158,11,0.1)',
  },
  {
    name: 'Karan Shah',
    bucket: 'Fresh',
    note: 'New from Housing.com · Lonavala',
    tag: 'NEW',
    score: 68,
    fg: '#059669',
    bg: 'rgba(16,185,129,0.08)',
  },
]
const START_AT = 3700
// Dashboard
const NAV = [
  { icon: CalendarCheck, label: 'Today' },
  { icon: House, label: 'Dashboard' },
  { icon: Users, label: 'Leads' },
  { icon: Send, label: 'Outreach' },
  { icon: SquareCheckBig, label: 'Workspace' },
  { icon: ChartColumn, label: 'Insights' },
  { icon: Bot, label: 'AI Advisor' },
]
const KPIS = [
  { label: 'Total leads', value: 248, decimals: 0, dot: PRI },
  { label: 'Hot leads', value: 53, decimals: 0, dot: '#DC2626' },
  { label: 'Pipeline value', value: 186.4, decimals: 1, dot: '#8FB0FF', money: true },
  { label: 'Due today', value: 12, decimals: 0, dot: GREEN },
]
const STAGES = [
  { label: 'New', count: 96, color: '#059669' },
  { label: 'Cold', count: 41, color: '#1D4ED8' },
  { label: 'Warm', count: 58, color: '#B45309' },
  { label: 'Hot', count: 53, color: '#DC2626' },
]
const CALL_AT = 3000
const LOGGED_AT = 4300
const DASH_CTA_AT = 4700
const DASH_CLICK_AT = 6500

// Where the demo cursor goes, per phase: move at `at`, click at `click`.
type Cue = { at: number; target: string; click: number }
const CUES: Cue[][] = [
  [{ at: 2300, target: 'continue', click: CONTINUE_AT }],
  [
    { at: 2150, target: 'route', click: ROUTE_AT },
    { at: 3450, target: 'send', click: SEND_AT },
  ],
  [
    { at: 2400, target: 'fix', click: FIX_AT },
    { at: 3400, target: 'import', click: IMPORT_AT },
  ],
  [{ at: 2900, target: 'start', click: START_AT }],
  [
    { at: 2350, target: 'call', click: CALL_AT },
    { at: 5700, target: 'get-started', click: DASH_CLICK_AT },
  ],
]

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
const typed = (s: string, t: number, start: number, msPerChar = 70) =>
  s.slice(0, Math.max(0, Math.min(s.length, Math.floor((t - start) / msPerChar))))
const initials = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || 'LG'
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16) || 'yourteam'
const mmss = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}`
const withWorkspace = (href: string, name: string) =>
  name ? `${href}${href.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(name)}` : href

/* ─── Demo clock ─────────────────────────────────────────────────────────────── */
// One clock drives the whole demo, so it can pause, loop and jump to any step.
type Clock = { phase: number; t: number }

function useDemoClock(playing: boolean) {
  const live = useRef<Clock>({ phase: 0, t: 0 })
  const [clock, setClock] = useState<Clock>({ phase: 0, t: 0 })

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 64) : 0
      last = now
      let { phase, t } = live.current
      t += dt
      if (t >= STEP_MS[phase]) {
        phase = (phase + 1) % STEP_MS.length
        t = 0
      }
      live.current = { phase, t }
      setClock(live.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const jump = useCallback((phase: number, t = 0) => {
    live.current = { phase, t }
    setClock(live.current)
  }, [])

  return [clock, jump] as const
}

// Reduced-motion preference that reads `false` during SSR and hydration, so the
// server HTML always matches, then switches to the real value on the client.
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false
  )
}

/* ─── Section ────────────────────────────────────────────────────────────────── */
export function HowItWorksSteps({
  id = 'how-it-works',
  ctaHref = '/signup',
  ctaLabel = 'Get started today',
  logoSrc = '/lgc-icon.svg',
  className = '',
}: HowItWorksStepsProps) {
  const uid = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const inView = useInView(sectionRef, { amount: 0.3 })
  const reduce = usePrefersReducedMotion()
  const [paused, setPaused] = useState(false)
  const [typing, setTyping] = useState(false)
  const [userName, setUserName] = useState('')

  const [{ phase, t: clockT }, jump] = useDemoClock(inView && !paused && !typing && !reduce)
  // With reduced motion there is no autoplay: every step simply shows its finished state.
  const t = reduce ? STEP_MS[phase] - 1 : clockT
  const live = phase >= 3
  const dash = phase === 4
  const name = userName.trim() || DEFAULT_NAME
  const href = withWorkspace(ctaHref, userName.trim())
  const stepProgress = (i: number) => (i < phase ? 1 : i === phase ? clamp01(t / STEP_MS[i]) : 0)
  const secs = live
    ? SETUP_SECS[3]
    : SETUP_SECS[phase] + (SETUP_SECS[phase + 1] - SETUP_SECS[phase]) * clamp01(t / STEP_MS[phase])

  const goTo = (i: number) => {
    setTyping(false)
    jump(i)
  }
  const next = () => goTo(Math.min(phase + 1, 4))

  const pane =
    phase === 0 ? (
      <WorkspacePane
        t={t}
        userName={userName}
        typing={typing}
        onType={v => setUserName(v)}
        onFocus={() => setTyping(true)}
        onBlur={() => setTyping(false)}
        onSubmit={next}
      />
    ) : phase === 1 ? (
      <TeamPane t={t} name={name} onNext={next} />
    ) : phase === 2 ? (
      <ImportPane
        t={t}
        onFix={() => t < FIX_AT && jump(2, FIX_AT)}
        onImport={() =>
          reduce || t >= IMPORTED_AT ? goTo(3) : t < IMPORT_AT && jump(2, IMPORT_AT)
        }
      />
    ) : (
      // While the dashboard is up, the "you're live" pane stays in its finished state underneath.
      <LivePane
        t={dash ? STEP_MS[3] : t}
        name={name}
        onStart={() => goTo(4)}
        onReplay={() => goTo(0)}
      />
    )

  return (
    <MotionConfig reducedMotion="user">
      <section
        id={id}
        ref={sectionRef}
        aria-labelledby={`${uid}-title`}
        className={`relative isolate overflow-hidden bg-[#F4F6FB] py-20 text-[#0F1729] antialiased sm:py-28 ${className}`}
        style={{ fontFamily: FONT_SANS, wordSpacing: '0.03em' }}
      >
        <Backdrop />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          {/* ── Left: pitch, steps, CTA ── */}
          <div className="min-w-0">
            <motion.div
              {...rise(0)}
              className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-[#2B59E0]"
              style={MONO}
            >
              <span className="h-[2px] w-7 rounded-full bg-[#2B59E0]" />
              How it works
            </motion.div>

            <h2
              id={`${uid}-title`}
              className="mt-5 text-[44px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[60px]"
            >
              {HEADLINE.map(([word, accent], i) => (
                <Fragment key={word}>
                  <motion.span
                    className="inline-block"
                    style={{ color: accent ? PRI : undefined }}
                    initial={{ opacity: 0, y: 36, filter: 'blur(10px)' }}
                    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.08 + i * 0.08 }}
                  >
                    {word}
                  </motion.span>
                  {i < HEADLINE.length - 1 && ' '}
                </Fragment>
              ))}
            </h2>

            <motion.p
              {...rise(0.35)}
              className="mt-5 max-w-md text-[17px] leading-relaxed text-[#5C6479]"
            >
              Three steps take your team from zero to first lead. Watch it run, or click through it
              yourself.
            </motion.p>

            <div
              role="tablist"
              aria-label="Setup steps"
              aria-orientation="vertical"
              className="mt-9 hidden flex-col gap-1.5 lg:flex"
            >
              {STEPS.map((s, i) => {
                const active = i === phase
                const state = i < phase ? 'done' : active ? 'active' : 'idle'
                return (
                  <motion.button
                    key={s.title}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`${uid}-panel`}
                    onClick={() => goTo(i)}
                    {...rise(0.45 + i * 0.08)}
                    className="group relative w-full cursor-pointer rounded-[16px] border p-4 text-left outline-none transition-[background-color,border-color,box-shadow] duration-500 focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
                    style={{
                      background: active ? '#FFFFFF' : 'rgba(255,255,255,0)',
                      borderColor: active ? '#DCE3F5' : 'rgba(220,227,245,0)',
                      boxShadow: active
                        ? '0 1px 2px rgba(15,23,41,0.04), 0 16px 40px rgba(20,36,90,0.10)'
                        : '0 1px 2px rgba(15,23,41,0), 0 16px 40px rgba(20,36,90,0)',
                    }}
                  >
                    <span className="flex gap-4">
                      <StepBadge n={i + 1} state={state} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span
                            className="text-[17px] font-extrabold tracking-[-0.01em] transition-colors duration-300"
                            style={{ color: active ? '#0F1729' : '#3B4A6B' }}
                          >
                            {s.title}
                          </span>
                          <span
                            className="shrink-0 text-[11px] font-medium text-[#9AA2B8]"
                            style={MONO}
                          >
                            {s.time}
                          </span>
                        </span>
                        <span className="mt-1 block text-[14px] leading-relaxed text-[#5C6479]">
                          {s.desc}
                        </span>
                        <span
                          className="mt-3 block h-[3px] overflow-hidden rounded-full bg-[#E6EBF6] transition-opacity duration-300"
                          style={{ opacity: active ? 1 : 0 }}
                        >
                          <span
                            className="block h-full origin-left rounded-full bg-[#2B59E0]"
                            style={{ transform: `scaleX(${stepProgress(i)})` }}
                          />
                        </span>
                      </span>
                    </span>
                  </motion.button>
                )
              })}
            </div>

            <CtaRow href={href} label={ctaLabel} glow={live} className="mt-9 hidden lg:flex" />
          </div>

          {/* ── Right: the demo window ── */}
          <div className="relative min-w-0">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10"
              style={{
                background:
                  'radial-gradient(60% 55% at 55% 45%, rgba(43,89,224,0.16), transparent 70%)',
              }}
            />

            <motion.div
              ref={stageRef}
              id={`${uid}-panel`}
              role="tabpanel"
              aria-label="Interactive setup demo"
              initial={{ opacity: 0, y: 70, rotateX: 10, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 1, ease: EASE }}
              style={{ transformPerspective: 2200, transformOrigin: '50% 60%' }}
              className="relative overflow-hidden rounded-[20px] border border-[#DCE1EC] bg-white shadow-[0_2px_6px_rgba(15,23,41,0.05),0_40px_90px_rgba(20,36,90,0.16)]"
            >
              {/* browser bar */}
              <div className="flex h-10 items-center gap-2 border-b border-[#E8EAF0] bg-white px-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="size-[11px] shrink-0 rounded-full bg-[#E3E6EE]" />
                ))}
                <span
                  className="mx-auto min-w-0 truncate rounded-[8px] bg-[#F4F6FB] px-4 py-1 text-[12px] text-[#9AA2B8] sm:px-10"
                  style={MONO}
                >
                  app.leadgapcrm.in/{dash ? 'dashboard' : 'onboarding'}
                </span>
                {reduce ? (
                  <span className="w-7 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPaused(p => !p)}
                    aria-label={paused ? 'Play demo' : 'Pause demo'}
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-[#5C6479] transition-colors hover:bg-[#F4F6FB] hover:text-[#0F1729]"
                  >
                    {paused ? (
                      <Play className="size-3.5" strokeWidth={2.25} />
                    ) : (
                      <Pause className="size-3.5" strokeWidth={2.25} />
                    )}
                  </button>
                )}
              </div>

              <div className="relative">
                {/* setup wizard (fades away once the dashboard opens) */}
                <motion.div
                  inert={dash}
                  aria-hidden={dash || undefined}
                  animate={{ opacity: dash ? 0 : 1, scale: dash ? 0.985 : 1 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  {/* wizard header: logo, setup timer, step segments */}
                  <div className="px-5 pt-5 sm:px-7">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoSrc} alt="" className="h-8 w-auto shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-extrabold tracking-[-0.01em]">
                            LeadGap CRM
                          </div>
                          <div className="truncate text-[12px] font-medium text-[#5C6479]">
                            Setup wizard
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#9AA2B8]"
                          style={MONO}
                        >
                          Setup time
                        </div>
                        <div
                          className="flex items-center justify-end gap-1.5 text-[24px] font-semibold leading-none transition-colors min-[380px]:text-[28px] sm:text-[32px]"
                          style={{ ...MONO, color: live ? GREEN : PRI }}
                        >
                          {live && <Check className="size-6" strokeWidth={2.75} />}
                          {mmss(secs)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {STEPS.map((s, i) => (
                        <button
                          key={s.short}
                          type="button"
                          onClick={() => goTo(i)}
                          aria-label={`Show step ${i + 1}: ${s.title}`}
                          className="cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
                        >
                          <span className="block h-1.5 overflow-hidden rounded-full bg-[#EEF2FD]">
                            <span
                              className="block h-full origin-left rounded-full transition-colors duration-500"
                              style={{
                                transform: `scaleX(${stepProgress(i)})`,
                                background: i < phase ? GREEN : PRI,
                              }}
                            />
                          </span>
                          <span
                            className="mt-1.5 flex items-center gap-1 whitespace-nowrap text-[11.5px] font-semibold transition-colors"
                            style={{
                              color: i === phase ? '#0F1729' : i < phase ? GREEN : '#9AA2B8',
                            }}
                          >
                            {i < phase && <Check className="size-3" strokeWidth={3} />}
                            <span className="max-[379px]:hidden">{i + 1}. </span>
                            {s.short}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* step content */}
                  <div className="relative h-[408px] sm:h-[384px]">
                    <AnimatePresence initial={false}>
                      <motion.div
                        key={Math.min(phase, 3)}
                        className="absolute inset-0 px-5 pb-5 pt-4 sm:px-7 sm:pb-6"
                        initial={{ opacity: 0, x: 28, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, x: -28, filter: 'blur(6px)' }}
                        transition={{ duration: 0.45, ease: EASE }}
                      >
                        {pane}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* the main dashboard, after "Start your workspace" */}
                <AnimatePresence>
                  {dash && (
                    <motion.div
                      key="dashboard"
                      className="absolute inset-0"
                      initial={{ opacity: 0, y: 18, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: EASE }}
                    >
                      <DashboardPane
                        t={t}
                        name={name}
                        href={href}
                        logoSrc={logoSrc}
                        onReplay={() => goTo(0)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {paused && !reduce && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="pointer-events-none absolute right-4 top-[52px] z-30 flex items-center gap-1.5 rounded-full bg-[#0B1433] px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    <Pause className="size-3" strokeWidth={2.5} /> Paused
                  </motion.div>
                )}
              </AnimatePresence>

              {!reduce && <DemoCursor stageRef={stageRef} phase={phase} t={t} hidden={typing} />}
            </motion.div>

            {/* mobile: what the current step means, then the CTA */}
            <div className="mt-7 lg:hidden">
              <div className="min-h-[124px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div
                      className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#2B59E0]"
                      style={MONO}
                    >
                      {dash
                        ? 'Your dashboard'
                        : live
                          ? 'Done'
                          : `Step ${phase + 1} of 3 · ${STEPS[phase].time}`}
                    </div>
                    <div className="mt-1.5 text-[21px] font-extrabold tracking-[-0.02em]">
                      {dash
                        ? 'Straight into your dashboard.'
                        : live
                          ? 'Live in under 3 minutes.'
                          : STEPS[phase].title}
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-[#5C6479]">
                      {dash
                        ? "Hot leads, pipeline value and today's follow-ups, ready from the first minute."
                        : live
                          ? 'Your leads are scored, sorted and ready to call.'
                          : STEPS[phase].desc}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <CtaRow href={href} label={ctaLabel} glow={live} className="mt-5 flex" />
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}

export default HowItWorksSteps

/* ─── Section pieces ─────────────────────────────────────────────────────────── */
function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { duration: 0.6, ease: EASE, delay },
  }
}

function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 70% 40%, #FFFFFF, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,23,41,0.07) 1px, transparent 1.2px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 80%)',
        }}
      />
    </>
  )
}

function StepBadge({ n, state }: { n: number; state: 'done' | 'active' | 'idle' }) {
  return (
    <motion.span
      animate={{
        backgroundColor: state === 'done' ? GREEN : state === 'active' ? PRI : '#EEF2FD',
        color: state === 'idle' ? '#0038A8' : '#FFFFFF',
      }}
      transition={{ duration: 0.3 }}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-[12px] text-[15px] font-semibold"
      style={MONO}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'done' ? (
          <motion.span
            key="done"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
          >
            <Check className="size-5" strokeWidth={2.75} />
          </motion.span>
        ) : (
          <motion.span
            key="n"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {n}
          </motion.span>
        )}
      </AnimatePresence>
      {state === 'active' && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-[12px]"
          animate={{ boxShadow: ['0 0 0 0 rgba(43,89,224,0.35)', '0 0 0 9px rgba(43,89,224,0)'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </motion.span>
  )
}

function CtaRow({
  href,
  label,
  glow,
  className = '',
}: {
  href: string
  label: string
  glow: boolean
  className?: string
}) {
  return (
    <div className={`flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <motion.a
          href={href}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          animate={{
            boxShadow: glow
              ? [
                  '0 18px 40px rgba(43,89,224,0.35), 0 0 0 0 rgba(43,89,224,0.45)',
                  '0 18px 40px rgba(43,89,224,0.35), 0 0 0 16px rgba(43,89,224,0)',
                ]
              : '0 18px 40px rgba(43,89,224,0.30), 0 0 0 0 rgba(43,89,224,0)',
          }}
          transition={{
            default: { type: 'spring', stiffness: 400, damping: 25 },
            boxShadow: glow
              ? { duration: 1.4, repeat: Infinity, ease: 'easeOut' }
              : { duration: 0.3 },
          }}
          className="group relative inline-flex h-[54px] items-center gap-3 overflow-hidden rounded-[14px] bg-[#2B59E0] px-7 text-[16px] font-extrabold text-white transition-colors hover:bg-[#2450D0]"
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12"
            style={{
              backgroundImage:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
            }}
            initial={{ x: '-150%' }}
            animate={{ x: '400%' }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
          />
          <span className="relative">{label}</span>
          <ArrowRight
            className="relative size-5 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2.25}
          />
        </motion.a>
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[#3B4A6B]">
          <Clock3 className="size-4 text-[#2B59E0]" strokeWidth={2} />
          Live in under 3 minutes
        </span>
      </div>
      <span className="text-[13px] font-medium text-[#9AA2B8]">
        For agents, brokerages and developer sales teams across India
      </span>
    </div>
  )
}

/* ─── Demo cursor ────────────────────────────────────────────────────────────── */
function DemoCursor({
  stageRef,
  phase,
  t,
  hidden,
}: {
  stageRef: RefObject<HTMLDivElement | null>
  phase: number
  t: number
  hidden: boolean
}) {
  let cue: Cue | undefined
  for (const c of CUES[phase]) if (t >= c.at) cue = c
  const target = cue?.target ?? null
  const x = useMotionValue(560)
  const y = useMotionValue(470)

  useEffect(() => {
    const stage = stageRef.current
    const el = target ? stage?.querySelector<HTMLElement>(`[data-cursor="${target}"]`) : null
    if (!stage || !el) return
    const move = (instant: boolean) => {
      const s = stage.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const tx = r.left - s.left + Math.min(r.width * 0.62, r.width - 10)
      const ty = r.top - s.top + r.height * 0.62
      if (instant) {
        x.set(tx)
        y.set(ty)
      } else {
        animate(x, tx, { duration: 0.75, ease: [0.65, 0, 0.35, 1] })
        animate(y, ty, { duration: 0.75, ease: [0.65, 0, 0.35, 1] })
      }
    }
    move(false)
    const onResize = () => move(true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [phase, target, stageRef, x, y])

  const pressing = !!cue && t >= cue.click && t < cue.click + 180
  const rippling = !!cue && t >= cue.click && t < cue.click + 650

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ x, y }}
      animate={{ opacity: cue && !hidden ? 1 : 0 }}
      transition={{ duration: 0.25 }}
    >
      <AnimatePresence>
        {rippling && (
          <motion.span
            key={`${phase}-${cue?.click}`}
            className="absolute -left-[18px] -top-[18px] size-9 rounded-full border-2 border-[#2B59E0]"
            initial={{ scale: 0.2, opacity: 0.7 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <motion.svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        className="-ml-[4px] -mt-[3px] drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
        animate={{ scale: pressing ? 0.82 : 1 }}
        transition={{ duration: 0.12 }}
        style={{ originX: 0.15, originY: 0.1 }}
      >
        <path
          d="M4 2.5l15 9.2-6.6 1.4 3.9 7.3-2.7 1.4-3.9-7.3L4 19z"
          fill="#0F1729"
          stroke="#fff"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  )
}

/* ─── Shared demo UI ─────────────────────────────────────────────────────────── */
function PaneHead({ icon, title, sub }: { icon: ReactNode; title: string; sub: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EEF2FD] text-[#0038A8]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[17px] font-extrabold leading-tight tracking-[-0.02em]">
          {title}
        </div>
        <div className="truncate text-[13px] font-medium text-[#5C6479]">{sub}</div>
      </div>
    </div>
  )
}

function DemoButton({
  cursor,
  pressed,
  done,
  onClick,
  className = 'w-full',
  children,
}: {
  cursor: string
  pressed: boolean
  done: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <motion.button
      type="button"
      data-cursor={cursor}
      onClick={onClick}
      animate={{ scale: pressed ? 0.96 : 1, backgroundColor: done ? GREEN : PRI }}
      transition={{ scale: { duration: 0.12 }, backgroundColor: { duration: 0.3 } }}
      className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[14px] font-bold text-white outline-none focus-visible:ring-4 focus-visible:ring-[#2B59E0]/25 ${className}`}
      style={{
        boxShadow: done ? '0 10px 24px rgba(5,150,105,0.22)' : '0 10px 24px rgba(43,89,224,0.25)',
      }}
    >
      {children}
    </motion.button>
  )
}

function Caret({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="ml-[2px] inline-block h-[1.1em] w-[2px] translate-y-[2px] rounded-full bg-[#2B59E0]"
      style={{ opacity: on ? 1 : 0 }}
    />
  )
}

/* ─── Step 1 · Name your workspace ───────────────────────────────────────────── */
function WorkspacePane({
  t,
  userName,
  typing,
  onType,
  onFocus,
  onBlur,
  onSubmit,
}: {
  t: number
  userName: string
  typing: boolean
  onType: (v: string) => void
  onFocus: () => void
  onBlur: () => void
  onSubmit: () => void
}) {
  const inputId = useId()
  const auto = !typing && !userName
  const value = auto ? typed(DEFAULT_NAME, t, TYPE_AT) : userName
  const typedAt = TYPE_AT + DEFAULT_NAME.length * 70
  const showPreview = auto ? t >= typedAt + 150 : userName.trim().length > 0
  const shown = value.trim() || DEFAULT_NAME
  const saving = t >= CONTINUE_AT && t < SAVED_AT
  const saved = t >= SAVED_AT
  const caretOn = auto && t > 200 && !saved && (t < typedAt || Math.floor(t / 450) % 2 === 0)

  return (
    <div className="flex h-full flex-col">
      <PaneHead
        icon={<Building2 className="size-5" strokeWidth={1.75} />}
        title="Name your workspace"
        sub="This is what your team will see."
      />

      <div className="mt-6 flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#9AA2B8]"
          style={MONO}
        >
          Workspace name
        </label>
        <AnimatePresence>
          {!userName && !typing && (
            <motion.span
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 rounded-full bg-[#EEF2FD] px-2.5 py-1 text-[11px] font-bold text-[#2B59E0]"
            >
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#2B59E0] opacity-60" />
                <span className="relative size-1.5 rounded-full bg-[#2B59E0]" />
              </span>
              Try it: type yours
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="relative mt-2">
        <input
          id={inputId}
          value={value}
          onChange={e => onType(e.target.value.slice(0, 32))}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder="Mumbai Realty Group"
          autoComplete="off"
          spellCheck={false}
          className="h-12 w-full rounded-[10px] border bg-[#FAFBFE] px-4 text-[16px] font-semibold outline-none transition-[border-color,box-shadow] placeholder:font-medium placeholder:text-[#9AA2B8]"
          style={{
            fontFamily: FONT_SANS,
            color: auto ? 'transparent' : '#0F1729',
            caretColor: PRI,
            borderColor: typing || (auto && t > 200 && !saved) ? PRI : BORDER,
            boxShadow:
              typing || (auto && t > 200 && !saved) ? '0 0 0 4px rgba(43,89,224,0.10)' : 'none',
          }}
        />
        {auto && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center pl-[17px] text-[16px] font-semibold text-[#0F1729]"
          >
            {value}
            <Caret on={caretOn} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mt-4 flex items-center gap-3 rounded-[12px] border border-[#E8EAF0] bg-white p-3 shadow-[0_8px_24px_rgba(20,36,90,0.06)]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#0038A8] text-[14px] font-extrabold text-white">
              {initials(shown)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">{shown}</div>
              <div className="flex items-center gap-1.5 truncate text-[12px] text-[#5C6479]">
                <ShieldCheck className="size-3.5 shrink-0 text-[#2B59E0]" strokeWidth={2} />
                Private workspace<span className="hidden sm:inline"> · you&apos;re the admin</span>
              </div>
            </div>
            <span className="shrink-0 rounded-[6px] bg-[rgba(16,185,129,0.08)] px-2 py-1 text-[11px] font-bold tracking-[0.04em] text-[#059669]">
              READY
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto pt-4">
        <DemoButton
          cursor="continue"
          pressed={t >= CONTINUE_AT && t < CONTINUE_AT + 160}
          done={saved}
          onClick={onSubmit}
        >
          {saved ? (
            <>
              <Check className="size-4" strokeWidth={2.75} /> Workspace created
            </>
          ) : saving ? (
            <>
              <LoaderCircle className="size-4 animate-spin" strokeWidth={2.5} /> Creating workspace
            </>
          ) : (
            <>
              Continue <ArrowRight className="size-4" strokeWidth={2.25} />
            </>
          )}
        </DemoButton>
      </div>
    </div>
  )
}

/* ─── Step 2 · Invite your team ──────────────────────────────────────────────── */
function TeamPane({ t, name, onNext }: { t: number; name: string; onNext: () => void }) {
  const [manualRoute, setManualRoute] = useState<boolean | null>(null)
  const domain = `${slug(name)}.in`
  const invites = TEAM.map((m, i) => {
    const email = `${m.first.toLowerCase()}@${domain}`
    const start = INVITE_AT[i]
    const end = start + email.length * 20
    return {
      ...m,
      email,
      text: typed(email, t, start, 20),
      typing: t >= start && t < end + 150,
      sent: t >= end + 150,
    }
  })
  const sent = invites.filter(m => m.sent)
  const routeOn = manualRoute ?? t >= ROUTE_AT
  const done = t >= SEND_AT + 200

  return (
    <div className="flex h-full flex-col">
      <PaneHead
        icon={<Users className="size-5" strokeWidth={1.75} />}
        title="Invite your team"
        sub="Agents get a link to join your workspace."
      />

      <div className="mt-5 flex flex-col gap-2">
        {invites.map(m => (
          <div
            key={m.first}
            className="flex h-11 items-center gap-3 rounded-[10px] border bg-[#FAFBFE] px-3 transition-[border-color,box-shadow] duration-200"
            style={{
              borderColor: m.typing ? PRI : BORDER,
              boxShadow: m.typing ? '0 0 0 4px rgba(43,89,224,0.10)' : 'none',
            }}
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold transition-opacity duration-300"
              style={{ background: m.bg, color: m.fg, opacity: m.sent ? 1 : 0.45 }}
            >
              {m.initials}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[14px] font-medium"
              style={{ color: m.text ? '#0F1729' : '#9AA2B8' }}
            >
              {m.text || `agent@${domain}`}
              {m.typing && <Caret on />}
            </span>
            <AnimatePresence>
              {m.sent && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-[#059669]"
                >
                  <Check className="size-3.5" strokeWidth={3} /> Added
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border border-[#E8EAF0] bg-white px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="text-[14px] font-bold">Auto-route new leads</div>
          <div className="truncate text-[12px] text-[#5C6479]">Each new enquiry gets an agent</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={routeOn}
          aria-label="Auto-route new leads"
          data-cursor="route"
          onClick={() => setManualRoute(!routeOn)}
          className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-300 outline-none focus-visible:ring-4 focus-visible:ring-[#2B59E0]/25"
          style={{ background: routeOn ? PRI : '#D5DBE8' }}
        >
          <motion.span
            className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,41,0.25)]"
            animate={{ x: routeOn ? 20 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          />
        </button>
      </div>

      <div className="mt-auto flex items-center gap-3 pt-4">
        <div className="flex shrink-0 items-center">
          <span className="relative z-10 flex size-9 items-center justify-center rounded-full bg-[#0038A8] text-[11px] font-extrabold text-white ring-2 ring-white">
            {initials(name)}
          </span>
          <AnimatePresence>
            {sent.map((m, i) => (
              <motion.span
                key={m.first}
                initial={{ opacity: 0, scale: 0.4, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                className="-ml-2 flex size-9 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-white"
                style={{ background: m.bg, color: m.fg, zIndex: 9 - i }}
              >
                {m.initials}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <DemoButton
          cursor="send"
          pressed={t >= SEND_AT && t < SEND_AT + 160}
          done={done}
          onClick={onNext}
          className="min-w-0 flex-1"
        >
          {done ? (
            <>
              <Check className="size-4" strokeWidth={2.75} />
              <span className="max-[379px]:hidden">3 agents invited</span>
              <span className="min-[380px]:hidden">Invited</span>
            </>
          ) : (
            <>
              Send invites <ArrowRight className="size-4" strokeWidth={2.25} />
            </>
          )}
        </DemoButton>
      </div>
    </div>
  )
}

/* ─── Step 3 · Import your pipeline ──────────────────────────────────────────── */
function ImportPane({
  t,
  onFix,
  onImport,
}: {
  t: number
  onFix: () => void
  onImport: () => void
}) {
  const landed = t >= LAND_AT
  const table = t >= TABLE_AT
  const importing = t >= IMPORT_AT && t < IMPORTED_AT
  const imported = t >= IMPORTED_AT
  const importProg = easeOut(prog(t, IMPORT_AT, IMPORTED_AT - 200))
  const count = Math.round(LEAD_COUNT * importProg)
  const flagged = t >= FLAG_AT && t < FIXED_AT
  const fixed = t >= FIXED_AT

  const status = imported
    ? {
        text: (
          <>
            {LEAD_COUNT} leads imported<span className="hidden sm:inline">, scored and sorted</span>
          </>
        ),
        color: GREEN,
      }
    : importing
      ? { text: `Importing ${count} / ${LEAD_COUNT}`, color: '#0F1729' }
      : fixed
        ? {
            text: (
              <>
                Fixed inline<span className="hidden sm:inline">. No re-upload needed.</span>
              </>
            ),
            color: GREEN,
          }
        : flagged
          ? {
              text: (
                <>
                  <span className="hidden sm:inline">1 row needs a fix: p</span>
                  <span className="sm:hidden">P</span>hone has 9 digits
                </>
              ),
              color: '#DC2626',
            }
          : { text: 'Checking every row…', color: '#5C6479' }

  return (
    <div className="flex h-full flex-col">
      <PaneHead
        icon={
          table ? (
            <FileSpreadsheet className="size-5 text-[#059669]" strokeWidth={1.75} />
          ) : (
            <Upload className="size-5" strokeWidth={1.75} />
          )
        }
        title="Import your pipeline"
        sub={
          table ? (
            <>
              portal_leads.csv · <span style={MONO}>{LEAD_COUNT}</span> rows
              <span className="hidden sm:inline"> · columns matched</span>
            </>
          ) : (
            'Drop a CSV from any portal.'
          )
        }
      />

      <AnimatePresence mode="wait" initial={false}>
        {!table ? (
          <motion.div
            key="drop"
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="mt-5 flex flex-1 flex-col items-center justify-center rounded-[14px] border-2 border-dashed transition-colors duration-300"
            style={{
              borderColor: landed ? PRI : '#D5DBE8',
              background: landed ? '#F5F8FF' : '#FAFBFE',
            }}
          >
            <motion.div
              initial={{ y: -150, x: 70, rotate: -12, opacity: 0 }}
              animate={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 150, damping: 15 }}
              className="flex items-center gap-3 rounded-[12px] border border-[#E8EAF0] bg-white px-4 py-3 shadow-[0_14px_34px_rgba(20,36,90,0.14)]"
            >
              <span className="flex size-9 items-center justify-center rounded-[9px] bg-[rgba(16,185,129,0.1)] text-[#059669]">
                <FileSpreadsheet className="size-5" strokeWidth={1.75} />
              </span>
              <div>
                <div className="text-[14px] font-bold">portal_leads.csv</div>
                <div className="text-[12px] text-[#5C6479]" style={MONO}>
                  {LEAD_COUNT} rows · 18 KB
                </div>
              </div>
            </motion.div>
            <div
              className="mt-4 flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: landed ? PRI : '#5C6479' }}
            >
              {landed ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" strokeWidth={2.5} /> Reading{' '}
                  {LEAD_COUNT} rows
                </>
              ) : (
                'Drop your CSV here'
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex flex-1 flex-col"
          >
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {['Name', 'Phone', 'Source', 'Budget'].map((f, i) => (
                <motion.span
                  key={f}
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: 0.1 + i * 0.08,
                    type: 'spring',
                    stiffness: 500,
                    damping: 26,
                  }}
                  className="flex items-center gap-1 rounded-[7px] border border-[#E8EAF0] bg-white px-2 py-[3px] text-[11.5px] font-semibold text-[#3B4A6B]"
                >
                  <Check className="size-3 text-[#059669]" strokeWidth={3} />
                  {f}
                </motion.span>
              ))}
            </div>

            <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E8EAF0] bg-white">
              <div
                className="grid grid-cols-[minmax(0,1fr)_96px_96px] max-[379px]:grid-cols-[minmax(0,1fr)_96px_12px] gap-2 bg-[#F7F8FC] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#9AA2B8] sm:grid-cols-[1.3fr_1.05fr_1fr_0.7fr]"
                style={MONO}
              >
                <span>Name</span>
                <span>Phone</span>
                <span className="max-[379px]:invisible">Source</span>
                <span className="hidden sm:block">Budget</span>
              </div>
              {ROWS.map((r, i) => {
                const bad = r.fix !== ''
                const fixing = bad && t >= FIX_AT && t < FIXED_AT
                const phone = bad && t >= FIX_AT + 180 ? r.phone + r.fix : r.phone
                return (
                  <motion.div
                    key={r.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.09, duration: 0.35, ease: EASE }}
                    className="grid h-9 grid-cols-[minmax(0,1fr)_96px_96px] max-[379px]:grid-cols-[minmax(0,1fr)_96px_12px] items-center gap-2 border-t border-[#EEF0F5] px-3 text-[12.5px] sm:grid-cols-[1.3fr_1.05fr_1fr_0.7fr] sm:text-[13px]"
                  >
                    <span className="truncate font-semibold">{r.name}</span>
                    {bad ? (
                      <button
                        type="button"
                        data-cursor="fix"
                        onClick={onFix}
                        aria-label="Fix this phone number"
                        className="-ml-1.5 flex h-7 cursor-pointer items-center truncate rounded-[6px] border px-1.5 text-left text-[12.5px] transition-colors duration-300"
                        style={{
                          ...MONO,
                          background:
                            flagged && !fixing
                              ? 'rgba(239,68,68,0.08)'
                              : fixed
                                ? 'rgba(16,185,129,0.08)'
                                : fixing
                                  ? '#FFFFFF'
                                  : 'transparent',
                          borderColor:
                            flagged && !fixing
                              ? 'rgba(220,38,38,0.35)'
                              : fixing
                                ? PRI
                                : fixed
                                  ? 'rgba(5,150,105,0.3)'
                                  : 'transparent',
                          color: flagged && !fixing ? '#DC2626' : fixed ? GREEN : '#3B4A6B',
                        }}
                      >
                        {phone}
                        {fixing && <Caret on />}
                      </button>
                    ) : (
                      <span className="truncate text-[12.5px] text-[#3B4A6B]" style={MONO}>
                        {r.phone}
                      </span>
                    )}
                    <span className="flex min-w-0 items-center gap-1.5 text-[#3B4A6B]">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: SOURCE_DOT[r.source] }}
                      />
                      <span className="truncate max-[379px]:hidden">{r.source}</span>
                    </span>
                    <span className="hidden text-[12.5px] text-[#3B4A6B] sm:block" style={MONO}>
                      {r.budget}
                    </span>
                  </motion.div>
                )
              })}
            </div>

            <div className="mt-auto flex items-center gap-3 pt-4">
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[13px] font-semibold transition-colors duration-300"
                  style={{ color: status.color }}
                >
                  {status.text}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF2FD]">
                  <div
                    className="h-full origin-left rounded-full transition-colors duration-300"
                    style={{
                      transform: `scaleX(${importProg})`,
                      background: imported ? GREEN : PRI,
                    }}
                  />
                </div>
              </div>
              <DemoButton
                cursor="import"
                pressed={t >= IMPORT_AT && t < IMPORT_AT + 160}
                done={imported}
                onClick={onImport}
                className="min-w-[124px] shrink-0 px-4 sm:min-w-[156px]"
              >
                {imported ? (
                  <>
                    <Check className="size-4" strokeWidth={2.75} /> Imported
                  </>
                ) : importing ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" strokeWidth={2.5} /> Importing
                  </>
                ) : (
                  <span>
                    Import <span className="hidden sm:inline">{LEAD_COUNT} </span>leads
                  </span>
                )}
              </DemoButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Done · You're live ─────────────────────────────────────────────────────── */
function LivePane({
  t,
  name,
  onStart,
  onReplay,
}: {
  t: number
  name: string
  onStart: () => void
  onReplay: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <div className="relative flex size-11 shrink-0 items-center justify-center">
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-[#059669]"
            initial={{ scale: 0.6, opacity: 0.6 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
          />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return (
              <motion.span
                key={i}
                aria-hidden
                className="absolute size-1.5 rounded-full"
                style={{ background: i % 2 ? PRI : GREEN }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * 34, y: Math.sin(a) * 34, opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
              />
            )
          })}
          <motion.span
            className="relative flex size-11 items-center justify-center rounded-full bg-[#059669] text-white shadow-[0_10px_24px_rgba(5,150,105,0.3)]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.05 }}
          >
            <Check className="size-6" strokeWidth={2.75} />
          </motion.span>
        </div>
        <motion.div
          className="min-w-0"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
        >
          <div className="truncate text-[19px] font-extrabold tracking-[-0.02em]">
            {name} is live.
          </div>
          <div className="text-[13px] font-medium leading-snug text-[#5C6479]">
            <span style={MONO}>{LEAD_COUNT}</span> leads scored and sorted. Call these first.
          </div>
        </motion.div>
      </div>

      <div
        className="mt-5 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-[#9AA2B8]"
        style={MONO}
      >
        <span>Today · who needs you now</span>
        <span>Intent</span>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {TODAY.map((l, i) => {
          const score = Math.round(l.score * easeOut(prog(t, 700 + i * 150, 1700 + i * 150)))
          return (
            <motion.div
              key={l.name}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.15, duration: 0.5, ease: EASE }}
              className="flex h-[54px] items-center gap-3 rounded-[12px] border bg-white px-3"
              style={{
                borderColor: i === 0 ? 'rgba(43,89,224,0.45)' : BORDER,
                boxShadow: i === 0 ? '0 0 0 4px rgba(43,89,224,0.08)' : 'none',
              }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold"
                style={{ background: l.bg, color: l.fg }}
              >
                {initials(l.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-bold">{l.name}</span>
                  <span
                    className="shrink-0 rounded-[5px] px-1.5 py-[1px] text-[10px] font-bold tracking-[0.04em]"
                    style={{ background: l.bg, color: l.fg }}
                  >
                    {l.tag}
                  </span>
                </div>
                <div className="truncate text-[12px] text-[#5C6479]">
                  <span className="font-semibold text-[#3B4A6B]">{l.bucket}</span> · {l.note}
                </div>
              </div>
              <span
                className="w-7 shrink-0 text-right text-[18px] font-semibold"
                style={{ ...MONO, color: l.fg }}
              >
                {score}
              </span>
              <span className="hidden size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#EEF2FD] text-[#2B59E0] sm:flex">
                <PhoneCall className="size-4" strokeWidth={2} />
              </span>
            </motion.div>
          )
        })}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <motion.button
          type="button"
          data-cursor="start"
          onClick={onStart}
          animate={{ scale: t >= START_AT && t < START_AT + 160 ? 0.96 : 1 }}
          transition={{ duration: 0.12 }}
          className="flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#2B59E0] text-[14px] font-bold text-white shadow-[0_10px_24px_rgba(43,89,224,0.3)] transition-colors hover:bg-[#2450D0]"
        >
          <span className="truncate max-[379px]:hidden">Start your workspace</span>
          <span className="min-[380px]:hidden">Open workspace</span>
          <ArrowRight className="size-4 shrink-0" strokeWidth={2.25} />
        </motion.button>
        <button
          type="button"
          onClick={onReplay}
          className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#E8EAF0] bg-white px-3.5 text-[13px] font-bold text-[#3B4A6B] transition-colors hover:bg-[#F7F8FC]"
        >
          <RotateCcw className="size-4" strokeWidth={2.25} /> Replay
        </button>
      </div>
    </div>
  )
}

/* ─── After setup · the main dashboard ───────────────────────────────────────── */
function DashboardPane({
  t,
  name,
  href,
  logoSrc,
  onReplay,
}: {
  t: number
  name: string
  href: string
  logoSrc: string
  onReplay: () => void
}) {
  const calling = t >= CALL_AT && t < LOGGED_AT
  const logged = t >= LOGGED_AT
  const kpiIn = (i: number) => easeOut(prog(t, 300 + i * 100, 1300 + i * 100))
  const chartIn = easeOut(prog(t, 900, 2400))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const DASH_KPIS = [
    { label: 'Total leads', raw: 106, display: (p: number) => Math.round(106 * p).toString(), navy: false, badge: null },
    { label: 'Hot leads', raw: 53, display: (p: number) => Math.round(53 * p).toString(), navy: false, badge: { text: 'intent 70+', color: '#B45309', bg: 'rgba(245,158,11,0.1)' } },
    { label: 'Pipeline value', raw: 227.8, display: (p: number) => `₹${(227.8 * p).toFixed(1)} Cr`, navy: true, badge: null },
    { label: 'Deals closed', raw: 7, display: (p: number) => Math.round(7 * p).toString(), navy: false, badge: { text: '+7 won', color: '#059669', bg: 'rgba(16,185,129,0.1)' } },
  ]

  // SVG sparkline path — rising curve matching the real app
  const LINE = 'M0 58 C25 56 45 52 65 48 C85 44 95 40 115 32 C135 24 150 16 170 10 C188 4 205 6 225 3 C248 0 265 6 280 2'
  const AREA = `${LINE} L280 64 L0 64 Z`

  return (
    <div className="flex h-full" style={{ fontFamily: FONT_SANS }}>
      {/* ── Dark icon-only sidebar ── */}
      <aside className="hidden w-12 shrink-0 flex-col items-center gap-0.5 border-r border-white/[0.06] bg-[#0B1433] pb-4 pt-3 sm:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" className="mb-3 h-6 w-auto" />
        {NAV.map(({ icon: Icon, label }, i) => {
          const on = label === 'Dashboard'
          return (
            <motion.div
              key={label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.06 + i * 0.04, duration: 0.35, ease: EASE }}
              className="flex size-9 items-center justify-center rounded-[8px]"
              style={{
                background: on ? 'rgba(43,89,224,0.22)' : 'transparent',
                color: on ? '#8FB0FF' : 'rgba(255,255,255,0.28)',
              }}
            >
              <Icon className="size-[17px] shrink-0" strokeWidth={on ? 2 : 1.75} />
            </motion.div>
          )
        })}
      </aside>

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#F4F6FB]">

        {/* Header */}
        <div className="border-b border-[#E8EAF0] bg-white px-4 py-2.5">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
          >
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9AA2B8]">
              Friday, 2 October
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[16px] font-extrabold tracking-[-0.03em]">
                  {greeting}, {name}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#5C6479]">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(43,89,224,0.08)', color: PRI }}
                  >
                    <span className="size-1.5 rounded-full bg-[#DC2626]" />
                    46 hot leads need follow-up
                  </span>
                  · 7 deals closed
                </div>
              </div>

              {/* Hot lead call card */}
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.4, ease: EASE }}
                className="hidden shrink-0 items-center gap-2 rounded-[10px] border border-[#E8EAF0] bg-white py-1.5 pl-2.5 pr-1.5 shadow-[0_4px_12px_rgba(20,36,90,0.06)] sm:flex"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
                <div className="leading-tight">
                  <div className="text-[11px] font-bold">Rohan Mehta</div>
                  <div className="text-[9.5px] text-[#9AA2B8]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    86 score · ₹1.4 Cr
                  </div>
                </div>
                <motion.button
                  type="button"
                  data-cursor="call"
                  animate={{ scale: t >= CALL_AT && t < CALL_AT + 160 ? 0.93 : 1 }}
                  transition={{ duration: 0.12 }}
                  className="flex h-6 min-w-[68px] cursor-pointer items-center justify-center gap-1 rounded-[7px] px-2 text-[11px] font-bold transition-colors duration-300"
                  style={{
                    background: calling || logged ? 'rgba(16,185,129,0.1)' : '#EEF2FD',
                    color: calling || logged ? GREEN : PRI,
                  }}
                >
                  {logged ? (
                    <><Check className="size-3" strokeWidth={3} /> Logged</>
                  ) : calling ? (
                    <><PhoneCall className="size-3 animate-pulse" strokeWidth={2.25} /> Calling</>
                  ) : (
                    <>Call <ArrowRight className="size-3" strokeWidth={2.5} /></>
                  )}
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 overflow-hidden px-3 py-2.5">

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-2">
            {DASH_KPIS.map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.07, duration: 0.4, ease: EASE }}
                className="relative min-w-0 rounded-[10px] border p-2.5"
                style={
                  k.navy
                    ? { background: '#0B1433', borderColor: '#0B1433' }
                    : { background: '#FFFFFF', borderColor: BORDER }
                }
              >
                {k.badge && (
                  <span
                    className="absolute right-1.5 top-1.5 rounded-[4px] px-1.5 py-[2px] text-[8.5px] font-bold"
                    style={{ background: k.badge.bg, color: k.badge.color }}
                  >
                    {k.badge.text}
                  </span>
                )}
                <div
                  className="text-[9px] font-semibold"
                  style={{ color: k.navy ? '#AFC0EA' : '#5C6479' }}
                >
                  {k.label}
                </div>
                <div
                  className="mt-1 text-[17px] font-extrabold leading-none tracking-[-0.03em]"
                  style={{ color: k.navy ? '#FFFFFF' : '#0F1729', fontVariantNumeric: 'tabular-nums' }}
                >
                  {k.display(kpiIn(i))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pipeline movement — line chart */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.45, ease: EASE }}
            className="flex-1 min-h-0 rounded-[12px] border border-[#E8EAF0] bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[12px] font-bold text-[#0F1729]">Pipeline movement</div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[15px] font-extrabold tracking-[-0.02em]">₹256.2 Cr</span>
                  <span className="text-[10px] font-bold" style={{ color: GREEN }}>+22%</span>
                  <span className="text-[10px] text-[#9AA2B8]">vs prior year</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {['1W', '1M', '6M', '1Y'].map((l, i) => (
                  <span
                    key={l}
                    className="rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold"
                    style={i === 3 ? { background: '#EEF2FD', color: PRI } : { color: '#9AA2B8' }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>

            {/* SVG sparkline */}
            <div className="relative mt-1.5 h-[52px]">
              <svg viewBox="0 0 280 64" className="h-full w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="dash-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRI} stopOpacity="0.14" />
                    <stop offset="100%" stopColor={PRI} stopOpacity="0.01" />
                  </linearGradient>
                  <clipPath id="chart-clip">
                    <rect x="0" y="0" width={280 * chartIn} height="64" />
                  </clipPath>
                </defs>
                <path d={AREA} fill="url(#dash-grad)" clipPath="url(#chart-clip)" />
                <path d={LINE} stroke={PRI} strokeWidth="2" fill="none" strokeLinecap="round" clipPath="url(#chart-clip)" />
                {/* forecast dashed tail */}
                <path
                  d="M225 3 C248 0 265 6 280 2"
                  stroke={PRI} strokeWidth="1.5" strokeDasharray="3 2.5" fill="none"
                  style={{ opacity: chartIn * 0.45 }}
                />
                {/* active dot */}
                <circle cx="210" cy="5" r="3.5" fill="white" stroke={PRI} strokeWidth="2"
                  style={{ opacity: chartIn > 0.7 ? 1 : 0 }} />
              </svg>
              {/* tooltip */}
              <AnimatePresence>
                {chartIn > 0.82 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute rounded-[7px] bg-[#0B1433] px-2 py-1.5 shadow-lg"
                    style={{ left: '71%', top: '-4px' }}
                  >
                    <div className="text-[8.5px] font-medium text-[#AFC0EA]">Oct</div>
                    <div className="text-[11px] font-extrabold text-white">₹3.6 Cr</div>
                    <div className="text-[8.5px] font-semibold" style={{ color: GREEN }}>Trending up</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-1.5 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#9AA2B8]">
                <span className="inline-block h-px w-4 bg-[#2B59E0]" /> Created pipeline
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#9AA2B8]">
                <span className="inline-block h-px w-4 border-t border-dashed border-[#2B59E0] opacity-50" /> Forecast
              </span>
            </div>
          </motion.div>

          {/* CTA banner */}
          <AnimatePresence>
            {t >= DASH_CTA_AT && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="flex shrink-0 items-center gap-2 rounded-[12px] bg-[#0B1433] py-2 pl-3.5 pr-2 text-white shadow-[0_12px_32px_rgba(11,20,51,0.28)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold">This is day one.</div>
                  <div className="text-[10.5px] text-[#AFC0EA]">Leads scored. Ready to call.</div>
                </div>
                <motion.a
                  href={href}
                  data-cursor="get-started"
                  animate={{ scale: t >= DASH_CLICK_AT && t < DASH_CLICK_AT + 160 ? 0.95 : 1 }}
                  transition={{ duration: 0.12 }}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-[#2B59E0] px-3 text-[12px] font-extrabold text-white transition-colors hover:bg-[#3A66EA]"
                >
                  Get started <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </motion.a>
                <button
                  type="button"
                  onClick={onReplay}
                  aria-label="Replay demo"
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-[#AFC0EA] transition-colors hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="size-[15px]" strokeWidth={2.25} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
