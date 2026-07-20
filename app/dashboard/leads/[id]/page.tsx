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
  TrendingUp, Calendar, Trash2, Loader2, Activity, Filter,
  AlertCircle, Plus, MessageCircle, CheckCircle, XCircle,
  MinusCircle, HelpCircle, ChevronDown, User, PhoneOff, Copy, Send,
  Zap, Bell, Award,
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#F5F6FA'
const PANEL   = '#FFFFFF'
const BORDER  = '#E8ECF0'
const BLUE         = '#FF7043'
const PRIMARY_DIM  = 'rgba(255,112,67,0.08)'
const PRIMARY_BORDER = 'rgba(255,112,67,0.22)'
const PRIMARY_GRAD = 'linear-gradient(135deg, #FF7043 0%, #FF8A65 100%)'
const EMERALD = '#059669'
const RED     = '#DC2626'
const AMBER   = '#F59E0B'
const TEXT    = '#263238'
const MUTED   = '#78889B'
const MUTED2  = '#455A64'
const WA_GRN  = '#16A34A'

const ACT_COLORS: Record<string, { icon: string; bg: string; accent: string }> = {
  'Call Made':            { icon: '#059669', bg: '#ECFDF5', accent: '#059669' },
  'Call Missed':          { icon: '#DC2626', bg: '#FEF2F2', accent: '#DC2626' },
  'WhatsApp Sent':        { icon: WA_GRN,   bg: '#F0FDF4', accent: WA_GRN    },
  'WhatsApp Received':    { icon: WA_GRN,   bg: '#F0FDF4', accent: WA_GRN    },
  'Email Sent':           { icon: '#FF7043', bg: PRIMARY_DIM, accent: '#FF7043' },
  'Email Received':       { icon: '#FF7043', bg: PRIMARY_DIM, accent: '#FF7043' },
  'Site Visit Scheduled': { icon: '#F59E0B', bg: 'rgba(245,158,11,0.09)', accent: '#F59E0B' },
  'Site Visit Done':      { icon: '#FF7043', bg: 'rgba(255,112,67,0.08)', accent: '#FF7043' },
  'Follow Up Set':        { icon: '#F59E0B', bg: 'rgba(245,158,11,0.09)', accent: '#F59E0B' },
  'Note':                 { icon: BLUE,      bg: PRIMARY_DIM, accent: BLUE    },
  'Status Changed':       { icon: '#FF7043', bg: PRIMARY_DIM, accent: '#FF7043' },
}

// ─── Types ────────────────────────────────────────────────────────────────────
type LeadActivity = {
  id: string; type: string; createdAt: string
  notes?: string | null; outcome?: string | null
  duration?: number | null; nextActionDate?: string | null
}
type LeadTask = {
  id: string; lead_id: string; title: string; task_type: string
  due_date: string; priority: 'High' | 'Medium' | 'Low'
  status: 'Pending' | 'Done' | 'Cancelled'
  notes?: string | null; assigned_to?: string | null; created_at: string
}
type ActivityTab = 'all' | 'calls' | 'whatsapp' | 'notes' | 'tasks'
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

// Demo avatar map — CS ID → public image path (add more as needed)
const AVATAR_MAP: Record<string, string> = {
  'CS01689': '/avatars/adi.png',
}
function getAvatarImg(csId: string): string | null {
  return AVATAR_MAP[csId] ?? null
}

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
  if (score >= 70) return { label: 'High Intent', color: '#FF7043', ring: '#FF7043', bg: 'rgba(255,112,67,0.08)' }
  if (score >= 40) return { label: 'Medium',      color: '#F59E0B', ring: '#F59E0B', bg: 'rgba(245,158,11,0.09)' }
  return               { label: 'Low',            color: '#78889B', ring: '#CBD5E1', bg: '#F0F2F5' }
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
  'No Response': { Icon: HelpCircle,  color: '#FF7043', bg: 'rgba(245,158,11,0.09)' },
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
  { id: 'Warm',         label: 'Warm',         color: '#F59E0B', desc: 'VM / OBM / SV done or docs requested', terminal: false },
  { id: 'Hot',          label: 'Hot',          color: '#FF7043', desc: 'EOI received — high intent to book',   terminal: false },
  { id: 'Closed',       label: 'Closed',       color: '#059669', desc: 'Deals — EOI paid',               terminal: true  },
  { id: 'Disqualified', label: 'Disqualified', color: '#94A3B8', desc: 'Not proceeding — NC or rejected',      terminal: true  },
]
const BUCKETS = [
  { label: 'New',          color: '#64748B', stages: ['New']          },
  { label: 'Cold',         color: '#2563EB', stages: ['Cold']         },
  { label: 'Warm',         color: '#F59E0B', stages: ['Warm']         },
  { label: 'Hot',          color: '#FF7043', stages: ['Hot']          },
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

// Kirrivan-style activity card
function KirivanCard({ act, upcoming, onLog }: { act: LeadActivity; upcoming?: boolean; onLog: () => void }) {
  const AIcon = ACT_ICON[act.type] ?? Activity
  const ac    = ACT_COLORS[act.type] ?? { icon: '#64748B', bg: '#F8FAFC', accent: '#64748B' }
  const oc    = act.outcome ? OUTCOME_CFG[act.outcome] : null
  const OIcon = oc?.Icon

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Header row — outside the card, like Kirrivan */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingLeft: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AIcon style={{ width: 11, height: 11, color: ac.icon }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED2 }}>{act.type}</span>
          {upcoming && act.nextActionDate && (
            <span style={{ fontSize: 11, color: BLUE, fontWeight: 500 }}>· Due {formatShortDate(act.nextActionDate)}</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: MUTED }}>{timeAgo(act.createdAt)}</span>
      </div>

      {/* Card body */}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', background: PANEL, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ padding: '13px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            {/* Status circle (like Kirrivan checkbox) */}
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${upcoming ? BLUE : ac.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, background: oc && !upcoming ? `${ac.accent}10` : 'transparent' }}>
              {oc && OIcon && !upcoming && <OIcon style={{ width: 11, height: 11, color: oc.color }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title + due date */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: act.notes ? 6 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{act.type}</span>
                {act.nextActionDate && !upcoming && (
                  <span style={{ fontSize: 11, color: BLUE, fontWeight: 600, flexShrink: 0 }}>
                    Follow-up · {formatShortDate(act.nextActionDate)}
                  </span>
                )}
              </div>
              {/* Notes body */}
              {act.notes && (
                <p style={{ fontSize: 13, color: MUTED2, margin: 0, lineHeight: 1.58 }}>{act.notes}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer metadata row — Kirrivan style */}
        <div style={{ display: 'flex', borderTop: `1px solid ${BORDER}`, background: '#FAFBFC' }}>
          <div style={{ flex: 1, padding: '8px 14px', borderRight: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>Reminder</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: act.nextActionDate ? BLUE : MUTED }}>
              {act.nextActionDate ? formatShortDate(act.nextActionDate) : 'No reminder'}
            </div>
          </div>
          <div style={{ flex: 1, padding: '8px 14px', borderRight: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>Duration</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: MUTED2 }}>
              {act.duration ? `${Math.floor(act.duration / 60)}m ${act.duration % 60}s` : '—'}
            </div>
          </div>
          <div style={{ flex: 1, padding: '8px 14px' }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>Outcome</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: oc ? oc.color : MUTED }}>
              {act.outcome ?? '—'}
            </div>
          </div>
        </div>
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

  // ── Email compose state ────────────────────────────────────────────────────
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent]     = useState(false)
  const [emailError, setEmailError]   = useState<string | null>(null)

  // ── Tasks state ────────────────────────────────────────────────────────────
  const [tasks,       setTasks]       = useState<LeadTask[]>([])
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [savingTask,  setSavingTask]  = useState(false)
  const [taskForm, setTaskForm] = useState({
    task_type: 'Follow Up', title: '', date: '', time: '10:00',
    priority: 'Medium' as 'High' | 'Medium' | 'Low', notes: '',
  })

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

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/crm/leads/${leadId}/tasks`)
    if (res.ok) { const d = await res.json(); setTasks(d.tasks ?? []) }
  }, [leadId])

  useEffect(() => { fetchLead(); fetchTasks() }, [fetchLead, fetchTasks])
  useEffect(() => { window.scrollTo(0, 0) }, [])

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
  const handleSendEmail = async () => {
    if (!emailForm.subject.trim() || !emailForm.body.trim() || sendingEmail) return
    setSendingEmail(true); setEmailError(null)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email, toName: name,
          subject: emailForm.subject.trim(),
          body: emailForm.body.trim(),
          leadId,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Send failed')
      setEmailSent(true)
      setTimeout(() => {
        setShowEmailModal(false); setEmailSent(false)
        setEmailForm({ subject: '', body: '' })
        fetchLead()
      }, 1800)
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Could not send email')
    } finally { setSendingEmail(false) }
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
    Closed: '#059669', Hot: '#FF7043', Warm: '#F59E0B',
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
  const callActs    = activities.filter(a => a.type.toLowerCase().includes('call'))
  const waActs      = activities.filter(a => a.type.toLowerCase().includes('whatsapp'))
  const noteActs    = activities.filter(a => a.type === 'Note')
  const upcomingTasks = activities.filter(a => a.nextActionDate && new Date(a.nextActionDate) > new Date())
  const pendingTasks  = tasks.filter(t => t.status === 'Pending')
  const tabCounts: Record<ActivityTab, number> = {
    all: activities.length, calls: callActs.length, whatsapp: waActs.length,
    notes: noteActs.length, tasks: pendingTasks.length,
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
      if (daysUntil <= 2) nudge = { icon: Bell, color: AMBER, bg: 'rgba(245,158,11,0.09)', border: 'rgba(255,112,67,0.22)', text: `Follow-up ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : 'in 2 days'}`, sub: `Scheduled on ${formatShortDate(futureFU)} — log the outcome when done`, actionLabel: 'Log Outcome', onAction: () => setShowActivityModal(true) }
    } else if (activities.length === 0) {
      nudge = { icon: Zap, color: BLUE, bg: PRIMARY_DIM, border: PRIMARY_BORDER, text: 'Make your first move', sub: 'This lead hasn\'t been contacted yet — a quick call increases conversion by 3×', actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (score >= 70 && ['New', 'Cold'].includes(lead.status || 'New')) {
      nudge = { icon: Zap, color: '#FF7043', bg: 'rgba(255,112,67,0.08)', border: 'rgba(160,0,200,0.2)', text: 'High intent — move fast', sub: `Score ${score}/100 but still in early stage. Don't let a hot lead go cold`, actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (callAttempts.length >= 2 && lastAct?.type.includes('Call') && lastAct?.outcome === 'No Response') {
      nudge = { icon: MessageCircle, color: WA_GRN, bg: '#F0FDF4', border: '#BBF7D0', text: 'Switch to WhatsApp', sub: `${callAttempts.length} calls with no answer — leads respond 4× faster to messages`, actionLabel: 'Send WA', onAction: () => setShowWhatsAppModal(true) }
    } else if (daysSince !== null && daysSince >= 7) {
      nudge = { icon: AlertCircle, color: RED, bg: '#FEF2F2', border: '#FECACA', text: `No contact in ${daysSince} days`, sub: 'Lead is going cold — reach out now before they look elsewhere', actionLabel: 'Call Now', onAction: () => setShowCallModal(true) }
    } else if (daysSince !== null && daysSince >= 3) {
      nudge = { icon: Bell, color: AMBER, bg: 'rgba(245,158,11,0.09)', border: 'rgba(255,112,67,0.22)', text: `${daysSince} days since last contact`, sub: 'A quick touchpoint now keeps the lead warm and moving', actionLabel: 'Log Activity', onAction: () => setShowActivityModal(true) }
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

            {/* Avatar + Identity — iPhone Contacts style */}
            <div style={{ padding: '28px 20px 22px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>

              {/* Avatar — halo style for photo, plain initials otherwise */}
              {(() => {
                const avatarImg = getAvatarImg(getCsId(lead))
                return avatarImg ? (
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: `radial-gradient(circle, ${ss.color}22 0%, transparent 70%)` }} />
                    <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `1.5px solid ${ss.color}28` }} />
                    <div style={{ width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', boxShadow: `0 10px 28px ${ss.color}30, 0 2px 8px rgba(0,0,0,0.06)`, position: 'relative' }}>
                      <img src={avatarImg} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                    width: 72, height: 72, borderRadius: '50%', background: ss.bg, border: `2px solid ${ss.color}30` }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: ss.color, letterSpacing: '-1px' }}>{initials}</span>
                  </div>
                )
              })()}

              {/* Name */}
              <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: '0 0 4px', letterSpacing: '-0.04em' }}>{name}</h2>

              {/* Source */}
              <p style={{ fontSize: 12, color: MUTED, margin: '0 0 10px' }}>
                {lead.sourcePortal ? lead.sourcePortal.replace('OPT99ACRES','99acres').replace('MAGICBRICKS','MagicBricks').replace('HOUSING_COM','Housing.com').replace('FACEBOOK','Facebook') : 'Direct'}
              </p>

              {/* CS ID */}
              <button onClick={copyCsId}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: copied ? EMERALD : MUTED, background: copied ? '#ECFDF5' : BG, border: `1px solid ${copied ? '#A7F3D0' : BORDER}`, padding: '4px 12px', borderRadius: 99, fontFamily: 'monospace', cursor: 'pointer', marginBottom: 13, transition: 'all 0.2s' }}>
                {copied ? '✓ Copied' : <>{getCsId(lead)} <Copy style={{ width: 9, height: 9, opacity: 0.5 }} /></>}
              </button>

              {/* Status + milestone badges */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ss.color, background: ss.bg, padding: '4px 12px', borderRadius: 99 }}>{ss.label}</span>
                {achievedStage && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: MILESTONE_COLOR[achievedStage] ?? MUTED, background: `${MILESTONE_COLOR[achievedStage] ?? MUTED}12`, border: `1px solid ${MILESTONE_COLOR[achievedStage] ?? MUTED}28`, padding: '4px 10px', borderRadius: 99 }}>
                    <Award style={{ width: 9, height: 9 }} />{topMilestone}
                  </span>
                )}
              </div>

              {/* iOS-style circular action buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 20 }}>

                {phone && (
                  <button onClick={() => setShowCallModal(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(145deg,#34C759,#28a745)', boxShadow: '0 6px 16px rgba(52,199,89,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                      <Phone style={{ width: 22, height: 22, color: '#fff' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>call</span>
                  </button>
                )}

                {phone && (
                  <button onClick={() => setShowWhatsAppModal(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(145deg,#25D366,#1da851)', boxShadow: '0 6px 16px rgba(37,211,102,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                      <MessageCircle style={{ width: 22, height: 22, color: '#fff' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>whatsapp</span>
                  </button>
                )}

                {email && (
                  <button onClick={() => { setShowEmailModal(true); setEmailSent(false); setEmailError(null) }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(145deg,#FF7043,#e8622e)', boxShadow: '0 6px 16px rgba(255,112,67,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                      <Mail style={{ width: 22, height: 22, color: '#fff' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>mail</span>
                  </button>
                )}

              </div>

              {/* Meta stats row */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '0 20px', borderRight: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{lastAct ? timeAgo(lastAct.createdAt) : '—'}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Last contact</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{daysInPipe > 0 ? `${daysInPipe}d` : 'Today'}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>In pipeline</div>
                </div>
              </div>
            </div>

            {/* Info tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
              {(['info', 'requirements'] as LeftTab[]).map(tab => (
                <button key={tab} onClick={() => setLeftTab(tab)}
                  style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600, color: leftTab === tab ? BLUE : MUTED, background: leftTab === tab ? PRIMARY_DIM : 'transparent', border: 'none', borderBottom: leftTab === tab ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer' }}>
                  {tab === 'info' ? 'Lead Info' : 'Requirement Info'}
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
                        {lead.localities.map(l => <span key={l} style={{ fontSize: 10, fontWeight: 600, color: '#FF7043', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, padding: '2px 7px', borderRadius: 5 }}>{l}</span>)}
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
                    <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6 }}>Property Assigned</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {lead.propertyType.map(pt => <span key={pt} style={{ fontSize: 11, fontWeight: 700, color: '#E64A19', background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(255,112,67,0.22)', padding: '3px 9px', borderRadius: 6 }}>{pt}</span>)}
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
                      {lead.localities.map(l => <span key={l} style={{ fontSize: 10, fontWeight: 600, color: '#FF7043', background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, padding: '2px 7px', borderRadius: 5 }}>{l}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════
              CENTER — Activity Feed (Kirrivan style)
          ══════════════════════════════════════════════════ */}
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>

            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC', flexShrink: 0, overflowX: 'auto' }}>
              {([
                { key: 'all',      label: 'Log Activities' },
                { key: 'notes',    label: 'Quick Notes' },
                { key: 'calls',    label: 'Calls'    },
                { key: 'whatsapp', label: 'WhatsApp' },
                { key: 'tasks',    label: 'Tasks'    },
              ] as { key: ActivityTab; label: string }[]).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '13px 16px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? BLUE : MUTED, background: 'transparent', border: 'none', borderBottom: activeTab === tab.key ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {tab.label}
                  {tabCounts[tab.key] > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: activeTab === tab.key ? BLUE : '#94A3B8', background: activeTab === tab.key ? PRIMARY_DIM : '#F1F5F9', padding: '1px 6px', borderRadius: 10 }}>
                      {tabCounts[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Filter / action bar (Kirrivan style) ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', border: `1px solid ${BORDER}`, borderRadius: 8, background: PANEL, fontSize: 12, color: MUTED, cursor: 'default' }}>
                  <Filter style={{ width: 11, height: 11 }} />
                  {activeTab === 'all' ? `${activities.length} activities` : activeTab === 'calls' ? `${callActs.length} calls` : activeTab === 'notes' ? `${noteActs.length} notes` : activeTab === 'tasks' ? `${upcomingTasks.length} upcoming` : `${waActs.length} messages`}
                </button>
              </div>
              <button onClick={() => setShowActivityModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', background: BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Plus style={{ width: 12, height: 12 }} />Create activity
              </button>
            </div>

            {/* ── Smart Nudge Bar ── */}
            {nudge && activeTab === 'all' && (
              <div style={{ margin: '10px 16px 0', padding: '11px 14px', background: nudge.bg, border: `1px solid ${nudge.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${nudge.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <nudge.icon style={{ width: 15, height: 15, color: nudge.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 1 }}>{nudge.text}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{nudge.sub}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={nudge.onAction} style={{ padding: '5px 12px', background: nudge.color, border: 'none', borderRadius: 7, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{nudge.actionLabel}</button>
                  <button onClick={() => setNudgeDismissed(true)} style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${nudge.border}`, borderRadius: 7, color: MUTED, fontSize: 11, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            )}

            {/* ── ACTIVITY tab ── */}
            {activeTab === 'all' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Quick note composer */}
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveQuickNote() }}
                      placeholder="Add a quick note… (⌘+Enter to save)"
                      rows={quickNote ? 3 : 1}
                      style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 13px', fontSize: 13, color: TEXT, background: BG, resize: 'none', outline: 'none', fontFamily: 'inherit', transition: 'rows 0.2s' }} />
                    {quickNote.trim() && (
                      <button onClick={saveQuickNote} disabled={savingNote}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: BLUE, border: 'none', borderRadius: 9, color: '#fff', fontSize: 12, fontWeight: 600, cursor: savingNote ? 'not-allowed' : 'pointer', opacity: savingNote ? 0.7 : 1, flexShrink: 0 }}>
                        {savingNote ? <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 11, height: 11 }} />}
                        Save
                      </button>
                    )}
                  </div>
                </div>

                {/* Feed */}
                <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                  {activities.length === 0 ? (
                    <EmptyState icon={Clock} title="No activities yet" sub="Log a call, note, or WhatsApp to get started" action={{ label: 'Log first activity', onClick: () => setShowActivityModal(true) }} />
                  ) : (
                    <>
                      {/* Upcoming section */}
                      {upcomingTasks.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Upcoming Activity</div>
                          {upcomingTasks.map(act => (
                            <KirivanCard key={act.id} act={act} upcoming onLog={() => setShowActivityModal(true)} />
                          ))}
                          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, marginTop: 20 }}>Recent Activity</div>
                        </>
                      )}
                      {/* All/Recent activities */}
                      {activities.filter(a => !upcomingTasks.includes(a)).map(act => {
                        const advancedTo = statusMarkers.get(act.id)
                        const advColor = advancedTo ? ({ New: '#78889B', Cold: '#2E66F6', Warm: '#F59E0B', Hot: '#FF7043', Closed: '#059669', Disqualified: '#94A3B8' } as Record<string, string>)[advancedTo] ?? '#78889B' : null
                        return (
                          <div key={act.id}>
                            <KirivanCard act={act} onLog={() => setShowActivityModal(true)} />
                            {advancedTo && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 12px' }}>
                                <div style={{ flex: 1, height: 1, background: `${advColor}28` }} />
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: advColor!, background: `${advColor}10`, border: `1px solid ${advColor}28`, padding: '2px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                                  <TrendingUp style={{ width: 9, height: 9 }} /> Moved to {advancedTo}
                                </span>
                                <div style={{ flex: 1, height: 1, background: `${advColor}28` }} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── QUICK NOTES tab ── */}
            {activeTab === 'notes' && (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Type a quick note — it will appear in the Log Activities feed.</p>
                <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveQuickNote() }}
                  placeholder="Write a note… (⌘+Enter to save)"
                  rows={4}
                  style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px', fontSize: 13, color: TEXT, background: BG, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={saveQuickNote} disabled={!quickNote.trim() || savingNote}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 18px', background: BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: (!quickNote.trim() || savingNote) ? 'not-allowed' : 'pointer', opacity: (!quickNote.trim() || savingNote) ? 0.5 : 1 }}>
                    {savingNote ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 12, height: 12 }} />}
                    {savingNote ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>
            )}

            {/* ── CALLS tab ── */}
            {activeTab === 'calls' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
                  {[
                    { label: 'Total',     value: callStats.total,      color: MUTED2  },
                    { label: 'Connected', value: callStats.connected,  color: EMERALD },
                    { label: 'No Answer', value: callStats.noResponse, color: AMBER   },
                    { label: 'Missed',    value: callStats.missed,     color: RED     },
                  ].map((s, i, a) => (
                    <div key={s.label} style={{ padding: '20px 0', textAlign: 'center', borderRight: i < a.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── WHATSAPP tab ── */}
            {activeTab === 'whatsapp' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4', flexShrink: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: WA_GRN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle style={{ width: 16, height: 16, color: '#fff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: MUTED2 }}>{name}</div>
                    <div style={{ fontSize: 11, color: WA_GRN }}>{phone || 'No phone number'}</div>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '16px', overflowY: 'auto', background: '#F7FDF9', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {waActs.length === 0 ? (
                    <EmptyState icon={MessageCircle} title="No WhatsApp messages yet" sub="Send a message to start the conversation" action={{ label: 'Send WhatsApp', onClick: () => setShowWhatsAppModal(true) }} waStyle />
                  ) : waActs.map(act => {
                    const isSent = act.type === 'WhatsApp Sent'
                    return (
                      <div key={act.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '75%', padding: '10px 14px', background: isSent ? '#DCF8C6' : PANEL, border: `1px solid ${isSent ? '#A7F3D0' : BORDER}`, borderRadius: isSent ? '18px 18px 4px 18px' : '18px 18px 18px 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                          {act.notes ? <p style={{ fontSize: 13, color: TEXT, margin: 0, lineHeight: 1.5 }}>{act.notes}</p>
                            : <p style={{ fontSize: 12, color: MUTED, margin: 0, fontStyle: 'italic' }}>{act.type}</p>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, padding: '0 2px' }}>
                          <span style={{ fontSize: 10, color: MUTED }}>{timeAgo(act.createdAt)}</span>
                          {isSent && <CheckCircle style={{ width: 10, height: 10, color: '#34B7F1' }} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── TASKS tab ── */}
            {activeTab === 'tasks' && lead && (() => {
              const TASK_TYPES = ['Follow Up', 'Call Back', 'Site Visit', 'Send Brochure', 'Meeting', 'Send Proposal', 'Check In', 'Custom']
              const PRIORITY_CFG = { High: { color: RED, bg: 'rgba(220,38,38,0.09)' }, Medium: { color: AMBER, bg: 'rgba(245,158,11,0.09)' }, Low: { color: MUTED, bg: '#F1F5F9' } }
              const TYPE_DEFAULTS: Record<string, string> = {
                'Follow Up':     `Follow up with ${lead.name.firstName}`,
                'Call Back':     `Call ${lead.name.firstName} back`,
                'Site Visit':    `Site visit with ${lead.name.firstName}`,
                'Send Brochure': `Send brochure to ${lead.name.firstName}`,
                'Meeting':       `Meeting with ${lead.name.firstName}`,
                'Send Proposal': `Send proposal to ${lead.name.firstName}`,
                'Check In':      `Check in with ${lead.name.firstName}`,
                'Custom':        '',
              }
              const now = new Date()
              const todayStr = now.toISOString().slice(0, 10)

              const fmtDue = (iso: string) => {
                const d = new Date(iso)
                const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                const dDay = d.toISOString().slice(0, 10)
                const label = dDay === todayStr ? 'Today' : dDay === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? 'Tomorrow' : d < now ? 'Overdue' : dateStr
                return { label, timeStr, overdue: d < now && dDay !== todayStr }
              }

              const overdue  = pendingTasks.filter(t => { const d = new Date(t.due_date); return d < now && d.toISOString().slice(0,10) !== todayStr })
              const today    = pendingTasks.filter(t => new Date(t.due_date).toISOString().slice(0,10) === todayStr)
              const upcoming = pendingTasks.filter(t => { const d = new Date(t.due_date); return d >= now && d.toISOString().slice(0,10) !== todayStr })
              const done     = tasks.filter(t => t.status === 'Done')
              const cancelled = tasks.filter(t => t.status === 'Cancelled')

              const updateTask = async (taskId: string, status: 'Done' | 'Cancelled') => {
                await fetch(`/api/crm/leads/${leadId}/tasks/${taskId}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status }),
                })
                fetchTasks()
              }

              const handleCreateTask = async () => {
                if (!taskForm.title.trim() || !taskForm.date) return
                setSavingTask(true)
                const due_date = new Date(`${taskForm.date}T${taskForm.time}:00`).toISOString()
                await fetch(`/api/crm/leads/${leadId}/tasks`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: taskForm.title, task_type: taskForm.task_type, due_date, priority: taskForm.priority, notes: taskForm.notes }),
                })
                setSavingTask(false)
                setShowTaskForm(false)
                setTaskForm({ task_type: 'Follow Up', title: '', date: '', time: '10:00', priority: 'Medium', notes: '' })
                fetchTasks()
              }

              const TaskCard = ({ task }: { task: LeadTask }) => {
                const { label, timeStr, overdue: isOverdue } = fmtDue(task.due_date)
                const pc = PRIORITY_CFG[task.priority]
                const isDone = task.status === 'Done'
                const isCancelled = task.status === 'Cancelled'
                return (
                  <div style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: `1px solid ${BORDER}`, opacity: isCancelled ? 0.45 : 1 }}>
                    <div style={{ width: 3, borderRadius: 99, background: isDone ? EMERALD : isCancelled ? '#CBD5E1' : pc.color, flexShrink: 0, alignSelf: 'stretch', minHeight: 36 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? MUTED : TEXT, textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.4 }}>{task.title}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: pc.color, background: pc.bg, padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>{task.priority}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: MUTED, background: '#F1F5F9', padding: '1px 7px', borderRadius: 99 }}>{task.task_type}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? RED : isDone ? EMERALD : MUTED }}>
                          {isDone ? '✓ Done' : isCancelled ? 'Cancelled' : isOverdue ? `⚠ ${label} · ${timeStr}` : `${label} · ${timeStr}`}
                        </span>
                      </div>
                      {task.notes && <p style={{ fontSize: 12, color: MUTED, margin: '0 0 6px', lineHeight: 1.5 }}>{task.notes}</p>}
                      {task.status === 'Pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => updateTask(task.id, 'Done')}
                            style={{ fontSize: 11, fontWeight: 700, color: EMERALD, background: 'rgba(5,150,105,0.09)', border: 'none', borderRadius: 7, padding: '4px 12px', cursor: 'pointer' }}>
                            ✓ Mark Done
                          </button>
                          <button onClick={() => updateTask(task.id, 'Cancelled')}
                            style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: '#F1F5F9', border: 'none', borderRadius: 7, padding: '4px 12px', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              const SectionHead = ({ label, count }: { label: string; count: number }) => (
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {label} <span style={{ fontWeight: 800, color: TEXT }}>{count}</span>
                </div>
              )

              return (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Add Task button */}
                  <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setShowTaskForm(v => !v); setTaskForm(f => ({ ...f, title: TYPE_DEFAULTS['Follow Up'] })) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#fff', background: PRIMARY_GRAD, border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,112,67,0.28)' }}>
                      <Plus style={{ width: 13, height: 13 }} /> Add Task
                    </button>
                  </div>

                  {/* Inline create form */}
                  {showTaskForm && (
                    <div style={{ margin: '12px 16px', background: '#FAFBFC', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px' }}>
                      {/* Task type */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>Task Type</label>
                        <select value={taskForm.task_type}
                          onChange={e => {
                            const t = e.target.value
                            setTaskForm(f => ({ ...f, task_type: t, title: TYPE_DEFAULTS[t] ?? f.title }))
                          }}
                          style={{ width: '100%', fontSize: 13, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', outline: 'none' }}>
                          {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      {/* Title */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>Title</label>
                        <input type="text" value={taskForm.title} placeholder="Task title…"
                          onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                          style={{ width: '100%', fontSize: 13, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      {/* Date + Time */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10, marginBottom: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>Due Date</label>
                          <input type="date" value={taskForm.date} min={todayStr}
                            onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))}
                            style={{ width: '100%', fontSize: 13, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', outline: 'none', boxSizing: 'border-box', colorScheme: 'light', accentColor: '#FF7043' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>Time</label>
                          <input type="time" value={taskForm.time}
                            onChange={e => setTaskForm(f => ({ ...f, time: e.target.value }))}
                            style={{ width: '100%', fontSize: 13, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', outline: 'none', boxSizing: 'border-box', colorScheme: 'light', accentColor: '#FF7043' }} />
                        </div>
                      </div>
                      {/* Priority */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 7 }}>Priority</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['High', 'Medium', 'Low'] as const).map(p => {
                            const pc = PRIORITY_CFG[p]
                            const active = taskForm.priority === p
                            return (
                              <button key={p} onClick={() => setTaskForm(f => ({ ...f, priority: p }))}
                                style={{ flex: 1, fontSize: 12, fontWeight: 700, border: `1px solid ${active ? pc.color : BORDER}`, borderRadius: 8, padding: '7px 0', cursor: 'pointer', color: active ? pc.color : MUTED, background: active ? pc.bg : PANEL, transition: 'all 0.15s' }}>
                                {p}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      {/* Notes */}
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>Notes <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span></label>
                        <textarea rows={2} value={taskForm.notes} placeholder="Any additional context…"
                          onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
                          style={{ width: '100%', fontSize: 13, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={() => setShowTaskForm(false)}
                          style={{ fontSize: 12, fontWeight: 600, color: MUTED, background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>
                          Cancel
                        </button>
                        <button onClick={handleCreateTask} disabled={savingTask || !taskForm.title.trim() || !taskForm.date}
                          style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: !taskForm.title.trim() || !taskForm.date ? '#CBD5E1' : PRIMARY_GRAD, border: 'none', borderRadius: 8, padding: '8px 18px', cursor: !taskForm.title.trim() || !taskForm.date ? 'not-allowed' : 'pointer' }}>
                          {savingTask ? 'Saving…' : 'Add Task'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Task list */}
                  <div style={{ flex: 1, padding: '4px 16px 16px', overflowY: 'auto' }}>
                    {tasks.length === 0 && !showTaskForm ? (
                      <EmptyState icon={Calendar} title="No tasks yet" sub="Add a task with a date and time — e.g. Call back on Friday at 4 PM" action={{ label: 'Add Task', onClick: () => setShowTaskForm(true) }} />
                    ) : (
                      <>
                        {overdue.length > 0 && <><SectionHead label="Overdue" count={overdue.length} />{overdue.map(t => <TaskCard key={t.id} task={t} />)}</>}
                        {today.length > 0 && <><SectionHead label="Today" count={today.length} />{today.map(t => <TaskCard key={t.id} task={t} />)}</>}
                        {upcoming.length > 0 && <><SectionHead label="Upcoming" count={upcoming.length} />{upcoming.map(t => <TaskCard key={t.id} task={t} />)}</>}
                        {done.length > 0 && <><SectionHead label="Completed" count={done.length} />{done.map(t => <TaskCard key={t.id} task={t} />)}</>}
                        {cancelled.length > 0 && <><SectionHead label="Cancelled" count={cancelled.length} />{cancelled.map(t => <TaskCard key={t.id} task={t} />)}</>}
                        {tasks.length > 0 && overdue.length === 0 && today.length === 0 && upcoming.length === 0 && done.length === 0 && cancelled.length === 0 && (
                          <EmptyState icon={Calendar} title="No tasks yet" sub="Add a task to get started" action={{ label: 'Add Task', onClick: () => setShowTaskForm(true) }} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ══════════════════════════════════════════════════
              RIGHT — Sidebar
          ══════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Lead Lifecycle */}
            <SideCard>
              <SideCardHeader title="Lead Lifecycle" icon={TrendingUp} />
              <div style={{ padding: '14px 12px' }}>
                {(() => {
                  const PIPELINE = ['New', 'Cold', 'Warm', 'Hot', 'Closed'] as const
                  const STAGE_CFG: Record<string, { color: string; emoji: string; desc: string }> = {
                    New:          { color: '#64748B', emoji: '📋', desc: 'Unworked — just assigned' },
                    Cold:         { color: '#2563EB', emoji: '❄️', desc: 'Calls / WA only' },
                    Warm:         { color: '#F59E0B', emoji: '🌡️', desc: 'VM / OBM / SV done' },
                    Hot:          { color: '#FF7043', emoji: '🔥', desc: 'EOI received' },
                    Closed:       { color: '#059669', emoji: '✅', desc: 'Deals' },
                    Disqualified: { color: '#94A3B8', emoji: '✗',  desc: 'NC / not proceeding' },
                  }
                  // Which activity type drives each stage
                  const STAGE_TRIGGER: Record<string, string[]> = {
                    Cold:   ['Call Made', 'Call Missed', 'WhatsApp Sent', 'WhatsApp Received', 'Email Sent'],
                    Warm:   ['VM Done', 'OBM Done', 'Site Visit Done', 'Site Visit Scheduled'],
                    Hot:    ['EOI Received'],
                    Closed: ['Deal Closed'],
                  }

                  const currentStatus  = lead.status ?? 'New'
                  const isDisqualified = currentStatus === 'Disqualified'
                  const currentIdx     = PIPELINE.indexOf(currentStatus as typeof PIPELINE[number])

                  // Build stage history from activities — what activity first reached each stage
                  const stageHistory: Record<string, { type: string; date: string }> = {}
                  const chrono = [...activities].reverse()
                  for (const act of chrono) {
                    for (const [stage, triggers] of Object.entries(STAGE_TRIGGER)) {
                      if (triggers.includes(act.type) && !stageHistory[stage]) {
                        stageHistory[stage] = { type: act.type, date: act.createdAt }
                      }
                    }
                  }

                  const curCfg = STAGE_CFG[currentStatus] ?? STAGE_CFG['New']

                  return (
                    <div>
                      <style>{`
                        @keyframes lc-ripple {
                          0%   { box-shadow: 0 0 0 0 ${curCfg.color}70, 0 0 0 0 ${curCfg.color}35; }
                          70%  { box-shadow: 0 0 0 8px ${curCfg.color}00, 0 0 0 16px ${curCfg.color}00; }
                          100% { box-shadow: 0 0 0 0 ${curCfg.color}00, 0 0 0 0  ${curCfg.color}00; }
                        }
                        @keyframes lc-shine {
                          0%   { background-position: -220% center; }
                          100% { background-position: 220% center; }
                        }
                        @keyframes lc-flow {
                          0%, 100% { opacity: 0.45; }
                          50%       { opacity: 1; }
                        }
                      `}</style>

                      {PIPELINE.map((stage, idx) => {
                        const cfg      = STAGE_CFG[stage]
                        const isDone   = !isDisqualified && currentIdx > idx
                        const isCur    = currentStatus === stage
                        const isFuture = currentIdx < idx
                        const hist     = stageHistory[stage]

                        return (
                          <div key={stage}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 10px', borderRadius: 10,
                              // shimmer sweep on current stage
                              background: isCur
                                ? `linear-gradient(105deg, ${cfg.color}0e 20%, ${cfg.color}28 50%, ${cfg.color}0e 80%)`
                                : 'transparent',
                              backgroundSize: isCur ? '250% 100%' : undefined,
                              animation: isCur ? 'lc-shine 3.5s ease-in-out infinite' : 'none',
                              outline: isCur ? `1.5px solid ${cfg.color}30` : 'none',
                            }}>
                              {/* Circle — ripple on current */}
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                background: isDone
                                  ? `linear-gradient(145deg, ${cfg.color}, ${cfg.color}cc)`
                                  : isCur ? `linear-gradient(145deg, ${cfg.color}, ${cfg.color}dd)` : '#F1F5F9',
                                border: `2px solid ${isDone || isCur ? cfg.color : '#E2E8F0'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: isCur ? 'lc-ripple 2.4s ease-out infinite' : 'none',
                                position: 'relative',
                              }}>
                                {isDone
                                  ? <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>✓</span>
                                  : <span style={{ filter: isFuture ? 'grayscale(1) opacity(0.25)' : 'none', fontSize: 13 }}>{cfg.emoji}</span>}
                              </div>

                              {/* Text */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: isCur ? 700 : isDone ? 600 : 400, color: isCur ? cfg.color : isDone ? cfg.color : isFuture ? '#CBD5E1' : '#94A3B8', display: 'flex', alignItems: 'center', gap: 5 }}>
                                  {stage}
                                  {isCur && <span style={{ fontSize: 10, fontWeight: 700, background: `${cfg.color}20`, color: cfg.color, padding: '1px 6px', borderRadius: 99 }}>Current</span>}
                                </div>
                                {hist && !isCur ? (
                                  <div style={{ fontSize: 10, color: isDone ? cfg.color : MUTED, marginTop: 1, opacity: 0.8 }}>
                                    {hist.type} · {formatShortDate(hist.date)}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 10, color: isFuture ? '#CBD5E1' : MUTED, marginTop: 1 }}>{cfg.desc}</div>
                                )}
                              </div>
                            </div>

                            {/* Connector — liquid pulse on done segments */}
                            {idx < PIPELINE.length - 1 && (
                              <div style={{
                                marginLeft: 25, width: 2, height: 10, borderRadius: 1,
                                background: isDone ? cfg.color : '#E2E8F0',
                                animation: isDone ? 'lc-flow 2s ease-in-out infinite' : 'none',
                              }} />
                            )}
                          </div>
                        )
                      })}

                      {/* Disqualified */}
                      <div style={{ marginTop: 10, borderTop: `1px dashed ${BORDER}`, paddingTop: 10 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 9,
                          background: isDisqualified ? 'rgba(148,163,184,0.12)' : 'transparent',
                          outline: isDisqualified ? '2px solid rgba(148,163,184,0.3)' : 'none',
                        }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: isDisqualified ? '#94A3B8' : '#F1F5F9', border: `2px solid ${isDisqualified ? '#94A3B8' : '#E2E8F0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isDisqualified
                              ? <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>✗</span>
                              : <span style={{ opacity: 0.3, fontSize: 13 }}>✗</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: isDisqualified ? 700 : 400, color: isDisqualified ? '#94A3B8' : '#CBD5E1', display: 'flex', alignItems: 'center', gap: 5 }}>
                              Disqualified
                              {isDisqualified && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(148,163,184,0.2)', color: '#94A3B8', padding: '1px 6px', borderRadius: 99 }}>Current</span>}
                            </div>
                            <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>NC / not proceeding</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </SideCard>

            <PropertyMatcher lead={{ name, city: lead.city ?? null, budgetMin: lead.budgetMin ?? null, budgetMax: lead.budgetMax ?? null, propertyType: lead.propertyType ?? null, timeline: lead.timeline ?? null, localities: lead.localities ?? null, phone: phone || null }} />
            <FollowUpWriter lead={{ leadId, name, city: lead.city ?? null, budget: formatBudget(lead.budgetMin, lead.budgetMax) !== '—' ? formatBudget(lead.budgetMin, lead.budgetMax) : null, propertyType: lead.propertyType?.join(', ') ?? null, timeline: lead.timeline ?? null, score, lastActivity: activities[0]?.type ?? null, status: lead.status ?? null, phone: phone || null }} />

          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <LogActivityModal
        leadId={leadId}
        leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()}
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        currentStatus={lead.status ?? 'New'}
        existingActivityTypes={activities.map(a => a.type)}
        onActivityLogged={(result) => {
          setShowActivityModal(false)
          if (result?.statusAdvancedTo) setLead(p => p ? { ...p, status: result.statusAdvancedTo! } : p)
          fetchLead(); fetchTasks()
        }}
      />
      <WhatsAppModal isOpen={showWhatsAppModal} onClose={() => { setShowWhatsAppModal(false); fetchLead() }} leadId={leadId} leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()} leadPhone={lead.phones.primaryPhoneNumber ?? ''} city={lead.city ?? ''} />
      <CallModal isOpen={showCallModal} onClose={() => setShowCallModal(false)} leadId={leadId} leadName={`${lead.name.firstName} ${lead.name.lastName}`.trim()} leadPhone={lead.phones.primaryPhoneNumber ?? ''} onLogged={fetchLead} />

      {/* ── Email Compose Modal ── */}
      {showEmailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && !sendingEmail && setShowEmailModal(false)}>
          <div style={{ background: PANEL, borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: PRIMARY_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail style={{ width: 16, height: 16, color: BLUE }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>New Email</div>
                  <div style={{ fontSize: 11, color: MUTED }}>To: {name} &lt;{email}&gt;</div>
                </div>
              </div>
              <button onClick={() => !sendingEmail && setShowEmailModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {/* Body */}
            {emailSent ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <CheckCircle style={{ width: 26, height: 26, color: EMERALD }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Email sent!</div>
                <div style={{ fontSize: 13, color: MUTED }}>Activity logged on this lead's timeline.</div>
              </div>
            ) : (
              <div style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Subject */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>SUBJECT</label>
                  <input
                    value={emailForm.subject}
                    onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. Following up on your enquiry"
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: `1.5px solid ${BORDER}`, borderRadius: 10, outline: 'none', color: TEXT, background: '#FAFBFC', boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                    onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                  />
                </div>
                {/* Body */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>MESSAGE</label>
                  <textarea
                    value={emailForm.body}
                    onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
                    placeholder={`Hi ${lead.name.firstName},\n\nThank you for your interest in…`}
                    rows={8}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: `1.5px solid ${BORDER}`, borderRadius: 10, outline: 'none', color: TEXT, background: '#FAFBFC', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                    onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                  />
                </div>

                {emailError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9 }}>
                    <AlertCircle style={{ width: 14, height: 14, color: RED, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: RED }}>{emailError}</span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowEmailModal(false)}
                    style={{ flex: 1, padding: '10px 0', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSendEmail} disabled={sendingEmail || !emailForm.subject.trim() || !emailForm.body.trim()}
                    style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', background: sendingEmail ? '#ccc' : PRIMARY_GRAD, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: sendingEmail ? 'not-allowed' : 'pointer', opacity: (!emailForm.subject.trim() || !emailForm.body.trim()) ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                    {sendingEmail
                      ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Sending…</>
                      : <><Send style={{ width: 14, height: 14 }} /> Send Email</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 20px', textAlign: 'center', background: waStyle ? 'transparent' : undefined }}>
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
