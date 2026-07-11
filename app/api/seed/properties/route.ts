import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAdminSecret } from '@/lib/admin-guard'

const DEMO_PROPERTIES = [
  {
    title:       'Kalpataru Aura — 3BHK Premium',
    type:        'Apartment',
    city:        'Mumbai',
    locality:    'Goregaon East',
    price:       24500000,
    area_sqft:   1320,
    bedrooms:    3,
    bathrooms:   3,
    floor:       18,
    total_floors: 32,
    developer:   'Kalpataru Group',
    rera_number: 'P51800036799',
    description: 'Spacious 3BHK with panoramic views, modular kitchen, and world-class amenities. 5 min from Oberoi Mall.',
    amenities:   ['Gym', 'Swimming Pool', 'Clubhouse', 'Security', 'Parking'],
    status:      'Available',
  },
  {
    title:       'Lodha Palava — 2BHK Smart Home',
    type:        'Apartment',
    city:        'Mumbai',
    locality:    'Dombivali',
    price:       7800000,
    area_sqft:   750,
    bedrooms:    2,
    bathrooms:   2,
    floor:       8,
    total_floors: 20,
    developer:   'Lodha Group',
    rera_number: 'P51700025843',
    description: 'Smart home automation, township living with school, hospital, and mall within campus. Ready to move.',
    amenities:   ['Gym', 'Jogging Track', 'Kids Zone', 'School', 'Mall'],
    status:      'Available',
  },
  {
    title:       'Prestige Lakeside Habitat — 3BHK',
    type:        'Apartment',
    city:        'Bangalore',
    locality:    'Whitefield',
    price:       11500000,
    area_sqft:   1420,
    bedrooms:    3,
    bathrooms:   2,
    floor:       12,
    total_floors: 24,
    developer:   'Prestige Group',
    rera_number: 'PRM/KA/RERA/1251/446/PR/170819/002230',
    description: 'Lakefront gated community, 3BHK with lake views, premium finishes, and tech park proximity.',
    amenities:   ['Lake View', 'Gym', 'Pool', 'Tennis Court', 'Clubhouse'],
    status:      'Available',
  },
  {
    title:       'Embassy Springs — 4BHK Villa',
    type:        'Villa',
    city:        'Bangalore',
    locality:    'Devanahalli',
    price:       28000000,
    area_sqft:   3500,
    bedrooms:    4,
    bathrooms:   4,
    developer:   'Embassy Group',
    rera_number: 'PRM/KA/RERA/1251/310/PR/180522/005678',
    description: 'Luxury villa with private garden, home theatre, and driver quarters. 10 min from Kempegowda Airport.',
    amenities:   ['Private Garden', 'Swimming Pool', 'Home Theatre', 'Golf Course', 'Concierge'],
    status:      'Available',
  },
  {
    title:       'Godrej Nirvaan — 1BHK',
    type:        'Apartment',
    city:        'Mumbai',
    locality:    'Thane West',
    price:       5500000,
    area_sqft:   580,
    bedrooms:    1,
    bathrooms:   1,
    floor:       5,
    total_floors: 15,
    developer:   'Godrej Properties',
    rera_number: 'P51700027641',
    description: 'Efficient 1BHK ideal for young professionals. Excellent connectivity to LBS Marg and Ghodbunder Road.',
    amenities:   ['Gym', 'Garden', 'Security', 'Parking'],
    status:      'Available',
  },
  {
    title:       'Mahindra Eden — 2BHK',
    type:        'Apartment',
    city:        'Pune',
    locality:    'Kharadi',
    price:       8900000,
    area_sqft:   920,
    bedrooms:    2,
    bathrooms:   2,
    floor:       9,
    total_floors: 18,
    developer:   'Mahindra Lifespaces',
    rera_number: 'P52100027312',
    description: 'Modern 2BHK in Pune\'s IT corridor. Vaastu compliant, abundant natural light, green landscaping.',
    amenities:   ['Pool', 'Gym', 'Amphitheatre', 'Senior Citizen Zone', 'EV Charging'],
    status:      'Under Offer',
  },
  {
    title:       'Shapoorji Pallonji — Corner Plot',
    type:        'Plot',
    city:        'Navi Mumbai',
    locality:    'Kharghar',
    price:       4200000,
    area_sqft:   1000,
    developer:   'Shapoorji Pallonji',
    rera_number: 'P99000018740',
    description: 'Gated township plot, corner location, fully developed with roads, drainage, and electricity.',
    amenities:   ['Gated Society', 'CCTV', 'Club Access'],
    status:      'Available',
  },
  {
    title:       'Puravankara Atmosphere — 2BHK',
    type:        'Apartment',
    city:        'Bangalore',
    locality:    'Hebbal',
    price:       12200000,
    area_sqft:   1180,
    bedrooms:    2,
    bathrooms:   2,
    floor:       22,
    total_floors: 38,
    developer:   'Puravankara',
    rera_number: 'PRM/KA/RERA/1251/446/PR/200112/003419',
    description: 'High-rise 2BHK with unobstructed Hebbal Lake views. Sky lounge, infinity pool, co-working spaces.',
    amenities:   ['Infinity Pool', 'Sky Lounge', 'Co-working', 'Concierge', 'Gym'],
    status:      'Sold',
  },
]

export async function POST(req: NextRequest) {
  const guard = requireAdminSecret(req)
  if (guard) return guard

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  // Clear existing demo data and re-insert
  await sb.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const { data, error } = await sb.from('properties').insert(DEMO_PROPERTIES).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ inserted: data?.length ?? 0 }, { status: 201 })
}
