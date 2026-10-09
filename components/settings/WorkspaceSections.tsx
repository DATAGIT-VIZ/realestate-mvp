'use client'

// Settings → Workspace: Business details, Lead management, Calling & WhatsApp, Automations, AI preferences and
// Branding & reports. Business details and AI preferences belong to the owner (Solo) or the admins (Teams);
// agents can read them. Lead management, Calling and Automations describe how LeadGap works, for everyone.

import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Buildings, Info, Stack, ArrowRight, PhoneCall, WhatsappLogo, EnvelopeSimple, Lightning, Sparkle, PaintBrush,
  ChartBar, Pause, Prohibit, CheckCircle, Clock, Robot, TrendUp, CheckSquare, ArrowSquareOut, LockSimple, Key,
  Sliders, Broadcast,
} from '@phosphor-icons/react'
import {
  Btn, Insight, Panel, Pill, Select, StagePill, Toggle, inputCls, inputStyle,
  BORDER, SURFACE, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, WA, XS, type StageId,
} from '@/components/outreach/OutreachKit'
import {
  Choice, Row, SaveBar, Soon, StatusDot, ValueBox, errText, linkBtnCls, linkBtnStyle, metaObj, metaText,
  type SectionProps,
} from './SettingsKit'

/** Shown above a shared section when an agent opens it */
export function ViewOnlyNote({ what }: { what: string }) {
  return (
    <Insight tone="neutral" icon={<LockSimple size={15} weight="bold" />} title="Your admin manages this">
      You can see {what} here, but only an admin can change it. Ask your admin if something needs updating.
    </Insight>
  )
}

const soonLabel = (label: string) => <span className="inline-flex flex-wrap items-center gap-2">{label} <Soon /></span>

// ─── Business details ─────────────────────────────────────────────────────────
type Biz = { name: string; rera: string; address: string; city: string; hours: string; fyStart: string }
const CITIES = ['Mumbai', 'Pune', 'Bengaluru', 'Hyderabad', 'Chennai', 'Delhi NCR', 'Ahmedabad', 'Kolkata']
const HOURS = ['9 am – 7 pm, Mon–Sat', '9 am – 6 pm, Mon–Fri', '10 am – 8 pm, all days', 'All hours']
const FY = ['April (Indian financial year)', 'January', 'October']

export function BusinessSection({ mode, meApi, notify }: SectionProps) {
  const { me, save } = meApi
  const ws = metaObj(me, 'workspace')
  const s = (k: string) => (typeof ws[k] === 'string' ? (ws[k] as string) : '')
  const saved: Biz = { name: metaText(me, 'workspace_name'), rera: s('rera'), address: s('address'), city: s('city'), hours: s('hours'), fyStart: s('fyStart') }
  const [draft, setDraft] = useState<Partial<Biz>>({})
  const [saving, setSaving] = useState(false)
  const v = (k: keyof Biz) => draft[k] ?? saved[k]
  const set = (k: keyof Biz) => (x: string) => setDraft(d => ({ ...d, [k]: x }))
  const dirty = (Object.keys(draft) as (keyof Biz)[]).some(k => (draft[k] ?? '').trim() !== saved[k])
  const ro = mode !== 'edit'

  async function onSave() {
    setSaving(true)
    try {
      await save({
        workspace_name: v('name').trim(),
        workspace: { ...ws, rera: v('rera').trim(), address: v('address').trim(), city: v('city').trim(), hours: v('hours'), fyStart: v('fyStart') },
      })
      setDraft({})
      notify({ text: 'Business details saved', tone: 'ok' })
    } catch (e) { notify({ text: errText(e), tone: 'err' }) }
    finally { setSaving(false) }
  }

  const text = (k: keyof Biz, id: string, placeholder: string, extra?: { list?: string; mono?: boolean }) => ro
    ? <ValueBox muted={!v(k)}>{v(k) || 'Not added'}</ValueBox>
    : <input id={id} list={extra?.list} className={inputCls} style={{ ...inputStyle, fontVariantNumeric: extra?.mono ? 'tabular-nums' : undefined }}
        value={v(k)} onChange={e => set(k)(e.target.value)} placeholder={placeholder} />
  const pick = (k: keyof Biz, id: string, options: string[], none: string) => ro
    ? <ValueBox muted={!v(k)}>{v(k) || 'Not set'}</ValueBox>
    : <Select id={id} value={v(k)} onChange={set(k)}><option value="">{none}</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</Select>

  return (
    <div className="flex flex-col gap-5">
      {ro && <ViewOnlyNote what="your company's details" />}
      <Panel icon={<Buildings size={18} weight="bold" />} title="Company" sub="Who you are to your clients.">
        <Row label="Company or agency name" htmlFor="bz-name">{text('name', 'bz-name', 'Your Agency Pvt Ltd')}</Row>
        <Row label="RERA number" hint="Your registration with the state RERA" htmlFor="bz-rera">{text('rera', 'bz-rera', 'MAHARERA/A00000000', { mono: true })}</Row>
        <Row label="Office address" htmlFor="bz-addr">{text('address', 'bz-addr', 'Office address')}</Row>
      </Panel>
      <Panel icon={<Clock size={18} weight="bold" />} title="Market and hours" sub="Where you sell and when you work.">
        <Row label="City or market" hint="Your main market" htmlFor="bz-city">
          {text('city', 'bz-city', 'Mumbai', { list: 'bz-cities' })}
          <datalist id="bz-cities">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
        </Row>
        <Row label="Business hours" htmlFor="bz-hours">{pick('hours', 'bz-hours', HOURS, 'Choose hours')}</Row>
        <Row label="Financial year starts in" hint="For yearly reports" htmlFor="bz-fy">{pick('fyStart', 'bz-fy', FY, 'Choose a month')}</Row>
      </Panel>
      {!ro && (
        <Insight tone="neutral" icon={<Info size={15} weight="bold" />} title="Saved to your account">
          Reports and client messages don&apos;t print these yet. Branding &amp; reports will use them once it&apos;s available.
        </Insight>
      )}
      {!ro && <SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={() => setDraft({})} />}
    </div>
  )
}

// ─── Lead management ──────────────────────────────────────────────────────────
const FLOW: { stage: StageId; when: string }[] = [
  { stage: 'New',    when: 'Arrives from a portal, a CSV import or is added by hand' },
  { stage: 'Cold',   when: 'First contact: a call that isn\'t "No response", a missed call, or a WhatsApp or email either way' },
  { stage: 'Warm',   when: 'A virtual meeting, office meeting or site visit is done' },
  { stage: 'Hot',    when: 'An EOI is received' },
  { stage: 'Closed', when: 'The deal is closed' },
]

export function LeadRulesSection() {
  return (
    <div className="flex flex-col gap-5">
      <Panel icon={<Stack size={18} weight="bold" />} title="How a lead moves" sub="LeadGap moves each lead for you from the activity you log. Stages only move forward.">
        <ol className="m-0 grid list-none gap-2.5 p-0 lg:grid-cols-5 lg:gap-0">
          {FLOW.map((f, i) => (
            <li key={f.stage} className="relative flex gap-3 lg:flex-col lg:gap-2.5 lg:pr-3">
              <div className="flex flex-col items-center lg:flex-row">
                <span className="grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold text-white" style={{ background: BLUE, boxShadow: `0 0 0 4px ${BLUE_BG}` }}>{i + 1}</span>
                {i < FLOW.length - 1 && <span className="my-1 w-px flex-1 lg:mx-2 lg:my-0 lg:h-px lg:w-auto" style={{ background: '#D0D5DD' }} />}
              </div>
              <div className="min-w-0 pb-2 lg:pb-0">
                <StagePill stage={f.stage} />
                <p className="m-0 mt-1.5 text-[13px] leading-snug" style={{ color: TEXT_2 }}>{f.when}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <RuleCard icon={<Pause size={16} weight="bold" />} stage="Hold" title="On hold">
            You put a lead on hold with a reason and a date up to 90 days away. It keeps its stage for when it comes back.
          </RuleCard>
          <RuleCard icon={<Prohibit size={16} weight="bold" />} stage="Disqualified" title="Disqualified">
            After 5 &quot;No response&quot; calls in a row. A call that gets through or a WhatsApp reply starts the count again.
          </RuleCard>
        </div>
        <p className="m-0 mt-4 text-[13px] leading-snug" style={{ color: SUBTLE }}>
          Closed and Disqualified are final. You can still change a stage by hand from the lead page, with a reason.
        </p>
      </Panel>

      <Panel icon={<Clock size={18} weight="bold" />} title="Gone quiet" sub="On Today, a lead joins the &quot;gone quiet&quot; list when nothing has been logged on it for:">
        <div className="grid grid-cols-3 gap-2.5">
          {([['Hot', 1], ['Warm', 2], ['Cold', 4]] as [StageId, number][]).map(([s, d]) => (
            <div key={s} className="rounded-[12px] border p-3" style={{ borderColor: BORDER, background: SURFACE }}>
              <StagePill stage={s} small />
              <div className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums" style={{ color: TEXT }}>{d}<span className="ml-1 text-[13px] font-medium tracking-normal" style={{ color: SUBTLE }}>{d === 1 ? 'day' : 'days'}</span></div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel icon={<Sliders size={18} weight="bold" />} title="Your own rules" right={<Soon />} sub="Ways to tune the pipeline that LeadGap can't do yet.">
        <Row label="Custom stages" hint="Rename, add or reorder stages"><Btn disabled>Edit stages</Btn></Row>
        {[
          ['Budget match', 'How closely the budget fits your listings'],
          ['Response speed', 'How fast the lead replies to calls and messages'],
          ['Portal quality', 'Extra weight for high-intent portals'],
          ['Activity recency', 'A boost for recently active leads'],
        ].map(([l, h]) => (
          <Row key={l} label={`Score weight: ${l}`} hint={h}>
            <Select value="Medium" onChange={() => {}} className="pointer-events-none opacity-60"><option>Medium</option></Select>
          </Row>
        ))}
        <Row label="Mark a lead stale after" hint="No activity in this window">
          <Select value="7 days" onChange={() => {}} className="pointer-events-none opacity-60"><option>7 days</option></Select>
        </Row>
        <Row label="Archive lost leads after" hint="Disqualified leads move to an archive">
          <Select value="Never" onChange={() => {}} className="pointer-events-none opacity-60"><option>Never</option></Select>
        </Row>
      </Panel>
    </div>
  )
}

function RuleCard({ icon, stage, title, children }: { icon: ReactNode; stage: StageId; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[12px] border p-3.5" style={{ borderColor: BORDER, background: SURFACE }}>
      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] border bg-white" style={{ borderColor: BORDER, color: TEXT_2, boxShadow: XS }}>{icon}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-semibold" style={{ color: TEXT }}>{title}</span><StagePill stage={stage} small /></div>
        <p className="m-0 mt-1 text-[13px] leading-snug" style={{ color: TEXT_2 }}>{children}</p>
      </div>
    </div>
  )
}

// ─── Calling & WhatsApp ───────────────────────────────────────────────────────
export function ChannelsSection({ overview }: SectionProps) {
  const sv = overview.data?.services
  const state = (k: 'calling' | 'whatsapp' | 'email') => (overview.error ? false : sv ? sv[k] : null)
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        <ChannelCard icon={<PhoneCall size={20} weight="fill" />} tint="#079455" name="Calling" by="Exotel" on={state('calling')}
          does="Click-to-call from lead pages and the Power Dialer, with the call logged on the lead." />
        <ChannelCard icon={<WhatsappLogo size={20} weight="fill" />} tint={WA} name="WhatsApp" by="Interakt" on={state('whatsapp')}
          does="Broadcasts and WhatsApp steps in Sequences. Replies come back onto the lead." />
        <ChannelCard icon={<EnvelopeSimple size={20} weight="fill" />} tint={BLUE} name="Email" by="Resend" on={state('email')}
          does="Email steps in Sequences." />
      </div>
      {overview.error && <p className="m-0 text-[13px]" style={{ color: '#B42318' }}>Couldn&apos;t check connections: {overview.error}</p>}
      <Insight tone="neutral" icon={<Info size={15} weight="bold" />} title="Connected for your whole workspace">
        LeadGap sets these up on its server, so there are no keys to paste here. If one shows &quot;Not set up&quot;, that channel can&apos;t send yet.
      </Insight>

      <Panel icon={<Broadcast size={18} weight="bold" />} title="Messages you send" sub="Write and send WhatsApp messages from Outreach.">
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/outreach/broadcast" className={linkBtnCls()} style={linkBtnStyle}>Broadcast<ArrowRight size={15} weight="bold" /></Link>
          <Link href="/dashboard/outreach/sequences" className={linkBtnCls()} style={linkBtnStyle}>Sequences<ArrowRight size={15} weight="bold" /></Link>
        </div>
        <div className="mt-4 border-t pt-3" style={{ borderColor: '#F2F4F7' }}>
          <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold" style={{ color: TEXT_2 }}>Saved templates <Soon /></div>
          {['New lead greeting', 'Follow-up reminder', 'Site visit confirmation', 'Deal won thank you'].map(t => (
            <div key={t} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: '#F2F4F7' }}>
              <span className="text-[14px]" style={{ color: TEXT }}>{t}</span><Btn size="sm" disabled>Edit</Btn>
            </div>
          ))}
        </div>
      </Panel>

      <Panel icon={<Key size={18} weight="bold" />} title="Use your own accounts" right={<Soon />} sub="Bring your own Exotel number or WhatsApp Business number instead of LeadGap's.">
        {['Exotel SID', 'Exotel API key', 'Exotel API token', 'Caller number shown to leads', 'Interakt API key', 'WhatsApp Business number'].map(l => (
          <Row key={l} label={l}><ValueBox muted>Not available yet</ValueBox></Row>
        ))}
      </Panel>
    </div>
  )
}

function ChannelCard({ icon, tint, name, by, on, does }: { icon: ReactNode; tint: string; name: string; by: string; on: boolean | null; does: string }) {
  return (
    <div className="flex flex-col rounded-[16px] border bg-white p-4" style={{ borderColor: BORDER, boxShadow: XS }}>
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-10 place-items-center rounded-[11px] text-white" style={{ background: tint }}>{icon}</span>
        <StatusDot on={on} />
      </div>
      <div className="mt-3 text-[16px] font-semibold" style={{ color: TEXT }}>{name}</div>
      <div className="text-[12.5px]" style={{ color: LABEL }}>through {by}</div>
      <p className="m-0 mt-2 text-[13px] leading-snug" style={{ color: TEXT_2 }}>{does}</p>
    </div>
  )
}

// ─── Automations ──────────────────────────────────────────────────────────────
const RUNNING: { title: string; when: string; does: string }[] = [
  { title: 'Stage updates',          when: 'As you log',      does: 'Each call, message, meeting or visit you log moves the lead to the right stage.' },
  { title: 'No-response rule',       when: 'As you log',      does: 'A lead is disqualified after 5 "No response" calls in a row.' },
  { title: 'Sequence steps',         when: 'Every 2 hours',   does: 'Active sequences send their next WhatsApp or email step.' },
  { title: 'Morning digest',         when: 'Daily, 8:00 am',  does: 'New leads and today\'s follow-ups, in the bell.' },
  { title: 'Follow-up reminders',    when: 'Daily, 2:30 pm',  does: 'Follow-ups that came due are flagged in the bell.' },
]
const PLANNED: { title: string; does: string; teams?: boolean }[] = [
  { title: 'Auto-assign new leads',                 does: 'Round-robin across active agents when a lead arrives', teams: true },
  { title: 'WhatsApp greeting on a new lead',       does: 'Send a template the moment a lead is created' },
  { title: 'Reminder after 24 hours of silence',    does: 'Alert the agent if no call or message is logged' },
  { title: 'Escalate to an admin after 3 quiet days', does: 'Tell the admin when a lead has had no activity for 3 days', teams: true },
  { title: 'Site visit confirmation',               does: 'WhatsApp the lead when a site visit is booked' },
  { title: 'Celebrate a deal won',                  does: 'Tell the team when a deal is closed', teams: true },
  { title: 'Weekly report to the manager',          does: 'Each agent\'s report every Monday at 9:00 am', teams: true },
]

export function AutomationsSection({ access }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <Panel icon={<Lightning size={18} weight="fill" />} title="Running now" sub="These run on their own. There's nothing to switch on.">
        <div className="-mx-4 sm:-mx-5">
          {RUNNING.map(r => (
            <div key={r.title} className="flex items-start gap-3 border-b px-4 py-3.5 last:border-b-0 sm:px-5" style={{ borderColor: '#F2F4F7' }}>
              <CheckCircle size={20} weight="fill" className="mt-px shrink-0" style={{ color: '#17B26A' }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{r.title}</span>
                  <Pill small tone="green">{r.when}</Pill>
                </div>
                <p className="m-0 mt-0.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>{r.does}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel icon={<Clock size={18} weight="bold" />} title="Not available yet" sub="Planned automations. They can't be switched on until LeadGap runs them.">
        <div className="-mx-4 sm:-mx-5">
          {PLANNED.filter(p => !p.teams || access !== 'solo').map(p => (
            <div key={p.title} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0 sm:px-5" style={{ borderColor: '#F2F4F7' }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{p.title}</span>
                  {p.teams && <Pill tone="violet" small>Teams</Pill>}
                </div>
                <p className="m-0 mt-0.5 text-[13px] leading-snug" style={{ color: SUBTLE }}>{p.does}</p>
              </div>
              <Toggle on={false} onChange={() => {}} label={`${p.title}: not available yet`} disabled />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ─── AI preferences ───────────────────────────────────────────────────────────
type Trust = 'suggest' | 'notify' | 'auto'
const TRUST: { id: Trust; label: string; soon?: boolean }[] = [
  { id: 'suggest', label: 'Suggest' },
  { id: 'notify', label: 'Auto + notify', soon: true },
  { id: 'auto', label: 'Autonomous', soon: true },
]
const AI_FLOWS = [
  { Icon: WhatsappLogo, color: WA,        title: 'WhatsApp replies',  desc: 'Reads a lead\'s WhatsApp reply and suggests the next stage or a follow-up.' },
  { Icon: TrendUp,      color: BLUE,      title: 'Stage moves',       desc: 'Spots leads whose activity says they should move on, and suggests the move.' },
  { Icon: CheckSquare,  color: '#DC6803', title: 'Follow-up tasks',   desc: 'Turns call notes and messages into follow-up tasks for you to accept.' },
]

export function AiSection({ mode, overview }: SectionProps) {
  const ro = mode !== 'edit'
  const aiOn = overview.error ? false : overview.data ? overview.data.services.ai : null
  return (
    <div className="flex flex-col gap-5">
      {ro && <ViewOnlyNote what="how much the AI may do" />}
      <div className="flex flex-wrap items-center gap-4 rounded-[16px] border p-4 sm:p-5" style={{ borderColor: '#D1E0FF', background: 'linear-gradient(120deg, #F5F8FF 0%, #EFF4FF 100%)' }}>
        <span className="grid size-11 shrink-0 place-items-center rounded-[12px] text-white" style={{ background: BLUE }}><Robot size={22} weight="fill" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold" style={{ color: TEXT }}>LeadGap&apos;s AI never changes a lead on its own</div>
          <p className="m-0 mt-0.5 text-[13.5px] leading-snug" style={{ color: TEXT_2 }}>It suggests; you apply each change, with Undo. Higher levels of trust are on the way.</p>
        </div>
        <StatusDot on={aiOn} onText="AI is on" offText="AI isn't set up" />
      </div>
      <Panel icon={<Sparkle size={18} weight="fill" />} title="How much the AI may do" sub="Per workflow. Only Suggest is available for now."
        right={<Link href="/dashboard/advisor/workflows" className={linkBtnCls('sm')} style={linkBtnStyle}>AI Workflows<ArrowSquareOut size={14} weight="bold" /></Link>}>
        {AI_FLOWS.map(f => (
          <Row key={f.title} top label={<span className="flex items-center gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-[8px]" style={{ background: `${f.color}14`, color: f.color }}><f.Icon size={16} weight="fill" /></span>{f.title}</span>} hint={f.desc}>
            <Choice<Trust> label={`${f.title}: how much the AI may do`} value="suggest" onChange={() => {}} options={TRUST} disabled={ro} />
          </Row>
        ))}
      </Panel>
    </div>
  )
}

// ─── Branding & reports ───────────────────────────────────────────────────────
export function BrandingSection() {
  return (
    <div className="flex flex-col gap-5">
      <Insight tone="neutral" icon={<Clock size={15} weight="bold" />} title="Branding isn't available yet">
        Reports print with LeadGap&apos;s header for now. These options will put your own logo and colours on them.
      </Insight>
      <Panel icon={<PaintBrush size={18} weight="bold" />} title="Your brand on reports" right={<Soon />}>
        <Row label="Company logo" hint="At the top of every printed report"><Btn disabled>Upload logo</Btn></Row>
        <Row label="Brand colour" hint="For report headers">
          <div className="flex items-center gap-2"><span className="size-10 shrink-0 rounded-[10px] border" style={{ background: BLUE, borderColor: BORDER }} /><ValueBox muted>#1D4ED8</ValueBox></div>
        </Row>
        <Row label="Footer line" hint="Printed at the bottom of each report"><ValueBox muted>© Your Agency · RERA registered</ValueBox></Row>
        <Row label="Show your RERA number" hint="From Business details"><Toggle on={false} onChange={() => {}} label="Show RERA number: not available yet" disabled /></Row>
      </Panel>
      <Panel icon={<ChartBar size={18} weight="bold" />} title="Report defaults" right={<Soon />} sub="What Reports opens with.">
        <Row label="Time range">{soonLabel('This month')}</Row>
        <Row label="Report">{soonLabel('Productivity')}</Row>
      </Panel>
    </div>
  )
}
