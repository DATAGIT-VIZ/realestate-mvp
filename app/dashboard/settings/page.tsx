'use client'

import { useState, useEffect } from 'react'
import {
  User, Building2, Bell, Phone, Plug, Zap, CreditCard,
  Shield, Database, ChevronRight, Settings, Layers,
  GitBranch, MessageSquare, Globe, Clock, Palette,
  AlertCircle, Lock, Download, Trash2, ToggleLeft,
} from 'lucide-react'
import { getPlan, getRole, setPlan, setRole, type Plan, type Role } from '@/lib/plan'

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG      = '#F8FAFC'
const PANEL   = '#FFFFFF'
const BORDER  = '#E2E8F0'
const TEXT    = '#0F172A'
const MUTED   = '#64748B'
const LABEL   = '#94A3B8'
const BLUE    = '#a000c8'
const BLUE_D  = 'rgba(160,0,200,0.07)'
const GREEN   = '#059669'
const GREEN_D = '#ECFDF5'
const AMBER   = '#be2ed6'
const AMBER_D = 'rgba(190,46,214,0.07)'
const VIOLET  = '#a000c8'
const VIOLET_D= 'rgba(160,0,200,0.07)'
const RED     = '#EF4444'
const RED_D   = '#FEF2F2'

// ─── Section types ────────────────────────────────────────────────────────────
interface Section {
  id: string
  label: string
  icon: React.ElementType
  color: string
  colorDim: string
  teamsOnly?: boolean
  adminOnly?: boolean
}

const SECTIONS: Section[] = [
  { id: 'profile',       label: 'Profile',           icon: User,         color: BLUE,   colorDim: BLUE_D   },
  { id: 'workspace',     label: 'Workspace',          icon: Building2,    color: VIOLET, colorDim: VIOLET_D },
  { id: 'notifications', label: 'Notifications',      icon: Bell,         color: AMBER,  colorDim: AMBER_D  },
  { id: 'leads',         label: 'Lead Management',    icon: Layers,       color: BLUE,   colorDim: BLUE_D   },
  { id: 'calling',       label: 'Calling & WhatsApp', icon: Phone,        color: GREEN,  colorDim: GREEN_D  },
  { id: 'integrations',  label: 'Portals & Integrations', icon: Plug,     color: VIOLET, colorDim: VIOLET_D },
  { id: 'automations',   label: 'Automations',        icon: Zap,          color: AMBER,  colorDim: AMBER_D  },
  { id: 'routing',       label: 'Lead Routing',       icon: GitBranch,    color: BLUE,   colorDim: BLUE_D,   teamsOnly: true, adminOnly: true },
  { id: 'branding',      label: 'Branding & Reports', icon: Palette,      color: VIOLET, colorDim: VIOLET_D },
  { id: 'billing',       label: 'Billing & Plan',     icon: CreditCard,   color: GREEN,  colorDim: GREEN_D  },
  { id: 'security',      label: 'Security',           icon: Shield,       color: RED,    colorDim: RED_D    },
  { id: 'data',          label: 'Data & Privacy',     icon: Database,     color: MUTED,  colorDim: BG       },
]

// ─── Small helpers ─────────────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 800, color, background: bg, border: `1px solid ${color}25`, borderRadius: 20, padding: '2px 7px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
      {label}
    </span>
  )
}

function ComingSoon() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: AMBER, background: AMBER_D, border: `1px solid ${AMBER}25`, borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
      <Clock size={9} /> Coming soon
    </div>
  )
}

function Row({ label, description, children, last }: { label: string; description?: string; children?: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${BORDER}`, gap: 16, flexWrap: 'wrap' as const }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function PlaceholderInput({ placeholder }: { placeholder: string }) {
  return (
    <input
      disabled placeholder={placeholder}
      style={{ width: 220, padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: MUTED, background: BG, cursor: 'not-allowed' }}
    />
  )
}

function PlaceholderToggle({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && <span style={{ fontSize: 12, color: MUTED }}>{label}</span>}
      <div style={{ width: 36, height: 20, background: BORDER, borderRadius: 10, position: 'relative', cursor: 'not-allowed' }}>
        <div style={{ width: 16, height: 16, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}/>
      </div>
    </div>
  )
}

function PlaceholderSelect({ options }: { options: string[] }) {
  return (
    <select disabled style={{ padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: MUTED, background: BG, cursor: 'not-allowed', minWidth: 160 }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )
}

function SaveBtn() {
  return (
    <button disabled style={{ padding: '7px 16px', background: BORDER, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: LABEL, cursor: 'not-allowed' }}>
      Save changes
    </button>
  )
}

function ConnectBtn({ label = 'Connect' }: { label?: string }) {
  return (
    <button disabled style={{ padding: '6px 14px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: MUTED, cursor: 'not-allowed' }}>
      {label}
    </button>
  )
}

// ─── Section content components ────────────────────────────────────────────────

function ProfileSection() {
  return (
    <div>
      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 0 20px', borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: VIOLET_D, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: VIOLET }}>A</div>
        <div>
          <button disabled style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: BLUE_D, border: `1px solid ${BLUE}20`, borderRadius: 8, padding: '6px 14px', cursor: 'not-allowed' }}>Upload photo</button>
          <div style={{ fontSize: 11, color: LABEL, marginTop: 4 }}>JPG or PNG, max 2 MB</div>
        </div>
      </div>
      <Row label="Full Name" description="Shown on reports and lead cards"><PlaceholderInput placeholder="Your name"/></Row>
      <Row label="Email Address" description="Used for login and notifications"><PlaceholderInput placeholder="you@company.com"/></Row>
      <Row label="Mobile Number" description="For call routing and WhatsApp"><PlaceholderInput placeholder="+91 98200 00000"/></Row>
      <Row label="Role / Designation" description="e.g. Senior Broker, Channel Partner"><PlaceholderInput placeholder="Senior Agent"/></Row>
      <Row label="Language" last description="UI language"><PlaceholderSelect options={['English', 'Hindi', 'Marathi', 'Telugu', 'Tamil']}/></Row>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><SaveBtn/></div>
    </div>
  )
}

function WorkspaceSection() {
  return (
    <div>
      <Row label="Company / Agency Name" description="Appears on all reports and client communications"><PlaceholderInput placeholder="Your Agency Pvt Ltd"/></Row>
      <Row label="RERA Number" description="Regulatory ID, shown on reports"><PlaceholderInput placeholder="MAHARERA/A00000000"/></Row>
      <Row label="Office Address"><PlaceholderInput placeholder="Office address"/></Row>
      <Row label="City / Market" description="Your primary market — used for AI insights"><PlaceholderSelect options={['Mumbai','Pune','Bangalore','Hyderabad','Chennai','Delhi NCR','Ahmedabad']}/></Row>
      <Row label="Business Hours" description="Used for follow-up reminders and call scheduling"><PlaceholderSelect options={['9 AM – 7 PM Mon–Sat','9 AM – 6 PM Mon–Fri','All hours']}/></Row>
      <Row label="Fiscal Year Start" last description="For seasonal reports"><PlaceholderSelect options={['April (India standard)','January','October']}/></Row>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><SaveBtn/></div>
    </div>
  )
}

function NotificationsSection() {
  const items = [
    { label: 'New lead arrived',            description: 'Instant alert when a lead comes in from any portal' },
    { label: 'Lead not followed up in 24h', description: 'Reminder if a fresh lead has no call or message logged' },
    { label: 'Deal stage changed',          description: 'When a deal moves forward or backwards in the pipeline' },
    { label: 'Team member added a note',    description: 'Activity on a lead assigned to you (Teams plan)',      teams: true },
    { label: 'Daily digest — 8 AM',        description: 'Summary of your leads, calls, and deals for the day' },
    { label: 'Weekly performance report',   description: 'Auto-generated report every Monday morning' },
    { label: 'Deal won celebration',        description: '🎉 Notify the team when a deal is closed (Teams)',     teams: true },
  ]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 0, marginBottom: 4 }}>
        <div/>
        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'center' as const, paddingBottom: 8 }}>App</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'center' as const, paddingBottom: 8 }}>Email</div>
      </div>
      {items.map((item, i) => (
        <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', alignItems: 'center', padding: '12px 0', borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{item.label}</span>
              {item.teams && <Badge label="Teams" color={VIOLET} bg={VIOLET_D}/>}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{item.description}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><PlaceholderToggle/></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><PlaceholderToggle/></div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><SaveBtn/></div>
    </div>
  )
}

function LeadsSection() {
  return (
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: AMBER_D, border: `1px solid ${AMBER}25`, borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <AlertCircle size={14} color={AMBER} style={{ marginTop: 1, flexShrink: 0 }}/>
        <div style={{ fontSize: 12, color: AMBER }}>These settings control how leads are scored, staged, and managed across your workspace.</div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Pipeline Stages</div>
      {['New', 'Attempting', 'Connected', 'Virtual Meeting', 'Site Visit', 'Negotiation', 'Token Paid', 'Won', 'Lost'].map((s, i, arr) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: i < arr.length - 1 ? 6 : 0, opacity: 0.7 }}>
          <div style={{ width: 20, height: 20, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed' }}>
            <span style={{ fontSize: 9, color: LABEL }}>☰</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: TEXT, flex: 1 }}>{s}</span>
          <span style={{ fontSize: 10, color: LABEL }}>drag to reorder</span>
        </div>
      ))}

      <div style={{ borderTop: `1px solid ${BORDER}`, margin: '20px 0' }}/>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Lead Score Weights</div>
      {[
        { label: 'Budget match',    desc: 'How closely budget aligns with listed properties' },
        { label: 'Response speed',  desc: 'How quickly lead responds to calls/messages' },
        { label: 'Portal quality',  desc: 'Weight given to high-intent portals (MagicBricks vs FB)' },
        { label: 'Activity recency',desc: 'Boost score for recently active leads' },
      ].map((item, i, arr) => (
        <Row key={item.label} label={item.label} description={item.desc} last={i === arr.length - 1}>
          <PlaceholderSelect options={['High','Medium','Low','Off']}/>
        </Row>
      ))}

      <div style={{ borderTop: `1px solid ${BORDER}`, margin: '20px 0' }}/>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Stale Lead Rules</div>
      <Row label="Mark lead as stale after" description="No activity logged within this window"><PlaceholderSelect options={['3 days','7 days','14 days','30 days','Never']}/></Row>
      <Row label="Auto-archive lost leads after" last description="Leads in Lost stage moved to archive"><PlaceholderSelect options={['30 days','60 days','90 days','Never']}/></Row>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><SaveBtn/></div>
    </div>
  )
}

function CallingSection() {
  return (
    <div>
      {/* Exotel */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Exotel (Cloud Telephony)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: BORDER }}/>
            <span style={{ fontSize: 11, color: LABEL }}>Not connected</span>
          </div>
        </div>
        <Row label="Exotel SID"><PlaceholderInput placeholder="your-sid"/></Row>
        <Row label="API Key"><PlaceholderInput placeholder="api-key"/></Row>
        <Row label="API Token"><PlaceholderInput placeholder="api-token"/></Row>
        <Row label="Caller Number" last description="The number shown to leads when you call"><PlaceholderInput placeholder="+91 22 XXXX XXXX"/></Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><ConnectBtn label="Test & Connect"/></div>
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, margin: '8px 0 20px' }}/>

      {/* Interakt WhatsApp */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>WhatsApp via Interakt</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: BORDER }}/>
            <span style={{ fontSize: 11, color: LABEL }}>Not connected</span>
          </div>
        </div>
        <Row label="Interakt API Key"><PlaceholderInput placeholder="your-interakt-api-key"/></Row>
        <Row label="WhatsApp Business Number" last><PlaceholderInput placeholder="+91 98200 00000"/></Row>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '14px 0 8px' }}>Message Templates</div>
        {['New lead greeting', 'Follow-up reminder', 'Site visit confirmation', 'Deal won thank you'].map((t, i, arr) => (
          <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
            <span style={{ fontSize: 12, color: TEXT }}>{t}</span>
            <ConnectBtn label="Configure"/>
          </div>
        ))}
      </div>
    </div>
  )
}

function IntegrationsSection() {
  const portals = [
    { name: 'MagicBricks',  status: 'not_connected', color: '#E8460A' },
    { name: '99acres',      status: 'not_connected', color: '#E63946' },
    { name: 'Housing.com',  status: 'not_connected', color: '#EC4899' },
    { name: 'NoBroker',     status: 'not_connected', color: '#a000c8' },
    { name: 'Square Yards', status: 'not_connected', color: '#0EA5E9' },
    { name: 'Facebook Lead Ads', status: 'not_connected', color: '#1877F2' },
    { name: 'Google Ads',   status: 'not_connected', color: '#EA4335' },
    { name: 'IndiaProperty',status: 'not_connected', color: '#be2ed6' },
  ]
  return (
    <div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
        Connect your property portals to auto-import leads directly into RealEdge. Each portal sends leads via webhook — no manual copy-paste.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {portals.map(p => (
          <div key={p.name} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${p.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={14} color={p.color}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{p.name}</div>
                <div style={{ fontSize: 10, color: LABEL }}>Not connected</div>
              </div>
            </div>
            <ConnectBtn/>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: '12px 14px', background: BLUE_D, border: `1px solid rgba(160,0,200,0.2)`, borderRadius: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: BLUE, marginBottom: 2 }}>Your Webhook URL</div>
        <div style={{ fontSize: 11, color: MUTED, fontFamily: 'monospace', background: PANEL, padding: '6px 10px', borderRadius: 6, marginTop: 4, wordBreak: 'break-all' as const }}>
          https://your-app.realedge.in/api/webhook/leads?token=••••••••
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Paste this URL in each portal's lead form CRM integration settings.</div>
      </div>
    </div>
  )
}

function AutomationsSection() {
  const rules = [
    { title: 'Auto-assign new lead', desc: 'Round-robin across active agents when a lead arrives', teams: true },
    { title: 'WhatsApp greeting on new lead', desc: 'Send a template message instantly when a lead is created' },
    { title: 'Follow-up reminder after 24h silence', desc: 'Alert the assigned agent if no call or message is logged' },
    { title: 'Escalate to admin if stale 3+ days', desc: 'Notify admin when a lead has zero activity for 3 days', teams: true },
    { title: 'Auto-move to "Attempting" after first call', desc: 'Stage updates automatically when a call is logged' },
    { title: 'Auto-send site visit confirmation', desc: 'WhatsApp message when deal is moved to Site Visit stage' },
    { title: 'Congratulate on deal won', desc: 'Notify the team channel when a deal is closed', teams: true },
    { title: 'Weekly auto-report to manager', desc: 'Agent\'s productivity report sent every Monday 9 AM', teams: true },
  ]
  return (
    <div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
        Automate repetitive actions so you never miss a follow-up or a handoff. Rules run in order — toggle to enable when ready.
      </div>
      {rules.map((r, i) => (
        <div key={r.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < rules.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
          <div style={{ flex: 1, paddingRight: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{r.title}</span>
              {r.teams && <Badge label="Teams" color={VIOLET} bg={VIOLET_D}/>}
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>{r.desc}</div>
          </div>
          <PlaceholderToggle/>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><SaveBtn/></div>
    </div>
  )
}

function RoutingSection() {
  return (
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: VIOLET_D, border: `1px solid ${VIOLET}20`, borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <GitBranch size={14} color={VIOLET} style={{ marginTop: 1, flexShrink: 0 }}/>
        <div style={{ fontSize: 12, color: VIOLET }}>Lead Routing determines which agent gets a new lead automatically. Available on the Teams plan.</div>
      </div>
      <Row label="Routing Mode" description="How new leads are assigned"><PlaceholderSelect options={['Round Robin (default)', 'By City', 'By Property Type', 'By Lead Score', 'Manual only']}/></Row>
      <Row label="Assign by working hours" description="Only route to agents currently on shift"><PlaceholderToggle/></Row>
      <Row label="Fallback agent" last description="Receives leads when no agent is available"><PlaceholderSelect options={['Admin', 'First available', 'None']}/></Row>

      <div style={{ borderTop: `1px solid ${BORDER}`, margin: '16px 0', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', paddingTop: 16 }}>City → Agent Mapping</div>
      {['Mumbai', 'Pune', 'Bangalore'].map((city, i, arr) => (
        <Row key={city} label={city} last={i === arr.length - 1}><PlaceholderSelect options={['Any agent', 'Rahul Mehta', 'Priya Sharma', 'Aditya Joshi']}/></Row>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><SaveBtn/></div>
    </div>
  )
}

function BrandingSection() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Your branding appears on printed reports and client-facing documents generated in RealEdge.</div>
        <Row label="Company Logo" description="Shown in the header of all printed reports">
          <button disabled style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: BLUE_D, border: `1px solid ${BLUE}20`, borderRadius: 8, padding: '6px 14px', cursor: 'not-allowed' }}>Upload logo</button>
        </Row>
        <Row label="Brand Colour" description="Accent colour on report headers"><PlaceholderInput placeholder="#a000c8"/></Row>
        <Row label="Report footer text" description="Line shown at the bottom of every report"><PlaceholderInput placeholder="© 2026 Your Agency · RERA Registered"/></Row>
        <Row label="Show RERA number on reports" last><PlaceholderToggle/></Row>
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, margin: '4px 0 16px' }}/>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Report Defaults</div>
      <Row label="Default time range" description="Pre-selected when opening Reports"><PlaceholderSelect options={['This month','This week','Last 3 months','All time']}/></Row>
      <Row label="Default report type" last><PlaceholderSelect options={['Productivity','By Source','Pipeline','Seasonal']}/></Row>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><SaveBtn/></div>
    </div>
  )
}

function BillingSection({ plan, onPlanChange }: { plan: Plan; onPlanChange: (p: Plan) => void }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {([['solo','Solo','For individual agents','₹999 / month'] , ['teams','Teams','For brokerages & teams','₹2,499 / month']] as const).map(([id, name, desc, price]) => (
          <button key={id} onClick={() => onPlanChange(id)}
            style={{ padding: '16px', borderRadius: 14, border: `2px solid ${plan === id ? BLUE : BORDER}`, background: plan === id ? BLUE_D : PANEL, cursor: 'pointer', textAlign: 'left' as const }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: plan === id ? BLUE : TEXT }}>{name}</div>
            <div style={{ fontSize: 12, color: MUTED, margin: '3px 0 8px' }}>{desc}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: plan === id ? BLUE : TEXT }}>{price}</div>
            {plan === id && <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: 6 }}>✓ Current plan</div>}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Payment & Invoices</div>
      <Row label="Payment method" description="Razorpay · Visa ending 4242"><ConnectBtn label="Update card"/></Row>
      <Row label="Next billing date" description="Auto-renews monthly"><span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>1 Aug 2026</span></Row>
      <Row label="Invoices" last description="Download past invoices"><ConnectBtn label="View invoices"/></Row>
    </div>
  )
}

function SecuritySection() {
  return (
    <div>
      <Row label="Change Password" description="Last changed — never">
        <button disabled style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: BLUE_D, border: `1px solid ${BLUE}20`, borderRadius: 8, padding: '6px 14px', cursor: 'not-allowed' }}>Change</button>
      </Row>
      <Row label="Two-Factor Authentication" description="Add an extra layer of security via OTP"><PlaceholderToggle label="Disabled"/></Row>
      <Row label="Active Sessions" description="You are signed in on 1 device">
        <ConnectBtn label="View sessions"/>
      </Row>
      <Row label="Login History" last description="See recent sign-ins to your account">
        <ConnectBtn label="View history"/>
      </Row>
    </div>
  )
}

function DataSection() {
  return (
    <div>
      <Row label="Export all data" description="Download all your leads, deals, and activities as CSV">
        <button disabled style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: BLUE, background: BLUE_D, border: `1px solid ${BLUE}20`, borderRadius: 8, padding: '6px 14px', cursor: 'not-allowed' }}>
          <Download size={12}/> Export CSV
        </button>
      </Row>
      <Row label="Data retention" description="How long activity logs are kept"><PlaceholderSelect options={['Forever','2 years','1 year','6 months']}/></Row>
      <Row label="Cookie & tracking preferences" description="Control analytics cookies"><PlaceholderToggle/></Row>
      <Row label="Delete account" last description="Permanently delete your workspace and all data">
        <button disabled style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: RED, background: RED_D, border: `1px solid ${RED}20`, borderRadius: 8, padding: '6px 14px', cursor: 'not-allowed' }}>
          <Trash2 size={12}/> Delete account
        </button>
      </Row>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [plan,    setPlanState] = useState<Plan>('solo')
  const [role,    setRoleState] = useState<Role>('admin')
  const [activeId, setActiveId] = useState('profile')

  useEffect(() => {
    setPlanState(getPlan())
    setRoleState(getRole())
    const sync = () => { setPlanState(getPlan()); setRoleState(getRole()) }
    window.addEventListener('plan-changed', sync)
    return () => window.removeEventListener('plan-changed', sync)
  }, [])

  const handlePlanChange = (p: Plan) => { setPlan(p); setPlanState(p); window.dispatchEvent(new Event('plan-changed')) }
  const handleRoleChange = (r: Role) => { setRole(r); setRoleState(r); window.dispatchEvent(new Event('plan-changed')) }

  const visibleSections = SECTIONS.filter(s => {
    if (s.teamsOnly && plan !== 'teams') return false
    if (s.adminOnly && role !== 'admin') return false
    return true
  })

  const active = visibleSections.find(s => s.id === activeId) ?? visibleSections[0]

  function renderContent() {
    switch (active.id) {
      case 'profile':       return <ProfileSection/>
      case 'workspace':     return <WorkspaceSection/>
      case 'notifications': return <NotificationsSection/>
      case 'leads':         return <LeadsSection/>
      case 'calling':       return <CallingSection/>
      case 'integrations':  return <IntegrationsSection/>
      case 'automations':   return <AutomationsSection/>
      case 'routing':       return <RoutingSection/>
      case 'branding':      return <BrandingSection/>
      case 'billing':       return <BillingSection plan={plan} onPlanChange={handlePlanChange}/>
      case 'security':      return <SecuritySection/>
      case 'data':          return <DataSection/>
      default:              return null
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: PANEL, borderBottom: `1px solid ${BORDER}`, padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: BG, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={16} color={MUTED}/>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '-0.01em' }}>Settings</h1>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Manage your account, workspace, and integrations</p>
          </div>
        </div>

        {/* Dev plan / role switcher */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: BG, border: `1px solid ${BORDER}`, borderRadius: 9, padding: 3 }}>
            {(['solo','teams'] as Plan[]).map(p => (
              <button key={p} onClick={() => handlePlanChange(p)}
                style={{ padding: '4px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: plan === p ? PANEL : 'transparent', color: plan === p ? BLUE : LABEL, boxShadow: plan === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize' as const }}>
                {p}
              </button>
            ))}
          </div>
          {plan === 'teams' && (
            <div style={{ display: 'flex', gap: 4, background: BG, border: `1px solid ${BORDER}`, borderRadius: 9, padding: 3 }}>
              {(['admin','agent'] as Role[]).map(r => (
                <button key={r} onClick={() => handleRoleChange(r)}
                  style={{ padding: '4px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: role === r ? PANEL : 'transparent', color: role === r ? VIOLET : LABEL, boxShadow: role === r ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize' as const }}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 0 }}>

        {/* Sidebar nav */}
        <div style={{ width: 220, background: PANEL, borderRight: `1px solid ${BORDER}`, padding: '12px 8px', flexShrink: 0 }}>
          {visibleSections.map(s => {
            const Icon = s.icon
            const sel  = active.id === s.id
            return (
              <button key={s.id} onClick={() => setActiveId(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 10, border: 'none', background: sel ? s.colorDim : 'transparent', cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'background 0.1s' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: sel ? `${s.color}20` : BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={13} color={sel ? s.color : LABEL}/>
                </div>
                <span style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? s.color : MUTED, flex: 1 }}>{s.label}</span>
                {sel && <ChevronRight size={12} color={s.color}/>}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
          <div style={{ maxWidth: 680 }}>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: active.colorDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <active.icon size={16} color={active.color}/>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>{active.label}</div>
                  <div style={{ fontSize: 11, color: LABEL }}>
                    {active.teamsOnly ? 'Teams plan · Admin only' : active.adminOnly ? 'Admin only' : 'All plans'}
                  </div>
                </div>
              </div>
              <ComingSoon/>
            </div>

            {/* Section content */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '4px 20px 20px' }}>
              {renderContent()}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
