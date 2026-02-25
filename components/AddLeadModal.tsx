'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateLeadScore } from '@/lib/scoring'
import {
  X,
  User,
  Phone,
  Mail,
  Building,
  DollarSign,
  Clock,
  Tag,
  Loader2,
  UserPlus,
} from 'lucide-react'

type AddLeadModalProps = {
  onClose: () => void
  onSuccess: () => void
}

type FormData = {
  name: string
  phone: string
  email: string
  source: string
  property_type: string
  budget_min: string
  budget_max: string
  timeline: string
}

type FormErrors = {
  name?: string
  phone?: string
  general?: string
}

const SOURCE_OPTIONS = [
  { value: '', label: 'Select source' },
  { value: 'Website', label: 'Website' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Cold Call', label: 'Cold Call' },
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Property Portal', label: 'Property Portal' },
  { value: 'Other', label: 'Other' },
]

const PROPERTY_TYPE_OPTIONS = [
  { value: '', label: 'Select property type' },
  { value: 'Apartment', label: 'Apartment' },
  { value: 'Villa', label: 'Villa' },
  { value: 'Plot', label: 'Plot' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Office Space', label: 'Office Space' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Other', label: 'Other' },
]

const TIMELINE_OPTIONS = [
  { value: '', label: 'Select timeline' },
  { value: 'Immediate', label: 'Immediate (within 1 month)' },
  { value: '1-3 months', label: '1-3 months' },
  { value: '3-6 months', label: '3-6 months' },
  { value: '6-12 months', label: '6-12 months' },
  { value: '12+ months', label: '12+ months' },
  { value: 'Just browsing', label: 'Just browsing' },
]

export function AddLeadModal({ onClose, onSuccess }: AddLeadModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    email: '',
    source: '',
    property_type: '',
    budget_min: '',
    budget_max: '',
    timeline: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (formData.phone.trim().length < 10) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)
    setErrors({})

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setErrors({ general: 'You must be logged in to add leads' })
        return
      }

      const { score: intentScore, breakdown: scoreBreakdown } = calculateLeadScore(formData)
      const now = new Date().toISOString()

      const leadData = {
        agent_id: session.user.id,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        source: formData.source || null,
        property_type: formData.property_type || null,
        budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
        budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
        timeline: formData.timeline || null,
        intent_score: intentScore,
        score_breakdown: scoreBreakdown,
        status: 'new',
        first_contact_date: now,
        last_activity_date: now,
      }

      const { error: insertError } = await supabase.from('leads').insert(leadData)

      if (insertError) {
        throw insertError
      }

      onSuccess()
    } catch (err) {
      console.error('Error adding lead:', err)
      setErrors({ general: 'Failed to add lead. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#7B5EA7]" />
              Add New Lead
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B5EA7]/20 focus:border-[#7B5EA7] transition-all ${errors.name ? 'border-red-400' : 'border-gray-200'
                    }`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B5EA7]/20 focus:border-[#7B5EA7] transition-all ${errors.phone ? 'border-red-400' : 'border-gray-200'
                    }`}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B5EA7]/20 focus:border-[#7B5EA7] transition-all"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            {/* Source and Property Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Source
                </label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    id="source"
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B5EA7]/20 focus:border-[#7B5EA7] transition-all appearance-none"
                  >
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="property_type" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Property Type
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    id="property_type"
                    name="property_type"
                    value={formData.property_type}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B5EA7]/20 focus:border-[#7B5EA7] transition-all appearance-none"
                  >
                    {PROPERTY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Budget */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="budget_min" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Budget Min
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="budget_min"
                    name="budget_min"
                    type="number"
                    value={formData.budget_min}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B5EA7]/20 focus:border-[#7B5EA7] transition-all"
                    placeholder="50,000"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="budget_max" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Budget Max
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="budget_max"
                    name="budget_max"
                    type="number"
                    value={formData.budget_max}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B5EA7]/20 focus:border-[#7B5EA7] transition-all"
                    placeholder="100,000"
                  />
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <label htmlFor="timeline" className="block text-sm font-medium text-gray-700 mb-1.5">
                Timeline
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  id="timeline"
                  name="timeline"
                  value={formData.timeline}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B5EA7]/20 focus:border-[#7B5EA7] transition-all appearance-none"
                >
                  {TIMELINE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* General Error */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#7B5EA7] hover:bg-[#6A4F91] text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Add Lead
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

