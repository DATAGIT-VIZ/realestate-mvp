'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User, Users, Download, RefreshCw, Loader2,
  TrendingUp, Target, Trophy,
  ChevronRight, Lock, FileText, Activity,
  MapPin, BarChart2,
} from 'lucide-react'
import { getPlan, getRole } from '@/lib/plan'

const BG     = '#F8FAFC'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'
const LABEL  = '#94A3B8'
const BLUE   = '#2563EB'
const BLUE_D = '#EFF6FF'
const GREEN  = '#059669'
const AMBER  = '#D97706'
const AMBER_D= '#FFFBEB'
const VIOLET = '#7C3AED'
const VIOLET_D='#F5F3FF'

function fmt(n: number) {
  if (!n) return '₹0'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

const RANGES = [
  { id: '7d',   label: 'This week' },
  { id: '30d',  label: 'This month' },
  { id: '90d',  label: 'Last 3 months' },
  { id: 'all',  label: 'All time' },
]

function sinceDate(range: string): Date {
  const d = new Date()
  if (range === '7d')  { d.setDate(d.getDate() - 7); return d }
  if (range === '30d') { d.setDate(d.getDate() - 30); return d }
  if (range === '90d') { d.setDate(d.getDate() - 90); return d }
  return new Date('2020-01-01')
}

// ─── Demo fallback data (used when live data is empty) ────────────────────────
const _now = Date.now()
const _day = 86_400_000
const DEMO_ACTIVITIES: Activity[] = [
  { id:'da01', type:'call',              createdAt: new Date(_now - 1*3600000).toISOString(),  personId:'m1' },
  { id:'da02', type:'call',              createdAt: new Date(_now - 3*3600000).toISOString(),  personId:'m5', outcome:'connected' },
  { id:'da03', type:'whatsapp_message',  createdAt: new Date(_now - 5*3600000).toISOString(),  personId:'m2' },
  { id:'da04', type:'call',              createdAt: new Date(_now - 8*3600000).toISOString(),  personId:'m3', outcome:'voicemail' },
  { id:'da05', type:'call',              createdAt: new Date(_now - 0.5*_day).toISOString(),   personId:'m6', outcome:'connected' },
  { id:'da06', type:'site_visit',        createdAt: new Date(_now - 1*_day).toISOString(),     personId:'m7' },
  { id:'da07', type:'call',              createdAt: new Date(_now - 1*_day).toISOString(),     personId:'m1' },
  { id:'da08', type:'follow_up',         createdAt: new Date(_now - 1.5*_day).toISOString(),   personId:'m4' },
  { id:'da09', type:'whatsapp_message',  createdAt: new Date(_now - 2*_day).toISOString(),     personId:'m8' },
  { id:'da10', type:'call',              createdAt: new Date(_now - 2*_day).toISOString(),     personId:'m5' },
  { id:'da11', type:'call',              createdAt: new Date(_now - 3*_day).toISOString(),     personId:'m2', outcome:'connected' },
  { id:'da12', type:'site_visit',        createdAt: new Date(_now - 3*_day).toISOString(),     personId:'m6' },
  { id:'da13', type:'call',              createdAt: new Date(_now - 4*_day).toISOString(),     personId:'m9' },
  { id:'da14', type:'whatsapp_message',  createdAt: new Date(_now - 4*_day).toISOString(),     personId:'m3' },
  { id:'da15', type:'call',              createdAt: new Date(_now - 5*_day).toISOString(),     personId:'m1', outcome:'voicemail' },
  { id:'da16', type:'negotiation_call',  createdAt: new Date(_now - 5*_day).toISOString(),     personId:'m7' },
  { id:'da17', type:'call',              createdAt: new Date(_now - 6*_day).toISOString(),     personId:'m4' },
  { id:'da18', type:'whatsapp_message',  createdAt: new Date(_now - 7*_day).toISOString(),     personId:'m2' },
  { id:'da19', type:'call',              createdAt: new Date(_now - 8*_day).toISOString(),     personId:'m5' },
  { id:'da20', type:'site_visit',        createdAt: new Date(_now - 9*_day).toISOString(),     personId:'m8' },
  { id:'da21', type:'call',              createdAt: new Date(_now - 10*_day).toISOString(),    personId:'m6' },
  { id:'da22', type:'follow_up',         createdAt: new Date(_now - 12*_day).toISOString(),    personId:'m3' },
  { id:'da23', type:'call',              createdAt: new Date(_now - 14*_day).toISOString(),    personId:'m1', outcome:'connected' },
  { id:'da24', type:'whatsapp_message',  createdAt: new Date(_now - 15*_day).toISOString(),    personId:'m9' },
  { id:'da25', type:'call',              createdAt: new Date(_now - 18*_day).toISOString(),    personId:'m2' },
  { id:'da26', type:'negotiation_call',  createdAt: new Date(_now - 20*_day).toISOString(),    personId:'m7' },
  { id:'da27', type:'call',              createdAt: new Date(_now - 22*_day).toISOString(),    personId:'m4' },
  { id:'da28', type:'site_visit',        createdAt: new Date(_now - 25*_day).toISOString(),    personId:'m5' },
]

const DEMO_DEALS: Deal[] = [
  { id:'dd1', lead_name:'Aditya Joshi',  deal_value: 12_000_000, stage:'won',         city:'Mumbai',    created_at: new Date(_now - 5*_day).toISOString() },
  { id:'dd2', lead_name:'Karthik Balan', deal_value:  7_500_000, stage:'won',         city:'Bangalore', created_at: new Date(_now - 12*_day).toISOString() },
  { id:'dd3', lead_name:'Meera Pillai',  deal_value:  9_200_000, stage:'token_paid',  city:'Chennai',   created_at: new Date(_now - 3*_day).toISOString() },
  { id:'dd4', lead_name:'Rahul Mehta',   deal_value:  8_500_000, stage:'negotiation', city:'Mumbai',    created_at: new Date(_now - 2*_day).toISOString() },
  { id:'dd5', lead_name:'Priya Sharma',  deal_value:  4_200_000, stage:'site_visit',  city:'Pune',      created_at: new Date(_now - 7*_day).toISOString() },
  { id:'dd6', lead_name:'Vikram Singh',  deal_value:  5_800_000, stage:'lost',        city:'Hyderabad', created_at: new Date(_now - 20*_day).toISOString() },
]

const DEMO_MEMBERS: TeamMember[] = [
  { id:'dm1', name:'Rahul Mehta',   role:'senior_agent', is_active:true, email:'rahul@realedge.in' },
  { id:'dm2', name:'Priya Sharma',  role:'agent',        is_active:true, email:'priya@realedge.in' },
  { id:'dm3', name:'Aditya Joshi',  role:'agent',        is_active:true, email:'aditya@realedge.in' },
]

interface Lead {
  id: string
  name: { firstName: string; lastName?: string }
  phones: { primaryPhoneNumber: string | null }
  city?: string | null
  intentScore?: number | null
  sourcePortal?: string | null
  propertyType?: string[] | null
  budgetMin?: number | null
  budgetMax?: number | null
  status?: string | null
  createdAt?: string | null
  agentId?: string | null
}

interface Activity {
  id: string
  type: string
  outcome?: string | null
  notes?: string | null
  createdAt: string
  personId: string
}

interface Deal {
  id: string
  lead_name: string
  deal_value?: number
  stage: string
  city?: string
  assigned_to?: string
  created_at?: string
}

interface TeamMember {
  id: string
  name: string
  role: string
  email?: string
  phone?: string
  is_active: boolean
}

interface ReportData {
  leads: Lead[]
  activities: Activity[]
  deals: Deal[]
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode
}) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

// ─── Productivity report for one agent ────────────────────────────────────────
function ProductivityReport({ data, range, agentName }: {
  data: ReportData; range: string; agentName?: string
}) {
  const since = sinceDate(range)

  const filteredLeads = data.leads.filter(l =>
    !l.createdAt || new Date(l.createdAt) >= since
  )
  const filteredActs  = data.activities.filter(a => new Date(a.createdAt) >= since)
  const filteredDeals = data.deals

  // Stats
  const totalLeads    = filteredLeads.length
  const hotLeads      = filteredLeads.filter(l => (l.intentScore ?? 0) >= 70).length
  const totalCalls    = filteredActs.filter(a => a.type?.toLowerCase().includes('call')).length
  const totalActs     = filteredActs.length
  const wonDeals      = filteredDeals.filter(d => d.stage === 'won').length
  const closedDeals   = filteredDeals.filter(d => ['won', 'lost'].includes(d.stage)).length
  const winRate       = closedDeals ? Math.round((wonDeals / closedDeals) * 100) : 0
  const pipelineVal   = filteredDeals.filter(d => !['won', 'lost'].includes(d.stage)).reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const wonVal        = filteredDeals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.deal_value ?? 0), 0)

  // Source breakdown
  const sourceMap: Record<string, number> = {}
  for (const l of filteredLeads) {
    const s = l.sourcePortal ?? 'Direct'
    sourceMap[s] = (sourceMap[s] ?? 0) + 1
  }
  const sources = Object.entries(sourceMap).sort(([,a],[,b]) => b - a)
  const sourceTotal = sources.reduce((s,[,v]) => s+v, 0)

  // Pipeline stages
  const stageMap: Record<string, number> = {}
  for (const d of filteredDeals.filter(x => x.stage !== 'lost')) {
    stageMap[d.stage] = (stageMap[d.stage] ?? 0) + 1
  }
  const STAGE_LABEL: Record<string, string> = { new: 'New', site_visit: 'Site Visit', negotiation: 'Negotiation', token_paid: 'Token Paid', won: 'Won' }
  const stages = Object.entries(stageMap).sort(([,a],[,b]) => b - a)

  // Activity type breakdown
  const actMap: Record<string, number> = {}
  for (const a of filteredActs) {
    const t = a.type ?? 'Other'
    actMap[t] = (actMap[t] ?? 0) + 1
  }
  const actTypes = Object.entries(actMap).sort(([,a],[,b]) => b - a)

  // City breakdown from leads
  const cityMap: Record<string, number> = {}
  for (const l of filteredLeads) {
    const c = l.city ?? 'Unknown'
    cityMap[c] = (cityMap[c] ?? 0) + 1
  }
  const cities = Object.entries(cityMap).sort(([,a],[,b]) => b - a).slice(0, 5)

  const downloadCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Leads Added', totalLeads],
      ['Hot Leads', hotLeads],
      ['Calls Logged', totalCalls],
      ['Activities Total', totalActs],
      ['Deals Won', wonDeals],
      ['Win Rate %', winRate],
      ['Pipeline Value', fmt(pipelineVal)],
      ['Won Value', fmt(wonVal)],
      ['', ''],
      ['Lead Sources', ''],
      ...sources.map(([s, n]) => [s, n]),
      ['', ''],
      ['Pipeline Stages', ''],
      ...stages.map(([s, n]) => [STAGE_LABEL[s] ?? s, n]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${(agentName ?? 'my').replace(/\s+/g,'_')}_productivity_report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Export row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={downloadCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1px solid ${BORDER}`, borderRadius: 9, background: PANEL, color: MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={13}/> Export CSV
        </button>
      </div>

      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard label="Leads Added"  value={totalLeads}  sub={`${hotLeads} hot`}       color={BLUE}   icon={<TrendingUp size={15}/>}/>
        <StatCard label="Activities"   value={totalActs}   sub={`${totalCalls} calls`}    color={VIOLET} icon={<Activity size={15}/>}/>
        <StatCard label="Deals Won"    value={wonDeals}    sub={fmt(wonVal)}               color={GREEN}  icon={<Trophy size={15}/>}/>
        <StatCard label="Win Rate"     value={`${winRate}%`} sub={`${closedDeals} closed`} color={AMBER}  icon={<Target size={15}/>}/>
      </div>

      {/* Pipeline value banner */}
      {pipelineVal > 0 && (
        <div style={{ background: BLUE_D, border: `1px solid #BFDBFE`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Active Pipeline</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>{fmt(pipelineVal)}</div>
          </div>
          <BarChart2 size={28} color={BLUE} style={{ opacity: 0.4 }}/>
        </div>
      )}

      {/* Lead sources */}
      {sources.length > 0 && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '11px 16px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Lead Sources</span>
          </div>
          {sources.map(([src, count]) => {
            const pct = sourceTotal ? Math.round((count / sourceTotal) * 100) : 0
            return (
              <div key={src} style={{ padding: '10px 16px', borderBottom: `1px solid #F8FAFC`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, minWidth: 100 }}>{src}</span>
                <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3 }}>
                  <div style={{ height: '100%', background: BLUE, borderRadius: 3, width: `${pct}%`, transition: 'width 0.5s' }}/>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: BLUE, minWidth: 28, textAlign: 'right' }}>{count}</span>
                <span style={{ fontSize: 11, color: LABEL, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Pipeline stages + Activity types side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {/* Pipeline stages */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Pipeline Stages</span>
          </div>
          {stages.length === 0
            ? <div style={{ padding: '16px 14px', fontSize: 12, color: LABEL }}>No deals yet</div>
            : stages.map(([stage, count]) => (
                <div key={stage} style={{ padding: '9px 14px', borderBottom: `1px solid #F8FAFC`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: TEXT }}>{STAGE_LABEL[stage] ?? stage}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: stage === 'won' ? GREEN : TEXT }}>{count}</span>
                </div>
              ))
          }
        </div>

        {/* Activity breakdown */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Activity Breakdown</span>
          </div>
          {actTypes.length === 0
            ? <div style={{ padding: '16px 14px', fontSize: 12, color: LABEL }}>No activities yet</div>
            : actTypes.map(([type, count]) => (
                <div key={type} style={{ padding: '9px 14px', borderBottom: `1px solid #F8FAFC`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: TEXT, textTransform: 'capitalize' }}>{type.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: VIOLET }}>{count}</span>
                </div>
              ))
          }
        </div>
      </div>

      {/* City focus */}
      {cities.length > 0 && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={13} color={MUTED}/>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>City Focus</span>
          </div>
          <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {cities.map(([city, count]) => (
              <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 20 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{city}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: BLUE, background: BLUE_D, borderRadius: 10, padding: '1px 6px' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalLeads === 0 && totalActs === 0 && filteredDeals.length === 0 && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '40px 24px', textAlign: 'center', color: MUTED }}>
          <FileText size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }}/>
          <p style={{ margin: 0, fontSize: 14 }}>No data for the selected time range.</p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab,        setTab]       = useState<'mine' | 'team'>('mine')
  const [range,      setRange]     = useState('30d')
  const [data,       setData]      = useState<ReportData>({ leads: [], activities: [], deals: [] })
  const [loading,    setLoading]   = useState(true)
  const [members,    setMembers]   = useState<TeamMember[]>([])
  const [activeAgent,setActiveAgent] = useState<TeamMember | null>(null)
  const [plan,       setPlan]      = useState<'solo' | 'teams'>('solo')
  const [role,       setRole]      = useState<'admin' | 'agent'>('admin')
  const [isDemo,     setIsDemo]    = useState(false)

  useEffect(() => {
    setPlan(getPlan())
    setRole(getRole())
    const sync = () => { setPlan(getPlan()); setRole(getRole()) }
    window.addEventListener('plan-changed', sync)
    return () => window.removeEventListener('plan-changed', sync)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lr, ar, dr] = await Promise.all([
        fetch('/api/crm/leads?limit=500').then(r => r.json()),
        fetch('/api/crm/activities?limit=500').then(r => r.json()),
        fetch('/api/deals').then(r => r.json()),
      ])
      const leads: Lead[]          = lr.data?.leads ?? lr.data ?? lr.leads ?? []
      const liveActs: Activity[]   = ar.data?.activities ?? ar.data ?? ar.activities ?? []
      const liveDeals: Deal[]      = dr.data ?? dr.deals ?? []
      // Fall back to demo data so the UI is never empty during development / demo
      const usingDemo  = liveActs.length === 0 && liveDeals.length === 0
      const activities = liveActs.length  > 0 ? liveActs  : DEMO_ACTIVITIES
      const deals      = liveDeals.length > 0 ? liveDeals : DEMO_DEALS
      setIsDemo(usingDemo)
      setData({ leads, activities, deals })

      if (plan === 'teams' && role === 'admin') {
        const mr = await fetch('/api/team').then(r => r.json())
        const ms: TeamMember[] = mr.members ?? []
        setMembers(ms.length > 0 ? ms : DEMO_MEMBERS)
      }
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [plan, role])

  useEffect(() => { load() }, [load])

  // In dev mode all data belongs to one user — show full dataset per agent so the UI is useful
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agentData = (_agent: TeamMember): ReportData => data

  const isTeamsAdmin = plan === 'teams' && role === 'admin'

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    border: 'none', cursor: 'pointer',
    background: active ? BLUE : 'transparent',
    color: active ? '#fff' : MUTED,
    display: 'flex', alignItems: 'center', gap: 6,
  })

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '24px 28px 48px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: VIOLET_D, border: `1px solid ${VIOLET}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={16} color={VIOLET}/>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '-0.01em' }}>Reports</h1>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Productivity reports for you and your team</p>
          </div>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: `1px solid ${BORDER}`, borderRadius: 9, background: PANEL, color: MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={12}/> Refresh
        </button>
      </div>

      {/* Tabs + Range selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4 }}>
          <button style={tabStyle(tab === 'mine')} onClick={() => setTab('mine')}>
            <User size={13}/> My Report
          </button>
          {isTeamsAdmin ? (
            <button style={tabStyle(tab === 'team')} onClick={() => setTab('team')}>
              <Users size={13}/> Team Reports
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, color: LABEL, fontSize: 13, fontWeight: 700, cursor: 'not-allowed', opacity: 0.6 }}>
              <Lock size={12}/> Team Reports
              <span style={{ fontSize: 9, fontWeight: 800, background: AMBER_D, color: AMBER, border: `1px solid ${AMBER}30`, borderRadius: 20, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teams</span>
            </div>
          )}
        </div>

        {/* Time range */}
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 3 }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: range === r.id ? PANEL : 'transparent', color: range === r.id ? TEXT : MUTED, boxShadow: range === r.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: MUTED, padding: 40 }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }}/> Loading report data…
        </div>
      ) : tab === 'mine' ? (
        /* ── My Productivity Report ── */
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE_D, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={15} color={BLUE}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>My Productivity Report</div>
              <div style={{ fontSize: 11, color: MUTED }}>Your personal performance overview</div>
            </div>
            {isDemo && (
              <span style={{ fontSize: 9, fontWeight: 800, background: AMBER_D, color: AMBER, border: `1px solid ${AMBER}30`, borderRadius: 20, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Sample data
              </span>
            )}
          </div>
          <ProductivityReport data={data} range={range} />
        </div>
      ) : (
        /* ── Team Reports (admin only) ── */
        <div>
          {members.length === 0 ? (
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center', color: MUTED, maxWidth: 480 }}>
              <Users size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }}/>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: TEXT }}>No agents added yet</p>
              <p style={{ margin: 0, fontSize: 13 }}>Add agents in the Team section to see their individual reports here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Agent list */}
              <div style={{ width: 220, flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px 2px' }}>Select Agent</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map(m => {
                    const sel = activeAgent?.id === m.id
                    const ad  = agentData(m)
                    const won = ad.deals.filter(d => d.stage === 'won').length
                    const leads = ad.leads.filter(l => !l.createdAt || new Date(l.createdAt) >= sinceDate(range)).length
                    return (
                      <button key={m.id} onClick={() => setActiveAgent(sel ? null : m)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${sel ? BLUE : BORDER}`, background: sel ? BLUE_D : PANEL, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: sel ? BLUE : `${VIOLET}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: sel ? '#fff' : VIOLET, flexShrink: 0 }}>
                          {m.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: sel ? BLUE : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                          <div style={{ fontSize: 10, color: MUTED }}>{leads} leads · {won} won</div>
                        </div>
                        {sel && <ChevronRight size={13} color={BLUE}/>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Agent report */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {activeAgent ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 11, background: `${VIOLET}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: VIOLET }}>
                        {activeAgent.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{activeAgent.name} — Productivity Report</div>
                        <div style={{ fontSize: 11, color: MUTED, textTransform: 'capitalize' }}>{activeAgent.role.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <ProductivityReport data={agentData(activeAgent)} range={range} agentName={activeAgent.name}/>
                  </div>
                ) : (
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '48px 24px', textAlign: 'center', color: MUTED }}>
                    <Users size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.25 }}/>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>Select an agent</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>Choose an agent from the left to view their report.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
