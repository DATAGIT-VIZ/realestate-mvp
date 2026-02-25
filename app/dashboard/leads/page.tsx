'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Lead } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { AddLeadModal } from '@/components/AddLeadModal'
import { KanbanBoard } from '@/components/crm/KanbanBoard'
import { calculateLeadScore } from '@/lib/scoring'
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
  LayoutGrid,
  List,
} from 'lucide-react'

// ─── Design tokens (matching analytics) ─────────────────────────────────────
const BG = '#080D18'
const PANEL = '#0E1623'
const BORDER = 'rgba(255,255,255,0.06)'
const AMBER = '#F59E0B'
const EMERALD = '#10B981'
const RED_HOT = '#FB923C'
const TEXT = '#F1F5F9'
const MUTED = 'rgba(255,255,255,0.35)'

type StatusFilter = 'all' | 'hot' | 'warm' | 'cold'

function getStatusStyle(score: number): { label: string; color: string; bg: string } {
  if (score >= 70) return { label: 'High Intent', color: RED_HOT, bg: 'rgba(251,146,60,0.12)' }
  if (score >= 40) return { label: 'Medium', color: AMBER, bg: 'rgba(245,158,11,0.12)' }
  return { label: 'Low', color: MUTED, bg: 'rgba(255,255,255,0.05)' }
}

function getScoreDotColor(score: number): string {
  if (score >= 70) return RED_HOT
  if (score >= 40) return AMBER
  return '#475569'
}

function getRelativeTime(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}

export default function LeadsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')

  const sampleLeads = [
    { name: 'Rajesh Sharma', phone: '+91 98765 43210', email: 'rajesh.sharma@gmail.com', source: 'Referral', property_type: 'Villa', budget_min: 15000000, budget_max: 25000000, timeline: 'Immediate', locations: ['Whitefield', 'Sarjapur Road'], intent_score: 85 },
    { name: 'Priya Patel', phone: '+91 87654 32109', email: 'priya.patel@outlook.com', source: 'Website', property_type: 'Apartment', budget_min: 8000000, budget_max: 12000000, timeline: '1-3 months', locations: ['Indiranagar', 'Koramangala'], intent_score: 75 },
    { name: 'Amit Kumar', phone: '+91 76543 21098', email: 'amit.kumar@yahoo.com', source: 'Property Portal', property_type: 'Apartment', budget_min: 5000000, budget_max: 7500000, timeline: '3-6 months', locations: ['Electronic City', 'HSR'], intent_score: 60 },
    { name: 'Sneha Reddy', phone: '+91 65432 10987', email: 'sneha.reddy@gmail.com', source: 'Social Media', property_type: 'Plot', budget_min: 3000000, budget_max: 5000000, timeline: '6-12 months', locations: ['Devanahalli', 'Yelahanka'], intent_score: 45 },
    { name: 'Vikram Singh', phone: '+91 54321 09876', email: null, source: 'Cold Call', property_type: 'Commercial', budget_min: null, budget_max: null, timeline: 'Just browsing', locations: null, intent_score: 30 },
  ]

  const handleLeadUpdate = async (leadId: string, newStatus: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    try {
      const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
      if (error) throw error
    } catch { fetchLeads() }
  }

  const seedSampleData = async () => {
    try {
      setSeeding(true)
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const leadsToInsert = sampleLeads.map((lead, i) => {
        const { score, breakdown } = calculateLeadScore(lead)
        return { agent_id: session.user.id, name: lead.name, phone: lead.phone, email: lead.email, source: lead.source, property_type: lead.property_type, budget_min: lead.budget_min, budget_max: lead.budget_max, timeline: lead.timeline, locations: lead.locations, intent_score: score, score_breakdown: breakdown, status: 'new', first_contact_date: new Date(Date.now() - (i * 86400000)).toISOString(), last_activity_date: new Date(Date.now() - (i * 43200000)).toISOString() }
      })
      const { error: insertError } = await supabase.from('leads').insert(leadsToInsert)
      if (insertError) throw insertError
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
        setUser({ id: 'mock-user-id', email: 'demo@example.com', user_metadata: { full_name: 'Demo Agent' }, app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() } as User)
        setLeads([
          { id: 'lead-1', agent_id: 'mock-user-id', name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '+91 98765 43210', source: 'Website', source_detail: 'Premium Listing', property_type: '3BHK Apartment', locations: ['Bandra West', 'Khar'], budget_min: 45000000, budget_max: 60000000, timeline: 'Immediate', intent_score: 85, score_breakdown: {}, status: 'Active', first_contact_date: new Date().toISOString(), last_activity_date: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'lead-2', agent_id: 'mock-user-id', name: 'Priya Patel', email: 'priya.p@example.com', phone: '+91 99887 76655', source: 'Referral', source_detail: 'Existing Client', property_type: 'Villa', locations: ['Juhu', 'Versova'], budget_min: 80000000, budget_max: 120000000, timeline: '3 months', intent_score: 72, score_breakdown: {}, status: 'Negotiation', first_contact_date: new Date().toISOString(), last_activity_date: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'lead-3', agent_id: 'mock-user-id', name: 'Amit Verma', email: 'amit.v@example.com', phone: '+91 91234 56789', source: 'MagicBricks', source_detail: null, property_type: '2BHK', locations: ['Andheri East'], budget_min: 15000000, budget_max: 20000000, timeline: '1 month', intent_score: 45, score_breakdown: {}, status: 'New', first_contact_date: new Date().toISOString(), last_activity_date: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ])
        setLoading(false)
        return
      }
      setUser(session.user)
      const { data: leadsData, error: fetchError } = await supabase.from('leads').select('*').eq('agent_id', session.user.id).order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      if (leadsData) setLeads(leadsData)
    } catch (err) {
      console.error('Error fetching leads:', err)
      setError('Failed to load leads. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLeads() }, [])

  const filteredLeads = useMemo(() => leads.filter(lead => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery || lead.name.toLowerCase().includes(searchLower) || lead.phone.toLowerCase().includes(searchLower) || (lead.email && lead.email.toLowerCase().includes(searchLower))
    let matchesStatus = true
    if (statusFilter !== 'all') {
      const s = lead.intent_score
      if (statusFilter === 'hot') matchesStatus = s >= 70
      if (statusFilter === 'warm') matchesStatus = s >= 40 && s < 70
      if (statusFilter === 'cold') matchesStatus = s < 40
    }
    return matchesSearch && matchesStatus
  }), [leads, searchQuery, statusFilter])

  const handleLeadAdded = () => { setShowAddModal(false); fetchLeads() }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: 28, height: 28, color: AMBER, animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0 24px', borderBottom: `1px solid ${BORDER}`, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '-0.3px' }}>Leads</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: '4px 0 0' }}>Manage and track your pipeline</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={seedSampleData} disabled={seeding}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              {seeding ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Database style={{ width: 14, height: 14 }} />}
              <span>Sample Data</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: AMBER, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              Add Lead
            </button>
          </div>
        </div>

        {/* Search + Filter row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {/* Search */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Search style={{ width: 14, height: 14, color: MUTED, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text" placeholder="Search by name, phone, or email..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Status filter */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer', minWidth: 130 }}
            >
              <Filter style={{ width: 13, height: 13 }} />
              <span style={{ flex: 1, textAlign: 'left', color: TEXT }}>{statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>
            {showFilterDropdown && (
              <div style={{ position: 'absolute', top: '100%', marginTop: 4, right: 0, minWidth: '100%', background: '#131C2E', border: `1px solid ${BORDER}`, borderRadius: 10, zIndex: 20, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                {(['all', 'hot', 'warm', 'cold'] as StatusFilter[]).map(s => (
                  <button key={s} onClick={() => { setStatusFilter(s); setShowFilterDropdown(false) }}
                    style={{ display: 'block', width: '100%', padding: '9px 14px', background: statusFilter === s ? 'rgba(245,158,11,0.1)' : 'transparent', color: statusFilter === s ? AMBER : TEXT, fontSize: 13, border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 3, gap: 2 }}>
            {[{ v: 'list', icon: List }, { v: 'board', icon: LayoutGrid }].map(({ v, icon: Icon }) => (
              <button key={v} onClick={() => setViewMode(v as 'list' | 'board')}
                style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', cursor: 'pointer', background: viewMode === v ? AMBER : 'transparent', color: viewMode === v ? '#000' : MUTED }}
              >
                <Icon style={{ width: 14, height: 14 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Kanban Board */}
        {viewMode === 'board' && !loading && (
          <KanbanBoard leads={filteredLeads} onLeadUpdate={handleLeadUpdate} />
        )}

        {/* Empty State */}
        {!loading && filteredLeads.length === 0 && viewMode === 'list' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <UserPlus style={{ width: 24, height: 24, color: AMBER }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: '0 0 8px' }}>
              {searchQuery || statusFilter !== 'all' ? 'No leads found' : 'No leads yet'}
            </h3>
            <p style={{ color: MUTED, fontSize: 13, margin: '0 0 24px' }}>
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Add your first lead to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: AMBER, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus style={{ width: 14, height: 14 }} /> Add Lead
                </button>
                <button onClick={seedSampleData} disabled={seeding} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer' }}>
                  {seeding ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Database style={{ width: 14, height: 14 }} />}
                  {seeding ? 'Seeding...' : 'Sample Data'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Desktop Table */}
        {viewMode === 'list' && filteredLeads.length > 0 && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }} className="hidden md:block">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Name', 'Phone', 'Status', 'Score', 'Source', 'Last Activity', 'Actions'].map((h, i) => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 3 ? 'center' : i === 6 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => {
                  const status = getStatusStyle(lead.intent_score)
                  const dotColor = getScoreDotColor(lead.intent_score)
                  return (
                    <tr key={lead.id}
                      style={{ borderBottom: idx < filteredLeads.length - 1 ? `1px solid ${BORDER}` : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Name */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0 }}>{lead.name}</p>
                            {lead.email && <p style={{ fontSize: 11, color: MUTED, margin: 0, display: 'flex', alignItems: 'center', gap: 3 }}><Mail style={{ width: 10, height: 10 }} />{lead.email}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Phone */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 13, color: MUTED, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Phone style={{ width: 12, height: 12 }} />{lead.phone}
                        </span>
                      </td>
                      {/* Status */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: status.color, background: status.bg, padding: '3px 10px', borderRadius: 20 }}>
                          {status.label}
                        </span>
                      </td>
                      {/* Score */}
                      <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${dotColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: dotColor }}>{lead.intent_score}</span>
                        </div>
                      </td>
                      {/* Source */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 13, color: MUTED }}>{lead.source || '—'}</span>
                      </td>
                      {/* Last Activity */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock style={{ width: 11, height: 11 }} />{getRelativeTime(lead.last_activity_date || lead.created_at)}
                        </span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        <Link href={`/dashboard/leads/${lead.id}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 12, fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = AMBER; (e.currentTarget as HTMLElement).style.color = AMBER }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = MUTED }}
                        >
                          <Eye style={{ width: 12, height: 12 }} />View
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
        {viewMode === 'list' && filteredLeads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="md:hidden">
            {filteredLeads.map(lead => {
              const status = getStatusStyle(lead.intent_score)
              const dotColor = getScoreDotColor(lead.intent_score)
              return (
                <div key={lead.id} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>{lead.name}</h3>
                        {lead.email && <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0' }}>{lead.email}</p>}
                      </div>
                    </div>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${dotColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: dotColor }}>{lead.intent_score}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: status.color, background: status.bg, padding: '3px 10px', borderRadius: 20 }}>{status.label}</span>
                    {lead.source && <span style={{ fontSize: 11, color: MUTED, background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20 }}>{lead.source}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}><Phone style={{ width: 11, height: 11 }} />{lead.phone}</span>
                    <span style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}><Clock style={{ width: 11, height: 11 }} />{getRelativeTime(lead.last_activity_date || lead.created_at)}</span>
                  </div>
                  <Link href={`/dashboard/leads/${lead.id}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: '8px 0', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 12, textDecoration: 'none' }}
                  >
                    <Eye style={{ width: 12, height: 12 }} />View Details
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        {/* Lead count */}
        {filteredLeads.length > 0 && (
          <p style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 16 }}>
            Showing {filteredLeads.length} of {leads.length} leads
          </p>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && <AddLeadModal onClose={() => setShowAddModal(false)} onSuccess={handleLeadAdded} />}
    </div>
  )
}
