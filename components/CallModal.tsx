'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Phone, PhoneSlash, PhoneX, PhoneCall,
  Clock, Check, X, Warning, Sparkle, Copy,
} from '@phosphor-icons/react'

const C = {
  bg:      '#FAFAF8',
  panel:   '#FFFFFF',
  border:  '#E2E2DC',
  text:    '#0C0C0B',
  muted:   '#78889B',
  label:   '#A4B1BE',
  emerald: '#059669',
  red:     '#DC2626',
  amber:   '#3B82F6',
  blue:    '#1D4ED8',
  orange:  '#1D4ED8',
}

const OUTCOMES = [
  { key: 'Answered',   label: 'Answered',   icon: Phone,      color: C.emerald },
  { key: 'No Answer',  label: 'No Answer',  icon: PhoneX,     color: C.amber   },
  { key: 'Busy',       label: 'Busy',       icon: PhoneSlash, color: C.orange  },
  { key: 'Wrong Num',  label: 'Wrong #',    icon: X,          color: C.red     },
  { key: 'Call Back',  label: 'Call Back',  icon: Clock,      color: C.blue    },
]

type Stage = 'setup' | 'calling' | 'log' | 'summary'

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

function generateCallSummary(form: {
  type: string
  outcome: string
  duration: number
  notes: string
  nextActionDate?: string
}): { summary: string; actions: string[] } {
  const mins   = Math.floor(form.duration / 60)
  const secs   = form.duration % 60
  const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  const outcomeMap: Record<string, string> = {
    Answered:   'The call was answered.',
    'No Answer': 'The lead did not pick up.',
    Busy:       'The line was busy.',
    'Wrong Num':'Wrong number reached.',
    'Call Back':'Lead requested a call back.',
  }
  const outcomeText = outcomeMap[form.outcome] ?? ''

  const summary = [
    form.type === 'Call Missed' ? 'Missed call attempt.' : `${durStr} call — ${outcomeText}`,
    form.notes ? form.notes : '',
  ].filter(Boolean).join(' ')

  const actions: string[] = []
  const n = form.notes.toLowerCase()
  if (n.includes('site visit') || n.includes('visit'))     actions.push('Schedule site visit')
  if (n.includes('brochure')   || n.includes('catalog'))   actions.push('Send brochure')
  if (n.includes('call back')  || n.includes('call me') || form.nextActionDate)
                                                            actions.push('Follow-up call scheduled')
  if (n.includes('whatsapp')   || n.includes('message'))   actions.push('Send WhatsApp follow-up')
  if (form.outcome === 'Call Back')                         actions.push('Schedule call back')

  return { summary, actions: [...new Set(actions)] }
}

const AGENT_PHONE_KEY = 'leadgap_agent_phone'

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
  const [aiSummary, setAiSummary]     = useState<{ summary: string; actions: string[] } | null>(null)
  const [copied, setCopied]           = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      setAiSummary(null)
      setCopied(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/calls/configured')
      .then(r => r.json())
      .then(j => setExoAvail(j.configured === true))
      .catch(() => setExoAvail(false))
  }, [isOpen])

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  const handleStartCall = async () => {
    if (exoAvail) {
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
      // Generate summary and switch to summary stage instead of closing
      const gen = generateCallSummary({ type: 'Call Made', outcome, duration: elapsed, notes: notes.trim() })
      setAiSummary(gen)
      setStage('summary')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCopySummary = () => {
    if (!aiSummary) return
    const text = [
      aiSummary.summary,
      aiSummary.actions.length > 0 ? '\nAction items:\n' + aiSummary.actions.map(a => `· ${a}`).join('\n') : '',
    ].filter(Boolean).join('')
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(12,12,11,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: C.panel, borderRadius: 2, border: `1px solid ${C.border}`, width: 420, overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ background: stage === 'calling' ? 'linear-gradient(135deg,#064E3B,#065F46)' : C.bg, padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: stage === 'calling' ? 16 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 2, background: stage === 'calling' ? 'rgba(5,150,105,0.3)' : stage === 'summary' ? 'rgba(146,119,58,0.12)' : 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {stage === 'calling'
                  ? <PhoneCall size={16} weight="light" color="#34D399" />
                  : stage === 'log'
                  ? <Check size={16} weight="light" color={C.emerald} />
                  : stage === 'summary'
                  ? <Sparkle size={16} weight="light" color="#8A6E35" />
                  : <Phone size={16} weight="light" color={C.emerald} />
                }
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: stage === 'calling' ? '#F0FDF4' : stage === 'summary' ? '#8A6E35' : C.text, margin: 0 }}>
                  {stage === 'setup' ? 'Call Lead' : stage === 'calling' ? 'Call in Progress' : stage === 'log' ? 'Log Outcome' : 'AI Call Summary'}
                </p>
                <p style={{ fontSize: 11, color: stage === 'calling' ? '#6EE7B7' : stage === 'summary' ? '#92773A' : C.muted, margin: 0 }}>
                  {stage === 'summary' ? 'Generated from your call notes' : leadName}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 2, border: `1px solid ${stage === 'calling' ? 'rgba(255,255,255,0.15)' : C.border}`, background: 'transparent', color: stage === 'calling' ? '#6EE7B7' : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} weight="light" />
            </button>
          </div>

          {stage === 'calling' && (
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <p style={{ fontSize: 38, fontWeight: 700, color: '#F0FDF4', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', margin: 0 }}>
                {formatDuration(elapsed)}
              </p>
              <p style={{ fontSize: 12, color: '#6EE7B7', margin: '6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block', animation: 'callpulse 1.5s ease-in-out infinite' }} />
                {callSid ? 'Connected via Exotel' : 'Manual timer'}
              </p>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 20 }}>

          {/* SETUP */}
          {stage === 'setup' && (
            <div>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, padding: '14px', marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Lead phone</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>{leadPhone}</p>
              </div>

              {exoAvail === true && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                    Your mobile number
                    <span style={{ fontWeight: 400, marginLeft: 6 }}>(Exotel will ring this first)</span>
                  </label>
                  <input
                    type="tel"
                    value={agentPhone}
                    onChange={e => setAgentPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, color: C.text, background: C.panel, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.blue)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                  {error && <p style={{ fontSize: 11, color: C.red, marginTop: 6 }}>{error}</p>}
                </div>
              )}

              <button onClick={handleStartCall}
                style={{ width: '100%', padding: '12px 0', background: C.emerald, border: 'none', borderRadius: 2, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                <Phone size={15} weight="light" />
                {exoAvail ? 'Start Call via Exotel' : 'Start Call'}
              </button>
            </div>
          )}

          {/* CALLING */}
          {stage === 'calling' && (
            <div>
              {callSid && (
                <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 14 }}>
                  Your phone will ring shortly. After the call ends, log the outcome.
                </p>
              )}

              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 7 }}>Quick note (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Jot notes while on the call…"
                rows={3}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Dismiss
                </button>
                <button onClick={handleEndCall}
                  style={{ flex: 1, padding: '10px 0', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 2, color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <PhoneSlash size={13} weight="light" /> End & Log
                </button>
              </div>
            </div>
          )}

          {/* LOG */}
          {stage === 'log' && (
            <div>
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 14px' }}>
                Duration: <strong style={{ color: C.text }}>{formatDuration(elapsed)}</strong>
              </p>

              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 9 }}>Call outcome</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7, marginBottom: 18 }}>
                {OUTCOMES.map(o => {
                  const Icon = o.icon
                  const sel  = outcome === o.key
                  return (
                    <button key={o.key} onClick={() => setOutcome(o.key)}
                      style={{ padding: '9px 4px', borderRadius: 2, border: `1.5px solid ${sel ? o.color : C.border}`, background: sel ? `${o.color}12` : C.panel, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, transition: 'all 0.12s' }}
                    >
                      <Icon size={15} weight="light" color={o.color} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: o.color, textAlign: 'center', lineHeight: 1.2 }}>{o.label}</span>
                    </button>
                  )
                })}
              </div>

              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 7 }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What was discussed? What's the next step?"
                rows={3}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />

              {error && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 9 }}>
                  <Warning size={12} weight="light" color={C.red} />
                  <p style={{ fontSize: 11, color: C.red, margin: 0 }}>{error}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={onClose} style={{ flex: '0 0 auto', padding: '10px 18px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Skip
                </button>
                <button onClick={handleSave} disabled={saving || !outcome}
                  style={{ flex: 1, padding: '10px 0', background: saving || !outcome ? C.bg : C.blue, border: `1px solid ${saving || !outcome ? C.border : C.blue}`, borderRadius: 2, color: saving || !outcome ? C.label : '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !outcome ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {saving ? 'Saving…' : <><Check size={13} weight="light" /> Save Call</>}
                </button>
              </div>
            </div>
          )}

          {/* SUMMARY */}
          {stage === 'summary' && aiSummary && (
            <div>
              {/* Summary text */}
              <div style={{ background: C.bg, border: `1px solid #E2E2DC`, borderRadius: 2, padding: '14px 16px', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65, margin: 0 }}>{aiSummary.summary}</p>
              </div>

              {/* Action items */}
              {aiSummary.actions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Action items detected</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {aiSummary.actions.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(29,78,216,0.04)', border: '1px solid rgba(29,78,216,0.12)', borderRadius: 2 }}>
                        <Check size={11} weight="light" color={C.blue} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.text }}>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: C.border, margin: '16px 0' }} />

              {/* Footer buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleCopySummary}
                  style={{ flex: 1, padding: '10px 0', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, color: copied ? C.emerald : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'color 0.15s, border-color 0.15s' }}
                >
                  {copied ? <Check size={13} weight="light" /> : <Copy size={13} weight="light" />}
                  {copied ? 'Copied' : 'Copy summary'}
                </button>
                <button
                  onClick={onClose}
                  style={{ flex: 1, padding: '10px 0', background: C.blue, border: 'none', borderRadius: 2, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes callpulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
