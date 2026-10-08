'use client'

// Stamp duty and registration for nine states, with each state's own rules (women's concessions, area,
// slabs, caps, fixed fees). Rates checked in October 2026; the page says so and asks to confirm before paying.

import { useMemo } from 'react'
import { MapPin, Buildings, Info, ListChecks, MapTrifold } from '@phosphor-icons/react'
import { BORDER, TEXT, TEXT_2, SUBTLE, LABEL, BLUE, BLUE_BG, XS, Seg, Select, Toggle, Panel, inr } from '@/components/outreach/OutreachKit'
import { Basis } from '@/components/insights/InsightsKit'
import {
  rupees, pctText, MoneyField, InputCard, ResultHero, HeroTile, HeroSplit, Line, TotalRow, CalcLayout, MobileResult, type CalcSummary,
} from './CalcKit'

export type Buyer = 'male' | 'female' | 'joint'
export type PropKind = 'residential' | 'commercial'
export type StampInputs = { state: StateId; area: string; value: number; govValue: number; kind: PropKind; buyer: Buyer; newFlat: boolean }
export const STAMP_DEFAULTS: StampInputs = { state: 'MH', area: 'mumbai', value: 8_000_000, govValue: 0, kind: 'residential', buyer: 'male', newFlat: false }
export const RATES_CHECKED = 'October 2026'

type StateId = 'MH' | 'KA' | 'DL' | 'HR' | 'UP' | 'TS' | 'TN' | 'GJ' | 'WB'
type Charge = { label: string; sub?: string; amount: number; reg?: boolean }
type Ctx = { area: string; base: number; buyer: Buyer; kind: PropKind; newFlat: boolean }
type Rule = {
  label: string
  govName: string
  areas: { id: string; label: string }[]
  calc: (c: Ctx) => { charges: Charge[]; notes: string[] }
  regRule: string
}

const L = 100_000, CR = 10_000_000
const pctOf = (base: number, p: number) => (base * p) / 100
const duty = (label: string, base: number, p: number, sub?: string): Charge => ({ label: `${label} (${+p.toFixed(2)}%)`, sub, amount: pctOf(base, p) })
const WOMEN_ONLY = 'Every buyer must be a woman for the lower rate.'

/** Haryana charges a fixed registration fee by value */
function hrFee(v: number) {
  const slabs: [number, number][] = [[50_000, 100], [5 * L, 1_000], [10 * L, 5_000], [20 * L, 10_000], [25 * L, 12_500], [30 * L, 15_000], [40 * L, 20_000], [50 * L, 25_000], [60 * L, 30_000], [70 * L, 35_000], [80 * L, 40_000], [90 * L, 45_000]]
  return slabs.find(([top]) => v <= top)?.[1] ?? 50_000
}

export const STATES: Record<StateId, Rule> = {
  MH: {
    label: 'Maharashtra', govName: 'ready reckoner value',
    areas: [
      { id: 'mumbai', label: 'Mumbai (BMC)' },
      { id: 'corp', label: 'Pune, PCMC, Thane, Navi Mumbai, Nagpur and other corporations' },
      { id: 'council', label: 'Municipal council or cantonment' },
      { id: 'village', label: 'Gram panchayat (village)' },
    ],
    regRule: '1% of the value, capped at ₹30,000',
    calc: ({ area, base, buyer, kind }) => {
      const women = kind === 'residential' && buyer === 'female'
      const off = women ? 1 : 0
      const charges: Charge[] =
        area === 'mumbai' ? [duty('Stamp duty', base, 5 - off), duty('Metro cess', base, 1)]
        : area === 'corp' ? [duty('Stamp duty', base, 5 - off), duty('Local body tax', base, 1), duty('Metro cess', base, 1)]
        : [duty('Stamp duty', base, (area === 'council' ? 4 : 3) - off)]
      charges.push({ label: 'Registration (1%, max ₹30,000)', amount: Math.min(30_000, pctOf(base, 1)), reg: true })
      const notes = [women ? `Women buyers pay 1% less on homes. ${WOMEN_ONLY}` : 'Women buying a home pay 1% less stamp duty.']
      if (area === 'council' || area === 'village') notes.push('Council and village rates vary by area. Confirm locally.')
      return { charges, notes }
    },
  },
  KA: {
    label: 'Karnataka', govName: 'guidance value',
    areas: [{ id: 'urban', label: 'Urban (BBMP and city corporations)' }, { id: 'rural', label: 'Rural' }],
    regRule: '2% of the value, no cap (since 31 Aug 2025)',
    calc: ({ area, base, buyer }) => ({
      charges: [
        duty('Stamp duty', base, 5),
        { label: 'Cess (10% of the duty)', amount: pctOf(base, 0.5) },
        { label: `Surcharge (${area === 'rural' ? 3 : 2}% of the duty)`, amount: pctOf(base, area === 'rural' ? 0.15 : 0.1) },
        { label: 'Registration (2%)', amount: pctOf(base, 2), reg: true },
      ],
      notes: [
        'A lower duty (2% up to ₹20 L, 3% from ₹20 L to ₹45 L) may apply to the first sale of a new flat. Check before quoting.',
        ...(buyer === 'female' ? ['Karnataka has no lower rate for women.'] : []),
      ],
    }),
  },
  DL: {
    label: 'Delhi', govName: 'circle rate value',
    areas: [{ id: 'mcd', label: 'MCD areas' }, { id: 'ndmc', label: 'NDMC (New Delhi)' }, { id: 'cantt', label: 'Delhi Cantonment' }],
    regRule: '1% of the value plus a ₹100 pasting fee',
    calc: ({ area, base, buyer, kind }) => {
      const b: Buyer = kind === 'commercial' ? 'male' : buyer
      const t = area === 'cantt' ? { male: 3, female: 3, joint: 3 }
        : area === 'ndmc' ? { male: 5.5, female: 3.5, joint: 4.5 }
        : base <= 25 * L ? { male: 6, female: 4, joint: 5 } : { male: 7, female: 5, joint: 6 }
      return {
        charges: [
          duty('Stamp duty', base, t[b], area === 'mcd' && base > 25 * L ? 'Includes the extra 1% MCD transfer duty above ₹25 L' : undefined),
          { label: 'Registration (1%)', amount: pctOf(base, 1), reg: true },
          { label: 'Pasting fee', amount: 100, reg: true },
        ],
        notes: [kind === 'residential' ? `Women pay 2% less, and a man and woman buying together pay 1% less. ${buyer === 'female' ? WOMEN_ONLY : ''}`.trim() : 'Commercial property pays the standard rate.'],
      }
    },
  },
  HR: {
    label: 'Haryana', govName: 'collector rate value',
    areas: [{ id: 'urban', label: 'Within municipal limits' }, { id: 'rural', label: 'Rural' }],
    regRule: 'A fixed fee by value, from ₹100 up to ₹50,000 above ₹90 L',
    calc: ({ area, base, buyer, kind }) => {
      const b: Buyer = kind === 'commercial' ? 'male' : buyer
      const t = area === 'rural' ? { male: 5, female: 3, joint: 4 } : { male: 7, female: 5, joint: 6 }
      return {
        charges: [duty('Stamp duty', base, t[b]), { label: 'Registration fee (fixed)', amount: hrFee(base), reg: true }],
        notes: [kind === 'residential' ? 'Women pay 2% less, and a man and woman buying together pay 1% less.' : 'Commercial property pays the standard rate.'],
      }
    },
  },
  UP: {
    label: 'Uttar Pradesh', govName: 'circle rate value',
    areas: [],
    regRule: '1% of the value, no cap',
    calc: ({ base, buyer, kind }) => {
      const rebate = kind === 'residential' && base <= CR ? (buyer === 'female' ? 1 : buyer === 'joint' ? 0.5 : 0) : 0
      return {
        charges: [duty('Stamp duty', base, 7 - rebate, rebate ? 'After the women\'s rebate' : undefined), { label: 'Registration (1%)', amount: pctOf(base, 1), reg: true }],
        notes: [
          'Women get a 1% rebate (0.5% when buying with a man) on homes up to ₹1 Cr.',
          ...(kind === 'residential' && base > CR && buyer !== 'male' ? ['Above ₹1 Cr the rebate may be capped or not apply, so it is left out here. Confirm.'] : []),
        ],
      }
    },
  },
  TS: {
    label: 'Telangana', govName: 'market value',
    areas: [],
    regRule: '0.5% of the value',
    calc: ({ base }) => ({
      charges: [duty('Stamp duty', base, 5.5), duty('Transfer duty', base, 1.5), { label: 'Registration (0.5%)', amount: pctOf(base, 0.5), reg: true }],
      notes: ['The same 7.5% applies to new and resale property, for every buyer.'],
    }),
  },
  TN: {
    label: 'Tamil Nadu', govName: 'guideline value',
    areas: [],
    regRule: '2% of the value (1% for women buyers up to ₹10 L)',
    calc: ({ base, buyer, kind, newFlat }) => {
      const nf = kind === 'residential' && newFlat
      const p = nf ? (base <= 50 * L ? 4 : base <= 3 * CR ? 5 : 7) : 7
      const reg = kind === 'residential' && buyer === 'female' && base <= 10 * L ? 1 : 2
      return {
        charges: [duty('Stamp and transfer duty', base, p, nf ? 'First sale of a new flat, on the combined value' : undefined), { label: `Registration (${reg}%)`, amount: pctOf(base, reg), reg: true }],
        notes: [
          nf ? 'New flats from a builder pay 4% up to ₹50 L, 5% up to ₹3 Cr, then 7%, on the combined land and building value.' : 'A first sale of a new flat may pay less. Turn on "First sale of a new flat" to see it.',
          ...(reg === 1 ? [`Women pay 1% registration on homes up to ₹10 L. ${WOMEN_ONLY}`] : []),
        ],
      }
    },
  },
  GJ: {
    label: 'Gujarat', govName: 'jantri value',
    areas: [],
    regRule: '1% of the value, waived when every buyer is a woman',
    calc: ({ base, buyer, kind }) => {
      const waived = kind === 'residential' && buyer === 'female'
      return {
        charges: [
          duty('Stamp duty', base, 3.5),
          { label: 'Surcharge (40% of the duty)', amount: pctOf(base, 1.4) },
          { label: waived ? 'Registration (waived)' : 'Registration (1%)', amount: waived ? 0 : pctOf(base, 1), reg: true },
        ],
        notes: [
          waived ? `Registration is free for women. ${WOMEN_ONLY}` : 'Registration is free when every buyer is a woman.',
          ...(kind === 'commercial' ? ['Commercial rates can differ slightly. Confirm.'] : []),
        ],
      }
    },
  },
  WB: {
    label: 'West Bengal', govName: 'market value',
    areas: [{ id: 'municipal', label: 'Kolkata and other municipal areas' }, { id: 'panchayat', label: 'Panchayat areas' }],
    regRule: 'About 1% of the value',
    calc: ({ area, base }) => {
      const p = area === 'panchayat' ? (base <= CR ? 5 : 6) : (base <= CR ? 6 : 7)
      return {
        charges: [duty('Stamp duty', base, p), { label: 'Registration (about 1%)', amount: pctOf(base, 1), reg: true }],
        notes: ['Stamp duty goes up by 1% above ₹1 Cr.'],
      }
    },
  },
}
const IDS = Object.keys(STATES) as StateId[]
export const isStateId = (x: string): x is StateId => x in STATES

export function stampNumbers(i: StampInputs) {
  const rule = STATES[i.state]
  const area = rule.areas.find(a => a.id === i.area)?.id ?? rule.areas[0]?.id ?? ''
  const base = Math.max(i.value, i.govValue)
  const { charges, notes } = rule.calc({ area, base, buyer: i.buyer, kind: i.kind, newFlat: i.newFlat })
  const dutyTotal = charges.filter(c => !c.reg).reduce((s, c) => s + c.amount, 0)
  const regTotal = charges.filter(c => c.reg).reduce((s, c) => s + c.amount, 0)
  const total = dutyTotal + regTotal
  return { rule, area, areaLabel: rule.areas.find(a => a.id === area)?.label ?? null, base, charges, notes, dutyTotal, regTotal, total, pct: base ? (total / base) * 100 : 0 }
}

const BUYERS: { id: Buyer; label: string }[] = [{ id: 'male', label: 'Man' }, { id: 'female', label: 'Woman' }, { id: 'joint', label: 'Man + woman' }]

export function stampSummary(i: StampInputs): CalcSummary {
  const r = stampNumbers(i)
  const lines = [
    `${r.rule.label}${r.areaLabel ? `, ${r.areaLabel}` : ''}`,
    `${i.kind === 'residential' ? 'Home' : 'Commercial property'} worth ${inr(i.value)}${r.base > i.value ? ` (duty on the ${r.rule.govName} of ${inr(r.base)})` : ''}`,
    `Stamp duty: ${inr(r.dutyTotal)}`,
    `Registration: ${rupees(r.regTotal)}`,
    `Total: *${inr(r.total)}* (${pctText(r.pct, 2)}), so the property costs ${inr(i.value + r.total)} in all`,
    `Rates as of ${RATES_CHECKED}. The final amount is set at registration.`,
  ]
  const inputs: [string, string][] = [
    ['State', r.rule.label], ...(r.areaLabel ? [['Area', r.areaLabel]] as [string, string][] : []),
    ['Property value', rupees(i.value)], ...(i.govValue ? [[`Government ${r.rule.govName}`, rupees(i.govValue)]] as [string, string][] : []),
    ['Property type', i.kind === 'residential' ? 'Residential' : 'Commercial'],
    ...(i.kind === 'residential' ? [['Buyer', BUYERS.find(b => b.id === i.buyer)!.label]] as [string, string][] : []),
    ...(i.state === 'TN' && i.kind === 'residential' ? [['First sale of a new flat', i.newFlat ? 'Yes' : 'No']] as [string, string][] : []),
  ]
  return { title: 'Stamp duty', noun: 'stamp duty estimate', headline: `Stamp duty and registration ${inr(r.total)}`, lines, inputs, share: null }
}

export function StampDutyCalculator({ value: v, onChange }: { value: StampInputs; onChange: (v: StampInputs) => void }) {
  const set = <K extends keyof StampInputs>(k: K) => (x: StampInputs[K]) => onChange({ ...v, [k]: x })
  const r = useMemo(() => stampNumbers(v), [v])
  const pickState = (s: StateId) => onChange({ ...v, state: s, area: STATES[s].areas[0]?.id ?? '' })

  const across = useMemo(() => IDS.map(id => {
    const x = stampNumbers({ ...v, state: id, area: id === v.state ? v.area : STATES[id].areas[0]?.id ?? '' })
    return { id, label: STATES[id].label, area: x.areaLabel, total: x.total, pct: x.pct }
  }).sort((a, b) => a.total - b.total), [v])
  const top = Math.max(1, ...across.map(a => a.total))

  const rates = useMemo(() => BUYERS.map(b => ({ ...b, ...stampNumbers({ ...v, buyer: b.id }) })), [v])

  const hero = (
    <ResultHero eyebrow="Stamp duty and registration" value={inr(r.total)}
      sub={<>{pctText(r.pct, 2)} of {inr(r.base)} in {r.rule.label}{r.base > v.value ? `, on the ${r.rule.govName}` : ''}.</>}
      footer={<HeroSplit parts={[{ label: 'Stamp duty', value: r.dutyTotal, color: '#FFFFFF' }, { label: 'Registration', value: r.regTotal, color: '#84ADFF' }]} />}>
      <HeroTile label="Stamp duty" value={inr(r.dutyTotal)} sub={pctText(r.base ? (r.dutyTotal / r.base) * 100 : 0, 2)} />
      <HeroTile label="Registration" value={rupees(r.regTotal)} />
      <HeroTile label="Total cost of buying" value={inr(v.value + r.total)} sub="price plus charges" />
    </ResultHero>
  )

  const inputs = (
    <>
      <InputCard title="Where" icon={<MapPin size={15} weight="bold" />}>
        <div className="min-w-0">
          <label htmlFor="sd-state" className="mb-1.5 block text-[13px] font-semibold" style={{ color: TEXT_2 }}>State</label>
          <Select id="sd-state" value={v.state} onChange={x => isStateId(x) && pickState(x)}>
            {IDS.map(id => <option key={id} value={id}>{STATES[id].label}</option>)}
          </Select>
        </div>
        {r.rule.areas.length > 0 && (
          <div className="min-w-0">
            <label htmlFor="sd-area" className="mb-1.5 block text-[13px] font-semibold" style={{ color: TEXT_2 }}>Area</label>
            <Select id="sd-area" value={r.area} onChange={set('area')}>
              {r.rule.areas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </div>
        )}
      </InputCard>
      <InputCard title="Property" icon={<Buildings size={15} weight="bold" />}>
        <MoneyField id="sd-value" label="Property value" value={v.value} onChange={set('value')} range={[500_000, 200_000_000]} />
        <MoneyField id="sd-gov" label={`Government ${r.rule.govName}`} value={v.govValue} onChange={set('govValue')} optional
          hint="Duty is charged on the higher of the deal value and this. Leave it empty if you don't have it." />
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: TEXT_2 }}>Property type</span>
          <Seg label="Property type" full value={v.kind} onChange={set('kind')} options={[{ id: 'residential', label: 'Residential' }, { id: 'commercial', label: 'Commercial' }]} />
        </div>
        {v.kind === 'residential' && (
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: TEXT_2 }}>Buyer</span>
            <Seg label="Buyer" full value={v.buyer} onChange={set('buyer')} options={BUYERS} />
            <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: SUBTLE }}>Pick Woman when every buyer is a woman.</p>
          </div>
        )}
        {v.state === 'TN' && v.kind === 'residential' && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold" style={{ color: TEXT_2 }}>First sale of a new flat</span>
            <Toggle on={v.newFlat} onChange={set('newFlat')} label="First sale of a new flat" />
          </div>
        )}
      </InputCard>
      <MobileResult label="Stamp duty and registration" value={inr(r.total)} sub={`${pctText(r.pct, 2)} in ${r.rule.label}`} />
    </>
  )

  const details = (
    <>
      <Panel icon={<ListChecks size={17} weight="bold" />} title="Breakdown" sub={`${r.rule.label}${r.areaLabel ? `, ${r.areaLabel}` : ''}`}>
        <Line label="Property value" value={rupees(v.value)} sub={r.base > v.value ? `Duty is on the ${r.rule.govName}: ${rupees(r.base)}` : undefined} />
        {r.charges.map(c => <Line key={c.label} label={c.label} sub={c.sub} value={rupees(c.amount)} tone={c.reg ? '#079455' : BLUE} />)}
        <TotalRow label="Total charges" sub={`${pctText(r.pct, 2)} of ${inr(r.base)}`} value={rupees(r.total)} />
        <TotalRow label="Total cost of buying" value={rupees(v.value + r.total)} />
        {r.notes.length > 0 && (
          <ul className="m-0 mt-3.5 flex list-none flex-col gap-2 p-0">
            {r.notes.map(n => (
              <li key={n} className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: TEXT_2 }}>
                <Info size={15} weight="bold" className="mt-px shrink-0" style={{ color: BLUE }} />{n}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {v.kind === 'residential' && (
        <Panel icon={<Info size={17} weight="bold" />} title={`Rates in ${r.rule.label}`} sub={`For ${inr(r.base)}${r.areaLabel ? `, ${r.areaLabel}` : ''}. Registration: ${r.rule.regRule}.`}>
          <div className="grid grid-cols-3 gap-2">
            {rates.map(b => {
              const on = b.id === v.buyer
              return (
                <button key={b.id} type="button" onClick={() => set('buyer')(b.id)} aria-pressed={on}
                  className="min-w-0 cursor-pointer rounded-[12px] border px-2 py-3 text-center transition-colors"
                  style={on ? { background: BLUE_BG, borderColor: '#84ADFF' } : { borderColor: BORDER, boxShadow: XS }}>
                  <span className="block text-[12.5px] font-medium leading-tight" style={{ color: on ? BLUE : SUBTLE }}>{b.label}</span>
                  <span className="mt-1 block text-[20px] font-semibold tabular-nums leading-tight" style={{ color: TEXT }}>{pctText(b.base ? (b.dutyTotal / b.base) * 100 : 0, 2)}</span>
                  <span className="block truncate text-[12px] tabular-nums" style={{ color: SUBTLE }}>{inr(b.total)} in all</span>
                </button>
              )
            })}
          </div>
        </Panel>
      )}

      <Panel icon={<MapTrifold size={17} weight="bold" />} title="Across states" sub={`The same ${inr(v.value)} ${v.kind === 'residential' ? `home, ${BUYERS.find(b => b.id === v.buyer)!.label.toLowerCase()} buying` : 'commercial property'}. Tap a state to use it.`}>
        <div className="flex flex-col gap-1">
          {across.map(a => {
            const on = a.id === v.state
            return (
              <button key={a.id} type="button" onClick={() => pickState(a.id)} aria-pressed={on}
                className="grid cursor-pointer grid-cols-[minmax(0,130px)_minmax(0,1fr)_64px] items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-[#F9FAFB]"
                style={on ? { background: BLUE_BG } : undefined}>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold" style={{ color: on ? BLUE : TEXT }}>{a.label}</span>
                  {a.area && <span className="block truncate text-[11.5px]" style={{ color: LABEL }}>{a.area}</span>}
                </span>
                <span className="h-2 overflow-hidden rounded-full" style={{ background: '#F2F4F7' }}>
                  <span className="block h-full rounded-full" style={{ width: `${(a.total / top) * 100}%`, background: on ? BLUE : '#98A2B3' }} />
                </span>
                <span className="text-right">
                  <span className="block text-[13.5px] font-semibold tabular-nums" style={{ color: TEXT }}>{inr(a.total)}</span>
                  <span className="block text-[11.5px] tabular-nums" style={{ color: SUBTLE }}>{pctText(a.pct, 2)}</span>
                </span>
              </button>
            )
          })}
        </div>
        <Basis>Each state uses its main city area unless it is the state you picked.</Basis>
      </Panel>

      <p className="m-0 flex items-start gap-2 rounded-[12px] border px-3.5 py-3 text-[12.5px] leading-snug" style={{ borderColor: '#FEDF89', background: '#FFFAEB', color: '#93370D' }}>
        <Info size={15} weight="bold" className="mt-px shrink-0" />
        <span>Rates as of {RATES_CHECKED}. States change them often and some areas have their own rules, so confirm with the sub-registrar or the state&apos;s registration portal before the buyer pays.</span>
      </p>
    </>
  )

  return <CalcLayout hero={hero} inputs={inputs} details={details} />
}
