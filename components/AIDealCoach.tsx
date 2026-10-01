'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Lightning, Flame, Clock, CurrencyInr, TrendUp,
  ArrowUpRight,
} from '@phosphor-icons/react'

// Minimal lead shape — both dashboard and lifecycle CRMLead satisfy this structurally
type Lead = {
  id: string
  name: { firstName: string; lastName: string }
  intentScore: number | null
  status: string | null
  budgetMax: number | null
  sourcePortal?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Design tokens ──────────────────────────────────────────────────────────────
const BG      = '#FAFAF8'
const BORDER  = '#E2E2DC'
const TEXT    = '#0C0C0B'
const MUTED   = '#78889B'
const LABEL   = '#A4B1BE'

const COACH_GOLD    = '#8A6E35'
const COACH_GOLD_LT = 'rgba(138,110,53,0.07)'
const COACH_GOLD_BD = 'rgba(138,110,53,0.2)'

// ─── Types ──────────────────────────────────────────────────────────────────────
type CoachUrgency = 'high' | 'medium' | 'low'

// Each chip shows one contributing signal so the recommendation feels grounded
type CoachSignal = {
  label: string
  color: string
  bg: string
}

type CoachNudge = {
  id: string
  urgency: CoachUrgency
  Icon: React.ElementType
  stat: string
  statLabel: string
  signals: CoachSignal[]
  detail: string
  cta: string
  href: string
  accentColor: string
  accentBg: string
}

const URGENCY_COLOR: Record<CoachUrgency, string> = {
  high:   '#C42B2B',
  medium: '#D97706',
  low:    '#047857',
}
const URGENCY_LABEL: Record<CoachUrgency, string> = {
  high:   'Urgent',
  medium: 'Attention',
  low:    'Insight',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function formatPipeline(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)} Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(0)} L`
  return `₹${n.toLocaleString()}`
}
function score(l: Lead) { return l.intentScore ?? 0 }
function name(l: Lead)  { return `${l.name?.firstName ?? ''} ${l.name?.lastName ?? ''}`.trim() || 'Unnamed' }
function hoursAgo(d: string) { return Math.round((Date.now() - new Date(d).getTime()) / 3_600_000) }
function daysAgo(d: string)  { return Math.round((Date.now() - new Date(d).getTime()) / 86_400_000) }
const TERMINAL = new Set(['Closed', 'Won', 'Lost', 'NC'])
const EARLY    = new Set(['Fresh', 'Cold', 'Attempting'])
const LATE     = new Set(['Site Visit', 'Negotiation', 'Virtual Meeting'])

// ─── Individual nudge card ───────────────────────────────────────────────────────
function CoachCard({ nudge }: { nudge: CoachNudge }) {
  const [hov, setHov] = useState(false)
  const urgencyColor  = URGENCY_COLOR[nudge.urgency]
  const statLen       = nudge.stat.replace(/[₹,. ]/g, '').length
  const statFontSize  = statLen <= 3 ? 36 : statLen <= 6 ? 28 : 22

  return (
    <Link href={nudge.href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          borderTop:    `3px solid ${urgencyColor}`,
          borderRight:  `1px solid ${hov ? nudge.accentColor + '40' : BORDER}`,
          borderBottom: `1px solid ${hov ? nudge.accentColor + '40' : BORDER}`,
          borderLeft:   `1px solid ${hov ? nudge.accentColor + '40' : BORDER}`,
          borderRadius: 2,
          background: hov ? nudge.accentBg : '#FFFFFF',
          padding: '16px 18px',
          display: 'flex', flexDirection: 'column',
          height: '100%', boxSizing: 'border-box',
          cursor: 'pointer',
          transition: 'border-color 0.14s, background 0.14s',
        }}
      >
        {/* Urgency badge + icon */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: urgencyColor, background: `${urgencyColor}12`, padding: '3px 7px', borderRadius: 2,
          }}>
            {URGENCY_LABEL[nudge.urgency]}
          </span>
          <div style={{
            width: 26, height: 26, borderRadius: 2,
            background: nudge.accentBg, border: `1px solid ${nudge.accentColor}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <nudge.Icon size={12} weight="light" style={{ color: nudge.accentColor }} />
          </div>
        </div>

        {/* Hero stat — fixed 56px so dividers align across all cards */}
        <div style={{ height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: statFontSize, fontWeight: 700, fontStyle: 'italic',
            color: nudge.accentColor, lineHeight: 1.05, letterSpacing: '-0.02em',
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            {nudge.stat}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: TEXT, marginTop: 4, lineHeight: 1.2 }}>
            {nudge.statLabel}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: BORDER, margin: '12px 0' }} />

        {/* Signal chips — shows what combination of data fired this nudge */}
        {nudge.signals.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {nudge.signals.map((sig, i) => (
              <span key={i} style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.03em',
                color: sig.color, background: sig.bg,
                border: `1px solid ${sig.color}28`,
                padding: '2px 6px', borderRadius: 2, whiteSpace: 'nowrap',
              }}>
                {sig.label}
              </span>
            ))}
          </div>
        )}

        {/* Detail — flex: 1 ensures CTA always sits at same baseline */}
        <div style={{ flex: 1, fontSize: 11, color: MUTED, lineHeight: 1.65, marginBottom: 14 }}>
          {nudge.detail}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: nudge.accentColor, letterSpacing: '0.01em' }}>
            {nudge.cta}
          </span>
          <ArrowUpRight size={11} weight="light" style={{ color: nudge.accentColor, flexShrink: 0 }} />
        </div>
      </div>
    </Link>
  )
}

// ─── Main widget ─────────────────────────────────────────────────────────────────
export function AIDealCoach({ leads }: { leads: Lead[] }) {
  const [dismissed, setDismissed] = useState(false)

  const nudges = useMemo((): CoachNudge[] => {
    const result: CoachNudge[] = []

    // ── 1. Hot leads gone quiet ────────────────────────────────────────────────
    // Signals: intent score ≥70 + 72h+ with no update + budget confirmed
    const staleHot = leads.filter(l =>
      score(l) >= 70 &&
      !TERMINAL.has(l.status ?? '') &&
      hoursAgo(l.updatedAt) > 72
    )
    if (staleHot.length > 0) {
      const avgScore    = Math.round(staleHot.reduce((s, l) => s + score(l), 0) / staleHot.length)
      const maxHours    = Math.max(...staleHot.map(l => hoursAgo(l.updatedAt)))
      const withBudget  = staleHot.filter(l => (l.budgetMax ?? 0) > 0)

      const signals: CoachSignal[] = [
        { label: `Intent avg ${avgScore}`,  color: '#C42B2B', bg: 'rgba(196,43,43,0.06)' },
        { label: `${maxHours}h+ no contact`, color: '#D97706', bg: 'rgba(217,119,6,0.06)' },
      ]
      if (withBudget.length > 0) {
        signals.push({ label: `${withBudget.length} budget confirmed`, color: '#047857', bg: 'rgba(4,120,87,0.06)' })
      }

      const dayCount = Math.round(maxHours / 24)
      result.push({
        id: 'stale-hot',
        urgency: 'high',
        Icon: Flame,
        stat: String(staleHot.length),
        statLabel: `hot lead${staleHot.length > 1 ? 's' : ''} at risk`,
        signals,
        detail: staleHot.length === 1
          ? `${name(staleHot[0])} scores ${score(staleHot[0])}/100 but has had no contact for ${dayCount} days. High-intent leads go cold within a week.`
          : `${name(staleHot[0])} + ${staleHot.length - 1} more have high intent but zero contact in ${dayCount}+ days.`,
        cta: 'Follow up now',
        href: staleHot.length === 1 ? `/dashboard/leads/${staleHot[0].id}` : '/dashboard/leads',
        accentColor: '#C42B2B',
        accentBg: 'rgba(196,43,43,0.05)',
      })
    }

    // ── 2. Early-stage leads that haven't moved ────────────────────────────────
    // Signals: days in stage + portal source quality + whether intent signal exists
    const stuckEarly = leads.filter(l =>
      EARLY.has(l.status ?? 'Fresh') &&
      daysAgo(l.createdAt) > 5
    )
    if (stuckEarly.length > 0) {
      const maxDays     = Math.max(...stuckEarly.map(l => daysAgo(l.createdAt)))
      const portalLeads = stuckEarly.filter(l => l.sourcePortal)
      const withSignal  = stuckEarly.filter(l => score(l) >= 40)

      const signals: CoachSignal[] = [
        { label: `${maxDays}d+ in stage`, color: '#D97706', bg: 'rgba(217,119,6,0.06)' },
      ]
      if (portalLeads.length > 0) {
        signals.push({
          label: `${portalLeads.length} portal lead${portalLeads.length > 1 ? 's' : ''}`,
          color: '#1D4ED8', bg: 'rgba(29,78,216,0.06)',
        })
      }
      if (withSignal.length > 0) {
        signals.push({
          label: `${withSignal.length} with intent signal`,
          color: '#047857', bg: 'rgba(4,120,87,0.06)',
        })
      }

      result.push({
        id: 'stuck-early',
        urgency: 'medium',
        Icon: Clock,
        stat: String(stuckEarly.length),
        statLabel: `lead${stuckEarly.length > 1 ? 's' : ''} stuck early`,
        signals,
        detail: portalLeads.length > 0
          ? `${portalLeads.length} portal-sourced lead${portalLeads.length > 1 ? 's' : ''} stuck without first contact. Week-one reach-out has 3× higher conversion.`
          : `Stuck in initial stage for ${maxDays}+ days with no progression. Early contact is your highest-leverage action.`,
        cta: 'Review and qualify',
        href: '/dashboard/leads',
        accentColor: '#D97706',
        accentBg: 'rgba(217,119,6,0.05)',
      })
    }

    // ── 3. High-value deals (₹5 Cr+) open ────────────────────────────────────
    // Signals: deal count + avg idle days + late-stage count (changes urgency)
    const highValue = leads.filter(l =>
      (l.budgetMax ?? 0) >= 5_000_000 &&
      !TERMINAL.has(l.status ?? '')
    )
    if (highValue.length > 0) {
      const totalVal    = highValue.reduce((s, l) => s + (l.budgetMax ?? 0), 0)
      const avgIdle     = Math.round(highValue.reduce((s, l) => s + daysAgo(l.updatedAt), 0) / highValue.length)
      const lateStage   = highValue.filter(l => LATE.has(l.status ?? ''))

      const signals: CoachSignal[] = [
        { label: `${highValue.length} open deal${highValue.length > 1 ? 's' : ''}`, color: COACH_GOLD, bg: COACH_GOLD_LT },
        { label: `${avgIdle}d avg idle`, color: avgIdle >= 7 ? '#D97706' : MUTED, bg: avgIdle >= 7 ? 'rgba(217,119,6,0.06)' : 'rgba(120,136,155,0.06)' },
      ]
      if (lateStage.length > 0) {
        signals.push({ label: `${lateStage.length} in late stage`, color: '#1D4ED8', bg: 'rgba(29,78,216,0.06)' })
      }

      result.push({
        id: 'high-value',
        urgency: lateStage.length > 0 ? 'high' : 'medium',
        Icon: CurrencyInr,
        stat: formatPipeline(totalVal),
        statLabel: 'in high-value pipeline',
        signals,
        detail: lateStage.length > 0
          ? `${lateStage.length} deal${lateStage.length > 1 ? 's' : ''} above ₹5 Cr in late stage. A direct manager touchpoint at negotiation closes 2× faster.`
          : `${highValue.length} lead${highValue.length > 1 ? 's' : ''} above ₹5 Cr still open. These deserve white-glove attention — don't let them drift.`,
        cta: 'Prioritize now',
        href: '/dashboard/lifecycle',
        accentColor: COACH_GOLD,
        accentBg: COACH_GOLD_LT,
      })
    }

    // ── 4. Conversion rate below benchmark ────────────────────────────────────
    // Signals: actual rate vs 20% avg + stalled-count + early→late drop-off %
    const closedCount = leads.filter(l => ['Closed', 'Won'].includes(l.status ?? '')).length
    const convRate    = leads.length > 10 ? Math.round((closedCount / leads.length) * 100) : null
    if (convRate !== null && convRate < 15) {
      const stalledCount = leads.filter(l =>
        !TERMINAL.has(l.status ?? '') && daysAgo(l.updatedAt) > 10
      ).length
      const earlyCount = leads.filter(l => EARLY.has(l.status ?? '')).length
      const lateCount  = leads.filter(l => LATE.has(l.status ?? '')).length
      const dropOff    = earlyCount > 0
        ? Math.round(((earlyCount - Math.min(lateCount, earlyCount)) / earlyCount) * 100)
        : null

      const signals: CoachSignal[] = [
        { label: `${convRate}% close rate`,  color: '#047857', bg: 'rgba(4,120,87,0.06)' },
        { label: 'Industry avg 20%',          color: '#94A3B8', bg: 'rgba(148,163,184,0.06)' },
      ]
      if (stalledCount > 0) {
        signals.push({ label: `${stalledCount} stalled 10d+`, color: '#C42B2B', bg: 'rgba(196,43,43,0.06)' })
      }

      result.push({
        id: 'conv-rate',
        urgency: 'low',
        Icon: TrendUp,
        stat: `${convRate}%`,
        statLabel: 'close rate',
        signals,
        detail: dropOff !== null && dropOff > 40
          ? `${dropOff}% of early-stage leads never reach a site visit. A structured 3-touch sequence after first contact bridges that drop.`
          : `Pipeline is below the 20% industry benchmark. A follow-up sequence for warm leads recovers stalled deals before they go lost.`,
        cta: 'View analytics',
        href: '/dashboard/analytics',
        accentColor: '#047857',
        accentBg: 'rgba(4,120,87,0.05)',
      })
    }

    return result.slice(0, 4)
  }, [leads])

  if (dismissed || nudges.length === 0) return null

  return (
    <div style={{
      border: `1px solid ${COACH_GOLD_BD}`,
      borderRadius: 2, background: BG,
      marginBottom: 20, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px 14px 0',
        borderBottom: `1px solid ${COACH_GOLD_BD}`,
        background: COACH_GOLD_LT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ width: 3, alignSelf: 'stretch', background: COACH_GOLD, marginRight: 17, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 2,
              background: COACH_GOLD_LT, border: `1px solid ${COACH_GOLD_BD}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Lightning size={14} weight="light" style={{ color: COACH_GOLD }} />
            </div>
            <div>
              <div style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 15, fontWeight: 700, fontStyle: 'italic',
                color: COACH_GOLD, lineHeight: 1, marginBottom: 3,
              }}>
                AI Deal Coach
              </div>
              <div style={{ fontSize: 11, color: LABEL }}>
                {nudges.length} action{nudges.length > 1 ? 's' : ''} · {nudges.map(n => n.signals.length).reduce((a, b) => a + b, 0)} signals analysed
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          style={{
            fontSize: 11, color: LABEL, background: 'none',
            border: `1px solid ${BORDER}`, borderRadius: 2,
            cursor: 'pointer', padding: '4px 10px', letterSpacing: '0.01em',
            transition: 'color 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = MUTED }}
          onMouseLeave={e => { e.currentTarget.style.color = LABEL; e.currentTarget.style.borderColor = BORDER }}
        >
          Dismiss
        </button>
      </div>

      {/* Cards */}
      <div style={{
        padding: '20px',
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(nudges.length, 4)}, 1fr)`,
        gap: 12,
      }}>
        {nudges.map(n => <CoachCard key={n.id} nudge={n} />)}
      </div>
    </div>
  )
}
