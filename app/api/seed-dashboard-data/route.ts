import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminSecret } from '@/lib/admin-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  const guard = requireAdminSecret(request)
  if (guard) return guard

  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ============================================
    // SAMPLE LEADS - Diverse for all insights
    // ============================================
    const sampleLeads = [
      // HOT LEADS (score 70+) - For "Hot Property Type" insight
      {
        agent_id: userId,
        name: 'Rajesh Mehta',
        email: 'rajesh.mehta@email.com',
        phone: '+919876543210',
        source: 'Website',
        property_type: '3BHK Apartment',
        locations: ['Bandra West', 'Andheri West'],
        budget_min: 15000000,
        budget_max: 25000000,
        timeline: 'Immediate',
        intent_score: 85,
        status: 'active',
        first_contact_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        agent_id: userId,
        name: 'Priya Sharma',
        email: 'priya.sharma@email.com',
        phone: '+919876543211',
        source: 'Referral',
        property_type: '3BHK Apartment',
        locations: ['Powai', 'Bandra East'],
        budget_min: 20000000,
        budget_max: 35000000,
        timeline: '1-3 months',
        intent_score: 78,
        status: 'active',
        first_contact_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        agent_id: userId,
        name: 'Amit Patel',
        email: 'amit.patel@email.com',
        phone: '+919876543212',
        source: 'MagicBricks',
        property_type: '3BHK Apartment',
        locations: ['Worli', 'Lower Parel'],
        budget_min: 30000000,
        budget_max: 50000000,
        timeline: 'Immediate',
        intent_score: 92,
        status: 'active',
        first_contact_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_date: new Date().toISOString(),
      },
      {
        agent_id: userId,
        name: 'Sunita Reddy',
        email: 'sunita.reddy@email.com',
        phone: '+919876543213',
        source: '99acres',
        property_type: 'Villa',
        locations: ['Lonavala', 'Khandala'],
        budget_min: 50000000,
        budget_max: 100000000,
        timeline: '3-6 months',
        intent_score: 75,
        status: 'active',
        first_contact_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      // WARM LEADS (score 40-69) - For "Going Cold" insight
      {
        agent_id: userId,
        name: 'Vikram Singh',
        email: 'vikram.singh@email.com',
        phone: '+919876543214',
        source: 'Housing.com',
        property_type: '2BHK Apartment',
        locations: ['Thane', 'Mulund'],
        budget_min: 8000000,
        budget_max: 12000000,
        timeline: '6+ months',
        intent_score: 55,
        status: 'active',
        first_contact_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // Going cold!
      },
      {
        agent_id: userId,
        name: 'Neha Gupta',
        email: 'neha.gupta@email.com',
        phone: '+919876543215',
        source: 'Facebook',
        property_type: '2BHK Apartment',
        locations: ['Goregaon', 'Malad'],
        budget_min: 10000000,
        budget_max: 15000000,
        timeline: '3-6 months',
        intent_score: 48,
        status: 'active',
        first_contact_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // Going cold!
      },
      {
        agent_id: userId,
        name: 'Rahul Joshi',
        email: 'rahul.joshi@email.com',
        phone: '+919876543216',
        source: 'Walk-in',
        property_type: '1BHK Apartment',
        locations: ['Navi Mumbai', 'Vashi'],
        budget_min: 5000000,
        budget_max: 8000000,
        timeline: '1-3 months',
        intent_score: 62,
        status: 'active',
        first_contact_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), // Going cold!
      },
      // NEW LEADS (today) - For "New Leads" insight
      {
        agent_id: userId,
        name: 'Kavita Desai',
        email: 'kavita.desai@email.com',
        phone: '+919876543217',
        source: 'Instagram',
        property_type: 'Studio',
        locations: ['Bandra West'],
        budget_min: 8000000,
        budget_max: 12000000,
        timeline: 'Immediate',
        intent_score: 45,
        status: 'new',
        first_contact_date: new Date().toISOString(),
        last_activity_date: new Date().toISOString(),
      },
      {
        agent_id: userId,
        name: 'Arun Kumar',
        email: 'arun.kumar@email.com',
        phone: '+919876543218',
        source: 'Website',
        property_type: '3BHK Apartment',
        locations: ['Andheri East', 'Powai'],
        budget_min: 18000000,
        budget_max: 28000000,
        timeline: '1-3 months',
        intent_score: 40,
        status: 'new',
        first_contact_date: new Date().toISOString(),
        last_activity_date: new Date().toISOString(),
      },
      // COLD LEAD - For variety
      {
        agent_id: userId,
        name: 'Meera Nair',
        email: 'meera.nair@email.com',
        phone: '+919876543219',
        source: 'Referral',
        property_type: 'Penthouse',
        locations: ['Juhu', 'Versova'],
        budget_min: 80000000,
        budget_max: 150000000,
        timeline: '6+ months',
        intent_score: 30,
        status: 'active',
        first_contact_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    // Insert leads
    const { data: insertedLeads, error: leadsError } = await supabase
      .from('leads')
      .insert(sampleLeads)
      .select()

    if (leadsError) {
      console.error('Error inserting leads:', leadsError)
      return NextResponse.json({ error: leadsError.message }, { status: 500 })
    }

    // ============================================
    // SAMPLE ACTIVITIES - Diverse for all insights
    // ============================================
    const leadIds = insertedLeads.map(l => l.id)
    
    const now = new Date()
    const sampleActivities = [
      // Activities for Rajesh Mehta (Hot Lead) - EMI questions, quick response
      {
        lead_id: leadIds[0],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'Interested',
          response_time: 'Within 1 hour',
          notes: 'Very interested in 3BHK near metro station',
          questions_asked: ['What is the EMI for 20 year loan?', 'Is there any payment plan available?']
        },
        created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000).toISOString(), // Yesterday evening (6 PM)
      },
      {
        lead_id: leadIds[0],
        agent_id: userId,
        activity_type: 'site_visit',
        activity_data: {
          outcome: 'Very interested',
          notes: 'Loved the property, discussing with family',
        },
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        lead_id: leadIds[0],
        agent_id: userId,
        activity_type: 'whatsapp',
        activity_data: {
          outcome: 'Interested',
          notes: 'Sent EMI calculator',
        },
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000).toISOString(), // Evening
      },

      // Activities for Priya Sharma (Hot Lead) - Site visit, positive
      {
        lead_id: leadIds[1],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'Interested',
          response_time: 'Within 2 hours',
          notes: 'Asked about loan options and payment structure',
          questions_asked: ['Can you share the payment schedule?']
        },
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 18.5 * 60 * 60 * 1000).toISOString(), // Evening
      },
      {
        lead_id: leadIds[1],
        agent_id: userId,
        activity_type: 'site_visit',
        activity_data: {
          outcome: 'Very interested',
          notes: 'Visited with spouse, very positive',
        },
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        lead_id: leadIds[1],
        agent_id: userId,
        activity_type: 'property_viewed',
        activity_data: {
          notes: 'Viewed 3BHK in Powai online',
        },
        created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },

      // Activities for Amit Patel (Hottest Lead) - Multiple views, quick response
      {
        lead_id: leadIds[2],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'Very interested',
          response_time: 'Within 1 hour',
          notes: 'Ready to proceed, discussing EMI options',
          questions_asked: ['What is the down payment?', 'EMI calculation for 15 years?']
        },
        created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000).toISOString(), // Evening today
      },
      {
        lead_id: leadIds[2],
        agent_id: userId,
        activity_type: 'site_visit',
        activity_data: {
          outcome: 'Very interested',
          notes: 'Third visit with parents, finalizing',
        },
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        lead_id: leadIds[2],
        agent_id: userId,
        activity_type: 'property_viewed',
        activity_data: {
          notes: 'Viewed Worli property online 5 times',
        },
        created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        lead_id: leadIds[2],
        agent_id: userId,
        activity_type: 'property_viewed',
        activity_data: {
          notes: 'Compared with Lower Parel options',
        },
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        lead_id: leadIds[2],
        agent_id: userId,
        activity_type: 'property_viewed',
        activity_data: {
          notes: 'Rechecked floor plans',
        },
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },

      // Activities for Sunita Reddy (Villa buyer) - Site visit
      {
        lead_id: leadIds[3],
        agent_id: userId,
        activity_type: 'site_visit',
        activity_data: {
          outcome: 'Interested',
          notes: 'Visited villa in Lonavala, likes the view',
        },
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        lead_id: leadIds[3],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'Interested',
          response_time: 'Within 2 hours',
          notes: 'Discussing payment options for villa',
        },
        created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000).toISOString(), // Afternoon
      },

      // Activities for Vikram Singh (Going cold) - Old activity
      {
        lead_id: leadIds[4],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'Callback requested',
          notes: 'Was busy, asked to call back next week',
        },
        created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago - going cold!
      },
      {
        lead_id: leadIds[4],
        agent_id: userId,
        activity_type: 'whatsapp',
        activity_data: {
          outcome: 'No response',
          notes: 'Sent property details, no reply',
        },
        created_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      },

      // Activities for Neha Gupta (Going cold)
      {
        lead_id: leadIds[5],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'No answer',
          notes: 'Tried calling twice',
        },
        created_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(), // Going cold!
      },

      // Activities for Rahul Joshi (Going cold)
      {
        lead_id: leadIds[6],
        agent_id: userId,
        activity_type: 'email',
        activity_data: {
          outcome: 'Sent',
          notes: 'Sent comparative pricing',
        },
        created_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString(), // Going cold!
      },

      // Activities with different outcomes for testing
      {
        lead_id: leadIds[0],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'Interested',
          response_time: 'Within 1 hour',
          notes: 'Follow up on EMI discussion',
        },
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 19.5 * 60 * 60 * 1000).toISOString(), // Evening
      },

      // Some negative outcomes for color testing
      {
        lead_id: leadIds[9],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'Not interested',
          notes: 'Budget too high for current options',
        },
        created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      },

      // Morning activity for time comparison
      {
        lead_id: leadIds[1],
        agent_id: userId,
        activity_type: 'call',
        activity_data: {
          outcome: 'No answer',
          notes: 'Called in morning, no response',
        },
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(), // Morning
      },
    ]

    // Insert activities
    const { error: activitiesError } = await supabase
      .from('lead_activities')
      .insert(sampleActivities)

    if (activitiesError) {
      console.error('Error inserting activities:', activitiesError)
      return NextResponse.json({ error: activitiesError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Sample data seeded successfully!',
      data: {
        leadsCreated: insertedLeads.length,
        activitiesCreated: sampleActivities.length,
        insights: {
          '3BHK Trending': '3 hot leads interested in 3BHK',
          'Peak Time': 'Most activities in Evening (5-9 PM)',
          'EMI Pattern': '3 leads asked about EMI/payment',
          'Going Cold': '3 warm leads with 7+ days no activity',
          'Site Visits': '4 leads with site visits',
          'Quick Response': 'Multiple leads with fast responses',
          'New Leads': '2 leads added today',
        }
      }
    })

  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 })
  }
}

