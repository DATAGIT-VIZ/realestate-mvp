'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Building2, Zap, Shield, Bot, BarChart3, ChevronRight,
  ArrowRight, CheckCircle, Menu, X, Star, Users, TrendingUp,
  PhoneCall, Clock, Target, Sparkles, Home, Flame, Eye,
  Banknote, Calendar, Trophy, MapPin, User, BadgeCheck, Share2,
  Linkedin, Twitter, Instagram, Youtube,
} from 'lucide-react'

const Share2Icon = Share2
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts'
import FloatingDashboard from './FloatingDashboard'
import WorkspaceBento from './WorkspaceBento'
import { AnimatedDock } from '@/components/ui/animated-dock'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

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

function HeroSlide1({ secs }: { secs: number }) {
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  return (
    <div className="flex flex-col gap-3 px-4 py-3 h-full">
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.16)' }}>
        <span className="size-2 rounded-full bg-red-500 shrink-0"
          style={{ animation: 'bento-timer-pulse 1s ease-in-out infinite' }} />
        <span className="text-[12px] font-semibold flex-1 tabular-nums" style={{ color: '#080D18' }}>
          New lead · {mm}:{ss} ago
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ background: '#3B82F6' }}>99acres</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0 size-[72px]">
          <svg viewBox="0 0 88 88" width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="44" cy="44" r="36" fill="none" stroke="#F1F5F9" strokeWidth="8" />
            <circle cx="44" cy="44" r="36" fill="none" stroke="#3B82F6" strokeWidth="8"
              strokeDasharray={`${0.94 * HERO_CIRC} ${HERO_CIRC}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black leading-none tabular-nums" style={{ fontSize: 20, color: '#080D18' }}>94</span>
            <span className="font-semibold" style={{ fontSize: 8, color: '#94A3B8' }}>/100</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-extrabold truncate" style={{ fontSize: 15, color: '#080D18' }}>Rajesh Sharma</span>
          <span className="truncate" style={{ fontSize: 11, color: '#64748B' }}>3BHK · Whitefield, Blr</span>
          <span className="self-start px-2 py-0.5 rounded-full font-bold"
            style={{ fontSize: 10, background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.2)' }}>
            AI: High Intent
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {([
          { Icon: Eye,       text: 'Viewed 12 listings',  color: '#3B82F6' },
          { Icon: PhoneCall, text: 'Called twice in 24h',  color: '#7C3AED' },
          { Icon: Banknote,  text: 'Budget confirmed',     color: '#059669' },
        ] as { Icon: React.ElementType; text: string; color: string }[]).map(({ Icon, text, color }) => (
          <div key={text} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Icon className="w-3 h-3 shrink-0" style={{ color }} />
            <span className="text-[11px] font-medium" style={{ color: '#334155' }}>{text}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold text-white"
        style={{ fontSize: 12, background: '#3B82F6' }}>
        <Zap className="w-3.5 h-3.5 shrink-0" />
        Start call — highest close probability
      </div>
    </div>
  )
}

function HeroSlide2() {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 h-full">
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)' }}>
        <span className="size-2 rounded-full shrink-0"
          style={{ background: '#7C3AED', animation: 'bento-timer-pulse 2s ease-in-out infinite' }} />
        <span className="text-[12px] font-semibold flex-1" style={{ color: '#080D18' }}>5 leads scored by AI</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ background: '#7C3AED' }}>Just now</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0 size-[72px]">
          <svg viewBox="0 0 88 88" width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="44" cy="44" r="36" fill="none" stroke="#F1F5F9" strokeWidth="8" />
            <circle cx="44" cy="44" r="36" fill="none" stroke="#7C3AED" strokeWidth="8"
              strokeDasharray={`${0.87 * HERO_CIRC} ${HERO_CIRC}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black leading-none tabular-nums" style={{ fontSize: 20, color: '#080D18' }}>87</span>
            <span className="font-semibold" style={{ fontSize: 8, color: '#94A3B8' }}>/100</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-extrabold truncate" style={{ fontSize: 15, color: '#080D18' }}>Priya Mehta</span>
          <span className="truncate" style={{ fontSize: 11, color: '#64748B' }}>2BHK · Koramangala, Blr</span>
          <span className="self-start px-2 py-0.5 rounded-full font-bold"
            style={{ fontSize: 10, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
            AI: Warm Intent
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {([
          { Icon: Calendar,   text: 'Requested site visit',     color: '#7C3AED' },
          { Icon: BadgeCheck, text: 'Loan pre-approval shared', color: '#3B82F6' },
          { Icon: Building2,  text: 'Enquired 3 properties',    color: '#059669' },
        ] as { Icon: React.ElementType; text: string; color: string }[]).map(({ Icon, text, color }) => (
          <div key={text} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Icon className="w-3 h-3 shrink-0" style={{ color }} />
            <span className="text-[11px] font-medium" style={{ color: '#334155' }}>{text}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold text-white"
        style={{ fontSize: 12, background: '#7C3AED' }}>
        <User className="w-3.5 h-3.5 shrink-0" />
        Assign to agent — follow up today
      </div>
    </div>
  )
}

function HeroSlide3() {
  const steps = ['Lead', 'Qualified', 'Site Visit', 'Closed'] as const
  return (
    <div className="flex flex-col gap-3 px-4 py-3 h-full">
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.18)' }}>
        <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-[12px] font-semibold flex-1" style={{ color: '#080D18' }}>Deal confirmed</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ background: '#059669' }}>Closed</span>
      </div>
      <div className="px-3 py-2.5 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div className="font-black tabular-nums leading-none" style={{ fontSize: 30, color: '#080D18' }}>&#x20B9;1.2 Cr</div>
        <div className="mt-1" style={{ fontSize: 11, color: '#64748B' }}>3BHK · Koramangala, Blr</div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1" style={{ fontSize: 10, color: '#94A3B8' }}>
            <User className="w-3 h-3" /> Priya M.
          </div>
          <div className="flex items-center gap-1" style={{ fontSize: 10, color: '#94A3B8' }}>
            <Clock className="w-3 h-3" /> 8 days
          </div>
        </div>
      </div>
      <div className="relative">
        <div className="absolute top-2.5 left-[10%] right-[10%] h-px" style={{ background: '#059669' }} />
        <div className="relative grid grid-cols-4 gap-1">
          {steps.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="size-5 rounded-full flex items-center justify-center z-10 relative"
                style={{ background: i === steps.length - 1 ? '#3B82F6' : '#059669' }}>
                {i === steps.length - 1
                  ? <Trophy className="w-2.5 h-2.5 text-white" />
                  : <CheckCircle className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className="text-[8px] font-semibold text-center leading-tight"
                style={{ color: '#94A3B8' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-1 text-[9px] font-medium" style={{ color: '#94A3B8' }}>
            <Clock className="w-3 h-3" /> Closed in
          </div>
          <div className="font-black tabular-nums" style={{ fontSize: 18, color: '#080D18' }}>8 days</div>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-1 text-[9px] font-medium" style={{ color: '#94A3B8' }}>
            <Star className="w-3 h-3" /> Commission
          </div>
          <div className="font-black tabular-nums" style={{ fontSize: 18, color: '#080D18' }}>&#x20B9;72K</div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold text-white"
        style={{ fontSize: 12, background: '#3B82F6' }}>
        <BarChart3 className="w-3.5 h-3.5 shrink-0" />
        View full pipeline
      </div>
    </div>
  )
}

function TeakHeroCard() {
  const [active, setActive] = useState(0)
  const [flipping, setFlipping] = useState(false)
  const reduced = useReducedMotion()
  const [secs, setSecs] = useState(107)

  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setFlipping(true)
      setTimeout(() => {
        setActive(prev => (prev + 1) % 3)
        setFlipping(false)
      }, 280)
    }, 3600)
    return () => clearInterval(t)
  }, [])

  const slides = [
    <HeroSlide1 key="s1" secs={secs} />,
    <HeroSlide2 key="s2" />,
    <HeroSlide3 key="s3" />,
  ]

  return (
    <div className="relative select-none" style={{ width: 304 }}>

      {/* Ambient glow */}
      <div className="absolute -inset-6 -z-10 rounded-3xl blur-3xl opacity-[0.18]"
        style={{ background: 'radial-gradient(ellipse at 60% 40%, #3B82F6, #7C3AED)' }} />

      {/* Shadow cards */}
      <div className="absolute inset-0 rounded-2xl" style={{
        transform: 'translateY(16px) scale(0.90)',
        background: '#CBD5E1',
        zIndex: 1,
      }} />
      <div className="absolute inset-0 rounded-2xl" style={{
        transform: 'translateY(8px) scale(0.95)',
        background: '#E2E8F0',
        border: '1px solid #CBD5E1',
        zIndex: 2,
      }} />

      {/* Main card */}
      <div className="rounded-2xl overflow-hidden" style={{
        position: 'relative',
        zIndex: 3,
        background: '#ffffff',
        border: '1px solid #E2E8F0',
        boxShadow: '0 32px 64px rgba(8,13,24,0.13), 0 8px 20px rgba(8,13,24,0.07)',
      }}>

        {/* Static nav bar — never flips */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: '#080D18' }}>
          <div className="flex items-center gap-2">
            <div className="size-5 rounded flex items-center justify-center text-white font-black"
              style={{ background: '#3B82F6', fontSize: 8 }}>RE</div>
            <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>RealEdge CRM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400"
              style={{ animation: 'bento-timer-pulse 2s ease-in-out infinite' }} />
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Live</span>
          </div>
        </div>

        {/* Flipping content area */}
        <motion.div
          animate={reduced ? {} : {
            rotateY: flipping ? 90 : 0,
            opacity: flipping ? 0 : 1,
          }}
          transition={{ duration: 0.26, ease: 'easeInOut' }}
          style={{ transformPerspective: 900, minHeight: 320 }}
        >
          {slides[active]}
        </motion.div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center items-center gap-1.5 mt-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-full transition-colors duration-300" style={{
            height: 6,
            width: active === i ? 20 : 6,
            background: active === i ? '#3B82F6' : '#CBD5E1',
            transition: 'width 300ms ease, background 300ms ease',
          }} />
        ))}
      </div>

      {/* Floating badges */}
      <div className="absolute -top-4 -right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold shadow-lg whitespace-nowrap"
        style={{ background: 'white', border: '1px solid #E2E8F0', color: '#080D18', animation: 'lp-float 4s ease-in-out infinite' }}>
        <Home className="w-3 h-3" style={{ color: '#3B82F6' }} /> 24 leads synced
      </div>
      <div className="absolute -bottom-4 -left-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold shadow-lg whitespace-nowrap"
        style={{ background: 'white', border: '1px solid #E2E8F0', color: '#059669', animation: 'lp-float 5s ease-in-out infinite', animationDelay: '1.8s' }}>
        <CheckCircle className="w-3 h-3" /> 3 deals closing today
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

/* ─── Hero — split layout ─────────────────────────────────────────────────── */
function Hero() {
  return (
    <section
      id="lp-hero"
      className="relative min-h-screen flex items-center pt-16 pb-24 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <InteractiveGrid />

        <div
          className="absolute -top-32 right-0 w-[700px] h-[700px] opacity-[0.07] lp-blob"
          style={{ background: 'radial-gradient(ellipse at 60% 30%, #0047AB, transparent 65%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] opacity-[0.04] lp-blob"
          style={{ background: 'radial-gradient(ellipse, #2E66F6, transparent 70%)', animationDelay: '4s' }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: copy ── */}
          <div className="flex flex-col gap-7">
            {/* Badge */}
            <div
              className="lp-fade-up self-start flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold"
              style={{
                background: 'rgba(0,71,171,0.06)',
                border: '1px solid rgba(0,71,171,0.18)',
                color: '#0047AB',
                animationDelay: '0.05s',
                opacity: 0,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Built for India&apos;s real estate market
            </div>

            {/* Headline */}
            <h1
              className="lp-fade-up text-[48px] md:text-[58px] lg:text-[64px] font-extrabold leading-[1.04] tracking-tight text-[#1A1F27]"
              style={{ animationDelay: '0.15s', opacity: 0 }}
            >
              The CRM that turns<br />
              leads into{' '}
              <span style={{ color: '#0038A8', fontStyle: 'italic' }}>
                closed deals.
              </span>
            </h1>

            {/* Sub */}
            <p
              className="lp-fade-up text-[16px] md:text-[18px] text-[#78889B] leading-relaxed max-w-lg"
              style={{ animationDelay: '0.3s', opacity: 0 }}
            >
              Auto-capture leads from 99acres, MagicBricks &amp; Housing.com.
              AI follow-ups. Real-time pipeline. Built for how Indian builders actually sell.
            </p>

            {/* CTAs */}
            <div
              className="lp-fade-up flex flex-wrap gap-3"
              style={{ animationDelay: '0.45s', opacity: 0 }}
            >
              <Link
                href="/signup"
                className="flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-semibold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
                style={{ background: '#0038A8', boxShadow: '0 8px 28px rgba(0,56,168,0.30)' }}
              >
                Start free — no card needed
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-semibold text-[#263238] transition-all duration-200 hover:bg-white hover:shadow-md"
                style={{ border: '1.5px solid #E8ECF0', background: 'rgba(255,255,255,0.7)' }}
              >
                Book a demo
                <ChevronRight className="w-4 h-4 text-[#78889B]" />
              </Link>
            </div>

            {/* Trust */}
            <div
              className="lp-fade-up flex flex-wrap items-center gap-4 text-[12px] text-[#A4B1BE]"
              style={{ animationDelay: '0.6s', opacity: 0 }}
            >
              {['No credit card', 'Free 14-day trial', 'Setup in 5 minutes'].map((t, i) => (
                <div key={t} className="flex items-center gap-1.5">
                  {i > 0 && <div className="w-1 h-1 rounded-full bg-[#CBD5E1]" />}
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            {/* Inline stats */}
            <div
              className="lp-fade-up grid grid-cols-3 gap-6 pt-6 border-t border-[#E8ECF0]"
              style={{ animationDelay: '0.75s', opacity: 0 }}
            >
              {[
                { val: '3x', label: 'faster response' },
                { val: '40%', label: 'more deals closed' },
                { val: '6', label: 'portals synced' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-[26px] font-extrabold text-[#1A1F27]">{s.val}</div>
                  <div className="text-[11px] text-[#78889B] font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: animated card stack ── */}
          <div
            className="lp-fade-up hidden lg:flex justify-center items-center"
            style={{ animationDelay: '0.55s', opacity: 0 }}
          >
            <TeakHeroCard />
          </div>
        </div>

        {/* Mobile card (shows below text on small screens) */}
        <div
          className="lp-fade-up lg:hidden flex justify-center mt-16"
          style={{ animationDelay: '0.7s', opacity: 0 }}
        >
          <TeakHeroCard />
        </div>
      </div>
    </section>
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
  { name: '99acres',      mark: '99',  weight: 800 },
  { name: 'MagicBricks',  mark: '◆',   weight: 700 },
  { name: 'Housing.com',  mark: '⌂',   weight: 600 },
  { name: 'NoBroker',     mark: '◯',   weight: 800 },
  { name: 'Square Yards', mark: '⬜',  weight: 700 },
  { name: 'CommonFloor',  mark: '≡',   weight: 600 },
  { name: 'PropTiger',    mark: '▶',   weight: 700 },
  { name: 'Makaan',       mark: '⬔',   weight: 600 },
]

function PortalStrip() {
  // duplicate so the seam is invisible
  const doubled = [...PORTALS, ...PORTALS]

  return (
    <section className="border-y border-[#E8ECF0]" style={{ background: 'rgba(255,255,255,0.65)' }}>
      <p className="text-center text-[11px] font-semibold text-[#B8C4CE] uppercase tracking-[0.18em] pt-8 pb-5">
        Leads auto-synced from India&apos;s top portals
      </p>

      {/* Track with edge fades */}
      <div
        className="relative overflow-hidden pb-8"
        style={{
          maskImage: 'linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)',
        }}
      >
        <div className="lp-marquee-track flex w-max gap-16 items-center">
          {doubled.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 whitespace-nowrap select-none"
              style={{ color: '#C4CDD8' }}
            >
              <span
                className="text-[13px]"
                style={{ fontWeight: p.weight, lineHeight: 1 }}
              >
                {p.mark}
              </span>
              <span
                className="text-[17px] tracking-tight"
                style={{ fontWeight: p.weight, color: '#C4CDD8' }}
              >
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Bento Features (Magic UI bento-grid style) ─────────────────────────── */

/* BentoGrid + BentoCard ---------------------------------------------------- */
function BentoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid w-full grid-cols-3 gap-4" style={{ gridAutoRows: '22rem' }}>
      {children}
    </div>
  )
}

function BentoCard({
  Icon, name, description, background, className = '', href = '#', cta = 'Learn more',
}: {
  Icon: React.ElementType
  name: string
  description: string
  background?: React.ReactNode
  className?: string
  href?: string
  cta?: string
}) {
  return (
    <div
      className={`group relative col-span-3 overflow-hidden rounded-2xl bg-white ${className}`}
      style={{ border: '1px solid #E8ECF0' }}
    >
      {/* Background visualization fills the whole card */}
      <div className="pointer-events-none absolute inset-0">{background}</div>

      {/* Gradient wash — covers bottom 160px so label is always on clean white */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[5]"
        style={{ height: 160, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.97) 38%, white 62%)' }} />

      {/* Static label — no slide animation */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-1 px-6 pb-5 pt-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1 bg-white"
          style={{ border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <Icon className="w-4.5 h-4.5 text-[#263238]" />
        </div>
        <h3 className="text-[16px] font-bold text-[#1A1F27]">{name}</h3>
        <p className="text-[12px] text-[#78889B] leading-relaxed max-w-xs">{description}</p>
        <a href={href} className="pointer-events-auto mt-1 flex items-center gap-1 text-[12px] font-semibold text-[#0047AB] hover:underline transition-colors w-fit">
          {cta} <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}

/* Marquee lead cards (Cell 1 background) ------------------------------------ */
const LEAD_CARDS_BENTO = [
  { source: '99acres',     name: 'Rajesh Sharma', budget: '₹1.2 Cr', type: '3BHK Whitefield' },
  { source: 'MagicBricks', name: 'Priya Mehta',   budget: '₹85 L',   type: '2BHK Koramangala' },
  { source: 'Housing.com', name: 'Vikram Singh',  budget: '₹2.1 Cr', type: '4BHK Jubilee Hills' },
  { source: 'NoBroker',    name: 'Anita Reddy',   budget: '₹65 L',   type: '2BHK HSR Layout' },
  { source: 'PropTiger',   name: 'Rohit Kumar',   budget: '₹1.8 Cr', type: '3BHK Banjara Hills' },
]
const LEAD_ROW2 = [
  { source: 'Square Yards', name: 'Deepa Nair',  budget: '₹92 L',   type: '2BHK Gurgaon'   },
  { source: '99acres',      name: 'Amit Shah',   budget: '₹1.5 Cr', type: '3BHK Noida'      },
  { source: 'Housing.com',  name: 'Smita Patel', budget: '₹76 L',   type: '2BHK Pune'       },
  { source: 'NoBroker',     name: 'Karthik V.',  budget: '₹2.4 Cr', type: '4BHK Chennai'    },
  { source: 'PropTiger',    name: 'Ritu Sharma', budget: '₹1.1 Cr', type: '3BHK Hyderabad'  },
]
const SOURCE_DOT_COLORS: Record<string, string> = {
  '99acres': '#FF4800', 'MagicBricks': '#E53935', 'Housing.com': '#1565C0',
  'NoBroker': '#FF6F00', 'PropTiger': '#2E7D32', 'Square Yards': '#7B1FA2',
}


function BentoLeadMarquee() {
  const allCards = [...LEAD_CARDS_BENTO, ...LEAD_ROW2, ...LEAD_CARDS_BENTO, ...LEAD_ROW2]
  return (
    <div
      className="absolute top-0 left-3 right-3 overflow-hidden"
      style={{
        height: 'calc(100% - 110px)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 72%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 72%, transparent 100%)',
      }}
    >
      <div className="lp-marquee-track-v flex flex-col gap-3" style={{ animationDuration: '22s' }}>
        {allCards.map((c, i) => (
          <div key={i} className="rounded-xl p-3.5 bg-white shadow-sm shrink-0"
            style={{ border: '1px solid #E8ECF0' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: SOURCE_DOT_COLORS[c.source] ?? '#0047AB' }} />
              <span className="text-[9px] font-bold uppercase tracking-wide flex-1 truncate"
                style={{ color: SOURCE_DOT_COLORS[c.source] ?? '#0047AB' }}>{c.source}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-bold text-[#1A1F27] truncate">{c.name}</div>
              <div className="text-[12px] font-semibold shrink-0" style={{ color: '#0047AB' }}>{c.budget}</div>
            </div>
            <div className="text-[10px] text-[#A4B1BE] mt-0.5 truncate">{c.type}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Animated event feed (Cell 2 background) ----------------------------------- */
const FEED_EVENTS = [
  { Icon: Zap,          title: 'New lead synced',       sub: '99acres · Rajesh Sharma',    time: '2m ago',  color: '#2E66F6' },
  { Icon: Bot,          title: 'AI score updated',       sub: 'Intent 94/100 · Hot lead',   time: '4m ago',  color: '#059669' },
  { Icon: Trophy,       title: 'Deal closed',            sub: '₹1.2 Cr · Vikram Singh',     time: '11m ago', color: '#0047AB' },
  { Icon: Calendar,     title: 'Site visit booked',      sub: 'Tomorrow 10AM · Sector 62',  time: '28m ago', color: '#9333EA' },
  { Icon: PhoneCall,    title: 'Follow-up reminder',     sub: 'Priya Mehta · Call due',     time: '45m ago', color: '#F59E0B' },
  { Icon: CheckCircle,  title: 'Booking received',       sub: '₹12L token · Anita R.',      time: '1h ago',  color: '#059669' },
]

function BentoActivityFeed({ className }: { className?: string }) {
  const [items, setItems] = useState(FEED_EVENTS.slice(0, 3))
  const idxRef = useRef(0)

  useEffect(() => {
    const t = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % FEED_EVENTS.length
      setItems(prev => [FEED_EVENTS[idxRef.current], ...prev.slice(0, 2)])
    }, 2400)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      className={`flex flex-col gap-3 w-full ${className ?? ''}`}
      style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 58%, transparent 82%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 58%, transparent 82%)' }}
    >
      {items.map((ev, i) => (
        <div
          key={`${ev.title}-${i}`}
          className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white lp-slide-in"
          style={{
            border: '1px solid #E8ECF0',
            borderLeft: `3px solid ${ev.color}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            animationDelay: i === 0 ? '0s' : '99s',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${ev.color}15`, border: `1.5px solid ${ev.color}30` }}
          >
            <ev.Icon className="w-4 h-4" style={{ color: ev.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#1A1F27] truncate">{ev.title}</div>
            <div className="text-[11px] text-[#78889B] truncate mt-0.5">{ev.sub}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-[10px] text-[#A4B1BE] whitespace-nowrap">{ev.time}</span>
            <div className="w-2 h-2 rounded-full" style={{ background: ev.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* Animated portal beam (Cell 3 background) ---------------------------------- */
const BEAM_PORTALS = [
  { label: '99', name: '99acres',     color: '#FF4800', y: 15  },
  { label: 'MB', name: 'MagicBricks', color: '#E53935', y: 30  },
  { label: 'HO', name: 'Housing',     color: '#1565C0', y: 45  },
  { label: 'NB', name: 'NoBroker',    color: '#FF6F00', y: 60  },
  { label: 'PT', name: 'PropTiger',   color: '#2E7D32', y: 75  },
]

function BentoPortalBeam({ className }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 flex items-center gap-0 overflow-hidden ${className ?? ''}`}
      style={{ padding: '20px 20px 90px 20px' }}
    >
      {/* Left: portal pills */}
      <div className="flex flex-col gap-2 shrink-0 z-10">
        {BEAM_PORTALS.map((p, i) => (
          <div
            key={p.label}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white shadow-sm"
            style={{ border: `1.5px solid ${p.color}40`, color: p.color }}
          >
            <div className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: p.color, animationDelay: `${i * 0.3}s` }} />
            {p.name}
          </div>
        ))}
      </div>

      {/* Middle: SVG beams spanning the flex gap — `none` ratio so x=0..300 maps to container width */}
      <div className="flex-1 relative self-stretch mx-2">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200" preserveAspectRatio="none">
          <defs>
            {BEAM_PORTALS.map((p) => (
              <linearGradient key={p.label} id={`bg2-${p.label}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={p.color} stopOpacity="0.9" />
                <stop offset="65%" stopColor={p.color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={p.color} stopOpacity="0.05" />
              </linearGradient>
            ))}
          </defs>
          {BEAM_PORTALS.map((p, i) => {
            const y = 22 + i * 39
            const pathD = `M 0,${y} C 100,${y} 180,100 280,100`
            return (
              <g key={p.label}>
                <path d={pathD} fill="none" stroke={`url(#bg2-${p.label})`} strokeWidth="1.8" />
                <circle r="3.5" fill={p.color} opacity="0.95">
                  <animateMotion dur="1.9s" repeatCount="indefinite" begin={`${i * 0.36}s`} path={pathD} />
                </circle>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Right: Lead Gap CRM node + output pills */}
      <div className="flex items-center gap-3 shrink-0 z-10">
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-18 h-18 rounded-3xl border animate-ping opacity-20"
              style={{ borderColor: '#0047AB', animationDuration: '2.2s', width: 72, height: 72 }} />
            <div className="absolute -inset-2 rounded-3xl blur-xl opacity-35" style={{ background: '#0047AB' }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl z-10"
              style={{ background: '#0038A8' }}>
              <Building2 className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-[9px] font-bold text-[#78889B] mt-2 text-center">Lead Gap CRM</div>
        </div>

        <div className="flex flex-col gap-2">
          {[
            { Icon: Zap, label: 'Auto assign', color: '#2E66F6' },
            { Icon: Bot, label: 'AI score',    color: '#059669' },
          ].map(({ Icon, label, color }) => (
            <div key={label}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white shadow-sm text-[10px] font-semibold"
              style={{ border: `1.5px solid ${color}30`, color }}>
              <Icon className="w-3 h-3" /> {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Mini pipeline board (Cell 4 background) ----------------------------------- */
function BentoPipelineBoard() {
  const columns = [
    {
      label: 'New', color: '#2E66F6',
      deals: [
        { init: 'RS', name: 'Rajesh S.', budget: '₹1.2 Cr' },
        { init: 'PM', name: 'Priya M.',  budget: '₹85 L'   },
        { init: 'VK', name: 'Vikram K.', budget: '₹2.1 Cr' },
      ],
    },
    {
      label: 'Visiting', color: '#0047AB',
      deals: [
        { init: 'AR', name: 'Anita R.', budget: '₹65 L'   },
        { init: 'RK', name: 'Rohit K.', budget: '₹1.8 Cr' },
      ],
    },
    {
      label: 'Closing', color: '#9333EA',
      deals: [
        { init: 'SK', name: 'Suresh K.', budget: '₹90 L'   },
        { init: 'NG', name: 'Nisha G.',  budget: '₹1.5 Cr' },
      ],
    },
    {
      label: 'Closed', color: '#059669',
      deals: [
        { init: 'MG', name: 'Mohan G.', budget: '₹75 L'   },
        { init: 'AK', name: 'Arun K.',  budget: '₹1.1 Cr' },
      ],
    },
  ]

  return (
    <div
      className="absolute top-5 inset-x-3"
      style={{
        maskImage: 'linear-gradient(to bottom, #000 55%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent 95%)',
      }}
    >
      <div className="grid grid-cols-4 gap-2">
        {columns.map(col => (
          <div key={col.label}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: col.color }}>
                {col.label}
              </span>
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold"
                style={{ background: col.color }}
              >
                {col.deals.length}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {col.deals.map((deal, i) => (
                <div
                  key={i}
                  className="rounded-lg p-2"
                  style={{ background: `${col.color}0d`, border: `1px solid ${col.color}22` }}
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[6px] font-bold shrink-0"
                      style={{ background: col.color }}
                    >
                      {deal.init}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[8px] font-semibold text-[#263238] truncate">{deal.name}</div>
                      <div className="text-[7px] font-bold" style={{ color: col.color }}>{deal.budget}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="py-28">
      <div className="max-w-6xl mx-auto px-6">
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
          {/* Cell 1: Auto Lead Sync — 1 col, lead card marquee */}
          <BentoCard
            Icon={Zap}
            name="Auto Lead Sync"
            description="Leads flow in from every portal the moment they are posted — zero manual copy-paste."
            className="lg:col-span-1"
            href="#"
            cta="See how it works"
            background={<BentoLeadMarquee />}
          />

          {/* Cell 2: Live Activity Feed — 2 cols, animated notification list */}
          <BentoCard
            Icon={TrendingUp}
            name="Live Activity Feed"
            description="Every lead event — synced, scored, assigned, closed — appears in real time."
            className="lg:col-span-2"
            href="#"
            cta="View pipeline"
            background={
              <BentoActivityFeed className="absolute top-6 right-4 left-4" />
            }
          />

          {/* Cell 3: Portal Integrations — 2 cols, animated beam */}
          <BentoCard
            Icon={Share2Icon}
            name="Portal Integrations"
            description="Connect 99acres, MagicBricks, Housing.com, NoBroker and more — leads routed automatically."
            className="lg:col-span-2"
            href="#"
            cta="See all integrations"
            background={
              <BentoPortalBeam className="absolute inset-0" />
            }
          />

          {/* Cell 4: Pipeline Board — 1 col, mini kanban */}
          <BentoCard
            Icon={BarChart3}
            name="Live Pipeline"
            description="Every deal stage, visible at a glance. Know exactly what to close next."
            className="lg:col-span-1"
            href="#"
            cta="Open pipeline"
            background={<BentoPipelineBoard />}
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
          <div className="text-[22px] mb-1">🎉</div>
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
  return (
    <section ref={ref} className="py-24 px-6" style={{ background: '#EDEAE3' }}>
      <div className="max-w-5xl mx-auto">

        {/* Centred intro — heading one line, description below */}
        <div className="mb-14 text-center flex flex-col items-center">
          <div className="lp-in lp-in-delay-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#0038A8' }}>
              Sound familiar?
            </p>
            <h2 className="text-[24px] sm:text-[32px] md:text-[42px] font-extrabold leading-tight tracking-tight" style={{ color: '#0F172A' }}>
              This is how brokers lose deals every day.
            </h2>
          </div>
          <div className="lp-in lp-in-delay-2 mt-4">
            <p className="text-[16px] leading-relaxed" style={{ color: '#64748B', maxWidth: 480 }}>
              Three silent problems eating your revenue every month. Every Indian broker knows them. Most never fix them.
            </p>
          </div>
        </div>

        {/* Outer bento card */}
        <div
          className="lp-in lp-in-delay-3 rounded-3xl overflow-hidden"
          style={{
            background: 'white',
            border: '1.5px solid #DDD9D1',
            boxShadow: '0 4px 32px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
          }}
        >
          <PortalChaosCard />
          <div className="grid md:grid-cols-2">
            <SpeedCard />
            <VisibilityCard />
          </div>
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
    <section ref={ref} className="py-28 px-6" style={{ background: 'white' }}>
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
              className={`lp-in lp-in-delay-${i + 1} rounded-2xl p-8 flex flex-col md:flex-row gap-8 items-start`}
              style={{ background: '#F8F9FB', border: '1px solid #E8ECF0' }}
            >
              {/* Left: icon + copy */}
              <div className="flex flex-col gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: s.bg }}>
                    <s.icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.fix}</span>
                </div>
                <h3 className="text-[20px] font-bold text-[#1A1F27] leading-snug">{s.title}</h3>
                <p className="text-[14px] text-[#78889B] leading-relaxed">{s.body}</p>
              </div>
              {/* Right: bullet checklist */}
              <div className="flex flex-col gap-3 shrink-0 md:w-64">
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
      <PortalStrip />
      <ProblemSection />
      <SolutionSection />
      <WorkspaceSection />
      <Features />
      <Stats />
      <HowItWorks />
      <KPIDashboard />
      <Testimonial />
      <CTASection />
      <Footer />
    </div>
  )
}
