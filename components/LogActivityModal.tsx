'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  Eye,
  Calendar,
  Users,
  Bell,
  FileText,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  MinusCircle,
  HelpCircle,
  Activity,
  FlaskConical,
} from 'lucide-react'

type LogActivityModalProps = {
  leadId: string
  isOpen: boolean
  onClose: () => void
  onActivityLogged: () => void
}

const ACTIVITY_TYPES = [
  { value: 'Call Made', label: 'Call Made', icon: Phone },
  { value: 'Email Sent', label: 'Email Sent', icon: Mail },
  { value: 'WhatsApp Sent', label: 'WhatsApp Sent', icon: MessageCircle },
  { value: 'Property Viewed', label: 'Property Viewed', icon: Eye },
  { value: 'Site Visit Scheduled', label: 'Site Visit Scheduled', icon: Calendar },
  { value: 'Meeting Held', label: 'Meeting Held', icon: Users },
  { value: 'Follow-up Required', label: 'Follow-up Required', icon: Bell },
  { value: 'Note Added', label: 'Note Added', icon: FileText },
]

const OUTCOME_OPTIONS = [
  { value: 'Positive', label: 'Positive', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30', icon: CheckCircle },
  { value: 'Neutral', label: 'Neutral', color: 'text-slate-400', bgColor: 'bg-slate-500/20 border-slate-500/30', icon: MinusCircle },
  { value: 'Negative', label: 'Negative', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30', icon: XCircle },
  { value: 'No Response', label: 'No Response', color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30', icon: HelpCircle },
]

const RESPONSE_TIME_OPTIONS = [
  { value: '', label: 'Select response time' },
  { value: 'Within 2 hours', label: 'Within 2 hours' },
  { value: 'Within 24 hours', label: 'Within 24 hours' },
  { value: '1-3 days', label: '1-3 days' },
  { value: '3+ days', label: '3+ days' },
  { value: 'No response yet', label: 'No response yet' },
]

const QUESTION_OPTIONS = [
  { value: 'Asked about pricing', label: 'Asked about pricing' },
  { value: 'Asked about payment plans', label: 'Asked about payment plans' },
  { value: 'Asked about location/amenities', label: 'Asked about location/amenities' },
  { value: 'Requested site visit', label: 'Requested site visit' },
  { value: 'Asked about documentation', label: 'Asked about documentation' },
  { value: 'Asked about possession date', label: 'Asked about possession date' },
]

export function LogActivityModal({ leadId, isOpen, onClose, onActivityLogged }: LogActivityModalProps) {
  const [activityType, setActivityType] = useState('')
  const [activityDate, setActivityDate] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [notes, setNotes] = useState('')
  const [outcome, setOutcome] = useState('')
  const [responseTime, setResponseTime] = useState('')
  const [questionsAsked, setQuestionsAsked] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simulatePast, setSimulatePast] = useState(false) // Testing feature

  const handleQuestionToggle = (question: string) => {
    setQuestionsAsked((prev) =>
      prev.includes(question)
        ? prev.filter((q) => q !== question)
        : [...prev, question]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!activityType) {
      setError('Please select an activity type')
      return
    }

    if (!notes || notes.trim().length < 10) {
      setError('Notes must be at least 10 characters')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('You must be logged in')
        return
      }

      const response = await fetch(`/api/leads/${leadId}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          activity_type: activityType,
          activity_date: activityDate,
          notes: notes.trim(),
          outcome: outcome || null,
          response_time: responseTime || null,
          questions_asked: questionsAsked,
          simulate_past: simulatePast, // Testing: set created_at to 10 days ago
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log activity')
      }

      // Reset form
      setActivityType('')
      setNotes('')
      setOutcome('')
      setResponseTime('')
      setQuestionsAsked([])
      setSimulatePast(false)

      // Callback and close
      onActivityLogged()
      onClose()
    } catch (err) {
      console.error('Error logging activity:', err)
      setError(err instanceof Error ? err.message : 'Failed to log activity')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 flex items-center justify-between px-6 py-4 border-b border-slate-800 z-10">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              Log Activity
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Activity Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Activity Type <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ACTIVITY_TYPES.map((type) => {
                  const Icon = type.icon
                  const isSelected = activityType === type.value
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setActivityType(type.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs text-center leading-tight">{type.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date/Time */}
            <div>
              <label htmlFor="activity_date" className="block text-sm font-medium text-slate-300 mb-2">
                Date & Time
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  id="activity_date"
                  type="datetime-local"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-2">
                Notes <span className="text-red-400">*</span>
                <span className="text-slate-500 font-normal ml-2">(min 10 characters)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none"
                placeholder="Describe what happened during this interaction..."
              />
              <p className="text-xs text-slate-500 mt-1">
                {notes.length}/10 characters minimum
              </p>
            </div>

            {/* Outcome */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Outcome
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OUTCOME_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = outcome === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOutcome(isSelected ? '' : opt.value)}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? `${opt.bgColor} ${opt.color}`
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Response Time */}
            <div>
              <label htmlFor="response_time" className="block text-sm font-medium text-slate-300 mb-2">
                Response Time <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <select
                id="response_time"
                value={responseTime}
                onChange={(e) => setResponseTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none"
              >
                {RESPONSE_TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-800">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Questions Asked */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Questions Asked <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUESTION_OPTIONS.map((question) => {
                  const isChecked = questionsAsked.includes(question.value)
                  return (
                    <button
                      key={question.value}
                      type="button"
                      onClick={() => handleQuestionToggle(question.value)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                        isChecked
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                          isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm">{question.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Testing: Simulate Past Activity */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <button
                type="button"
                onClick={() => setSimulatePast(!simulatePast)}
                className="flex items-center gap-3 w-full text-left"
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    simulatePast ? 'bg-amber-500 border-amber-500' : 'border-amber-500/50'
                  }`}
                >
                  {simulatePast && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Simulate 10 days ago</span>
                  </div>
                  <p className="text-xs text-amber-400/70 mt-0.5">Testing: This will set created_at to 10 days ago to test time decay</p>
                </div>
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Logging...
                  </>
                ) : (
                  <>
                    <Activity className="h-5 w-5" />
                    Log Activity
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

