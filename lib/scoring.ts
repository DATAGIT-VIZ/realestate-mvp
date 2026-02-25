export type ScoreBreakdown = {
    budget?: number
    timeline?: number
    location?: number
    contact_info?: number
    source?: number
}

export function calculateLeadScore(lead: any): { score: number; breakdown: ScoreBreakdown } {
    let score = 0
    const breakdown: ScoreBreakdown = {}

    // 1. Contact Info (Base Trust) - Max 30
    if (lead.phone) {
        score += 20
        breakdown.contact_info = (breakdown.contact_info || 0) + 20
    }
    if (lead.email) {
        score += 10
        breakdown.contact_info = (breakdown.contact_info || 0) + 10
    }

    // 2. Budget (Financial Qualification) - Max 25
    if (lead.budget_min && lead.budget_max) {
        score += 25
        breakdown.budget = 25
    } else if (lead.budget_min || lead.budget_max) {
        score += 15
        breakdown.budget = 15
    }

    // 3. Timeline (Urgency) - Max 25
    const timeline = lead.timeline?.toLowerCase() || ''
    if (timeline.includes('immediate') || timeline.includes('urgent')) {
        score += 25
        breakdown.timeline = 25
    } else if (timeline.includes('1 month') || timeline.includes('3 months')) {
        score += 15
        breakdown.timeline = 15
    } else if (timeline.includes('6 months')) {
        score += 5
        breakdown.timeline = 5
    }

    // 4. Source (Intent) - Max 20
    const source = lead.source?.toLowerCase() || ''
    if (source.includes('website') || source.includes('referral')) {
        score += 20
        breakdown.source = 20
    } else if (source.includes('paid') || source.includes('ad')) {
        score += 15
        breakdown.source = 15
    } else {
        score += 5
        breakdown.source = 5
    }

    return {
        score: Math.min(100, score),
        breakdown
    }
}
