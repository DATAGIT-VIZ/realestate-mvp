'use client'

import { useState } from 'react'
import { Sparkles, Copy, MessageCircle, Mail, RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

const C = {
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  violet:  '#7C3AED',
  blue:    '#2563EB',
  emerald: '#059669',
  red:     '#EF4444',
  amber:   '#D97706',
}

type OutputType = 'whatsapp' | 'email'

type LeadContext = {
  leadId:      string
  name:        string
  city:        string | null
  budget:      string | null
  propertyType: string | null
  timeline:    string | null
  score:       number
  lastActivity: string | null
  status:      string | null
  phone:       string | null
}

type Props = {
  lead: LeadContext
}

export function FollowUpWriter({ lead }: Props) {
  const [open, setOpen]               = useState(false)
  const [outputType, setOutputType]   = useState<OutputType>('whatsapp')
  const [agentContext, setAgentContext] = useState('')
  const [result, setResult]           = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)

  const handleGenerate = async () => {
    if (!agentContext.trim()) { setError('Describe what happened first'); return }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res  = await fetch('/api/ai/followup-writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            name:         lead.name,
            city:         lead.city,
            budget:       lead.budget,
            propertyType: lead.propertyType,
            timeline:     lead.timeline,
            score:        lead.score,
            lastActivity: lead.lastActivity,
            status:       lead.status,
          },
          agentContext,
          outputType,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResult(json.data.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendWhatsApp = () => {
    if (!result || !lead.phone) return
    const num = lead.phone.replace(/\D/g, '').replace(/^0/, '91').replace(/^(?!91)/, '91')
    const url = `https://wa.me/${num}?text=${encodeURIComponent(result)}`
    window.open(url, '_blank')
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>

      {/* Header — always visible, toggles panel */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14, color: C.violet }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>AI Follow-up Writer</p>
            <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>Generate a message in seconds</p>
          </div>
        </div>
        {open
          ? <ChevronUp style={{ width: 15, height: 15, color: C.label }} />
          : <ChevronDown style={{ width: 15, height: 15, color: C.label }} />
        }
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${C.border}` }}>

          {/* Output type toggle */}
          <div style={{ display: 'flex', background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2, marginBottom: 14, marginTop: 14 }}>
            {(['whatsapp', 'email'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setOutputType(t); setResult(null) }}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: outputType === t ? C.panel : 'transparent',
                  color:      outputType === t ? C.text   : C.muted,
                  boxShadow:  outputType === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'whatsapp'
                  ? <MessageCircle style={{ width: 13, height: 13, color: outputType === t ? '#25D366' : C.label }} />
                  : <Mail style={{ width: 13, height: 13, color: outputType === t ? C.blue : C.label }} />
                }
                {t === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </button>
            ))}
          </div>

          {/* Context input */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            What happened?
          </label>
          <textarea
            value={agentContext}
            onChange={e => setAgentContext(e.target.value)}
            placeholder={
              outputType === 'whatsapp'
                ? `e.g. "Called yesterday, interested in 3BHK Baner, wants site visit this Sunday"`
                : `e.g. "Met at housing expo, interested in 2BHK under 80L, first-time buyer, needs home loan info"`
            }
            rows={3}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.text, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
            onFocus={e => (e.currentTarget.style.borderColor = C.violet)}
            onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
          />

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
              <AlertCircle style={{ width: 12, height: 12, color: C.red, flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: C.red, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !agentContext.trim()}
            style={{
              width: '100%', marginTop: 10, padding: '10px 0',
              background: loading || !agentContext.trim() ? '#E2E8F0' : `linear-gradient(135deg, #7C3AED, #6D28D9)`,
              border: 'none', borderRadius: 10, color: loading || !agentContext.trim() ? C.label : '#fff',
              fontSize: 12, fontWeight: 700, cursor: loading || !agentContext.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'all 0.15s',
            }}
          >
            {loading
              ? <><RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Generating…</>
              : <><Sparkles style={{ width: 13, height: 13 }} /> Generate Message</>
            }
          </button>

          {/* Result */}
          {result && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.violet, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Generated</span>
                <button onClick={handleGenerate} style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RefreshCw style={{ width: 10, height: 10 }} /> Regenerate
                </button>
              </div>

              <div style={{ background: '#FAFAFA', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', position: 'relative' }}>
                <pre style={{ fontSize: 12, color: C.text, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.7 }}>
                  {result}
                </pre>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={handleCopy}
                  style={{ flex: 1, padding: '9px 0', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, color: copied ? C.emerald : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s' }}
                >
                  {copied ? <><Check style={{ width: 12, height: 12 }} /> Copied!</> : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
                </button>

                {outputType === 'whatsapp' && lead.phone && (
                  <button onClick={handleSendWhatsApp}
                    style={{ flex: 1, padding: '9px 0', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <MessageCircle style={{ width: 12, height: 12 }} /> Send on WA
                  </button>
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
