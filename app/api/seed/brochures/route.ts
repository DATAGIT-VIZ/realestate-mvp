import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const MOCK_BROCHURES = [
  {
    name: 'Lodha Palava — 2BHK Brochure',
    project_name: 'Lodha Palava',
    file_url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
    file_name: 'lodha_palava_2bhk.pdf',
    file_size: 204800,
    file_type: 'pdf',
  },
  {
    name: 'Prestige Lakeside — 3BHK Premium',
    project_name: 'Prestige Lakeside',
    file_url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
    file_name: 'prestige_lakeside_3bhk.pdf',
    file_size: 358400,
    file_type: 'pdf',
  },
  {
    name: 'Godrej Reserve — Villa Collection',
    project_name: 'Godrej Reserve',
    file_url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
    file_name: 'godrej_reserve_villas.pdf',
    file_size: 512000,
    file_type: 'pdf',
  },
  {
    name: 'Brigade Utopia — Master Plan',
    project_name: 'Brigade Utopia',
    file_url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
    file_name: 'brigade_utopia_masterplan.pdf',
    file_size: 716800,
    file_type: 'pdf',
  },
  {
    name: 'Sobha City — Payment Schedule',
    project_name: 'Sobha City',
    file_url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
    file_name: 'sobha_city_payment.pdf',
    file_size: 153600,
    file_type: 'pdf',
  },
]

export async function POST() {
  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  // Clear existing demo brochures and re-insert so button is idempotent
  await sb.from('brochures').delete().in('name', MOCK_BROCHURES.map(b => b.name))

  const { data, error } = await sb.from('brochures').insert(MOCK_BROCHURES).select()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ seeded: data?.length ?? 0 })
}
