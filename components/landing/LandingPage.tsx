'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Building2, Zap, Shield, Bot, BarChart3, ChevronRight,
  ArrowRight, CheckCircle, Menu, X, Star, Users, TrendingUp,
  PhoneCall, Clock, Target, Sparkles,
} from 'lucide-react'

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
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)' }}
          >
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[#263238] text-[15px] tracking-tight">Vya Pulse</span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7">
          {['Features', 'How it works', 'Pricing'].map(l => (
            <a
              key={l}
              href={`#${l.toLowerCase().replace(' ', '-')}`}
              className="text-[13px] font-medium text-[#78889B] hover:text-[#263238] transition-colors"
            >
              {l}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-[13px] font-medium text-[#78889B] hover:text-[#263238] transition-colors px-4 py-2"
          >
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

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-black/5 transition-colors"
          onClick={() => setOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5 text-[#263238]" /> : <Menu className="w-5 h-5 text-[#263238]" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-[#E8ECF0] px-6 py-5 flex flex-col gap-4 shadow-lg">
          {['Features', 'How it works', 'Pricing'].map(l => (
            <a
              key={l}
              href={`#${l.toLowerCase().replace(' ', '-')}`}
              className="text-[14px] font-medium text-[#78889B]"
              onClick={() => setOpen(false)}
            >
              {l}
            </a>
          ))}
          <div className="border-t border-[#E8ECF0] pt-4 flex flex-col gap-3">
            <Link href="/login" className="text-[14px] font-medium text-[#78889B] text-center py-2">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-[14px] font-semibold text-white py-3 rounded-full text-center"
              style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)' }}
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

/* ─── App Mockup ──────────────────────────────────────────────────────────── */
function AppMockup() {
  const leads = [
    { name: 'Rajesh Sharma', phone: '+91 98765 43210', status: 'Hot', source: 'MagicBricks', budget: '₹1.2 Cr', time: '2m ago' },
    { name: 'Priya Mehta', phone: '+91 87654 32109', status: 'Warm', source: '99acres', budget: '₹85 L', time: '14m ago' },
    { name: 'Vikram Singh', phone: '+91 76543 21098', status: 'Hot', source: 'Housing.com', budget: '₹2.1 Cr', time: '1h ago' },
    { name: 'Ananya Patel', phone: '+91 65432 10987', status: 'Cold', source: 'Walk-in', budget: '₹1.5 Cr', time: '3h ago' },
    { name: 'Suresh Kumar', phone: '+91 54321 09876', status: 'Warm', source: 'MagicBricks', budget: '₹70 L', time: '5h ago' },
  ]

  const statusColor: Record<string, string> = {
    Hot: 'bg-[#FF7043]/10 text-[#FF7043]',
    Warm: 'bg-amber-50 text-amber-600',
    Cold: 'bg-[#78889B]/10 text-[#78889B]',
  }

  return (
    <div className="lp-float relative w-full max-w-4xl mx-auto mt-14 select-none pointer-events-none">
      {/* Ambient glow */}
      <div
        className="absolute inset-x-16 -bottom-6 h-24 blur-2xl opacity-30 rounded-full"
        style={{ background: 'linear-gradient(90deg, #FF7043 0%, #2E66F6 100%)' }}
      />

      {/* Browser chrome */}
      <div
        className="relative rounded-2xl overflow-hidden ring-1 shadow-2xl"
        style={{ background: '#1A1F27', outline: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: '#242A33' }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#FEBC2E' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#28C840' }} />
          </div>
          <div className="flex-1 mx-6">
            <div className="rounded-md px-3 py-1 text-[11px] text-[#78889B] font-mono text-center max-w-xs mx-auto" style={{ background: '#1A1F27' }}>
              app.vyapulse.in/dashboard/leads
            </div>
          </div>
        </div>

        {/* App UI */}
        <div className="flex" style={{ height: 380 }}>
          {/* Sidebar */}
          <div className="w-48 shrink-0 flex flex-col p-3 gap-0.5" style={{ background: '#F5F6FA', borderRight: '1px solid #E8ECF0' }}>
            <div className="px-3 py-2 text-[10px] font-semibold text-[#A4B1BE] uppercase tracking-wider mb-1">Workspace</div>
            {[
              { emoji: '⚡', label: 'Dashboard' },
              { emoji: '👥', label: 'Leads', active: true },
              { emoji: '✅', label: 'Tasks' },
              { emoji: '📊', label: 'Pipeline' },
              { emoji: '📱', label: 'Portals' },
            ].map(item => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium cursor-default"
                style={
                  item.active
                    ? { background: '#FF7043', color: '#fff' }
                    : { color: '#78889B' }
                }
              >
                <span className="text-[13px]">{item.emoji}</span>
                {item.label}
              </div>
            ))}
            <div className="mt-auto px-3 py-2">
              <div className="w-full rounded-lg p-2.5 text-[11px]" style={{ background: '#FF7043/10', border: '1px solid rgba(255,112,67,0.2)' }}>
                <div className="font-semibold text-[#FF7043] mb-0.5">3 hot leads</div>
                <div className="text-[#78889B]">need follow-up today</div>
              </div>
            </div>
          </div>

          {/* Main panel */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Toolbar */}
            <div className="px-5 py-3.5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #F0F3F7' }}>
              <div>
                <div className="text-[13px] font-semibold text-[#263238]">All Leads</div>
                <div className="text-[11px] text-[#78889B]">24 leads · synced just now</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#78889B]" style={{ background: '#F5F6FA' }}>
                  Filter
                </div>
                <div
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
                  style={{ background: '#FF7043' }}
                >
                  + Add Lead
                </div>
              </div>
            </div>

            {/* Column headers */}
            <div className="px-5 py-2 grid grid-cols-12 gap-2 text-[10px] font-semibold text-[#A4B1BE] uppercase tracking-wider shrink-0" style={{ background: '#FAFBFC', borderBottom: '1px solid #F0F3F7' }}>
              <div className="col-span-4">Name</div>
              <div className="col-span-3">Budget</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Source</div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-hidden">
              {leads.map((lead, i) => (
                <div
                  key={i}
                  className="px-5 py-3 grid grid-cols-12 gap-2 items-center cursor-default hover:bg-[#FAFBFC] transition-colors"
                  style={{ borderBottom: '1px solid #F8FAFB' }}
                >
                  <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: `linear-gradient(135deg, #FF7043, #2E66F6)` }}
                    >
                      {lead.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-[#263238] truncate">{lead.name}</div>
                      <div className="text-[10px] text-[#A4B1BE]">{lead.time}</div>
                    </div>
                  </div>
                  <div className="col-span-3 text-[12px] font-semibold text-[#263238]">{lead.budget}</div>
                  <div className="col-span-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[lead.status]}`}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="col-span-3 text-[11px] text-[#78889B] truncate">{lead.source}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-12 overflow-hidden">
      {/* Background blobs */}
      <div
        className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-[0.07] pointer-events-none lp-blob"
        style={{ background: 'radial-gradient(ellipse, #FF7043 0%, transparent 70%)' }}
      />
      <div
        className="absolute top-[100px] right-[-180px] w-[480px] h-[480px] opacity-[0.05] pointer-events-none lp-blob"
        style={{ background: 'radial-gradient(ellipse, #2E66F6 0%, transparent 70%)', animationDelay: '3s' }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 flex flex-col items-center text-center gap-6">
        {/* Badge */}
        <div
          className="lp-fade-up flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold"
          style={{
            background: 'rgba(255,112,67,0.08)',
            border: '1px solid rgba(255,112,67,0.22)',
            color: '#FF7043',
            animationDelay: '0.1s',
            opacity: 0,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Built for India&apos;s real estate market
        </div>

        {/* Headline */}
        <h1
          className="lp-fade-up text-[56px] md:text-[72px] font-extrabold leading-[1.05] tracking-tight text-[#1A1F27]"
          style={{ animationDelay: '0.2s', opacity: 0 }}
        >
          The CRM your{' '}
          <span
            className="relative"
            style={{
              background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 60%, #2E66F6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            sales team
          </span>{' '}
          <br className="hidden md:block" />
          actually uses.
        </h1>

        {/* Sub */}
        <p
          className="lp-fade-up text-[17px] md:text-[19px] text-[#78889B] max-w-[580px] leading-relaxed"
          style={{ animationDelay: '0.35s', opacity: 0 }}
        >
          Auto-capture leads from 99acres, MagicBricks &amp; Housing.com.
          AI follow-ups. Real-time pipeline. Close more, stress less.
        </p>

        {/* CTAs */}
        <div
          className="lp-fade-up flex flex-col sm:flex-row items-center gap-3 mt-2"
          style={{ animationDelay: '0.5s', opacity: 0 }}
        >
          <Link
            href="/signup"
            className="flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-semibold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)', boxShadow: '0 8px 30px rgba(255,112,67,0.35)' }}
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

        {/* Trust signals */}
        <div
          className="lp-fade-up flex items-center gap-4 text-[12px] text-[#A4B1BE] mt-1"
          style={{ animationDelay: '0.65s', opacity: 0 }}
        >
          {['No credit card', 'Free 14-day trial', 'Setup in 5 minutes'].map((t, i) => (
            <div key={t} className="flex items-center gap-1.5">
              {i > 0 && <div className="w-1 h-1 rounded-full bg-[#CBD5E1]" />}
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t}</span>
            </div>
          ))}
        </div>

        {/* Mockup */}
        <div
          className="lp-fade-up w-full mt-4"
          style={{ animationDelay: '0.8s', opacity: 0 }}
        >
          <AppMockup />
        </div>
      </div>
    </section>
  )
}

/* ─── Portal strip ────────────────────────────────────────────────────────── */
function PortalStrip() {
  const portals = ['99acres', 'MagicBricks', 'Housing.com', 'NoBroker', 'CommonFloor', 'Square Yards']
  return (
    <section className="py-10 border-y border-[#E8ECF0]" style={{ background: 'rgba(255,255,255,0.6)' }}>
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-center text-[12px] font-semibold text-[#A4B1BE] uppercase tracking-widest mb-6">
          Auto-syncs leads from all major Indian portals
        </p>
        <div className="flex flex-wrap justify-center gap-4 md:gap-8">
          {portals.map(p => (
            <div
              key={p}
              className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-[#78889B]"
              style={{ background: '#F5F6FA', border: '1px solid #E8ECF0' }}
            >
              {p}
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
    desc: "Leads flow in from every portal the moment they’re posted. Zero manual copy-paste. Your inbox, automated.",
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
    desc: 'Smart reminders, intent scoring, and follow-up suggestions — so you never let a hot lead go cold.',
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
const STEPS = [
  {
    number: '01',
    icon: <PhoneCall className="w-5 h-5" />,
    title: 'Connect your portals',
    desc: 'Paste your portal credentials once. Vya Pulse starts pulling leads automatically — 24/7, no human needed.',
  },
  {
    number: '02',
    icon: <Users className="w-5 h-5" />,
    title: 'Leads auto-assign',
    desc: 'New leads route to the right agent based on your rules. Each agent gets their own private workspace — no overlap.',
  },
  {
    number: '03',
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Close more with AI',
    desc: 'The AI scores intent, triggers follow-up reminders, and flags deals that need your attention. You just close.',
  },
]

function HowItWorks() {
  const ref = useScrollReveal()
  return (
    <section id="how-it-works" ref={ref} className="py-28" style={{ background: '#FAFBFC' }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="lp-in lp-in-delay-1 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold mb-5"
            style={{ background: 'rgba(46,102,246,0.07)', border: '1px solid rgba(46,102,246,0.2)', color: '#2E66F6' }}>
            <Clock className="w-3.5 h-3.5" /> Up and running in minutes
          </div>
          <h2 className="lp-in lp-in-delay-2 text-[38px] md:text-[46px] font-extrabold text-[#1A1F27] leading-tight tracking-tight">
            Three steps from signup<br className="hidden md:block" /> to closing deals
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-[calc(16.66%+1.5rem)] right-[calc(16.66%+1.5rem)] h-px bg-gradient-to-r from-[#FF7043] to-[#2E66F6] opacity-30" />

          {STEPS.map((step, i) => (
            <div key={step.number} className={`lp-in lp-in-delay-${i + 1} relative flex flex-col items-start gap-4`}>
              <div className="relative">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                  style={{ background: i === 0 ? '#FF7043' : i === 1 ? '#2E66F6' : '#059669' }}
                >
                  {step.icon}
                </div>
                <div
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: '#1A1F27' }}
                >
                  {step.number.replace('0', '')}
                </div>
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#1A1F27] mb-2">{step.title}</h3>
                <p className="text-[14px] text-[#78889B] leading-relaxed">{step.desc}</p>
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
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
            style={{ background: 'linear-gradient(135deg, #FF7043, #2E66F6)' }}
          >
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
      <div
        className="lp-in lp-in-delay-1 max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1A1F27 0%, #263238 100%)' }}
      >
        {/* Background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #FF7043, transparent)' }}
        />

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
              className="flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-semibold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] shadow-xl"
              style={{ background: 'linear-gradient(135deg, #FF7043 0%, #E64A19 100%)', boxShadow: '0 8px 30px rgba(255,112,67,0.4)' }}
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
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
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF7043, #E64A19)' }}
            >
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#263238] text-[14px]">Vya Pulse</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-[13px] text-[#78889B]">
            {['Features', 'Pricing', 'Privacy', 'Terms', 'Contact'].map(l => (
              <a key={l} href="#" className="hover:text-[#263238] transition-colors">{l}</a>
            ))}
          </div>

          <div className="text-[12px] text-[#A4B1BE]">
            © 2026 Vya Pulse · Made with ❤️ in India
          </div>
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
      <PortalStrip />
      <Features />
      <Stats />
      <HowItWorks />
      <Testimonial />
      <CTASection />
      <Footer />
    </div>
  )
}
