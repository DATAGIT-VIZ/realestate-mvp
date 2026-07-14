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
import {
  ArrowLeft, Phone, Mail, MapPin, Clock, Tag,
  TrendingUp, Calendar, Trash2, Loader2, Activity,
  AlertCircle, Plus, MessageCircle, CheckCircle, XCircle,
  MinusCircle, HelpCircle, ChevronDown, User, PhoneOff, Copy, Send,
  Zap, Bell, Award,
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#F4F6FA'
const PANEL   = '#FFFFFF'
const BORDER  = '#E8EDF2'
const BLUE         = '#a000c8'
const PRIMARY_DIM  = 'rgba(160,0,200,0.08)'
const PRIMARY_BORDER = 'rgba(160,0,200,0.25)'
const PRIMARY_GRAD = 'linear-gradient(135deg, #7600bc 0%, #b100cd 100%)'
const EMERALD = '#059669'
const RED     = '#DC2626'
const AMBER   = '#be2ed6'
const TEXT    = '#0F172A'
const MUTED   = '#64748B'
const MUTED2  = '#334155'
const WA_GRN  = '#16A34A'

const ACT_COLORS: Record<string, { icon: string; bg: string; accent: string }> = {
  'Call Made':            { icon: '#059669', bg: '#ECFDF5', accent: '#059669' },
  'Call Missed':          { icon: '#DC2626', bg: '#FEF2F2', accent: '#DC2626' },
  'WhatsApp Sent':        { icon: WA_GRN,   bg: '#F0FDF4', accent: WA_GRN    },
  'WhatsApp Received':    { icon: WA_GRN,   bg: '#F0FDF4', accent: WA_GRN    },
  'Email Sent':           { icon: '#a000c8', bg: PRIMARY_DIM, accent: '#a000c8' },
  'Email Received':       { icon: '#a000c8', bg: PRIMARY_DIM, accent: '#a000c8' },
  'Site Visit Scheduled': { icon: '#be2ed6', bg: 'rgba(190,46,214,0.07)', accent: '#be2ed6' },
  'Site Visit Done':      { icon: '#a000c8', bg: 'rgba(160,0,200,0.07)', accent: '#a000c8' },
  'Follow Up Set':        { icon: '#be2ed6', bg: 'rgba(190,46,214,0.07)', accent: '#be2ed6' },
  'Note':                 { icon: BLUE,      bg: PRIMARY_DIM, accent: BLUE    },
  'Status Changed':       { icon: '#a000c8', bg: PRIMARY_DIM, accent: '#a000c8' },
}

// ─── Types ────────────────────────────────────────────────────────────────────
type LeadActivity = {
  id: string; type: string; createdAt: string
  notes?: string | null; outcome?: string | null
  duration?: number | null; nextActionDate?: string | null
}
type ActivityTab = 'all' | 'calls' | 'whatsapp' | 'notes'
type LeftTab     = 'info' | 'requirements'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCsId(lead: CRMLead): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
}
const getDisplayName = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed Lead'
const getInitials    = (l: CRMLead) => [l.name.firstName[0], l.name.lastName[0]].filter(Boolean).join('').toUpperCase() || '?'
const getPhone       = (l: CRMLead) => l.phones.primaryPhoneNumber ?? ''
const getEmail       = (l: CRMLead) => l.emails.primaryEmail ?? ''
const getScore       = (l: CRMLead) => l.intentScore ?? 0

function formatBudget(min: number | null, max: number | null): string {
  const fmt = (n: number) => n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(1)}Cr` : `${+(n / 100_000).toFixed(1)}L`
  if (min && max) return `₹${fmt(min)} – ₹${fmt(max)}`
  if (min) return `₹${fmt(min)}+`
  if (max) return `Up to ₹${fmt(max)}`
  return '—'
}
function timeAgo(d: string) {
  const s = Date.now() - new Date(d).getTime()
  const m = Math.floor(s / 60_000), h = Math.floor(m / 60), dy = Math.floor(h / 24)
  if (dy > 0) return `${dy}d ago`; if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`; return 'Just now'
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatShortDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function scoreStyle(score: number) {
  if (score >= 70) return { label: 'High Intent', color: '#a000c8', ring: '#a000c8', bg: 'rgba(160,0,200,0.07)' }
  if (score >= 40) return { label: 'Medium',      color: '#8a00c2', ring: '#be2ed6', bg: 'rgba(190,46,214,0.07)' }
  return               { label: 'Low',            color: '#64748B', ring: '#CBD5E1', bg: '#F1F5F9' }
}
function scoreBreakdown(l: CRMLead) {
  const ph = getPhone(l), em = getEmail(l)
  const t = (l.timeline ?? '').toLowerCase()
  const urgency = t.includes('immediate') || t.includes('1 month') ? 'Immediate'
    : t.includes('1–3') || t.includes('3 month') ? 'Within 3m'
    : t.includes('6') ? 'Within 6m' : t ? 'Long-term' : 'Unknown'
  const s = (l.sourcePortal ?? '').toLowerCase()
  const srcQ = s.includes('website') || s.includes('referral') ? 'Premium'
    : s.includes('magicbricks') || s.includes('99acres') || s.includes('housing') ? 'Portal'
    : s.includes('facebook') || s.includes('google') ? 'Paid Ads' : s ? 'Other' : 'Unknown'
  return [
    { label: 'Phone',    value: ph ? 'Provided'  : 'Missing', pos: !!ph },
    { label: 'Email',    value: em ? 'Provided'  : 'Missing', pos: !!em },
    { label: 'Budget',   value: (l.budgetMin || l.budgetMax) ? formatBudget(l.budgetMin, l.budgetMax) : 'Not set', pos: !!(l.budgetMin || l.budgetMax) },
    { label: 'Timeline', value: urgency,                      pos: urgency !== 'Unknown' && urgency !== 'Long-term' },
    { label: 'Source',   value: srcQ,                         pos: srcQ === 'Premium' || srcQ === 'Portal' },
  ]
}

const OUTCOME_CFG: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  'Positive':    { Icon: CheckCircle, color: '#059669', bg: '#ECFDF5' },
  'Neutral':     { Icon: MinusCircle, color: '#64748B', bg: '#F1F5F9' },
  'Negative':    { Icon: XCircle,     color: '#DC2626', bg: '#FEF2F2' },
  'No Response': { Icon: HelpCircle,  color: '#8a00c2', bg: 'rgba(190,46,214,0.07)' },
}
const ACT_ICON: Record<string, React.ElementType> = {
  'Call Made': Phone, 'Call Missed': Phone, 'WhatsApp Sent': MessageCircle,
  'WhatsApp Received': MessageCircle, 'Email Sent': Mail, 'Email Received': Mail,
  'Site Visit Scheduled': Calendar, 'Site Visit Done': MapPin, 'Follow Up Set': Clock,
  'Note': Tag, 'Status Changed': TrendingUp,
}

const STAGES = [
  { id: 'New',          label: 'New',          color: '#64748B', desc: 'Unworked — just assigned',            terminal: false },
  { id: 'Cold',         label: 'Cold',         color: '#2563EB', desc: 'Calls / WhatsApp only, no engagement', terminal: false },
  { id: 'Warm',         label: 'Warm',         color: '#be2ed6', desc: 'VM / OBM / SV done or docs requested', terminal: false },
  { id: 'Hot',          label: 'Hot',          color: '#a000c8', desc: 'EOI received — high intent to book',   terminal: false },
  { id: 'Closed',       label: 'Closed',       color: '#059669', desc: 'Deal closed — EOI paid',               terminal: true  },
  { id: 'Disqualified', label: 'Disqualified', color: '#94A3B8', desc: 'Not proceeding — NC or rejected',      terminal: true  },
]
const BUCKETS = [
  { label: 'New',          color: '#64748B', stages: ['New']          },
  { label: 'Cold',         color: '#2563EB', stages: ['Cold']         },
  { label: 'Warm',         color: '#be2ed6', stages: ['Warm']         },
  { label: 'Hot',          color: '#a000c8', stages: ['Hot']          },
  { label: 'Closed',       color: '#059669', stages: ['Closed']       },
  { label: 'Disqualified', color: '#94A3B8', stages: ['Disqualified'] },
]

// ─── Shared sub-components ────────────────────────────────────────────────────
function SideCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', ...style }}>
      {children}
    </div>
  )
}
function SideCardHeader({ title, icon: Icon, action }: { title: string; icon: React.ElementType; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${BORDER}` }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
        <Icon style={{ width: 11, height: 11 }} />{title}
      </h3>
      {action}
    </div>
  )
}

// Activity card used in multiple tabs
function ActivityCard({ act }: { act: LeadActivity }) {
  const AIcon = ACT_ICON[act.type] ?? Activity
  const ac    = ACT_COLORS[act.type] ?? { icon: '#64748B', bg: '#F8FAFC', accent: '#64748B' }
  const oc    = act.outcome ? OUTCOME_CFG[act.outcome] : null
  const OIcon = oc?.Icon
  return (
    <div style={{ marginBottom: 8, padding: '12px 14px', background: '#FAFBFC', borderTop: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${ac.accent}`, borderRadius: '0 10px 10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: oc || act.notes || act.duration || act.nextActionDate ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AIcon style={{ width: 13, height: 13, color: ac.icon }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{act.type}</span>
        </div>
        <span style={{ fontSize: 11, color: MUTED, background: PANEL, border: `1px solid ${BORDER}`, padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
          {timeAgo(act.createdAt)}
        </span>
      </div>
      {oc && OIcon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: oc.color, background: oc.bg, padding: '2px 8px', borderRadius: 6, marginBottom: act.notes || act.duration || act.nextActionDate ? 6 : 0 }}>
          <OIcon style={{ width: 10, height: 10 }} />{act.outcome}
        </span>
      )}
      {act.notes && <p style={{ fontSize: 13, color: MUTED2, margin: '0 0 6px', lineHeight: 1.55 }}>{act.notes}</p>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {act.duration && (
          <span style={{ fontSize: 11, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock style={{ width: 10, height: 10 }} />{Math.floor(act.duration / 60)}m {act.duration % 60}s
          </span>
        )}
        {act.nextActionDate && (
          <span style={{ fontSize: 11, color: BLUE, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
            <Calendar style={{ width: 10, height: 10 }} />Follow up: {formatDate(act.nextActionDate)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LeadDetailPage() {
  const router = useRouter()
  const { id: leadId } = useParams() as { id: string }

  const [lead, setLead]             = useState<CRMLead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showCallModal, setShowCallModal]         = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [stageChanging, setStageChanging] = useState(false)
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [callAttempts, setCallAttempts]   = useState<string[]>([])
  const [showNCSuggest, setShowNCSuggest] = useState(false)
  const [activeTab, setActiveTab]   = useState<ActivityTab>('all')
  const [leftTab, setLeftTab]       = useState<LeftTab>('info')
  const [quickNote, setQuickNote]   = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetch(`/api/crm/leads/${leadId}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setLead(json.data.lead); setActivities(json.data.activities ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load lead') }
    finally { setLoading(false) }
  }, [leadId])

  useEffect(() => { fetchLead() }, [fetchLead])

  const handleStageChange = async (stage: string) => {
    if (!lead) return
    setShowStageMenu(false); setStageChanging(true)
    try {
      await fetch(`/api/crm/leads/${leadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: stage }) })
      setLead(p => p ? { ...p, status: stage } : p)
    } finally { setStageChanging(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await fetch(`/api/crm/leads/${leadId}`, { method: 'DELETE' }); router.push('/dashboard/leads') }
    catch { setDeleting(false) }
  }

  useEffect(() => {
    try { const s = localStorage.getItem(`call_attempts_${leadId}`); if (s) setCallAttempts(JSON.parse(s)) } catch {}
  }, [leadId])

  const logCallAttempt = () => {
    const u = [...callAttempts, new Date().toISOString()]; setCallAttempts(u)
    try { localStorage.setItem(`call_attempts_${leadId}`, JSON.stringify(u)) } catch {}
    if (u.length >= 5) setShowNCSuggest(true)
  }
  const clearCallAttempts = () => {
    setCallAttempts([]); setShowNCSuggest(false)
    try { localStorage.removeItem(`call_attempts_${leadId}`) } catch {}
  }
  const saveQuickNote = async () => {
    if (!quickNote.trim() || savingNote) return
    setSavingNote(true)
    try {
      await fetch(`/api/crm/leads/${leadId}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'Note', notes: quickNote.trim() }) })
      setQuickNote(''); await fetchLead()
    } catch {} finally { setSavingNote(false) }
  }
  const copyCsId = () => {
    if (!lead) return
    navigator.clipboard.writeText(getCsId(lead)); setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Loader2 style={{ width: 22, height: 22, color: BLUE, animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14, color: MUTED }}>Loading lead…</span>
    </div>
  )
  if (error || !lead) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <AlertCircle style={{ width: 40, height: 40, color: RED, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: TEXT, margin: '0 0 8px' }}>{error || 'Lead not found'}</h2>
        <Link href="/dashboard/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Back to Leads
        </Link>
      </div>
    </div>
  )

  const score   = getScore(lead)
  const ss      = scoreStyle(score)
  const name    = getDisplayName(lead)
  const phone   = getPhone(lead)
  const email   = getEmail(lead)
  const bdown   = scoreBreakdown(lead)
  const initials = getInitials(lead)

  const lastAct    = activities[0] ?? null
  const nextFU     = activities.find(a => a.nextActionDate)?.nextActionDate ?? null
  const futureFU   = nextFU && new Date(nextFU) > new Date() ? nextFU : null
  const daysInPipe = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86_400_000)
  const daysSince  = lastAct ? Math.floor((Date.now() - new Date(lastAct.createdAt).getTime()) / 86_400_000) : null

  // ── Last-achieved milestone ──────────────────────────────────────────────────
  const MILESTONE_STATUS: Record<string, string> = {
    'Deal Closed': 'Closed', 'EOI Received': 'Hot',
    'Site Visit Done': 'Warm', 'OBM Done': 'Warm', 'VM Done': 'Warm',
  }
  const MILESTONE_COLOR: Record<string, string> = {
    Closed: '#059669', Hot: '#a000c8', Warm: '#be2ed6',
  }
  const activityTypes = activities.map(a => a.type)
  const topMilestone  = ['Deal Closed', 'EOI Received', 'Site Visit Done', 'OBM Done', 'VM Done']
    .find(m => activityTypes.includes(m)) ?? null
  const achievedStage = topMilestone ? MILESTONE_STATUS[topMilestone] : null

  // ── Status transition markers (simulate lifecycle engine client-side) ─────────
  const STATUS_ADV_CLIENT: Record<string, string> = {
    'Call Made': 'Cold', 'Call Missed': 'Cold', 'WhatsApp Sent': 'Cold',
    'WhatsApp Received': 'Cold', 'Email Sent': 'Cold',
    'VM Done': 'Warm', 'OBM Done': 'Warm', 'Site Visit Done': 'Warm',
    'EOI Received': 'Hot', 'Deal Closed': 'Closed',
  }
  const SIM_ORDER = ['New', 'Cold', 'Warm', 'Hot', 'Closed']
  const statusMarkers = new Map<string, string>()
  {
    let sim = 'New'
    const chrono = [...activities].reverse()
    for (const act of chrono) {
      const target = STATUS_ADV_CLIENT[act.type]
      if (target) {
        const ci = SIM_ORDER.indexOf(sim), ti = SIM_ORDER.indexOf(target)
        if (ti > ci) { statusMarkers.set(act.id, target); sim = target }
      }
    }
  }

  // ── Tab data ────────────────────────────────────────────────────────────────
  const callActs = activities.filter(a => a.type.toLowerCase().includes('call'))
  const waActs   = activities.filter(a => a.type.toLowerCase().includes('whatsapp'))
  const noteActs = activities.filter(a => a.type === 'Note')
  const tabCounts: Record<ActivityTab, number> = {
    all: activities.length, calls: callActs.length, whatsapp: waActs.length, notes: noteActs.length,
  }
  const callStats = {
    total:      callActs.length,
    connected:  callActs.filter(a => a.outcome === 'Positive').length,
    missed:     callActs.filter(a => a.type === 'Call Missed').length,
    noResponse: callActs.filter(a => a.outcome === 'No Response').length,
  }

  // ── Smart nudge ─────────────────────────────────────────────────────────────
  type NudgeType = { icon: React.ElementType; color: string; bg: string; border: string; text: string; sub: string; actionLabel: string; onAction: () => void }
  let nudge: NudgeType | null = null
  if (!nudgeDismissed) {
    if (futureFU) {
      const daysUntil = Math.ceil((new Date(futureFU).getTime() - Date.now()) / 86_400_000)
      if (daysUntil <= 2) nudge = { icon: Bell, color: AMBER, bg: 'rgba(190,46,214,0.07)', border: 'rgba(190,46,214,0.25)', text: `Follow-up ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : 'in 2 days'}`, sub: `Scheduled on ${formatShortDate(futureFU)} — log the outcome when done`, actionLabel: 'Log Outcome', onAction: () => setShowActivityModal(true) }
    } else if (activities.length === 0) {
      nudge = { icon: Zap, color: BLUE, bg: PRIMARY_DIM, border: PRIMARY_BORDER, text: 'Make your first move', sub: 'This lead hasn\'t been contacted yet — a quick call increases conversion by 3×', actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (score >= 70 && ['New', 'Cold'].includes(lead.status || 'New')) {
      nudge = { icon: Zap, color: '#a000c8', bg: 'rgba(160,0,200,0.07)', border: 'rgba(160,0,200,0.2)', text: 'High intent — move fast', sub: `Score ${score}/100 but still in early stage. Don't let a hot lead go cold`, actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (callAttempts.length >= 2 && lastAct?.type.includes('Call') && lastAct?.outcome === 'No Response') {
      nudge = { icon: MessageCircle, color: WA_GRN, bg: '#F0FDF4', border: '#BBF7D0', text: 'Switch to WhatsApp', sub: `${callAttempts.length} calls with no answer — leads respond 4× faster to messages`, actionLabel: 'Send WA', onAction: () => setShowWhatsAppModal(true) }
    } else if (daysSince !== null && daysSince >= 7) {
      nudge = { icon: AlertCircle, color: RED, bg: '#FEF2F2', border: '#FECACA', text: `No contact in ${daysSince} days`, sub: 'Lead is going cold — reach out now before they look elsewhere', actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (daysSince !== null && daysSince >= 3) {
      nudge = { icon: Bell, color: AMBER, bg: 'rgba(190,46,214,0.07)', border: 'rgba(190,46,214,0.25)', text: `${daysSince} days since last contact`, sub: 'A quick touchpoint now keeps the lead warm and moving', actionLabel: 'Log Activity', onAction: () => setShowActivityModal(true) }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div className="max-w-[1320px] mx-auto px-4 pb-16 lg:px-6">

        {/* Breadcrumb */}
        <div style={{ padding: '16px 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/dashboard/leads" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED, textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> All Leads
          </Link>
          <span style={{ fontSize: 12, color: '#CBD5E1' }}>/</span>
          <span style={{ fontSize: 13, color: MUTED2, fontWeight: 500 }}>{name}</span>
        </div>

        {/* ── 3-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 290px', gap: 16, alignItems: 'start' }}
          className="grid-cols-1 lg:grid-flow-col">

          {/* ══════════════════════════════════════════════════
              LEFT — Profile Panel
          ══════════════════════════════════════════════════ */}
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

            {/* Avatar + Identity */}
            <div style={{ padding: '24px 20px 16px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: ss.bg, border: `3px solid ${ss.ring}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', position: 'relative' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: ss.color, letterSpacing: '-1px' }}>{initials}</span>
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: ss.ring, border: '2px solid white' }} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: TEXT, margin: '0 0 6px', letterSpacing: '-0.3px' }}>{name}</h2>
              <button onClick={copyCsId}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: copied ? EMERALD : '#64748B', background: copied ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${copied ? '#A7F3D0' : '#E2E8F0'}`, padding: '3px 10px', borderRadius: 6, fontFamily: 'monospace', cursor: 'pointer', marginBottom: 10, transition: 'all 0.15s' }}>
                {copied ? '✓ Copied' : <>{getCsId(lead)}<Copy style={{ width: 9, height: 9, opacity: 0.5 }} /></>}
              </button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap', marginBottom: achievedStage ? 8 : 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ss.color, background: ss.bg, padding: '3px 10px', borderRadius: 20 }}>{ss.label}</span>
                {lead.sourceDetail?.startsWith('[') && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8a00c2', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, padding: '3px 10px', borderRadius: 20 }}>
                    {lead.sourceDetail.match(/^\[([^\]]+)\]/)?.[1]}
                  </span>
                )}
              </div>
              {achievedStage && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: MILESTONE_COLOR[achievedStage] ?? MUTED, background: `${MILESTONE_COLOR[achievedStage] ?? MUTED}12`, border: `1px solid ${MILESTONE_COLOR[achievedStage] ?? MUTED}30`, padding: '3px 10px', borderRadius: 20 }}>
                    <Award style={{ width: 10, height: 10 }} />Reached {achievedStage} · {topMilestone}
                  </span>
                </div>
              )}
              {/* Score bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>Intent Score</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: ss.color }}>{score}/100</span>
                </div>
                <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3 }}>
                  <div style={{ width: `${score}%`, height: '100%', background: ss.ring, borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: MUTED, margin: '10px 0 2px' }}>
                {lastAct ? <>● Last: <strong style={{ color: MUTED2 }}>{timeAgo(lastAct.createdAt)}</strong></> : '● No contact yet'}
              </p>
              {daysInPipe > 0 && <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>● In pipeline: <strong style={{ color: MUTED2 }}>{daysInPipe}d</strong></p>}
            </div>

            {/* Quick actions */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
              {/* Primary call CTA */}
              {phone && (
                <button onClick={() => setShowCallModal(true)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', background: 'linear-gradient(135deg,#059669,#047857)', border: 'none', borderRadius: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8, boxShadow: '0 2px 8px rgba(5,150,105,0.35)', position: 'relative', overflow: 'hidden' }}>
                  <Phone style={{ width: 15, height: 15 }} />
                  Call {lead.name.firstName || 'Lead'}
                  <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 500, marginLeft: 2 }}>{phone}</span>
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 7, marginBottom: 10 }}>
                {[
                  { icon: Activity,      label: 'Log',    onClick: () => setShowActivityModal(true), danger: false, show: true },
                  { icon: MessageCircle, label: 'WA',     onClick: () => setShowWhatsAppModal(true), danger: false, show: !!phone },
                  { icon: Trash2,        label: 'Delete', onClick: () => setShowDeleteConfirm(true), danger: true,  show: true },
                ].filter(b => b.show).map(btn => {
                  const BIcon = btn.icon
                  return (
                    <button key={btn.label} onClick={btn.onClick}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '9px 4px', background: btn.danger ? 'rgba(239,68,68,0.06)' : '#F8FAFC', border: `1px solid ${btn.danger ? 'rgba(239,68,68,0.15)' : BORDER}`, borderRadius: 10, cursor: 'pointer' }}>
                      <BIcon style={{ width: 15, height: 15, color: btn.danger ? RED : MUTED }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: btn.danger ? RED : MUTED }}>{btn.label}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setShowActivityModal(true)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: PRIMARY_GRAD, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Plus style={{ width: 14, height: 14 }} />Log Activity
              </button>
            </div>

            {/* Info tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
              {(['info', 'requirements'] as LeftTab[]).map(tab => (
                <button key={tab} onClick={() => setLeftTab(tab)}
                  style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600, color: leftTab === tab ? BLUE : MUTED, background: leftTab === tab ? PRIMARY_DIM : 'transparent', border: 'none', borderBottom: leftTab === tab ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer' }}>
                  {tab === 'info' ? 'Lead Info' : 'Requirements'}
                </button>
              ))}
            </div>

            {/* Lead Info */}
            {leftTab === 'info' && (
              <div style={{ padding: '4px 16px 12px' }}>
                {[
                  { icon: Mail,     label: 'Email',  value: email || null, href: email ? `mailto:${email}` : undefined },
                  { icon: Phone,    label: 'Phone',  value: phone || null, href: phone ? `tel:${phone}` : undefined },
                  { icon: MapPin,   label: 'City',   value: lead.city     },
                  { icon: Tag,      label: 'Source', value: lead.sourcePortal },
                  { icon: Calendar, label: 'Added',  value: formatDate(lead.createdAt) },
                ].map(row => {
                  const RowIcon = row.icon
                  return (
                    <div key={row.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <RowIcon style={{ width: 13, height: 13, color: '#94A3B8', marginTop: 3, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{row.label}</div>
                        {row.href
                          ? <a href={row.href} style={{ fontSize: 12, color: BLUE, textDecoration: 'none', wordBreak: 'break-all' }}>{row.value}</a>
                          : <span style={{ fontSize: 12, color: row.value ? MUTED2 : MUTED }}>{row.value || '—'}</span>
                        }
                      </div>
                    </div>
                  )
                })}
                {lead.localities && lead.localities.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
                    <MapPin style={{ width: 13, height: 13, color: '#94A3B8', marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 5 }}>Localities</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {lead.localities.map(l => <span key={l} style={{ fontSize: 10, fontWeight: 600, color: '#8a00c2', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, padding: '2px 7px', borderRadius: 5 }}>{l}</span>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Requirements */}
            {leftTab === 'requirements' && (
              <div style={{ padding: '12px 16px' }}>
                {lead.propertyType && lead.propertyType.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6 }}>Property Type</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {lead.propertyType.map(pt => <span key={pt} style={{ fontSize: 11, fontWeight: 700, color: '#7600bc', background: 'rgba(190,46,214,0.07)', border: '1px solid rgba(190,46,214,0.25)', padding: '3px 9px', borderRadius: 6 }}>{pt}</span>)}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: 12, padding: '10px 12px', background: '#F8FAFC', borderRadius: 10, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 3 }}>Budget</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: formatBudget(lead.budgetMin, lead.budgetMax) !== '—' ? EMERALD : MUTED, letterSpacing: '-0.3px' }}>
                    {formatBudget(lead.budgetMin, lead.budgetMax)}
                  </div>
                </div>
                {[{ label: 'Timeline', value: lead.timeline }, { label: 'Status', value: lead.status }].map((r, i, a) => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: `1px solid ${BORDER}`, borderBottom: i === a.length - 1 ? 'none' : undefined }}>
                    <span style={{ fontSize: 11, color: MUTED }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.value ? MUTED2 : MUTED }}>{r.value || '—'}</span>
                  </div>
                ))}
                {lead.localities && lead.localities.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6 }}>Preferred Areas</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {lead.localities.map(l => <span key={l} style={{ fontSize: 10, fontWeight: 600, color: '#8a00c2', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, padding: '2px 7px', borderRadius: 5 }}>{l}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════
              CENTER — Activity Feed
          ══════════════════════════════════════════════════ */}
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', minHeight: 560 }}>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC', flexShrink: 0 }}>
              {([
                { key: 'all',      label: 'Activity'  },
                { key: 'notes',    label: 'Notes'     },
                { key: 'calls',    label: 'Calls'     },
                { key: 'whatsapp', label: 'WhatsApp'  },
              ] as { key: ActivityTab; label: string }[]).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '12px 16px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? BLUE : MUTED, background: 'transparent', border: 'none', borderBottom: activeTab === tab.key ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer' }}>
                  {tab.label}
                  {tabCounts[tab.key] > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: activeTab === tab.key ? '#7600bc' : '#94A3B8', background: activeTab === tab.key ? PRIMARY_DIM : '#F1F5F9', padding: '1px 6px', borderRadius: 10 }}>
                      {tabCounts[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Smart Nudge Bar */}
            {nudge && activeTab === 'all' && (
              <div style={{ margin: '12px 16px 0', padding: '12px 14px', background: nudge.bg, border: `1px solid ${nudge.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${nudge.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <nudge.icon style={{ width: 16, height: 16, color: nudge.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{nudge.text}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{nudge.sub}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={nudge.onAction}
                    style={{ padding: '6px 12px', background: nudge.color, border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {nudge.actionLabel}
                  </button>
                  <button onClick={() => setNudgeDismissed(true)}
                    style={{ padding: '6px 8px', background: 'transparent', border: `1px solid ${nudge.border}`, borderRadius: 8, color: MUTED, fontSize: 11, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* ── ALL tab ─────────────────────────────────────────────────── */}
            {activeTab === 'all' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: MUTED }}>{activities.length} {activities.length === 1 ? 'activity' : 'activities'}</span>
                  <button onClick={() => setShowActivityModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, borderRadius: 8, color: BLUE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    <Plus style={{ width: 12, height: 12 }} />Create activity
                  </button>
                </div>
                {/* Quick note input */}
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveQuickNote() }}
                      placeholder="Add a quick note… (⌘+Enter to save)"
                      rows={quickNote ? 3 : 1}
                      style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: TEXT, background: '#F8FAFC', resize: 'none', outline: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }} />
                    {quickNote.trim() && (
                      <button onClick={saveQuickNote} disabled={savingNote}
                        style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: savingNote ? 'not-allowed' : 'pointer', opacity: savingNote ? 0.7 : 1 }}>
                        {savingNote ? <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 11, height: 11 }} />}
                        Save
                      </button>
                    )}
                  </div>
                </div>
                {/* Activity list */}
                <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
                  {activities.length === 0
                    ? <EmptyState icon={Clock} title="No activities yet" sub="Log a call, note, or WhatsApp to get started" action={{ label: 'Log first activity', onClick: () => setShowActivityModal(true) }} />
                    : activities.map(act => {
                        const advancedTo = statusMarkers.get(act.id)
                        const advColor = advancedTo ? ({ New: '#64748B', Cold: '#2563EB', Warm: '#be2ed6', Hot: '#a000c8', Closed: '#059669', Disqualified: '#94A3B8' } as Record<string, string>)[advancedTo] ?? '#64748B' : null
                        return (
                          <div key={act.id}>
                            <ActivityCard act={act} />
                            {advancedTo && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0 8px', margin: '0 0 4px' }}>
                                <div style={{ flex: 1, height: 1, background: `${advColor}30` }} />
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: advColor!, background: `${advColor}12`, border: `1px solid ${advColor}30`, padding: '2px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                                  <TrendingUp style={{ width: 9, height: 9 }} /> Moved to {advancedTo}
                                </span>
                                <div style={{ flex: 1, height: 1, background: `${advColor}30` }} />
                              </div>
                            )}
                          </div>
                        )
                      })
                  }
                </div>
              </div>
            )}

            {/* ── NOTES tab ───────────────────────────────────────────────── */}
            {activeTab === 'notes' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Note compose — always open */}
                <div style={{ padding: '16px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MUTED2, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag style={{ width: 12, height: 12 }} /> Add a note
                  </div>
                  <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveQuickNote() }}
                    placeholder="Write your note here… (⌘+Enter to save)"
                    rows={4}
                    style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: TEXT, background: PANEL, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={saveQuickNote} disabled={!quickNote.trim() || savingNote}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 18px', background: BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: (!quickNote.trim() || savingNote) ? 'not-allowed' : 'pointer', opacity: (!quickNote.trim() || savingNote) ? 0.55 : 1 }}>
                      {savingNote ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 12, height: 12 }} />}
                      {savingNote ? 'Saving…' : 'Save Note'}
                    </button>
                  </div>
                </div>
                {/* Notes list */}
                <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
                  {noteActs.length === 0
                    ? <EmptyState icon={Tag} title="No notes yet" sub="Your notes appear here — use the form above to add one" />
                    : noteActs.map(act => <ActivityCard key={act.id} act={act} />)
                  }
                </div>
              </div>
            )}

            {/* ── CALLS tab ───────────────────────────────────────────────── */}
            {activeTab === 'calls' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Call stats strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                  {[
                    { label: 'Total',       value: callStats.total,      color: MUTED2  },
                    { label: 'Connected',   value: callStats.connected,  color: EMERALD },
                    { label: 'No Answer',   value: callStats.noResponse, color: AMBER   },
                    { label: 'Missed',      value: callStats.missed,     color: RED     },
                  ].map((stat, i, a) => (
                    <div key={stat.label} style={{ padding: '14px 0', textAlign: 'center', borderRight: i < a.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, letterSpacing: '-0.5px' }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 2, fontWeight: 500 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                {/* Log call CTA */}
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setShowCallModal(true)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 9, color: EMERALD, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <Phone style={{ width: 14, height: 14 }} />Log a Call
                  </button>
                  <button onClick={logCallAttempt} disabled={callAttempts.length >= 5}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, color: RED, fontSize: 13, fontWeight: 700, cursor: callAttempts.length >= 5 ? 'not-allowed' : 'pointer', opacity: callAttempts.length >= 5 ? 0.5 : 1 }}>
                    <PhoneOff style={{ width: 14, height: 14 }} />No Answer
                  </button>
                </div>
                {/* NC suggestion */}
                {showNCSuggest && (
                  <div style={{ margin: '10px 16px 0', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: RED, margin: '0 0 4px' }}>📵 5 failed call attempts</p>
                    <p style={{ fontSize: 11, color: '#991B1B', margin: '0 0 8px' }}>Mark as Disqualified — non-contactable after 5 failed attempts.</p>
                    <button onClick={() => { handleStageChange('Disqualified'); setShowNCSuggest(false) }}
                      style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: RED, border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer' }}>
                      Disqualify (NC)
                    </button>
                  </div>
                )}
                {/* Call attempt dots */}
                {callAttempts.length > 0 && (
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: MUTED }}>No-answer attempts</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1,2,3,4,5].map(n => (
                          <div key={n} style={{ width: 20, height: 4, borderRadius: 2, background: n <= callAttempts.length ? (n >= 5 ? RED : n >= 3 ? AMBER : BLUE) : BORDER }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: callAttempts.length >= 5 ? RED : MUTED }}>{callAttempts.length}/5</span>
                      <button onClick={clearCallAttempts} style={{ fontSize: 10, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>Reset</button>
                    </div>
                  </div>
                )}
                {/* Calls list */}
                <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
                  {callActs.length === 0
                    ? <EmptyState icon={Phone} title="No calls logged" sub="Log a call above to track your conversation history" action={{ label: 'Log a Call', onClick: () => setShowCallModal(true) }} />
                    : callActs.map(act => <ActivityCard key={act.id} act={act} />)
                  }
                </div>
              </div>
            )}

            {/* ── WHATSAPP tab ─────────────────────────────────────────────── */}
            {activeTab === 'whatsapp' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* WA header */}
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4', flexShrink: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: WA_GRN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle style={{ width: 16, height: 16, color: '#fff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: MUTED2 }}>{name}</div>
                    <div style={{ fontSize: 11, color: WA_GRN }}>{phone || 'No phone number'}</div>
                  </div>
                  <button onClick={() => setShowWhatsAppModal(true)} disabled={!phone}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: WA_GRN, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: phone ? 'pointer' : 'not-allowed', opacity: phone ? 1 : 0.5 }}>
                    <Send style={{ width: 12, height: 12 }} />Send WhatsApp
                  </button>
                </div>
                {/* Conversation thread */}
                <div style={{ flex: 1, padding: '16px', overflowY: 'auto', background: '#F7FDF9', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {waActs.length === 0 ? (
                    <EmptyState icon={MessageCircle} title="No WhatsApp messages yet" sub="Send a message below to start the conversation" action={{ label: 'Send WhatsApp', onClick: () => setShowWhatsAppModal(true) }} waStyle />
                  ) : (
                    waActs.map(act => {
                      const isSent = act.type === 'WhatsApp Sent'
                      return (
                        <div key={act.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start' }}>
                          <div style={{ maxWidth: '75%', padding: '10px 14px', background: isSent ? '#DCF8C6' : PANEL, border: `1px solid ${isSent ? '#A7F3D0' : BORDER}`, borderRadius: isSent ? '18px 18px 4px 18px' : '18px 18px 18px 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                            {act.notes
                              ? <p style={{ fontSize: 13, color: TEXT, margin: 0, lineHeight: 1.5 }}>{act.notes}</p>
                              : <p style={{ fontSize: 12, color: MUTED, margin: 0, fontStyle: 'italic' }}>{act.type}</p>
                            }
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, padding: '0 2px' }}>
                            <span style={{ fontSize: 10, color: MUTED }}>{timeAgo(act.createdAt)}</span>
                            {isSent && <CheckCircle style={{ width: 10, height: 10, color: '#34B7F1' }} />}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {/* Send bar */}
                {phone && (
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
                    <button onClick={() => setShowWhatsAppModal(true)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', background: WA_GRN, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <MessageCircle style={{ width: 15, height: 15 }} />Send a WhatsApp Message
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════
              RIGHT — Sidebar
          ══════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Intent Score */}
            <SideCard>
              <SideCardHeader title="Intent Score" icon={TrendingUp} />
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: ss.color, fontWeight: 700 }}>{ss.label}</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: ss.color, letterSpacing: '-0.5px' }}>{score}</span>
                </div>
                <div style={{ height: 7, background: '#F1F5F9', borderRadius: 4, marginBottom: 12 }}>
                  <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(90deg, ${ss.ring}99, ${ss.ring})`, borderRadius: 4 }} />
                </div>
                {bdown.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < bdown.length - 1 ? 6 : 0 }}>
                    <span style={{ fontSize: 11, color: MUTED }}>{item.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: item.pos ? EMERALD : '#94A3B8' }}>
                      {item.pos ? '✓' : '✗'} {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </SideCard>

            {/* Lead Lifecycle */}
            <SideCard>
              <SideCardHeader title="Lead Lifecycle" icon={TrendingUp} />
              <div style={{ padding: '14px 12px' }}>
                {(() => {
                  const PIPELINE = ['New', 'Cold', 'Warm', 'Hot', 'Closed'] as const
                  const STAGE_CFG: Record<string, { color: string; emoji: string; desc: string }> = {
                    New:          { color: '#64748B', emoji: '📋', desc: 'Unworked' },
                    Cold:         { color: '#2563EB', emoji: '❄️', desc: 'Calls / WA only' },
                    Warm:         { color: '#be2ed6', emoji: '🌡️', desc: 'VM / OBM / SV done' },
                    Hot:          { color: '#a000c8', emoji: '🔥', desc: 'EOI received' },
                    Closed:       { color: '#059669', emoji: '✅', desc: 'Deal closed' },
                    Disqualified: { color: '#94A3B8', emoji: '✗',  desc: 'Not proceeding' },
                  }

                  const currentStatus = lead.status ?? 'New'
                  const isDisqualified = currentStatus === 'Disqualified'
                  const currentIdx     = PIPELINE.indexOf(currentStatus as typeof PIPELINE[number])
                  const isTerminal     = currentStatus === 'Closed' || isDisqualified

                  return (
                    <div>
                      {/* Pipeline steps */}
                      {PIPELINE.map((stage, idx) => {
                        const cfg     = STAGE_CFG[stage]
                        const isDone  = !isDisqualified && currentIdx > idx
                        const isCur   = currentStatus === stage
                        const isFuture = !isDisqualified && currentIdx < idx && !isTerminal
                        const canClick = !isTerminal && idx > currentIdx

                        return (
                          <div key={stage}>
                            <button
                              onClick={() => canClick && handleStageChange(stage)}
                              disabled={!canClick && !isCur}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                padding: '9px 10px', borderRadius: 10, border: 'none', textAlign: 'left',
                                background: isCur ? `${cfg.color}12` : 'transparent',
                                cursor: canClick ? 'pointer' : 'default',
                                outline: isCur ? `2px solid ${cfg.color}40` : 'none',
                                transition: 'background 0.15s',
                              }}
                            >
                              {/* Step indicator */}
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                background: isDone ? cfg.color : isCur ? cfg.color : '#F1F5F9',
                                border: `2px solid ${isDone || isCur ? cfg.color : '#E2E8F0'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: isDone ? 14 : 13,
                              }}>
                                {isDone
                                  ? <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>✓</span>
                                  : <span style={{ filter: isFuture ? 'grayscale(1) opacity(0.3)' : 'none' }}>{cfg.emoji}</span>}
                              </div>

                              {/* Label */}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: isCur ? 700 : isDone ? 600 : 400, color: isCur ? cfg.color : isDone ? cfg.color : isFuture ? '#CBD5E1' : '#94A3B8' }}>
                                  {stage}
                                  {isCur && <span style={{ fontSize: 10, fontWeight: 700, background: `${cfg.color}20`, color: cfg.color, padding: '1px 6px', borderRadius: 99, marginLeft: 6 }}>Current</span>}
                                </div>
                                <div style={{ fontSize: 10, color: isFuture ? '#CBD5E1' : '#94A3B8', marginTop: 1 }}>{cfg.desc}</div>
                              </div>

                              {/* Move-to hint */}
                              {canClick && (
                                <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600, opacity: 0.7 }}>Move →</span>
                              )}
                            </button>

                            {/* Connector line */}
                            {idx < PIPELINE.length - 1 && (
                              <div style={{ marginLeft: 25, width: 2, height: 10, background: isDone ? cfg.color : '#E2E8F0', borderRadius: 1 }} />
                            )}
                          </div>
                        )
                      })}

                      {/* Disqualified — separate terminal */}
                      <div style={{ marginTop: 10, borderTop: `1px dashed ${BORDER}`, paddingTop: 10 }}>
                        <button
                          onClick={() => !isTerminal && handleStageChange('Disqualified')}
                          disabled={isTerminal}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '8px 10px', borderRadius: 9, border: 'none', textAlign: 'left',
                            background: isDisqualified ? 'rgba(148,163,184,0.12)' : 'transparent',
                            cursor: isTerminal ? 'default' : 'pointer',
                            outline: isDisqualified ? '2px solid rgba(148,163,184,0.3)' : 'none',
                          }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: isDisqualified ? '#94A3B8' : '#F1F5F9', border: `2px solid ${isDisqualified ? '#94A3B8' : '#E2E8F0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, filter: !isDisqualified && !isTerminal ? 'grayscale(0.3)' : 'none' }}>
                            {isDisqualified ? <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>✗</span> : <span style={{ opacity: 0.4 }}>✗</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: isDisqualified ? 700 : 400, color: isDisqualified ? '#94A3B8' : '#CBD5E1' }}>
                              Disqualified
                              {isDisqualified && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(148,163,184,0.2)', color: '#94A3B8', padding: '1px 6px', borderRadius: 99, marginLeft: 6 }}>Current</span>}
                            </div>
                            <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>NC / not proceeding</div>
                          </div>
                          {!isTerminal && <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, opacity: 0.5 }}>Mark →</span>}
                        </button>
                      </div>

                      {stageChanging && (
                        <div style={{ marginTop: 8, fontSize: 12, color: MUTED, textAlign: 'center' }}>Updating…</div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </SideCard>

            <PropertyMatcher lead={{ name, city: lead.city ?? null, budgetMin: lead.budgetMin ?? null, budgetMax: lead.budgetMax ?? null, propertyType: lead.propertyType ?? null, timeline: lead.timeline ?? null, localities: lead.localities ?? null, phone: phone || null }} />
            <FollowUpWriter lead={{ leadId, name, city: lead.city ?? null, budget: formatBudget(lead.budgetMin, lead.budgetMax) !== '—' ? formatBudget(lead.budgetMin, lead.budgetMax) : null, propertyType: lead.propertyType?.join(', ') ?? null, timeline: lead.timeline ?? null, score, lastActivity: activities[0]?.type ?? null, status: lead.status ?? null, phone: phone || null }} />

            {/* Lead Details */}
            <SideCard>
              <SideCardHeader title="Lead Details" icon={Tag} />
              <div style={{ padding: '4px 14px 10px' }}>
                {[
                  { label: 'Lead ID',      value: lead.leadPortalId ?? undefined },
                  { label: 'Source',       value: lead.sourcePortal },
                  { label: 'Added',        value: formatDate(lead.createdAt) },
                  { label: 'Last updated', value: formatDate(lead.updatedAt) },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                    <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: row.value ? MUTED2 : MUTED, textAlign: 'right' }}>{row.value || '—'}</span>
                  </div>
                ))}
              </div>
            </SideCard>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <LogActivityModal
        leadId={leadId}
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        currentStatus={lead.status ?? 'New'}
        existingActivityTypes={activities.map(a => a.type)}
        onActivityLogged={(result) => {
          setShowActivityModal(false)
          if (result?.statusAdvancedTo) setLead(p => p ? { ...p, status: result.statusAdvancedTo! } : p)
          fetchLead()
        }}
      />
      <WhatsAppModal isOpen={showWhatsAppModal} onClose={() => { setShowWhatsAppModal(false); fetchLead() }} leadId={leadId} leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()} leadPhone={lead.phones.primaryPhoneNumber ?? ''} city={lead.city ?? ''} />
      <CallModal isOpen={showCallModal} onClose={() => setShowCallModal(false)} leadId={leadId} leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()} leadPhone={lead.phones.primaryPhoneNumber ?? ''} onLogged={fetchLead} />

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 28, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 style={{ width: 20, height: 20, color: RED }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: '0 0 8px' }}>Delete Lead?</h3>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 24px' }}>Permanently delete <strong style={{ color: TEXT }}>{name}</strong> and all activity history.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '10px 0', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: RED, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
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

// ─── Shared empty state ───────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, sub, action, waStyle }: { icon: React.ElementType; title: string; sub: string; action?: { label: string; onClick: () => void }; waStyle?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', textAlign: 'center', background: waStyle ? 'transparent' : undefined }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Icon style={{ width: 22, height: 22, color: '#94A3B8' }} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px', maxWidth: 220 }}>{sub}</p>
      {action && (
        <button onClick={action.onClick}
          style={{ padding: '8px 18px', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, borderRadius: 8, color: BLUE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
