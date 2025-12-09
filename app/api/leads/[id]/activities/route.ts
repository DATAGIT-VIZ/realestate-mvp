import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { updateLeadScore } from '@/lib/intentScoring'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET - Fetch all activities for a lead
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: leadId } = await context.params

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the lead belongs to this user
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('agent_id', user.id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Fetch activities
    const { data: activities, error: fetchError } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Log a new activity
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: leadId } = await context.params
    const body = await request.json()

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the lead belongs to this user
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('agent_id', user.id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const { activity_type, activity_date, notes, outcome, response_time, questions_asked, simulate_past } = body

    // Validate required fields
    if (!activity_type || !notes) {
      return NextResponse.json({ error: 'Activity type and notes are required' }, { status: 400 })
    }

    if (notes.length < 10) {
      return NextResponse.json({ error: 'Notes must be at least 10 characters' }, { status: 400 })
    }

    // Calculate created_at (for testing time decay)
    let createdAt = new Date().toISOString()
    if (simulate_past) {
      // Set to 10 days ago for testing time decay penalty
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)
      createdAt = pastDate.toISOString()
    }

    // Prepare activity data
    const activityData = {
      notes,
      outcome,
      response_time,
      questions_asked: questions_asked || [],
      activity_date: activity_date || new Date().toISOString(),
    }

    // Insert activity
    const { data: activity, error: insertError } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        agent_id: user.id,
        activity_type,
        activity_data: activityData,
        created_at: createdAt, // Use simulated date if testing
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Update lead's last_activity_date (use simulated date if testing)
    await supabase
      .from('leads')
      .update({ last_activity_date: createdAt })
      .eq('id', leadId)

    // Recalculate and update the lead's intent score
    const { lead: updatedLead, error: scoreError } = await updateLeadScore(leadId)

    if (scoreError) {
      console.error('Score update error:', scoreError)
    }

    return NextResponse.json({
      activity,
      updatedLead,
      message: 'Activity logged successfully',
    })
  } catch (error) {
    console.error('Error logging activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

