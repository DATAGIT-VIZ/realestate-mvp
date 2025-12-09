import { supabase, Lead, LeadActivity } from './supabase'

export type ScoreBreakdownItem = {
  factor: string
  points: number
  icon: string
}

export type ScoringResult = {
  score: number
  breakdown: ScoreBreakdownItem[]
}

export async function calculateIntentScore(leadId: string): Promise<ScoringResult> {
  const breakdown: ScoreBreakdownItem[] = []
  let score = 30 // BASE SCORE

  breakdown.push({ factor: 'Base score', points: 30, icon: 'User' })

  // Fetch lead data
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    return { score: 30, breakdown }
  }

  // Fetch all activities for this lead
  const { data: activities, error: activitiesError } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  const allActivities: LeadActivity[] = activities || []

  const now = new Date()

  // Helper to check if date is within N days
  const isWithinDays = (date: string, days: number) => {
    const diff = now.getTime() - new Date(date).getTime()
    return diff <= days * 24 * 60 * 60 * 1000
  }

  // RESPONSE TIME BONUSES
  const responseTimeActivities = allActivities.filter(a => a.activity_data?.response_time)
  if (responseTimeActivities.length > 0) {
    const latestResponseTime = responseTimeActivities[0].activity_data?.response_time
    if (latestResponseTime === 'Within 2 hours') {
      score += 15
      breakdown.push({ factor: 'Responded within 2 hours', points: 15, icon: 'Zap' })
    } else if (latestResponseTime === 'Within 24 hours') {
      score += 10
      breakdown.push({ factor: 'Responded within 24 hours', points: 10, icon: 'Clock' })
    } else if (latestResponseTime === '1-3 days') {
      score += 5
      breakdown.push({ factor: 'Responded within 1-3 days', points: 5, icon: 'Clock' })
    }
  }

  // ACTIVITY FREQUENCY - Last 7 days (max +30)
  const activitiesLast7Days = allActivities.filter(a => isWithinDays(a.created_at, 7))
  if (activitiesLast7Days.length > 0) {
    const points = Math.min(activitiesLast7Days.length * 5, 30)
    score += points
    breakdown.push({
      factor: `${activitiesLast7Days.length} activities in last 7 days`,
      points,
      icon: 'Activity',
    })
  }

  // ACTIVITY FREQUENCY - Last 24 hours (max +20)
  const activitiesLast24Hours = allActivities.filter(a => isWithinDays(a.created_at, 1))
  if (activitiesLast24Hours.length > 0) {
    const points = Math.min(activitiesLast24Hours.length * 10, 20)
    score += points
    breakdown.push({
      factor: `${activitiesLast24Hours.length} activities in last 24 hours`,
      points,
      icon: 'TrendingUp',
    })
  }

  // ENGAGEMENT SIGNALS - Check all activities for questions asked
  const allQuestionsAsked = new Set<string>()
  allActivities.forEach(activity => {
    const questions = activity.activity_data?.questions_asked || []
    questions.forEach((q: string) => allQuestionsAsked.add(q))
  })

  if (allQuestionsAsked.has('Asked about pricing')) {
    score += 15
    breakdown.push({ factor: 'Asked about pricing', points: 15, icon: 'DollarSign' })
  }

  if (allQuestionsAsked.has('Asked about payment plans')) {
    score += 20
    breakdown.push({ factor: 'Asked about payment plans', points: 20, icon: 'CreditCard' })
  }

  if (allQuestionsAsked.has('Requested site visit')) {
    score += 25
    breakdown.push({ factor: 'Requested site visit', points: 25, icon: 'MapPin' })
  }

  if (allQuestionsAsked.has('Asked about documentation')) {
    score += 15
    breakdown.push({ factor: 'Asked about documentation', points: 15, icon: 'FileText' })
  }

  if (allQuestionsAsked.has('Asked about possession date')) {
    score += 10
    breakdown.push({ factor: 'Asked about possession date', points: 10, icon: 'Calendar' })
  }

  // PROPERTY VIEWS (max +30)
  const propertyViews = allActivities.filter(a => a.activity_type === 'Property Viewed')
  if (propertyViews.length > 0) {
    const points = Math.min(propertyViews.length * 10, 30)
    score += points
    breakdown.push({
      factor: `${propertyViews.length} property view${propertyViews.length > 1 ? 's' : ''}`,
      points,
      icon: 'Eye',
    })
  }

  // SITE VISITS SCHEDULED
  const siteVisits = allActivities.filter(a => a.activity_type === 'Site Visit Scheduled')
  if (siteVisits.length > 0) {
    score += 15
    breakdown.push({ factor: 'Site visit scheduled', points: 15, icon: 'Building' })
  }

  // OUTCOME BONUSES
  const recentActivitiesWithOutcome = allActivities.filter(a => a.activity_data?.outcome)
  let positiveCount = 0
  let negativeCount = 0
  let noResponseCount = 0

  recentActivitiesWithOutcome.forEach(activity => {
    const outcome = activity.activity_data?.outcome
    if (outcome === 'Positive') positiveCount++
    else if (outcome === 'Negative') negativeCount++
    else if (outcome === 'No Response') noResponseCount++
  })

  if (positiveCount > 0) {
    const points = Math.min(positiveCount * 10, 30)
    score += points
    breakdown.push({
      factor: `${positiveCount} positive outcome${positiveCount > 1 ? 's' : ''}`,
      points,
      icon: 'ThumbsUp',
    })
  }

  if (negativeCount > 0) {
    const points = Math.max(negativeCount * -5, -15)
    score += points
    breakdown.push({
      factor: `${negativeCount} negative outcome${negativeCount > 1 ? 's' : ''}`,
      points,
      icon: 'ThumbsDown',
    })
  }

  if (noResponseCount > 0) {
    const points = Math.max(noResponseCount * -10, -20)
    score += points
    breakdown.push({
      factor: `${noResponseCount} no response${noResponseCount > 1 ? 's' : ''}`,
      points,
      icon: 'Clock',
    })
  }

  // TIME DECAY
  const lastActivityDate = allActivities.length > 0 
    ? new Date(allActivities[0].created_at) 
    : new Date(lead.created_at)
  
  const daysSinceLastActivity = Math.floor(
    (now.getTime() - lastActivityDate.getTime()) / (24 * 60 * 60 * 1000)
  )

  if (daysSinceLastActivity >= 30) {
    score -= 30
    breakdown.push({
      factor: `No activity in ${daysSinceLastActivity} days`,
      points: -30,
      icon: 'AlertCircle',
    })
  } else if (daysSinceLastActivity >= 14) {
    score -= 20
    breakdown.push({
      factor: `No activity in ${daysSinceLastActivity} days`,
      points: -20,
      icon: 'AlertTriangle',
    })
  } else if (daysSinceLastActivity >= 7) {
    score -= 10
    breakdown.push({
      factor: `No activity in ${daysSinceLastActivity} days`,
      points: -10,
      icon: 'Clock',
    })
  }

  // LEAD DATA BONUSES (from initial lead info)
  if (lead.budget_min && lead.budget_max) {
    score += 10
    breakdown.push({ factor: 'Budget range provided', points: 10, icon: 'DollarSign' })
  }

  if (lead.timeline === 'Immediate') {
    score += 15
    breakdown.push({ factor: 'Immediate timeline', points: 15, icon: 'Zap' })
  } else if (lead.timeline === '1-3 months') {
    score += 10
    breakdown.push({ factor: 'Short timeline (1-3 months)', points: 10, icon: 'Calendar' })
  }

  if (lead.source === 'Referral') {
    score += 10
    breakdown.push({ factor: 'Referral lead', points: 10, icon: 'Users' })
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score))

  return { score, breakdown }
}

// Update lead score in database
export async function updateLeadScore(leadId: string): Promise<{ lead: Lead | null; error: string | null }> {
  try {
    const { score, breakdown } = await calculateIntentScore(leadId)

    const { data, error } = await supabase
      .from('leads')
      .update({
        intent_score: score,
        score_breakdown: breakdown,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .select()
      .single()

    if (error) {
      return { lead: null, error: error.message }
    }

    return { lead: data, error: null }
  } catch (err) {
    console.error('Error updating lead score:', err)
    return { lead: null, error: 'Failed to update lead score' }
  }
}

