'use client'

// Rental yield: gross and net yield, where the rent goes, yearly cash flow, the position after N years and
// how the return compares with other options (whose rates the user sets).

import { useMemo, useState, type ReactNode } from 'react'
import { House, Receipt, Bank, TrendUp, ArrowsLeftRight, Wallet, ChartBar } from '@phosphor-icons/react'
import { BORDER, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, GREEN_D, XS, Toggle, Panel, inr } from '@/components/outreach/OutreachKit'
import { Figure, Basis } from '@/components/insights/InsightsKit'
import {
  emiOf, balanceAfter, irr, clamp, rupees, money, pctText, MoneyField, RateField, InputCard, ResultHero, HeroTile,
  Line, TotalRow, Assumption, SignedBars, CalcLayout, MobileResult, type CalcSummary,
} from './CalcKit'

export type RentalInputs = {
  propertyPrice: number; monthlyRent: number; occupancyRate: number
  monthlyMaintenance: number; annualPropertyTax: number; annualInsurance: number; managementFeePercent: number
  useFinancing: boolean; loanAmount: number; loanInterestRate: number; loanTenure: number
  appreciationRate: number; rentIncreaseRate: number; years: number
  fdRate: number; reitRate: number; stockRate: number
}
export const RENTAL_DEFAULTS: RentalInputs = {
  propertyPrice: 5_000_000, monthlyRent: 20_000, occupancyRate: 90,
  monthlyMaintenance: 3_000, annualPropertyTax: 25_000, annualInsurance: 5_000, managementFeePercent: 5,
  useFinancing: false, loanAmount: 4_000_000, loanInterestRate: 8.5, loanTenure: 20,
  appreciationRate: 7, rentIncreaseRate: 5, years: 10,
  fdRate: 7, reitRate: 9, stockRate: 12,
}

/** Net yield bands used across LeadGap */
const BANDS = [
  { id: 'Poor', from: 0, to: 2.5, color: '#F97066', tone: '#D92D20' },
  { id: 'Marginal', from: 2.5, to: 4, color: '#FDB022', tone: '#B54708' },
  { id: 'Good', from: 4, to: 6, color: '#84ADFF', tone: BLUE },
  { id: 'Excellent', from: 6, to: 8, color: '#47CD89', tone: GREEN_D },
] as const
const bandOf = (y: number) => (y >= 6 ? BANDS[3] : y >= 4 ? BANDS[2] : y >= 2.5 ? BANDS[1] : BANDS[0])

export function rentalNumbers(i: RentalInputs) {
  const price = Math.max(0, i.propertyPrice)
  const gross = i.monthlyRent * 12
  const effective = gross * (i.occupancyRate / 100)
  const vacancy = gross - effective
  const mgmt = effective * (i.managementFeePercent / 100)
  const maint = i.monthlyMaintenance * 12
  const taxIns = i.annualPropertyTax + i.annualInsurance
  const noi = effective - maint - taxIns - mgmt
  const grossYield = price ? (gross / price) * 100 : 0
  const netYield = price ? (noi / price) * 100 : 0
  const loan = i.useFinancing ? clamp(i.loanAmount, 0, price) : 0
  const emi = loan ? emiOf(loan, i.loanInterestRate, i.loanTenure) : 0
  const cashIn = price - loan
  const n = Math.max(1, Math.round(i.years))
  const yearly = Array.from({ length: n }, (_, k) => {
    const rent = i.monthlyRent * Math.pow(1 + i.rentIncreaseRate / 100, k) * 12 * (i.occupancyRate / 100)
    const yNoi = rent - maint - taxIns - rent * (i.managementFeePercent / 100)
    const emiMonths = clamp(i.loanTenure * 12 - k * 12, 0, 12)
    return { year: k + 1, noi: yNoi, debt: emi * emiMonths, cash: yNoi - emi * emiMonths }
  })
  const cum = yearly.reduce((s, y) => s + y.cash, 0)
  const value = price * Math.pow(1 + i.appreciationRate / 100, n)
  const balance = loan ? balanceAfter(loan, i.loanInterestRate, emi, Math.min(n * 12, i.loanTenure * 12)) : 0
  const equity = value - balance
  const gain = equity + cum - cashIn
  const flows = [-cashIn, ...yearly.map(y => y.cash)]
  flows[n] += equity
  const ret = cashIn > 0 ? irr(flows) : null
  const cash1 = noi - emi * Math.min(12, i.loanTenure * 12)
  return {
    price, gross, effective, vacancy, mgmt, maint, taxIns, noi, grossYield, netYield, loan, emi, cashIn, n, yearly, cum,
    value, balance, equity, gain, ret, cash1, coc: cashIn > 0 ? (cash1 / cashIn) * 100 : null, band: bandOf(netYield),
  }
}

export function rentalSummary(i: RentalInputs): CalcSummary {
  const r = rentalNumbers(i)
  const lines = [
    `Property: ${inr(r.price)}, rent ${rupees(i.monthlyRent)} a month (${i.occupancyRate}% occupied)`,
    `Gross yield: ${pctText(r.grossYield, 2)} · Net yield: *${pctText(r.netYield, 2)}* (${r.band.id})`,
    `Net income after costs: ${inr(r.noi)} a year`,
    ...(r.loan ? [`With a ${inr(r.loan)} loan: ${money(r.cash1 / 12)} a month after the EMI`] : []),
    ...(r.ret != null ? [`Over ${r.n} years at ${i.appreciationRate}% price growth and ${i.rentIncreaseRate}% rent growth: about ${pctText(r.ret)} a year`] : []),
  ]
  const inputs: [string, string][] = [
    ['Property price', rupees(r.price)], ['Monthly rent', rupees(i.monthlyRent)], ['Occupancy', `${i.occupancyRate}%`],
    ['Maintenance', `${rupees(i.monthlyMaintenance)} a month`], ['Property tax', `${rupees(i.annualPropertyTax)} a year`],
    ['Insurance', `${rupees(i.annualInsurance)} a year`], ['Management fee', `${i.managementFeePercent}% of rent collected`],
    ...(r.loan ? [['Loan', `${rupees(r.loan)} at ${i.loanInterestRate}% for ${i.loanTenure} years`]] as [string, string][] : []),
    ['Price growth (assumed)', `${i.appreciationRate}% a year`], ['Rent growth (assumed)', `${i.rentIncreaseRate}% a year`], ['Holding period', `${r.n} years`],
  ]
  return {
    title: 'Rental yield', noun: 'rental yield estimate', headline: `Net yield ${pctText(r.netYield, 2)}`, lines, inputs,
    share: {
      type: 'rental_yield',
      inputData: {
        propertyPrice: i.propertyPrice, monthlyRent: i.monthlyRent, occupancyRate: i.occupancyRate,
        monthlyMaintenance: i.monthlyMaintenance, annualPropertyTax: i.annualPropertyTax, annualInsurance: i.annualInsurance,
        managementFeePercent: i.managementFeePercent, years: r.n,
        useFinancing: i.useFinancing, loanAmount: r.loan, loanInterestRate: i.loanInterestRate, loanTenure: i.loanTenure,
        appreciationRate: i.appreciationRate, rentIncreaseRate: i.rentIncreaseRate,
      },
    },
  }
}

function YieldScale({ value }: { value: number }) {
  const max = 8
  return (
    <div>
      <div className="relative">
        <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full">
          {BANDS.map(b => <span key={b.id} style={{ flexGrow: b.to - b.from, flexBasis: 0, background: b.color, opacity: bandOf(value).id === b.id ? 1 : 0.45 }} />)}
        </div>
        <span aria-hidden className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white"
          style={{ left: `${clamp(value / max, 0, 1) * 100}%`, borderColor: '#0E1A5A', boxShadow: '0 0 0 2px #fff' }} />
      </div>
      <div className="mt-2 flex text-[11.5px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
        {BANDS.map(b => (
          <span key={b.id} className="min-w-0 truncate" style={{ flexGrow: b.to - b.from, flexBasis: 0, fontWeight: bandOf(value).id === b.id ? 700 : 500, color: bandOf(value).id === b.id ? '#FFFFFF' : undefined }}>
            {b.id} {b.id === 'Excellent' ? '6%+' : `${b.from}–${b.to}%`}
          </span>
        ))}
      </div>
    </div>
  )
}

function RateCell({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <span className="flex h-8 items-center rounded-[8px] border bg-white pr-2" style={{ borderColor: '#D0D5DD', boxShadow: XS }}>
      <input id={id} aria-label="Assumed return" inputMode="decimal" value={text ?? String(value)}
        onFocus={() => setText(String(value))} onBlur={() => setText(null)}
        onChange={e => { const t = e.target.value.replace(/[^\d.]/g, ''); setText(t); const x = parseFloat(t); onChange(Number.isFinite(x) ? clamp(x, 0, 40) : 0) }}
        className="w-[42px] bg-transparent px-1.5 text-right text-[13.5px] font-semibold tabular-nums outline-none" style={{ color: TEXT }} />
      <span className="text-[12.5px]" style={{ color: SUBTLE }}>%</span>
    </span>
  )
}

export function RentalYieldCalculator({ value: v, onChange }: { value: RentalInputs; onChange: (v: RentalInputs) => void }) {
  const set = <K extends keyof RentalInputs>(k: K) => (x: RentalInputs[K]) => onChange({ ...v, [k]: x })
  const r = useMemo(() => rentalNumbers(v), [v])
  const emptyMonths = +(12 * (1 - v.occupancyRate / 100)).toFixed(1)

  const hero = (
    <ResultHero eyebrow="Net rental yield" value={pctText(r.netYield, 2)}
      sub={<>Gross {pctText(r.grossYield, 2)}. Rent after costs, on a {inr(r.price)} price.</>}
      badge={<span className="rounded-full bg-white px-3 py-1 text-[13px] font-bold" style={{ color: r.band.tone }}>{r.band.id}</span>}
      footer={<YieldScale value={r.netYield} />}>
      <HeroTile label="Net income" value={`${inr(r.noi)}`} sub={`a year · ${rupees(r.noi / 12)} a month`} />
      <HeroTile label={r.loan ? 'Cash flow after EMI' : 'Cash flow'} value={money(r.cash1 / 12)} sub="a month, year 1" />
      <HeroTile label={`Return over ${r.n} years`} value={r.ret != null ? pctText(r.ret) : '—'} sub="a year, with growth" />
    </ResultHero>
  )

  const inputs = (
    <>
      <InputCard title="Property and rent" icon={<House size={15} weight="bold" />}>
        <MoneyField id="ry-price" label="Property price" value={v.propertyPrice} onChange={set('propertyPrice')} range={[500_000, 200_000_000]} />
        <MoneyField id="ry-rent" label="Monthly rent" value={v.monthlyRent} onChange={set('monthlyRent')} range={[2_000, 1_000_000]}
          hint={`${inr(v.monthlyRent * 12)} a year`} />
        <RateField id="ry-occ" label="Occupancy" value={v.occupancyRate} onChange={set('occupancyRate')} min={50} max={100} step={1} unit="%"
          hint={emptyMonths ? `About ${emptyMonths} month${emptyMonths === 1 ? '' : 's'} empty a year` : 'Let all year'} />
      </InputCard>
      <InputCard title="Running costs" icon={<Receipt size={15} weight="bold" />}>
        <MoneyField id="ry-maint" label="Maintenance a month" value={v.monthlyMaintenance} onChange={set('monthlyMaintenance')} />
        <div className="grid gap-4 min-[420px]:grid-cols-2">
          <MoneyField id="ry-tax" label="Property tax a year" value={v.annualPropertyTax} onChange={set('annualPropertyTax')} />
          <MoneyField id="ry-ins" label="Insurance a year" value={v.annualInsurance} onChange={set('annualInsurance')} />
        </div>
        <RateField id="ry-mgmt" label="Management fee" value={v.managementFeePercent} onChange={set('managementFeePercent')} min={0} max={15} step={0.5} unit="%"
          hint="Of the rent collected. Use 0 if the owner manages it." />
      </InputCard>
      <InputCard title="Loan" icon={<Bank size={15} weight="bold" />} right={<Toggle on={v.useFinancing} onChange={set('useFinancing')} label="Bought with a loan" />}>
        {v.useFinancing ? (
          <>
            <MoneyField id="ry-loan" label="Loan amount" value={v.loanAmount} onChange={set('loanAmount')} range={[100_000, Math.max(200_000, v.propertyPrice)]}
              hint={<>EMI <b style={{ color: TEXT }}>{rupees(r.emi)}</b> a month · down payment {inr(r.cashIn)}</>} />
            <RateField id="ry-rate" label="Interest rate" value={v.loanInterestRate} onChange={set('loanInterestRate')} min={1} max={20} step={0.05} unit="% a year" />
            <RateField id="ry-tenure" label="Tenure" value={v.loanTenure} onChange={set('loanTenure')} min={1} max={30} step={1} unit="years" />
          </>
        ) : undefined}
      </InputCard>
      <InputCard title="Growth" icon={<TrendUp size={15} weight="bold" />}>
        <RateField id="ry-app" label="Price growth" value={v.appreciationRate} onChange={set('appreciationRate')} min={0} max={15} step={0.5} unit="% a year" />
        <RateField id="ry-rentup" label="Rent increase" value={v.rentIncreaseRate} onChange={set('rentIncreaseRate')} min={0} max={15} step={0.5} unit="% a year" />
        <RateField id="ry-years" label="Holding period" value={v.years} onChange={set('years')} min={1} max={30} step={1} unit="years" />
        <Assumption>Growth rates are your assumptions, not forecasts. Costs are kept flat.</Assumption>
      </InputCard>
      <MobileResult label="Net yield" value={pctText(r.netYield, 2)} sub={`${r.band.id} · ${inr(r.noi)} a year after costs`} />
    </>
  )

  const max = r.gross || 1
  const neg = '#F97066'
  const others = [
    { id: 'fd', label: 'Fixed deposit', rate: v.fdRate, set: set('fdRate') },
    { id: 'reit', label: 'REITs', rate: v.reitRate, set: set('reitRate') },
    { id: 'stocks', label: 'Stock market', rate: v.stockRate, set: set('stockRate') },
  ]
  const top = Math.max(15, r.ret ?? 0, ...others.map(o => o.rate))
  const grow = (rate: number) => r.cashIn * Math.pow(1 + rate / 100, r.n)

  const details = (
    <>
      <Panel icon={<Wallet size={17} weight="bold" />} title="Where the rent goes" sub="One year, from the full rent down to what the owner keeps.">
        <Line label="Rent for the year" sub={`${rupees(v.monthlyRent)} × 12`} value={rupees(r.gross)} bar={{ value: r.gross, max, color: BLUE }} />
        <Line label="Empty months" sub={`${100 - v.occupancyRate}% of the year`} value={money(-r.vacancy)} tone="#B42318" bar={{ value: r.vacancy, max, color: neg }} />
        <Line label="Maintenance" value={money(-r.maint)} tone="#B42318" bar={{ value: r.maint, max, color: neg }} />
        <Line label="Property tax and insurance" value={money(-r.taxIns)} tone="#B42318" bar={{ value: r.taxIns, max, color: neg }} />
        <Line label="Management fee" sub={`${v.managementFeePercent}% of rent collected`} value={money(-r.mgmt)} tone="#B42318" bar={{ value: r.mgmt, max, color: neg }} />
        {r.loan > 0 && <Line label="Loan EMIs" sub={`${rupees(r.emi)} × 12`} value={money(-r.emi * 12)} tone="#B42318" bar={{ value: r.emi * 12, max, color: neg }} />}
        <TotalRow label={r.loan ? 'Cash flow after EMIs' : 'Net income'} sub={`${money(r.cash1 / 12)} a month`} value={money(r.cash1)} tone={r.cash1 >= 0 ? GREEN_D : '#B42318'} />
      </Panel>

      <Panel icon={<ChartBar size={17} weight="bold" />} title="Cash flow, year by year" sub={`Rent grows ${v.rentIncreaseRate}% a year${r.loan ? ', EMIs stop when the loan ends' : ''}.`}>
        <SignedBars points={r.yearly.map(y => ({ tick: `Y${y.year}`, label: `Year ${y.year}`, value: y.cash }))} format={money} />
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <Figure label={`Total, ${r.n} yrs`} value={money(r.cum)} tone={r.cum >= 0 ? TEXT : '#B42318'} />
          <Figure label="Year 1" value={money(r.yearly[0]?.cash ?? 0)} />
          <Figure label={`Year ${r.n}`} value={money(r.yearly[r.n - 1]?.cash ?? 0)} />
        </div>
      </Panel>

      <Panel icon={<TrendUp size={17} weight="bold" />} title={`After ${r.n} years`} sub={`If the price grows ${v.appreciationRate}% a year and the property is then sold.`}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Figure label="Property value" value={inr(r.value)} sub={`from ${inr(r.price)}`} />
          <Figure label="Price gain" value={money(r.value - r.price)} tone={GREEN_D} />
          <Figure label="Rent cash flow" value={money(r.cum)} sub={`over ${r.n} years`} />
          {r.loan > 0 && <Figure label="Loan left" value={inr(r.balance)} sub={r.balance ? 'paid from the sale' : 'paid off'} />}
          <Figure label="Total gain" value={money(r.gain)} tone={r.gain >= 0 ? GREEN_D : '#B42318'} sub={`on ${inr(r.cashIn)} put in`} />
          <Figure label="Return a year" value={r.ret != null ? pctText(r.ret) : '—'} sub="rent plus growth (IRR)" />
          {r.loan > 0 && r.coc != null && <Figure label="Cash-on-cash, year 1" value={pctText(r.coc)} sub="cash flow ÷ cash put in" />}
        </div>
        <Basis>Leaves out stamp duty, registration, tax on the rent and selling costs.</Basis>
      </Panel>

      <Panel icon={<ArrowsLeftRight size={17} weight="bold" />} title="Compared with other options" sub={`What ${inr(r.cashIn)} could grow to in ${r.n} years.`}>
        <div className="flex flex-col gap-2">
          <CompareRow label="This property" strong rate={r.ret} top={top} grown={r.ret != null ? grow(r.ret) : null} />
          {others.map(o => <CompareRow key={o.id} label={o.label} rate={o.rate} top={top} grown={grow(o.rate)} input={<RateCell id={`ry-${o.id}`} value={o.rate} onChange={o.set} />} />)}
        </div>
        <div className="mt-3"><Assumption>The rates for the other options are your assumptions. Edit them to today&apos;s rates. This property&apos;s rate is its yearly return from the inputs on the left.</Assumption></div>
      </Panel>
    </>
  )

  return <CalcLayout hero={hero} inputs={inputs} details={details} />
}

function CompareRow({ label, rate, top, grown, strong, input }: { label: string; rate: number | null; top: number; grown: number | null; strong?: boolean; input?: ReactNode }) {
  return (
    <div className="rounded-[12px] border px-3.5 py-3" style={strong ? { background: '#EFF4FF', borderColor: '#84ADFF' } : { borderColor: BORDER }}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[14px] font-semibold" style={{ color: strong ? BLUE : TEXT }}>{label}</span>
        <span className="flex shrink-0 items-center gap-2.5">
          {input ?? <span className="text-[14px] font-bold tabular-nums" style={{ color: BLUE }}>{rate != null ? pctText(rate) : '—'}</span>}
          <span className="min-w-[72px] text-right text-[13px] tabular-nums" style={{ color: TEXT_2 }}>{grown != null ? inr(grown) : '—'}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: '#F2F4F7' }}>
        <div className="h-full rounded-full" style={{ width: `${rate != null ? clamp((rate / top) * 100, 0, 100) : 0}%`, background: strong ? BLUE : LABEL }} />
      </div>
    </div>
  )
}
