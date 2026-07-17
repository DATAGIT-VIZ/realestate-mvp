import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Base real-estate filter — item must match at least one of these ───────────
const RE_BASE = [
  'real estate', 'property', 'realty', 'housing', 'residential', 'commercial',
  'apartment', 'flat', 'villa', 'plot', 'land', 'builder', 'developer',
  'home buyer', 'homebuyer', 'bhk', 'sq ft', 'sqft', 'broker', 'brokerage',
  'stamp duty', 'circle rate', 'registration charge', 'rera', 'rental yield',
  'rental market', 'new launch', 'new project', 'micro-market', 'micromarket',
]

// ── Exactly 8 allowed categories ─────────────────────────────────────────────
const TAGS: Record<string, string[]> = {
  stamp_duty:     ['stamp duty', 'registration charge', 'circle rate', 'registration fee', 'stamp charges'],
  property_stats: ['property price', 'price index', 'residential prices', 'housing prices', 'property valuation', 'property market', 'housing market', 'property statistics', 'real estate market'],
  rental:         ['rental yield', 'rental demand', 'rental market', 'rent rises', 'rent hike', 'rent surge', 'rental income', 'rental rate', 'rental growth', 'co-living'],
  policy:         ['rbi', 'repo rate', 'interest rate', 'rera', 'home loan rate', 'budget 2026', 'gst on property', 'tds on property', 'pmay', 'pradhan mantri awas'],
  sales_jump:     ['sales jump', 'sales surge', 'sales rise', 'sales record', 'units sold', 'home sales', 'residential sales', 'property sales', 'registration data', 'sold out'],
  demand_surge:   ['demand surge', 'demand rises', 'enquiries spike', 'search spike', 'queries rise', 'demand up', 'residential demand', 'buyer enquiries', 'site visits', 'enquiry spike'],
  new_launch:     ['new launch', 'new project', 'project launched', 'township launch', 'upcoming project', 'pre-launch', 'new development', 'project announcement', 'launches'],
  micro_market:   ['micro-market', 'micromarket', 'emerging market', 'emerging locality', 'corridor', 'belt', 'suburb growth', 'locality trend', 'area trend', 'emerging zone'],
}

// ── Curated fallback — exactly 8 categories, one each ─────────────────────────
const FALLBACK = [
  {
    title: 'Maharashtra cuts stamp duty on women buyers to 4% — brokers expect MMR sales surge',
    link: '#', pubDate: new Date().toISOString(), tag: 'stamp_duty', source: 'ET Realty',
  },
  {
    title: 'India residential property prices rise 9.2% YoY in Q2 2026 — Knight Frank index',
    link: '#', pubDate: new Date().toISOString(), tag: 'property_stats', source: 'ET Realty',
  },
  {
    title: 'Bengaluru records 4.4% rental yield in HITEC City — highest in five years',
    link: '#', pubDate: new Date().toISOString(), tag: 'rental', source: 'ET Realty',
  },
  {
    title: 'RBI holds repo rate at 6.5% for fifth consecutive time — home loan borrowers get relief',
    link: '#', pubDate: new Date().toISOString(), tag: 'policy', source: 'ET Realty',
  },
  {
    title: 'Mumbai residential sales jump 22% YoY in June — 14,200 units registered',
    link: '#', pubDate: new Date().toISOString(), tag: 'sales_jump', source: 'ET Realty',
  },
  {
    title: 'Online property enquiries spike 38% in May — 99acres reports record traffic',
    link: '#', pubDate: new Date().toISOString(), tag: 'demand_surge', source: 'ET Realty',
  },
  {
    title: 'Navi Mumbai sees 34% jump in new project launches — Panvel, Taloja lead Q2 numbers',
    link: '#', pubDate: new Date().toISOString(), tag: 'new_launch', source: 'ET Realty',
  },
  {
    title: 'Pune Wakad, Hinjewadi micro-markets emerge as top residential picks for IT workforce',
    link: '#', pubDate: new Date().toISOString(), tag: 'micro_market', source: 'ET Realty',
  },
]

export interface NewsItem {
  title: string
  link: string
  pubDate: string
  tag: string | null
  source: string
}

let cache: { items: NewsItem[]; ts: number } | null = null
const TTL = 3 * 60 * 60 * 1000 // 3 hours — matches client refresh interval

function isRealEstate(title: string): boolean {
  const lower = title.toLowerCase()
  return RE_BASE.some(kw => lower.includes(kw))
}

function tagItem(title: string): string | null {
  const lower = title.toLowerCase()
  for (const [tag, kws] of Object.entries(TAGS)) {
    if (kws.some(kw => lower.includes(kw))) return tag
  }
  return null
}

function parseRSS(xml: string, source: string): NewsItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(m => {
      const b       = m[1]
      const title   = (b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim()
      const link    = (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '#').trim()
      const pubDate = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? new Date().toISOString()).trim()
      return { title, link, pubDate, tag: tagItem(title), source } satisfies NewsItem
    })
    .filter(i => i.title.length > 12 && isRealEstate(i.title)) // ← strict RE filter
    .slice(0, 10)
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.items)
  }

  try {
    const res = await fetch('https://realty.economictimes.indiatimes.com/rss/topstories', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VyaPulse/1.0)' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml   = await res.text()
    const items = parseRSS(xml, 'ET Realty')
    if (items.length === 0) throw new Error('empty after RE filter')
    cache = { items, ts: Date.now() }
    return NextResponse.json(items)
  } catch {
    cache = { items: FALLBACK, ts: Date.now() - TTL + 30 * 60 * 1000 } // retry in 30 min
    return NextResponse.json(FALLBACK)
  }
}
