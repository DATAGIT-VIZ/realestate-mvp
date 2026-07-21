'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Building2, Zap, Shield, Bot, BarChart3, ChevronRight,
  ArrowRight, CheckCircle, Menu, X, Star, Users, TrendingUp,
  PhoneCall, Clock, Target, Sparkles,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts'
import FloatingDashboard from './FloatingDashboard'

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
            style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)' }}
          >
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[#263238] text-[15px] tracking-tight">Vya Pulse</span>
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
            style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)' }}
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
              style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)' }}>
              Get started free
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

/* ─── Animated card stack (teak.io inspired) ─────────────────────────────── */
const CARDS = [
  {
    badge: '⚡ New lead synced',
    badgeColor: '#2E66F6',
    title: 'Rajesh Sharma',
    sub: '+91 98765 43210  ·  ₹1.2 Cr',
    detail: 'MagicBricks  ·  3BHK Whitefield, Bengaluru',
    bottom: (
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#78889B]">Synced just now</span>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: 'rgba(255,112,67,0.1)', color: '#FF7043' }}>
          🔥 Hot
        </span>
      </div>
    ),
  },
  {
    badge: '🤖 AI analysis done',
    badgeColor: '#059669',
    title: 'Intent score: 94 / 100',
    sub: 'High purchase intent detected',
    detail: 'Viewed 12 listings · Called twice · Budget confirmed',
    bottom: (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-[#78889B]">Budget match</span>
          <span className="font-bold text-emerald-600">✓ Perfect fit</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E8ECF0' }}>
          <div className="h-full rounded-full" style={{ width: '94%', background: 'linear-gradient(90deg, #FF7043, #E64A19)' }} />
        </div>
      </div>
    ),
  },
  {
    badge: '🎉 Deal closed!',
    badgeColor: '#FF7043',
    title: '₹1.2 Cr booked',
    sub: '3BHK · Whitefield, Bengaluru',
    detail: 'Rajesh Sharma  ·  Closed in 8 days from first enquiry',
    bottom: (
      <div className="flex items-center gap-2 text-[12px] font-semibold text-emerald-600">
        <CheckCircle className="w-4 h-4" />
        Booking amount received
      </div>
    ),
  },
]

function AnimatedCardStack() {
  const [active, setActive] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setExiting(true)
      setTimeout(() => {
        setActive(prev => (prev + 1) % CARDS.length)
        setExiting(false)
      }, 380)
    }, 3200)
    return () => clearInterval(t)
  }, [])

  const card = CARDS[active]

  return (
    <div className="relative w-[340px] select-none" style={{ height: 400 }}>
      {/* Ambient glow */}
      <div
        className="absolute inset-8 -z-10 blur-3xl opacity-25 rounded-3xl"
        style={{ background: 'linear-gradient(135deg, #FF7043 0%, #2E66F6 100%)' }}
      />

      {/* Shadow card 2 */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'white',
          border: '1px solid #E8ECF0',
          transform: 'translateY(18px) scale(0.88)',
          opacity: 0.3,
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}
      />
      {/* Shadow card 1 */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'white',
          border: '1px solid #E8ECF0',
          transform: 'translateY(9px) scale(0.94)',
          opacity: 0.55,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      />

      {/* Active card — 3D Y-flip on transition */}
      <div
        className="absolute inset-0 rounded-2xl p-6 flex flex-col gap-4"
        style={{
          background: 'white',
          border: '1px solid #E8ECF0',
          boxShadow: '0 24px 64px rgba(0,0,0,0.13)',
          transform: exiting
            ? 'perspective(700px) rotateY(90deg) scale(0.94)'
            : 'perspective(700px) rotateY(0deg) scale(1)',
          opacity: exiting ? 0 : 1,
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
        }}
      >
        {/* Badge */}
        <div
          className="self-start px-3 py-1.5 rounded-full text-[11px] font-bold text-white"
          style={{ background: card.badgeColor }}
        >
          {card.badge}
        </div>

        <div className="flex-1 flex flex-col gap-3">
          <div className="text-[22px] font-extrabold text-[#1A1F27] leading-tight">{card.title}</div>
          <div className="text-[13px] font-medium text-[#78889B]">{card.sub}</div>
          <div
            className="p-3 rounded-xl text-[12px] text-[#78889B] leading-relaxed"
            style={{ background: '#F5F6FA', border: '1px solid #F0F3F7' }}
          >
            {card.detail}
          </div>
        </div>

        <div>{card.bottom}</div>
      </div>

      {/* Floating pills */}
      <div
        className="absolute -top-5 -right-10 px-3 py-1.5 rounded-full text-[11px] font-semibold shadow-md whitespace-nowrap"
        style={{
          background: 'white',
          border: '1px solid #E8ECF0',
          color: '#FF7043',
          animation: 'lp-float 4s ease-in-out infinite',
        }}
      >
        🏠 24 leads synced
      </div>
      <div
        className="absolute -bottom-5 -left-10 px-3 py-1.5 rounded-full text-[11px] font-semibold shadow-md whitespace-nowrap"
        style={{
          background: 'white',
          border: '1px solid #E8ECF0',
          color: '#059669',
          animation: 'lp-float 5s ease-in-out infinite',
          animationDelay: '1.8s',
        }}
      >
        ✅ 3 deals closing today
      </div>

      {/* Progress dots */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
        {CARDS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: i === active ? 20 : 6,
              height: 6,
              background: i === active ? '#FF7043' : '#D1D9E0',
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Hero — split layout ─────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 pb-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.38]"
          style={{
            backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          className="absolute -top-32 right-0 w-[700px] h-[700px] opacity-[0.08] lp-blob"
          style={{ background: 'radial-gradient(ellipse at 60% 30%, #FF7043, transparent 65%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] opacity-[0.05] lp-blob"
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
                background: 'rgba(255,112,67,0.08)',
                border: '1px solid rgba(255,112,67,0.22)',
                color: '#FF7043',
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
              <span
                style={{
                  background: 'linear-gradient(130deg, #FF7043 0%, #E64A19 60%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontStyle: 'italic',
                }}
              >
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
                style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)', boxShadow: '0 8px 28px rgba(255,112,67,0.38)' }}
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
            <AnimatedCardStack />
          </div>
        </div>

        {/* Mobile card (shows below text on small screens) */}
        <div
          className="lp-fade-up lg:hidden flex justify-center mt-16"
          style={{ animationDelay: '0.7s', opacity: 0 }}
        >
          <AnimatedCardStack />
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
          <stop offset="0%" stopColor="#FF7043" />
          <stop offset="100%" stopColor="#E64A19" />
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
                    { label: 'Hot leads',  count: 12, color: '#FF7043' },
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
                        <stop offset="5%"  stopColor="#FF7043" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#FF7043" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#A4B1BE' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1A1F27', border: 'none', borderRadius: 8, fontSize: 11, color: 'white', padding: '6px 10px' }}
                      cursor={{ stroke: '#FF7043', strokeWidth: 1, strokeDasharray: '4 2' }}
                      formatter={(v: number) => [`${v} leads`, '']}
                    />
                    <Area type="monotone" dataKey="leads" stroke="#FF7043" strokeWidth={2} fill="url(#area-fill)" dot={false} activeDot={{ r: 4, fill: '#FF7043', stroke: 'white', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="text-[10px] font-bold text-[#A4B1BE] uppercase tracking-widest">Recent leads</div>

              <div className="flex flex-col gap-3">
                {RECENT_LEADS.map((lead, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ background: 'linear-gradient(135deg, #FF7043, #2E66F6)' }}
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
                          ? { background: 'rgba(255,112,67,0.1)', color: '#FF7043' }
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
                    style={{ width: '70%', background: 'linear-gradient(90deg, #FF7043, #E64A19)' }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-[#A4B1BE]">
                  <span>₹0</span>
                  <span className="font-semibold text-[#FF7043]">70%</span>
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
                  <div key={s.label} className="p-3 rounded-xl" style={{ background: '#F5F6FA' }}>
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

/* ─── Features ────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <Zap className="w-5 h-5" />,
    color: '#FF7043',
    title: 'Auto Lead Capture',
    desc: "Leads flow in from every portal the moment they're posted. Zero manual copy-paste. Your inbox, automated.",
    bullets: ['99acres, MagicBricks, Housing.com', 'Duplicate detection', 'Instant agent assignment'],
  },
  {
    icon: <Shield className="w-5 h-5" />,
    color: '#2E66F6',
    title: 'Team Isolation',
    desc: 'Every agent sees only their own leads. Managers see everything. No lead poaching, no confusion.',
    bullets: ['Role-based views', 'Manager oversight panel', 'Zero cross-contamination'],
  },
  {
    icon: <Bot className="w-5 h-5" />,
    color: '#059669',
    title: 'AI Follow-up Engine',
    desc: 'Smart reminders, intent scoring, and follow-up suggestions so you never let a hot lead go cold.',
    bullets: ['Intent score (Hot / Warm / Cold)', 'Auto-reminder cadence', 'WhatsApp-ready templates'],
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    color: '#9333EA',
    title: 'Real-time Pipeline',
    desc: 'Know exactly where every deal stands. From first enquiry to booking — one view, live.',
    bullets: ['Kanban + list view', 'Stage-wise revenue forecast', 'Team leaderboard'],
  },
]

function Features() {
  const ref = useScrollReveal()
  return (
    <section id="features" className="py-28" ref={ref}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="lp-in lp-in-delay-1 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold mb-5"
            style={{ background: 'rgba(255,112,67,0.08)', border: '1px solid rgba(255,112,67,0.2)', color: '#FF7043' }}>
            <Target className="w-3.5 h-3.5" /> Everything your team needs
          </div>
          <h2 className="lp-in lp-in-delay-2 text-[38px] md:text-[46px] font-extrabold text-[#1A1F27] leading-tight tracking-tight">
            Built for how Indian real estate<br className="hidden md:block" /> teams actually work
          </h2>
          <p className="lp-in lp-in-delay-3 text-[16px] text-[#78889B] mt-4 max-w-xl mx-auto">
            No generic SaaS fluff. Every feature built around the reality of selling apartments in India.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`lp-in lp-in-delay-${(i % 4) + 1} group p-7 rounded-2xl border border-[#E8ECF0] bg-white hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ background: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="text-[18px] font-bold text-[#1A1F27] mb-2">{f.title}</h3>
              <p className="text-[14px] text-[#78889B] leading-relaxed mb-5">{f.desc}</p>
              <ul className="flex flex-col gap-2">
                {f.bullets.map(b => (
                  <li key={b} className="flex items-center gap-2.5 text-[13px] text-[#263238] font-medium">
                    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: f.color }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
          style={{ background: 'linear-gradient(135deg,#FF7043,#E64A19)' }}>
          <Building2 className="w-7 h-7 text-white" />
        </div>
        {pulse && <div className="absolute inset-0 rounded-2xl border-2 border-[#FF7043] animate-ping opacity-40" />}
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
          : { background: 'rgba(255,112,67,0.12)', border: '1px solid rgba(255,112,67,0.25)', color: '#FF7043' }}>
        <div className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: allDone ? '#10B981' : '#FF7043' }} />
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
            style={{ background: 'linear-gradient(135deg,#FF7043,#2E66F6)' }}>RS</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white">New lead · MagicBricks</div>
            <div className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>Rajesh Sharma · ₹1.2 Cr · 3BHK</div>
          </div>
          <div className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0"
            style={{ background: 'rgba(255,112,67,0.2)', color: '#FF7043' }}>🔥 Hot</div>
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
            style={{ color: score >= 80 ? '#FF7043' : score >= 50 ? '#F59E0B' : 'white' }}>
            {score}
          </div>
          <div className="text-[18px] font-bold pb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>/100</div>
          {(phase === 'hot' || phase === 'closed') && (
            <div className="ml-auto px-3 py-1.5 rounded-full text-[11px] font-extrabold lp-fade-up"
              style={{ background: 'rgba(255,112,67,0.2)', color: '#FF7043', border: '1px solid rgba(255,112,67,0.4)' }}>
              🔥 Hot Lead
            </div>
          )}
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-75"
            style={{ width: `${score}%`, background: score >= 80 ? 'linear-gradient(90deg,#FF7043,#E64A19)' : score >= 50 ? '#F59E0B' : '#2E66F6' }} />
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
          style={{ background: 'linear-gradient(135deg,rgba(255,112,67,0.15),rgba(230,74,25,0.08))', border: '1px solid rgba(255,112,67,0.3)' }}>
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
    { num: '01', color: '#FF7043', icon: <PhoneCall className="w-5 h-5" />, title: 'Connect your portals', desc: 'Paste credentials once. Leads pull in automatically 24/7 — no human in the loop.', card: <PortalSyncCard /> },
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
            <Star key={i} className="w-5 h-5 fill-[#FF7043] text-[#FF7043]" />
          ))}
        </div>
        <blockquote className="lp-in lp-in-delay-2 text-[22px] md:text-[28px] font-bold text-[#1A1F27] leading-snug tracking-tight mb-8">
          &ldquo;Before Vya Pulse, our agents were chasing leads on WhatsApp groups.
          Now everything&apos;s in one place and our conversion rate is up 35%.&rdquo;
        </blockquote>
        <div className="lp-in lp-in-delay-3 flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
            style={{ background: 'linear-gradient(135deg, #FF7043, #2E66F6)' }}>
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

/* ─── CTA ─────────────────────────────────────────────────────────────────── */
function CTASection() {
  const ref = useScrollReveal()
  return (
    <section ref={ref} className="py-24 px-6">
      <div className="lp-in lp-in-delay-1 max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1A1F27 0%, #263238 100%)' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #FF7043, transparent)' }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold mb-6"
            style={{ background: 'rgba(255,112,67,0.12)', border: '1px solid rgba(255,112,67,0.25)', color: '#FF7043' }}>
            <Sparkles className="w-3.5 h-3.5" /> Free 14-day trial — no credit card
          </div>
          <h2 className="text-[36px] md:text-[48px] font-extrabold text-white leading-tight tracking-tight mb-4">
            Ready to close more deals?
          </h2>
          <p className="text-[16px] text-[#78889B] max-w-lg mx-auto mb-8">
            Join real estate teams across India who&apos;ve switched from messy spreadsheets to Vya Pulse.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-semibold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)', boxShadow: '0 8px 30px rgba(255,112,67,0.4)' }}
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
function Footer() {
  return (
    <footer className="py-12 border-t border-[#E8ECF0]" style={{ background: '#FAFBFC' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF7043, #E64A19)' }}>
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#263238] text-[14px]">Vya Pulse</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[13px] text-[#78889B]">
            {['Features', 'Pricing', 'Privacy', 'Terms', 'Contact'].map(l => (
              <a key={l} href="#" className="hover:text-[#263238] transition-colors">{l}</a>
            ))}
          </div>
          <div className="text-[12px] text-[#A4B1BE]">© 2026 Vya Pulse · Made with ❤️ in India</div>
        </div>
      </div>
    </footer>
  )
}

/* ─── Root ────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F5F6FA', fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}>
      <Nav />
      <Hero />
      <KPIDashboard />
      <PortalStrip />
      <Features />
      <Stats />
      <HowItWorks />
      <Testimonial />
      <FloatingDashboard />
      <CTASection />
      <Footer />
    </div>
  )
}
