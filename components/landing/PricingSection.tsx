'use client'

/* ─────────────────────────────────────────────────────────────────────────────
 * PricingSection · "Start free. Upgrade as you grow."
 *
 * LeadGap's three plans (Free, Pro, Team) as cards that list the same rows, so
 * visitors can compare them at a glance. A plan picker ("Trying it out",
 * "Full-time agent", "Running a team") highlights the plan that fits; on phones
 * it switches which card is shown, so the section stays one card long.
 *
 * Prices and limits match PLANS in lib/razorpay.ts. Edit PLAN_CARDS and GROUPS
 * below when the plans change.
 *
 * Stack: React 19 · TypeScript · Tailwind CSS v4 · motion (motion/react) · lucide-react
 * Usage:  <PricingSection />            (every prop is optional)
 * ──────────────────────────────────────────────────────────────────────────── */

import { Fragment, useId, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock3,
  Download,
  Minus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

export type PricingPlanId = 'free' | 'pro' | 'team'

export type PricingSectionProps = {
  /** Section anchor, so the nav's "Pricing" link scrolls here. */
  id?: string
  /** Sign-up page. Pro and Team add ?plan=pro / ?plan=team. */
  signupHref?: string
  /** "Talk to us" link for teams bigger than the Team plan. */
  contactHref?: string
  /** Shown after "/ month" on paid plans, for example "+ GST". */
  taxNote?: string
  /** The plan highlighted before the visitor picks one. */
  defaultPlan?: PricingPlanId
  className?: string
}

/* ─── Brand tokens ───────────────────────────────────────────────────────────── */
const FONT_SANS =
  "var(--font-jakarta, 'Plus Jakarta Sans'), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
const FONT_MONO =
  "var(--font-geist-mono, 'Geist Mono'), 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const MONO = { fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' } as const
const PRI = '#2B59E0'
const INK = '#0F1729'
const EASE = [0.22, 1, 0.36, 1] as const

/* ─── Plans ──────────────────────────────────────────────────────────────────── */
// Keep price and seats in step with PLANS in lib/razorpay.ts (stored there in paise).
type PlanCard = {
  id: PricingPlanId
  name: string
  who: string
  audience: string
  price: number
  period: 'forever' | 'month'
  seats: number
  cta: string
  note: string
  badge?: string
  tag?: string
}

const PLAN_CARDS: PlanCard[] = [
  {
    id: 'free',
    name: 'Free',
    who: 'Trying it out',
    audience: 'For agents trying LeadGap on their first leads.',
    price: 0,
    period: 'forever',
    seats: 1,
    cta: 'Start free',
    note: 'Upgrade whenever you like.',
  },
  {
    id: 'pro',
    name: 'Pro',
    who: 'Full-time agent',
    audience: 'For full-time agents who want every lead called, followed up and closed.',
    price: 2499,
    period: 'month',
    seats: 1,
    cta: 'Start with Pro',
    note: 'Billed monthly. Cancel anytime.',
    badge: 'Recommended',
  },
  {
    id: 'team',
    name: 'Team',
    who: 'Running a team',
    audience: 'For brokerages that share leads across a team of agents.',
    price: 5999,
    period: 'month',
    seats: 5,
    cta: 'Start with Team',
    note: 'Billed monthly. Cancel anytime.',
    tag: 'For brokerages',
  },
]

/* ─── What each plan includes ──────────────────────────────────────────────── */
type Cell = string | boolean | 'soon'
type Row = { label: string; cells: Record<PricingPlanId, Cell> }
type Group = { title: string; rows: Row[] }

const ALL = { free: true, pro: true, team: true }
const PAID = { free: false, pro: true, team: true }
const PAID_SOON = { free: false, pro: 'soon', team: 'soon' } as const
const TEAM_ONLY = { free: false, pro: false, team: true }

const GROUPS: Group[] = [
  {
    title: 'Leads and pipeline',
    rows: [
      { label: 'Leads', cells: { free: 'Up to 50', pro: 'Unlimited', team: 'Unlimited' } },
      { label: 'Team members', cells: { free: 'Just you', pro: 'Just you', team: 'Up to 5' } },
      { label: 'Pipeline and Today view', cells: ALL },
      { label: 'Intent score on every lead', cells: ALL },
      { label: 'Call logging', cells: ALL },
      { label: 'Property calculators', cells: ALL },
    ],
  },
  {
    title: 'Calling and outreach',
    rows: [
      { label: 'Click-to-call (Exotel)', cells: PAID },
      { label: 'Bulk WhatsApp broadcast', cells: PAID },
      { label: 'Outreach sequences', cells: PAID },
    ],
  },
  {
    title: 'AI and insights',
    rows: [
      { label: 'AI Advisor', cells: PAID },
      { label: 'AI follow-up writer', cells: PAID_SOON },
      { label: 'AI property matcher', cells: PAID_SOON },
      { label: 'Advanced analytics', cells: PAID },
    ],
  },
  {
    title: 'Team',
    rows: [
      { label: 'Team analytics', cells: TEAM_ONLY },
      { label: 'Assign leads to agents', cells: TEAM_ONLY },
      { label: 'Priority support', cells: TEAM_ONLY },
      { label: 'Custom integrations', cells: TEAM_ONLY },
    ],
  },
]

const TRUST = [
  { icon: ShieldCheck, title: 'Secure checkout', body: 'Payments run through Razorpay.' },
  { icon: CalendarCheck, title: 'Cancel anytime', body: 'Keep access until your paid month ends.' },
  { icon: Download, title: 'Your leads stay yours', body: 'Export them to CSV whenever you like.' },
]

const HEADLINE: [string, boolean][] = [
  ['Start', false],
  ['free.', false],
  ['Upgrade', true],
  ['as', true],
  ['you', true],
  ['grow.', true],
]

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

function anchorLine(p: PlanCard) {
  if (p.price === 0) return 'Up to 50 leads, just you'
  if (p.seats > 1) return `About ${rupees(Math.round(p.price / p.seats))} per agent`
  return `About ${rupees(Math.round(p.price / 30))} a day`
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.6, ease: EASE, delay },
})

/* ─── Section ────────────────────────────────────────────────────────────────── */
export default function PricingSection({
  id = 'pricing',
  signupHref = '/signup',
  contactHref = `mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@leadgap.in'}?subject=${encodeURIComponent('LeadGap for a bigger team')}`,
  taxNote,
  defaultPlan = 'pro',
  className = '',
}: PricingSectionProps) {
  const uid = useId()
  const [picked, setPicked] = useState<PricingPlanId>(defaultPlan)
  const pickerRef = useRef<HTMLDivElement>(null)
  const current = PLAN_CARDS.find(p => p.id === picked) ?? PLAN_CARDS[1]
  const hrefFor = (p: PlanCard) => (p.id === 'free' ? signupHref : `${signupHref}?plan=${p.id}`)

  const showOnPhone = (planId: PricingPlanId) => {
    setPicked(planId)
    const el = pickerRef.current
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: 'smooth' })
  }

  return (
    <MotionConfig reducedMotion="user">
      <section
        id={id}
        aria-labelledby={`${uid}-title`}
        className={`relative isolate overflow-hidden bg-[#F4F6FB] py-20 text-[#0F1729] antialiased sm:py-28 ${className}`}
        style={{ fontFamily: FONT_SANS, wordSpacing: '0.03em' }}
      >
        <Backdrop />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          {/* ── Header ── */}
          <div className="mx-auto max-w-2xl text-center">
            <motion.div
              {...rise(0)}
              className="flex items-center justify-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-[#2B59E0]"
              style={MONO}
            >
              <span className="h-[2px] w-7 rounded-full bg-[#2B59E0]" />
              Pricing
              <span className="h-[2px] w-7 rounded-full bg-[#2B59E0]" />
            </motion.div>

            <h2
              id={`${uid}-title`}
              className="mt-5 text-[34px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[44px] lg:text-[46px]"
            >
              {HEADLINE.map(([word, accent], i) => (
                <Fragment key={word}>
                  <motion.span
                    className="inline-block"
                    style={{ color: accent ? PRI : undefined }}
                    initial={{ opacity: 0, y: 36, filter: 'blur(10px)' }}
                    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.08 + i * 0.07 }}
                  >
                    {word}
                  </motion.span>
                  {i === 1 ? <br /> : i < HEADLINE.length - 1 && ' '}
                </Fragment>
              ))}
            </h2>

            <motion.p
              {...rise(0.35)}
              className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-[#5C6479] sm:text-[17px]"
            >
              Every plan has the pipeline, the Today view and call logging. Pick the one that fits
              how you sell.
            </motion.p>
          </div>

          {/* ── Plan picker ── */}
          <motion.div {...rise(0.45)} ref={pickerRef} className="mx-auto mt-9 w-full max-w-[540px] scroll-mt-24">
            <p className="mb-2.5 text-center text-[12px] font-medium uppercase tracking-[0.14em] text-[#8A93A8]" style={MONO}>
              Which fits you?
            </p>
            <PlanPicker uid={uid} value={picked} onChange={setPicked} />
          </motion.div>

          {/* ── Cards: all three on desktop ── */}
          <div className="mt-12 hidden grid-cols-3 items-stretch gap-5 lg:grid">
            {PLAN_CARDS.map((p, i) => (
              <motion.div key={p.id} {...rise(0.15 + i * 0.08)} className="flex">
                <PlanCardView
                  plan={p}
                  picked={picked === p.id}
                  onPick={() => setPicked(p.id)}
                  href={hrefFor(p)}
                  taxNote={taxNote}
                />
              </motion.div>
            ))}
          </div>

          {/* ── Cards: the picked one on phones and tablets ── */}
          <div className="mx-auto mt-10 max-w-[480px] lg:hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="flex"
              >
                <PlanCardView plan={current} picked onPick={() => {}} href={hrefFor(current)} taxNote={taxNote} />
              </motion.div>
            </AnimatePresence>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[14px] text-[#5C6479]">
              <span>Also see</span>
              {PLAN_CARDS.filter(p => p.id !== picked).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => showOnPhone(p.id)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[#DCE3F5] bg-white px-3.5 font-semibold text-[#0038A8] outline-none transition-colors hover:border-[#2B59E0] focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
                >
                  {p.name}
                  <span className="font-medium text-[#8A93A8]">{p.price === 0 ? '₹0' : rupees(p.price)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Reassurance ── */}
          <motion.div
            {...rise(0.1)}
            className="mx-auto mt-12 grid max-w-4xl grid-cols-1 overflow-hidden rounded-[18px] border border-[#E3E8F4] bg-white sm:grid-cols-3"
          >
            {TRUST.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className={`flex items-start gap-3 px-5 py-4 ${i > 0 ? 'border-t border-[#EEF1F6] sm:border-l sm:border-t-0' : ''}`}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[#2B59E0]">
                  <Icon className="size-[18px]" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-[#0F1729]">{title}</span>
                  <span className="block text-[13px] leading-snug text-[#5C6479]">{body}</span>
                </span>
              </div>
            ))}
          </motion.div>

          <motion.p {...rise(0.15)} className="mt-6 text-center text-[14px] text-[#5C6479]">
            Running more than 5 agents?{' '}
            <a
              href={contactHref}
              className="inline-flex items-center gap-1 font-semibold text-[#0038A8] underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              Talk to us
              <ArrowRight className="size-3.5" strokeWidth={2.5} />
            </a>
          </motion.p>
        </div>
      </section>
    </MotionConfig>
  )
}

/* ─── Plan picker ───────────────────────────────────────────────────────────── */
function PlanPicker({
  uid,
  value,
  onChange,
}: {
  uid: string
  value: PricingPlanId
  onChange: (id: PricingPlanId) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = PLAN_CARDS.findIndex(p => p.id === value)
    const next = (i + step + PLAN_CARDS.length) % PLAN_CARDS.length
    onChange(PLAN_CARDS[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Which plan fits you"
      onKeyDown={onKey}
      className="grid grid-cols-3 gap-1 rounded-[16px] border border-[#E3E8F4] bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,41,0.04),0_10px_30px_rgba(20,36,90,0.06)]"
    >
      {PLAN_CARDS.map((p, i) => {
        const on = p.id === value
        return (
          <button
            key={p.id}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(p.id)}
            className="relative cursor-pointer rounded-[12px] px-1.5 py-2.5 text-center outline-none focus-visible:ring-2 focus-visible:ring-[#2B59E0]/40"
          >
            {on && (
              <motion.span
                layoutId={`${uid}-picked`}
                className="absolute inset-0 rounded-[12px] bg-[#2B59E0] shadow-[0_6px_18px_rgba(43,89,224,0.35)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span
              className="relative block text-[15px] font-bold transition-colors duration-200"
              style={{ color: on ? '#FFFFFF' : INK }}
            >
              {p.name}
            </span>
            <span
              className="relative block truncate text-[12px] font-medium transition-colors duration-200"
              style={{ color: on ? 'rgba(255,255,255,0.82)' : '#7A8399' }}
            >
              {p.who}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ─── Plan card ─────────────────────────────────────────────────────────────── */
function PlanCardView({
  plan,
  picked,
  onPick,
  href,
  taxNote,
}: {
  plan: PlanCard
  picked: boolean
  onPick: () => void
  href: string
  taxNote?: string
}) {
  const period = plan.period === 'forever' ? 'forever' : 'month'
  return (
    <article
      onClick={onPick}
      aria-label={`${plan.name} plan`}
      className="relative flex w-full flex-col rounded-[22px] border p-6 transition-[background-color,border-color,box-shadow,transform] duration-500 sm:p-7 lg:cursor-pointer"
      style={{
        background: picked ? 'linear-gradient(180deg, #F2F6FF 0%, #FFFFFF 46%)' : '#FFFFFF',
        borderColor: picked ? PRI : '#E3E8F4',
        boxShadow: picked
          ? `0 0 0 1px ${PRI}, 0 24px 60px rgba(43,89,224,0.16)`
          : '0 1px 2px rgba(15,23,41,0.04), 0 12px 32px rgba(20,36,90,0.05)',
        transform: picked ? 'translateY(-6px)' : 'translateY(0)',
      }}
    >
      {plan.badge && (
        <span className="absolute -top-3.5 left-6 inline-flex items-center gap-1.5 rounded-full bg-[#2B59E0] px-3 py-1 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_rgba(43,89,224,0.35)] sm:left-7">
          <Sparkles className="size-3.5" strokeWidth={2.25} />
          {plan.badge}
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[26px] font-extrabold tracking-[-0.025em] text-[#0F1729]">{plan.name}</h3>
        {plan.tag && (
          <span className="mt-1 shrink-0 rounded-full border border-[#DCE3F5] bg-[#F5F7FC] px-2.5 py-1 text-[12px] font-semibold text-[#3B4A6B]">
            {plan.tag}
          </span>
        )}
      </div>
      <p className="mt-1.5 min-h-[44px] text-[14px] leading-snug text-[#5C6479]">{plan.audience}</p>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[46px] font-extrabold leading-none tracking-[-0.04em] text-[#0F1729] tabular-nums">
          {plan.price === 0 ? '₹0' : rupees(plan.price)}
        </span>
        <span className="text-[15px] font-medium text-[#7A8399]">
          / {period}
          {taxNote && plan.price > 0 ? ` ${taxNote}` : ''}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] font-medium text-[#2B59E0]" style={MONO}>
        {anchorLine(plan)}
      </p>

      <Link
        href={href}
        onClick={e => e.stopPropagation()}
        className="group mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-bold outline-none transition-[background-color,color,box-shadow,transform] duration-300 focus-visible:ring-2 focus-visible:ring-[#2B59E0]/50 focus-visible:ring-offset-2 active:scale-[0.98]"
        style={
          picked
            ? { background: PRI, color: '#FFFFFF', boxShadow: '0 10px 24px rgba(43,89,224,0.32)' }
            : { background: '#FFFFFF', color: '#0038A8', boxShadow: 'inset 0 0 0 1.5px #C9D5F5' }
        }
      >
        {plan.cta}
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2.5} />
      </Link>
      <p className="mt-2.5 text-center text-[12.5px] text-[#7A8399]">{plan.note}</p>

      <div className="mt-6 h-px bg-[#E6EAF2]" />

      <div className="mt-1">
        {GROUPS.map(g => (
          <div key={g.title} className="mt-4">
            <h4 className="pb-1.5 text-[15px] font-bold tracking-[-0.01em] text-[#0F1729]">{g.title}</h4>
            <ul className="border-t border-[#EEF1F6]">
              {g.rows.map(r => (
                <RowLine key={r.label} label={r.label} cell={r.cells[plan.id]} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  )
}

function RowLine({ label, cell }: { label: string; cell: Cell }) {
  const off = cell === false
  const soon = cell === 'soon'
  return (
    <li className="flex items-center gap-3 border-b border-[#EEF1F6] py-[9px] text-[14px] last:border-b-0">
      {off ? (
        <Minus className="size-4 shrink-0 text-[#C5CBD8]" strokeWidth={2.25} aria-hidden />
      ) : soon ? (
        <Clock3 className="size-4 shrink-0 text-[#D08A1E]" strokeWidth={2.25} aria-hidden />
      ) : (
        <Check className="size-4 shrink-0 text-[#059669]" strokeWidth={2.75} aria-hidden />
      )}
      <span className={`min-w-0 flex-1 leading-snug ${off ? 'text-[#A6ADBD]' : 'text-[#3B4560]'}`}>
        {label}
        {off && <span className="sr-only"> (not included)</span>}
      </span>
      {soon ? (
        <span className="shrink-0 rounded-full bg-[#FFF3DD] px-2 py-0.5 text-[11.5px] font-semibold text-[#9A5B0B]">
          Coming soon
        </span>
      ) : typeof cell === 'string' ? (
        <span className="shrink-0 text-right font-bold text-[#0F1729]">{cell}</span>
      ) : cell ? (
        <span className="shrink-0 font-semibold text-[#0F1729]">Included</span>
      ) : null}
    </li>
  )
}

function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse 60% 45% at 50% 18%, #FFFFFF, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,23,41,0.07) 1px, transparent 1.2px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 80%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-[90px]"
        style={{ background: 'radial-gradient(closest-side, rgba(43,89,224,0.16), transparent)' }}
      />
    </>
  )
}
