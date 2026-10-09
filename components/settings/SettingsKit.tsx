'use client'

// Shared pieces for the Settings pages: who can see and change what (Solo owner, Teams admin, Teams agent),
// the signed-in user's saved details, the account overview, and the row and card layout.
// Same tokens and components as the Leads, Outreach and Insights pages (components/outreach/OutreachKit).

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  UserCircle, Bell, ShieldCheck, Buildings, Stack, PhoneCall, Plugs, Lightning, Sparkle, PaintBrush,
  UsersThree, ArrowsSplit, CreditCard, Database, Clock, Eye, LockSimple, CheckCircle, Circle,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { getPlan, getRole, type Plan, type Role } from '@/lib/plan'
import {
  BORDER, BORDER_2, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, GREEN_D, XS, Pill, type Tone, type ToastMsg,
} from '@/components/outreach/OutreachKit'

// ─── Who is looking ───────────────────────────────────────────────────────────
/** Solo owner, or an admin or agent on the Teams plan */
export type Access = 'solo' | 'admin' | 'agent'
export const accessOf = (plan: Plan, role: Role): Access => (plan === 'teams' ? (role === 'agent' ? 'agent' : 'admin') : 'solo')
export const ACCESS_LABEL: Record<Access, { short: string; long: string }> = {
  solo:  { short: 'Solo',  long: 'Solo · Owner' },
  admin: { short: 'Admin', long: 'Teams · Admin' },
  agent: { short: 'Agent', long: 'Teams · Agent' },
}

// Plan and role live in the browser (lib/plan) and change through the 'plan-changed' event
const subscribePlan = (cb: () => void) => { window.addEventListener('plan-changed', cb); return () => window.removeEventListener('plan-changed', cb) }
const accessNow = () => accessOf(getPlan(), getRole())
export const useAccess = () => useSyncExternalStore(subscribePlan, accessNow, () => 'solo' as Access)

// ─── Sections and what each viewpoint may do in them ──────────────────────────
/** edit: can change it. view: can see it, not change it. hidden: not shown. */
export type Mode = 'edit' | 'view' | 'hidden'
export type SectionId =
  | 'profile' | 'notifications' | 'security'
  | 'workspace' | 'leads' | 'calling' | 'portals' | 'automations' | 'ai' | 'branding'
  | 'team' | 'routing'
  | 'billing' | 'data'
type GroupId = 'account' | 'workspace' | 'team' | 'plan'
/** personal: about you. shared: about the whole workspace. builtin: how LeadGap works, not a setting */
type Kind = 'personal' | 'shared' | 'builtin'

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'account',   label: 'Your account' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'team',      label: 'Team' },
  { id: 'plan',      label: 'Plan and data' },
]
export type SectionDef = {
  id: SectionId; group: GroupId; kind: Kind; label: string; blurb: string; Icon: typeof UserCircle
  modes: Record<Access, Mode>
}
const ALL_EDIT: Record<Access, Mode> = { solo: 'edit', admin: 'edit', agent: 'edit' }
const ALL_VIEW: Record<Access, Mode> = { solo: 'view', admin: 'view', agent: 'view' }
const OWNER_EDIT_AGENT_VIEW: Record<Access, Mode> = { solo: 'edit', admin: 'edit', agent: 'view' }
const OWNER_ONLY: Record<Access, Mode> = { solo: 'edit', admin: 'edit', agent: 'hidden' }
const TEAM_ADMIN_ONLY: Record<Access, Mode> = { solo: 'hidden', admin: 'edit', agent: 'hidden' }

export const SECTIONS: SectionDef[] = [
  { id: 'profile',       group: 'account',   kind: 'personal', label: 'Profile',                blurb: 'Your name, phone and designation',            Icon: UserCircle,  modes: ALL_EDIT },
  { id: 'notifications', group: 'account',   kind: 'personal', label: 'Notifications',          blurb: 'What LeadGap tells you about, and where',      Icon: Bell,        modes: ALL_EDIT },
  { id: 'security',      group: 'account',   kind: 'personal', label: 'Security',               blurb: 'Password and signed-in devices',               Icon: ShieldCheck, modes: ALL_EDIT },
  { id: 'workspace',     group: 'workspace', kind: 'shared',   label: 'Business details',       blurb: 'Company, RERA number, office and market',      Icon: Buildings,   modes: OWNER_EDIT_AGENT_VIEW },
  { id: 'leads',         group: 'workspace', kind: 'builtin',  label: 'Lead management',        blurb: 'Stages and the rules that move leads',         Icon: Stack,       modes: ALL_VIEW },
  { id: 'calling',       group: 'workspace', kind: 'builtin',  label: 'Calling & WhatsApp',     blurb: 'Calling, WhatsApp and email connections',      Icon: PhoneCall,   modes: ALL_VIEW },
  { id: 'portals',       group: 'workspace', kind: 'shared',   label: 'Portals & integrations', blurb: 'Where your leads come from',                   Icon: Plugs,       modes: OWNER_ONLY },
  { id: 'automations',   group: 'workspace', kind: 'builtin',  label: 'Automations',            blurb: 'What runs on its own',                         Icon: Lightning,   modes: ALL_VIEW },
  { id: 'ai',            group: 'workspace', kind: 'shared',   label: 'AI preferences',         blurb: 'How much the AI may do on its own',            Icon: Sparkle,     modes: OWNER_EDIT_AGENT_VIEW },
  { id: 'branding',      group: 'workspace', kind: 'shared',   label: 'Branding & reports',     blurb: 'Logo, colours and report defaults',            Icon: PaintBrush,  modes: OWNER_ONLY },
  { id: 'team',          group: 'team',      kind: 'shared',   label: 'Team & access',          blurb: 'Members, roles and who can do what',           Icon: UsersThree,  modes: TEAM_ADMIN_ONLY },
  { id: 'routing',       group: 'team',      kind: 'shared',   label: 'Lead routing',           blurb: 'Which agent gets a new lead',                  Icon: ArrowsSplit, modes: TEAM_ADMIN_ONLY },
  { id: 'billing',       group: 'plan',      kind: 'shared',   label: 'Plan & billing',         blurb: 'Subscription, payments and invoices',          Icon: CreditCard,  modes: OWNER_ONLY },
  { id: 'data',          group: 'plan',      kind: 'shared',   label: 'Data & privacy',         blurb: 'Download or delete your data',                 Icon: Database,    modes: OWNER_ONLY },
]
export const sectionDef = (id: SectionId) => SECTIONS.find(s => s.id === id)!
export const modeOf = (id: SectionId, a: Access): Mode => sectionDef(id).modes[a]

/** The pill next to a section title: who it is for */
export function AccessPill({ s, access }: { s: SectionDef; access: Access }) {
  const mode = s.modes[access]
  if (s.kind === 'builtin') return <Pill tone="neutral" small><Eye size={12} weight="bold" />Built into LeadGap</Pill>
  if (mode === 'view') return <Pill tone="neutral" small><LockSimple size={12} weight="bold" />View only</Pill>
  if (s.kind === 'personal') return <Pill tone="blue" small><UserCircle size={12} weight="bold" />Just for you</Pill>
  if (access === 'admin') return <Pill tone="violet" small><ShieldCheck size={12} weight="bold" />Admins only · applies to everyone</Pill>
  return null
}

// ─── The signed-in user ───────────────────────────────────────────────────────
export type Me = {
  id: string; email: string; meta: Record<string, unknown>
  createdAt: string | null; lastSignIn: string | null
}
async function fetchMe(): Promise<Me | null> {
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  if (!u) return null
  return {
    id: u.id, email: u.email ?? '', meta: (u.user_metadata ?? {}) as Record<string, unknown>,
    createdAt: u.created_at ?? null, lastSignIn: u.last_sign_in_at ?? null,
  }
}
/**
 * The user's own details. Saving writes to the Supabase auth user's metadata, where signup and onboarding
 * already keep full_name, phone and workspace_name. Only top-level keys are merged, so pass whole objects.
 */
export function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const load = useCallback(() => fetchMe().then(setMe).catch(() => setMe(null)), [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async (patch: Record<string, unknown>) => {
    const { error } = await supabase.auth.updateUser({ data: patch })
    if (error) throw new Error(error.message)
    setMe(m => (m ? { ...m, meta: { ...m.meta, ...patch } } : m))
  }, [])
  return { me, save, reload: load }
}
export const metaText = (me: Me | null | undefined, key: string) => {
  const v = me?.meta[key]
  return typeof v === 'string' ? v : ''
}
export const metaObj = (me: Me | null | undefined, key: string): Record<string, unknown> => {
  const v = me?.meta[key]
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
export const displayNameOf = (me: Me | null | undefined) =>
  metaText(me, 'full_name') || metaText(me, 'name') || [metaText(me, 'first_name'), metaText(me, 'last_name')].filter(Boolean).join(' ') || (me?.email.split('@')[0] ?? '')

// ─── Account overview (connections and lead counts) ───────────────────────────
export type Overview = {
  services: { calling: boolean; whatsapp: boolean; email: boolean; payments: boolean; ai: boolean }
  sources: { source: string | null; leads: number; last: string | null }[]
  totals: { leads: number; activities: number | null }
  /** Webhook deliveries per portal name from the ingest log. Counts every account; null when the log isn't set up */
  deliveries: Record<string, { created: number; duplicate: number; failed: number; last: string | null }> | null
  capped?: boolean
}
async function fetchOverview(): Promise<Overview> {
  const r = await fetch('/api/settings/overview', { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Couldn't load (${r.status})`)
  return j as Overview
}
export function useOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => fetchOverview().then(d => { setData(d); setError(null) }).catch(e => setError(e instanceof Error ? e.message : 'Couldn\'t load')), [])
  useEffect(() => { load() }, [load])
  return { data, error, reload: load }
}

/** What every section component gets from the Settings shell */
export type SectionProps = {
  access: Access
  mode: Mode
  meApi: ReturnType<typeof useMe>
  overview: ReturnType<typeof useOverview>
  notify: (t: ToastMsg) => void
  go: (id: SectionId) => void
}

// ─── Layout pieces ────────────────────────────────────────────────────────────
/** A setting: label and hint on the left, the control on the right (stacked on phones) */
export function Row({ label, hint, children, htmlFor, top }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string; top?: boolean }) {
  return (
    <div className={`grid gap-x-8 gap-y-2 border-t py-4 first:border-t-0 first:pt-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,340px)] ${top ? 'sm:items-start' : 'sm:items-center'}`} style={{ borderColor: '#F2F4F7' }}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-[14px] font-semibold" style={{ color: TEXT }}>{label}</label>
        {hint && <p className="m-0 mt-0.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** For a link that should look like a secondary button (a button inside a link isn't valid HTML) */
export const linkBtnCls = (size: 'sm' | 'md' = 'md') =>
  `inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border bg-white font-semibold no-underline transition-colors hover:bg-[#F9FAFB] ${size === 'sm' ? 'h-8 rounded-[8px] px-2.5 text-[13px]' : 'h-10 rounded-[10px] px-3.5 text-[14px]'}`
export const linkBtnStyle = { borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }

/** Marks something that LeadGap can't do yet, so nobody mistakes a dead control for a working one */
export function Soon({ children = 'Not available yet' }: { children?: ReactNode }) {
  return <Pill tone="neutral" small><Clock size={12} weight="bold" />{children}</Pill>
}

/** A read-only value in place of an input */
export function ValueBox({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <div className="flex h-10 min-w-0 items-center rounded-[10px] border px-3 text-[14px]" style={{ borderColor: BORDER, background: '#F9FAFB', color: muted ? LABEL : TEXT_2 }}>
      <span className="truncate">{children}</span>
    </div>
  )
}

/** Connected or not, with a dot */
export function StatusDot({ on, onText = 'Connected', offText = 'Not set up' }: { on: boolean | null; onText?: string; offText?: string }) {
  if (on == null) return <span className="text-[13px]" style={{ color: LABEL }}>Checking…</span>
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold" style={{ color: on ? GREEN_D : SUBTLE }}>
      {on ? <CheckCircle size={15} weight="fill" /> : <Circle size={15} weight="bold" style={{ color: LABEL }} />}
      {on ? onText : offText}
    </span>
  )
}

/** A segmented choice where some options can't be picked yet */
export function Choice<T extends string>({ value, onChange, options, label, disabled }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string; soon?: boolean }[]; label: string; disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full max-w-full gap-0.5 rounded-[10px] border p-[3px]" style={{ background: '#F9FAFB', borderColor: BORDER }}>
      {options.map(o => {
        const on = o.id === value
        const off = disabled || o.soon
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} disabled={off && !on} onClick={() => !off && onChange(o.id)}
            title={o.soon ? 'Not available yet' : undefined}
            className="flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-[7px] px-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
            style={on ? { background: '#FFFFFF', color: TEXT, boxShadow: '0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)' } : { color: off ? '#D0D5DD' : SUBTLE }}>
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Sticky bar that appears when a form has unsaved changes */
export function SaveBar({ dirty, saving, onSave, onReset, note }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; note?: ReactNode }) {
  if (!dirty && !saving) return null
  return (
    <div className="sticky bottom-[76px] z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-white px-4 py-3 lg:bottom-4"
      style={{ borderColor: BORDER, boxShadow: '0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)' }}>
      <span className="text-[13.5px] font-medium" style={{ color: TEXT_2 }}>{note ?? 'You have unsaved changes'}</span>
      <span className="flex gap-2">
        <button type="button" onClick={onReset} disabled={saving} className="h-9 cursor-pointer rounded-[9px] border bg-white px-3 text-[13.5px] font-semibold disabled:cursor-not-allowed" style={{ borderColor: '#D0D5DD', color: TEXT_2, boxShadow: XS }}>Discard</button>
        <button type="button" onClick={onSave} disabled={saving} className="h-9 cursor-pointer rounded-[9px] px-3.5 text-[13.5px] font-semibold text-white disabled:cursor-wait disabled:opacity-70" style={{ background: BLUE, boxShadow: XS }}>{saving ? 'Saving…' : 'Save changes'}</button>
      </span>
    </div>
  )
}

/** Short tone dot + label, used in lists */
export function Dot({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = tone === 'green' ? GREEN_D : tone === 'blue' ? BLUE : tone === 'amber' ? '#DC6803' : tone === 'red' ? '#D92D20' : tone === 'violet' ? '#6938EF' : LABEL
  return <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: c }}><span className="size-2 rounded-full" style={{ background: c }} />{children}</span>
}

export const dateText = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const dateTimeText = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/\b(am|pm)\b/gi, s => s.toLowerCase()) : '—'
export const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
