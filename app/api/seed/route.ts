import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const d = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
const h = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

// ─── Leads ────────────────────────────────────────────────────────────────────
const LEADS = [
  // ─── NEW (10) ──────────────────────────────────────────────────────────────
  { name: 'Rohit Malhotra',       phone: '+919867501001', email: 'rohit.m@gmail.com',       source: 'MAGICBRICKS', city: 'Mumbai',    budget_min: 8000000,   budget_max: 12000000,  property_type: '3 BHK',  timeline: 'Within 3 months',  intent_score: 72, status: 'New',          locations: ['Andheri West', 'Bandra'],       client_type: 'Individual',       created_at: h(6)   },
  { name: 'Kavya Krishnan',       phone: '+919867502002', email: 'kavya.k@gmail.com',       source: 'MARKETING',  city: 'Bangalore', budget_min: 6000000,   budget_max: 9000000,   property_type: '2 BHK',  timeline: 'Within 6 months',  intent_score: 65, status: 'New',          locations: ['Whitefield', 'Marathahalli'],   client_type: 'Individual',       created_at: h(10)  },
  { name: 'Suresh Gupta',         phone: '+919867503003', email: 'suresh.g@outlook.com',    source: 'MAGICBRICKS', city: 'Delhi',     budget_min: 15000000,  budget_max: 20000000,  property_type: '3 BHK',  timeline: 'Immediate',        intent_score: 78, status: 'New',          locations: ['Dwarka', 'Vasant Kunj'],        client_type: 'Individual',       created_at: h(14)  },
  { name: 'Nandita Sharma',       phone: '+919867504004', email: 'nandita.s@gmail.com',     source: 'HOUSING_COM', city: 'Pune',      budget_min: 5000000,   budget_max: 7500000,   property_type: '2 BHK',  timeline: 'Within 6 months',  intent_score: 58, status: 'New',          locations: ['Baner', 'Wakad'],               client_type: null,               created_at: h(18)  },
  { name: 'Vishal Nair',          phone: '+919867505005', email: null,                      source: 'FACEBOOK',    city: 'Hyderabad', budget_min: 7000000,   budget_max: 10000000,  property_type: '3 BHK',  timeline: 'Within 3 months',  intent_score: 63, status: 'New',          locations: ['Gachibowli', 'Kondapur'],       client_type: null,               created_at: h(22)  },
  { name: 'Pooja Agrawal',        phone: '+919867506006', email: 'pooja.ag@gmail.com',      source: 'CHANNEL_PARTNER',  city: 'Mumbai',    budget_min: 20000000,  budget_max: 30000000,  property_type: '4 BHK',  timeline: 'Within 3 months',  intent_score: 80, status: 'New',          locations: ['Worli', 'Lower Parel'],         client_type: 'Channel Partner',  created_at: h(26)  },
  { name: 'Rajan Pillai',         phone: '+919867507007', email: 'rajan.p@gmail.com',       source: 'MAGICBRICKS', city: 'Chennai',   budget_min: 30000000,  budget_max: 50000000,  property_type: 'Villa',  timeline: 'Within 6 months',  intent_score: 85, status: 'New',          locations: ['ECR', 'Sholinganallur'],        client_type: 'Individual',       created_at: h(30)  },
  { name: 'Neha Joshi',           phone: '+919867508008', email: 'neha.j@gmail.com',        source: 'HOUSING_COM', city: 'Pune',      budget_min: 4500000,   budget_max: 6500000,   property_type: '2 BHK',  timeline: 'Within 6 months',  intent_score: 55, status: 'New',          locations: ['Kothrud', 'Karve Nagar'],       client_type: null,               created_at: d(1)   },
  { name: 'Sameer Khan',          phone: '+919867509009', email: 'sameer.k@gmail.com',      source: 'OPT99ACRES',  city: 'Mumbai',    budget_min: 10000000,  budget_max: 15000000,  property_type: '3 BHK',  timeline: 'Immediate',        intent_score: 70, status: 'New',          locations: ['Goregaon', 'Malad'],            client_type: 'Individual',       created_at: d(1)   },
  { name: 'Deepa Venkatesh',      phone: '+919867510010', email: null,                      source: 'FACEBOOK',    city: 'Bangalore', budget_min: 8000000,   budget_max: 12000000,  property_type: '3 BHK',  timeline: 'Within 6 months',  intent_score: 62, status: 'New',          locations: ['JP Nagar', 'Banashankari'],     client_type: null,               created_at: d(2)   },

  // ─── COLD (8) ──────────────────────────────────────────────────────────────
  { name: 'Aryan Malhotra',       phone: '+919867511011', email: 'aryan.m@gmail.com',       source: 'MAGICBRICKS', city: 'Mumbai',    budget_min: 15000000,  budget_max: 20000000,  property_type: '3 BHK',  timeline: 'Within 3 months',  intent_score: 68, status: 'Cold',         locations: ['Powai', 'Chandivali'],          client_type: 'Individual',       created_at: d(5)   },
  { name: 'Preethi Subramaniam',  phone: '+919867512012', email: 'preethi.s@gmail.com',     source: 'OPT99ACRES',  city: 'Chennai',   budget_min: 6000000,   budget_max: 9000000,   property_type: '2 BHK',  timeline: 'Within 6 months',  intent_score: 55, status: 'Cold',         locations: ['Velachery', 'Perungudi'],       client_type: null,               created_at: d(6)   },
  { name: 'Rahul Deshmukh',       phone: '+919867513013', email: 'rahul.d@gmail.com',       source: 'CHANNEL_PARTNER', city: 'Pune',      budget_min: 9000000,   budget_max: 13000000,  property_type: '3 BHK',  timeline: 'Within 3 months',  intent_score: 60, status: 'Cold',         locations: ['Hinjewadi', 'Wakad'],           client_type: 'Channel Partner',  created_at: d(7)   },
  { name: 'Sonia Kapoor',         phone: '+919867514014', email: 'sonia.k@gmail.com',       source: 'MAGICBRICKS', city: 'Delhi',     budget_min: 25000000,  budget_max: 35000000,  property_type: '4 BHK',  timeline: 'Within 3 months',  intent_score: 72, status: 'Cold',         locations: ['Golf Links', 'Jor Bagh'],       client_type: 'Individual',       created_at: d(8)   },
  { name: 'Ajay Reddy',           phone: '+919867515015', email: null,                      source: 'OPT99ACRES',  city: 'Hyderabad', budget_min: 5500000,   budget_max: 8000000,   property_type: '2 BHK',  timeline: 'Within 6 months',  intent_score: 50, status: 'Cold',         locations: ['Miyapur', 'Bachupally'],        client_type: null,               created_at: d(9)   },
  { name: 'Lakshmi Menon',        phone: '+919867516016', email: 'lakshmi.m@gmail.com',     source: 'FACEBOOK',    city: 'Bangalore', budget_min: 7500000,   budget_max: 11000000,  property_type: '3 BHK',  timeline: 'Within 6 months',  intent_score: 64, status: 'Cold',         locations: ['Hebbal', 'Yelahanka'],          client_type: null,               created_at: d(10)  },
  { name: 'Nikhil Verma',         phone: '+919867517017', email: 'nikhil.v@gmail.com',      source: 'GOOGLE',      city: 'Mumbai',    budget_min: 12000000,  budget_max: 18000000,  property_type: '3 BHK',  timeline: 'Within 3 months',  intent_score: 69, status: 'Cold',         locations: ['Thane', 'Mulund'],              client_type: 'Individual',       created_at: d(11)  },
  { name: 'Asha Patel',           phone: '+919867518018', email: 'asha.p@gmail.com',        source: 'MARKETING', city: 'Pune',      budget_min: 4000000,   budget_max: 6000000,   property_type: '2 BHK',  timeline: 'Within 6 months',  intent_score: 45, status: 'Cold',         locations: ['Hadapsar', 'Kharadi'],          client_type: null,               created_at: d(12)  },

  // ─── WARM (7) ──────────────────────────────────────────────────────────────
  { name: 'Rohini Krishnamurthy', phone: '+919867519019', email: 'rohini.k@gmail.com',      source: 'OPT99ACRES',  city: 'Bangalore', budget_min: 18000000,  budget_max: 25000000,  property_type: '4 BHK',  timeline: 'Within 3 months',  intent_score: 82, status: 'Warm',         locations: ['Indiranagar', 'Koramangala'],   client_type: 'Individual',       created_at: d(15)  },
  { name: 'Sanjay Mehta',         phone: '+919867520020', email: 'sanjay.m@gmail.com',      source: 'MAGICBRICKS', city: 'Mumbai',    budget_min: 12000000,  budget_max: 18000000,  property_type: '3 BHK',  timeline: 'Immediate',        intent_score: 78, status: 'Warm',         locations: ['Bandra West', 'Santacruz'],     client_type: 'Individual',       created_at: d(16)  },
  { name: 'Priyanka Singh',       phone: '+919867521021', email: 'priyanka.s@gmail.com',    source: 'HOUSING_COM', city: 'Delhi',     budget_min: 9000000,   budget_max: 13000000,  property_type: '3 BHK',  timeline: 'Within 3 months',  intent_score: 75, status: 'Warm',         locations: ['Noida Sector 50', 'Greater Noida'], client_type: null,          created_at: d(18)  },
  { name: 'Kiran Kumar',          phone: '+919867522022', email: 'kiran.k@gmail.com',       source: 'OPT99ACRES',  city: 'Hyderabad', budget_min: 15000000,  budget_max: 20000000,  property_type: '4 BHK',  timeline: 'Within 3 months',  intent_score: 80, status: 'Warm',         locations: ['Jubilee Hills', 'Banjara Hills'], client_type: 'Individual',     created_at: d(19)  },
  { name: 'Ananya Roy',           phone: '+919867523023', email: 'ananya.r@gmail.com',      source: 'MAGICBRICKS', city: 'Bangalore', budget_min: 6000000,   budget_max: 9000000,   property_type: '3 BHK',  timeline: 'Within 3 months',  intent_score: 73, status: 'Warm',         locations: ['Sarjapur Road', 'Electronic City'], client_type: null,         created_at: d(20)  },
  { name: 'Manoj Iyer',           phone: '+919867524024', email: 'manoj.i@gmail.com',       source: 'CHANNEL_PARTNER',  city: 'Mumbai',    budget_min: 25000000,  budget_max: 40000000,  property_type: 'Villa',  timeline: 'Within 3 months',  intent_score: 85, status: 'Warm',         locations: ['Alibaug', 'Lonavala'],          client_type: 'Channel Partner',  created_at: d(22)  },
  { name: 'Sunita Ramesh',        phone: '+919867525025', email: 'sunita.r@gmail.com',      source: 'MARKETING', city: 'Pune',      budget_min: 5500000,   budget_max: 8000000,   property_type: '2 BHK',  timeline: 'Within 3 months',  intent_score: 70, status: 'Warm',         locations: ['Aundh', 'Pimple Saudagar'],     client_type: null,               created_at: d(23)  },

  // ─── HOT (6) ───────────────────────────────────────────────────────────────
  { name: 'Vikram Bhatia',        phone: '+919867526026', email: 'vikram.b@gmail.com',      source: 'MAGICBRICKS', city: 'Mumbai',    budget_min: 30000000,  budget_max: 50000000,  property_type: '4 BHK',  timeline: 'Immediate',        intent_score: 92, status: 'Hot',          locations: ['Malabar Hill', 'Cuffe Parade'],  client_type: 'Individual',       created_at: d(25)  },
  { name: 'Gayatri Naidu',        phone: '+919867527027', email: 'gayatri.n@gmail.com',     source: 'OPT99ACRES',  city: 'Hyderabad', budget_min: 10000000,  budget_max: 15000000,  property_type: '3 BHK',  timeline: 'Immediate',        intent_score: 88, status: 'Hot',          locations: ['Madhapur', 'HITEC City'],       client_type: 'Individual',       created_at: d(26)  },
  { name: 'Rajesh Kumar',         phone: '+919867528028', email: 'rajesh.k@gmail.com',      source: 'MAGICBRICKS', city: 'Bangalore', budget_min: 40000000,  budget_max: 60000000,  property_type: 'Villa',  timeline: 'Immediate',        intent_score: 95, status: 'Hot',          locations: ['Sadashivanagar', 'Rajajinagar'], client_type: 'Individual',      created_at: d(28)  },
  { name: 'Meena Agarwal',        phone: '+919867529029', email: 'meena.a@gmail.com',       source: 'HOUSING_COM', city: 'Delhi',     budget_min: 15000000,  budget_max: 20000000,  property_type: '3 BHK',  timeline: 'Immediate',        intent_score: 90, status: 'Hot',          locations: ['South Extension', 'Lajpat Nagar'], client_type: 'Individual',   created_at: d(29)  },
  { name: 'Sunil Chopra',         phone: '+919867530030', email: 'sunil.c@gmail.com',       source: 'OPT99ACRES',  city: 'Mumbai',    budget_min: 25000000,  budget_max: 35000000,  property_type: '4 BHK',  timeline: 'Immediate',        intent_score: 87, status: 'Hot',          locations: ['Juhu', 'Versova'],              client_type: 'Individual',       created_at: d(30)  },
  { name: 'Tara Krishnan',        phone: '+919867531031', email: 'tara.k@gmail.com',        source: 'CHANNEL_PARTNER', city: 'Bangalore', budget_min: 8000000,   budget_max: 12000000,  property_type: '3 BHK',  timeline: 'Immediate',        intent_score: 83, status: 'Hot',          locations: ['HSR Layout', 'BTM Layout'],     client_type: 'Channel Partner',  created_at: d(32)  },

  // ─── CLOSED (5) ────────────────────────────────────────────────────────────
  { name: 'Aditya Sharma',        phone: '+919867532032', email: 'aditya.s@gmail.com',      source: 'MAGICBRICKS', city: 'Mumbai',    budget_min: 35000000,  budget_max: 50000000,  property_type: '4 BHK',  timeline: 'Immediate',        intent_score: 98, status: 'Closed',       locations: ['Peddar Road', 'Altamount Road'], client_type: 'Individual',      created_at: d(45)  },
  { name: 'Priya Nambiar',        phone: '+919867533033', email: 'priya.n@gmail.com',       source: 'OPT99ACRES',  city: 'Bangalore', budget_min: 12000000,  budget_max: 18000000,  property_type: '3 BHK',  timeline: 'Immediate',        intent_score: 95, status: 'Closed',       locations: ['Koramangala', 'Indiranagar'],   client_type: 'Individual',       created_at: d(50)  },
  { name: 'Harish Reddy',         phone: '+919867534034', email: 'harish.r@gmail.com',      source: 'MAGICBRICKS', city: 'Hyderabad', budget_min: 25000000,  budget_max: 40000000,  property_type: 'Villa',  timeline: 'Immediate',        intent_score: 96, status: 'Closed',       locations: ['Jubilee Hills'],                client_type: 'Individual',       created_at: d(55)  },
  { name: 'Anita Banerjee',       phone: '+919867535035', email: 'anita.b@gmail.com',       source: 'HOUSING_COM', city: 'Pune',      budget_min: 7000000,   budget_max: 10000000,  property_type: '3 BHK',  timeline: 'Within 3 months',  intent_score: 91, status: 'Closed',       locations: ['Viman Nagar', 'Kalyani Nagar'], client_type: null,               created_at: d(60)  },
  { name: 'Deepak Malhotra',      phone: '+919867536036', email: 'deepak.m@gmail.com',      source: 'OPT99ACRES',  city: 'Delhi',     budget_min: 20000000,  budget_max: 30000000,  property_type: '4 BHK',  timeline: 'Immediate',        intent_score: 94, status: 'Closed',       locations: ['Vasant Vihar', 'Shanti Niketan'], client_type: 'Individual',     created_at: d(65)  },

  // ─── DISQUALIFIED (4) ──────────────────────────────────────────────────────
  { name: 'Arun Patel',           phone: '+919867537037', email: null,                      source: 'FACEBOOK',    city: 'Mumbai',    budget_min: 3500000,   budget_max: 5500000,   property_type: '2 BHK',  timeline: null,               intent_score: 30, status: 'Disqualified', locations: ['Mira Road'],                    client_type: null,               created_at: d(13)  },
  { name: 'Ritu Sharma',          phone: '+919867538038', email: 'ritu.s@gmail.com',        source: 'GOOGLE',      city: 'Delhi',     budget_min: null,      budget_max: null,       property_type: '3 BHK',  timeline: null,               intent_score: 25, status: 'Disqualified', locations: [],                               client_type: null,               created_at: d(14)  },
  { name: 'Mohan Ghosh',          phone: '+919867539039', email: null,                      source: 'HOUSING_COM', city: 'Bangalore', budget_min: 4000000,   budget_max: 6000000,   property_type: '2 BHK',  timeline: 'Long-term',        intent_score: 20, status: 'Disqualified', locations: ['Electronic City'],              client_type: null,               created_at: d(15)  },
  { name: 'Swati Jain',           phone: '+919867540040', email: 'swati.j@gmail.com',       source: 'FACEBOOK',    city: 'Pune',      budget_min: 5000000,   budget_max: 7000000,   property_type: '3 BHK',  timeline: null,               intent_score: 22, status: 'Disqualified', locations: ['Kondhwa'],                      client_type: null,               created_at: d(16)  },
]

// ─── Activities (keyed by lead name for post-insert ID lookup) ────────────────
type ActivityRow = { name_key: string; type: string; notes: string | null; outcome: string | null; duration: number | null; next_action_date: string | null; created_at: string }

const ACTIVITIES: ActivityRow[] = [
  // COLD leads
  { name_key: 'Aryan Malhotra',       type: 'Call Made',        notes: 'Reached him — interested in 3BHK, wants options in Powai. Asking for brochure.',                     outcome: 'Positive',    duration: 185, next_action_date: null,  created_at: d(4)  },
  { name_key: 'Aryan Malhotra',       type: 'Call Made',        notes: 'No answer, will try again tomorrow.',                                                                   outcome: 'No Response', duration: 0,   next_action_date: null,  created_at: d(3)  },
  { name_key: 'Aryan Malhotra',       type: 'WhatsApp Sent',    notes: 'Sent project brochure and floor plans over WhatsApp.',                                                  outcome: null,          duration: null, next_action_date: null, created_at: d(2)  },

  { name_key: 'Preethi Subramaniam',  type: 'Call Made',        notes: 'First call — enquired about 2BHK in Velachery. Budget confirmed 60-90L.',                             outcome: 'Positive',    duration: 145, next_action_date: null,  created_at: d(5)  },
  { name_key: 'Preethi Subramaniam',  type: 'Note',             notes: 'Prefers ground or first floor. Husband NRI — decision pending his visit next month.',                  outcome: null,          duration: null, next_action_date: null, created_at: d(4)  },

  { name_key: 'Rahul Deshmukh',       type: 'Call Made',        notes: 'No answer.',                                                                                            outcome: 'No Response', duration: 0,   next_action_date: null,  created_at: d(7)  },
  { name_key: 'Rahul Deshmukh',       type: 'WhatsApp Sent',    notes: 'Hi Rahul, calling from Vya Pulse. Tried reaching you — please share a good time to connect.',         outcome: null,          duration: null, next_action_date: null, created_at: d(6)  },
  { name_key: 'Rahul Deshmukh',       type: 'Call Made',        notes: 'Connected briefly — wants Hinjewadi projects near Infosys gate. Will send options.',                  outcome: 'Neutral',     duration: 60,  next_action_date: null,  created_at: d(5)  },

  { name_key: 'Sonia Kapoor',         type: 'Call Made',        notes: 'Long call — looking for 4BHK in Golf Links/Jor Bagh area. Husband is a senior executive.',            outcome: 'Positive',    duration: 312, next_action_date: null,  created_at: d(7)  },
  { name_key: 'Sonia Kapoor',         type: 'Call Made',        notes: 'Follow-up call. She is busy this week — asked to reconnect after Sunday.',                             outcome: 'Neutral',     duration: 78,  next_action_date: null,  created_at: d(5)  },

  { name_key: 'Ajay Reddy',           type: 'Call Made',        notes: 'Short call. Interested but timeline uncertain — might need 6+ months.',                                outcome: 'Neutral',     duration: 95,  next_action_date: null,  created_at: d(8)  },
  { name_key: 'Ajay Reddy',           type: 'WhatsApp Sent',    notes: 'Sent 3 project options near Miyapur metro station.',                                                   outcome: null,          duration: null, next_action_date: null, created_at: d(7)  },

  { name_key: 'Lakshmi Menon',        type: 'WhatsApp Sent',    notes: 'Initial outreach — shared project video and brochure.',                                                outcome: null,          duration: null, next_action_date: null, created_at: d(9)  },
  { name_key: 'Lakshmi Menon',        type: 'WhatsApp Sent',    notes: 'Follow-up: Any questions about the property? Happy to schedule a call.',                               outcome: null,          duration: null, next_action_date: null, created_at: d(7)  },
  { name_key: 'Lakshmi Menon',        type: 'Call Made',        notes: 'First call — she saw our WhatsApp, interested. Wants 3BHK near Hebbal flyover area.',                 outcome: 'Positive',    duration: 210, next_action_date: null,  created_at: d(6)  },

  { name_key: 'Nikhil Verma',         type: 'Call Made',        notes: 'First call — NRI returning to Mumbai. Looking for 3BHK in Thane for family.',                         outcome: 'Neutral',     duration: 168, next_action_date: null,  created_at: d(10) },
  { name_key: 'Nikhil Verma',         type: 'Email Sent',       notes: 'Sent detailed proposal with 3 project options in Thane and Mulund.',                                  outcome: null,          duration: null, next_action_date: null, created_at: d(9)  },

  { name_key: 'Asha Patel',           type: 'Call Made',        notes: 'No answer.',                                                                                            outcome: 'No Response', duration: 0,   next_action_date: null,  created_at: d(12) },
  { name_key: 'Asha Patel',           type: 'Call Missed',      notes: null,                                                                                                    outcome: null,          duration: null, next_action_date: null, created_at: d(11) },
  { name_key: 'Asha Patel',           type: 'Call Made',        notes: 'Connected — looking for affordable 2BHK in Hadapsar/Kharadi near IT park.',                           outcome: 'Neutral',     duration: 122, next_action_date: null,  created_at: d(10) },

  // WARM leads
  { name_key: 'Rohini Krishnamurthy', type: 'Call Made',        notes: 'First call — family of 4, needs 4BHK in Indiranagar/Koramangala. Very serious buyer.',                outcome: 'Positive',    duration: 285, next_action_date: null,  created_at: d(14) },
  { name_key: 'Rohini Krishnamurthy', type: 'Call Made',        notes: 'Discussed project in detail. Husband joining next call.',                                              outcome: 'Positive',    duration: 198, next_action_date: null,  created_at: d(12) },
  { name_key: 'Rohini Krishnamurthy', type: 'OBM Done',         notes: 'Online briefing meeting completed with husband. Both loved the project. Site visit next.',            outcome: 'Positive',    duration: 2700, next_action_date: null, created_at: d(10) },
  { name_key: 'Rohini Krishnamurthy', type: 'Note',             notes: 'Key requirements: east-facing unit, corner flat preferred, floor 5+.',                                outcome: null,          duration: null, next_action_date: null, created_at: d(9)  },
  { name_key: 'Rohini Krishnamurthy', type: 'Follow Up Set',    notes: 'Site visit scheduled for this weekend.',                                                               outcome: null,          duration: null, next_action_date: d(3),  created_at: d(8)  },

  { name_key: 'Sanjay Mehta',         type: 'Call Made',        notes: 'Spoke at length — upgrading from 2BHK. Budget 1.2-1.8Cr confirmed. Wife co-decision maker.',         outcome: 'Positive',    duration: 340, next_action_date: null,  created_at: d(15) },
  { name_key: 'Sanjay Mehta',         type: 'VM Done',          notes: 'Video meeting done with wife. Both liked project. Requesting site visit now.',                        outcome: 'Positive',    duration: 3600, next_action_date: null, created_at: d(13) },
  { name_key: 'Sanjay Mehta',         type: 'Site Visit Scheduled', notes: 'Site visit booked for Sunday 10am.',                                                              outcome: null,          duration: null, next_action_date: d(5),  created_at: d(11) },

  { name_key: 'Priyanka Singh',       type: 'Call Made',        notes: 'Interested in 3BHK in Noida. Works in Cyber City. Wants 45-min commute max.',                        outcome: 'Positive',    duration: 220, next_action_date: null,  created_at: d(17) },
  { name_key: 'Priyanka Singh',       type: 'Call Made',        notes: 'Discussed possession timeline. Prefers ready-to-move or possession within 1 year.',                  outcome: 'Positive',    duration: 175, next_action_date: null,  created_at: d(15) },
  { name_key: 'Priyanka Singh',       type: 'Site Visit Done',  notes: 'Visited project with husband. They liked the 12th floor units. Discussing internally.',              outcome: 'Positive',    duration: 5400, next_action_date: null, created_at: d(12) },
  { name_key: 'Priyanka Singh',       type: 'Note',             notes: 'Post site-visit feedback: loved the clubhouse and view. Price negotiation expected.',                 outcome: null,          duration: null, next_action_date: null, created_at: d(11) },

  { name_key: 'Kiran Kumar',          type: 'Call Made',        notes: 'Tech exec — clear on budget, wants 4BHK in Jubilee Hills. Premium finishes important.',              outcome: 'Positive',    duration: 265, next_action_date: null,  created_at: d(18) },
  { name_key: 'Kiran Kumar',          type: 'WhatsApp Sent',    notes: 'Sent project deck and floor plans as requested.',                                                      outcome: null,          duration: null, next_action_date: null, created_at: d(17) },
  { name_key: 'Kiran Kumar',          type: 'Call Made',        notes: 'Positive follow-up. Wife also reviewed the plans. OBM scheduled.',                                   outcome: 'Positive',    duration: 198, next_action_date: null,  created_at: d(15) },
  { name_key: 'Kiran Kumar',          type: 'OBM Done',         notes: 'Detailed OBM — wife had 15 specific questions all answered. Very keen to visit.',                    outcome: 'Positive',    duration: 3300, next_action_date: null, created_at: d(12) },

  { name_key: 'Ananya Roy',           type: 'Call Made',        notes: 'First call — moved from Kolkata to Bangalore. Wants 3BHK near Electronic City for work.',            outcome: 'Positive',    duration: 190, next_action_date: null,  created_at: d(19) },
  { name_key: 'Ananya Roy',           type: 'VM Done',          notes: 'Virtual walkthrough of the model apartment done. She loved the layout and amenities.',                outcome: 'Positive',    duration: 2400, next_action_date: null, created_at: d(16) },
  { name_key: 'Ananya Roy',           type: 'Note',             notes: 'Has a budget flexibility of +10L if the unit is on higher floors with good view.',                   outcome: null,          duration: null, next_action_date: null, created_at: d(14) },

  { name_key: 'Manoj Iyer',           type: 'Call Made',        notes: 'Senior banker — vacation home in Alibaug/Lonavala. Has purchased before. Decision maker.',           outcome: 'Positive',    duration: 412, next_action_date: null,  created_at: d(21) },
  { name_key: 'Manoj Iyer',           type: 'Call Made',        notes: 'Second call — wife joining visit. Confirmed Alibaug preference.',                                    outcome: 'Positive',    duration: 285, next_action_date: null,  created_at: d(19) },
  { name_key: 'Manoj Iyer',           type: 'Site Visit Scheduled', notes: 'Full-day site visit to Alibaug property with wife.',                                             outcome: null,          duration: null, next_action_date: null,  created_at: d(17) },
  { name_key: 'Manoj Iyer',           type: 'Site Visit Done',  notes: 'Site visit done. Loved the sea view villa. Asked for final price and payment plan.',                 outcome: 'Positive',    duration: 14400, next_action_date: null, created_at: d(14) },

  { name_key: 'Sunita Ramesh',        type: 'Call Made',        notes: 'First-time buyer. Teacher. Wants 2BHK in Aundh/Pimple area. Close to school.',                      outcome: 'Positive',    duration: 155, next_action_date: null,  created_at: d(22) },
  { name_key: 'Sunita Ramesh',        type: 'Call Made',        notes: 'Confirmed loan pre-approval from SBI. Ready to move in 3 months.',                                   outcome: 'Positive',    duration: 180, next_action_date: null,  created_at: d(19) },
  { name_key: 'Sunita Ramesh',        type: 'VM Done',          notes: 'Virtual tour done. She cried seeing the kitchen — exactly what she wanted.',                         outcome: 'Positive',    duration: 2100, next_action_date: null, created_at: d(17) },

  // HOT leads
  { name_key: 'Vikram Bhatia',        type: 'Call Made',        notes: 'Industrialist — upgrading to luxury 4BHK on Malabar Hill. Very clear requirements.',                outcome: 'Positive',    duration: 520, next_action_date: null,  created_at: d(24) },
  { name_key: 'Vikram Bhatia',        type: 'Site Visit Done',  notes: 'First site visit with wife. Loved the sea-facing penthouse. Ready to proceed.',                     outcome: 'Positive',    duration: 7200, next_action_date: null, created_at: d(22) },
  { name_key: 'Vikram Bhatia',        type: 'Site Visit Done',  notes: 'Second site visit with CA and lawyer. Legal documents reviewed on site.',                            outcome: 'Positive',    duration: 10800, next_action_date: null, created_at: d(20) },
  { name_key: 'Vikram Bhatia',        type: 'EOI Received',     notes: 'EOI of ₹25L paid. Application submitted for unit 4201. Target closing in 3 weeks.',                outcome: 'Positive',    duration: null, next_action_date: d(7),  created_at: d(18) },
  { name_key: 'Vikram Bhatia',        type: 'Note',             notes: 'Negotiated on stamp duty. Developer agreed to cover registration fees. Price locked.',              outcome: null,          duration: null, next_action_date: null, created_at: d(15) },

  { name_key: 'Gayatri Naidu',        type: 'Call Made',        notes: 'Software lead — systematic buyer. Shortlisted 2 projects in Madhapur area.',                        outcome: 'Positive',    duration: 360, next_action_date: null,  created_at: d(25) },
  { name_key: 'Gayatri Naidu',        type: 'OBM Done',         notes: 'Detailed online briefing with husband. Compared floor plans side by side.',                         outcome: 'Positive',    duration: 3600, next_action_date: null, created_at: d(22) },
  { name_key: 'Gayatri Naidu',        type: 'Site Visit Done',  notes: 'Site visit completed. Compared 3 units — preferred B-wing 8th floor.',                              outcome: 'Positive',    duration: 5400, next_action_date: null, created_at: d(19) },
  { name_key: 'Gayatri Naidu',        type: 'EOI Received',     notes: 'EOI submitted for unit B-804. Cheque ₹5L deposited. Awaiting builder confirmation.',                outcome: 'Positive',    duration: null, next_action_date: d(5),  created_at: d(16) },
  { name_key: 'Gayatri Naidu',        type: 'Follow Up Set',    notes: 'Agreement signing scheduled once builder confirms allotment.',                                        outcome: null,          duration: null, next_action_date: d(4),  created_at: d(14) },

  { name_key: 'Rajesh Kumar',         type: 'Call Made',        notes: 'Retired IPS officer — villa for self-use and investment. Very specific on location.',                outcome: 'Positive',    duration: 610, next_action_date: null,  created_at: d(27) },
  { name_key: 'Rajesh Kumar',         type: 'Site Visit Done',  notes: 'Long site visit with son (who is architect). Son made notes and approves the structure.',            outcome: 'Positive',    duration: 14400, next_action_date: null, created_at: d(24) },
  { name_key: 'Rajesh Kumar',         type: 'Site Visit Done',  notes: 'Second visit — wife visited. She particularly loved the garden and swimming pool area.',             outcome: 'Positive',    duration: 10800, next_action_date: null, created_at: d(21) },
  { name_key: 'Rajesh Kumar',         type: 'VM Done',          notes: 'Legal due diligence call with son over video. Builder title clear.',                                  outcome: 'Positive',    duration: 3000, next_action_date: null, created_at: d(18) },
  { name_key: 'Rajesh Kumar',         type: 'EOI Received',     notes: 'EOI of ₹10L paid. Villa-7 locked. ATS signing this weekend.',                                        outcome: 'Positive',    duration: null, next_action_date: d(2),  created_at: d(15) },

  { name_key: 'Meena Agarwal',        type: 'Call Made',        notes: 'Govt officer — buying with PF withdrawal. Ready in 60 days. 3BHK required.',                        outcome: 'Positive',    duration: 290, next_action_date: null,  created_at: d(28) },
  { name_key: 'Meena Agarwal',        type: 'Call Made',        notes: 'Second call — confirmed budget 1.5-2Cr. South Extension first choice.',                              outcome: 'Positive',    duration: 198, next_action_date: null,  created_at: d(25) },
  { name_key: 'Meena Agarwal',        type: 'Site Visit Done',  notes: 'Site visit with husband. Selected shortlist of 2 units. Needs 1 week to decide.',                  outcome: 'Positive',    duration: 7200, next_action_date: null, created_at: d(22) },
  { name_key: 'Meena Agarwal',        type: 'EOI Received',     notes: 'EOI submitted. ₹2L DD deposited. Flat 602 Tower-A locked.',                                         outcome: 'Positive',    duration: null, next_action_date: d(10), created_at: d(18) },

  { name_key: 'Sunil Chopra',         type: 'Call Made',        notes: 'Entrepreneur — second home in Juhu. Has bought from our developer before.',                          outcome: 'Positive',    duration: 480, next_action_date: null,  created_at: d(29) },
  { name_key: 'Sunil Chopra',         type: 'OBM Done',         notes: 'OBM with CFO (handles all his property). Satisfied with project financials and ROI.',                outcome: 'Positive',    duration: 4200, next_action_date: null, created_at: d(26) },
  { name_key: 'Sunil Chopra',         type: 'Site Visit Done',  notes: 'Visited with CFO. EOI signed on the spot for Penthouse A.',                                          outcome: 'Positive',    duration: 5400, next_action_date: null, created_at: d(23) },
  { name_key: 'Sunil Chopra',         type: 'EOI Received',     notes: 'EOI signed for Penthouse A. ₹25L advance paid. Deal estimate ₹3.2Cr.',                              outcome: 'Positive',    duration: null, next_action_date: d(6),  created_at: d(20) },

  { name_key: 'Tara Krishnan',        type: 'Call Made',        notes: 'Senior doctor — wants 3BHK near HSR Layout for mother. Parking essential.',                         outcome: 'Positive',    duration: 310, next_action_date: null,  created_at: d(31) },
  { name_key: 'Tara Krishnan',        type: 'Site Visit Done',  notes: 'Site visit done with mother. Mother approves — 3rd floor unit preferred.',                          outcome: 'Positive',    duration: 9000, next_action_date: null, created_at: d(28) },
  { name_key: 'Tara Krishnan',        type: 'EOI Received',     notes: 'EOI submitted. ₹3L token paid for unit 305-C. Agreement expected in 2 weeks.',                      outcome: 'Positive',    duration: null, next_action_date: d(8),  created_at: d(25) },
  { name_key: 'Tara Krishnan',        type: 'Note',             notes: 'Special request: ensure adequate street lighting and security near the building.',              outcome: null,          duration: null, next_action_date: null, created_at: d(23) },

  // CLOSED leads
  { name_key: 'Aditya Sharma',        type: 'Call Made',        notes: 'First contact — referred by existing client Mehta ji. Looking for luxury on Peddar Road.',          outcome: 'Positive',    duration: 595, next_action_date: null,  created_at: d(44) },
  { name_key: 'Aditya Sharma',        type: 'Site Visit Done',  notes: 'Site visit day 1. Toured 3 units. Loved Penthouse B — 42nd floor sea view.',                       outcome: 'Positive',    duration: 14400, next_action_date: null, created_at: d(41) },
  { name_key: 'Aditya Sharma',        type: 'OBM Done',         notes: 'OBM with legal team. Title clear. Bank loan already pre-approved at HDFC.',                         outcome: 'Positive',    duration: 5400, next_action_date: null, created_at: d(38) },
  { name_key: 'Aditya Sharma',        type: 'EOI Received',     notes: 'EOI paid ₹50L for Penthouse B. ATS ceremony on the 15th.',                                          outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(35) },
  { name_key: 'Aditya Sharma',        type: 'Deal Closed',      notes: 'ATS signed. ₹4.8Cr total. 40% upfront, balance on registration. Handover in 18 months.',           outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(30) },

  { name_key: 'Priya Nambiar',        type: 'Call Made',        notes: 'Google engineer — shifting from rental to owned. 3BHK Koramangala/Indiranagar.',                    outcome: 'Positive',    duration: 310, next_action_date: null,  created_at: d(49) },
  { name_key: 'Priya Nambiar',        type: 'Site Visit Done',  notes: 'Property tour done with husband. Loved the smart home features in unit 904.',                       outcome: 'Positive',    duration: 7200, next_action_date: null, created_at: d(46) },
  { name_key: 'Priya Nambiar',        type: 'EOI Received',     notes: 'EOI ₹8L paid for unit 904-A. Possession in 12 months.',                                             outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(42) },
  { name_key: 'Priya Nambiar',        type: 'Deal Closed',      notes: 'Deal closed at ₹1.55Cr. Loan disbursed from ICICI. Registration date set.',                         outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(38) },

  { name_key: 'Harish Reddy',         type: 'Call Made',        notes: 'Business owner — villa in Jubilee Hills for self-use. 4BHK, large garden.',                         outcome: 'Positive',    duration: 680, next_action_date: null,  created_at: d(54) },
  { name_key: 'Harish Reddy',         type: 'Site Visit Done',  notes: 'Visited entire township. Selected Villa 12 (corner plot, south-east facing).',                      outcome: 'Positive',    duration: 18000, next_action_date: null, created_at: d(50) },
  { name_key: 'Harish Reddy',         type: 'OBM Done',         notes: 'OBM with architect for customization. Agreed on internal modifications.',                            outcome: 'Positive',    duration: 4800, next_action_date: null, created_at: d(46) },
  { name_key: 'Harish Reddy',         type: 'EOI Received',     notes: 'EOI ₹20L paid. Villa 12 allotted. Builder agreement being drafted.',                                  outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(42) },
  { name_key: 'Harish Reddy',         type: 'Deal Closed',      notes: 'Sale deed signed. ₹3.6Cr settled. Possession ceremony done. Client gifted us sweets!',              outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(38) },

  { name_key: 'Anita Banerjee',       type: 'Call Made',        notes: 'School principal — first home buyer. Patient and detail-oriented.',                                  outcome: 'Positive',    duration: 240, next_action_date: null,  created_at: d(59) },
  { name_key: 'Anita Banerjee',       type: 'VM Done',          notes: 'Virtual tour done. She made a pros/cons list! All questions answered.',                              outcome: 'Positive',    duration: 3000, next_action_date: null, created_at: d(56) },
  { name_key: 'Anita Banerjee',       type: 'Site Visit Done',  notes: 'Site visit. Brought sister for second opinion. Both approved.',                                      outcome: 'Positive',    duration: 7200, next_action_date: null, created_at: d(53) },
  { name_key: 'Anita Banerjee',       type: 'EOI Received',     notes: 'EOI ₹3L paid. 7th floor unit booked — close to elevator as requested.',                             outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(50) },
  { name_key: 'Anita Banerjee',       type: 'Deal Closed',      notes: 'Registration done. ₹87L all-in. Home loan from Bank of Baroda. Keys handed over.',                  outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(46) },

  { name_key: 'Deepak Malhotra',      type: 'Call Made',        notes: 'Lawyer — investment purchase in South Delhi. Very fast decision maker.',                             outcome: 'Positive',    duration: 410, next_action_date: null,  created_at: d(64) },
  { name_key: 'Deepak Malhotra',      type: 'Site Visit Done',  notes: 'Quick site visit — he had already studied the project online. Just wanted to verify.',              outcome: 'Positive',    duration: 5400, next_action_date: null, created_at: d(61) },
  { name_key: 'Deepak Malhotra',      type: 'EOI Received',     notes: 'EOI 15L same day. 4BHK unit 2204. He said: this is the one, close it.',                   outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(59) },
  { name_key: 'Deepak Malhotra',      type: 'Deal Closed',      notes: 'Full payment done in 10 days. ₹2.4Cr cash purchase. Fastest close on record.',                      outcome: 'Positive',    duration: null, next_action_date: null, created_at: d(55) },

  // DISQUALIFIED leads
  { name_key: 'Arun Patel',           type: 'Call Made',        notes: 'No answer.',                                                                                           outcome: 'No Response', duration: 0,   next_action_date: null,  created_at: d(13) },
  { name_key: 'Arun Patel',           type: 'Call Made',        notes: 'No answer again.',                                                                                     outcome: 'No Response', duration: 0,   next_action_date: null,  created_at: d(12) },
  { name_key: 'Arun Patel',           type: 'Call Missed',      notes: null,                                                                                                    outcome: null,          duration: null, next_action_date: null, created_at: d(11) },
  { name_key: 'Arun Patel',           type: 'WhatsApp Sent',    notes: 'Hi Arun, tried calling multiple times. Please let us know a good time.',                              outcome: null,          duration: null, next_action_date: null, created_at: d(10) },
  { name_key: 'Arun Patel',           type: 'Call Made',        notes: 'No answer. 5th attempt — marking NC.',                                                                 outcome: 'No Response', duration: 0,   next_action_date: null,  created_at: d(9)  },

  { name_key: 'Ritu Sharma',          type: 'Call Made',        notes: 'Connected — budget expectation ₹30L, our lowest is ₹55L. Clear mismatch.',                           outcome: 'Negative',    duration: 85,  next_action_date: null,  created_at: d(14) },
  { name_key: 'Ritu Sharma',          type: 'Note',             notes: 'Budget mismatch. Not a fit for our projects. Marked disqualified.',                                   outcome: null,          duration: null, next_action_date: null, created_at: d(13) },

  { name_key: 'Mohan Ghosh',          type: 'Call Made',        notes: 'Not interested — already bought property elsewhere.',                                                   outcome: 'Negative',    duration: 45,  next_action_date: null,  created_at: d(15) },

  { name_key: 'Swati Jain',           type: 'Call Made',        notes: 'First call — initially interested.',                                                                   outcome: 'Neutral',     duration: 155, next_action_date: null,  created_at: d(16) },
  { name_key: 'Swati Jain',           type: 'Call Made',        notes: 'Second call — said she purchased in another project. Cannot be won back.',                            outcome: 'Negative',    duration: 60,  next_action_date: null,  created_at: d(14) },
]

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (key !== 'vya-demo-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  try {
    // 1. Wipe existing data
    await sb.from('lead_activities').delete().not('id', 'is', null)
    await sb.from('leads').delete().not('id', 'is', null)

    // 2. Insert leads (agent_id null = visible to all workspace users)
    const insertRows = LEADS.map(lead => ({ ...lead, agent_id: null }))
    const { data: inserted, error: insErr } = await sb
      .from('leads')
      .insert(insertRows)
      .select('id, name')
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

    const nameToId: Record<string, string> = {}
    for (const row of inserted ?? []) nameToId[row.name] = row.id

    // 3. Insert activities
    const actRows = ACTIVITIES
      .map(a => {
        const lead_id = nameToId[a.name_key]
        if (!lead_id) return null
        return {
          lead_id,
          activity_type: a.type,
          activity_data: {
            notes:          a.notes,
            outcome:        a.outcome,
            duration:       a.duration,
            nextActionDate: a.next_action_date,
          },
          created_at: a.created_at,
        }
      })
      .filter(Boolean)

    const { error: actErr } = await sb.from('lead_activities').insert(actRows)
    if (actErr) return NextResponse.json({ error: actErr.message }, { status: 400 })

    return NextResponse.json({
      ok: true,
      leads: inserted?.length ?? 0,
      activities: actRows.length,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
