'use client'

// 5-year projection: property value, loan left and equity each year under an assumed growth rate, set against
// the cash actually put in (down payment plus EMIs), so the gain and the yearly return are honest.

import { useMemo } from 'react'
import { Buildings, Bank, TrendUp, ChartBar, Table, Coins } from '@phosphor-icons/react'
import { BORDER, TEXT, TEXT_2, SUBTLE, BLUE, GREEN_D, Toggle, Panel, Select, Btn, inr } from '@/components/outreach/OutreachKit'
import { BarChart, Legend, Figure, Basis } from '@/components/insights/InsightsKit'
import {
  emiOf, balanceAfter, irr, rupees, money, pctText, MoneyField, RateField, InputCard, ResultHero, HeroTile, HeroSplit,
  Assumption, ChoiceRow, CalcLayout, MobileResult, type CalcSummary,
} from './CalcKit'

export type Scenario = 'conservative' | 'moderate' | 'optimistic'
export type ProjInputs = {
  currentMarketValue: number; initialInvestment: number; propertyType: string; scenario: Scenario
  hasLoan: boolean; loanAmount: number; loanInterestRate: number; loanTenure: number
}
export const PROJ_DEFAULTS: ProjInputs = {
  currentMarketValue: 5_000_000, initialInvestment: 1_000_000, propertyType: 'Apartment', scenario: 'moderate',
  hasLoan: true, loanAmount: 4_000_000, loanInterestRate: 8.5, loanTenure: 20,
}
/** Fixed so a shared link shows the same numbers (the public calculator page uses these three rates) */
export const SCENARIOS: Record<Scenario, { label: string; rate: number }> = {
  conservative: { label: 'Conservative', rate: 5 },
  moderate: { label: 'Moderate', rate: 7 },
  optimistic: { label: 'Optimistic', rate: 10 },
}
const TYPES = ['Apartment', 'Villa', 'Independent House', 'Plot', 'Commercial']
const THIS_YEAR = new Date().getFullYear()
const YEARS = 5

export function project(i: ProjInputs, rate: number) {
  const loan = i.hasLoan ? Math.max(0, i.loanAmount) : 0
  const emi = loan ? emiOf(loan, i.loanInterestRate, i.loanTenure) : 0
  const tm = Math.round(i.loanTenure * 12)
  const rows = Array.from({ length: YEARS + 1 }, (_, y) => {
    const m = Math.min(12 * y, tm)
    const value = i.currentMarketValue * Math.pow(1 + rate / 100, y)
    const balance = loan ? balanceAfter(loan, i.loanInterestRate, emi, m) : 0
    const emis = emi * m
    const cashIn = i.initialInvestment + emis
    const equity = value - balance
    return { year: y, cal: THIS_YEAR + y, value, balance, equity, emis, cashIn, gain: equity - cashIn, principal: loan - balance, interest: emis - (loan - balance) }
  })
  const flows = Array.from({ length: YEARS * 12 + 1 }, (_, m) => (m === 0 ? -i.initialInvestment : m <= tm ? -emi : 0))
  flows[YEARS * 12] += rows[YEARS].equity
  return { loan, emi, rows, final: rows[YEARS], ret: irr(flows, 12) }
}

export function projSummary(i: ProjInputs): CalcSummary {
  const s = SCENARIOS[i.scenario]
  const p = project(i, s.rate)
  const f = p.final
  const lines = [
    `Property: ${i.propertyType}, worth ${inr(i.currentMarketValue)} today`,
    ...(p.loan ? [`Loan: ${inr(p.loan)} at ${i.loanInterestRate}% for ${i.loanTenure} years (EMI ${rupees(p.emi)})`] : []),
    `In ${f.cal}, at ${s.rate}% a year (${s.label.toLowerCase()}): worth ${inr(f.value)}${p.loan ? `, loan left ${inr(f.balance)}` : ''}`,
    `Equity: *${inr(f.equity)}*`,
    `Cash put in: ${inr(f.cashIn)} · Gain if sold: ${money(f.gain)}${p.ret != null ? ` (about ${pctText(p.ret)} a year)` : ''}`,
  ]
  const inputs: [string, string][] = [
    ['Property', i.propertyType], ['Value today', rupees(i.currentMarketValue)],
    [p.loan ? 'Down payment' : 'Amount paid', rupees(i.initialInvestment)],
    ...(p.loan ? [['Loan', `${rupees(p.loan)} at ${i.loanInterestRate}% for ${i.loanTenure} years`]] as [string, string][] : []),
    ['Price growth (assumed)', `${s.rate}% a year (${s.label})`],
  ]
  return {
    title: '5-year projection', noun: '5-year projection', headline: `Equity ${inr(f.equity)} in ${f.cal}`, lines, inputs,
    share: {
      type: 'projection',
      inputData: {
        currentMarketValue: i.currentMarketValue, scenario: i.scenario, hasLoan: i.hasLoan, loanAmount: p.loan,
        loanInterestRate: i.loanInterestRate, loanTenure: i.loanTenure, initialInvestment: i.initialInvestment, propertyType: i.propertyType,
      },
    },
  }
}

export function ProjectionCalculator({ value: v, onChange }: { value: ProjInputs; onChange: (v: ProjInputs) => void }) {
  const set = <K extends keyof ProjInputs>(k: K) => (x: ProjInputs[K]) => onChange({ ...v, [k]: x })
  const all = useMemo(() => ({
    conservative: project(v, SCENARIOS.conservative.rate),
    moderate: project(v, SCENARIOS.moderate.rate),
    optimistic: project(v, SCENARIOS.optimistic.rate),
  }), [v])
  const s = SCENARIOS[v.scenario]
  const p = all[v.scenario]
  const f = p.final
  const gap = v.currentMarketValue - v.initialInvestment - (v.hasLoan ? v.loanAmount : 0)

  const toggleLoan = (on: boolean) => {
    if (!on) return onChange({ ...v, hasLoan: false, initialInvestment: v.currentMarketValue })
    const loanAmount = v.loanAmount > 0 && v.loanAmount < v.currentMarketValue ? v.loanAmount : Math.round(v.currentMarketValue * 0.8)
    onChange({ ...v, hasLoan: true, loanAmount, initialInvestment: v.currentMarketValue - loanAmount })
  }

  const hero = (
    <ResultHero eyebrow={`Equity in ${f.cal}`} value={inr(f.equity)}
      sub={<>Worth {inr(f.value)}{p.loan ? `, ${inr(f.balance)} loan left` : ''}. {s.label}, {s.rate}% a year.</>}
      footer={p.loan ? <HeroSplit parts={[{ label: 'Equity', value: f.equity, color: '#FFFFFF' }, { label: 'Loan left', value: f.balance, color: '#84ADFF' }]} /> : undefined}>
      <HeroTile label="Cash put in" value={inr(f.cashIn)} sub={p.loan ? `${inr(v.initialInvestment)} down + EMIs` : 'paid upfront'} />
      <HeroTile label="Gain if sold" value={money(f.gain)} sub="equity minus cash put in" />
      <HeroTile label="Return on your cash" value={p.ret != null ? pctText(p.ret) : '—'} sub="a year" />
    </ResultHero>
  )

  const inputs = (
    <>
      <InputCard title="The property" icon={<Buildings size={15} weight="bold" />}>
        <MoneyField id="pj-value" label="Value today" value={v.currentMarketValue} onChange={set('currentMarketValue')} range={[500_000, 200_000_000]} />
        <div className="min-w-0">
          <label htmlFor="pj-type" className="mb-1.5 block text-[13px] font-semibold" style={{ color: TEXT_2 }}>Property type</label>
          <Select id="pj-type" value={v.propertyType} onChange={set('propertyType')}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <MoneyField id="pj-down" label={v.hasLoan ? 'Down payment (your cash)' : 'Amount paid'} value={v.initialInvestment} onChange={set('initialInvestment')} />
        {Math.abs(gap) >= 1000 && (
          <div className="-mt-2 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: SUBTLE }}>
            <span>{v.hasLoan ? `Down payment and loan add up to ${inr(v.initialInvestment + v.loanAmount)}, not ${inr(v.currentMarketValue)}.` : `This is ${inr(Math.abs(gap))} ${gap > 0 ? 'less' : 'more'} than the value today.`}</span>
            {v.hasLoan && v.currentMarketValue - v.initialInvestment > 0 && <Btn size="sm" variant="ghost" onClick={() => set('loanAmount')(v.currentMarketValue - v.initialInvestment)}>Set loan to {inr(v.currentMarketValue - v.initialInvestment)}</Btn>}
          </div>
        )}
      </InputCard>
      <InputCard title="Home loan" icon={<Bank size={15} weight="bold" />} right={<Toggle on={v.hasLoan} onChange={toggleLoan} label="Include a home loan" />}>
        {v.hasLoan ? (
          <>
            <MoneyField id="pj-loan" label="Loan amount" value={v.loanAmount} onChange={set('loanAmount')} range={[100_000, Math.max(200_000, v.currentMarketValue)]}
              hint={<>EMI <b style={{ color: TEXT }}>{rupees(p.emi)}</b> a month</>} />
            <RateField id="pj-rate" label="Interest rate" value={v.loanInterestRate} onChange={set('loanInterestRate')} min={1} max={20} step={0.05} unit="% a year" />
            <RateField id="pj-tenure" label="Tenure" value={v.loanTenure} onChange={set('loanTenure')} min={1} max={30} step={1} unit="years" />
          </>
        ) : undefined}
      </InputCard>
      <InputCard title="Price growth" icon={<TrendUp size={15} weight="bold" />}>
        <ChoiceRow label="Growth scenario" value={v.scenario} onChange={set('scenario')}
          options={(Object.keys(SCENARIOS) as Scenario[]).map(k => ({ id: k, label: SCENARIOS[k].label, sub: `${SCENARIOS[k].rate}% a year` }))} />
        <Assumption>Growth rates are assumptions, not forecasts. Prices can also stay flat or fall.</Assumption>
      </InputCard>
      <MobileResult label={`Equity in ${f.cal}`} value={inr(f.equity)} sub={`${s.label} · gain ${money(f.gain)}`} />
    </>
  )

  const details = (
    <>
      <Panel icon={<ChartBar size={17} weight="bold" />} title="How the equity builds" sub="Each bar is the property's value: your share and what is still owed."
        right={<Legend items={[{ label: 'Equity', color: BLUE }, ...(p.loan ? [{ label: 'Loan left', color: '#D0D5DD' }] : [])]} />}>
        <BarChart format={inr} height={200} points={p.rows.map(r => ({
          tick: String(r.cal), label: r.year ? `${r.cal}, year ${r.year}` : `${r.cal}, today`,
          parts: [{ key: 'e', label: 'Equity', value: Math.max(0, r.equity), color: BLUE }, ...(p.loan ? [{ key: 'b', label: 'Loan left', value: r.balance, color: '#D0D5DD' }] : [])],
        }))} />
      </Panel>

      <Panel icon={<Table size={17} weight="bold" />} title="Year by year">
        <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor: BORDER }}>
          <table className="w-full border-collapse whitespace-nowrap text-[13.5px]">
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th className="px-2.5 py-2.5 sm:px-3 text-left text-[12px] font-semibold" style={{ color: SUBTLE }}>Year</th>
                <th className="px-2.5 py-2.5 sm:px-3 text-right text-[12px] font-semibold" style={{ color: SUBTLE }}>Value</th>
                {p.loan > 0 && <th className="hidden px-2.5 py-2.5 sm:px-3 text-right text-[12px] font-semibold sm:table-cell" style={{ color: SUBTLE }}>Loan left</th>}
                <th className="px-2.5 py-2.5 sm:px-3 text-right text-[12px] font-semibold" style={{ color: SUBTLE }}>Equity</th>
                <th className="hidden px-2.5 py-2.5 sm:px-3 text-right text-[12px] font-semibold md:table-cell" style={{ color: SUBTLE }}>Cash put in</th>
                <th className="px-2.5 py-2.5 sm:px-3 text-right text-[12px] font-semibold" style={{ color: SUBTLE }}>Gain</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map(r => (
                <tr key={r.year} className="border-t" style={{ borderColor: '#F2F4F7', background: r.year === 0 ? '#F9FAFB' : undefined }}>
                  <td className="px-2.5 py-2.5 sm:px-3 font-semibold" style={{ color: TEXT }}>{r.cal}<span className="ml-1 text-[12px] font-normal" style={{ color: SUBTLE }}>{r.year ? '' : 'now'}</span></td>
                  <td className="px-2.5 py-2.5 sm:px-3 text-right tabular-nums" style={{ color: TEXT_2 }}>{inr(r.value)}</td>
                  {p.loan > 0 && <td className="hidden px-2.5 py-2.5 sm:px-3 text-right tabular-nums sm:table-cell" style={{ color: TEXT_2 }}>{inr(r.balance)}</td>}
                  <td className="px-2.5 py-2.5 sm:px-3 text-right font-semibold tabular-nums" style={{ color: TEXT }}>{inr(r.equity)}</td>
                  <td className="hidden px-2.5 py-2.5 sm:px-3 text-right tabular-nums md:table-cell" style={{ color: TEXT_2 }}>{inr(r.cashIn)}</td>
                  <td className="px-2.5 py-2.5 sm:px-3 text-right font-semibold tabular-nums" style={{ color: r.gain >= 0 ? GREEN_D : '#B42318' }}>{r.year ? money(r.gain) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Basis>Gain is equity minus everything put in so far (the {p.loan ? 'down payment and EMIs' : 'amount paid'}).</Basis>
      </Panel>

      {p.loan > 0 && (
        <Panel icon={<Coins size={17} weight="bold" />} title="The loan over these 5 years" sub={`${rupees(p.emi)} a month for ${Math.min(60, Math.round(v.loanTenure * 12))} months.`}>
          <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-3">
            <Figure label="EMIs paid" value={inr(f.emis)} />
            <Figure label="Went to interest" value={inr(f.interest)} sub={`${pctText(f.emis ? (f.interest / f.emis) * 100 : 0, 0)} of the EMIs`} />
            <Figure label="Loan repaid" value={inr(f.principal)} tone={GREEN_D} sub={`${pctText(p.loan ? (f.principal / p.loan) * 100 : 0, 0)} of the loan`} />
          </div>
        </Panel>
      )}

      <Panel icon={<TrendUp size={17} weight="bold" />} title="Three scenarios" sub="Tap one to use it.">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {(Object.keys(SCENARIOS) as Scenario[]).map(k => {
            const q = all[k], on = k === v.scenario
            return (
              <button key={k} type="button" onClick={() => set('scenario')(k)} aria-pressed={on}
                className="cursor-pointer rounded-[14px] border px-4 py-3.5 text-left transition-colors hover:bg-[#F9FAFB]"
                style={on ? { background: '#EFF4FF', borderColor: '#84ADFF', boxShadow: '0 0 0 3px rgba(29,78,216,0.08)' } : { borderColor: BORDER }}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold" style={{ color: on ? BLUE : TEXT }}>{SCENARIOS[k].label}</span>
                  <span className="text-[12.5px]" style={{ color: SUBTLE }}>{SCENARIOS[k].rate}% a year</span>
                </span>
                <span className="mt-2 block text-[22px] font-semibold tabular-nums leading-tight" style={{ color: TEXT }}>{inr(q.final.equity)}</span>
                <span className="block text-[12.5px]" style={{ color: SUBTLE }}>equity in {q.final.cal}</span>
                <span className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 whitespace-nowrap border-t pt-2.5 text-[12.5px]" style={{ borderColor: '#F2F4F7', color: TEXT_2 }}>
                  <span>Gain <b className="tabular-nums" style={{ color: q.final.gain >= 0 ? GREEN_D : '#B42318' }}>{money(q.final.gain)}</b></span>
                  <span>Return <b className="tabular-nums">{q.ret != null ? pctText(q.ret) : '—'}</b></span>
                </span>
              </button>
            )
          })}
        </div>
        <Basis>Leaves out rent, maintenance, property tax, stamp duty and selling costs.</Basis>
      </Panel>
    </>
  )

  return <CalcLayout hero={hero} inputs={inputs} details={details} />
}
