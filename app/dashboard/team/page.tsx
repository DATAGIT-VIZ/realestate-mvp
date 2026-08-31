'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, Trash, PencilSimple, Trophy, TrendUp,
  Handshake, Target, Users, Phone, Envelope, CircleNotch,
  CheckCircle, Circle, Star, Medal, Warning, Lightning,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'

const WORKSPACE_TABS = [
  { label: 'Tasks', href: '/dashboard/tasks' },
  { label: 'Team',  href: '/dashboard/team', teamsOnly: true },
]

const C = {
  bg: '#FAFAF8', panel: '#FFFFFF', border: '#E2E2DC',
  text: '#263238', muted: '#78889B', label: '#A4B1BE',
  blue: '#1D4ED8', emerald: '#059669', amber: '#F59E0B',
  red: '#EF4444', violet: '#1D4ED8',
}
const ORANGE_DIM = 'rgba(29,78,216,0.08)'
const ORANGE_BRD = 'rgba(29,78,216,0.22)'

const ROLES      = ['agent', 'senior_agent', 'manager']
const ROLE_LABEL: Record<string, string> = { agent: 'Agent', senior_agent: 'Sr. Agent', manager: 'Manager' }
const ROLE_COLOR: Record<string, string> = { agent: '#1D4ED8', senior_agent: '#F59E0B', manager: '#059669' }

const CITIES     = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata', 'Surat', 'Jaipur']
const PROP_TYPES = ['1BHK', '2BHK', '3BHK', '4BHK+', 'Villa', 'Plot', 'Commercial']

interface TeamMember {
  id: string
  name: string
  email?: string
  phone?: string
  role: string
  specialty_cities: string[]
  specialty_types: string[]
  monthly_target: number
  is_active: boolean
  created_at: string
}

interface Deal {
  id: string
  assigned_to?: string
  stage: string
  deal_value?: number
}

interface AgentStats {
  name: string
  active: number
  won: number
  pipeline: number
  wonValue: number
  winRate: number
  target: number
  member?: TeamMember
}

function fmt(n: number) {
  if (!n) return '₹0'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

const BLANK: Partial<TeamMember> = {
  name: '', email: '', phone: '', role: 'agent',
  specialty_cities: [], specialty_types: [], monthly_target: 5, is_active: true,
}

// ─── Agent Modal ──────────────────────────────────────────────────────────────
function AgentModal({ member, onClose, onSave }: {
  member: TeamMember | null
  onClose: () => void
  onSave: (data: Partial<TeamMember>) => Promise<void>
}) {
  const [form,   setForm]   = useState<Partial<TeamMember>>(member ?? { ...BLANK })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set  = (k: keyof TeamMember, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const tog  = (field: 'specialty_cities' | 'specialty_types', val: string) =>
    set(field, (form[field] ?? []).includes(val)
      ? (form[field] as string[]).filter(x => x !== val)
      : [...(form[field] as string[]), val])

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`,
    borderRadius: 9, fontSize: 13, color: C.text, outline: 'none',
    background: '#F5F6FA', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block' }

  const handleSave = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return }
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (e: any) { setError(e.message ?? 'Failed'); setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.panel, borderRadius: 2, padding: 20, width: 'min(520px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{member ? 'Edit Agent' : 'Add Agent'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X style={{ width: 20, height: 20 }} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Name *</label>
              <input style={inp} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Rahul Sharma" />
            </div>
            <div>
              <label style={lbl}>Role</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.role ?? 'agent'} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Email</label>
              <div style={{ position: 'relative' }}>
                <Envelope style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: C.label }} />
                <input style={{ ...inp, paddingLeft: 30 }} type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="agent@example.com" />
              </div>
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <div style={{ position: 'relative' }}>
                <Phone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: C.label }} />
                <input style={{ ...inp, paddingLeft: 30 }} type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="9876543210" />
              </div>
            </div>
          </div>

          <div>
            <label style={lbl}>Monthly Target (Deals)</label>
            <input style={{ ...inp, maxWidth: 120 }} type="number" min={1} value={form.monthly_target ?? 5} onChange={e => set('monthly_target', Number(e.target.value))} />
          </div>

          <div>
            <label style={lbl}>City Specialties</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CITIES.map(c => {
                const on = (form.specialty_cities ?? []).includes(c)
                return <button key={c} type="button" onClick={() => tog('specialty_cities', c)}
                  style={{ padding: '4px 10px', borderRadius: 2, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? C.blue : C.border}`, background: on ? 'rgba(29,78,216,0.08)' : '#F5F6FA', color: on ? C.blue : C.muted, cursor: 'pointer' }}>
                  {c}
                </button>
              })}
            </div>
          </div>

          <div>
            <label style={lbl}>Property Specialties</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PROP_TYPES.map(t => {
                const on = (form.specialty_types ?? []).includes(t)
                return <button key={t} type="button" onClick={() => tog('specialty_types', t)}
                  style={{ padding: '4px 10px', borderRadius: 2, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? C.violet : C.border}`, background: on ? 'rgba(29,78,216,0.08)' : '#F5F6FA', color: on ? C.violet : C.muted, cursor: 'pointer' }}>
                  {t}
                </button>
              })}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active ?? true} onChange={e => set('is_active', e.target.checked)} />
            <span style={{ fontSize: 13, color: C.text }}>Active (available for lead assignment)</span>
          </label>

          {error && <div style={{ background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 9, padding: '9px 12px', fontSize: 13, color: C.red }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px 0', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, color: C.muted, background: '#F5F6FA', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px 0', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#fff', background: saving ? '#E2E8F0' : C.blue, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              {saving ? <><CircleNotch style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> Saving…</> : (member ? 'Save Changes' : 'Add Agent')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [members,    setMembers]    = useState<TeamMember[]>([])
  const [deals,      setDeals]      = useState<Deal[]>([])
  const [tasks,      setTasks]      = useState<{ assigned_to: string | null; status: string; due_date: string }[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState<TeamMember | 'new' | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [activeTab,  setActiveTab]  = useState<'leaderboard' | 'agents'>('leaderboard')

  const [assignedCounts, setAssignedCounts] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, dRes, distRes, tRes] = await Promise.all([
      fetch('/api/team'),
      fetch('/api/deals'),
      fetch('/api/crm/leads/distribute'),
      fetch('/api/crm/tasks'),
    ])
    const [mJson, dJson, distJson, tJson] = await Promise.all([mRes.json(), dRes.json(), distRes.json(), tRes.json()])
    setMembers(mJson.members ?? [])
    setDeals(dJson.deals ?? [])
    setAssignedCounts(distJson.perAgent ?? {})
    setTasks(tJson.tasks ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<TeamMember>) => {
    const isEdit = modal && modal !== 'new'
    const res = isEdit
      ? await fetch(`/api/team/${(modal as TeamMember).id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      : await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error ?? `Server error ${res.status}`)
    }
    await load()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/team/${id}`, { method: 'DELETE' })
    setMembers(ms => ms.filter(m => m.id !== id))
    setDeleting(null)
  }

  // Compute per-agent stats from deals
  const agentStats: AgentStats[] = members.map(m => {
    const mDeals = deals.filter(d => d.assigned_to?.toLowerCase() === m.name.toLowerCase())
    const active = mDeals.filter(d => !['won', 'lost'].includes(d.stage)).length
    const won    = mDeals.filter(d => d.stage === 'won').length
    const lost   = mDeals.filter(d => d.stage === 'lost').length
    const closed = won + lost
    return {
      name:     m.name,
      active,
      won,
      pipeline: mDeals.filter(d => !['lost'].includes(d.stage)).reduce((s, d) => s + (d.deal_value ?? 0), 0),
      wonValue: mDeals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.deal_value ?? 0), 0),
      winRate:  closed ? Math.round((won / closed) * 100) : 0,
      target:   m.monthly_target,
      member:   m,
    }
  }).sort((a, b) => b.won - a.won || b.pipeline - a.pipeline)

  const totalPipeline = agentStats.reduce((s, a) => s + a.pipeline, 0)
  const totalWon      = agentStats.reduce((s, a) => s + a.won, 0)

  const rankBadge = (i: number) => {
    const ranks = [
      { bg: 'rgba(29,78,216,0.10)', color: '#1D4ED8', border: 'rgba(29,78,216,0.28)' },
      { bg: 'rgba(120,136,155,0.10)', color: '#5A6A78', border: 'rgba(120,136,155,0.28)' },
      { bg: 'rgba(245,158,11,0.10)', color: '#F59E0B', border: 'rgba(245,158,11,0.28)' },
    ]
    const r = ranks[i]
    if (r) return (
      <div style={{ width: 26, height: 26, borderRadius: 2, background: r.bg, border: `1px solid ${r.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: r.color }}>
        #{i + 1}
      </div>
    )
    return <span style={{ fontSize: 12, fontWeight: 600, color: C.label }}>#{i + 1}</span>
  }

  const tab = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    border: 'none', cursor: 'pointer',
    background: active ? C.blue : 'transparent',
    color: active ? '#fff' : C.muted,
  })

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      <PageTabBar tabs={WORKSPACE_TABS} />
    <div className="px-4 py-5 pb-24 lg:px-7 lg:py-7">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div className="hidden lg:block">
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Team Analytics</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Manage agents, track performance, view leaderboard</p>
        </div>
        <button onClick={() => setModal('new')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: C.blue, border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(29,78,216,0.28)' }}>
          <Plus style={{ width: 15, height: 15 }} /> Add Agent
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6">
        {[
          { label: 'Team Size',       value: `${members.filter(m => m.is_active).length} active`, icon: <Users style={{ width: 16, height: 16 }} />,    color: C.blue },
          { label: 'Total Pipeline',  value: fmt(totalPipeline),                                  icon: <TrendUp style={{ width: 16, height: 16 }} />, color: C.violet },
          { label: 'Deals Won',       value: `${totalWon} this month`,                            icon: <Trophy style={{ width: 16, height: 16 }} />,     color: C.emerald },
          { label: 'Deals in Active', value: `${deals.filter(d => !['won','lost'].includes(d.stage)).length}`, icon: <Handshake style={{ width: 16, height: 16 }} />, color: C.amber },
        ].map(s => (
          <div key={s.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        <button style={tab(activeTab === 'leaderboard')} onClick={() => setActiveTab('leaderboard')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy style={{ width: 13, height: 13 }} />Leaderboard</span>
        </button>
        <button style={tab(activeTab === 'agents')} onClick={() => setActiveTab('agents')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users style={{ width: 13, height: 13 }} />Agents</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, padding: 40 }}>
          <CircleNotch size={18} weight="light" style={{ animation: 'spin 0.8s linear infinite' }} /> Loading team data…
        </div>
      ) : activeTab === 'leaderboard' ? (
        /* ── Leaderboard ─────────────────────────────────────────────────── */
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
          {agentStats.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: C.muted }}>
              <Medal style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: 14 }}>Add agents and assign deals to see the leaderboard.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rank</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent</th>
                  <th className="hidden sm:table-cell" style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</th>
                  <th className="hidden lg:table-cell" style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Won</th>
                  <th className="hidden md:table-cell" style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Win Rate</th>
                  <th className="hidden lg:table-cell" style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>vs Target</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((a, i) => (
                  <tr key={a.name} style={{ borderBottom: `1px solid ${C.border}`, background: i === 0 ? 'rgba(29,78,216,0.06)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>{rankBadge(i)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${ROLE_COLOR[a.member?.role ?? 'agent']}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: ROLE_COLOR[a.member?.role ?? 'agent'] }}>
                          {a.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{ROLE_LABEL[a.member?.role ?? 'agent']}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell" style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: C.text }}>{a.active}</td>
                    <td className="hidden lg:table-cell" style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: C.violet }}>{fmt(a.pipeline)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Trophy style={{ width: 13, height: 13, color: C.emerald }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.emerald }}>{a.won}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, maxWidth: 80 }}>
                          <div style={{ height: '100%', borderRadius: 3, background: a.winRate >= 50 ? C.emerald : a.winRate >= 25 ? C.amber : C.red, width: `${Math.min(a.winRate, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{a.winRate}%</span>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {a.won >= a.target
                          ? <CheckCircle style={{ width: 14, height: 14, color: C.emerald }} />
                          : <Circle style={{ width: 14, height: 14, color: C.label }} />}
                        <span style={{ fontSize: 12, color: a.won >= a.target ? C.emerald : C.muted }}>{a.won}/{a.target}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* ── Agent Capacity Cards ────────────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {members.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: 48, textAlign: 'center', background: C.panel, borderRadius: 2, border: `1px solid ${C.border}`, color: C.muted }}>
              <Users size={32} weight="light" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              <p style={{ margin: '0 0 16px', fontSize: 14 }}>No agents added yet.</p>
              <button onClick={() => setModal('new')} style={{ padding: '9px 20px', background: C.blue, border: 'none', borderRadius: 2, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add your first agent</button>
            </div>
          ) : members.map(m => {
            const stats        = agentStats.find(a => a.name === m.name)
            const now          = new Date()
            const todayStr     = now.toISOString().slice(0, 10)
            const agentTasks   = tasks.filter(t => t.assigned_to === m.id && t.status === 'Pending')
            const taskToday    = agentTasks.filter(t => new Date(t.due_date).toISOString().slice(0, 10) === todayStr).length
            const taskOverdue  = agentTasks.filter(t => new Date(t.due_date) < now && new Date(t.due_date).toISOString().slice(0, 10) !== todayStr).length
            const taskTotal    = agentTasks.length
            const MAX_CAPACITY = 12
            const loadPct      = Math.min((taskTotal / MAX_CAPACITY) * 100, 100)
            const loadColor    = taskOverdue > 0 ? C.red : taskTotal >= 8 ? C.amber : C.emerald

            return (
              <div key={m.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: '16px 16px 14px', opacity: m.is_active ? 1 : 0.55 }}>

                {/* Header: avatar + name + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 2, background: `${ROLE_COLOR[m.role]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: ROLE_COLOR[m.role] }}>
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.name}</div>
                      <span style={{ fontSize: 9, fontWeight: 700, background: `${ROLE_COLOR[m.role]}14`, color: ROLE_COLOR[m.role], borderRadius: 2, padding: '1px 6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setModal(m)} style={{ padding: '4px 6px', borderRadius: 2, border: `1px solid ${C.border}`, background: C.bg, cursor: 'pointer' }}>
                      <PencilSimple size={12} weight="light" style={{ color: C.muted }} />
                    </button>
                    <button onClick={() => setDeleting(m.id)} style={{ padding: '4px 6px', borderRadius: 2, border: `1px solid rgba(239,68,68,0.25)`, background: 'rgba(239,68,68,0.05)', cursor: 'pointer' }}>
                      <Trash size={12} weight="light" style={{ color: C.red }} />
                    </button>
                  </div>
                </div>

                {/* Task capacity bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Task Load</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: loadColor }}>{taskTotal} tasks</span>
                      {taskToday > 0 && <span style={{ fontSize: 10, color: C.amber, fontWeight: 600 }}>{taskToday} today</span>}
                      {taskOverdue > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.red, fontWeight: 700 }}>
                          <Warning size={10} weight="light" style={{ color: C.red }} />
                          {taskOverdue} overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 2, background: `${loadColor}18` }}>
                    <div style={{ height: '100%', borderRadius: 2, background: loadColor, width: `${loadPct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>

                {/* Contact */}
                {(m.email || m.phone) && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    {m.email && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted }}><Envelope size={11} weight="light" />{m.email}</div>}
                    {m.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted }}><Phone size={11} weight="light" />{m.phone}</div>}
                  </div>
                )}

                {/* City/type specialties */}
                {(m.specialty_cities.length > 0 || m.specialty_types.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {m.specialty_cities.map(c => <span key={c} style={{ fontSize: 9, fontWeight: 700, background: 'rgba(29,78,216,0.07)', color: C.blue, borderRadius: 2, padding: '2px 6px', letterSpacing: '0.03em' }}>{c}</span>)}
                    {m.specialty_types.map(t => <span key={t} style={{ fontSize: 9, fontWeight: 700, background: 'rgba(29,78,216,0.07)', color: C.violet, borderRadius: 2, padding: '2px 6px', letterSpacing: '0.03em' }}>{t}</span>)}
                  </div>
                )}

                {/* Stats strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                  {[
                    { label: 'Leads',   value: (assignedCounts[m.id] ?? 0), color: C.blue    },
                    { label: 'Active',  value: stats?.active ?? 0,           color: C.violet  },
                    { label: 'Won',     value: stats?.won ?? 0,              color: C.emerald },
                    { label: 'Target',  value: `${stats?.won ?? 0}/${m.monthly_target}`, color: (stats?.won ?? 0) >= m.monthly_target ? C.emerald : C.amber },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: C.label, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <AgentModal member={modal === 'new' ? null : modal as TeamMember} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {deleting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: C.panel, borderRadius: 2, padding: 28, maxWidth: 360, width: '100%' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Remove this agent?</p>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Their deal assignments will not be affected.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleting(null)} style={{ flex: 1, padding: '10px 0', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: C.muted, background: '#F5F6FA', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleting)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: C.red, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
    </div>
  )
}
