'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { type CRMLead } from '@/lib/twenty'
import { LogActivityModal } from '@/components/LogActivityModal'
import { WhatsAppModal } from '@/components/WhatsAppModal'
import { CallModal } from '@/components/CallModal'
import { FollowUpWriter } from '@/components/FollowUpWriter'
import { PropertyMatcher } from '@/components/PropertyMatcher'
import { EnrollSequenceModal } from '@/components/EnrollSequenceModal'
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, Clock, Tag,
  TrendingUp, Calendar, Edit2, Trash2, Loader2, Activity,
  AlertCircle, Plus, MessageCircle, CheckCircle, XCircle,
  MinusCircle, HelpCircle, ChevronDown, IndianRupee, User, Zap,
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#F8FAFC'
const PANEL   = '#FFFFFF'
const PANEL2  = '#F8FAFC'
const BORDER  = '#E2E8F0'
const AMBER   = '#D97706'
const BLUE    = '#2563EB'
const EMERALD = '#059669'
const RED_HOT = '#F97316'
const RED     = '#DC2626'
const TEXT    = '#0F172A'
const MUTED   = '#64748B'
const MUTED2  = '#334155'

// ─── Types ────────────────────────────────────────────────────────────────────
type Activity = {
  id: string
  type: string
  createdAt: string
  notes?: string | null
  outcome?: string | null
  duration?: number | null
  nextActionDate?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getDisplayName = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed Lead'
const getPhone = (l: CRMLead) => l.phones.primaryPhoneNumber ?? ''
const getEmail = (l: CRMLead) => l.emails.primaryEmail ?? ''
const getScore = (l: CRMLead) => l.intentScore ?? 0

function formatBudget(min: number | null, max: number | null): string {
  const fmt = (n: number) =>
    n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(1)}Cr` : `${+(n / 100_000).toFixed(1)}L`
  if (min && max) return `₹${fmt(min)} – ₹${fmt(max)}`
  if (min) return `₹${fmt(min)}+`
  if (max) return `Up to ₹${fmt(max)}`
  return '—'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'Just now'
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function scoreStyle(score: number) {
  if (score >= 70) return { label: 'High Intent', color: '#EA580C', ring: '#F97316', bg: '#FFF7ED' }
  if (score >= 40) return { label: 'Medium',      color: '#B45309', ring: '#D97706', bg: '#FFFBEB' }
  return               { label: 'Low',          color: '#64748B', ring: '#CBD5E1', bg: '#F1F5F9' }
}

function scoreBreakdown(l: CRMLead) {
  const items: { label: string; value: string; positive: boolean }[] = []
  const phone = getPhone(l)
  const email = getEmail(l)
  items.push({ label: 'Phone number', value: phone ? 'Provided' : 'Missing', positive: !!phone })
  items.push({ label: 'Email address', value: email ? 'Provided' : 'Missing', positive: !!email })
  if (l.budgetMin || l.budgetMax) {
    items.push({ label: 'Budget defined', value: formatBudget(l.budgetMin, l.budgetMax), positive: true })
  } else {
    items.push({ label: 'Budget', value: 'Not specified', positive: false })
  }
  const t = (l.timeline ?? '').toLowerCase()
  const urgency = t.includes('immediate') || t.includes('1 month') ? 'Immediate'
    : t.includes('1–3') || t.includes('3 month') ? 'Within 3 months'
    : t.includes('6') ? 'Within 6 months'
    : t ? 'Long-term' : 'Unknown'
  items.push({ label: 'Timeline urgency', value: urgency, positive: urgency !== 'Unknown' && urgency !== 'Long-term' })
  const s = (l.sourcePortal ?? '').toLowerCase()
  const srcQuality = s.includes('website') || s.includes('referral') ? 'Premium'
    : s.includes('magicbricks') || s.includes('99acres') || s.includes('housing') ? 'Portal'
    : s.includes('facebook') || s.includes('google') ? 'Paid Ads'
    : s ? 'Other' : 'Unknown'
  items.push({ label: 'Lead source quality', value: srcQuality, positive: srcQuality === 'Premium' || srcQuality === 'Portal' })
  return items
}

const OUTCOME_CONFIG: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  'Positive':    { Icon: CheckCircle, color: '#059669', bg: '#ECFDF5' },
  'Neutral':     { Icon: MinusCircle, color: '#64748B', bg: '#F1F5F9' },
  'Negative':    { Icon: XCircle,     color: '#DC2626', bg: '#FEF2F2' },
  'No Response': { Icon: HelpCircle,  color: '#B45309', bg: '#FFFBEB' },
}

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  'Call Made':            Phone,
  'Call Missed':          Phone,
  'WhatsApp Sent':        MessageCircle,
  'WhatsApp Received':    MessageCircle,
  'Email Sent':           Mail,
  'Email Received':       Mail,
  'Site Visit Scheduled': Calendar,
  'Site Visit Done':      MapPin,
  'Follow Up Set':        Clock,
  'Note':                 Tag,
  'Status Changed':       TrendingUp,
}

const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost']

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', ...style }}>
      {children}
    </div>
  )
}

function CardHeader({ title, icon: Icon, action }: { title: string; icon: React.ElementType; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: MUTED2, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
        <Icon style={{ width: 13, height: 13 }} />{title}
      </h3>
      {action}
    </div>
  )
}

function InfoRow({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12, color: MUTED, flexShrink: 0 }}>{label}</span>
      {href
        ? <a href={href} style={{ fontSize: 13, color: BLUE, textDecoration: 'none', textAlign: 'right' }}>{value || '—'}</a>
        : <span style={{ fontSize: 13, color: value ? TEXT : MUTED, textAlign: 'right' }}>{value || '—'}</span>
      }
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LeadDetailPage() {
  const router = useRouter()
  const { id: leadId } = useParams() as { id: string }

  const [lead, setLead]           = useState<CRMLead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showCallModal, setShowCallModal]         = useState(false)
  const [showSequenceModal, setShowSequenceModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [stageChanging, setStageChanging] = useState(false)
  const [showStageMenu, setShowStageMenu] = useState(false)

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/crm/leads/${leadId}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setLead(json.data.lead)
      setActivities(json.data.activities ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lead')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => { fetchLead() }, [fetchLead])

  const handleStageChange = async (stage: string) => {
    if (!lead) return
    setShowStageMenu(false)
    setStageChanging(true)
    try {
      await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: stage }),
      })
      setLead(prev => prev ? { ...prev, status: stage } : prev)
    } finally {
      setStageChanging(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/crm/leads/${leadId}`, { method: 'DELETE' })
      router.push('/dashboard/leads')
    } catch {
      setDeleting(false)
    }
  }

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Loader2 style={{ width: 22, height: 22, color: AMBER, animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, color: MUTED }}>Loading lead…</span>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle style={{ width: 40, height: 40, color: RED, margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: TEXT, margin: '0 0 8px' }}>{error || 'Lead not found'}</h2>
          <p style={{ fontSize: 13, color: MUTED, margin: '0 0 24px' }}>This lead may have been deleted or you don't have access.</p>
          <Link href="/dashboard/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, textDecoration: 'none' }}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back to Leads
          </Link>
        </div>
      </div>
    )
  }

  const score   = getScore(lead)
  const ss      = scoreStyle(score)
  const name    = getDisplayName(lead)
  const phone   = getPhone(lead)
  const email   = getEmail(lead)
  const bdown   = scoreBreakdown(lead)
  const waNum   = phone.replace(/\D/g, '').replace(/^0/, '91')

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── Breadcrumb ── */}
        <div style={{ padding: '20px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard/leads"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED, textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> All Leads
          </Link>
          {/* Delete */}
          <button onClick={() => setShowDeleteConfirm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, color: RED, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            <Trash2 style={{ width: 13, height: 13 }} /> Delete
          </button>
        </div>

        {/* ── Lead header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Avatar */}
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${ss.bg}`, border: `2px solid ${ss.ring}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User style={{ width: 26, height: 26, color: ss.color }} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ss.color, background: ss.bg, padding: '3px 10px', borderRadius: 20 }}>
                  {ss.label}
                </span>
                {lead.sourcePortal && (
                  <span style={{ fontSize: 11, color: MUTED, background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20 }}>
                    via {lead.sourcePortal}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {phone && (
              <button onClick={() => setShowCallModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: EMERALD, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <Phone style={{ width: 14, height: 14 }} />Call
              </button>
            )}
            {phone && (
              <button onClick={() => setShowWhatsAppModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 10, color: '#25D366', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <MessageCircle style={{ width: 14, height: 14 }} />WhatsApp
              </button>
            )}
            <button onClick={() => setShowSequenceModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, color: '#7C3AED', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Zap style={{ width: 14, height: 14 }} />Sequence
            </button>
            <button onClick={() => setShowActivityModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: BLUE, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus style={{ width: 14, height: 14 }} />Log Activity
            </button>
          </div>
        </div>

        {/* ── 2-col layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }} className="lg:grid-cols-[1fr_340px] grid-cols-1">

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Contact info */}
            <Card>
              <CardHeader title="Contact Info" icon={User} />
              <div style={{ padding: '4px 20px 8px' }}>
                <InfoRow label="Phone" value={phone} href={phone ? `tel:${phone}` : undefined} />
                <InfoRow label="Email" value={email} href={email ? `mailto:${email}` : undefined} />
                <InfoRow label="City" value={lead.city} />
                <InfoRow label="Localities" value={lead.localities?.join(', ') || null} />
              </div>
            </Card>

            {/* Requirements */}
            <Card>
              <CardHeader title="Requirements" icon={Building2} />
              <div style={{ padding: '4px 20px 8px' }}>
                <InfoRow label="Property Type" value={lead.propertyType?.join(', ') || null} />
                <InfoRow label="Budget" value={formatBudget(lead.budgetMin, lead.budgetMax)} />
                <InfoRow label="Timeline" value={lead.timeline} />
                <InfoRow label="Status" value={lead.status} />
              </div>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader
                title="Activity Timeline"
                icon={Activity}
                action={
                  <button onClick={() => setShowActivityModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Plus style={{ width: 12, height: 12 }} />Log
                  </button>
                }
              />

              {activities.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <Clock style={{ width: 28, height: 28, color: MUTED, margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 13, color: MUTED, margin: '0 0 8px' }}>No activities yet</p>
                  <button onClick={() => setShowActivityModal(true)}
                    style={{ fontSize: 12, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Log your first activity →
                  </button>
                </div>
              ) : (
                <div style={{ padding: '8px 20px 16px' }}>
                  {activities.map((act, idx) => {
                    const AIcon = ACTIVITY_ICON[act.type] ?? Activity
                    const oc = act.outcome ? OUTCOME_CONFIG[act.outcome] : null
                    const OIcon = oc?.Icon
                    return (
                      <div key={act.id} style={{ display: 'flex', gap: 14, paddingBottom: idx < activities.length - 1 ? 20 : 0 }}>
                        {/* Timeline line + dot */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AIcon style={{ width: 14, height: 14, color: BLUE }} />
                          </div>
                          {idx < activities.length - 1 && (
                            <div style={{ width: 1, flex: 1, background: BORDER, marginTop: 6 }} />
                          )}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, paddingTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{act.type}</span>
                            <span style={{ fontSize: 11, color: MUTED }}>{timeAgo(act.createdAt)}</span>
                          </div>
                          {oc && OIcon && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: oc.color, background: oc.bg, padding: '2px 8px', borderRadius: 6, marginBottom: 6 }}>
                              <OIcon style={{ width: 10, height: 10 }} />{act.outcome}
                            </span>
                          )}
                          {act.notes && (
                            <p style={{ fontSize: 13, color: MUTED2, margin: '0 0 4px', lineHeight: 1.5 }}>{act.notes}</p>
                          )}
                          {act.duration && (
                            <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>
                              <Clock style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
                              {Math.floor(act.duration / 60)}m {act.duration % 60}s
                            </p>
                          )}
                          {act.nextActionDate && (
                            <p style={{ fontSize: 11, color: AMBER, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar style={{ width: 10, height: 10 }} />
                              Follow up: {formatDate(act.nextActionDate)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Score ring */}
            <Card>
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 16px' }}>Intent Score</p>
                {/* Ring SVG */}
                <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 12px' }}>
                  <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={BORDER} strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={ss.ring} strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - score / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: ss.color, lineHeight: 1 }}>{score}</span>
                    <span style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>/ 100</span>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: ss.color }}>{ss.label}</span>

                {/* Score breakdown */}
                <div style={{ marginTop: 16, textAlign: 'left', borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                  {bdown.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < bdown.length - 1 ? 8 : 0 }}>
                      <span style={{ fontSize: 11, color: MUTED }}>{item.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: item.positive ? EMERALD : '#6B7280' }}>
                        {item.positive ? '✓' : '✗'} {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Pipeline stage */}
            <Card>
              <CardHeader title="Pipeline Stage" icon={TrendingUp} />
              <div style={{ padding: 16 }}>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowStageMenu(v => !v)} disabled={stageChanging}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <span>{stageChanging ? 'Updating…' : (lead.status || 'New')}</span>
                    <ChevronDown style={{ width: 14, height: 14, color: MUTED }} />
                  </button>
                  {showStageMenu && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 10, zIndex: 20, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                      {PIPELINE_STAGES.map(s => (
                        <button key={s} onClick={() => handleStageChange(s)}
                          style={{ display: 'block', width: '100%', padding: '9px 14px', background: lead.status === s ? 'rgba(59,130,246,0.1)' : 'transparent', color: lead.status === s ? '#93C5FD' : TEXT, fontSize: 13, border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: lead.status === s ? 600 : 400 }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stage progress dots */}
                <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                  {PIPELINE_STAGES.slice(0, -1).map((s, i) => {
                    const currentIdx = PIPELINE_STAGES.indexOf(lead.status ?? 'New')
                    const isDone = i <= currentIdx
                    return (
                      <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: isDone ? BLUE : BORDER }} />
                    )
                  })}
                </div>
              </div>
            </Card>

            {/* Lead details */}
            <Card>
              <CardHeader title="Lead Details" icon={Tag} />
              <div style={{ padding: '4px 20px 8px' }}>
                <InfoRow label="Source portal" value={lead.sourcePortal} />
                <InfoRow label="Source detail" value={lead.sourceDetail} />
                <InfoRow label="Portal lead ID" value={lead.leadPortalId} />
                <InfoRow label="Added" value={formatDate(lead.createdAt)} />
                <InfoRow label="Last updated" value={formatDate(lead.updatedAt)} />
              </div>
            </Card>

            {/* AI Property Matcher */}
            <PropertyMatcher lead={{
              name,
              city:         lead.city ?? null,
              budgetMin:    lead.budgetMin ?? null,
              budgetMax:    lead.budgetMax ?? null,
              propertyType: lead.propertyType ?? null,
              timeline:     lead.timeline ?? null,
              localities:   lead.localities ?? null,
              phone:        phone || null,
            }} />

            {/* AI Follow-up Writer */}
            <FollowUpWriter lead={{
              leadId:       leadId,
              name,
              city:         lead.city ?? null,
              budget:       formatBudget(lead.budgetMin, lead.budgetMax) !== '—' ? formatBudget(lead.budgetMin, lead.budgetMax) : null,
              propertyType: lead.propertyType?.join(', ') ?? null,
              timeline:     lead.timeline ?? null,
              score,
              lastActivity: activities[0]?.type ?? null,
              status:       lead.status ?? null,
              phone:        phone || null,
            }} />
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <LogActivityModal
        leadId={leadId}
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onActivityLogged={() => { setShowActivityModal(false); fetchLead() }}
      />

      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => { setShowWhatsAppModal(false); fetchLead() }}
        leadId={leadId}
        leadName={lead ? `${lead.name.firstName} ${lead.name.lastName}`.trim() : ''}
        leadPhone={lead?.phones.primaryPhoneNumber ?? ''}
        city={lead?.city ?? ''}
      />

      <EnrollSequenceModal
        isOpen={showSequenceModal}
        onClose={() => setShowSequenceModal(false)}
        leadId={leadId}
        leadName={name}
        leadPhone={phone}
        onEnrolled={() => setShowSequenceModal(false)}
      />

      <CallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        leadId={leadId}
        leadName={lead ? `${lead.name.firstName} ${lead.name.lastName}`.trim() : ''}
        leadPhone={lead?.phones.primaryPhoneNumber ?? ''}
        onLogged={fetchLead}
      />

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}
        >
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 28, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 style={{ width: 20, height: 20, color: RED }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: '0 0 8px' }}>Delete Lead?</h3>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 24px' }}>
              This will permanently delete <strong style={{ color: TEXT }}>{name}</strong> and all their activity history. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, padding: '10px 0', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: RED, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : null}
                {deleting ? 'Deleting…' : 'Delete Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
