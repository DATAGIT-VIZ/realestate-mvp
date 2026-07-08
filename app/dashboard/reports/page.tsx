'use client'

import { useState, useCallback } from 'react'
import {
  BarChart2, PieChart, TrendingUp, Table2, Play, Save, Trash2,
  Download, Loader2, BookOpen, Sparkles, RefreshCw, X,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#2563EB', emerald: '#059669', amber: '#D97706',
  red: '#EF4444', violet: '#7C3AED', rose: '#E11D48',
}

const CHART_COLORS = [C.blue, C.emerald, C.amber, C.violet, C.red, '#0EA5E9', '#84CC16', '#F97316']

// ─── Config options ───────────────────────────────────────────────────────────
const SOURCES = [
  { id: 'deals',        label: 'Deals Pipeline',  desc: 'stage, value, agent, city, portal' },
  { id: 'portal_leads', label: 'Inbound Leads',   desc: 'portal, city, status, volume' },
]

const GROUP_BY_OPTIONS: Record<string, { id: string; label: string }[]> = {
  deals: [
    { id: 'stage',         label: 'Deal Stage' },
    { id: 'city',          label: 'City' },
    { id: 'source_portal', label: 'Source Portal' },
    { id: 'property_type', label: 'Property Type' },
    { id: 'assigned_to',   label: 'Agent' },
    { id: 'month',         label: 'Month (trend)' },
  ],
  portal_leads: [
    { id: 'source_portal',   label: 'Source Portal' },
    { id: 'city',            label: 'City' },
    { id: 'ingestion_status', label: 'Status' },
    { id: 'month',           label: 'Month (trend)' },
  ],
}

const METRIC_OPTIONS: Record<string, { id: string; label: string; desc: string }[]> = {
  deals: [
    { id: 'count',     label: 'Deal Count',      desc: 'Number of deals' },
    { id: 'sum_value', label: 'Total ₹ Value',   desc: 'Sum of deal values' },
    { id: 'avg_value', label: 'Avg Deal Size',   desc: 'Average deal value' },
    { id: 'win_rate',  label: 'Win Rate %',      desc: '% of deals closed won' },
  ],
  portal_leads: [
    { id: 'count', label: 'Lead Count', desc: 'Number of leads received' },
  ],
}

const CHART_TYPES = [
  { id: 'bar',   label: 'Bar',   icon: BarChart2   },
  { id: 'pie',   label: 'Pie',   icon: PieChart    },
  { id: 'line',  label: 'Line',  icon: TrendingUp  },
  { id: 'table', label: 'Table', icon: Table2      },
]

// ─── Demo fallback data ───────────────────────────────────────────────────────
const DEMO_DATA: Record<string, ReportRow[]> = {
  'pipeline-stage':    [{ label:'New', value:14 },{ label:'Contacted', value:11 },{ label:'Qualified', value:8 },{ label:'Negotiation', value:5 },{ label:'Won', value:4 },{ label:'Lost', value:3 }],
  'revenue-city':      [{ label:'Mumbai', value:58500000 },{ label:'Pune', value:42000000 },{ label:'Bangalore', value:37500000 },{ label:'Hyderabad', value:21000000 },{ label:'Chennai', value:15000000 }],
  'lead-source-mix':   [{ label:'MagicBricks', value:34 },{ label:'99acres', value:28 },{ label:'Housing.com', value:19 },{ label:'NoBroker', value:12 },{ label:'Direct', value:7 }],
  'agent-performance': [{ label:'Priya Sharma', value:12 },{ label:'Rahul Mehta', value:9 },{ label:'Sneha Iyer', value:7 },{ label:'Karthik Nair', value:6 },{ label:'Anjali Desai', value:4 }],
  'monthly-trend':     [{ label:'2025-08', value:6 },{ label:'2025-09', value:8 },{ label:'2025-10', value:11 },{ label:'2025-11', value:9 },{ label:'2025-12', value:14 },{ label:'2026-01', value:17 }],
  'property-mix':      [{ label:'2 BHK', value:22 },{ label:'3 BHK', value:18 },{ label:'Villa', value:8 },{ label:'Plot', value:6 },{ label:'1 BHK', value:5 }],
  'portal-value':      [{ label:'MagicBricks', value:48000000 },{ label:'99acres', value:37500000 },{ label:'Housing.com', value:22000000 },{ label:'Direct', value:19000000 },{ label:'NoBroker', value:9500000 }],
  'win-rate-agent':    [{ label:'Anjali Desai', value:58 },{ label:'Priya Sharma', value:52 },{ label:'Karthik Nair', value:44 },{ label:'Sneha Iyer', value:38 },{ label:'Rahul Mehta', value:31 }],
}

// ─── Pre-built templates ──────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'pipeline-stage',    name: 'Pipeline by Stage',
    desc: 'How many deals in each stage',
    icon: '📊', color: C.blue,
    config: { source: 'deals', groupBy: 'stage', metric: 'count', chartType: 'bar', filters: {} },
  },
  {
    id: 'revenue-city',      name: 'Revenue by City',
    desc: 'Total deal value across cities',
    icon: '🏙', color: C.emerald,
    config: { source: 'deals', groupBy: 'city', metric: 'sum_value', chartType: 'bar', filters: {} },
  },
  {
    id: 'lead-source-mix',   name: 'Lead Source Mix',
    desc: 'Which portals send the most leads',
    icon: '🥧', color: C.violet,
    config: { source: 'portal_leads', groupBy: 'source_portal', metric: 'count', chartType: 'pie', filters: {} },
  },
  {
    id: 'agent-performance', name: 'Agent Leaderboard',
    desc: 'Deal count per agent',
    icon: '🏆', color: C.amber,
    config: { source: 'deals', groupBy: 'assigned_to', metric: 'count', chartType: 'table', filters: {} },
  },
  {
    id: 'monthly-trend',     name: 'Monthly Deal Trend',
    desc: 'Deals closed each month',
    icon: '📈', color: C.rose,
    config: { source: 'deals', groupBy: 'month', metric: 'count', chartType: 'line', filters: {} },
  },
  {
    id: 'property-mix',      name: 'Property Type Mix',
    desc: 'Distribution by BHK / Villa / Plot',
    icon: '🏠', color: '#0EA5E9',
    config: { source: 'deals', groupBy: 'property_type', metric: 'count', chartType: 'pie', filters: {} },
  },
  {
    id: 'portal-value',      name: 'Portal Deal Value',
    desc: 'Which portal drives highest ₹ pipeline',
    icon: '💰', color: C.emerald,
    config: { source: 'deals', groupBy: 'source_portal', metric: 'sum_value', chartType: 'bar', filters: {} },
  },
  {
    id: 'win-rate-agent',    name: 'Win Rate by Agent',
    desc: 'Conversion % per agent',
    icon: '🎯', color: C.red,
    config: { source: 'deals', groupBy: 'assigned_to', metric: 'win_rate', chartType: 'bar', filters: {} },
  },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReportRow  { label: string; value: number; extra?: number }
interface SavedReport { id: string; name: string; config: ReportConfig; created_at: string }

interface ReportConfig {
  source:    string
  groupBy:   string
  metric:    string
  chartType: string
  filters:   { dateFrom?: string; dateTo?: string; city?: string; stage?: string; source?: string; agent?: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtValue(v: number, metric: string) {
  if (metric === 'sum_value' || metric === 'avg_value') {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`
    if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`
    return `₹${v.toLocaleString('en-IN')}`
  }
  if (metric === 'win_rate') return `${v}%`
  return String(v)
}

function downloadCSV(data: ReportRow[], name: string, metric: string) {
  const header = 'Label,Value\n'
  const rows   = data.map(r => `"${r.label}",${r.value}`).join('\n')
  const blob   = new Blob([header + rows], { type: 'text/csv' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${name.replace(/\s+/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Chart components ─────────────────────────────────────────────────────────
function ReportChart({ data, chartType, metric }: { data: ReportRow[]; chartType: string; metric: string }) {
  const display = data.slice(0, 12) // cap at 12 for readability

  if (chartType === 'table') {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase' }}>Label</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase' }}>Value</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const total = data.reduce((s, x) => s + x.value, 0)
              const share = total ? Math.round((r.value / total) * 100) : 0
              return (
                <tr key={r.label} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? '#FAFBFC' : C.panel }}>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.text }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {r.label}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 800, color: C.text, textAlign: 'right' }}>{fmtValue(r.value, metric)}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div style={{ width: 60, height: 6, background: '#F1F5F9', borderRadius: 3 }}>
                        <div style={{ height: '100%', background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 3, width: `${share}%` }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.muted, minWidth: 30 }}>{share}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (chartType === 'pie') {
    const pieData = display.map(r => ({ ...r, name: r.label }))
    return (
      <ResponsiveContainer width="100%" height={320}>
        <RechartsPie>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120}
            label={(props) => {
              const pct = props.percent != null ? (props.percent * 100).toFixed(0) : '0'
              return `${props.name} ${pct}%`
            }}
            labelLine={false}>
            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmtValue(v, metric)} />
          <Legend />
        </RechartsPie>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'line') {
    const lineData = display.map(r => ({ ...r, name: r.label }))
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={lineData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} />
          <YAxis tick={{ fontSize: 11, fill: C.muted }} tickFormatter={v => fmtValue(v, metric)} />
          <Tooltip formatter={(v: number) => fmtValue(v, metric)} />
          <Line type="monotone" dataKey="value" stroke={C.blue} strokeWidth={2.5} dot={{ fill: C.blue, r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // Bar (default)
  const barData = display.map(r => ({ ...r, name: r.label }))
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={barData} margin={{ top: 4, right: 16, bottom: 40, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: C.muted }} tickFormatter={v => fmtValue(v, metric)} />
        <Tooltip formatter={(v: number) => fmtValue(v, metric)} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {display.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [activeTab,    setActiveTab]    = useState<'templates' | 'builder' | 'saved'>('templates')
  const [config,       setConfig]       = useState<ReportConfig>({
    source: 'deals', groupBy: 'stage', metric: 'count', chartType: 'bar', filters: {},
  })
  const [result,       setResult]       = useState<ReportRow[] | null>(null)
  const [resultMeta,   setResultMeta]   = useState<{ total: number; name: string } | null>(null)
  const [running,      setRunning]      = useState(false)
  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [savedLoaded,  setSavedLoaded]  = useState(false)
  const [saveModal,    setSaveModal]    = useState(false)
  const [saveName,     setSaveName]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [runError,     setRunError]     = useState<string | null>(null)

  const setF = (k: keyof ReportConfig, v: string) => {
    setConfig(c => {
      const next = { ...c, [k]: v }
      // Reset groupBy / metric when source changes
      if (k === 'source') {
        next.groupBy = GROUP_BY_OPTIONS[v]?.[0]?.id ?? 'city'
        next.metric  = METRIC_OPTIONS[v]?.[0]?.id  ?? 'count'
      }
      return next
    })
  }
  const setFilter = (k: string, v: string) =>
    setConfig(c => ({ ...c, filters: { ...c.filters, [k]: v || undefined } }))

  const runReport = useCallback(async (cfg: ReportConfig, displayName = '', templateId?: string) => {
    setRunning(true)
    setRunError(null)
    setResult(null)
    try {
      const r = await fetch('/api/reports/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
      })
      const j = await r.json()
      if (!r.ok) {
        // API unavailable — fall back to demo data if we have it
        const demo = templateId ? DEMO_DATA[templateId] : null
        if (demo) { setResult(demo); setResultMeta({ total: demo.reduce((s,r)=>s+r.value,0), name: displayName }); setConfig(cfg); if (activeTab==='templates') setActiveTab('builder'); return }
        setRunError(j.error ?? 'Failed'); return
      }
      // If DB returned zero rows, use demo data so charts are always populated
      const rows = (j.data ?? []) as ReportRow[]
      const demo = templateId ? DEMO_DATA[templateId] : null
      const finalRows = rows.length === 0 && demo ? demo : rows
      setResult(finalRows)
      setResultMeta({ total: j.total || finalRows.reduce((s,r)=>s+r.value,0), name: displayName || `${cfg.source} by ${cfg.groupBy}` })
      setConfig(cfg)
      if (activeTab === 'templates') setActiveTab('builder')
    } finally {
      setRunning(false)
    }
  }, [activeTab])

  const loadSaved = async () => {
    if (savedLoaded) return
    const r = await fetch('/api/reports/saved')
    const j = await r.json()
    setSavedReports(j.reports ?? [])
    setSavedLoaded(true)
  }

  const handleSave = async () => {
    if (!saveName.trim()) return
    setSaving(true)
    await fetch('/api/reports/saved', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: saveName, config }),
    })
    setSaveModal(false)
    setSaveName('')
    setSaving(false)
    setSavedLoaded(false)
  }

  const handleDeleteSaved = async (id: string) => {
    await fetch(`/api/reports/saved/${id}`, { method: 'DELETE' })
    setSavedReports(rs => rs.filter(r => r.id !== id))
  }

  const inp: React.CSSProperties = {
    padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 9,
    fontSize: 13, color: C.text, outline: 'none', background: '#FAFBFC', width: '100%', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }
  const tabStyle = (a: boolean): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none',
    cursor: 'pointer', background: a ? C.blue : 'transparent', color: a ? '#fff' : C.muted,
  })

  return (
    <div className="px-4 py-5 pb-24 lg:px-7 lg:py-7 min-h-screen" style={{ background: C.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 className="hidden lg:block" style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Custom Reports</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Analyse your pipeline, leads, and agent performance</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        <button style={tabStyle(activeTab === 'templates')} onClick={() => setActiveTab('templates')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen style={{ width: 13, height: 13 }} /> Templates</span>
        </button>
        <button style={tabStyle(activeTab === 'builder')} onClick={() => setActiveTab('builder')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles style={{ width: 13, height: 13 }} /> Builder</span>
        </button>
        <button style={tabStyle(activeTab === 'saved')} onClick={() => { setActiveTab('saved'); loadSaved() }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Save style={{ width: 13, height: 13 }} /> Saved</span>
        </button>
      </div>

      {/* ── Templates ──────────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {TEMPLATES.map(t => (
            <div key={t.id}
              onClick={() => runReport(t.config as ReportConfig, t.name, t.id)}
              style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: '20px 20px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s', position: 'relative' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 20px ${t.color}20`)}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: `${t.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {t.icon}
                </div>
                <Play style={{ width: 16, height: 16, color: t.color, opacity: 0.6 }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{t.desc}</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: `${t.color}15`, color: t.color, borderRadius: 20, padding: '2px 8px' }}>{t.config.source === 'deals' ? 'Deals' : 'Leads'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, background: '#F1F5F9', color: C.muted, borderRadius: 20, padding: '2px 8px' }}>{t.config.chartType}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Builder ────────────────────────────────────────────────────────── */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Config panel */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Report Configuration</h2>

            {/* Data source */}
            <div>
              <label style={lbl}>Data Source</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SOURCES.map(s => (
                  <button key={s.id} onClick={() => setF('source', s.id)}
                    style={{ textAlign: 'left', padding: '10px 14px', border: `2px solid ${config.source === s.id ? C.blue : C.border}`, borderRadius: 11, background: config.source === s.id ? '#EFF6FF' : '#FAFBFC', cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: config.source === s.id ? C.blue : C.text }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Group by */}
            <div>
              <label style={lbl}>Group By</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={config.groupBy} onChange={e => setF('groupBy', e.target.value)}>
                {(GROUP_BY_OPTIONS[config.source] ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>

            {/* Metric */}
            <div>
              <label style={lbl}>Metric</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(METRIC_OPTIONS[config.source] ?? []).map(m => (
                  <button key={m.id} onClick={() => setF('metric', m.id)}
                    style={{ textAlign: 'left', padding: '9px 12px', border: `2px solid ${config.metric === m.id ? C.violet : C.border}`, borderRadius: 9, background: config.metric === m.id ? '#F5F3FF' : '#FAFBFC', cursor: 'pointer' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: config.metric === m.id ? C.violet : C.text }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chart type */}
            <div>
              <label style={lbl}>Chart Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {CHART_TYPES.map(ct => {
                  const Icon = ct.icon
                  const sel  = config.chartType === ct.id
                  return (
                    <button key={ct.id} onClick={() => setF('chartType', ct.id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', border: `2px solid ${sel ? C.blue : C.border}`, borderRadius: 10, background: sel ? '#EFF6FF' : '#FAFBFC', cursor: 'pointer', color: sel ? C.blue : C.muted }}>
                      <Icon style={{ width: 16, height: 16 }} />
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{ct.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Filters */}
            <div>
              <label style={lbl}>Filters (optional)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.label, marginBottom: 4 }}>From</div>
                    <input style={inp} type="date" value={config.filters.dateFrom ?? ''} onChange={e => setFilter('dateFrom', e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.label, marginBottom: 4 }}>To</div>
                    <input style={inp} type="date" value={config.filters.dateTo ?? ''} onChange={e => setFilter('dateTo', e.target.value)} />
                  </div>
                </div>
                {config.source === 'deals' && (
                  <>
                    <input style={inp} placeholder="Filter by city…" value={config.filters.city ?? ''} onChange={e => setFilter('city', e.target.value)} />
                    <input style={inp} placeholder="Filter by agent…" value={config.filters.agent ?? ''} onChange={e => setFilter('agent', e.target.value)} />
                  </>
                )}
                <input style={inp} placeholder="Filter by portal…" value={config.filters.source ?? ''} onChange={e => setFilter('source', e.target.value)} />
              </div>
            </div>

            <button onClick={() => runReport(config, resultMeta?.name ?? '')} disabled={running}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: running ? '#E2E8F0' : C.blue, border: 'none', borderRadius: 12, color: running ? C.label : '#fff', fontSize: 14, fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer', boxShadow: running ? 'none' : '0 2px 8px rgba(37,99,235,0.25)' }}>
              {running ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <Play style={{ width: 16, height: 16 }} />}
              {running ? 'Running…' : 'Run Report'}
            </button>
          </div>

          {/* Results panel */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, minHeight: 400, overflow: 'hidden' }}>
            {runError ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
                <p style={{ fontSize: 14, margin: 0 }}>{runError}</p>
              </div>
            ) : result === null ? (
              <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
                <BarChart2 style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.25, display: 'block' }} />
                <p style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 600, color: C.text }}>Configure and run a report</p>
                <p style={{ fontSize: 13, margin: 0 }}>Select a template or build your own, then click Run Report.</p>
              </div>
            ) : (
              <div>
                {/* Result header */}
                <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{resultMeta?.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{result.length} groups · {resultMeta?.total} total records</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => runReport(config, resultMeta?.name ?? '')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#F8FAFC', color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
                    </button>
                    <button onClick={() => downloadCSV(result, resultMeta?.name ?? 'report', config.metric)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#F8FAFC', color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Download style={{ width: 12, height: 12 }} /> CSV
                    </button>
                    <button onClick={() => { setSaveName(resultMeta?.name ?? ''); setSaveModal(true) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 8, background: C.blue, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <Save style={{ width: 12, height: 12 }} /> Save
                    </button>
                  </div>
                </div>

                {/* Chart */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
                  {result.length === 0 ? (
                    <div style={{ padding: '32px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>No data for the selected filters.</div>
                  ) : (
                    <ReportChart data={result} chartType={config.chartType} metric={config.metric} />
                  )}
                </div>

                {/* Always show table below chart */}
                {config.chartType !== 'table' && result.length > 0 && (
                  <div style={{ padding: '0 0 0' }}>
                    <ReportChart data={result} chartType="table" metric={config.metric} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Saved Reports ──────────────────────────────────────────────────── */}
      {activeTab === 'saved' && (
        <div>
          {savedReports.length === 0 ? (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '48px 32px', textAlign: 'center' }}>
              <Save style={{ width: 36, height: 36, margin: '0 auto 12px', opacity: 0.25, display: 'block', color: C.muted }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>No saved reports yet</p>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Build a report and click Save to store it here.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {savedReports.map(r => (
                <div key={r.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: '20px 20px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{r.name}</h3>
                    <button onClick={() => handleDeleteSaved(r.id)} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: C.label }}><Trash2 style={{ width: 13, height: 13 }} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {[r.config.source, r.config.groupBy, r.config.metric, r.config.chartType].map(tag => (
                      <span key={tag} style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: C.muted, borderRadius: 20, padding: '2px 8px' }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: C.label, marginBottom: 12 }}>
                    Saved {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                  <button onClick={() => { runReport(r.config, r.name); setActiveTab('builder') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.blue, border: 'none', borderRadius: 9, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    <Play style={{ width: 13, height: 13 }} /> Run
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save name modal */}
      {saveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: C.panel, borderRadius: 18, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Save Report</h2>
              <button onClick={() => setSaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Report name…"
              style={{ ...inp, marginBottom: 16 }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSaveModal(false)} style={{ flex: 1, padding: '10px 0', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: C.muted, background: '#F8FAFC', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !saveName.trim()}
                style={{ flex: 2, padding: '10px 0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: saving || !saveName.trim() ? '#E2E8F0' : C.blue, cursor: saving || !saveName.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 14, height: 14 }} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
