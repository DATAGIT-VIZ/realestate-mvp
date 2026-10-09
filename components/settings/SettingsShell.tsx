'use client'

// The Settings page. What each person sees depends on who they are:
// - Solo owner: everything about their own account and workspace, plus plan and data.
// - Teams admin: all of that, plus Team & access and Lead routing, applying to everyone.
// - Teams agent: their own profile, alerts and password. Workspace details read-only. Admin areas are locked.
// Plan and role come from lib/plan (stored in this browser for now), so "Preview as" switches between the three.

import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import {
  LockSimple, UsersThree, ArrowRight, Crown, User, Eye, CaretRight,
} from '@phosphor-icons/react'
import { setPlan, setRole } from '@/lib/plan'
import {
  Avatar, Badge, Btn, PageHeader, Pill, Seg, Toast, useToast,
  BORDER, BORDER_2, SURFACE, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, XS,
} from '@/components/outreach/OutreachKit'
import {
  ACCESS_LABEL, AccessPill, GROUPS, SECTIONS, displayNameOf, sectionDef, useAccess, useMe, useOverview,
  type Access, type SectionDef, type SectionId, type SectionProps,
} from './SettingsKit'
import { NotificationsSection, ProfileSection, SecuritySection } from './AccountSections'
import { AiSection, AutomationsSection, BrandingSection, BusinessSection, ChannelsSection, LeadRulesSection } from './WorkspaceSections'
import { PortalsSection } from './PortalsSection'
import { RoutingSection, TeamSection } from './TeamSections'
import { BillingSection, DataSection } from './PlanSections'

const SUB: Record<Access, string> = {
  solo: 'Your account, workspace, portals and billing. Everything here is yours to change.',
  admin: 'You\'re an admin: you manage the workspace, team, routing and billing for everyone.',
  agent: 'Your personal settings. Your admin manages the workspace, team and billing.',
}

// The open section lives in the URL hash (#portals), so links and the back button keep working
const subscribeHash = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb) }
const hashNow = () => window.location.hash.slice(1)
const LEGACY: Record<string, SectionId> = { integrations: 'portals', 'billing-plan': 'billing' }
const asSection = (h: string): SectionId | null => (SECTIONS.some(s => s.id === h) ? (h as SectionId) : LEGACY[h] ?? null)

export default function SettingsShell({ section, portal }: { section?: SectionId; portal?: string }) {
  const access = useAccess()
  const meApi = useMe()
  const overview = useOverview()
  const { toast, show, hide } = useToast()
  const hash = useSyncExternalStore(subscribeHash, hashNow, () => '')

  const visible = SECTIONS.filter(s => s.modes[access] !== 'hidden')
  const firstVisible = visible[0].id
  const activeId: SectionId = asSection(hash) ?? section ?? firstVisible
  const active = sectionDef(activeId)
  const mode = active.modes[access]

  const go = useCallback((id: SectionId) => {
    window.history.replaceState(null, '', `/dashboard/settings#${id}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    if (window.innerWidth < 1024) window.scrollTo({ top: 0 })
  }, [])

  const preview = (a: Access) => {
    setPlan(a === 'solo' ? 'solo' : 'teams')
    if (a !== 'solo') setRole(a)
  }

  const props: SectionProps = { access, mode, meApi, overview, notify: show, go }
  const body = mode === 'hidden' ? <Locked s={active} access={access} go={go} /> : renderSection(activeId, props, hash ? undefined : portal)
  const name = displayNameOf(meApi.me)

  return (
    <div className="min-h-screen bg-white pb-28 lg:pb-16">
      <PageHeader title="Settings"
        badge={<Badge tone={access === 'agent' ? 'neutral' : 'blue'}>{access === 'agent' ? <User size={13} weight="bold" /> : <Crown size={13} weight="fill" />}{ACCESS_LABEL[access].long}</Badge>}
        sub={SUB[access]}
        actions={
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>Preview as</span>
            <Seg<Access> label="Preview settings as" value={access} onChange={preview}
              options={[{ id: 'solo', label: 'Solo' }, { id: 'admin', label: 'Teams admin' }, { id: 'agent', label: 'Teams agent' }]} />
          </div>
        } />

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-10 lg:px-8">
        {/* Section list: a sticky column on desktop, a picker on phones */}
        <aside className="min-w-0">
          <div className="lg:hidden">
            <label htmlFor="settings-section" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>Section</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: BLUE }}><active.Icon size={18} weight="bold" /></span>
              <select id="settings-section" value={activeId} onChange={e => go(e.target.value as SectionId)}
                className="h-12 w-full cursor-pointer appearance-none rounded-[12px] border bg-white pl-10 pr-9 text-[15px] font-semibold outline-none focus:border-[#84ADFF] focus:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]"
                style={{ borderColor: BORDER_2, color: TEXT, boxShadow: XS }}>
                {GROUPS.map(g => {
                  const items = visible.filter(s => s.group === g.id)
                  return items.length ? <optgroup key={g.id} label={g.label}>{items.map(s => <option key={s.id} value={s.id}>{s.label}{s.modes[access] === 'view' ? ' (view only)' : ''}</option>)}</optgroup> : null
                })}
                {access === 'agent' && (
                  <optgroup label="Managed by your admin">
                    {SECTIONS.filter(s => s.modes.agent === 'hidden').map(s => <option key={s.id} value={s.id}>{s.label} (locked)</option>)}
                  </optgroup>
                )}
              </select>
              <CaretRight size={14} weight="bold" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90" style={{ color: SUBTLE }} />
            </div>
          </div>

          <nav aria-label="Settings sections" className="sticky top-4 hidden lg:block">
            <div className="mb-5 flex items-center gap-3 rounded-[14px] border p-3" style={{ borderColor: BORDER, background: SURFACE }}>
              <Avatar name={name || '?'} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{meApi.me === undefined ? 'Loading…' : name || 'You'}</div>
                <div className="truncate text-[12.5px]" style={{ color: SUBTLE }}>{meApi.me?.email ?? ''}</div>
              </div>
            </div>
            {GROUPS.map(g => {
              const items = visible.filter(s => s.group === g.id)
              if (!items.length) return null
              return (
                <div key={g.id} className="mb-4">
                  <div className="mb-1 px-3 text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>{g.label}</div>
                  {items.map(s => <NavItem key={s.id} s={s} on={s.id === activeId} onClick={() => go(s.id)} badge={s.modes[access] === 'view' ? <Eye size={14} weight="bold" style={{ color: LABEL }} /> : s.group === 'team' ? <Pill tone="violet" small>Admin</Pill> : null} />)}
                </div>
              )
            })}
            {access === 'agent' && (
              <div className="mb-4">
                <div className="mb-1 flex items-center gap-1.5 px-3 text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}><LockSimple size={12} weight="bold" />Managed by your admin</div>
                {SECTIONS.filter(s => s.modes.agent === 'hidden').map(s => <NavItem key={s.id} s={s} on={s.id === activeId} locked onClick={() => go(s.id)} />)}
              </div>
            )}
            {access === 'solo' && (
              <button type="button" onClick={() => go('billing')}
                className="mt-1 flex w-full cursor-pointer flex-col items-start gap-1 rounded-[14px] border p-3.5 text-left transition-colors hover:bg-[#F5F8FF]"
                style={{ borderColor: '#D1E0FF', background: BLUE_BG }}>
                <span className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: BLUE }}><UsersThree size={16} weight="bold" />Working with a team?</span>
                <span className="text-[12.5px] leading-snug" style={{ color: TEXT_2 }}>The Team plan adds admins and agents, lead routing and team analytics.</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: BLUE }}>See plans<ArrowRight size={13} weight="bold" /></span>
              </button>
            )}
          </nav>
        </aside>

        {/* The open section */}
        <main className="min-w-0 max-w-[920px]">
          <div className="mb-5 flex items-start gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-[13px] border bg-white" style={{ borderColor: BORDER, color: mode === 'hidden' ? LABEL : BLUE, boxShadow: XS }}>
              {mode === 'hidden' ? <LockSimple size={22} weight="bold" /> : <active.Icon size={22} weight="bold" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h2 className="m-0 text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[24px]" style={{ color: TEXT }}>{active.label}</h2>
                {mode !== 'hidden' && <AccessPill s={active} access={access} />}
              </div>
              <p className="m-0 mt-1 text-[14px]" style={{ color: SUBTLE }}>{active.blurb}</p>
            </div>
          </div>
          <div key={`${activeId}-${access}`}>{body}</div>
        </main>
      </div>

      <Toast toast={toast} onClose={hide} />
    </div>
  )
}

function NavItem({ s, on, onClick, badge, locked }: { s: SectionDef; on: boolean; onClick: () => void; badge?: ReactNode; locked?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined}
      className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-[14px] transition-colors hover:bg-[#F9FAFB]"
      style={on ? { background: BLUE_BG, color: BLUE, fontWeight: 600 } : { color: locked ? LABEL : TEXT_2, fontWeight: 500 }}>
      <s.Icon size={18} weight={on ? 'fill' : 'bold'} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{s.label}</span>
      {locked ? <LockSimple size={13} weight="bold" /> : badge}
    </button>
  )
}

function renderSection(id: SectionId, p: SectionProps, portal?: string) {
  switch (id) {
    case 'profile':       return <ProfileSection {...p} />
    case 'notifications': return <NotificationsSection {...p} />
    case 'security':      return <SecuritySection {...p} />
    case 'workspace':     return <BusinessSection {...p} />
    case 'leads':         return <LeadRulesSection />
    case 'calling':       return <ChannelsSection {...p} />
    case 'portals':       return <PortalsSection {...p} initialPortal={portal} onPortalClose={portal ? () => p.go('portals') : undefined} />
    case 'automations':   return <AutomationsSection {...p} />
    case 'ai':            return <AiSection {...p} />
    case 'branding':      return <BrandingSection />
    case 'team':          return <TeamSection {...p} />
    case 'routing':       return <RoutingSection {...p} />
    case 'billing':       return <BillingSection {...p} />
    case 'data':          return <DataSection {...p} />
  }
}

/** What someone sees when they open a section that isn't theirs */
function Locked({ s, access, go }: { s: SectionDef; access: Access; go: (id: SectionId) => void }) {
  const teamOnly = s.modes.solo === 'hidden'
  return (
    <div className="rounded-[16px] border px-6 py-12 text-center" style={{ borderColor: BORDER, boxShadow: XS }}>
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[12px] border" style={{ borderColor: BORDER, color: TEXT_2, boxShadow: XS }}>
        {teamOnly && access === 'solo' ? <UsersThree size={22} weight="bold" /> : <LockSimple size={22} weight="bold" />}
      </div>
      {access === 'solo' ? (
        <>
          <h3 className="m-0 text-[18px] font-semibold" style={{ color: TEXT }}>{s.label} is part of the Team plan</h3>
          <p className="mx-auto mb-0 mt-1.5 max-w-[440px] text-[14px] leading-relaxed" style={{ color: SUBTLE }}>Add admins and agents, decide who gets which leads, and see how your team is doing.</p>
          <div className="mt-6 flex justify-center"><Btn variant="primary" onClick={() => go('billing')}>See plans<ArrowRight size={15} weight="bold" /></Btn></div>
        </>
      ) : (
        <>
          <h3 className="m-0 text-[18px] font-semibold" style={{ color: TEXT }}>Your admin manages {s.label.toLowerCase()}</h3>
          <p className="mx-auto mb-0 mt-1.5 max-w-[440px] text-[14px] leading-relaxed" style={{ color: SUBTLE }}>This applies to everyone in your workspace, so only admins can open it. Ask your admin if something here needs to change.</p>
          <div className="mt-6 flex justify-center"><Btn onClick={() => go('profile')}>Go to your profile</Btn></div>
        </>
      )}
    </div>
  )
}
