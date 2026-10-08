'use client'

// Invite team (/dashboard/invite, the sidebar's "Invite team" link).
// 1. Add people: one by one or pasted from a list. Saved with POST /api/team, the same team the
//    Team page, lead assignment and team reports use.
// 2. Say hello: a welcome message each person gets on WhatsApp or email, sent from your own phone or mail app.
// 3. Give them leads: share waiting leads from the Team page.
// Agents can't sign in with their own account yet, so nothing here sends a login link.
// Same tokens, cards and buttons as the Leads, Team and Settings pages (components/outreach/OutreachKit).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import {
  UserPlus, UsersThree, Plus, X, ListBullets, Rows, WhatsappLogo, Envelope, Copy, Check, ArrowRight,
  Crown, Lock, Info, Warning, ArrowsSplit, Clock, Sparkle, ShieldCheck, Trash,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { getPlan, getRole } from '@/lib/plan'
import { PLANS } from '@/lib/razorpay'
import {
  CANVAS, SURFACE, BORDER, BORDER_2, TEXT, TEXT_2, MUTED, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, GREEN_D, WA, XS, TONE,
  Avatar, Pill, Btn, Badge, Panel, PageHeader, Seg, Select, Insight, EmptyState, Toast, useToast,
  WaPhone, WaBubble, EmailCard, inputCls, inputStyle, textareaCls, phone10, formatPhone, waHref, insertAtCursor,
} from '@/components/outreach/OutreachKit'

// ─── Who is looking ───────────────────────────────────────────────────────────
type Access = 'solo' | 'admin' | 'agent'
const subscribeAccess = (cb: () => void) => {
  window.addEventListener('plan-changed', cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener('plan-changed', cb); window.removeEventListener('storage', cb) }
}
const accessNow = (): Access => (getPlan() !== 'teams' ? 'solo' : getRole() === 'agent' ? 'agent' : 'admin')
const accessOnServer = (): Access | null => null
const useAccess = () => useSyncExternalStore(subscribeAccess, accessNow, accessOnServer)

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Member {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  role: string
  is_active?: boolean | null
  created_at?: string
}
type Me = { name: string; email: string; workspace: string }

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

async function fetchMembers(): Promise<Member[]> {
  const r = await fetch('/api/team', { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Couldn't load your team (${r.status})`)
  return j.members ?? []
}
async function fetchMe(): Promise<Me> {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  const md = (u?.user_metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const email = u?.email ?? ''
  return { name: str(md.full_name) || str(md.name) || email.split('@')[0] || '', email, workspace: str(md.workspace_name) }
}

const isActive = (m: Member) => m.is_active !== false
const ROLE_LABEL: Record<string, string> = { agent: 'Agent', senior_agent: 'Sr. Agent', manager: 'Manager', admin: 'Admin' }
const ROLE_TONE: Record<string, 'blue' | 'amber' | 'green' | 'violet'> = { agent: 'blue', senior_agent: 'amber', manager: 'green', admin: 'violet' }
const roleLabel = (r: string) => ROLE_LABEL[r] ?? 'Agent'
const SEATS = PLANS.team.limits.agents

// ─── Drafts ───────────────────────────────────────────────────────────────────
type RoleId = 'agent' | 'manager'
type Draft = { key: number; name: string; phone: string; email: string; role: RoleId }
type Field3 = 'name' | 'phone' | 'email'
type DraftCheck = { blank: boolean; ready: boolean; errors: Partial<Record<Field3, string>>; dupe?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const blankDraft = (key: number, role: RoleId = 'agent'): Draft => ({ key, name: '', phone: '', email: '', role })
const nextKey = (rows: Draft[]) => rows.reduce((k, r) => Math.max(k, r.key), 0) + 1

function checkRows(rows: Draft[], members: Member[]): Map<number, DraftCheck> {
  const out = new Map<number, DraftCheck>()
  const seenPhone = new Map<string, number>()
  const seenEmail = new Map<string, number>()
  rows.forEach((r, i) => {
    const name = r.name.trim(), phone = r.phone.trim(), email = r.email.trim().toLowerCase()
    const blank = !name && !phone && !email
    const errors: DraftCheck['errors'] = {}
    if (!blank && !name) errors.name = 'Add their name'
    const p10 = phone ? phone10(phone) : null
    if (phone && !p10) errors.phone = 'Use a 10-digit mobile number'
    if (email && !EMAIL_RE.test(email)) errors.email = 'Check this email'
    let dupe: string | undefined
    const onTeam = members.find(m => (p10 && phone10(m.phone) === p10) || (email && (m.email ?? '').trim().toLowerCase() === email))
    if (onTeam) dupe = `${onTeam.name} is already on your team with this ${p10 && phone10(onTeam.phone) === p10 ? 'number' : 'email'}`
    else if (p10 && seenPhone.has(p10)) dupe = `Same number as row ${seenPhone.get(p10)! + 1}`
    else if (email && seenEmail.has(email)) dupe = `Same email as row ${seenEmail.get(email)! + 1}`
    if (p10 && !seenPhone.has(p10)) seenPhone.set(p10, i)
    if (email && !seenEmail.has(email)) seenEmail.set(email, i)
    out.set(r.key, { blank, errors, dupe, ready: !blank && !dupe && Object.keys(errors).length === 0 })
  })
  return out
}

// "Priya Sharma, 98200 12345, priya@acme.in" (commas, tabs, semicolons or pipes; any order)
type Parsed = { name: string; phone: string; email: string }
function parseList(text: string): Parsed[] {
  const out: Parsed[] = []
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim()
    if (!line) continue
    if (/^name\b/i.test(line) && !/\d|@/.test(line)) continue
    let email = '', phone = ''
    const em = line.match(/[^\s,;|\t<>()]+@[^\s,;|\t<>()]+\.[^\s,;|\t<>()]{2,}/)
    if (em) { email = em[0]; line = line.replace(em[0], ' ') }
    const ph = line.match(/(?:\+?91[\s-]?|0)?[6-9]\d{2}[\s-]?\d{2}[\s-]?\d{5}|(?:\+?91[\s-]?|0)?[6-9]\d{9}/)
    if (ph && phone10(ph[0])) { phone = phone10(ph[0])!; line = line.replace(ph[0], ' ') }
    const name = line.split(/[,;|\t]+/).map(s => s.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/^[-–:.\s]+|[-–:.\s]+$/g, '')
    if (name || phone || email) out.push({ name, phone, email })
  }
  return out
}

// ─── Welcome message ──────────────────────────────────────────────────────────
const TAGS = [
  { tag: '{{name}}', label: 'Their name' },
  { tag: '{{workspace}}', label: 'Business name' },
  { tag: '{{you}}', label: 'Your name' },
]
const DEFAULT_TEMPLATE =
  'Hi {{name}}, welcome to {{workspace}}! I\'ve added you to our team on LeadGap, the CRM we use for all our leads. ' +
  'I\'ll assign your leads there and we\'ll keep track of every follow-up together.\n\n– {{you}}'
const SUBJECT = 'Welcome to {{workspace}}'

function fill(text: string, m: Pick<Member, 'name'>, me: Me | null) {
  return text
    .replace(/\{\{\s*name\s*\}\}/gi, m.name.trim().split(/\s+/)[0] || 'there')
    .replace(/\{\{\s*workspace\s*\}\}/gi, me?.workspace || 'the team')
    .replace(/\{\{\s*you\s*\}\}/gi, me?.name || 'Your team lead')
}
const mailHref = (to: string, subject: string, body: string) =>
  `mailto:${to.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

// ─── Small pieces ─────────────────────────────────────────────────────────────
const aBtn = (tone: 'secondary' | 'wa' = 'secondary') =>
  `inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border px-2.5 text-[13px] font-semibold no-underline transition-[background,filter] ${tone === 'wa' ? 'hover:brightness-95' : 'bg-white hover:bg-[#F9FAFB]'}`
const aBtnStyle = (tone: 'secondary' | 'wa' = 'secondary') =>
  tone === 'wa' ? { background: '#E7F8EE', borderColor: '#A6E9C2', color: '#067647', boxShadow: XS } : { borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }
const linkCls = 'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[4px] border bg-white px-3.5 text-[14px] font-semibold no-underline transition-colors hover:bg-[#F9FAFB]'
const linkStyle = { borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }
const primaryLinkCls = 'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[4px] border px-3.5 text-[14px] font-semibold text-white no-underline transition-[filter] hover:brightness-110'
const primaryLinkStyle = { background: BLUE, borderColor: BLUE, boxShadow: '0 1px 2px rgba(16,24,40,0.05), inset 0 -2px 0 rgba(16,24,40,0.12)' }

function Soon() {
  return <Pill small><Clock size={12} weight="light" />Not available yet</Pill>
}

function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="m-0 mt-1 text-[12.5px] font-medium leading-snug" style={{ color: TONE.red.color }}>{children}</p>
}

/** The three steps across the top. Done marks only what really happened on this visit. */
function Steps({ added, greeted }: { added: number; greeted: number }) {
  const steps = [
    { n: 1, title: 'Add people', sub: added ? `${added} added just now` : 'Name and phone is enough', done: added > 0, href: '#add' },
    { n: 2, title: 'Say hello', sub: greeted ? `${greeted} welcomed` : 'WhatsApp or email', done: greeted > 0, href: '#hello' },
    { n: 3, title: 'Give them leads', sub: 'From the Team page', done: false, href: '#leads' },
  ]
  return (
    <ol className="m-0 hidden list-none grid-cols-3 gap-3 p-0 sm:grid">
      {steps.map(s => (
        <li key={s.n} className="min-w-0">
          <a href={s.href} className="flex h-full min-w-0 items-center gap-2.5 rounded-[4px] border bg-white px-2.5 py-2.5 no-underline transition-colors hover:bg-[#F9FAFB] sm:gap-3 sm:px-4 sm:py-3"
            style={{ borderColor: s.done ? '#ABEFC6' : BORDER, boxShadow: XS }}>
            <span className="grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold sm:size-8"
              style={s.done ? { background: '#ECFDF3', color: '#067647', boxShadow: '0 0 0 3px #F6FEF9' } : { background: BLUE, color: '#fff', boxShadow: '0 0 0 3px #EFF4FF' }}>
              {s.done ? <Check size={14} weight="light" /> : s.n}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight sm:text-[14.5px]" style={{ color: TEXT }}>{s.title}</span>
              <span className="mt-0.5 hidden truncate text-[12.5px] sm:block" style={{ color: SUBTLE }}>{s.sub}</span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}

/** Five seats, each filled by an active teammate */
function Seats({ members, adding }: { members: Member[]; adding: number }) {
  const active = members.filter(isActive)
  const used = active.length
  const slots = Math.max(SEATS, used)
  const over = used - SEATS
  const left = SEATS - used
  return (
    <Panel icon={<UsersThree size={18} weight="light" />} title="Seats on the Team plan"
      sub={`The Team plan includes up to ${SEATS} agents.`}
      right={<span className="text-[13px] font-semibold tabular-nums" style={{ color: over > 0 ? TONE.amber.color : TEXT_2 }}>{used} of {SEATS}</span>}>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: slots }, (_, i) => {
          const m = active[i]
          const incoming = !m && i < used + adding
          return (
            <div key={i} title={m ? `${m.name} · ${roleLabel(m.role)}` : incoming ? 'Being added' : 'Open seat'}
              className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-[4px] border"
              style={m
                ? { borderColor: i >= SEATS ? TONE.amber.border : BORDER, background: i >= SEATS ? TONE.amber.bg : CANVAS, boxShadow: XS }
                : { borderColor: incoming ? BLUE_LN : BORDER_2, borderStyle: 'dashed', background: incoming ? BLUE_BG : SURFACE }}>
              {m ? <Avatar name={m.name} size={30} /> : <Plus size={16} weight="light" color={incoming ? BLUE : LABEL} />}
              <span className="w-full truncate px-1 text-center text-[11px] font-medium" style={{ color: m ? TEXT_2 : LABEL }}>{m ? m.name.split(/\s+/)[0] : incoming ? 'Adding' : 'Open'}</span>
            </div>
          )
        })}
      </div>
      <p className="m-0 mt-3 text-[13px] leading-snug" style={{ color: over > 0 ? TONE.amber.color : SUBTLE }}>
        {over > 0
          ? `${over} more active ${over === 1 ? 'person' : 'people'} than the Team plan includes. Pause someone on the Team page to stay within it.`
          : left === 0 ? 'Every seat is taken. Pause someone on the Team page to free one.'
          : `${left} open ${left === 1 ? 'seat' : 'seats'}. Seats count active teammates only.`}
      </p>
    </Panel>
  )
}

const ROLE_INFO: { id: RoleId; title: string; icon: ReactNode; points: string[] }[] = [
  { id: 'agent', title: 'Agent', icon: <UserPlus size={16} weight="light" />, points: ['Works the leads you assign them', 'Shows up on the leaderboard and in team reports', 'Can be given tasks from the Tasks page'] },
  { id: 'manager', title: 'Manager', icon: <Crown size={16} weight="light" />, points: ['Everything an agent has', 'Gets admin access once teammates can sign in', 'Counts towards your seats like an agent'] },
]

function RolesCard({ tableLink = true }: { tableLink?: boolean }) {
  return (
    <Panel icon={<ShieldCheck size={18} weight="light" />} title="What each role gets"
      right={tableLink ? <Link href="/dashboard/settings#team" className="text-[13px] font-semibold no-underline hover:underline" style={{ color: BLUE }}>Full access table</Link> : undefined}>
      <div className="flex flex-col gap-2.5">
        {ROLE_INFO.map(r => (
          <div key={r.id} className="rounded-[4px] border p-3" style={{ borderColor: BORDER, background: SURFACE }}>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-[4px] border bg-white" style={{ borderColor: BORDER, color: r.id === 'manager' ? '#067647' : BLUE }}>{r.icon}</span>
              <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{r.title}</span>
            </div>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {r.points.map(p => (
                <li key={p} className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: TEXT_2 }}>
                  <Check size={13} weight="light" className="mt-[3px] shrink-0" color={GREEN_D} />{p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function LoginCard() {
  return (
    <Panel icon={<Lock size={18} weight="light" />} title="Their own login" right={<Soon />}>
      <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: TEXT_2 }}>
        Teammates can&apos;t sign in with their own account yet, so there&apos;s no invite link to send. For now you add them here, assign their leads and see their work in team reports.
      </p>
    </Panel>
  )
}

// ─── Step 1 · Add people ──────────────────────────────────────────────────────
function AddPeople({ rows, setRows, checks, overBy, onAdded, notify }: {
  rows: Draft[]
  overBy: number
  setRows: (f: (rows: Draft[]) => Draft[]) => void
  checks: Map<number, DraftCheck>
  onAdded: (m: Member[]) => void
  notify: (t: { text: string; tone: 'ok' | 'err' }) => void
}) {
  const [mode, setMode] = useState<'rows' | 'paste'>('rows')
  const [paste, setPaste] = useState('')
  const [failed, setFailed] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const [touched, setTouched] = useState<Record<string, true>>({})
  const touch = (key: number, f: Field3) => setTouched(t => (t[`${key}:${f}`] ? t : { ...t, [`${key}:${f}`]: true }))

  const ready = rows.filter(r => checks.get(r.key)?.ready)
  const problems = rows.filter(r => { const c = checks.get(r.key); return c && !c.blank && !c.ready }).length
  const parsed = useMemo(() => parseList(paste), [paste])

  const set = (key: number, patch: Partial<Draft>) => {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)))
    setFailed(f => { if (!(key in f)) return f; const n = { ...f }; delete n[key]; return n })
  }
  const remove = (key: number) => setRows(rs => (rs.length === 1 ? [blankDraft(nextKey(rs))] : rs.filter(r => r.key !== key)))
  const addRow = () => setRows(rs => [...rs, blankDraft(nextKey(rs), rs[rs.length - 1]?.role ?? 'agent')])

  function usePasted() {
    setRows(rs => {
      const kept = rs.filter(r => !checks.get(r.key)?.blank)
      let k = nextKey(rs)
      return [...kept, ...parsed.map(p => ({ key: k++, name: p.name, phone: p.phone, email: p.email, role: 'agent' as RoleId }))]
    })
    setPaste('')
    setMode('rows')
    notify({ text: `${parsed.length} ${parsed.length === 1 ? 'person' : 'people'} ready to add. Check the rows, then add them.`, tone: 'ok' })
  }

  async function addAll() {
    setTried(true)
    if (!ready.length) return
    setSaving(true)
    const added: Member[] = []
    const fails: Record<number, string> = {}
    for (const r of ready) {
      try {
        const res = await fetch('/api/team', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: r.name.trim(), phone: phone10(r.phone) ?? null, email: r.email.trim() || null, role: r.role }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok || !j.member) throw new Error(j.error || `Couldn't add ${r.name.trim()} (${res.status})`)
        added.push(j.member as Member)
      } catch (e) { fails[r.key] = errText(e) }
    }
    const done = new Set(ready.filter(r => !(r.key in fails)).map(r => r.key))
    setRows(rs => {
      const left = rs.filter(r => !done.has(r.key) && !checks.get(r.key)?.blank)
      return left.length ? left : [blankDraft(nextKey(rs))]
    })
    setFailed(fails)
    setSaving(false)
    setTried(false)
    if (added.length) onAdded(added)
    const nf = Object.keys(fails).length
    if (added.length && !nf) notify({ text: added.length === 1 ? `${added[0].name} is on the team` : `${added.length} people added to the team`, tone: 'ok' })
    else if (added.length) notify({ text: `${added.length} added, ${nf} couldn't be added`, tone: 'err' })
    else notify({ text: nf === 1 ? Object.values(fails)[0] : `Couldn't add ${nf} people`, tone: 'err' })
  }

  return (
    <Panel id="add" step={1} title="Add people"
      sub="Their name and mobile number are enough. Add a few at once, or paste a list."
      right={<Seg label="How to add" value={mode} onChange={setMode}
        options={[{ id: 'rows', label: <><Rows size={14} weight="light" />One by one</> }, { id: 'paste', label: <><ListBullets size={14} weight="light" />Paste a list</> }]} />}>
      {mode === 'paste' ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="inv-paste" className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>One person per line: name, mobile, email</label>
          <textarea id="inv-paste" rows={6} value={paste} onChange={e => setPaste(e.target.value)} className={textareaCls} style={inputStyle}
            placeholder={'Priya Sharma, 98200 12345, priya@acme.in\nRohan Mehta, +91 99300 11223\nSneha Iyer; sneha@acme.in'} />
          <p className="m-0 text-[12.5px]" style={{ color: SUBTLE }}>Works with a copied spreadsheet column, a WhatsApp group&apos;s contact list or plain text. The email is optional.</p>
          {parsed.length > 0 && (
            <div className="rounded-[4px] border" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5" style={{ borderColor: BORDER, background: SURFACE }}>
                <span className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Found {parsed.length} {parsed.length === 1 ? 'person' : 'people'}</span>
              </div>
              <ul className="m-0 max-h-[220px] list-none overflow-y-auto p-0">
                {parsed.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b px-3.5 py-2 last:border-b-0 text-[13.5px]" style={{ borderColor: '#F2F4F7' }}>
                    <span className="font-semibold" style={{ color: p.name ? TEXT : TONE.red.color }}>{p.name || 'No name'}</span>
                    <span className="tabular-nums" style={{ color: SUBTLE }}>{p.phone ? formatPhone(p.phone) : 'No mobile'}</span>
                    {p.email && <span className="min-w-0 truncate" style={{ color: SUBTLE }}>{p.email}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2.5">
            <Btn onClick={() => { setPaste(''); setMode('rows') }}>Cancel</Btn>
            <Btn variant="primary" onClick={usePasted} disabled={!parsed.length}><ArrowRight size={16} weight="light" />Use {parsed.length || ''} {parsed.length === 1 ? 'person' : 'people'}</Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.25fr)_128px_36px] gap-2 px-1 sm:grid">
            {['Name', 'Mobile', 'Email (optional)', 'Role'].map(h => <span key={h} className="text-[12.5px] font-semibold" style={{ color: SUBTLE }}>{h}</span>)}
          </div>
          {rows.map((r, i) => {
            const c = checks.get(r.key)
            const showErr = (k: Field3) => ((tried || touched[`${r.key}:${k}`]) && c?.errors[k]) || undefined
            const nameErr = showErr('name')
            return (
              <div key={r.key} className="rounded-[4px] border p-3 sm:rounded-none sm:border-0 sm:p-0" style={{ borderColor: BORDER }}>
                <div className="mb-2 flex items-center justify-between sm:hidden">
                  <span className="text-[12.5px] font-semibold" style={{ color: SUBTLE }}>Person {i + 1}</span>
                  <button type="button" onClick={() => remove(r.key)} aria-label={`Remove person ${i + 1}`}
                    className="grid size-8 cursor-pointer place-items-center rounded-[4px] transition-colors hover:bg-[#F2F4F7]" style={{ color: SUBTLE }}><X size={15} weight="light" /></button>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.25fr)_128px_36px]">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <input aria-label={`Name, person ${i + 1}`} value={r.name} onChange={e => set(r.key, { name: e.target.value })} onBlur={() => { if (r.name.trim() || r.phone.trim() || r.email.trim()) touch(r.key, 'name') }} placeholder="Full name"
                      className={inputCls} style={{ ...inputStyle, ...(nameErr ? { borderColor: '#FDA29B' } : {}) }} autoComplete="off" />
                    <FieldError>{nameErr}</FieldError>
                  </div>
                  <div className="min-w-0">
                    <input aria-label={`Mobile, person ${i + 1}`} type="tel" inputMode="tel" value={r.phone} onChange={e => set(r.key, { phone: e.target.value })} onBlur={() => touch(r.key, 'phone')} placeholder="98200 12345"
                      className={inputCls} style={{ ...inputStyle, ...(showErr('phone') ? { borderColor: '#FDA29B' } : {}) }} autoComplete="off" />
                    <FieldError>{showErr('phone')}</FieldError>
                  </div>
                  <div className="min-w-0 sm:order-none">
                    <Select value={r.role} onChange={v => set(r.key, { role: v as RoleId })} className="sm:hidden">
                      <option value="agent">Agent</option><option value="manager">Manager</option>
                    </Select>
                    <div className="hidden sm:block">
                      <input aria-label={`Email, person ${i + 1}`} type="email" value={r.email} onChange={e => set(r.key, { email: e.target.value })} onBlur={() => touch(r.key, 'email')} placeholder="name@company.com"
                        className={inputCls} style={{ ...inputStyle, ...(showErr('email') ? { borderColor: '#FDA29B' } : {}) }} autoComplete="off" />
                      <FieldError>{showErr('email')}</FieldError>
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 sm:hidden">
                    <input aria-label={`Email, person ${i + 1} (optional)`} type="email" value={r.email} onChange={e => set(r.key, { email: e.target.value })} onBlur={() => touch(r.key, 'email')} placeholder="Email (optional)"
                      className={inputCls} style={{ ...inputStyle, ...(showErr('email') ? { borderColor: '#FDA29B' } : {}) }} autoComplete="off" />
                    <FieldError>{showErr('email')}</FieldError>
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <Select value={r.role} onChange={v => set(r.key, { role: v as RoleId })}>
                      <option value="agent">Agent</option><option value="manager">Manager</option>
                    </Select>
                  </div>
                  <button type="button" onClick={() => remove(r.key)} aria-label={`Remove person ${i + 1}`} title="Remove"
                    className="hidden size-10 cursor-pointer place-items-center rounded-[4px] transition-colors hover:bg-[#F2F4F7] sm:grid" style={{ color: LABEL }}>
                    <Trash size={16} weight="light" />
                  </button>
                </div>
                {(c?.dupe || failed[r.key]) && (
                  <p className="m-0 mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: failed[r.key] ? TONE.red.color : TONE.amber.color }}>
                    <Warning size={13} weight="light" />{failed[r.key] ?? c?.dupe}
                  </p>
                )}
              </div>
            )
          })}

          <button type="button" onClick={addRow}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-dashed text-[14px] font-semibold transition-colors hover:bg-[#F9FAFB]"
            style={{ borderColor: BORDER_2, color: TEXT_2 }}>
            <Plus size={15} weight="light" />Add another person
          </button>

          {overBy > 0 && (
            <p className="m-0 flex items-start gap-1.5 text-[13px] font-medium leading-snug" style={{ color: TONE.amber.color }}>
              <Warning size={14} weight="light" className="mt-0.5 shrink-0" />
              That makes {SEATS + overBy} active people. The Team plan includes {SEATS}, so you may want to pause someone on the Team page.
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: '#F2F4F7' }}>
            <span className="text-[13px]" style={{ color: problems ? TONE.amber.color : SUBTLE }}>
              {problems ? `${problems} ${problems === 1 ? 'row needs' : 'rows need'} a fix before adding` : ready.length ? `${ready.length} ready to add` : 'Fill in a name to get started'}
            </span>
            <Btn variant="primary" onClick={addAll} disabled={saving || !ready.length}>
              <UserPlus size={16} weight="light" />{saving ? 'Adding…' : ready.length > 1 ? `Add ${ready.length} to the team` : 'Add to the team'}
            </Btn>
          </div>
        </div>
      )}
    </Panel>
  )
}

// ─── Step 2 · Say hello ───────────────────────────────────────────────────────
type Sent = Record<string, 'whatsapp' | 'email' | 'copied'>
const SENT_LABEL = { whatsapp: 'WhatsApp opened', email: 'Email opened', copied: 'Copied' }

function SayHello({ members, fresh, me, sent, onSent, notify }: {
  members: Member[]; fresh: string[]; me: Me | null; sent: Sent
  onSent: (id: string, how: Sent[string]) => void
  notify: (t: { text: string; tone: 'ok' | 'err' }) => void
}) {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [list, setList] = useState<'new' | 'all'>('new')
  const [picked, setPicked] = useState<string | null>(null)
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const ref = useRef<HTMLTextAreaElement>(null)

  const freshMembers = members.filter(m => fresh.includes(m.id))
  const view = list === 'new' && freshMembers.length ? 'new' : 'all'
  const people = view === 'new' ? freshMembers : members.filter(isActive)
  const sample = people.find(m => m.id === picked) ?? people[0] ?? { id: 'sample', name: 'Priya Sharma', phone: null, email: null, role: 'agent' }
  const body = fill(template, sample, me)
  const subject = fill(SUBJECT, sample, me)

  async function copy(m: Member) {
    try { await navigator.clipboard.writeText(fill(template, m, me)); onSent(m.id, 'copied'); notify({ text: `Message for ${m.name} copied`, tone: 'ok' }) }
    catch { notify({ text: 'Couldn\'t copy. Select the message and copy it instead.', tone: 'err' }) }
  }

  return (
    <Panel id="hello" step={2} title="Say hello"
      sub="Each person gets this from your own WhatsApp or email, so it reads like it came from you. Nothing is sent until you press send there.">
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
              <label htmlFor="inv-msg" className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Welcome message</label>
              {template !== DEFAULT_TEMPLATE && <button type="button" onClick={() => setTemplate(DEFAULT_TEMPLATE)} className="cursor-pointer text-[12.5px] font-semibold hover:underline" style={{ color: BLUE }}>Reset</button>}
            </div>
            <textarea id="inv-msg" ref={ref} rows={7} value={template} onChange={e => setTemplate(e.target.value)} className={textareaCls} style={inputStyle} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[12.5px] font-medium" style={{ color: SUBTLE }}>Insert</span>
              {TAGS.map(t => (
                <button key={t.tag} type="button" onClick={() => insertAtCursor(ref.current, t.tag, template, setTemplate)}
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[4px] border px-2 text-[12.5px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                  style={{ borderColor: BORDER_2, color: TEXT_2, background: CANVAS }}>
                  <span style={{ color: BLUE }}>+</span>{t.label}
                </button>
              ))}
            </div>
            {!me?.workspace && template.includes('{{workspace}}') && (
              <p className="m-0 mt-2 text-[12.5px]" style={{ color: SUBTLE }}>
                Your business name isn&apos;t set, so it reads &ldquo;the team&rdquo;. <Link href="/dashboard/settings#workspace" className="font-semibold no-underline hover:underline" style={{ color: BLUE }}>Add it in Settings</Link>
              </p>
            )}
          </div>

          {/* Live preview */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Preview for {sample.name.split(/\s+/)[0]}</span>
              <Seg label="Preview" value={channel} onChange={setChannel}
                options={[{ id: 'whatsapp', label: <><WhatsappLogo size={15} weight="fill" /><span className="sr-only">WhatsApp</span></> }, { id: 'email', label: <><Envelope size={15} weight="light" /><span className="sr-only">Email</span></> }]} />
            </div>
            {channel === 'whatsapp'
              ? <WaPhone contact={sample.name}><WaBubble text={body} time="now" /></WaPhone>
              : <EmailCard to={sample.email || 'their email'} subject={subject} body={body} />}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Send to</span>
            {freshMembers.length > 0 && (
              <Seg label="Who to show" value={view} onChange={setList}
                options={[{ id: 'new', label: 'Just added', count: freshMembers.length }, { id: 'all', label: 'Whole team', count: members.filter(isActive).length }]} />
            )}
          </div>
          {people.length === 0 ? (
            <div className="rounded-[4px] border border-dashed px-4 py-6 text-center text-[13.5px]" style={{ borderColor: BORDER_2, color: SUBTLE }}>
              Add someone in step 1 and they&apos;ll show up here, ready for a welcome.
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[4px] border p-0" style={{ borderColor: BORDER }}>
              {people.map(m => {
                const text = fill(template, m, me)
                const on = sample.id === m.id
                const s = sent[m.id]
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 last:border-b-0 sm:flex-nowrap"
                    style={{ borderColor: '#F2F4F7', background: on ? '#F8FAFF' : CANVAS }}>
                    <button type="button" onClick={() => setPicked(m.id)} aria-pressed={on} title="Preview their message"
                      className="flex min-w-0 flex-1 basis-[180px] cursor-pointer items-center gap-2.5 text-left">
                      <Avatar name={m.name} size={34} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[14px] font-semibold" style={{ color: TEXT }}>{m.name}</span>
                          <Pill tone={ROLE_TONE[m.role] ?? 'blue'} small>{roleLabel(m.role)}</Pill>
                          {s && <Pill tone="green" small><Check size={11} weight="light" />{SENT_LABEL[s]}</Pill>}
                        </span>
                        <span className="block truncate text-[12.5px] tabular-nums" style={{ color: SUBTLE }}>{[m.phone && formatPhone(m.phone), m.email].filter(Boolean).join(' · ') || 'No mobile or email yet'}</span>
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {phone10(m.phone)
                        ? <a href={waHref(m.phone, text)} target="_blank" rel="noopener noreferrer" onClick={() => onSent(m.id, 'whatsapp')} className={aBtn('wa')} style={aBtnStyle('wa')} aria-label={`WhatsApp ${m.name}`}><WhatsappLogo size={15} weight="fill" color={WA} />WhatsApp</a>
                        : <span className={aBtn()} style={{ ...aBtnStyle(), color: LABEL, cursor: 'not-allowed' }} title="No mobile number"><WhatsappLogo size={15} weight="fill" />WhatsApp</span>}
                      {m.email
                        ? <a href={mailHref(m.email, fill(SUBJECT, m, me), text)} onClick={() => onSent(m.id, 'email')} className={aBtn()} style={aBtnStyle()} aria-label={`Email ${m.name}`}><Envelope size={15} weight="light" /><span className="hidden sm:inline">Email</span></a>
                        : null}
                      <button type="button" onClick={() => copy(m)} className={aBtn()} style={aBtnStyle()} aria-label={`Copy message for ${m.name}`} title="Copy message"><Copy size={15} weight="light" /></button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  )
}

// ─── Step 3 · Give them leads ─────────────────────────────────────────────────
function GiveLeads() {
  return (
    <Panel id="leads" step={3} title="Give them leads"
      sub="New teammates start with an empty list. Share the leads that are waiting, and they show up on the leaderboard from day one.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/team" className="group flex min-w-0 items-start gap-3 rounded-[4px] border p-4 no-underline transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: BORDER, boxShadow: XS }}>
          <span className="grid size-9 shrink-0 place-items-center rounded-[4px]" style={{ background: BLUE_BG, color: BLUE }}><ArrowsSplit size={18} weight="light" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[14.5px] font-semibold" style={{ color: TEXT }}>Share waiting leads<ArrowRight size={14} weight="light" className="transition-transform group-hover:translate-x-0.5" /></span>
            <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: SUBTLE }}>On the Team page, Assign leads splits every unassigned lead between the people you pick.</span>
          </span>
        </Link>
        <Link href="/dashboard/tasks" className="group flex min-w-0 items-start gap-3 rounded-[4px] border p-4 no-underline transition-colors hover:bg-[#F9FAFB]" style={{ borderColor: BORDER, boxShadow: XS }}>
          <span className="grid size-9 shrink-0 place-items-center rounded-[4px]" style={{ background: '#ECFDF3', color: '#067647' }}><Sparkle size={18} weight="light" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[14.5px] font-semibold" style={{ color: TEXT }}>Give them a first task<ArrowRight size={14} weight="light" className="transition-transform group-hover:translate-x-0.5" /></span>
            <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: SUBTLE }}>Assign a call-back or a site visit on the Tasks page so their day starts with something to do.</span>
          </span>
        </Link>
      </div>
    </Panel>
  )
}

// ─── Locked views ─────────────────────────────────────────────────────────────
function SoloView() {
  const t = PLANS.team
  const PERKS = [
    { icon: <UsersThree size={16} weight="light" />, title: `Up to ${t.limits.agents} agents`, sub: 'Add your team here and send each a welcome.' },
    { icon: <ArrowsSplit size={16} weight="light" />, title: 'Share leads in one click', sub: 'Split waiting leads between the people you pick.' },
    { icon: <Crown size={16} weight="light" />, title: 'Leaderboard and team reports', sub: 'Who is closing, who is stretched, and what each person did.' },
    { icon: <ShieldCheck size={16} weight="light" />, title: 'Roles for your team', sub: 'Mark each person as an agent or a manager.' },
  ]
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section className="overflow-hidden rounded-[4px] border" style={{ borderColor: BORDER, boxShadow: XS }}>
          <div className="relative px-5 pb-6 pt-7 sm:px-8 sm:pt-9" style={{ background: 'linear-gradient(160deg, #EFF4FF 0%, #FFFFFF 70%)' }}>
            <div className="flex -space-x-1.5" aria-hidden>
              {['Priya Sharma', 'Rohan Mehta', 'Sneha Iyer', 'Arjun Nair'].map(n => <span key={n} className="rounded-full" style={{ boxShadow: '0 0 0 3px #fff' }}><Avatar name={n} size={44} /></span>)}
              <span className="grid size-11 place-items-center rounded-full border-2 border-dashed bg-white" style={{ borderColor: BLUE_LN, color: BLUE }}><Plus size={18} weight="light" /></span>
            </div>
            <h2 className="m-0 mt-5 text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]" style={{ color: TEXT }}>Bring your team onto LeadGap</h2>
            <p className="m-0 mt-2 max-w-[560px] text-[15px] leading-relaxed" style={{ color: MUTED }}>
              You&apos;re on a single-user workspace. Inviting people is part of the Team plan, where you add agents, share leads between them and see how each one is doing.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link href="/dashboard/settings/billing" className={primaryLinkCls} style={primaryLinkStyle}>See the Team plan<ArrowRight size={16} weight="light" /></Link>
              <span className="text-[14px]" style={{ color: SUBTLE }}><b style={{ color: TEXT }}>{t.priceLabel}</b> {t.period}</span>
            </div>
          </div>
          <ul className="m-0 grid list-none gap-px border-t p-0 sm:grid-cols-2" style={{ borderColor: BORDER, background: BORDER }}>
            {PERKS.map(p => (
              <li key={p.title} className="flex items-start gap-3 bg-white px-5 py-4 sm:px-8">
                <span className="grid size-8 shrink-0 place-items-center rounded-[4px] border" style={{ borderColor: BORDER, color: BLUE, boxShadow: XS }}>{p.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold" style={{ color: TEXT }}>{p.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: SUBTLE }}>{p.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <div className="flex flex-col gap-5">
          <RolesCard tableLink={false} />
          <LoginCard />
        </div>
      </div>
    </div>
  )
}

function AgentView() {
  return (
    <div className="mx-auto max-w-[720px] px-4 pb-24 lg:px-8">
      <EmptyState icon={<Lock size={22} weight="light" />} title="Only admins can invite people"
        actions={<Link href="/dashboard/today" className={linkCls} style={linkStyle}>Back to Today</Link>}>
        Your admin adds people to the team and decides who gets which leads. If someone is missing, ask your admin to add them.
      </EmptyState>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8" aria-busy>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">{[260, 320].map(h => <div key={h} className="animate-pulse rounded-[4px]" style={{ height: h, background: '#F2F4F7' }} />)}</div>
        <div className="flex flex-col gap-5">{[220, 260].map(h => <div key={h} className="animate-pulse rounded-[4px]" style={{ height: h, background: '#F2F4F7' }} />)}</div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InviteTeamPage() {
  const access = useAccess()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [fresh, setFresh] = useState<string[]>([])
  const [sent, setSent] = useState<Sent>({})
  const [rows, setRows] = useState<Draft[]>([blankDraft(1), blankDraft(2)])
  const { toast, show, hide } = useToast()

  const load = useCallback(() => fetchMembers().then(m => { setMembers(m); setLoadError(null) }).catch(e => { setMembers([]); setLoadError(errText(e)) }), [])
  useEffect(() => { if (access === 'admin') load() }, [access, load])
  useEffect(() => { fetchMe().then(setMe).catch(() => {}) }, [])

  const onAdded = useCallback((added: Member[]) => {
    setMembers(ms => [...(ms ?? []), ...added])
    setFresh(f => [...f, ...added.map(m => m.id)])
    requestAnimationFrame(() => document.getElementById('hello')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [])
  const onSent = useCallback((id: string, how: Sent[string]) => setSent(s => ({ ...s, [id]: how })), [])

  const active = (members ?? []).filter(isActive)
  const checks = useMemo(() => checkRows(rows, members ?? []), [rows, members])
  const adding = rows.filter(r => checks.get(r.key)?.ready).length

  return (
    <div className="min-h-screen" style={{ background: CANVAS }}>
      <PageHeader title="Invite your team" backHref="/dashboard/team" backLabel="Back to team"
        badge={access === 'admin' && members && <Badge tone={active.length > SEATS ? 'amber' : 'blue'}><UsersThree size={14} weight="light" />{active.length} of {SEATS} seats</Badge>}
        sub={access === 'solo'
          ? 'Work with agents? Add them on the Team plan and share your leads between them.'
          : access === 'agent'
            ? 'Your admin manages who is on the team.'
            : 'Add the people who work your leads, welcome them on WhatsApp, then hand over their first leads.'}
        actions={access === 'admin' ? <Link href="/dashboard/team" className={linkCls} style={linkStyle}><UsersThree size={16} weight="light" />Team page</Link> : undefined} />

      {access === null ? <Skeleton />
        : access === 'solo' ? <SoloView />
        : access === 'agent' ? <AgentView />
        : !members ? <Skeleton />
        : (
          <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
            <div className="mb-5"><Steps added={fresh.length} greeted={Object.keys(sent).length} /></div>
            {loadError && (
              <div className="mb-5"><Insight tone="red" icon={<Warning size={15} weight="light" />} title="Couldn't load your team">
                {loadError}. You can still add people; duplicates won&apos;t be caught until the list loads. <button type="button" onClick={load} className="cursor-pointer font-semibold underline" style={{ color: TONE.red.color }}>Try again</button>
              </Insight></div>
            )}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex min-w-0 flex-col gap-5">
                <AddPeople rows={rows} setRows={setRows} checks={checks} overBy={adding > 0 ? active.length + adding - SEATS : 0} onAdded={onAdded} notify={show} />
                <SayHello members={members} fresh={fresh} me={me} sent={sent} onSent={onSent} notify={show} />
                <GiveLeads />
              </div>
              <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[72px]">
                <Seats members={members} adding={adding} />
                <RolesCard />
                <LoginCard />
                <Insight tone="neutral" icon={<Info size={15} weight="light" />} title="Someone leaving?">
                  Pause them on the Team page. Their leads stay with them, and they&apos;re left out when you share new leads.
                </Insight>
              </aside>
            </div>
          </div>
        )}
      <Toast toast={toast} onClose={hide} />
    </div>
  )
}
