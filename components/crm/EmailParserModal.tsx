'use client'

import { useState } from 'react'
import { X, Mail, Loader2, Check, AlertCircle, Sparkles, ArrowRight } from 'lucide-react'
import { Lead } from '@/lib/supabase'

const PANEL          = '#FFFFFF'
const BORDER         = '#E8ECF0'
const BG             = '#F5F6FA'
const TEXT           = '#263238'
const MUTED          = '#78889B'
const LABEL          = '#A4B1BE'
const ORANGE         = '#FF7043'
const ORANGE_DIM     = 'rgba(255,112,67,0.09)'
const ORANGE_BORDER  = 'rgba(255,112,67,0.22)'
const ORANGE_GRAD    = 'linear-gradient(135deg, #FF7043 0%, #FF8A65 100%)'
const EMERALD        = '#059669'

const EXAMPLE_EMAIL = `Subject: New Lead – 3BHK in Bandra West from MagicBricks

Name: Priya Sharma
Mobile: 9876543210
Email: priya.sharma@gmail.com
City: Mumbai
Property Type: 3BHK Apartment
Budget: 1.5 Cr – 2 Cr
Preferred Localities: Bandra West, Juhu
Timeline: Immediate
Message: Looking for a ready-to-move flat for end use.`

interface EmailParserModalProps {
  onClose: () => void
  onSuccess: (lead: Partial<Lead>) => void
}

export function EmailParserModal({ onClose, onSuccess }: EmailParserModalProps) {
  const [subject, setSubject]       = useState('')
  const [emailText, setEmailText]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<Partial<Lead> | null>(null)

  const handleParse = async () => {
    if (!emailText.trim()) { setError('Please paste the email body.'); return }
    setLoading(true); setError(null); setParsedData(null)
    try {
      const res = await fetch('/api/leads/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: (subject ? `Subject: ${subject}\n\n` : '') + emailText }),
      })
      if (!res.ok) throw new Error('Failed to parse email. Please try again.')
      setParsedData(await res.json())
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const tryExample = () => {
    setSubject('New Lead – 3BHK in Bandra West from MagicBricks')
    setEmailText(`Name: Priya Sharma
Mobile: 9876543210
Email: priya.sharma@gmail.com
City: Mumbai
Property Type: 3BHK Apartment
Budget: 1.5 Cr – 2 Cr
Preferred Localities: Bandra West, Juhu
Timeline: Immediate
Message: Looking for a ready-to-move flat for end use.`)
    setError(null)
  }

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</label>
      <div style={{ padding: '8px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: value ? TEXT : LABEL, fontSize: 13 }}>
        {value || '—'}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)' }} onClick={onClose} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 820, maxHeight: '90vh', background: PANEL, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail style={{ width: 16, height: 16, color: ORANGE }} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: 0 }}>Quick Import</h2>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Paste a portal email · AI extracts the lead</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, cursor: 'pointer' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {!parsedData ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left — input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Email Subject (Optional)</label>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. New Lead from MagicBricks – 2BHK Pune"
                    style={{ width: '100%', padding: '9px 13px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                    onFocus={e => (e.currentTarget.style.borderColor = ORANGE_BORDER)}
                    onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Paste Email Body <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <textarea
                    value={emailText}
                    onChange={e => setEmailText(e.target.value)}
                    placeholder={'Paste the portal lead email here...\n\nWorks with MagicBricks, 99acres, Housing.com, NoBroker, Facebook, or any portal email.'}
                    disabled={loading}
                    style={{ flex: 1, minHeight: 180, padding: 13, background: BG, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                    onFocus={e => (e.currentTarget.style.borderColor = ORANGE_BORDER)}
                    onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                  />
                </div>
                {error && (
                  <div style={{ padding: '9px 13px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle style={{ width: 13, height: 13, color: '#EF4444', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>
                  </div>
                )}
              </div>

              {/* Right — example email */}
              <div style={{ background: BG, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Example Email</span>
                  <button
                    onClick={tryExample}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: ORANGE, background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
                    Try it <ArrowRight style={{ width: 11, height: 11 }} />
                  </button>
                </div>
                <pre style={{ margin: 0, fontSize: 11.5, color: MUTED, lineHeight: 1.75, fontFamily: 'ui-monospace, SFMono-Regular, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {EXAMPLE_EMAIL}
                </pre>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '10px 14px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 8 }}>
                <Check style={{ width: 14, height: 14, color: EMERALD, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: EMERALD, fontWeight: 600 }}>Lead extracted successfully</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Name"          value={parsedData.name} />
                <Field label="Phone"         value={parsedData.phone} />
                <Field label="Email"         value={parsedData.email} />
                <Field label="Property Type" value={parsedData.property_type} />
                <Field label="Timeline"      value={parsedData.timeline} />
                <Field label="Source"        value={parsedData.source} />
              </div>
            </div>
          )}
        </div>

        {/* Pro tip bar */}
        {!parsedData && (
          <div style={{ padding: '10px 24px', background: `${ORANGE}07`, borderTop: `1px solid ${ORANGE_BORDER}` }}>
            <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: ORANGE }}>Pro tip:</span> Set up a Gmail filter to auto-forward emails from portals to a dedicated inbox, then paste them here in bulk. Once deployed, webhooks handle this automatically — zero manual work.
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#FAFBFC' }}>
          <button
            onClick={parsedData ? () => setParsedData(null) : onClose}
            style={{ padding: '9px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            {parsedData ? 'Back' : 'Cancel'}
          </button>
          {!parsedData ? (
            <button
              onClick={handleParse}
              disabled={loading || !emailText.trim()}
              style={{ padding: '9px 20px', background: loading || !emailText.trim() ? '#F5C4B8' : ORANGE_GRAD, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading || !emailText.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading
                ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Extracting…</>
                : <><Sparkles style={{ width: 13, height: 13 }} /> Extract Lead</>}
            </button>
          ) : (
            <button
              onClick={() => { if (parsedData) onSuccess(parsedData) }}
              style={{ padding: '9px 20px', background: ORANGE_GRAD, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Add Lead →
            </button>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
