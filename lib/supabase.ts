import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types (we'll expand this later)
export type Profile = {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  role: string
  created_at: string
  updated_at: string
}

export type Lead = {
  id: string
  agent_id: string
  name: string
  email: string | null
  phone: string
  source: string | null
  source_detail: string | null
  property_type: string | null
  locations: string[] | null
  budget_min: number | null
  budget_max: number | null
  timeline: string | null
  intent_score: number
  score_breakdown: any
  status: string
  first_contact_date: string
  last_activity_date: string
  created_at: string
  updated_at: string
}

export type LeadActivity = {
  id: string
  lead_id: string
  agent_id: string
  activity_type: string
  activity_data: any
  created_at: string
}

// Profile insert type for signup
export type ProfileInsert = {
  id: string
  email: string
  full_name?: string | null
  company_name?: string | null
  phone?: string | null
  role?: string
}
