'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PORTALS } from './portals'
import { Plug, ChevronRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0', borderDim: '#F1F5F9',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#a000c8', blueDim: 'rgba(160,0,200,0.07)',
  emerald: '#059669', emeraldDim: '#ECFDF5',
}

export default function IntegrationsPage() {
  const router = useRouter()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ingest/log?limit=1000&status=all&source=all')
      .then(r => r.json())
      .then(j => {
        const rows: { source_portal: string }[] = j.data?.rows ?? []
        const c: Record<string, number> = {}
        rows.forEach(r => { c[r.source_portal] = (c[r.source_portal] ?? 0) + 1 })
        setCounts(c)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getCount = (id: string) => {
    const name = PORTALS.find(p => p.id === id)?.name ?? ''
    return counts[name] ?? 0
  }

  const METHOD_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    account_manager: { label: 'Via Account Manager', color: C.muted,    bg: C.borderDim   },
    self_serve:      { label: 'Self-serve',           color: C.emerald, bg: C.emeraldDim  },
    zapier:          { label: 'Via Zapier',           color: '#be2ed6',  bg: 'rgba(190,46,214,0.07)'     },
  }

  return (
    <div style={{ padding: '28px 28px 60px', minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#a000c8,#a000c8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plug size={18} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Integrations</h1>
        </div>
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 0 52px', lineHeight: 1.6 }}>
          Connect RealEdge with your portals. Leads flow in automatically — no manual copy-paste.
        </p>
      </div>

      {/* Portal grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {PORTALS.map(portal => {
          const count   = getCount(portal.id)
          const ml      = METHOD_LABELS[portal.method]
          const active  = count > 0

          return (
            <div key={portal.id} style={{ background: C.panel, border: `1px solid ${active ? portal.color + '40' : C.border}`, borderRadius: 20, overflow: 'hidden', boxShadow: active ? `0 2px 16px ${portal.color}15` : '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s' }}>

              {/* Card header */}
              <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: portal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {portal.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{portal.name}</span>
                    {active && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, background: C.emeraldDim, color: C.emerald, borderRadius: 20, padding: '2px 8px' }}>
                        <CheckCircle2 size={9} /> Active
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{portal.tagline}</p>
                </div>
              </div>

              {/* Stats */}
              <div style={{ padding: '0 20px 16px', display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: portal.color }}>{loading ? '—' : count}</div>
                  <div style={{ fontSize: 10, color: C.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Leads</div>
                </div>
                <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{loading ? '—' : (active ? 'Live' : '—')}</div>
                  <div style={{ fontSize: 10, color: C.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.borderDim}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, background: ml.bg, color: ml.color, borderRadius: 20, padding: '3px 10px' }}>
                  {ml.label}
                </span>
                <button
                  onClick={() => router.push(`/dashboard/integrations/${portal.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: active ? portal.bg : 'linear-gradient(135deg,#a000c8,#a000c8)', border: active ? `1px solid ${portal.color}40` : 'none', borderRadius: 10, color: active ? portal.color : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {active ? 'Manage' : 'Configure'} <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom info */}
      <div style={{ marginTop: 28, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertCircle size={16} color={C.blue} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>How it works:</strong> Each integration gives you a unique webhook URL. Send it to your portal's account manager — they configure it on their end. Once done, every new enquiry lands directly in RealEdge, auto-scored and ready to call.
        </div>
      </div>

      {loading && <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 16px', fontSize: 12, color: C.muted, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading lead counts…
      </div>}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
