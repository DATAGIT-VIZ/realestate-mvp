'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { getPortal } from '../portals'
import {
  ArrowLeft, Copy, Check, Mail, MessageCircle,
  ExternalLink, CheckCircle2, Webhook, ChevronRight
} from 'lucide-react'

const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0', borderDim: '#F1F5F9',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#a000c8', blueDim: 'rgba(160,0,200,0.07)',
  emerald: '#059669', emeraldDim: '#ECFDF5',
  wa: '#25D366',
}

type StatBox = { label: string; value: number | string; color: string }

export default function PortalDetailPage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal: portalId } = use(params)
  const router = useRouter()
  const portal = getPortal(portalId)

  const [copied,    setCopied]    = useState<'url' | 'all' | null>(null)
  const [stats,     setStats]     = useState<StatBox[]>([])
  const [loadStats, setLoadStats] = useState(true)

  useEffect(() => {
    if (!portal) return
    fetch('/api/ingest/log?limit=1000&status=all&source=all')
      .then(r => r.json())
      .then(j => {
        const rows: { source_portal: string; status: string }[] = j.data?.rows ?? []
        const mine = rows.filter(r => r.source_portal?.toLowerCase().includes(portal.id.replace('-','').toLowerCase()) || r.source_portal?.toLowerCase() === portal.name.toLowerCase())
        const newC   = mine.filter(r => r.status === 'created').length
        const dupC   = mine.filter(r => r.status === 'duplicate').length
        const errC   = mine.filter(r => r.status === 'error').length
        setStats([
          { label: 'Total Leads', value: mine.length, color: portal.color },
          { label: 'New',         value: newC,         color: C.blue },
          { label: 'Duplicates',  value: dupC,         color: '#be2ed6' },
          { label: 'Errors',      value: errC,         color: '#DC2626' },
        ])
      })
      .catch(() => { setStats([
        { label: 'Total Leads', value: 0, color: portal?.color ?? C.blue },
        { label: 'New',         value: 0, color: C.blue },
        { label: 'Duplicates',  value: 0, color: '#be2ed6' },
        { label: 'Errors',      value: 0, color: '#DC2626' },
      ])})
      .finally(() => setLoadStats(false))
  }, [portal?.id])

  if (!portal) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
      Portal not found. <button style={{ color: C.blue, cursor: 'pointer', background: 'none', border: 'none' }} onClick={() => router.back()}>Go back</button>
    </div>
  )

  const copyToClipboard = async (text: string, key: 'url' | 'all') => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2500)
  }

  const allDetails = `${portal.name} CRM Integration Details
========================================
Webhook URL: ${portal.webhookPath}
Method: POST
Format: JSON

Parameters:
${portal.params.map(p => `  - ${p}`).join('\n')}

Steps to configure:
${portal.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
`

  const emailSubject = encodeURIComponent(`Enable CRM Push Integration — ${portal.name}`)
  const emailBody = encodeURIComponent(
`Hi,

I am using RealEdge CRM to manage my property enquiries. I'd like to enable automatic lead forwarding from ${portal.name} to my CRM.

Please configure PUSH integration with the following webhook details:

Webhook URL: ${portal.webhookPath}
Method: POST
Format: JSON

Please map the following fields: ${portal.params.join(', ')}

Kindly confirm once configured.

Thank you!`
  )
  const mailtoLink = `mailto:${portal.managerEmail ?? ''}?subject=${emailSubject}&body=${emailBody}`

  const waMessage = encodeURIComponent(
`Hi, I'm using RealEdge CRM and would like to enable automatic lead forwarding from ${portal.name}.

Please configure a PUSH integration to:

Webhook URL: ${portal.webhookPath}
Method: POST | Format: JSON

Fields needed: ${portal.params.join(', ')}

Please confirm once done. Thank you!`
  )
  const waLink = `https://wa.me/?text=${waMessage}`

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      {/* Top bar */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/integrations')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 14px', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Integrations
        </button>
        <ChevronRight size={14} color={C.label} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{portal.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{portal.name} Integration</span>
        </div>
      </div>

      <div style={{ padding: '24px 28px 60px' }}>

        {/* Portal header card */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: portal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              {portal.emoji}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>{portal.name} Integration</h2>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Webhook setup and live lead feed</p>
            </div>
            {stats[0]?.value && Number(stats[0].value) > 0 && (
              <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: C.emeraldDim, color: C.emerald, borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                <CheckCircle2 size={13} /> Active
              </div>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {(loadStats ? [
              { label: 'Total Leads', value: '—', color: portal.color },
              { label: 'New', value: '—', color: C.blue },
              { label: 'Duplicates', value: '—', color: '#be2ed6' },
              { label: 'Errors', value: '—', color: '#DC2626' },
            ] : stats).map((s, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

          {/* LEFT — Connection Instructions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Webhook URL section */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: C.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Webhook size={15} color={C.blue} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>Connection Instructions</h3>
              </div>

              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: '0 0 16px' }}>
                Send this webhook URL via WhatsApp or Email to your <strong style={{ color: C.text }}>{portal.name} Account Manager</strong> or Support Team to complete the integration.
              </p>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Your Unique Webhook URL</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                  <code style={{ flex: 1, fontSize: 12, color: C.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>{portal.webhookPath}</code>
                  <button
                    onClick={() => copyToClipboard(portal.webhookPath, 'url')}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, background: copied === 'url' ? C.emeraldDim : C.panel, border: `1px solid ${copied === 'url' ? C.emerald + '40' : C.border}`, borderRadius: 8, padding: '6px 12px', color: copied === 'url' ? C.emerald : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {copied === 'url' ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Parameters */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Fields to map</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {portal.params.map(p => (
                    <span key={p} style={{ fontSize: 11, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', color: C.muted, fontFamily: 'monospace' }}>{p}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '20px 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>Send to Account Manager</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <a
                  href={mailtoLink}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: C.blue, borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>
                  <Mail size={14} /> Send via Email
                </a>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: C.wa, borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>
                  <MessageCircle size={14} /> Send via WhatsApp
                </a>
                <button
                  onClick={() => copyToClipboard(allDetails, 'all')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: copied === 'all' ? C.emeraldDim : C.bg, border: `1px solid ${copied === 'all' ? C.emerald + '40' : C.border}`, borderRadius: 12, color: copied === 'all' ? C.emerald : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {copied === 'all' ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy All</>}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT — How to Connect */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '22px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>How to Connect</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {portal.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: portal.bg, border: `2px solid ${portal.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: portal.color }}>
                      {i + 1}
                    </div>
                    <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.7, paddingTop: 4 }}>{step}</p>
                  </div>
                ))}
              </div>

              {portal.docsUrl && (
                <a href={portal.docsUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, padding: '10px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.blue, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  <ExternalLink size={13} /> View official docs
                </a>
              )}
            </div>

            {/* Tip box */}
            <div style={{ background: portal.bg, border: `1px solid ${portal.color}20`, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: portal.color, marginBottom: 6 }}>Pro tip</div>
              <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.7 }}>
                Use the <strong>"Send via WhatsApp"</strong> button above — it pre-fills a complete message with your webhook URL for your account manager. They just need to configure it on their end.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
