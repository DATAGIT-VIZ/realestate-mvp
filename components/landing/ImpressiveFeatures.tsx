'use client'

import { useEffect, useRef, useState, Fragment } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import {
  RobotIcon as Robot,
  WhatsappLogo,
  Brain,
  ChartBar,
  ArrowRight,
  CheckCircle,
  CaretUp,
  Sparkle,
} from '@phosphor-icons/react'

/* ── Design tokens ───────────────────────────────────────────────────────── */
const FONT   = "var(--font-jakarta, 'Plus Jakarta Sans'), system-ui, sans-serif"
const PRI    = '#2B59E0'
const GREEN  = '#22C55E'
const AMBER  = '#F59E0B'
const TEXT   = '#F2F0EC'
const MUTED  = 'rgba(242,240,236,0.40)'
const DIM    = 'rgba(242,240,236,0.18)'
const EASE   = [0.22, 1, 0.36, 1] as const
const CIRC   = 2 * Math.PI * 46

function rise(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.65, ease: EASE, delay },
  } as const
}

/* ── Illustration 1: AI Intent Scorer ───────────────────────────────────── */
const FACTORS = [
  { label: 'Portal browsing',   score: 92, color: PRI   },
  { label: 'Call response',     score: 78, color: PRI   },
  { label: 'Budget confirmed',  score: 95, color: GREEN },
  { label: 'Timeline urgency',  score: 84, color: AMBER },
  { label: 'Property match',    score: 88, color: PRI   },
]

function IntentScorerIllustration() {
  const ref  = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const calm = useReducedMotion()
  const overall = 88

  return (
    <div ref={ref} style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
      {/* Ring */}
      <div style={{ flexShrink: 0, position: 'relative', width: 110, height: 110 }}>
        <svg viewBox="0 0 110 110" width={110} height={110} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={55} cy={55} r={46} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
          <motion.circle
            cx={55} cy={55} r={46} fill="none" stroke={PRI} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={`${(overall / 100) * CIRC} ${CIRC}`}
            initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}}
            transition={calm ? { duration: 0 } : { duration: 1.4, ease: EASE, delay: 0.2 }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <motion.span
            style={{ fontSize: 30, fontWeight: 800, color: TEXT, lineHeight: 1, fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}
            initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.7, duration: 0.4 }}
          >{overall}</motion.span>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: FONT }}>/100</span>
        </div>
      </div>

      {/* Factor bars */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FACTORS.map(({ label, score, color }, i) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: MUTED, fontFamily: FONT }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT, fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', borderRadius: 999, background: color }}
                initial={{ scaleX: 0, originX: 0 }}
                animate={inView ? { scaleX: score / 100 } : {}}
                transition={calm ? { duration: 0 } : { duration: 0.9, ease: EASE, delay: 0.3 + i * 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Illustration 2: AI Advisor ──────────────────────────────────────────── */
const CHAT = [
  { role: 'user', text: 'Who should I focus on today?' },
  { role: 'ai',   text: 'Call Priya Desai first — score 88, loan pre-approved, viewed 14 listings this week. Best window is the next 2 hours before she contacts another broker.' },
  { role: 'ai',   text: 'After that, Rohan Mehta. He missed your last call but replied on WhatsApp — follow up now while intent is high.' },
]

function AdvisorIllustration() {
  const ref    = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const calm   = useReducedMotion()
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (calm) { setShown(CHAT.length); return }
    let i = 0
    const t = setInterval(() => { i++; setShown(i); if (i >= CHAT.length) clearInterval(t) }, 900)
    return () => clearInterval(t)
  }, [inView, calm])

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* AI label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, background: `${PRI}22`, border: `1px solid ${PRI}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkle size={10} weight="light" color={PRI} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: PRI, letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: FONT }}>AI Advisor</span>
      </div>

      {CHAT.slice(0, shown).map((msg, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            padding: '9px 13px',
            borderRadius: 4,
            background: msg.role === 'user' ? 'rgba(255,255,255,0.07)' : `rgba(43,89,224,0.14)`,
            border: `1px solid ${msg.role === 'user' ? 'rgba(255,255,255,0.07)' : 'rgba(43,89,224,0.22)'}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: msg.role === 'user' ? MUTED : 'rgba(242,240,236,0.82)', lineHeight: 1.55, fontFamily: FONT }}>{msg.text}</p>
        </motion.div>
      ))}

      {/* Typing indicator */}
      {shown > 0 && shown < CHAT.length && (
        <div style={{ display: 'flex', gap: 3, padding: '8px 12px', alignSelf: 'flex-start' }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: `${PRI}60` }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.22 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Illustration 3: Bulk WhatsApp ───────────────────────────────────────── */
const WA_STATS = [
  { label: 'Sent',      n: 63,  pct: 100, color: 'rgba(255,255,255,0.25)' },
  { label: 'Delivered', n: 61,  pct: 97,  color: '#60A5FA'                },
  { label: 'Read',      n: 47,  pct: 75,  color: PRI                      },
  { label: 'Replied',   n: 23,  pct: 37,  color: GREEN                    },
  { label: 'Booked',    n: 8,   pct: 13,  color: '#22C55E'                },
]

function WhatsAppIllustration() {
  const ref    = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const calm   = useReducedMotion()

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Campaign chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 4, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: GREEN, fontFamily: FONT }}>Site Visit Follow-up</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, animation: 'bento-timer-pulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 10, color: GREEN, fontFamily: FONT }}>Sending</span>
        </div>
      </div>

      {/* Stat bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {WA_STATS.map(({ label, n, pct, color }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: FONT, width: 64, flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: color, borderRadius: 999 }}
                initial={{ scaleX: 0, originX: 0 }}
                animate={inView ? { scaleX: pct / 100 } : {}}
                transition={calm ? { duration: 0 } : { duration: 0.9, ease: EASE, delay: 0.2 + i * 0.09 }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? MUTED : TEXT, fontFamily: FONT, fontVariantNumeric: 'tabular-nums', width: 22, textAlign: 'right' as const }}>{n}</span>
          </div>
        ))}
      </div>

      {/* Message preview */}
      <div style={{ padding: '10px 12px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.5, fontFamily: FONT }}>
          "Hi <span style={{ color: TEXT }}>{'{{name}}'}</span>, the 3BHK you enquired about in Baner is still available. Shall we schedule a site visit this weekend?"
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          <CheckCircle size={10} weight="fill" color={PRI} />
          <span style={{ fontSize: 10, color: MUTED, fontFamily: FONT }}>Personalised · Scheduled · 10:00 AM</span>
        </div>
      </div>
    </div>
  )
}

/* ── Illustration 4: Team Analytics (Admin) ──────────────────────────────── */
const AGENTS = [
  { initials: 'RS', name: 'Rahul S.',  leads: 24, calls: 18, deals: 3, value: '₹4.2Cr', trend: +22, color: PRI   },
  { initials: 'PM', name: 'Priya M.',  leads: 18, calls: 22, deals: 2, value: '₹2.8Cr', trend: +11, color: '#7C3AED' },
  { initials: 'NK', name: 'Nikhil K.', leads: 15, calls: 11, deals: 1, value: '₹1.1Cr', trend: -4,  color: AMBER  },
]

const WEEKLY = [14, 22, 18, 31, 26, 38, 42]
const DAYS   = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MAX_W  = Math.max(...WEEKLY)

function TeamAnalyticsIllustration() {
  const ref    = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const calm   = useReducedMotion()

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mini bar chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: DIM, fontFamily: FONT }}>Leads this week</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, fontFamily: FONT }}>↑ 22% vs last week</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 48 }}>
          {WEEKLY.map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
              <motion.div
                style={{ width: '100%', background: i === 6 ? PRI : 'rgba(43,89,224,0.35)', borderRadius: '2px 2px 0 0' }}
                initial={{ scaleY: 0, originY: 1 }}
                animate={inView ? { scaleY: 1, height: `${(v / MAX_W) * 100}%` } : { scaleY: 0, height: 0 }}
                transition={calm ? { duration: 0 } : { duration: 0.6, ease: EASE, delay: 0.1 + i * 0.06 }}
              />
              <span style={{ fontSize: 8, color: DIM, fontFamily: FONT }}>{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px 40px 56px', gap: 4, padding: '4px 8px' }}>
          {['Agent', 'Leads', 'Calls', 'Deals', 'Value'].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, color: DIM, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: FONT, textAlign: h === 'Agent' ? 'left' : 'right' as const }}>{h}</span>
          ))}
        </div>
        {AGENTS.map(({ initials, name, leads, calls, deals, value, trend, color }, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, x: -8 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={calm ? { duration: 0 } : { duration: 0.4, ease: EASE, delay: 0.3 + i * 0.1 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px 40px 56px', gap: 4, padding: '8px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color, flexShrink: 0, fontFamily: FONT }}>{initials}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, fontFamily: FONT }}>{name}</span>
            </div>
            {[leads, calls, deals].map((v, j) => (
              <span key={j} style={{ fontSize: 12, fontWeight: 700, color: MUTED, textAlign: 'right' as const, fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT, fontFamily: FONT }}>{value}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: trend > 0 ? GREEN : '#EF4444', fontFamily: FONT }}>{trend > 0 ? '↑' : '↓'}{Math.abs(trend)}%</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ── Feature card shell ──────────────────────────────────────────────────── */
interface CardProps {
  icon: React.ReactNode
  eyebrow: string
  headline: string
  sub: string
  accent: string
  children: React.ReactNode
  delay?: number
}

function FeatureCard({ icon, eyebrow, headline, sub, accent, children, delay = 0 }: CardProps) {
  return (
    <motion.div
      {...rise(delay)}
      style={{
        background: 'linear-gradient(160deg, #191919 0%, #111111 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        borderRadius: 4,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 4, background: `${accent}18`, border: `1px solid ${accent}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: accent, fontFamily: FONT }}>{eyebrow}</span>
        </div>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT, lineHeight: 1.18, letterSpacing: '-0.02em', fontFamily: FONT }}>{headline}</h3>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.6, fontFamily: FONT }}>{sub}</p>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.055)', flexShrink: 0 }} />

      {/* Live illustration */}
      <div style={{ flex: 1 }}>{children}</div>
    </motion.div>
  )
}

/* ── Root ────────────────────────────────────────────────────────────────── */
export default function ImpressiveFeatures() {
  const calm = useReducedMotion()

  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '96px 0 112px' }}>
      {/* Radial glow background */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 120% 55% at 50% 0%, #1C1C1C 0%, #0B0B0B 55%, #080808 100%)', zIndex: 0 }} />
      {/* Subtle centre bloom */}
      <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: `radial-gradient(ellipse at 50% 50%, ${PRI}10 0%, transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>

        {/* ── Section header ── */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <motion.div {...rise(0)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', marginBottom: 24 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(242,240,236,0.55)', letterSpacing: '0.04em', fontFamily: FONT }}>Features</span>
          </motion.div>

          <motion.h2
            {...rise(0.06)}
            style={{ margin: '0 0 16px', fontSize: 'clamp(34px, 4vw, 52px)', fontWeight: 800, lineHeight: 1.06, letterSpacing: '-0.03em', fontFamily: FONT }}
          >
            <span style={{ color: TEXT }}>The tools that</span>
            <br />
            <span style={{ color: 'rgba(242,240,236,0.35)' }}>actually close deals.</span>
          </motion.h2>

          <motion.p {...rise(0.12)} style={{ margin: '0 auto', fontSize: 16, color: MUTED, maxWidth: 480, lineHeight: 1.65, fontFamily: FONT }}>
            Four capabilities that separate agents who close from agents who chase.
          </motion.p>
        </div>

        {/* ── 2 × 2 grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>

          <FeatureCard
            icon={<Brain size={15} weight="light" color={PRI} />}
            eyebrow="AI intent score"
            headline="Know exactly who's ready to buy."
            sub="Every lead is scored 0–100 across five behavioural signals the moment it arrives. No guesswork."
            accent={PRI}
            delay={0.08}
          >
            <IntentScorerIllustration />
          </FeatureCard>

          <FeatureCard
            icon={<Sparkle size={15} weight="light" color="#A78BFA" />}
            eyebrow="AI advisor"
            headline="Your deal coach, always on."
            sub="Ask who to call, why a lead is cold, or what to say next. The AI reads your full pipeline before answering."
            accent="#A78BFA"
            delay={0.14}
          >
            <AdvisorIllustration />
          </FeatureCard>

          <FeatureCard
            icon={<WhatsappLogo size={15} weight="light" color={GREEN} />}
            eyebrow="Bulk WhatsApp"
            headline="Reach every lead. One click."
            sub="Send personalised follow-ups to your entire list and track opens, replies, and bookings in real time."
            accent={GREEN}
            delay={0.2}
          >
            <WhatsAppIllustration />
          </FeatureCard>

          <FeatureCard
            icon={<ChartBar size={15} weight="light" color={AMBER} />}
            eyebrow="Team analytics"
            headline="See every agent. Every deal."
            sub="Admins get a live view of team performance — leads, calls, pipeline value, and trend week over week."
            accent={AMBER}
            delay={0.26}
          >
            <TeamAnalyticsIllustration />
          </FeatureCard>
        </div>

        {/* Bottom CTA */}
        <motion.div {...rise(0.36)} style={{ display: 'flex', justifyContent: 'center', marginTop: 52 }}>
          <a
            href="/signup"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'rgba(242,240,236,0.45)', fontFamily: FONT, textDecoration: 'none', borderBottom: '1px solid rgba(242,240,236,0.12)', paddingBottom: 2, transition: 'color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = TEXT }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(242,240,236,0.45)' }}
          >
            Explore all features <ArrowRight size={14} weight="light" />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
