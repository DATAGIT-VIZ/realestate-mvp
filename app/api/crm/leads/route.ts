import { NextRequest, NextResponse } from 'next/server'
import { calcLeadScore, type CRMLead, type CRMLeadInput } from '@/lib/twenty'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

// ─── Supabase row → CRMLead (UI shape unchanged) ─────────────────────────────
function rowToCrm(r: Record<string, unknown>): CRMLead {
  const parts = ((r.name as string) ?? '').trim().split(/\s+/)
  return {
    id:           r.id as string,
    name:         { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') },
    phones:       { primaryPhoneNumber: (r.phone as string) ?? '', primaryPhoneCountryCode: 'IN' },
    emails:       { primaryEmail: (r.email as string) ?? '' },
    city:         (r.city as string) ?? null,
    intentScore:  (r.intent_score as number) ?? 0,
    status:       (r.status as string) ?? 'New',
    leadPortalId: (r.cs_id as string) ?? null,           // CS ID is the portal ID
    sourcePortal: (r.source as string) ?? null,
    sourceDetail: buildSourceDetail(r.client_type as string, r.portal_lead_id as string),
    budgetMin:    (r.budget_min as number) ?? null,
    budgetMax:    (r.budget_max as number) ?? null,
    propertyType: (r.property_type as string) ? [(r.property_type as string)] : null,
    timeline:     (r.timeline as string) ?? null,
    localities:   (r.locations as string[]) ?? null,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
  }
}

function buildSourceDetail(clientType?: string | null, portalId?: string | null): string | null {
  const parts: string[] = []
  if (clientType) parts.push(`[${clientType}]`)
  if (portalId)   parts.push(`[pid:${portalId}]`)
  return parts.length ? parts.join(' ') : null
}

// ─── GET /api/crm/leads ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: { leads: DEMO_LEADS, pageInfo: null, totalCount: DEMO_LEADS.length }, error: null })

  // Dev bypass: agent_id is stored as NULL for imported leads; don't filter by agent_id
  const DEV_AGENT   = '00000000-0000-0000-0000-000000000001'
  const isDevBypass = userId === DEV_AGENT

  try {
    const { searchParams } = req.nextUrl
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status')
    const score  = searchParams.get('score')
    const source = searchParams.get('source')
    const limit  = Math.min(Number(searchParams.get('limit') ?? '50'), 200)

    let q = sb.from('leads').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('intent_score', { ascending: false, nullsFirst: false })
      .limit(limit)

    // Strict workspace isolation — each user sees only their own leads
    if (!isDevBypass) q = q.eq('agent_id', userId)

    if (status) q = q.eq('status', status)
    if (source) q = q.eq('source', source)
    if (score === 'hot')  q = q.gte('intent_score', 70)
    if (score === 'warm') q = q.gte('intent_score', 40).lt('intent_score', 70)
    if (score === 'cold') q = q.lt('intent_score', 40)

    if (search) {
      if (/^CS\d+$/i.test(search)) {
        q = q.eq('cs_id', search.toUpperCase())
      } else {
        q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
      }
    }

    const { data, count, error } = await q
    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })

    const leads = (data ?? []).map(rowToCrm)
    return NextResponse.json({ data: { leads, pageInfo: null, totalCount: count ?? leads.length }, error: null })
  } catch (err) {
    console.error('[GET /api/crm/leads]', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch leads' }, { status: 500 })
  }
}

// ─── POST /api/crm/leads ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId, response } = await requireAuth()
  if (response) return response

  const sb = getAdminClient()
  if (!sb) return NextResponse.json({ data: null, error: 'Database not configured' }, { status: 503 })

  try {
    const body: CRMLeadInput = await req.json()
    if (!body.firstName || !body.phone) {
      return NextResponse.json({ data: null, error: 'firstName and phone are required' }, { status: 400 })
    }

    const phone = body.phone.startsWith('+') ? body.phone : `+91${body.phone.replace(/^0/, '')}`

    // Dedup by phone across the whole workspace
    const { data: existing } = await sb.from('leads')
      .select('id, name, cs_id')
      .eq('phone', phone)
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json(
        { data: null, error: `Lead already exists: ${existing.name}`, existingId: existing.id, duplicate: true },
        { status: 409 }
      )
    }

    const intentScore = body.intentScore ?? calcLeadScore(body)
    const fullName    = `${body.firstName} ${body.lastName ?? ''}`.trim()

    // CS ID is auto-assigned by Supabase trigger (cs_id_seq) — no manual generation needed
    const insertRow: Record<string, unknown> = {
      agent_id:       userId,
      name:           fullName,
      phone,
      email:          body.email          ?? null,
      source:         body.sourcePortal   ?? null,
      client_type:    body.clientType     ?? null,
      portal_lead_id: null,                           // manual adds have no portal ID
      property_type:  body.propertyType?.[0]         ?? null,
      locations:      body.localities                 ?? [],
      budget_min:     body.budgetMin                  ?? null,
      budget_max:     body.budgetMax                  ?? null,
      timeline:       body.timeline                   ?? null,
      intent_score:   intentScore,
      status:         body.status                     ?? 'New',
    }
    if (body.city) insertRow.city = body.city

    const { data: created, error: insertErr } = await sb.from('leads').insert(insertRow).select().single()

    if (insertErr) return NextResponse.json({ data: null, error: insertErr.message }, { status: 400 })

    return NextResponse.json({ data: rowToCrm(created as Record<string, unknown>), error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/crm/leads]', err)
    return NextResponse.json({ data: null, error: 'Failed to create lead' }, { status: 500 })
  }
}

// ─── Demo fallback (no Supabase configured) ──────────────────────────────────
const NF: Partial<CRMLead> = { budgetMin: null, budgetMax: null, sourceDetail: null, propertyType: null, timeline: null, localities: null }
const mk = (n: string) => ({ primaryPhoneNumber: n, primaryPhoneCountryCode: 'IN' as const })
const me = (e: string) => ({ primaryEmail: e })

const DEMO_LEADS: CRMLead[] = [
  { ...NF as CRMLead, id:'m1',  name:{firstName:'Rahul',   lastName:'Mehta'  }, phones:mk('+919820001111'), emails:me('rahul@example.in'),   city:'Mumbai',    intentScore:88, sourcePortal:'MagicBricks', leadPortalId:'CS00001', sourceDetail:'[Individual]',        status:'New',          createdAt:new Date(Date.now()-1*3600000).toISOString(),      updatedAt:new Date(Date.now()-1*3600000).toISOString()     },
  { ...NF as CRMLead, id:'m2',  name:{firstName:'Priya',   lastName:'Sharma' }, phones:mk('+919820002222'), emails:me('priya@example.in'),   city:'Pune',      intentScore:72, sourcePortal:'99acres',     leadPortalId:'CS00002', sourceDetail:'[Channel Partner]',   status:'Cold',         createdAt:new Date(Date.now()-3*3600000).toISOString(),      updatedAt:new Date(Date.now()-3*3600000).toISOString()     },
  { ...NF as CRMLead, id:'m3',  name:{firstName:'Arjun',   lastName:'Kapoor' }, phones:mk('+919820003333'), emails:me('arjun@example.in'),   city:'Bangalore', intentScore:55, sourcePortal:'Housing.com', leadPortalId:'CS00003', sourceDetail:'[Agent]',             status:'Cold',         createdAt:new Date(Date.now()-2*86400000).toISOString(),     updatedAt:new Date(Date.now()-2*86400000).toISOString()    },
  { ...NF as CRMLead, id:'m4',  name:{firstName:'Sneha',   lastName:'Nair'   }, phones:mk('+919820004444'), emails:me('sneha@example.in'),   city:'Mumbai',    intentScore:65, sourcePortal:'NoBroker',    leadPortalId:'CS00004', sourceDetail:'[Individual]',        status:'Cold',         createdAt:new Date(Date.now()-3*86400000).toISOString(),     updatedAt:new Date(Date.now()-3*86400000).toISOString()    },
  { ...NF as CRMLead, id:'m5',  name:{firstName:'Aditya',  lastName:'Joshi'  }, phones:mk('+919820005555'), emails:me('aditya@example.in'),  city:'Mumbai',    intentScore:91, sourcePortal:'MagicBricks', leadPortalId:'CS00005', sourceDetail:'[Channel Partner]',   status:'Warm',         createdAt:new Date(Date.now()-6*86400000).toISOString(),     updatedAt:new Date(Date.now()-6*86400000).toISOString()    },
  { ...NF as CRMLead, id:'m6',  name:{firstName:'Meera',   lastName:'Pillai' }, phones:mk('+919820006666'), emails:me('meera@example.in'),   city:'Chennai',   intentScore:93, sourcePortal:'MagicBricks', leadPortalId:'CS00006', sourceDetail:'[Individual]',        status:'Warm',         createdAt:new Date(Date.now()-10*86400000).toISOString(),    updatedAt:new Date(Date.now()-10*86400000).toISOString()   },
  { ...NF as CRMLead, id:'m7',  name:{firstName:'Karthik', lastName:'Balan'  }, phones:mk('+919820007777'), emails:me('karthik@example.in'), city:'Bangalore', intentScore:95, sourcePortal:'99acres',     leadPortalId:'CS00007', sourceDetail:'[Agent]',             status:'Closed',       createdAt:new Date(Date.now()-14*86400000).toISOString(),    updatedAt:new Date(Date.now()-14*86400000).toISOString()   },
  { ...NF as CRMLead, id:'m8',  name:{firstName:'Divya',   lastName:'Iyer'   }, phones:mk('+919820008888'), emails:me('divya@example.in'),   city:'Pune',      intentScore:74, sourcePortal:'99acres',     leadPortalId:'CS00008', sourceDetail:'[Interior Designer]', status:'Hot',          createdAt:new Date(Date.now()-7*86400000).toISOString(),     updatedAt:new Date(Date.now()-7*86400000).toISOString()    },
  { ...NF as CRMLead, id:'m9',  name:{firstName:'Vikram',  lastName:'Singh'  }, phones:mk('+919820009999'), emails:me('vikram@example.in'),  city:'Hyderabad', intentScore:40, sourcePortal:'MagicBricks', leadPortalId:'CS00009', sourceDetail:'[Individual]',        status:'Disqualified', createdAt:new Date(Date.now()-4*86400000).toISOString(),     updatedAt:new Date(Date.now()-4*86400000).toISOString()    },
  { ...NF as CRMLead, id:'m10', name:{firstName:'Anjali',  lastName:'Desai'  }, phones:mk('+919820010000'), emails:me('anjali@example.in'),  city:'Pune',      intentScore:78, sourcePortal:'99acres',     leadPortalId:'CS00010', sourceDetail:'[Interior Designer]', status:'New',          createdAt:new Date(Date.now()-60*3600000).toISOString(),     updatedAt:new Date(Date.now()-60*3600000).toISOString()    },
]
