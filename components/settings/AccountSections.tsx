'use client'

// Settings → Your account: Profile, Notifications and Security. Everyone edits their own.

import { useState } from 'react'
import {
  UserCircle, EnvelopeSimple, Camera, Bell, DeviceMobile, Key, SignOut, ShieldCheck, ClockCounterClockwise,
  CheckCircle, Info,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import {
  Avatar, Btn, Dialog, Field, Insight, Panel, Pill, Select, Toggle, inputCls, inputStyle, phone10,
  BORDER, TEXT, SUBTLE, LABEL, RED,
} from '@/components/outreach/OutreachKit'
import {
  ACCESS_LABEL, Row, SaveBar, Soon, ValueBox, dateText, dateTimeText, displayNameOf, errText, metaText,
  type SectionProps,
} from './SettingsKit'

// ─── Profile ──────────────────────────────────────────────────────────────────
type ProfileForm = { full_name: string; phone: string; designation: string }
const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Telugu', 'Tamil']

export function ProfileSection({ access, meApi, notify }: SectionProps) {
  const { me, save } = meApi
  const saved: ProfileForm = {
    full_name: metaText(me, 'full_name') || metaText(me, 'name'),
    phone: (p => (p ? `${p.slice(0, 5)} ${p.slice(5)}` : metaText(me, 'phone')))(phone10(metaText(me, 'phone'))),
    designation: metaText(me, 'designation'),
  }
  const [draft, setDraft] = useState<Partial<ProfileForm>>({})
  const [saving, setSaving] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const val = (k: keyof ProfileForm) => draft[k] ?? saved[k]
  const set = (k: keyof ProfileForm) => (v: string) => setDraft(d => ({ ...d, [k]: v }))
  const dirty = (Object.keys(draft) as (keyof ProfileForm)[]).some(k => (draft[k] ?? '').trim() !== saved[k])

  const phoneTyped = val('phone').trim()
  const phoneBad = phoneTyped !== '' && !phone10(phoneTyped)
  const nameBad = val('full_name').trim() === ''

  async function onSave() {
    if (nameBad) { notify({ text: 'Add your name before saving', tone: 'err' }); return }
    if (phoneBad) { notify({ text: 'Enter a 10-digit Indian mobile number', tone: 'err' }); return }
    setSaving(true)
    try {
      const name = val('full_name').trim()
      const patch: Record<string, unknown> = { full_name: name, phone: phoneTyped ? phone10(phoneTyped) : '', designation: val('designation').trim() }
      // Today, the Dashboard and the Advisor read first_name before full_name, so keep them in step
      if (metaText(me, 'first_name')) patch.first_name = name.split(/\s+/)[0]
      await save(patch)
      setDraft({})
      notify({ text: 'Profile saved', tone: 'ok' })
    } catch (e) { notify({ text: errText(e), tone: 'err' }) }
    finally { setSaving(false) }
  }

  const name = displayNameOf(me) || 'You'
  return (
    <div className="flex flex-col gap-5">
      {/* Who you are, at a glance */}
      <div className="relative overflow-hidden rounded-[16px] border bg-white" style={{ borderColor: BORDER }}>
        <div className="h-20 sm:h-24" style={{ background: 'linear-gradient(120deg, #EFF4FF 0%, #D1E0FF 55%, #B2CCFF 100%)' }} />
        <div className="flex flex-wrap items-end gap-4 px-4 pb-5 sm:px-6">
          <div className="-mt-10 rounded-full bg-white p-1"><Avatar name={name} size={76} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 truncate text-[20px] font-semibold tracking-[-0.01em]" style={{ color: TEXT }}>{me === undefined ? 'Loading…' : name}</h3>
              <Pill tone={access === 'agent' ? 'neutral' : 'blue'} small>{ACCESS_LABEL[access].long}</Pill>
            </div>
            <p className="m-0 mt-0.5 truncate text-[14px]" style={{ color: SUBTLE }}>
              {[val('designation').trim(), me?.email].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn size="sm" disabled title="Not available yet"><Camera size={15} weight="bold" />Upload photo</Btn>
            <Soon />
          </div>
        </div>
      </div>

      <Panel icon={<UserCircle size={18} weight="bold" />} title="Your details" sub="Your name greets you on Today, the Dashboard and the AI Advisor, and goes on the reports you share.">
        <Row label="Full name" htmlFor="pf-name">
          <input id="pf-name" className={inputCls} style={{ ...inputStyle, borderColor: nameBad && draft.full_name != null ? RED : inputStyle.borderColor }}
            value={val('full_name')} onChange={e => set('full_name')(e.target.value)} placeholder="Your name" autoComplete="name" />
        </Row>
        <Row label="Mobile number" hint="Your own number, for your team and your clients" htmlFor="pf-phone">
          <input id="pf-phone" className={inputCls} style={{ ...inputStyle, borderColor: phoneBad ? RED : inputStyle.borderColor }} inputMode="tel"
            value={val('phone')} onChange={e => set('phone')(e.target.value)} placeholder="98200 00000" autoComplete="tel" />
          {phoneBad && <p className="m-0 mt-1.5 text-[12.5px] font-medium" style={{ color: '#B42318' }}>Enter a 10-digit Indian mobile number</p>}
        </Row>
        <Row label="Designation" hint="For example Senior Broker or Channel Partner" htmlFor="pf-role">
          <input id="pf-role" className={inputCls} style={inputStyle} value={val('designation')} onChange={e => set('designation')(e.target.value)} placeholder="Senior Agent" />
        </Row>
        <Row label="Email address" hint="You sign in with this">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1"><ValueBox>{me?.email || '—'}</ValueBox></div>
            <Btn onClick={() => setEmailOpen(true)} disabled={!me}><EnvelopeSimple size={16} weight="bold" />Change</Btn>
          </div>
        </Row>
        <Row label={<span className="inline-flex items-center gap-2">Language <Soon>More coming</Soon></span>} hint="LeadGap is in English for now" htmlFor="pf-lang">
          <Select id="pf-lang" value="English" onChange={() => {}}>
            {LANGUAGES.map(l => <option key={l} value={l} disabled={l !== 'English'}>{l === 'English' ? l : `${l} (not available yet)`}</option>)}
          </Select>
        </Row>
      </Panel>

      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={() => setDraft({})} />
      <ChangeEmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} current={me?.email ?? ''} notify={notify} />
    </div>
  )
}

function ChangeEmailDialog({ open, onClose, current, notify }: { open: boolean; onClose: () => void; current: string; notify: SectionProps['notify'] }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().toLowerCase() !== current.toLowerCase()
  async function send() {
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() })
      if (error) throw new Error(error.message)
      notify({ text: `Confirmation sent to ${email.trim()}. The change happens once you open the link.`, tone: 'ok' })
      setEmail(''); onClose()
    } catch (e) { notify({ text: errText(e), tone: 'err' }) }
    finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Change your email" sub="You'll sign in with the new address once you confirm it." icon={<EnvelopeSimple size={20} weight="bold" />}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={send} disabled={!ok || busy}>{busy ? 'Sending…' : 'Send confirmation'}</Btn></>}>
      <div className="flex flex-col gap-4">
        <Field label="Current email"><ValueBox>{current}</ValueBox></Field>
        <Field label="New email" htmlFor="ce-new" hint="We'll email a link to confirm it. Until then you keep signing in with the current one.">
          <input id="ce-new" type="email" className={inputCls} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
        </Field>
      </div>
    </Dialog>
  )
}

// ─── Notifications ────────────────────────────────────────────────────────────
type Note = { label: string; hint: string; app: 'on' | 'soon'; teams?: boolean }
const NOTES: Note[] = [
  { label: 'Follow-up reminders',          hint: 'When a follow-up you scheduled comes due, in the bell at the top',      app: 'on' },
  { label: 'Morning digest',               hint: 'New leads and today\'s follow-ups, every day at 8:00 am',                app: 'on' },
  { label: 'New lead arrived',             hint: 'An alert the moment a lead comes in from any portal',                    app: 'soon' },
  { label: 'Lead not followed up in 24h',  hint: 'A nudge if a fresh lead has no call or message logged',                  app: 'soon' },
  { label: 'Lead changed stage',           hint: 'When a lead moves to Warm, Hot or Closed',                               app: 'soon' },
  { label: 'Weekly performance report',    hint: 'Your report for the week, every Monday morning',                         app: 'soon' },
  { label: 'Team member added a note',     hint: 'Activity on a lead assigned to you',                                     app: 'soon', teams: true },
  { label: 'Deal won',                     hint: 'Tell the team when someone closes a deal',                               app: 'soon', teams: true },
]

export function NotificationsSection({ access }: SectionProps) {
  const rows = NOTES.filter(n => !n.teams || access !== 'solo')
  const live = rows.filter(n => n.app === 'on')
  const later = rows.filter(n => n.app === 'soon')
  return (
    <div className="flex flex-col gap-5">
      <Panel icon={<Bell size={18} weight="bold" />} title="Working now" sub="These show in the bell at the top of every page.">
        <NoteTable rows={live} />
      </Panel>
      <Panel icon={<ClockCounterClockwise size={18} weight="bold" />} title="Not available yet" sub="Planned alerts. They can't be switched on until LeadGap sends them.">
        <NoteTable rows={later} />
      </Panel>
      <Insight tone="neutral" icon={<Info size={15} weight="bold" />} title="Email alerts aren't sent yet">
        Everything above arrives in the app only. Email copies will appear here when LeadGap can send them.
      </Insight>
    </div>
  )
}

function NoteTable({ rows }: { rows: Note[] }) {
  return (
    <div className="-mx-4 sm:-mx-5">
      <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center border-b px-4 pb-2 text-[12px] font-semibold uppercase tracking-[0.04em] sm:grid-cols-[minmax(0,1fr)_96px_96px] sm:px-5" style={{ borderColor: '#F2F4F7', color: LABEL }}>
        <span>Alert</span><span className="text-center">In app</span><span className="text-center">Email</span>
      </div>
      {rows.map(n => (
        <div key={n.label} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-y-1 border-b px-4 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_96px_96px] sm:px-5" style={{ borderColor: '#F2F4F7' }}>
          <div className="min-w-0 pr-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{n.label}</span>
              {n.teams && <Pill tone="violet" small>Teams</Pill>}
            </div>
            <p className="m-0 mt-0.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>{n.hint}</p>
          </div>
          <div className="flex justify-center">
            {n.app === 'on'
              ? <span title="Always on" className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: '#067647' }}><CheckCircle size={18} weight="fill" /><span className="hidden sm:inline">On</span></span>
              : <Toggle on={false} onChange={() => {}} label={`${n.label} in app: not available yet`} disabled />}
          </div>
          <div className="flex justify-center"><Toggle on={false} onChange={() => {}} label={`${n.label} by email: not available yet`} disabled /></div>
        </div>
      ))}
    </div>
  )
}

// ─── Security ─────────────────────────────────────────────────────────────────
export function SecuritySection({ meApi, notify }: SectionProps) {
  const { me } = meApi
  const [pwOpen, setPwOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  async function signOutOthers() {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) throw new Error(error.message)
      notify({ text: 'Signed out of every other device', tone: 'ok' })
    } catch (e) { notify({ text: errText(e), tone: 'err' }) }
    finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-5">
      <Panel icon={<Key size={18} weight="bold" />} title="Sign-in">
        <Row label="Password" hint="At least 8 characters. You stay signed in on this device.">
          <Btn onClick={() => setPwOpen(true)} disabled={!me}><Key size={16} weight="bold" />Change password</Btn>
        </Row>
        <Row label="Last sign-in" hint="On any device">
          <ValueBox>{me ? dateTimeText(me.lastSignIn) : 'Loading…'}</ValueBox>
        </Row>
        <Row label="Account created">
          <ValueBox>{me ? dateText(me.createdAt) : 'Loading…'}</ValueBox>
        </Row>
      </Panel>

      <Panel icon={<DeviceMobile size={18} weight="bold" />} title="Devices">
        <Row label="Sign out everywhere else" hint="Lost a phone, or signed in on a shared computer? This ends every session except this one.">
          <Btn onClick={signOutOthers} disabled={busy || !me}><SignOut size={16} weight="bold" />{busy ? 'Signing out…' : 'Sign out other devices'}</Btn>
        </Row>
        <Row label={<span className="inline-flex items-center gap-2">Signed-in devices <Soon /></span>} hint="A list of each device and where it signed in from">
          <Btn disabled>View devices</Btn>
        </Row>
      </Panel>

      <Panel icon={<ShieldCheck size={18} weight="bold" />} title="Extra protection">
        <Row label={<span className="inline-flex items-center gap-2">Two-step sign-in <Soon /></span>} hint="A one-time code on your phone as well as your password">
          <div className="flex items-center gap-2.5"><Toggle on={false} onChange={() => {}} label="Two-step sign-in: not available yet" disabled /><span className="text-[13px]" style={{ color: LABEL }}>Off</span></div>
        </Row>
        <Row label={<span className="inline-flex items-center gap-2">Sign-in history <Soon /></span>} hint="Every recent sign-in to your account">
          <Btn disabled>View history</Btn>
        </Row>
      </Panel>

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} notify={notify} />
    </div>
  )
}

function ChangePasswordDialog({ open, onClose, notify }: { open: boolean; onClose: () => void; notify: SectionProps['notify'] }) {
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const short = pw.length > 0 && pw.length < 8
  const mismatch = again.length > 0 && again !== pw
  const ok = pw.length >= 8 && again === pw
  async function submit() {
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw new Error(error.message)
      notify({ text: 'Password changed', tone: 'ok' })
      setPw(''); setAgain(''); onClose()
    } catch (e) { notify({ text: errText(e), tone: 'err' }) }
    finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Change password" icon={<Key size={20} weight="bold" />}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={submit} disabled={!ok || busy}>{busy ? 'Saving…' : 'Change password'}</Btn></>}>
      <div className="flex flex-col gap-4">
        <Field label="New password" htmlFor="pw-new" hint={short ? <span style={{ color: '#B42318' }}>Use at least 8 characters</span> : 'At least 8 characters'}>
          <input id="pw-new" type="password" className={inputCls} style={inputStyle} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Type it again" htmlFor="pw-again" hint={mismatch ? <span style={{ color: '#B42318' }}>The two don&apos;t match</span> : undefined}>
          <input id="pw-again" type="password" className={inputCls} style={inputStyle} value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
    </Dialog>
  )
}
