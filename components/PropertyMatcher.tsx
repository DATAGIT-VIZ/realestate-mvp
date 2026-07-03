'use client'

import { useState } from 'react'
import { Building2, Sparkles, RefreshCw, MessageCircle, ChevronDown, ChevronUp, AlertCircle, Star } from 'lucide-react'

const C = {
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  violet:  '#7C3AED',
  emerald: '#059669',
  amber:   '#D97706',
  red:     '#EF4444',
  blue:    '#2563EB',
}

type Match = {
  id:             string | null
  title:          string
  price:          string
  city:           string
  locality:       string
  type:           string
  bedrooms:       number | null
  matchScore:     number
  matchReasons:   string[]
  concern:        string | null
  whatsappSnippet: string
}

type LeadProps = {
  name:        string
  city:        string | null
  budgetMin:   number | null
  budgetMax:   number | null
  propertyType: string[] | null
  timeline:    string | null
  localities:  string[] | null
  phone:       string | null
}

export function PropertyMatcher({ lead }: { lead: LeadProps }) {
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [matches, setMatches]   = useState<Match[]>([])
  const [summary, setSummary]   = useState<string | null>(null)
  const [hasInventory, setHasInventory] = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [ran, setRan]           = useState(false)

  const handleMatch = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/ai/property-matcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setMatches(json.data.matches ?? [])
      setSummary(json.data.summary ?? null)
      setHasInventory(json.data.hasInventory ?? false)
      setRan(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Matching failed')
    } finally {
      setLoading(false)
    }
  }

  const sendWhatsApp = (snippet: string) => {
    if (!lead.phone) return
    const num = lead.phone.replace(/\D/g, '').replace(/^0/, '91').replace(/^(?!91)/, '91')
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(snippet)}`, '_blank')
  }

  const scoreColor = (s: number) => s >= 75 ? C.emerald : s >= 50 ? C.amber : C.label

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>

      {/* Header */}
      <button
        onClick={() => { setOpen(v => !v); if (!open && !ran) handleMatch() }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 style={{ width: 14, height: 14, color: C.violet }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>AI Property Matcher</p>
            <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
              {ran ? `${matches.length} match${matches.length !== 1 ? 'es' : ''} found` : 'Find matching properties'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {ran && (
            <button onClick={e => { e.stopPropagation(); handleMatch() }}
              style={{ padding: '4px 8px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw style={{ width: 10, height: 10, animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Re-run
            </button>
          )}
          {open ? <ChevronUp style={{ width: 15, height: 15, color: C.label }} /> : <ChevronDown style={{ width: 15, height: 15, color: C.label }} />}
        </div>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 18px' }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
              <Sparkles style={{ width: 14, height: 14, color: C.violet, animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: C.muted }}>Matching properties…</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '10px 0' }}>
              <AlertCircle style={{ width: 13, height: 13, color: C.red }} />
              <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* No inventory hint */}
          {!loading && ran && !hasInventory && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
                <strong>No inventory yet</strong> — showing AI suggestions. <a href="/dashboard/properties" style={{ color: C.violet, textDecoration: 'none', fontWeight: 600 }}>Add properties →</a>
              </p>
            </div>
          )}

          {/* Summary */}
          {!loading && summary && (
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 12px', lineHeight: 1.5, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
              {summary}
            </p>
          )}

          {/* Match cards */}
          {!loading && matches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {matches.map((m, i) => (
                <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {/* Match header */}
                  <div style={{ padding: '10px 12px', background: '#FAFAFA', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.title}
                      </p>
                      <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
                        {[m.bedrooms ? `${m.bedrooms}BHK` : null, m.type, m.locality, m.city].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>{m.price}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                        <Star style={{ width: 9, height: 9, color: scoreColor(m.matchScore), fill: scoreColor(m.matchScore) }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(m.matchScore) }}>{m.matchScore}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Reasons */}
                  <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}` }}>
                    {m.matchReasons.slice(0, 2).map((r, j) => (
                      <p key={j} style={{ fontSize: 11, color: C.emerald, margin: j < m.matchReasons.length - 1 ? '0 0 2px' : 0, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <span style={{ flexShrink: 0, marginTop: 1 }}>✓</span> {r}
                      </p>
                    ))}
                    {m.concern && (
                      <p style={{ fontSize: 11, color: C.amber, margin: '4px 0 0', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span> {m.concern}
                      </p>
                    )}
                  </div>

                  {/* Send WA */}
                  {lead.phone && (
                    <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}` }}>
                      <button onClick={() => sendWhatsApp(m.whatsappSnippet)}
                        style={{ width: '100%', padding: '7px 0', background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      >
                        <MessageCircle style={{ width: 11, height: 11 }} /> Send on WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
