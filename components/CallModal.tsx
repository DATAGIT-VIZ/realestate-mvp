'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Phone, PhoneOff, PhoneMissed, PhoneCall, Mic, Clock, Check, X, AlertCircle } from 'lucide-react'

const C = {
  bg:      '#F8FAFC',
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  emerald: '#059669',
  red:     '#DC2626',
  amber:   '#be2ed6',
  blue:    '#a000c8',
  orange:  '#a000c8',
}

const OUTCOMES = [
  { key: 'Answered',   label: 'Answered',   icon: Phone,       color: C.emerald },
  { key: 'No Answer',  label: 'No Answer',  icon: PhoneMissed, color: C.amber   },
  { key: 'Busy',       label: 'Busy',       icon: PhoneOff,    color: C.orange  },
  { key: 'Wrong Num',  label: 'Wrong #',    icon: X,           color: C.red     },
  { key: 'Call Back',  label: 'Call Back',  icon: Clock,       color: C.blue    },
]

type Stage = 'setup' | 'calling' | 'log'

type Props = {
  isOpen:    boolean
  onClose:   () => void
  leadId:    string
  leadName:  string
  leadPhone: string
  onLogged?: () => void
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const AGENT_PHONE_KEY = 'realedge_agent_phone'

export function CallModal({ isOpen, onClose, leadId, leadName, leadPhone, onLogged }: Props) {
  const [stage, setStage]             = useState<Stage>('setup')
  const [agentPhone, setAgentPhone]   = useState('')
  const [elapsed, setElapsed]         = useState(0)
  const [outcome, setOutcome]         = useState('')
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [callSid, setCallSid]         = useState<string | null>(null)
  const [exoAvail, setExoAvail]       = useState<boolean | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load saved agent phone
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(AGENT_PHONE_KEY) ?? ''
      setAgentPhone(saved)
      setStage('setup')
      setElapsed(0)
      setOutcome('')
      setNotes('')
      setError(null)
      setCallSid(null)
    }
  }, [isOpen])

  // Check if Exotel is configured
  useEffect(() => {
    if (!isOpen) return
    fetch('/api/calls/configured')
      .then(r => r.json())
      .then(j => setExoAvail(j.configured === true))
      .catch(() => setExoAvail(false))
  }, [isOpen])

  // Timer
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  const handleStartCall = async () => {
    if (exoAvail) {
      // Exotel path — needs agent phone
      if (!agentPhone.trim()) { setError('Enter your mobile number'); return }
      localStorage.setItem(AGENT_PHONE_KEY, agentPhone.trim())
      setError(null)
      try {
        const res  = await fetch('/api/calls/make', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, leadPhone, agentPhone }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setCallSid(json.data?.callSid ?? null)
        setStage('calling')
        setTimeout(startTimer, 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Call failed')
      }
    } else {
      // Demo mode: simulate call in-app, no dial needed
      setStage('calling')
      startTimer()
    }
  }

  const handleEndCall = () => {
    stopTimer()
    setStage('log')
  }

  const handleSave = async () => {
    if (!outcome) { setError('Select an outcome'); return }
    setSaving(true)
    setError(null)
    try {
      const body = {
        type:     'Call Made',
        outcome,
        duration: elapsed,
        notes:    notes.trim() || `${outcome} · ${formatDuration(elapsed)}`,
        callSid:  callSid ?? undefined,
      }
      const res  = await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      onLogged?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', width: 420, overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ background: stage === 'calling' ? 'linear-gradient(135deg,#064E3B,#065F46)' : C.bg, padding: '24px 24px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: stage === 'calling' ? 'rgba(5,150,105,0.3)' : 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {stage === 'calling'
                  ? <PhoneCall style={{ width: 18, height: 18, color: '#34D399' }} />
                  : stage === 'log'
                  ? <Check style={{ width: 18, height: 18, color: C.emerald }} />
                  : <Phone style={{ width: 18, height: 18, color: C.emerald }} />
                }
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: stage === 'calling' ? '#F0FDF4' : C.text, margin: 0 }}>
                  {stage === 'setup' ? 'Call Lead' : stage === 'calling' ? 'Call in Progress' : 'Log Outcome'}
                </p>
                <p style={{ fontSize: 11, color: stage === 'calling' ? '#6EE7B7' : C.muted, margin: 0 }}>{leadName}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${stage === 'calling' ? 'rgba(255,255,255,0.15)' : C.border}`, background: 'transparent', color: stage === 'calling' ? '#6EE7B7' : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>

          {/* Timer */}
          {stage === 'calling' && (
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <p style={{ fontSize: 40, fontWeight: 700, color: '#F0FDF4', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', margin: 0 }}>
                {formatDuration(elapsed)}
              </p>
              <p style={{ fontSize: 12, color: '#6EE7B7', margin: '6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
                {callSid ? 'Connected via Exotel' : 'Manual timer'}
              </p>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 24 }}>

          {/* SETUP */}
          {stage === 'setup' && (
            <div>
              {/* Lead phone display */}
              <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px', marginBottom: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Lead phone</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>{leadPhone}</p>
              </div>

              {/* Exotel agent phone input — only when Exotel is available */}
              {exoAvail === true && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>
                    Your mobile number
                    <span style={{ fontWeight: 400, marginLeft: 6 }}>(Exotel will ring this first)</span>
                  </label>
                  <input
                    type="tel"
                    value={agentPhone}
                    onChange={e => setAgentPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, color: C.text, background: C.panel, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.blue)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                  {error && <p style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{error}</p>}
                </div>
              )}

              <button onClick={handleStartCall}
                style={{ width: '100%', padding: '13px 0', background: C.emerald, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Phone style={{ width: 16, height: 16 }} />
                {exoAvail ? 'Start Call via Exotel' : 'Start Call'}
              </button>
            </div>
          )}

          {/* CALLING */}
          {stage === 'calling' && (
            <div>
              {callSid && (
                <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 16 }}>
                  Your phone will ring shortly. After the call ends, log the outcome.
                </p>
              )}

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>Quick note (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Jot notes while on the call…"
                rows={3}
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Dismiss
                </button>
                <button onClick={handleEndCall}
                  style={{ flex: 1, padding: '11px 0', background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <PhoneOff style={{ width: 14, height: 14 }} /> End & Log
                </button>
              </div>
            </div>
          )}

          {/* LOG */}
          {stage === 'log' && (
            <div>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>
                Duration: <strong style={{ color: C.text }}>{formatDuration(elapsed)}</strong>
              </p>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 10 }}>Call outcome</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 20 }}>
                {OUTCOMES.map(o => {
                  const Icon = o.icon
                  const sel  = outcome === o.key
                  return (
                    <button key={o.key} onClick={() => setOutcome(o.key)}
                      style={{ padding: '10px 4px', borderRadius: 10, border: `1.5px solid ${sel ? o.color : C.border}`, background: sel ? `${o.color}12` : C.panel, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, transition: 'all 0.12s' }}
                    >
                      <Icon style={{ width: 16, height: 16, color: o.color }} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: o.color, textAlign: 'center', lineHeight: 1.2 }}>{o.label}</span>
                    </button>
                  )
                })}
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What was discussed? What's the next step?"
                rows={3}
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />

              {error && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
                  <AlertCircle style={{ width: 13, height: 13, color: C.red }} />
                  <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{error}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={onClose} style={{ flex: '0 0 auto', padding: '11px 20px', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Skip
                </button>
                <button onClick={handleSave} disabled={saving || !outcome}
                  style={{ flex: 1, padding: '11px 0', background: saving || !outcome ? '#E2E8F0' : C.blue, border: 'none', borderRadius: 10, color: saving || !outcome ? C.label : '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !outcome ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {saving ? 'Saving…' : <><Check style={{ width: 14, height: 14 }} /> Save Call</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
