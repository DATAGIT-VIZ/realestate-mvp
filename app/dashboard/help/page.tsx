'use client'

import { useState } from 'react'
import {
  HelpCircle, ChevronDown, ChevronRight,
  Users, BarChart3, Phone, MessageCircle,
  Mail, BookOpen, Zap, Shield, Search,
} from 'lucide-react'

const C = {
  bg:     '#F8FAFC',
  panel:  '#FFFFFF',
  border: '#E2E8F0',
  text:   '#0F172A',
  muted:  '#64748B',
  label:  '#94A3B8',
  blue:   '#a000c8',
  violet: '#a000c8',
  emerald:'#059669',
}

const FAQS = [
  {
    section: 'Leads & CS IDs',
    items: [
      {
        q: 'What is a CS ID?',
        a: 'CS ID (Customer System ID) is a unique identifier assigned to every lead the moment they enter Vya Pulse — whether added manually, imported via CSV, or auto-captured from portals like MagicBricks or 99acres. Format: CS00001, CS00042, etc. Use it to search for a lead instantly across any screen.',
      },
      {
        q: 'How do I add a lead manually?',
        a: 'Go to Leads → click "+ New Lead". Fill in name, phone number (required), and any other details. A CS ID is auto-assigned on save. You can also import multiple leads at once using "Import CSV" or paste a forwarded email/WhatsApp using "Parse Email".',
      },
      {
        q: 'How does duplicate detection work?',
        a: 'When a lead is added (manually or from a portal), we check if the same phone number already exists. If it does, we return the existing lead instead of creating a duplicate. This keeps your database clean.',
      },
      {
        q: 'What is client type and how is it used?',
        a: 'Client type (Individual, Channel Partner, Agent, Interior Designer) describes who the lead is. Set it when adding a lead manually. It helps segment your pipeline and is shown as a badge on the lead card.',
      },
    ],
  },
  {
    section: 'Lead Lifecycle',
    items: [
      {
        q: 'What are the 5 lifecycle stages?',
        a: 'New Leads → Cold Stage → Warm Stage → Hot Stage → Disqualified/NC. Each bucket groups the detailed sub-stages: Cold has Attempting & VM Done; Warm has Connected & Virtual Meeting Done; Hot has Site Visit Done, Negotiation, and Closed. Drag a card between columns or use the sub-stage pills on the card to update precisely.',
      },
      {
        q: 'What does NC mean?',
        a: 'NC = Non-Contactable. A lead is marked NC after 5 failed attempts with no response. It moves them to Disqualified/NC column so agents focus on reachable leads. NC leads can be re-activated if the lead contacts you later.',
      },
      {
        q: 'How do I find a specific lead on the lifecycle board?',
        a: 'Every column header has a search icon (🔍). Click it, type the CS ID (e.g. CS00042), and the board instantly filters to show only that lead — highlighted with a glow ring around the card. Click ✕ to clear.',
      },
    ],
  },
  {
    section: 'Power Dialer',
    items: [
      {
        q: 'What are the 3 calling modes?',
        a: 'Corporate Number: Shows the lead\'s number formatted for easy dialling from your work SIM — tap "I\'m calling now" to start the timer. Internet Calling: Browser-based calling via Exotel or Twilio (requires connecting your provider in Settings → Integrations). Manual Log: Skip the dial — just log the outcome for a call you already made from your personal phone.',
      },
      {
        q: 'How do I set up browser calling?',
        a: 'Go to Settings → Integrations and connect your Exotel or Twilio account. Once connected, switch the dialer mode to "Internet Calling" and calls will be placed directly from the browser — no SIM needed.',
      },
      {
        q: 'Does the dialer remember my calling mode?',
        a: 'Yes. Your selected mode (Corporate / Internet / Manual) is saved in the browser and persists across sessions. You can change it anytime from the welcome screen or during a dialing session using "Change mode".',
      },
    ],
  },
  {
    section: 'Analytics & Scores',
    items: [
      {
        q: 'What is the Intent Score?',
        a: 'Intent Score (0–100) shows how likely a lead is to convert, calculated from: contact completeness (phone + email), budget range, timeline urgency (Immediate scores highest), and source quality (Referral/Website score higher than social ads). It is recalculated automatically whenever you update a lead\'s details.',
      },
      {
        q: 'What is the Activity Score?',
        a: 'Activity Score (0–100) measures an agent\'s engagement effort. It weights: Site Visits (×5) → Calls (×3) → WhatsApp (×2.5) → Emails (×1.5) → Notes (×1). Visible in Team Analytics. Currently uses simulated data — real per-agent scoring activates after connecting Supabase activity logs.',
      },
      {
        q: 'What does the Lead Analytics page show?',
        a: 'Lead Analytics (under Insights) shows: total leads over time, intent score distribution, source portal breakdown, status funnel, and a timeline chart. Use the Weekly / Monthly / Quarterly / Yearly toggles to change the period.',
      },
    ],
  },
  {
    section: 'Team & Plans',
    items: [
      {
        q: 'What is the difference between Solo and Teams plan?',
        a: 'Solo plan is for individual agents — one person, no team management, no Inventory module. Teams plan unlocks: team member management, per-agent activity analytics, Inventory (property catalogue), Lead Routing rules, and role-based access (Admin vs Agent). Switch plans in Settings.',
      },
      {
        q: 'What can an Agent see vs an Admin?',
        a: 'In Teams plan: Agents see Leads, Lifecycle, Power Dialer, Broadcast, Analytics, Calculators. Admins additionally see: Team management, Team Analytics, Lead Routing, Billing, and Integrations. Plan and role are demo-switchable in Settings.',
      },
    ],
  },
]

const QUICK_LINKS = [
  { icon: Users,      label: 'Add your first lead',     href: '/dashboard/leads',              color: C.blue   },
  { icon: BarChart3,  label: 'View lead analytics',     href: '/dashboard/analytics',          color: C.violet },
  { icon: Phone,      label: 'Start a dialing session', href: '/dashboard/calls',              color: C.emerald},
  { icon: MessageCircle, label: 'Send WhatsApp broadcast', href: '/dashboard/outreach/broadcast', color: '#25D366'},
  { icon: BookOpen,   label: 'Lead lifecycle board',    href: '/dashboard/lifecycle',          color: '#a000c8'},
  { icon: Zap,        label: 'AI property advisor',     href: '/dashboard/advisor',            color: '#be2ed6'},
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{q}</span>
        <ChevronDown style={{ width: 15, height: 15, color: C.label, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px', lineHeight: 1.7, paddingRight: 24 }}>{a}</p>
      )}
    </div>
  )
}

export default function HelpPage() {
  const [search, setSearch] = useState('')

  const filtered = FAQS.map(s => ({
    ...s,
    items: s.items.filter(i =>
      !search || i.q.toLowerCase().includes(search.toLowerCase()) || i.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(s => s.items.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#4c00b0,#a000c8)', padding: '32px 28px 28px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <HelpCircle style={{ width: 22, height: 22, color: 'rgba(255,255,255,0.8)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Help & Support</h1>
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 20px', lineHeight: 1.6 }}>
            Everything you need to get the most out of Vya Pulse CRM.
          </p>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.muted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search help articles…"
              style={{ width: '100%', padding: '11px 14px 11px 36px', border: 'none', borderRadius: 12, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 28px 60px' }}>

        {/* Quick links */}
        {!search && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Quick links</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
              {QUICK_LINKS.map(l => {
                const Icon = l.icon
                return (
                  <a key={l.label} href={l.href}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, textDecoration: 'none', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = l.color; (e.currentTarget as HTMLAnchorElement).style.background = `${l.color}06` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.border; (e.currentTarget as HTMLAnchorElement).style.background = C.panel }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: `${l.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 15, height: 15, color: l.color }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{l.label}</span>
                    <ChevronRight style={{ width: 13, height: 13, color: C.label, marginLeft: 'auto', flexShrink: 0 }} />
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* FAQ sections */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
            <HelpCircle style={{ width: 32, height: 32, color: C.label, marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: C.text }}>No results for &ldquo;{search}&rdquo;</p>
            <p style={{ fontSize: 13, margin: 0 }}>Try different keywords or reach out below.</p>
          </div>
        ) : (
          filtered.map(section => (
            <div key={section.section} style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{section.section}</p>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '0 16px' }}>
                {section.items.map(item => (
                  <FAQItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))
        )}

        {/* Contact section */}
        <div style={{ background: 'linear-gradient(135deg,rgba(160,0,200,0.05),rgba(160,0,200,0.04))', border: `1px solid rgba(160,0,200,0.15)`, borderRadius: 16, padding: '20px 22px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Still need help?</p>
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 16px', lineHeight: 1.6 }}>Reach out — we typically respond within a few hours.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="mailto:support@vyapulse.in"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: C.blue, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <Mail style={{ width: 13, height: 13 }} /> Email support
            </a>
            <a href="https://wa.me/919999999999" target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 10, color: '#15803D', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <MessageCircle style={{ width: 13, height: 13 }} /> WhatsApp us
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <Shield style={{ width: 13, height: 13, color: C.muted }} />
              <span style={{ fontSize: 12, color: C.muted }}>Your data is safe — <strong style={{ color: C.text }}>India-hosted, SOC2 ready</strong></span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
