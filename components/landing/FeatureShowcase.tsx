'use client'

/* ─────────────────────────────────────────────────────────────────────────────
 * FeatureShowcase · the dark "four capabilities" moment on the landing page
 *
 * The one dark block on a light page, so the scroll stops here. Four features
 * (AI Intent Score, AI Advisor, Bulk WhatsApp, Team Analytics) sit in a single
 * showcase card: a tab list and a big title on the left, a glowing blue art
 * panel on the right. Each art panel is a small animated scene built from the
 * same parts: a glossy centre tile, illustrated avatars in glass rings, chips
 * with real product values, and wires that carry light pulses into the tile.
 *
 * The card cycles on its own while it is on screen. Hovering or focusing the
 * card pauses it, the tabs (mouse, touch or arrow keys) switch features, and
 * the art panel tilts toward the pointer. Reduced motion: no auto cycle, no
 * loops, every scene shows its finished state.
 * Stack: React 19 · TypeScript · Tailwind CSS v4 · motion (motion/react) ·
 *        @phosphor-icons/react (WhatsApp mark) · lucide-react
 * Usage:  <FeatureShowcase />            (every prop is optional)
 * ──────────────────────────────────────────────────────────────────────────── */

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { WhatsappLogo } from '@phosphor-icons/react'
import { CheckCheck, Flame, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'

export type FeatureShowcaseProps = {
  /** Section id, for in-page links. */
  id?: string
  /** Milliseconds each feature stays up before the card moves on. */
  interval?: number
  className?: string
}

/* ─── Tokens ───────────────────────────────────────────────────────────────── */
const FONT_SANS =
  "var(--font-jakarta, 'Plus Jakarta Sans'), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
const FONT_MONO =
  "var(--font-geist-mono, 'Geist Mono'), 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const MONO: CSSProperties = { fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' }
const EASE = [0.22, 1, 0.36, 1] as const

const INK = '#04060E' // the dark block
const LILAC = '#B9C6FF' // glyphs, active tab
const PULSE = '#A9C1FF'

const STAGE = 420 // art scenes are drawn on a 420 × 420 stage, then scaled

/* ─── Content ──────────────────────────────────────────────────────────────── */
type Key = 'score' | 'advisor' | 'broadcast' | 'team'
const FEATURES: { key: Key; title: string; desc: string }[] = [
  {
    key: 'score',
    title: 'AI Intent Score',
    desc: 'Every lead scored 0 to 100 the moment it lands. No guesswork.',
  },
  {
    key: 'advisor',
    title: 'AI Advisor',
    desc: 'Ask who to call next. It reads your whole pipeline first.',
  },
  {
    key: 'broadcast',
    title: 'Bulk WhatsApp',
    desc: 'Personal follow-ups to your whole list in one send. Track every reply.',
  },
  {
    key: 'team',
    title: 'Team Analytics',
    desc: 'Every agent, every deal, week over week, in one live view.',
  },
]

/* ─── People ───────────────────────────────────────────────────────────────── */
type Hair = 'short' | 'long' | 'bun' | 'curly'
type Person = {
  name: string
  skin: string
  hair: string
  style: Hair
  shirt: string
  bg: string
  beard?: boolean
  glasses?: boolean
}
const P = {
  priyaD: {
    name: 'Priya Desai',
    skin: '#C98B63',
    hair: '#22150F',
    style: 'long',
    shirt: '#F59E0B',
    bg: '#FFE6C2',
  },
  rohan: {
    name: 'Rohan Mehta',
    skin: '#A56D4B',
    hair: '#17110E',
    style: 'short',
    shirt: '#10B981',
    bg: '#CDF5E4',
    beard: true,
  },
  rahul: {
    name: 'Rahul S.',
    skin: '#B97A55',
    hair: '#141016',
    style: 'short',
    shirt: '#2B59E0',
    bg: '#DCE6FF',
  },
  priyaM: {
    name: 'Priya M.',
    skin: '#D7A07A',
    hair: '#3A2215',
    style: 'bun',
    shirt: '#EC4899',
    bg: '#FFE0EF',
  },
  ananya: {
    name: 'Ananya R.',
    skin: '#E2AE8A',
    hair: '#4A2C1A',
    style: 'long',
    shirt: '#8B5CF6',
    bg: '#EAE2FF',
  },
  nikhil: {
    name: 'Nikhil K.',
    skin: '#8D593B',
    hair: '#0F0B0A',
    style: 'curly',
    shirt: '#0EA5E9',
    bg: '#D3EFFF',
    glasses: true,
  },
  sneha: {
    name: 'Sneha K.',
    skin: '#C88E6B',
    hair: '#1E120C',
    style: 'bun',
    shirt: '#14B8A6',
    bg: '#CFF7F1',
  },
  arjun: {
    name: 'Arjun P.',
    skin: '#9C6646',
    hair: '#1A1310',
    style: 'curly',
    shirt: '#F97316',
    bg: '#FFE4D2',
  },
  meera: {
    name: 'Meera J.',
    skin: '#B57A57',
    hair: '#2B1A12',
    style: 'long',
    shirt: '#6366F1',
    bg: '#E2E4FF',
    glasses: true,
  },
  vikram: {
    name: 'Vikram T.',
    skin: '#C08460',
    hair: '#231914',
    style: 'short',
    shirt: '#EF4444',
    bg: '#FFE0E0',
    beard: true,
  },
} satisfies Record<string, Person>

/* ─── Small helpers ────────────────────────────────────────────────────────── */
// Reduced motion, read on the client only so the server HTML always matches.
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

// A rAF clock that moves to the next feature; progress drives the tab rings.
function useCycle(count: number, dur: number, running: boolean) {
  const [index, setIndex] = useState(0)
  const progress = useMotionValue(0)
  const elapsed = useRef(0)
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      elapsed.current += Math.min(now - last, 100)
      last = now
      if (elapsed.current >= dur) {
        elapsed.current = 0
        progress.set(0)
        setIndex(i => (i + 1) % count)
      } else {
        progress.set(elapsed.current / dur)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, count, dur, progress])
  const pick = useCallback(
    (i: number) => {
      elapsed.current = 0
      progress.set(0)
      setIndex(i)
    },
    [progress]
  )
  return { index, progress, pick }
}

// Scenes read these: calm skips motion, live gates the looping pulses.
const SceneCtx = createContext({ calm: false, live: true })
const useScene = () => useContext(SceneCtx)

// Orthogonal wire with one rounded corner, like a circuit trace.
function elbow(ax: number, ay: number, bx: number, by: number, first: 'h' | 'v', r = 16) {
  const sx = Math.sign(bx - ax) || 1
  const sy = Math.sign(by - ay) || 1
  if (Math.abs(bx - ax) < r || Math.abs(by - ay) < r) return `M${ax} ${ay} L${bx} ${by}`
  return first === 'h'
    ? `M${ax} ${ay} H${bx - sx * r} Q${bx} ${ay} ${bx} ${ay + sy * r} V${by}`
    : `M${ax} ${ay} V${by - sy * r} Q${ax} ${by} ${ax + sx * r} ${by} H${bx}`
}

// Deterministic star field (no Math.random during render).
const STARS = Array.from({ length: 54 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  // Rounded, so the server's inline styles match what the browser reads back.
  const round = (v: number) => Math.round(v * 100) / 100
  return {
    x: round(r(1) * 100),
    y: round(r(2) * 100),
    s: r(3) < 0.82 ? 1 : 1.6,
    o: round(0.18 + r(4) * 0.5),
    twinkle: r(5) < 0.22,
    d: r(6) * 4,
  }
})

/* ─── Section ──────────────────────────────────────────────────────────────── */
export function FeatureShowcase({
  id = 'capabilities',
  interval = 7000,
  className = '',
}: FeatureShowcaseProps) {
  const uid = useId()
  const calm = useCalm()
  const cardRef = useRef<HTMLDivElement>(null)
  const inView = useInView(cardRef, { amount: 0.35 })
  const shown = useInView(cardRef, { once: true, amount: 0.35 })
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const running = inView && !hovering && !focused && !calm
  const { index, progress, pick } = useCycle(FEATURES.length, interval, running)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const f = FEATURES[index]

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const n =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? FEATURES.length - 1
          : (index + (step ?? 0) + FEATURES.length) % FEATURES.length
    pick(n)
    tabRefs.current[n]?.focus()
  }

  return (
    <MotionConfig reducedMotion="user">
      <section
        id={id}
        aria-labelledby={`${uid}-title`}
        className={`relative px-2 py-3 antialiased sm:px-4 sm:py-5 ${className}`}
        style={{ fontFamily: FONT_SANS, wordSpacing: '0.03em' }}
      >
        <div
          className="relative isolate overflow-hidden rounded-[28px] px-4 pb-10 pt-16 text-white sm:rounded-[40px] sm:px-8 sm:pb-16 sm:pt-24"
          style={{ background: INK }}
        >
          <Sky calm={calm} />

          {/* ── Header ── */}
          <div className="relative mx-auto max-w-3xl text-center">
            <motion.div
              {...rise(0)}
              className="flex items-center justify-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-[#8FAEFF]"
              style={MONO}
            >
              <span className="h-[2px] w-7 rounded-full bg-[#8FAEFF]/70" />
              Features
              <span className="h-[2px] w-7 rounded-full bg-[#8FAEFF]/70" />
            </motion.div>
            <h2
              id={`${uid}-title`}
              className="mt-5 text-[34px] font-extrabold leading-[1.06] tracking-[-0.035em] [text-wrap:balance] sm:text-[46px] lg:text-[54px]"
            >
              {[
                ['Built', 'for', 'agents', 'who', 'close,'],
                ['not', 'agents', 'who', 'chase.'],
              ].map((line, l) => (
                <span key={l} className="block">
                  {line.map((word, w) => (
                    <Fragment key={`${word}-${w}`}>
                      <motion.span
                        className="inline-block bg-clip-text text-transparent"
                        style={{
                          backgroundImage: l
                            ? 'linear-gradient(180deg,#A9C1FF 0%,#5B86F6 100%)'
                            : 'linear-gradient(180deg,#FFFFFF 30%,#B8C2DE 100%)',
                        }}
                        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ duration: 0.7, ease: EASE, delay: 0.06 + (l * 3 + w) * 0.06 }}
                      >
                        {word}
                      </motion.span>
                      {w < line.length - 1 && ' '}
                    </Fragment>
                  ))}
                </span>
              ))}
            </h2>
            <motion.p
              {...rise(0.3)}
              className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-white/55 sm:text-[17px]"
            >
              Four tools that do the heavy lifting, so your team spends the day closing.
            </motion.p>
          </div>

          {/* ── Showcase card ── */}
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, ease: EASE }}
            onPointerEnter={e => e.pointerType === 'mouse' && setHovering(true)}
            onPointerLeave={e => e.pointerType === 'mouse' && setHovering(false)}
            onFocus={() => setFocused(true)}
            onBlur={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
            }}
            className="relative mx-auto mt-12 flex max-w-[1120px] flex-col rounded-[26px] border border-white/[0.09] bg-black/60 p-4 shadow-[0_40px_120px_-40px_rgba(43,89,224,0.45)] sm:mt-14 sm:rounded-[36px] sm:p-7 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-12 lg:p-11"
          >
            {/* left: tabs + title */}
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:justify-between lg:py-2">
              <div
                role="tablist"
                aria-label="Features"
                aria-orientation="vertical"
                onKeyDown={onKey}
                className="order-1 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:order-none lg:flex lg:flex-col lg:gap-1.5"
              >
                {FEATURES.map((ft, i) => (
                  <Tab
                    key={ft.key}
                    label={ft.title}
                    on={i === index}
                    progress={progress}
                    running={running}
                    tabId={`${uid}-tab-${i}`}
                    panelId={`${uid}-panel`}
                    innerRef={el => {
                      tabRefs.current[i] = el
                    }}
                    onClick={() => pick(i)}
                  />
                ))}
              </div>

              <div
                id={`${uid}-panel`}
                role="tabpanel"
                aria-labelledby={`${uid}-tab-${index}`}
                className="order-3 mt-6 text-center lg:order-none lg:mt-0 lg:text-left"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={f.key}
                    initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <Glyph k={f.key} />
                    <h3
                      style={{
                        backgroundImage: 'linear-gradient(180deg,#FFFFFF 35%,#C2CDF2 100%)',
                      }}
                      className="mt-4 bg-clip-text pb-1 text-[32px] font-bold leading-[1.02] tracking-[-0.03em] text-transparent sm:text-[40px] lg:mt-6 lg:text-[54px]"
                    >
                      {f.title}
                    </h3>
                    <p className="mx-auto mt-3 max-w-[360px] text-[15px] leading-relaxed text-white/55 sm:text-[16px] lg:mx-0">
                      {f.desc}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* right: art panel */}
            <div className="order-2 mx-auto mt-5 w-full max-w-[480px] lg:order-none lg:mt-0">
              <SceneCtx.Provider value={{ calm, live: inView && !calm }}>
                <ArtPanel k={f.key} shown={shown} calm={calm} />
              </SceneCtx.Provider>
            </div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  )
}

export default FeatureShowcase

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.6 },
    transition: { duration: 0.6, ease: EASE, delay },
  }
}

/* ─── Background ───────────────────────────────────────────────────────────── */
function Sky({ calm }: { calm: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* spotlight over the heading */}
      <div
        className="absolute inset-x-0 top-0 h-[620px]"
        style={{
          background:
            'radial-gradient(52% 60% at 50% 0%, rgba(74,116,255,0.34) 0%, rgba(43,89,224,0.12) 45%, transparent 75%)',
        }}
      />
      {/* low glow behind the card */}
      <div
        className="absolute inset-x-0 bottom-0 h-[70%]"
        style={{
          background:
            'radial-gradient(45% 55% at 70% 70%, rgba(43,89,224,0.18) 0%, transparent 70%), radial-gradient(35% 40% at 20% 80%, rgba(91,134,246,0.10) 0%, transparent 70%)',
        }}
      />
      {STARS.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o }}
          animate={s.twinkle && !calm ? { opacity: [s.o, s.o * 0.2, s.o] } : { opacity: s.o }}
          transition={
            s.twinkle && !calm
              ? { duration: 3.2, repeat: Infinity, delay: s.d, ease: 'easeInOut' }
              : { duration: 0 }
          }
        />
      ))}
      {/* fine top edge, like light catching the rim */}
      <div className="absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  )
}

/* ─── Tabs ─────────────────────────────────────────────────────────────────── */
function Tab({
  label,
  on,
  progress,
  running,
  tabId,
  panelId,
  innerRef,
  onClick,
}: {
  label: string
  on: boolean
  progress: MotionValue<number>
  running: boolean
  tabId: string
  panelId: string
  innerRef: (el: HTMLButtonElement | null) => void
  onClick: () => void
}) {
  return (
    <button
      ref={innerRef}
      id={tabId}
      type="button"
      role="tab"
      aria-selected={on}
      aria-controls={panelId}
      tabIndex={on ? 0 : -1}
      onClick={onClick}
      className={`group relative flex min-w-0 cursor-pointer items-center overflow-hidden rounded-[12px] border px-3 py-2.5 text-left outline-none max-[359px]:px-2 transition-colors focus-visible:ring-2 focus-visible:ring-[#8FAEFF]/60 lg:rounded-[8px] lg:border-0 lg:bg-transparent lg:px-0 lg:py-1.5 ${
        on
          ? 'border-white/15 bg-white/[0.07]'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      {/* desktop: dot with a progress ring, the label slides over to make room */}
      <span className="relative hidden size-[18px] shrink-0 lg:block" aria-hidden>
        <motion.span
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.4 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <svg viewBox="0 0 18 18" className="size-full -rotate-90">
            <circle
              cx="9"
              cy="9"
              r="7.5"
              fill="none"
              stroke="rgba(185,198,255,0.18)"
              strokeWidth="1.5"
            />
            <motion.circle
              cx="9"
              cy="9"
              r="7.5"
              fill="none"
              stroke={LILAC}
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{ pathLength: on && running ? progress : on ? 1 : 0 }}
            />
            <circle cx="9" cy="9" r="3.6" fill={LILAC} />
          </svg>
        </motion.span>
      </span>
      <span
        className={`min-w-0 truncate text-[13px] font-semibold max-[359px]:text-[11.5px] transition-[translate,color] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] sm:text-[13.5px] lg:ml-3.5 lg:text-[17px] ${
          on ? 'text-[#DDE4FF]' : 'text-white/45 group-hover:text-white/75 lg:-translate-x-[18px]'
        }`}
      >
        {label}
      </span>
      {/* phone / tablet: a progress bar along the bottom of the pill */}
      {on && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[#8FAEFF] lg:hidden"
          style={{ scaleX: running ? progress : 1 }}
        />
      )}
    </button>
  )
}

/* ─── Glyphs above the title ───────────────────────────────────────────────── */
function Glyph({ k }: { k: Key }) {
  const gid = useId()
  const fill = `url(#${gid})`
  const shapes: Record<Key, ReactNode> = {
    score: (
      <>
        <path d="M4 22A18 18 0 0 1 22 4V22Z" fill={fill} />
        <path d="M26 4A18 18 0 0 1 44 22H26Z" fill={fill} />
        <path d="M4 26H22V44A18 18 0 0 1 4 26Z" fill={fill} />
        <rect x="26" y="26" width="18" height="18" rx="3" fill={fill} />
      </>
    ),
    advisor: (
      <path
        d="M24 3C25.6 15 33 22.4 45 24C33 25.6 25.6 33 24 45C22.4 33 15 25.6 3 24C15 22.4 22.4 15 24 3Z"
        fill={fill}
      />
    ),
    broadcast: (
      <>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3 - Math.PI / 2
          return (
            <circle
              key={i}
              cx={24 + Math.cos(a) * 13.5}
              cy={24 + Math.sin(a) * 13.5}
              r="7.2"
              fill={fill}
            />
          )
        })}
      </>
    ),
    team: (
      <>
        {[0, 45, 90, 135].map(r => (
          <rect
            key={r}
            x="19.5"
            y="3"
            width="9"
            height="42"
            rx="4.5"
            fill={fill}
            transform={`rotate(${r} 24 24)`}
          />
        ))}
      </>
    ),
  }
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className="mx-auto size-9 sm:size-11 lg:mx-0 lg:size-[52px]"
      aria-hidden
      initial={{ rotate: -30, scale: 0.6 }}
      animate={{ rotate: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 16 }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E0E6FF" />
          <stop offset="1" stopColor="#93A9FF" />
        </linearGradient>
      </defs>
      {shapes[k]}
    </motion.svg>
  )
}

/* ─── Art panel ────────────────────────────────────────────────────────────── */
function ArtPanel({ k, shown, calm }: { k: Key; shown: boolean; calm: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 120, damping: 18 })
  const sy = useSpring(py, { stiffness: 120, damping: 18 })
  const rotateY = useTransform(sx, [-0.5, 0.5], [-7, 7])
  const rotateX = useTransform(sy, [-0.5, 0.5], [6, -6])
  const glare = useTransform(
    sx,
    v => `radial-gradient(40% 30% at ${50 + v * 60}% 0%, rgba(255,255,255,0.16), transparent 70%)`
  )

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (calm || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onLeave = () => {
    px.set(0)
    py.set(0)
  }

  const scenes: Record<Key, ReactNode> = {
    score: <ScoreScene />,
    advisor: <AdvisorScene />,
    broadcast: <BroadcastScene />,
    team: <TeamScene />,
  }

  return (
    <div style={{ perspective: 1100 }} onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        ref={ref}
        aria-hidden
        className="relative aspect-square w-full overflow-hidden rounded-[24px] sm:rounded-[30px]"
        style={{
          rotateX,
          rotateY,
          background:
            'radial-gradient(66% 62% at 50% 54%, #040920 0%, #071033 42%, rgba(7,16,51,0.62) 64%, rgba(7,16,51,0) 84%), linear-gradient(155deg, #5A88FF 0%, #2A4FD6 34%, #1A3497 60%, #4370FF 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.32), inset 0 0 0 1px rgba(255,255,255,0.08), 0 30px 60px -20px rgba(18,40,140,0.6)',
        }}
      >
        {/* dot grid, faded toward the rim */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(150,178,255,0.22) 1px, transparent 1.3px)',
            backgroundSize: '15px 15px',
            maskImage: 'radial-gradient(60% 60% at 50% 52%, #000 30%, transparent 85%)',
            WebkitMaskImage: 'radial-gradient(60% 60% at 50% 52%, #000 30%, transparent 85%)',
          }}
        />
        {/* light beam from the top */}
        <div
          className="absolute -top-[14%] left-[22%] h-[70%] w-[22%] -rotate-[28deg] opacity-40 blur-[24px]"
          style={{ background: 'linear-gradient(180deg, rgba(150,180,255,0.55), transparent 80%)' }}
        />
        {/* moving glare that follows the pointer */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: glare }}
        />
        {w > 0 && (
          <div
            className="absolute left-0 top-0"
            style={{
              width: STAGE,
              height: STAGE,
              transform: `scale(${w / STAGE})`,
              transformOrigin: '0 0',
            }}
          >
            <AnimatePresence>
              {shown && (
                <motion.div
                  key={k}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.94, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
                  transition={{ duration: 0.55, ease: EASE }}
                >
                  {scenes[k]}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  )
}

/* ─── Scene parts ──────────────────────────────────────────────────────────── */
// All positions below are in stage pixels (0–420).
// Centred on (x, y). Uses the CSS `translate` property, so motion's own
// transforms (scale, y) stack on top instead of replacing the centring.
const at = (x: number, y: number): CSSProperties => ({
  position: 'absolute',
  left: x,
  top: y,
  translate: '-50% -50%',
})

function pop(delay: number, calm: boolean) {
  return {
    initial: calm ? false : ({ opacity: 0, scale: 0.6 } as const),
    animate: { opacity: 1, scale: 1 },
    transition: calm
      ? { duration: 0 }
      : { type: 'spring' as const, stiffness: 260, damping: 20, delay },
  }
}

function Wires({
  paths,
  start = 0.25,
  pulseFrom = 1.1,
}: {
  paths: string[]
  start?: number
  pulseFrom?: number
}) {
  const { calm, live } = useScene()
  return (
    <svg viewBox={`0 0 ${STAGE} ${STAGE}`} className="absolute inset-0 size-full overflow-visible">
      {paths.map((d, i) => (
        <Fragment key={i}>
          <motion.path
            d={d}
            fill="none"
            stroke="rgba(170,192,255,0.26)"
            strokeWidth="1.6"
            strokeLinecap="round"
            initial={calm ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: calm ? 0 : 0.7,
              ease: EASE,
              delay: calm ? 0 : start + i * 0.07,
            }}
          />
          {live && (
            <motion.path
              d={d}
              fill="none"
              stroke={PULSE}
              strokeWidth="2.4"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 5px rgba(120,160,255,0.95))' }}
              initial={{ pathLength: 0.16, pathOffset: -0.16 }}
              animate={{ pathOffset: 1 }}
              transition={{
                duration: 1.5,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatDelay: 1.4,
                delay: pulseFrom + i * 0.32,
              }}
            />
          )}
        </Fragment>
      ))}
    </svg>
  )
}

function Gloss({
  size,
  y,
  round = false,
  children,
  delay = 0.05,
}: {
  size: number
  y: number
  round?: boolean
  children: ReactNode
  delay?: number
}) {
  const { calm } = useScene()
  return (
    <motion.div {...pop(delay, calm)} style={{ ...at(STAGE / 2, y), width: size, height: size }}>
      <motion.div
        className="relative size-full"
        animate={calm ? undefined : { y: [0, -5, 0] }}
        transition={calm ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          borderRadius: round ? '50%' : size * 0.27,
          background: 'linear-gradient(180deg, #7FA2FF 0%, #3F6CF6 42%, #2550DB 100%)',
          boxShadow:
            'inset 0 2px 1px rgba(255,255,255,0.6), inset 0 -12px 22px rgba(10,22,92,0.45), 0 9px 0 #1B3AA6, 0 10px 0 rgba(0,0,0,0.25), 0 28px 50px rgba(2,6,32,0.7)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-[8%] top-[5%] h-[46%]"
          style={{
            borderRadius: round ? '50% 50% 45% 45%' : size * 0.22,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0))',
          }}
        />
        <div className="relative flex size-full items-center justify-center">{children}</div>
      </motion.div>
    </motion.div>
  )
}

function Bubble({
  person,
  size = 58,
  x,
  y,
  delay,
  ring,
  badge,
}: {
  person: Person
  size?: number
  x: number
  y: number
  delay: number
  ring?: ReactNode
  badge?: ReactNode
}) {
  const { calm } = useScene()
  return (
    <motion.div {...pop(delay, calm)} style={{ ...at(x, y), width: size, height: size }}>
      <div
        className="relative flex size-full items-center justify-center rounded-full border border-white/[0.12]"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 60%), rgba(14,22,62,0.88)',
          boxShadow: '0 12px 26px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        {ring}
        <Avatar p={person} size={size - 14} />
        {badge}
      </div>
    </motion.div>
  )
}

function Avatar({ p, size }: { p: Person; size: number }) {
  const cid = useId()
  const ink = '#1C2033'
  const shade = 'rgba(0,0,0,0.12)'
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="block">
      <defs>
        <clipPath id={cid}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${cid})`}>
        <rect width="64" height="64" fill={p.bg} />
        {p.style === 'long' && (
          <path
            d="M18.5 30C16.5 16 24 10.5 32 10.5C40.5 10.5 47.5 16 45.5 30L46.5 47C43.5 49 40 48 38.5 45H25.5C24 48 20.5 49 17.5 47Z"
            fill={p.hair}
          />
        )}
        {p.style === 'bun' && <circle cx="32" cy="10.5" r="6.5" fill={p.hair} />}
        <path d="M7 66C8 50 18.5 44.5 32 44.5C45.5 44.5 56 50 57 66Z" fill={p.shirt} />
        <path d="M26.5 44.6L32 51L37.5 44.6Z" fill={shade} />
        <path d="M27 35H37V44C37 47 27 47 27 44Z" fill={p.skin} />
        <path d="M27 38.5C30 40.5 34 40.5 37 38.5V36H27Z" fill={shade} />
        <ellipse cx="20.6" cy="28.5" rx="2.3" ry="3" fill={p.skin} />
        <ellipse cx="43.4" cy="28.5" rx="2.3" ry="3" fill={p.skin} />
        <ellipse cx="32" cy="27" rx="11.6" ry="13" fill={p.skin} />
        {p.beard && (
          <path
            d="M20.6 28C21.2 38.5 26.5 41.5 32 41.5C37.5 41.5 42.8 38.5 43.4 28C41.8 33.5 37.5 35.6 32 35.6C26.5 35.6 22.2 33.5 20.6 28Z"
            fill={p.hair}
          />
        )}
        {p.style === 'short' && (
          <path
            d="M20.3 26.5C19 15.5 25 11.5 32.5 11.5C40 11.5 45.6 16 43.7 26.5C42.6 21 39 18.4 33.8 18.4C28.6 18.4 23.6 20.4 20.3 26.5Z"
            fill={p.hair}
          />
        )}
        {(p.style === 'long' || p.style === 'bun') && (
          <path
            d="M20.4 27C19.8 16 26 11.6 32.5 11.6C40 11.6 44.8 16.6 43.6 27C40.4 19.6 33.4 17.4 27.4 19.8C24.4 21.2 22 23.6 20.4 27Z"
            fill={p.hair}
          />
        )}
        {p.style === 'curly' && (
          <g fill={p.hair}>
            {[
              [22, 22, 5.5],
              [26.5, 16, 6],
              [33, 13.5, 6.4],
              [39.5, 16.5, 6],
              [43, 22.5, 5.2],
              [30, 19, 5],
              [36.5, 19.5, 5],
            ].map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} />
            ))}
          </g>
        )}
        <circle cx="27.6" cy="28.6" r="1.35" fill={ink} />
        <circle cx="36.4" cy="28.6" r="1.35" fill={ink} />
        {p.glasses && (
          <g fill="none" stroke={ink} strokeWidth="1.1">
            <circle cx="27.6" cy="28.6" r="3.6" />
            <circle cx="36.4" cy="28.6" r="3.6" />
            <path d="M31.2 28.4H32.8" />
          </g>
        )}
        <circle cx="25" cy="32.6" r="1.8" fill="#F28B82" opacity="0.28" />
        <circle cx="39" cy="32.6" r="1.8" fill="#F28B82" opacity="0.28" />
        <path
          d="M28.9 33.4Q32 35.8 35.1 33.4"
          fill="none"
          stroke={ink}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

function Chip({
  x,
  y,
  delay,
  children,
  className = '',
  from = 'center',
}: {
  x: number
  y: number
  delay: number
  children: ReactNode
  className?: string
  /** Which edge sits on x. */
  from?: 'center' | 'left'
}) {
  const { calm } = useScene()
  return (
    <motion.div
      initial={calm ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: calm ? 0 : 0.5, ease: EASE, delay: calm ? 0 : delay }}
      style={{ ...at(x, y), translate: from === 'left' ? '0 -50%' : '-50% -50%' }}
    >
      <div
        className={`flex items-center gap-2 whitespace-nowrap rounded-full border border-white/[0.12] px-3 py-[7px] text-[12.5px] text-white/85 ${className}`}
        style={{
          background: 'rgba(8,14,44,0.82)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}

function Count({
  to,
  delay = 0,
  duration = 1.1,
  format = (v: number) => String(Math.round(v)),
}: {
  to: number
  delay?: number
  duration?: number
  format?: (v: number) => string
}) {
  const { calm } = useScene()
  const mv = useMotionValue(calm ? to : 0)
  const text = useTransform(mv, format)
  useEffect(() => {
    if (calm) {
      mv.set(to)
      return
    }
    const c = animate(mv, to, { duration, delay, ease: EASE })
    return () => c.stop()
  }, [calm, mv, to, delay, duration])
  return <motion.span>{text}</motion.span>
}

function Typed({ text, delay, speed = 34 }: { text: string; delay: number; speed?: number }) {
  const { calm } = useScene()
  const n = useMotionValue(calm ? text.length : 0)
  const shown = useTransform(n, v => text.slice(0, Math.round(v)))
  useEffect(() => {
    if (calm) {
      n.set(text.length)
      return
    }
    const c = animate(n, text.length, { duration: text.length / speed, delay, ease: 'linear' })
    return () => c.stop()
  }, [calm, n, text, delay, speed])
  // The invisible copy holds the final size so the card never jumps while typing.
  return (
    <span className="grid">
      <span className="invisible col-start-1 row-start-1">{text}</span>
      <motion.span className="col-start-1 row-start-1">{shown}</motion.span>
    </span>
  )
}

/* ─── Scene 1 · AI Intent Score ────────────────────────────────────────────── */
const SIGNALS = [
  { label: 'Portal browsing', v: 92, x: 98, y: 98, c: '#8FAEFF' },
  { label: 'Budget confirmed', v: 95, x: 322, y: 98, c: '#34D399' },
  { label: 'Call response', v: 78, x: 98, y: 318, c: '#8FAEFF' },
  { label: 'Timeline urgency', v: 84, x: 322, y: 318, c: '#FBBF24' },
]

function ScoreScene() {
  const { calm } = useScene()
  const T = { x0: 138, x1: 282, y0: 136, y1: 280 } // centre tile bounds
  const paths = [
    elbow(98, 114, T.x0, 184, 'v'),
    elbow(322, 114, T.x1, 184, 'v'),
    elbow(98, 302, T.x0, 232, 'v'),
    elbow(322, 302, T.x1, 232, 'v'),
    `M210 76 V${T.y0}`,
    `M210 ${T.y1} V360`,
  ]
  const R = 46
  const C = 2 * Math.PI * R
  return (
    <>
      <Wires paths={paths} />
      <Gloss size={144} y={208}>
        <div className="relative size-[112px]">
          <svg viewBox="0 0 112 112" className="absolute inset-0 -rotate-90">
            <circle
              cx="56"
              cy="56"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="8"
            />
            <motion.circle
              cx="56"
              cy="56"
              r={R}
              fill="none"
              stroke="#fff"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={calm ? false : { strokeDashoffset: C }}
              animate={{ strokeDashoffset: C * (1 - 0.88) }}
              transition={{ duration: calm ? 0 : 1.4, ease: EASE, delay: calm ? 0 : 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-[34px] font-extrabold tracking-[-0.04em] text-white">
              <Count to={88} delay={0.5} duration={1.4} />
            </span>
            <span className="mt-1 text-[10px] text-white/70" style={MONO}>
              /100
            </span>
          </div>
        </div>
      </Gloss>

      <Bubble person={P.priyaD} x={210} y={46} delay={0.15} size={56} />
      <Chip x={246} y={46} delay={0.3} from="left" className="!py-[5px]">
        <span className="font-semibold text-white">Priya Desai</span>
        <span className="text-[10.5px] text-white/50" style={MONO}>
          new lead
        </span>
      </Chip>

      {SIGNALS.map((s, i) => (
        <Chip key={s.label} x={s.x} y={s.y} delay={0.45 + i * 0.1}>
          <span className="size-1.5 rounded-full" style={{ background: s.c }} />
          <span className="text-white/70">{s.label}</span>
          <span className="font-semibold text-white" style={MONO}>
            <Count to={s.v} delay={0.6 + i * 0.1} />
          </span>
        </Chip>
      ))}

      <Chip x={210} y={374} delay={1.5} className="!border-[#FBBF24]/35">
        <Flame className="size-3.5 text-[#FBBF24]" strokeWidth={2.4} />
        <span className="font-semibold text-[#FDE7B0]">Hot lead</span>
        <span className="text-white/55">· call first</span>
      </Chip>
    </>
  )
}

/* ─── Scene 2 · AI Advisor ─────────────────────────────────────────────────── */
function AdvisorScene() {
  const { calm } = useScene()
  const gid = useId()
  const cy = 176
  const paths = [
    `M88 ${118} H112 Q126 118 126 132 V${cy - 14} Q126 ${cy} 140 ${cy} H146`,
    `M88 ${234} H112 Q126 234 126 220 V${cy + 14} Q126 ${cy} 140 ${cy} H146`,
    elbow(364, 82, 274, cy, 'v'),
  ]
  const answerAt = 1.7
  return (
    <>
      <Wires paths={paths} pulseFrom={1.8} />
      <Gloss size={128} y={cy} round>
        <svg viewBox="0 0 64 64" className="size-[60px]">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#C9D6FF" />
            </linearGradient>
          </defs>
          <path
            d="M14 14H50C53.3 14 56 16.7 56 20V40C56 43.3 53.3 46 50 46H30L20 54V46H14C10.7 46 8 43.3 8 40V20C8 16.7 10.7 14 14 14Z"
            fill={`url(#${gid})`}
          />
          <path
            d="M32 20.5C32.8 26.3 34.7 28.2 40.5 29C34.7 29.8 32.8 31.7 32 37.5C31.2 31.7 29.3 29.8 23.5 29C29.3 28.2 31.2 26.3 32 20.5Z"
            fill="#3F6CF6"
          />
        </svg>
      </Gloss>

      {/* the agent asks */}
      <Bubble person={P.rahul} x={364} y={54} delay={0.1} size={54} />
      <motion.div
        initial={calm ? false : { opacity: 0, x: 12, scale: 0.92 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: calm ? 0 : 0.45, ease: EASE, delay: calm ? 0 : 0.35 }}
        className="absolute right-[86px] top-[36px] origin-right rounded-[14px] rounded-tr-[4px] border border-white/[0.12] bg-white/[0.1] px-3.5 py-2 text-[13px] font-medium text-white"
        style={{ boxShadow: '0 10px 24px rgba(0,0,0,0.35)' }}
      >
        Who should I call first?
      </motion.div>

      {/* leads the advisor weighs */}
      <Bubble
        person={P.priyaD}
        x={62}
        y={118}
        delay={0.3}
        size={54}
        ring={
          <motion.span
            className="absolute -inset-[5px] rounded-full border-2 border-[#8FAEFF]"
            initial={calm ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: calm ? 0 : 0.4, delay: calm ? 0 : answerAt + 0.5 }}
            style={{ boxShadow: '0 0 18px rgba(120,160,255,0.75)' }}
          />
        }
        badge={
          <span
            className="absolute -bottom-1 -right-2 rounded-full bg-[#FBBF24] px-1.5 py-[1px] text-[9.5px] font-bold text-[#3A2400]"
            style={MONO}
          >
            88
          </span>
        }
      />
      <Bubble
        person={P.rohan}
        x={62}
        y={234}
        delay={0.4}
        size={54}
        badge={
          <span
            className="absolute -bottom-1 -right-2 rounded-full bg-[#8FAEFF] px-1.5 py-[1px] text-[9.5px] font-bold text-[#0B1433]"
            style={MONO}
          >
            74
          </span>
        }
      />

      {/* the answer */}
      <motion.div
        initial={calm ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: calm ? 0 : 0.5, ease: EASE, delay: calm ? 0 : 0.9 }}
        className="absolute inset-x-[30px] top-[286px] rounded-[18px] border border-white/[0.12] p-4"
        style={{
          background: 'linear-gradient(180deg, rgba(20,34,96,0.92), rgba(9,15,48,0.92))',
          boxShadow: '0 18px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        <div
          className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-[#A9C1FF]"
          style={MONO}
        >
          <Sparkles className="size-3" strokeWidth={2.4} />
          AI ADVISOR
          {!calm && (
            <motion.span
              className="ml-1 flex gap-[3px]"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: answerAt, duration: 0.2 }}
            >
              {[0, 1, 2].map(d => (
                <motion.span
                  key={d}
                  className="size-[4px] rounded-full bg-[#A9C1FF]"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                />
              ))}
            </motion.span>
          )}
        </div>
        <div className="mt-2 text-[14.5px] font-semibold leading-snug text-white">
          <Typed text="Call Priya Desai first. Score 88, loan pre‑approved." delay={answerAt} />
        </div>
        <div className="mt-1 text-[13px] leading-snug text-white/60">
          <Typed text="Then Rohan Mehta. He replied on WhatsApp." delay={answerAt + 1.7} />
        </div>
      </motion.div>
    </>
  )
}

/* ─── Scene 3 · Bulk WhatsApp ──────────────────────────────────────────────── */
const RECIPIENTS = [
  { p: P.sneha, x: 70, y: 66 },
  { p: P.arjun, x: 350, y: 66 },
  { p: P.meera, x: 48, y: 186 },
  { p: P.vikram, x: 372, y: 186 },
  { p: P.ananya, x: 92, y: 300 },
  { p: P.rohan, x: 328, y: 300 },
]

function BroadcastScene() {
  const { calm } = useScene()
  const T = { x0: 148, x1: 272, y0: 120, y1: 244 }
  const paths = [
    elbow(70, 94, T.x0, 150, 'v'),
    elbow(350, 94, T.x1, 150, 'v'),
    `M76 186 H${T.x0}`,
    `M344 186 H${T.x1}`,
    elbow(92, 272, T.x0, 222, 'v'),
    elbow(328, 272, T.x1, 222, 'v'),
  ]
  // Drawn lead → tile; reversed so the pulses run outward, from the tile to each lead.
  const outward = paths.map(reversePath)
  return (
    <>
      <Wires paths={outward} pulseFrom={1.0} />
      <Gloss size={124} y={182}>
        <WhatsappLogo size={64} weight="fill" color="#FFFFFF" />
      </Gloss>

      {RECIPIENTS.map((r, i) => (
        <Bubble
          key={r.p.name}
          person={r.p}
          x={r.x}
          y={r.y}
          delay={0.2 + i * 0.07}
          size={54}
          badge={
            <motion.span
              className="absolute -bottom-1 -right-1 flex size-[20px] items-center justify-center rounded-full border-2 border-[#0E163E] bg-[#25D366]"
              initial={calm ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={
                calm
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 400, damping: 16, delay: 1.0 + i * 0.32 + 1.1 }
              }
            >
              <CheckCheck className="size-3 text-white" strokeWidth={3} />
            </motion.span>
          }
        />
      ))}

      {/* a reply comes back */}
      <motion.div
        initial={calm ? false : { opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: calm ? 0 : 0.45, ease: EASE, delay: calm ? 0 : 3.6 }}
        className="absolute right-[112px] top-[40px] origin-bottom-right whitespace-nowrap rounded-[12px] rounded-br-[3px] bg-[#1F7A55] px-3 py-1.5 text-[12px] font-medium text-white"
        style={{ boxShadow: '0 10px 22px rgba(0,0,0,0.35)' }}
      >
        Saturday works for me
      </motion.div>

      {/* campaign totals */}
      <motion.div
        initial={calm ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: calm ? 0 : 0.5, ease: EASE, delay: calm ? 0 : 0.7 }}
        className="absolute inset-x-[36px] top-[346px] flex items-center rounded-[16px] border border-white/[0.12] px-4 py-2.5"
        style={{
          background: 'rgba(8,14,44,0.85)',
          boxShadow: '0 14px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-white">Site visit follow-up</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#6EE7B7]" style={MONO}>
            <span className="size-1.5 rounded-full bg-[#34D399]" />
            sending
          </div>
        </div>
        {[
          ['Sent', 63],
          ['Read', 47],
          ['Booked', 8],
        ].map(([label, v], i) => (
          <div key={label} className="ml-4 text-right leading-none">
            <div className="text-[17px] font-bold text-white" style={MONO}>
              <Count to={v as number} delay={1 + i * 0.4} duration={1.6} />
            </div>
            <div
              className="mt-1 text-[9.5px] uppercase tracking-[0.1em] text-white/45"
              style={MONO}
            >
              {label}
            </div>
          </div>
        ))}
      </motion.div>
    </>
  )
}

// Reverse a simple M/H/V/Q path so a pulse runs the other way.
function reversePath(d: string) {
  const tokens = d.match(/[MHVQL]|-?\d+(\.\d+)?/g) ?? []
  let x = 0
  let y = 0
  const out: [number, number][] = []
  const ctrl: (null | [number, number])[] = []
  for (let i = 0; i < tokens.length;) {
    const cmd = tokens[i++]
    if (cmd === 'M' || cmd === 'L') {
      x = +tokens[i++]
      y = +tokens[i++]
      out.push([x, y])
      ctrl.push(null)
    } else if (cmd === 'H') {
      x = +tokens[i++]
      out.push([x, y])
      ctrl.push(null)
    } else if (cmd === 'V') {
      y = +tokens[i++]
      out.push([x, y])
      ctrl.push(null)
    } else if (cmd === 'Q') {
      const c: [number, number] = [+tokens[i++], +tokens[i++]]
      x = +tokens[i++]
      y = +tokens[i++]
      out.push([x, y])
      ctrl.push(c)
    }
  }
  let r = `M${out[out.length - 1][0]} ${out[out.length - 1][1]}`
  for (let k = out.length - 1; k > 0; k--) {
    const [px, py] = out[k - 1]
    const c = ctrl[k]
    r += c ? ` Q${c[0]} ${c[1]} ${px} ${py}` : ` L${px} ${py}`
  }
  return r
}

/* ─── Scene 4 · Team Analytics ─────────────────────────────────────────────── */
const AGENTS = [
  { p: P.rahul, value: 4.2, change: 22, x: 106, y: 62, top: true },
  { p: P.priyaM, value: 2.8, change: 11, x: 314, y: 62 },
  { p: P.ananya, value: 1.9, change: 9, x: 106, y: 352 },
  { p: P.nikhil, value: 1.1, change: -4, x: 314, y: 352 },
]
const WEEK = [5, 7, 6, 9, 8, 10, 13]

function TeamScene() {
  const { calm } = useScene()
  const T = { x0: 142, x1: 278, y0: 140, y1: 276 }
  const paths = [
    elbow(70, 88, T.x0, 172, 'v'),
    elbow(350, 88, T.x1, 172, 'v'),
    elbow(70, 326, T.x0, 244, 'v'),
    elbow(350, 326, T.x1, 244, 'v'),
  ]
  return (
    <>
      <Wires paths={paths} pulseFrom={1.2} />
      <Gloss size={136} y={208}>
        <div className="flex w-[98px] flex-col items-start">
          <div className="text-[8.5px] font-semibold tracking-[0.12em] text-white/80" style={MONO}>
            LEADS THIS WEEK
          </div>
          <div className="mt-2 flex h-[54px] w-full items-end gap-[5px]">
            {WEEK.map((v, i) => (
              <motion.span
                key={i}
                className="flex-1 origin-bottom rounded-[3px]"
                style={{
                  height: `${(v / 13) * 100}%`,
                  background: i === WEEK.length - 1 ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                }}
                initial={calm ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  duration: calm ? 0 : 0.6,
                  ease: EASE,
                  delay: calm ? 0 : 0.4 + i * 0.06,
                }}
              />
            ))}
          </div>
          <div
            className="mt-2 flex items-center gap-1 text-[11px] font-bold text-white"
            style={MONO}
          >
            <TrendingUp className="size-3" strokeWidth={3} />
            22%
          </div>
        </div>
      </Gloss>

      {AGENTS.map((a, i) => (
        <AgentCard key={a.p.name} {...a} delay={0.25 + i * 0.1} />
      ))}
    </>
  )
}

function AgentCard({
  p,
  value,
  change,
  x,
  y,
  top,
  delay,
}: {
  p: Person
  value: number
  change: number
  x: number
  y: number
  top?: boolean
  delay: number
}) {
  const { calm } = useScene()
  const up = change >= 0
  return (
    <motion.div {...pop(delay, calm)} style={at(x, y)}>
      <div
        className="relative flex w-[176px] items-center gap-2.5 rounded-full border border-white/[0.12] py-1.5 pl-1.5 pr-3.5"
        style={{
          background: 'rgba(8,14,44,0.85)',
          boxShadow: '0 12px 26px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div className="relative shrink-0">
          <div className="rounded-full border border-white/15 p-[2px]">
            <Avatar p={p} size={38} />
          </div>
          {top && (
            <span
              className="absolute -right-1.5 -top-1.5 rounded-full bg-[#FBBF24] px-1 text-[9px] font-bold text-[#3A2400]"
              style={MONO}
            >
              #1
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 leading-none">
          <div className="truncate text-[12.5px] font-semibold text-white">{p.name}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-white" style={MONO}>
              <Count to={value} delay={delay + 0.3} format={v => `₹${v.toFixed(1)} Cr`} />
            </span>
            <span
              className={`flex items-center gap-0.5 text-[10.5px] font-semibold ${up ? 'text-[#6EE7B7]' : 'text-[#FCA5A5]'}`}
              style={MONO}
            >
              {up ? (
                <TrendingUp className="size-3" strokeWidth={2.6} />
              ) : (
                <TrendingDown className="size-3" strokeWidth={2.6} />
              )}
              {Math.abs(change)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
