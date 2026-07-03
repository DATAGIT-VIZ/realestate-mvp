import { NextResponse } from 'next/server'
import { gql } from '@/lib/twenty'
import type { CRMLead } from '@/lib/twenty'
import { LEAD_FIELDS } from '@/lib/twenty'

const MUTATION = /* GraphQL */ `
  mutation CreateLead($data: PersonCreateInput!) {
    createPerson(data: $data) { ${LEAD_FIELDS} }
  }
`

const SEEDS = [
  {
    name:         { firstName: 'Arjun', lastName: 'Kapoor' },
    phones:       { primaryPhoneNumber: '9845001122', primaryPhoneCountryCode: '+91' },
    emails:       { primaryEmail: 'arjun.kapoor@gmail.com' },
    city:         'Mumbai',
    intentScore:  88,
    status:       'Hot',
    sourcePortal: 'MagicBricks',
    propertyType: ['3BHK Apartment'],
    localities:   ['Bandra West', 'Juhu'],
    budgetMin:    18000000,
    budgetMax:    28000000,
    timeline:     'Immediate',
  },
  {
    name:         { firstName: 'Sneha', lastName: 'Nair' },
    phones:       { primaryPhoneNumber: '9876540033', primaryPhoneCountryCode: '+91' },
    emails:       { primaryEmail: 'sneha.nair@outlook.com' },
    city:         'Bangalore',
    intentScore:  72,
    status:       'Warm',
    sourcePortal: '99acres',
    propertyType: ['2BHK Apartment'],
    localities:   ['Whitefield', 'Marathahalli'],
    budgetMin:    8000000,
    budgetMax:    12000000,
    timeline:     '1–3 Months',
  },
  {
    name:         { firstName: 'Rohit', lastName: 'Verma' },
    phones:       { primaryPhoneNumber: '9910005566', primaryPhoneCountryCode: '+91' },
    emails:       { primaryEmail: 'rohit.verma@yahoo.in' },
    city:         'Pune',
    intentScore:  91,
    status:       'Hot',
    sourcePortal: 'Referral',
    propertyType: ['Villa'],
    localities:   ['Koregaon Park', 'Kalyani Nagar'],
    budgetMin:    40000000,
    budgetMax:    70000000,
    timeline:     'Immediate',
  },
  {
    name:         { firstName: 'Divya', lastName: 'Menon' },
    phones:       { primaryPhoneNumber: '9966112233', primaryPhoneCountryCode: '+91' },
    emails:       { primaryEmail: 'divya.menon@gmail.com' },
    city:         'Hyderabad',
    intentScore:  55,
    status:       'Warm',
    sourcePortal: 'Housing.com',
    propertyType: ['2BHK Apartment', '3BHK Apartment'],
    localities:   ['Gachibowli', 'HITEC City'],
    budgetMin:    7000000,
    budgetMax:    11000000,
    timeline:     '3–6 Months',
  },
  {
    name:         { firstName: 'Karan', lastName: 'Singh' },
    phones:       { primaryPhoneNumber: '9823456700', primaryPhoneCountryCode: '+91' },
    emails:       { primaryEmail: 'karan.singh@rediffmail.com' },
    city:         'Delhi',
    intentScore:  40,
    status:       'New',
    sourcePortal: 'Facebook Ads',
    propertyType: ['1BHK Apartment'],
    localities:   ['Dwarka', 'Rohini'],
    budgetMin:    5000000,
    budgetMax:    7500000,
    timeline:     '6+ Months',
  },
]

export async function POST() {
  const results: { name: string; id?: string; error?: string }[] = []

  for (const seed of SEEDS) {
    try {
      const res = await gql<{ createPerson: CRMLead }>(MUTATION, { data: seed })
      if (res.errors?.length) {
        results.push({ name: `${seed.name.firstName} ${seed.name.lastName}`, error: res.errors[0].message })
      } else {
        results.push({ name: `${seed.name.firstName} ${seed.name.lastName}`, id: res.data?.createPerson.id })
      }
    } catch (e) {
      results.push({ name: `${seed.name.firstName} ${seed.name.lastName}`, error: String(e) })
    }
  }

  const ok     = results.filter(r => r.id).length
  const failed = results.filter(r => r.error).length

  return NextResponse.json({ created: ok, failed, results })
}
