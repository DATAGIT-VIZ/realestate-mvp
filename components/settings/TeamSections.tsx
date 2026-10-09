'use client'

// Settings → Team (Teams plan, admins only): Team & access, and Lead routing.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  UsersThree, Check, X, Eye, ArrowRight, Plus, Trash, Warning, ArrowsSplit, ListNumbers, Envelope, Info, Crown,
} from '@phosphor-icons/react'
import { PLANS } from '@/lib/razorpay'
import {
  Avatar, Btn, Dialog, EmptyState, Field, Insight, Panel, Pill, Seg, Select, Toggle, inputCls, inputStyle,
  BORDER, SURFACE, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, XS,
} from '@/components/outreach/OutreachKit'
import { Row, Soon, displayNameOf, errText, linkBtnCls, linkBtnStyle, type SectionProps } from './SettingsKit'

// ─── Data ─────────────────────────────────────────────────────────────────────
type MemberRole = 'admin' | 'manager' | 'agent'
export type Member = {
  id: string; name: string; email: string | null; phone: string | null; role: MemberRole | string
  is_active?: boolean | null; specialty_cities?: string[] | null; monthly_target?: number | null; created_at?: string
}
type Rule = {
  id: string; priority: number; rule_type: string; match_value?: string | null; agent_id?: string | null
  is_active: boolean; agent?: { id: string; name: string } | null
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Couldn't load (${r.status})`)
  return j as T
}
async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Couldn't save (${r.status})`)
  return j
}
const fetchMembers = () => getJson<{ members: Member[] }>('/api/team').then(j => j.members ?? [])
const fetchRules = () => getJson<{ rules: Rule[] }>('/api/routing-rules').then(j => j.rules ?? [])
const isActive = (m: Member) => m.is_active !== false

// ─── Team & access ────────────────────────────────────────────────────────────
type Cell = true | false | string
const MATRIX: { what: string; admin: Cell; agent: Cell }[] = [
  { what: 'Leads',                                 admin: 'Every lead',  agent: 'Leads assigned to them' },
  { what: 'Today, Pipeline, Outreach and AI Advisor', admin: true,       agent: true },
  { what: 'Team page and Team analytics',          admin: true,          agent: false },
  { what: 'Reports',                               admin: 'Any agent',   agent: 'Their own' },
  { what: 'Lead routing',                          admin: true,          agent: false },
  { what: 'Portals & integrations',                admin: true,          agent: false },
  { what: 'Business details and AI preferences',   admin: 'Change',      agent: 'View' },
  { what: 'Plan, billing and data export',         admin: true,          agent: false },
  { what: 'Their own profile, alerts and password', admin: true,         agent: true },
]

function CellMark({ v }: { v: Cell }) {
  if (v === true) return <span className="inline-flex size-6 items-center justify-center rounded-full" style={{ background: '#ECFDF3', color: '#067647' }}><Check size={14} weight="bold" /><span className="sr-only">Yes</span></span>
  if (v === false) return <span className="inline-flex size-6 items-center justify-center rounded-full" style={{ background: '#F2F4F7', color: LABEL }}><X size={13} weight="bold" /><span className="sr-only">No</span></span>
  return <span className="text-[13px] font-semibold leading-tight" style={{ color: v === 'View' || v === 'Their own' || v.startsWith('Leads') ? TEXT_2 : '#067647' }}>{v}</span>
}

export function TeamSection({ meApi, notify }: SectionProps) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => fetchMembers().then(m => { setMembers(m); setError(null) }).catch(e => setError(errText(e))), [])
  useEffect(() => { load() }, [load])
  const [busy, setBusy] = useState<string | null>(null)

  async function patch(m: Member, body: Partial<Member>, done: string) {
    setBusy(m.id)
    const before = members
    setMembers(ms => ms?.map(x => (x.id === m.id ? { ...x, ...body } : x)) ?? ms)
    try { await send(`/api/team/${m.id}`, 'PATCH', body); notify({ text: done, tone: 'ok' }) }
    catch (e) { setMembers(before); notify({ text: errText(e), tone: 'err' }) }
    finally { setBusy(null) }
  }

  const seats = PLANS.team.limits.agents
  const active = (members ?? []).filter(isActive)
  const me = meApi.me
  const myName = displayNameOf(me) || 'You'
  const counts = { admin: active.filter(m => m.role === 'admin' || m.role === 'manager').length, agent: active.filter(m => m.role !== 'admin' && m.role !== 'manager').length }

  return (
    <div className="flex flex-col gap-5">
      <Panel icon={<Eye size={18} weight="bold" />} title="Who can do what" sub="Admins run the workspace. Agents work their own leads.">
        <div className="-mx-4 overflow-hidden sm:-mx-5">
          <div className="grid grid-cols-[minmax(0,1fr)_92px_92px] items-end border-b px-4 pb-2.5 sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:px-5" style={{ borderColor: '#F2F4F7' }}>
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>Access</span>
            <span className="flex flex-col items-center gap-1 text-center"><Pill tone="violet" small><Crown size={11} weight="fill" />Admin</Pill><span className="hidden text-[11.5px] sm:block" style={{ color: LABEL }}>and manager</span></span>
            <span className="flex justify-center"><Pill tone="blue" small>Agent</Pill></span>
          </div>
          {MATRIX.map(r => (
            <div key={r.what} className="grid grid-cols-[minmax(0,1fr)_92px_92px] items-center border-b px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:px-5" style={{ borderColor: '#F2F4F7' }}>
              <span className="pr-2 text-[13.5px] font-medium leading-snug" style={{ color: TEXT }}>{r.what}</span>
              <span className="flex justify-center text-center"><CellMark v={r.admin} /></span>
              <span className="flex justify-center text-center"><CellMark v={r.agent} /></span>
            </div>
          ))}
        </div>
        <div className="mt-4"><Insight tone="amber" icon={<Info size={15} weight="bold" />} title="Agents can't sign in with their own account yet">
          This is the access each role gets once they can. Until then, roles decide who leads are assigned to and who shows up in team reports.
        </Insight></div>
      </Panel>

      <Panel icon={<UsersThree size={18} weight="bold" />} title="Members"
        sub={members ? `${active.length} active · the Team plan includes up to ${seats} agents` : 'Everyone on your team'}
        right={<Link href="/dashboard/team" className={linkBtnCls('sm')} style={linkBtnStyle}><Plus size={14} weight="bold" />Add on the Team page</Link>}>
        <div className="-mx-4 sm:-mx-5">
          {/* The signed-in owner */}
          <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: '#F2F4F7', background: SURFACE }}>
            <Avatar name={myName} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="truncate text-[14.5px] font-semibold" style={{ color: TEXT }}>{myName}</span><Pill tone="violet" small><Crown size={11} weight="fill" />Owner · you</Pill></div>
              <div className="truncate text-[13px]" style={{ color: SUBTLE }}>{me?.email ?? ''}</div>
            </div>
          </div>
          {error && <p className="m-0 px-4 py-4 text-[13.5px] sm:px-5" style={{ color: '#B42318' }}>Couldn&apos;t load your team: {error}</p>}
          {!members && !error && <p className="m-0 px-4 py-4 text-[13.5px] sm:px-5" style={{ color: SUBTLE }}>Loading…</p>}
          {members?.length === 0 && (
            <p className="m-0 px-4 py-5 text-[14px] sm:px-5" style={{ color: SUBTLE }}>No one else yet. Add your agents on the Team page and they&apos;ll show up here.</p>
          )}
          {members?.map(m => (
            <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b px-4 py-3 last:border-b-0 sm:flex-nowrap sm:px-5" style={{ borderColor: '#F2F4F7', opacity: isActive(m) ? 1 : 0.6 }}>
              <Avatar name={m.name} size={38} />
              <div className="min-w-0 flex-1 basis-[160px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[14.5px] font-semibold" style={{ color: TEXT }}>{m.name}</span>
                  {!isActive(m) && <Pill small>Inactive</Pill>}
                </div>
                <div className="truncate text-[13px]" style={{ color: SUBTLE }}>{[m.email, m.phone].filter(Boolean).join(' · ') || 'No contact details'}</div>
              </div>
              <div className="flex w-full items-center gap-3 sm:w-auto">
                <div className="flex-1 sm:w-[132px] sm:flex-none">
                  <Select value={['admin', 'manager', 'agent'].includes(m.role) ? m.role : 'agent'} onChange={v => patch(m, { role: v as MemberRole }, `${m.name} is now ${v === 'agent' ? 'an agent' : `a${v === 'admin' ? 'n' : ''} ${v}`}`)}>
                    <option value="admin">Admin</option><option value="manager">Manager</option><option value="agent">Agent</option>
                  </Select>
                </div>
                <span className="flex items-center gap-2">
                  <Toggle on={isActive(m)} disabled={busy === m.id} label={isActive(m) ? `Deactivate ${m.name}` : `Activate ${m.name}`}
                    onChange={v => patch(m, { is_active: v }, v ? `${m.name} is active again` : `${m.name} is inactive and won't get new leads`)} />
                  <span className="hidden w-14 text-[12.5px] font-medium sm:inline" style={{ color: SUBTLE }}>{isActive(m) ? 'Active' : 'Inactive'}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
        {members && members.length > 0 && (
          <p className="m-0 mt-3 text-[12.5px]" style={{ color: LABEL }}>{counts.admin} admin{counts.admin === 1 ? '' : 's'} or manager{counts.admin === 1 ? '' : 's'}, {counts.agent} agent{counts.agent === 1 ? '' : 's'} active</p>
        )}
      </Panel>

      <Panel icon={<Envelope size={18} weight="bold" />} title="Invite by email" right={<Soon />} sub="Send an agent a link to sign in with their own account and role.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input disabled className={inputCls} style={{ ...inputStyle, background: SURFACE }} placeholder="agent@company.com" />
          <Btn disabled>Send invite</Btn>
        </div>
      </Panel>
    </div>
  )
}

// ─── Lead routing ─────────────────────────────────────────────────────────────
type RuleType = 'city' | 'portal' | 'property_type' | 'round_robin'
const RULE_TYPES: { id: RuleType; label: string; short: string; desc: string; placeholder: string; suggestions: string[] }[] = [
  { id: 'city',          label: 'City',          short: 'City',     desc: 'Leads from one city',             placeholder: 'e.g. Mumbai',      suggestions: ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata'] },
  { id: 'portal',        label: 'Source portal', short: 'Portal',   desc: 'Leads from one portal or source', placeholder: 'e.g. MagicBricks', suggestions: ['MagicBricks', '99acres', 'Housing.com', 'Facebook Ads', 'Referral', 'Walk-in'] },
  { id: 'property_type', label: 'Property type', short: 'Type',     desc: 'Leads looking for one type',      placeholder: 'e.g. 3BHK',        suggestions: ['1BHK', '2BHK', '3BHK', '4BHK+', 'Villa', 'Plot', 'Commercial'] },
  { id: 'round_robin',   label: 'Round robin',   short: 'Rotate',   desc: 'Every lead no other rule matched, shared in turn', placeholder: '', suggestions: [] },
]
const ruleType = (id: string) => RULE_TYPES.find(r => r.id === id)
const BLANK = { rule_type: 'city' as RuleType, match_value: '', agent_id: '', priority: '' }

export function RoutingSection({ notify }: SectionProps) {
  const [rules, setRules] = useState<Rule[] | null>(null)
  const [agents, setAgents] = useState<Member[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => Promise.all([fetchRules(), fetchMembers()])
    .then(([r, m]) => { setRules(r); setAgents(m.filter(isActive)); setError(null) })
    .catch(e => setError(errText(e))), [])
  useEffect(() => { load() }, [load])

  const [form, setForm] = useState(BLANK)
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Rule | null>(null)
  const rt = ruleType(form.rule_type)!
  // A new rule goes after the existing ones unless an order is typed
  const nextOrder = (rules ?? []).reduce((m, r) => Math.max(m, r.priority), 0) + 1

  async function add() {
    setFormError(null)
    if (form.rule_type !== 'round_robin' && !form.match_value.trim()) { setFormError(`Pick or type a ${rt.label.toLowerCase()}`); return }
    if (!form.agent_id) { setFormError('Pick who gets these leads'); return }
    setAdding(true)
    try {
      const j = await send('/api/routing-rules', 'POST', {
        rule_type: form.rule_type, agent_id: form.agent_id, priority: form.priority.trim() === '' ? nextOrder : Math.max(0, Math.round(Number(form.priority)) || 0),
        match_value: form.rule_type === 'round_robin' ? null : form.match_value.trim(),
      })
      setRules(rs => [...(rs ?? []), j.rule as Rule].sort((a, b) => a.priority - b.priority))
      setForm(BLANK)
      notify({ text: 'Rule added', tone: 'ok' })
    } catch (e) { setFormError(errText(e)) }
    finally { setAdding(false) }
  }
  async function toggle(r: Rule) {
    setRules(rs => rs?.map(x => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)) ?? rs)
    try { await send(`/api/routing-rules/${r.id}`, 'PATCH', { is_active: !r.is_active }) }
    catch (e) { setRules(rs => rs?.map(x => (x.id === r.id ? r : x)) ?? rs); notify({ text: errText(e), tone: 'err' }) }
  }
  async function remove(r: Rule) {
    setConfirm(null)
    const before = rules
    setRules(rs => rs?.filter(x => x.id !== r.id) ?? rs)
    try { await send(`/api/routing-rules/${r.id}`, 'DELETE'); notify({ text: 'Rule deleted', tone: 'ok' }) }
    catch (e) { setRules(before); notify({ text: errText(e), tone: 'err' }) }
  }

  const sorted = [...(rules ?? [])].sort((a, b) => a.priority - b.priority)
  return (
    <div className="flex flex-col gap-5">
      <Insight tone="amber" icon={<Warning size={15} weight="bold" />} title="Saved rules aren't applied to new leads yet">
        New leads aren&apos;t assigned automatically today, so assign them from the Leads page. Your rules are kept and will start working once routing is switched on.
      </Insight>

      <Panel icon={<Plus size={18} weight="bold" />} title="Add a rule" sub="Send leads that match to one agent.">
        <div className="flex flex-col gap-4">
          <Field label="Match leads by">
            <Seg<RuleType> label="Rule type" full value={form.rule_type} onChange={v => setForm(f => ({ ...f, rule_type: v, match_value: '' }))}
              options={RULE_TYPES.map(r => ({ id: r.id, label: <><span className="sm:hidden">{r.short}</span><span className="hidden sm:inline">{r.label}</span></> }))} />
            <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: SUBTLE }}>{rt.desc}</p>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px]">
            {form.rule_type !== 'round_robin' ? (
              <Field label={rt.label} htmlFor="rr-match">
                <input id="rr-match" list="rr-suggest" className={inputCls} style={inputStyle} value={form.match_value} placeholder={rt.placeholder}
                  onChange={e => setForm(f => ({ ...f, match_value: e.target.value }))} />
                <datalist id="rr-suggest">{rt.suggestions.map(s => <option key={s} value={s} />)}</datalist>
              </Field>
            ) : (
              <Field label="Matches"><div className="flex h-10 items-center rounded-[10px] border px-3 text-[14px]" style={{ borderColor: BORDER, background: SURFACE, color: SUBTLE }}>Everything else</div></Field>
            )}
            <Field label="Assign to" htmlFor="rr-agent">
              {agents.length === 0
                ? <Link href="/dashboard/team" className="flex h-10 items-center gap-1 rounded-[10px] border px-3 text-[14px] font-semibold no-underline" style={{ borderColor: BORDER, color: BLUE }}>Add agents first<ArrowRight size={14} weight="bold" /></Link>
                : <Select id="rr-agent" value={form.agent_id} onChange={v => setForm(f => ({ ...f, agent_id: v }))}>
                    <option value="">Pick an agent</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>}
            </Field>
            <Field label="Order" htmlFor="rr-pri">
              <input id="rr-pri" type="number" min={0} inputMode="numeric" className={inputCls} style={inputStyle} value={form.priority} placeholder={String(nextOrder)} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
            </Field>
          </div>
          {formError && <p className="m-0 text-[13px] font-medium" style={{ color: '#B42318' }}>{formError}</p>}
          <div><Btn variant="primary" onClick={add} disabled={adding || agents.length === 0}><Plus size={16} weight="bold" />{adding ? 'Adding…' : 'Add rule'}</Btn></div>
        </div>
      </Panel>

      <Panel icon={<ListNumbers size={18} weight="bold" />} title="Your rules" sub="Checked in order, lowest number first. The first active rule that matches wins.">
        {error && <p className="m-0 text-[13.5px]" style={{ color: '#B42318' }}>Couldn&apos;t load rules: {error}</p>}
        {!rules && !error && <p className="m-0 text-[13.5px]" style={{ color: SUBTLE }}>Loading…</p>}
        {rules?.length === 0 && (
          <EmptyState icon={<ArrowsSplit size={22} weight="bold" />} title="No rules yet">Add a rule above to decide which agent gets leads from a city, portal or property type.</EmptyState>
        )}
        {sorted.length > 0 && (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {sorted.map(r => {
              const t = ruleType(r.rule_type)
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border px-3 py-2.5 sm:flex-nowrap" style={{ borderColor: BORDER, background: r.is_active ? '#FFFFFF' : SURFACE, boxShadow: XS }}>
                  <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-[8px] px-1.5 text-[13px] font-bold tabular-nums" style={{ background: r.is_active ? BLUE_BG : '#F2F4F7', color: r.is_active ? BLUE : LABEL }}>{r.priority}</span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1" style={{ opacity: r.is_active ? 1 : 0.6 }}>
                    <Pill small tone={r.rule_type === 'round_robin' ? 'green' : 'neutral'}>{t?.label ?? r.rule_type}</Pill>
                    <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{r.rule_type === 'round_robin' ? 'Everything else' : r.match_value}</span>
                    <ArrowRight size={14} weight="bold" style={{ color: LABEL }} />
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[14px]" style={{ color: TEXT_2 }}>
                      {r.agent?.name ? <><Avatar name={r.agent.name} size={22} /><span className="truncate">{r.agent.name}</span></> : <span style={{ color: LABEL }}>No agent</span>}
                    </span>
                  </div>
                  <span className="ml-auto flex items-center gap-1.5">
                    <Toggle on={r.is_active} onChange={() => toggle(r)} label={r.is_active ? 'Turn rule off' : 'Turn rule on'} />
                    <Btn variant="ghost" size="sm" label="Delete rule" onClick={() => setConfirm(r)}><Trash size={16} weight="bold" /></Btn>
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>

      <Panel icon={<ArrowsSplit size={18} weight="bold" />} title="More routing options" right={<Soon />}>
        <Row label="Routing mode" hint="Round robin, by city, by property type, by lead score or manual only"><Select value="Rules" onChange={() => {}} className="pointer-events-none opacity-60"><option>Rules above</option></Select></Row>
        <Row label="Only agents on shift" hint="Skip agents outside their working hours"><Toggle on={false} onChange={() => {}} label="Only agents on shift: not available yet" disabled /></Row>
        <Row label="Fallback" hint="Who gets a lead when nobody else can"><Select value="Admin" onChange={() => {}} className="pointer-events-none opacity-60"><option>Admin</option></Select></Row>
      </Panel>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Delete this rule?" icon={<Trash size={20} weight="bold" />}
        sub={confirm ? `${ruleType(confirm.rule_type)?.label ?? confirm.rule_type}${confirm.match_value ? `: ${confirm.match_value}` : ''} → ${confirm.agent?.name ?? 'no agent'}` : undefined}
        footer={<><Btn onClick={() => setConfirm(null)}>Keep it</Btn><Btn variant="danger" onClick={() => confirm && remove(confirm)}>Delete rule</Btn></>}>
        <p className="m-0 text-[14px]" style={{ color: TEXT_2 }}>Leads this rule would have matched go to the next rule instead.</p>
      </Dialog>
    </div>
  )
}
