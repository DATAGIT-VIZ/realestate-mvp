'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Phone, PhoneCall, PhoneOff, PhoneMissed, SkipForward,
  CheckCircle, MapPin, Home, Loader2, AlertCircle,
  Mic, MicOff, RotateCcw,
} from 'lucide-react'

const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#2563EB', emerald: '#059669', amber: '#D97706',
  red: '#EF4444', violet: '#7C3AED',
}

const OUTCOMES = [
  { id: 'connected',      label: 'Connected',      icon: CheckCircle,  color: C.emerald },
  { id: 'no_answer',      label: 'No Answer',      icon: PhoneMissed,  color: C.amber   },
  { id: 'callback',       label: 'Callback',       icon: RotateCcw,    color: C.blue    },
  { id: 'not_interested', label: 'Not Interested', icon: PhoneOff,     color: C.red     },
]

interface Lead {
  id: string
  name: { firstName: string; lastName?: string }
  phones: { primaryPhoneNumber: string }
  city?: string
  intentScore?: number
  sourcePortal?: string
  propertyType?: string[]
}

interface CallLog {
  leadName: string
  phone:    string
  outcome:  string
  note:     string
  duration: number
}

function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null
  const color = score >= 75 ? C.red : score >= 50 ? C.amber : C.blue
  const label = score >= 75 ? 'Hot' : score >= 50 ? 'Warm' : 'New'
  return <span style={{ fontSize: 11, fontWeight: 800, background: `${color}15`, color, borderRadius: 20, padding: '2px 9px' }}>{label} {score}</span>
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

export default function PowerDialerPage() {
  const [leads,       setLeads]       = useState<Lead[]>([])
  const [loading,     setLoading]     = useState(true)
  const [queueIdx,    setQueueIdx]    = useState(0)
  const [calling,     setCalling]     = useState(false)
  const [callActive,  setCallActive]  = useState(false)
  const [callStart,   setCallStart]   = useState<Date | null>(null)
  const [elapsed,     setElapsed]     = useState(0)
  const [outcome,     setOutcome]     = useState('')
  const [note,        setNote]        = useState('')
  const [log,         setLog]         = useState<CallLog[]>([])
  const [exotelOk,    setExotelOk]    = useState(false)
  const [muted,       setMuted]       = useState(false)
  const [stats,       setStats]       = useState({ total: 0, connected: 0, skipped: 0 })

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/leads?limit=50')
      const j = await r.json()
      setLeads((j.leads ?? []).sort((a: Lead, b: Lead) => (b.intentScore ?? 0) - (a.intentScore ?? 0)))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadLeads()
    fetch('/api/calls/status').then(r => r.json()).then(j => setExotelOk(j.configured ?? false)).catch(() => {})
  }, [loadLeads])

  useEffect(() => {
    if (!callActive || !callStart) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - callStart.getTime()) / 1000)), 1000)
    return () => clearInterval(t)
  }, [callActive, callStart])

  const current  = leads[queueIdx]
  const fullName = current ? `${current.name.firstName} ${current.name.lastName ?? ''}`.trim() : ''
  const phone    = current?.phones?.primaryPhoneNumber ?? ''

  const handleCall = async () => {
    if (!current) return
    setCalling(true)
    try {
      if (exotelOk) {
        await fetch('/api/calls/make', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: phone, leadId: current.id, leadName: fullName }),
        })
      }
      setCallActive(true)
      setCallStart(new Date())
      setElapsed(0)
    } finally { setCalling(false) }
  }

  const handleLogAndNext = () => {
    if (!outcome) return
    const duration = callStart ? Math.floor((Date.now() - callStart.getTime()) / 1000) : 0
    setLog(prev => [{ leadName: fullName, phone, outcome, note, duration }, ...prev])
    setStats(s => ({ ...s, total: s.total + 1, connected: s.connected + (outcome === 'connected' ? 1 : 0) }))
    setOutcome(''); setNote(''); setCallActive(false); setCallStart(null); setElapsed(0)
    setQueueIdx(i => i + 1)
  }

  const handleSkip = () => {
    setStats(s => ({ ...s, total: s.total + 1, skipped: s.skipped + 1 }))
    setOutcome(''); setNote(''); setCallActive(false); setCallStart(null); setElapsed(0)
    setQueueIdx(i => i + 1)
  }

  const outcomeMeta = OUTCOMES.find(o => o.id === outcome)

  return (
    <div style={{ padding: '28px 28px 60px', minHeight: '100vh', background: C.bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Power Dialer</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Score-sorted lead queue — one call at a time</p>
        </div>
        <button onClick={loadLeads} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 10, background: C.panel, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <RotateCcw style={{ width: 13, height: 13 }} /> Refresh
        </button>
      </div>

      {!exotelOk && (
        <div style={{ background: '#FFFBEB', border: `1px solid rgba(217,119,6,0.3)`, borderRadius: 14, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle style={{ width: 16, height: 16, color: C.amber, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#92400E' }}>
            <strong>Exotel not configured</strong> — calls are simulated. Add <code>EXOTEL_SID / API_KEY / API_TOKEN / PHONE</code> to enable real click-to-call.
          </span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Queue',     value: `${queueIdx}/${leads.length}`, color: C.blue    },
          { label: 'Dialed',    value: stats.total,                   color: C.text    },
          { label: 'Connected', value: stats.connected,               color: C.emerald },
          { label: 'Skipped',   value: stats.skipped,                 color: C.amber   },
        ].map(s => (
          <div key={s.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Dialer card */}
        <div>
          {loading ? (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: 60, textAlign: 'center', color: C.muted }}>
              <Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
              Loading leads…
            </div>
          ) : queueIdx >= leads.length ? (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '48px 32px', textAlign: 'center' }}>
              <CheckCircle style={{ width: 48, height: 48, color: C.emerald, margin: '0 auto 16px', display: 'block' }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>Queue done!</h2>
              <p style={{ fontSize: 14, color: C.muted, margin: '0 0 20px' }}>
                {stats.total} called · {stats.connected} connected · {stats.total ? Math.round(stats.connected / stats.total * 100) : 0}% connect rate
              </p>
              <button onClick={() => { setQueueIdx(0); setStats({ total: 0, connected: 0, skipped: 0 }); loadLeads() }}
                style={{ padding: '11px 24px', background: C.blue, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Start New Session
              </button>
            </div>
          ) : (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }}>
              {/* Lead info */}
              <div style={{ padding: '24px 28px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: `${C.blue}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: C.blue }}>
                    {fullName.charAt(0)}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>{fullName}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.blue }}>{phone}</span>
                      <ScoreBadge score={current.intentScore} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {current.city && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: C.muted }}><MapPin style={{ width: 13, height: 13 }} />{current.city}</div>}
                  {current.propertyType?.[0] && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: C.muted }}><Home style={{ width: 13, height: 13 }} />{current.propertyType[0]}</div>}
                  {current.sourcePortal && <span style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: C.blue, borderRadius: 20, padding: '2px 9px' }}>{current.sourcePortal}</span>}
                </div>
              </div>

              {/* Call controls */}
              <div style={{ padding: '20px 28px', background: callActive ? '#F0FDF4' : '#FAFBFC', borderBottom: `1px solid ${C.border}` }}>
                {!callActive ? (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={handleCall} disabled={calling}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 28px', background: calling ? '#E2E8F0' : C.emerald, border: 'none', borderRadius: 14, color: calling ? C.label : '#fff', fontSize: 16, fontWeight: 800, cursor: calling ? 'not-allowed' : 'pointer', boxShadow: calling ? 'none' : '0 4px 16px rgba(5,150,105,0.3)' }}>
                      {calling ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> : <PhoneCall style={{ width: 18, height: 18 }} />}
                      {calling ? 'Calling…' : `Call ${fullName.split(' ')[0]}`}
                    </button>
                    <button onClick={handleSkip} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 18px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 14, color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      <SkipForward style={{ width: 14, height: 14 }} /> Skip
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: C.emerald, animation: 'pulse 1.5s infinite' }} />
                      <span style={{ fontSize: 24, fontWeight: 800, color: C.emerald, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(elapsed)}</span>
                    </div>
                    <button onClick={() => setMuted(m => !m)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 9, background: muted ? '#FFF1F2' : C.panel, color: muted ? C.red : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {muted ? <MicOff style={{ width: 13, height: 13 }} /> : <Mic style={{ width: 13, height: 13 }} />}
                      {muted ? 'Unmute' : 'Mute'}
                    </button>
                    <button onClick={() => setCallActive(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: C.red, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <PhoneOff style={{ width: 14, height: 14 }} /> End Call
                    </button>
                  </div>
                )}
              </div>

              {/* Log outcome */}
              {(callActive || callStart) && (
                <div style={{ padding: '20px 28px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Call Outcome</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {OUTCOMES.map(o => {
                      const Icon = o.icon
                      const sel  = outcome === o.id
                      return (
                        <button key={o.id} onClick={() => setOutcome(o.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `2px solid ${sel ? o.color : C.border}`, background: sel ? `${o.color}15` : '#F8FAFC', color: sel ? o.color : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          <Icon style={{ width: 14, height: 14 }} /> {o.label}
                        </button>
                      )
                    })}
                  </div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note…"
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, resize: 'vertical', minHeight: 56, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
                  <button onClick={handleLogAndNext} disabled={!outcome}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: !outcome ? '#E2E8F0' : (outcomeMeta?.color ?? C.blue), border: 'none', borderRadius: 12, color: !outcome ? C.label : '#fff', fontSize: 14, fontWeight: 700, cursor: !outcome ? 'not-allowed' : 'pointer' }}>
                    Log &amp; Next <SkipForward style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: call log + queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>Today&apos;s Calls ({log.length})</div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {log.length === 0
                ? <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: C.label }}>No calls yet</div>
                : log.map((c, i) => {
                    const o = OUTCOMES.find(x => x.id === c.outcome)
                    return (
                      <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.leadName}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{fmtTime(c.duration)}</div>
                        </div>
                        {o && <span style={{ fontSize: 10, fontWeight: 700, background: `${o.color}15`, color: o.color, borderRadius: 20, padding: '2px 8px' }}>{o.label}</span>}
                      </div>
                    )
                  })}
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>Up Next</div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {leads.slice(queueIdx + 1, queueIdx + 7).map((lead, i) => (
                <div key={lead.id} style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: Math.max(0.4, 1 - i * 0.12) }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{lead.name.firstName} {lead.name.lastName ?? ''}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{lead.city ?? '—'}</div>
                  </div>
                  <ScoreBadge score={lead.intentScore} />
                </div>
              ))}
              {queueIdx + 1 >= leads.length && <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: C.label }}>End of queue</div>}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>
    </div>
  )
}
