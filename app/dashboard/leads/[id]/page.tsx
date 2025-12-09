'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, Lead, LeadActivity } from '@/lib/supabase'
import { LogActivityModal } from '@/components/LogActivityModal'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Building,
  DollarSign,
  Clock,
  Tag,
  TrendingUp,
  Calendar,
  Edit,
  Trash2,
  Loader2,
  MapPin,
  Activity,
  AlertCircle,
  Plus,
  MessageCircle,
  Eye,
  Users,
  Bell,
  FileText,
  CheckCircle,
  XCircle,
  MinusCircle,
  HelpCircle,
  Zap,
  CreditCard,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from 'lucide-react'

// Icon mapping for score breakdown
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  Zap,
  Clock,
  Activity,
  TrendingUp,
  DollarSign,
  CreditCard,
  MapPin,
  FileText,
  Calendar,
  Eye,
  Building,
  ThumbsUp,
  ThumbsDown,
  Users,
  AlertCircle,
  AlertTriangle,
}

// Icon mapping for activity types
const ACTIVITY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Call Made': Phone,
  'Email Sent': Mail,
  'WhatsApp Sent': MessageCircle,
  'Property Viewed': Eye,
  'Site Visit Scheduled': Calendar,
  'Meeting Held': Users,
  'Follow-up Required': Bell,
  'Note Added': FileText,
}

const OUTCOME_STYLES: Record<string, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  'Positive': { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: CheckCircle },
  'Neutral': { color: 'text-slate-400', bgColor: 'bg-slate-500/20', icon: MinusCircle },
  'Negative': { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: XCircle },
  'No Response': { color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: HelpCircle },
}

function getStatusFromScore(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 70) {
    return { label: 'Hot', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30' }
  } else if (score >= 40) {
    return { label: 'Warm', color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30' }
  }
  return { label: 'Cold', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' }
}

function getScoreColor(score: number): { text: string; bg: string; border: string } {
  if (score >= 70) return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500' }
  if (score >= 40) return { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500' }
  return { text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500' }
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export default function LeadDetailPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string

  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('agent_id', session.user.id)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Lead not found')
        } else {
          throw fetchError
        }
        return
      }

      setLead(data)
    } catch (err) {
      console.error('Error fetching lead:', err)
      setError('Failed to load lead details')
    } finally {
      setLoading(false)
    }
  }, [leadId, router])

  const fetchActivities = useCallback(async () => {
    try {
      setActivitiesLoading(true)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) return

      const response = await fetch(`/api/leads/${leadId}/activities`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      if (response.ok) {
        setActivities(data.activities || [])
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
    } finally {
      setActivitiesLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    if (leadId) {
      fetchLead()
      fetchActivities()
    }
  }, [leadId, fetchLead, fetchActivities])

  const handleActivityLogged = () => {
    fetchLead()
    fetchActivities()
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)
        .eq('agent_id', session.user.id)

      if (deleteError) throw deleteError

      router.push('/dashboard/leads')
    } catch (err) {
      console.error('Error deleting lead:', err)
      setError('Failed to delete lead')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading lead details...</p>
        </div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 mb-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">{error || 'Lead not found'}</h2>
          <p className="text-slate-400 mb-6">The lead you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.</p>
          <Link
            href="/dashboard/leads"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Leads
          </Link>
        </div>
      </div>
    )
  }

  const status = getStatusFromScore(lead.intent_score)
  const scoreColors = getScoreColor(lead.intent_score)

  // Parse score breakdown if it's an array (new format)
  const scoreBreakdown = Array.isArray(lead.score_breakdown) ? lead.score_breakdown : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Leads
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700">
              <User className="h-7 w-7 text-slate-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{lead.name}</h1>
              <span className={`inline-flex px-3 py-1 mt-1 rounded-full text-xs font-medium border ${status.bgColor} ${status.color}`}>
                {status.label} Lead
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowActivityModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Plus className="h-4 w-4" />
              Log Activity
            </button>
            <button
              onClick={() => router.push(`/dashboard/leads/${lead.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Info Card */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-500" />
                Contact Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Phone className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-white">{lead.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Mail className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-white">{lead.email || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Requirements Card */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building className="h-5 w-5 text-emerald-500" />
                Requirements
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Building className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Property Type</p>
                    <p className="text-white">{lead.property_type || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <MapPin className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Locations</p>
                    <p className="text-white">
                      {lead.locations && lead.locations.length > 0
                        ? lead.locations.join(', ')
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <DollarSign className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Budget</p>
                    <p className="text-white">
                      {lead.budget_min && lead.budget_max
                        ? `${formatCurrency(lead.budget_min)} - ${formatCurrency(lead.budget_max)}`
                        : lead.budget_min
                        ? `From ${formatCurrency(lead.budget_min)}`
                        : lead.budget_max
                        ? `Up to ${formatCurrency(lead.budget_max)}`
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Clock className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Timeline</p>
                    <p className="text-white">{lead.timeline || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  Activity Timeline
                </h2>
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {activitiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 mb-3">
                    <Clock className="h-6 w-6 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm">No activities recorded yet</p>
                  <button
                    onClick={() => setShowActivityModal(true)}
                    className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 transition-colors"
                  >
                    Log your first activity →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity, index) => {
                    const ActivityIcon = ACTIVITY_TYPE_ICONS[activity.activity_type] || Activity
                    const outcomeData = activity.activity_data?.outcome
                      ? OUTCOME_STYLES[activity.activity_data.outcome]
                      : null
                    const OutcomeIcon = outcomeData?.icon

                    return (
                      <div
                        key={activity.id}
                        className="relative pl-8 pb-4 border-l-2 border-slate-800 last:border-l-transparent last:pb-0"
                      >
                        {/* Timeline dot */}
                        <div className="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>

                        {/* Activity card */}
                        <div className="bg-slate-800/50 rounded-xl p-4 ml-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700">
                                <ActivityIcon className="h-4 w-4 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">
                                  {activity.activity_type}
                                </p>
                                <p className="text-slate-500 text-xs">
                                  {formatRelativeTime(activity.created_at)}
                                </p>
                              </div>
                            </div>
                            {outcomeData && OutcomeIcon && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${outcomeData.bgColor} ${outcomeData.color}`}>
                                <OutcomeIcon className="h-3 w-3" />
                                {activity.activity_data.outcome}
                              </span>
                            )}
                          </div>

                          {/* Notes */}
                          {activity.activity_data?.notes && (
                            <p className="text-slate-300 text-sm mt-2">
                              {activity.activity_data.notes}
                            </p>
                          )}

                          {/* Response time */}
                          {activity.activity_data?.response_time && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                              <Clock className="h-3 w-3" />
                              Response: {activity.activity_data.response_time}
                            </div>
                          )}

                          {/* Questions asked */}
                          {activity.activity_data?.questions_asked && activity.activity_data.questions_asked.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {activity.activity_data.questions_asked.map((question: string, qIndex: number) => (
                                <span
                                  key={qIndex}
                                  className="inline-flex px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full"
                                >
                                  {question}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Intent Score Card */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Intent Score
              </h2>
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-24 h-24 rounded-full border-4 ${scoreColors.border} ${scoreColors.bg}`}
                >
                  <span className={`text-3xl font-bold ${scoreColors.text}`}>{lead.intent_score}</span>
                </div>
                <p className={`mt-3 font-medium ${status.color}`}>{status.label}</p>
              </div>

              {/* Score Breakdown - New format with icons */}
              {scoreBreakdown && scoreBreakdown.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <p className="text-sm text-slate-400 mb-3">Score Breakdown</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {scoreBreakdown.map((item: { factor: string; points: number; icon: string }, index: number) => {
                      const IconComponent = ICON_MAP[item.icon] || Activity
                      const isPositive = item.points > 0
                      const isNegative = item.points < 0
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <IconComponent
                              className={`h-4 w-4 flex-shrink-0 ${
                                isPositive ? 'text-emerald-500' : isNegative ? 'text-red-500' : 'text-slate-500'
                              }`}
                            />
                            <span className="text-slate-400 truncate">{item.factor}</span>
                          </div>
                          <span
                            className={`font-medium flex-shrink-0 ${
                              isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}{item.points}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Legacy score breakdown format */}
              {!scoreBreakdown && lead.score_breakdown && typeof lead.score_breakdown === 'object' && (
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <p className="text-sm text-slate-400 mb-3">Score Factors</p>
                  <div className="space-y-2 text-sm">
                    {lead.score_breakdown.timeline && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Timeline</span>
                        <span className="text-slate-300">{lead.score_breakdown.timeline}</span>
                      </div>
                    )}
                    {lead.score_breakdown.budget_provided && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Budget</span>
                        <span className="text-emerald-400">Provided ✓</span>
                      </div>
                    )}
                    {lead.score_breakdown.property_type_provided && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Property Type</span>
                        <span className="text-emerald-400">Specified ✓</span>
                      </div>
                    )}
                    {lead.score_breakdown.source && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Source</span>
                        <span className="text-slate-300">{lead.score_breakdown.source}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Meta Info Card */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-500" />
                Details
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500">Source</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Tag className="h-4 w-4 text-slate-500" />
                    <p className="text-white">{lead.source || '—'}</p>
                  </div>
                  {lead.source_detail && (
                    <p className="text-slate-500 text-sm mt-0.5">{lead.source_detail}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-white capitalize mt-1">{lead.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">First Contact</p>
                  <p className="text-white mt-1">{formatDate(lead.first_contact_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last Activity</p>
                  <p className="text-white mt-1">{formatDate(lead.last_activity_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Created</p>
                  <p className="text-white mt-1">{formatDate(lead.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log Activity Modal */}
      <LogActivityModal
        leadId={leadId}
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onActivityLogged={handleActivityLogged}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/20 mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white text-center mb-2">Delete Lead</h3>
              <p className="text-slate-400 text-center mb-6">
                Are you sure you want to delete <span className="text-white font-medium">{lead.name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-5 w-5" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
