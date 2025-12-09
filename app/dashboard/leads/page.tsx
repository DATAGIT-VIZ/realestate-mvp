'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Lead } from '@/lib/supabase'
import { AddLeadModal } from '@/components/AddLeadModal'
import {
  Users,
  Phone,
  Mail,
  Search,
  Plus,
  Filter,
  Eye,
  Loader2,
  UserPlus,
  Clock,
  ChevronDown,
  Database,
} from 'lucide-react'

type StatusFilter = 'all' | 'hot' | 'warm' | 'cold'

function getStatusFromScore(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 70) {
    return { label: 'Hot', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30' }
  } else if (score >= 40) {
    return { label: 'Warm', color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30' }
  }
  return { label: 'Cold', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' }
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400 border-emerald-500'
  if (score >= 40) return 'text-amber-400 border-amber-500'
  return 'text-red-400 border-red-500'
}

function getRelativeTime(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  return 'Just now'
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const sampleLeads = [
    {
      name: 'Rajesh Sharma',
      phone: '+91 98765 43210',
      email: 'rajesh.sharma@gmail.com',
      source: 'Referral',
      property_type: 'Villa',
      budget_min: 15000000,
      budget_max: 25000000,
      timeline: 'Immediate',
      locations: ['Whitefield', 'Sarjapur Road'],
      intent_score: 85,
    },
    {
      name: 'Priya Patel',
      phone: '+91 87654 32109',
      email: 'priya.patel@outlook.com',
      source: 'Website',
      property_type: 'Apartment',
      budget_min: 8000000,
      budget_max: 12000000,
      timeline: '1-3 months',
      locations: ['Indiranagar', 'Koramangala'],
      intent_score: 75,
    },
    {
      name: 'Amit Kumar',
      phone: '+91 76543 21098',
      email: 'amit.kumar@yahoo.com',
      source: 'Property Portal',
      property_type: 'Apartment',
      budget_min: 5000000,
      budget_max: 7500000,
      timeline: '3-6 months',
      locations: ['Electronic City', 'HSR Layout'],
      intent_score: 60,
    },
    {
      name: 'Sneha Reddy',
      phone: '+91 65432 10987',
      email: 'sneha.reddy@gmail.com',
      source: 'Social Media',
      property_type: 'Plot',
      budget_min: 3000000,
      budget_max: 5000000,
      timeline: '6-12 months',
      locations: ['Devanahalli', 'Yelahanka'],
      intent_score: 45,
    },
    {
      name: 'Vikram Singh',
      phone: '+91 54321 09876',
      email: null,
      source: 'Cold Call',
      property_type: 'Commercial',
      budget_min: null,
      budget_max: null,
      timeline: 'Just browsing',
      locations: null,
      intent_score: 30,
    },
  ]

  const seedSampleData = async () => {
    try {
      setSeeding(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const now = new Date().toISOString()
      const leadsToInsert = sampleLeads.map((lead, index) => ({
        agent_id: session.user.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        property_type: lead.property_type,
        budget_min: lead.budget_min,
        budget_max: lead.budget_max,
        timeline: lead.timeline,
        locations: lead.locations,
        intent_score: lead.intent_score,
        score_breakdown: {
          timeline: lead.timeline,
          budget_provided: !!(lead.budget_min && lead.budget_max),
          property_type_provided: !!lead.property_type,
          source: lead.source,
        },
        status: 'new',
        first_contact_date: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString(),
        last_activity_date: new Date(Date.now() - (index * 12 * 60 * 60 * 1000)).toISOString(),
      }))

      const { error: insertError } = await supabase.from('leads').insert(leadsToInsert)

      if (insertError) {
        throw insertError
      }

      await fetchLeads()
    } catch (err) {
      console.error('Error seeding data:', err)
      setError('Failed to seed sample data. Please try again.')
    } finally {
      setSeeding(false)
    }
  }

  const fetchLeads = async () => {
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
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setLeads(data || [])
    } catch (err) {
      console.error('Error fetching leads:', err)
      setError('Failed to load leads. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        lead.name.toLowerCase().includes(searchLower) ||
        lead.phone.toLowerCase().includes(searchLower) ||
        (lead.email && lead.email.toLowerCase().includes(searchLower))

      // Status filter
      let matchesStatus = true
      if (statusFilter !== 'all') {
        const score = lead.intent_score
        if (statusFilter === 'hot') matchesStatus = score >= 70
        else if (statusFilter === 'warm') matchesStatus = score >= 40 && score < 70
        else if (statusFilter === 'cold') matchesStatus = score < 40
      }

      return matchesSearch && matchesStatus
    })
  }, [leads, searchQuery, statusFilter])

  const handleLeadAdded = () => {
    setShowAddModal(false)
    fetchLeads()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading leads...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <Users className="h-8 w-8 text-emerald-500" />
              Leads
            </h1>
            <p className="text-slate-400 mt-1">
              Manage and track your real estate leads
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={seedSampleData}
              disabled={seeding}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {seeding ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Database className="h-5 w-5" />
              )}
              <span className="hidden sm:inline">{seeding ? 'Seeding...' : 'Seed Sample Data'}</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-200"
            >
              <Plus className="h-5 w-5" />
              Add Lead
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white hover:bg-slate-800 transition-colors min-w-[140px]"
            >
              <Filter className="h-5 w-5 text-slate-400" />
              <span className="capitalize">{statusFilter === 'all' ? 'All Status' : statusFilter}</span>
              <ChevronDown className="h-4 w-4 text-slate-400 ml-auto" />
            </button>
            {showFilterDropdown && (
              <div className="absolute top-full mt-2 right-0 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                {(['all', 'hot', 'warm', 'cold'] as StatusFilter[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status)
                      setShowFilterDropdown(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-slate-700 transition-colors capitalize ${
                      statusFilter === status ? 'bg-slate-700 text-emerald-400' : 'text-white'
                    }`}
                  >
                    {status === 'all' ? 'All Status' : status}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredLeads.length === 0 && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 mb-4">
              <UserPlus className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery || statusFilter !== 'all' ? 'No leads found' : 'No leads yet'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Add your first lead to get started!'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  Add Your First Lead
                </button>
                <span className="text-slate-500">or</span>
                <button
                  onClick={seedSampleData}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {seeding ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Database className="h-5 w-5" />
                  )}
                  {seeding ? 'Seeding...' : 'Seed Sample Data'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Desktop Table */}
        {filteredLeads.length > 0 && (
          <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Name</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Phone</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-slate-400">Score</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Source</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Last Activity</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const status = getStatusFromScore(lead.intent_score)
                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div>
                          <p className="text-white font-medium">{lead.name}</p>
                          {lead.email && (
                            <p className="text-slate-500 text-sm flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-300 flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-500" />
                          {lead.phone}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${status.bgColor} ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 ${getScoreColor(
                            lead.intent_score
                          )}`}
                        >
                          <span className="text-sm font-bold">{lead.intent_score}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-400">{lead.source || '—'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {getRelativeTime(lead.last_activity_date || lead.created_at)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Cards */}
        {filteredLeads.length > 0 && (
          <div className="md:hidden space-y-4">
            {filteredLeads.map((lead) => {
              const status = getStatusFromScore(lead.intent_score)
              return (
                <div
                  key={lead.id}
                  className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-medium">{lead.name}</h3>
                      {lead.email && (
                        <p className="text-slate-500 text-sm flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </p>
                      )}
                    </div>
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${getScoreColor(
                        lead.intent_score
                      )}`}
                    >
                      <span className="text-sm font-bold">{lead.intent_score}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${status.bgColor} ${status.color}`}
                    >
                      {status.label}
                    </span>
                    {lead.source && (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {lead.source}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      {lead.phone}
                    </span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getRelativeTime(lead.last_activity_date || lead.created_at)}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/leads/${lead.id}`}
                    className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        {/* Lead count */}
        {filteredLeads.length > 0 && (
          <p className="text-slate-500 text-sm mt-4 text-center">
            Showing {filteredLeads.length} of {leads.length} leads
          </p>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} onSuccess={handleLeadAdded} />
      )}
    </div>
  )
}

