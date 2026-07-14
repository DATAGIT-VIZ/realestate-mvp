'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Calculator,
  TrendingUp,
  ChevronLeft,
  Share2,
  Download,
  Building,
  BarChart3,
  CheckCircle,
  X,
  Loader2,
  Copy,
  MessageCircle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  LineChart,
  Line,
} from 'recharts'

type CalculatorTab = 'rental-yield' | 'investment' | 'stamp-duty'

const formatCurrency = (value: number, decimals = 0): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(decimals)} Cr`
  if (value >= 100000)   return `₹${(value / 100000).toFixed(decimals)} L`
  if (value >= 1000)     return `₹${(value / 1000).toFixed(decimals)}K`
  return `₹${value.toFixed(decimals)}`
}

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-IN').format(Math.round(value))

// ── Shared design tokens ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0',
  borderRadius: 10, fontSize: 13, color: '#0F172A', outline: 'none',
  background: '#fff', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 6,
}
const panelStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24,
}
const heroGrad: React.CSSProperties = {
  padding: '20px 22px',
  background: 'linear-gradient(135deg, #4c00b0 0%, #b100cd 100%)',
}
const tipStyle = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }

// ── Slider row helper ─────────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step = 1, suffix = '%', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={labelStyle}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#a000c8' }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#a000c8' }} />
    </div>
  )
}

// ── INR input helper ──────────────────────────────────────────────────────────
function INRInput({ label, value, hint, onChange }: {
  label: string; value: number; hint?: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: 13 }}>₹</span>
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ ...inputStyle, paddingLeft: 24 }} />
      </div>
      {hint && <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

// ── Section divider ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '4px 0 12px' }}>
      {children}
    </p>
  )
}

// ── Stat box ─────────────────────────────────────────────────────────────────
function StatBox({ label, value, color = '#0F172A' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
      <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, color, margin: 0 }}>{value}</p>
    </div>
  )
}

// ============================================
// TAB 1: RENTAL YIELD CALCULATOR
// ============================================
function RentalYieldCalculator() {
  const [propertyPrice, setPropertyPrice]           = useState(5000000)
  const [monthlyRent, setMonthlyRent]               = useState(20000)
  const [occupancyRate, setOccupancyRate]           = useState(90)
  const [monthlyMaintenance, setMonthlyMaintenance] = useState(3000)
  const [annualPropertyTax, setAnnualPropertyTax]   = useState(25000)
  const [annualInsurance, setAnnualInsurance]       = useState(5000)
  const [managementFeePercent, setManagementFeePercent] = useState(5)
  const [useFinancing, setUseFinancing]             = useState(false)
  const [loanAmount, setLoanAmount]                 = useState(4000000)
  const [loanInterestRate, setLoanInterestRate]     = useState(8.5)
  const [loanTenure, setLoanTenure]                 = useState(20)
  const [appreciationRate, setAppreciationRate]     = useState(7)
  const [rentIncreaseRate, setRentIncreaseRate]     = useState(5)
  const [years, setYears]                           = useState(10)

  const calculations = useMemo(() => {
    const annualGrossRent   = monthlyRent * 12
    const effectiveRent     = annualGrossRent * (occupancyRate / 100)
    const managementFee     = effectiveRent * (managementFeePercent / 100)
    const annualMaintenance = monthlyMaintenance * 12
    const totalExpenses     = annualMaintenance + annualPropertyTax + annualInsurance + managementFee
    const netOperatingIncome = effectiveRent - totalExpenses

    const grossYield = (annualGrossRent / propertyPrice) * 100
    const netYield   = (netOperatingIncome / propertyPrice) * 100
    const capRate    = netYield

    let monthlyEMI = 0, annualEMI = 0
    let downPayment = propertyPrice, cashOnCashReturn = netYield
    if (useFinancing && loanAmount > 0) {
      const r = loanInterestRate / 100 / 12, m = loanTenure * 12
      monthlyEMI = (loanAmount * r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1)
      annualEMI  = monthlyEMI * 12
      downPayment = propertyPrice - loanAmount
      cashOnCashReturn = downPayment > 0 ? ((netOperatingIncome - annualEMI) / downPayment) * 100 : 0
    }

    const annualCashFlow = netOperatingIncome - (useFinancing ? annualEMI : 0)

    const yearlyData: { year: string; cashFlow: number; cumulativeCashFlow: number }[] = []
    let cumulative = 0
    let currentRent = monthlyRent
    for (let y = 1; y <= years; y++) {
      const yGross = currentRent * 12 * (occupancyRate / 100)
      const yMgmt  = yGross * (managementFeePercent / 100)
      const yExp   = annualMaintenance + annualPropertyTax + annualInsurance + yMgmt
      const yNOI   = yGross - yExp
      const yCF    = yNOI - (useFinancing ? annualEMI : 0)
      cumulative  += yCF
      yearlyData.push({ year: `Y${y}`, cashFlow: Math.round(yCF), cumulativeCashFlow: Math.round(cumulative) })
      currentRent = currentRent * (1 + rentIncreaseRate / 100)
    }

    const finalValue       = propertyPrice * Math.pow(1 + appreciationRate / 100, years)
    const totalCapitalGain = finalValue - propertyPrice
    const totalROI         = ((totalCapitalGain + cumulative) / downPayment) * 100
    const annualizedROI    = (Math.pow(1 + totalROI / 100, 1 / years) - 1) * 100

    let verdict = 'Poor'
    if (netYield >= 6) verdict = 'Excellent'
    else if (netYield >= 4) verdict = 'Good'
    else if (netYield >= 2.5) verdict = 'Marginal'

    const verdictColor = verdict === 'Excellent' ? '#059669' : verdict === 'Good' ? '#a000c8' : verdict === 'Marginal' ? '#be2ed6' : '#EF4444'

    return {
      grossYield, netYield, capRate, netOperatingIncome, totalExpenses,
      effectiveRent, managementFee, monthlyEMI, annualEMI, downPayment,
      cashOnCashReturn, annualCashFlow, yearlyData, finalValue,
      totalCapitalGain, totalROI, annualizedROI, verdict, verdictColor,
    }
  }, [propertyPrice, monthlyRent, occupancyRate, monthlyMaintenance, annualPropertyTax, annualInsurance,
    managementFeePercent, useFinancing, loanAmount, loanInterestRate, loanTenure, appreciationRate, rentIncreaseRate, years])

  const comparisons = [
    { name: 'Fixed Deposit',  rate: 7,  color: '#94A3B8' },
    { name: 'REITs',          rate: 9,  color: '#a000c8' },
    { name: 'Stock Market',   rate: 12, color: '#059669' },
    { name: 'This Property',  rate: calculations.annualizedROI, color: '#a000c8' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

      {/* ── Left: Inputs ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={panelStyle}>
          <SectionLabel>Property & Rent</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <INRInput label="Property Price" value={propertyPrice} hint={formatCurrency(propertyPrice)} onChange={setPropertyPrice} />
            <INRInput label="Monthly Rent" value={monthlyRent} hint={`${formatCurrency(monthlyRent * 12)}/yr`} onChange={setMonthlyRent} />
            <SliderRow label="Occupancy Rate" value={occupancyRate} min={70} max={100} onChange={setOccupancyRate} />
          </div>
        </div>

        <div style={panelStyle}>
          <SectionLabel>Annual Expenses</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <INRInput label="Maintenance / Month" value={monthlyMaintenance} hint={`${formatCurrency(monthlyMaintenance * 12)}/yr`} onChange={setMonthlyMaintenance} />
            <INRInput label="Annual Property Tax" value={annualPropertyTax} onChange={setAnnualPropertyTax} />
            <INRInput label="Annual Insurance" value={annualInsurance} onChange={setAnnualInsurance} />
            <SliderRow label="Management Fee" value={managementFeePercent} min={0} max={15} onChange={setManagementFeePercent} />
          </div>
        </div>

        <div style={panelStyle}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: useFinancing ? 14 : 0 }}>
            <input type="checkbox" checked={useFinancing} onChange={e => setUseFinancing(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#a000c8' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Include Financing</span>
          </label>
          {useFinancing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <INRInput label="Loan Amount" value={loanAmount} hint={formatCurrency(loanAmount)} onChange={setLoanAmount} />
              <SliderRow label="Interest Rate" value={loanInterestRate} min={6} max={15} step={0.1} onChange={setLoanInterestRate} />
              <SliderRow label="Loan Tenure" value={loanTenure} min={5} max={30} suffix=" yrs" onChange={setLoanTenure} />
              <div style={{ background: 'rgba(160,0,200,0.05)', border: '1px solid rgba(160,0,200,0.15)', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 11, color: '#a000c8', margin: '0 0 2px' }}>Monthly EMI</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#a000c8', margin: 0 }}>₹{formatNumber(calculations.monthlyEMI)}</p>
              </div>
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <SectionLabel>Growth Assumptions</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SliderRow label="Property Appreciation" value={appreciationRate} min={3} max={15} suffix="%/yr" onChange={setAppreciationRate} />
            <SliderRow label="Rent Increase Rate" value={rentIncreaseRate} min={2} max={10} suffix="%/yr" onChange={setRentIncreaseRate} />
            <SliderRow label="Investment Period" value={years} min={1} max={20} suffix=" yrs" onChange={setYears} />
          </div>
        </div>
      </div>

      {/* ── Right: Results ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Hero card */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={heroGrad}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Net Rental Yield</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>{calculations.netYield.toFixed(2)}%</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '6px 0 0' }}>
              Gross {calculations.grossYield.toFixed(2)}% · Annualized ROI {calculations.annualizedROI.toFixed(1)}%
            </p>
          </div>
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatBox label="Gross Yield" value={`${calculations.grossYield.toFixed(2)}%`} color="#a000c8" />
            <StatBox label={useFinancing ? 'Cash-on-Cash' : 'Cap Rate'} value={`${(useFinancing ? calculations.cashOnCashReturn : calculations.capRate).toFixed(2)}%`} color="#a000c8" />
            <StatBox label="Net Annual Cash Flow" value={formatCurrency(calculations.annualCashFlow)} color={calculations.annualCashFlow >= 0 ? '#059669' : '#EF4444'} />
            <div style={{ background: `${calculations.verdictColor}10`, border: `1px solid ${calculations.verdictColor}30`, borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px' }}>Verdict</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: calculations.verdictColor, margin: 0 }}>{calculations.verdict}</p>
            </div>
          </div>
        </div>

        {/* Cash flow breakdown */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>Annual Cash Flow Breakdown</p>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: '+ Rental Income (after vacancy)', value: calculations.effectiveRent, color: '#a000c8' },
              { label: '- Maintenance', value: -monthlyMaintenance * 12, color: '#be2ed6' },
              { label: '- Taxes & Insurance', value: -(annualPropertyTax + annualInsurance), color: '#be2ed6' },
              { label: '- Management Fees', value: -calculations.managementFee, color: '#be2ed6' },
              ...(useFinancing ? [{ label: '- Loan EMI', value: -calculations.annualEMI, color: '#EF4444' }] : []),
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value >= 0 ? '+' : ''}{formatCurrency(row.value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginTop: 10, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Net Annual Cash Flow</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: calculations.annualCashFlow >= 0 ? '#059669' : '#EF4444' }}>
                {calculations.annualCashFlow >= 0 ? '+' : ''}{formatCurrency(calculations.annualCashFlow)}
              </span>
            </div>
          </div>
        </div>

        {/* Cash flow chart */}
        <div style={{ ...panelStyle }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 14px' }}>Annual Cash Flow ({years} years)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calculations.yearlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v, 0)} />
              <Tooltip contentStyle={tipStyle} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="cashFlow" name="Cash Flow" fill="#a000c8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Compare to other investments */}
        <div style={panelStyle}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 14px' }}>vs Other Investments</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comparisons.map((item, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: item.name === 'This Property' ? 700 : 400, color: item.name === 'This Property' ? '#0F172A' : '#64748B' }}>{item.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.rate.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: `${Math.min(item.rate * 5, 100)}%`, background: item.color, borderRadius: 99, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* After N Years */}
        <div style={panelStyle}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 14px' }}>After {years} Years</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatBox label="Property Value"  value={formatCurrency(calculations.finalValue)}       color="#a000c8" />
            <StatBox label="Capital Gain"    value={formatCurrency(calculations.totalCapitalGain)} color="#059669" />
            <StatBox label="Total Cash Flow" value={formatCurrency(calculations.yearlyData[calculations.yearlyData.length - 1]?.cumulativeCashFlow ?? 0)} color={calculations.annualCashFlow >= 0 ? '#a000c8' : '#EF4444'} />
            <StatBox label="Total ROI"       value={`${calculations.totalROI.toFixed(0)}%`}        color="#a000c8" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// TAB 2: 5-YEAR INVESTMENT PROJECTION
// ============================================
function InvestmentProjection() {
  const currentYear = new Date().getFullYear()
  const [initialInvestment, setInitialInvestment]   = useState(1000000)
  const [currentMarketValue, setCurrentMarketValue] = useState(5000000)
  const [propertyType, setPropertyType]             = useState('Apartment')
  const [scenario, setScenario]                     = useState<'conservative' | 'moderate' | 'optimistic'>('moderate')
  const [hasLoan, setHasLoan]                       = useState(true)
  const [loanAmount, setLoanAmount]                 = useState(4000000)
  const [loanInterestRate, setLoanInterestRate]     = useState(8.5)
  const [loanTenure, setLoanTenure]                 = useState(20)

  const scenarioRates = { conservative: 5, moderate: 7, optimistic: 10 }

  const calculations = useMemo(() => {
    const projectionYears = 5

    let monthlyEMI = 0, annualEMI = 0
    if (hasLoan && loanAmount > 0) {
      const r = loanInterestRate / 100 / 12, m = loanTenure * 12
      monthlyEMI = (loanAmount * r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1)
      annualEMI  = monthlyEMI * 12
    }

    const calcBalance = (start: number, rate: number, emi: number, elapsed: number) => {
      let bal = start
      const mr = rate / 100 / 12
      for (let m = 0; m < elapsed * 12 && bal > 0; m++) {
        const int = bal * mr
        bal = Math.max(0, bal - (emi - int))
      }
      return bal
    }

    const genProjection = (rate: number) => {
      const data: { year: number; calendarYear: number; propertyValue: number; equity: number; loanBalance: number; netWorth: number; yoyGrowth: number; principalPaid: number }[] = []
      let prev = initialInvestment
      for (let y = 0; y <= projectionYears; y++) {
        const pv  = currentMarketValue * Math.pow(1 + rate / 100, y)
        const lb  = hasLoan ? calcBalance(loanAmount, loanInterestRate, monthlyEMI, y) : 0
        const eq  = pv - lb
        const nw  = eq
        const yoy = y === 0 ? 0 : ((nw - prev) / Math.abs(prev)) * 100
        const prevLB = y === 0 ? loanAmount : calcBalance(loanAmount, loanInterestRate, monthlyEMI, y - 1)
        data.push({ year: y, calendarYear: currentYear + y, propertyValue: pv, equity: eq, loanBalance: lb, netWorth: nw, yoyGrowth: yoy, principalPaid: y === 0 ? 0 : prevLB - lb })
        prev = nw
      }
      return data
    }

    const conservative = genProjection(scenarioRates.conservative)
    const moderate     = genProjection(scenarioRates.moderate)
    const optimistic   = genProjection(scenarioRates.optimistic)
    const main = scenario === 'conservative' ? conservative : scenario === 'optimistic' ? optimistic : moderate

    const final = main[projectionYears]
    const init  = main[0]

    return {
      main, conservative, moderate, optimistic,
      totalAppreciation:  final.propertyValue - init.propertyValue,
      appreciationPercent: ((final.propertyValue - init.propertyValue) / init.propertyValue) * 100,
      equityBuilt:        final.equity,
      loanPaidDown:       hasLoan ? loanAmount - final.loanBalance : 0,
      totalWealthCreated: final.netWorth - init.netWorth,
      currentLTV:         hasLoan ? (loanAmount / currentMarketValue) * 100 : 0,
      finalLTV:           hasLoan ? (final.loanBalance / final.propertyValue) * 100 : 0,
      monthlyEMI, annualEMI,
    }
  }, [currentMarketValue, scenario, hasLoan, loanAmount, loanInterestRate, loanTenure, initialInvestment, currentYear])

  const chartData = calculations.main.map(d => ({
    year:           d.calendarYear.toString(),
    'Property Value': Math.round(d.propertyValue),
    'Equity':         Math.round(d.equity),
    'Loan Balance':   Math.round(d.loanBalance),
  }))

  const compData = calculations.main.map((d, i) => ({
    year:                d.calendarYear.toString(),
    'Conservative (5%)': Math.round(calculations.conservative[i].netWorth),
    'Moderate (7%)':     Math.round(calculations.moderate[i].netWorth),
    'Optimistic (10%)':  Math.round(calculations.optimistic[i].netWorth),
  }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

      {/* ── Left: Inputs ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={panelStyle}>
          <SectionLabel>Property Details</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <INRInput label="Down Payment (Initial Investment)" value={initialInvestment} hint={formatCurrency(initialInvestment)} onChange={setInitialInvestment} />
            <INRInput label="Current Market Value" value={currentMarketValue} hint={formatCurrency(currentMarketValue)} onChange={setCurrentMarketValue} />
            <div>
              <label style={labelStyle}>Property Type</label>
              <select value={propertyType} onChange={e => setPropertyType(e.target.value)} style={inputStyle}>
                {['Apartment', 'Villa', 'Independent House', 'Plot', 'Commercial'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={panelStyle}>
          <SectionLabel>Appreciation Scenario</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { key: 'conservative', label: 'Conservative', rate: '5%' },
              { key: 'moderate',     label: 'Moderate',     rate: '7%' },
              { key: 'optimistic',   label: 'Optimistic',   rate: '10%' },
            ] as const).map(({ key, label, rate }) => (
              <button key={key} onClick={() => setScenario(key)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${scenario === key ? '#a000c8' : '#E2E8F0'}`, background: scenario === key ? 'rgba(160,0,200,0.06)' : '#fff', color: scenario === key ? '#a000c8' : '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <div>{label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{rate}/yr</div>
              </button>
            ))}
          </div>
        </div>

        <div style={panelStyle}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: hasLoan ? 14 : 0 }}>
            <input type="checkbox" checked={hasLoan} onChange={e => setHasLoan(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#a000c8' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Include Home Loan</span>
          </label>
          {hasLoan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <INRInput label="Loan Amount" value={loanAmount} hint={formatCurrency(loanAmount)} onChange={setLoanAmount} />
              <SliderRow label="Interest Rate" value={loanInterestRate} min={6} max={15} step={0.1} onChange={setLoanInterestRate} />
              <SliderRow label="Loan Tenure" value={loanTenure} min={5} max={30} suffix=" yrs" onChange={setLoanTenure} />
              {hasLoan && (
                <div style={{ background: 'rgba(160,0,200,0.05)', border: '1px solid rgba(160,0,200,0.15)', borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ fontSize: 11, color: '#a000c8', margin: '0 0 2px' }}>Monthly EMI</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#a000c8', margin: 0 }}>₹{formatNumber(calculations.monthlyEMI)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Results ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Hero card */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={heroGrad}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Equity by {currentYear + 5}</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>{formatCurrency(calculations.equityBuilt)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '6px 0 0' }}>
              +{calculations.appreciationPercent.toFixed(1)}% property growth · {scenario} scenario
            </p>
          </div>
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatBox label="Total Appreciation" value={formatCurrency(calculations.totalAppreciation)} color="#059669" />
            <StatBox label="Loan Paid Down"     value={formatCurrency(calculations.loanPaidDown)}      color="#a000c8" />
            <StatBox label="Wealth Created"     value={formatCurrency(calculations.totalWealthCreated)} color="#a000c8" />
            <StatBox label="Annualized Return"  value={`${(calculations.appreciationPercent / 5).toFixed(1)}%/yr`} color="#be2ed6" />
          </div>
        </div>

        {/* 5-Year table */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>Year-by-Year Projection</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Year', 'Property Value', 'Equity', 'Loan Balance', 'Net Worth', 'YoY'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Year' ? 'left' : 'right', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calculations.main.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid #F1F5F9', background: row.year === 0 ? 'rgba(160,0,200,0.03)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: '#0F172A' }}>{row.calendarYear}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#059669' }}>{formatCurrency(row.propertyValue)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#a000c8' }}>{formatCurrency(row.equity)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#be2ed6' }}>{formatCurrency(row.loanBalance)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#a000c8' }}>{formatCurrency(row.netWorth)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: row.yoyGrowth > 0 ? '#059669' : '#64748B' }}>
                      {row.year === 0 ? '—' : `+${row.yoyGrowth.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Wealth growth chart */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>Wealth Growth</p>
            <div style={{ display: 'flex', gap: 12 }}>
              {[{ label: 'Property Value', color: '#059669' }, { label: 'Equity', color: '#a000c8' }, ...(hasLoan ? [{ label: 'Loan Balance', color: '#be2ed6' }] : [])].map(l => (
                <span key={l.label} style={{ fontSize: 10, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v, 0)} />
              <Tooltip contentStyle={tipStyle} formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="Property Value" stroke="#059669" fill="#059669" fillOpacity={0.12} strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Equity"         stroke="#a000c8" fill="#a000c8" fillOpacity={0.18} strokeWidth={2} dot={false} />
              {hasLoan && <Area type="monotone" dataKey="Loan Balance" stroke="#be2ed6" fill="#be2ed6" fillOpacity={0.08} strokeWidth={2} dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Scenario comparison */}
        <div style={panelStyle}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 14px' }}>Scenario Comparison (Equity after 5 years)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {([
              { key: 'conservative', label: 'Conservative 5%', value: calculations.conservative[5]?.netWorth ?? 0 },
              { key: 'moderate',     label: 'Moderate 7%',     value: calculations.moderate[5]?.netWorth ?? 0 },
              { key: 'optimistic',   label: 'Optimistic 10%',  value: calculations.optimistic[5]?.netWorth ?? 0 },
            ] as const).map(s => (
              <div key={s.key} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 12, background: scenario === s.key ? 'rgba(160,0,200,0.06)' : '#F8FAFC', border: `1px solid ${scenario === s.key ? 'rgba(160,0,200,0.2)' : '#E2E8F0'}` }}>
                <p style={{ fontSize: 10, color: '#94A3B8', margin: '0 0 4px' }}>{s.label}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: scenario === s.key ? '#a000c8' : '#0F172A', margin: 0 }}>{formatCurrency(s.value)}</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={compData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v, 0)} />
              <Tooltip contentStyle={tipStyle} formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="Conservative (5%)" stroke="#94A3B8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Moderate (7%)"     stroke="#a000c8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Optimistic (10%)"  stroke="#be2ed6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ============================================
// TAB 3: STAMP DUTY CALCULATOR (unchanged)
// ============================================
const STAMP_DUTY_RATES: Record<string, {
  label:       string
  residential: { male: number; female: number; joint: number; reg: number; surcharge?: number; note?: string }
  commercial:  { rate: number; reg: number; note?: string }
  localBodies: { label: string; value: number }[]
}> = {
  MH: {
    label: 'Maharashtra',
    residential: { male: 6, female: 5, joint: 6, reg: 1, note: 'Mumbai Metro adds 1% metro cess' },
    commercial:  { rate: 5, reg: 1 },
    localBodies: [
      { label: 'Other (no surcharge)',     value: 0 },
      { label: 'Mumbai (+ 1% metro cess)', value: 1 },
      { label: 'PMC/PCMC (+ 1% LBT)',      value: 1 },
    ],
  },
  KA: {
    label: 'Karnataka',
    residential: { male: 5, female: 5, joint: 5, reg: 1, note: 'BBMP area adds 2% surcharge on stamp duty' },
    commercial:  { rate: 5, reg: 1 },
    localBodies: [
      { label: 'Other (no surcharge)',            value: 0 },
      { label: 'BBMP (Bangalore) + 2% surcharge', value: 2 },
    ],
  },
  DL: {
    label: 'Delhi',
    residential: { male: 6, female: 4, joint: 5, reg: 1, note: 'Concessional rate for women buyers' },
    commercial:  { rate: 6, reg: 1 },
    localBodies: [{ label: 'Delhi (MCD)', value: 0 }],
  },
  TS: {
    label: 'Telangana',
    residential: { male: 4, female: 4, joint: 4, reg: 0.5, note: 'Transfer duty 1.5% additional for resale' },
    commercial:  { rate: 4, reg: 0.5 },
    localBodies: [
      { label: 'Other',                  value: 0 },
      { label: 'GHMC (Hyderabad city)',  value: 0 },
    ],
  },
  TN: {
    label: 'Tamil Nadu',
    residential: { male: 7, female: 7, joint: 7, reg: 4, note: 'Registration charges are 4% of guideline value' },
    commercial:  { rate: 7, reg: 4 },
    localBodies: [{ label: 'All areas', value: 0 }],
  },
  GJ: {
    label: 'Gujarat',
    residential: { male: 4.9, female: 3.9, joint: 4.9, reg: 1, note: 'Women get 1% rebate on stamp duty' },
    commercial:  { rate: 4.9, reg: 1 },
    localBodies: [{ label: 'All areas', value: 0 }],
  },
}

function StampDutyCalculator() {
  const [state,        setState]        = useState('MH')
  const [propValue,    setPropValue]    = useState(8000000)
  const [gender,       setGender]       = useState<'male' | 'female' | 'joint'>('male')
  const [propType,     setPropType]     = useState<'residential' | 'commercial'>('residential')
  const [localBodyIdx, setLocalBodyIdx] = useState(0)
  const [isResale,     setIsResale]     = useState(false)

  const stateData = STAMP_DUTY_RATES[state]
  const localBody = stateData.localBodies[localBodyIdx] ?? stateData.localBodies[0]

  const { stampDutyPct, regPct, stampDutyAmt, regAmt, totalGovt, totalAcquisition } = useMemo(() => {
    let baseSd: number, regPct: number
    if (propType === 'commercial') {
      baseSd = stateData.commercial.rate
      regPct = stateData.commercial.reg
    } else {
      const r = stateData.residential
      baseSd = r[gender]
      regPct = r.reg
    }
    const surPct       = localBody.value
    const stampDutyPct = baseSd + surPct
    const stampDutyAmt = propValue * (stampDutyPct / 100)
    const regAmt       = propValue * (regPct / 100)
    const transferDuty = (state === 'TS' && isResale) ? propValue * 0.015 : 0
    const totalGovt    = stampDutyAmt + regAmt + transferDuty
    return { stampDutyPct, regPct, stampDutyAmt, regAmt, surchargeAmt: propValue * (surPct / 100), totalGovt, totalAcquisition: propValue + totalGovt }
  }, [state, propValue, gender, propType, localBody, isResale, stateData])

  const fmtINR = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`
    if (v >= 100000)   return `₹${(v / 100000).toFixed(2)} L`
    return `₹${Math.round(v).toLocaleString('en-IN')}`
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>Property Details</h3>
        <div>
          <label style={labelStyle}>State</label>
          <select value={state} onChange={e => { setState(e.target.value); setLocalBodyIdx(0) }} style={inputStyle}>
            {Object.entries(STAMP_DUTY_RATES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Property Value</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: 13 }}>₹</span>
            <input type="number" min={100000} step={100000} value={propValue}
              onChange={e => setPropValue(Number(e.target.value))}
              style={{ ...inputStyle, paddingLeft: 24 }} />
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{fmtINR(propValue)}</p>
        </div>
        <div>
          <label style={labelStyle}>Property Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['residential', 'commercial'] as const).map(t => (
              <button key={t} onClick={() => setPropType(t)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${propType === t ? '#a000c8' : '#E2E8F0'}`, background: propType === t ? 'rgba(160,0,200,0.06)' : '#fff', color: propType === t ? '#a000c8' : '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {propType === 'residential' && (
          <div>
            <label style={labelStyle}>Buyer</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['male', 'female', 'joint'] as const).map(g => (
                <button key={g} onClick={() => setGender(g)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${gender === g ? '#a000c8' : '#E2E8F0'}`, background: gender === g ? 'rgba(160,0,200,0.06)' : '#fff', color: gender === g ? '#a000c8' : '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}
        {stateData.localBodies.length > 1 && (
          <div>
            <label style={labelStyle}>Local Body / Area</label>
            <select value={localBodyIdx} onChange={e => setLocalBodyIdx(Number(e.target.value))} style={inputStyle}>
              {stateData.localBodies.map((lb, i) => (
                <option key={i} value={i}>{lb.label}</option>
              ))}
            </select>
          </div>
        )}
        {state === 'TS' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={isResale} onChange={e => setIsResale(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#a000c8' }} />
            <span style={{ fontSize: 13, color: '#0F172A' }}>Resale property (+ 1.5% transfer duty)</span>
          </label>
        )}
        {propType === 'residential' && stateData.residential.note && (
          <div style={{ background: 'rgba(160,0,200,0.05)', border: '1px solid rgba(160,0,200,0.15)', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontSize: 12, color: '#a000c8', margin: 0 }}>ℹ️ {stateData.residential.note}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={heroGrad}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total Govt Charges</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>{fmtINR(totalGovt)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '6px 0 0' }}>
              {((totalGovt / propValue) * 100).toFixed(2)}% of property value
            </p>
          </div>
          <div style={{ padding: '20px' }}>
            {[
              { label: 'Property Value',               value: propValue,    color: '#0F172A' },
              { label: `Stamp Duty (${stampDutyPct}%)`, value: stampDutyAmt, color: '#a000c8' },
              { label: `Registration (${regPct}%)`,    value: regAmt,       color: '#059669' },
              ...(state === 'TS' && isResale ? [{ label: 'Transfer Duty (1.5%)', value: propValue * 0.015, color: '#be2ed6' }] : []),
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{fmtINR(row.value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', marginTop: 12, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Total Acquisition Cost</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{fmtINR(totalAcquisition)}</span>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>{stateData.label} — Current Rates</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {propType === 'residential' ? (
              (['male', 'female', 'joint'] as const).map(g => (
                <div key={g} style={{ background: gender === g ? 'rgba(160,0,200,0.06)' : '#F8FAFC', border: `1px solid ${gender === g ? 'rgba(160,0,200,0.2)' : '#E2E8F0'}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: 10, color: '#94A3B8', margin: '0 0 4px', textTransform: 'capitalize' }}>{g}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>{stateData.residential[g]}%</p>
                  <p style={{ fontSize: 9, color: '#94A3B8', margin: '2px 0 0' }}>stamp duty</p>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: '#94A3B8', margin: '0 0 4px' }}>Commercial Rate</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{stateData.commercial.rate}%</p>
                <p style={{ fontSize: 9, color: '#94A3B8', margin: '2px 0 0' }}>stamp duty</p>
              </div>
            )}
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: '#64748B' }}>Registration charges</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{propType === 'residential' ? stateData.residential.reg : stateData.commercial.reg}%</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>All States — Male Residential</p>
          {Object.entries(STAMP_DUTY_RATES).map(([k, v]) => {
            const total    = v.residential.male + v.residential.reg
            const isActive = k === state
            return (
              <div key={k} onClick={() => { setState(k); setLocalBodyIdx(0) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: isActive ? 'rgba(160,0,200,0.05)' : 'transparent', marginBottom: 2 }}>
                <span style={{ fontSize: 12, color: isActive ? '#a000c8' : '#64748B', flex: 1, fontWeight: isActive ? 700 : 400 }}>{v.label}</span>
                <div style={{ flex: 2, height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(total / 15) * 100}%`, background: isActive ? '#a000c8' : '#94A3B8', borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#a000c8' : '#0F172A', minWidth: 36, textAlign: 'right' }}>{total}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE
// ============================================
export default function CalculatorsPage() {
  const [activeTab, setActiveTab]         = useState<CalculatorTab>('stamp-duty')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareLoading, setShareLoading]   = useState(false)
  const [shareUrl, setShareUrl]           = useState<string | null>(null)
  const [shareError, setShareError]       = useState<string | null>(null)
  const [agentName, setAgentName]         = useState('')
  const [agentPhone, setAgentPhone]       = useState('')
  const [companyName, setCompanyName]     = useState('Vya Pulse')
  const [clientPhone, setClientPhone]     = useState('')
  const [copied, setCopied]               = useState(false)

  const tabs = [
    { id: 'rental-yield', label: 'Rental Yield',      icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'investment',   label: '5-Year Projection', icon: <BarChart3   className="h-4 w-4" /> },
    { id: 'stamp-duty',   label: 'Stamp Duty',        icon: <Building    className="h-4 w-4" /> },
  ] as const

  const handleShare = async () => {
    setShareLoading(true)
    setShareError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const agentId = session?.user?.id || 'mock-user-id'
      const res = await fetch('/api/calculations/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, calculatorType: activeTab.replace('-', '_'), inputData: {}, agentName, agentPhone, companyName }),
      })
      const result = await res.json()
      if (result.success) setShareUrl(result.url)
      else setShareError(result.error || 'Failed to generate link')
    } catch {
      setShareError('Failed to generate shareable link')
    }
    setShareLoading(false)
  }

  const handleCopyLink = async () => {
    if (shareUrl) { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const handleWhatsAppShare = () => {
    if (!shareUrl) return
    const names: Record<string, string> = { 'rental-yield': 'Rental Yield Analysis', 'investment': '5-Year Investment Projection', 'stamp-duty': 'Stamp Duty Calculator' }
    const msg = `Hi!\n\nI've prepared a *${names[activeTab]}* for you.\n\nView here:\n${shareUrl}\n\nBest regards,\n${agentName || 'Your Real Estate Agent'}`
    const ph  = clientPhone.replace(/\D/g, '')
    window.open(ph ? `https://wa.me/91${ph}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ROI Calculators</h1>
            <p className="text-gray-500 text-sm">Make data-driven real estate decisions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setShareUrl(null); setShareError(null); setShowShareModal(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] transition-colors">
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a000c8] hover:bg-blue-700 text-white transition-colors">
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1.5 bg-white border border-[#E2E8F0] rounded-xl w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={activeTab === tab.id
              ? { background: '#EFF6FF', color: '#a000c8', border: '1px solid #BFDBFE', borderRadius: 8 }
              : { background: 'transparent', color: '#64748B', border: '1px solid transparent', borderRadius: 8 }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all hover:bg-[#F8FAFC]">
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'rental-yield' && <RentalYieldCalculator />}
      {activeTab === 'investment'   && <InvestmentProjection />}
      {activeTab === 'stamp-duty'   && <StampDutyCalculator />}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowShareModal(false)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-[#a000c8]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Share Calculator</h3>
                  <p className="text-xs text-gray-400">Create a shareable link for your client</p>
                </div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!shareUrl ? (
              <>
                <div className="space-y-4 mb-6">
                  {[
                    { label: 'Your Name', value: agentName, setter: setAgentName, placeholder: 'e.g., Rahul Sharma', type: 'text' },
                    { label: 'Your Phone', value: agentPhone, setter: setAgentPhone, placeholder: 'e.g., 9876543210', type: 'tel' },
                    { label: 'Company Name', value: companyName, setter: setCompanyName, placeholder: 'e.g., Dream Homes Realty', type: 'text' },
                    { label: 'Client Phone (optional)', value: clientPhone, setter: setClientPhone, placeholder: 'e.g., 9876543210', type: 'tel' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-sm text-gray-500 mb-1.5">{f.label}</label>
                      <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#a000c8]/30 focus:border-[#a000c8]" />
                    </div>
                  ))}
                </div>
                {shareError && <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#EF4444] text-sm">{shareError}</div>}
                <button onClick={handleShare} disabled={shareLoading || !agentName}
                  className="w-full flex items-center justify-center gap-2 bg-[#a000c8] hover:bg-blue-700 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white py-3 rounded-xl font-medium transition-colors disabled:cursor-not-allowed">
                  {shareLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</> : <><Share2 className="h-5 w-5" /> Generate Shareable Link</>}
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-[#a000c8]" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">Link Generated!</h4>
                  <p className="text-gray-500 text-sm">Share this link with your client</p>
                </div>
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 mb-4">
                  <p className="text-[#a000c8] text-sm break-all">{shareUrl}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button onClick={handleCopyLink}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${copied ? 'bg-[#a000c8] text-white' : 'bg-white border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]'}`}>
                    {copied ? <><CheckCircle className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Link</>}
                  </button>
                  <button onClick={handleWhatsAppShare}
                    className="flex items-center justify-center gap-2 bg-[#059669] hover:bg-emerald-700 text-white py-3 rounded-xl font-medium transition-colors">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </button>
                </div>
                <button onClick={() => { setShareUrl(null); setShowShareModal(false) }}
                  className="w-full text-gray-500 hover:text-gray-900 text-sm transition-colors">
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
