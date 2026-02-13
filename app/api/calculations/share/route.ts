import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use the provided Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhqdhmlelprreniddodp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocWRobWxlbHBycmVuaWRkb2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDUxMDEsImV4cCI6MjA4MDQ4MTEwMX0.y-cOeeuhlbn6t3UW2byLdkjMSugFSUhm3gedTgb6bro'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, leadId, calculatorType, inputData, agentName, agentPhone, companyName } = body

    if (!calculatorType || !inputData) {
      return NextResponse.json(
        { error: 'Calculator type and input data are required' },
        { status: 400 }
      )
    }

    // Insert the shared calculation
    const { data, error } = await supabase
      .from('shared_calculations')
      .insert({
        agent_id: agentId || null,
        lead_id: leadId || null,
        calculator_type: calculatorType,
        input_data: {
          ...inputData,
          agent_name: agentName || 'Real Estate Agent',
          agent_phone: agentPhone || null,
          company_name: companyName || 'RealEstate',
        },
        views_count: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving calculation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Generate the shareable URL
    // Try to get base URL from request headers, fallback to env or localhost
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
    const shareableUrl = `${baseUrl}/calc/${data.id}`

    return NextResponse.json({
      success: true,
      id: data.id,
      url: shareableUrl,
    })
  } catch (error) {
    console.error('Error in share API:', error)
    return NextResponse.json(
      { error: 'Failed to create shareable link' },
      { status: 500 }
    )
  }
}

 