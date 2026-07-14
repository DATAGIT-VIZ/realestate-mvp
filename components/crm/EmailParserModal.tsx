'use client'

import { useState } from 'react'
import { X, Mail, Loader2, Check, AlertCircle } from 'lucide-react'
import { Lead } from '@/lib/supabase'

const PANEL        = '#FFFFFF'
const BORDER       = '#E2E8F0'
const BG_TINT      = '#FAFAFA'
const TEXT         = '#0F172A'
const MUTED        = '#64748B'
const LABEL        = '#94A3B8'
const PRIMARY      = '#a000c8'
const PRIMARY_DIM  = 'rgba(160,0,200,0.08)'
const PRIMARY_BORDER = 'rgba(160,0,200,0.25)'
const GRAD         = 'linear-gradient(135deg, #7600bc 0%, #b100cd 100%)'

interface EmailParserModalProps {
    onClose: () => void
    onSuccess: (lead: Partial<Lead>) => void
}

export function EmailParserModal({ onClose, onSuccess }: EmailParserModalProps) {
    const [emailText, setEmailText] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [parsedData, setParsedData] = useState<Partial<Lead> | null>(null)

    const handleParse = async () => {
        if (!emailText.trim()) {
            setError('Please paste some email or message text.')
            return
        }
        setLoading(true)
        setError(null)
        setParsedData(null)
        try {
            const response = await fetch('/api/leads/parse-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: emailText }),
            })
            if (!response.ok) throw new Error('Failed to parse email. Please try again.')
            const data = await response.json()
            setParsedData(data)
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = () => {
        if (parsedData) onSuccess(parsedData)
    }

    const Field = ({ label, value }: { label: string; value?: string | null }) => (
        <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</label>
            <div style={{ padding: '9px 13px', background: BG_TINT, border: `1px solid ${BORDER}`, borderRadius: 8, color: value ? TEXT : LABEL, fontSize: 13 }}>
                {value || 'Not found'}
            </div>
        </div>
    )

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            {/* Backdrop */}
            <div
                style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)' }}
                onClick={onClose}
            />

            {/* Modal */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '90vh', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(100,0,160,0.12), 0 4px 16px rgba(0,0,0,0.08)' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Mail style={{ width: 15, height: 15, color: PRIMARY }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: 0 }}>Parse from Email / Text</h2>
                            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>AI extracts lead info automatically</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, cursor: 'pointer' }}
                    >
                        <X style={{ width: 14, height: 14 }} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                    {!parsedData ? (
                        <>
                            <p style={{ fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.6 }}>
                                Paste the contents of an email, WhatsApp message, or SMS. Our AI will automatically extract the lead's name, contact info, and requirements.
                            </p>
                            <textarea
                                value={emailText}
                                onChange={(e) => setEmailText(e.target.value)}
                                placeholder="Paste message text here..."
                                style={{ width: '100%', height: 180, padding: 14, background: BG_TINT, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                                onFocus={e => { e.currentTarget.style.borderColor = PRIMARY_BORDER }}
                                onBlur={e => { e.currentTarget.style.borderColor = BORDER }}
                                disabled={loading}
                            />
                            {error && (
                                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertCircle style={{ width: 14, height: 14, color: '#EF4444', flexShrink: 0 }} />
                                    <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{error}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '10px 14px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 8 }}>
                                <Check style={{ width: 14, height: 14, color: '#059669', flexShrink: 0 }} />
                                <p style={{ fontSize: 13, color: '#059669', margin: 0, fontWeight: 600 }}>Lead details extracted successfully</p>
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

                {/* Footer */}
                <div style={{ padding: '14px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 10, background: BG_TINT }}>
                    <button
                        onClick={parsedData ? () => setParsedData(null) : onClose}
                        style={{ padding: '9px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                        {parsedData ? 'Back' : 'Cancel'}
                    </button>
                    {!parsedData ? (
                        <button
                            onClick={handleParse}
                            disabled={loading || !emailText.trim()}
                            style={{ padding: '9px 20px', background: (loading || !emailText.trim()) ? '#e8bcf0' : GRAD, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: (loading || !emailText.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            {loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Parsing...</> : 'Extract Info'}
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            style={{ padding: '9px 20px', background: GRAD, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                            Add Lead →
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
