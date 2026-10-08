'use client'

// Calculators: EMI, rental yield, 5-year projection and stamp duty. Inputs are kept while you switch between them.
// Each one can go to a client on WhatsApp (EMI, rental yield and projection also as a link to the public
// /calc page) or be printed as a PDF.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  Calculator, House, ChartLineUp, Stamp, ShareNetwork, Printer, Copy, Check, WhatsappLogo, LinkSimple, ArrowSquareOut, CircleNotch,
} from '@phosphor-icons/react'
import { PageTabBar } from '@/components/layout/PageTabBar'
import { supabase } from '@/lib/supabase'
import {
  CANVAS, SURFACE, BORDER, TEXT, TEXT_2, SUBTLE, BLUE, BLUE_BG, BLUE_LN, XS, PageHeader, Btn, Pill, Dialog, Field,
  inputCls, inputStyle, WaBubble, phone10, useToast, Toast,
} from '@/components/outreach/OutreachKit'
import { INSIGHTS_TABS, fetchMyName, printElement, PRINT_CSS, errText } from '@/components/insights/InsightsKit'
import { RANGE_CSS, HERO_BG, type CalcSummary } from '@/components/insights/calculators/CalcKit'
import { EmiCalculator, EMI_DEFAULTS, emiSummary, emiNumbers, type EmiInputs } from '@/components/insights/calculators/EmiCalculator'
import { RentalYieldCalculator, RENTAL_DEFAULTS, rentalSummary, type RentalInputs } from '@/components/insights/calculators/RentalYieldCalculator'
import { ProjectionCalculator, PROJ_DEFAULTS, projSummary, type ProjInputs } from '@/components/insights/calculators/ProjectionCalculator'
import { StampDutyCalculator, STAMP_DEFAULTS, stampSummary, type StampInputs } from '@/components/insights/calculators/StampDutyCalculator'

type CalcId = 'emi' | 'rental' | 'projection' | 'stamp'
const CALCS: { id: CalcId; label: string; blurb: string; Icon: typeof Calculator; isNew?: boolean }[] = [
  { id: 'emi',        label: 'EMI',               blurb: 'Monthly EMI, interest, prepayments', Icon: Calculator, isNew: true },
  { id: 'rental',     label: 'Rental yield',      blurb: 'Yield, cash flow, return',           Icon: House },
  { id: 'projection', label: '5-year projection', blurb: 'Value, equity, gain',                Icon: ChartLineUp },
  { id: 'stamp',      label: 'Stamp duty',        blurb: 'Duty and registration by state',     Icon: Stamp },
]
const isCalc = (x: unknown): x is CalcId => CALCS.some(c => c.id === x)

// ─── Last calculator used (this browser only) ─────────────────────────────────
const TAB_KEY = 'leadgap-calculator'
const tabSubs = new Set<() => void>()
let tabMem: CalcId | null = null
function readTab(): CalcId {
  if (tabMem) return tabMem
  try { const v = localStorage.getItem(TAB_KEY); return isCalc(v) ? v : 'emi' } catch { return 'emi' }
}
function writeTab(v: CalcId) {
  tabMem = v
  try { localStorage.setItem(TAB_KEY, v) } catch { /* storage blocked: the in-memory value still works */ }
  tabSubs.forEach(f => f())
}
const subscribeTab = (f: () => void) => { tabSubs.add(f); return () => { tabSubs.delete(f) } }

// ─── Sender details for the share message (this browser only) ─────────────────
type Profile = { name: string; phone: string; company: string }
const PROFILE_KEY = 'leadgap-share-profile'
function readProfile(): Profile | null {
  try {
    const j = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')
    return j && typeof j === 'object' ? { name: String(j.name ?? ''), phone: String(j.phone ?? ''), company: String(j.company ?? '') } : null
  } catch { return null }
}
function saveProfile(p: Profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch { /* storage blocked */ }
}

export default function CalculatorsPage() {
  const tab = useSyncExternalStore(subscribeTab, readTab, () => 'emi' as CalcId)
  const [emi, setEmi] = useState<EmiInputs>(EMI_DEFAULTS)
  const [rental, setRental] = useState<RentalInputs>(RENTAL_DEFAULTS)
  const [proj, setProj] = useState<ProjInputs>(PROJ_DEFAULTS)
  const [stamp, setStamp] = useState<StampInputs>(STAMP_DEFAULTS)
  const [myName, setMyName] = useState<string | null>(null)
  const [sharing, setSharing] = useState<Profile | null>(null)
  const loadName = useCallback(() => { fetchMyName().then(setMyName) }, [])
  useEffect(() => { loadName() }, [loadName])

  const summary: CalcSummary = useMemo(() => (
    tab === 'emi' ? emiSummary(emi) : tab === 'rental' ? rentalSummary(rental) : tab === 'projection' ? projSummary(proj) : stampSummary(stamp)
  ), [tab, emi, rental, proj, stamp])

  const go = (id: CalcId) => { writeTab(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const toStampDuty = (price: number) => { setStamp(s => ({ ...s, value: price })); go('stamp') }
  const toProjection = () => {
    const { loan, down } = emiNumbers(emi)
    setProj(p => ({ ...p, currentMarketValue: emi.price, initialInvestment: Math.round(down), hasLoan: loan > 0, loanAmount: Math.round(loan), loanInterestRate: emi.rate, loanTenure: emi.tenure }))
    go('projection')
  }
  const profileNow = () => readProfile() ?? { name: myName ?? '', phone: '', company: '' }
  const print = () => {
    const p = profileNow()
    printElement('calc-sheet', `${summary.title}${p.name ? ` · ${p.name}` : ''}`, { by: [p.name, p.company].filter(Boolean).join(' · ') || 'LeadGap' })
  }

  return (
    <div className="min-h-screen" style={{ background: CANVAS }}>
      <style>{PRINT_CSS + RANGE_CSS}</style>
      <PageTabBar tabs={INSIGHTS_TABS} />
      <PageHeader title="Calculators" backHref="/dashboard"
        sub="Work out a buyer's EMI, a rental's yield, five-year growth and stamp duty, then send the numbers to the client."
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setSharing(profileNow())}><ShareNetwork size={16} weight="bold" /><span><span className="sm:hidden">Share</span><span className="hidden sm:inline">Share with client</span></span></Btn>
            <Btn variant="primary" onClick={print}><Printer size={16} weight="bold" /><span><span className="sm:hidden">PDF</span><span className="hidden sm:inline">Download PDF</span></span></Btn>
          </div>
        }
      />

      <div className="mx-auto max-w-[1400px] px-4 pb-28 lg:px-8 lg:pb-16">
        <div role="tablist" aria-label="Calculator" className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          {CALCS.map(c => {
            const on = c.id === tab
            return (
              <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => writeTab(c.id)}
                className="flex min-w-[210px] cursor-pointer items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors sm:min-w-0"
                style={on ? { background: BLUE_BG, borderColor: BLUE_LN, boxShadow: '0 0 0 3px rgba(29,78,216,0.08)' } : { background: CANVAS, borderColor: BORDER, boxShadow: XS }}>
                <span className="grid size-10 shrink-0 place-items-center rounded-[11px]" style={on ? { background: BLUE, color: '#FFFFFF' } : { background: SURFACE, color: TEXT_2, border: `1px solid ${BORDER}` }}>
                  <c.Icon size={19} weight="bold" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] font-semibold" style={{ color: on ? BLUE : TEXT }}>{c.label}</span>
                    {c.isNew && <Pill tone="green" small>New</Pill>}
                  </span>
                  <span className="block truncate text-[12.5px]" style={{ color: SUBTLE }}>{c.blurb}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div id="calc-sheet" className="lg-report mt-6">
          <PrintHead summary={summary} />
          {tab === 'emi' && <EmiCalculator value={emi} onChange={setEmi} onStampDuty={toStampDuty} onProject={toProjection} />}
          {tab === 'rental' && <RentalYieldCalculator value={rental} onChange={setRental} />}
          {tab === 'projection' && <ProjectionCalculator value={proj} onChange={setProj} />}
          {tab === 'stamp' && <StampDutyCalculator value={stamp} onChange={setStamp} />}
          <p className="mt-6 hidden text-[11px] print:block" style={{ color: SUBTLE }}>Estimates for discussion, worked out in LeadGap. Not an offer of a loan or a tax opinion.</p>
        </div>
      </div>

      {sharing && <ShareDialog summary={summary} initial={sharing} onClose={() => setSharing(null)} />}
    </div>
  )
}

/** Shown only on the printed sheet: who prepared it, when, and the inputs used */
function PrintHead({ summary }: { summary: CalcSummary }) {
  return (
    <div className="mb-5 hidden print:block">
      <div className="rounded-[16px] px-6 py-5 text-white" style={{ background: HERO_BG }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#C7D7FE' }}>LeadGap · Calculators</div>
        <div className="mt-1.5 text-[24px] font-bold">{summary.title}</div>
        <div className="mt-1 text-[13px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Prepared by <span data-fill="by">LeadGap</span> · <span data-fill="date" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-[12px] border px-5 py-4 text-[12.5px]" style={{ borderColor: BORDER }}>
        {summary.inputs.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b py-1" style={{ borderColor: '#F2F4F7' }}>
            <span style={{ color: SUBTLE }}>{k}</span><b className="text-right font-semibold" style={{ color: TEXT }}>{v}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function messageOf(s: CalcSummary, p: Profile, client: string, link: string | null) {
  const sign = [p.name.trim(), p.company.trim()].filter(Boolean).join(', ')
  return [
    `Hi ${client.trim() || 'there'},`,
    `Here is the ${s.noun} we talked about:`,
    '',
    ...s.lines.map(l => `• ${l}`),
    ...(link ? ['', `Full breakdown: ${link}`] : []),
    ...(sign || p.phone.trim() ? ['', sign, p.phone.trim()].filter((x, k) => k === 0 || x) : []),
  ].join('\n')
}

function ShareDialog({ summary, initial, onClose }: { summary: CalcSummary; initial: Profile; onClose: () => void }) {
  const [p, setP] = useState<Profile>(initial)
  const [client, setClient] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<'link' | 'text' | null>(null)
  const { toast, show, hide } = useToast()
  const text = messageOf(summary, p, client, link)
  const ph = phone10(clientPhone)

  const createLink = async () => {
    if (!summary.share) return
    if (!p.name.trim()) { show({ text: 'Add your name so the client knows who sent it.', tone: 'err' }); return }
    setBusy(true)
    try {
      const { data } = await supabase.auth.getSession()
      const r = await fetch('/api/calculations/share', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: data.session?.user?.id ?? null, calculatorType: summary.share.type, inputData: summary.share.inputData,
          agentName: p.name.trim(), agentPhone: p.phone.trim() || null, companyName: p.company.trim() || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.success || !j.url) throw new Error(j.error || 'Could not create the link')
      setLink(j.url as string)
      saveProfile(p)
    } catch (e) {
      show({ text: errText(e), tone: 'err' })
    }
    setBusy(false)
  }
  const copy = async (what: 'link' | 'text') => {
    try { await navigator.clipboard.writeText(what === 'link' ? link ?? '' : text); setCopied(what); setTimeout(() => setCopied(null), 2000); saveProfile(p) }
    catch { show({ text: 'Couldn\'t copy. Select the text and copy it instead.', tone: 'err' }) }
  }
  const sendWa = () => {
    saveProfile(p)
    window.open(`https://wa.me/${ph ? `91${ph}` : ''}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  const field = (id: keyof Profile, label: string, placeholder: string, type = 'text') => (
    <Field label={label} htmlFor={`sh-${id}`}>
      <input id={`sh-${id}`} type={type} value={p[id]} placeholder={placeholder} onChange={e => setP(x => ({ ...x, [id]: e.target.value }))} className={inputCls} style={inputStyle} />
    </Field>
  )

  return (
    <Dialog open onClose={onClose} width={640} icon={<ShareNetwork size={19} weight="bold" />} title={`Share the ${summary.noun}`}
      sub={summary.share ? 'Send the numbers on WhatsApp, with a link to a page the client can open.' : 'Send the numbers on WhatsApp or copy them.'}
      footer={
        <>
          <Btn onClick={() => copy('text')}>{copied === 'text' ? <Check size={15} weight="bold" /> : <Copy size={15} weight="bold" />}{copied === 'text' ? 'Copied' : 'Copy message'}</Btn>
          {summary.share && !link && (
            <Btn variant="primary" onClick={createLink} disabled={busy}>
              {busy ? <CircleNotch size={15} weight="bold" className="animate-spin" /> : <LinkSimple size={15} weight="bold" />}{busy ? 'Creating link…' : 'Create link'}
            </Btn>
          )}
          <Btn variant="call" onClick={sendWa}><WhatsappLogo size={16} weight="fill" />{ph ? 'Send on WhatsApp' : 'Open WhatsApp'}</Btn>
        </>
      }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client's name" htmlFor="sh-client">
          <input id="sh-client" value={client} placeholder="e.g. Rahul" onChange={e => setClient(e.target.value)} className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Client's WhatsApp number" htmlFor="sh-cphone" hint={clientPhone && !ph ? 'Enter a 10-digit mobile number.' : undefined}>
          <input id="sh-cphone" type="tel" inputMode="tel" value={clientPhone} placeholder="98765 43210" onChange={e => setClientPhone(e.target.value)} className={inputCls} style={inputStyle} />
        </Field>
        {field('name', 'Your name', 'e.g. Priya Sharma')}
        {field('phone', 'Your phone', '98765 43210', 'tel')}
        <div className="sm:col-span-2">{field('company', 'Company', 'e.g. Dream Homes Realty')}</div>
      </div>

      {link && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[12px] border px-3.5 py-3" style={{ background: BLUE_BG, borderColor: BLUE_LN }}>
          <LinkSimple size={16} weight="bold" style={{ color: BLUE }} />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium" style={{ color: BLUE }}>{link}</span>
          <Btn size="sm" onClick={() => copy('link')}>{copied === 'link' ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}{copied === 'link' ? 'Copied' : 'Copy link'}</Btn>
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold no-underline hover:bg-white" style={{ color: BLUE }}>
            Open<ArrowSquareOut size={13} weight="bold" />
          </a>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 text-[13px] font-semibold" style={{ color: TEXT_2 }}>Message preview</div>
        <div className="rounded-[14px] px-3 py-4" style={{ background: '#EFEAE2' }}>
          <WaBubble text={text} time="now" />
        </div>
        {summary.share && !link && <p className="m-0 mt-2 text-[12.5px]" style={{ color: SUBTLE }}>Create a link to add a page the client can open, with your name and number on it.</p>}
      </div>
      <Toast toast={toast} onClose={hide} />
    </Dialog>
  )
}
