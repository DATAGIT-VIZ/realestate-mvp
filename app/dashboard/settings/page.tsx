'use client'

import { useState, useEffect } from 'react'
import { Settings, Users, Shield, User, ChevronRight, Check } from 'lucide-react'
import { getPlan, getRole, setPlan, setRole, type Plan, type Role } from '@/lib/plan'

const C = {
  bg: '#F8FAFC', panel: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', muted: '#64748B', label: '#94A3B8',
  blue: '#2563EB', blueDim: '#EFF6FF', blueBorder: '#BFDBFE',
  violet: '#7C3AED', violetDim: '#F5F3FF', violetBorder: '#DDD6FE',
  amber: '#D97706', amberDim: '#FFFBEB', amberBorder: '#FDE68A',
  emerald: '#059669', emeraldDim: '#ECFDF5',
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <Icon size={15} color={C.muted} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

function PlanCard({ label, description, badge, active, onClick }: {
  label: string; description: string; badge?: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
        border: `2px solid ${active ? C.blue : C.border}`,
        background: active ? C.blueDim : C.bg,
        transition: 'all 0.15s',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: active ? C.blue : C.text }}>{label}</span>
          {badge && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: C.amberDim, color: C.amber, border: `1px solid ${C.amberBorder}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{description}</p>
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginLeft: 12,
        border: `2px solid ${active ? C.blue : C.label}`,
        background: active ? C.blue : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <Check size={11} color="#fff" strokeWidth={3} />}
      </div>
    </button>
  )
}

function RoleCard({ label, description, roleValue, active, onClick }: {
  label: string; description: string; roleValue: Role; active: boolean; onClick: () => void
}) {
  const color = roleValue === 'admin' ? C.violet : C.blue
  const dimColor = roleValue === 'admin' ? C.violetDim : C.blueDim
  const borderColor = roleValue === 'admin' ? C.violetBorder : C.blueBorder
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
        border: `2px solid ${active ? color : C.border}`,
        background: active ? dimColor : C.bg,
        transition: 'all 0.15s',
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: active ? color : C.text, margin: '0 0 3px' }}>{label}</p>
        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{description}</p>
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginLeft: 12,
        border: `2px solid ${active ? color : C.label}`,
        background: active ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <Check size={11} color="#fff" strokeWidth={3} />}
      </div>
    </button>
  )
}

export default function SettingsPage() {
  const [plan, setPlanState] = useState<Plan>('solo')
  const [role, setRoleState] = useState<Role>('admin')

  useEffect(() => {
    setPlanState(getPlan())
    setRoleState(getRole())
  }, [])

  const handlePlanChange = (p: Plan) => {
    setPlan(p)
    setPlanState(p)
    // When switching to solo, reset role to admin (no agents on solo)
    if (p === 'solo') { setRole('admin'); setRoleState('admin') }
  }

  const handleRoleChange = (r: Role) => {
    setRole(r)
    setRoleState(r)
  }

  return (
    <div className="px-4 py-5 pb-24 lg:px-7 lg:py-7 min-h-screen" style={{ background: C.bg }}>
      <div className="max-w-[680px]">

        <h1 className="hidden lg:block" style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Settings</h1>
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Manage your workspace preferences and account.</p>

        {/* Profile (placeholder) */}
        <SectionCard title="Profile" icon={User}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: C.violetDim, border: `1px solid ${C.violetBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: C.violet }}>
              D
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>demo@realedge.in</p>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Account settings coming with Supabase auth migration</p>
            </div>
          </div>
        </SectionCard>

        {/* Workspace Plan */}
        <SectionCard title="Workspace Plan" icon={Settings}>
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 14px' }}>
            Switch between Solo and Teams to preview how the interface adapts. On Teams, role-based access control applies.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PlanCard
              label="Solo"
              description="Single agent workspace — full access to all features, no role restrictions."
              active={plan === 'solo'}
              onClick={() => handlePlanChange('solo')}
            />
            <PlanCard
              label="Teams"
              description="Multi-agent workspace — role-based access control, shared lead pool, team analytics."
              badge="Teams"
              active={plan === 'teams'}
              onClick={() => handlePlanChange('teams')}
            />
          </div>
        </SectionCard>

        {/* Role (Teams plan only) */}
        {plan === 'teams' && (
          <SectionCard title="Your Role" icon={Shield}>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 14px' }}>
              Simulates how the interface looks for each role. In production, roles are assigned by the workspace Admin.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <RoleCard
                label="Admin / Manager"
                description="Full portal access — all analytics, team logs, lead routing, billing, and settings."
                roleValue="admin"
                active={role === 'admin'}
                onClick={() => handleRoleChange('admin')}
              />
              <RoleCard
                label="Agent"
                description="Own leads and activity only — Team, Billing, and Lead Routing are hidden."
                roleValue="agent"
                active={role === 'agent'}
                onClick={() => handleRoleChange('agent')}
              />
            </div>

            {/* What changes summary */}
            <div style={{ marginTop: 16, padding: '12px 14px', background: role === 'agent' ? C.blueDim : C.violetDim, border: `1px solid ${role === 'agent' ? C.blueBorder : C.violetBorder}`, borderRadius: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: role === 'agent' ? C.blue : C.violet, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {role === 'agent' ? 'Agent view — hidden from sidebar' : 'Admin view — full access'}
              </p>
              {role === 'agent' ? (
                <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
                  <li>Team page</li>
                  <li>Billing</li>
                  <li>Lead Routing</li>
                </ul>
              ) : (
                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>All navigation items visible. No restrictions.</p>
              )}
            </div>
          </SectionCard>
        )}

        {/* Navigation to sub-settings */}
        <SectionCard title="More Settings" icon={Settings}>
          {[
            { label: 'Lead Routing',  desc: 'Auto-assign rules by source, score, or location', href: '/dashboard/settings/routing',  adminOnly: true  },
            { label: 'Billing',       desc: 'Subscription, usage, and invoices',               href: '/dashboard/settings/billing',  adminOnly: true  },
            { label: 'Integrations',  desc: 'Connect portals, WhatsApp, and calling tools',    href: '/dashboard/integrations',      adminOnly: false },
          ].filter(item => !item.adminOnly || plan === 'solo' || role === 'admin')
           .map(item => (
            <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${C.border}`, textDecoration: 'none', cursor: 'pointer' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 1px' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{item.desc}</p>
              </div>
              <ChevronRight size={15} color={C.label} />
            </a>
          ))}
        </SectionCard>

      </div>
    </div>
  )
}
