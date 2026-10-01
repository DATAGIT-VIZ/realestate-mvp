'use client'

import { PageTabBar } from '@/components/layout/PageTabBar'
import { Robot, Lightning, WhatsappLogo, Phone, ArrowRight, Clock } from '@phosphor-icons/react'

const ADVISOR_TABS = [
  { label: 'AI Chat',   href: '/dashboard/advisor' },
  { label: 'Workflows', href: '/dashboard/advisor/workflows' },
]

const WORKFLOWS = [
  {
    icon: WhatsappLogo,
    color: '#25D366',
    bg: 'rgba(37,211,102,0.08)',
    title: 'WhatsApp AI Auto-Update',
    desc: 'AI reads WhatsApp conversations, detects intent signals, and updates lead stages, tasks, and notes automatically.',
    status: 'coming_soon',
    triggers: ['Confirmed budget', 'Wants site visit', 'Not interested', 'Call me tomorrow at X'],
  },
  {
    icon: Lightning,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    title: 'AI Deal Coach',
    desc: 'Proactive nudges when leads go cold, deals stall in a stage too long, or follow-ups are overdue.',
    status: 'coming_soon',
    triggers: ['Lead stuck 7d+ in a stage', 'No activity in 5 days', 'Missed call not followed up'],
  },
  {
    icon: Phone,
    color: '#1D4ED8',
    bg: 'rgba(29,78,216,0.08)',
    title: 'AI Call Summarization',
    desc: 'After every logged call, AI generates a 2–3 line summary and flags action items. No manual note-taking.',
    status: 'coming_soon',
    triggers: ['Call completed', 'Notes entered', 'Action items detected'],
  },
]

export default function WorkflowsPage() {
  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: '#F5F6FA', display: 'flex', flexDirection: 'column' }}>
      <PageTabBar tabs={ADVISOR_TABS} />

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px 64px', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Robot size={17} weight="light" color="#fff" />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#263238', margin: 0, letterSpacing: '-0.03em' }}>AI Workflows</h1>
          </div>
          <p style={{ fontSize: 13, color: '#78889B', margin: 0 }}>
            Autonomous actions triggered by AI — every change is logged and reversible.
          </p>
        </div>

        {/* Trust level strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', border: '1px solid #E8ECF0', borderRadius: 10, marginBottom: 24 }}>
          <Clock size={14} weight="light" style={{ color: '#78889B', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#78889B', flex: 1 }}>
            AI trust level: <strong style={{ color: '#263238' }}>Suggest only</strong> — AI shows recommendations, you apply them.
          </span>
          <button style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8', background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            Change in Settings
          </button>
        </div>

        {/* Workflow cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {WORKFLOWS.map((wf) => {
            const Icon = wf.icon
            return (
              <div key={wf.title} style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: '20px 20px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: wf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} weight="light" style={{ color: wf.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#263238' }}>{wf.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)', letterSpacing: '0.02em' }}>
                      Coming soon
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#78889B', margin: '0 0 12px', lineHeight: 1.5 }}>{wf.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {wf.triggers.map(t => (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#455A64', background: '#F5F6FA', border: '1px solid #E8ECF0', borderRadius: 6, padding: '3px 9px' }}>
                        <ArrowRight size={10} weight="bold" style={{ color: '#B0B8C8' }} />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Activity log placeholder */}
        <div style={{ marginTop: 32, background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: '20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#263238', margin: '0 0 4px' }}>Workflow Activity Log</h2>
          <p style={{ fontSize: 12, color: '#78889B', margin: '0 0 16px' }}>Every AI-triggered action appears here — with accept / reject / undo controls.</p>
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#B0B8C8', fontSize: 13 }}>
            No AI actions yet. Activity will appear here once workflows are enabled.
          </div>
        </div>

      </div>
    </div>
  )
}
