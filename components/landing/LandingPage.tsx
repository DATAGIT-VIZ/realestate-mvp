'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Building2, Zap, Shield, Bot, BarChart3, ChevronRight,
  ArrowRight, CheckCircle, Menu, X, Star, Users, TrendingUp,
  PhoneCall, Clock, Target, Sparkles, Home, Flame, Eye,
  Banknote, Calendar, Trophy, MapPin, User, BadgeCheck, Share2,
  Linkedin, Twitter, Instagram, Youtube, Bell, Search, Settings, MessageCircle,
} from 'lucide-react'

const Share2Icon = Share2
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis,
  LineChart, Line, YAxis, BarChart, Bar, CartesianGrid,
} from 'recharts'
import FloatingDashboard from './FloatingDashboard'
import { CinematicFooter } from './CinematicFooter'
import WorkspaceBento from './WorkspaceBento'
import { AnimatedDock } from '@/components/ui/animated-dock'
import CardSwap, { Card as SwapCard } from '@/components/ui/CardSwap'
import dynamic from 'next/dynamic'
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then(async (m) => {
    m.setWasmUrl('/lottie/dotlottie-player.wasm')
    return m.DotLottieReact
  }),
  { ssr: false, loading: () => <div className="w-full h-full" /> }
)
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform } from 'motion/react'
import { Lock, Robot, ChartLine, ChartBar } from '@phosphor-icons/react'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'

/* ─── Scroll-reveal hook ──────────────────────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.querySelectorAll('.lp-in').forEach(node => node.classList.add('is-visible'))
        }
      },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

/* ─── Animated counter ────────────────────────────────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const dur = 1600
          const tick = (now: number) => {
            const p = Math.min((now - start) / dur, 1)
            const ease = 1 - Math.pow(1 - p, 3)
            setVal(Math.round(ease * to))
            if (p < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [to])

  return <span ref={ref}>{val}{suffix}</span>
}

/* ─── Nav ─────────────────────────────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(245,246,250,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid #E8ECF0' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: '#0038A8' }}
          >
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[#263238] text-[15px] tracking-tight">Lead Gap CRM</span>
        </a>

        <div className="hidden md:flex items-center gap-7">
          {['Features', 'How it works', 'Pricing'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(' ', '-')}`}
              className="text-[13px] font-medium text-[#78889B] hover:text-[#263238] transition-colors">
              {l}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-[13px] font-medium text-[#78889B] hover:text-[#263238] transition-colors px-4 py-2">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-[13px] font-semibold text-white px-5 py-2.5 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] shadow-sm"
            style={{ background: '#0038A8' }}
          >
            Get started free
          </Link>
        </div>

        <button className="md:hidden p-2 rounded-lg hover:bg-black/5 transition-colors"
          onClick={() => setOpen(v => !v)} aria-label="Toggle menu">
          {open ? <X className="w-5 h-5 text-[#263238]" /> : <Menu className="w-5 h-5 text-[#263238]" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-[#E8ECF0] px-6 py-5 flex flex-col gap-4 shadow-lg">
          {['Features', 'How it works', 'Pricing'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(' ', '-')}`}
              className="text-[14px] font-medium text-[#78889B]" onClick={() => setOpen(false)}>{l}</a>
          ))}
          <div className="border-t border-[#E8ECF0] pt-4 flex flex-col gap-3">
            <Link href="/login" className="text-[14px] font-medium text-[#78889B] text-center py-2">Log in</Link>
            <Link href="/signup"
              className="text-[14px] font-semibold text-white py-3 rounded-full text-center"
              style={{ background: '#0038A8' }}>
              Get started free
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

/* ─── Hero CRM Card ─────────────────────────────────────────────────────────── */

const HERO_CIRC = 2 * Math.PI * 36

/* Dashboard-matched palette */
const H_TEXT   = '#263238'   // dashboard TEXT
const H_MID    = '#455A64'   // dashboard MUTED2
const H_MUTE   = '#78889B'   // dashboard MUTED
const H_BORDER = '#E8ECF0'   // dashboard BORDER
const H_ROW    = '#F5F6FA'   // dashboard BG
const H_BLUE   = '#1D4ED8'   // dashboard BLUE
const H_VIO    = '#7C3AED'
const H_GRN    = '#059669'

const CARD_EASE = [0.22, 1, 0.36, 1] as const

function HeroSlide1({ secs }: { secs: number }) {
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
        style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.13)' }}>
        <span className="size-2 rounded-full bg-red-500 shrink-0"
          style={{ animation: 'bento-timer-pulse 1s ease-in-out infinite' }} />
        <span className="flex-1 tabular-nums font-semibold" style={{ fontSize: 12, color: H_TEXT }}>
          New lead · {mm}:{ss} ago
        </span>
        <span className="font-bold px-2 py-0.5 rounded-full text-white"
          style={{ fontSize: 10, background: H_BLUE }}>99acres</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative shrink-0 size-[68px]">
          <svg viewBox="0 0 88 88" width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="44" cy="44" r="36" fill="none" stroke={H_BORDER} strokeWidth="8" />
            <circle cx="44" cy="44" r="36" fill="none" stroke={H_BLUE} strokeWidth="8"
              strokeDasharray={`${0.94 * HERO_CIRC} ${HERO_CIRC}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black leading-none tabular-nums" style={{ fontSize: 19, color: H_TEXT }}>94</span>
            <span className="font-medium" style={{ fontSize: 8, color: H_MUTE }}>/100</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-bold truncate" style={{ fontSize: 14, color: H_TEXT }}>Rajesh Sharma</span>
          <span className="truncate" style={{ fontSize: 11, color: H_MUTE }}>3BHK · Whitefield, Blr</span>
          <span className="self-start px-2 py-0.5 rounded-full font-semibold"
            style={{ fontSize: 10, background: 'rgba(29,78,216,0.08)', color: H_BLUE, border: '1px solid rgba(29,78,216,0.15)' }}>
            AI: High Intent
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {([
          { Icon: Eye,       text: 'Viewed 12 listings',  color: H_BLUE },
          { Icon: PhoneCall, text: 'Called twice in 24h', color: H_MID  },
          { Icon: Banknote,  text: 'Budget confirmed',    color: H_GRN  },
        ] as { Icon: React.ElementType; text: string; color: string }[]).map(({ Icon, text, color }) => (
          <div key={text} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: H_ROW, border: `1px solid ${H_BORDER}` }}>
            <Icon className="size-3 shrink-0" style={{ color }} />
            <span className="font-medium" style={{ fontSize: 11, color: H_MID }}>{text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-white"
        style={{ fontSize: 12, background: H_BLUE }}>
        <Zap className="size-3.5 shrink-0" />
        Start call — highest close probability
      </div>
    </div>
  )
}

function HeroSlide2() {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
        style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.14)' }}>
        <span className="size-2 rounded-full shrink-0"
          style={{ background: H_VIO, animation: 'bento-timer-pulse 2s ease-in-out infinite' }} />
        <span className="flex-1 font-semibold" style={{ fontSize: 12, color: H_TEXT }}>5 leads scored by AI</span>
        <span className="font-bold px-2 py-0.5 rounded-full text-white"
          style={{ fontSize: 10, background: H_VIO }}>Just now</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative shrink-0 size-[68px]">
          <svg viewBox="0 0 88 88" width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="44" cy="44" r="36" fill="none" stroke={H_BORDER} strokeWidth="8" />
            <circle cx="44" cy="44" r="36" fill="none" stroke={H_VIO} strokeWidth="8"
              strokeDasharray={`${0.87 * HERO_CIRC} ${HERO_CIRC}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black leading-none tabular-nums" style={{ fontSize: 19, color: H_TEXT }}>87</span>
            <span className="font-medium" style={{ fontSize: 8, color: H_MUTE }}>/100</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-bold truncate" style={{ fontSize: 14, color: H_TEXT }}>Priya Mehta</span>
          <span className="truncate" style={{ fontSize: 11, color: H_MUTE }}>2BHK · Koramangala, Blr</span>
          <span className="self-start px-2 py-0.5 rounded-full font-semibold"
            style={{ fontSize: 10, background: 'rgba(124,58,237,0.08)', color: H_VIO, border: '1px solid rgba(124,58,237,0.15)' }}>
            AI: Warm Intent
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {([
          { Icon: Calendar,   text: 'Requested site visit',     color: H_VIO  },
          { Icon: BadgeCheck, text: 'Loan pre-approval shared', color: H_BLUE },
          { Icon: Building2,  text: 'Enquired 3 properties',    color: H_GRN  },
        ] as { Icon: React.ElementType; text: string; color: string }[]).map(({ Icon, text, color }) => (
          <div key={text} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: H_ROW, border: `1px solid ${H_BORDER}` }}>
            <Icon className="size-3 shrink-0" style={{ color }} />
            <span className="font-medium" style={{ fontSize: 11, color: H_MID }}>{text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-white"
        style={{ fontSize: 12, background: H_VIO }}>
        <User className="size-3.5 shrink-0" />
        Assign to agent — follow up today
      </div>
    </div>
  )
}

function HeroSlide3() {
  const steps = ['Lead', 'Qualified', 'Site Visit', 'Closed'] as const
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
        style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.14)' }}>
        <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="flex-1 font-semibold" style={{ fontSize: 12, color: H_TEXT }}>Deal confirmed</span>
        <span className="font-bold px-2 py-0.5 rounded-full text-white"
          style={{ fontSize: 10, background: H_GRN }}>Closed</span>
      </div>

      <div className="px-3 py-2.5 rounded-lg" style={{ background: H_ROW, border: `1px solid ${H_BORDER}` }}>
        <div className="font-black tabular-nums leading-none" style={{ fontSize: 27, color: H_TEXT }}>&#x20B9;1.2 Cr</div>
        <div className="mt-1 flex items-center gap-3" style={{ fontSize: 11, color: H_MUTE }}>
          <span>3BHK · Koramangala</span>
          <span className="flex items-center gap-1"><Clock className="size-3" /> 8 days</span>
        </div>
      </div>

      <div className="relative py-1">
        <div className="absolute top-[10px] left-[10%] right-[10%] h-px" style={{ background: H_GRN }} />
        <div className="relative grid grid-cols-4 gap-1">
          {steps.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="size-5 rounded-full flex items-center justify-center z-10 relative"
                style={{ background: i === steps.length - 1 ? H_BLUE : H_GRN }}>
                {i === steps.length - 1
                  ? <Trophy className="size-2.5 text-white" />
                  : <CheckCircle className="size-2.5 text-white" />}
              </div>
              <span className="text-[8px] font-semibold text-center leading-tight"
                style={{ color: H_MUTE }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg" style={{ background: H_ROW, border: `1px solid ${H_BORDER}` }}>
          <div className="flex items-center gap-1 font-medium mb-0.5" style={{ fontSize: 9, color: H_MUTE }}>
            <Clock className="size-3" /> Closed in
          </div>
          <div className="font-black tabular-nums" style={{ fontSize: 17, color: H_TEXT }}>8 days</div>
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: H_ROW, border: `1px solid ${H_BORDER}` }}>
          <div className="flex items-center gap-1 font-medium mb-0.5" style={{ fontSize: 9, color: H_MUTE }}>
            <Star className="size-3" /> Commission
          </div>
          <div className="font-black tabular-nums" style={{ fontSize: 17, color: H_TEXT }}>&#x20B9;72K</div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-white"
        style={{ fontSize: 12, background: H_BLUE }}>
        <BarChart3 className="size-3.5 shrink-0" />
        View full pipeline
      </div>
    </div>
  )
}

function TeakHeroCard() {
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion()
  const [secs, setSecs] = useState(107)

  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setActive(prev => (prev + 1) % 3), 3600)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative select-none" style={{ width: 304 }}>

      {/* Ambient glow — pulses slowly */}
      <motion.div
        className="absolute -inset-8 -z-10 rounded-3xl blur-3xl"
        animate={{ opacity: [0.13, 0.22, 0.13] }}
        transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
        style={{ background: 'radial-gradient(ellipse at 60% 40%, #3B82F6, #7C3AED)' }}
      />

      {/* Shadow card stack */}
      <div className="absolute inset-0 rounded-xl" style={{
        transform: 'translateY(16px) scale(0.90)',
        background: '#C4CDD6',
        zIndex: 1,
      }} />
      <div className="absolute inset-0 rounded-xl" style={{
        transform: 'translateY(8px) scale(0.95)',
        background: '#DAE0E8',
        border: `1px solid #C4CDD6`,
        zIndex: 2,
      }} />

      {/* Main card */}
      <div className="rounded-xl overflow-hidden" style={{
        position: 'relative',
        zIndex: 3,
        background: '#FFFFFF',
        border: `1px solid ${H_BORDER}`,
        boxShadow: '0 20px 40px rgba(38,50,56,0.13), 0 4px 10px rgba(38,50,56,0.07)',
      }}>

        {/* Static nav — never flips */}
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#080D18' }}>
          <div className="flex items-center gap-2">
            <div className="size-5 rounded flex items-center justify-center text-white font-black"
              style={{ background: H_BLUE, fontSize: 8 }}>RE</div>
            <span className="font-semibold" style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>RealEdge CRM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400"
              style={{ animation: 'bento-timer-pulse 2s ease-in-out infinite' }} />
            <span className="font-medium" style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Live</span>
          </div>
        </div>

        {/* AnimatePresence slide area — initial={false} skips entrance on first load */}
        <div style={{ perspective: '1000px' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={reduced ? { opacity: 0 } : { rotateY: -30, opacity: 0, scale: 0.97 }}
              animate={reduced ? { opacity: 1 } : { rotateY: 0, opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { rotateY: 30, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.42, ease: CARD_EASE }}
              style={{ transformOrigin: 'center center' }}
            >
              {active === 0 && <HeroSlide1 secs={secs} />}
              {active === 1 && <HeroSlide2 />}
              {active === 2 && <HeroSlide3 />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center items-center gap-1.5 mt-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-full" style={{
            height: 5,
            width: active === i ? 20 : 5,
            background: active === i ? H_BLUE : H_BORDER,
            transition: 'width 380ms cubic-bezier(0.22,1,0.36,1), background 380ms ease',
          }} />
        ))}
      </div>

      {/* Floating badges */}
      <div className="absolute -top-4 -right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap font-semibold"
        style={{
          fontSize: 11, background: '#FFFFFF', border: `1px solid ${H_BORDER}`, color: H_TEXT,
          boxShadow: '0 4px 14px rgba(38,50,56,0.10)',
          animation: 'lp-float 4s ease-in-out infinite',
        }}>
        <Home className="size-3" style={{ color: H_BLUE }} /> 24 leads synced
      </div>
      <div className="absolute -bottom-4 -left-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap font-semibold"
        style={{
          fontSize: 11, background: '#FFFFFF', border: `1px solid ${H_BORDER}`, color: H_GRN,
          boxShadow: '0 4px 14px rgba(38,50,56,0.10)',
          animation: 'lp-float 5s ease-in-out infinite', animationDelay: '1.8s',
        }}>
        <CheckCircle className="size-3" /> 3 deals closing today
      </div>
    </div>
  )
}

/* ─── Interactive grid — individual cells light up near cursor ────────────── */
const IGRID_COLS = 36
const IGRID_ROWS = 22

function InteractiveGrid() {
  const cellsRef = useRef<(HTMLDivElement | null)[]>(Array(IGRID_COLS * IGRID_ROWS).fill(null))
  const prevLit = useRef<Set<number>>(new Set())

  useEffect(() => {
    const hero = document.getElementById('lp-hero')
    if (!hero) return
    const heroEl = hero

    function handleMove(e: MouseEvent) {
      const rect = heroEl.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const col = Math.floor((x / rect.width) * IGRID_COLS)
      const row = Math.floor((y / rect.height) * IGRID_ROWS)

      // reset previously lit cells
      prevLit.current.forEach(idx => {
        const el = cellsRef.current[idx]
        if (el) el.style.background = ''
      })
      prevLit.current.clear()

      // light up cells within radius
      const R = 2.8
      for (let r = Math.max(0, row - 3); r <= Math.min(IGRID_ROWS - 1, row + 3); r++) {
        for (let c = Math.max(0, col - 3); c <= Math.min(IGRID_COLS - 1, col + 3); c++) {
          const dist = Math.sqrt((r - row) ** 2 + (c - col) ** 2)
          if (dist > R) continue
          const alpha = ((1 - dist / R) * 0.26).toFixed(3)
          const idx = r * IGRID_COLS + c
          const el = cellsRef.current[idx]
          if (el) {
            el.style.background = `rgba(0,71,171,${alpha})`
            prevLit.current.add(idx)
          }
        }
      }
    }

    function handleLeave() {
      prevLit.current.forEach(idx => {
        const el = cellsRef.current[idx]
        if (el) el.style.background = ''
      })
      prevLit.current.clear()
    }

    hero.addEventListener('mousemove', handleMove)
    hero.addEventListener('mouseleave', handleLeave)
    return () => {
      hero.removeEventListener('mousemove', handleMove)
      hero.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        maskImage: 'radial-gradient(ellipse 92% 88% at 50% 44%, black 0%, transparent 88%)',
        WebkitMaskImage: 'radial-gradient(ellipse 92% 88% at 50% 44%, black 0%, transparent 88%)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${IGRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${IGRID_ROWS}, 1fr)`,
          width: '100%',
          height: '100%',
        }}
      >
        {Array.from({ length: IGRID_COLS * IGRID_ROWS }).map((_, i) => (
          <div
            key={i}
            ref={el => { cellsRef.current[i] = el }}
            style={{ border: '1px solid rgba(148,163,184,0.22)' }}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Hero Dashboard Mockup ──────────────────────────────────────────────── */
const DASH_SALES_DATA = [
  { month: 'Jan', v: 8  },
  { month: 'Feb', v: 11 },
  { month: 'Mar', v: 44 },
  { month: 'Apr', v: 14 },
  { month: 'May', v: 22 },
  { month: 'Jun', v: 31 },
]

const DASH_BAR_DATA = [
  { label: '4',  p: 55, q: 80, w: 40 },
  { label: '8',  p: 70, q: 60, w: 50 },
  { label: '16', p: 85, q: 90, w: 70 },
  { label: '32', p: 100,q: 75, w: 55 },
  { label: '64', p: 65, q: 85, w: 60 },
]

const DASH_NAV = [
  { Icon: BarChart3, label: 'Dashboard',  active: false },
  { Icon: Users,     label: 'Leads',      active: false },
  { Icon: PhoneCall, label: 'Calls',      active: false },
  { Icon: Target,    label: 'Pipeline',   active: false },
  { Icon: Building2, label: 'Properties', active: false },
  { Icon: TrendingUp,label: 'Analytics',  active: true  },
  { Icon: Calendar,  label: 'Tasks',      active: false },
]

const DASH_LEADS = [
  { name: 'Rajesh Sharma', company: 'AcmecropTech',  status: 'Hot',    sc: '#DC2626', val: '₹2.1Cr' },
  { name: 'Priya Mehta',   company: 'MagicBricks',   status: 'Warm',   sc: '#F59E0B', val: '₹85L'   },
  { name: 'Vikram Singh',  company: 'Housing.com',   status: 'Active', sc: '#059669', val: '₹1.4Cr' },
]

function HeroDashboardMock() {
  return (
    <div className="w-full h-full flex flex-col select-none" style={{
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(0,0,0,0.18)',
    }}>
      {/* Browser chrome — dark/black */}
      <div className="flex items-center gap-3 px-4" style={{ height: 32, background: '#1C1C1E', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex gap-1.5">
          {['#FC6C6C', '#FDBC40', '#34C759'].map(c => (
            <div key={c} className="size-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            <Shield className="size-2.5" style={{ color: 'rgba(255,255,255,0.35)' }} />
            app.leadgapcrm.in/analytics
          </div>
        </div>
        <div className="size-4" />
      </div>

      {/* App shell — all white */}
      <div className="flex flex-1 overflow-hidden" style={{ background: '#FFFFFF' }}>

        {/* Main content — full width, no sidebar */}
        <div className="flex-1 flex flex-col" style={{ background: '#FFFFFF', overflow: 'hidden' }}>

          {/* Header bar with logo */}
          <div className="flex items-center gap-3 px-4 shrink-0" style={{ height: 44, background: '#FFFFFF', borderBottom: '1px solid #EFEFEF' }}>
            {/* Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="size-6 rounded flex items-center justify-center font-black text-white" style={{ background: '#0047AB', fontSize: 8 }}>RE</div>
              <span className="font-bold tracking-tight" style={{ fontSize: 12, color: '#1A1F27' }}>Lead Gap CRM</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 px-2.5 rounded" style={{ width: 160, height: 26, background: '#F5F6FA', border: '1px solid #EFEFEF' }}>
              <Search className="size-3 shrink-0" style={{ color: '#A4B1BE' }} />
              <span style={{ fontSize: 9.5, color: '#A4B1BE' }}>Search leads, contacts...</span>
            </div>
            <div className="size-7 rounded flex items-center justify-center" style={{ background: '#F5F6FA', border: '1px solid #EFEFEF' }}>
              <Bell className="size-3.5" style={{ color: '#78889B' }} />
            </div>
            <div className="flex items-center gap-2 pl-3" style={{ borderLeft: '1px solid #EFEFEF' }}>
              <div className="size-7 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ background: '#0047AB', fontSize: 9 }}>RS</div>
              <div>
                <div className="font-semibold" style={{ fontSize: 10, color: '#263238' }}>Rahul Sharma</div>
                <div style={{ fontSize: 8.5, color: '#78889B' }}>rahul@leadgapcrm.in</div>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col p-4 gap-3" style={{ overflow: 'hidden', background: '#F8F9FB' }}>

            {/* Page title row */}
            <div className="flex items-center justify-between shrink-0">
              <h2 className="font-bold" style={{ fontSize: 14, color: '#263238' }}>Analytics</h2>
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded" style={{ fontSize: 8.5, background: '#F5F6FA', border: '1px solid #E8ECF0', color: '#78889B' }}>
                  Jul 27, 2026
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded font-semibold text-white"
                  style={{ fontSize: 8.5, background: '#0047AB' }}>
                  <Zap className="size-2.5" /> AI Insights
                </div>
              </div>
            </div>

            {/* Two-column cards */}
            <div className="flex gap-3 shrink-0">

              {/* Left: Total revenue + area chart */}
              <div className="flex-1 rounded p-3" style={{ background: '#FFFFFF', border: '1px solid #E8ECF0' }}>
                <div className="font-semibold mb-1" style={{ fontSize: 8.5, color: '#78889B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total revenue</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-black tabular-nums" style={{ fontSize: 22, color: '#263238', lineHeight: 1 }}>₹46.5L</span>
                  <span style={{ fontSize: 8.5, color: '#78889B' }}>Last month ₹49.2L</span>
                  <span className="px-1.5 py-0.5 rounded font-bold" style={{ fontSize: 7.5, background: 'rgba(0,71,171,0.08)', color: '#0047AB' }}>+55%</span>
                </div>
                {/* Progress bar */}
                <div className="flex gap-0.5 rounded overflow-hidden mb-1" style={{ height: 5 }}>
                  <div style={{ width: '62%', background: '#0047AB', borderRadius: 3 }} />
                  <div style={{ width: '24%', background: '#3B82F6', borderRadius: 3 }} />
                  <div style={{ width: '14%', background: '#93C5FD', borderRadius: 3 }} />
                </div>
                <div className="mb-2" style={{ fontSize: 7.5, color: '#78889B' }}>Next target ₹55.2L</div>
                {/* Area chart */}
                <ResponsiveContainer width="100%" height={68}>
                  <AreaChart data={DASH_SALES_DATA} margin={{ top: 4, right: 2, left: -36, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dash-rev-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0047AB" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#0047AB" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 7, fill: '#78889B' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 8, border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', borderRadius: 4, padding: '3px 8px' }}
                      formatter={(v: number) => [`₹${v}L`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="v" stroke="#0047AB" strokeWidth={1.5} fill="url(#dash-rev-grad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Right: Sales overview + bars + returning visits */}
              <div className="flex flex-col gap-2.5" style={{ width: 188 }}>

                {/* Sales overview + bar chart */}
                <div className="rounded p-3" style={{ background: '#FFFFFF', border: '1px solid #E8ECF0' }}>
                  <div className="font-semibold mb-0.5" style={{ fontSize: 8.5, color: '#78889B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sales overview</div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-black tabular-nums" style={{ fontSize: 18, color: '#263238', lineHeight: 1.2 }}>₹18K</span>
                    <span className="font-semibold" style={{ fontSize: 8.5, color: '#059669' }}>+28.09% ↗</span>
                  </div>
                  {/* Grouped bars */}
                  <div className="flex items-end gap-1.5" style={{ height: 52 }}>
                    {DASH_BAR_DATA.map(({ label, p, q, w }) => (
                      <div key={label} className="flex-1 flex flex-col items-center gap-0">
                        <div className="flex items-end gap-px w-full" style={{ flex: 1 }}>
                          <div style={{ flex: 1, height: `${p}%`, background: '#0047AB', borderRadius: '1px 1px 0 0', minHeight: 3 }} />
                          <div style={{ flex: 1, height: `${q}%`, background: '#3B82F6', borderRadius: '1px 1px 0 0', minHeight: 3 }} />
                          <div style={{ flex: 1, height: `${w}%`, background: '#93C5FD', borderRadius: '1px 1px 0 0', minHeight: 3 }} />
                        </div>
                        <div style={{ fontSize: 7, color: '#A4B1BE', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                    {[['#0047AB', 'Proposals'], ['#3B82F6', 'Qualified'], ['#93C5FD', 'Closed won']].map(([c, l]) => (
                      <div key={l} className="flex items-center gap-1">
                        <div className="size-1.5 rounded-sm shrink-0" style={{ background: c }} />
                        <span style={{ fontSize: 7, color: '#78889B' }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Returning visits */}
                <div className="rounded p-3" style={{ background: '#FFFFFF', border: '1px solid #E8ECF0' }}>
                  <div className="font-semibold mb-2" style={{ fontSize: 8.5, color: '#78889B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Returning visits</div>
                  {[{ label: 'July', pct: 45 }, { label: 'October', pct: 36 }].map(({ label, pct }) => (
                    <div key={label} className="mb-2 last:mb-0">
                      <div className="flex justify-between mb-1" style={{ fontSize: 9, color: '#455A64' }}>
                        <span>{label}</span>
                        <span className="font-bold tabular-nums">{pct}%</span>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height: 5, background: '#F0F3F7' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0047AB, #3B82F6)', borderRadius: 999 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Contacts table */}
            <div className="rounded overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8ECF0', flex: 1 }}>
              <div className="px-4 py-2 font-semibold" style={{ fontSize: 9.5, color: '#263238', borderBottom: '1px solid #E8ECF0', background: '#F5F6FA' }}>
                Manage your contacts
              </div>
              <div className="grid px-4 py-1.5" style={{
                gridTemplateColumns: '2fr 1.5fr 72px 72px',
                borderBottom: '1px solid #F5F6FA',
                fontSize: 8, fontWeight: 600, color: '#78889B', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {['Name', 'Company', 'Status', 'Value'].map(h => <div key={h}>{h}</div>)}
              </div>
              {DASH_LEADS.map(({ name, company, status, sc, val }) => (
                <div key={name} className="grid px-4 py-2 items-center"
                  style={{ gridTemplateColumns: '2fr 1.5fr 72px 72px', borderBottom: '1px solid #F5F6FA' }}>
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ background: 'rgba(0,71,171,0.08)', color: '#0047AB', fontSize: 8 }}>
                      {name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <span className="font-semibold" style={{ fontSize: 10, color: '#263238' }}>{name}</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: '#78889B' }}>{company}</div>
                  <div className="flex items-center gap-1">
                    <div className="size-1.5 rounded-full" style={{ background: sc }} />
                    <span className="font-semibold" style={{ fontSize: 9.5, color: sc }}>{status}</span>
                  </div>
                  <div className="font-bold tabular-nums" style={{ fontSize: 10, color: '#263238' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Hero — centered text block ─────────────────────────────────────────── */
function Hero() {
  return (
    <section id="lp-hero" className="relative flex flex-col justify-center min-h-[78vh] pt-14 overflow-hidden">
      {/* Cobalt blue gradient blobs */}
      <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 0 }}>
        <div className="absolute" style={{
          top: '-12%', left: '-8%', width: 760, height: 760,
          background: 'radial-gradient(ellipse at center, rgba(0,71,171,0.22) 0%, transparent 62%)',
          filter: 'blur(52px)',
        }} />
        <div className="absolute" style={{
          top: '-16%', right: '-6%', width: 680, height: 680,
          background: 'radial-gradient(ellipse at center, rgba(26,111,230,0.18) 0%, transparent 62%)',
          filter: 'blur(52px)',
        }} />
        <div className="absolute" style={{
          top: '42%', left: '22%', width: 560, height: 480,
          background: 'radial-gradient(ellipse at center, rgba(0,163,255,0.08) 0%, transparent 65%)',
          filter: 'blur(64px)',
        }} />
      </div>


      <div className="relative flex flex-col items-center text-center px-6 py-8 max-w-[720px] mx-auto" style={{ zIndex: 2 }}>
        {/* Announcement pill */}
        <div
          className="lp-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-semibold mb-4 md:mb-7"
          style={{ fontSize: 12, opacity: 0, animationDelay: '0.05s', background: 'rgba(0,71,171,0.06)', border: '1px solid rgba(0,71,171,0.16)', color: '#0047AB' }}
        >
          <span className="size-1.5 rounded-full bg-[#0047AB]" style={{ animation: 'bento-timer-pulse 2s ease-in-out infinite' }} />
          New &middot; AI-powered lead management is here
        </div>

        {/* Headline */}
        <h1
          className="lp-fade-up font-extrabold leading-[1.06] tracking-tight text-[#1A1F27] mb-3 md:mb-6 text-balance"
          style={{ fontSize: 'clamp(36px, 6vw, 68px)', opacity: 0, animationDelay: '0.14s' }}
        >
          The CRM that turns<br />
          leads into{' '}
          <em style={{ color: '#0038A8', fontStyle: 'italic' }}>closed deals.</em>
        </h1>

        {/* Sub */}
        <p
          className="lp-fade-up leading-relaxed mb-6 md:mb-9 text-pretty"
          style={{ fontSize: 15, color: '#78889B', maxWidth: 420, opacity: 0, animationDelay: '0.26s' }}
        >
          Auto-capture from 99acres, MagicBricks &amp; Housing.com.
          AI follow-ups. Real-time pipeline. Built for Indian real estate.
        </p>

        {/* CTAs */}
        <div className="lp-fade-up flex flex-col sm:flex-row justify-center gap-3 w-full sm:w-auto mb-4 md:mb-5" style={{ opacity: 0, animationDelay: '0.38s' }}>
          <Link
            href="/signup"
            className="flex items-center justify-center gap-2 px-7 py-3 rounded-full font-semibold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
            style={{ fontSize: 15, background: '#0047AB', boxShadow: '0 8px 28px rgba(0,71,171,0.30)' }}
          >
            Start free — no card needed <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-7 py-3 rounded-full font-semibold transition-all duration-200 hover:bg-white hover:shadow-sm"
            style={{ fontSize: 15, border: '1.5px solid #E8ECF0', background: 'rgba(255,255,255,0.65)', color: '#263238' }}
          >
            Book a demo <ChevronRight className="w-4 h-4 text-[#78889B]" />
          </Link>
        </div>

        {/* Trust line */}
        <p className="lp-fade-up" style={{ fontSize: 11, color: '#A4B1BE', opacity: 0, animationDelay: '0.50s' }}>
          No credit card required &middot; Free 14-day trial &middot; Setup in 5 minutes
        </p>

      </div>
    </section>
  )
}

/* ─── Hero scroll reveal — 3D perspective tilt ───────────────────────────── */
function HeroScrollDash() {
  return (
    <div style={{ background: '#F4F8FD' }}>
      <ContainerScroll titleComponent={<></>}>
        <HeroDashboardMock />
      </ContainerScroll>
    </div>
  )
}

/* ─── KPI Dashboard ──────────────────────────────────────────────────────── */
const WEEKLY_DATA = [
  { day: 'Mon', leads: 8  },
  { day: 'Tue', leads: 14 },
  { day: 'Wed', leads: 11 },
  { day: 'Thu', leads: 19 },
  { day: 'Fri', leads: 16 },
  { day: 'Sat', leads: 22 },
  { day: 'Sun', leads: 17 },
]

const RECENT_LEADS = [
  { name: 'Rajesh Sharma', budget: '₹1.2 Cr', source: 'MagicBricks', status: 'Hot',  time: '2m ago'  },
  { name: 'Priya Mehta',   budget: '₹85 L',   source: '99acres',      status: 'Warm', time: '14m ago' },
  { name: 'Vikram Singh',  budget: '₹2.1 Cr', source: 'Housing.com',  status: 'Hot',  time: '1h ago'  },
]

function DonutRing({ pct }: { pct: number }) {
  const r = 42, cx = 54, cy = 54, size = 108
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="kpi-donut" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0047AB" />
          <stop offset="100%" stopColor="#0038A8" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0F3F7" strokeWidth="10" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="url(#kpi-donut)"
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy - 5} textAnchor="middle" fill="#1A1F27" fontSize="18" fontWeight="800" fontFamily="var(--font-jakarta),sans-serif">
        {pct}%
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fill="#A4B1BE" fontSize="8" fontFamily="var(--font-jakarta),sans-serif">
        CONVERTED
      </text>
    </svg>
  )
}

function KPIDashboard() {
  const [tab, setTab] = useState<'overview' | 'pipeline' | 'activity'>('overview')
  const ref = useScrollReveal()

  return (
    <section ref={ref} className="py-16 px-6" style={{ background: 'white' }}>
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <div className="lp-in lp-in-delay-1 text-center mb-8">
          <p className="text-[12px] font-semibold text-[#A4B1BE] uppercase tracking-[0.15em]">
            Real-time visibility across your entire team
          </p>
        </div>

        {/* Dashboard card */}
        <div
          className="lp-in lp-in-delay-2 rounded-3xl overflow-hidden"
          style={{
            border: '1px solid #E8ECF0',
            boxShadow: '0 32px 80px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
            background: 'white',
          }}
        >
          {/* Header bar */}
          <div
            className="px-6 py-4 flex items-center justify-between flex-wrap gap-3"
            style={{ borderBottom: '1px solid #F0F3F7', background: '#FAFBFC' }}
          >
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live</span>
                </div>
                <div className="text-[14px] font-bold text-[#1A1F27]">Lead Performance</div>
              </div>

              {/* Tabs */}
              <div className="flex gap-0.5 rounded-lg p-1" style={{ background: '#EFEFEF' }}>
                {(['overview', 'pipeline', 'activity'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-all duration-200"
                    style={
                      tab === t
                        ? { background: 'white', color: '#1A1F27', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                        : { color: '#78889B' }
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-[#78889B]"
              style={{ border: '1px solid #E8ECF0', background: 'white' }}
            >
              <Clock className="w-3 h-3" />
              Last 7 days
            </div>
          </div>

          {/* 3-column body */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#F0F3F7]">

            {/* ── Col 1: Conversion donut ── */}
            <div className="p-6 flex flex-col gap-4">
              <div className="text-[10px] font-bold text-[#A4B1BE] uppercase tracking-widest">Conversion Rate</div>

              <div className="flex items-center gap-4">
                <DonutRing pct={34} />
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Hot leads',  count: 12, color: '#0047AB' },
                    { label: 'Warm',       count: 18, color: '#F59E0B' },
                    { label: 'Cold',       count: 9,  color: '#CBD5E1' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 text-[11px]">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[#78889B] flex-1">{s.label}</span>
                      <span className="font-bold text-[#1A1F27]">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
                style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.14)' }}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-emerald-700 font-semibold">+21% vs last month</span>
              </div>
            </div>

            {/* ── Col 2: Area chart + leads ── */}
            <div className="p-6 flex flex-col gap-4">
              <div className="text-[10px] font-bold text-[#A4B1BE] uppercase tracking-widest">Lead Inflow · 7 days</div>

              <div style={{ height: 88 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={WEEKLY_DATA} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0047AB" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0047AB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#A4B1BE' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1A1F27', border: 'none', borderRadius: 8, fontSize: 11, color: 'white', padding: '6px 10px' }}
                      cursor={{ stroke: '#0047AB', strokeWidth: 1, strokeDasharray: '4 2' }}
                      formatter={(v: number) => [`${v} leads`, '']}
                    />
                    <Area type="monotone" dataKey="leads" stroke="#0047AB" strokeWidth={2} fill="url(#area-fill)" dot={false} activeDot={{ r: 4, fill: '#0047AB', stroke: 'white', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="text-[10px] font-bold text-[#A4B1BE] uppercase tracking-widest">Recent leads</div>

              <div className="flex flex-col gap-3">
                {RECENT_LEADS.map((lead, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ background: '#0047AB' }}
                    >
                      {lead.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[#263238] truncate">{lead.name}</div>
                      <div className="text-[10px] text-[#A4B1BE]">{lead.source} · {lead.time}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[12px] font-bold text-[#1A1F27]">{lead.budget}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={lead.status === 'Hot'
                          ? { background: 'rgba(0,71,171,0.08)', color: '#0047AB' }
                          : { background: 'rgba(245,158,11,0.1)', color: '#D97706' }}
                      >
                        {lead.status === 'Hot' ? '🔥' : '🌡'} {lead.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Col 3: Pipeline + portals ── */}
            <div className="p-6 flex flex-col gap-5">
              <div className="text-[10px] font-bold text-[#A4B1BE] uppercase tracking-widest">Monthly Pipeline</div>

              <div>
                <div className="text-[34px] font-extrabold text-[#1A1F27] leading-none tracking-tight">₹8.4 Cr</div>
                <div className="text-[11px] text-[#78889B] mt-1.5 mb-3">of ₹12 Cr target</div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F0F3F7' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: '70%', background: '#0038A8' }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-[#A4B1BE]">
                  <span>₹0</span>
                  <span className="font-semibold text-[#0047AB]">70%</span>
                  <span>₹12 Cr</span>
                </div>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Avg deal size', val: '₹94 L' },
                  { label: 'Deals this month', val: '9' },
                  { label: 'Avg close time', val: '11 days' },
                  { label: 'Follow-ups sent', val: '143' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl" style={{ background: '#F4F8FD' }}>
                    <div className="text-[14px] font-extrabold text-[#1A1F27]">{s.val}</div>
                    <div className="text-[10px] text-[#A4B1BE] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Portals */}
              <div className="pt-2" style={{ borderTop: '1px solid #F0F3F7' }}>
                <div className="text-[10px] font-bold text-[#A4B1BE] uppercase tracking-widest mb-3">Portals connected</div>
                <div className="flex flex-wrap gap-2">
                  {['99acres', 'MagicBricks', 'Housing.com', 'NoBroker', 'Sq.Yards', 'CommonFloor'].map(p => (
                    <div
                      key={p}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.18)', color: '#059669' }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Portal marquee ──────────────────────────────────────────────────────── */
const PORTALS = [
  { name: '99acres',      dot: '#DC2626' },
  { name: 'MagicBricks',  dot: '#B91C1C' },
  { name: 'Housing.com',  dot: '#1D4ED8' },
  { name: 'NoBroker',     dot: '#047857' },
  { name: 'Square Yards', dot: '#0047AB' },
  { name: 'CommonFloor',  dot: '#7C3AED' },
  { name: 'PropTiger',    dot: '#C2410C' },
  { name: 'Makaan',       dot: '#0369A1' },
]

function PortalStrip() {
  const doubled = [...PORTALS, ...PORTALS]

  return (
    <section style={{ background: '#FAFAF8', borderTop: '1px solid #EDEAE3', borderBottom: '1px solid #EDEAE3' }}>
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] pt-7 pb-5" style={{ color: '#0047AB' }}>
        Leads auto-synced from India&apos;s top portals
      </p>

      <div
        className="relative overflow-hidden pb-7"
        style={{
          maskImage: 'linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)',
        }}
      >
        <div className="lp-marquee-track flex w-max gap-3 items-center">
          {doubled.map((p, i) => (
            <div key={i} className="flex items-center gap-2 px-3.5 py-1.5 whitespace-nowrap select-none"
              style={{ background: `${p.dot}12`, border: `1px solid ${p.dot}28`, borderRadius: 6 }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.dot }} />
              <span className="text-[13px] font-semibold tracking-tight" style={{ color: p.dot }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Bento Features (Dribbble minimal style) ─────────────────────────────── */

function BentoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {children}
    </div>
  )
}

function BentoCard({
  name, description, preview, className = '',
}: {
  name: string
  description: string
  preview: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl overflow-hidden bg-white ${className}`}
      style={{ border: '1px solid #E8ECF0' }}>
      <div className="relative overflow-hidden" style={{ background: '#F6F7F9', height: 260 }}>
        {preview}
      </div>
      <div className="px-5 py-4 border-t" style={{ borderColor: '#F0F2F5' }}>
        <h3 className="text-[14px] font-bold text-[#1A1F27] mb-1">{name}</h3>
        <p className="text-[12px] leading-relaxed" style={{ color: '#78889B' }}>{description}</p>
      </div>
    </div>
  )
}

/* ── Bento preview: Auto Lead Sync — Data Sharing Lottie ────────────────────── */
function PreviewLeadSync() {
  const [animData, setAnimData] = useState<object | null>(null)
  useEffect(() => {
    fetch('/lottie/data-sharing-service.json').then(r => r.json()).then(setAnimData)
  }, [])
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      {animData && Lottie ? (
        <Lottie
          animationData={animData}
          loop
          autoplay
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <div className="w-full h-full" />
      )}
    </div>
  )
}

/* ── Bento preview: Advanced Live Stats — interactive line/bar toggle ────────── */
function PreviewFeed() {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')
  const peak = Math.max(...REVENUE_DATA.map(d => d.v))
  const low  = Math.min(...REVENUE_DATA.map(d => d.v))
  const avg  = (REVENUE_DATA.reduce((s, d) => s + d.v, 0) / REVENUE_DATA.length).toFixed(1)

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 4, border: 'none', cursor: 'pointer',
    background: active ? '#0038A8' : 'transparent',
    color: active ? '#fff' : '#9BA8B5',
    boxShadow: active ? '0 2px 8px rgba(0,56,168,0.28)' : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.18s ease',
  })

  const statItems = [
    { label: 'Peak', value: `₹${peak} Cr`, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
    { label: 'Low',  value: `₹${low} Cr`,  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
    { label: 'Avg',  value: `₹${avg} Cr`,  color: '#0038A8', bg: '#EFF6FF', border: '#BFDBFE' },
  ]

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'linear-gradient(160deg, #F8FAFF 0%, #FDFCFB 100%)' }}>
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-1 shrink-0">
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#9BA8B5', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 3 }}>
            Team Revenue · Jul
          </p>
          <div className="flex items-end gap-2">
            <span style={{ fontSize: 30, fontWeight: 800, color: '#0D1117', lineHeight: 1, letterSpacing: '-0.03em' }}>
              ₹2.2 Cr
            </span>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 4, padding: '1px 6px' }}>
                ↑ +16%
              </span>
              <span style={{ fontSize: 9, color: '#9BA8B5' }}>vs Jun</span>
            </div>
          </div>
        </div>
        {/* Toggle */}
        <div className="flex gap-1 mt-1 p-1 rounded-lg" style={{ background: '#F1F3F8' }}>
          <button style={toggleStyle(chartType === 'line')} onClick={() => setChartType('line')}>
            <ChartLine size={13} weight="light" />
          </button>
          <button style={toggleStyle(chartType === 'bar')} onClick={() => setChartType('bar')}>
            <ChartBar size={13} weight="light" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: '1 1 0', minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <AreaChart data={REVENUE_DATA} margin={{ top: 6, right: 16, left: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="pf-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#0038A8" stopOpacity={0.22} />
                  <stop offset="75%"  stopColor="#0038A8" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="#0038A8" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#EEF0F5" strokeDasharray="0" />
              <XAxis dataKey="m" tick={{ fontSize: 8, fill: '#C5CDD8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, border: '1px solid #E8ECF0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', padding: '6px 12px', background: '#fff' }}
                formatter={(v: number) => [`₹${v} Cr`, 'Revenue']}
                labelStyle={{ color: '#9BA8B5', fontSize: 9, marginBottom: 2 }}
                cursor={{ stroke: 'rgba(0,56,168,0.1)', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="v" stroke="#0038A8" strokeWidth={2} fill="url(#pf-area)" dot={false}
                activeDot={{ r: 4, fill: '#0038A8', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          ) : (
            <BarChart data={REVENUE_DATA} margin={{ top: 6, right: 16, left: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="pf-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#0038A8" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#0047AB" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#EEF0F5" strokeDasharray="0" />
              <XAxis dataKey="m" tick={{ fontSize: 8, fill: '#C5CDD8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, border: '1px solid #E8ECF0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', padding: '6px 12px', background: '#fff' }}
                formatter={(v: number) => [`₹${v} Cr`, 'Revenue']}
                labelStyle={{ color: '#9BA8B5', fontSize: 9, marginBottom: 2 }}
                cursor={{ fill: 'rgba(0,56,168,0.04)' }}
              />
              <Bar dataKey="v" fill="url(#pf-bar)" radius={[3, 3, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Stats row — 3 color-coded boxes */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2.5 shrink-0" style={{ borderTop: '1px solid #EDEEF2' }}>
        {statItems.map(s => (
          <div key={s.label} className="flex flex-col items-center py-1.5 rounded-lg"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <span style={{ fontSize: 7.5, fontWeight: 700, color: s.color, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Bento preview: Portal flow lottie (used by Activity Log cell) ──────────── */
function PreviewPortals() {
  const [animData, setAnimData] = useState<object | null>(null)
  useEffect(() => {
    fetch('/leads-g2g.json').then(r => r.json()).then(setAnimData)
  }, [])
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      {animData && Lottie ? (
        <Lottie
          animationData={animData}
          loop
          autoplay
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <div className="w-full h-full" />
      )}
    </div>
  )
}

/* ── Bento preview: Live Feed — Track growth lottie ─────────────────────────── */
function PreviewLiveFeed() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      <DotLottieReact
        src="/lottie/track-growth.lottie"
        loop
        autoplay
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}


/* ── Bento preview: Activity Log ─────────────────────────────────────────── */
const ACTIVITY_LOG_ROWS = [
  {
    init: 'RS', color: '#0047AB',
    name: 'Rahul S.', action: 'called', target: 'Priya Mehta',
    time: '2m ago',
    tag: { label: 'Connected', clr: '#059669', bg: '#ECFDF5' },
  },
  {
    init: 'AM', color: '#7C3AED',
    name: 'Amit M.', action: 'added note on site visit', target: '',
    time: '18m ago',
    note: 'Client open to ₹1.5 Cr, wants 3BHK near Sector 62.',
  },
  {
    init: 'NK', color: '#B45309',
    name: 'Neha K.', action: 'moved to', target: 'Negotiation',
    time: '45m ago',
    tag: { label: 'Negotiation', clr: '#B45309', bg: '#FEF3C7' },
  },
  {
    init: 'VR', color: '#059669',
    name: 'Vikram R.', action: 'closed deal —', target: 'Suresh K.',
    time: '1h ago',
    tag: { label: '₹1.2 Cr won', clr: '#059669', bg: '#ECFDF5' },
  },
]

function PreviewPipeline() {
  return (
    <div className="absolute inset-0 flex flex-col px-5 pt-4 pb-3 gap-2 overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#A4B1BE' }}>Activity log</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-[10px] font-medium" style={{ color: '#78889B' }}>Live</span>
        </div>
      </div>

      {/* activity rows */}
      {ACTIVITY_LOG_ROWS.slice(0, 3).map((row, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-lg overflow-hidden shrink-0"
          style={{ border: '1px solid #EEF0F4', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold shrink-0"
              style={{ background: row.color, fontSize: 9 }}
            >
              {row.init}
            </div>

            {/* text */}
            <div className="flex-1 min-w-0">
              <p className="leading-snug text-[11px]">
                <span className="font-semibold text-[#1A1F27]">{row.name} </span>
                <span style={{ color: '#78889B' }}>{row.action}{row.target ? ` ${row.target}` : ''}</span>
              </p>
              {row.note && (
                <p className="mt-0.5 truncate text-[10px]" style={{ color: '#A4B1BE' }}>{row.note}</p>
              )}
              {row.tag && (
                <span
                  className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-semibold leading-none"
                  style={{ background: row.tag.bg, color: row.tag.clr }}
                >
                  {row.tag.label}
                </span>
              )}
            </div>

            {/* time */}
            <span className="shrink-0 tabular-nums text-[10px]" style={{ color: '#C5CDD8' }}>{row.time}</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ─── Unique Features ───────────────────────────────────────────────────────── */

/* ── Mock 1: Globe with orbiting portal chips ───────────────────────────────── */
const GLOBE_PORTALS = [
  { label: '99acres',     color: '#E8173B', favicon: '/portals/99acres.png',     rx: 22, ry: 12, speed: 0.42, startAngle: 0.0  },
  { label: 'MagicBricks', color: '#E87722', favicon: '/portals/magicbricks.png', rx: 30, ry: 17, speed: 0.28, startAngle: 2.1  },
  { label: 'Housing',     color: '#0071BC', favicon: '/portals/housing.png',     rx: 22, ry: 12, speed: 0.42, startAngle: 3.8  },
  { label: 'NoBroker',    color: '#7C3AED', favicon: '/portals/nobroker.png',    rx: 30, ry: 17, speed: 0.28, startAngle: 0.85 },
  { label: 'CommonFloor', color: '#059669', favicon: '/portals/commonfloor.png', rx: 38, ry: 22, speed: 0.18, startAngle: 3.1  },
]

function LeadSyncMock() {
  const portalRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef     = useRef<number>(0)
  const t0Ref      = useRef<number>(0)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (prefersReduced) {
      GLOBE_PORTALS.forEach((p, i) => {
        const el = portalRefs.current[i]; if (!el) return
        el.style.left = `${50 + p.rx * Math.cos(p.startAngle)}%`
        el.style.top  = `${56 + p.ry * Math.sin(p.startAngle)}%`
        el.style.opacity = '0.85'
      })
      return
    }
    const animate = (now: number) => {
      if (!t0Ref.current) t0Ref.current = now
      const t = (now - t0Ref.current) * 0.001
      GLOBE_PORTALS.forEach((p, i) => {
        const el = portalRefs.current[i]; if (!el) return
        const a   = p.startAngle + t * p.speed
        const sin = Math.sin(a)
        el.style.left      = `${50 + p.rx * Math.cos(a)}%`
        el.style.top       = `${56 + p.ry * Math.sin(a)}%`
        el.style.transform = `translate(-50%,-50%) scale(${0.76 + 0.24 * ((sin + 1) / 2)})`
        el.style.opacity   = String(0.48 + 0.52 * ((sin + 1) / 2))
        el.style.zIndex    = sin > 0 ? '20' : '5'
      })
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { rafRef.current && cancelAnimationFrame(rafRef.current) }
  }, [prefersReduced])

  return (
    <div className="relative h-full overflow-hidden" style={{ background: '#070E1A' }}>
      {/* Starfield dots */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.55) 1px, transparent 1px)',
        backgroundSize: '34px 34px', opacity: 0.14,
      }} />

      {/* Orbit ellipses */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <ellipse cx="50%" cy="56%" rx="22%" ry="12%"
          fill="none" stroke="rgba(77,127,208,0.28)" strokeWidth="1" strokeDasharray="4 6" />
        <ellipse cx="50%" cy="56%" rx="30%" ry="17%"
          fill="none" stroke="rgba(77,127,208,0.20)" strokeWidth="1" strokeDasharray="4 6" />
        <ellipse cx="50%" cy="56%" rx="38%" ry="22%"
          fill="none" stroke="rgba(77,127,208,0.13)" strokeWidth="1" strokeDasharray="4 6" />
      </svg>

      {/* Globe sphere */}
      <div className="absolute" style={{
        left: 'calc(50% - 46px)', top: 'calc(56% - 46px)',
        width: 92, height: 92, borderRadius: '50%', zIndex: 10,
        background: 'radial-gradient(circle at 36% 30%, #2563EB 0%, #0038A8 50%, #001448 100%)',
        boxShadow: '0 0 0 1px rgba(77,127,208,0.35), 0 0 42px rgba(0,56,168,0.55)',
        overflow: 'hidden',
      }}>
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.22) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-black text-[12px] text-white tracking-tight select-none">LG</span>
        </div>
      </div>

      {/* Orbiting portal chips — animated via RAF */}
      {GLOBE_PORTALS.map((p, i) => (
        <div
          key={p.label}
          ref={el => { portalRefs.current[i] = el }}
          style={{
            position: 'absolute',
            left: `${50 + p.rx * Math.cos(p.startAngle)}%`,
            top:  `${56 + p.ry * Math.sin(p.startAngle)}%`,
            transform: 'translate(-50%,-50%)',
            opacity: 0.7, zIndex: 10,
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: '#fff', whiteSpace: 'nowrap',
            padding: '4px 9px 4px 5px', borderRadius: 20,
            boxShadow: `0 2px 10px rgba(0,0,0,0.25), 0 0 0 1px ${p.color}30`,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.favicon} alt={p.label} width={14} height={14}
              style={{ borderRadius: 2, display: 'block', imageRendering: 'auto' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#111', letterSpacing: 0 }}>
              {p.label}
            </span>
          </div>
        </div>
      ))}

      {/* Status bar */}
      <div className="absolute bottom-3 w-full flex justify-center" style={{ zIndex: 20 }}>
        <span className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: 'bento-timer-pulse 1.2s ease-in-out infinite' }} />
          Syncing leads live across 5 portals
        </span>
      </div>
    </div>
  )
}

/* ── Mock 2: AI chat (Zapmaii Dribbble reference) ───────────────────────────── */
const CHAT_SIDEBAR = ['Which leads to call?', 'Site visit follow-ups', 'Weekly conversion report']

const CHAT_MSGS = [
  { role: 'user', text: 'Which leads should I call first today?' },
  { role: 'ai',   text: 'Call Ravi Kumar (score 94) — no contact in 3 days. Then Priya Mehta (78) who just browsed 5 listings.' },
  { role: 'user', text: 'Set a follow-up for Ravi at 3 PM' },
  { role: 'ai',   text: '✓ Reminder set for Ravi Kumar at 3:00 PM today.' },
]

function AIInsightsMock() {
  const [msgs, setMsgs]     = useState<typeof CHAT_MSGS>([])
  const [typing, setTyping] = useState(false)
  const [cycle, setCycle]   = useState(0)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (prefersReduced) { setMsgs(CHAT_MSGS); return }
    setMsgs([]); setTyping(false)
    const T = [
      setTimeout(() => setMsgs([CHAT_MSGS[0]]),                                    500),
      setTimeout(() => setTyping(true),                                             1300),
      setTimeout(() => { setTyping(false); setMsgs(m => [...m, CHAT_MSGS[1]]) },   2500),
      setTimeout(() => setMsgs(m => [...m, CHAT_MSGS[2]]),                          3700),
      setTimeout(() => setTyping(true),                                             4400),
      setTimeout(() => { setTyping(false); setMsgs(m => [...m, CHAT_MSGS[3]]) },   5300),
      setTimeout(() => { setMsgs([]); setTyping(false); setCycle(c => c + 1) },    8200),
    ]
    return () => T.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, prefersReduced])

  return (
    <div className="h-full flex overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div className="w-[110px] shrink-0 flex flex-col py-4 px-2.5 gap-1" style={{ background: '#111827', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-1.5 px-1.5 mb-3">
          <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[8px] font-black" style={{ background: '#0038A8' }}>LG</div>
          <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>AI Advisor</span>
        </div>
        {CHAT_SIDEBAR.map((s, i) => (
          <div key={i} className="px-2 py-1.5 rounded" style={{ background: i === 0 ? 'rgba(255,255,255,0.08)' : 'transparent', cursor: 'default' }}>
            <p className="text-[9px] leading-snug truncate" style={{ color: i === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.38)' }}>{s}</p>
          </div>
        ))}
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#FFFFFF' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #F0F0F0' }}>
          <span className="text-[11px] font-semibold" style={{ color: '#0D1117' }}>Conversation</span>
          <button className="text-[9px] font-bold px-2 py-1" style={{ background: 'rgba(0,56,168,0.08)', color: '#0038A8', borderRadius: 4 }}>New Chat</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden px-3 py-2 flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-1.5"
                style={{ flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}
              >
                {m.role === 'user' ? (
                  <div className="w-5 h-5 rounded-full shrink-0 overflow-hidden mt-0.5 flex items-flex-end justify-center"
                    style={{ background: '#EDE9FE' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={DICEBEAR('You')} alt="You" width={20} height={20} style={{ display: 'block' }} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: '#0038A8' }}>
                    <Robot size={11} weight="light" color="#fff" />
                  </div>
                )}
                <div className="max-w-[78%] px-2.5 py-1.5"
                  style={{
                    background: m.role === 'user' ? '#F4F4F6' : '#EEF2FF',
                    borderRadius: m.role === 'user' ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
                    fontSize: 10, color: '#0D1117', lineHeight: 1.55,
                  }}>
                  {m.text}
                </div>
              </motion.div>
            ))}

            {typing && (
              <motion.div key="dots"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-1.5"
              >
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                  style={{ background: '#0038A8' }}>
                  <Robot size={11} weight="light" color="#fff" />
                </div>
                <div className="flex gap-1 items-center px-3 py-2" style={{ background: '#EEF2FF', borderRadius: '2px 10px 10px 10px' }}>
                  {[0, 1, 2].map(j => (
                    <motion.span key={j} className="w-1 h-1 rounded-full" style={{ background: '#0038A8', opacity: 0.4 }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: j * 0.2 }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: '#F5F5F7', borderRadius: 8 }}>
            <span style={{ fontSize: 10, color: '#9BA8B5', flex: 1 }}>Ask me anything...</span>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#0038A8' }}>
              <ArrowRight className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Mock 3: Agent network bubbles (mirrors Alytics "Product Usage Tracking") ─ */
/* Agent cards: illustrated avatar + toggle, positioned on a graph-paper grid */
const WORKSPACE_AGENTS = [
  { seed: 'Rajesh',  bg: '#FEF3C7', active: true,  cx: 22, cy: 18 },
  { seed: 'Priya',   bg: '#EDE9FE', active: true,  cx: 50, cy: 12 },
  { seed: 'Vikram',  bg: '#DCFCE7', active: false, cx: 78, cy: 18 },
  { seed: 'Ananya',  bg: '#FCE7F3', active: true,  cx: 34, cy: 62 },
  { seed: 'Karan',   bg: '#DBEAFE', active: true,  cx: 62, cy: 62 },
]
const DICEBEAR = (seed: string) =>
  `https://api.dicebear.com/7.x/open-peeps/svg?seed=${seed}&backgroundColor=transparent&clothingColor=0038A8`

/* SVG connector paths (in percentage coords of 280px-high container) */
const CONNECTOR_PATHS = [
  /* top row horizontal bar */
  'M 22 18 H 78',
  /* down from Priya to junction */
  'M 50 18 V 42',
  /* junction horizontal to Ananya col */
  'M 34 42 H 62',
  /* Ananya & Karan drops */
  'M 34 42 V 62',
  'M 62 42 V 62',
]

function AgentToggle({ active }: { active: boolean }) {
  return (
    <div style={{
      width: 26, height: 14, borderRadius: 7,
      background: active ? '#0038A8' : '#D1D5DB',
      position: 'relative', transition: 'background 0.25s',
    }}>
      <div style={{
        position: 'absolute', top: 2, width: 10, height: 10, borderRadius: '50%',
        background: '#fff',
        left: active ? 14 : 2,
        transition: 'left 0.25s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

function AgentNetworkMock() {
  const prefersReduced = useReducedMotion()

  return (
    <div className="h-full relative overflow-hidden" style={{ background: '#F8F9FB' }}>
      {/* Graph paper background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(0,56,168,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,56,168,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
      }} />

      {/* SVG connector lines — viewBox matches percent coords (100×100) */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
        {CONNECTOR_PATHS.map((d, i) => (
          <path key={i}
            d={d}
            fill="none"
            stroke="rgba(99,142,220,0.45)"
            strokeWidth="0.8"
            strokeDasharray="2.5 2.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Lock badge — top right */}
      <div className="absolute flex items-center gap-1.5 px-2 py-1"
        style={{ top: 14, right: 16, background: '#fff', border: '1px solid #E4EAF2', borderRadius: 6, zIndex: 20 }}>
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
          <rect x="1" y="5" width="8" height="7" rx="1.5" stroke="#9BA8B5" strokeWidth="1.2"/>
          <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="#9BA8B5" strokeWidth="1.2"/>
          <circle cx="5" cy="8.5" r="1" fill="#9BA8B5"/>
        </svg>
        <div className="flex gap-[3px]">
          {[0,1,2].map(j => <div key={j} className="w-1 h-1 rounded-full" style={{ background: '#C5CDD8' }} />)}
        </div>
      </div>

      {/* Agent cards */}
      {WORKSPACE_AGENTS.map((a, i) => (
        <motion.div
          key={a.seed}
          className="absolute flex flex-col items-center gap-1.5 px-2.5 pt-2 pb-2"
          style={{
            left: `${a.cx}%`, top: `${a.cy}%`,
            transform: 'translate(-50%, -50%)',
            background: '#FFFFFF',
            border: '1px solid #E4EAF2',
            borderRadius: 10,
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            zIndex: 10, width: 64,
          }}
          initial={{ opacity: 0, scale: 0.82 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Illustrated avatar on colored bg */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: a.bg, overflow: 'hidden',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DICEBEAR(a.seed)} alt={a.seed} width={40} height={40}
                style={{ display: 'block', objectFit: 'cover' }} />
            </div>
            {!a.active && (
              <div style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', border: '1px solid #E4EAF2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              }}>
                <Lock size={9} weight="light" color="#6B7280" />
              </div>
            )}
          </div>
          <AgentToggle active={a.active} />
        </motion.div>
      ))}

      {/* Checkmark — bottom center */}
      <motion.div
        className="absolute flex items-center justify-center"
        style={{ bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="rgba(0,56,168,0.18)" strokeWidth="1.5"/>
          <path d="M6 10.5L9 13.5L14 8" stroke="#0038A8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </motion.div>
    </div>
  )
}

/* ── Mock 4: Team revenue analytics — single area chart ─────────────────────── */
const REVENUE_DATA = [
  { m: 'Jan', v: 1.1 },
  { m: 'Feb', v: 1.3 },
  { m: 'Mar', v: 1.5 },
  { m: 'Apr', v: 1.4 },
  { m: 'May', v: 1.7 },
  { m: 'Jun', v: 1.9 },
  { m: 'Jul', v: 2.2 },
]

const TEAM_AGENTS = [
  { seed: 'Rajesh', bg: '#FEF3C7', name: 'Rajesh K.', rev: '₹4.2L', pct: 85 },
  { seed: 'Priya',  bg: '#EDE9FE', name: 'Priya M.',  rev: '₹3.8L', pct: 72 },
  { seed: 'Karan',  bg: '#DBEAFE', name: 'Karan S.',  rev: '₹2.9L', pct: 54 },
]

function RevenueDot(props: { cx?: number; cy?: number; index?: number }) {
  const { cx = 0, cy = 0, index = 0 } = props
  if (index !== REVENUE_DATA.length - 1) return <g />
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="#0038A8" fillOpacity={0.12} />
      <circle cx={cx} cy={cy} r={5}  fill="#0038A8" />
      <circle cx={cx} cy={cy} r={2}  fill="#fff" />
    </g>
  )
}

function ImpactChartMock() {
  return (
    <div className="h-full flex flex-col" style={{ background: '#fff' }}>
      {/* ── Headline stat ── */}
      <div className="flex items-start justify-between px-5 pt-4 pb-0 shrink-0">
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9BA8B5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Team Revenue · Jul
          </p>
          <p style={{ fontSize: 30, fontWeight: 900, color: '#0D1117', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            ₹2.2 Cr
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 mt-1">
          <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', borderRadius: 20, padding: '2px 9px' }}>
            ▲ +23%
          </span>
          <span style={{ fontSize: 9, color: '#9BA8B5' }}>vs last month</span>
        </div>
      </div>

      {/* ── Area chart ── */}
      <div style={{ flex: '1 1 0', minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={REVENUE_DATA} margin={{ top: 8, right: 16, left: 16, bottom: 2 }}>
            <defs>
              <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#0038A8" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#0038A8" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis dataKey="m"
              tick={{ fontSize: 9, fill: '#C5CDD8' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, border: '1px solid #E8ECF0', borderRadius: 4, boxShadow: 'none', padding: '4px 10px' }}
              formatter={(v: number) => [`₹${v} Cr`, 'Revenue']}
              labelStyle={{ color: '#9BA8B5', fontSize: 9 }}
              cursor={{ stroke: 'rgba(0,56,168,0.12)', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#0038A8"
              strokeWidth={2}
              fill="url(#rev-fill)"
              dot={<RevenueDot />}
              activeDot={{ r: 4, fill: '#0038A8', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Team breakdown ── */}
      <div className="px-5 pb-4 shrink-0 flex flex-col gap-2">
        {TEAM_AGENTS.map(a => (
          <div key={a.seed} className="flex items-center gap-2">
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: a.bg, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DICEBEAR(a.seed)} alt={a.name} width={18} height={18} style={{ display: 'block' }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#4B5563', width: 46, flexShrink: 0 }}>{a.name}</span>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#F0F2F5', overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: '#0038A8', borderRadius: 2 }}
                initial={{ width: 0 }}
                whileInView={{ width: `${a.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#0038A8', width: 32, textAlign: 'right', flexShrink: 0 }}>{a.rev}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Section ─────────────────────────────────────────────────────────────────── */
const UNIQUE_FEATURES = [
  {
    title: 'Portal Lead Sync',
    desc: 'Leads from 99acres, MagicBricks, Housing.com and NoBroker land in seconds — zero copy-paste, always current.',
    Mock: LeadSyncMock,
  },
  {
    title: 'AI Lead Advisor',
    desc: 'Actionable insights from your lead data, without digging into spreadsheets or dashboards.',
    Mock: AIInsightsMock,
  },
  {
    title: 'Agent Workspace',
    desc: 'Each agent works in their own isolated workspace. Admins see everything. No shared spreadsheet chaos.',
    Mock: AgentNetworkMock,
  },
  {
    title: 'Team Revenue Analytics',
    desc: 'One view of every rupee your team has closed — by agent, by month, trending in real time.',
    Mock: ImpactChartMock,
  },
]

function UniqueFeatures() {
  const ref = useScrollReveal()
  return (
    <section ref={ref} id="unique-features" className="py-28" style={{ background: '#FAFAF8' }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Header — exact Alytics structure */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-1.5 mb-6 text-[12px] font-semibold"
            style={{ background: '#EEF2F7', color: '#0038A8', borderRadius: 20 }}>
            Unique Features
          </div>
          <h2 className="text-[40px] md:text-[52px] font-extrabold text-[#0D1117] leading-[1.15] tracking-tight">
            Make Your Platform<br className="hidden md:block" /> Work Harder For You
          </h2>
          <p className="text-[16px] mt-4 max-w-sm mx-auto" style={{ color: '#78889B', lineHeight: 1.6 }}>
            Streamline your brokerage with unified lead data and AI-powered workflows — all in one place.
          </p>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {UNIQUE_FEATURES.map(({ title, desc, Mock }, i) => (
            <div key={title}
              className={`lp-in lp-in-delay-${(i % 2) + 1} flex flex-col overflow-hidden`}
              style={{ background: '#FFFFFF', border: '1px solid #E8ECF0', borderRadius: 16, boxShadow: '0 1px 24px rgba(0,0,0,0.04)' }}>
              {/* Live UI preview area */}
              <div className="overflow-hidden relative" style={{ height: 280, background: '#F6F7F9', borderBottom: '1px solid #EBEDF0' }}>
                <Mock />
              </div>
              {/* Title + desc */}
              <div className="px-8 py-6">
                <h3 className="font-bold text-[#0D1117] mb-2" style={{ fontSize: 17 }}>{title}</h3>
                <p style={{ fontSize: 14, color: '#78889B', lineHeight: 1.65 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="py-28">
      <div className="max-w-[1360px] mx-auto px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold mb-5"
            style={{ background: 'rgba(0,71,171,0.06)', border: '1px solid rgba(0,71,171,0.12)', color: '#0047AB' }}>
            <Target className="w-3.5 h-3.5" /> Everything your team needs
          </div>
          <h2 className="text-[38px] md:text-[46px] font-extrabold text-[#1A1F27] leading-tight tracking-tight">
            Built for how Indian real estate<br className="hidden md:block" /> teams actually work
          </h2>
          <p className="text-[16px] text-[#78889B] mt-4 max-w-xl mx-auto">
            No generic SaaS fluff. Every feature built around the reality of selling apartments in India.
          </p>
        </div>

        <BentoGrid>
          {/* Cell 1: Auto Lead Sync */}
          <BentoCard
            name="Auto Lead Sync"
            description="Leads flow in from every portal the moment they are posted — zero manual copy-paste."
            preview={<PreviewLeadSync />}
          />

          {/* Cell 2: Advanced Live Stats — spans 2 cols */}
          <BentoCard
            name="Advanced Live Stats"
            description="Revenue, lead volume, response time — all tracked live in your team dashboard."
            className="md:col-span-2"
            preview={<PreviewFeed />}
          />

          {/* Cell 3: Live Feed — Omnichannel CRM lottie */}
          <BentoCard
            name="Live Feed"
            description="Every call, note, and status change — logged automatically, visible to your whole team in real time."
            className="md:col-span-2"
            preview={<PreviewLiveFeed />}
          />

          {/* Cell 4: Portal Integrations — portal flow lottie */}
          <BentoCard
            name="Portal Integrations"
            description="Connect 99acres, MagicBricks, Housing.com, NoBroker and more — leads routed automatically."
            preview={<PreviewPortals />}
          />
        </BentoGrid>
      </div>
    </section>
  )
}

/* ─── Stats ───────────────────────────────────────────────────────────────── */
const STATS = [
  { value: 3, suffix: 'x', label: 'faster lead response time' },
  { value: 40, suffix: '%', label: 'more deals closed per agent' },
  { value: 6, suffix: ' portals', label: 'auto-synced, zero manual entry' },
  { value: 5, suffix: ' min', label: 'average onboarding time' },
]

function Stats() {
  const ref = useScrollReveal()
  return (
    <section ref={ref} className="py-20" style={{ background: '#1A1F27' }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
          {STATS.map((s, i) => (
            <div key={s.label} className={`lp-in lp-in-delay-${i + 1} text-center`}>
              <div className="text-[44px] md:text-[52px] font-extrabold text-white leading-none mb-2">
                <Counter to={s.value} suffix={s.suffix} />
              </div>
              <div className="text-[13px] text-[#78889B] leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── How it works ────────────────────────────────────────────────────────── */
/* ─── How it works — animated step cards ─────────────────────────────────── */
const seq = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function PortalSyncCard() {
  const portals = [
    { name: '99acres',     abbr: '99', color: '#FF6B35' },
    { name: 'MagicBricks', abbr: 'MB', color: '#E63946' },
    { name: 'Housing.com', abbr: 'HC', color: '#2D9B6F' },
    { name: 'NoBroker',    abbr: 'NB', color: '#7B2FBE' },
  ]
  const [connected, setConnected] = useState<number[]>([])
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      while (alive) {
        setConnected([]); setPulse(true)
        await seq(500)
        for (let i = 0; i < portals.length; i++) {
          if (!alive) return
          await seq(620)
          setConnected(prev => [...prev, i])
        }
        setPulse(false)
        await seq(2400)
      }
    })()
    return () => { alive = false }
  }, [])

  const allDone = connected.length === portals.length

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
          style={{ background: '#0038A8' }}>
          <Building2 className="w-7 h-7 text-white" />
        </div>
        {pulse && <div className="absolute inset-0 rounded-2xl border-2 border-[#0047AB] animate-ping opacity-40" />}
      </div>

      <div className="w-full flex flex-col gap-2">
        {portals.map((p, i) => {
          const done = connected.includes(i)
          return (
            <div key={p.name} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-500"
              style={{
                background: done ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                transform: done ? 'translateX(4px)' : 'translateX(0)',
              }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-extrabold shrink-0"
                style={{ background: p.color }}>{p.abbr}</div>
              <span className="text-[12px] font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.8)' }}>{p.name}</span>
              <div className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 shrink-0"
                style={{ background: done ? '#10B981' : 'rgba(255,255,255,0.08)' }}>
                {done && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-semibold transition-all duration-700"
        style={allDone
          ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }
          : { background: 'rgba(0,71,171,0.10)', border: '1px solid rgba(0,71,171,0.18)', color: '#0047AB' }}>
        <div className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: allDone ? '#10B981' : '#0047AB' }} />
        {allDone ? 'All portals live · syncing' : 'Connecting portals…'}
      </div>
    </div>
  )
}

function LeadRoutingCard() {
  const [phase, setPhase] = useState<'idle'|'in'|'routing'|'assigned'>('idle')

  useEffect(() => {
    let alive = true
    ;(async () => {
      while (alive) {
        setPhase('idle');  await seq(700)
        setPhase('in');    await seq(1100)
        setPhase('routing'); await seq(900)
        setPhase('assigned'); await seq(2800)
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <div className="flex flex-col gap-3 py-1">
      {/* Incoming */}
      <div className="rounded-xl p-3.5 transition-all duration-600"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)',
          opacity: phase === 'idle' ? 0 : 1,
          transform: phase === 'idle' ? 'translateY(-10px) scale(0.96)' : 'translateY(0) scale(1)',
        }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg,#0047AB,#2E66F6)' }}>RS</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white">New lead · MagicBricks</div>
            <div className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>Rajesh Sharma · ₹1.2 Cr · 3BHK</div>
          </div>
          <div className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0"
            style={{ background: 'rgba(0,71,171,0.12)', color: '#0047AB' }}>🔥 Hot</div>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center gap-2 text-[11px] font-semibold transition-all duration-500"
        style={{ color: '#6B8EF7', opacity: phase === 'routing' || phase === 'assigned' ? 1 : 0 }}>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,transparent,#2E66F6)' }} />
        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        <span className="shrink-0">Auto-assigning</span>
        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,#2E66F6,transparent)' }} />
      </div>

      {/* Agent */}
      <div className="rounded-xl p-3.5 transition-all duration-600"
        style={{
          background: phase === 'assigned' ? 'rgba(46,102,246,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${phase === 'assigned' ? 'rgba(46,102,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
          opacity: phase === 'routing' || phase === 'assigned' ? 1 : 0,
          transform: phase === 'assigned' ? 'scale(1.02)' : 'scale(1)',
        }}>
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
              style={{ background: 'linear-gradient(135deg,#2E66F6,#7C3AED)' }}>A</div>
            {phase === 'assigned' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[8px] font-bold">1</div>
            )}
          </div>
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-white">Arjun Nair</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Senior Agent · Whitefield zone</div>
          </div>
          {phase === 'assigned' && <span className="text-[10px] font-bold text-emerald-400 shrink-0">Assigned ✓</span>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-1">
        {[{ l: 'Response', v: '< 2 min' }, { l: 'Overlap', v: 'Zero' }, { l: 'Privacy', v: '100%' }].map(s => (
          <div key={s.l} className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-[13px] font-extrabold text-white">{s.v}</div>
            <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AICloseCard() {
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<'idle'|'scoring'|'hot'|'closed'>('idle')

  useEffect(() => {
    let alive = true
    ;(async () => {
      while (alive) {
        setScore(0); setPhase('idle'); await seq(600)
        setPhase('scoring')
        for (let s = 0; s <= 94; s += 3) {
          if (!alive) return
          setScore(s); await seq(28)
        }
        setScore(94); await seq(350)
        setPhase('hot');    await seq(1200)
        setPhase('closed'); await seq(2800)
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Intent Score</span>
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Rajesh Sharma</span>
        </div>
        <div className="flex items-end gap-3 mb-3">
          <div className="text-[44px] font-extrabold leading-none transition-colors duration-300"
            style={{ color: score >= 80 ? '#0047AB' : score >= 50 ? '#F59E0B' : 'white' }}>
            {score}
          </div>
          <div className="text-[18px] font-bold pb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>/100</div>
          {(phase === 'hot' || phase === 'closed') && (
            <div className="ml-auto px-3 py-1.5 rounded-full text-[11px] font-extrabold lp-fade-up"
              style={{ background: 'rgba(0,71,171,0.12)', color: '#0047AB', border: '1px solid rgba(0,71,171,0.25)' }}>
              🔥 Hot Lead
            </div>
          )}
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-75"
            style={{ width: `${score}%`, background: score >= 80 ? '#0038A8' : score >= 50 ? '#F59E0B' : '#2E66F6' }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <span>Low intent</span><span>High intent</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {[
          { l: 'Portal activity',   v: 'High',       done: score > 20 },
          { l: 'Budget confirmed',  v: '✓ ₹1.2 Cr',  done: score > 50 },
          { l: 'Called twice',      v: 'Engaged',    done: score > 75 },
        ].map(f => (
          <div key={f.l} className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-500"
            style={{
              background: f.done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${f.done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
            }}>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.done ? '#10B981' : 'rgba(255,255,255,0.18)' }} />
            <span className="text-[11px] flex-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{f.l}</span>
            <span className="text-[11px] font-semibold shrink-0" style={{ color: f.done ? '#10B981' : 'rgba(255,255,255,0.25)' }}>{f.v}</span>
          </div>
        ))}
      </div>

      {phase === 'closed' && (
        <div className="rounded-xl p-4 text-center lp-fade-up"
          style={{ background: 'linear-gradient(135deg,rgba(0,71,171,0.10),rgba(0,56,168,0.06))', border: '1px solid rgba(0,71,171,0.20)' }}>
          <div className="flex justify-center mb-1.5">
            <Trophy className="w-5 h-5" style={{ color: '#0047AB' }} />
          </div>
          <div className="text-[15px] font-extrabold text-white">Deal closed!</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>₹1.2 Cr · 8 days from first enquiry</div>
        </div>
      )}
    </div>
  )
}

function HowItWorks() {
  const ref = useScrollReveal()
  const steps = [
    { num: '01', color: '#0047AB', icon: <PhoneCall className="w-5 h-5" />, title: 'Connect your portals', desc: 'Paste credentials once. Leads pull in automatically 24/7 — no human in the loop.', card: <PortalSyncCard /> },
    { num: '02', color: '#2E66F6', icon: <Users className="w-5 h-5" />,    title: 'Leads auto-assign',   desc: 'New leads route instantly to the right agent. Private workspace — zero overlap ever.', card: <LeadRoutingCard /> },
    { num: '03', color: '#059669', icon: <TrendingUp className="w-5 h-5" />, title: 'Close more with AI', desc: 'AI scores intent in real time, triggers follow-ups, flags hot deals. You just close.', card: <AICloseCard /> },
  ]

  return (
    <section id="how-it-works" ref={ref} className="py-28" style={{ background: '#111318' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="lp-in lp-in-delay-1 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold mb-5"
            style={{ background: 'rgba(107,142,247,0.1)', border: '1px solid rgba(107,142,247,0.25)', color: '#6B8EF7' }}>
            <Clock className="w-3.5 h-3.5" /> Up and running in minutes
          </div>
          <h2 className="lp-in lp-in-delay-2 text-[38px] md:text-[48px] font-extrabold text-white leading-tight tracking-tight">
            Three steps from signup<br className="hidden md:block" /> to closing deals
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((step, i) => (
            <div key={step.num}
              className={`lp-in lp-in-delay-${i + 1} rounded-2xl p-5 flex flex-col gap-5`}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                  style={{ background: step.color }}>
                  {step.icon}
                </div>
                <div className="text-[32px] font-extrabold" style={{ color: 'rgba(255,255,255,0.07)' }}>{step.num}</div>
              </div>
              {/* Animated area */}
              <div className="rounded-xl p-4 flex-1"
                style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 300 }}>
                {step.card}
              </div>
              {/* Text */}
              <div>
                <h3 className="text-[16px] font-bold text-white mb-1.5">{step.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Testimonial ─────────────────────────────────────────────────────────── */
function Testimonial() {
  const ref = useScrollReveal()
  return (
    <section ref={ref} className="py-24">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div className="lp-in lp-in-delay-1 flex justify-center gap-1 mb-6">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-5 h-5 fill-[#0047AB] text-[#0047AB]" />
          ))}
        </div>
        <blockquote className="lp-in lp-in-delay-2 text-[22px] md:text-[28px] font-bold text-[#1A1F27] leading-snug tracking-tight mb-8">
          &ldquo;Before Lead Gap CRM, our agents were chasing leads on WhatsApp groups.
          Now everything&apos;s in one place and our conversion rate is up 35%.&rdquo;
        </blockquote>
        <div className="lp-in lp-in-delay-3 flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
            style={{ background: '#0047AB' }}>
            AK
          </div>
          <div className="text-left">
            <div className="text-[14px] font-semibold text-[#263238]">Arun Kapoor</div>
            <div className="text-[12px] text-[#A4B1BE]">Sales Head, Prestige Builders — Bengaluru</div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Teak-exact Problem Bento ────────────────────────────────────────────── */

/* Card 1 (wide) — "Rewards that feel like magic" pattern
   Text TOP-LEFT, two floating UI cards RIGHT, decorative shapes below */
function PortalChaosCard() {
  return (
    <div style={{ borderBottom: '1.5px solid #E2E8F0' }}>
      <div className="flex flex-col md:grid" style={{ gridTemplateColumns: '5fr 7fr' }}>

        {/* Left: text — top aligned, NOT centered */}
        <div className="p-7 md:p-9 flex flex-col gap-4 border-b border-[#E2E8F0] md:border-b-0 md:border-r">
          <span className="self-start px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
            style={{ background: '#E8EFFA', color: '#0038A8', border: '1px solid #4D7FD0' }}>
            01 — Portals
          </span>
          <h3 className="text-[26px] font-extrabold leading-tight tracking-tight" style={{ color: '#0F172A' }}>
            Your leads live<br />in 5 different tabs.
          </h3>
          <p className="text-[14px] leading-relaxed" style={{ color: '#64748B', maxWidth: 260 }}>
            5 portals. 5 inboxes. 1 spreadsheet — refreshed every morning while last night&apos;s leads go cold.
          </p>
        </div>

        {/* Right: two UI mock cards + shapes below — flex column so shapes never overlap cards */}
        <div className="flex flex-col overflow-hidden" style={{ background: '#F9F7F4' }}>

          {/* UI mock cards — always side by side (fit fine at any width ≥ 280px) */}
          <div className="p-5 md:p-7 flex gap-3 md:gap-4">

            {/* Card A: New lead notification */}
            <div className="flex-1 min-w-0 rounded-2xl bg-white p-4" style={{ border: '1px solid #EDE9E0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg,#E8522A,#2E66F6)' }}>RS</div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold truncate" style={{ color: '#0F172A' }}>Rajesh Sharma</div>
                  <div className="text-[10px]" style={{ color: '#9B9289' }}>New enquiry</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="self-start px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: '#FFF3E8', border: '1px solid #FDDCB8', color: '#C2410C' }}>
                  99acres
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold" style={{ color: '#0F172A' }}>₹1.2 Cr</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: '#E8EFFA', color: '#0038A8', border: '1px solid #4D7FD0' }}>
                    unread
                  </span>
                </div>
              </div>
            </div>

            {/* Card B: Multi-portal inbox */}
            <div className="flex-1 min-w-0 rounded-2xl bg-white p-4" style={{ border: '1px solid #EDE9E0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9B9289' }}>Unread inbox</div>
              <div className="flex flex-col gap-2.5">
                {[
                  { clr: '#B91C1C', src: 'MagicBricks', count: 8  },
                  { clr: '#1D4ED8', src: 'Housing.com', count: 5  },
                  { clr: '#047857', src: 'NoBroker',    count: 3  },
                  { clr: '#6D28D9', src: 'PropTiger',   count: 2  },
                ].map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.clr }} />
                    <span className="flex-1 text-[11px] font-medium truncate" style={{ color: '#4A4540' }}>{p.src}</span>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: '#E8EFFA', color: '#0047AB' }}>{p.count} new</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shapes — own 120px block, always rendered below cards, zero z-index conflict */}
          <div className="relative overflow-hidden pointer-events-none" style={{ height: 120 }}>
            <div className="absolute" style={{ left: '8%',  bottom: '16%', width: 76, height: 76, background: '#0047AB', borderRadius: 18, animation: 'bento-cw 9s linear infinite',   animationDelay: '-2s'   }} />
            <div className="absolute" style={{ left: '32%', bottom: '28%', width: 60, height: 60, background: '#2E66F6', borderRadius: 14, animation: 'bento-ccw 7s linear infinite',  animationDelay: '-1.2s' }} />
            <div className="absolute" style={{ left: '56%', bottom: '20%', width: 46, height: 46, background: '#059669', borderRadius: 10, animation: 'bento-cw 5s linear infinite',   animationDelay: '-0.8s' }} />
            <div className="absolute" style={{ left: '22%', bottom: '6%',  width: 26, height: 26, background: '#0047AB', borderRadius: 6,  animation: 'bento-ccw 4s linear infinite',  animationDelay: '-0.3s' }} />
            <div className="absolute" style={{ left: '70%', bottom: '40%', width: 24, height: 24, background: '#2E66F6', borderRadius: 5,  animation: 'bento-cw 4.5s linear infinite', animationDelay: '-2.5s' }} />
            <div className="absolute" style={{ right: '16%',bottom: '10%', width: 18, height: 18, background: '#0047AB', borderRadius: 4,  animation: 'bento-cw 3.5s linear infinite', animationDelay: '-1.8s' }} />
            <div className="absolute" style={{ left: '42%', bottom: '2%',  width: 90, height: 90, borderRadius: '50%', background: '#4D7FD0', opacity: 0.18, animation: 'bento-bob 8s ease-in-out infinite',      animationDelay: '-4s' }} />
            <div className="absolute" style={{ left: '78%', bottom: '40%', width: 20, height: 20, borderRadius: '50%', background: '#7C3AED', opacity: 0.7,  animation: 'bento-bob-fast 5s ease-in-out infinite', animationDelay: '-1s' }} />
            <div className="absolute" style={{ right: '8%', bottom: '25%', width: 13, height: 13, borderRadius: '50%', background: '#059669', opacity: 0.8, animation: 'bento-bob-fast 4s ease-in-out infinite',  animationDelay: '-3s' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* Card 2 (left half) — live urgency timer ticks every second */
function SpeedCard() {
  const [secs, setSecs] = useState(13462)   // starts at 3h 44m 22s

  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const timer = `${h}h ${m}m ${String(s).padStart(2, '0')}s`

  return (
    <div className="flex flex-col border-b border-[#E2E8F0] md:border-b-0 md:border-r">
      <div className="p-6 md:p-8 flex flex-col gap-3">
        <span className="self-start px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{ background: '#E8EFFA', color: '#0038A8', border: '1px solid #4D7FD0' }}>
          02 — Response time
        </span>
        <h3 className="text-[22px] font-extrabold leading-snug tracking-tight" style={{ color: '#0F172A' }}>
          The first broker wins.<br />Every single time.
        </h3>
        <p className="text-[13px] leading-relaxed" style={{ color: '#64748B' }}>
          78% of buyers pick whoever calls first. A 4-hour delay isn&apos;t slow — it&apos;s a closed deal for someone else.
        </p>
      </div>

      <div className="px-6 pb-6 md:px-8 md:pb-8">
        <div className="rounded-2xl bg-white p-4" style={{ border: '1px solid #EDE9E0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          {/* Header with live ticking timer */}
          <div className="flex items-center gap-2.5 pb-3 mb-3" style={{ borderBottom: '1px solid #F5F2EE' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ background: '#0038A8' }}>RS</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold" style={{ color: '#0F172A' }}>Rajesh Sharma</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {/* Pulsing red dot */}
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" style={{ animation: 'bento-timer-pulse 1s ease-in-out infinite' }} />
                <span className="text-[11px] font-bold tabular-nums" style={{ color: '#EF4444' }}>
                  Unresponded · {timer}
                </span>
              </div>
            </div>
          </div>
          {/* Form rows — staggered slide-in */}
          <div className="flex flex-col gap-3">
            {[
              { label: 'Source',   content: <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#FFF3E8', border: '1px solid #FDDCB8', color: '#C2410C' }}>99acres</span> },
              { label: 'Priority', content: <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#DC2626' }}>Hot</span> },
              { label: 'Status',   content: <span className="text-[12px] font-semibold" style={{ color: '#EF4444' }}>Waiting…</span> },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3"
                style={{ animation: 'bento-row-in 0.45s ease-out both', animationDelay: `${0.2 + i * 0.18}s` }}>
                <span className="text-[11px] shrink-0" style={{ color: '#9B9289', width: 52 }}>{row.label}</span>
                {row.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Card 3 (right half) — "Segments that actually segment" pattern
   Left col scrolls UP, right col scrolls DOWN, highlighted chip pulses (teak-exact) */
const SEG_LEADS_RAW  = ['Rajesh S.', 'Priya M.', 'Vikram S.', 'Anjali M.', 'Rohan G.', 'Sneha K.']
const SEG_STATUS_RAW = ['No owner', 'Ask Priya?', '…nobody', 'Dropped', 'Check Arjun', 'Unassigned']

function VisibilityCard() {
  const leftAll  = [...SEG_LEADS_RAW,  ...SEG_LEADS_RAW]
  const rightAll = [...SEG_STATUS_RAW, ...SEG_STATUS_RAW]

  return (
    <div className="flex flex-col">
      {/* Text — top */}
      <div className="p-6 md:p-8 flex flex-col gap-3">
        <span className="self-start px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{ background: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD6FE' }}>
          03 — Visibility
        </span>
        <h3 className="text-[22px] font-extrabold leading-snug tracking-tight" style={{ color: '#0F172A' }}>
          Nobody knows<br />who owns what.
        </h3>
        <p className="text-[13px] leading-relaxed" style={{ color: '#64748B' }}>
          No assignments. No follow-ups. Deals die quietly while your team plays hot potato with every lead.
        </p>
      </div>

      {/* Teak "Segments" — scrolling columns + dark "+" connector */}
      <div className="px-6 pb-6 md:px-8 md:pb-8 flex items-stretch gap-3" style={{ height: 172 }}>

        {/* Left col: lead names scroll UP — stretch fills height for overflow clip */}
        <div className="flex-1 overflow-hidden" style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
        }}>
          <div className="lp-marquee-track-v flex flex-col gap-2.5 pt-1" style={{ animationDuration: '10s' }}>
            {leftAll.map((name, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap self-start"
                style={{ background: 'white', border: '1.5px solid #E2E8F0', color: '#64748B' }}>
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Center: dark "+" pill — self-center keeps it mid-height */}
        <div className="shrink-0 self-center px-3.5 py-2 rounded-full text-[14px] font-bold"
          style={{ background: '#0F172A', color: 'white' }}>
          +
        </div>

        {/* Right col: status chips scroll DOWN, "Unassigned 🔴" highlighted with pulse */}
        <div className="flex-1 overflow-hidden" style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
        }}>
          <div className="lp-marquee-track-v-rev flex flex-col gap-2.5 pt-1" style={{ animationDuration: '12s' }}>
            {rightAll.map((label, i) => {
              const isHot = label === 'Unassigned'
              return (
                <span key={i} className="px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap self-start"
                  style={isHot
                    ? { background: '#FEE2E2', border: '1.5px solid #FCA5A5', color: '#DC2626', animation: 'bento-chip-glow 2s ease-in-out infinite' }
                    : { background: 'white', border: '1.5px solid #E2E8F0', color: '#64748B' }
                  }>
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProblemSection() {
  const ref = useScrollReveal()
  const [secs, setSecs] = useState(13462)
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const timer = `${h}h ${m}m ${String(s).padStart(2, '0')}s`

  return (
    <section ref={ref} className="py-24 px-6" style={{ background: '#EDEAE3', overflowX: 'clip' }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-16 md:gap-16 items-center">

        {/* Left — text */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <p className="lp-in lp-in-delay-1 text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#0038A8' }}>
            Sound familiar?
          </p>
          <h2 className="lp-in lp-in-delay-2 text-[30px] sm:text-[36px] md:text-[42px] font-extrabold leading-tight tracking-tight" style={{ color: '#0F172A' }}>
            This is how brokers lose deals every day.
          </h2>
          <p className="lp-in lp-in-delay-3 text-[16px] leading-relaxed" style={{ color: '#64748B', maxWidth: 400 }}>
            Three silent problems eating your revenue every month. Every Indian broker knows them. Most never fix them.
          </p>

          {/* Problem list */}
          <div className="lp-in lp-in-delay-4 flex flex-col gap-3 mt-2">
            {[
              { num: '01', label: 'Leads scattered across 5 portals' },
              { num: '02', label: 'First caller wins — you call 4 hours late' },
              { num: '03', label: 'No one knows who owns which lead' },
            ].map(({ num, label }) => (
              <div key={num} className="flex items-center gap-3">
                <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded"
                  style={{ background: '#E8EFFA', color: '#0038A8', border: '1px solid #C7D8F5' }}>
                  {num}
                </span>
                <span className="text-[14px] font-medium" style={{ color: '#334155' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — CardSwap desktop mockups */}
        <div className="lp-in lp-in-delay-3 flex-shrink-0 relative" style={{ width: 520, height: 440 }}>
          <CardSwap
            width={460}
            height={390}
            cardDistance={38}
            verticalDistance={42}
            delay={4000}
            pauseOnHover={false}
            skewAmount={3}
            easing="elastic"
          >

            {/* ── Desktop 1 — 5+ Portal Integration ── */}
            <SwapCard>
              <div className="flex flex-col h-full overflow-hidden rounded-2xl">
                {/* macOS browser chrome — dark */}
                <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ background: '#1C1C1E', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                  <div className="flex-1 mx-3 px-3 py-1 rounded text-[10px] font-medium text-center" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                    app.leadgapcrm.in/portals
                  </div>
                </div>
                {/* screen — white */}
                <div className="flex-1 flex flex-col px-6 py-5 gap-4" style={{ background: '#FFFFFF' }}>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: '#0047AB' }}>01 — Portals</div>
                    <div className="text-[18px] font-extrabold leading-tight" style={{ color: '#1A1F27' }}>5+ Portal Integration</div>
                    <div className="text-[11px] mt-1" style={{ color: '#78889B' }}>Every lead, one inbox. Auto-synced in real time.</div>
                  </div>
                  {/* portal logo grid */}
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      { name: '99acres',     logo: '/portals/99acres.png'     },
                      { name: 'MagicBricks', logo: '/portals/magicbricks.png' },
                      { name: 'Housing',     logo: '/portals/housing.png'     },
                      { name: 'NoBroker',    logo: '/portals/nobroker.png'    },
                      { name: 'PropTiger',   logo: '/portals/proptiger.png'   },
                      { name: 'Makaan',      logo: '/portals/makaan.png'      },
                      { name: 'Sq.Yards',    logo: '/portals/squareyards.png' },
                      { name: 'CommonFlr',   logo: '/portals/commonfloor.png' },
                    ].map((p, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                          style={{ background: '#F5F7FA', border: '1px solid #E8ECF0' }}>
                          <img src={p.logo} alt={p.name} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                        </div>
                        <span className="text-[8px] font-medium text-center leading-tight" style={{ color: '#78889B' }}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                  {/* live sync indicator */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <span className="text-[11px] font-medium" style={{ color: '#166534' }}>Live sync active — 30 new leads today</span>
                  </div>
                </div>
              </div>
            </SwapCard>

            {/* ── Desktop 2 — Response Time ── */}
            <SwapCard>
              <div className="flex flex-col h-full overflow-hidden rounded-2xl">
                {/* macOS browser chrome — dark */}
                <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ background: '#1C1C1E', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                  <div className="flex-1 mx-3 px-3 py-1 rounded text-[10px] font-medium text-center" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                    app.leadgapcrm.in/response
                  </div>
                </div>
                {/* screen — white */}
                <div className="flex-1 flex flex-col min-h-0" style={{ background: '#FFFFFF' }}>
                  <div className="px-6 pt-4 pb-2 shrink-0">
                    <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: '#F59E0B' }}>02 — Response Time</div>
                    <div className="text-[16px] font-extrabold leading-tight" style={{ color: '#1A1F27' }}>First caller wins.</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: '#EF4444' }}>{timer} unresponded</span>
                    </div>
                  </div>
                  {/* Lottie animation fills remaining space */}
                  <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-2">
                    <DotLottieReact
                      src="/lottie/dashboard-developer.lottie"
                      loop
                      autoplay
                      style={{ width: '100%', height: '100%', maxHeight: '100%' }}
                    />
                  </div>
                </div>
              </div>
            </SwapCard>

            {/* ── Desktop 3 — AI Advisor ── */}
            <SwapCard>
              <div className="flex flex-col h-full overflow-hidden rounded-2xl">
                {/* macOS browser chrome — dark */}
                <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ background: '#1C1C1E', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                  <div className="flex-1 mx-3 px-3 py-1 rounded text-[10px] font-medium text-center" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                    app.leadgapcrm.in/ai-advisor
                  </div>
                </div>
                {/* screen — white */}
                <div className="flex-1 flex flex-col min-h-0" style={{ background: '#FFFFFF' }}>
                  <div className="px-6 pt-4 pb-2 shrink-0">
                    <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: '#7C3AED' }}>03 — AI Advisor</div>
                    <div className="text-[16px] font-extrabold leading-tight" style={{ color: '#1A1F27' }}>Nobody owns what.</div>
                    <div className="text-[11px] mt-1" style={{ color: '#78889B' }}>AI assigns, follows up, and closes the gaps.</div>
                  </div>
                  {/* AI stat rows */}
                  <div className="px-6 pb-2 flex flex-col gap-1.5 shrink-0">
                    {[
                      { label: 'Leads scored today',    value: '12',      clr: '#7C3AED' },
                      { label: 'Follow-ups auto-sent',  value: '3',       clr: '#10B981' },
                      { label: 'Pipeline monitored',    value: '₹4.2 Cr', clr: '#F59E0B' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded" style={{ background: '#F5F6FA', border: '1px solid #EFEFEF' }}>
                        <span className="text-[10px] font-medium" style={{ color: '#5A6472' }}>{s.label}</span>
                        <span className="text-[11px] font-bold tabular-nums" style={{ color: s.clr }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                  {/* Dashboard Lottie */}
                  <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-2">
                    <DotLottieReact
                      src="/lottie/dashboard-main.lottie"
                      loop
                      autoplay
                      style={{ width: '100%', height: '100%', maxHeight: '100%' }}
                    />
                  </div>
                </div>
              </div>
            </SwapCard>

          </CardSwap>
        </div>

      </div>
    </section>
  )
}

/* ─── Solution Section ────────────────────────────────────────────────────── */
const SOLUTIONS = [
  {
    fix: 'Fix #1',
    icon: Zap,
    color: '#2E66F6',
    bg: 'rgba(46,102,246,0.08)',
    title: 'One inbox. Every portal. Zero manual work.',
    body: 'Connect 99acres, MagicBricks, Housing.com, NoBroker and more in 2 minutes. Every lead flows in automatically — no copy-pasting, no missed enquiries, ever.',
    bullets: ['6 portals synced in real time', 'Auto-deduplication across sources', 'Instant WhatsApp & email alerts'],
  },
  {
    fix: 'Fix #2',
    icon: Bot,
    color: '#0047AB',
    bg: 'rgba(0,71,171,0.06)',
    title: 'AI scores every lead before you even see it.',
    body: 'Each enquiry gets an intent score the moment it arrives. The hottest leads rise to the top, get assigned to the right agent, and trigger follow-ups automatically.',
    bullets: ['Intent score 0–100 in < 30s', 'Smart agent auto-assignment', 'Built-in follow-up sequences'],
  },
  {
    fix: 'Fix #3',
    icon: BarChart3,
    color: '#059669',
    bg: 'rgba(5,150,105,0.08)',
    title: 'Live pipeline. Full team. Total clarity.',
    body: 'See every deal, every agent, every stage — in real time. Spot what\'s stuck, who\'s overloaded, and exactly where your next close is coming from.',
    bullets: ['Live kanban board by agent', 'Revenue pipeline at a glance', 'One-click performance reports'],
  },
]

function SolutionSection() {
  const ref = useScrollReveal()
  return (
    <section ref={ref} className="py-28 px-6" style={{ background: '#F5F7FF', position: 'relative', zIndex: 1 }}>
      <div className="max-w-5xl mx-auto">
        <p className="lp-in lp-in-delay-1 text-center text-[11px] font-bold uppercase tracking-[0.2em] mb-5" style={{ color: '#0047AB' }}>
          How Lead Gap CRM fixes it
        </p>
        <h2 className="lp-in lp-in-delay-2 text-center text-[36px] md:text-[44px] font-extrabold leading-tight tracking-tight text-[#1A1F27] mb-4">
          One platform. Every problem solved.
        </h2>
        <p className="lp-in lp-in-delay-3 text-center text-[16px] leading-relaxed max-w-xl mx-auto mb-16 text-[#78889B]">
          Lead Gap CRM automates the work your team does manually — and gives you visibility you&apos;ve never had before.
        </p>

        <div className="flex flex-col gap-4">
          {SOLUTIONS.map((s, i) => (
            <div
              key={i}
              className={`lp-in lp-in-delay-${i + 1} flex flex-col md:flex-row gap-8 items-start overflow-hidden`}
              style={{ background: '#FFFFFF', border: '1px solid #E8ECF0', borderRadius: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.04)', borderLeft: `3px solid ${s.color}` }}
            >
              {/* Colored number */}
              <div className="hidden md:flex items-center justify-center shrink-0 self-stretch px-6"
                style={{ background: `${s.color}08`, borderRight: `1px solid ${s.color}18`, minWidth: 80 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: `${s.color}30`, lineHeight: 1 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Left: icon + copy */}
              <div className="flex flex-col gap-4 flex-1 min-w-0 py-7 pl-0 md:pl-0 pr-0">
                <div className="flex items-center gap-3 px-6 md:px-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: s.bg }}>
                    <s.icon className="w-4.5 h-4.5" style={{ color: s.color }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.fix}</span>
                </div>
                <h3 className="text-[20px] font-bold text-[#1A1F27] leading-snug px-6 md:px-0">{s.title}</h3>
                <p className="text-[14px] text-[#78889B] leading-relaxed px-6 md:px-0">{s.body}</p>
              </div>

              {/* Right: bullet checklist */}
              <div className="flex flex-col gap-3 shrink-0 md:w-60 py-7 px-6 md:pr-8"
                style={{ borderTop: '1px solid #F0F2F5' }} >
                {s.bullets.map((b, j) => (
                  <div key={j} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: s.color }} />
                    <span className="text-[13px] font-medium text-[#263238] leading-snug">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lp-in lp-in-delay-4 flex justify-center mt-12">
          <Link
            href="/signup"
            className="flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-semibold text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            style={{ background: '#0038A8', boxShadow: '0 8px 28px rgba(0,71,171,0.22)' }}
          >
            Get started free — no card needed
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─── CTA ─────────────────────────────────────────────────────────────────── */
function CTASection() {
  const ref = useScrollReveal()
  return (
    <section ref={ref} className="py-24 px-6">
      <div className="lp-in lp-in-delay-1 max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1A1F27 0%, #263238 100%)' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #0047AB, transparent)' }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold mb-6"
            style={{ background: 'rgba(0,71,171,0.10)', border: '1px solid rgba(0,71,171,0.18)', color: '#0047AB' }}>
            <Sparkles className="w-3.5 h-3.5" /> Free 14-day trial — no credit card
          </div>
          <h2 className="text-[36px] md:text-[48px] font-extrabold text-white leading-tight tracking-tight mb-4">
            Ready to close more deals?
          </h2>
          <p className="text-[16px] text-[#78889B] max-w-lg mx-auto mb-8">
            Join real estate teams across India who&apos;ve switched from messy spreadsheets to Lead Gap CRM.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-semibold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
              style={{ background: '#0038A8', boxShadow: '0 8px 30px rgba(0,71,171,0.25)' }}
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-semibold transition-all hover:bg-white/10"
              style={{ border: '1.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }}
            >
              Talk to sales
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */
const DOCK_ITEMS = [
  { link: '#', label: 'LinkedIn',  Icon: <Linkedin  size={18} /> },
  { link: '#', label: 'Twitter/X', Icon: <Twitter   size={18} /> },
  { link: '#', label: 'Instagram', Icon: <Instagram size={18} /> },
  { link: '#', label: 'YouTube',   Icon: <Youtube   size={18} /> },
]

const FOOTER_FEATURES = [
  'PORTAL SYNC', 'AI LEAD SCORING', 'AUTO FOLLOW-UPS', 'TEAM WORKSPACE',
  'REAL-TIME PIPELINE', 'INSTANT ALERTS', 'SMART ASSIGNMENT', 'WHATSAPP ALERTS',
]

function Footer() {
  const marqueeItems = [...FOOTER_FEATURES, ...FOOTER_FEATURES]

  return (
    <footer className="relative overflow-hidden" style={{ background: '#0C0C0E' }}>

      {/* ── Marquee strip ── */}
      <div className="overflow-hidden py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="lp-marquee-track flex gap-0 whitespace-nowrap" style={{ animationDuration: '30s' }}>
          {marqueeItems.map((f, i) => (
            <span key={i} className="shrink-0 flex items-center text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: 'rgba(255,255,255,0.28)', paddingRight: 40 }}>
              {f}
              <span className="ml-10" style={{ color: 'rgba(255,255,255,0.12)' }}>+</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Ghost watermark ── */}
      <div className="absolute inset-x-0 bottom-16 flex justify-center items-end pointer-events-none select-none overflow-hidden">
        <span className="font-black whitespace-nowrap leading-none"
          style={{
            fontSize: 'clamp(72px, 13vw, 160px)',
            color: 'rgba(255,255,255,0.035)',
            letterSpacing: '-0.04em',
          }}>
          LEAD GAP
        </span>
      </div>

      {/* ── Main CTA block ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-12 gap-8">

        {/* Headline */}
        <h2 className="font-black leading-none tracking-tight"
          style={{
            fontSize: 'clamp(40px, 6.5vw, 76px)',
            color: 'white',
            letterSpacing: '-0.03em',
          }}>
          Ready to close more deals?
        </h2>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-full text-[14px] font-bold transition-transform hover:scale-105"
            style={{ background: '#0047AB', color: 'white' }}>
            <ArrowRight size={15} />
            Get started free
          </Link>
          <Link href="/login"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-full text-[14px] font-bold transition-transform hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }}>
            Talk to sales
          </Link>
        </div>

        {/* Small links */}
        <div className="flex flex-wrap justify-center gap-6">
          {['Privacy Policy', 'Terms of Service', 'Contact'].map(l => (
            <a key={l} href="#"
              className="text-[12px] transition-colors hover:text-white"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              {l}
            </a>
          ))}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="relative z-10 flex items-center px-8 py-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Copyright */}
        <span className="text-[11px] shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Lead Gap CRM · All rights reserved.
        </span>

        {/* Animated social dock — truly centered */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <AnimatedDock items={DOCK_ITEMS} />
        </div>

        {/* Back to top */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="ml-auto w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
          <ArrowRight size={14} className="-rotate-90" />
        </button>
      </div>
    </footer>
  )
}

/* ─── Workspace Section ───────────────────────────────────────────────────── */
function WorkspaceSection() {
  const ref = useScrollReveal()
  return (
    <section ref={ref} className="py-24 px-6" style={{ background: '#F4F8FD' }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div className="flex flex-col gap-6 lp-in lp-in-delay-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#0047AB' }}>
              Built different
            </p>
            <h2 className="text-[34px] md:text-[42px] font-extrabold leading-tight tracking-tight" style={{ color: '#1A1F27' }}>
              The workspace that<br />actually gets work done.
            </h2>
            <p className="text-[16px] leading-relaxed" style={{ color: '#78889B', maxWidth: 380 }}>
              Most CRMs are built for software companies with IT teams and six-week onboarding. Lead Gap CRM is built for brokers — you&apos;re running leads in under 5 minutes.
            </p>

            <div className="flex flex-col gap-3">
              {[
                'All 5 portals in one inbox — no tab-switching',
                'Assign leads to agents in two clicks',
                'Follow-up reminders that actually fire on time',
                'Pipeline view your whole team can read at a glance',
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(0,71,171,0.10)', border: '1px solid rgba(0,71,171,0.18)' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#0047AB' }} />
                  </div>
                  <span className="text-[14px] leading-snug" style={{ color: '#263238' }}>{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: interactive bento card */}
          <div className="lp-in lp-in-delay-2">
            <WorkspaceBento />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Root ────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F4F8FD', fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}>
      <Nav />
      <Hero />
      <HeroScrollDash />
      <PortalStrip />
      <ProblemSection />
      <SolutionSection />
      <WorkspaceSection />
      <UniqueFeatures />
      <Features />
      <Stats />
      <HowItWorks />
      <KPIDashboard />
      <Testimonial />
      <CTASection />
      <CinematicFooter />
    </div>
  )
}
