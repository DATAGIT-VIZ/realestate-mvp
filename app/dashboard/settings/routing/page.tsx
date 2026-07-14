'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2, Loader2, ArrowRight, Shield, ToggleLeft, ToggleRight, Info } from 'lucide-react'

const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#a000c8', emerald: '#059669', amber: '#be2ed6',
  red: '#EF4444', violet: '#a000c8',
}

const RULE_TYPES = [
  { id: 'city',          label: 'City',          desc: 'Match leads from a specific city',       placeholder: 'e.g. Mumbai' },
  { id: 'portal',        label: 'Source Portal',  desc: 'Match leads from a portal',             placeholder: 'e.g. MagicBricks' },
  { id: 'property_type', label: 'Property Type',  desc: 'Match by property type',                placeholder: 'e.g. Villa' },
  { id: 'round_robin',   label: 'Round Robin',    desc: 'Rotate through all active agents',      placeholder: '' },
]

const PORTALS = ['MagicBricks', '99acres', 'Housing.com', 'Facebook Ads', 'Referral', 'Walk-in']
const CITIES  = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata']
const TYPES   = ['1BHK', '2BHK', '3BHK', '4BHK+', 'Villa', 'Plot', 'Commercial']

interface Agent { id: string; name: string; role: string }

interface Rule {
  id:          string
  priority:    number
  rule_type:   string
  match_value?: string
  agent_id?:   string
  is_active:   boolean
  agent?:      { id: string; name: string }
}

interface FormState {
  rule_type:   string
  match_value: string
  agent_id:    string
  priority:    number
}

const BLANK: FormState = { rule_type: 'city', match_value: '', agent_id: '', priority: 0 }

function RuleTypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    city:          { bg: 'rgba(160,0,200,0.07)', color: C.blue },
    portal:        { bg: 'rgba(160,0,200,0.07)', color: C.violet },
    property_type: { bg: 'rgba(190,46,214,0.07)', color: C.amber },
    round_robin:   { bg: '#F0FDF4', color: C.emerald },
  }
  const c = colors[type] ?? { bg: '#F8FAFC', color: C.muted }
  const label = RULE_TYPES.find(r => r.id === type)?.label ?? type
  return <span style={{ fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, borderRadius: 20, padding: '3px 10px' }}>{label}</span>
}

export default function RoutingPage() {
  const [rules,   setRules]   = useState<Rule[]>([])
  const [agents,  setAgents]  = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState<FormState>({ ...BLANK })
  const [adding,  setAdding]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [rRes, aRes] = await Promise.all([fetch('/api/routing-rules'), fetch('/api/team')])
    const [rJson, aJson] = await Promise.all([rRes.json(), aRes.json()])
    setRules(rJson.rules ?? [])
    setAgents((aJson.members ?? []).filter((m: Agent & { is_active: boolean }) => m.is_active))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k: keyof FormState, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const rt = RULE_TYPES.find(r => r.id === form.rule_type)

  const getSuggestions = () => {
    if (form.rule_type === 'city')          return CITIES
    if (form.rule_type === 'portal')        return PORTALS
    if (form.rule_type === 'property_type') return TYPES
    return []
  }

  const handleAdd = async () => {
    setError(null)
    if (form.rule_type !== 'round_robin' && !form.match_value) { setError('Match value is required'); return }
    if (!form.agent_id) { setError('Select an agent'); return }
    setAdding(true)
    const res = await fetch('/api/routing-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, priority: Number(form.priority) }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); setAdding(false); return }
    setForm({ ...BLANK })
    await load()
    setAdding(false)
  }

  const toggleActive = async (rule: Rule) => {
    await fetch(`/api/routing-rules/${rule.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    setRules(rs => rs.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/routing-rules/${id}`, { method: 'DELETE' })
    setRules(rs => rs.filter(r => r.id !== id))
  }

  const inp: React.CSSProperties = {
    padding: '9px 12px', border: `1px solid ${C.border}`,
    borderRadius: 9, fontSize: 13, color: C.text, outline: 'none',
    background: '#FAFBFC', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block' }

  return (
    <div style={{ padding: '28px 28px 60px', minHeight: '100vh', background: C.bg }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Lead Routing Rules</h1>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Auto-assign incoming leads to agents based on city, source portal, or property type</p>
      </div>

      {/* How it works */}
      <div style={{ background: 'rgba(160,0,200,0.07)', border: `1px solid rgba(160,0,200,0.2)`, borderRadius: 16, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Info style={{ width: 16, height: 16, color: C.blue, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#7600bc', lineHeight: 1.6 }}>
          Rules are evaluated in <strong>priority order</strong> (lower number = first match). When a lead arrives via any ingest endpoint, the first matching active rule determines assignment. Round Robin applies to all unmatched leads.
        </div>
      </div>

      {/* Add rule form */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 18px' }}>Add New Rule</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 120px', gap: 12, alignItems: 'end' }}>
          {/* Rule type */}
          <div>
            <label style={lbl}>Rule Type</label>
            <select style={{ ...inp, width: '100%', cursor: 'pointer' }} value={form.rule_type} onChange={e => set('rule_type', e.target.value)}>
              {RULE_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            {rt && <p style={{ fontSize: 11, color: C.label, margin: '4px 0 0' }}>{rt.desc}</p>}
          </div>

          {/* Match value */}
          <div>
            <label style={lbl}>{form.rule_type === 'round_robin' ? 'Match Value' : 'Match Value *'}</label>
            {getSuggestions().length > 0 ? (
              <select style={{ ...inp, width: '100%', cursor: 'pointer' }} value={form.match_value} onChange={e => set('match_value', e.target.value)} disabled={form.rule_type === 'round_robin'}>
                <option value="">Select {rt?.label}</option>
                {getSuggestions().map(s => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <input style={{ ...inp, width: '100%' }} value={form.match_value} onChange={e => set('match_value', e.target.value)} placeholder={form.rule_type === 'round_robin' ? 'Applies to all' : rt?.placeholder} disabled={form.rule_type === 'round_robin'} />
            )}
          </div>

          {/* Agent */}
          <div>
            <label style={lbl}>Assign To *</label>
            {agents.length === 0 ? (
              <div style={{ ...inp, color: C.label, fontSize: 12 }}>Add agents first →</div>
            ) : (
              <select style={{ ...inp, width: '100%', cursor: 'pointer' }} value={form.agent_id} onChange={e => set('agent_id', e.target.value)}>
                <option value="">Select agent</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>

          {/* Priority */}
          <div>
            <label style={lbl}>Priority</label>
            <input style={{ ...inp, width: '100%' }} type="number" min={0} value={form.priority} onChange={e => set('priority', e.target.value)} placeholder="0" />
          </div>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 9, padding: '9px 12px', fontSize: 13, color: C.red, marginTop: 12 }}>{error}</div>}

        <button onClick={handleAdd} disabled={adding || agents.length === 0}
          style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', background: adding || agents.length === 0 ? '#E2E8F0' : C.blue, border: 'none', borderRadius: 10, color: adding || agents.length === 0 ? C.label : '#fff', fontSize: 13, fontWeight: 700, cursor: adding || agents.length === 0 ? 'not-allowed' : 'pointer' }}>
          {adding ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Plus style={{ width: 14, height: 14 }} />}
          Add Rule
        </button>
      </div>

      {/* Rules list */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, display: 'flex', alignItems: 'center', gap: 10, color: C.muted }}>
            <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Loading rules…
          </div>
        ) : rules.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.muted }}>
            <Shield style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 14 }}>No routing rules yet. Add one above to start auto-assigning leads.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Priority', 'Type', 'Match', 'Assigned To', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: rule.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: C.text }}>#{rule.priority}</td>
                  <td style={{ padding: '14px 16px' }}><RuleTypeBadge type={rule.rule_type} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    {rule.rule_type === 'round_robin'
                      ? <span style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>All unmatched leads</span>
                      : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ArrowRight style={{ width: 12, height: 12, color: C.label }} /><span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{rule.match_value}</span></div>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {rule.agent ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{rule.agent.name}</span>
                    ) : <span style={{ fontSize: 12, color: C.label }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button onClick={() => toggleActive(rule)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: rule.is_active ? C.emerald : C.label }}>
                      {rule.is_active
                        ? <ToggleRight style={{ width: 20, height: 20 }} />
                        : <ToggleLeft style={{ width: 20, height: 20 }} />}
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{rule.is_active ? 'Active' : 'Off'}</span>
                    </button>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button onClick={() => handleDelete(rule.id)} style={{ padding: '5px 7px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#FFF1F2', color: C.red, cursor: 'pointer' }}>
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
