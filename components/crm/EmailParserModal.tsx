'use client'

import { useState } from 'react'
import { X, Mail, Loader2, Check, AlertCircle } from 'lucide-react'
import { Lead } from '@/lib/supabase'

const BG = '#080D18'
const PANEL = '#0E1623'
const BORDER = 'rgba(255,255,255,0.06)'
const AMBER = '#F59E0B'
const TEXT = '#F1F5F9'
const MUTED = 'rgba(255,255,255,0.35)'

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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: emailText }),
            })

            if (!response.ok) {
                throw new Error('Failed to parse email. Please try again.')
            }

            const data = await response.json()
            setParsedData(data)
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = () => {
        if (parsedData) {
            onSuccess(parsedData)
        }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            {/* Backdrop */}
            <div
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                onClick={onClose}
            />

            {/* Modal */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 600, maxHeight: '90vh', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Mail style={{ width: 16, height: 16, color: AMBER }} />
                        </div>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: 0 }}>Parse from Email/Text</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 8, color: MUTED, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = TEXT }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = MUTED }}
                    >
                        <X style={{ width: 16, height: 16 }} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: 24, overflowY: 'auto' }}>
                    {!parsedData ? (
                        <>
                            <p style={{ fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
                                Paste the contents of an email, WhatsApp message, or SMS. Our AI will automatically extract the lead's name, contact info, and requirements.
                            </p>

                            <textarea
                                value={emailText}
                                onChange={(e) => setEmailText(e.target.value)}
                                placeholder="Paste message text here..."
                                style={{
                                    width: '100%',
                                    height: 200,
                                    padding: 16,
                                    background: 'rgba(0,0,0,0.2)',
                                    border: `1px solid ${BORDER}`,
                                    borderRadius: 12,
                                    color: TEXT,
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                    resize: 'vertical',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                                disabled={loading}
                            />

                            {error && (
                                <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertCircle style={{ width: 14, height: 14, color: '#EF4444' }} />
                                    <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{error}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
                                <Check style={{ width: 16, height: 16, color: '#10B981' }} />
                                <p style={{ fontSize: 13, color: '#10B981', margin: 0, fontWeight: 500 }}>Successfully extracted lead details!</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Name</label>
                                    <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 14 }}>
                                        {parsedData.name || <span style={{ color: MUTED }}>Not found</span>}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Phone</label>
                                    <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 14 }}>
                                        {parsedData.phone || <span style={{ color: MUTED }}>Not found</span>}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Email</label>
                                    <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 14 }}>
                                        {parsedData.email || <span style={{ color: MUTED }}>Not found</span>}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Property Type</label>
                                    <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 14 }}>
                                        {parsedData.property_type || <span style={{ color: MUTED }}>Not found</span>}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Timeline</label>
                                    <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 14 }}>
                                        {parsedData.timeline || <span style={{ color: MUTED }}>Not found</span>}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Source</label>
                                    <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 14 }}>
                                        {parsedData.source || <span style={{ color: MUTED }}>Not found</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                    <button
                        onClick={parsedData ? () => setParsedData(null) : onClose}
                        style={{ padding: '10px 18px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                        {parsedData ? 'Back' : 'Cancel'}
                    </button>

                    {!parsedData ? (
                        <button
                            onClick={handleParse}
                            disabled={loading || !emailText.trim()}
                            style={{ padding: '10px 18px', background: AMBER, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 600, cursor: (loading || !emailText.trim()) ? 'not-allowed' : 'pointer', opacity: (loading || !emailText.trim()) ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            {loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Parsing...</> : 'Extract Info'}
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            style={{ padding: '10px 18px', background: AMBER, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                            Continue to Add Lead
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
