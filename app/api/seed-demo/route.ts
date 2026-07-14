/**
 * POST /api/seed-demo
 * Seeds realistic demo data into Supabase for the co-founder demo.
 * Safe to call multiple times — clears and re-seeds each time.
 *
 * Usage: curl -s -X POST http://localhost:3000/api/seed-demo | jq
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAdminSecret } from '@/lib/admin-guard'

export const runtime = 'nodejs'

const DEMO_USER = '00000000-0000-0000-0000-000000000001'

const now   = () => new Date().toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const future  = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0]

// ─── Seed data ─────────────────────────────────────────────────────────────
const AGENTS = [
  { name: 'Rahul Sharma',  email: 'rahul@vyapulse.in',  phone: '9876543201', role: 'senior_agent', specialty_cities: ['Mumbai', 'Pune'],       specialty_types: ['3BHK', 'Villa'],  monthly_target: 8  },
  { name: 'Priya Patel',   email: 'priya@vyapulse.in',  phone: '9876543202', role: 'agent',        specialty_cities: ['Bangalore'],             specialty_types: ['2BHK', '3BHK'],   monthly_target: 5  },
  { name: 'Ankit Verma',   email: 'ankit@vyapulse.in',  phone: '9876543203', role: 'agent',        specialty_cities: ['Pune', 'Hyderabad'],     specialty_types: ['1BHK', '2BHK'],   monthly_target: 5  },
  { name: 'Neha Gupta',    email: 'neha@vyapulse.in',   phone: '9876543204', role: 'agent',        specialty_cities: ['Hyderabad', 'Chennai'],  specialty_types: ['Plot', 'Villa'],   monthly_target: 4  },
  { name: 'Vikram Singh',  email: 'vikram@vyapulse.in', phone: '9876543205', role: 'manager',      specialty_cities: ['Delhi', 'Gurgaon'],      specialty_types: ['4BHK+', 'Villa'], monthly_target: 10 },
]

const DEALS = [
  // New
  { lead_name: 'Arjun Mehta',      lead_phone: '9811001001', property_type: '3BHK', locality: 'Bandra',        city: 'Mumbai',    deal_value: 28000000, stage: 'new',         assigned_to: 'Rahul Sharma', source_portal: 'MagicBricks', expected_close: future(30), created_at: daysAgo(2) },
  { lead_name: 'Sunita Rao',       lead_phone: '9811001002', property_type: '2BHK', locality: 'Whitefield',    city: 'Bangalore', deal_value: 8500000,  stage: 'new',         assigned_to: 'Priya Patel',  source_portal: '99acres',     expected_close: future(25), created_at: daysAgo(1) },
  { lead_name: 'Karan Malhotra',   lead_phone: '9811001003', property_type: '1BHK', locality: 'Dwarka',        city: 'Delhi',     deal_value: 5500000,  stage: 'new',         assigned_to: 'Vikram Singh', source_portal: 'Facebook Ads', expected_close: future(45), created_at: daysAgo(3) },

  // Site Visit
  { lead_name: 'Deepa Nair',       lead_phone: '9811001004', property_type: '3BHK', locality: 'Koregaon Park', city: 'Pune',      deal_value: 15000000, stage: 'site_visit',  assigned_to: 'Ankit Verma',  source_portal: 'Housing.com', expected_close: future(20), created_at: daysAgo(7)  },
  { lead_name: 'Rohan Joshi',      lead_phone: '9811001005', property_type: 'Villa', locality: 'Jubilee Hills', city: 'Hyderabad', deal_value: 45000000, stage: 'site_visit',  assigned_to: 'Neha Gupta',   source_portal: 'Referral',    expected_close: future(15), created_at: daysAgo(5)  },
  { lead_name: 'Meera Krishnan',   lead_phone: '9811001006', property_type: '2BHK', locality: 'Marathahalli',  city: 'Bangalore', deal_value: 7200000,  stage: 'site_visit',  assigned_to: 'Priya Patel',  source_portal: '99acres',     expected_close: future(18), created_at: daysAgo(4)  },
  { lead_name: 'Aditya Kapoor',    lead_phone: '9811001007', property_type: '4BHK+',locality: 'DLF Phase 1',   city: 'Gurgaon',   deal_value: 32000000, stage: 'site_visit',  assigned_to: 'Vikram Singh', source_portal: 'MagicBricks', expected_close: future(22), created_at: daysAgo(6)  },

  // Negotiation
  { lead_name: 'Shweta Sharma',    lead_phone: '9811001008', property_type: '3BHK', locality: 'Andheri West',  city: 'Mumbai',    deal_value: 22000000, stage: 'negotiation', assigned_to: 'Rahul Sharma', source_portal: 'MagicBricks', expected_close: future(10), created_at: daysAgo(14) },
  { lead_name: 'Nikhil Desai',     lead_phone: '9811001009', property_type: '2BHK', locality: 'HSR Layout',    city: 'Bangalore', deal_value: 9800000,  stage: 'negotiation', assigned_to: 'Priya Patel',  source_portal: 'Housing.com', expected_close: future(8),  created_at: daysAgo(10) },
  { lead_name: 'Ritu Agarwal',     lead_phone: '9811001010', property_type: 'Plot', locality: 'ORR',           city: 'Hyderabad', deal_value: 12000000, stage: 'negotiation', assigned_to: 'Neha Gupta',   source_portal: '99acres',     expected_close: future(7),  created_at: daysAgo(12) },
  { lead_name: 'Sanjay Bhatia',    lead_phone: '9811001011', property_type: '3BHK', locality: 'Viman Nagar',   city: 'Pune',      deal_value: 13500000, stage: 'negotiation', assigned_to: 'Ankit Verma',  source_portal: 'Referral',    expected_close: future(9),  created_at: daysAgo(8)  },
  { lead_name: 'Pooja Iyer',       lead_phone: '9811001012', property_type: 'Villa', locality: 'Juhu',         city: 'Mumbai',    deal_value: 72000000, stage: 'negotiation', assigned_to: 'Rahul Sharma', source_portal: 'Referral',    expected_close: future(12), created_at: daysAgo(9)  },

  // Token Paid
  { lead_name: 'Amit Trivedi',     lead_phone: '9811001013', property_type: '3BHK', locality: 'Powai',         city: 'Mumbai',    deal_value: 19500000, stage: 'token_paid',  assigned_to: 'Rahul Sharma', source_portal: 'MagicBricks', expected_close: future(5),  created_at: daysAgo(20) },
  { lead_name: 'Kavita Reddy',     lead_phone: '9811001014', property_type: '2BHK', locality: 'Gachibowli',    city: 'Hyderabad', deal_value: 7800000,  stage: 'token_paid',  assigned_to: 'Neha Gupta',   source_portal: 'Housing.com', expected_close: future(4),  created_at: daysAgo(18) },
  { lead_name: 'Manoj Pillai',     lead_phone: '9811001015', property_type: '4BHK+',locality: 'Indiranagar',   city: 'Bangalore', deal_value: 25000000, stage: 'token_paid',  assigned_to: 'Priya Patel',  source_portal: 'Referral',    expected_close: future(3),  created_at: daysAgo(22) },

  // Won
  { lead_name: 'Divya Menon',      lead_phone: '9811001016', property_type: '3BHK', locality: 'Bandra',        city: 'Mumbai',    deal_value: 31000000, stage: 'won',         assigned_to: 'Rahul Sharma', source_portal: 'MagicBricks', created_at: daysAgo(30) },
  { lead_name: 'Rajan Nair',       lead_phone: '9811001017', property_type: '2BHK', locality: 'Electronic City',city: 'Bangalore',deal_value: 6500000,  stage: 'won',         assigned_to: 'Priya Patel',  source_portal: '99acres',     created_at: daysAgo(25) },
  { lead_name: 'Anjali Singh',     lead_phone: '9811001018', property_type: 'Villa', locality: 'Aamby Valley',  city: 'Pune',     deal_value: 55000000, stage: 'won',         assigned_to: 'Ankit Verma',  source_portal: 'Referral',    created_at: daysAgo(28) },
  { lead_name: 'Suresh Kumar',     lead_phone: '9811001019', property_type: '1BHK', locality: 'Dwarka',        city: 'Delhi',     deal_value: 4800000,  stage: 'won',         assigned_to: 'Vikram Singh', source_portal: 'Facebook Ads', created_at: daysAgo(35) },
  { lead_name: 'Lavanya Prasad',   lead_phone: '9811001020', property_type: 'Plot', locality: 'Shadnagar',     city: 'Hyderabad', deal_value: 9000000,  stage: 'won',         assigned_to: 'Neha Gupta',   source_portal: 'Housing.com', created_at: daysAgo(40) },
  { lead_name: 'Abhishek Tiwari',  lead_phone: '9811001021', property_type: '3BHK', locality: 'Worli',         city: 'Mumbai',    deal_value: 42000000, stage: 'won',         assigned_to: 'Rahul Sharma', source_portal: 'Referral',    created_at: daysAgo(45) },
  { lead_name: 'Sneha Kulkarni',   lead_phone: '9811001022', property_type: '2BHK', locality: 'Wakad',         city: 'Pune',      deal_value: 8200000,  stage: 'won',         assigned_to: 'Ankit Verma',  source_portal: '99acres',     created_at: daysAgo(50) },

  // Lost
  { lead_name: 'Vijay Pandey',     lead_phone: '9811001023', property_type: '3BHK', locality: 'Kurla',         city: 'Mumbai',    deal_value: 16000000, stage: 'lost', lost_reason: 'Budget mismatch', assigned_to: 'Rahul Sharma', source_portal: 'MagicBricks', created_at: daysAgo(32) },
  { lead_name: 'Sundar Iyengar',   lead_phone: '9811001024', property_type: '2BHK', locality: 'BTM Layout',    city: 'Bangalore', deal_value: 6800000,  stage: 'lost', lost_reason: 'Competitor',      assigned_to: 'Priya Patel',  source_portal: '99acres',     created_at: daysAgo(38) },
  { lead_name: 'Rashmi Sharma',    lead_phone: '9811001025', property_type: '1BHK', locality: 'Goregaon',      city: 'Mumbai',    deal_value: 7500000,  stage: 'lost', lost_reason: 'Not serious',     assigned_to: 'Rahul Sharma', source_portal: 'Facebook Ads', created_at: daysAgo(42) },
]

// portal_leads columns: source_portal, ingestion_status, raw_payload, contact_name, contact_phone (no city column)
const PORTAL_LEADS = [
  ...Array.from({ length: 18 }, (_, i) => ({ source_portal: 'MagicBricks',  ingestion_status: i < 15 ? 'created' : i < 17 ? 'duplicate' : 'failed', contact_name: `Lead ${i+1}`,  contact_phone: `98100${String(i+1).padStart(5,'0')}`, raw_payload: {}, created_at: daysAgo(i * 3 + 1) })),
  ...Array.from({ length: 16 }, (_, i) => ({ source_portal: '99acres',      ingestion_status: i < 13 ? 'created' : i < 15 ? 'duplicate' : 'failed', contact_name: `Lead ${i+20}`, contact_phone: `98200${String(i+1).padStart(5,'0')}`, raw_payload: {}, created_at: daysAgo(i * 3 + 2) })),
  ...Array.from({ length: 12 }, (_, i) => ({ source_portal: 'Housing.com',  ingestion_status: i < 10 ? 'created' : 'duplicate',                      contact_name: `Lead ${i+40}`, contact_phone: `98300${String(i+1).padStart(5,'0')}`, raw_payload: {}, created_at: daysAgo(i * 4 + 1) })),
  ...Array.from({ length: 10 }, (_, i) => ({ source_portal: 'Facebook Ads', ingestion_status: i < 8  ? 'created' : 'duplicate',                      contact_name: `Lead ${i+55}`, contact_phone: `98400${String(i+1).padStart(5,'0')}`, raw_payload: {}, created_at: daysAgo(i * 5 + 1) })),
  ...Array.from({ length: 8  }, (_, i) => ({ source_portal: 'Referral',     ingestion_status: 'created',                                              contact_name: `Lead ${i+65}`, contact_phone: `98500${String(i+1).padStart(5,'0')}`, raw_payload: {}, created_at: daysAgo(i * 6 + 1) })),
]

export async function POST(req: NextRequest) {
  const guard = requireAdminSecret(req)
  if (guard) return guard

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Supabase service key not configured' }, { status: 503 })

  const results: Record<string, unknown> = {}

  // Clear existing demo data
  await sb.from('deals').delete().eq('user_id', DEMO_USER)
  await sb.from('team_members').delete().eq('manager_id', DEMO_USER)
  await sb.from('routing_rules').delete().eq('user_id', DEMO_USER)
  results.cleared = true

  // 1. Seed team members
  const { data: teamData, error: teamErr } = await sb.from('team_members')
    .insert(AGENTS.map(a => ({ ...a, manager_id: DEMO_USER })))
    .select('id, name')
  if (teamErr) return NextResponse.json({ error: teamErr.message, step: 'team' }, { status: 500 })
  results.team = teamData?.length ?? 0

  // 2. Build agent name → id map for routing rules
  const agentMap: Record<string, string> = {}
  for (const a of teamData ?? []) agentMap[a.name] = a.id

  // 3. Seed routing rules
  const routingRules = [
    { user_id: DEMO_USER, priority: 1, rule_type: 'city',          match_value: 'Mumbai',     agent_id: agentMap['Rahul Sharma'],  is_active: true },
    { user_id: DEMO_USER, priority: 2, rule_type: 'city',          match_value: 'Bangalore',  agent_id: agentMap['Priya Patel'],   is_active: true },
    { user_id: DEMO_USER, priority: 3, rule_type: 'city',          match_value: 'Pune',       agent_id: agentMap['Ankit Verma'],   is_active: true },
    { user_id: DEMO_USER, priority: 4, rule_type: 'portal',        match_value: 'Facebook Ads', agent_id: agentMap['Vikram Singh'], is_active: true },
    { user_id: DEMO_USER, priority: 9, rule_type: 'round_robin',   match_value: null,         agent_id: agentMap['Neha Gupta'],    is_active: true },
  ]
  const { error: rrErr } = await sb.from('routing_rules').insert(routingRules)
  if (rrErr) results.routingError = rrErr.message
  else results.routingRules = routingRules.length

  // 4. Seed deals
  const deals = DEALS.map(d => ({
    ...d,
    user_id: DEMO_USER,
    expected_close: d.expected_close ?? null,
    created_at:     d.created_at ?? now(),
    updated_at:     now(),
  }))
  const { error: dealErr } = await sb.from('deals').insert(deals)
  if (dealErr) return NextResponse.json({ error: dealErr.message, step: 'deals' }, { status: 500 })
  results.deals = deals.length

  // 5. Seed portal leads (no user_id column on this table)
  // Insert in batches of 20
  let leadsInserted = 0
  for (let i = 0; i < PORTAL_LEADS.length; i += 20) {
    const batch = PORTAL_LEADS.slice(i, i + 20)
    const { error } = await sb.from('portal_leads').insert(batch)
    if (error) { results.portalLeadsError = error.message; break }
    leadsInserted += batch.length
  }
  results.portalLeads = leadsInserted

  return NextResponse.json({
    ok: true,
    message: '✅ Demo data seeded successfully',
    ...results,
  })
}
