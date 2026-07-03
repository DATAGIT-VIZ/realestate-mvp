import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase-admin'

export type Property = {
  id:              string
  title:           string
  type:            string | null
  city:            string | null
  locality:        string | null
  area_sqft:       number | null
  price:           number
  bedrooms:        number | null
  bathrooms:       number | null
  floor:           number | null
  total_floors:    number | null
  possession_date: string | null
  developer:       string | null
  rera_number:     string | null
  description:     string | null
  amenities:       string[]
  status:          'Available' | 'Under Offer' | 'Sold'
  created_at:      string
  updated_at:      string
}

export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Supabase not configured' }, { status: 503 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const city   = searchParams.get('city')
  const limit  = Number(searchParams.get('limit') ?? '100')

  let query = sb.from('properties').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status && status !== 'all') query = query.eq('status', status)
  if (city)                        query = query.ilike('city', `%${city}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })

  return NextResponse.json({ data: { properties: data ?? [], total: data?.length ?? 0 }, error: null })
}

export async function POST(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Supabase not configured' }, { status: 503 })

  const body = await req.json()
  if (!body.title || !body.price) {
    return NextResponse.json({ data: null, error: 'title and price are required' }, { status: 400 })
  }

  const { data, error } = await sb.from('properties').insert([{
    title:           body.title,
    type:            body.type           ?? null,
    city:            body.city           ?? null,
    locality:        body.locality       ?? null,
    area_sqft:       body.area_sqft      ?? null,
    price:           body.price,
    bedrooms:        body.bedrooms       ?? null,
    bathrooms:       body.bathrooms      ?? null,
    floor:           body.floor          ?? null,
    total_floors:    body.total_floors   ?? null,
    possession_date: body.possession_date ?? null,
    developer:       body.developer      ?? null,
    rera_number:     body.rera_number    ?? null,
    description:     body.description    ?? null,
    amenities:       body.amenities      ?? [],
    status:          body.status         ?? 'Available',
  }]).select().single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })
  return NextResponse.json({ data: { property: data }, error: null }, { status: 201 })
}
