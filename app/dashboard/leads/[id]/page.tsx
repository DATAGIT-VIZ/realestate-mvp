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
  AlertCircle, Plus, MessageCircle, CheckCircle, XCircle, X,
  MinusCircle, HelpCircle, ChevronDown, IndianRupee, User, Zap, PhoneOff, Copy,
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
function getCsId(lead: CRMLead): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
}

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

const LIFECYCLE_STAGES = [
  { id: 'Fresh',           label: 'Fresh',               color: '#64748B', desc: 'Unworked — just arrived'        },
  { id: 'Attempting',      label: 'Attempting',           color: '#2563EB', desc: 'Active call attempts'           },
  { id: 'VM Done',         label: 'VM Done',              color: '#7C3AED', desc: 'Voicemail / message left'       },
  { id: 'Connected',       label: 'Connected',            color: '#0EA5E9', desc: 'First contact made'             },
  { id: 'Virtual Meeting', label: 'Virtual Meeting Done', color: '#D97706', desc: 'Video / virtual call done'      },
  { id: 'Site Visit',      label: 'Site Visit Done',      color: '#F97316', desc: 'Physical site visit completed'  },
  { id: 'Negotiation',     label: 'Negotiation',          color: '#8B5CF6', desc: 'Terms & pricing discussion'     },
  { id: 'Won',             label: 'Closed',               color: '#059669', desc: 'Deal closed successfully', terminal: true },
  { id: 'Lost',            label: 'Lost',                 color: '#DC2626', desc: 'Lead not proceeding',      terminal: true },
  { id: 'NC',              label: 'NC',                   color: '#94A3B8', desc: 'Non-contactable (5 failed attempts)', terminal: true },
]

// Bucket grouping — mirrors the lifecycle kanban board
const STAGE_BUCKETS = [
  { label: 'New Leads',         color: '#64748B', stages: ['Fresh']                                },
  { label: 'Cold Stage',        color: '#2563EB', stages: ['Attempting', 'VM Done']                },
  { label: 'Warm Stage',        color: '#D97706', stages: ['Connected', 'Virtual Meeting']         },
  { label: 'Hot Stage',         color: '#F97316', stages: ['Site Visit', 'Negotiation', 'Won']     },
  { label: 'Disqualified / NC', color: '#DC2626', stages: ['Lost', 'NC']                           },
]

const PIPELINE_STAGES = LIFECYCLE_STAGES.map(s => s.id)

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
  const [enrollments, setEnrollments] = useState<Array<{
    id: string; status: string; current_step: number; next_fire_at: string | null; created_at: string;
    sequences: { id: string; name: string; description: string | null; sequence_steps: Array<{ step_order: number; channel: string }> } | null
  }>>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [stageChanging, setStageChanging] = useState(false)
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [callAttempts, setCallAttempts] = useState<string[]>([])
  const [showNCSuggest, setShowNCSuggest] = useState(false)

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

  const fetchEnrollments = useCallback(async () => {
    try {
      const res  = await fetch(`/api/outreach/enrollments?leadId=${leadId}`)
      const json = await res.json()
      setEnrollments(json.data?.enrollments ?? [])
    } catch { /* enrollments are non-critical */ }
  }, [leadId])

  useEffect(() => { fetchEnrollments() }, [fetchEnrollments])

  const handleCancelEnrollment = async (enrollmentId: string) => {
    setCancellingId(enrollmentId)
    await fetch(`/api/outreach/enrollments?id=${enrollmentId}`, { method: 'DELETE' })
    setCancellingId(null)
    fetchEnrollments()
  }

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

  // Call attempt tracker — persisted in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`call_attempts_${leadId}`)
      if (stored) setCallAttempts(JSON.parse(stored))
    } catch {}
  }, [leadId])

  const logCallAttempt = () => {
    const updated = [...callAttempts, new Date().toISOString()]
    setCallAttempts(updated)
    try { localStorage.setItem(`call_attempts_${leadId}`, JSON.stringify(updated)) } catch {}
    if (updated.length >= 5) setShowNCSuggest(true)
  }

  const clearCallAttempts = () => {
    setCallAttempts([])
    setShowNCSuggest(false)
    try { localStorage.removeItem(`call_attempts_${leadId}`) } catch {}
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
      <div className="max-w-[1200px] mx-auto px-4 pb-24 lg:px-6">

        {/* ── Breadcrumb ── */}
        <div style={{ padding: '16px 0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '-0.5px' }}>{name}</h1>
                <button
                  title="Copy lead ID"
                  onClick={() => navigator.clipboard.writeText(getCsId(lead))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 7, fontFamily: 'monospace', letterSpacing: '0.06em', cursor: 'pointer' }}
                >
                  {getCsId(lead)}<Copy style={{ width: 11, height: 11, opacity: 0.5 }} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ss.color, background: ss.bg, padding: '3px 10px', borderRadius: 20 }}>
                  {ss.label}
                </span>
                {/* Client type badge */}
                {lead.sourceDetail?.startsWith('[') && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE', padding: '3px 10px', borderRadius: 20 }}>
                    {lead.sourceDetail.match(/^\[([^\]]+)\]/)?.[1]}
                  </span>
                )}
                {lead.sourcePortal && (
                  <span style={{ fontSize: 11, color: MUTED, background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20 }}>
                    via {lead.sourcePortal}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">

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

            {/* Lifecycle Stage */}
            <Card style={{ overflow: 'visible' }}>
              <CardHeader title="Lead Lifecycle" icon={TrendingUp} />
              <div style={{ padding: 16 }}>
                {/* Current stage pill + dropdown */}
                {(() => {
                  const cur = LIFECYCLE_STAGES.find(s => s.id === (lead.status || 'Fresh')) ?? LIFECYCLE_STAGES[0]
                  return (
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setShowStageMenu(v => !v)} disabled={stageChanging}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: `${cur.color}10`, border: `1px solid ${cur.color}40`, borderRadius: 10, color: cur.color, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cur.color, display: 'inline-block', flexShrink: 0 }} />
                          {stageChanging ? 'Updating…' : cur.label}
                        </span>
                        <ChevronDown style={{ width: 14, height: 14 }} />
                      </button>
                      {!stageChanging && <p style={{ fontSize: 11, color: MUTED, margin: '6px 0 0 4px' }}>{cur.desc}</p>}
                      {showStageMenu && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, zIndex: 20, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.12)' }}>
                          {STAGE_BUCKETS.map(bucket => (
                            <div key={bucket.label}>
                              {/* Bucket group header */}
                              <div style={{ padding: '7px 14px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: bucket.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: bucket.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{bucket.label}</span>
                              </div>
                              {/* Stages in this bucket */}
                              {bucket.stages.map(sid => {
                                const s = LIFECYCLE_STAGES.find(x => x.id === sid)
                                if (!s) return null
                                const isActive = lead.status === s.id
                                return (
                                  <button key={s.id} onClick={() => handleStageChange(s.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 14px 7px 28px', background: isActive ? `${s.color}0D` : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? s.color : TEXT }}>{s.label}</div>
                                      <div style={{ fontSize: 10, color: MUTED }}>{s.desc}</div>
                                    </div>
                                    {isActive && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: s.color }}>✓</span>}
                                  </button>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Journey progress bar — non-terminal stages only */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {LIFECYCLE_STAGES.filter(s => !s.terminal).map((s) => {
                      const stages   = LIFECYCLE_STAGES.filter(x => !x.terminal)
                      const curIdx   = stages.findIndex(x => x.id === (lead.status || 'Fresh'))
                      const thisIdx  = stages.indexOf(s)
                      const isDone   = thisIdx <= curIdx
                      return (
                        <div key={s.id} title={s.label} style={{ flex: 1, height: 4, borderRadius: 2, background: isDone ? s.color : BORDER, transition: 'background 0.3s' }} />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: MUTED }}>New Leads</span>
                    <span style={{ fontSize: 10, color: MUTED }}>Hot Stage</span>
                  </div>
                </div>

                {/* Terminal state badges */}
                {['Won','Lost','NC'].includes(lead.status ?? '') && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `${LIFECYCLE_STAGES.find(s=>s.id===lead.status)?.color}10`, border: `1px solid ${LIFECYCLE_STAGES.find(s=>s.id===lead.status)?.color}30` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: LIFECYCLE_STAGES.find(s=>s.id===lead.status)?.color }}>
                      {lead.status === 'Won' ? '🏆 Closed — Deal Done' : lead.status === 'Lost' ? '❌ Lost — Not Proceeding' : '📵 NC — Non-Contactable'}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Call Attempt Tracker */}
            <Card>
              <CardHeader title="Call Attempts" icon={PhoneOff}
                action={
                  <span style={{ fontSize: 11, fontWeight: 700, color: callAttempts.length >= 5 ? '#DC2626' : callAttempts.length >= 3 ? '#D97706' : MUTED, background: callAttempts.length >= 5 ? '#FEF2F2' : callAttempts.length >= 3 ? '#FFFBEB' : '#F1F5F9', padding: '2px 8px', borderRadius: 10 }}>
                    {callAttempts.length}/5
                  </span>
                }
              />
              <div style={{ padding: 16 }}>
                {/* Attempt dots */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {[1,2,3,4,5].map(n => (
                    <div key={n} style={{ flex: 1, height: 6, borderRadius: 3, background: n <= callAttempts.length ? (n >= 5 ? '#DC2626' : n >= 3 ? '#D97706' : '#2563EB') : BORDER }} />
                  ))}
                </div>

                {callAttempts.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {callAttempts.slice(-3).map((ts, i) => (
                      <div key={i} style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>
                        Attempt {callAttempts.length - (Math.min(3, callAttempts.length) - 1 - i)} — {new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ))}
                  </div>
                )}

                {/* NC suggestion */}
                {showNCSuggest && (
                  <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, marginBottom: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', margin: '0 0 6px' }}>📵 5 failed attempts</p>
                    <p style={{ fontSize: 11, color: '#991B1B', margin: '0 0 8px' }}>Move this lead to NC — a re-engagement sequence will auto-trigger in 7 days.</p>
                    <button onClick={() => { handleStageChange('NC'); setShowNCSuggest(false) }}
                      style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer' }}>
                      Move to NC
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={logCallAttempt} disabled={callAttempts.length >= 5}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', background: callAttempts.length >= 5 ? '#F1F5F9' : 'rgba(239,68,68,0.06)', border: `1px solid ${callAttempts.length >= 5 ? BORDER : 'rgba(239,68,68,0.2)'}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: callAttempts.length >= 5 ? MUTED : '#DC2626', cursor: callAttempts.length >= 5 ? 'not-allowed' : 'pointer' }}>
                    <PhoneOff style={{ width: 12, height: 12 }} /> Log No-Answer
                  </button>
                  {callAttempts.length > 0 && (
                    <button onClick={clearCallAttempts}
                      style={{ padding: '9px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 12, color: MUTED, cursor: 'pointer' }}>
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </Card>

            {/* Active Sequences */}
            <Card>
              <CardHeader
                title="Sequences"
                icon={Zap}
                action={
                  <button onClick={() => setShowSequenceModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#7C3AED', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                    <Plus style={{ width: 11, height: 11 }} /> Enroll
                  </button>
                }
              />
              <div style={{ padding: '8px 0' }}>
                {enrollments.length === 0 && (
                  <p style={{ fontSize: 12, color: MUTED, padding: '10px 20px', margin: 0 }}>Not enrolled in any sequence.</p>
                )}
                {enrollments.map(en => {
                  const seq  = en.sequences
                  const total = seq?.sequence_steps?.length ?? 0
                  const step  = Math.min(en.current_step + 1, total)
                  const active = en.status === 'active'
                  const statusColor = active ? '#059669' : en.status === 'completed' ? '#2563EB' : '#64748B'
                  return (
                    <div key={en.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 20px', borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? 'rgba(5,150,105,0.08)' : 'rgba(100,116,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <Zap style={{ width: 13, height: 13, color: statusColor }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seq?.name ?? 'Unknown'}</p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: active ? 'rgba(5,150,105,0.1)' : 'rgba(100,116,139,0.08)', color: statusColor }}>
                            {en.status}
                          </span>
                          {total > 0 && (
                            <span style={{ fontSize: 10, color: MUTED }}>Step {step}/{total}</span>
                          )}
                        </div>
                        {/* Mini step progress */}
                        {total > 0 && (
                          <div style={{ display: 'flex', gap: 2, marginTop: 5 }}>
                            {Array.from({ length: total }).map((_, i) => (
                              <div key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: i < step ? '#7C3AED' : BORDER }} />
                            ))}
                          </div>
                        )}
                      </div>
                      {(active || en.status === 'paused') && (
                        <button
                          onClick={() => handleCancelEnrollment(en.id)}
                          disabled={cancellingId === en.id}
                          title="Cancel enrollment"
                          style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X style={{ width: 10, height: 10 }} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Lead details */}
            <Card>
              <CardHeader title="Lead Details" icon={Tag} />
              <div style={{ padding: '4px 20px 8px' }}>
                <InfoRow label="Lead ID" value={lead.leadPortalId ?? undefined} />
                <InfoRow label="Source portal" value={lead.sourcePortal} />
                {lead.sourceDetail && !lead.sourceDetail.startsWith('[') && (
                  <InfoRow label="Source detail" value={lead.sourceDetail} />
                )}
                {lead.sourceDetail?.startsWith('[') && lead.sourceDetail.includes(']') && lead.sourceDetail.split(']')[1]?.trim() && (
                  <InfoRow label="Source detail" value={lead.sourceDetail.split(']').slice(1).join(']').trim()} />
                )}
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
        onEnrolled={() => { setShowSequenceModal(false); fetchEnrollments() }}
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
