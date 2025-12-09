'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Lead, LeadActivity } from '@/lib/supabase'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  ComposedChart,
  Area,
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
} from 'lucide-react'
import { format, subDays, differenceInDays, differenceInHours, startOfWeek, getDay, getHours } from 'date-fns'

// Color palette
const COLORS = {
  green: '#10B981',
  red: '#EF4444',
  blue: '#3B82F6',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  pink: '#EC4899',
  emerald: '#059669',
  slate: '#64748B',
}

// Format currency in INR
function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

// Get status from score
function getLeadStatus(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
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
        router.push('/login')
        return
      }

      const [leadsRes, activitiesRes] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('agent_id', session.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('lead_activities')
          .select('*')
          .eq('agent_id', session.user.id)
          .order('created_at', { ascending: false }),
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

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // ============================================
  // SECTION 1: EXECUTIVE SUMMARY CALCULATIONS
  // ============================================
  const executiveSummary = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = subDays(now, 7)

    // Hot leads (score >= 70)
    const hotLeads = leads.filter(l => l.intent_score >= 70)
    const hotLeadsOld = leads.filter(l => 
      l.intent_score >= 70 && new Date(l.created_at) < sevenDaysAgo
    )
    const hotPipelineValue = hotLeads.reduce((sum, l) => sum + (l.budget_max || 0), 0)
    const hotTrend = hotLeadsOld.length > 0 
      ? Math.round(((hotLeads.length - hotLeadsOld.length) / hotLeadsOld.length) * 100)
      : hotLeads.length > 0 ? 100 : 0

    // Conversion velocity - avg days from first contact to hot status
    const hotLeadsWithDates = hotLeads.filter(l => l.first_contact_date)
    const avgConversionDays = hotLeadsWithDates.length > 0
      ? Math.round(
          hotLeadsWithDates.reduce((sum, l) => {
            return sum + differenceInDays(
              new Date(l.last_activity_date || l.updated_at),
              new Date(l.first_contact_date)
            )
          }, 0) / hotLeadsWithDates.length
        )
      : 0

    // Response rate - leads with quick response
    const leadsWithResponse = activities.filter(a => 
      a.activity_data?.response_time === 'Within 2 hours' ||
      a.activity_data?.response_time === 'Within 24 hours'
    )
    const uniqueLeadsWithResponse = new Set(leadsWithResponse.map(a => a.lead_id))
    const responseRate = leads.length > 0 
      ? Math.round((uniqueLeadsWithResponse.size / leads.length) * 100)
      : 0

    // Activity density - activities per lead
    const activityDensity = leads.length > 0
      ? (activities.length / leads.length).toFixed(1)
      : '0'

    return {
      hotLeadsCount: hotLeads.length,
      hotPipelineValue,
      hotTrend,
      avgConversionDays,
      responseRate,
      activityDensity,
      totalLeads: leads.length,
      totalActivities: activities.length,
    }
  }, [leads, activities])

  // ============================================
  // SECTION 2: PROPERTY INTEREST HEAT MAP
  // ============================================
  const propertyInterest = useMemo(() => {
    const interestMap: Record<string, {
      propertyType: string
      location: string
      leadCount: number
      activityCount: number
      avgScore: number
      interestScore: number
    }> = {}

    leads.forEach(lead => {
      const propertyType = lead.property_type || 'Unknown'
      const locations = lead.locations || ['Unknown']
      
      locations.forEach(location => {
        const key = `${propertyType}-${location}`
        if (!interestMap[key]) {
          interestMap[key] = {
            propertyType,
            location,
            leadCount: 0,
            activityCount: 0,
            avgScore: 0,
            interestScore: 0,
          }
        }
        interestMap[key].leadCount++
        interestMap[key].avgScore += lead.intent_score
      })
    })

    activities.forEach(activity => {
      const lead = leads.find(l => l.id === activity.lead_id)
      if (lead) {
        const propertyType = lead.property_type || 'Unknown'
        const locations = lead.locations || ['Unknown']
        locations.forEach(location => {
          const key = `${propertyType}-${location}`
          if (interestMap[key]) {
            interestMap[key].activityCount++
          }
        })
      }
    })

    const data = Object.values(interestMap).map(item => ({
      ...item,
      avgScore: item.leadCount > 0 ? Math.round(item.avgScore / item.leadCount) : 0,
      interestScore: (item.leadCount * 2) + (item.activityCount * 3),
    })).sort((a, b) => b.interestScore - a.interestScore)

    const hottest = data[0]
    const coldest = data.find(d => d.avgScore < 40) || data[data.length - 1]

    return { data: data.slice(0, 15), hottest, coldest }
  }, [leads, activities])

  // ============================================
  // SECTION 3: BEHAVIORAL PATTERNS
  // ============================================
  const behavioralPatterns = useMemo(() => {
    // Engagement heatmap (day x hour)
    const engagementGrid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0))
    
    activities.forEach(activity => {
      const date = new Date(activity.created_at)
      const day = getDay(date)
      const hour = getHours(date)
      engagementGrid[day][hour]++
    })

    // Find peak engagement
    let peakDay = 0, peakHour = 0, peakCount = 0
    engagementGrid.forEach((hours, day) => {
      hours.forEach((count, hour) => {
        if (count > peakCount) {
          peakCount = count
          peakDay = day
          peakHour = hour
        }
      })
    })

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Activity type effectiveness
    const activityEffectiveness: Record<string, { count: number, scoreIncrease: number, hotConversions: number }> = {}
    
    const activityTypes = ['Call Made', 'Email Sent', 'WhatsApp Sent', 'Property Viewed', 'Site Visit Scheduled', 'Meeting Held']
    activityTypes.forEach(type => {
      activityEffectiveness[type] = { count: 0, scoreIncrease: 0, hotConversions: 0 }
    })

    activities.forEach(activity => {
      if (activityEffectiveness[activity.activity_type]) {
        activityEffectiveness[activity.activity_type].count++
        const lead = leads.find(l => l.id === activity.lead_id)
        if (lead && lead.intent_score >= 70) {
          activityEffectiveness[activity.activity_type].hotConversions++
        }
      }
    })

    const effectivenessData = Object.entries(activityEffectiveness)
      .map(([type, data]) => ({
        type,
        count: data.count,
        conversionRate: data.count > 0 ? Math.round((data.hotConversions / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate)

    return {
      engagementGrid,
      peakDay: dayNames[peakDay],
      peakHour,
      peakCount,
      effectivenessData,
    }
  }, [leads, activities])

  // ============================================
  // SECTION 4: DIFFERENTIATING FACTORS
  // ============================================
  const differentiatingFactors = useMemo(() => {
    const hotLeads = leads.filter(l => l.intent_score >= 70)
    const coldLeads = leads.filter(l => l.intent_score < 40)

    const getAvgActivities = (leadsList: Lead[]) => {
      if (leadsList.length === 0) return 0
      const leadIds = new Set(leadsList.map(l => l.id))
      const relevantActivities = activities.filter(a => leadIds.has(a.lead_id))
      return (relevantActivities.length / leadsList.length).toFixed(1)
    }

    const getMostCommonQuestion = (leadsList: Lead[]) => {
      const leadIds = new Set(leadsList.map(l => l.id))
      const relevantActivities = activities.filter(a => leadIds.has(a.lead_id))
      const questionCounts: Record<string, number> = {}
      
      relevantActivities.forEach(a => {
        const questions = a.activity_data?.questions_asked || []
        questions.forEach((q: string) => {
          questionCounts[q] = (questionCounts[q] || 0) + 1
        })
      })

      const sorted = Object.entries(questionCounts).sort((a, b) => b[1] - a[1])
      return sorted[0]?.[0] || 'None recorded'
    }

    const getMostCommonPropertyType = (leadsList: Lead[]) => {
      const typeCounts: Record<string, number> = {}
      leadsList.forEach(l => {
        const type = l.property_type || 'Unknown'
        typeCounts[type] = (typeCounts[type] || 0) + 1
      })
      const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
      return sorted[0]?.[0] || 'Mixed'
    }

    const getAvgBudget = (leadsList: Lead[]) => {
      const withBudget = leadsList.filter(l => l.budget_max)
      if (withBudget.length === 0) return 0
      return withBudget.reduce((sum, l) => sum + (l.budget_max || 0), 0) / withBudget.length
    }

    const getAvgResponseTime = (leadsList: Lead[]) => {
      const leadIds = new Set(leadsList.map(l => l.id))
      const relevantActivities = activities.filter(a => 
        leadIds.has(a.lead_id) && a.activity_data?.response_time
      )
      
      const responseTimes: Record<string, number> = {
        'Within 2 hours': 0,
        'Within 24 hours': 0,
        '1-3 days': 0,
        '3+ days': 0,
        'No response yet': 0,
      }
      
      relevantActivities.forEach(a => {
        const rt = a.activity_data?.response_time
        if (rt && responseTimes[rt] !== undefined) {
          responseTimes[rt]++
        }
      })

      const total = Object.values(responseTimes).reduce((a, b) => a + b, 0)
      if (total === 0) return 'No data'
      
      if (responseTimes['Within 2 hours'] > total * 0.5) return '< 2 hours'
      if (responseTimes['Within 24 hours'] > total * 0.3) return '< 24 hours'
      if (responseTimes['1-3 days'] > total * 0.3) return '1-3 days'
      return '48+ hours'
    }

    return {
      hot: {
        count: hotLeads.length,
        avgActivities: getAvgActivities(hotLeads),
        mostCommonQuestion: getMostCommonQuestion(hotLeads),
        mostCommonPropertyType: getMostCommonPropertyType(hotLeads),
        avgBudget: getAvgBudget(hotLeads),
        avgResponseTime: getAvgResponseTime(hotLeads),
      },
      cold: {
        count: coldLeads.length,
        avgActivities: getAvgActivities(coldLeads),
        mostCommonQuestion: getMostCommonQuestion(coldLeads),
        mostCommonPropertyType: getMostCommonPropertyType(coldLeads),
        avgBudget: getAvgBudget(coldLeads),
        avgResponseTime: getAvgResponseTime(coldLeads),
      },
    }
  }, [leads, activities])

  // ============================================
  // SECTION 5: PREDICTIVE LEAD SCORING
  // ============================================
  const predictiveScoring = useMemo(() => {
    const now = new Date()
    
    return leads
      .map(lead => {
        let probability = lead.intent_score * 0.5 // Base: 50% weight

        // Recent engagement
        const leadActivities = activities.filter(a => a.lead_id === lead.id)
        const recentActivity = leadActivities.find(a => 
          differenceInHours(now, new Date(a.created_at)) <= 48
        )
        if (recentActivity) probability += 20

        // Question quality
        const hasQualityQuestion = leadActivities.some(a => {
          const questions = a.activity_data?.questions_asked || []
          return questions.includes('Asked about payment plans') || 
                 questions.includes('Asked about documentation')
        })
        if (hasQualityQuestion) probability += 15

        // Response speed
        const hasQuickResponse = leadActivities.some(a => 
          a.activity_data?.response_time === 'Within 2 hours'
        )
        if (hasQuickResponse) probability += 10

        // Budget alignment
        if (lead.budget_min && lead.budget_max) probability += 5

        probability = Math.min(100, Math.round(probability))

        // Determine next best action
        let nextAction = 'Schedule a follow-up call'
        let urgency: 'hot' | 'urgent' | 'followup' = 'followup'

        if (probability >= 80) {
          urgency = 'hot'
          if (!leadActivities.some(a => a.activity_type === 'Site Visit Scheduled')) {
            nextAction = 'Schedule site visit - high conversion potential'
          } else {
            nextAction = 'Send payment plan details'
          }
        } else if (probability >= 60) {
          urgency = 'urgent'
          if (hasQualityQuestion) {
            nextAction = 'Send detailed property info'
          } else {
            nextAction = 'Call to understand requirements'
          }
        }

        return {
          ...lead,
          probability,
          nextAction,
          urgency,
          activityCount: leadActivities.length,
          lastActivity: leadActivities[0]?.created_at,
        }
      })
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10)
  }, [leads, activities])

  // ============================================
  // SECTION 6: SOURCE PERFORMANCE
  // ============================================
  const sourcePerformance = useMemo(() => {
    const sourceStats: Record<string, {
      source: string
      count: number
      totalScore: number
      hotCount: number
      activityCount: number
    }> = {}

    leads.forEach(lead => {
      const source = lead.source || 'Unknown'
      if (!sourceStats[source]) {
        sourceStats[source] = { source, count: 0, totalScore: 0, hotCount: 0, activityCount: 0 }
      }
      sourceStats[source].count++
      sourceStats[source].totalScore += lead.intent_score
      if (lead.intent_score >= 70) sourceStats[source].hotCount++
    })

    activities.forEach(activity => {
      const lead = leads.find(l => l.id === activity.lead_id)
      if (lead) {
        const source = lead.source || 'Unknown'
        if (sourceStats[source]) {
          sourceStats[source].activityCount++
        }
      }
    })

    return Object.values(sourceStats)
      .map(s => ({
        ...s,
        avgScore: s.count > 0 ? Math.round(s.totalScore / s.count) : 0,
        conversionRate: s.count > 0 ? Math.round((s.hotCount / s.count) * 100) : 0,
        activitiesPerLead: s.count > 0 ? (s.activityCount / s.count).toFixed(1) : '0',
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate)
  }, [leads, activities])

  // ============================================
  // SECTION 7: TIMELINE TRENDS
  // ============================================
  const timelineTrends = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const now = new Date()
    const data: Array<{
      date: string
      leads: number
      hotLeads: number
      activities: number
      avgScore: number
    }> = []

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i)
      const dateStr = format(date, 'MMM dd')
      const dayStart = new Date(date.setHours(0, 0, 0, 0))
      const dayEnd = new Date(date.setHours(23, 59, 59, 999))

      const dayLeads = leads.filter(l => {
        const created = new Date(l.created_at)
        return created >= dayStart && created <= dayEnd
      })

      const dayActivities = activities.filter(a => {
        const created = new Date(a.created_at)
        return created >= dayStart && created <= dayEnd
      })

      const hotLeadsCount = dayLeads.filter(l => l.intent_score >= 70).length
      const avgScore = dayLeads.length > 0 
        ? Math.round(dayLeads.reduce((sum, l) => sum + l.intent_score, 0) / dayLeads.length)
        : 0

      data.push({
        date: dateStr,
        leads: dayLeads.length,
        hotLeads: hotLeadsCount,
        activities: dayActivities.length,
        avgScore,
      })
    }

    return data
  }, [leads, activities, dateRange])

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading analytics...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // INSUFFICIENT DATA STATE
  // ============================================
  if (leads.length < 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-800 mb-6">
            <BarChart3 className="h-10 w-10 text-slate-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Not Enough Data Yet</h1>
          <p className="text-slate-400 mb-6">
            Add at least 10 leads and log some activities to see meaningful analytics insights.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => router.push('/dashboard/leads')}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
            >
              Go to Leads
            </button>
          </div>
          <p className="text-slate-500 text-sm mt-8">
            Current: {leads.length} leads, {activities.length} activities
          </p>
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
              <BarChart3 className="h-8 w-8 text-emerald-500" />
              Analytics Dashboard
            </h1>
            <p className="text-slate-400 mt-1">
              Strategic insights from {leads.length} leads and {activities.length} activities
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Range Toggle */}
            <div className="flex bg-slate-800 rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    dateRange === range
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-5 w-5 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 1: EXECUTIVE SUMMARY */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Hot Leads Pipeline */}
          <div 
            className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-emerald-500/50 transition-colors"
            onClick={() => router.push('/dashboard/leads?status=hot')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-500/20">
                <Flame className="h-5 w-5 text-orange-400" />
              </div>
              <div className={`flex items-center gap-1 text-sm ${executiveSummary.hotTrend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {executiveSummary.hotTrend >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {Math.abs(executiveSummary.hotTrend)}%
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatINR(executiveSummary.hotPipelineValue)}</p>
            <p className="text-sm text-slate-400 mt-1">
              Pipeline from {executiveSummary.hotLeadsCount} hot leads
            </p>
          </div>

          {/* Conversion Velocity */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <span className={`text-sm ${executiveSummary.avgConversionDays <= 14 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {executiveSummary.avgConversionDays <= 14 ? 'Fast' : 'Average'}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{executiveSummary.avgConversionDays} days</p>
            <p className="text-sm text-slate-400 mt-1">
              Avg time to hot status
            </p>
          </div>

          {/* Response Rate */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/20">
                <MessageSquare className="h-5 w-5 text-emerald-400" />
              </div>
              <span className={`text-sm ${executiveSummary.responseRate >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {executiveSummary.responseRate >= 60 ? 'Excellent' : 'Needs work'}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{executiveSummary.responseRate}%</p>
            <p className="text-sm text-slate-400 mt-1">
              Respond within 24h
            </p>
          </div>

          {/* Activity Density */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/20">
                <Activity className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{executiveSummary.activityDensity}</p>
            <p className="text-sm text-slate-400 mt-1">
              Activities per lead
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 2: PROPERTY INTEREST + INSIGHTS */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-500" />
              Property Interest Map
            </h2>
            {propertyInterest.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="propertyType" 
                    type="category"
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                  />
                  <YAxis 
                    dataKey="location" 
                    type="category"
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (payload && payload[0]) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm">
                            <p className="font-medium text-white">{data.propertyType} - {data.location}</p>
                            <p className="text-slate-400">{data.leadCount} leads</p>
                            <p className="text-slate-400">{data.activityCount} activities</p>
                            <p className="text-slate-400">Avg Score: {data.avgScore}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Scatter data={propertyInterest.data} name="Interest">
                    {propertyInterest.data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.avgScore >= 70 ? COLORS.green : entry.avgScore >= 40 ? COLORS.yellow : COLORS.red}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                Add leads with property types to see the interest map
              </div>
            )}
          </div>

          {/* Insights Panel */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-400" />
              Key Insights
            </h2>
            <div className="space-y-4">
              {propertyInterest.hottest && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-medium text-emerald-400">Hottest Segment</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {propertyInterest.hottest.propertyType} in {propertyInterest.hottest.location} - {propertyInterest.hottest.leadCount} leads, avg score {propertyInterest.hottest.avgScore}
                  </p>
                </div>
              )}
              {propertyInterest.coldest && propertyInterest.coldest.avgScore < 50 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Needs Attention</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {propertyInterest.coldest.propertyType} in {propertyInterest.coldest.location} - low engagement, consider re-engagement campaign
                  </p>
                </div>
              )}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Recommendation</span>
                </div>
                <p className="text-sm text-slate-300">
                  Focus follow-ups on your hottest property segment for maximum conversion
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 3: BEHAVIORAL PATTERNS */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Engagement Heatmap */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              Engagement by Time
            </h2>
            <div className="space-y-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                <div key={day} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-8">{day}</span>
                  <div className="flex gap-0.5 flex-1">
                    {behavioralPatterns.engagementGrid[dayIndex].slice(6, 22).map((count, hourIndex) => (
                      <div
                        key={hourIndex}
                        className="flex-1 h-4 rounded-sm transition-colors"
                        style={{
                          backgroundColor: count === 0 
                            ? '#1e293b' 
                            : `rgba(16, 185, 129, ${Math.min(count / 5, 1)})`,
                        }}
                        title={`${day} ${hourIndex + 6}:00 - ${count} activities`}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-xs text-slate-500 mt-2 pl-10">
                <span>6AM</span>
                <span>12PM</span>
                <span>6PM</span>
                <span>10PM</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-sm text-emerald-400">
                <Zap className="h-4 w-4 inline mr-1" />
                Peak: {behavioralPatterns.peakDay} {behavioralPatterns.peakHour}:00-{behavioralPatterns.peakHour + 2}:00 ({behavioralPatterns.peakCount} activities)
              </p>
            </div>
          </div>

          {/* Activity Effectiveness */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Activity Effectiveness
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={behavioralPatterns.effectivenessData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748B" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis 
                  dataKey="type" 
                  type="category" 
                  stroke="#64748B" 
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  width={120}
                />
                <Tooltip
                  content={({ payload }) => {
                    if (payload && payload[0]) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm">
                          <p className="text-white">{data.type}</p>
                          <p className="text-emerald-400">{data.conversionRate}% → Hot</p>
                          <p className="text-slate-400">{data.count} total</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="conversionRate" fill={COLORS.emerald} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {behavioralPatterns.effectivenessData[0] && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-sm text-blue-400">
                  <Lightbulb className="h-4 w-4 inline mr-1" />
                  {behavioralPatterns.effectivenessData[0].type} has {behavioralPatterns.effectivenessData[0].conversionRate}% conversion - prioritize this activity
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 4: DIFFERENTIATING FACTORS */}
        {/* ============================================ */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-500" />
            What Differentiates Hot vs Cold Leads?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hot Leads Column */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="h-5 w-5 text-emerald-400" />
                <span className="font-medium text-emerald-400">Hot Leads ({differentiatingFactors.hot.count})</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Response Time</span>
                  <span className="text-white">{differentiatingFactors.hot.avgResponseTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Activities</span>
                  <span className="text-white">{differentiatingFactors.hot.avgActivities}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Common Question</span>
                  <span className="text-white text-right max-w-[150px] truncate">{differentiatingFactors.hot.mostCommonQuestion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Property Type</span>
                  <span className="text-white">{differentiatingFactors.hot.mostCommonPropertyType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Budget</span>
                  <span className="text-white">{formatINR(differentiatingFactors.hot.avgBudget)}</span>
                </div>
              </div>
            </div>

            {/* Cold Leads Column */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <span className="font-medium text-red-400">Cold Leads ({differentiatingFactors.cold.count})</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Response Time</span>
                  <span className="text-white">{differentiatingFactors.cold.avgResponseTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Activities</span>
                  <span className="text-white">{differentiatingFactors.cold.avgActivities}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Common Question</span>
                  <span className="text-white text-right max-w-[150px] truncate">{differentiatingFactors.cold.mostCommonQuestion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Property Type</span>
                  <span className="text-white">{differentiatingFactors.cold.mostCommonPropertyType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Budget</span>
                  <span className="text-white">{formatINR(differentiatingFactors.cold.avgBudget)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Insight */}
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-400 mb-1">🎯 Key Differentiator</p>
                <p className="text-sm text-slate-300">
                  Leads who respond quickly and ask about payment plans are significantly more likely to convert. 
                  Focus on understanding financing needs early in the conversation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 5: PREDICTIVE LEAD SCORING */}
        {/* ============================================ */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-500" />
            Who Should You Call Right Now?
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">#</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Lead</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Probability</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400 hidden md:table-cell">Next Action</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Urgency</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {predictiveScoring.map((lead, index) => (
                  <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-500">{index + 1}</td>
                    <td className="py-3 px-4">
                      <p className="text-white font-medium">{lead.name}</p>
                      <p className="text-slate-500 text-sm">{lead.phone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${lead.probability}%`,
                              backgroundColor: lead.probability >= 70 ? COLORS.green : lead.probability >= 50 ? COLORS.yellow : COLORS.red,
                            }}
                          />
                        </div>
                        <span className="text-sm text-slate-300">{lead.probability}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <p className="text-sm text-slate-400 max-w-[200px] truncate">{lead.nextAction}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {lead.urgency === 'hot' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                          <Flame className="h-3 w-3" /> Hot
                        </span>
                      )}
                      {lead.urgency === 'urgent' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                          <Zap className="h-3 w-3" /> Urgent
                        </span>
                      )}
                      {lead.urgency === 'followup' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500/20 text-slate-400 text-xs rounded-full">
                          <Clock className="h-3 w-3" /> Follow-up
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                        className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 ml-auto"
                      >
                        View <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 6: SOURCE PERFORMANCE */}
        {/* ============================================ */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            Lead Source Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Source</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Leads</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Avg Score</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Hot %</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Activities/Lead</th>
                </tr>
              </thead>
              <tbody>
                {sourcePerformance.map((source) => (
                  <tr key={source.source} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-white font-medium">{source.source}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">{source.count}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`${source.avgScore >= 70 ? 'text-emerald-400' : source.avgScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {source.avgScore}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${source.conversionRate >= 30 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                        {source.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">{source.activitiesPerLead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sourcePerformance[0] && sourcePerformance[0].conversionRate > 0 && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-sm text-emerald-400">
                <Lightbulb className="h-4 w-4 inline mr-1" />
                {sourcePerformance[0].source} has the highest conversion rate at {sourcePerformance[0].conversionRate}%. Consider increasing focus on this channel.
              </p>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SECTION 7: TIMELINE TRENDS */}
        {/* ============================================ */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Timeline Trends
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={timelineTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="date" 
                stroke="#64748B" 
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                interval={dateRange === '7d' ? 0 : dateRange === '30d' ? 4 : 10}
              />
              <YAxis stroke="#64748B" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <Tooltip
                content={({ payload, label }) => {
                  if (payload && payload.length > 0) {
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm">
                        <p className="text-white font-medium mb-2">{label}</p>
                        {payload.map((p, i) => (
                          <p key={i} style={{ color: p.color }} className="text-sm">
                            {p.name}: {p.value}
                          </p>
                        ))}
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              <Bar dataKey="activities" name="Activities" fill={COLORS.blue} opacity={0.3} />
              <Line type="monotone" dataKey="leads" name="New Leads" stroke={COLORS.emerald} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="hotLeads" name="Hot Leads" stroke={COLORS.yellow} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          
          {/* Trend Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {timelineTrends.reduce((sum, d) => sum + d.leads, 0)}
              </p>
              <p className="text-sm text-slate-400">Total New Leads</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">
                {timelineTrends.reduce((sum, d) => sum + d.hotLeads, 0)}
              </p>
              <p className="text-sm text-slate-400">Became Hot</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">
                {timelineTrends.reduce((sum, d) => sum + d.activities, 0)}
              </p>
              <p className="text-sm text-slate-400">Activities Logged</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

