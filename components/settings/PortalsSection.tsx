'use client'

// Settings → Portals & integrations. The owner (Solo) or the admins (Teams) connect property portals and ad
// platforms here. Portal details (webhook link, fields, steps) come from app/dashboard/integrations/portals.ts.

import { useState } from 'react'
import {
  Copy, Check, EnvelopeSimple, WhatsappLogo, ArrowSquareOut, CaretRight, Info, Warning, Tray, Globe,
} from '@phosphor-icons/react'
import { PORTALS, getPortal, type PortalConfig } from '@/app/dashboard/integrations/portals'
import {
  Btn, Dialog, Insight, Panel, Pill, SourceMark, sourceMeta,
  BORDER, SURFACE, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, MONO, WA, XS,
} from '@/components/outreach/OutreachKit'
import { Soon, dateText, dateTimeText, linkBtnCls, linkBtnStyle, type Overview, type SectionProps } from './SettingsKit'

// How each portal's leads are labelled in `leads.source` and in the ingest log, compared without case or punctuation
const KEYS: Record<string, string[]> = {
  magicbricks: ['MAGICBRICKS'],
  '99acres':   ['99ACRES', 'OPT99ACRES'],
  housing:     ['HOUSINGCOM', 'HOUSING'],
  nobroker:    ['NOBROKER'],
  facebook:    ['FACEBOOK', 'FACEBOOKADS', 'FACEBOOKLEADS', 'FACEBOOKLEADADS'],
  google:      ['GOOGLE', 'GOOGLEADS'],
}
// The key SourceMark knows each portal by (for its logo or icon)
const MARK: Record<string, string> = { facebook: 'FACEBOOK', google: 'GOOGLE' }
const norm = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const portalOf = (source: string | null) => {
  const k = norm(source)
  return PORTALS.find(p => KEYS[p.id]?.includes(k))?.id ?? null
}
const METHOD: Record<PortalConfig['method'], string> = {
  account_manager: 'Through your account manager',
  self_serve: 'Self-serve',
  zapier: 'Through Zapier',
}
// Portals the old page listed that LeadGap can't receive from yet
const LATER = [{ name: 'Square Yards', mark: 'Square Yards' }, { name: 'IndiaProperty', mark: null }]

type PortalStats = { leads: number; last: string | null }
function statsFor(id: string, ov: Overview | null): PortalStats {
  const out: PortalStats = { leads: 0, last: null }
  for (const s of ov?.sources ?? []) {
    if (portalOf(s.source) !== id) continue
    out.leads += s.leads
    if (s.last && (!out.last || s.last > out.last)) out.last = s.last
  }
  return out
}
function deliveriesFor(id: string, ov: Overview | null) {
  if (!ov?.deliveries) return null
  const d = { created: 0, duplicate: 0, failed: 0, last: null as string | null }
  for (const [name, v] of Object.entries(ov.deliveries)) {
    if (!KEYS[id]?.includes(norm(name))) continue
    d.created += v.created; d.duplicate += v.duplicate; d.failed += v.failed
    if (v.last && (!d.last || v.last > d.last)) d.last = v.last
  }
  return d
}

export function PortalsSection({ overview, initialPortal, onPortalClose }: SectionProps & { initialPortal?: string | null; onPortalClose?: () => void }) {
  const ov = overview.data
  const [open, setOpen] = useState<string | null>(initialPortal && getPortal(initialPortal) ? initialPortal : null)
  const loading = !ov && !overview.error

  const rows = PORTALS.map(p => ({ p, s: statsFor(p.id, ov) }))
  const live = rows.filter(r => r.s.leads > 0)
  const portalLeads = rows.reduce((n, r) => n + r.s.leads, 0)
  const lastIn = rows.reduce<string | null>((m, r) => (r.s.last && (!m || r.s.last > m) ? r.s.last : m), null)
  const others = (ov?.sources ?? []).filter(s => !portalOf(s.source))

  const close = () => { setOpen(null); onPortalClose?.() }
  const current = open ? getPortal(open) : null

  return (
    <div className="flex flex-col gap-5">
      {/* At a glance */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Glance label="Portals sending leads" value={loading ? '—' : `${live.length} of ${PORTALS.length}`} />
        <Glance label="Leads from portals" value={loading ? '—' : portalLeads.toLocaleString('en-IN')} />
        <Glance label="Last portal lead" value={loading ? '—' : lastIn ? dateText(lastIn) : 'None yet'} small />
      </div>
      {overview.error && <p className="m-0 text-[13px]" style={{ color: '#B42318' }}>Couldn&apos;t load lead counts: {overview.error}</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
        {rows.map(({ p, s }) => (
          <button key={p.id} type="button" onClick={() => setOpen(p.id)}
            className="group flex min-w-0 cursor-pointer flex-col rounded-[16px] border bg-white p-4 text-left transition-[border-color,box-shadow] hover:border-[#B2CCFF] hover:shadow-[0_4px_8px_-2px_rgba(16,24,40,0.1)]"
            style={{ borderColor: BORDER, boxShadow: XS }}>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-[12px] border bg-white" style={{ borderColor: BORDER }}><SourceMark raw={MARK[p.id] ?? p.name} size={28} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15.5px] font-semibold" style={{ color: TEXT }}>{p.name}</div>
                <div className="truncate text-[13px]" style={{ color: SUBTLE }}>{p.tagline}</div>
              </div>
              {s.leads > 0
                ? <Pill tone="green" small><span className="size-1.5 rounded-full bg-[#17B26A]" />Receiving</Pill>
                : <Pill small>Not connected</Pill>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniStat label="Leads in your account" value={loading ? '—' : s.leads.toLocaleString('en-IN')} />
              <MiniStat label="Last lead" value={loading ? '—' : s.last ? dateText(s.last) : '—'} />
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: '#F2F4F7' }}>
              <span className="text-[12.5px] font-medium" style={{ color: SUBTLE }}>{METHOD[p.method]}</span>
              <span className="inline-flex items-center gap-1 text-[13.5px] font-semibold" style={{ color: BLUE }}>{s.leads > 0 ? 'Manage' : 'Set up'}<CaretRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" /></span>
            </div>
          </button>
        ))}
        {LATER.map(l => (
          <div key={l.name} className="flex min-w-0 items-center gap-3 rounded-[16px] border border-dashed p-4" style={{ borderColor: '#D0D5DD', background: SURFACE }}>
            <span className="grid size-11 shrink-0 place-items-center rounded-[12px] border bg-white opacity-70" style={{ borderColor: BORDER }}>
              {l.mark ? <SourceMark raw={l.mark} size={28} /> : <Globe size={22} weight="bold" style={{ color: LABEL }} />}
            </span>
            <div className="min-w-0 flex-1"><div className="text-[15px] font-semibold" style={{ color: TEXT_2 }}>{l.name}</div><div className="text-[13px]" style={{ color: LABEL }}>Can&apos;t receive leads from here yet</div></div>
            <Soon />
          </div>
        ))}
      </div>

      {others.length > 0 && (
        <Panel icon={<Tray size={18} weight="bold" />} title="Other sources in your account" sub="Leads that didn't come through a portal link: imports, leads added by hand and other sources.">
          <div className="-mx-4 sm:-mx-5">
            {others.slice(0, 12).map(s => (
              <div key={s.source ?? '—'} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0 sm:px-5" style={{ borderColor: '#F2F4F7' }}>
                <SourceMark raw={s.source} size={22} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium" style={{ color: TEXT }}>{s.source ? sourceMeta(s.source).label : 'No source'}</span>
                <span className="hidden text-[12.5px] sm:inline" style={{ color: LABEL }}>last {dateText(s.last)}</span>
                <span className="w-14 text-right text-[14px] font-semibold tabular-nums" style={{ color: TEXT_2 }}>{s.leads.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Insight tone="blue" icon={<Info size={15} weight="bold" />} title="How portal links work">
        Each portal gets a link. You send it to the portal (most go through your account manager), they switch on lead forwarding, and new enquiries come straight into LeadGap. No copying and pasting.
      </Insight>

      {current && <PortalDialog p={current} ov={ov} onClose={close} />}
    </div>
  )
}

function Glance({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="min-w-0 rounded-[14px] border bg-white px-3 py-3 sm:px-4" style={{ borderColor: BORDER, boxShadow: XS }}>
      <div className="text-[12px] font-medium leading-tight sm:text-[13px]" style={{ color: SUBTLE }}>{label}</div>
      <div className={`mt-1 truncate font-semibold tracking-[-0.02em] tabular-nums ${small ? 'text-[15px] sm:text-[18px]' : 'text-[20px] sm:text-[24px]'}`} style={{ color: TEXT }}>{value}</div>
    </div>
  )
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[10px] px-3 py-2" style={{ background: SURFACE }}>
      <div className="truncate text-[15px] font-semibold tabular-nums" style={{ color: TEXT }}>{value}</div>
      <div className="truncate text-[12px]" style={{ color: LABEL }}>{label}</div>
    </div>
  )
}

function PortalDialog({ p, ov, onClose }: { p: PortalConfig; ov: Overview | null; onClose: () => void }) {
  const [copied, setCopied] = useState<'url' | 'all' | null>(null)
  const s = statsFor(p.id, ov)
  const d = deliveriesFor(p.id, ov)
  const sharesLink = /\/api\/ingest\/99acres$/.test(p.webhookPath) && p.id !== '99acres'

  async function copy(text: string, what: 'url' | 'all') {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 2200) } catch { /* the link is still on screen to copy by hand */ }
  }
  const allDetails = [
    `${p.name} lead forwarding for LeadGap`,
    '',
    `Webhook URL: ${p.webhookPath}`,
    'Method: POST',
    'Format: JSON',
    '',
    'Fields:',
    ...p.params.map(x => `  - ${x}`),
    '',
    'Steps:',
    ...p.steps.map((x, i) => `  ${i + 1}. ${x}`),
  ].join('\n')
  const ask = [
    'Hi,',
    '',
    `I use LeadGap to manage my property enquiries and would like ${p.name} to forward new leads to it automatically.`,
    'Please set up push integration with these details:',
    '',
    `Webhook URL: ${p.webhookPath}`,
    'Method: POST · Format: JSON',
    `Fields: ${p.params.join(', ')}`,
    '',
    'Please confirm once it is done. Thank you!',
  ].join('\n')
  const mailto = `mailto:${p.managerEmail ?? ''}?subject=${encodeURIComponent(`Enable CRM push integration: ${p.name}`)}&body=${encodeURIComponent(ask)}`
  const wa = `https://wa.me/?text=${encodeURIComponent(ask)}`

  return (
    <Dialog open onClose={onClose} width={640} full
      icon={<SourceMark raw={MARK[p.id] ?? p.name} size={24} />}
      title={`${p.name}`} sub={`${METHOD[p.method]} · ${s.leads > 0 ? `${s.leads.toLocaleString('en-IN')} leads so far, last on ${dateText(s.last)}` : 'No leads from here yet'}`}
      footer={<Btn onClick={onClose}>Done</Btn>}>
      <div className="flex flex-col gap-5">
        <section>
          <h4 className="m-0 mb-2 text-[13px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>Your link for {p.name}</h4>
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 break-all rounded-[10px] border px-3 py-2.5 text-[13px] leading-snug" style={{ fontFamily: MONO, borderColor: BORDER, background: SURFACE, color: TEXT_2 }}>{p.webhookPath}</code>
            <Btn onClick={() => copy(p.webhookPath, 'url')} label="Copy link">{copied === 'url' ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}<span className="hidden sm:inline">{copied === 'url' ? 'Copied' : 'Copy'}</span></Btn>
          </div>
          <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: SUBTLE }}>POST · JSON</p>
          {sharesLink && (
            <div className="mt-3"><Insight tone="amber" icon={<Warning size={15} weight="bold" />} title="Shares the 99acres link">
              Leads sent to this link are saved with 99acres as their source for now.
            </Insight></div>
          )}
        </section>

        <section>
          <h4 className="m-0 mb-2 text-[13px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>{p.method === 'account_manager' ? 'Send it to your account manager' : 'Share or keep the details'}</h4>
          <div className="grid gap-2 sm:grid-cols-3">
            <a href={wa} target="_blank" rel="noopener noreferrer" className={`${linkBtnCls()} w-full`} style={linkBtnStyle}><WhatsappLogo size={17} weight="fill" style={{ color: WA }} />WhatsApp</a>
            <a href={mailto} className={`${linkBtnCls()} w-full`} style={linkBtnStyle}><EnvelopeSimple size={17} weight="bold" />Email{p.managerEmail ? '' : ' it'}</a>
            <Btn className="w-full" onClick={() => copy(allDetails, 'all')}>{copied === 'all' ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}{copied === 'all' ? 'Copied' : 'Copy all details'}</Btn>
          </div>
          {p.managerEmail && <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: SUBTLE }}>Email goes to {p.managerEmail}</p>}
        </section>

        <section>
          <h4 className="m-0 mb-2 text-[13px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>Steps</h4>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {p.steps.map((x, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: BLUE }}>{i + 1}</span>
                <span className="pt-0.5 text-[14px] leading-snug" style={{ color: TEXT_2 }}>{x}</span>
              </li>
            ))}
          </ol>
          {p.docsUrl && <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-semibold no-underline" style={{ color: BLUE }}>Setup guide<ArrowSquareOut size={14} weight="bold" /></a>}
        </section>

        <section>
          <h4 className="m-0 mb-2 text-[13px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>Fields {p.name} sends</h4>
          <div className="flex flex-wrap gap-1.5">
            {p.params.map(x => <span key={x} className="rounded-[7px] border px-2 py-1 text-[12.5px]" style={{ fontFamily: MONO, borderColor: BORDER, color: TEXT_2, background: '#FFFFFF' }}>{x}</span>)}
          </div>
        </section>

        {d && (
          <section>
            <h4 className="m-0 mb-1 text-[13px] font-semibold uppercase tracking-[0.04em]" style={{ color: LABEL }}>Deliveries to this link</h4>
            <p className="m-0 mb-2 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>Every delivery the link has received, for all accounts. {d.last ? `Last one ${dateTimeText(d.last)}.` : ''}</p>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="New leads" value={d.created.toLocaleString('en-IN')} />
              <MiniStat label="Duplicates" value={d.duplicate.toLocaleString('en-IN')} />
              <MiniStat label="Failed" value={d.failed.toLocaleString('en-IN')} />
            </div>
          </section>
        )}
      </div>
    </Dialog>
  )
}
