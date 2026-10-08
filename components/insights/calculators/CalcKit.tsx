'use client'

// Shared pieces for the four calculators: loan maths, the money and rate inputs, and the result cards.
// Same tokens as the rest of Insights (OutreachKit).

import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, XS, inputCls, inputStyle, inr,
} from '@/components/outreach/OutreachKit'

// ─── Maths ────────────────────────────────────────────────────────────────────
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Monthly EMI on a reducing balance */
export function emiOf(principal: number, annualRate: number, years: number) {
  const n = Math.round(years * 12)
  if (principal <= 0 || n <= 0) return 0
  const r = annualRate / 1200
  if (r <= 0) return principal / n
  const f = Math.pow(1 + r, n)
  return (principal * r * f) / (f - 1)
}

/** Loan left after `months` EMIs */
export function balanceAfter(principal: number, annualRate: number, emi: number, months: number) {
  const r = annualRate / 1200
  let bal = principal
  for (let m = 0; m < months && bal > 0.5; m++) bal = Math.max(0, bal + bal * r - emi)
  return bal
}

export type YearRow = { year: number; principal: number; interest: number; paid: number; balance: number; months: number }
export type Schedule = { emi: number; months: number; interest: number; paid: number; years: YearRow[] }

/**
 * Month-by-month schedule. The EMI stays the same; extra payments go straight to the principal and close the loan early.
 * `lumpMonth` is 1-based (12 = the end of year 1).
 */
export function amortise(principal: number, annualRate: number, years: number, extraMonthly = 0, lump = 0, lumpMonth = 0): Schedule {
  const emi = emiOf(principal, annualRate, years)
  const r = annualRate / 1200
  const out: YearRow[] = []
  let bal = principal, month = 0, interest = 0, paid = 0
  let row: YearRow = { year: 1, principal: 0, interest: 0, paid: 0, balance: bal, months: 0 }
  const cap = Math.round(years * 12) + 1
  while (bal > 0.5 && month < cap) {
    month++
    const int = bal * r
    let pay = Math.min(bal + int, emi + extraMonthly)
    if (lump > 0 && month === lumpMonth) pay = Math.min(bal + int, pay + lump)
    const prin = pay - int
    bal = Math.max(0, bal - prin)
    interest += int; paid += pay
    row.principal += prin; row.interest += int; row.paid += pay; row.balance = bal; row.months++
    if (month % 12 === 0 || bal <= 0.5) {
      out.push(row)
      row = { year: row.year + 1, principal: 0, interest: 0, paid: 0, balance: bal, months: 0 }
    }
  }
  return { emi, months: month, interest, paid, years: out }
}

/** Annual internal rate of return for evenly spaced cash flows (`perYear` flows a year). Null when it has no answer. */
export function irr(flows: number[], perYear = 1): number | null {
  const npv = (r: number) => flows.reduce((s, f, i) => s + f / Math.pow(1 + r, i), 0)
  let lo = -0.9, hi = 1
  let flo = npv(lo), fhi = npv(hi)
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid)
    if (Math.abs(fm) < 1e-6) { lo = hi = mid; break }
    if (flo * fm < 0) { hi = mid; fhi = fm } else { lo = mid; flo = fm }
  }
  const r = (lo + hi) / 2
  return (Math.pow(1 + r, perYear) - 1) * 100
}

// ─── Formatting ───────────────────────────────────────────────────────────────
/** Full rupees with Indian commas: ₹55,541 */
export const rupees = (n: number) => `${n < 0 ? '−' : ''}₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`
/** Short rupees, signed: ₹69.3 L, −₹1.2 L */
export const money = (n: number) => (n < 0 ? `−${inr(-n)}` : inr(n))
export const pctText = (n: number, d = 1) => `${Number.isFinite(n) ? +n.toFixed(d) : 0}%`
/** 15 yrs 4 mo */
export function monthsText(m: number) {
  const y = Math.floor(m / 12), r = Math.round(m % 12)
  if (!y) return `${r} mo`
  return r ? `${y} yr${y === 1 ? '' : 's'} ${r} mo` : `${y} year${y === 1 ? '' : 's'}`
}

// ─── Inputs ───────────────────────────────────────────────────────────────────
const SLIDER = 1000
const fill = (f: number) => ({ '--p': `${clamp(f, 0, 1) * 100}%` }) as CSSProperties
const niceRound = (x: number) => {
  const step = x >= 1e7 ? 5e5 : x >= 1e6 ? 5e4 : x >= 1e5 ? 5e3 : 500
  return Math.round(x / step) * step
}

/** Rupee amount: types as plain digits, shows Indian commas and lakh/crore beside it. `range` adds a slider. */
export function MoneyField({ id, label, value, onChange, range, hint, optional, compact }: {
  id: string; label: string; value: number; onChange: (v: number) => void; range?: [number, number]; hint?: ReactNode
  optional?: boolean; compact?: boolean
}) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value ? Math.round(value).toLocaleString('en-IN') : '')
  const [lo, hi] = range ?? [1, 1]
  const pos = range ? Math.round((SLIDER * Math.log(clamp(value || lo, lo, hi) / lo)) / Math.log(hi / lo)) : 0
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold" style={{ color: TEXT_2 }}>
        <span className="min-w-0 truncate">{label}</span>
        {optional && <span className="shrink-0 text-[12px] font-medium" style={{ color: LABEL }}>Optional</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: SUBTLE }}>₹</span>
        <input id={id} inputMode="numeric" autoComplete="off" value={shown} placeholder={optional ? 'Not set' : '0'}
          onFocus={() => setText(value ? String(Math.round(value)) : '')}
          onBlur={() => setText(null)}
          onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 11); setText(d); onChange(Number(d) || 0) }}
          className={`${inputCls} ${compact ? 'h-10' : 'h-11'} pl-7 pr-[76px] text-[15px] font-semibold tabular-nums`} style={inputStyle} />
        {value >= 100_000 && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-[6px] px-1.5 py-0.5 text-[12px] font-semibold tabular-nums"
            style={{ background: '#EFF4FF', color: BLUE }}>{inr(value)}</span>
        )}
      </div>
      {range && (
        <input type="range" min={0} max={SLIDER} step={1} value={pos} aria-label={`${label} slider`}
          onChange={e => onChange(niceRound(lo * Math.pow(hi / lo, Number(e.target.value) / SLIDER)))}
          className="lg-range mt-2.5 w-full" style={fill(pos / SLIDER)} />
      )}
      {hint && <p className="m-0 mt-1.5 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>{hint}</p>}
    </div>
  )
}

/** A number on a slider with a box to type it */
export function RateField({ id, label, value, onChange, min, max, step, unit, hint }: {
  id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string; hint?: ReactNode
}) {
  const [text, setText] = useState<string | null>(null)
  const dec = String(step).split('.')[1]?.length ?? 0
  const commit = (raw: string) => {
    const v = parseFloat(raw)
    if (Number.isFinite(v)) onChange(+clamp(v, min, max).toFixed(dec))
  }
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="min-w-0 text-[13px] font-semibold" style={{ color: TEXT_2 }}>{label}</label>
        <div className="flex h-9 shrink-0 items-center rounded-[9px] border bg-white pr-2.5 focus-within:border-[#84ADFF] focus-within:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]"
          style={{ borderColor: BORDER_2, boxShadow: XS }}>
          <input id={id} inputMode="decimal" autoComplete="off" value={text ?? String(value)}
            onFocus={() => setText(String(value))}
            onBlur={e => { commit(e.target.value); setText(null) }}
            onChange={e => {
              const t = e.target.value.replace(/[^\d.]/g, '')
              setText(t)
              const v = parseFloat(t)
              if (Number.isFinite(v) && v >= min && v <= max) onChange(v)
            }}
            className="w-[58px] bg-transparent px-2 text-right text-[14.5px] font-semibold tabular-nums outline-none" style={{ color: TEXT }} />
          <span className="text-[13px]" style={{ color: SUBTLE }}>{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={clamp(value, min, max)} aria-label={`${label} slider`}
        onChange={e => onChange(Number(e.target.value))} className="lg-range mt-2.5 w-full" style={fill((clamp(value, min, max) - min) / (max - min || 1))} />
      {hint && <p className="m-0 mt-1 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>{hint}</p>}
    </div>
  )
}

/** Card that holds a group of inputs */
export function InputCard({ title, icon, right, children }: { title: ReactNode; icon?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-[16px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS }}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <h3 className="m-0 flex min-w-0 items-center gap-2 text-[14.5px] font-semibold" style={{ color: TEXT }}>
          {icon && <span className="grid size-7 shrink-0 place-items-center rounded-[8px]" style={{ background: '#EFF4FF', color: BLUE }}>{icon}</span>}
          <span className="truncate">{title}</span>
        </h3>
        {right}
      </header>
      {children && <div className="flex flex-col gap-5 px-4 pb-5 pt-4 sm:px-5">{children}</div>}
      {!children && <div className="h-4" />}
    </section>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────
/** What each calculator hands the page for sharing, the WhatsApp summary and the printed sheet */
export type CalcSummary = {
  title: string
  /** How the message names it: "home loan EMI" */
  noun: string
  headline: string
  lines: string[]
  inputs: [string, string][]
  share: { type: 'emi' | 'rental_yield' | 'projection'; inputData: Record<string, unknown> } | null
}

/**
 * Inputs on the left, answer on the right. On phones the answer comes first, then the inputs (with a small
 * answer bar that stays in view while you scroll them), then the details.
 */
export function CalcLayout({ hero, inputs, details }: { hero: ReactNode; inputs: ReactNode; details: ReactNode }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-5 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">{hero}</div>
      <div className="no-print flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">{inputs}</div>
      <div id="calc-details" className="flex min-w-0 scroll-mt-4 flex-col gap-4 lg:col-start-2 lg:row-start-2">{details}</div>
    </div>
  )
}

/** Phones only: the answer, pinned above the tab bar while the inputs scroll */
export function MobileResult({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <a href="#calc-details" className="sticky bottom-[76px] z-20 flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-white no-underline shadow-[0_12px_24px_-8px_rgba(14,26,90,0.5)] lg:hidden"
      style={{ background: HERO_BG }}>
      <span className="min-w-0">
        <span className="block text-[11.5px] font-bold uppercase tracking-[0.12em]" style={{ color: '#C7D7FE' }}>{label}</span>
        <span className="block truncate text-[20px] font-bold tabular-nums leading-tight">{value}</span>
        {sub && <span className="block truncate text-[12px]" style={{ color: 'rgba(255,255,255,0.75)' }}>{sub}</span>}
      </span>
      <span className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold" style={{ background: 'rgba(255,255,255,0.14)' }}>Breakdown ↓</span>
    </a>
  )
}

// ─── Results ──────────────────────────────────────────────────────────────────
export const HERO_BG = 'linear-gradient(135deg, #0E1A5A 0%, #1A2E9E 55%, #1D4ED8 100%)'

/** The headline answer on the cobalt card */
export function ResultHero({ eyebrow, value, unit, sub, badge, children, footer }: {
  eyebrow: ReactNode; value: ReactNode; unit?: ReactNode; sub?: ReactNode; badge?: ReactNode; children?: ReactNode; footer?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-[20px] text-white" style={{ background: HERO_BG, boxShadow: '0 16px 32px -16px rgba(14,26,90,0.55)' }}>
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(132,173,255,0.35), transparent 65%)' }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)' }} />
      <div className="relative px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: '#C7D7FE' }}>{eyebrow}</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[40px] font-bold leading-none tracking-[-0.035em] tabular-nums sm:text-[48px]">{value}</span>
              {unit && <span className="text-[15px] font-medium" style={{ color: 'rgba(255,255,255,0.78)' }}>{unit}</span>}
            </div>
            {sub && <div className="mt-2.5 text-[14px] leading-snug" style={{ color: 'rgba(255,255,255,0.82)' }}>{sub}</div>}
          </div>
          {badge}
        </div>
        {children && <div className="mt-5 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">{children}</div>}
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </section>
  )
}

/** A figure on the cobalt card */
export function HeroTile({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 rounded-[12px] border px-3.5 py-2.5 min-[420px]:block"
      style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.14)' }}>
      <div className="truncate text-[12.5px] font-medium" style={{ color: 'rgba(255,255,255,0.72)' }}>{label}</div>
      <div className="min-w-0 text-right min-[420px]:text-left">
        <div className="truncate text-[18px] font-semibold tabular-nums min-[420px]:mt-0.5">{value}</div>
        {sub && <div className="truncate text-[12px]" style={{ color: 'rgba(255,255,255,0.66)' }}>{sub}</div>}
      </div>
    </div>
  )
}

/** Two-part bar on the cobalt card (principal vs interest and the like) */
export function HeroSplit({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0)
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.14)' }}>
        {parts.map(p => p.value > 0 && <span key={p.label} style={{ width: `${total ? (p.value / total) * 100 : 0}%`, background: p.color }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map(p => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <span className="size-2 rounded-full" style={{ background: p.color }} />{p.label}
            <b className="font-semibold tabular-nums text-white">{total ? Math.round((p.value / total) * 100) : 0}%</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/** One line of a cost breakdown */
export function Line({ label, sub, value, tone, strong, bar }: {
  label: ReactNode; sub?: ReactNode; value: ReactNode; tone?: string; strong?: boolean; bar?: { value: number; max: number; color: string }
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${strong ? '' : 'border-b'}`} style={{ borderColor: '#F2F4F7' }}>
      <div className="min-w-0 flex-1">
        <div className={`text-[14px] ${strong ? 'font-semibold' : ''}`} style={{ color: strong ? TEXT : TEXT_2 }}>{label}</div>
        {sub && <div className="text-[12.5px]" style={{ color: SUBTLE }}>{sub}</div>}
        {bar && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: '#F2F4F7' }}>
            <div className="h-full rounded-full" style={{ width: `${bar.max ? clamp((Math.abs(bar.value) / bar.max) * 100, 0, 100) : 0}%`, background: bar.color }} />
          </div>
        )}
      </div>
      <div className={`shrink-0 text-right tabular-nums ${strong ? 'text-[16px] font-bold' : 'text-[14px] font-semibold'}`} style={{ color: tone ?? TEXT }}>{value}</div>
    </div>
  )
}

/** Total row in a grey box */
export function TotalRow({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border px-4 py-3" style={{ background: SURFACE, borderColor: BORDER }}>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold" style={{ color: TEXT }}>{label}</div>
        {sub && <div className="text-[12.5px]" style={{ color: SUBTLE }}>{sub}</div>}
      </div>
      <div className="shrink-0 text-[18px] font-bold tabular-nums" style={{ color: tone ?? TEXT }}>{value}</div>
    </div>
  )
}

/** Small "this is an assumption" note */
export function Assumption({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 flex items-start gap-1.5 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>
      <span className="mt-[3px] shrink-0 rounded-[4px] px-1 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ background: '#FEF0C7', color: '#93370D' }}>Assumption</span>
      <span>{children}</span>
    </p>
  )
}

/** Bars that can go below zero (yearly cash flow) */
export function SignedBars({ points, format, height = 180 }: { points: { tick: string; label: string; value: number }[]; format: (n: number) => string; height?: number }) {
  const [picked, setPicked] = useState<number | null>(null)
  const active = Math.min(picked ?? points.length - 1, points.length - 1)
  const top = Math.max(0, ...points.map(p => p.value))
  const bottom = Math.max(0, ...points.map(p => -p.value))
  const span = top + bottom || 1
  const zero = (top / span) * 100
  const every = points.length > 20 ? 5 : points.length > 10 ? 2 : 1
  const a = points[active]
  if (!points.length) return null
  return (
    <div>
      <div className="relative" style={{ height }}>
        <span aria-hidden className="absolute inset-x-0 border-t" style={{ top: `${zero}%`, borderColor: BORDER_2 }} />
        <div className="absolute inset-0 flex gap-[2px] sm:gap-1">
          {points.map((p, i) => {
            const h = (Math.abs(p.value) / span) * 100, on = i === active, neg = p.value < 0
            return (
              <button key={i} type="button" onMouseEnter={() => setPicked(i)} onFocus={() => setPicked(i)} onClick={() => setPicked(i)}
                aria-label={`${p.label}: ${format(p.value)}`} aria-pressed={on}
                className="relative h-full min-w-0 flex-1 cursor-pointer rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[#84ADFF]"
                style={{ background: on ? 'rgba(29,78,216,0.07)' : 'transparent' }}>
                <span className="absolute left-[14%] right-[14%]"
                  style={{
                    top: neg ? `${zero}%` : `${zero - h}%`, height: `${Math.max(h, 0.8)}%`,
                    background: neg ? '#F97066' : BLUE, borderRadius: neg ? '0 0 4px 4px' : '4px 4px 0 0',
                  }} />
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] sm:gap-1" aria-hidden>
        {points.map((p, i) => (
          <span key={i} className="relative h-4 min-w-0 flex-1">
            {(i % every === 0 || i === points.length - 1) && (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px]" style={{ color: i === active ? TEXT : LABEL, fontWeight: i === active ? 600 : 500 }}>{p.tick}</span>
            )}
          </span>
        ))}
      </div>
      {a && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: BORDER, background: SURFACE }}>
          <span className="text-[13.5px] font-semibold" style={{ color: TEXT }}>{a.label}</span>
          <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: a.value < 0 ? '#D92D20' : TEXT_2 }}>{format(a.value)}</span>
        </div>
      )}
    </div>
  )
}

/** Choice cards (scenario, buyer and the like) */
export function ChoiceRow<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode; sub?: ReactNode }[]; label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => {
        const on = o.id === value
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)}
            className="min-w-0 cursor-pointer rounded-[12px] border px-2 py-2.5 text-center transition-colors"
            style={on ? { background: '#EFF4FF', borderColor: '#84ADFF', boxShadow: '0 0 0 3px rgba(29,78,216,0.08)' } : { background: CANVAS, borderColor: BORDER, boxShadow: XS }}>
            <span className="block truncate text-[13.5px] font-semibold" style={{ color: on ? BLUE : TEXT }}>{o.label}</span>
            {o.sub && <span className="mt-0.5 block truncate text-[12px]" style={{ color: on ? BLUE : SUBTLE }}>{o.sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Styles for the range sliders (thin track, round thumb) */
export const RANGE_CSS = `
.lg-range { -webkit-appearance: none; appearance: none; height: 20px; background: transparent; cursor: pointer; }
.lg-range::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: linear-gradient(to right, ${BLUE} var(--p, 0%), #EAECF0 var(--p, 0%)); }
.lg-range::-moz-range-track { height: 6px; border-radius: 999px; background: #EAECF0; }
.lg-range::-moz-range-progress { height: 6px; border-radius: 999px; background: ${BLUE}; }
.lg-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; margin-top: -7px; border-radius: 999px; background: #fff; border: 2px solid ${BLUE}; box-shadow: 0 1px 3px rgba(16,24,40,0.18); }
.lg-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 999px; background: #fff; border: 2px solid ${BLUE}; box-shadow: 0 1px 3px rgba(16,24,40,0.18); }
.lg-range:focus-visible { outline: none; }
.lg-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px rgba(29,78,216,0.18); }
`
