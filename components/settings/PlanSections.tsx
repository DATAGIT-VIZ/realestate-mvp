'use client'

// Settings → Plan and data: Plan & billing (Razorpay) and Data & privacy. Owner (Solo) or admins (Teams) only.

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  CreditCard, CheckCircle, ArrowClockwise, Receipt, ArrowSquareOut, Warning, Lightning, UsersThree, ShieldCheck,
  DownloadSimple, Database, Trash, CalendarBlank, Info, Lifebuoy,
} from '@phosphor-icons/react'
import { PLANS, type PlanId } from '@/lib/razorpay'
import {
  Btn, Dialog, Insight, Panel, Pill, Select, Toggle,
  BORDER, SURFACE, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, BLUE_LN, XS, type Tone,
} from '@/components/outreach/OutreachKit'
import { Row, Soon, dateText, errText, linkBtnCls, linkBtnStyle, type SectionProps } from './SettingsKit'

// ─── Plan & billing ───────────────────────────────────────────────────────────
type Invoice = { id: string; date: number; amount_paid: number; status: string; short_url: string }
type Billing = {
  plan: PlanId; status: string; razorpaySubscriptionId?: string | null
  currentPeriodStart?: string | null; currentPeriodEnd?: string | null; cancelAtPeriodEnd?: boolean; cancelledAt?: string | null
  invoices: Invoice[]; razorpayConfigured?: boolean
}
type Checkout = new (opts: Record<string, unknown>) => { open(): void }

const fetchBilling = async (): Promise<Billing> => {
  const r = await fetch('/api/billing/status', { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.data) throw new Error(j.error || `Couldn't load billing (${r.status})`)
  const d = j.data as Billing
  return { ...d, plan: d.plan in PLANS ? d.plan : 'free', invoices: d.invoices ?? [] }
}

// Razorpay's checkout script loads only when someone actually upgrades
let checkoutScript: Promise<Checkout> | null = null
function loadCheckout(): Promise<Checkout> {
  const w = window as unknown as { Razorpay?: Checkout }
  if (w.Razorpay) return Promise.resolve(w.Razorpay)
  checkoutScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Payment window failed to load')))
    s.onerror = () => { checkoutScript = null; reject(new Error('Couldn\'t reach Razorpay. Check your connection and try again.')) }
    document.head.appendChild(s)
  })
  return checkoutScript
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`
const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'green' },
  past_due: { label: 'Payment failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  created: { label: 'Waiting for payment', tone: 'amber' },
  authenticated: { label: 'Starting', tone: 'amber' },
}
const PLAN_ICON: Record<PlanId, typeof Lightning> = { free: ShieldCheck, pro: Lightning, team: UsersThree }
const WORKSPACE: Record<PlanId, string> = { free: 'Solo', pro: 'Solo', team: 'Teams' }

export function BillingSection({ access, notify }: SectionProps) {
  const [billing, setBilling] = useState<Billing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const load = useCallback(() => fetchBilling().then(b => { setBilling(b); setError(null) }).catch(e => setError(errText(e))).finally(() => setRefreshing(false)), [])
  useEffect(() => { load() }, [load])
  const [upgrading, setUpgrading] = useState<PlanId | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const current: PlanId = billing?.plan ?? 'free'
  const payments = billing?.razorpayConfigured !== false

  async function upgrade(id: PlanId) {
    if (id === 'free') { setCancelOpen(true); return }
    if (!payments) { notify({ text: 'Online payments aren\'t switched on yet', tone: 'err' }); return }
    setUpgrading(id)
    try {
      const [Razorpay, r] = await Promise.all([
        loadCheckout(),
        fetch('/api/billing/create-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: id }) }),
      ])
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error) throw new Error(typeof j.error === 'string' ? j.error : 'Couldn\'t start the payment')
      const { subscriptionId, keyId, planLabel, amount } = j.data
      new Razorpay({
        key: keyId, subscription_id: subscriptionId, name: 'LeadGap', description: `${planLabel} plan, monthly`,
        image: '/lgc-icon.svg', currency: 'INR', amount, theme: { color: BLUE },
        modal: { ondismiss: () => setUpgrading(null) },
        // Razorpay tells the server through the webhook; check again shortly after
        handler: () => { setUpgrading(null); notify({ text: `Payment received. Your ${planLabel} plan starts in a moment.`, tone: 'ok' }); setTimeout(load, 3000) },
      }).open()
    } catch (e) { notify({ text: errText(e), tone: 'err' }); setUpgrading(null) }
  }

  async function cancel(immediately: boolean) {
    setCancelling(true)
    try {
      const r = await fetch('/api/billing/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ immediately }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error) throw new Error(j.error || 'Cancellation failed')
      setCancelOpen(false)
      notify({ text: immediately ? 'Plan cancelled' : 'Your plan will end at the close of this billing period', tone: 'ok' })
      load()
    } catch (e) { notify({ text: errText(e), tone: 'err' }) }
    finally { setCancelling(false) }
  }

  const plan = PLANS[current]
  const st = STATUS[billing?.status ?? 'active'] ?? { label: billing?.status ?? '', tone: 'neutral' as Tone }
  const Icon = PLAN_ICON[current]

  return (
    <div className="flex flex-col gap-5">
      {/* Current plan */}
      <div className="overflow-hidden rounded-[16px] border bg-white" style={{ borderColor: BORDER, boxShadow: XS }}>
        <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5" style={{ background: 'linear-gradient(120deg, #F5F8FF 0%, #EFF4FF 100%)' }}>
          <span className="grid size-12 shrink-0 place-items-center rounded-[13px] text-white" style={{ background: BLUE }}><Icon size={24} weight="fill" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[19px] font-semibold tracking-[-0.01em]" style={{ color: TEXT }}>{billing ? `${plan.label} plan` : error ? 'Plan' : 'Loading…'}</span>
              {billing && <Pill tone={st.tone} small>{st.label}</Pill>}
              {billing?.cancelAtPeriodEnd && <Pill tone="amber" small>Ends at period end</Pill>}
            </div>
            <p className="m-0 mt-0.5 text-[13.5px]" style={{ color: TEXT_2 }}>
              {billing ? (current === 'free' ? 'Free forever, for one person.' : `${plan.priceLabel} a month · ${WORKSPACE[current]} workspace`) : error ?? ''}
            </p>
          </div>
          <span className="flex items-center gap-2">
            <Btn size="sm" variant="ghost" label="Refresh" onClick={() => { setRefreshing(true); load() }}><ArrowClockwise size={16} weight="bold" className={refreshing ? 'animate-spin' : ''} /></Btn>
            {billing && current !== 'free' && !billing.cancelAtPeriodEnd && billing.status === 'active' && <Btn size="sm" onClick={() => setCancelOpen(true)}>Cancel plan</Btn>}
          </span>
        </div>
        {billing && current !== 'free' && (
          <div className="grid grid-cols-1 gap-px border-t sm:grid-cols-3" style={{ borderColor: BORDER, background: BORDER }}>
            <Fact icon={<CalendarBlank size={15} weight="bold" />} label={billing.cancelAtPeriodEnd ? 'Ends on' : 'Next payment'} value={dateText(billing.currentPeriodEnd)} />
            <Fact icon={<CalendarBlank size={15} weight="bold" />} label="This period started" value={dateText(billing.currentPeriodStart)} />
            <Fact icon={<CreditCard size={15} weight="bold" />} label="Paid through" value="Razorpay" />
          </div>
        )}
      </div>
      {error && !billing && <div className="flex flex-wrap items-center gap-3"><p className="m-0 text-[13.5px]" style={{ color: '#B42318' }}>{error}</p><Btn size="sm" onClick={load}>Try again</Btn></div>}

      {billing && access !== 'solo' && current !== 'team' && (
        <Insight tone="amber" icon={<UsersThree size={15} weight="bold" />} title={`This workspace uses Teams, but your plan is ${plan.label}`}>
          The Team plan is the one that covers admins and agents.
        </Insight>
      )}
      {billing && !payments && (
        <Insight tone="amber" icon={<Warning size={15} weight="bold" />} title="Online payments aren't switched on yet">
          Plans can&apos;t be bought from here until LeadGap connects its payment account.
        </Insight>
      )}

      {/* Plans */}
      <div className="grid gap-3 lg:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map(id => {
          const p = PLANS[id]
          const isCurrent = billing != null && id === current
          const PIcon = PLAN_ICON[id]
          return (
            <div key={id} className="relative flex flex-col rounded-[16px] border bg-white p-4 sm:p-5"
              style={{ borderColor: isCurrent ? BLUE_LN : BORDER, boxShadow: isCurrent ? `0 0 0 3px ${BLUE_BG}, ${XS}` : XS }}>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-[10px] border" style={{ borderColor: BORDER, color: id === 'free' ? SUBTLE : BLUE, boxShadow: XS }}><PIcon size={18} weight="fill" /></span>
                {isCurrent ? <Pill tone="blue" small><CheckCircle size={12} weight="fill" />Your plan</Pill> : <Pill small>{WORKSPACE[id]}</Pill>}
              </div>
              <div className="mt-3 text-[16px] font-semibold" style={{ color: TEXT }}>{p.label}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[28px] font-semibold leading-none tracking-[-0.03em]" style={{ color: TEXT }}>{p.priceLabel}</span>
                <span className="text-[13px]" style={{ color: SUBTLE }}>{p.price > 0 ? '/ month' : 'forever'}</span>
              </div>
              <ul className="m-0 mt-4 flex flex-1 list-none flex-col gap-2 p-0">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px] leading-snug" style={{ color: TEXT_2 }}>
                    <CheckCircle size={16} weight="fill" className="mt-px shrink-0" style={{ color: id === 'free' ? LABEL : BLUE }} />{f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {!billing ? <Btn className="w-full" disabled>{p.label}</Btn>
                  : isCurrent ? <Btn className="w-full" disabled>Current plan</Btn>
                  : id === 'free'
                    ? <Btn className="w-full" onClick={() => upgrade('free')} disabled={billing.cancelAtPeriodEnd || billing.status !== 'active'}>Move to Free</Btn>
                    : <Btn className="w-full" variant="primary" onClick={() => upgrade(id)} disabled={!!upgrading || !payments}>{upgrading === id ? 'Opening payment…' : `${current === 'team' && id === 'pro' ? 'Switch' : 'Upgrade'} to ${p.label}`}</Btn>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="m-0 text-[13px]" style={{ color: SUBTLE }}>Free and Pro are for one person working alone (Solo). Team adds admins and agents, lead routing and team analytics (Teams). Paid plans are billed monthly and you can cancel any time.</p>

      {/* Invoices */}
      <Panel icon={<Receipt size={18} weight="bold" />} title="Invoices" sub={billing?.invoices.length ? 'Your last 12, from Razorpay.' : undefined}>
        {!billing ? <p className="m-0 text-[13.5px]" style={{ color: SUBTLE }}>{error ? '—' : 'Loading…'}</p>
          : billing.invoices.length === 0 ? <p className="m-0 text-[14px]" style={{ color: SUBTLE }}>No invoices yet. They appear here after your first payment.</p>
          : (
            <div className="-mx-4 sm:-mx-5">
              {billing.invoices.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5" style={{ borderColor: '#F2F4F7' }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold tabular-nums" style={{ color: TEXT }}>{rupees(inv.amount_paid)}</div>
                    <div className="text-[12.5px]" style={{ color: LABEL }}>{dateText(new Date(inv.date * 1000).toISOString())}</div>
                  </div>
                  <Pill small tone={inv.status === 'paid' ? 'green' : inv.status === 'issued' ? 'amber' : 'red'}>{inv.status === 'paid' ? 'Paid' : inv.status === 'issued' ? 'Due' : inv.status}</Pill>
                  {inv.short_url && <a href={inv.short_url} target="_blank" rel="noopener noreferrer" className={linkBtnCls('sm')} style={linkBtnStyle}>View<ArrowSquareOut size={13} weight="bold" /></a>}
                </div>
              ))}
            </div>
          )}
      </Panel>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel your ${plan.label} plan?`} icon={<Warning size={20} weight="bold" />}
        sub="You'll move to Free: up to 50 leads, and no AI, calling or bulk WhatsApp."
        footer={<>
          <Btn onClick={() => setCancelOpen(false)} disabled={cancelling}>Keep my plan</Btn>
          <Btn variant="danger" onClick={() => cancel(true)} disabled={cancelling}>Cancel now</Btn>
          <Btn variant="primary" onClick={() => cancel(false)} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel at period end'}</Btn>
        </>}>
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed" style={{ color: TEXT_2 }}>
          <p className="m-0"><strong style={{ color: TEXT }}>At period end</strong> (recommended): keep everything until {billing?.currentPeriodEnd ? dateText(billing.currentPeriodEnd) : 'the end of this billing period'}, then move to Free.</p>
          <p className="m-0"><strong style={{ color: TEXT }}>Now</strong>: move to Free straight away and lose paid features today.</p>
        </div>
      </Dialog>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-white px-4 py-3 sm:px-5">
      <span style={{ color: LABEL }}>{icon}</span>
      <span className="text-[13px]" style={{ color: SUBTLE }}>{label}</span>
      <span className="ml-auto text-[13.5px] font-semibold tabular-nums sm:ml-1" style={{ color: TEXT }}>{value}</span>
    </div>
  )
}

// ─── Data & privacy ───────────────────────────────────────────────────────────
export function DataSection({ overview }: SectionProps) {
  const t = overview.data?.totals
  const [delOpen, setDelOpen] = useState(false)
  const n = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('en-IN'))
  return (
    <div className="flex flex-col gap-5">
      <Panel icon={<DownloadSimple size={18} weight="bold" />} title="Download your data" sub="A CSV file of everything in your account. It opens in Excel and Google Sheets.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ExportCard title="Leads" count={n(t?.leads)} unit="leads" what="Every field on every lead: contact details, budget, stage, source and dates." href="/api/settings/export?what=leads" />
          <ExportCard title="Activity" count={n(t?.activities)} unit="activities" what="Every call, message, meeting and note logged on your leads, with outcomes." href="/api/settings/export?what=activities" />
        </div>
        {overview.error && <p className="m-0 mt-3 text-[13px]" style={{ color: '#B42318' }}>Couldn&apos;t load counts: {overview.error}. The downloads still work.</p>}
      </Panel>

      <Panel icon={<Database size={18} weight="bold" />} title="Privacy" right={<Soon />}>
        <Row label="Keep activity for" hint="Older activity would be deleted for good">
          <Select value="Forever" onChange={() => {}} className="pointer-events-none opacity-60">{['Forever', '2 years', '1 year', '6 months'].map(o => <option key={o}>{o}</option>)}</Select>
        </Row>
        <Row label="Analytics cookies" hint="Help improve LeadGap with anonymous usage data">
          <Toggle on={false} onChange={() => {}} label="Analytics cookies: not available yet" disabled />
        </Row>
      </Panel>

      <div className="rounded-[16px] border p-4 sm:p-5" style={{ borderColor: '#FECDCA', background: '#FFFBFA' }}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-[11px] border bg-white" style={{ borderColor: '#FECDCA', color: '#D92D20' }}><Trash size={19} weight="bold" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold" style={{ color: TEXT }}>Delete account</div>
            <p className="m-0 mt-0.5 text-[13.5px] leading-snug" style={{ color: TEXT_2 }}>Delete your workspace and everything in it, for good.</p>
          </div>
          <Btn variant="danger" onClick={() => setDelOpen(true)}>Delete account</Btn>
        </div>
      </div>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)} title="Delete your account" icon={<Trash size={20} weight="bold" />}
        footer={<><Btn onClick={() => setDelOpen(false)}>Close</Btn><Link href="/dashboard/help" className={linkBtnCls()} style={linkBtnStyle}><Lifebuoy size={16} weight="bold" />Go to Help</Link></>}>
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed" style={{ color: TEXT_2 }}>
          <p className="m-0">Deleting isn&apos;t automatic yet. Download your leads and activity above first, then ask from Help and the LeadGap team will delete your workspace and all its data.</p>
          <Insight tone="neutral" icon={<Info size={15} weight="bold" />} title="Cancel your plan too">If you&apos;re on a paid plan, cancel it under Plan &amp; billing so you aren&apos;t charged again.</Insight>
        </div>
      </Dialog>
    </div>
  )
}

function ExportCard({ title, count, unit, what, href }: { title: string; count: string; unit: string; what: string; href: string }) {
  return (
    <div className="flex flex-col rounded-[14px] border p-4" style={{ borderColor: BORDER, background: SURFACE }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold" style={{ color: TEXT }}>{title}</span>
        <span className="text-[13px] tabular-nums" style={{ color: SUBTLE }}><span className="text-[18px] font-semibold" style={{ color: TEXT }}>{count}</span> {unit}</span>
      </div>
      <p className="m-0 mt-1.5 flex-1 text-[13px] leading-snug" style={{ color: TEXT_2 }}>{what}</p>
      <a href={href} download className={`${linkBtnCls()} mt-3.5 w-full`} style={linkBtnStyle}><DownloadSimple size={16} weight="bold" />Download CSV</a>
    </div>
  )
}
