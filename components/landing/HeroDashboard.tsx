'use client'

/* ─────────────────────────────────────────────────────────────────────────────
 * HeroDashboard · the live product panel under the hero
 *
 * A faithful copy of the real LeadGap dashboard (app/dashboard/page.tsx: same
 * tokens, cards, charts and copy patterns) that zooms in as the visitor scrolls
 * past the hero, then plays a short guided tour with a demo cursor:
 *   01 your day at a glance  →  02 a new enquiry lands, already scored  →
 *   03 one-click call, follow-up booked  →  04 pipeline by range  →  05 lead sources
 * Hovering (or tapping) the panel hands control to the visitor: the tour pauses
 * and every widget works (range tabs, chart hover, funnel tabs, calendar days,
 * market pulse, the Call button). The chapter pills below jump between steps.
 *
 * Desktop and tablet get the full dashboard, scaled to fit. Phones get the
 * mobile app in a phone frame. Reduced motion: no zoom, no auto tour.
 * Stack: React 19 · TypeScript · Tailwind CSS v4 · motion (motion/react) ·
 *        @phosphor-icons/react (the app's own icons) · lucide-react
 * Usage:  <HeroDashboard />            (every prop is optional)
 * ──────────────────────────────────────────────────────────────────────────── */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
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
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import {
  Bell,
  CalendarCheck,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  CheckCircle,
  CheckSquare,
  Fire,
  Gear,
  House,
  MagnifyingGlass,
  Megaphone,
  Microphone,
  Newspaper,
  PhoneCall,
  PhoneDisconnect,
  Robot,
  Trophy,
  Users,
} from '@phosphor-icons/react'
import { Lock, Pause, Play } from 'lucide-react'

export type HeroDashboardProps = {
  /** Square LeadGap mark used in the app sidebar and phone header. */
  logoSrc?: string
  /** First name in the dashboard greeting. */
  userName?: string
  className?: string
}

/* ─── Tokens: landing type + the app's own dashboard palette ───────────────── */
const FONT_SANS =
  "var(--font-jakarta, 'Plus Jakarta Sans'), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
const FONT_MONO =
  "var(--font-geist-mono, 'Geist Mono'), 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const MONO: CSSProperties = { fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' }

const BG = '#eef0f6'
const PANEL = '#ffffff'
const BORDER = '#dfe2ed'
const TEXT = '#0f1729'
const MUTED = '#5c6479'
const LABEL = '#9aa2b8'
const BLUE = '#1D4ED8'
const BLUE_L = '#3B82F6'
const BLUE_DIM = 'rgba(29,78,216,0.08)'
const NAVY = '#0038A8'
const EMERALD = '#10b981'
const AMBER = '#f59e0b'
const RED_C = '#f43f5e'
const VIOLET = '#7c5cfc'
const EASE = [0.22, 1, 0.36, 1] as const

// Design canvases. Both are drawn at this size and scaled to fit.
const DESK = { w: 1280, h: 800 }
const PHONE = { w: 360, h: 740 }
const DESKTOP_MIN = 700

/* ─── Mock data (the same shapes the real dashboard renders) ───────────────── */
type Range = '1W' | '1M' | '6M' | '1Y'
type FunnelTab = 'Status' | 'Source' | 'Budget'
type CallState = 'idle' | 'ringing' | 'live' | 'booked'
type Anchor = 'top' | 'chart' | 'funnel'

const SERIES: Record<Range, { labels: string[]; vals: number[]; vs: string }> = {
  '1Y': {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    vals: [12.4, 13.9, 15.2, 16.8, 18.1, 19.7, 21.6, 23.4, 25.9, 28.7, 30.1, 31.0],
    vs: 'year',
  },
  '6M': {
    labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    vals: [18.1, 19.7, 21.6, 23.4, 25.9, 28.7],
    vs: '6 mo',
  },
  '1M': { labels: ['W1', 'W2', 'W3', 'W4'], vals: [5.8, 6.9, 7.4, 8.6], vs: 'month' },
  '1W': {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vals: [1.1, 1.4, 1.2, 1.9, 1.7, 2.3, 0.9],
    vs: 'week',
  },
}

const FUNNEL: Record<FunnelTab, { name: string; count: number; cr: number; color: string }[]> = {
  Status: [
    { name: 'New', count: 41, cr: 88.6, color: BLUE },
    { name: 'Cold', count: 22, cr: 41.3, color: BLUE_L },
    { name: 'Warm', count: 18, cr: 39.7, color: AMBER },
    { name: 'Hot', count: 18, cr: 44.1, color: '#1D4ED8' },
    { name: 'Closed', count: 7, cr: 14.1, color: EMERALD },
  ],
  Source: [
    { name: '99acres', count: 33, cr: 69.4, color: BLUE },
    { name: 'Housing.com', count: 29, cr: 71.2, color: VIOLET },
    { name: 'MagicBricks', count: 25, cr: 52.6, color: AMBER },
    { name: 'Facebook', count: 19, cr: 34.6, color: EMERALD },
  ],
  Budget: [
    { name: '< ₹50 L', count: 18, cr: 6.1, color: '#94a3b8' },
    { name: '₹50 L – 1 Cr', count: 34, cr: 25.8, color: BLUE },
    { name: '₹1 – 2 Cr', count: 29, cr: 43.5, color: BLUE_L },
    { name: '₹2 – 5 Cr', count: 19, cr: 68.4, color: AMBER },
    { name: '₹5 Cr +', count: 6, cr: 84.0, color: EMERALD },
  ],
}

const SOURCES = FUNNEL.Source.map(s => ({
  name: s.name,
  pct: Math.round((s.count / 106) * 100),
  color: s.color,
}))

const DONUT_R = 38
const DONUT_C = 2 * Math.PI * DONUT_R
const SOURCE_ARCS = SOURCES.map((s, i) => {
  const before = SOURCES.slice(0, i).reduce((sum, x) => sum + (x.pct / 100) * DONUT_C, 0)
  const len = (s.pct / 100) * DONUT_C
  return { ...s, dash: `${len.toFixed(2)} ${(DONUT_C - len).toFixed(2)}`, offset: -before }
})

const PULSE = [
  'Site-visit requests from your Baner listings doubled this week',
  'Housing.com is your fastest-growing lead source this month',
  '3 hot leads opened your price list after 9 PM yesterday',
]

type CalEvent = {
  hour: string
  title?: string
  range?: string
  tone?: string
  people?: string[]
  action?: string
  free?: boolean
  booked?: boolean
}
const TODAY_EVENTS: CalEvent[] = [
  { hour: '10 am', title: 'Follow-up block', range: '10.00 – 11.00 am', tone: BLUE },
  { hour: '11 am', free: true },
  {
    hour: '12 pm',
    title: 'Team forecast lock',
    range: '12.00 – 12.45 pm',
    tone: VIOLET,
    people: ['AR', 'NK'],
    action: 'On Slack',
  },
]
const BOOKED_EVENT: CalEvent = {
  hour: '11 am',
  title: 'Site visit · Priya Sharma',
  range: '11.30 am – 12.30 pm',
  tone: AMBER,
  booked: true,
}
const OTHER_EVENTS: CalEvent[] = [
  { hour: '10 am', free: true },
  {
    hour: '11 am',
    title: 'Builder review',
    range: '11.00 – 11.45 am',
    tone: BLUE,
    people: ['AR', 'VG'],
    action: 'On Slack',
  },
  { hour: '12 pm', free: true },
]

const NAV = [
  { name: 'Today', Icon: CalendarCheck },
  { name: 'Dashboard', Icon: House, active: true },
  { name: 'Leads', Icon: Users },
  { name: 'Outreach', Icon: Megaphone },
  { name: 'Workspace', Icon: CheckSquare },
  { name: 'Insights', Icon: ChartBar },
  { name: 'AI Advisor', Icon: Robot },
]
const TABS = [
  { name: 'Home', Icon: House, active: true },
  { name: 'Leads', Icon: Users },
  { name: 'Workspace', Icon: CheckSquare },
  { name: 'Insights', Icon: ChartBar },
  { name: 'Settings', Icon: Gear },
]

/* ─── Tour script ──────────────────────────────────────────────────────────── */
type Scene = {
  leads: number
  hot: number
  week: number
  notif: number
  toast: boolean
  call: CallState
  booked: boolean
  range: Range
  hover: number
  funnel: FunnelTab
  slice: number
  anchor: Anchor
  pulse: number
  day: number
  kpi: number
  cursor: string | null
  click: number
}

const START: Scene = {
  leads: 106,
  hot: 53,
  week: 9,
  notif: 30,
  toast: false,
  call: 'idle',
  booked: false,
  range: '1Y',
  hover: 9,
  funnel: 'Status',
  slice: -1,
  anchor: 'top',
  pulse: 0,
  day: -1,
  kpi: -1,
  cursor: 'rest',
  click: 0,
}

type Action = { at: number; set: Partial<Scene> | ((s: Scene) => Partial<Scene>) }
type Step = {
  label: string
  caption: string
  dur: number
  enter: Partial<Scene>
  actions: Action[]
}

const tap = (s: Scene) => ({ click: s.click + 1 })

const STEPS: Step[] = [
  {
    label: 'Your day',
    caption: 'Everything that matters, the moment you log in.',
    dur: 6200,
    enter: { ...START, click: undefined, pulse: undefined, day: undefined } as Partial<Scene>,
    actions: [
      { at: 1500, set: { cursor: 'kpi-1', kpi: 1 } },
      { at: 3000, set: { cursor: 'kpi-2', kpi: 2 } },
      { at: 4300, set: s => ({ pulse: s.pulse + 1 }) },
      { at: 4700, set: { cursor: 'rest', kpi: -1 } },
    ],
  },
  {
    label: 'New lead',
    caption: 'A Housing.com enquiry lands, already scored.',
    dur: 6200,
    enter: { toast: false, call: 'idle', anchor: 'top', kpi: -1 },
    actions: [
      { at: 500, set: { toast: true, leads: 107, hot: 54, week: 10, notif: 31 } },
      { at: 1800, set: { cursor: 'toast-score' } },
      { at: 3300, set: { cursor: 'kpi-0', kpi: 0 } },
      { at: 5300, set: { toast: false, cursor: 'rest', kpi: -1 } },
    ],
  },
  {
    label: 'First call',
    caption: 'Call your hottest lead in one click. The follow-up is set before you hang up.',
    dur: 8400,
    enter: { toast: false, call: 'idle', booked: false, anchor: 'top', kpi: -1, day: -1 },
    actions: [
      { at: 500, set: { cursor: 'call-btn' } },
      { at: 1400, set: s => ({ ...tap(s), call: 'ringing' }) },
      { at: 2800, set: { call: 'live' } },
      { at: 5400, set: { call: 'booked', booked: true } },
      { at: 6100, set: { cursor: 'cal-booked' } },
      { at: 7800, set: { call: 'idle' } },
    ],
  },
  {
    label: 'Pipeline',
    caption: 'Watch your pipeline grow, month by month.',
    dur: 7400,
    enter: { toast: false, call: 'idle', anchor: 'chart', range: '1Y', hover: 9, kpi: -1 },
    actions: [
      { at: 600, set: { cursor: 'range-6M' } },
      { at: 1400, set: s => ({ ...tap(s), range: '6M', hover: 5 }) },
      { at: 2300, set: { cursor: 'pt-1', hover: 1 } },
      { at: 3200, set: { cursor: 'pt-2', hover: 2 } },
      { at: 4100, set: { cursor: 'pt-3', hover: 3 } },
      { at: 5000, set: { cursor: 'pt-5', hover: 5 } },
      { at: 6500, set: { cursor: 'rest' } },
    ],
  },
  {
    label: 'Sources',
    caption: 'See which portals bring the leads that close.',
    dur: 7800,
    enter: { toast: false, call: 'idle', anchor: 'chart', funnel: 'Status', slice: -1, kpi: -1 },
    actions: [
      { at: 300, set: { anchor: 'funnel' } },
      { at: 1500, set: { cursor: 'funnel-Source' } },
      { at: 2300, set: s => ({ ...tap(s), funnel: 'Source' }) },
      { at: 3700, set: { cursor: 'slice-1', slice: 1 } },
      { at: 5800, set: { cursor: 'rest', slice: -1 } },
    ],
  },
]

function applyPatch(scene: Scene, p: Partial<Scene>): Scene {
  const next = { ...scene }
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined) (next as Record<string, unknown>)[k] = v
  }
  return next
}

// A rAF clock drives the script. Scene changes only re-render when an action fires;
// the chapter progress bar reads a motion value instead.
function useTour(running: boolean) {
  const [state, setState] = useState({ step: 0, scene: START })
  const clock = useRef({ step: 0, t: 0, fired: 0 })
  const progress = useMotionValue(0)

  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const c = clock.current
      c.t += Math.min(now - last, 100)
      last = now
      const step = STEPS[c.step]
      const due: Action[] = []
      while (c.fired < step.actions.length && step.actions[c.fired].at <= c.t) {
        due.push(step.actions[c.fired])
        c.fired += 1
      }
      if (due.length) {
        setState(s => ({
          step: s.step,
          scene: due.reduce(
            (sc, a) => applyPatch(sc, typeof a.set === 'function' ? a.set(sc) : a.set),
            s.scene
          ),
        }))
      }
      if (c.t >= step.dur) {
        const next = (c.step + 1) % STEPS.length
        clock.current = { step: next, t: 0, fired: 0 }
        setState(s => ({ step: next, scene: applyPatch(s.scene, STEPS[next].enter) }))
        progress.set(0)
      } else {
        progress.set(c.t / step.dur)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, progress])

  const jump = useCallback(
    (i: number) => {
      clock.current = { step: i, t: 0, fired: 0 }
      progress.set(0)
      setState(s => ({ step: i, scene: applyPatch(s.scene, STEPS[i].enter) }))
    },
    [progress]
  )
  const patch = useCallback(
    (p: Partial<Scene>) => setState(s => ({ step: s.step, scene: applyPatch(s.scene, p) })),
    []
  )
  return { step: state.step, scene: state.scene, progress, jump, patch }
}

/* ─── Shared context ───────────────────────────────────────────────────────── */
type Day = { dow: string; n: number; today: boolean }
type Ctx = {
  scene: Scene
  patch: (p: Partial<Scene>) => void
  startCall: () => void
  endCall: () => void
  shown: boolean
  calm: boolean
  userName: string
  logoSrc: string
  dateLabel: string
  week: Day[]
}
const TourCtx = createContext<Ctx | null>(null)
function useDash() {
  const c = useContext(TourCtx)
  if (!c) throw new Error('HeroDashboard widgets must render inside HeroDashboard')
  return c
}

// The visitor's real date, read on the client only, so the server HTML never mismatches.
const noopSubscribe = () => () => {}
function useTodayKey() {
  return useSyncExternalStore(
    noopSubscribe,
    () => new Date().toDateString(),
    () => 'Mon Oct 05 2026'
  )
}
// Reduced motion, read the same way: the server and the first client render both say
// "motion on", so the scroll-zoom styles hydrate cleanly, then the real setting applies.
const RM_QUERY = '(prefers-reduced-motion: reduce)'
function subscribeCalm(onChange: () => void) {
  const m = window.matchMedia(RM_QUERY)
  m.addEventListener('change', onChange)
  return () => m.removeEventListener('change', onChange)
}
function useCalm() {
  return useSyncExternalStore(
    subscribeCalm,
    () => window.matchMedia(RM_QUERY).matches,
    () => false
  )
}

function describeDay(key: string) {
  const d = new Date(key)
  const dateLabel = d
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
  const sunday = new Date(d)
  sunday.setDate(d.getDate() - d.getDay())
  const week: Day[] = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(sunday)
    x.setDate(sunday.getDate() + i)
    return {
      dow: x.toLocaleDateString('en-IN', { weekday: 'short' }),
      n: x.getDate(),
      today: i === d.getDay(),
    }
  })
  return { dateLabel, week }
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const crore = (v: number) => `₹${v.toFixed(1)} Cr`
const whole = (v: number) => String(Math.round(v))

/* ─── Section ──────────────────────────────────────────────────────────────── */
export function HeroDashboard({
  logoSrc = '/lgc-icon.svg',
  userName = 'Rahul',
  className = '',
}: HeroDashboardProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [boxRef, boxW] = useWidth<HTMLDivElement>()
  const shown = useInView(boxRef, { once: true, amount: 0.25 })
  const calm = useCalm()
  const inView = useInView(sectionRef, { amount: 0.3 })

  const [hovering, setHovering] = useState(false)
  const [held, setHeld] = useState(false)
  const [paused, setPaused] = useState(false)
  const running = inView && !hovering && !held && !paused && !calm
  const { step, scene, progress, jump, patch } = useTour(running)

  const todayKey = useTodayKey()
  const { dateLabel, week } = describeDay(todayKey)

  // A call the visitor starts themselves runs on timers while the tour is paused.
  const timers = useRef<number[]>([])
  const holdTimer = useRef<number | undefined>(undefined)
  const clearTimers = () => {
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
  }
  const startCall = () => {
    clearTimers()
    patch({ call: 'ringing', toast: false })
    const seq: [number, Partial<Scene>][] = [
      [1400, { call: 'live' }],
      [4000, { call: 'booked', booked: true, day: -1 }],
      [6800, { call: 'idle' }],
    ]
    timers.current = seq.map(([ms, p]) => window.setTimeout(() => patch(p), ms))
  }
  const endCall = () => {
    clearTimers()
    patch({ call: 'idle' })
  }
  useEffect(() => {
    const t = timers
    const h = holdTimer
    return () => {
      t.current.forEach(id => window.clearTimeout(id))
      window.clearTimeout(h.current)
    }
  }, [])

  const onEnter = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setHovering(true)
  }
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setHovering(false)
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    setHeld(true)
    window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => setHeld(false), 8000)
  }

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start 0.95', 'start 0.2'] })
  const scale = useTransform(scrollYProgress, [0, 1], [0.84, 1])
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0])
  const y = useTransform(scrollYProgress, [0, 1], [90, 0])
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1])
  // Static values (not an empty object) so the scroll-linked styles are overwritten, not left behind.
  const zoom = calm ? { scale: 1, rotateX: 0, y: 0, opacity: 1 } : { scale, rotateX, y, opacity }

  const desktop = boxW >= DESKTOP_MIN
  const ctx: Ctx = {
    scene,
    patch,
    startCall,
    endCall,
    shown,
    calm,
    userName,
    logoSrc,
    dateLabel,
    week,
  }
  const control = paused || calm ? 'paused' : hovering || held ? 'exploring' : 'live'

  return (
    <MotionConfig reducedMotion="user">
      <TourCtx.Provider value={ctx}>
        <section
          ref={sectionRef}
          aria-label="LeadGap dashboard preview"
          className={`relative px-4 pb-16 pt-4 sm:px-6 md:pb-24 ${className}`}
          style={{ fontFamily: FONT_SANS }}
        >
          <div className="mx-auto max-w-[1160px]" style={{ perspective: 1800 }}>
            <motion.div style={{ ...zoom, transformOrigin: '50% 0%' }} className="relative">
              {/* soft light behind the panel */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[60px] opacity-80 blur-3xl"
                style={{
                  background:
                    'radial-gradient(ellipse 60% 55% at 50% 45%, rgba(140,175,255,0.55), transparent 70%)',
                }}
              />
              <div ref={boxRef} className="w-full">
                {boxW > 0 &&
                  (desktop ? (
                    <BrowserWindow
                      width={boxW}
                      control={control}
                      onToggle={() => setPaused(p => !p)}
                    >
                      <Canvas
                        design={DESK}
                        width={boxW}
                        innerRef={canvasRef}
                        onPointerEnter={onEnter}
                        onPointerLeave={onLeave}
                        onPointerDown={onDown}
                      >
                        <DesktopApp />
                        <DemoCursor
                          root={canvasRef}
                          design={DESK}
                          rest={{ x: 980, y: 150 }}
                          visible={running}
                        />
                      </Canvas>
                    </BrowserWindow>
                  ) : (
                    <div className="mx-auto" style={{ width: Math.min(boxW, PHONE.w) }}>
                      <Canvas
                        design={PHONE}
                        width={Math.min(boxW, PHONE.w)}
                        innerRef={canvasRef}
                        onPointerEnter={onEnter}
                        onPointerLeave={onLeave}
                        onPointerDown={onDown}
                      >
                        <PhoneApp />
                        <DemoCursor
                          root={canvasRef}
                          design={PHONE}
                          rest={null}
                          visible={running}
                          touch
                        />
                      </Canvas>
                    </div>
                  ))}
                {boxW === 0 && <div className="aspect-[1280/840] w-full" />}
              </div>
            </motion.div>

            <Chapters
              step={step}
              progress={progress}
              running={running}
              desktop={desktop}
              onPick={i => {
                setPaused(false)
                jump(i)
              }}
              onToggle={() => setPaused(p => !p)}
              control={control}
            />
          </div>
        </section>
      </TourCtx.Provider>
    </MotionConfig>
  )
}

export default HeroDashboard

/* ─── Frames ───────────────────────────────────────────────────────────────── */
function BrowserWindow({
  width,
  control,
  onToggle,
  children,
}: {
  width: number
  control: 'live' | 'paused' | 'exploring'
  onToggle: () => void
  children: ReactNode
}) {
  const roomy = width >= 900
  return (
    <div className="overflow-hidden rounded-[14px] border border-white/40 bg-white shadow-[0_50px_120px_-30px_rgba(6,14,60,0.75),0_0_0_1px_rgba(10,20,70,0.08)]">
      <div className="relative flex h-10 items-center gap-3 border-b border-[#E3E7F0] bg-[#F5F7FB] px-4">
        <span className="flex gap-1.5" aria-hidden>
          {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
            <span key={c} className="size-[11px] rounded-full" style={{ background: c }} />
          ))}
        </span>
        <div className="absolute left-1/2 flex h-[26px] w-[min(380px,46%)] -translate-x-1/2 items-center justify-center gap-1.5 rounded-[7px] border border-[#E3E7F0] bg-white text-[11.5px] text-[#5C6479]">
          <Lock className="size-3 text-[#10b981]" strokeWidth={2.4} />
          app.leadgapcrm.in/dashboard
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={control === 'live' ? 'Pause the demo' : 'Play the demo'}
          className="ml-auto flex h-[26px] items-center gap-1.5 rounded-full border border-[#E3E7F0] bg-white px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#5C6479] outline-none transition-colors hover:text-[#0F1729] focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
          style={MONO}
        >
          {control === 'live' ? (
            <>
              <span className="relative flex size-[7px]">
                <span className="absolute inline-flex size-full rounded-full bg-[#10b981] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-[7px] rounded-full bg-[#10b981]" />
              </span>
              {roomy ? 'Live demo' : 'Live'}
              <Pause className="size-3" strokeWidth={2.4} />
            </>
          ) : (
            <>
              <Play className="size-3" strokeWidth={2.4} />
              {control === 'exploring' ? (roomy ? 'You’re exploring' : 'Exploring') : 'Paused'}
            </>
          )}
        </button>
      </div>
      {children}
    </div>
  )
}

function Canvas({
  design,
  width,
  innerRef,
  children,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
}: {
  design: { w: number; h: number }
  width: number
  innerRef: RefObject<HTMLDivElement | null>
  children: ReactNode
  onPointerEnter: (e: PointerEvent) => void
  onPointerLeave: (e: PointerEvent) => void
  onPointerDown: (e: PointerEvent) => void
}) {
  const s = width / design.w
  return (
    <div
      className="relative overflow-hidden"
      style={{ width, height: design.h * s }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
    >
      <div
        ref={innerRef}
        className="absolute left-0 top-0"
        style={{
          width: design.w,
          height: design.h,
          transform: `scale(${s})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ─── Demo cursor ──────────────────────────────────────────────────────────── */
function DemoCursor({
  root,
  design,
  rest,
  visible,
  touch = false,
}: {
  root: RefObject<HTMLDivElement | null>
  design: { w: number; h: number }
  rest: { x: number; y: number } | null
  visible: boolean
  touch?: boolean
}) {
  const { scene, calm } = useDash()
  const x = useMotionValue(rest?.x ?? design.w * 0.7)
  const y = useMotionValue(rest?.y ?? design.h * 0.6)
  const [onTarget, setOnTarget] = useState(false)

  useEffect(() => {
    const el = root.current
    if (!el || !scene.cursor) return
    let to = rest
    if (scene.cursor !== 'rest') {
      const t = el.querySelector(`[data-tour="${scene.cursor}"]`)
      if (!t) {
        const id = window.setTimeout(() => setOnTarget(false), 0)
        return () => window.clearTimeout(id)
      }
      const box = el.getBoundingClientRect()
      const r = t.getBoundingClientRect()
      const k = box.width / design.w || 1
      to = {
        x: (r.left - box.left + r.width * 0.5) / k,
        y: (r.top - box.top + r.height * 0.55) / k,
      }
    }
    if (!to) return
    const opts = { duration: calm ? 0 : 0.85, ease: [0.45, 0, 0.2, 1] as const }
    const ax = animate(x, to.x, opts)
    const ay = animate(y, to.y, opts)
    const id = window.setTimeout(() => setOnTarget(scene.cursor !== 'rest'), 0)
    return () => {
      ax.stop()
      ay.stop()
      window.clearTimeout(id)
    }
  }, [root, scene.cursor, design.w, rest, x, y, calm])

  if (touch) {
    return (
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-50"
        style={{ x, y }}
        animate={{ opacity: visible && onTarget ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="absolute -left-[18px] -top-[18px] size-9 rounded-full border-2 border-white/90 bg-[#1D4ED8]/25 shadow-[0_4px_14px_rgba(15,23,41,0.25)]" />
        {scene.click > 0 && (
          <motion.span
            key={scene.click}
            className="absolute -left-[18px] -top-[18px] size-9 rounded-full bg-[#1D4ED8]/30"
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{ x, y }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.3 }}
    >
      {scene.click > 0 && (
        <motion.span
          key={scene.click}
          className="absolute -left-4 -top-4 size-8 rounded-full border-2 border-[#1D4ED8]"
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      )}
      <motion.svg
        key={`press-${scene.click}`}
        width="26"
        height="26"
        viewBox="0 0 24 24"
        className="-ml-[3px] -mt-[2px] drop-shadow-[0_4px_6px_rgba(15,23,41,0.35)]"
        initial={{ scale: scene.click > 0 ? 0.82 : 1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        <path
          d="M4.5 2.8v16.9l4.6-4.4 2.9 6.6 2.7-1.2-2.9-6.5h6.4L4.5 2.8z"
          fill="#0f1729"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  )
}

/* ─── Chapters under the panel ─────────────────────────────────────────────── */
function Chapters({
  step,
  progress,
  running,
  desktop,
  onPick,
  onToggle,
  control,
}: {
  step: number
  progress: MotionValue<number>
  running: boolean
  desktop: boolean
  onPick: (i: number) => void
  onToggle: () => void
  control: 'live' | 'paused' | 'exploring'
}) {
  return (
    <div className="mt-7 flex flex-col items-center gap-4 text-center sm:mt-8">
      <div className="relative min-h-[52px] w-full max-w-[760px] sm:min-h-[30px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
            transition={{ duration: 0.4, ease: EASE }}
            className="text-[16px] font-semibold leading-snug text-white [text-wrap:balance] sm:text-[19px]"
          >
            {STEPS[step].caption}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label="Demo chapters"
          className="flex flex-wrap justify-center gap-1.5"
        >
          {STEPS.map((s, i) => {
            const on = i === step
            return (
              <button
                key={s.label}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={`${i + 1}. ${s.label}`}
                onClick={() => onPick(i)}
                className={`relative flex h-8 cursor-pointer items-center gap-1.5 overflow-hidden rounded-full border px-3 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60 ${
                  on
                    ? 'border-white bg-white text-[#0B1433]'
                    : 'border-white/20 bg-white/[0.08] text-white/75 hover:bg-white/15 hover:text-white'
                }`}
              >
                <span className="text-[10.5px] opacity-60" style={MONO}>
                  0{i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
                {on && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[#2B59E0]"
                    style={{ scaleX: running ? progress : 1 }}
                  />
                )}
              </button>
            )
          })}
        </div>
        {!desktop && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={control === 'live' ? 'Pause the demo' : 'Play the demo'}
            className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {control === 'live' ? (
              <Pause className="size-3.5" strokeWidth={2.4} />
            ) : (
              <Play className="size-3.5" strokeWidth={2.4} />
            )}
          </button>
        )}
      </div>
      <p className="text-[12px] text-white/55">
        {desktop ? 'Hover the dashboard to take over.' : 'Tap the dashboard to take over.'}
      </p>
    </div>
  )
}

/* ─── Desktop app ──────────────────────────────────────────────────────────── */
function DesktopApp() {
  const { scene } = useDash()
  return (
    <div
      className="absolute inset-0 flex text-left"
      style={{ background: BG, color: TEXT, fontFamily: FONT_SANS }}
    >
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="relative min-h-0 flex-1">
          <ScrollArea anchor={scene.anchor}>
            <div className="px-6 pb-6 pt-[22px]">
              <Greeting />
              <MarketPulse />
              <div data-anchor="kpis" className="mb-4 grid grid-cols-4 gap-4">
                <KpiCards />
              </div>
              <div
                data-anchor="chart"
                className="mb-4 grid grid-cols-[minmax(0,1fr)_332px] items-start gap-4"
              >
                <PipelineChart vw={780} vh={236} />
                <CalendarCard />
              </div>
              <div
                data-anchor="funnel"
                className="grid grid-cols-[minmax(0,1fr)_332px] items-stretch gap-4"
              >
                <FunnelCard />
                <SourcesCard />
              </div>
            </div>
          </ScrollArea>
          <div className="pointer-events-none absolute bottom-5 right-5 z-20 w-[330px]">
            <AnimatePresence>{scene.toast && <LeadToast key="toast" />}</AnimatePresence>
          </div>
          {/* bottom-left, so the site visit landing in the calendar stays in view */}
          <div className="pointer-events-none absolute bottom-5 left-6 z-20 w-[330px]">
            <AnimatePresence>{scene.call !== 'idle' && <Dialer key="dialer" />}</AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function Sidebar() {
  const { logoSrc } = useDash()
  return (
    <aside className="relative z-30 flex w-[60px] shrink-0 flex-col border-r border-[rgba(0,41,102,0.08)] bg-white">
      <div className="flex h-14 items-center justify-center border-b border-[rgba(0,41,102,0.08)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" className="size-[30px] object-contain" />
      </div>
      <div className="mt-3 flex flex-col items-center gap-1.5" aria-hidden>
        {NAV.map(({ name, Icon, active }) => (
          <span
            key={name}
            className="group relative flex size-9 items-center justify-center border-l-2"
            style={
              active
                ? { background: 'rgba(0,56,168,0.08)', color: NAVY, borderLeftColor: NAVY }
                : { color: 'rgba(0,56,168,0.65)', borderLeftColor: 'transparent' }
            }
          >
            <Icon size={18} weight={active ? 'bold' : 'light'} />
            <span
              className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap px-2.5 py-1.5 text-[12px] text-white group-hover:block"
              style={{ background: NAVY, borderRadius: 2 }}
            >
              {name}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-auto flex flex-col items-center gap-3 border-t border-[rgba(0,41,102,0.08)] py-4">
        <Gear size={18} weight="light" color="rgba(0,56,168,0.65)" />
        <span className="flex size-8 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[11px] font-bold text-blue-600">
          R
        </span>
      </div>
    </aside>
  )
}

function TopBar() {
  const { scene } = useDash()
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-6">
      <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-800">Dashboard</h1>
      <div className="flex-1" />
      <div className="flex h-8 w-[200px] items-center gap-2 rounded-[8px] border border-slate-200 bg-slate-50 px-3">
        <MagnifyingGlass size={14} className="text-slate-400" />
        <span className="flex-1 text-[12px] text-slate-400">Search...</span>
        <kbd className="rounded-[4px] border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          ⌘K
        </kbd>
      </div>
      <span className="relative flex size-9 items-center justify-center text-slate-500">
        <Bell size={18} />
        <motion.span
          key={scene.notif}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className="absolute right-0 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold text-white"
          style={{ background: BLUE }}
        >
          {scene.notif}
        </motion.span>
      </span>
      <span className="flex items-center gap-1.5 py-1 pl-1 pr-2">
        <span className="flex size-7 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[11px] font-bold text-blue-600">
          R
        </span>
        <CaretDown size={12} className="text-slate-400" />
      </span>
    </header>
  )
}

function ScrollArea({ anchor, children }: { anchor: Anchor; children: ReactNode }) {
  const { calm } = useDash()
  const view = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const y = useMotionValue(0)
  useEffect(() => {
    const v = view.current
    const c = content.current
    if (!v || !c) return
    let target = 0
    const el = anchor === 'top' ? null : c.querySelector<HTMLElement>(`[data-anchor="${anchor}"]`)
    if (el) {
      const vh = v.clientHeight
      const max = Math.max(0, c.offsetHeight - vh)
      const top = el.offsetTop
      const bottom = top + el.offsetHeight
      target = bottom - top > vh - 24 ? top - 12 : bottom + 20 - vh
      target = Math.min(max, Math.max(0, target))
      // Already (almost) in view: a tiny nudge reads as a glitch, so stay put.
      if (target < 48) target = 0
    }
    const a = animate(y, -target, { duration: calm ? 0 : 0.9, ease: EASE })
    return () => a.stop()
  }, [anchor, calm, y])
  return (
    <div ref={view} className="absolute inset-0 overflow-hidden">
      <motion.div ref={content} className="relative" style={{ y }}>
        {children}
      </motion.div>
    </div>
  )
}

/* ─── Widgets (shared by desktop and phone) ────────────────────────────────── */
function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        background: PANEL,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(15,23,41,.04)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function CardTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div>
      <div
        className="whitespace-nowrap text-[13px] font-semibold leading-none"
        style={{ color: TEXT }}
      >
        {children}
      </div>
      {sub && (
        <div className="mt-[5px] text-[11px]" style={{ color: MUTED }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  mono = false,
  compact = false,
  tourPrefix,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  mono?: boolean
  compact?: boolean
  tourPrefix: string
}) {
  return (
    <div className="flex gap-0.5 rounded-[9px] border border-[#e5e8f1] bg-[#f1f3f9] p-[3px]">
      {options.map(o => {
        const on = o === value
        return (
          <button
            key={o}
            type="button"
            data-tour={`${tourPrefix}-${o}`}
            onClick={() => onChange(o)}
            className={`relative cursor-pointer rounded-[7px] font-semibold outline-none ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-[5px] text-[10.5px]'}`}
            style={{ ...(mono ? MONO : {}), color: on ? TEXT : LABEL }}
          >
            {on && (
              <motion.span
                layoutId={`seg-${tourPrefix}`}
                className="absolute inset-0 rounded-[7px] bg-white shadow-[0_1px_3px_rgba(15,23,41,.1)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Counts up the first time it is seen, then eases between values. */
function Num({
  value,
  format = whole,
  className,
  style,
}: {
  value: number
  format?: (v: number) => string
  className?: string
  style?: CSSProperties
}) {
  const { calm } = useDash()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const mv = useMotionValue(0)
  const text = useTransform(mv, format)
  const prev = useRef<number | null>(null)
  useEffect(() => {
    if (!inView) return
    const from = prev.current
    prev.current = value
    if (calm || (from !== null && value < from)) {
      mv.set(value)
      return
    }
    const a = animate(mv, value, {
      duration: from === null ? 1.4 : 0.6,
      ease: EASE,
      delay: from === null ? 0.25 : 0,
    })
    return () => a.stop()
  }, [inView, value, calm, mv])
  return (
    <motion.span ref={ref} className={className} style={style}>
      {text}
    </motion.span>
  )
}

// Overdue hot leads; the tour's booked call clears one of them.
const dueHot = (sc: Scene) => (sc.booked ? 11 : 12)

function Greeting() {
  const { scene, userName, dateLabel } = useDash()
  return (
    <div className="mb-[18px] flex flex-wrap items-end gap-5">
      <div>
        <div
          className="mb-[7px] text-[10.5px] tracking-[0.1em]"
          style={{ ...MONO, color: '#7c8499' }}
        >
          {dateLabel}
        </div>
        <h2
          className="m-0 text-[26px] font-bold leading-[1.15] tracking-[-0.8px]"
          style={{ color: TEXT }}
        >
          Good morning, {userName}
        </h2>
        <p className="mt-1.5 text-[12.5px]" style={{ color: MUTED }}>
          {dueHot(scene)} hot leads need follow-up · 7 deals closed
        </p>
      </div>
      <div className="flex-1" />
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-[7px] rounded-[10px] px-[13px] py-[7px]"
          style={{ background: BLUE_DIM, border: '1px solid rgba(29,78,216,.25)' }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: BLUE, boxShadow: '0 0 0 2.5px rgba(29,78,216,.25)' }}
          />
          <span className="whitespace-nowrap text-[11.5px] font-semibold" style={{ color: BLUE }}>
            {dueHot(scene)} hot leads need follow-up
          </span>
        </div>
        <PriorityLead />
      </div>
    </div>
  )
}

function PriorityLead({ wide = false }: { wide?: boolean }) {
  const { scene, startCall } = useDash()
  const busy = scene.call !== 'idle'
  return (
    <div
      className={`flex items-center gap-[9px] rounded-[10px] px-3 py-2 ${wide ? 'w-full' : ''}`}
      style={{
        background: PANEL,
        border: `1px solid ${BORDER}`,
        boxShadow: '0 1px 2px rgba(15,23,41,.04)',
      }}
    >
      <span className="size-[7px] rounded-full" style={{ background: AMBER }} />
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-semibold" style={{ color: TEXT }}>
          Priya Sharma
        </div>
        <div className="text-[10px]" style={{ ...MONO, color: LABEL }}>
          95 score · ₹2.0 Cr
        </div>
      </div>
      <button
        type="button"
        data-tour="call-btn"
        onClick={startCall}
        disabled={busy}
        className="ml-1 cursor-pointer rounded-[7px] px-1.5 py-1 text-[10.5px] font-semibold outline-none transition-colors hover:bg-[rgba(29,78,216,0.08)] disabled:cursor-default"
        style={{ color: busy ? EMERALD : BLUE }}
      >
        {busy ? 'On call' : 'Call →'}
      </button>
    </div>
  )
}

function MarketPulse({ compact = false }: { compact?: boolean }) {
  const { scene, patch } = useDash()
  const i = ((scene.pulse % PULSE.length) + PULSE.length) % PULSE.length
  return (
    <div
      className={`flex items-center overflow-hidden rounded-[12px] text-white ${compact ? 'gap-3 px-3 py-2.5' : 'mb-[18px] gap-4 px-4 py-[13px]'}`}
      style={{ background: 'linear-gradient(90deg,#101832 0%,#1a2447 55%,#20305e 100%)' }}
    >
      <div className="flex shrink-0 items-center gap-[7px]">
        <span
          className="size-1.5 rounded-full motion-safe:animate-pulse"
          style={{ background: RED_C }}
        />
        <span className="text-[10px] font-bold tracking-[0.12em]" style={MONO}>
          {compact ? 'PULSE' : 'MARKET PULSE'}
        </span>
        {!compact && (
          <>
            <span className="text-[10px]" style={{ ...MONO, color: '#8b94b3' }}>
              09:41 am
            </span>
            <Newspaper size={10} weight="light" color="#8b94b3" />
          </>
        )}
      </div>
      {!compact && <div className="h-5 w-px shrink-0 bg-white/15" />}
      <div className={`relative min-w-0 flex-1 overflow-hidden ${compact ? 'h-7' : 'h-[18px]'}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={i}
            initial={{ y: compact ? 28 : 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: compact ? -28 : -18, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className={`absolute inset-0 font-medium ${compact ? 'line-clamp-2 text-[10.5px] leading-[14px]' : 'truncate text-[12.5px]'}`}
          >
            {PULSE[i]}
          </motion.span>
        </AnimatePresence>
      </div>
      {!compact && (
        <div className="flex shrink-0 items-center gap-1.5">
          {[-1, 1].map(d => (
            <button
              key={d}
              type="button"
              aria-label={d < 0 ? 'Previous headline' : 'Next headline'}
              onClick={() => patch({ pulse: scene.pulse + d })}
              className="grid size-[26px] cursor-pointer place-items-center rounded-[7px] border border-white/20 bg-white/[0.06] text-white outline-none hover:bg-white/15"
            >
              {d < 0 ? <CaretLeft size={10} /> : <CaretRight size={10} />}
            </button>
          ))}
          <span
            className="min-w-[28px] text-center text-[10px]"
            style={{ ...MONO, color: '#8b94b3' }}
          >
            {i + 1}/{PULSE.length}
          </span>
        </div>
      )}
    </div>
  )
}

function KpiCards({ compact = false }: { compact?: boolean }) {
  const { scene, shown, calm } = useDash()
  const spark = [11, 14, 12, 17, 15, 19, 18]
  const hotBars = [5, 7, 6, 9, 8, 11, 7]
  const sMax = Math.max(...spark)
  const sMin = Math.min(...spark)
  const pts = spark
    .map(
      (v, i) =>
        `${((i / 6) * 120).toFixed(1)},${(24 - ((v - sMin) / (sMax - sMin)) * 20 - 2).toFixed(1)}`
    )
    .join(' ')
  const grow = (d: number) => ({ duration: calm ? 0 : 0.9, ease: EASE, delay: calm ? 0 : d })
  return (
    <>
      <Kpi
        i={0}
        compact={compact}
        value={<Num value={scene.leads} />}
        title="Total leads"
        badge={`+${scene.week} wk`}
        badgeColor={MUTED}
        badgeBg="#f1f3f9"
        accentBg="#dbeafe"
        icon={<Users size={compact ? 13 : 16} weight="bold" color={BLUE} />}
      >
        <svg viewBox="0 0 120 24" preserveAspectRatio="none" className="mt-3 block h-6 w-full">
          <motion.polyline
            points={pts}
            fill="none"
            stroke={BLUE}
            strokeWidth="1.8"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: shown ? 1 : 0 }}
            transition={grow(0.4)}
          />
        </svg>
      </Kpi>
      <Kpi
        i={1}
        compact={compact}
        value={<Num value={scene.hot} />}
        title="Hot leads"
        sub=" · intent 70+"
        badge="High priority"
        badgeColor="#b45309"
        badgeBg="#fef3c7"
        accentBg="#fff0e4"
        icon={<Fire size={compact ? 13 : 16} weight="fill" color={AMBER} />}
      >
        <div className="mt-3 flex h-6 items-end gap-[3px]">
          {hotBars.map((v, k) => (
            <motion.span
              key={k}
              className="flex-1 origin-bottom rounded-[2px]"
              style={{
                height: `${Math.max((v / 11) * 100, 12)}%`,
                background: AMBER,
                opacity: 0.7 + (v / 11) * 0.3,
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: shown ? 1 : 0 }}
              transition={grow(0.4 + k * 0.05)}
            />
          ))}
        </div>
      </Kpi>
      <Kpi
        i={2}
        compact={compact}
        dark
        value={<Num value={227.8} format={crore} />}
        title="Pipeline value"
        sub=" · combined budgets"
        badge="active"
        badgeColor="#6ee7b7"
        badgeBg="rgba(16,185,129,.16)"
      >
        <div className="mt-3.5 flex h-6 items-center gap-[7px]">
          <div className="h-[5px] flex-1 overflow-hidden rounded-[5px] bg-white/[0.14]">
            <motion.div
              className="h-full origin-left rounded-[5px]"
              style={{ width: '74%', background: 'linear-gradient(90deg,#6ee7b7,#3b5cff)' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: shown ? 1 : 0 }}
              transition={grow(0.5)}
            />
          </div>
          {!compact && (
            <span className="text-[10px]" style={{ ...MONO, color: '#a8b1cc' }}>
              74% weighted
            </span>
          )}
        </div>
      </Kpi>
      <Kpi
        i={3}
        compact={compact}
        value={<Num value={7} />}
        title="Deals closed"
        sub=" · this month"
        badge="+7 won"
        badgeColor="#047857"
        badgeBg="#e2fbef"
        accentBg="#e2fbef"
        icon={<Trophy size={compact ? 13 : 16} weight="fill" color={EMERALD} />}
      >
        <div className="mt-3 flex h-6 items-center gap-1">
          {Array.from({ length: 10 }, (_, k) => (
            <motion.span
              key={k}
              className="size-2 rounded-full"
              style={{ background: k < 7 ? EMERALD : '#e5e8f1' }}
              initial={{ scale: 0 }}
              animate={{ scale: shown ? 1 : 0 }}
              transition={grow(0.4 + k * 0.05)}
            />
          ))}
        </div>
      </Kpi>
    </>
  )
}

function Kpi({
  i,
  value,
  title,
  sub,
  badge,
  badgeColor,
  badgeBg,
  accentBg,
  icon,
  dark = false,
  compact = false,
  children,
}: {
  i: number
  icon?: ReactNode
  value: ReactNode
  title: string
  sub?: string
  badge?: string
  badgeColor?: string
  badgeBg?: string
  accentBg?: string
  dark?: boolean
  compact?: boolean
  children?: ReactNode
}) {
  const { scene } = useDash()
  const focus = scene.kpi === i
  return (
    <motion.div
      data-tour={`kpi-${i}`}
      animate={{
        y: focus ? -4 : 0,
        boxShadow: focus
          ? '0 18px 36px -18px rgba(29,78,216,0.45)'
          : '0 1px 2px rgba(15,23,41,.04)',
      }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`relative overflow-hidden ${compact ? 'p-3' : 'p-4'}`}
      style={{
        background: dark ? 'linear-gradient(150deg,#101832 0%,#1c2750 100%)' : PANEL,
        border: dark ? 'none' : `1px solid ${focus ? '#c6d3f5' : BORDER}`,
        borderRadius: 16,
      }}
    >
      {dark && (
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-[140px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(29,78,216,.55),transparent 70%)' }}
        />
      )}
      <div className="relative flex items-center justify-between">
        <div
          className={`grid place-items-center rounded-[9px] ${compact ? 'size-6' : 'size-8'}`}
          style={{ background: dark ? 'rgba(255,255,255,0.08)' : accentBg }}
        >
          {dark ? (
            <span
              className={`font-semibold ${compact ? 'text-[12px]' : 'text-[14px]'}`}
              style={{ ...MONO, color: '#a8b1cc' }}
            >
              ₹
            </span>
          ) : (
            icon
          )}
        </div>
        {badge && !compact && (
          <span
            className="rounded-full px-[7px] py-1 text-[10px] font-semibold"
            style={{ color: badgeColor, background: badgeBg }}
          >
            {badge}
          </span>
        )}
      </div>
      <div
        className={`relative font-bold leading-none ${compact ? 'mt-2.5 text-[20px] tracking-[-0.6px]' : 'mt-3.5 text-[26px] tracking-[-0.8px]'}`}
        style={{ color: dark ? '#fff' : TEXT }}
      >
        {value}
      </div>
      <div
        className="relative mt-[5px] truncate text-[11.5px] font-medium"
        style={{ color: dark ? '#a8b1cc' : MUTED }}
      >
        {title}
        {sub && !compact && (
          <span style={{ color: dark ? '#7f89a8' : LABEL, fontWeight: 400 }}>{sub}</span>
        )}
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  )
}

function smooth(pts: { x: number; y: number }[]) {
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function PipelineChart({ vw, vh, compact = false }: { vw: number; vh: number; compact?: boolean }) {
  const { scene, patch, shown, calm } = useDash()
  const { labels, vals, vs } = SERIES[scene.range]
  const total = vals.reduce((s, v) => s + v, 0)
  const hi = Math.min(scene.hover, vals.length - 1)
  const padX = 14
  const bot = vh - 36
  const top = 16
  const max = Math.max(...vals) * 1.08
  const min = Math.min(...vals) * 0.7
  const step = (vw - padX * 2) / (vals.length - 1)
  const yOf = (v: number) => bot - ((v - min) / (max - min)) * (bot - top)
  const pts = vals.map((v, i) => ({ x: padX + i * step, y: yOf(v) }))
  const fpts = vals.map((v, i) => ({
    x: padX + i * step,
    y: yOf(v * 0.93 * (1 + (i - vals.length / 2) * 0.012)),
  }))
  const line = smooth(pts)
  const hp = pts[hi]
  // Near the right edge (and always on the phone) the tooltip sits beside the point,
  // clear of the range switch.
  const flip = compact || hp.x > vw * 0.88
  const leftSide = hp.x > vw * 0.5
  const showLabel = (i: number) => !compact || vals.length <= 7 || i % 2 === 1
  const gradId = compact ? 'hd-area-m' : 'hd-area'

  return (
    <Card className={compact ? 'px-3.5 pb-2.5 pt-3.5' : 'px-5 pb-3 pt-[18px]'}>
      <div className="flex items-start gap-3">
        <div>
          <CardTitle>Pipeline movement</CardTitle>
          <div className="mt-2.5 flex items-baseline gap-2 whitespace-nowrap">
            <Num
              value={total}
              format={crore}
              className={`font-bold tracking-[-0.6px] ${compact ? 'text-[18px]' : 'text-[22px]'}`}
              style={{ color: TEXT }}
            />
            <span className="text-[11px] font-semibold" style={{ color: EMERALD }}>
              +22%
            </span>
            {!compact && (
              <span className="text-[11px]" style={{ color: LABEL }}>
                vs prior {vs}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1" />
        <Segmented
          options={['1W', '1M', '6M', '1Y'] as Range[]}
          value={scene.range}
          onChange={r => patch({ range: r, hover: SERIES[r].vals.length - (r === '1Y' ? 3 : 1) })}
          mono
          tourPrefix="range"
          compact={compact}
        />
      </div>

      <div className="relative mt-3">
        <svg viewBox={`0 0 ${vw} ${vh}`} className="block h-auto w-full overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={BLUE} stopOpacity=".22" />
              <stop offset="1" stopColor={BLUE} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g stroke="#eef0f6" strokeWidth="1">
            {[0, 1, 2, 3].map(k => (
              <line
                key={k}
                x1="0"
                x2={vw}
                y1={top + ((bot - top) / 3) * k}
                y2={top + ((bot - top) / 3) * k}
              />
            ))}
          </g>
          <motion.path
            key={`a-${scene.range}`}
            d={`${line} L${pts[pts.length - 1].x},${bot} L${pts[0].x},${bot} Z`}
            fill={`url(#${gradId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: shown ? 1 : 0 }}
            transition={{ duration: calm ? 0 : 0.8, delay: calm ? 0 : 0.5 }}
          />
          <motion.path
            key={`f-${scene.range}`}
            d={smooth(fpts)}
            fill="none"
            stroke="#c8d0e8"
            strokeWidth="1.8"
            strokeDasharray="5 5"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: shown ? 1 : 0 }}
            transition={{ duration: calm ? 0 : 0.8, delay: calm ? 0 : 0.7 }}
          />
          <motion.path
            key={`l-${scene.range}`}
            d={line}
            fill="none"
            stroke={BLUE}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: shown ? 1 : 0 }}
            transition={{ duration: calm ? 0 : 1.1, ease: EASE }}
          />
          <motion.line
            y1="0"
            y2={bot}
            stroke={BLUE}
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity=".4"
            initial={false}
            animate={{ x1: hp.x, x2: hp.x }}
            transition={{ duration: calm ? 0 : 0.35, ease: EASE }}
          />
          <motion.circle
            r="5.5"
            fill="#fff"
            stroke={BLUE}
            strokeWidth="2.5"
            initial={false}
            animate={{ cx: hp.x, cy: hp.y }}
            transition={{ duration: calm ? 0 : 0.35, ease: EASE }}
          />
          {pts.map((p, i) => (
            <g key={i}>
              <rect
                x={p.x - step / 2}
                y="0"
                width={step}
                height={bot}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={() => patch({ hover: i })}
              />
              <circle data-tour={`pt-${i}`} cx={p.x} cy={p.y} r="1" fill="transparent" />
              {showLabel(i) && (
                <text
                  x={p.x}
                  y={vh - 12}
                  textAnchor="middle"
                  fill={i === hi ? TEXT : LABEL}
                  style={{ font: `500 10px ${FONT_MONO}` }}
                >
                  {labels[i]}
                </text>
              )}
            </g>
          ))}
        </svg>
        <motion.div
          className={`pointer-events-none absolute rounded-[10px] text-white shadow-[0_8px_24px_rgba(15,23,41,.28)] ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
          style={{ background: '#0f1729' }}
          initial={false}
          animate={{
            left: `${(hp.x / vw) * 100}%`,
            top: `${(Math.max(hp.y, flip ? 34 : 0) / vh) * 100}%`,
            x: flip ? (leftSide ? '-112%' : '12%') : '-50%',
            y: flip ? '-50%' : '-118%',
          }}
          transition={{ duration: calm ? 0 : 0.35, ease: EASE }}
        >
          <div className="text-[9.5px] tracking-[0.06em]" style={{ ...MONO, color: '#8b94b3' }}>
            {labels[hi].toUpperCase()}
          </div>
          <div
            className={`mt-1 whitespace-nowrap font-bold ${compact ? 'text-[12.5px]' : 'text-[14px]'}`}
          >
            {crore(vals[hi])}
          </div>
          {!compact && (
            <div className="mt-1 whitespace-nowrap text-[9.5px] text-[#6ee7b7]">trending up</div>
          )}
        </motion.div>
      </div>

      {!compact && (
        <div className="mt-1 flex items-center gap-4 border-t border-[#eef0f6] pt-3">
          {[
            { label: 'Created pipeline', color: BLUE },
            { label: 'Forecast', color: '#c8d0e8' },
          ].map(l => (
            <div
              key={l.label}
              className="flex items-center gap-1.5 text-[10.5px] font-medium"
              style={{ color: MUTED }}
            >
              <span
                className="block h-[2.5px] w-3.5 rounded-[2px]"
                style={{ background: l.color }}
              />
              {l.label}
            </div>
          ))}
          <div className="flex-1" />
          <span className="text-[10.5px] font-semibold" style={{ color: BLUE }}>
            Open report →
          </span>
        </div>
      )}
    </Card>
  )
}

function CalendarCard() {
  const { scene, patch, week } = useDash()
  const todayIdx = week.findIndex(d => d.today)
  const sel = scene.day < 0 ? todayIdx : scene.day
  const isToday = sel === todayIdx
  const events = isToday
    ? TODAY_EVENTS.map(e => (e.free && scene.booked ? BOOKED_EVENT : e))
    : OTHER_EVENTS
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <CardTitle>Calendar</CardTitle>
        <span
          className="flex items-center gap-1.5 rounded-[8px] border bg-white px-2.5 py-[5px] text-[11px] font-medium"
          style={{ borderColor: BORDER, color: '#3c4459' }}
        >
          This week{' '}
          <span className="text-[9px]" style={{ color: LABEL }}>
            ▾
          </span>
        </span>
      </div>
      <div className="flex gap-0.5 border-b border-[#eef0f6] pb-1.5">
        {week.map((d, i) => {
          const on = i === sel
          return (
            <button
              key={i}
              type="button"
              onClick={() => patch({ day: i === todayIdx ? -1 : i })}
              className="flex flex-1 cursor-pointer flex-col items-center gap-[5px] rounded-[6px] pt-1 outline-none"
            >
              <span className="text-[9.5px] font-medium" style={{ color: LABEL }}>
                {d.dow}
              </span>
              <span
                className="text-[12.5px]"
                style={{ fontWeight: on ? 700 : 500, color: on ? TEXT : LABEL }}
              >
                {d.n}
              </span>
              <span
                className="block h-0.5 w-[18px] rounded-[1px]"
                style={{ background: on ? BLUE : 'transparent' }}
              />
            </button>
          )
        })}
      </div>
      <div className="flex flex-col">
        {events.map((e, i) => (
          <div
            key={`${sel}-${i}-${e.title ?? 'free'}`}
            className="flex items-stretch gap-2.5"
            style={{ minHeight: e.free ? 44 : e.people ? 94 : 60 }}
          >
            <div className="w-[38px] shrink-0 pt-0.5 text-[10px]" style={{ color: LABEL }}>
              {e.hour}
            </div>
            <div className="min-w-0 flex-1 pb-1.5">
              {e.free ? (
                <div className="flex h-full items-center rounded-[9px] border border-dashed border-[#e2e6f2] px-2.5 text-[10.5px] font-medium text-[#a8afc2]">
                  Available · book slot
                </div>
              ) : (
                <motion.div
                  data-tour={e.booked ? 'cal-booked' : undefined}
                  initial={
                    e.booked ? { opacity: 0, scale: 0.94, backgroundColor: '#fff7e6' } : false
                  }
                  animate={{ opacity: 1, scale: 1, backgroundColor: '#fbfcfe' }}
                  transition={{ duration: 0.5, ease: EASE, backgroundColor: { duration: 2.4 } }}
                  className="rounded-[9px] border border-[#e8ebf4] px-[11px] py-[9px]"
                  style={{ borderLeft: `2.5px solid ${e.tone ?? BLUE}` }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="block size-1.5 shrink-0 rounded-full"
                      style={{ background: e.tone ?? BLUE }}
                    />
                    <span
                      className="flex-1 truncate text-[11.5px] font-semibold"
                      style={{ color: TEXT }}
                    >
                      {e.title}
                    </span>
                    {e.booked && (
                      <span className="rounded-full bg-[#e2fbef] px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.04em] text-[#047857]">
                        New
                      </span>
                    )}
                  </div>
                  {e.range && (
                    <div
                      className="mt-[5px] pl-3 text-[10px]"
                      style={{ ...MONO, color: '#7c8499' }}
                    >
                      {e.range}
                    </div>
                  )}
                  {e.people && (
                    <div className="mt-2 flex items-center gap-[7px] pl-3">
                      <div className="flex">
                        {e.people.map((p, pi) => (
                          <span
                            key={p}
                            className="grid size-[22px] place-items-center rounded-full border-2 border-white text-[8.5px] font-bold text-[#3c4459]"
                            style={{
                              background: ['#e3e9fb', '#fdeacd', '#e7e2fb'][pi % 3],
                              marginLeft: pi ? -7 : 0,
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                      <div className="flex-1" />
                      <span
                        className="whitespace-nowrap rounded-[7px] border bg-white px-2 py-1 text-[10px] font-semibold text-[#3c4459]"
                        style={{ borderColor: BORDER }}
                      >
                        {e.action} ›
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function FunnelCard({ compact = false }: { compact?: boolean }) {
  const { scene, patch, shown, calm } = useDash()
  const rows = FUNNEL[scene.funnel]
  const max = Math.max(...rows.map(r => r.count))
  const total = rows.reduce((s, r) => s + r.count, 0)
  const barH = compact ? 22 : 30
  return (
    <Card className={compact ? 'p-3.5' : 'px-5 py-[18px]'}>
      <div className="flex items-center gap-3">
        <CardTitle>Pipeline funnel</CardTitle>
        <div className="flex-1" />
        <Segmented
          options={['Status', 'Source', 'Budget'] as FunnelTab[]}
          value={scene.funnel}
          onChange={t => patch({ funnel: t })}
          tourPrefix="funnel"
          compact={compact}
        />
      </div>
      <div className="mt-[5px] text-[11px]" style={{ color: MUTED }}>
        {total} leads across{' '}
        {scene.funnel === 'Status' ? 'stages' : scene.funnel === 'Source' ? 'sources' : 'budgets'}
      </div>
      <div className={`flex flex-col ${compact ? 'mt-3 gap-[7px]' : 'mt-4 gap-[9px]'}`}>
        {rows.map((r, i) => {
          const w = Math.max(12, (r.count / max) * 100)
          const inside = w > 42
          return (
            <div key={`${scene.funnel}-${r.name}`} className="flex items-center gap-3">
              <div
                className={`shrink-0 truncate font-medium text-[#3c4459] ${compact ? 'w-[74px] text-[10.5px]' : 'w-24 text-[11.5px]'}`}
              >
                {r.name}
              </div>
              <div
                className="relative flex-1 overflow-hidden rounded-[8px] bg-[#f4f5f9]"
                style={{ height: barH }}
              >
                <motion.div
                  className="h-full origin-left rounded-[8px]"
                  style={{
                    width: `${w}%`,
                    background: `linear-gradient(90deg,${r.color},${r.color}cc)`,
                  }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: shown ? 1 : 0 }}
                  transition={{ duration: calm ? 0 : 0.7, ease: EASE, delay: calm ? 0 : 0.08 * i }}
                />
                {!compact && (
                  <span
                    className="absolute top-0 flex items-center text-[10px]"
                    style={{
                      ...MONO,
                      height: barH,
                      left: inside ? 0 : `calc(${w}% + 10px)`,
                      width: inside ? `${w}%` : undefined,
                      justifyContent: inside ? 'flex-end' : 'flex-start',
                      paddingRight: inside ? 10 : 0,
                      color: inside ? 'rgba(255,255,255,.9)' : '#7c8499',
                    }}
                  >
                    {crore(r.cr)}
                  </span>
                )}
              </div>
              <div
                className={`shrink-0 text-right font-semibold ${compact ? 'w-6 text-[11px]' : 'w-10 text-[12px]'}`}
                style={{ color: TEXT }}
              >
                {r.count}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function SourcesCard({ compact = false }: { compact?: boolean }) {
  const { scene, patch, shown, calm } = useDash()
  const arcs = SOURCE_ARCS
  const hi = scene.slice
  const focus = hi >= 0 ? SOURCES[hi] : null
  return (
    <Card className={`flex flex-col gap-3 ${compact ? 'p-3.5' : 'p-4'}`}>
      <CardTitle>Lead sources</CardTitle>
      <div className="flex items-center gap-3.5">
        <div
          className="relative shrink-0"
          style={{ width: compact ? 92 : 104, height: compact ? 92 : 104 }}
        >
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r={DONUT_R} fill="none" stroke="#f1f3f9" strokeWidth="16" />
            {arcs.map((a, i) => (
              <motion.circle
                key={a.name}
                cx="50"
                cy="50"
                r={DONUT_R}
                fill="none"
                stroke={a.color}
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
                initial={{ opacity: 0, strokeWidth: 16 }}
                animate={{
                  opacity: shown ? (hi < 0 || hi === i ? 1 : 0.28) : 0,
                  strokeWidth: hi === i ? 19 : 16,
                }}
                transition={{
                  duration: calm ? 0 : 0.45,
                  delay: calm || !shown ? 0 : hi >= 0 ? 0 : 0.15 * i,
                }}
                onMouseEnter={() => patch({ slice: i })}
                onMouseLeave={() => patch({ slice: -1 })}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
            <span className="text-[15px] font-bold" style={{ color: TEXT }}>
              {focus ? `${focus.pct}%` : '106'}
            </span>
            <span
              className="mt-1 text-[8.5px] uppercase tracking-[0.08em]"
              style={{ ...MONO, color: LABEL }}
            >
              {focus ? 'of leads' : 'leads'}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-[7px]">
          {arcs.map((a, i) => (
            <div
              key={a.name}
              data-tour={`slice-${i}`}
              onMouseEnter={() => patch({ slice: i })}
              onMouseLeave={() => patch({ slice: -1 })}
              className="flex cursor-pointer items-center gap-2 rounded-[6px] px-1 py-0.5 transition-colors"
              style={{ background: hi === i ? '#f3f5fb' : 'transparent' }}
            >
              <span
                className="block size-2 shrink-0 rounded-[2px]"
                style={{ background: a.color }}
              />
              <span className="flex-1 truncate text-[11.5px] font-medium text-[#3c4459]">
                {a.name}
              </span>
              <span className="text-[11px] font-semibold" style={{ ...MONO, color: TEXT }}>
                {a.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
      {!compact && (
        <div
          className="border-t border-[#eef0f6] pt-3 text-[10.5px] leading-normal"
          style={{ color: MUTED }}
        >
          Housing.com leads book the most site visits this month.
        </div>
      )}
    </Card>
  )
}

function LeadToast({ push = false }: { push?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: push ? -24 : 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: push ? -16 : 16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={`pointer-events-auto w-full ${push ? 'rounded-[18px] bg-white/95 p-3 shadow-[0_18px_40px_-12px_rgba(15,23,41,0.45)] backdrop-blur' : 'rounded-[14px] border bg-white p-3.5 shadow-[0_24px_48px_-20px_rgba(15,23,41,0.45)]'}`}
      style={push ? undefined : { borderColor: BORDER }}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid size-6 place-items-center rounded-[7px] text-white"
          style={{ background: BLUE }}
        >
          <Bell size={13} weight="bold" />
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ ...MONO, color: MUTED }}
        >
          New lead · Housing.com
        </span>
        <span className="ml-auto text-[10px]" style={{ color: LABEL }}>
          now
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-[9px] text-[11px] font-bold"
          style={{ background: '#ede9fe', color: '#6D28D9' }}
        >
          SK
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold" style={{ color: TEXT }}>
            Sneha Kapoor
          </div>
          <div className="truncate text-[10.5px]" style={{ ...MONO, color: LABEL }}>
            3BHK · Baner · ₹1.4 Cr
          </div>
        </div>
        <span
          data-tour="toast-score"
          className="flex shrink-0 flex-col items-center rounded-[9px] px-2 py-1"
          style={{ background: 'rgba(244,63,94,0.08)' }}
        >
          <span className="text-[15px] font-bold leading-none" style={{ ...MONO, color: RED_C }}>
            88
          </span>
          <span
            className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em]"
            style={{ color: RED_C }}
          >
            Hot
          </span>
        </span>
      </div>
      {!push && (
        <div className="mt-3 flex gap-2">
          <span
            className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[11px] font-semibold text-white"
            style={{ background: BLUE }}
          >
            <PhoneCall size={12} weight="bold" /> Call now
          </span>
          <span
            className="flex h-7 flex-1 items-center justify-center rounded-[8px] border text-[11px] font-semibold text-[#3c4459]"
            style={{ borderColor: BORDER }}
          >
            Assign to Vikas
          </span>
        </div>
      )}
    </motion.div>
  )
}

function Dialer({ sheet = false }: { sheet?: boolean }) {
  const { scene, endCall } = useDash()
  const state = scene.call
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`pointer-events-auto w-full overflow-hidden text-white shadow-[0_28px_60px_-20px_rgba(6,14,40,0.7)] ${sheet ? 'rounded-[20px] p-4' : 'rounded-[16px] p-3.5'}`}
      style={{ background: 'linear-gradient(150deg,#101832 0%,#1c2750 100%)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="relative grid size-10 shrink-0 place-items-center rounded-full text-[12px] font-bold"
          style={{ background: '#fef3c7', color: '#B45309' }}
        >
          {state === 'ringing' && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-[#fef3c7]"
              animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          PS
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold">Priya Sharma</div>
          <div className="truncate whitespace-nowrap text-[10.5px] text-[#a8b1cc]" style={MONO}>
            {state === 'ringing' ? (
              'Calling · +91 98•••••210'
            ) : state === 'live' ? (
              <CallTimer />
            ) : (
              'Call logged · 2:41'
            )}
          </div>
        </div>
        {state !== 'booked' && (
          <div className="flex gap-1.5">
            <span className="grid size-8 place-items-center rounded-full bg-white/10">
              <Microphone size={14} />
            </span>
            <button
              type="button"
              aria-label="End call"
              onClick={endCall}
              className="grid size-8 cursor-pointer place-items-center rounded-full outline-none"
              style={{ background: RED_C }}
            >
              <PhoneDisconnect size={14} weight="fill" />
            </button>
          </div>
        )}
      </div>
      {state === 'live' && (
        <div className="mt-3 flex h-6 items-center gap-[3px]">
          {Array.from({ length: 28 }, (_, i) => (
            <motion.span
              key={i}
              className="w-[3px] flex-1 rounded-full bg-[#6ee7b7]"
              animate={{ height: [4, 6 + ((i * 7) % 16), 4] }}
              transition={{
                duration: 0.9 + (i % 5) * 0.12,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: (i % 7) * 0.08,
              }}
            />
          ))}
        </div>
      )}
      {state === 'booked' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2.5 rounded-[11px] bg-[#10b981]/15 px-3 py-2.5"
        >
          <CheckCircle size={20} weight="fill" color="#6ee7b7" />
          <div className="min-w-0">
            <div className="text-[12px] font-bold">Site visit booked</div>
            <div className="text-[10.5px] text-[#a8b1cc]" style={MONO}>
              Today · 11:30 AM · follow-up set
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

function CallTimer() {
  const [s, setS] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setS(v => v + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <>On call · 00:{String(s).padStart(2, '0')}</>
}

/* ─── Phone app ────────────────────────────────────────────────────────────── */
function PhoneApp() {
  const { scene, userName, dateLabel, logoSrc } = useDash()
  return (
    <div className="absolute inset-0 rounded-[48px] bg-[#0B1433] p-[9px] shadow-[0_40px_90px_-30px_rgba(6,14,60,0.8)]">
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-[40px] text-left"
        style={{ background: BG, color: TEXT, fontFamily: FONT_SANS }}
      >
        {/* status bar */}
        <div className="relative flex h-[42px] shrink-0 items-end justify-between bg-white px-7 pb-1.5 text-[12px] font-semibold">
          <span>9:41</span>
          <span className="absolute left-1/2 top-2.5 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-[#0B1433]" />
          <span className="flex items-center gap-1">
            <span className="flex items-end gap-[2px]">
              {[4, 6, 8, 10].map(h => (
                <span
                  key={h}
                  className="w-[3px] rounded-[1px] bg-[#0f1729]"
                  style={{ height: h }}
                />
              ))}
            </span>
            <span className="ml-1 h-[10px] w-[20px] rounded-[3px] border border-[#0f1729] p-[1px]">
              <span className="block h-full w-3/4 rounded-[1px] bg-[#0f1729]" />
            </span>
          </span>
        </div>
        {/* app header */}
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-slate-200/80 bg-white px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" className="size-[26px] object-contain" />
          <span className="text-[14px] font-semibold text-slate-800">Dashboard</span>
          <span className="flex-1" />
          <span className="relative flex size-8 items-center justify-center text-slate-500">
            <Bell size={17} />
            <motion.span
              key={scene.notif}
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              className="absolute -right-0.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
              style={{ background: BLUE }}
            >
              {scene.notif}
            </motion.span>
          </span>
          <span className="flex size-7 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[11px] font-bold text-blue-600">
            R
          </span>
        </div>

        <div className="relative min-h-0 flex-1">
          <ScrollArea anchor={scene.anchor}>
            <div className="flex flex-col gap-3 p-3.5">
              <div>
                <div
                  className="mb-1.5 text-[9.5px] tracking-[0.1em]"
                  style={{ ...MONO, color: '#7c8499' }}
                >
                  {dateLabel}
                </div>
                <div className="text-[20px] font-bold leading-tight tracking-[-0.6px]">
                  Good morning, {userName}
                </div>
                <div className="mt-1 text-[11.5px]" style={{ color: MUTED }}>
                  {dueHot(scene)} hot leads need follow-up · 7 deals closed
                </div>
              </div>
              <PriorityLead wide />
              <MarketPulse compact />
              <div data-anchor="kpis" className="-mt-[18px] grid grid-cols-2 gap-2.5 pt-[18px]">
                <KpiCards compact />
              </div>
              <div data-anchor="chart">
                <PipelineChart vw={300} vh={160} compact />
              </div>
              <div data-anchor="funnel" className="flex flex-col gap-3">
                <FunnelCard compact />
                <SourcesCard compact />
              </div>
            </div>
          </ScrollArea>
          <div className="pointer-events-none absolute inset-x-2.5 top-2 z-20">
            <AnimatePresence>{scene.toast && <LeadToast key="push" push />}</AnimatePresence>
          </div>
          <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-20">
            <AnimatePresence>
              {scene.call !== 'idle' && <Dialer key="sheet" sheet />}
            </AnimatePresence>
          </div>
        </div>

        {/* tab bar */}
        <div
          aria-hidden
          className="flex h-[62px] shrink-0 items-start justify-around border-t border-slate-200/80 bg-white px-2 pt-2"
        >
          {TABS.map(({ name, Icon, active }) => (
            <span
              key={name}
              className="flex w-14 flex-col items-center gap-1"
              style={{ color: active ? NAVY : 'rgba(0,56,168,0.55)' }}
            >
              <Icon size={19} weight={active ? 'bold' : 'light'} />
              <span className="text-[9.5px] font-medium">{name}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
