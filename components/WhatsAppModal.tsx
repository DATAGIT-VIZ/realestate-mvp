'use client'

import { useState, useEffect } from 'react'
import { X, MessageCircle, Send, Loader2, Check, Paperclip, FileText, ChevronDown } from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG_OVERLAY = 'rgba(15,23,42,0.4)'
const PANEL      = '#FFFFFF'
const BORDER     = '#E2E8F0'
const PRIMARY    = '#FF7043'
const GREEN      = '#059669'
const TEXT       = '#0F172A'
const MUTED      = '#64748B'
const BG         = '#F8FAFC'

type Brochure = { id: string; name: string; project_name: string | null; file_url: string; file_type: string }

// ─── Template definitions ─────────────────────────────────────────────────────
// These match your template names in Interakt. Variables are shown as {{1}}, {{2}}…
// Edit variable labels to match your actual template variable meanings.

type Variable = { key: string; label: string; placeholder: string; prefill?: string }

type Template = {
  name: string          // Interakt template name (exact string)
  label: string         // Display label
  description: string
  body: string          // Preview text with {{variable}} placeholders
  variables: Variable[]
}

const TEMPLATES: Template[] = [
  {
    name: 'vyapulse_welcome',
    label: 'Welcome',
    description: 'First message after lead comes in',
    body: `Hi {{name}}! 👋\n\nThank you for your interest in properties. I'm {{agent_name}} from Vya Pulse.\n\nI'd love to understand your requirements better and help you find your perfect property. Could we schedule a quick 10-minute call?`,
    variables: [
      { key: 'name',       label: 'Lead name',  placeholder: 'Rahul', prefill: '' },
      { key: 'agent_name', label: 'Your name',  placeholder: 'Priya', prefill: '' },
    ],
  },
  {
    name: 'vyapulse_followup_day1',
    label: 'Follow-up Day 1',
    description: 'Next-day follow-up',
    body: `Hi {{name}}, this is {{agent_name}} again from Vya Pulse.\n\nJust wanted to follow up on your property search. Have you had a chance to think about the budget and localities?\n\nI have some great options in {{city}} that match your requirements. Shall I share them?`,
    variables: [
      { key: 'name',       label: 'Lead name', placeholder: 'Rahul', prefill: '' },
      { key: 'agent_name', label: 'Your name', placeholder: 'Priya', prefill: '' },
      { key: 'city',       label: 'City',      placeholder: 'Pune',  prefill: '' },
    ],
  },
  {
    name: 'vyapulse_followup_day3',
    label: 'Follow-up Day 3',
    description: 'Day 3 follow-up nudge',
    body: `Hi {{name}}! 🏠\n\nI've shortlisted {{count}} properties in {{city}} that are a great match for your budget of {{budget}}.\n\nWould you like me to share the details? A site visit can be arranged at your convenience.`,
    variables: [
      { key: 'name',   label: 'Lead name',       placeholder: 'Rahul',   prefill: '' },
      { key: 'count',  label: 'Property count',  placeholder: '3',       prefill: '' },
      { key: 'city',   label: 'City',            placeholder: 'Pune',    prefill: '' },
      { key: 'budget', label: 'Budget',          placeholder: '₹80L',    prefill: '' },
    ],
  },
  {
    name: 'vyapulse_property_recommendation',
    label: 'Property Recommendation',
    description: 'Share a specific property',
    body: `Hi {{name}}! I found a property that matches exactly what you're looking for:\n\n🏢 *{{property_name}}*\n📍 {{locality}}, {{city}}\n💰 ₹{{price}}\n🛏 {{bhk}}\n\nInterested in a site visit? I can arrange one this week!`,
    variables: [
      { key: 'name',          label: 'Lead name',      placeholder: 'Rahul',     prefill: '' },
      { key: 'property_name', label: 'Property name',  placeholder: 'Lodha Palava', prefill: '' },
      { key: 'locality',      label: 'Locality',       placeholder: 'Dombivli',  prefill: '' },
      { key: 'city',          label: 'City',           placeholder: 'Mumbai',    prefill: '' },
      { key: 'price',         label: 'Price',          placeholder: '85 Lac',    prefill: '' },
      { key: 'bhk',           label: 'BHK config',     placeholder: '2 BHK',     prefill: '' },
    ],
  },
  {
    name: 'vyapulse_site_visit_reminder',
    label: 'Site Visit Reminder',
    description: 'Reminder before a scheduled visit',
    body: `Hi {{name}}! 📅\n\nThis is a reminder about your site visit scheduled for *{{date}}* at *{{time}}*.\n\n📍 {{property_name}}, {{locality}}\n\nPlease confirm your attendance. See you there! 🙏`,
    variables: [
      { key: 'name',          label: 'Lead name',     placeholder: 'Rahul',      prefill: '' },
      { key: 'date',          label: 'Visit date',    placeholder: 'Tuesday, 25 Jun', prefill: '' },
      { key: 'time',          label: 'Visit time',    placeholder: '11:00 AM',   prefill: '' },
      { key: 'property_name', label: 'Property name', placeholder: 'Prestige Lakeside', prefill: '' },
      { key: 'locality',      label: 'Locality',      placeholder: 'Whitefield', prefill: '' },
    ],
  },
]

// Replace {{key}} placeholders with filled values for preview
function renderPreview(template: Template, values: Record<string, string>): string {
  let text = template.body
  for (const v of template.variables) {
    text = text.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), values[v.key] || `{{${v.key}}}`)
  }
  return text
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  isOpen: boolean
  onClose: () => void
  leadId: string
  leadName?: string
  leadPhone?: string
  city?: string
}

export function WhatsAppModal({ isOpen, onClose, leadId, leadName = '', leadPhone = '', city = '' }: Props) {
  const [step, setStep]                   = useState<'pick' | 'fill' | 'sent'>('pick')
  const [selectedTpl, setSelectedTpl]     = useState<Template | null>(null)
  const [values, setValues]               = useState<Record<string, string>>({})
  const [brochures, setBrochures]         = useState<Brochure[]>([])
  const [selectedBrochure, setSelectedBrochure] = useState<Brochure | null>(null)
  const [brochureOpen, setBrochureOpen]   = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetch('/api/brochures').then(r => r.json()).then(d => setBrochures(d.brochures ?? []))
    }
  }, [isOpen])

  if (!isOpen) return null

  const close = () => {
    setStep('pick'); setSelectedTpl(null); setValues({})
    setSelectedBrochure(null); setBrochureOpen(false); setError(null); onClose()
  }

  const selectTemplate = (tpl: Template) => {
    // Pre-fill obvious values from lead context
    const prefilled: Record<string, string> = {}
    for (const v of tpl.variables) {
      if (v.key === 'name')  prefilled[v.key] = leadName.split(' ')[0] || ''
      if (v.key === 'city')  prefilled[v.key] = city || ''
    }
    setValues(prefilled)
    setSelectedTpl(tpl)
    setStep('fill')
  }

  const send = async () => {
    if (!selectedTpl) return
    setLoading(true)
    setError(null)
    try {
      const variableList = selectedTpl.variables.map(v => values[v.key] ?? '')
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          to: leadPhone,
          templateName: selectedTpl.name,
          variables: variableList,
          brochureUrl:  selectedBrochure?.file_url  ?? undefined,
          brochureName: selectedBrochure?.name ?? undefined,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setStep('sent')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 11px',
    background: BG, border: `1px solid ${BORDER}`,
    borderRadius: 8, color: TEXT, fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: BG_OVERLAY, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && close()}
    >
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle style={{ width: 16, height: 16, color: '#25D366' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: 0 }}>
                {step === 'pick' ? 'Choose Template' : step === 'fill' ? 'Preview & Send' : 'Message Sent!'}
              </h2>
              <p style={{ fontSize: 11, color: MUTED, margin: '1px 0 0' }}>
                {leadName ? `To: ${leadName}` : leadPhone}
                {step === 'fill' && selectedTpl ? ` · ${selectedTpl.label}` : ''}
              </p>
            </div>
          </div>
          <button onClick={close} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Step 1: Template picker + brochure ── */}
          {step === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Templates */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Choose Template</p>
                {TEMPLATES.map(tpl => (
                  <button key={tpl.name} onClick={() => selectTemplate(tpl)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '13px 16px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,112,67,0.03)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.background = BG }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{tpl.label}</span>
                    <span style={{ fontSize: 12, color: MUTED }}>{tpl.description}</span>
                  </button>
                ))}
              </div>

              {/* Brochure picker — shown in step 1 so agent can select before picking template */}
              {brochures.length > 0 && (
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Paperclip style={{ width: 11, height: 11 }} />Attach Brochure
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
                  </p>
                  <div style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setBrochureOpen(o => !o)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: selectedBrochure ? 'rgba(255,112,67,0.05)' : BG, border: `1px solid ${selectedBrochure ? PRIMARY : BORDER}`, borderRadius: 9, cursor: 'pointer' }}
                    >
                      <FileText style={{ width: 13, height: 13, color: selectedBrochure ? PRIMARY : MUTED, flexShrink: 0 }} />
                      <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: selectedBrochure ? TEXT : MUTED }}>
                        {selectedBrochure ? selectedBrochure.name : 'Select a brochure to send…'}
                      </span>
                      {selectedBrochure && (
                        <span onClick={e => { e.stopPropagation(); setSelectedBrochure(null) }}
                          style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,112,67,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <X style={{ width: 9, height: 9, color: PRIMARY }} />
                        </span>
                      )}
                      <ChevronDown style={{ width: 13, height: 13, color: MUTED, transform: brochureOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </button>
                    {brochureOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                        {brochures.map(b => (
                          <button key={b.id} type="button"
                            onClick={() => { setSelectedBrochure(b); setBrochureOpen(false) }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: selectedBrochure?.id === b.id ? 'rgba(255,112,67,0.06)' : 'transparent', border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left' }}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,112,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileText style={{ width: 15, height: 15, color: PRIMARY }} />
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0 }}>{b.name}</p>
                              {b.project_name && <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>{b.project_name}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedBrochure && (
                    <p style={{ fontSize: 11, color: PRIMARY, margin: '6px 0 0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Paperclip style={{ width: 10, height: 10 }} />
                      Will be sent alongside the template message
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Fill variables + preview ── */}
          {step === 'fill' && selectedTpl && (
            <>
              {selectedBrochure && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(255,112,67,0.07)', border: '1px solid rgba(255,112,67,0.2)', borderRadius: 8 }}>
                  <Paperclip style={{ width: 12, height: 12, color: PRIMARY, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600, flex: 1 }}>📎 {selectedBrochure.name}</span>
                  <button type="button" onClick={() => setSelectedBrochure(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: PRIMARY, fontSize: 11 }}>Remove</button>
                </div>
              )}
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '9px 12px' }}>
                  <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>
                </div>
              )}

              {/* Variable inputs */}
              {selectedTpl.variables.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Fill in Variables</p>
                  {selectedTpl.variables.map(v => (
                    <div key={v.key}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>{v.label}</label>
                      <input
                        type="text"
                        placeholder={v.placeholder}
                        value={values[v.key] ?? ''}
                        onChange={e => setValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Live preview */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Preview</p>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '14px 16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -1, left: -1, right: -1, height: 3, background: '#25D366', borderRadius: '14px 14px 0 0' }} />
                  <pre style={{ margin: 0, fontSize: 13, color: '#0F172A', fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                    {renderPreview(selectedTpl, values)}
                  </pre>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Sent confirmation ── */}
          {step === 'sent' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Check style={{ width: 24, height: 24, color: GREEN }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: '0 0 6px' }}>Message sent!</p>
              <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px' }}>
                {selectedTpl?.label} sent to {leadName || leadPhone}. Activity logged in timeline.
              </p>
              <button onClick={close}
                style={{ padding: '9px 24px', background: PRIMARY, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer — only show on fill step */}
        {step === 'fill' && (
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setStep('pick')}
              style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              ← Back
            </button>
            <button onClick={send} disabled={loading || !leadPhone}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: loading ? 'rgba(160,0,200,0.5)' : PRIMARY, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading
                ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />Sending…</>
                : <><Send style={{ width: 13, height: 13 }} />Send on WhatsApp</>
              }
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
