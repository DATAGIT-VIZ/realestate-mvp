'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Lead, LeadActivity } from '@/lib/supabase'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Clock,
  MessageSquare,
  Activity,
  Target,
  Users,
  Building,
  DollarSign,
  Phone,
  Calendar,
  Eye,
  Mail,
  Zap,
  AlertCircle,
  Lightbulb,
  RefreshCw,
  Loader2,
  ChevronRight,
  BarChart3,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  TrendingUp as TUp,
} from 'lucide-react'
import { format, subDays, differenceInDays, differenceInHours, startOfWeek, getDay, getHours } from 'date-fns'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#080D18',
  panel: '#0E1623',
  border: 'rgba(255,255,255,0.06)',
  amber: '#F59E0B',
  amberDim: 'rgba(245,158,11,0.12)',
  emerald: '#10B981',
  red: '#EF4444',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  muted: 'rgba(255,255,255,0.35)',
  text: '#F1F5F9',
}

// Format currency in INR
function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  return `₹${amount.toLocaleString('en-IN')}`
}

function getLeadStatus(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}

// ─── Custom tooltip style ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1A2332', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#F1F5F9' }}>
      <p style={{ color: C.muted, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || C.amber }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        const mockLeads: Lead[] = Array.from({ length: 50 }).map((_, i) => ({
          id: `lead-${i}`,
          agent_id: 'mock-user-id',
          name: `Mock Lead ${i}`,
          email: `lead${i}@example.com`,
          phone: `+91 ${9000000000 + i}`,
          source: ['Website', 'Referral', 'MagicBricks', 'Facebook Ad', 'Cold Call'][Math.floor(Math.random() * 5)],
          source_detail: null,
          property_type: ['Apartment', 'Villa', 'Plot', 'Commercial'][Math.floor(Math.random() * 4)],
          locations: [['Bandra', 'Juhu'], ['Whitefield'], ['Andheri'], ['Koramangala']][Math.floor(Math.random() * 4)],
          budget_min: 10000000,
          budget_max: 50000000,
          timeline: '1-3 months',
          intent_score: Math.floor(Math.random() * 100),
          score_breakdown: {},
          status: ['new', 'contacted', 'warm', 'hot', 'cold'][Math.floor(Math.random() * 5)],
          first_contact_date: subDays(new Date(), Math.floor(Math.random() * 30)).toISOString(),
          last_activity_date: subDays(new Date(), Math.floor(Math.random() * 5)).toISOString(),
          created_at: subDays(new Date(), Math.floor(Math.random() * 60)).toISOString(),
          updated_at: new Date().toISOString()
        }))

        const mockActivities: LeadActivity[] = Array.from({ length: 100 }).map((_, i) => ({
          id: `act-${i}`,
          lead_id: `lead-${Math.floor(Math.random() * 50)}`,
          agent_id: 'mock-user-id',
          activity_type: ['Call Made', 'Email Sent', 'WhatsApp Sent', 'Property Viewed', 'Site Visit Scheduled'][Math.floor(Math.random() * 5)],
          activity_data: {
            response_time: ['Within 2 hours', 'Within 24 hours', '1-3 days'][Math.floor(Math.random() * 3)],
            questions_asked: Math.random() > 0.7 ? ['Asked about payment plans'] : []
          },
          created_at: subDays(new Date(), Math.floor(Math.random() * 30)).toISOString()
        }))

        setLeads(mockLeads)
        setActivities(mockActivities)
        return
      }

      const [leadsRes, activitiesRes] = await Promise.all([
        supabase.from('leads').select('*').eq('agent_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('lead_activities').select('*').eq('agent_id', session.user.id).order('created_at', { ascending: false }),
      ])

      setLeads(leadsRes.data || [])
      setActivities(activitiesRes.data || [])
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  const handleRefresh = () => { setRefreshing(true); fetchData() }

  // ── Executive Summary ──────────────────────────────────────────────────────
  const executiveSummary = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = subDays(now, 7)
    const hotLeads = leads.filter(l => l.intent_score >= 70)
    const hotLeadsOld = leads.filter(l => l.intent_score >= 70 && new Date(l.created_at) < sevenDaysAgo)
    const hotPipelineValue = hotLeads.reduce((sum, l) => sum + (l.budget_max || 0), 0)
    const hotTrend = hotLeadsOld.length > 0
      ? Math.round(((hotLeads.length - hotLeadsOld.length) / hotLeadsOld.length) * 100)
      : hotLeads.length > 0 ? 100 : 0
    const hotLeadsWithDates = hotLeads.filter(l => l.first_contact_date)
    const avgConversionDays = hotLeadsWithDates.length > 0
      ? Math.round(hotLeadsWithDates.reduce((sum, l) => sum + differenceInDays(new Date(l.last_activity_date || l.updated_at), new Date(l.first_contact_date)), 0) / hotLeadsWithDates.length)
      : 0
    const leadsWithResponse = activities.filter(a => a.activity_data?.response_time === 'Within 2 hours' || a.activity_data?.response_time === 'Within 24 hours')
    const uniqueLeadsWithResponse = new Set(leadsWithResponse.map(a => a.lead_id))
    const responseRate = leads.length > 0 ? Math.round((uniqueLeadsWithResponse.size / leads.length) * 100) : 0
    const activityDensity = leads.length > 0 ? (activities.length / leads.length).toFixed(1) : '0'
    return { hotLeadsCount: hotLeads.length, hotPipelineValue, hotTrend, avgConversionDays, responseRate, activityDensity, totalLeads: leads.length, totalActivities: activities.length }
  }, [leads, activities])

  // ── Behavioral Patterns ────────────────────────────────────────────────────
  const behavioralPatterns = useMemo(() => {
    const activityTypes = ['Call Made', 'Email Sent', 'WhatsApp Sent', 'Property Viewed', 'Site Visit Scheduled', 'Meeting Held']
    const activityEffectiveness: Record<string, { count: number; hotConversions: number }> = {}
    activityTypes.forEach(t => { activityEffectiveness[t] = { count: 0, hotConversions: 0 } })
    activities.forEach(activity => {
      if (activityEffectiveness[activity.activity_type]) {
        activityEffectiveness[activity.activity_type].count++
        const lead = leads.find(l => l.id === activity.lead_id)
        if (lead && lead.intent_score >= 70) activityEffectiveness[activity.activity_type].hotConversions++
      }
    })
    const effectivenessData = Object.entries(activityEffectiveness)
      .map(([type, data]) => ({ type, count: data.count, conversionRate: data.count > 0 ? Math.round((data.hotConversions / data.count) * 100) : 0 }))
      .sort((a, b) => b.conversionRate - a.conversionRate)
    return { effectivenessData }
  }, [leads, activities])

  // ── Source Performance ─────────────────────────────────────────────────────
  const sourcePerformance = useMemo(() => {
    const sourceStats: Record<string, { source: string; count: number; totalScore: number; hotCount: number; activityCount: number }> = {}
    leads.forEach(lead => {
      const source = lead.source || 'Unknown'
      if (!sourceStats[source]) sourceStats[source] = { source, count: 0, totalScore: 0, hotCount: 0, activityCount: 0 }
      sourceStats[source].count++
      sourceStats[source].totalScore += lead.intent_score
      if (lead.intent_score >= 70) sourceStats[source].hotCount++
    })
    activities.forEach(activity => {
      const lead = leads.find(l => l.id === activity.lead_id)
      if (lead) {
        const source = lead.source || 'Unknown'
        if (sourceStats[source]) sourceStats[source].activityCount++
      }
    })
    return Object.values(sourceStats)
      .map(s => ({ ...s, avgScore: s.count > 0 ? Math.round(s.totalScore / s.count) : 0, conversionRate: s.count > 0 ? Math.round((s.hotCount / s.count) * 100) : 0 }))
      .sort((a, b) => b.conversionRate - a.conversionRate)
  }, [leads, activities])

  // ── Timeline Trends ────────────────────────────────────────────────────────
  const timelineTrends = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const now = new Date()
    const data: Array<{ date: string; leads: number; hotLeads: number; activities: number; avgScore: number }> = []
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i)
      const dateStr = format(date, 'MMM dd')
      const dayStart = new Date(date.setHours(0, 0, 0, 0))
      const dayEnd = new Date(date.setHours(23, 59, 59, 999))
      const dayLeads = leads.filter(l => { const c = new Date(l.created_at); return c >= dayStart && c <= dayEnd })
      const dayActivities = activities.filter(a => { const c = new Date(a.created_at); return c >= dayStart && c <= dayEnd })
      const hotLeadsCount = dayLeads.filter(l => l.intent_score >= 70).length
      const avgScore = dayLeads.length > 0 ? Math.round(dayLeads.reduce((s, l) => s + l.intent_score, 0) / dayLeads.length) : 0
      data.push({ date: dateStr, leads: dayLeads.length, hotLeads: hotLeadsCount, activities: dayActivities.length, avgScore })
    }
    return data
  }, [leads, activities, dateRange])

  // ── Predictive Scoring ─────────────────────────────────────────────────────
  const predictiveScoring = useMemo(() => {
    const now = new Date()
    return leads.map(lead => {
      let probability = lead.intent_score * 0.5
      const leadActivities = activities.filter(a => a.lead_id === lead.id)
      if (leadActivities.find(a => differenceInHours(now, new Date(a.created_at)) <= 48)) probability += 20
      const hasQQ = leadActivities.some(a => (a.activity_data?.questions_asked || []).includes('Asked about payment plans') || (a.activity_data?.questions_asked || []).includes('Asked about documentation'))
      if (hasQQ) probability += 15
      if (leadActivities.some(a => a.activity_data?.response_time === 'Within 2 hours')) probability += 10
      if (lead.budget_min && lead.budget_max) probability += 5
      probability = Math.min(100, Math.round(probability))
      let nextAction = 'Schedule a follow-up call'
      let urgency: 'hot' | 'urgent' | 'followup' = 'followup'
      if (probability >= 80) {
        urgency = 'hot'
        nextAction = !leadActivities.some(a => a.activity_type === 'Site Visit Scheduled') ? 'Schedule site visit — high conversion potential' : 'Send payment plan details'
      } else if (probability >= 60) {
        urgency = 'urgent'
        nextAction = hasQQ ? 'Send detailed property info' : 'Call to understand requirements'
      }
      return { ...lead, probability, nextAction, urgency, activityCount: leadActivities.length, lastActivity: leadActivities[0]?.created_at }
    }).sort((a, b) => b.probability - a.probability).slice(0, 10)
  }, [leads, activities])

  // ── Lead Funnel ────────────────────────────────────────────────────────────
  const leadFunnel = useMemo(() => {
    const hasResponded = (leadId: string) => activities.some(a => a.lead_id === leadId && a.activity_data?.response_time && a.activity_data.response_time !== 'No response yet')
    const totalLeads = leads.length
    const contactedLeads = leads.filter(l => activities.some(a => a.lead_id === l.id)).length
    const respondedLeads = leads.filter(l => hasResponded(l.id)).length
    const warmLeads = leads.filter(l => l.intent_score >= 40 && l.intent_score < 70).length
    const hotLeads = leads.filter(l => l.intent_score >= 70).length
    return [
      { stage: 'Total Leads', count: totalLeads, pct: 100 },
      { stage: 'Contacted', count: contactedLeads, pct: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0 },
      { stage: 'Responded', count: respondedLeads, pct: totalLeads > 0 ? Math.round((respondedLeads / totalLeads) * 100) : 0 },
      { stage: 'Warm+', count: warmLeads + hotLeads, pct: totalLeads > 0 ? Math.round(((warmLeads + hotLeads) / totalLeads) * 100) : 0 },
      { stage: 'Hot 🔥', count: hotLeads, pct: totalLeads > 0 ? Math.round((hotLeads / totalLeads) * 100) : 0 },
    ]
  }, [leads, activities])

  // ── Insight Strip content ──────────────────────────────────────────────────
  const insightMessage = useMemo(() => {
    const top = predictiveScoring[0]
    if (!top) return { text: 'Add more leads to unlock AI-driven insights.', cta: 'Add leads', href: '/dashboard/leads' }
    const hoursSinceActivity = top.lastActivity ? differenceInHours(new Date(), new Date(top.lastActivity)) : 9999
    if (hoursSinceActivity > 72) return { text: `${top.name} (${top.probability}% close probability) hasn't been touched in ${Math.round(hoursSinceActivity / 24)} days — act now.`, cta: 'View lead', href: '/dashboard/leads' }
    if (executiveSummary.hotLeadsCount === 0) return { text: 'No hot leads yet. Try calling leads faster — response time is your biggest lever.', cta: 'View leads', href: '/dashboard/leads' }
    const bestSource = sourcePerformance[0]
    if (bestSource) return { text: `${bestSource.source} is your best-converting source at ${bestSource.conversionRate}% — consider increasing budget there.`, cta: 'See sources', href: '#sources' }
    return { text: `You have ${executiveSummary.hotLeadsCount} hot leads worth ${formatINR(executiveSummary.hotPipelineValue)} in pipeline. Keep the momentum going.`, cta: 'View leads', href: '/dashboard/leads' }
  }, [predictiveScoring, executiveSummary, sourcePerformance])

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 32, height: 32, color: C.amber, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: C.muted, fontSize: 14 }}>Loading insights…</p>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INSUFFICIENT DATA
  // ─────────────────────────────────────────────────────────────────────────────
  if (leads.length < 3) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: C.amberDim, border: `1px solid ${C.amber}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <BarChart3 style={{ width: 32, height: 32, color: C.amber }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 12 }}>Not enough data yet</h1>
          <p style={{ color: C.muted, marginBottom: 32, lineHeight: 1.6 }}>Add at least 3 leads and log some activities to unlock analytics insights.</p>
          <button
            onClick={() => router.push('/dashboard/leads')}
            style={{ padding: '12px 28px', background: C.amber, color: '#000', fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            Go to Leads
          </button>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 24 }}>Current: {leads.length} leads · {activities.length} activities</p>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.3px' }}>
              Insights
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
              {leads.length} leads · {activities.length} activities
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Date range */}
            <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
              {(['7d', '30d', '90d'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    background: dateRange === r ? C.amber : 'transparent',
                    color: dateRange === r ? '#000' : C.muted,
                    transition: 'all 0.15s',
                  }}
                >
                  {r === '7d' ? '7d' : r === '30d' ? '30d' : '90d'}
                </button>
              ))}
            </div>
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}
            >
              <RefreshCw style={{ width: 15, height: 15, color: C.muted, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* ── INSIGHT STRIP (KEY DIFFERENTIATOR) ── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.03) 100%)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '14px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.amberDim, border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Sparkles style={{ width: 12, height: 12, color: C.amber }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Insight</span>
          </div>
          <p style={{ fontSize: 13.5, color: C.text, margin: 0, lineHeight: 1.5, flex: 1 }}>{insightMessage.text}</p>
          <button
            onClick={() => router.push(insightMessage.href)}
            style={{ padding: '6px 16px', background: C.amber, color: '#000', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {insightMessage.cta} →
          </button>
        </div>

        {/* ── KPI CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            {
              label: 'Hot Leads',
              value: executiveSummary.hotLeadsCount,
              sub: 'score ≥ 70',
              trend: executiveSummary.hotTrend,
              icon: <Flame style={{ width: 18, height: 18, color: '#FB923C' }} />,
              accent: '#FB923C',
            },
            {
              label: 'Hot Pipeline',
              value: formatINR(executiveSummary.hotPipelineValue),
              sub: 'total budget value',
              trend: null,
              icon: <DollarSign style={{ width: 18, height: 18, color: C.emerald }} />,
              accent: C.emerald,
            },
            {
              label: 'Avg. Close Days',
              value: executiveSummary.avgConversionDays,
              sub: 'first contact → hot',
              trend: null,
              icon: <Clock style={{ width: 18, height: 18, color: C.blue }} />,
              accent: C.blue,
            },
            {
              label: 'Response Rate',
              value: `${executiveSummary.responseRate}%`,
              sub: 'leads contacted < 24h',
              trend: null,
              icon: <Phone style={{ width: 18, height: 18, color: C.purple }} />,
              accent: C.purple,
            },
          ].map((kpi, i) => (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${kpi.accent}60, transparent)` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{kpi.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${kpi.accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {kpi.icon}
                </div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.text, letterSpacing: '-0.5px', lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: C.muted }}>{kpi.sub}</span>
                {kpi.trend !== null && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: kpi.trend >= 0 ? C.emerald : C.red, background: kpi.trend >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 20 }}>
                    {kpi.trend >= 0 ? '↑' : '↓'} {Math.abs(kpi.trend)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── CHARTS ROW: Timeline + Source Performance ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14, marginBottom: 14 }}>

          {/* Timeline Area Chart */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Lead Volume</h2>
                <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Leads & activities over time</p>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: C.muted }}><span style={{ width: 10, height: 2, background: C.amber, display: 'inline-block', borderRadius: 4 }} />Leads</span>
                <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: C.muted }}><span style={{ width: 10, height: 2, background: C.emerald, display: 'inline-block', borderRadius: 4 }} />Activities</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timelineTrends} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.amber} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.emerald} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.floor(timelineTrends.length / 6)} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="leads" stroke={C.amber} strokeWidth={2} fill="url(#gradAmber)" name="Leads" dot={false} />
                <Area type="monotone" dataKey="activities" stroke={C.emerald} strokeWidth={2} fill="url(#gradGreen)" name="Activities" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Source Performance */}
          <div id="sources" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Lead Sources</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Conversion rate by source</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sourcePerformance.slice(0, 6).map((src, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{src.source}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>{src.count} leads</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: src.conversionRate >= 30 ? C.emerald : src.conversionRate >= 15 ? C.amber : C.muted }}>
                        {src.conversionRate}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${src.conversionRate}%`, background: src.conversionRate >= 30 ? C.emerald : src.conversionRate >= 15 ? C.amber : '#475569', borderRadius: 99, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MIDDLE ROW: Funnel + Activity Effectiveness ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 14, marginBottom: 14 }}>

          {/* Funnel */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Lead Funnel</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 24px' }}>Conversion by stage</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {leadFunnel.map((stage, i) => {
                const colors = [C.muted, C.blue, C.purple, C.amber, '#FB923C']
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: C.text }}>{stage.stage}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors[i] }}>{stage.count} <span style={{ color: C.muted, fontWeight: 400 }}>({stage.pct}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99 }}>
                      <div style={{ height: '100%', width: `${stage.pct}%`, background: colors[i], borderRadius: 99, transition: 'width 0.6s ease', opacity: 0.85 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity Effectiveness */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Activity Effectiveness</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Hot lead conversion rate per activity type</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={behavioralPatterns.effectivenessData} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="type" tick={{ fill: C.text, fontSize: 12 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="conversionRate" name="Conversion %" radius={[0, 6, 6, 0]}>
                  {behavioralPatterns.effectivenessData.map((entry, i) => (
                    <Cell key={i} fill={entry.conversionRate >= 40 ? C.emerald : entry.conversionRate >= 20 ? C.amber : '#334155'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── PREDICTIVE TOP 10 TABLE ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Top Leads to Act On</h2>
              <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Ranked by close probability</p>
            </div>
            <button onClick={() => router.push('/dashboard/leads')} style={{ fontSize: 12, color: C.amber, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 12, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
            {['Lead', 'Score', 'Probability', 'Next Action'].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>

          {predictiveScoring.map((lead, i) => {
            const urgencyColors: Record<string, string> = { hot: '#FB923C', urgent: C.amber, followup: C.muted }
            const urgencyBg: Record<string, string> = { hot: 'rgba(251,146,60,0.12)', urgent: 'rgba(245,158,11,0.1)', followup: 'rgba(255,255,255,0.04)' }
            return (
              <div
                key={lead.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Name + source */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: urgencyColors[lead.urgency], flexShrink: 0, boxShadow: `0 0 6px ${urgencyColors[lead.urgency]}` }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{lead.name}</p>
                    <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{lead.source || 'Unknown'}</p>
                  </div>
                </div>

                {/* Intent score */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 38, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99 }}>
                      <div style={{ width: `${lead.intent_score}%`, height: '100%', background: lead.intent_score >= 70 ? '#FB923C' : lead.intent_score >= 40 ? C.amber : '#475569', borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{lead.intent_score}</span>
                  </div>
                </div>

                {/* Probability */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: urgencyColors[lead.urgency], background: urgencyBg[lead.urgency], padding: '3px 10px', borderRadius: 20 }}>
                    {lead.probability}%
                  </span>
                </div>

                {/* Next action */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{lead.nextAction}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── SCORE DISTRIBUTION MINI CHART ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 22px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Lead Score Distribution</h2>
              <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Intent score buckets across all leads</p>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ label: 'Cold', color: '#475569' }, { label: 'Warm', color: C.amber }, { label: 'Hot', color: '#FB923C' }].map(l => (
                <span key={l.label} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: C.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={(() => {
              const buckets = [
                { range: '0–9', min: 0, max: 10 }, { range: '10–19', min: 10, max: 20 }, { range: '20–29', min: 20, max: 30 },
                { range: '30–39', min: 30, max: 40 }, { range: '40–49', min: 40, max: 50 }, { range: '50–59', min: 50, max: 60 },
                { range: '60–69', min: 60, max: 70 }, { range: '70–79', min: 70, max: 80 }, { range: '80–89', min: 80, max: 90 }, { range: '90–100', min: 90, max: 101 },
              ]
              return buckets.map(b => ({ range: b.range, count: leads.filter(l => l.intent_score >= b.min && l.intent_score < b.max).length, bucket: b.min >= 70 ? 'hot' : b.min >= 40 ? 'warm' : 'cold' }))
            })()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]}>
                {leads.length > 0 && [
                  { range: '0–9', min: 0 }, { range: '10–19', min: 10 }, { range: '20–29', min: 20 },
                  { range: '30–39', min: 30 }, { range: '40–49', min: 40 }, { range: '50–59', min: 50 },
                  { range: '60–69', min: 60 }, { range: '70–79', min: 70 }, { range: '80–89', min: 80 }, { range: '90–100', min: 90 },
                ].map((b, i) => (
                  <Cell key={i} fill={b.min >= 70 ? '#FB923C' : b.min >= 40 ? C.amber : '#334155'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  )
}
