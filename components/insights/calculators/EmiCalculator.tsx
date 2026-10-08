'use client'

// EMI calculator: from a property price and down payment, or straight from a loan amount.
// Shows the EMI, interest, a yearly schedule, prepayments, other tenures and rates, and what the buyer needs.

import { useMemo, useState } from 'react'
import { Bank, Coins, Lightning, CalendarDots, Scales, UserCircle, ArrowRight, Stamp, ChartLineUp, WarningCircle } from '@phosphor-icons/react'
import {
  BORDER, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, GREEN_D, XS, Seg, Toggle, Panel, Btn, inr,
} from '@/components/outreach/OutreachKit'
import { BarChart, Legend, Figure, Basis } from '@/components/insights/InsightsKit'
import {
  amortise, emiOf, rupees, pctText, monthsText, MoneyField, RateField, InputCard, ResultHero, HeroTile, HeroSplit,
  Assumption, ChoiceRow, CalcLayout, MobileResult, type CalcSummary,
} from './CalcKit'

export type EmiInputs = {
  mode: 'price' | 'loan'
  price: number; downPct: number; loan: number
  rate: number; tenure: number
  prepay: boolean; extra: number; lump: number; lumpYear: number
  foir: number
}
export const EMI_DEFAULTS: EmiInputs = {
  mode: 'price', price: 7_500_000, downPct: 20, loan: 6_000_000, rate: 8.5, tenure: 20,
  prepay: false, extra: 5_000, lump: 0, lumpYear: 5, foir: 50,
}

/** RBI's loan-to-value limits for home loans: 90% up to ₹30 L, 80% up to ₹75 L, 75% above */
export const maxLtv = (price: number) => (price <= 3_000_000 ? 90 : price <= 7_500_000 ? 80 : 75)

export function emiNumbers(i: EmiInputs) {
  const loan = Math.max(0, i.mode === 'price' ? i.price * (1 - i.downPct / 100) : i.loan)
  const down = i.mode === 'price' ? Math.max(0, i.price - loan) : 0
  const base = amortise(loan, i.rate, i.tenure)
  const hasPre = i.prepay && (i.extra > 0 || i.lump > 0)
  const pre = hasPre ? amortise(loan, i.rate, i.tenure, i.extra, i.lump, Math.min(i.lumpYear, i.tenure) * 12) : null
  return { loan, down, base, pre }
}

export function emiSummary(i: EmiInputs): CalcSummary {
  const { loan, down, base, pre } = emiNumbers(i)
  const lines = [
    `Loan: ${inr(loan)} at ${i.rate}% for ${i.tenure} years`,
    `EMI: *${rupees(base.emi)} a month*`,
    `Total interest: ${inr(base.interest)}`,
    `Total payable: ${inr(base.paid)}`,
  ]
  if (i.mode === 'price') lines.unshift(`Property price: ${inr(i.price)}, down payment ${inr(down)} (${i.downPct}%)`)
  if (pre) lines.push(`With prepayments: loan closes in ${monthsText(pre.months)} and saves ${inr(base.interest - pre.interest)} in interest`)
  const inputs: [string, string][] = [
    ...(i.mode === 'price' ? [['Property price', rupees(i.price)], ['Down payment', `${rupees(down)} (${i.downPct}%)`]] as [string, string][] : []),
    ['Loan amount', rupees(loan)], ['Interest rate', `${i.rate}% a year`], ['Tenure', `${i.tenure} years`],
    ...(pre ? [['Extra every month', rupees(i.extra)], ['One-time payment', i.lump ? `${rupees(i.lump)} at the end of year ${Math.min(i.lumpYear, i.tenure)}` : 'None']] as [string, string][] : []),
  ]
  return {
    title: 'Home loan EMI', noun: 'home loan EMI', headline: `EMI ${rupees(base.emi)} a month`, lines, inputs,
    share: {
      type: 'emi',
      inputData: {
        loanAmount: Math.round(loan), interestRate: i.rate, tenure: i.tenure,
        ...(i.mode === 'price' ? { propertyPrice: i.price, downPayment: Math.round(down) } : {}),
        ...(pre ? { extraMonthly: i.extra, lumpSum: i.lump, lumpYear: i.lumpYear } : {}),
      },
    },
  }
}

const PRINCIPAL = BLUE, INTEREST = '#84ADFF'

export function EmiCalculator({ value: v, onChange, onStampDuty, onProject }: {
  value: EmiInputs; onChange: (v: EmiInputs) => void; onStampDuty: (price: number) => void; onProject: () => void
}) {
  const set = <K extends keyof EmiInputs>(k: K) => (x: EmiInputs[K]) => onChange({ ...v, [k]: x })
  const { loan, down, base, pre } = useMemo(() => emiNumbers(v), [v])
  const sched = pre ?? base
  const [showAll, setShowAll] = useState(false)
  const [compare, setCompare] = useState<'tenure' | 'rate'>('tenure')
  const ltv = maxLtv(v.price)
  const lowDown = v.mode === 'price' && 100 - v.downPct > ltv

  const points = sched.years.map(y => ({
    tick: `Y${y.year}`, label: `Year ${y.year}`,
    parts: [
      { key: 'p', label: 'Principal', value: y.principal, color: PRINCIPAL },
      { key: 'i', label: 'Interest', value: y.interest, color: INTEREST },
    ],
  }))
  const n = points.length
  const cross = sched.years.findIndex(y => y.principal > y.interest) + 1
  const every: [number, number] = n <= 10 ? [1, 2] : n <= 20 ? [2, 4] : [5, 5]

  const tenures = [...new Set([10, 15, 20, 25, 30, v.tenure])].filter(t => t >= 1 && t <= 30).sort((a, b) => a - b)
  const rates = [v.rate - 1, v.rate - 0.5, v.rate, v.rate + 0.5, v.rate + 1].filter(r => r > 0).map(r => +r.toFixed(2))
  const bump = emiOf(loan, v.rate + 0.5, v.tenure) - base.emi

  const hero = loan <= 0 ? (
    <ResultHero eyebrow="Monthly EMI" value="₹0" sub="Enter a loan amount to see the EMI." />
  ) : (
    <ResultHero eyebrow="Monthly EMI" value={rupees(base.emi)} unit="a month"
      sub={<>{inr(loan)} loan at {v.rate}% for {v.tenure} years</>}
      badge={pre ? <span className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={{ background: 'rgba(23,178,106,0.2)', color: '#A6F4C5' }}>Closes {monthsText(base.months - pre.months)} early</span> : undefined}
      footer={<HeroSplit parts={[{ label: 'Principal', value: loan, color: '#FFFFFF' }, { label: 'Interest', value: base.interest, color: '#84ADFF' }]} />}>
      <HeroTile label="Loan amount" value={inr(loan)} sub={v.mode === 'price' ? `${100 - v.downPct}% of the price` : undefined} />
      <HeroTile label="Total interest" value={inr(base.interest)} sub={`${pctText((base.interest / loan) * 100, 0)} of the loan`} />
      <HeroTile label="Total payable" value={inr(base.paid)} sub={`${base.months} EMIs`} />
    </ResultHero>
  )

  const inputs = (
    <>
      <InputCard title="Loan" icon={<Bank size={15} weight="bold" />}>
        <Seg label="Work out from" full value={v.mode} onChange={set('mode')}
          options={[{ id: 'price', label: 'Property price' }, { id: 'loan', label: 'Loan amount' }]} />
        {v.mode === 'price' ? (
          <>
            <MoneyField id="emi-price" label="Property price" value={v.price} onChange={set('price')} range={[500_000, 100_000_000]} />
            <RateField id="emi-down" label="Down payment" value={v.downPct} onChange={set('downPct')} min={0} max={90} step={1} unit="%"
              hint={<>{rupees(down)} down, so the loan is <b style={{ color: TEXT }}>{rupees(loan)}</b></>} />
            {lowDown && (
              <p className="m-0 flex items-start gap-2 rounded-[10px] border px-2.5 py-2.5 sm:px-3 text-[12.5px] leading-snug" style={{ background: '#FFFAEB', borderColor: '#FEDF89', color: '#93370D' }}>
                <WarningCircle size={15} weight="bold" className="mt-px shrink-0" />
                <span>Banks can lend at most {ltv}% of a {inr(v.price)} home (RBI&apos;s loan-to-value limit), so the buyer needs at least {inr(v.price * (1 - ltv / 100))} down.</span>
              </p>
            )}
          </>
        ) : (
          <MoneyField id="emi-loan" label="Loan amount" value={v.loan} onChange={set('loan')} range={[100_000, 100_000_000]} />
        )}
        <RateField id="emi-rate" label="Interest rate" value={v.rate} onChange={set('rate')} min={1} max={20} step={0.05} unit="% a year" />
        <RateField id="emi-tenure" label="Tenure" value={v.tenure} onChange={set('tenure')} min={1} max={30} step={1} unit="years" />
      </InputCard>

      <InputCard title="Prepayments" icon={<Lightning size={15} weight="bold" />}
        right={<Toggle on={v.prepay} onChange={set('prepay')} label="Plan prepayments" />}>
        {v.prepay ? (
          <>
            <MoneyField id="emi-extra" label="Extra every month" value={v.extra} onChange={set('extra')} hint="Paid on top of the EMI, straight off the principal." />
            <MoneyField id="emi-lump" label="One-time payment" value={v.lump} onChange={set('lump')} optional />
            {v.lump > 0 && <RateField id="emi-lumpyear" label="Paid at the end of year" value={Math.min(v.lumpYear, v.tenure)} onChange={set('lumpYear')} min={1} max={Math.max(1, v.tenure)} step={1} unit="" />}
          </>
        ) : undefined}
      </InputCard>
      {!v.prepay && <p className="-mt-2 px-1 text-[12.5px]" style={{ color: SUBTLE }}>Turn on prepayments to see how paying a little extra shortens the loan.</p>}
      <MobileResult label="EMI" value={rupees(base.emi)} sub={`${inr(loan)} · ${v.rate}% · ${v.tenure} yrs`} />
    </>
  )

  const details = loan <= 0 ? null : (
    <>
      {pre && (
        <Panel icon={<Lightning size={17} weight="bold" />} title="With prepayments"
          sub={<>Paying {v.extra > 0 ? `${rupees(v.extra)} extra a month` : ''}{v.extra > 0 && v.lump > 0 ? ' and ' : ''}{v.lump > 0 ? `${inr(v.lump)} at the end of year ${Math.min(v.lumpYear, v.tenure)}` : ''} clears the loan {monthsText(base.months - pre.months)} early.</>}>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Figure label="Loan closes in" value={monthsText(pre.months)} sub={`instead of ${v.tenure} years`} />
            <Figure label="Interest saved" value={inr(base.interest - pre.interest)} tone={GREEN_D} sub={`${pctText(((base.interest - pre.interest) / base.interest) * 100, 0)} less interest`} />
            <Figure label="Total interest now" value={inr(pre.interest)} sub={`was ${inr(base.interest)}`} />
          </div>
        </Panel>
      )}

      <Panel icon={<CalendarDots size={17} weight="bold" />} title="Year by year" sub={`How each year's EMIs split between principal and interest${pre ? ', with prepayments' : ''}.`}
        right={<Legend items={[{ label: 'Principal', color: PRINCIPAL }, { label: 'Interest', color: INTEREST }]} />}>
        <BarChart points={points} format={inr} height={200} every={every} />
        <div className="mt-4 overflow-x-auto rounded-[12px] border" style={{ borderColor: BORDER }}>
          <table className="w-full border-collapse whitespace-nowrap text-[13.5px]">
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Year', 'Principal', 'Interest', 'Loan left'].map((h, k) => (
                  <th key={h} className={`px-2.5 py-2.5 sm:px-3 text-[12px] font-semibold ${k ? 'text-right' : 'text-left'}`} style={{ color: SUBTLE }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sched.years.map((y, k) => (
                <tr key={y.year} className={`border-t ${!showAll && k >= 5 ? 'hidden print:table-row' : ''}`} style={{ borderColor: '#F2F4F7' }}>
                  <td className="px-2.5 py-2.5 sm:px-3 font-semibold" style={{ color: TEXT }}>Year {y.year}{y.months < 12 && <span className="ml-1 text-[12px] font-normal" style={{ color: SUBTLE }}>({y.months} mo)</span>}</td>
                  <td className="px-2.5 py-2.5 sm:px-3 text-right tabular-nums" style={{ color: TEXT_2 }}>{inr(y.principal)}</td>
                  <td className="px-2.5 py-2.5 sm:px-3 text-right tabular-nums" style={{ color: TEXT_2 }}>{inr(y.interest)}</td>
                  <td className="px-2.5 py-2.5 sm:px-3 text-right font-semibold tabular-nums" style={{ color: TEXT }}>{y.balance > 0.5 ? inr(y.balance) : 'Paid off'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sched.years.length > 5 && (
          <div className="no-print mt-3">
            <Btn size="sm" variant="ghost" onClick={() => setShowAll(s => !s)}>{showAll ? 'Show fewer years' : `Show all ${sched.years.length} years`}</Btn>
          </div>
        )}
        <Basis>The EMI stays the same each month. {cross > 1 ? `Early EMIs are mostly interest; from year ${cross} most of each EMI goes to the principal.` : 'Most of each EMI goes to the principal from the start.'}</Basis>
      </Panel>

      <Panel icon={<Scales size={17} weight="bold" />} title="Compare" sub="Tap a row to use it."
        right={<Seg label="Compare by" value={compare} onChange={setCompare} options={[{ id: 'tenure', label: 'Tenure' }, { id: 'rate', label: 'Rate' }]} />}>
        <div className="flex flex-col gap-1.5">
          {(compare === 'tenure' ? tenures.map(t => ({ key: t, label: `${t} years`, emi: emiOf(loan, v.rate, t), on: t === v.tenure, pick: () => onChange({ ...v, tenure: t }), total: emiOf(loan, v.rate, t) * t * 12 - loan }))
            : rates.map(r => ({ key: r, label: `${r}%`, emi: emiOf(loan, r, v.tenure), on: r === v.rate, pick: () => onChange({ ...v, rate: r }), total: emiOf(loan, r, v.tenure) * v.tenure * 12 - loan })))
            .map(row => {
              const diff = row.emi - base.emi
              return (
                <button key={row.key} type="button" onClick={row.pick} aria-pressed={row.on}
                  className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-left transition-colors hover:bg-[#F9FAFB]"
                  style={row.on ? { background: '#EFF4FF', borderColor: '#84ADFF' } : { borderColor: BORDER, boxShadow: XS }}>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold" style={{ color: row.on ? BLUE : TEXT }}>{row.label}</span>
                    <span className="block text-[12.5px]" style={{ color: SUBTLE }}>{inr(row.total)} interest</span>
                  </span>
                  <span className="text-right text-[12.5px] font-semibold tabular-nums" style={{ color: row.on ? LABEL : diff > 0 ? '#B42318' : GREEN_D }}>
                    {row.on ? 'Now' : `${diff > 0 ? '+' : '−'}${rupees(Math.abs(diff)).replace('−', '')}`}
                  </span>
                  <span className="min-w-[88px] text-right text-[15px] font-bold tabular-nums" style={{ color: TEXT }}>{rupees(row.emi)}</span>
                </button>
              )
            })}
        </div>
        <Basis>{compare === 'tenure' ? 'A longer tenure lowers the EMI but adds interest.' : `Home loan rates are mostly floating. Each 0.5% rise adds about ${rupees(bump)} to this EMI.`}</Basis>
      </Panel>

      <Panel icon={<UserCircle size={17} weight="bold" />} title="What the buyer needs">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Figure label="Take-home pay needed" value={`${inr(base.emi / (v.foir / 100))} a month`} sub={`EMI at ${v.foir}% of take-home`} />
          {v.mode === 'price'
            ? <Figure label="Cash upfront" value={inr(down)} sub="Down payment, before stamp duty" />
            : <Figure label="EMI per lakh borrowed" value={rupees(emiOf(100_000, v.rate, v.tenure))} sub={`at ${v.rate}% for ${v.tenure} years`} />}
        </div>
        <div className="mt-3.5 flex flex-col gap-2">
          <span className="text-[13px] font-semibold" style={{ color: TEXT_2 }}>Bank&apos;s EMI limit (share of take-home pay)</span>
          <ChoiceRow label="EMI limit" value={String(v.foir)} onChange={x => set('foir')(Number(x))}
            options={[40, 50, 60].map(x => ({ id: String(x), label: `${x}%` }))} />
          <Assumption>Banks cap all of a buyer&apos;s EMIs at a share of take-home pay. The share depends on the bank and the buyer&apos;s income, and existing EMIs count too.</Assumption>
        </div>
        {v.mode === 'price' && (
          <div className="no-print mt-4 flex flex-wrap gap-2">
            <Btn size="sm" onClick={() => onStampDuty(v.price)}><Stamp size={15} weight="bold" />Stamp duty on {inr(v.price)}<ArrowRight size={13} weight="bold" /></Btn>
            <Btn size="sm" onClick={onProject}><ChartLineUp size={15} weight="bold" />5-year projection<ArrowRight size={13} weight="bold" /></Btn>
          </div>
        )}
      </Panel>

      <p className="m-0 flex items-start gap-2 px-1 text-[12.5px] leading-snug" style={{ color: LABEL }}>
        <Coins size={14} weight="bold" className="mt-px shrink-0" />
        Estimates on a reducing balance with a fixed rate. The bank&apos;s sanction letter has the exact EMI, fees and insurance.
      </p>
    </>
  )

  return <CalcLayout hero={hero} inputs={inputs} details={details} />
}
