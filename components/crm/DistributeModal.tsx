'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Users, Zap, Loader2, CheckCircle, ChevronDown, AlertCircle, Shuffle } from 'lucide-react'

const PRIMARY       = '#a000c8'
const PRIMARY_DIM   = 'rgba(160,0,200,0.08)'
const PRIMARY_BORDER = 'rgba(160,0,200,0.25)'
const GRAD          = 'linear-gradient(135deg, #7600bc 0%, #b100cd 100%)'
const BORDER        = '#E2E8F0'
const TEXT          = '#0F172A'
const MUTED         = '#64748B'
const LABEL         = '#94A3B8'
const PANEL         = '#FFFFFF'
const BG_TINT       = '#FAFAFA'

interface Agent {
  id: string
  name: string
  role: string
  is_active: boolean
}

interface Props {
  onClose: () => void
  onDone: () => void
}

type Priority = 'score' | 'newest' | 'oldest'
const PRIORITY_LABELS: Record<Priority, string> = {
  score:  'Highest Intent Score first',
  newest: 'Most Recently Added first',
  oldest: 'Oldest Leads first',
}

export function DistributeModal({ onClose, onDone }: Props) {
  const [agents,       setAgents]       = useState<Agent[]>([])
  const [unassigned,   setUnassigned]   = useState(0)
  const [perAgent,     setPerAgent]     = useState<Record<string, number>>({})
  const [counts,       setCounts]       = useState<Record<string, number>>({})
  const [priority,     setPriority]     = useState<Priority>('score')
  const [showPriority, setShowPriority] = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [distributing, setDistributing] = useState(false)
  const [done,         setDone]         = useState(false)
  const [result,       setResult]       = useState<{ distributed: number; details: Array<{ agentName: string; assigned: number }> } | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [agRes, statRes] = await Promise.all([
      fetch('/api/team'),
      fetch('/api/crm/leads/distribute'),
    ])
    const [agJson, statJson] = await Promise.all([agRes.json(), statRes.json()])
    const active = (agJson.members ?? []).filter((m: Agent) => m.is_active)
    setAgents(active)
    setUnassigned(statJson.unassigned ?? 0)
    setPerAgent(statJson.perAgent ?? {})
    // Default counts: empty
    const init: Record<string, number> = {}
    for (const a of active) init[a.id] = 0
    setCounts(init)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const activeAgents = agents.filter(a => a.is_active)
  const totalAssigning = Object.values(counts).reduce((s, n) => s + n, 0)
  const remaining = unassigned - totalAssigning

  const equalSplit = () => {
    if (!activeAgents.length) return
    const base  = Math.floor(unassigned / activeAgents.length)
    const extra = unassigned % activeAgents.length
    const next: Record<string, number> = {}
    activeAgents.forEach((a, i) => { next[a.id] = base + (i < extra ? 1 : 0) })
    setCounts(next)
  }

  const setCount = (id: string, val: number) => {
    const clamped = Math.max(0, Math.min(val, unassigned))
    // Adjust others proportionally so total doesn't exceed pool
    const othersTotal = Object.entries(counts).filter(([k]) => k !== id).reduce((s, [, v]) => s + v, 0)
    const max = unassigned - othersTotal
    setCounts(prev => ({ ...prev, [id]: Math.min(clamped, Math.max(0, max)) }))
  }

  const distribute = async () => {
    setDistributing(true); setError(null)
    const assignments = activeAgents
      .filter(a => (counts[a.id] ?? 0) > 0)
      .map(a => ({ agentId: a.id, agentName: a.name, count: counts[a.id] }))

    if (!assignments.length) { setError('Set at least one agent count above 0.'); setDistributing(false); return }

    try {
      const res  = await fetch('/api/crm/leads/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments, priority }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResult(json)
      setDone(true)
    } catch (err: any) {
      setError(err.message ?? 'Distribution failed')
    } finally {
      setDistributing(false)
    }
  }

  const roleColor = (role: string) => role === 'manager' ? '#059669' : role === 'senior_agent' ? '#8a00c2' : PRIMARY

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)' }} onClick={onClose} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 600, maxHeight: '90vh', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(100,0,160,0.14), 0 4px 16px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shuffle style={{ width: 16, height: 16, color: PRIMARY }} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: 0 }}>Distribute Leads</h2>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                {loading ? 'Loading…' : `${unassigned.toLocaleString()} unassigned leads in pool`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, cursor: 'pointer' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 10, color: MUTED }}>
              <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Loading agents…
            </div>

          ) : done && result ? (
            /* ── Success ── */
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(5,150,105,0.1)', border: '2px solid rgba(5,150,105,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle style={{ width: 28, height: 28, color: '#059669' }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT, margin: '0 0 6px' }}>
                {result.distributed.toLocaleString()} leads distributed
              </h3>
              <p style={{ fontSize: 13, color: MUTED, margin: '0 0 24px' }}>Agents have been assigned their leads.</p>
              <div style={{ background: BG_TINT, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', textAlign: 'left' }}>
                {result.details.filter(d => d.assigned > 0).map((d, i, arr) => (
                  <div key={d.agentName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{d.agentName}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{d.assigned.toLocaleString()} leads</span>
                  </div>
                ))}
              </div>
            </div>

          ) : activeAgents.length === 0 ? (
            /* ── No agents ── */
            <div style={{ textAlign: 'center', padding: '48px 0', color: MUTED }}>
              <Users style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: 14, margin: '0 0 6px', color: TEXT, fontWeight: 600 }}>No active agents</p>
              <p style={{ fontSize: 13, margin: 0 }}>Go to Team → Add agents before distributing.</p>
            </div>

          ) : (
            <>
              {/* Pool summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'In Pool',       value: unassigned.toLocaleString(),         color: PRIMARY },
                  { label: 'Assigning Now', value: totalAssigning.toLocaleString(),      color: '#8a00c2' },
                  { label: 'Remaining',     value: Math.max(0, remaining).toLocaleString(), color: remaining < 0 ? '#DC2626' : MUTED },
                ].map(s => (
                  <div key={s.label} style={{ background: BG_TINT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Action row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <button
                  onClick={equalSplit}
                  disabled={!unassigned}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: unassigned ? PRIMARY_DIM : '#F1F5F9', border: `1px solid ${unassigned ? PRIMARY_BORDER : BORDER}`, borderRadius: 9, color: unassigned ? PRIMARY : LABEL, fontSize: 12, fontWeight: 700, cursor: unassigned ? 'pointer' : 'not-allowed' }}
                >
                  <Zap style={{ width: 12, height: 12 }} /> Equal Split
                </button>
                <button
                  onClick={() => setCounts(Object.fromEntries(activeAgents.map(a => [a.id, 0])))}
                  style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 9, color: MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Clear
                </button>

                {/* Priority picker */}
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                  <button
                    onClick={() => setShowPriority(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 12, cursor: 'pointer' }}
                  >
                    {PRIORITY_LABELS[priority]}
                    <ChevronDown style={{ width: 11, height: 11, color: MUTED }} />
                  </button>
                  {showPriority && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, zIndex: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 220 }}>
                      {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([k, label]) => (
                        <button key={k} onClick={() => { setPriority(k); setShowPriority(false) }}
                          style={{ display: 'block', width: '100%', padding: '10px 14px', background: priority === k ? PRIMARY_DIM : 'transparent', color: priority === k ? PRIMARY : TEXT, fontSize: 13, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Agent list */}
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                {activeAgents.map((agent, idx) => {
                  const count       = counts[agent.id] ?? 0
                  const alreadyHas  = perAgent[agent.id] ?? 0
                  const pct         = unassigned > 0 ? Math.round((count / unassigned) * 100) : 0
                  return (
                    <div key={agent.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: idx < activeAgents.length - 1 ? `1px solid ${BORDER}` : 'none', background: count > 0 ? PRIMARY_DIM : PANEL }}
                    >
                      {/* Avatar */}
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${roleColor(agent.role)}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: roleColor(agent.role), flexShrink: 0 }}>
                        {agent.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Name + existing count */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{agent.name}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>
                          {alreadyHas > 0 ? `${alreadyHas.toLocaleString()} already assigned` : 'No leads yet'}
                          {count > 0 && <span style={{ color: PRIMARY, fontWeight: 700 }}> · +{count.toLocaleString()} now</span>}
                        </div>
                      </div>

                      {/* Percentage bar */}
                      {unassigned > 0 && (
                        <div style={{ width: 60, flexShrink: 0 }}>
                          <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: count > 0 ? GRAD : '#E2E8F0', width: `${pct}%`, transition: 'width 0.2s' }} />
                          </div>
                          <div style={{ fontSize: 10, color: count > 0 ? PRIMARY : LABEL, textAlign: 'right', marginTop: 2, fontWeight: 600 }}>{pct}%</div>
                        </div>
                      )}

                      {/* Count input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => setCount(agent.id, count - 1)} disabled={count === 0}
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${BORDER}`, background: count === 0 ? '#F8FAFC' : PANEL, color: count === 0 ? LABEL : TEXT, fontSize: 15, fontWeight: 700, cursor: count === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                          −
                        </button>
                        <input
                          type="number"
                          value={count}
                          min={0}
                          max={unassigned}
                          onChange={e => setCount(agent.id, Number(e.target.value))}
                          style={{ width: 70, padding: '5px 8px', border: `1.5px solid ${count > 0 ? PRIMARY_BORDER : BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 700, color: count > 0 ? PRIMARY : TEXT, textAlign: 'center', outline: 'none', background: count > 0 ? PRIMARY_DIM : PANEL }}
                        />
                        <button onClick={() => setCount(agent.id, count + 1)} disabled={remaining <= 0}
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${remaining <= 0 ? BORDER : PRIMARY_BORDER}`, background: remaining <= 0 ? '#F8FAFC' : PRIMARY_DIM, color: remaining <= 0 ? LABEL : PRIMARY, fontSize: 15, fontWeight: 700, cursor: remaining <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {error && (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9 }}>
                  <AlertCircle style={{ width: 14, height: 14, color: '#EF4444', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#EF4444' }}>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG_TINT }}>
          <span style={{ fontSize: 12, color: MUTED }}>
            {done ? 'Distribution complete' : totalAssigning > 0 ? `${totalAssigning.toLocaleString()} leads selected to distribute` : 'Set lead counts for each agent'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={done ? onDone : onClose}
              style={{ padding: '9px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {done ? 'Done' : 'Cancel'}
            </button>
            {!done && (
              <button
                onClick={distribute}
                disabled={distributing || totalAssigning === 0 || !unassigned}
                style={{ padding: '9px 20px', background: (distributing || totalAssigning === 0 || !unassigned) ? '#e8bcf0' : GRAD, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: (distributing || totalAssigning === 0 || !unassigned) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {distributing
                  ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />Distributing…</>
                  : <><Shuffle style={{ width: 14, height: 14 }} />Distribute {totalAssigning > 0 ? totalAssigning.toLocaleString() : ''} Leads</>}
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
