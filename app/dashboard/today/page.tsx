'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Phone, ChatCircle, Clock, Warning, ArrowRight, CircleNotch,
  CalendarCheck, Lightning, Star,
} from '@phosphor-icons/react'

// ─── Design tokens (matching dashboard) ─────────────────────────────────────
const BG     = '#FAFAF8'
const PANEL  = '#ffffff'
const BORDER = '#E8EAF0'
const TEXT   = '#0f1729'
const MUTED  = '#5c6479'
const LABEL  = '#9aa2b8'
const BLUE   = '#0038A8'

// ─── Types ───────────────────────────────────────────────────────────────────
type CRMLead = {
  id: string
  name: { firstName: string; lastName: string }
  phones: { primaryPhoneNumber: string | null }
  intentScore: number | null
  status: string | null
  sourcePortal: string | null
  createdAt: string
  updatedAt: string
  failedContactAttempts: number
}

const getName = (l: CRMLead) =>
  `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getInitials = (l: CRMLead) =>
  ((l.name.firstName?.[0] ?? '') + (l.name.lastName?.[0] ?? '')).toUpperCase() || '?'

const STAGE_WEIGHTS: Record<string, number> = {
  Hot: 1.0, Warm: 0.7, Cold: 0.4, New: 0.1,
}
const STAGE_THRESHOLDS: Record<string, number> = {
  Hot: 2, Warm: 4, Cold: 7, New: 1,
}

function gapDays(lead: CRMLead): number {
  const ref = new Date(lead.updatedAt)
  return Math.floor((Date.now() - ref.getTime()) / 86400000)
}

function rescuePriority(lead: CRMLead): number {
  const status = lead.status ?? 'New'
  const gap    = gapDays(lead)
  const sw     = STAGE_WEIGHTS[status]  ?? 0.1
  const thresh = STAGE_THRESHOLDS[status] ?? 1
  const gu     = Math.min(1.0, gap / thresh)
  const is     = lead.intentScore ?? 0
  return (sw * 40) + (gu * 35) + (is * 0.25)
}

function reasonLine(lead: CRMLead): string {
  const s   = lead.status ?? 'New'
  const gap = gapDays(lead)
  const pl  = gap === 1 ? '' : 's'
  const nc  = lead.failedContactAttempts ?? 0

  if (s === 'Hot' && gap >= 1)    return `Hot lead — ${gap} day${pl} since last contact`
  if (nc >= 3)                     return `Called ${nc} times with no answer — try WhatsApp`
  if (nc >= 1)                     return `Missed your last call — send a WhatsApp to reopen`
  if (s === 'Warm' && gap >= 3)    return `Warm lead going cold — ${gap} days of silence`
  if (s === 'Cold' && gap >= 5)    return `${gap} days of silence — send a follow-up`
  return `${gap} day${pl} since last touchpoint`
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Hot:          { bg: 'rgba(239,68,68,0.08)',  fg: '#DC2626' },
  Warm:         { bg: 'rgba(245,158,11,0.1)',  fg: '#B45309' },
  Cold:         { bg: 'rgba(59,130,246,0.08)', fg: '#1D4ED8' },
  New:          { bg: 'rgba(16,185,129,0.08)', fg: '#059669' },
  Hold:         { bg: 'rgba(139,92,246,0.08)', fg: '#6D28D9' },
  Disqualified: { bg: 'rgba(107,114,128,0.1)', fg: '#4B5563' },
  Closed:       { bg: 'rgba(16,185,129,0.1)',  fg: '#065F46' },
}

// ─── Lead card components ─────────────────────────────────────────────────────

function SlippingCard({ lead }: { lead: CRMLead }) {
  const status  = lead.status ?? 'New'
  const colors  = STATUS_COLORS[status] ?? STATUS_COLORS.Cold
  const initials = getInitials(lead)
  const score    = lead.intentScore ?? 0

  return (
    <Link href={`/dashboard/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: PANEL,
          border: `1px solid ${BORDER}`,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = BLUE)}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = BORDER)}
      >
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, background: colors.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 12, fontWeight: 700, color: colors.fg,
        }}>
          {initials}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getName(lead)}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: colors.bg, color: colors.fg, flexShrink: 0, letterSpacing: '0.04em' }}>
              {status.toUpperCase()}
            </span>
            {score > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: score >= 70 ? '#DC2626' : score >= 40 ? '#B45309' : MUTED, flexShrink: 0 }}>
                <Lightning size={10} weight="fill" />
                {score}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.4 }}>
            {reasonLine(lead)}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {lead.phones.primaryPhoneNumber && (
            <a
              href={`tel:${lead.phones.primaryPhoneNumber}`}
              onClick={e => e.stopPropagation()}
              style={{
                width: 30, height: 30, background: 'rgba(0,56,168,0.06)',
                border: `1px solid rgba(0,56,168,0.15)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: BLUE, textDecoration: 'none',
              }}
              title="Call"
            >
              <Phone size={13} weight="light" />
            </a>
          )}
          {lead.phones.primaryPhoneNumber && (
            <a
              href={`https://wa.me/${lead.phones.primaryPhoneNumber.replace(/\D/g, '')}`}
              onClick={e => e.stopPropagation()}
              target="_blank" rel="noopener noreferrer"
              style={{
                width: 30, height: 30, background: 'rgba(37,211,102,0.06)',
                border: `1px solid rgba(37,211,102,0.2)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#16A34A', textDecoration: 'none',
              }}
              title="WhatsApp"
            >
              <ChatCircle size={13} weight="light" />
            </a>
          )}
        </div>
      </div>
    </Link>
  )
}

function FreshCard({ lead }: { lead: CRMLead }) {
  const source = lead.sourcePortal ?? 'Direct'
  const score  = lead.intentScore ?? 0
  const age    = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 3600000)
  const ageStr = age < 24 ? `${age}h ago` : `${Math.floor(age / 24)}d ago`

  return (
    <Link href={`/dashboard/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: PANEL,
          border: `1px solid ${BORDER}`,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = BLUE)}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = BORDER)}
      >
        <div style={{
          width: 36, height: 36, background: 'rgba(16,185,129,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#059669',
        }}>
          {getInitials(lead)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getName(lead)}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: 'rgba(16,185,129,0.08)', color: '#059669', flexShrink: 0, letterSpacing: '0.04em' }}>
              NEW
            </span>
            {source && (
              <span style={{ fontSize: 10, color: LABEL, flexShrink: 0 }}>{source}</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
            First contact pending · {ageStr}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {lead.phones.primaryPhoneNumber && (
            <a
              href={`tel:${lead.phones.primaryPhoneNumber}`}
              onClick={e => e.stopPropagation()}
              style={{
                width: 30, height: 30, background: 'rgba(0,56,168,0.06)',
                border: `1px solid rgba(0,56,168,0.15)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: BLUE, textDecoration: 'none',
              }}
            >
              <Phone size={13} weight="light" />
            </a>
          )}
        </div>

        {score > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: score >= 70 ? '#DC2626' : MUTED, flexShrink: 0 }}>
            <Lightning size={10} weight="fill" />
            {score}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, count, subtitle }: { title: string; count: number; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '0.01em' }}>
          {title}
        </h2>
        <span style={{ fontSize: 11, fontWeight: 600, color: LABEL }}>{count}</span>
      </div>
      {subtitle && (
        <p style={{ fontSize: 11.5, color: MUTED, margin: '2px 0 0', lineHeight: 1.4 }}>{subtitle}</p>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon, message, action }: { icon: React.ReactNode; message: string; action?: React.ReactNode }) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${BORDER}`,
      padding: '28px 20px', textAlign: 'center',
    }}>
      <div style={{ color: LABEL, marginBottom: 8 }}>{icon}</div>
      <p style={{ fontSize: 13, color: MUTED, margin: '0 0 12px' }}>{message}</p>
      {action}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TodayPage() {
  const [slipping, setSlipping] = useState<CRMLead[]>([])
  const [fresh,    setFresh]    = useState<CRMLead[]>([])
  const [loading,  setLoading]  = useState(true)
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [activeRes, freshRes] = await Promise.all([
        fetch('/api/crm/leads?limit=100'),
        fetch('/api/crm/leads?status=New&limit=20'),
      ])
      const activeJson = await activeRes.json()
      const freshJson  = await freshRes.json()

      const allLeads: CRMLead[] = activeJson?.data?.leads ?? []
      const freshLeads: CRMLead[] = freshJson?.data?.leads ?? []

      // Slipping: non-New leads that have passed half their threshold
      const slippingLeads = allLeads
        .filter(l => {
          const s = l.status ?? 'New'
          if (['New', 'Closed', 'Disqualified', 'Hold'].includes(s)) return false
          const thresh = STAGE_THRESHOLDS[s] ?? 7
          return gapDays(l) >= thresh * 0.5
        })
        .sort((a, b) => rescuePriority(b) - rescuePriority(a))
        .slice(0, 12)

      setSlipping(slippingLeads)
      setFresh(freshLeads.slice(0, 8))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircleNotch size={22} weight="light" style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const hasContent = slipping.length > 0 || fresh.length > 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, fontFamily: 'var(--font-inter, Inter, system-ui, sans-serif)' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <CalendarCheck size={16} weight="light" style={{ color: BLUE }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: MUTED }}>
            {today}
          </span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '-0.02em' }}>
          Today
        </h1>
      </div>

      {!hasContent && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '48px 32px', textAlign: 'center', maxWidth: 480 }}>
          <Star size={28} weight="light" style={{ color: LABEL, marginBottom: 12 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: '0 0 8px' }}>All caught up</h3>
          <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px', lineHeight: 1.6 }}>
            No leads need attention right now. Import leads or add new ones to get started.
          </p>
          <Link href="/dashboard/leads/ingestion"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: BLUE, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            Import leads
            <ArrowRight size={13} weight="light" />
          </Link>
        </div>
      )}

      {/* Section 1 — Slipping */}
      {slipping.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader
            title="Slipping"
            count={slipping.length}
            subtitle="These leads haven't been contacted recently — call the highest priority ones first."
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {slipping.map(l => <SlippingCard key={l.id} lead={l} />)}
          </div>
        </div>
      )}

      {/* Section 2 — Due Today (placeholder until follow_up_date column ships) */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          title="Due Today"
          count={0}
          subtitle="Scheduled follow-ups land here."
        />
        <EmptyState
          icon={<Clock size={22} weight="light" />}
          message="No follow-ups scheduled for today."
          action={
            <span style={{ fontSize: 12, color: LABEL }}>
              Log a call and set a follow-up to see it here.
            </span>
          }
        />
      </div>

      {/* Section 3 — Fresh */}
      {fresh.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader
            title="Fresh"
            count={fresh.length}
            subtitle="New leads with no contact attempt yet."
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {fresh.map(l => <FreshCard key={l.id} lead={l} />)}
          </div>
          {fresh.length >= 8 && (
            <Link href="/dashboard/leads?status=New"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 16px', background: PANEL, border: `1px solid ${BORDER}`, borderTop: 'none', fontSize: 12, color: MUTED, textDecoration: 'none' }}>
              View all new leads
              <ArrowRight size={11} weight="light" />
            </Link>
          )}
        </div>
      )}

    </div>
  )
}
