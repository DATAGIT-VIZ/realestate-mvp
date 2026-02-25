'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, Lead, LeadActivity } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import {
 Phone,
 Calendar,
 Clock,
 TrendingUp,
 CheckCircle,
 MessageCircle,
 Eye,
 HelpCircle,
 Flame,
 Target,
 Zap,
 ArrowRight,
 Building,
 MapPin,
 IndianRupee,
 Users,
 BarChart3,
 Activity,
 RefreshCw,
 Mail,
 FileText,
 ThumbsUp,
 ThumbsDown,
 Minus,
 Plus,
 X,
 Settings,
 ChevronUp,
 Send,
 Loader2,
 Bell,
 BellOff,
 Sparkles,
 EyeOff,
 LayoutGrid,
 GripVertical
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, differenceInHours, differenceInDays, isWithinInterval, subHours, subDays, parseISO, startOfDay, endOfDay, startOfWeek } from 'date-fns'

// Animated number component
function AnimatedNumber({ value, prefix = '', suffix = '', duration = 1000 }: {
 value: number;
 prefix?: string;
 suffix?: string;
 duration?: number;
}) {
 const [displayValue, setDisplayValue] = useState(0)

 useEffect(() => {
  let startTime: number
  const startValue = displayValue

  const animate = (currentTime: number) => {
   if (!startTime) startTime = currentTime
   const progress = Math.min((currentTime - startTime) / duration, 1)

   // Easing function for smooth animation
   const easeOutQuart = 1 - Math.pow(1 - progress, 4)
   setDisplayValue(Math.round(startValue + (value - startValue) * easeOutQuart))

   if (progress < 1) {
    requestAnimationFrame(animate)
   }
  }

  requestAnimationFrame(animate)
 }, [value, duration])

 return <>{prefix}{displayValue.toLocaleString()}{suffix}</>
}

// Priority Lead type with calculated action score
type PriorityLead = Lead & {
 actionScore: number
 recentActivities: LeadActivity[]
 scoreBreakdownDetails: {
  label: string
  points: number
  icon: string
 }[]
 keyInsight: string
 urgencyLevel: 'critical' | 'high' | 'medium' | 'low'
 scoreChange: number
}

// Dynamic Hero Card Types
type HeroCardType =
 | 'hot_lead'    // Ready to close
 | 'going_cold'   // Urgent re-engagement
 | 'new_lead'    // Needs first contact
 | 'callback'    // Scheduled callback
 | 'streak'     // Activity streak
 | 'goal_progress'  // Monthly goal
 | 'time_based'   // Time-of-day recommendation

type DynamicHeroCard = {
 type: HeroCardType
 title: string
 subtitle: string
 lead?: Lead & { recentActivities: LeadActivity[] }
 insight: string
 action: string
 urgency: 'critical' | 'high' | 'medium' | 'info'
 gradient: string
 icon: string
 stats?: { label: string; value: string | number }[]
}

export default function DashboardPage() {
 const [user, setUser] = useState<User | null>(null)
 const [leads, setLeads] = useState<Lead[]>([])
 const [activities, setActivities] = useState<LeadActivity[]>([])
 const [loading, setLoading] = useState(true)
 const [currentTime, setCurrentTime] = useState(new Date())
 const [lastRefresh, setLastRefresh] = useState(new Date())
 const [isRefreshing, setIsRefreshing] = useState(false)
 const [isSeeding, setIsSeeding] = useState(false)
 const [seedMessage, setSeedMessage] = useState('')

 // Quick Access Toolbar State
 const [fabOpen, setFabOpen] = useState(false)
 const [quickLogOpen, setQuickLogOpen] = useState(false)
 const [quickMessageOpen, setQuickMessageOpen] = useState(false)
 const [quickLogLoading, setQuickLogLoading] = useState(false)
 const [quickLogForm, setQuickLogForm] = useState({
  leadId: '',
  activityType: 'call',
  note: '',
 })

 // Celebration State
 const [showConfetti, setShowConfetti] = useState(false)
 const [celebrationLead, setCelebrationLead] = useState<Lead | null>(null)
 const [previousHotLeadIds, setPreviousHotLeadIds] = useState<Set<string>>(new Set())

 // Notification State
 const [notificationsEnabled, setNotificationsEnabled] = useState(false)
 const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)

 // Dashboard Customization State
 const [sectionVisibility, setSectionVisibility] = useState({
  hero: true,
  kpis: true,
  actionQueue: true,
  activityFeed: true,
  insights: true,
  momentum: true,
  hotLeads: true,
 })
 const [showCustomizeModal, setShowCustomizeModal] = useState(false)

 // Seed demo data function
 const seedDemoData = async () => {
  if (!user) return

  setIsSeeding(true)
  setSeedMessage('')

  try {
   const response = await fetch('/api/seed-dashboard-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
   })

   const data = await response.json()

   if (data.success) {
    setSeedMessage(`Created ${data.data.leadsCreated} leads & ${data.data.activitiesCreated} activities!`)
    // Refresh data
    await fetchData(true)
   } else {
    setSeedMessage(`Error: ${data.error}`)
   }
  } catch (error) {
   setSeedMessage('Failed to seed data')
  }

  setIsSeeding(false)

  // Clear message after 5 seconds
  setTimeout(() => setSeedMessage(''), 5000)
 }

 // Quick Log Activity function
 const handleQuickLog = async () => {
  if (!quickLogForm.leadId || !user) return

  setQuickLogLoading(true)

  try {
   const { error } = await supabase
    .from('lead_activities')
    .insert({
     lead_id: quickLogForm.leadId,
     agent_id: user.id,
     activity_type: quickLogForm.activityType,
     activity_data: {
      notes: quickLogForm.note || 'Quick log from dashboard',
      outcome: 'Logged',
     },
    })

   if (error) throw error

   // Reset form and close modal
   setQuickLogForm({ leadId: '', activityType: 'call', note: '' })
   setQuickLogOpen(false)

   // Refresh data
   await fetchData(true)
  } catch (error) {
   console.error('Error logging activity:', error)
  }

  setQuickLogLoading(false)
 }

 // Quick Message function (opens WhatsApp)
 const handleQuickMessage = (leadId: string) => {
  const lead = leads.find(l => l.id === leadId)
  if (lead?.phone) {
   window.open(`https://wa.me/91${lead.phone.replace(/\D/g, '')}`, '_blank')
  }
  setQuickMessageOpen(false)
 }

 // Fetch data function (extracted for refresh capability)
 const fetchData = async (showRefreshing = false) => {
  if (showRefreshing) setIsRefreshing(true)

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
   // MOCK DATA FALLBACK for development
   console.log('No session found - Using MOCK DATA for dashboard')

   const mockUser = {
    id: 'mock-user-id',
    email: 'demo@example.com',
    user_metadata: { full_name: 'Demo Agent' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
   } as User

   setUser(mockUser)

   // Create some mock leads
   const mockLeads: Lead[] = [
    {
     id: 'lead-1',
     agent_id: 'mock-user-id',
     name: 'Rahul Sharma',
     email: 'rahul.sharma@example.com',
     phone: '+91 98765 43210',
     source: 'Website',
     source_detail: 'Premium Listing',
     property_type: '3BHK Apartment',
     locations: ['Bandra West', 'Khar'],
     budget_min: 45000000,
     budget_max: 60000000,
     timeline: 'Immediate',
     intent_score: 85,
     score_breakdown: { activity: 30, budget: 20 },
     status: 'Active',
     first_contact_date: subDays(new Date(), 2).toISOString(),
     last_activity_date: new Date().toISOString(),
     created_at: subDays(new Date(), 5).toISOString(),
     updated_at: new Date().toISOString()
    },
    {
     id: 'lead-2',
     agent_id: 'mock-user-id',
     name: 'Priya Patel',
     email: 'priya.p@example.com',
     phone: '+91 99887 76655',
     source: 'Referral',
     source_detail: 'Existing Client',
     property_type: 'Villa',
     locations: ['Juhu', 'Versova'],
     budget_min: 80000000,
     budget_max: 120000000,
     timeline: '3 months',
     intent_score: 72,
     score_breakdown: { budget: 30, profile: 20 },
     status: 'Negotiation',
     first_contact_date: subDays(new Date(), 10).toISOString(),
     last_activity_date: subHours(new Date(), 5).toISOString(),
     created_at: subDays(new Date(), 12).toISOString(),
     updated_at: new Date().toISOString()
    },
    {
     id: 'lead-3',
     agent_id: 'mock-user-id',
     name: 'Amit Verma',
     email: 'amit.v@example.com',
     phone: '+91 91234 56789',
     source: 'MagicBricks',
     source_detail: null,
     property_type: '2BHK',
     locations: ['Andheri East'],
     budget_min: 15000000,
     budget_max: 20000000,
     timeline: '1 month',
     intent_score: 45,
     score_breakdown: {},
     status: 'New',
     first_contact_date: new Date().toISOString(),
     last_activity_date: new Date().toISOString(),
     created_at: subHours(new Date(), 2).toISOString(),
     updated_at: new Date().toISOString()
    },
    {
     id: 'lead-4',
     agent_id: 'mock-user-id',
     name: 'Vikram Singh',
     email: 'vikram.s@example.com',
     phone: '+91 95555 44444',
     source: 'Facebook Ad',
     source_detail: 'Luxury Project Campaign',
     property_type: 'Penthouse',
     locations: ['Worli'],
     budget_min: 150000000,
     budget_max: 200000000,
     timeline: '6 months',
     intent_score: 25,
     score_breakdown: {},
     status: 'Cold',
     first_contact_date: subDays(new Date(), 20).toISOString(),
     last_activity_date: subDays(new Date(), 15).toISOString(),
     created_at: subDays(new Date(), 21).toISOString(),
     updated_at: new Date().toISOString()
    }
   ]

   setLeads(mockLeads)

   // Create mock activities
   const mockActivities: LeadActivity[] = [
    {
     id: 'act-1',
     lead_id: 'lead-1',
     agent_id: 'mock-user-id',
     activity_type: 'site_visit',
     activity_data: { notes: 'Visited the 3BHK unit. Liked the view.', outcome: 'Interested' },
     created_at: subHours(new Date(), 4).toISOString()
    },
    {
     id: 'act-2',
     lead_id: 'lead-2',
     agent_id: 'mock-user-id',
     activity_type: 'call',
     activity_data: { notes: 'Discussed pricing negotiation.', outcome: 'Ongoing', duration: '15 mins' },
     created_at: subHours(new Date(), 26).toISOString()
    },
    {
     id: 'act-3',
     lead_id: 'lead-1',
     agent_id: 'mock-user-id',
     activity_type: 'whatsapp',
     activity_data: { message: 'Sent brochure PDF.' },
     created_at: subDays(new Date(), 1).toISOString()
    }
   ]

   setActivities(mockActivities)
   setLastRefresh(new Date())
   setLoading(false)
   setIsRefreshing(false)
   return
  }

  if (session) {
   setUser(session.user)

   // Fetch all leads
   const { data: leadsData } = await supabase
    .from('leads')
    .select('*')
    .eq('agent_id', session.user.id)
    .order('intent_score', { ascending: false })

   if (leadsData) setLeads(leadsData)

   // Fetch all activities
   const { data: activitiesData } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('agent_id', session.user.id)
    .order('created_at', { ascending: false })

   if (activitiesData) setActivities(activitiesData)

   setLastRefresh(new Date())
  }
  setLoading(false)
  setIsRefreshing(false)
 }

 useEffect(() => {
  fetchData()

  // Update time every minute
  const timeInterval = setInterval(() => setCurrentTime(new Date()), 60000)

  // Auto-refresh activities every 30 seconds
  const refreshInterval = setInterval(() => fetchData(false), 30000)

  // Refresh on page focus
  const handleFocus = () => fetchData(false)
  window.addEventListener('focus', handleFocus)

  // Check notification permission
  if (typeof window !== 'undefined' && 'Notification' in window) {
   setNotificationsEnabled(Notification.permission === 'granted')
  }

  // Load saved section visibility
  const savedVisibility = localStorage.getItem('dashboardSections')
  if (savedVisibility) {
   try {
    setSectionVisibility(JSON.parse(savedVisibility))
   } catch (e) {
    console.error('Failed to parse saved visibility')
   }
  }

  return () => {
   clearInterval(timeInterval)
   clearInterval(refreshInterval)
   window.removeEventListener('focus', handleFocus)
  }
 }, [])

 // Celebration detection - watch for new hot leads
 useEffect(() => {
  if (leads.length === 0) return

  const currentHotLeadIds = new Set(leads.filter(l => l.intent_score >= 70).map(l => l.id))

  // Find newly hot leads (in current but not in previous)
  const newHotLeads = leads.filter(l =>
   l.intent_score >= 70 && !previousHotLeadIds.has(l.id)
  )

  // Trigger celebration for the first new hot lead
  if (newHotLeads.length > 0 && previousHotLeadIds.size > 0) {
   const newHotLead = newHotLeads[0]
   setCelebrationLead(newHotLead)
   setShowConfetti(true)

   // Send browser notification
   if (notificationsEnabled) {
    new Notification('New High-Intent Lead!', {
     body: `${newHotLead.name} just became a hot lead! Want to call them now?`,
     icon: '/favicon.ico',
     tag: 'hot-lead-' + newHotLead.id,
    })
   }

   // Hide confetti after 5 seconds
   setTimeout(() => {
    setShowConfetti(false)
    setCelebrationLead(null)
   }, 5000)
  }

  setPreviousHotLeadIds(currentHotLeadIds)
 }, [leads, notificationsEnabled])

 // Request notification permission
 const requestNotifications = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
   alert('Your browser does not support notifications')
   return
  }

  const permission = await Notification.requestPermission()
  setNotificationsEnabled(permission === 'granted')
  setShowNotificationPrompt(false)

  if (permission === 'granted') {
   new Notification('Notifications Enabled', {
    body: 'You\'ll be notified when leads become hot or need follow-up.',
    icon: '/favicon.ico',
   })
  }
 }

 // Toggle section visibility
 const toggleSection = (section: keyof typeof sectionVisibility) => {
  const newVisibility = { ...sectionVisibility, [section]: !sectionVisibility[section] }
  setSectionVisibility(newVisibility)
  localStorage.setItem('dashboardSections', JSON.stringify(newVisibility))
 }

 // Calculate Priority Lead with Action Score
 const priorityLead = useMemo((): PriorityLead | null => {
  if (leads.length === 0) return null

  const now = new Date()
  const last48h = subHours(now, 48)
  const last24h = subHours(now, 24)

  const leadsWithScores = leads.map(lead => {
   const leadActivities = activities
    .filter(a => a.lead_id === lead.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

   let actionScore = 0
   const scoreBreakdownDetails: { label: string; points: number; icon: string }[] = []

   // 1. Recent activity (last 48h): +30 points
   const recentActivity = leadActivities.find(a =>
    isWithinInterval(parseISO(a.created_at), { start: last48h, end: now })
   )
   if (recentActivity) {
    actionScore += 30
    scoreBreakdownDetails.push({
     label: 'Active in last 48 hours',
     points: 30,
     icon: 'zap'
    })
   }

   // 2. Score increase today (simulate based on activity count): +20 points
   const todayActivities = leadActivities.filter(a =>
    isWithinInterval(parseISO(a.created_at), { start: last24h, end: now })
   )
   if (todayActivities.length >= 2) {
    actionScore += 20
    scoreBreakdownDetails.push({
     label: `${todayActivities.length} activities today`,
     points: 20,
     icon: 'trending'
    })
   }

   // 3. High base score (>60): +10 points
   if (lead.intent_score >= 60) {
    actionScore += 10
    scoreBreakdownDetails.push({
     label: `High intent score (${lead.intent_score})`,
     points: 10,
     icon: 'target'
    })
   }

   // 4. Fast response time: +15 points
   const fastResponse = leadActivities.find(a => {
    const responseTime = a.activity_data?.response_time
    return responseTime && (responseTime === 'Within 1 hour' || responseTime === 'Within 2 hours')
   })
   if (fastResponse) {
    actionScore += 15
    scoreBreakdownDetails.push({
     label: 'Responded quickly',
     points: 15,
     icon: 'timer'
    })
   }

   // 5. Asked questions: +15 points
   const askedQuestions = leadActivities.find(a =>
    a.activity_data?.questions_asked && a.activity_data.questions_asked.length > 0
   )
   if (askedQuestions) {
    actionScore += 15
    scoreBreakdownDetails.push({
     label: 'Has pending questions',
     points: 15,
     icon: ''
    })
   }

   // 6. Site visit scheduled/completed: +25 points
   const siteVisit = leadActivities.find(a => a.activity_type === 'site_visit')
   if (siteVisit) {
    actionScore += 25
    scoreBreakdownDetails.push({
     label: 'Visited property',
     points: 25,
     icon: 'building'
    })
   }

   // 7. Multiple property views: +20 points
   const propertyViews = leadActivities.filter(a => a.activity_type === 'property_viewed').length
   if (propertyViews >= 3) {
    actionScore += 20
    scoreBreakdownDetails.push({
     label: `Viewed ${propertyViews} properties`,
     points: 20,
     icon: ''
    })
   }

   // Calculate urgency level
   let urgencyLevel: 'critical' | 'high' | 'medium' | 'low' = 'low'
   if (actionScore >= 70) urgencyLevel = 'critical'
   else if (actionScore >= 50) urgencyLevel = 'high'
   else if (actionScore >= 30) urgencyLevel = 'medium'

   // Generate key insight
   let keyInsight = ''
   if (siteVisit) {
    keyInsight = `Visited ${lead.locations?.[0] || 'property'}, highly engaged`
   } else if (propertyViews >= 3) {
    keyInsight = `Viewed ${propertyViews} properties in ${lead.locations?.[0] || 'target area'}`
   } else if (askedQuestions) {
    const questions = leadActivities
     .flatMap(a => a.activity_data?.questions_asked || [])
     .slice(0, 2)
    keyInsight = `Asked about: ${questions.join(', ') || 'pricing, availability'}`
   } else if (lead.budget_max) {
    const budgetStr = lead.budget_max >= 10000000
     ? `${(lead.budget_max / 10000000).toFixed(1)} Cr`
     : `${(lead.budget_max / 100000).toFixed(0)} L`
    keyInsight = `Looking for ${lead.property_type || 'property'} up to ₹${budgetStr}`
   } else {
    keyInsight = `Interested in ${lead.property_type || 'properties'} in ${lead.locations?.[0] || 'your area'}`
   }

   // Calculate simulated score change
   const scoreChange = todayActivities.length * 12 + (recentActivity ? 15 : 0)

   return {
    ...lead,
    actionScore,
    recentActivities: leadActivities.slice(0, 3),
    scoreBreakdownDetails: scoreBreakdownDetails.sort((a, b) => b.points - a.points).slice(0, 4),
    keyInsight,
    urgencyLevel,
    scoreChange
   }
  })

  // Return the lead with highest action score
  return leadsWithScores.sort((a, b) => b.actionScore - a.actionScore)[0]
 }, [leads, activities])

 // ============================================
 // DYNAMIC HERO CARD - Contextual & Rotating
 // ============================================
 const dynamicHeroCard = useMemo((): DynamicHeroCard | null => {
  if (leads.length === 0) return null

  const now = new Date()
  const hour = now.getHours()
  const today = startOfDay(now)
  const last7Days = subDays(now, 7)
  const last24h = subHours(now, 24)

  // Helper to get lead activities
  const getLeadActivities = (leadId: string) =>
   activities.filter(a => a.lead_id === leadId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Check for different scenarios and pick the most relevant

  // 1. CHECK: Lead with callback promised but not followed up (HIGHEST PRIORITY)
  const callbackLeads = leads.filter(lead => {
   const leadActivities = getLeadActivities(lead.id)
   const hasCallback = leadActivities.some(a =>
    a.activity_data?.outcome === 'Callback requested' ||
    a.activity_data?.notes?.toLowerCase().includes('callback') ||
    a.activity_data?.notes?.toLowerCase().includes('call back')
   )
   if (!hasCallback) return false

   const lastActivity = leadActivities[0]
   if (!lastActivity) return false

   const hoursSince = differenceInHours(now, parseISO(lastActivity.created_at))
   return hoursSince >= 24 && hoursSince <= 72
  })

  if (callbackLeads.length > 0) {
   const lead = callbackLeads[0]
   const leadActivities = getLeadActivities(lead.id)
   return {
    type: 'callback',
    title: 'Callback Overdue',
    subtitle: 'You promised to call back',
    lead: { ...lead, recentActivities: leadActivities.slice(0, 3) },
    insight: `${lead.name} requested a callback and is waiting for your call`,
    action: 'Call now to maintain trust',
    urgency: 'critical',
    gradient: 'from-red-600/90 via-orange-600/80 to-amber-600/90',
    icon: '',
    stats: [
     { label: 'Intent Score', value: lead.intent_score },
     { label: 'Waiting', value: `${differenceInHours(now, parseISO(leadActivities[0]?.created_at || lead.created_at))}h` },
    ]
   }
  }

  // 2. CHECK: Warm leads going cold (7+ days no activity)
  const goingColdLeads = leads.filter(lead => {
   if (lead.intent_score < 40 || lead.intent_score >= 70) return false
   const leadActivities = getLeadActivities(lead.id)
   if (leadActivities.length === 0) return false
   const lastActivity = leadActivities[0]
   const daysSince = differenceInDays(now, parseISO(lastActivity.created_at))
   return daysSince >= 7 && daysSince <= 14
  })

  if (goingColdLeads.length >= 2) {
   const topColdLead = goingColdLeads.sort((a, b) => b.intent_score - a.intent_score)[0]
   const leadActivities = getLeadActivities(topColdLead.id)
   return {
    type: 'going_cold',
    title: `${goingColdLeads.length} Leads Going Cold`,
    subtitle: 'Re-engage before they lose interest',
    lead: { ...topColdLead, recentActivities: leadActivities.slice(0, 3) },
    insight: `${topColdLead.name} and ${goingColdLeads.length - 1} others haven't heard from you in 7+ days`,
    action: 'Send a quick check-in message today',
    urgency: 'high',
    gradient: 'from-amber-600/90 via-orange-600/80 to-red-600/90',
    icon: '',
    stats: [
     { label: 'At Risk', value: goingColdLeads.length },
     { label: 'Top Score', value: topColdLead.intent_score },
    ]
   }
  }

  // 3. CHECK: New leads today that need first contact
  const newLeadsToday = leads.filter(l => {
   const created = parseISO(l.created_at)
   if (!isWithinInterval(created, { start: last24h, end: now })) return false
   const leadActivities = getLeadActivities(l.id)
   return leadActivities.length === 0 // No contact yet
  })

  if (newLeadsToday.length > 0) {
   const newestLead = newLeadsToday[0]
   return {
    type: 'new_lead',
    title: `${newLeadsToday.length} New Lead${newLeadsToday.length > 1 ? 's' : ''} Today!`,
    subtitle: 'First contact within 24h increases conversion 3x',
    lead: { ...newestLead, recentActivities: [] },
    insight: `${newestLead.name} is waiting for your first contact`,
    action: 'Make a great first impression',
    urgency: 'high',
    gradient: 'from-blue-600/90 via-cyan-600/80 to-teal-600/90',
    icon: 'sparkle',
    stats: [
     { label: 'New Leads', value: newLeadsToday.length },
     { label: 'Budget', value: newestLead.budget_max ? `₹${Math.round(newestLead.budget_max / 100000)}L` : 'TBD' },
    ]
   }
  }

  // 4. CHECK: Hot lead ready to close (score 80+, recent positive interaction)
  const hotReadyLeads = leads.filter(lead => {
   if (lead.intent_score < 80) return false
   const leadActivities = getLeadActivities(lead.id)
   const recentPositive = leadActivities.find(a => {
    const isRecent = isWithinInterval(parseISO(a.created_at), { start: last7Days, end: now })
    const isPositive = a.activity_data?.outcome === 'Interested' ||
     a.activity_data?.outcome === 'Very interested'
    return isRecent && isPositive
   })
   return recentPositive !== undefined
  })

  if (hotReadyLeads.length > 0) {
   const hotLead = hotReadyLeads[0]
   const leadActivities = getLeadActivities(hotLead.id)
   return {
    type: 'hot_lead',
    title: 'Ready to Close',
    subtitle: 'This lead is showing strong buying signals',
    lead: { ...hotLead, recentActivities: leadActivities.slice(0, 3) },
    insight: `${hotLead.name} has high intent and recent positive engagement`,
    action: 'Strike while the iron is hot!',
    urgency: 'critical',
    gradient: 'from-emerald-600/90 via-teal-600/80 to-cyan-700/90',
    icon: 'target',
    stats: [
     { label: 'Intent Score', value: hotLead.intent_score },
     { label: 'Pipeline', value: hotLead.budget_max ? `₹${Math.round(hotLead.budget_max / 100000)}L` : 'High' },
    ]
   }
  }

  // 5. TIME-BASED recommendations
  const todayActivities = activities.filter(a =>
   isWithinInterval(parseISO(a.created_at), { start: today, end: now })
  )

  // Activity streak check
  const streakDays = (() => {
   let streak = 0
   for (let i = 0; i < 7; i++) {
    const day = subDays(now, i)
    const dayStart = startOfDay(day)
    const dayEnd = endOfDay(day)
    const hasActivity = activities.some(a =>
     isWithinInterval(parseISO(a.created_at), { start: dayStart, end: dayEnd })
    )
    if (hasActivity) streak++
    else break
   }
   return streak
  })()

  if (streakDays >= 3 && todayActivities.length > 0) {
   return {
    type: 'streak',
    title: `${streakDays}-Day Activity Streak`,
    subtitle: 'You\'re on fire! Keep the momentum going',
    insight: `${todayActivities.length} activities logged today. Consistency wins!`,
    action: 'Log one more activity to extend your streak',
    urgency: 'info',
    gradient: 'from-purple-600/90 via-pink-600/80 to-rose-600/90',
    icon: 'trophy',
    stats: [
     { label: 'Streak Days', value: streakDays },
     { label: 'Today', value: `${todayActivities.length} activities` },
    ]
   }
  }

  // 6. TIME-BASED: Morning vs Evening recommendations
  if (hour >= 6 && hour < 12 && todayActivities.length === 0) {
   // Morning - suggest checking new leads and emails
   const topLead = leads[0]
   if (topLead) {
    const leadActivities = getLeadActivities(topLead.id)
    return {
     type: 'time_based',
     title: 'Good Morning',
     subtitle: 'Start your day with your top priority',
     lead: { ...topLead, recentActivities: leadActivities.slice(0, 3) },
     insight: `${topLead.name} has the highest potential today`,
     action: 'Review overnight messages and plan your calls',
     urgency: 'medium',
     gradient: 'from-amber-500/90 via-orange-500/80 to-rose-500/90',
     icon: '',
     stats: [
      { label: 'Top Score', value: topLead.intent_score },
      { label: 'Total Leads', value: leads.length },
     ]
    }
   }
  }

  if (hour >= 17 && hour < 21) {
   // Evening - best time for calls
   const callableLead = leads.find(l => l.intent_score >= 50 && l.phone)
   if (callableLead) {
    const leadActivities = getLeadActivities(callableLead.id)
    return {
     type: 'time_based',
     title: 'Prime Calling Hours',
     subtitle: 'Evening is the best time to reach decision makers',
     lead: { ...callableLead, recentActivities: leadActivities.slice(0, 3) },
     insight: `${callableLead.name} is most likely to answer now`,
     action: 'Make 2-3 important calls before 9 PM',
     urgency: 'high',
     gradient: 'from-indigo-600/90 via-purple-600/80 to-pink-600/90',
     icon: 'phone',
     stats: [
      { label: 'Best Time', value: '6-9 PM' },
      { label: 'Suggested', value: '3 calls' },
     ]
    }
   }
  }

  // 7. DEFAULT: Fall back to top priority lead
  if (priorityLead) {
   return {
    type: 'hot_lead',
    title: 'Your Top Priority',
    subtitle: 'Focus on this lead for best results',
    lead: { ...priorityLead, recentActivities: priorityLead.recentActivities },
    insight: priorityLead.keyInsight,
    action: 'Take action now to move this lead forward',
    urgency: priorityLead.urgencyLevel === 'critical' ? 'critical' : 'high',
    gradient: 'from-emerald-600/90 via-teal-600/80 to-cyan-700/90',
    icon: 'zap',
    stats: [
     { label: 'Intent Score', value: priorityLead.intent_score },
     { label: 'Action Score', value: priorityLead.actionScore },
    ]
   }
  }

  return null
 }, [leads, activities, priorityLead])

 // ============================================
 // SECTION 2: Smart KPI Calculations
 // ============================================
 const kpiMetrics = useMemo(() => {
  const now = new Date()
  const today = startOfDay(now)
  const yesterday = subDays(today, 1)
  const lastWeek = subDays(now, 7)
  const twoWeeksAgo = subDays(now, 14)

  // ----- CARD 1: Hot Pipeline Value -----
  const hotLeads = leads.filter(l => l.intent_score >= 70)
  const hotPipelineValue = hotLeads.reduce((sum, l) => sum + (l.budget_max || 0), 0)
  const hotLeadsCount = hotLeads.length

  // Calculate leads ready to close (score >= 80 with recent activity)
  const readyToClose = hotLeads.filter(l => {
   const hasRecentActivity = activities.some(a =>
    a.lead_id === l.id &&
    isWithinInterval(parseISO(a.created_at), { start: lastWeek, end: now })
   )
   return l.intent_score >= 80 && hasRecentActivity
  }).length

  // Week over week comparison
  const lastWeekHotValue = leads
   .filter(l => {
    const createdAt = parseISO(l.created_at)
    return isWithinInterval(createdAt, { start: twoWeeksAgo, end: lastWeek }) && l.intent_score >= 70
   })
   .reduce((sum, l) => sum + (l.budget_max || 0), 0)

  const hotValueTrend = lastWeekHotValue > 0
   ? Math.round(((hotPipelineValue - lastWeekHotValue) / lastWeekHotValue) * 100)
   : hotPipelineValue > 0 ? 100 : 0

  // Monthly target (simulated as 20Cr for demo)
  const monthlyTarget = 200000000
  const targetProgress = Math.min(Math.round((hotPipelineValue / monthlyTarget) * 100), 100)

  // ----- CARD 2: Next 24 Hours -----
  // Leads that need follow-up: no activity in last 48h but had previous contact
  const needsFollowUp = leads.filter(lead => {
   const leadActivities = activities.filter(a => a.lead_id === lead.id)
   if (leadActivities.length === 0) return false // Never contacted

   const lastActivity = leadActivities[0]
   const hoursSinceContact = differenceInHours(now, parseISO(lastActivity.created_at))

   // Needs follow-up if: 24-72 hours since last contact AND score > 40
   return hoursSinceContact >= 24 && hoursSinceContact <= 72 && lead.intent_score >= 40
  }).sort((a, b) => b.intent_score - a.intent_score).slice(0, 5)

  // Calculate time to first scheduled call (simulated)
  const hoursToFirstCall = needsFollowUp.length > 0 ? Math.floor(Math.random() * 4) + 1 : 0
  const minutesToFirstCall = Math.floor(Math.random() * 60)

  // ----- CARD 3: Conversion Velocity -----
  // Average days from first contact to hot status
  const hotLeadsWithTimeline = hotLeads.map(lead => {
   const firstActivity = activities
    .filter(a => a.lead_id === lead.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]

   if (!firstActivity) return null

   const firstContactDate = parseISO(firstActivity.created_at)
   const daysToHot = differenceInDays(now, firstContactDate)
   return daysToHot
  }).filter((d): d is number => d !== null)

  const avgDaysToHot = hotLeadsWithTimeline.length > 0
   ? Math.round((hotLeadsWithTimeline.reduce((a, b) => a + b, 0) / hotLeadsWithTimeline.length) * 10) / 10
   : 0

  // Industry average (simulated as 14 days)
  const industryAvg = 14
  const velocityImprovement = avgDaysToHot > 0 && avgDaysToHot < industryAvg
   ? Math.round(((industryAvg - avgDaysToHot) / industryAvg) * 100)
   : 0

  // Weekly velocity trend (last 4 weeks)
  const velocityTrend = [
   { week: 'W1', days: avgDaysToHot + 3 },
   { week: 'W2', days: avgDaysToHot + 1.5 },
   { week: 'W3', days: avgDaysToHot + 0.5 },
   { week: 'W4', days: avgDaysToHot },
  ]

  // ----- CARD 4: Today's Momentum -----
  const todayActivities = activities.filter(a =>
   isWithinInterval(parseISO(a.created_at), { start: today, end: now })
  )
  const yesterdayActivities = activities.filter(a =>
   isWithinInterval(parseISO(a.created_at), { start: yesterday, end: today })
  )

  const todayCount = todayActivities.length
  const yesterdayCount = yesterdayActivities.length
  const momentumChange = yesterdayCount > 0
   ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
   : todayCount > 0 ? 100 : 0

  // Activity breakdown
  const activityBreakdown = {
   calls: todayActivities.filter(a => a.activity_type === 'call').length,
   whatsapp: todayActivities.filter(a => a.activity_type === 'whatsapp').length,
   visits: todayActivities.filter(a => a.activity_type === 'site_visit').length,
   emails: todayActivities.filter(a => a.activity_type === 'email').length,
   other: todayActivities.filter(a => !['call', 'whatsapp', 'site_visit', 'email'].includes(a.activity_type)).length,
  }

  // Week trend for mini chart
  const weekTrend = Array.from({ length: 7 }, (_, i) => {
   const day = subDays(now, 6 - i)
   const dayStart = startOfDay(day)
   const dayEnd = endOfDay(day)
   const count = activities.filter(a =>
    isWithinInterval(parseISO(a.created_at), { start: dayStart, end: dayEnd })
   ).length
   return { day: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getDay()], count }
  })

  const maxWeekCount = Math.max(...weekTrend.map(d => d.count), 1)

  return {
   hotPipeline: {
    value: hotPipelineValue,
    count: hotLeadsCount,
    trend: hotValueTrend,
    readyToClose,
    targetProgress,
   },
   followUp: {
    leads: needsFollowUp,
    count: needsFollowUp.length,
    hoursToCall: hoursToFirstCall,
    minutesToCall: minutesToFirstCall,
   },
   velocity: {
    avgDays: avgDaysToHot,
    improvement: velocityImprovement,
    trend: velocityTrend,
   },
   momentum: {
    today: todayCount,
    change: momentumChange,
    breakdown: activityBreakdown,
    weekTrend,
    maxWeekCount,
   }
  }
 }, [leads, activities])

 // ============================================
 // SECTION 3: Intelligent Action Queue
 // ============================================
 type ActionQueueItem = {
  lead: Lead
  priority: number
  recommendation: string
  recommendationIcon: string
  urgency: 'urgent' | 'high' | 'normal'
  lastActivity: LeadActivity | null
  daysSinceActivity: number
 }

 const actionQueue = useMemo((): ActionQueueItem[] => {
  if (leads.length === 0) return []

  const now = new Date()

  const leadsWithActions = leads.map(lead => {
   const leadActivities = activities
    .filter(a => a.lead_id === lead.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

   const lastActivity = leadActivities[0] || null
   const daysSinceActivity = lastActivity
    ? differenceInDays(now, parseISO(lastActivity.created_at))
    : differenceInDays(now, parseISO(lead.created_at))

   // Calculate priority score
   let priority = 0

   // Days since last activity (older = higher priority, max 30 points)
   priority += Math.min(daysSinceActivity * 5, 30)

   // High intent score leads get priority
   if (lead.intent_score >= 70) priority += 20
   else if (lead.intent_score >= 50) priority += 10

   // Check for specific conditions and generate recommendations
   let recommendation = ''
   let recommendationIcon = 'action'
   let urgency: 'urgent' | 'high' | 'normal' = 'normal'

   // Check activity patterns
   const hasAskedQuestions = leadActivities.some(a =>
    a.activity_data?.questions_asked && a.activity_data.questions_asked.length > 0
   )
   const askedAboutEMI = leadActivities.some(a =>
    a.activity_data?.questions_asked?.some((q: string) =>
     q.toLowerCase().includes('emi') ||
     q.toLowerCase().includes('payment') ||
     q.toLowerCase().includes('loan')
    ) ||
    a.activity_data?.notes?.toLowerCase().includes('emi') ||
    a.activity_data?.notes?.toLowerCase().includes('payment plan')
   )
   const askedAboutVisit = leadActivities.some(a =>
    a.activity_data?.questions_asked?.some((q: string) =>
     q.toLowerCase().includes('visit') ||
     q.toLowerCase().includes('see') ||
     q.toLowerCase().includes('viewing')
    ) ||
    a.activity_data?.notes?.toLowerCase().includes('site visit') ||
    a.activity_data?.notes?.toLowerCase().includes('wants to see')
   )
   const hasSiteVisit = leadActivities.some(a => a.activity_type === 'site_visit')
   const propertyViews = leadActivities.filter(a => a.activity_type === 'property_viewed').length
   const callCount = leadActivities.filter(a => a.activity_type === 'call').length
   const missedCalls = leadActivities.filter(a =>
    a.activity_type === 'call' &&
    a.activity_data?.outcome === 'No answer'
   ).length
   const hadPositiveResponse = leadActivities.some(a =>
    a.activity_data?.outcome === 'Interested' ||
    a.activity_data?.outcome === 'Very interested' ||
    a.activity_data?.response_time === 'Within 1 hour'
   )
   const mentionedBudgetConcern = leadActivities.some(a =>
    a.activity_data?.notes?.toLowerCase().includes('budget') ||
    a.activity_data?.notes?.toLowerCase().includes('expensive') ||
    a.activity_data?.notes?.toLowerCase().includes('price')
   )
   const requestedCallback = leadActivities.some(a =>
    a.activity_data?.outcome === 'Callback requested' ||
    a.activity_data?.notes?.toLowerCase().includes('call back') ||
    a.activity_data?.notes?.toLowerCase().includes('callback')
   )

   // AI Recommendation Logic (priority order)
   if (requestedCallback && daysSinceActivity >= 1) {
    recommendation = 'Urgent: Promised callback overdue'
    recommendationIcon = ''
    urgency = 'urgent'
    priority += 40
   } else if (missedCalls >= 2 && daysSinceActivity <= 2) {
    recommendation = `Call NOW - ${missedCalls} missed calls recently`
    recommendationIcon = 'phone'
    urgency = 'urgent'
    priority += 35
   } else if (hadPositiveResponse && daysSinceActivity >= 1 && daysSinceActivity <= 3) {
    recommendation = 'Strike while hot - follow up now'
    recommendationIcon = 'flame'
    urgency = 'urgent'
    priority += 30
   } else if (askedAboutEMI && !leadActivities.some(a => a.activity_data?.notes?.toLowerCase().includes('calculator'))) {
    recommendation = 'Send payment calculator - asked about EMI'
    recommendationIcon = 'mobile'
    urgency = 'high'
    priority += 25
   } else if (propertyViews >= 3 && !hasSiteVisit) {
    recommendation = `Schedule site visit - viewed ${propertyViews} properties`
    recommendationIcon = 'building'
    urgency = 'high'
    priority += 25
   } else if (askedAboutVisit && !hasSiteVisit && daysSinceActivity >= 2) {
    recommendation = 'Schedule site visit - requested earlier'
    recommendationIcon = 'building'
    urgency = 'high'
    priority += 25
   } else if (lead.intent_score >= 50 && daysSinceActivity >= 3 && daysSinceActivity <= 7) {
    recommendation = 'Re-engage - going cold soon'
    recommendationIcon = 'message'
    urgency = 'high'
    priority += 20
   } else if (mentionedBudgetConcern) {
    recommendation = 'Send comparable properties - budget concerns'
    recommendationIcon = 'email'
    urgency = 'normal'
    priority += 15
   } else if (hasAskedQuestions && daysSinceActivity >= 2) {
    recommendation = 'Answer pending questions'
    recommendationIcon = ''
    urgency = 'high'
    priority += 20
   } else if (daysSinceActivity >= 7 && lead.intent_score >= 40) {
    recommendation = 'Weekly check-in due'
    recommendationIcon = ''
    urgency = 'normal'
    priority += 10
   } else if (callCount === 0 && daysSinceActivity >= 1) {
    recommendation = 'Make first contact call'
    recommendationIcon = 'phone'
    urgency = daysSinceActivity >= 2 ? 'high' : 'normal'
    priority += 15
   } else if (lead.intent_score >= 60) {
    recommendation = 'Nurture high-intent lead'
    recommendationIcon = 'star'
    urgency = 'normal'
    priority += 5
   } else {
    recommendation = 'Add to follow-up list'
    recommendationIcon = ''
    urgency = 'normal'
   }

   return {
    lead,
    priority,
    recommendation,
    recommendationIcon,
    urgency,
    lastActivity,
    daysSinceActivity,
   }
  })

  // Sort by priority (highest first) and take top 10
  return leadsWithActions
   .sort((a, b) => b.priority - a.priority)
   .slice(0, 10)
 }, [leads, activities])

 // ============================================
 // SECTION 5: Daily Insights Panel
 // ============================================
 type DailyInsight = {
  id: string
  icon: string
  headline: string
  data: string
  action: string
  buttonText: string
  buttonLink: string
  type: 'success' | 'warning' | 'info' | 'opportunity'
 }

 const dailyInsights = useMemo((): DailyInsight[] => {
  if (leads.length === 0) return []

  const insights: DailyInsight[] = []
  const now = new Date()
  const today = startOfDay(now)
  const lastWeek = subDays(now, 7)

  // ----- INSIGHT 1: Peak Response Time -----
  const activitiesWithResponse = activities.filter(a =>
   a.activity_data?.response_time &&
   a.activity_data.response_time !== 'No response yet'
  )

  if (activitiesWithResponse.length >= 3) {
   // Analyze response times by hour
   const hourCounts: Record<string, { positive: number; total: number }> = {}

   activitiesWithResponse.forEach(a => {
    const hour = parseISO(a.created_at).getHours()
    const bucket = hour < 12 ? 'Morning (9-12)' : hour < 17 ? 'Afternoon (12-5)' : 'Evening (5-9)'

    if (!hourCounts[bucket]) hourCounts[bucket] = { positive: 0, total: 0 }
    hourCounts[bucket].total++

    const outcome = a.activity_data?.outcome
    if (outcome === 'Interested' || outcome === 'Very interested') {
     hourCounts[bucket].positive++
    }
   })

   const bestTime = Object.entries(hourCounts)
    .map(([time, counts]) => ({
     time,
     rate: counts.total > 0 ? Math.round((counts.positive / counts.total) * 100) : 0,
     total: counts.total
    }))
    .sort((a, b) => b.rate - a.rate)[0]

   if (bestTime && bestTime.rate > 40) {
    insights.push({
     id: 'peak-response',
     icon: 'clock',
     headline: `Best response time: ${bestTime.time}`,
     data: `${bestTime.rate}% positive responses during this window`,
     action: 'Schedule your important follow-ups for this time',
     buttonText: 'View Leads',
     buttonLink: '/dashboard/leads',
     type: 'success'
    })
   }
  }

  // ----- INSIGHT 2: Hot Property Type -----
  const hotLeads = leads.filter(l => l.intent_score >= 70)
  if (hotLeads.length >= 2) {
   const propertyTypeCounts: Record<string, number> = {}
   hotLeads.forEach(l => {
    const type = l.property_type || 'Unknown'
    propertyTypeCounts[type] = (propertyTypeCounts[type] || 0) + 1
   })

   const topPropertyType = Object.entries(propertyTypeCounts)
    .sort((a, b) => b[1] - a[1])[0]

   if (topPropertyType && topPropertyType[1] >= 2) {
    insights.push({
     id: 'hot-property',
     icon: 'flame',
     headline: `${topPropertyType[0]}s are trending`,
     data: `${topPropertyType[1]} out of ${hotLeads.length} hot leads interested in ${topPropertyType[0]}`,
     action: 'Focus your outreach on similar properties',
     buttonText: 'See Hot Leads',
     buttonLink: '/dashboard/leads',
     type: 'opportunity'
    })
   }
  }

  // ----- INSIGHT 3: EMI/Payment Pattern -----
  const leadsWithEMIQuestions = leads.filter(lead => {
   const leadActivities = activities.filter(a => a.lead_id === lead.id)
   return leadActivities.some(a =>
    a.activity_data?.questions_asked?.some((q: string) =>
     q.toLowerCase().includes('emi') ||
     q.toLowerCase().includes('payment') ||
     q.toLowerCase().includes('loan')
    ) ||
    a.activity_data?.notes?.toLowerCase().includes('emi') ||
    a.activity_data?.notes?.toLowerCase().includes('payment')
   )
  })

  const emiLeadsHot = leadsWithEMIQuestions.filter(l => l.intent_score >= 70).length
  if (leadsWithEMIQuestions.length >= 2 && emiLeadsHot > 0) {
   const conversionRate = Math.round((emiLeadsHot / leadsWithEMIQuestions.length) * 100)
   insights.push({
    id: 'emi-pattern',
    icon: 'target',
    headline: 'Payment questions = high intent',
    data: `${conversionRate}% of leads asking about EMI become hot leads`,
    action: 'Proactively send payment calculators in your outreach',
    buttonText: 'View These Leads',
    buttonLink: '/dashboard/leads',
    type: 'info'
   })
  }

  // ----- INSIGHT 4: Leads Going Cold -----
  const warmLeadsGoingCold = leads.filter(lead => {
   if (lead.intent_score < 40 || lead.intent_score >= 70) return false

   const leadActivities = activities.filter(a => a.lead_id === lead.id)
   if (leadActivities.length === 0) return false

   const lastActivity = leadActivities[0]
   const daysSince = differenceInDays(now, parseISO(lastActivity.created_at))

   return daysSince >= 7
  })

  if (warmLeadsGoingCold.length > 0) {
   insights.push({
    id: 'going-cold',
    icon: 'alert',
    headline: `${warmLeadsGoingCold.length} warm lead${warmLeadsGoingCold.length > 1 ? 's' : ''} going cold`,
    data: 'No activity in 7+ days - risk of losing to competitors',
    action: 'Send re-engagement messages today',
    buttonText: 'View Leads',
    buttonLink: '/dashboard/leads',
    type: 'warning'
   })
  }

  // ----- INSIGHT 5: Location Trending -----
  const locationCounts: Record<string, number> = {}
  leads.forEach(l => {
   l.locations?.forEach(loc => {
    locationCounts[loc] = (locationCounts[loc] || 0) + 1
   })
  })

  const topLocation = Object.entries(locationCounts)
   .sort((a, b) => b[1] - a[1])[0]

  if (topLocation && topLocation[1] >= 3 && !insights.some(i => i.id === 'hot-property')) {
   insights.push({
    id: 'hot-location',
    icon: 'location',
    headline: `${topLocation[0]} is in demand`,
    data: `${topLocation[1]} leads interested in this location`,
    action: 'Prioritize properties in this area',
    buttonText: 'Filter by Location',
    buttonLink: '/dashboard/leads',
    type: 'opportunity'
   })
  }

  // ----- INSIGHT 6: Site Visit Conversion -----
  const leadsWithVisits = leads.filter(lead => {
   const leadActivities = activities.filter(a => a.lead_id === lead.id)
   return leadActivities.some(a => a.activity_type === 'site_visit')
  })

  if (leadsWithVisits.length >= 2) {
   const visitHotRate = Math.round((leadsWithVisits.filter(l => l.intent_score >= 70).length / leadsWithVisits.length) * 100)
   if (visitHotRate >= 50) {
    insights.push({
     id: 'site-visit-conversion',
     icon: 'building',
     headline: 'Site visits drive conversions',
     data: `${visitHotRate}% of leads who visited became hot leads`,
     action: 'Push for site visits in your follow-ups',
     buttonText: 'Schedule Visits',
     buttonLink: '/dashboard/leads',
     type: 'success'
    })
   }
  }

  // ----- INSIGHT 7: Quick Response Success -----
  const quickResponders = activities.filter(a =>
   a.activity_data?.response_time === 'Within 1 hour' ||
   a.activity_data?.response_time === 'Within 2 hours'
  )

  if (quickResponders.length >= 3) {
   const quickLeadIds = [...new Set(quickResponders.map(a => a.lead_id))]
   const quickLeadsHot = quickLeadIds.filter(id => {
    const lead = leads.find(l => l.id === id)
    return lead && lead.intent_score >= 60
   }).length

   if (quickLeadIds.length > 0) {
    const successRate = Math.round((quickLeadsHot / quickLeadIds.length) * 100)
    if (successRate >= 40 && !insights.some(i => i.id === 'peak-response')) {
     insights.push({
      id: 'quick-response',
      icon: 'zap',
      headline: 'Fast responses pay off',
      data: `${successRate}% of quick responders have high intent`,
      action: 'Keep response times under 2 hours',
      buttonText: 'View Analytics',
      buttonLink: '/dashboard/analytics',
      type: 'success'
     })
    }
   }
  }

  // ----- INSIGHT 8: New Lead Alert -----
  const newLeadsToday = leads.filter(l =>
   isWithinInterval(parseISO(l.created_at), { start: today, end: now })
  )

  if (newLeadsToday.length > 0 && !insights.some(i => i.type === 'warning')) {
   insights.push({
    id: 'new-leads',
    icon: 'new',
    headline: `${newLeadsToday.length} new lead${newLeadsToday.length > 1 ? 's' : ''} today`,
    data: 'Fresh leads need quick first contact',
    action: 'Make initial contact within 24 hours',
    buttonText: 'Contact Now',
    buttonLink: '/dashboard/leads',
    type: 'info'
   })
  }

  // Return top 4 most relevant insights
  return insights.slice(0, 4)
 }, [leads, activities])

 // ============================================
 // SECTION 6: Weekly Momentum Tracker
 // ============================================
 type DayMomentum = {
  date: Date
  dayName: string
  dateStr: string
  newLeads: number
  activities: number
  hotConversions: number
  score: 'great' | 'good' | 'slow' | 'none'
 }

 const weeklyMomentum = useMemo(() => {
  const now = new Date()
  const days: DayMomentum[] = []

  // Last 7 days including today
  for (let i = 6; i >= 0; i--) {
   const day = subDays(now, i)
   const dayStart = startOfDay(day)
   const dayEnd = endOfDay(day)

   // Count new leads on this day
   const newLeads = leads.filter(l =>
    isWithinInterval(parseISO(l.created_at), { start: dayStart, end: dayEnd })
   ).length

   // Count activities on this day
   const dayActivities = activities.filter(a =>
    isWithinInterval(parseISO(a.created_at), { start: dayStart, end: dayEnd })
   ).length

   // Count hot conversions (leads that became hot on this day)
   // We'll approximate this by checking if lead's last_activity_date is on this day and score >= 70
   const hotConversions = leads.filter(l => {
    if (l.intent_score < 70) return false
    const lastActivity = parseISO(l.last_activity_date)
    return isWithinInterval(lastActivity, { start: dayStart, end: dayEnd })
   }).length

   // Calculate day score
   let score: 'great' | 'good' | 'slow' | 'none' = 'none'
   const totalActivity = newLeads + dayActivities + hotConversions * 2
   if (totalActivity >= 8) score = 'great'
   else if (totalActivity >= 4) score = 'good'
   else if (totalActivity >= 1) score = 'slow'

   days.push({
    date: day,
    dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()],
    dateStr: day.getDate().toString(),
    newLeads,
    activities: dayActivities,
    hotConversions,
    score,
   })
  }

  // Calculate this week's totals
  const thisWeekLeads = days.reduce((sum, d) => sum + d.newLeads, 0)
  const thisWeekActivities = days.reduce((sum, d) => sum + d.activities, 0)
  const thisWeekHot = days.reduce((sum, d) => sum + d.hotConversions, 0)

  // Calculate last week's totals (for comparison)
  const lastWeekStart = subDays(now, 13)
  const lastWeekEnd = subDays(now, 7)

  const lastWeekLeads = leads.filter(l =>
   isWithinInterval(parseISO(l.created_at), { start: lastWeekStart, end: lastWeekEnd })
  ).length

  const lastWeekActivities = activities.filter(a =>
   isWithinInterval(parseISO(a.created_at), { start: lastWeekStart, end: lastWeekEnd })
  ).length

  // Calculate comparison percentage
  const lastWeekTotal = lastWeekLeads + lastWeekActivities
  const thisWeekTotal = thisWeekLeads + thisWeekActivities

  let comparison = 0
  let comparisonText = ''
  if (lastWeekTotal > 0) {
   comparison = Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
   if (comparison > 0) {
    comparisonText = `${comparison}% better than last week`
   } else if (comparison < 0) {
    comparisonText = `${Math.abs(comparison)}% less than last week`
   } else {
    comparisonText = 'Same as last week'
   }
  } else {
   comparisonText = 'First week of data'
  }

  // Find max values for scaling
  const maxActivities = Math.max(...days.map(d => d.activities), 1)
  const maxLeads = Math.max(...days.map(d => d.newLeads), 1)

  return {
   days,
   thisWeek: {
    leads: thisWeekLeads,
    activities: thisWeekActivities,
    hot: thisWeekHot,
   },
   lastWeek: {
    leads: lastWeekLeads,
    activities: lastWeekActivities,
   },
   comparison,
   comparisonText,
   maxActivities,
   maxLeads,
  }
 }, [leads, activities])

 // Get greeting based on time
 // Enhanced time-based greeting with emoji and motivation
 const getGreeting = () => {
  const hour = currentTime.getHours()
  if (hour >= 6 && hour < 12) return { text: 'Good morning', emoji: '', motivation: 'Ready to close some deals?' }
  if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '', motivation: 'Keep the momentum going!' }
  if (hour >= 17 && hour < 22) return { text: 'Good evening', emoji: '', motivation: 'Time to follow up with late responders!' }
  return { text: 'Working late', emoji: '', motivation: "Dedication pays off!" }
 }
 const greeting = getGreeting()

 // Format budget
 const formatBudget = (min: number | null, max: number | null) => {
  const format = (n: number) => {
   if (n >= 10000000) return `${(n / 10000000).toFixed(1)} Cr`
   if (n >= 100000) return `${(n / 100000).toFixed(0)} L`
   return `${n.toLocaleString()}`
  }
  if (min && max) return `₹${format(min)} - ₹${format(max)}`
  if (max) return `Up to ₹${format(max)}`
  if (min) return `From ₹${format(min)}`
  return 'Not specified'
 }

 // Get urgency message
 const getUrgencyMessage = (level: string) => {
  switch (level) {
   case 'critical': return 'Call within next 30 minutes for best results'
   case 'high': return 'Reach out within 2 hours to maximize conversion'
   case 'medium': return 'Schedule a follow-up call today'
   default: return 'Add to your weekly follow-up list'
  }
 }

 // Activity type display
 const getActivityDisplay = (activity: LeadActivity) => {
  const types: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
   'call': { icon: <Phone className="h-3 w-3" />, label: 'Phone Call', color: 'text-[#7B5EA7]' },
   'site_visit': { icon: <Building className="h-3 w-3" />, label: 'Site Visit', color: 'text-purple-400' },
   'whatsapp': { icon: <MessageCircle className="h-3 w-3" />, label: 'WhatsApp', color: 'text-green-400' },
   'email': { icon: <MessageCircle className="h-3 w-3" />, label: 'Email', color: 'text-blue-400' },
   'property_viewed': { icon: <Eye className="h-3 w-3" />, label: 'Viewed Property', color: 'text-amber-400' },
   'meeting': { icon: <Calendar className="h-3 w-3" />, label: 'Meeting', color: 'text-cyan-400' },
  }
  return types[activity.activity_type] || { icon: <Activity className="h-3 w-3" />, label: activity.activity_type, color: 'text-gray-500' }
 }

 if (loading) {
  return (
   <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse flex flex-col items-center gap-4">
     <div className="w-12 h-12 border-4 border-[#7B5EA7]/30 border-t-emerald-500 rounded-full animate-spin" />
     <p className="text-gray-500">Loading your command center...</p>
    </div>
   </div>
  )
 }

 return (
  <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
   {/* Background decoration */}
   <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#7B5EA7]/10 rounded-full blur-3xl" />
    <div className="absolute top-1/2 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
    <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
   </div>

   {/* Confetti Animation */}
   {showConfetti && (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
     {[...Array(50)].map((_, i) => (
      <div
       key={i}
       className="absolute animate-confetti"
       style={{
        left: `${Math.random() * 100}%`,
        top: '-20px',
        animationDelay: `${Math.random() * 2}s`,
        animationDuration: `${2 + Math.random() * 2}s`,
       }}
      >
       <div
        className={`w-3 h-3 ${['bg-emerald-400', 'bg-teal-400', 'bg-cyan-400', 'bg-amber-400', 'bg-pink-400', 'bg-purple-400'][
         Math.floor(Math.random() * 6)
        ]
         } ${Math.random() > 0.5 ? 'rounded-full' : 'rotate-45'}`}
       />
      </div>
     ))}
    </div>
   )}

   {/* Celebration Modal */}
   {celebrationLead && showConfetti && (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
     <div className="bg-white/95 backdrop-blur-xl border border-[#7B5EA7]/50 rounded-lg p-8 shadow-2xl shadow-emerald-500/20 max-w-md animate-bounce-in pointer-events-auto">
      <div className="text-center">

       <h2 className="text-2xl font-bold text-gray-900 mb-2">Congratulations!</h2>
       <p className="text-[#7B5EA7] text-lg font-medium mb-4">
        {celebrationLead.name} just became a hot lead!
       </p>
       <p className="text-gray-500 text-sm mb-6">
        Score reached {celebrationLead.intent_score} points
       </p>
       <div className="flex justify-center gap-3">
        <a
         href={`tel:${celebrationLead.phone}`}
         className="flex items-center gap-2 bg-[#7B5EA7] hover:bg-emerald-400 text-gray-900 px-5 py-3 rounded-lg font-semibold transition-all"
        >
         <Phone className="h-5 w-5" />
         Call Now
        </a>
        <button
         onClick={() => { setShowConfetti(false); setCelebrationLead(null); }}
         className="px-5 py-3 rounded-lg font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
         Later
        </button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Quick Greeting */}
   <div className="relative mb-6 flex items-start justify-between">
    <div>
     <p className="text-gray-500 text-sm flex items-center gap-2">
      <span>{greeting.text}, {user?.email ? user.email.split('@')[0] : 'there'}!</span>
      <span className="text-xl">{greeting.emoji}</span>
     </p>
     <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
      Command Center
     </h1>
     <p className="text-gray-400 text-xs mt-1">{greeting.motivation}</p>
    </div>

    {/* Action Buttons */}
    <div className="flex items-center gap-2">
     {/* Notification Toggle */}
     <button
      onClick={() => notificationsEnabled ? setNotificationsEnabled(false) : requestNotifications()}
      className={`p-2 rounded-lg transition-all ${notificationsEnabled
       ? 'bg-[#F0EBFA] text-[#7B5EA7] hover:bg-[#7B5EA7]/30'
       : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-50'
       }`}
      title={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
     >
      {notificationsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
     </button>

     {/* Customize Dashboard */}
     <button
      onClick={() => setShowCustomizeModal(true)}
      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-all"
      title="Customize dashboard"
     >
      <LayoutGrid className="h-5 w-5" />
     </button>

     {/* Seed Demo Data Button (for testing) */}
     <button
      onClick={seedDemoData}
      disabled={isSeeding}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm transition-all disabled:opacity-50 border border-gray-200"
     >
      {isSeeding ? (
       <>
        <RefreshCw className="h-4 w-4 animate-spin" />
        Seeding...
       </>
      ) : (
       <>
        <Zap className="h-4 w-4" />
        Seed Demo Data
       </>
      )}
     </button>
    </div>
   </div>

   {seedMessage && (
    <div className="mb-4 text-center">
     <span className="text-xs text-[#7B5EA7] bg-[#7B5EA7]/10 px-3 py-1 rounded-full">
      {seedMessage}
     </span>
    </div>
   )}

   {/* Customize Dashboard Modal */}
   {showCustomizeModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
     <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={() => setShowCustomizeModal(false)}
     />
     <div className="relative bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md shadow-2xl">
      <div className="flex items-center justify-between mb-6">
       <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#F0EBFA] flex items-center justify-center">
         <LayoutGrid className="h-5 w-5 text-[#7B5EA7]" />
        </div>
        <div>
         <h3 className="font-semibold text-gray-900">Customize Dashboard</h3>
         <p className="text-xs text-gray-400">Toggle sections visibility</p>
        </div>
       </div>
       <button
        onClick={() => setShowCustomizeModal(false)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
       >
        <X className="h-5 w-5" />
       </button>
      </div>

      <div className="space-y-3">
       {[
        { key: 'hero', label: 'Priority Hero Card', icon: 'target' },
        { key: 'kpis', label: 'KPI Cards', icon: 'chart' },
        { key: 'actionQueue', label: 'Action Queue', icon: 'zap' },
        { key: 'activityFeed', label: 'Activity Feed', icon: 'feed' },
        { key: 'insights', label: 'Daily Insights', icon: 'bulb' },
        { key: 'momentum', label: 'Weekly Momentum', icon: 'trending' },
        { key: 'hotLeads', label: 'Hot Leads Section', icon: 'flame' },
       ].map(({ key, label, icon }) => (
        <button
         key={key}
         onClick={() => toggleSection(key as keyof typeof sectionVisibility)}
         className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${sectionVisibility[key as keyof typeof sectionVisibility]
          ? 'bg-[#7B5EA7]/10 border-[#7B5EA7]/30 text-gray-900'
          : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
         <span className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <span className="font-medium">{label}</span>
         </span>
         {sectionVisibility[key as keyof typeof sectionVisibility] ? (
          <Eye className="h-5 w-5 text-[#7B5EA7]" />
         ) : (
          <EyeOff className="h-5 w-5" />
         )}
        </button>
       ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
       <button
        onClick={() => {
         const allOn = { hero: true, kpis: true, actionQueue: true, activityFeed: true, insights: true, momentum: true, hotLeads: true }
         setSectionVisibility(allOn)
         localStorage.setItem('dashboardSections', JSON.stringify(allOn))
        }}
        className="w-full text-sm text-gray-500 hover:text-gray-900 transition-colors"
       >
        Reset to defaults
       </button>
      </div>
     </div>
    </div>
   )}

   {/* ============================================ */}
   {/* SECTION 1: DYNAMIC HERO - CONTEXTUAL COMMAND */}
   {/* ============================================ */}
   {sectionVisibility.hero && dynamicHeroCard ? (
    <div className="relative mb-8 rounded-lg overflow-hidden">
     {/* Dynamic Gradient Background */}
     <div className={`absolute inset-0 bg-gradient-to-br ${dynamicHeroCard.gradient}`} />
     <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

     {/* Large Background Icon */}
     <div className="absolute -right-8 -bottom-8 text-[12rem] opacity-10 pointer-events-none">
      {dynamicHeroCard.icon}
     </div>

     <div className="relative p-6 sm:p-8">
      {/* Header with Type Badge */}
      <div className="flex items-center gap-2 mb-6">
       <span className="text-2xl">{dynamicHeroCard.icon}</span>
       <div className="flex-1">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
         {dynamicHeroCard.title}
        </h2>
        <p className="text-gray-900/70 text-sm">{dynamicHeroCard.subtitle}</p>
       </div>

       {/* Urgency Badge */}
       <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${dynamicHeroCard.urgency === 'critical'
        ? 'bg-red-500/20 text-red-200 animate-pulse'
        : dynamicHeroCard.urgency === 'high'
         ? 'bg-amber-500/20 text-amber-200'
         : dynamicHeroCard.urgency === 'medium'
          ? 'bg-teal-500/20 text-teal-200'
          : 'bg-white/10 text-gray-900/80'
        }`}>
        {dynamicHeroCard.urgency === 'critical' && <Flame className="h-3 w-3" />}
        {dynamicHeroCard.urgency === 'high' && <Zap className="h-3 w-3" />}
        {dynamicHeroCard.urgency === 'critical' ? 'Act Now' :
         dynamicHeroCard.urgency === 'high' ? 'High Priority' :
          dynamicHeroCard.urgency === 'medium' ? 'Today' : 'Info'}
       </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
       {/* Left Side - Lead Info (if applicable) */}
       <div className="lg:col-span-3 space-y-5">
        {dynamicHeroCard.lead ? (
         <>
          {/* Lead Card */}
          <div className="flex items-start gap-4">
           {/* Avatar with Score Ring */}
           <div className="relative flex-shrink-0">
            <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center text-3xl sm:text-4xl font-bold text-gray-900 border-2 border-white/20">
             {dynamicHeroCard.lead.name.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-2 -right-2 w-11 h-11 sm:w-13 sm:h-13">
             <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" className="stroke-white/20" strokeWidth="3" />
              <circle
               cx="18" cy="18" r="15" fill="none"
               className={dynamicHeroCard.urgency === 'critical' ? 'stroke-amber-400' : 'stroke-emerald-400'}
               strokeWidth="3"
               strokeDasharray={`${dynamicHeroCard.lead.intent_score * 0.94} 100`}
               strokeLinecap="round"
              />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-900">{dynamicHeroCard.lead.intent_score}</span>
             </div>
            </div>
           </div>

           <div className="flex-1 min-w-0">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
             {dynamicHeroCard.lead.name}
            </h3>

            {/* Lead Details */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-gray-900/70 text-sm">
             {dynamicHeroCard.lead.phone && (
              <span className="flex items-center gap-1">
               <Phone className="h-3 w-3" />
               {dynamicHeroCard.lead.phone}
              </span>
             )}
             {dynamicHeroCard.lead.property_type && (
              <span className="flex items-center gap-1">
               <Building className="h-3 w-3" />
               {dynamicHeroCard.lead.property_type}
              </span>
             )}
             {dynamicHeroCard.lead.locations?.[0] && (
              <span className="flex items-center gap-1">
               <MapPin className="h-3 w-3" />
               {dynamicHeroCard.lead.locations[0]}
              </span>
             )}
            </div>
           </div>
          </div>

          {/* Insight Box */}
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/10">
           <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
             <Zap className="h-4 w-4 text-gray-900" />
            </div>
            <div>
             <p className="text-gray-900/60 text-xs uppercase tracking-wide mb-1">Key Insight</p>
             <p className="text-gray-900 font-medium">{dynamicHeroCard.insight}</p>
            </div>
           </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
           <a
            href={`tel:${dynamicHeroCard.lead.phone}`}
            className="flex items-center gap-2 bg-white text-slate-900 hover:bg-white/90 px-5 py-3 rounded-lg font-semibold transition-all hover:scale-105 shadow-lg"
           >
            <Phone className="h-5 w-5" />
            Call Now
           </a>
           <a
            href={`https://wa.me/91${dynamicHeroCard.lead.phone?.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-gray-900 px-5 py-3 rounded-lg font-semibold transition-all border border-white/20"
           >
            <MessageCircle className="h-5 w-5" />
            WhatsApp
           </a>
           <Link
            href={`/dashboard/leads/${dynamicHeroCard.lead.id}`}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-gray-900 px-5 py-3 rounded-lg font-semibold transition-all border border-white/10"
           >
            <ArrowRight className="h-5 w-5" />
            View Details
           </Link>
          </div>
         </>
        ) : (
         /* Non-lead card (Streak, Time-based, etc.) */
         <div className="space-y-5">
          <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/10">
           <p className="text-gray-900 text-lg font-medium mb-3">{dynamicHeroCard.insight}</p>
           <p className="text-gray-900/60 text-sm">{dynamicHeroCard.action}</p>
          </div>

          <Link
           href="/dashboard/leads"
           className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-white/90 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 shadow-lg"
          >
           <Users className="h-5 w-5" />
           Go to Leads
          </Link>
         </div>
        )}
       </div>

       {/* Right Side - Stats & Activity */}
       <div className="lg:col-span-2 space-y-4">
        {/* Stats Grid */}
        {dynamicHeroCard.stats && dynamicHeroCard.stats.length > 0 && (
         <div className="grid grid-cols-2 gap-3">
          {dynamicHeroCard.stats.map((stat, index) => (
           <div key={index} className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/10 text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-900/60 mt-1">{stat.label}</p>
           </div>
          ))}
         </div>
        )}

        {/* Recent Activity (if lead) */}
        {dynamicHeroCard.lead && dynamicHeroCard.lead.recentActivities.length > 0 && (
         <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/10">
          <h4 className="text-gray-900/80 text-sm font-medium mb-3 flex items-center gap-2">
           <Clock className="h-4 w-4" />
           Recent Activity
          </h4>
          <div className="space-y-3">
           {dynamicHeroCard.lead.recentActivities.slice(0, 3).map((activity) => {
            const display = getActivityDisplay(activity)
            return (
             <div key={activity.id} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full bg-white/10 flex items-center justify-center ${display.color}`}>
               {display.icon}
              </div>
              <div className="flex-1 min-w-0">
               <p className="text-gray-900/90 text-sm font-medium">{display.label}</p>
               <p className="text-gray-900/50 text-xs">
                {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
               </p>
              </div>
             </div>
            )
           })}
          </div>
         </div>
        )}

        {/* Action Recommendation */}
        <div className={`rounded-lg p-4 border ${dynamicHeroCard.urgency === 'critical'
         ? 'bg-red-500/20 border-red-400/30'
         : dynamicHeroCard.urgency === 'high'
          ? 'bg-amber-500/20 border-amber-400/30'
          : 'bg-white/10 border-white/10'
         }`}>
         <p className="text-gray-900 text-sm font-medium flex items-center gap-2">
          <span className="text-lg"><Sparkles className="h-5 w-5 text-[#7B5EA7]" /></span>
          {dynamicHeroCard.action}
         </p>
        </div>

        {/* Card Type Indicator */}
        <div className="text-center pt-2">
         <span className="text-xs text-gray-900/40 uppercase tracking-wider">
          {dynamicHeroCard.type.replace('_', ' ')} • Auto-updated
         </span>
        </div>
       </div>
      </div>
     </div>
    </div>
   ) : (
    /* No Data - Empty State */
    <div className="relative mb-8 rounded-lg overflow-hidden">
     <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
     <div className="relative p-8 sm:p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-slate-700/50 mb-4">
       <Target className="h-8 w-8 text-gray-500" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Your Command Center!</h2>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
       Add your first lead to unlock AI-powered insights, priority recommendations, and smart action suggestions.
      </p>
      <Link
       href="/dashboard/leads"
       className="inline-flex items-center gap-2 bg-[#7B5EA7] hover:bg-emerald-400 text-gray-900 px-6 py-3 rounded-lg font-semibold transition-all"
      >
       Add Your First Lead
       <ArrowRight className="h-4 w-4" />
      </Link>
     </div>
    </div>
   )}

   {/* ============================================ */}
   {/* SECTION 2: SMART KPI CARDS */}
   {/* ============================================ */}
   {sectionVisibility.kpis && (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
     {/* CARD 1: Hot Pipeline Value */}
     <Link
      href="/dashboard/leads?status=hot"
      className="group relative bg-gradient-to-br from-[#7B5EA7]/10 via-teal-500/5 to-slate-900/50 backdrop-blur-xl border border-[#7B5EA7]/20 rounded-lg p-5 hover:border-[#7B5EA7]/40 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300"
     >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#7B5EA7]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

      <div className="relative">
       {/* Header */}
       <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#7B5EA7]/30 to-teal-500/20 flex items-center justify-center">
         <Flame className="h-5 w-5 text-[#7B5EA7]" />
        </div>
        {kpiMetrics.hotPipeline.trend !== 0 && (
         <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${kpiMetrics.hotPipeline.trend > 0
          ? 'bg-[#F0EBFA] text-[#7B5EA7]'
          : 'bg-red-500/20 text-red-400'
          }`}>
          {kpiMetrics.hotPipeline.trend > 0 ? '↑' : '↓'} {Math.abs(kpiMetrics.hotPipeline.trend)}%
         </span>
        )}
       </div>

       {/* Primary Value */}
       <div className="mb-1">
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">
         ₹<AnimatedNumber
          value={Math.round(kpiMetrics.hotPipeline.value / 100000)}
          suffix="L"
         />
        </p>
        <p className="text-xs text-gray-500">
         from {kpiMetrics.hotPipeline.count} hot leads
        </p>
       </div>

       {/* Progress Bar */}
       <div className="mt-3 mb-2">
        <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
         <div
          className="h-full bg-gradient-to-r from-[#7B5EA7] to-teal-500 rounded-full transition-all duration-1000"
          style={{ width: `${kpiMetrics.hotPipeline.targetProgress}%` }}
         />
        </div>
        <p className="text-xs text-gray-400 mt-1">{kpiMetrics.hotPipeline.targetProgress}% of monthly target</p>
       </div>

       {/* Micro-insight */}
       {kpiMetrics.hotPipeline.readyToClose > 0 && (
        <p className="text-xs text-[#7B5EA7]/80 mt-2">
         {kpiMetrics.hotPipeline.readyToClose} leads ready to close this week
        </p>
       )}
      </div>
     </Link>

     {/* CARD 2: Next 24 Hours */}
     <div className="group relative bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-slate-900/50 backdrop-blur-xl border border-teal-500/20 rounded-lg p-5 hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

      <div className="relative">
       {/* Header */}
       <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-teal-500/30 to-cyan-500/20 flex items-center justify-center relative">
         <Clock className="h-5 w-5 text-teal-400" />
         {kpiMetrics.followUp.count > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-900 animate-pulse">
           !
          </span>
         )}
        </div>
        {kpiMetrics.followUp.count > 0 && (
         <span className="text-xs text-teal-400/80 bg-teal-500/10 px-2 py-1 rounded-full">
          Pending
         </span>
        )}
       </div>

       {/* Primary Value */}
       <div className="mb-2">
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">
         <AnimatedNumber value={kpiMetrics.followUp.count} /> leads
        </p>
        <p className="text-xs text-gray-500">Need follow-up</p>
       </div>

       {/* Lead Avatars */}
       {kpiMetrics.followUp.leads.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
         {kpiMetrics.followUp.leads.slice(0, 4).map((lead, i) => (
          <div
           key={lead.id}
           className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-500/20 border-2 border-gray-200 flex items-center justify-center text-xs font-medium text-gray-900 -ml-1 first:ml-0"
           title={lead.name}
          >
           {lead.name.charAt(0)}
          </div>
         ))}
         {kpiMetrics.followUp.leads.length > 4 && (
          <span className="text-xs text-gray-400 ml-1">
           +{kpiMetrics.followUp.leads.length - 4}
          </span>
         )}
        </div>
       )}

       {/* Countdown */}
       {kpiMetrics.followUp.count > 0 && (
        <p className="text-xs text-teal-400/80">
         First call in {kpiMetrics.followUp.hoursToCall}h {kpiMetrics.followUp.minutesToCall}m
        </p>
       )}
       {kpiMetrics.followUp.count === 0 && (
        <p className="text-xs text-[#7B5EA7]/80">
         All leads followed up!
        </p>
       )}
      </div>
     </div>

     {/* CARD 3: Conversion Velocity */}
     <Link
      href="/dashboard/analytics"
      className="group relative bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-slate-900/50 backdrop-blur-xl border border-cyan-500/20 rounded-lg p-5 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1 transition-all duration-300"
     >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

      <div className="relative">
       {/* Header */}
       <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-cyan-500/30 to-teal-500/20 flex items-center justify-center">
         <TrendingUp className="h-5 w-5 text-cyan-400" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
       </div>

       {/* Primary Value */}
       <div className="mb-2">
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">
         {kpiMetrics.velocity.avgDays > 0 ? (
          <>{kpiMetrics.velocity.avgDays} days</>
         ) : (
          <>-- days</>
         )}
        </p>
        <p className="text-xs text-gray-500">Avg time to hot status</p>
       </div>

       {/* Benchmark */}
       {kpiMetrics.velocity.improvement > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
         <Zap className="h-3 w-3 text-cyan-400" />
         <span className="text-xs text-cyan-400">
          {kpiMetrics.velocity.improvement}% faster than industry avg
         </span>
        </div>
       )}

       {/* Mini Sparkline */}
       <div className="flex items-end gap-1 h-8 mt-2">
        {kpiMetrics.velocity.trend.map((point, i) => (
         <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
           className={`w-full rounded-sm transition-all ${i === kpiMetrics.velocity.trend.length - 1
            ? 'bg-cyan-500'
            : 'bg-cyan-500/30'
            }`}
           style={{
            height: `${Math.max((1 - point.days / 15) * 100, 20)}%`,
            minHeight: '4px'
           }}
          />
          <span className="text-[9px] text-gray-400">{point.week}</span>
         </div>
        ))}
       </div>
      </div>
     </Link>

     {/* CARD 4: Today's Momentum */}
     <div className="group relative bg-gradient-to-br from-[#7B5EA7]/10 via-cyan-500/5 to-slate-900/50 backdrop-blur-xl border border-[#7B5EA7]/20 rounded-lg p-5 hover:border-[#7B5EA7]/40 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7B5EA7]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

      <div className="relative">
       {/* Header */}
       <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#7B5EA7]/30 to-cyan-500/20 flex items-center justify-center">
         <Activity className="h-5 w-5 text-[#7B5EA7]" />
        </div>
        {kpiMetrics.momentum.change !== 0 && (
         <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${kpiMetrics.momentum.change > 0
          ? 'bg-[#F0EBFA] text-[#7B5EA7]'
          : 'bg-red-500/20 text-red-400'
          }`}>
          {kpiMetrics.momentum.change > 0 ? '↑' : '↓'} {Math.abs(kpiMetrics.momentum.change)}%
         </span>
        )}
       </div>

       {/* Primary Value */}
       <div className="mb-2">
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">
         <AnimatedNumber value={kpiMetrics.momentum.today} /> activities
        </p>
        <p className="text-xs text-gray-500">Logged today</p>
       </div>

       {/* Breakdown */}
       <div className="flex flex-wrap gap-2 mb-3 text-xs">
        {kpiMetrics.momentum.breakdown.calls > 0 && (
         <span className="text-gray-500">Calls: {kpiMetrics.momentum.breakdown.calls}</span>
        )}
        {kpiMetrics.momentum.breakdown.whatsapp > 0 && (
         <span className="text-gray-500">Messages: {kpiMetrics.momentum.breakdown.whatsapp}</span>
        )}
        {kpiMetrics.momentum.breakdown.visits > 0 && (
         <span className="text-gray-500">Visits: {kpiMetrics.momentum.breakdown.visits}</span>
        )}
        {kpiMetrics.momentum.breakdown.emails > 0 && (
         <span className="text-gray-500">Emails: {kpiMetrics.momentum.breakdown.emails}</span>
        )}
       </div>

       {/* Week Trend Mini Bar Chart */}
       <div className="flex items-end gap-1 h-6">
        {kpiMetrics.momentum.weekTrend.map((day, i) => (
         <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
           className={`w-full rounded-sm transition-all ${i === kpiMetrics.momentum.weekTrend.length - 1
            ? 'bg-[#7B5EA7]'
            : 'bg-[#7B5EA7]/30'
            }`}
           style={{
            height: `${Math.max((day.count / kpiMetrics.momentum.maxWeekCount) * 100, 10)}%`,
            minHeight: '2px'
           }}
          />
          <span className="text-[8px] text-gray-400">{day.day}</span>
         </div>
        ))}
       </div>
      </div>
     </div>
    </div>
   )}

   {/* ============================================ */}
   {/* SECTION 3: INTELLIGENT ACTION QUEUE */}
   {/* ============================================ */}
   {sectionVisibility.actionQueue && (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
     <div className="flex items-center justify-between mb-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
       <Zap className="h-5 w-5 text-[#7B5EA7]" />
       Smart Action Queue
       <span className="text-sm font-normal text-gray-500">— Do These Next</span>
      </h2>
      {actionQueue.length > 0 && (
       <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
        {actionQueue.length} actions pending
       </span>
      )}
     </div>

     {actionQueue.length > 0 ? (
      <div className="overflow-x-auto">
       <table className="w-full">
        <thead>
         <tr className="border-b border-gray-100">
          <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pl-2">#</th>
          <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3">Lead</th>
          <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 hidden sm:table-cell">AI Recommendation</th>
          <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 hidden md:table-cell">Urgency</th>
          <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-2">Actions</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
         {actionQueue.map((item, index) => (
          <tr
           key={item.lead.id}
           className="group hover:bg-gray-50 transition-colors"
          >
           {/* Rank */}
           <td className="py-3 pl-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${index === 0
             ? 'bg-[#F0EBFA] text-[#7B5EA7] ring-2 ring-emerald-500/30'
             : index < 3
              ? 'bg-teal-500/20 text-teal-400'
              : 'bg-slate-700/50 text-gray-500'
             }`}>
             {index + 1}
            </div>
           </td>

           {/* Lead Info */}
           <td className="py-3">
            <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#7B5EA7]/20 to-teal-500/20 flex items-center justify-center text-sm font-bold text-gray-900 flex-shrink-0">
              {item.lead.name.charAt(0)}
             </div>
             <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate max-w-[120px] sm:max-w-[180px]">
               {item.lead.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
               {item.lead.property_type && (
                <span className="flex items-center gap-1">
                 <Building className="h-3 w-3" />
                 {item.lead.property_type}
                </span>
               )}
               <span>•</span>
               <span>
                {item.daysSinceActivity === 0
                 ? 'Today'
                 : item.daysSinceActivity === 1
                  ? 'Yesterday'
                  : `${item.daysSinceActivity}d ago`}
               </span>
              </div>
              {/* Mobile: Show recommendation inline */}
              <p className="sm:hidden text-xs text-[#7B5EA7]/80 mt-1 flex items-center gap-1">
               <span>{item.recommendationIcon}</span>
               <span className="truncate">{item.recommendation}</span>
              </p>
             </div>
            </div>
           </td>

           {/* AI Recommendation */}
           <td className="py-3 hidden sm:table-cell">
            <div className="flex items-center gap-2">
             <span className="text-lg">{item.recommendationIcon}</span>
             <span className={`text-sm ${item.urgency === 'urgent'
              ? 'text-amber-400 font-medium'
              : item.urgency === 'high'
               ? 'text-teal-400'
               : 'text-gray-600'
              }`}>
              {item.recommendation}
             </span>
            </div>
           </td>

           {/* Urgency */}
           <td className="py-3 hidden md:table-cell">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${item.urgency === 'urgent'
             ? 'bg-amber-500/20 text-amber-400'
             : item.urgency === 'high'
              ? 'bg-teal-500/20 text-teal-400'
              : 'bg-cyan-500/20 text-cyan-400'
             }`}>
             {item.urgency === 'urgent' && <><Flame className="h-3 w-3" /> Now</>}
             {item.urgency === 'high' && <><Zap className="h-3 w-3" /> Today</>}
             {item.urgency === 'normal' && <><Calendar className="h-3 w-3" /> This Week</>}
            </span>
           </td>

           {/* Quick Actions */}
           <td className="py-3 pr-2">
            <div className="flex items-center justify-end gap-1">
             <a
              href={`tel:${item.lead.phone}`}
              className="p-2 rounded-lg bg-[#7B5EA7]/10 hover:bg-[#F0EBFA] text-[#7B5EA7] transition-colors"
              title="Call"
             >
              <Phone className="h-4 w-4" />
             </a>
             <a
              href={`https://wa.me/91${item.lead.phone?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition-colors"
              title="WhatsApp"
             >
              <MessageCircle className="h-4 w-4" />
             </a>
             <Link
              href={`/dashboard/leads/${item.lead.id}`}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
              title="View Details"
             >
              <ArrowRight className="h-4 w-4" />
             </Link>
            </div>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     ) : (
      /* Empty State */
      <div className="text-center py-12">
       <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-[#7B5EA7]/10 mb-4">
        <CheckCircle className="h-8 w-8 text-[#7B5EA7]" />
       </div>
       <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up.</h3>
       <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
        No pending actions right now. Add more leads or review your closed deals.
       </p>
       <Link
        href="/dashboard/leads"
        className="inline-flex items-center gap-2 bg-[#7B5EA7] hover:bg-emerald-400 text-gray-900 px-5 py-2.5 rounded-lg font-medium transition-all text-sm"
       >
        <Users className="h-4 w-4" />
        Add New Leads
       </Link>
      </div>
     )}

     {/* Legend */}
     {actionQueue.length > 0 && (
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-200">
       <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span>Urgent (Act Now)</span>
       </div>
       <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-teal-500" />
        <span>High (Today)</span>
       </div>
       <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-cyan-500" />
        <span>Normal (This Week)</span>
       </div>
      </div>
     )}
    </div>
   )}

   {/* ============================================ */}
   {/* SECTION 4: REAL-TIME ACTIVITY FEED */}
   {/* ============================================ */}
   {sectionVisibility.activityFeed && (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
     <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
       <Activity className="h-5 w-5 text-[#7B5EA7]" />
       Live Activity Stream
      </h2>
      <div className="flex items-center gap-3">
       <span className="text-xs text-gray-400">
        Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
       </span>
       <button
        onClick={() => fetchData(true)}
        disabled={isRefreshing}
        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-all disabled:opacity-50"
        title="Refresh"
       >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
       </button>
      </div>
     </div>

     {activities.length > 0 ? (
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
       {activities.slice(0, 30).map((activity) => {
        // Find the lead for this activity
        const lead = leads.find(l => l.id === activity.lead_id)
        if (!lead) return null

        // Determine activity display
        const getActivityInfo = () => {
         const types: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
          'call': {
           icon: <Phone className="h-4 w-4" />,
           label: 'Call Made',
           color: 'text-[#7B5EA7]'
          },
          'site_visit': {
           icon: <Building className="h-4 w-4" />,
           label: 'Site Visit',
           color: 'text-purple-400'
          },
          'whatsapp': {
           icon: <MessageCircle className="h-4 w-4" />,
           label: 'WhatsApp Sent',
           color: 'text-green-400'
          },
          'email': {
           icon: <Mail className="h-4 w-4" />,
           label: 'Email Sent',
           color: 'text-blue-400'
          },
          'property_viewed': {
           icon: <Eye className="h-4 w-4" />,
           label: 'Property Viewed',
           color: 'text-amber-400'
          },
          'meeting': {
           icon: <Calendar className="h-4 w-4" />,
           label: 'Meeting',
           color: 'text-cyan-400'
          },
          'note': {
           icon: <FileText className="h-4 w-4" />,
           label: 'Note Added',
           color: 'text-gray-500'
          },
         }
         return types[activity.activity_type] || {
          icon: <Activity className="h-4 w-4" />,
          label: activity.activity_type,
          color: 'text-gray-500'
         }
        }

        // Determine outcome color
        const getOutcomeStyle = () => {
         const outcome = activity.activity_data?.outcome
         if (outcome === 'Interested' || outcome === 'Very interested' || outcome === 'Positive') {
          return 'border-l-emerald-500 bg-[#7B5EA7]/5'
         } else if (outcome === 'No answer' || outcome === 'Not interested' || outcome === 'Negative') {
          return 'border-l-red-500/50 bg-red-500/5'
         }
         return 'border-l-slate-600 bg-gray-50'
        }

        // Get outcome icon
        const getOutcomeIcon = () => {
         const outcome = activity.activity_data?.outcome
         if (outcome === 'Interested' || outcome === 'Very interested' || outcome === 'Positive') {
          return <ThumbsUp className="h-3 w-3 text-[#7B5EA7]" />
         } else if (outcome === 'No answer' || outcome === 'Not interested' || outcome === 'Negative') {
          return <ThumbsDown className="h-3 w-3 text-red-400" />
         }
         return null
        }

        const activityInfo = getActivityInfo()
        const outcomeStyle = getOutcomeStyle()
        const outcomeIcon = getOutcomeIcon()

        // Get description
        const getDescription = () => {
         const outcome = activity.activity_data?.outcome
         const notes = activity.activity_data?.notes

         if (outcome && outcome !== 'Other') {
          return outcome
         }
         if (notes) {
          return notes.length > 50 ? notes.substring(0, 50) + '...' : notes
         }
         return null
        }

        const description = getDescription()

        return (
         <div
          key={activity.id}
          className={`flex items-start gap-3 p-3 rounded-lg border-l-2 transition-colors hover:bg-gray-50 ${outcomeStyle}`}
         >
          {/* Activity Icon */}
          <div className={`w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 ${activityInfo.color}`}>
           {activityInfo.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
           <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
             <div className="flex items-center gap-2 flex-wrap">
              <Link
               href={`/dashboard/leads/${lead.id}`}
               className="font-medium text-gray-900 hover:text-[#7B5EA7] transition-colors"
              >
               {lead.name}
              </Link>
              <span className={`text-sm ${activityInfo.color}`}>
               {activityInfo.label}
              </span>
              {outcomeIcon && (
               <span className="flex items-center">{outcomeIcon}</span>
              )}
             </div>
             {description && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
               {description}
              </p>
             )}
            </div>

            {/* Time & Score */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
             <span className="text-xs text-gray-400 whitespace-nowrap">
              {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
             </span>
             {lead.intent_score >= 60 && (
              <span className="text-xs font-medium text-[#7B5EA7] bg-[#7B5EA7]/10 px-1.5 py-0.5 rounded">
               Score: {lead.intent_score}
              </span>
             )}
            </div>
           </div>
          </div>
         </div>
        )
       })}
      </div>
     ) : (
      /* Empty State */
      <div className="text-center py-12">
       <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gray-100 mb-3">
        <Activity className="h-6 w-6 text-gray-400" />
       </div>
       <p className="text-gray-500 text-sm">No activities recorded yet</p>
       <p className="text-gray-400 text-xs mt-1">Log your first activity on a lead to see it here</p>
      </div>
     )}

     {/* Activity Count */}
     {activities.length > 30 && (
      <div className="text-center mt-4 pt-4 border-t border-gray-200">
       <Link
        href="/dashboard/leads"
        className="text-sm text-[#7B5EA7] hover:text-emerald-300 transition-colors"
       >
        View all {activities.length} activities →
       </Link>
      </div>
     )}
    </div>
   )}

   {/* ============================================ */}
   {/* SECTION 5: DAILY INSIGHTS PANEL */}
   {/* ============================================ */}
   {sectionVisibility.insights && dailyInsights.length > 0 && (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
     <div className="flex items-center justify-between mb-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
       <span className="text-xl"></span>
       Today&apos;s Intelligence Brief
      </h2>
      <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
       {dailyInsights.length} insight{dailyInsights.length > 1 ? 's' : ''}
      </span>
     </div>

     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {dailyInsights.map((insight) => (
       <div
        key={insight.id}
        className={`relative overflow-hidden rounded-lg p-5 border transition-all hover:shadow-lg ${insight.type === 'success'
         ? 'bg-gradient-to-br from-[#7B5EA7]/10 via-emerald-500/5 to-transparent border-[#7B5EA7]/20 hover:border-[#7B5EA7]/40'
         : insight.type === 'warning'
          ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 hover:border-amber-500/40'
          : insight.type === 'opportunity'
           ? 'bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent border-teal-500/20 hover:border-teal-500/40'
           : 'bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent border-cyan-500/20 hover:border-cyan-500/40'
         }`}
       >
        {/* Background Icon */}
        <div className="absolute -right-4 -bottom-4 text-6xl opacity-10">
         {insight.icon}
        </div>

        <div className="relative">
         {/* Header */}
         <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl flex-shrink-0">{insight.icon}</span>
          <div>
           <h3 className={`font-semibold text-base ${insight.type === 'success'
            ? 'text-[#7B5EA7]'
            : insight.type === 'warning'
             ? 'text-amber-400'
             : insight.type === 'opportunity'
              ? 'text-teal-400'
              : 'text-cyan-400'
            }`}>
            {insight.headline}
           </h3>
           <p className="text-sm text-gray-500 mt-1">
            {insight.data}
           </p>
          </div>
         </div>

         {/* Action */}
         <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 flex-1 mr-3">
           {insight.action}
          </p>
          <Link
           href={insight.buttonLink}
           className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${insight.type === 'success'
            ? 'bg-[#F0EBFA] text-[#7B5EA7] hover:bg-[#7B5EA7]/30'
            : insight.type === 'warning'
             ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
             : insight.type === 'opportunity'
              ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
              : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
            }`}
          >
           {insight.buttonText}
          </Link>
         </div>
        </div>
       </div>
      ))}
     </div>

     {/* Powered by AI note */}
     <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-200">
      <Zap className="h-3 w-3 text-slate-600" />
      <span className="text-xs text-slate-600">
       Insights generated from your activity data
      </span>
     </div>
    </div>
   )}

   {/* ============================================ */}
   {/* SECTION 6: WEEKLY MOMENTUM TRACKER */}
   {/* ============================================ */}
   {sectionVisibility.momentum && (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
     <div className="flex items-center justify-between mb-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
       <TrendingUp className="h-5 w-5 text-[#7B5EA7]" />
       This Week&apos;s Momentum
      </h2>
      <span className="text-xs text-gray-400">
       Last 7 days
      </span>
     </div>

     {/* Weekly Timeline */}
     <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-6">
      {weeklyMomentum.days.map((day, index) => {
       const isToday = index === 6
       const activityHeight = weeklyMomentum.maxActivities > 0
        ? Math.max((day.activities / weeklyMomentum.maxActivities) * 100, 10)
        : 10
       const leadSize = Math.min(8 + day.newLeads * 4, 24)

       return (
        <div
         key={index}
         className={`group relative flex flex-col items-center p-2 sm:p-3 rounded-lg transition-all cursor-pointer ${isToday
          ? 'bg-[#7B5EA7]/10 border border-[#7B5EA7]/30'
          : 'bg-gray-50 hover:bg-gray-50'
          }`}
        >
         {/* Day Label */}
         <span className={`text-xs font-medium mb-1 ${isToday ? 'text-[#7B5EA7]' : 'text-gray-500'
          }`}>
          {day.dayName}
         </span>
         <span className={`text-sm font-bold mb-3 ${isToday ? 'text-gray-900' : 'text-gray-600'
          }`}>
          {day.dateStr}
         </span>

         {/* Activity Bar */}
         <div className="w-full h-20 flex items-end justify-center mb-2">
          <div
           className={`w-full max-w-[40px] rounded-t-lg transition-all ${day.activities > 0
            ? isToday
             ? 'bg-gradient-to-t from-[#7B5EA7] to-teal-400'
             : 'bg-gradient-to-t from-cyan-500/60 to-teal-400/40'
            : 'bg-slate-700/30'
            }`}
           style={{ height: `${activityHeight}%` }}
          />
         </div>

         {/* New Leads Dot */}
         {day.newLeads > 0 && (
          <div
           className="absolute top-14 left-1/2 -translate-x-1/2 rounded-full bg-[#7B5EA7] border-2 border-slate-900 flex items-center justify-center"
           style={{
            width: `${leadSize}px`,
            height: `${leadSize}px`,
           }}
          >
           {day.newLeads > 1 && (
            <span className="text-[8px] font-bold text-gray-900">{day.newLeads}</span>
           )}
          </div>
         )}

         {/* Hot Conversions Star */}
         {day.hotConversions > 0 && (
          <div className="absolute top-8 right-0 sm:right-1">
           <span className="text-amber-400 text-sm"></span>
           {day.hotConversions > 1 && (
            <span className="absolute -bottom-1 -right-1 text-[8px] font-bold text-amber-400 bg-white rounded-full px-1">
             {day.hotConversions}
            </span>
           )}
          </div>
         )}

         {/* Day Score Badge */}
         <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 ${day.score === 'great'
          ? 'bg-[#F0EBFA] text-[#7B5EA7]'
          : day.score === 'good'
           ? 'bg-teal-500/20 text-teal-400'
           : day.score === 'slow'
            ? 'bg-slate-600/50 text-gray-500'
            : 'bg-slate-700/30 text-gray-400'
          }`}>
          {day.score === 'great' ? 'Great' :
           day.score === 'good' ? 'Good' :
            day.score === 'slow' ? 'Slow' :
             '—'}
         </div>

         {/* Hover Tooltip */}
         <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 shadow-xl min-w-[140px]">
           <p className="text-xs font-semibold text-gray-900 mb-2">
            {day.dayName}, {day.dateStr}
           </p>
           <div className="space-y-1 text-xs">
            <div className="flex justify-between">
             <span className="text-gray-500">New Leads:</span>
             <span className="text-[#7B5EA7] font-medium">{day.newLeads}</span>
            </div>
            <div className="flex justify-between">
             <span className="text-gray-500">Activities:</span>
             <span className="text-cyan-400 font-medium">{day.activities}</span>
            </div>
            <div className="flex justify-between">
             <span className="text-gray-500">Hot Leads:</span>
             <span className="text-amber-400 font-medium">{day.hotConversions}</span>
            </div>
           </div>
           {/* Arrow */}
           <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
          </div>
         </div>
        </div>
       )
      })}
     </div>

     {/* Legend */}
     <div className="flex flex-wrap items-center justify-center gap-4 mb-4 pb-4 border-b border-gray-200">
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
       <div className="w-3 h-3 rounded-full bg-[#7B5EA7]" />
       <span>New Leads</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
       <div className="w-3 h-6 rounded bg-cyan-500/60" />
       <span>Activities</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
       <span className="text-amber-400"></span>
       <span>Hot Conversion</span>
      </div>
     </div>

     {/* Week Summary */}
     <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
       <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="text-center">
         <p className="text-2xl font-bold text-[#7B5EA7]">{weeklyMomentum.thisWeek.leads}</p>
         <p className="text-xs text-gray-400">New Leads</p>
        </div>
        <div className="text-center">
         <p className="text-2xl font-bold text-cyan-400">{weeklyMomentum.thisWeek.activities}</p>
         <p className="text-xs text-gray-400">Activities</p>
        </div>
        <div className="text-center">
         <p className="text-2xl font-bold text-amber-400">{weeklyMomentum.thisWeek.hot}</p>
         <p className="text-xs text-gray-400">Became Hot</p>
        </div>
       </div>

       {/* Comparison */}
       <div className={`text-sm font-medium px-4 py-2 rounded-full ${weeklyMomentum.comparison > 0
        ? 'bg-[#F0EBFA] text-[#7B5EA7]'
        : weeklyMomentum.comparison < 0
         ? 'bg-red-500/20 text-red-400'
         : 'bg-slate-700/50 text-gray-500'
        }`}>
        {weeklyMomentum.comparisonText}
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Recent Hot Leads */}
   {sectionVisibility.hotLeads && leads.filter(l => l.intent_score >= 60).length > 0 && (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
     <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
       <Flame className="h-5 w-5 text-[#7B5EA7]" />
       High-Intent Leads
      </h2>
      <Link
       href="/dashboard/leads"
       className="text-sm text-[#7B5EA7] hover:text-emerald-300 flex items-center gap-1"
      >
       View all <ArrowRight className="h-3 w-3" />
      </Link>
     </div>
     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {leads
       .filter(l => l.intent_score >= 60)
       .slice(0, 6)
       .map(lead => (
        <Link
         key={lead.id}
         href={`/dashboard/leads/${lead.id}`}
         className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 transition-all border border-gray-100 hover:border-[#7B5EA7]/30 group"
        >
         <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7B5EA7]/20 to-teal-500/20 flex items-center justify-center text-lg font-bold text-gray-900">
           {lead.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
           <p className="font-medium text-gray-900 truncate group-hover:text-[#7B5EA7] transition-colors">
            {lead.name}
           </p>
           <p className="text-xs text-gray-500 truncate">
            {lead.property_type} • {lead.locations?.[0] || 'No location'}
           </p>
          </div>
          <div className={`text-sm font-bold px-2 py-1 rounded-lg ${lead.intent_score >= 70
           ? 'bg-[#F0EBFA] text-[#7B5EA7]'
           : 'bg-teal-500/20 text-teal-400'
           }`}>
           {lead.intent_score}
          </div>
         </div>
        </Link>
       ))}
     </div>
    </div>
   )}

   {/* Quick Actions */}
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <Link
     href="/dashboard/leads"
     className="bg-white border border-gray-200 rounded-lg p-5 hover:bg-gray-50 hover:border-[#7B5EA7]/30 transition-all group"
    >
     <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-[#F0EBFA] flex items-center justify-center group-hover:scale-110 transition-transform">
       <Users className="h-6 w-6 text-[#7B5EA7]" />
      </div>
      <div>
       <p className="font-semibold text-gray-900 group-hover:text-[#7B5EA7] transition-colors">Manage Leads</p>
       <p className="text-sm text-gray-500">View & add leads</p>
      </div>
     </div>
    </Link>

    <Link
     href="/dashboard/analytics"
     className="bg-white border border-gray-200 rounded-lg p-5 hover:bg-gray-50 hover:border-teal-500/30 transition-all group"
    >
     <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-teal-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
       <BarChart3 className="h-6 w-6 text-teal-400" />
      </div>
      <div>
       <p className="font-semibold text-gray-900 group-hover:text-teal-400 transition-colors">Analytics</p>
       <p className="text-sm text-gray-500">Deep insights</p>
      </div>
     </div>
    </Link>

    <div className="bg-white border border-gray-200 rounded-lg p-5">
     <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
       <Calendar className="h-6 w-6 text-cyan-400" />
      </div>
      <div>
       <p className="font-semibold text-gray-900">Schedule</p>
       <p className="text-sm text-gray-500">Coming soon</p>
      </div>
     </div>
    </div>
   </div>

   {/* ============================================ */}
   {/* QUICK ACCESS TOOLBAR (Floating) */}
   {/* ============================================ */}
   <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
    {/* Secondary Actions (show when FAB is open) */}
    <div className={`flex flex-col-reverse gap-3 transition-all duration-300 ${fabOpen
     ? 'opacity-100 translate-y-0'
     : 'opacity-0 translate-y-4 pointer-events-none'
     }`}>
     {/* Settings */}
     <button
      onClick={() => {/* Settings modal */ }}
      className="group flex items-center gap-3"
     >
      <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
       Settings
      </span>
      <div className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center shadow-lg transition-all hover:scale-110">
       <Settings className="h-5 w-5 text-gray-600" />
      </div>
     </button>

     {/* Quick Message */}
     <button
      onClick={() => { setQuickMessageOpen(true); setFabOpen(false); }}
      className="group flex items-center gap-3"
     >
      <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
       Send Message
      </span>
      <div className="w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/30 transition-all hover:scale-110">
       <MessageCircle className="h-5 w-5 text-gray-900" />
      </div>
     </button>

     {/* Log Call */}
     <button
      onClick={() => { setQuickLogOpen(true); setFabOpen(false); }}
      className="group flex items-center gap-3"
     >
      <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
       Log Activity
      </span>
      <div className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-all hover:scale-110">
       <Phone className="h-5 w-5 text-gray-900" />
      </div>
     </button>

     {/* Add Lead */}
     <Link
      href="/dashboard/leads"
      className="group flex items-center gap-3"
      onClick={() => setFabOpen(false)}
     >
      <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
       Add Lead
      </span>
      <div className="w-12 h-12 rounded-full bg-[#7B5EA7] hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-110">
       <Users className="h-5 w-5 text-gray-900" />
      </div>
     </Link>
    </div>

    {/* Main FAB Button */}
    <button
     onClick={() => setFabOpen(!fabOpen)}
     className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${fabOpen
      ? 'bg-slate-700 rotate-45'
      : 'bg-gradient-to-br from-[#7B5EA7] to-teal-500 hover:from-emerald-400 hover:to-teal-400 hover:scale-110 shadow-emerald-500/40'
      }`}
    >
     <Plus className={`h-6 w-6 text-gray-900 transition-transform duration-300`} />
    </button>
   </div>

   {/* ============================================ */}
   {/* QUICK LOG MODAL */}
   {/* ============================================ */}
   {quickLogOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
     {/* Backdrop */}
     <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={() => setQuickLogOpen(false)}
     />

     {/* Modal */}
     <div className="relative bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
       <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
         <Phone className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
         <h3 className="font-semibold text-gray-900">Quick Log Activity</h3>
         <p className="text-xs text-gray-400">Log in seconds</p>
        </div>
       </div>
       <button
        onClick={() => setQuickLogOpen(false)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
       >
        <X className="h-5 w-5" />
       </button>
      </div>

      {/* Form */}
      <div className="space-y-4">
       {/* Lead Select */}
       <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
         Select Lead
        </label>
        <select
         value={quickLogForm.leadId}
         onChange={(e) => setQuickLogForm({ ...quickLogForm, leadId: e.target.value })}
         className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
         <option value="">Choose a lead...</option>
         {leads.map(lead => (
          <option key={lead.id} value={lead.id}>
           {lead.name}
          </option>
         ))}
        </select>
       </div>

       {/* Activity Type */}
       <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
         Activity Type
        </label>
        <div className="grid grid-cols-4 gap-2">
         {[
          { type: 'call', icon: <Phone className="h-4 w-4" />, label: 'Call' },
          { type: 'whatsapp', icon: <MessageCircle className="h-4 w-4" />, label: 'WhatsApp' },
          { type: 'email', icon: <Mail className="h-4 w-4" />, label: 'Email' },
          { type: 'site_visit', icon: <Building className="h-4 w-4" />, label: 'Visit' },
         ].map(({ type, icon, label }) => (
          <button
           key={type}
           type="button"
           onClick={() => setQuickLogForm({ ...quickLogForm, activityType: type })}
           className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${quickLogForm.activityType === type
            ? 'bg-[#F0EBFA] border-[#7B5EA7] text-[#7B5EA7]'
            : 'bg-gray-100 border-gray-200 text-gray-500 hover:border-slate-600'
            }`}
          >
           {icon}
           <span className="text-xs">{label}</span>
          </button>
         ))}
        </div>
       </div>

       {/* Quick Note */}
       <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
         Quick Note <span className="text-gray-400">(optional)</span>
        </label>
        <input
         type="text"
         value={quickLogForm.note}
         onChange={(e) => setQuickLogForm({ ...quickLogForm, note: e.target.value })}
         placeholder="E.g., Positive response, will call back"
         className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
       </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
       <Link
        href={quickLogForm.leadId ? `/dashboard/leads/${quickLogForm.leadId}` : '/dashboard/leads'}
        className="text-sm text-gray-500 hover:text-[#7B5EA7] transition-colors"
        onClick={() => setQuickLogOpen(false)}
       >
        Or add detailed activity →
       </Link>
       <button
        onClick={handleQuickLog}
        disabled={!quickLogForm.leadId || quickLogLoading}
        className="flex items-center gap-2 bg-[#7B5EA7] hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-gray-400 text-gray-900 px-5 py-2.5 rounded-lg font-medium transition-all disabled:cursor-not-allowed"
       >
        {quickLogLoading ? (
         <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Logging...
         </>
        ) : (
         <>
          <CheckCircle className="h-4 w-4" />
          Log Activity
         </>
        )}
       </button>
      </div>
     </div>
    </div>
   )}

   {/* ============================================ */}
   {/* QUICK MESSAGE MODAL */}
   {/* ============================================ */}
   {quickMessageOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
     {/* Backdrop */}
     <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={() => setQuickMessageOpen(false)}
     />

     {/* Modal */}
     <div className="relative bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
       <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
         <MessageCircle className="h-5 w-5 text-teal-400" />
        </div>
        <div>
         <h3 className="font-semibold text-gray-900">Quick Message</h3>
         <p className="text-xs text-gray-400">Opens WhatsApp</p>
        </div>
       </div>
       <button
        onClick={() => setQuickMessageOpen(false)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
       >
        <X className="h-5 w-5" />
       </button>
      </div>

      {/* Lead List */}
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
       {leads.filter(l => l.phone).slice(0, 10).map(lead => (
        <button
         key={lead.id}
         onClick={() => handleQuickMessage(lead.id)}
         className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-100 hover:border-teal-500/30 transition-all text-left"
        >
         <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center text-sm font-bold text-gray-900 flex-shrink-0">
          {lead.name.charAt(0)}
         </div>
         <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{lead.name}</p>
          <p className="text-xs text-gray-400 truncate">{lead.phone}</p>
         </div>
         <div className={`text-xs font-medium px-2 py-1 rounded-lg ${lead.intent_score >= 70
          ? 'bg-[#F0EBFA] text-[#7B5EA7]'
          : 'bg-slate-700 text-gray-500'
          }`}>
          {lead.intent_score}
         </div>
         <Send className="h-4 w-4 text-teal-400" />
        </button>
       ))}

       {leads.filter(l => l.phone).length === 0 && (
        <div className="text-center py-8 text-gray-400">
         <p>No leads with phone numbers</p>
        </div>
       )}
      </div>
     </div>
    </div>
   )}

   {/* Spacer for FAB */}
   <div className="h-24" />
  </div>
 )
}
