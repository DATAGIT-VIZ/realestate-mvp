import { NextRequest, NextResponse } from 'next/server'
import { gql } from '@/lib/twenty'
import type { CRMLead } from '@/lib/twenty'
import { LEAD_FIELDS } from '@/lib/twenty'
import { requireAdminSecret } from '@/lib/admin-guard'

const MUTATION = /* GraphQL */ `
  mutation CreateLead($data: PersonCreateInput!) {
    createPerson(data: $data) { ${LEAD_FIELDS} }
  }
`

const SEEDS = [
  {
    name:         { firstName: 'Arjun', lastName: 'Kapoor' },
    phones:       { primaryPhoneNumber: '+919845001122', primaryPhoneCountryCode: 'IN' },
    emails:       { primaryEmail: 'arjun.kapoor@gmail.com' },
    city:         'Mumbai',
    intentScore:  88,
    status:       'CONTACTED',
    sourcePortal: 'MAGICBRICKS',
    budgetMin:    18000000,
    budgetMax:    28000000,
  },
  {
    name:         { firstName: 'Sneha', lastName: 'Nair' },
    phones:       { primaryPhoneNumber: '+919876540033', primaryPhoneCountryCode: 'IN' },
    emails:       { primaryEmail: 'sneha.nair@outlook.com' },
    city:         'Bangalore',
    intentScore:  72,
    status:       'NEW',
    sourcePortal: 'OPT99ACRES',
    budgetMin:    8000000,
    budgetMax:    12000000,
  },
  {
    name:         { firstName: 'Rohit', lastName: 'Verma' },
    phones:       { primaryPhoneNumber: '+919910005566', primaryPhoneCountryCode: 'IN' },
    emails:       { primaryEmail: 'rohit.verma@yahoo.in' },
    city:         'Pune',
    intentScore:  91,
    status:       'QUALIFIED',
    sourcePortal: 'REFERRAL',
    budgetMin:    40000000,
    budgetMax:    70000000,
  },
  {
    name:         { firstName: 'Divya', lastName: 'Menon' },
    phones:       { primaryPhoneNumber: '+919966112233', primaryPhoneCountryCode: 'IN' },
    emails:       { primaryEmail: 'divya.menon@gmail.com' },
    city:         'Hyderabad',
    intentScore:  55,
    status:       'NEW',
    sourcePortal: 'HOUSING_COM',
    budgetMin:    7000000,
    budgetMax:    11000000,
  },
  {
    name:         { firstName: 'Karan', lastName: 'Singh' },
    phones:       { primaryPhoneNumber: '+919823456700', primaryPhoneCountryCode: 'IN' },
    emails:       { primaryEmail: 'karan.singh@rediffmail.com' },
    city:         'Delhi',
    intentScore:  40,
    status:       'NEW',
    sourcePortal: 'FACEBOOK',
    budgetMin:    5000000,
    budgetMax:    7500000,
  },
]

export async function POST(req: NextRequest) {
  const guard = requireAdminSecret(req)
  if (guard) return guard

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
