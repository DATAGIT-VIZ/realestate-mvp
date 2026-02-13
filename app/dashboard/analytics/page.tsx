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
        // MOCK DATA FALLBACK
        console.log('No session found - Using MOCK DATA for analytics')

        // Generate more comprehensive mock data for analytics
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
  // SECTION 8: PROPERTY COMPARISON ANALYSIS
  // ============================================
  const propertyComparison = useMemo(() => {
    // Property types with most inquiries
    const propertyTypeInquiries: Record<string, { type: string; count: number; activities: number; avgScore: number; totalScore: number }> = {}

    leads.forEach(lead => {
      const type = lead.property_type || 'Unknown'
      if (!propertyTypeInquiries[type]) {
        propertyTypeInquiries[type] = { type, count: 0, activities: 0, avgScore: 0, totalScore: 0 }
      }
      propertyTypeInquiries[type].count++
      propertyTypeInquiries[type].totalScore += lead.intent_score
    })

    activities.forEach(activity => {
      const lead = leads.find(l => l.id === activity.lead_id)
      if (lead) {
        const type = lead.property_type || 'Unknown'
        if (propertyTypeInquiries[type]) {
          propertyTypeInquiries[type].activities++
        }
      }
    })

    const propertyTypeData = Object.values(propertyTypeInquiries)
      .map(p => ({
        ...p,
        avgScore: p.count > 0 ? Math.round(p.totalScore / p.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Locations with fastest responses
    const locationResponses: Record<string, { location: string; totalResponseTime: number; responseCount: number; leadCount: number }> = {}

    leads.forEach(lead => {
      const locations = lead.locations || ['Unknown']
      locations.forEach(location => {
        if (!locationResponses[location]) {
          locationResponses[location] = { location, totalResponseTime: 0, responseCount: 0, leadCount: 0 }
        }
        locationResponses[location].leadCount++
      })
    })

    activities.forEach(activity => {
      const lead = leads.find(l => l.id === activity.lead_id)
      if (lead && activity.activity_data?.response_time) {
        const locations = lead.locations || ['Unknown']
        const responseTimeMap: Record<string, number> = {
          'Within 2 hours': 2,
          'Within 24 hours': 24,
          '1-3 days': 48,
          '3+ days': 96,
          'No response yet': 168,
        }
        const responseTimeValue = responseTimeMap[activity.activity_data.response_time as string] ?? 100

        locations.forEach(location => {
          if (locationResponses[location]) {
            locationResponses[location].totalResponseTime += responseTimeValue
            locationResponses[location].responseCount++
          }
        })
      }
    })

    const locationData = Object.values(locationResponses)
      .filter(l => l.responseCount > 0)
      .map(l => ({
        ...l,
        avgResponseTime: Math.round(l.totalResponseTime / l.responseCount),
        avgResponseLabel: l.totalResponseTime / l.responseCount <= 2 ? '< 2 hrs' :
          l.totalResponseTime / l.responseCount <= 24 ? '< 24 hrs' :
            l.totalResponseTime / l.responseCount <= 48 ? '1-3 days' : '3+ days'
      }))
      .sort((a, b) => a.avgResponseTime - b.avgResponseTime)
      .slice(0, 8)

    // Budget brackets with highest conversion
    const budgetBrackets = [
      { label: '< ₹25L', min: 0, max: 2500000 },
      { label: '₹25L - ₹50L', min: 2500000, max: 5000000 },
      { label: '₹50L - ₹1Cr', min: 5000000, max: 10000000 },
      { label: '₹1Cr - ₹2Cr', min: 10000000, max: 20000000 },
      { label: '> ₹2Cr', min: 20000000, max: Infinity },
    ]

    const budgetData = budgetBrackets.map(bracket => {
      const bracketLeads = leads.filter(l => {
        const budget = l.budget_max || l.budget_min || 0
        return budget >= bracket.min && budget < bracket.max
      })
      const hotLeads = bracketLeads.filter(l => l.intent_score >= 70)
      return {
        bracket: bracket.label,
        count: bracketLeads.length,
        hotCount: hotLeads.length,
        conversionRate: bracketLeads.length > 0 ? Math.round((hotLeads.length / bracketLeads.length) * 100) : 0,
      }
    }).filter(b => b.count > 0)

    // Heatmap matrix: Property Type vs Location
    const heatmapData: Array<{ propertyType: string; location: string; value: number; leads: number; hotLeads: number }> = []
    const propertyTypes = [...new Set(leads.map(l => l.property_type || 'Unknown'))].slice(0, 6)
    const locations = [...new Set(leads.flatMap(l => l.locations || ['Unknown']))].slice(0, 6)

    propertyTypes.forEach(propertyType => {
      locations.forEach(location => {
        const matchingLeads = leads.filter(l =>
          (l.property_type || 'Unknown') === propertyType &&
          (l.locations || ['Unknown']).includes(location)
        )
        const hotLeads = matchingLeads.filter(l => l.intent_score >= 70)
        if (matchingLeads.length > 0) {
          heatmapData.push({
            propertyType,
            location,
            value: matchingLeads.length,
            leads: matchingLeads.length,
            hotLeads: hotLeads.length,
          })
        }
      })
    })

    // Find best performing combination
    const bestCombo = heatmapData.reduce((best, current) =>
      current.hotLeads > (best?.hotLeads || 0) ? current : best
      , heatmapData[0])

    return {
      propertyTypeData,
      locationData,
      budgetData,
      heatmapData,
      propertyTypes,
      locations,
      bestCombo,
    }
  }, [leads, activities])

  // ============================================
  // SECTION 9: LEAD FLOW ANALYSIS (Sankey-style)
  // ============================================
  const leadFlow = useMemo(() => {
    // Define statuses based on intent score and activity
    const getLeadStatus = (lead: Lead) => {
      if (lead.intent_score >= 70) return 'Hot'
      if (lead.intent_score >= 40) return 'Warm'

      // Check if contacted (has any activity)
      const hasActivity = activities.some(a => a.lead_id === lead.id)
      if (hasActivity) return 'Contacted'

      return 'New'
    }

    // Check if lead responded
    const hasResponded = (leadId: string) => {
      return activities.some(a =>
        a.lead_id === leadId &&
        a.activity_data?.response_time &&
        a.activity_data.response_time !== 'No response yet'
      )
    }

    // Group by source
    const sourceGroups: Record<string, {
      source: string
      total: number
      new: number
      contacted: number
      responded: number
      warm: number
      hot: number
      noResponse: number
    }> = {}

    leads.forEach(lead => {
      const source = lead.source || 'Unknown'
      if (!sourceGroups[source]) {
        sourceGroups[source] = {
          source,
          total: 0,
          new: 0,
          contacted: 0,
          responded: 0,
          warm: 0,
          hot: 0,
          noResponse: 0,
        }
      }

      sourceGroups[source].total++

      const status = getLeadStatus(lead)
      const responded = hasResponded(lead.id)

      if (status === 'New') {
        sourceGroups[source].new++
      } else if (status === 'Contacted') {
        sourceGroups[source].contacted++
        if (responded) {
          sourceGroups[source].responded++
        } else {
          sourceGroups[source].noResponse++
        }
      } else if (status === 'Warm') {
        sourceGroups[source].warm++
        sourceGroups[source].responded++
      } else if (status === 'Hot') {
        sourceGroups[source].hot++
        sourceGroups[source].responded++
      }
    })

    const flowData = Object.values(sourceGroups)
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)

    // Calculate overall funnel metrics
    const totalLeads = leads.length
    const contactedLeads = leads.filter(l => activities.some(a => a.lead_id === l.id)).length
    const respondedLeads = leads.filter(l => hasResponded(l.id)).length
    const warmLeads = leads.filter(l => l.intent_score >= 40 && l.intent_score < 70).length
    const hotLeads = leads.filter(l => l.intent_score >= 70).length

    const funnel = [
      { stage: 'Total Leads', count: totalLeads, percentage: 100 },
      { stage: 'Contacted', count: contactedLeads, percentage: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0 },
      { stage: 'Responded', count: respondedLeads, percentage: totalLeads > 0 ? Math.round((respondedLeads / totalLeads) * 100) : 0 },
      { stage: 'Warm+', count: warmLeads + hotLeads, percentage: totalLeads > 0 ? Math.round(((warmLeads + hotLeads) / totalLeads) * 100) : 0 },
      { stage: 'Hot', count: hotLeads, percentage: totalLeads > 0 ? Math.round((hotLeads / totalLeads) * 100) : 0 },
    ]

    // Find biggest drop-off
    const dropOffs = funnel.slice(1).map((stage, i) => ({
      from: funnel[i].stage,
      to: stage.stage,
      dropped: funnel[i].count - stage.count,
      dropRate: funnel[i].count > 0 ? Math.round(((funnel[i].count - stage.count) / funnel[i].count) * 100) : 0,
    })).filter(d => d.dropped > 0)

    const biggestDropOff = dropOffs.reduce((max, d) => d.dropRate > max.dropRate ? d : max, dropOffs[0])

    // Find worst performing source
    const sourcesWithDropOff = flowData.map(s => ({
      source: s.source,
      total: s.total,
      noResponseRate: s.contacted > 0 ? Math.round(((s.contacted - s.responded) / s.contacted) * 100) : 0,
      conversionRate: s.total > 0 ? Math.round((s.hot / s.total) * 100) : 0,
    })).sort((a, b) => b.noResponseRate - a.noResponseRate)

    const worstSource = sourcesWithDropOff[0]

    return {
      flowData,
      funnel,
      biggestDropOff,
      worstSource,
      totalLeads,
      contactedLeads,
      respondedLeads,
      hotLeads,
    }
  }, [leads, activities])

  // ============================================
  // SECTION 10: PROPERTY FEATURES ANALYSIS
  // ============================================
  const propertyFeatures = useMemo(() => {
    // Define amenities/features to track
    const amenityKeywords = [
      { name: 'Metro/Railway', keywords: ['metro', 'railway', 'station', 'train', 'transit'], icon: '🚇' },
      { name: 'Gym/Fitness', keywords: ['gym', 'fitness', 'workout', 'exercise'], icon: '🏋️' },
      { name: 'Swimming Pool', keywords: ['pool', 'swimming', 'swim'], icon: '🏊' },
      { name: 'Parking', keywords: ['parking', 'garage', 'car park', 'covered parking'], icon: '🅿️' },
      { name: 'Garden/Park', keywords: ['garden', 'park', 'green', 'landscap'], icon: '🌳' },
      { name: 'Security', keywords: ['security', 'guard', 'cctv', 'gated'], icon: '🔒' },
      { name: 'School Nearby', keywords: ['school', 'education', 'college', 'university'], icon: '🏫' },
      { name: 'Hospital Nearby', keywords: ['hospital', 'clinic', 'medical', 'healthcare'], icon: '🏥' },
      { name: 'Mall/Shopping', keywords: ['mall', 'shopping', 'market', 'retail'], icon: '🛒' },
      { name: 'Club House', keywords: ['club', 'clubhouse', 'community', 'recreation'], icon: '🏠' },
    ]

    // Analyze which leads/activities mention each amenity
    const amenityStats: Record<string, {
      name: string
      icon: string
      leadsCount: number
      avgScore: number
      totalScore: number
      hotLeadsCount: number
      leadIds: Set<string>
    }> = {}

    amenityKeywords.forEach(amenity => {
      amenityStats[amenity.name] = {
        name: amenity.name,
        icon: amenity.icon,
        leadsCount: 0,
        avgScore: 0,
        totalScore: 0,
        hotLeadsCount: 0,
        leadIds: new Set(),
      }
    })

    // Check activities for amenity mentions
    activities.forEach(activity => {
      const lead = leads.find(l => l.id === activity.lead_id)
      if (!lead) return

      const textToSearch = [
        activity.activity_data?.notes || '',
        ...(activity.activity_data?.questions_asked || []),
      ].join(' ').toLowerCase()

      amenityKeywords.forEach(amenity => {
        const mentioned = amenity.keywords.some(keyword => textToSearch.includes(keyword))
        if (mentioned && !amenityStats[amenity.name].leadIds.has(lead.id)) {
          amenityStats[amenity.name].leadIds.add(lead.id)
          amenityStats[amenity.name].leadsCount++
          amenityStats[amenity.name].totalScore += lead.intent_score
          if (lead.intent_score >= 70) {
            amenityStats[amenity.name].hotLeadsCount++
          }
        }
      })
    })

    // Also check locations for metro mentions
    leads.forEach(lead => {
      const locationText = (lead.locations || []).join(' ').toLowerCase()
      if (locationText.includes('metro') || locationText.includes('station') || locationText.includes('railway')) {
        if (!amenityStats['Metro/Railway'].leadIds.has(lead.id)) {
          amenityStats['Metro/Railway'].leadIds.add(lead.id)
          amenityStats['Metro/Railway'].leadsCount++
          amenityStats['Metro/Railway'].totalScore += lead.intent_score
          if (lead.intent_score >= 70) {
            amenityStats['Metro/Railway'].hotLeadsCount++
          }
        }
      }
    })

    // Calculate averages and sort
    const amenityData = Object.values(amenityStats)
      .map(a => ({
        ...a,
        avgScore: a.leadsCount > 0 ? Math.round(a.totalScore / a.leadsCount) : 0,
        conversionRate: a.leadsCount > 0 ? Math.round((a.hotLeadsCount / a.leadsCount) * 100) : 0,
      }))
      .filter(a => a.leadsCount > 0)
      .sort((a, b) => b.avgScore - a.avgScore)

    // Calculate overall average for comparison
    const overallAvgScore = leads.length > 0
      ? Math.round(leads.reduce((sum, l) => sum + l.intent_score, 0) / leads.length)
      : 0

    // Find top performing amenity
    const topAmenity = amenityData[0]
    const scoreDifference = topAmenity
      ? Math.round(((topAmenity.avgScore - overallAvgScore) / overallAvgScore) * 100)
      : 0

    // Metro vs non-metro analysis
    const metroLeadIds = amenityStats['Metro/Railway'].leadIds
    const metroLeads = leads.filter(l => metroLeadIds.has(l.id))
    const nonMetroLeads = leads.filter(l => !metroLeadIds.has(l.id))

    const metroAnalysis = {
      metroCount: metroLeads.length,
      nonMetroCount: nonMetroLeads.length,
      metroAvgScore: metroLeads.length > 0
        ? Math.round(metroLeads.reduce((sum, l) => sum + l.intent_score, 0) / metroLeads.length)
        : 0,
      nonMetroAvgScore: nonMetroLeads.length > 0
        ? Math.round(nonMetroLeads.reduce((sum, l) => sum + l.intent_score, 0) / nonMetroLeads.length)
        : 0,
      metroHotRate: metroLeads.length > 0
        ? Math.round((metroLeads.filter(l => l.intent_score >= 70).length / metroLeads.length) * 100)
        : 0,
      nonMetroHotRate: nonMetroLeads.length > 0
        ? Math.round((nonMetroLeads.filter(l => l.intent_score >= 70).length / nonMetroLeads.length) * 100)
        : 0,
    }

    return {
      amenityData,
      overallAvgScore,
      topAmenity,
      scoreDifference,
      metroAnalysis,
    }
  }, [leads, activities])

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
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateRange === range
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

        {/* ============================================ */}
        {/* SECTION 8: PROPERTY COMPARISON ANALYSIS */}
        {/* ============================================ */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Building className="h-5 w-5 text-emerald-500" />
            Property Comparison Analysis
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Property Types with Most Inquiries */}
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-400" />
                Property Types - Most Inquiries
              </h3>
              {propertyComparison.propertyTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={propertyComparison.propertyTypeData.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#64748B" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <YAxis
                      dataKey="type"
                      type="category"
                      stroke="#64748B"
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      width={80}
                    />
                    <Tooltip
                      content={({ payload }) => {
                        if (payload && payload[0]) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm">
                              <p className="text-white font-medium">{data.type}</p>
                              <p className="text-blue-400">{data.count} leads</p>
                              <p className="text-slate-400">Avg Score: {data.avgScore}</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="count" fill={COLORS.blue} radius={[0, 4, 4, 0]}>
                      {propertyComparison.propertyTypeData.slice(0, 5).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.avgScore >= 70 ? COLORS.green : entry.avgScore >= 40 ? COLORS.yellow : COLORS.blue}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                  Add property types to leads to see data
                </div>
              )}
            </div>

            {/* Locations with Fastest Responses */}
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-400" />
                Locations - Fastest Responses
              </h3>
              {propertyComparison.locationData.length > 0 ? (
                <div className="space-y-3">
                  {propertyComparison.locationData.slice(0, 5).map((location, index) => (
                    <div key={location.location} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-500 w-6">{index + 1}</span>
                        <span className="text-white text-sm truncate max-w-[120px]">{location.location}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${location.avgResponseTime <= 2 ? 'bg-emerald-500/20 text-emerald-400' :
                            location.avgResponseTime <= 24 ? 'bg-blue-500/20 text-blue-400' :
                              'bg-amber-500/20 text-amber-400'
                          }`}>
                          {location.avgResponseLabel}
                        </span>
                        <span className="text-slate-400 text-xs">{location.leadCount} leads</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                  Add locations to leads and log activities
                </div>
              )}
            </div>
          </div>

          {/* Budget Brackets with Highest Conversion */}
          <div className="bg-slate-800/30 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-400" />
              Budget Brackets - Conversion Rate
            </h3>
            {propertyComparison.budgetData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={propertyComparison.budgetData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="bracket"
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                  />
                  <YAxis stroke="#64748B" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip
                    content={({ payload }) => {
                      if (payload && payload[0]) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm">
                            <p className="text-white font-medium">{data.bracket}</p>
                            <p className="text-amber-400">{data.conversionRate}% → Hot</p>
                            <p className="text-slate-400">{data.count} leads ({data.hotCount} hot)</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="conversionRate" fill={COLORS.yellow} radius={[4, 4, 0, 0]}>
                    {propertyComparison.budgetData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.conversionRate >= 50 ? COLORS.green : entry.conversionRate >= 25 ? COLORS.yellow : COLORS.slate}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-500 text-sm">
                Add budget information to leads to see data
              </div>
            )}
          </div>

          {/* Property Type vs Location Heatmap */}
          <div className="bg-slate-800/30 rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-400" />
              Heatmap: Property Type × Location
            </h3>
            {propertyComparison.heatmapData.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {/* Header row with locations */}
                  <div className="flex items-center mb-2">
                    <div className="w-24 flex-shrink-0" />
                    {propertyComparison.locations.map(location => (
                      <div key={location} className="flex-1 text-center">
                        <span className="text-xs text-slate-400 truncate block px-1" title={location}>
                          {location.length > 10 ? location.slice(0, 10) + '...' : location}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Property type rows */}
                  {propertyComparison.propertyTypes.map(propertyType => (
                    <div key={propertyType} className="flex items-center mb-1">
                      <div className="w-24 flex-shrink-0 pr-2">
                        <span className="text-xs text-slate-400 truncate block" title={propertyType}>
                          {propertyType.length > 12 ? propertyType.slice(0, 12) + '...' : propertyType}
                        </span>
                      </div>
                      {propertyComparison.locations.map(location => {
                        const cell = propertyComparison.heatmapData.find(
                          d => d.propertyType === propertyType && d.location === location
                        )
                        const intensity = cell ? Math.min(cell.value / 5, 1) : 0
                        const hasHot = cell && cell.hotLeads > 0

                        return (
                          <div key={location} className="flex-1 px-0.5">
                            <div
                              className="h-10 rounded-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                              style={{
                                backgroundColor: cell
                                  ? hasHot
                                    ? `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`
                                    : `rgba(59, 130, 246, ${0.2 + intensity * 0.4})`
                                  : '#1e293b',
                              }}
                              title={cell ? `${propertyType} in ${location}: ${cell.leads} leads (${cell.hotLeads} hot)` : 'No data'}
                            >
                              {cell && (
                                <span className={`text-xs font-medium ${hasHot ? 'text-emerald-300' : 'text-blue-300'}`}>
                                  {cell.leads}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-emerald-500/60" />
                      <span className="text-xs text-slate-400">Has Hot Leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500/40" />
                      <span className="text-xs text-slate-400">Has Leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-slate-700" />
                      <span className="text-xs text-slate-400">No Data</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                Add property types and locations to see the heatmap
              </div>
            )}
          </div>

          {/* Best Performing Combo Insight */}
          {propertyComparison.bestCombo && propertyComparison.bestCombo.hotLeads > 0 && (
            <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-400 mb-1">🏆 Best Performing Segment</p>
                  <p className="text-sm text-slate-300">
                    <strong>{propertyComparison.bestCombo.propertyType}</strong> in <strong>{propertyComparison.bestCombo.location}</strong> has
                    the highest conversion with {propertyComparison.bestCombo.hotLeads} hot leads out of {propertyComparison.bestCombo.leads} total.
                    Focus your marketing and follow-ups on this segment!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SECTION 9: LEAD FLOW ANALYSIS */}
        {/* ============================================ */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" />
            Lead Flow Analysis
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Conversion Funnel */}
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-400" />
                Conversion Funnel
              </h3>
              <div className="space-y-3">
                {leadFlow.funnel.map((stage, index) => {
                  const width = stage.percentage
                  const isDropOff = index > 0 && leadFlow.funnel[index - 1].percentage - stage.percentage > 20
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-300">{stage.stage}</span>
                        <span className="text-sm text-slate-400">
                          {stage.count} ({stage.percentage}%)
                        </span>
                      </div>
                      <div className="relative h-8 bg-slate-700/50 rounded-lg overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 h-full rounded-lg transition-all duration-500 ${index === 0 ? 'bg-blue-500' :
                              index === 1 ? 'bg-cyan-500' :
                                index === 2 ? 'bg-emerald-500' :
                                  index === 3 ? 'bg-amber-500' :
                                    'bg-orange-500'
                            }`}
                          style={{ width: `${width}%` }}
                        />
                        {isDropOff && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <span className="text-xs text-red-400 font-medium">
                              ↓ {leadFlow.funnel[index - 1].percentage - stage.percentage}% drop
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Source to Status Flow */}
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                Source → Status Flow
              </h3>
              {leadFlow.flowData.length > 0 ? (
                <div className="space-y-3">
                  {leadFlow.flowData.slice(0, 5).map((source) => {
                    const hotWidth = source.total > 0 ? (source.hot / source.total) * 100 : 0
                    const warmWidth = source.total > 0 ? (source.warm / source.total) * 100 : 0
                    const contactedWidth = source.total > 0 ? (source.contacted / source.total) * 100 : 0
                    const newWidth = source.total > 0 ? (source.new / source.total) * 100 : 0

                    return (
                      <div key={source.source}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 truncate max-w-[100px]">{source.source}</span>
                          <span className="text-xs text-slate-500">{source.total} leads</span>
                        </div>
                        <div className="flex h-6 rounded-lg overflow-hidden bg-slate-700/30">
                          {hotWidth > 0 && (
                            <div
                              className="bg-orange-500 flex items-center justify-center"
                              style={{ width: `${hotWidth}%` }}
                              title={`Hot: ${source.hot}`}
                            >
                              {hotWidth > 15 && <span className="text-[10px] text-white font-medium">{source.hot}</span>}
                            </div>
                          )}
                          {warmWidth > 0 && (
                            <div
                              className="bg-amber-500 flex items-center justify-center"
                              style={{ width: `${warmWidth}%` }}
                              title={`Warm: ${source.warm}`}
                            >
                              {warmWidth > 15 && <span className="text-[10px] text-white font-medium">{source.warm}</span>}
                            </div>
                          )}
                          {contactedWidth > 0 && (
                            <div
                              className="bg-blue-500 flex items-center justify-center"
                              style={{ width: `${contactedWidth}%` }}
                              title={`Contacted: ${source.contacted}`}
                            >
                              {contactedWidth > 15 && <span className="text-[10px] text-white font-medium">{source.contacted}</span>}
                            </div>
                          )}
                          {newWidth > 0 && (
                            <div
                              className="bg-slate-500 flex items-center justify-center"
                              style={{ width: `${newWidth}%` }}
                              title={`New: ${source.new}`}
                            >
                              {newWidth > 15 && <span className="text-[10px] text-white font-medium">{source.new}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-700">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-orange-500" />
                      <span className="text-xs text-slate-400">Hot</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-amber-500" />
                      <span className="text-xs text-slate-400">Warm</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      <span className="text-xs text-slate-400">Contacted</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-slate-500" />
                      <span className="text-xs text-slate-400">New</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                  Add leads with sources to see the flow
                </div>
              )}
            </div>
          </div>

          {/* Drop-off Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Biggest Drop-off */}
            {leadFlow.biggestDropOff && leadFlow.biggestDropOff.dropped > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <span className="font-medium text-red-400">Biggest Drop-off</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {leadFlow.biggestDropOff.dropRate}%
                </p>
                <p className="text-sm text-slate-400">
                  {leadFlow.biggestDropOff.dropped} leads drop between{' '}
                  <span className="text-slate-300">{leadFlow.biggestDropOff.from}</span> →{' '}
                  <span className="text-slate-300">{leadFlow.biggestDropOff.to}</span>
                </p>
              </div>
            )}

            {/* Worst Performing Source */}
            {leadFlow.worstSource && leadFlow.worstSource.noResponseRate > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                  <span className="font-medium text-amber-400">Lowest Response Rate</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {leadFlow.worstSource.source}
                </p>
                <p className="text-sm text-slate-400">
                  {leadFlow.worstSource.noResponseRate}% of contacted leads never respond
                  <span className="text-slate-500 ml-1">({leadFlow.worstSource.total} total leads)</span>
                </p>
              </div>
            )}
          </div>

          {/* Flow Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{leadFlow.totalLeads}</p>
              <p className="text-xs text-slate-400">Total Leads</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-cyan-400">
                {leadFlow.totalLeads > 0 ? Math.round((leadFlow.contactedLeads / leadFlow.totalLeads) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-400">Contact Rate</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {leadFlow.contactedLeads > 0 ? Math.round((leadFlow.respondedLeads / leadFlow.contactedLeads) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-400">Response Rate</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">
                {leadFlow.totalLeads > 0 ? Math.round((leadFlow.hotLeads / leadFlow.totalLeads) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-400">Conversion Rate</p>
            </div>
          </div>

          {/* Actionable Insight */}
          {leadFlow.biggestDropOff && leadFlow.biggestDropOff.dropped > 0 && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-400 mb-1">💡 Where to Focus</p>
                  <p className="text-sm text-slate-300">
                    {leadFlow.biggestDropOff.from === 'Total Leads' && leadFlow.biggestDropOff.to === 'Contacted' ? (
                      <>You have {leadFlow.biggestDropOff.dropped} leads that haven&apos;t been contacted yet. Start with a quick intro call or message to move them through the funnel.</>
                    ) : leadFlow.biggestDropOff.from === 'Contacted' && leadFlow.biggestDropOff.to === 'Responded' ? (
                      <>{leadFlow.biggestDropOff.dropRate}% of contacted leads don&apos;t respond. Try different channels (WhatsApp, email) or reach out at different times (evening/weekends).</>
                    ) : leadFlow.biggestDropOff.from === 'Responded' ? (
                      <>Leads who respond need more engagement to become warm. Schedule property viewings or send personalized recommendations.</>
                    ) : (
                      <>Focus on converting {leadFlow.biggestDropOff.from} leads to {leadFlow.biggestDropOff.to} status to improve your overall funnel.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SECTION 10: PROPERTY FEATURES ANALYSIS */}
        {/* ============================================ */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Building className="h-5 w-5 text-emerald-500" />
            Property Features & Amenities Impact
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Metro vs Non-Metro Analysis */}
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                🚇 Metro Proximity Impact
              </h3>
              {propertyFeatures.metroAnalysis.metroCount > 0 || propertyFeatures.metroAnalysis.nonMetroCount > 0 ? (
                <div className="space-y-4">
                  {/* Metro Leads */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-emerald-400 font-medium">Near Metro/Railway</span>
                      <span className="text-xs text-slate-400">{propertyFeatures.metroAnalysis.metroCount} leads</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold text-white">{propertyFeatures.metroAnalysis.metroAvgScore}</p>
                        <p className="text-xs text-slate-500">Avg Score</p>
                      </div>
                      <div className="h-10 w-px bg-slate-700" />
                      <div>
                        <p className="text-2xl font-bold text-emerald-400">{propertyFeatures.metroAnalysis.metroHotRate}%</p>
                        <p className="text-xs text-slate-500">Hot Rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Non-Metro Leads */}
                  <div className="bg-slate-700/30 border border-slate-600/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400 font-medium">Not Near Metro</span>
                      <span className="text-xs text-slate-500">{propertyFeatures.metroAnalysis.nonMetroCount} leads</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold text-white">{propertyFeatures.metroAnalysis.nonMetroAvgScore}</p>
                        <p className="text-xs text-slate-500">Avg Score</p>
                      </div>
                      <div className="h-10 w-px bg-slate-700" />
                      <div>
                        <p className="text-2xl font-bold text-slate-400">{propertyFeatures.metroAnalysis.nonMetroHotRate}%</p>
                        <p className="text-xs text-slate-500">Hot Rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Comparison */}
                  {propertyFeatures.metroAnalysis.metroAvgScore > propertyFeatures.metroAnalysis.nonMetroAvgScore && (
                    <div className="text-center pt-2">
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                        Metro leads score {Math.round(((propertyFeatures.metroAnalysis.metroAvgScore - propertyFeatures.metroAnalysis.nonMetroAvgScore) / propertyFeatures.metroAnalysis.nonMetroAvgScore) * 100)}% higher
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm text-center">
                  <div>
                    <p>No metro-related data found</p>
                    <p className="text-xs mt-1">Add locations with "metro" or log activities mentioning metro proximity</p>
                  </div>
                </div>
              )}
            </div>

            {/* Amenities Impact Chart */}
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                ⭐ Amenities by Intent Score
              </h3>
              {propertyFeatures.amenityData.length > 0 ? (
                <div className="space-y-3">
                  {propertyFeatures.amenityData.slice(0, 6).map((amenity, index) => {
                    const barWidth = propertyFeatures.overallAvgScore > 0
                      ? Math.min((amenity.avgScore / 100) * 100, 100)
                      : 0
                    const isAboveAvg = amenity.avgScore > propertyFeatures.overallAvgScore

                    return (
                      <div key={amenity.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 flex items-center gap-2">
                            <span>{amenity.icon}</span>
                            <span>{amenity.name}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isAboveAvg ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {amenity.avgScore}
                            </span>
                            {isAboveAvg && (
                              <span className="text-xs text-emerald-500">
                                +{amenity.avgScore - propertyFeatures.overallAvgScore}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="relative h-5 bg-slate-700/50 rounded-lg overflow-hidden">
                          <div
                            className={`absolute left-0 top-0 h-full rounded-lg transition-all duration-500 ${isAboveAvg ? 'bg-emerald-500' : 'bg-slate-500'
                              }`}
                            style={{ width: `${barWidth}%` }}
                          />
                          {/* Average line indicator */}
                          <div
                            className="absolute top-0 h-full w-0.5 bg-amber-400"
                            style={{ left: `${propertyFeatures.overallAvgScore}%` }}
                            title={`Overall average: ${propertyFeatures.overallAvgScore}`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            {amenity.leadsCount} leads
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-700 mt-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-emerald-500" />
                      <span className="text-xs text-slate-400">Above Average</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-0.5 h-3 bg-amber-400" />
                      <span className="text-xs text-slate-400">Avg ({propertyFeatures.overallAvgScore})</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm text-center">
                  <div>
                    <p>No amenity data found</p>
                    <p className="text-xs mt-1">Log activities with notes mentioning amenities like gym, pool, parking, etc.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Amenities Grid */}
          {propertyFeatures.amenityData.length > 0 && (
            <div className="bg-slate-800/30 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Amenity Performance Overview</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {propertyFeatures.amenityData.map((amenity) => {
                  const isAboveAvg = amenity.avgScore > propertyFeatures.overallAvgScore
                  return (
                    <div
                      key={amenity.name}
                      className={`rounded-xl p-3 text-center border transition-colors ${isAboveAvg
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-slate-800/50 border-slate-700/50'
                        }`}
                    >
                      <span className="text-2xl">{amenity.icon}</span>
                      <p className="text-xs text-slate-400 mt-1 truncate">{amenity.name}</p>
                      <p className={`text-lg font-bold mt-1 ${isAboveAvg ? 'text-emerald-400' : 'text-white'}`}>
                        {amenity.avgScore}
                      </p>
                      <p className="text-xs text-slate-500">{amenity.leadsCount} leads</p>
                      {amenity.conversionRate > 0 && (
                        <p className={`text-xs mt-1 ${amenity.conversionRate >= 30 ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {amenity.conversionRate}% hot
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Key Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Performing Amenity */}
            {propertyFeatures.topAmenity && propertyFeatures.scoreDifference > 0 && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{propertyFeatures.topAmenity.icon}</span>
                  <div>
                    <p className="font-medium text-emerald-400 mb-1">🏆 Highest Impact Amenity</p>
                    <p className="text-sm text-slate-300">
                      Leads asking about <strong>{propertyFeatures.topAmenity.name}</strong> have{' '}
                      <strong>{propertyFeatures.scoreDifference}% higher</strong> intent scores
                      ({propertyFeatures.topAmenity.avgScore} vs {propertyFeatures.overallAvgScore} average)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Metro Insight */}
            {propertyFeatures.metroAnalysis.metroCount > 0 &&
              propertyFeatures.metroAnalysis.metroAvgScore > propertyFeatures.metroAnalysis.nonMetroAvgScore && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🚇</span>
                    <div>
                      <p className="font-medium text-blue-400 mb-1">💡 Metro Proximity Insight</p>
                      <p className="text-sm text-slate-300">
                        Leads interested in metro-adjacent properties score{' '}
                        <strong>
                          {Math.round(((propertyFeatures.metroAnalysis.metroAvgScore - propertyFeatures.metroAnalysis.nonMetroAvgScore) / propertyFeatures.metroAnalysis.nonMetroAvgScore) * 100)}% higher
                        </strong>{' '}
                        and convert at{' '}
                        <strong>{propertyFeatures.metroAnalysis.metroHotRate}%</strong> vs{' '}
                        <strong>{propertyFeatures.metroAnalysis.nonMetroHotRate}%</strong> for others.
                        Highlight metro connectivity in your listings!
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* No Data State */}
          {propertyFeatures.amenityData.length === 0 && propertyFeatures.metroAnalysis.metroCount === 0 && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 mb-3">
                <Building className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">No property feature data available yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Log activities with notes mentioning amenities (gym, pool, metro, parking, etc.) to see insights
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

