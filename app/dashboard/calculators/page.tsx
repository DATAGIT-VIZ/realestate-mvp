'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
 Home,
 Calculator,
 TrendingUp,
 PiggyBank,
 ChevronLeft,
 Share2,
 Download,
 Info,
 Building,
 IndianRupee,
 Calendar,
 Percent,
 ArrowRight,
 CheckCircle,
 XCircle,
 Target,
 Wallet,
 BarChart3,
 LineChart as LineChartIcon,
 Copy,
 MessageCircle,
 X,
 Loader2,
} from 'lucide-react'
import {
 LineChart,
 Line,
 BarChart,
 Bar,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
 ReferenceLine,
 Area,
 AreaChart,
 ComposedChart,
 Cell,
} from 'recharts'

// Types
type CalculatorTab = 'buy-vs-rent' | 'emi' | 'rental-yield' | 'investment' | 'stamp-duty'

// Format currency in Indian format
const formatCurrency = (value: number, decimals: number = 0): string => {
 if (value >= 10000000) {
  return `₹${(value / 10000000).toFixed(decimals)} Cr`
 } else if (value >= 100000) {
  return `₹${(value / 100000).toFixed(decimals)} L`
 } else if (value >= 1000) {
  return `₹${(value / 1000).toFixed(decimals)}K`
 }
 return `₹${value.toFixed(decimals)}`
}

const formatNumber = (value: number): string => {
 return new Intl.NumberFormat('en-IN').format(Math.round(value))
}

// ============================================
// TAB 1: BUY VS RENT CALCULATOR
// ============================================
function BuyVsRentCalculator({ onInputChange }: { onInputChange?: (inputs: Record<string, any>) => void }) {
 // Property Details
 const [propertyPrice, setPropertyPrice] = useState(5000000)
 const [propertyType, setPropertyType] = useState('Apartment')
 const [location, setLocation] = useState('')

 // Purchase Financing
 const [downPaymentPercent, setDownPaymentPercent] = useState(20)
 const [loanTenure, setLoanTenure] = useState(20)
 const [interestRate, setInterestRate] = useState(8.5)
 const [processingFeePercent, setProcessingFeePercent] = useState(0.5)
 const [stampDutyPercent, setStampDutyPercent] = useState(7)

 // Rental Alternative
 const [monthlyRent, setMonthlyRent] = useState(25000)
 const [annualRentIncrease, setAnnualRentIncrease] = useState(5)

 // Property Costs
 const [monthlyMaintenance, setMonthlyMaintenance] = useState(3000)
 const [annualPropertyTaxPercent, setAnnualPropertyTaxPercent] = useState(0.5)

 // Investment Assumptions
 const [propertyAppreciation, setPropertyAppreciation] = useState(7)
 const [timeHorizon, setTimeHorizon] = useState(10)
 const [alternativeReturn, setAlternativeReturn] = useState(8)

 // Calculations
 const calculations = useMemo(() => {
  const downPayment = propertyPrice * (downPaymentPercent / 100)
  const loanAmount = propertyPrice - downPayment
  const stampDuty = propertyPrice * (stampDutyPercent / 100)
  const processingFee = loanAmount * (processingFeePercent / 100)
  const totalInitialCost = downPayment + stampDuty + processingFee

  // EMI Calculation
  const monthlyRate = interestRate / 100 / 12
  const months = loanTenure * 12
  const emi = monthlyRate > 0
   ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
   : loanAmount / months

  const annualPropertyTax = propertyPrice * (annualPropertyTaxPercent / 100)

  // Year-by-year calculations
  const yearlyData: {
   year: number
   rentPaid: number
   rentCumulative: number
   buyCost: number
   buyCostCumulative: number
   propertyValue: number
   loanBalance: number
   equityBuilt: number
   investmentValue: number
   netPosition: number
  }[] = []

  let rentCumulative = 0
  let buyCostCumulative = totalInitialCost
  let currentRent = monthlyRent
  let loanBalance = loanAmount
  let investmentValue = downPayment + stampDuty + processingFee // Initial investment if renting

  // Calculate amortization for principal/interest split
  const calculateYearlyAmortization = (balance: number, rate: number, emiAmount: number) => {
   let principal = 0
   let interest = 0
   let remaining = balance
   for (let m = 0; m < 12 && remaining > 0; m++) {
    const monthlyInterest = remaining * (rate / 100 / 12)
    const monthlyPrincipal = Math.min(emiAmount - monthlyInterest, remaining)
    interest += monthlyInterest
    principal += monthlyPrincipal
    remaining -= monthlyPrincipal
   }
   return { principal, interest, remaining }
  }

  for (let year = 1; year <= timeHorizon; year++) {
   // Rent scenario
   const yearlyRent = currentRent * 12
   rentCumulative += yearlyRent
   investmentValue = investmentValue * (1 + alternativeReturn / 100)

   // Buy scenario
   const yearlyMaintenance = monthlyMaintenance * 12
   const { principal, interest, remaining } = calculateYearlyAmortization(loanBalance, interestRate, emi)
   const yearlyBuyCost = (emi * 12) + yearlyMaintenance + annualPropertyTax
   buyCostCumulative += yearlyBuyCost
   loanBalance = remaining

   // Property value
   const propertyValue = propertyPrice * Math.pow(1 + propertyAppreciation / 100, year)
   const equityBuilt = propertyValue - loanBalance

   // Net position (buying vs renting)
   // If buying: Equity built - Total cost paid
   // If renting: Investment value - Rent paid
   // Comparison: Equity - (Investment value)
   const netPosition = equityBuilt - investmentValue

   yearlyData.push({
    year,
    rentPaid: yearlyRent,
    rentCumulative,
    buyCost: yearlyBuyCost,
    buyCostCumulative,
    propertyValue,
    loanBalance,
    equityBuilt,
    investmentValue,
    netPosition,
   })

   // Increase rent for next year
   currentRent = currentRent * (1 + annualRentIncrease / 100)
  }

  // Find break-even point
  let breakEvenYear = null
  for (const data of yearlyData) {
   if (data.netPosition > 0) {
    breakEvenYear = data.year
    break
   }
  }

  const finalYear = yearlyData[yearlyData.length - 1]
  const totalBuyCost = finalYear?.buyCostCumulative || 0
  const totalRentCost = finalYear?.rentCumulative || 0
  const finalPropertyValue = finalYear?.propertyValue || 0
  const finalEquity = finalYear?.equityBuilt || 0
  const finalInvestmentValue = finalYear?.investmentValue || 0
  const netGainLoss = finalEquity - finalInvestmentValue
  const isBuyingBetter = netGainLoss > 0

  return {
   downPayment,
   loanAmount,
   stampDuty,
   processingFee,
   totalInitialCost,
   emi,
   yearlyData,
   breakEvenYear,
   totalBuyCost,
   totalRentCost,
   finalPropertyValue,
   finalEquity,
   finalInvestmentValue,
   netGainLoss,
   isBuyingBetter,
  }
 }, [
  propertyPrice, downPaymentPercent, loanTenure, interestRate, processingFeePercent, stampDutyPercent,
  monthlyRent, annualRentIncrease, monthlyMaintenance, annualPropertyTaxPercent,
  propertyAppreciation, timeHorizon, alternativeReturn
 ])

 // Report inputs to parent (using ref to avoid infinite loop)
 useEffect(() => {
  onInputChange?.({
   propertyPrice, propertyType, location, downPaymentPercent, loanTenure, interestRate,
   processingFeePercent, stampDutyPercent, monthlyRent, annualRentIncrease,
   monthlyMaintenance, annualPropertyTaxPercent, propertyAppreciation, timeHorizon, alternativeReturn
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [propertyPrice, propertyType, location, downPaymentPercent, loanTenure, interestRate,
  processingFeePercent, stampDutyPercent, monthlyRent, annualRentIncrease,
  monthlyMaintenance, annualPropertyTaxPercent, propertyAppreciation, timeHorizon, alternativeReturn])

 // Chart data
 const chartData = calculations.yearlyData.map(d => ({
  year: `Year ${d.year}`,
  'Total Buy Cost': Math.round(d.buyCostCumulative),
  'Total Rent Cost': Math.round(d.rentCumulative),
  'Property Value': Math.round(d.propertyValue),
  'Equity Built': Math.round(d.equityBuilt),
  'Investment (Rent)': Math.round(d.investmentValue),
 }))

 const wealthComparisonData = [
  {
   scenario: 'Buy',
   'Property Equity': calculations.finalEquity,
  },
  {
   scenario: 'Rent',
   'Investment Value': calculations.finalInvestmentValue,
  },
 ]

 return (
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
   {/* Left Side - Input Form (40%) */}
   <div className="lg:col-span-2 space-y-6">
    {/* Property Details */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Building className="h-5 w-5 text-[#2563EB]" />
      Property Details
     </h3>

     <div className="space-y-4">
      <div>
       <label className="block text-sm text-gray-500 mb-2">Property Price</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={propertyPrice}
         onChange={(e) => setPropertyPrice(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
       <p className="text-xs text-gray-400 mt-1">Total property price</p>
      </div>

      <div>
       <label className="block text-sm text-gray-500 mb-2">Property Type</label>
       <select
        value={propertyType}
        onChange={(e) => setPropertyType(e.target.value)}
        className="w-full bg-white border border-[#E2E8F0]rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
       >
        <option>Apartment</option>
        <option>Villa</option>
        <option>Independent House</option>
        <option>Plot</option>
       </select>
      </div>

      <div>
       <label className="block text-sm text-gray-500 mb-2">Location</label>
       <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="e.g., Bangalore, Mumbai"
        className="w-full bg-white border border-[#E2E8F0]rounded-lg px-4 py-2.5 text-gray-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
       />
      </div>
     </div>
    </div>

    {/* Purchase Financing */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Wallet className="h-5 w-5 text-[#2563EB]" />
      Purchase Financing
     </h3>

     <div className="space-y-5">
      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Down Payment</label>
        <span className="text-sm text-[#2563EB]">{downPaymentPercent}%</span>
       </div>
       <input
        type="range"
        min="10"
        max="50"
        value={downPaymentPercent}
        onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
       <p className="text-xs text-gray-400 mt-1">
        {formatCurrency(calculations.downPayment)} ({downPaymentPercent}% of {formatCurrency(propertyPrice)})
       </p>
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Loan Tenure</label>
        <span className="text-sm text-[#2563EB]">{loanTenure} years</span>
       </div>
       <input
        type="range"
        min="5"
        max="30"
        value={loanTenure}
        onChange={(e) => setLoanTenure(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Interest Rate</label>
        <span className="text-sm text-[#2563EB]">{interestRate}%</span>
       </div>
       <input
        type="range"
        min="6"
        max="15"
        step="0.1"
        value={interestRate}
        onChange={(e) => setInterestRate(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
       <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
        <Info className="h-3 w-3" /> Current SBI rate: ~8.5%
       </p>
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Registration & Stamp Duty</label>
        <span className="text-sm text-[#2563EB]">{stampDutyPercent}%</span>
       </div>
       <input
        type="range"
        min="5"
        max="10"
        step="0.5"
        value={stampDutyPercent}
        onChange={(e) => setStampDutyPercent(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
       <p className="text-xs text-gray-400 mt-1">{formatCurrency(calculations.stampDuty)}</p>
      </div>
     </div>
    </div>

    {/* Rental Alternative */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Home className="h-5 w-5 text-[#2563EB]" />
      Rental Alternative
     </h3>

     <div className="space-y-4">
      <div>
       <label className="block text-sm text-gray-500 mb-2">Expected Monthly Rent</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={monthlyRent}
         onChange={(e) => setMonthlyRent(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
       <p className="text-xs text-gray-400 mt-1">
        Typical: {formatCurrency(propertyPrice * 0.003)} - {formatCurrency(propertyPrice * 0.005)}/month
       </p>
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Annual Rent Increase</label>
        <span className="text-sm text-[#2563EB]">{annualRentIncrease}%</span>
       </div>
       <input
        type="range"
        min="3"
        max="10"
        value={annualRentIncrease}
        onChange={(e) => setAnnualRentIncrease(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
      </div>
     </div>
    </div>

    {/* Property Costs */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Calculator className="h-5 w-5 text-[#2563EB]" />
      Property Costs (Buying)
     </h3>

     <div className="space-y-4">
      <div>
       <label className="block text-sm text-gray-500 mb-2">Monthly Maintenance</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={monthlyMaintenance}
         onChange={(e) => setMonthlyMaintenance(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Annual Property Tax</label>
        <span className="text-sm text-[#2563EB]">{annualPropertyTaxPercent}%</span>
       </div>
       <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        value={annualPropertyTaxPercent}
        onChange={(e) => setAnnualPropertyTaxPercent(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
       <p className="text-xs text-gray-400 mt-1">{formatCurrency(propertyPrice * annualPropertyTaxPercent / 100)}/year</p>
      </div>
     </div>
    </div>

    {/* Investment Assumptions */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <TrendingUp className="h-5 w-5 text-[#2563EB]" />
      Investment Assumptions
     </h3>

     <div className="space-y-5">
      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Property Appreciation</label>
        <span className="text-sm text-[#2563EB]">{propertyAppreciation}%</span>
       </div>
       <input
        type="range"
        min="3"
        max="12"
        value={propertyAppreciation}
        onChange={(e) => setPropertyAppreciation(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
       <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
        <Info className="h-3 w-3" /> Tier 1 cities: 7-10%, Tier 2: 5-7%
       </p>
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Time Horizon</label>
        <span className="text-sm text-[#2563EB]">{timeHorizon} years</span>
       </div>
       <input
        type="range"
        min="3"
        max="30"
        value={timeHorizon}
        onChange={(e) => setTimeHorizon(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Alternative Investment Return</label>
        <span className="text-sm text-[#2563EB]">{alternativeReturn}%</span>
       </div>
       <input
        type="range"
        min="4"
        max="15"
        value={alternativeReturn}
        onChange={(e) => setAlternativeReturn(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
       <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
        <Info className="h-3 w-3" /> If you rent and invest down payment elsewhere
       </p>
      </div>
     </div>
    </div>
   </div>

   {/* Right Side - Results (60%) */}
   <div className="lg:col-span-3 space-y-6">
    {/* Summary Cards */}
    <div className="grid grid-cols-2 gap-4">
     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1">Total Cost to Buy</p>
      <p className="text-2xl font-bold text-gray-900">{formatCurrency(calculations.totalBuyCost)}</p>
      <p className="text-xs text-gray-400 mt-2">Over {timeHorizon} years</p>
     </div>

     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1">Total Cost to Rent</p>
      <p className="text-2xl font-bold text-gray-900">{formatCurrency(calculations.totalRentCost)}</p>
      <p className="text-xs text-gray-400 mt-2">Over {timeHorizon} years</p>
     </div>

     <div className={`rounded-2xl p-5 border ${calculations.isBuyingBetter
      ? 'bg-[#F0FDF4] border-[#BBF7D0]'
      : 'bg-[#FEF2F2] border-[#FECACA]'
      }`}>
      <p className="text-gray-500 text-sm mb-1">Net Gain/Loss</p>
      <p className={`text-2xl font-bold ${calculations.isBuyingBetter ? 'text-[#059669]' : 'text-[#EF4444]'}`}>
       {calculations.isBuyingBetter ? '+' : ''}{formatCurrency(calculations.netGainLoss)}
      </p>
      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
       {calculations.isBuyingBetter ? (
        <><CheckCircle className="h-3 w-3 text-[#059669]" /> Buying is better</>
       ) : (
        <><XCircle className="h-3 w-3 text-[#EF4444]" /> Renting is better</>
       )}
      </p>
     </div>

     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1">Break-even Point</p>
      <p className="text-2xl font-bold text-gray-900">
       {calculations.breakEvenYear ? `Year ${calculations.breakEvenYear}` : `>${timeHorizon} years`}
      </p>
      <p className="text-xs text-gray-400 mt-2">When buying becomes profitable</p>
     </div>
    </div>

    {/* EMI Info */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <div className="flex items-center justify-between">
      <div>
       <p className="text-gray-500 text-sm">Monthly EMI</p>
       <p className="text-3xl font-bold text-[#2563EB]">₹{formatNumber(calculations.emi)}</p>
      </div>
      <div className="text-right">
       <p className="text-gray-500 text-sm">vs Monthly Rent</p>
       <p className="text-3xl font-bold text-[#059669]">₹{formatNumber(monthlyRent)}</p>
      </div>
      <div className="text-right">
       <p className="text-gray-500 text-sm">Difference</p>
       <p className={`text-3xl font-bold ${calculations.emi > monthlyRent ? 'text-[#D97706]' : 'text-[#059669]'}`}>
        ₹{formatNumber(Math.abs(calculations.emi - monthlyRent))}
       </p>
      </div>
     </div>
    </div>

    {/* Total Cost Over Time Chart */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <LineChartIcon className="h-5 w-5 text-[#2563EB]" />
      Cost & Value Over Time
     </h3>
     <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
       <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <YAxis
         tick={{ fill: '#94A3B8', fontSize: 11 }}
         tickFormatter={(value) => formatCurrency(value, 1)}
        />
        <Tooltip
         contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }}
         labelStyle={{ color: '#0F172A' }}
         formatter={(value: number) => formatCurrency(value)}
        />
        <Legend />
        <Line type="monotone" dataKey="Total Buy Cost" stroke="#D97706" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Total Rent Cost" stroke="#2563EB" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Property Value" stroke="#059669" strokeWidth={2} dot={false} />
        {calculations.breakEvenYear && (
         <ReferenceLine
          x={`Year ${calculations.breakEvenYear}`}
          stroke="#7C3AED"
          strokeDasharray="5 5"
          label={{ value: 'Break-even', fill: '#a855f7', fontSize: 12 }}
         />
        )}
       </ComposedChart>
      </ResponsiveContainer>
     </div>
    </div>

    {/* Wealth Comparison Chart */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <BarChart3 className="h-5 w-5 text-[#2563EB]" />
      Wealth After {timeHorizon} Years
     </h3>
     <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
       <BarChart data={wealthComparisonData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(value) => formatCurrency(value, 1)} />
        <YAxis type="category" dataKey="scenario" tick={{ fill: '#94A3B8', fontSize: 11 }} width={60} />
        <Tooltip
         contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
         formatter={(value: number) => formatCurrency(value)}
        />
        <Bar dataKey="Property Equity" fill="#059669" radius={[0, 4, 4, 0]} />
        <Bar dataKey="Investment Value" fill="#2563EB" radius={[0, 4, 4, 0]} />
       </BarChart>
      </ResponsiveContainer>
     </div>
    </div>

    {/* Key Insights */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Key Insights</h3>
     <div className="space-y-3">
      <div className={`flex items-start gap-3 p-3 rounded-xl border ${calculations.isBuyingBetter ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'
       }`}>
       <span className="text-xl">{calculations.isBuyingBetter ? '' : ''}</span>
       <p className="text-gray-600">
        <strong>{calculations.isBuyingBetter ? 'Buying' : 'Renting'}</strong> is{' '}
        <strong>{formatCurrency(Math.abs(calculations.netGainLoss))}</strong> more profitable over {timeHorizon} years
       </p>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
       <span className="text-xl"></span>
       <p className="text-gray-600">
        You&apos;ll own <strong>{formatCurrency(calculations.finalEquity)}</strong> in equity by year {timeHorizon}
       </p>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
       <span className="text-xl"></span>
       <p className="text-gray-600">
        Monthly EMI: <strong>₹{formatNumber(calculations.emi)}</strong> vs Rent: <strong>₹{formatNumber(monthlyRent)}</strong>
       </p>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
       <span className="text-xl"></span>
       <p className="text-gray-600">
        Property value grows to <strong>{formatCurrency(calculations.finalPropertyValue)}</strong> by year {timeHorizon}
       </p>
      </div>
     </div>
    </div>

    {/* Year-by-Year Table */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Year-by-Year Breakdown</h3>
     <div className="overflow-x-auto">
      <table className="w-full text-sm">
       <thead>
        <tr className="text-gray-500 border-b border-gray-200">
         <th className="text-left py-2 px-2">Year</th>
         <th className="text-right py-2 px-2">Rent Paid</th>
         <th className="text-right py-2 px-2">Buy Cost</th>
         <th className="text-right py-2 px-2">Property Value</th>
         <th className="text-right py-2 px-2">Equity Built</th>
         <th className="text-right py-2 px-2">Net Position</th>
        </tr>
       </thead>
       <tbody>
        {calculations.yearlyData.filter((_, i) => i % 2 === 0 || i === calculations.yearlyData.length - 1).map((data) => (
         <tr key={data.year} className="border-b border-gray-100 hover:bg-gray-50/30">
          <td className="py-2 px-2 text-gray-900 font-medium">{data.year}</td>
          <td className="text-right py-2 px-2 text-[#2563EB]">{formatCurrency(data.rentCumulative)}</td>
          <td className="text-right py-2 px-2 text-[#D97706]">{formatCurrency(data.buyCostCumulative)}</td>
          <td className="text-right py-2 px-2 text-[#2563EB]">{formatCurrency(data.propertyValue)}</td>
          <td className="text-right py-2 px-2 text-[#7C3AED]">{formatCurrency(data.equityBuilt)}</td>
          <td className={`text-right py-2 px-2 font-semibold ${data.netPosition > 0 ? 'text-[#059669]' : 'text-[#EF4444]'}`}>
           {data.netPosition > 0 ? '+' : ''}{formatCurrency(data.netPosition)}
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    </div>
   </div>
  </div>
 )
}

// ============================================
// TAB 2: EMI CALCULATOR (Enhanced)
// ============================================
function EMICalculator({ onInputChange }: { onInputChange?: (inputs: Record<string, any>) => void }) {
 const [loanAmount, setLoanAmount] = useState(4000000)
 const [interestRate, setInterestRate] = useState(8.5)
 const [tenure, setTenure] = useState(20)
 const [enablePrepayment, setEnablePrepayment] = useState(false)
 const [annualPrepayment, setAnnualPrepayment] = useState(100000)
 const [showAmortization, setShowAmortization] = useState(false)

 // Calculate EMI for any given parameters
 const calculateEMI = (principal: number, rate: number, years: number) => {
  const monthlyRate = rate / 100 / 12
  const months = years * 12
  if (monthlyRate === 0) return principal / months
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
 }

 const calculations = useMemo(() => {
  const monthlyRate = interestRate / 100 / 12
  const months = tenure * 12
  const emi = calculateEMI(loanAmount, interestRate, tenure)

  const totalPayment = emi * months
  const totalInterest = totalPayment - loanAmount
  const interestToPrincipalRatio = totalInterest / loanAmount

  // Monthly amortization schedule
  const monthlyData: {
   month: number
   emi: number
   principal: number
   interest: number
   balance: number
  }[] = []

  // Yearly breakdown
  const yearlyData: {
   year: number
   principalPaid: number
   interestPaid: number
   balance: number
   principalCumulative: number
   interestCumulative: number
  }[] = []

  let balance = loanAmount
  let principalCumulative = 0
  let interestCumulative = 0

  for (let year = 1; year <= tenure; year++) {
   let yearlyPrincipal = 0
   let yearlyInterest = 0

   for (let month = 0; month < 12 && balance > 0; month++) {
    const monthlyInterest = balance * (interestRate / 100 / 12)
    const monthlyPrincipal = Math.min(emi - monthlyInterest, balance)
    yearlyInterest += monthlyInterest
    yearlyPrincipal += monthlyPrincipal
    balance -= monthlyPrincipal

    monthlyData.push({
     month: (year - 1) * 12 + month + 1,
     emi: emi,
     principal: monthlyPrincipal,
     interest: monthlyInterest,
     balance: Math.max(0, balance),
    })
   }

   principalCumulative += yearlyPrincipal
   interestCumulative += yearlyInterest

   yearlyData.push({
    year,
    principalPaid: yearlyPrincipal,
    interestPaid: yearlyInterest,
    balance: Math.max(0, balance),
    principalCumulative,
    interestCumulative,
   })
  }

  // Prepayment calculations
  let prepaymentSavings = 0
  let prepaymentTenureReduction = 0
  let prepaymentTotalInterest = totalInterest

  if (enablePrepayment && annualPrepayment > 0) {
   let prepayBalance = loanAmount
   let prepayMonths = 0
   let prepayTotalInterest = 0

   while (prepayBalance > 0 && prepayMonths < months) {
    const monthlyInterest = prepayBalance * monthlyRate
    const monthlyPrincipal = Math.min(emi - monthlyInterest, prepayBalance)
    prepayTotalInterest += monthlyInterest
    prepayBalance -= monthlyPrincipal
    prepayMonths++

    // Apply annual prepayment at year end
    if (prepayMonths % 12 === 0 && prepayBalance > 0) {
     prepayBalance = Math.max(0, prepayBalance - annualPrepayment)
    }
   }

   prepaymentSavings = totalInterest - prepayTotalInterest
   prepaymentTenureReduction = (months - prepayMonths) / 12
   prepaymentTotalInterest = prepayTotalInterest
  }

  // Tenure comparison
  const tenureComparison = [10, 15, 20, 25, 30].map(t => {
   const tEmi = calculateEMI(loanAmount, interestRate, t)
   const tTotal = tEmi * t * 12
   const tInterest = tTotal - loanAmount
   return {
    tenure: t,
    emi: tEmi,
    totalInterest: tInterest,
    totalCost: tTotal,
   }
  })

  // Find halfway point (when 50% of principal is paid)
  const halfwayYear = yearlyData.find(d => d.principalCumulative >= loanAmount / 2)?.year || Math.ceil(tenure / 2)

  return {
   emi,
   totalPayment,
   totalInterest,
   interestToPrincipalRatio,
   yearlyData,
   monthlyData,
   prepaymentSavings,
   prepaymentTenureReduction,
   prepaymentTotalInterest,
   tenureComparison,
   halfwayYear,
  }
 }, [loanAmount, interestRate, tenure, enablePrepayment, annualPrepayment])

 // Report inputs to parent
 useEffect(() => {
  onInputChange?.({ loanAmount, interestRate, tenure, enablePrepayment, annualPrepayment })
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [loanAmount, interestRate, tenure, enablePrepayment, annualPrepayment])

 const chartData = calculations.yearlyData.map(d => ({
  year: `Y${d.year}`,
  Principal: Math.round(d.principalPaid),
  Interest: Math.round(d.interestPaid),
  Balance: Math.round(d.balance),
 }))

 return (
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
   {/* Left Side - Input */}
   <div className="lg:col-span-2 space-y-6">
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Calculator className="h-5 w-5 text-[#2563EB]" />
      Loan Details
     </h3>

     <div className="space-y-5">
      <div>
       <label className="block text-sm text-gray-500 mb-2">Loan Amount</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={loanAmount}
         onChange={(e) => setLoanAmount(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
       <p className="text-xs text-gray-400 mt-1">{formatCurrency(loanAmount)}</p>
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Interest Rate</label>
        <span className="text-sm text-[#2563EB]">{interestRate}%</span>
       </div>
       <input
        type="range"
        min="6"
        max="15"
        step="0.1"
        value={interestRate}
        onChange={(e) => setInterestRate(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Loan Tenure</label>
        <span className="text-sm text-[#2563EB]">{tenure} years</span>
       </div>
       <input
        type="range"
        min="5"
        max="30"
        value={tenure}
        onChange={(e) => setTenure(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
      </div>
     </div>
    </div>

    {/* Prepayment Section */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <label className="flex items-center gap-3 cursor-pointer">
      <input
       type="checkbox"
       checked={enablePrepayment}
       onChange={(e) => setEnablePrepayment(e.target.checked)}
       className="w-5 h-5 rounded border-[#E2E8F0]bg-white text-[#2563EB] focus:ring-emerald-500"
      />
      <span className="text-gray-900 font-medium">Add Annual Prepayment</span>
     </label>

     {enablePrepayment && (
      <div className="mt-4">
       <label className="block text-sm text-gray-500 mb-2">Annual Prepayment Amount</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={annualPrepayment}
         onChange={(e) => setAnnualPrepayment(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
      </div>
     )}
    </div>

    {/* Large EMI Display */}
    <div className="bg-gradient-to-br from-[#2563EB]/20 to-teal-500/10 rounded-lg p-6 border border-[#2563EB]/30">
     <p className="text-gray-500 text-sm mb-2">Your Monthly EMI</p>
     <p className="text-5xl font-bold text-[#2563EB]">₹{formatNumber(calculations.emi)}</p>
     <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
      <div>
       <p className="text-gray-400 text-xs">Total Payment</p>
       <p className="text-gray-900 font-semibold">{formatCurrency(calculations.totalPayment)}</p>
      </div>
      <div>
       <p className="text-gray-400 text-xs">Interest : Principal</p>
       <p className="text-[#D97706] font-semibold">{calculations.interestToPrincipalRatio.toFixed(2)} : 1</p>
      </div>
     </div>
    </div>

    {/* Prepayment Impact */}
    {enablePrepayment && calculations.prepaymentSavings > 0 && (
     <div className="bg-[#F0FDF4] rounded-2xl p-5 border border-[#BBF7D0]">
      <h3 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
       <CheckCircle className="h-5 w-5 text-[#059669]" />
       Prepayment Impact
      </h3>
      <div className="space-y-2">
       <p className="text-[#059669]">
         Save <strong>{formatCurrency(calculations.prepaymentSavings)}</strong> in interest
       </p>
       <p className="text-[#059669]">
         Reduce tenure by <strong>{calculations.prepaymentTenureReduction.toFixed(1)} years</strong>
       </p>
      </div>
     </div>
    )}
   </div>

   {/* Right Side - Results */}
   <div className="lg:col-span-3 space-y-6">
    {/* Breakdown Cards */}
    <div className="grid grid-cols-3 gap-4">
     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] text-center">
      <p className="text-gray-500 text-xs mb-1">Principal Amount</p>
      <p className="text-xl font-bold text-[#2563EB]">{formatCurrency(loanAmount)}</p>
      <div className="w-full bg-[#E2E8F0] rounded-full h-2 mt-2">
       <div
        className="bg-[#2563EB] h-2 rounded-full"
        style={{ width: `${Math.round(loanAmount / calculations.totalPayment * 100)}%` }}
       />
      </div>
     </div>
     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] text-center">
      <p className="text-gray-500 text-xs mb-1">Total Interest</p>
      <p className="text-xl font-bold text-[#D97706]">{formatCurrency(calculations.totalInterest)}</p>
      <div className="w-full bg-[#E2E8F0] rounded-full h-2 mt-2">
       <div
        className="bg-[#D97706] h-2 rounded-full"
        style={{ width: `${Math.round(calculations.totalInterest / calculations.totalPayment * 100)}%` }}
       />
      </div>
     </div>
     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] text-center">
      <p className="text-gray-500 text-xs mb-1">Total Amount</p>
      <p className="text-xl font-bold text-gray-900">{formatCurrency(calculations.totalPayment)}</p>
      <p className="text-xs text-gray-400 mt-2">Over {tenure} years</p>
     </div>
    </div>

    {/* Pie Chart - Principal vs Interest */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4">Principal vs Interest Split</h3>
     <div className="flex items-center justify-center gap-8">
      <div className="relative w-48 h-48">
       <svg viewBox="0 0 100 100" className="transform -rotate-90">
        <circle
         cx="50" cy="50" r="40"
         fill="none" stroke="#2563EB" strokeWidth="20"
         strokeDasharray={`${(loanAmount / calculations.totalPayment) * 251.2} 251.2`}
        />
        <circle
         cx="50" cy="50" r="40"
         fill="none" stroke="#D97706" strokeWidth="20"
         strokeDasharray={`${(calculations.totalInterest / calculations.totalPayment) * 251.2} 251.2`}
         strokeDashoffset={`-${(loanAmount / calculations.totalPayment) * 251.2}`}
        />
       </svg>
       <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
         <p className="text-2xl font-bold text-gray-900">{Math.round(loanAmount / calculations.totalPayment * 100)}%</p>
         <p className="text-xs text-gray-500">Principal</p>
        </div>
       </div>
      </div>
      <div className="space-y-4">
       <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded bg-[#2563EB]"></div>
        <div>
         <p className="text-gray-900 font-medium">Principal</p>
         <p className="text-gray-500 text-sm">{formatCurrency(loanAmount)}</p>
        </div>
       </div>
       <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded bg-[#D97706]"></div>
        <div>
         <p className="text-gray-900 font-medium">Interest</p>
         <p className="text-gray-500 text-sm">{formatCurrency(calculations.totalInterest)}</p>
        </div>
       </div>
      </div>
     </div>
    </div>

    {/* Loan Balance Over Time */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4">Loan Balance Over Time</h3>
     <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
       <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, 0)} />
        <Tooltip
         contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
         formatter={(value: number) => formatCurrency(value)}
        />
        <ReferenceLine
         x={`Y${calculations.halfwayYear}`}
         stroke="#7C3AED"
         strokeDasharray="5 5"
         label={{ value: '50% paid', fill: '#a855f7', fontSize: 10 }}
        />
        <Area type="monotone" dataKey="Balance" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} />
       </AreaChart>
      </ResponsiveContainer>
     </div>
    </div>

    {/* Tenure Comparison Table */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Tenure Comparison</h3>
     <div className="overflow-x-auto">
      <table className="w-full text-sm">
       <thead>
        <tr className="text-gray-500 border-b border-gray-200">
         <th className="text-left py-2 px-3">Tenure</th>
         <th className="text-right py-2 px-3">Monthly EMI</th>
         <th className="text-right py-2 px-3">Total Interest</th>
         <th className="text-right py-2 px-3">Total Cost</th>
        </tr>
       </thead>
       <tbody>
        {calculations.tenureComparison.map((row) => (
         <tr
          key={row.tenure}
          className={`border-b border-gray-100 ${row.tenure === tenure ? 'bg-[#2563EB]/10' : 'hover:bg-gray-50/30'}`}
         >
          <td className="py-2 px-3 text-gray-900 font-medium">
           {row.tenure} years
           {row.tenure === tenure && <span className="ml-2 text-xs text-[#2563EB]">(Selected)</span>}
          </td>
          <td className="text-right py-2 px-3 text-[#2563EB]">₹{formatNumber(row.emi)}</td>
          <td className="text-right py-2 px-3 text-[#D97706]">{formatCurrency(row.totalInterest)}</td>
          <td className="text-right py-2 px-3 text-gray-900">{formatCurrency(row.totalCost)}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    </div>

    {/* Amortization Schedule (Expandable) */}
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
     <button
      onClick={() => setShowAmortization(!showAmortization)}
      className="w-full p-5 flex items-center justify-between text-gray-900 hover:bg-gray-50/30 transition-colors"
     >
      <h3 className="font-semibold"> Amortization Schedule</h3>
      <span className={`transform transition-transform ${showAmortization ? 'rotate-180' : ''}`}></span>
     </button>

     {showAmortization && (
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
       <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[#F8FAFC]">
         <tr className="text-gray-500 border-b border-gray-200">
          <th className="text-left py-2 px-3">Month</th>
          <th className="text-right py-2 px-3">EMI</th>
          <th className="text-right py-2 px-3">Principal</th>
          <th className="text-right py-2 px-3">Interest</th>
          <th className="text-right py-2 px-3">Balance</th>
         </tr>
        </thead>
        <tbody>
         {calculations.monthlyData.slice(0, 60).map((row) => (
          <tr key={row.month} className="border-b border-gray-200/30 hover:bg-gray-50/20">
           <td className="py-2 px-3 text-gray-900">{row.month}</td>
           <td className="text-right py-2 px-3 text-gray-600">₹{formatNumber(row.emi)}</td>
           <td className="text-right py-2 px-3 text-[#2563EB]">₹{formatNumber(row.principal)}</td>
           <td className="text-right py-2 px-3 text-[#D97706]">₹{formatNumber(row.interest)}</td>
           <td className="text-right py-2 px-3 text-[#2563EB]">{formatCurrency(row.balance)}</td>
          </tr>
         ))}
        </tbody>
       </table>
       {calculations.monthlyData.length > 60 && (
        <p className="text-center py-3 text-gray-400 text-sm">
         Showing first 60 months of {calculations.monthlyData.length} total
        </p>
       )}
      </div>
     )}
    </div>
   </div>
  </div>
 )
}

// ============================================
// TAB 3: RENTAL YIELD CALCULATOR (Enhanced)
// ============================================
function RentalYieldCalculator({ onInputChange }: { onInputChange?: (inputs: Record<string, any>) => void }) {
 // Property & Rent
 const [propertyPrice, setPropertyPrice] = useState(5000000)
 const [monthlyRent, setMonthlyRent] = useState(20000)
 const [occupancyRate, setOccupancyRate] = useState(90)

 // Annual Expenses
 const [monthlyMaintenance, setMonthlyMaintenance] = useState(3000)
 const [annualPropertyTax, setAnnualPropertyTax] = useState(25000)
 const [annualInsurance, setAnnualInsurance] = useState(5000)
 const [managementFeePercent, setManagementFeePercent] = useState(5)

 // Financing (optional)
 const [useFinancing, setUseFinancing] = useState(false)
 const [loanAmount, setLoanAmount] = useState(4000000)
 const [loanInterestRate, setLoanInterestRate] = useState(8.5)
 const [loanTenure, setLoanTenure] = useState(20)

 // Projections
 const [appreciationRate, setAppreciationRate] = useState(7)
 const [rentIncreaseRate, setRentIncreaseRate] = useState(5)
 const [years, setYears] = useState(10)

 const calculations = useMemo(() => {
  // Annual calculations
  const annualGrossRent = monthlyRent * 12
  const effectiveRent = annualGrossRent * (occupancyRate / 100)
  const managementFee = effectiveRent * (managementFeePercent / 100)
  const annualMaintenance = monthlyMaintenance * 12
  const totalExpenses = annualMaintenance + annualPropertyTax + annualInsurance + managementFee
  const netOperatingIncome = effectiveRent - totalExpenses // NOI

  // Yields
  const grossYield = (annualGrossRent / propertyPrice) * 100
  const netYield = (netOperatingIncome / propertyPrice) * 100
  const capRate = (netOperatingIncome / propertyPrice) * 100

  // Financing calculations
  let monthlyEMI = 0
  let annualEMI = 0
  let downPayment = propertyPrice
  let cashOnCashReturn = netYield

  if (useFinancing && loanAmount > 0) {
   const monthlyRate = loanInterestRate / 100 / 12
   const months = loanTenure * 12
   monthlyEMI = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
   annualEMI = monthlyEMI * 12
   downPayment = propertyPrice - loanAmount

   // Cash-on-Cash Return = (Annual Net Cash Flow / Down Payment) × 100
   const annualNetCashFlow = netOperatingIncome - annualEMI
   cashOnCashReturn = downPayment > 0 ? (annualNetCashFlow / downPayment) * 100 : 0
  }

  // Annual Cash Flow
  const annualCashFlow = netOperatingIncome - (useFinancing ? annualEMI : 0)

  // Multi-year projection
  const yearlyData: {
   year: number
   propertyValue: number
   annualRent: number
   expenses: number
   noi: number
   cashFlow: number
   cumulativeCashFlow: number
  }[] = []

  let cumulativeCashFlow = 0
  let currentRent = monthlyRent
  let breakEvenYear: number | null = null

  for (let year = 1; year <= years; year++) {
   const propertyValue = propertyPrice * Math.pow(1 + appreciationRate / 100, year)
   const yearlyGrossRent = currentRent * 12 * (occupancyRate / 100)
   const yearlyMgmtFee = yearlyGrossRent * (managementFeePercent / 100)
   const yearlyExpenses = annualMaintenance + annualPropertyTax + annualInsurance + yearlyMgmtFee
   const yearlyNOI = yearlyGrossRent - yearlyExpenses
   const yearlyEMI = useFinancing ? annualEMI : 0
   const yearlyCashFlow = yearlyNOI - yearlyEMI
   cumulativeCashFlow += yearlyCashFlow

   // Check break-even (when cumulative cash flow covers down payment)
   if (breakEvenYear === null && cumulativeCashFlow >= downPayment) {
    breakEvenYear = year
   }

   yearlyData.push({
    year,
    propertyValue,
    annualRent: yearlyGrossRent,
    expenses: yearlyExpenses,
    noi: yearlyNOI,
    cashFlow: yearlyCashFlow,
    cumulativeCashFlow,
   })

   currentRent = currentRent * (1 + rentIncreaseRate / 100)
  }

  // Final calculations
  const finalValue = propertyPrice * Math.pow(1 + appreciationRate / 100, years)
  const totalCapitalGain = finalValue - propertyPrice
  const totalROI = ((totalCapitalGain + cumulativeCashFlow) / downPayment) * 100
  const annualizedROI = (Math.pow(1 + totalROI / 100, 1 / years) - 1) * 100

  // Investment comparison
  const comparisons = [
   { name: 'Fixed Deposit', rate: 7, color: '#94A3B8' },
   { name: 'Stock Market', rate: 12, color: '#059669' },
   { name: 'REITs', rate: 9, color: '#7C3AED' },
   { name: 'This Property', rate: annualizedROI, color: '#2563EB' },
  ]

  // Investment decision
  let investmentDecision: { verdict: string; color: string; icon: string; message: string }
  if (netYield >= 6) {
   investmentDecision = { verdict: 'Excellent', color: 'green', icon: '', message: 'Excellent investment - yield above market average' }
  } else if (netYield >= 4) {
   investmentDecision = { verdict: 'Good', color: 'emerald', icon: '', message: 'Good investment - decent rental returns' }
  } else if (netYield >= 2.5) {
   investmentDecision = { verdict: 'Marginal', color: 'amber', icon: '', message: 'Marginal returns - consider negotiating price' }
  } else {
   investmentDecision = { verdict: 'Poor', color: 'red', icon: '', message: 'Poor investment - look for better opportunities' }
  }

  return {
   grossYield,
   netYield,
   capRate,
   netOperatingIncome,
   totalExpenses,
   effectiveRent,
   managementFee,
   monthlyEMI,
   annualEMI,
   downPayment,
   cashOnCashReturn,
   annualCashFlow,
   yearlyData,
   finalValue,
   totalCapitalGain,
   totalROI,
   annualizedROI,
   comparisons,
   investmentDecision,
   breakEvenYear,
  }
 }, [propertyPrice, monthlyRent, occupancyRate, monthlyMaintenance, annualPropertyTax, annualInsurance,
  managementFeePercent, useFinancing, loanAmount, loanInterestRate, loanTenure, appreciationRate,
  rentIncreaseRate, years])

 // Report inputs to parent
 useEffect(() => {
  onInputChange?.({
   propertyPrice, monthlyRent, occupancyRate, monthlyMaintenance, annualPropertyTax, annualInsurance,
   managementFeePercent, useFinancing, loanAmount, loanInterestRate, loanTenure, appreciationRate,
   rentIncreaseRate, years
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [propertyPrice, monthlyRent, occupancyRate, monthlyMaintenance, annualPropertyTax, annualInsurance,
  managementFeePercent, useFinancing, loanAmount, loanInterestRate, loanTenure, appreciationRate,
  rentIncreaseRate, years])

 const chartData = calculations.yearlyData.map(d => ({
  year: `Y${d.year}`,
  'Property Value': Math.round(d.propertyValue),
  'Cumulative Cash Flow': Math.round(d.cumulativeCashFlow),
  'Annual Cash Flow': Math.round(d.cashFlow),
 }))

 return (
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
   {/* Left Side - Input */}
   <div className="lg:col-span-2 space-y-6">
    {/* Property Details */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Building className="h-5 w-5 text-[#2563EB]" />
      Property Details
     </h3>

     <div className="space-y-4">
      <div>
       <label className="block text-sm text-gray-500 mb-2">Property Price</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={propertyPrice}
         onChange={(e) => setPropertyPrice(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
      </div>

      <div>
       <label className="block text-sm text-gray-500 mb-2">Expected Monthly Rent</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={monthlyRent}
         onChange={(e) => setMonthlyRent(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Occupancy Rate</label>
        <span className="text-sm text-[#2563EB]">{occupancyRate}%</span>
       </div>
       <input
        type="range"
        min="70"
        max="100"
        value={occupancyRate}
        onChange={(e) => setOccupancyRate(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
       <p className="text-xs text-gray-400 mt-1">Assume some vacancy periods</p>
      </div>
     </div>
    </div>

    {/* Annual Expenses */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Calculator className="h-5 w-5 text-[#2563EB]" />
      Annual Expenses
     </h3>

     <div className="space-y-4">
      <div>
       <label className="block text-sm text-gray-500 mb-2">Monthly Maintenance</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={monthlyMaintenance}
         onChange={(e) => setMonthlyMaintenance(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
      </div>

      <div>
       <label className="block text-sm text-gray-500 mb-2">Annual Property Tax</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={annualPropertyTax}
         onChange={(e) => setAnnualPropertyTax(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
      </div>

      <div>
       <label className="block text-sm text-gray-500 mb-2">Annual Insurance</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={annualInsurance}
         onChange={(e) => setAnnualInsurance(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Management Fees</label>
        <span className="text-sm text-[#2563EB]">{managementFeePercent}%</span>
       </div>
       <input
        type="range"
        min="0"
        max="10"
        value={managementFeePercent}
        onChange={(e) => setManagementFeePercent(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
       <p className="text-xs text-gray-400 mt-1">Of effective rent</p>
      </div>
     </div>
    </div>

    {/* Financing (Optional) */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <label className="flex items-center gap-3 cursor-pointer mb-4">
      <input
       type="checkbox"
       checked={useFinancing}
       onChange={(e) => setUseFinancing(e.target.checked)}
       className="w-5 h-5 rounded border-[#E2E8F0]bg-white text-[#2563EB] focus:ring-emerald-500"
      />
      <span className="text-gray-900 font-medium">Include Financing</span>
     </label>

     {useFinancing && (
      <div className="space-y-4">
       <div>
        <label className="block text-sm text-gray-500 mb-2">Loan Amount</label>
        <div className="relative">
         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
         <input
          type="number"
          value={loanAmount}
          onChange={(e) => setLoanAmount(Number(e.target.value))}
          className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
         />
        </div>
       </div>

       <div>
        <div className="flex justify-between mb-2">
         <label className="text-sm text-gray-500">Interest Rate</label>
         <span className="text-sm text-[#2563EB]">{loanInterestRate}%</span>
        </div>
        <input
         type="range"
         min="6"
         max="15"
         step="0.1"
         value={loanInterestRate}
         onChange={(e) => setLoanInterestRate(Number(e.target.value))}
         className="w-full accent-[#2563EB]"
        />
       </div>

       <div>
        <div className="flex justify-between mb-2">
         <label className="text-sm text-gray-500">Loan Tenure</label>
         <span className="text-sm text-[#2563EB]">{loanTenure} years</span>
        </div>
        <input
         type="range"
         min="5"
         max="30"
         value={loanTenure}
         onChange={(e) => setLoanTenure(Number(e.target.value))}
         className="w-full accent-[#2563EB]"
        />
       </div>
      </div>
     )}
    </div>

    {/* Projection Assumptions */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <TrendingUp className="h-5 w-5 text-[#2563EB]" />
      Projections
     </h3>

     <div className="space-y-5">
      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Property Appreciation</label>
        <span className="text-sm text-[#2563EB]">{appreciationRate}%/year</span>
       </div>
       <input
        type="range"
        min="3"
        max="15"
        value={appreciationRate}
        onChange={(e) => setAppreciationRate(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Rent Increase Rate</label>
        <span className="text-sm text-[#2563EB]">{rentIncreaseRate}%/year</span>
       </div>
       <input
        type="range"
        min="3"
        max="10"
        value={rentIncreaseRate}
        onChange={(e) => setRentIncreaseRate(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
      </div>

      <div>
       <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">Investment Period</label>
        <span className="text-sm text-[#2563EB]">{years} years</span>
       </div>
       <input
        type="range"
        min="1"
        max="20"
        value={years}
        onChange={(e) => setYears(Number(e.target.value))}
        className="w-full accent-[#2563EB]"
       />
      </div>
     </div>
    </div>
   </div>

   {/* Right Side - Results */}
   <div className="lg:col-span-3 space-y-6">
    {/* Key Metrics Cards */}
    <div className="grid grid-cols-2 gap-4">
     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1">Gross Rental Yield</p>
      <p className="text-3xl font-bold text-[#2563EB]">{calculations.grossYield.toFixed(2)}%</p>
      <p className="text-xs text-gray-400 mt-2">
       {calculations.grossYield >= 4 ? ' Good: >4%' : ' Below 4%'}
      </p>
     </div>

     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1">Net Rental Yield</p>
      <p className="text-3xl font-bold text-[#059669]">{calculations.netYield.toFixed(2)}%</p>
      <p className="text-xs text-gray-400 mt-2">After all expenses</p>
     </div>

     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1">
       {useFinancing ? 'Cash-on-Cash Return' : 'Cap Rate'}
      </p>
      <p className="text-3xl font-bold text-[#7C3AED]">
       {useFinancing ? calculations.cashOnCashReturn.toFixed(2) : calculations.capRate.toFixed(2)}%
      </p>
      <p className="text-xs text-gray-400 mt-2">
       {useFinancing ? 'Return on down payment' : 'NOI / Property Value'}
      </p>
     </div>

     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1">Annualized ROI</p>
      <p className="text-3xl font-bold text-[#D97706]">{calculations.annualizedROI.toFixed(1)}%</p>
      <p className="text-xs text-gray-400 mt-2">Including appreciation</p>
     </div>
    </div>

    {/* Investment Decision */}
    <div className={`rounded-2xl p-5 border ${calculations.investmentDecision.color === 'green' ? 'bg-[#F0FDF4] border-[#BBF7D0]' :
     calculations.investmentDecision.color === 'emerald' ? 'bg-[#EFF6FF] border-[#BFDBFE]' :
      calculations.investmentDecision.color === 'amber' ? 'bg-[#FFFBEB] border-[#FDE68A]' :
       'bg-[#FEF2F2] border-[#FECACA]'
     }`}>
     <div className="flex items-center gap-3">
      <span className="text-3xl">{calculations.investmentDecision.icon}</span>
      <div>
       <p className={`font-semibold text-lg ${calculations.investmentDecision.color === 'green' ? 'text-[#059669]' :
        calculations.investmentDecision.color === 'emerald' ? 'text-[#2563EB]' :
         calculations.investmentDecision.color === 'amber' ? 'text-[#D97706]' :
          'text-[#EF4444]'
        }`}>
        {calculations.investmentDecision.verdict} Investment
       </p>
       <p className="text-gray-500 text-sm">{calculations.investmentDecision.message}</p>
      </div>
     </div>
    </div>

    {/* Annual Cash Flow Breakdown */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Annual Cash Flow Breakdown</h3>
     <div className="space-y-3">
      <div className="flex justify-between items-center p-3 bg-[#2563EB]/10 rounded-lg">
       <span className="text-gray-600">+ Rental Income (after vacancy)</span>
       <span className="text-[#2563EB] font-semibold">+{formatCurrency(calculations.effectiveRent)}</span>
      </div>
      {useFinancing && (
       <div className="flex justify-between items-center p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl">
        <span className="text-gray-600">- Loan EMI</span>
        <span className="text-[#EF4444] font-semibold">-{formatCurrency(calculations.annualEMI)}</span>
       </div>
      )}
      <div className="flex justify-between items-center p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
       <span className="text-gray-600">- Maintenance</span>
       <span className="text-[#D97706] font-semibold">-{formatCurrency(monthlyMaintenance * 12)}</span>
      </div>
      <div className="flex justify-between items-center p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
       <span className="text-gray-600">- Taxes & Insurance</span>
       <span className="text-[#D97706] font-semibold">-{formatCurrency(annualPropertyTax + annualInsurance)}</span>
      </div>
      <div className="flex justify-between items-center p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
       <span className="text-gray-600">- Management Fees</span>
       <span className="text-[#D97706] font-semibold">-{formatCurrency(calculations.managementFee)}</span>
      </div>
      <div className={`flex justify-between items-center p-3 rounded-xl border-2 ${calculations.annualCashFlow >= 0 ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'
       }`}>
       <span className="text-gray-900 font-semibold">= Net Annual Cash Flow</span>
       <span className={`text-xl font-bold ${calculations.annualCashFlow >= 0 ? 'text-[#059669]' : 'text-[#EF4444]'}`}>
        {calculations.annualCashFlow >= 0 ? '+' : ''}{formatCurrency(calculations.annualCashFlow)}
       </span>
      </div>
     </div>
    </div>

    {/* Cash Flow Projection Chart */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Cash Flow Projection ({years} years)</h3>
     <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
       <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, 0)} />
        <Tooltip
         contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
         formatter={(value: number) => formatCurrency(value)}
        />
        <Legend />
        <Bar dataKey="Annual Cash Flow" fill="#059669" />
        <Line type="monotone" dataKey="Cumulative Cash Flow" stroke="#D97706" strokeWidth={2} dot={false} />
       </ComposedChart>
      </ResponsiveContainer>
     </div>
    </div>

    {/* Investment Comparison */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Compare to Other Investments</h3>
     <div className="space-y-3">
      {calculations.comparisons.map((item, index) => (
       <div key={index} className="flex items-center gap-4">
        <div className="flex-1">
         <div className="flex justify-between mb-1">
          <span className={`text-sm ${item.name === 'This Property' ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
           {item.name}
          </span>
          <span className={`text-sm font-medium ${item.name === 'This Property' ? 'text-[#2563EB]' : 'text-gray-600'}`}>
           {item.rate.toFixed(1)}%
          </span>
         </div>
         <div className="w-full bg-[#E2E8F0] rounded-full h-2">
          <div
           className="h-2 rounded-full transition-all duration-500"
           style={{ width: `${Math.min(item.rate * 5, 100)}%`, backgroundColor: item.color }}
          />
         </div>
        </div>
       </div>
      ))}
     </div>
    </div>

    {/* Final Summary */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> After {years} Years</h3>
     <div className="grid grid-cols-2 gap-4">
      <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
       <p className="text-gray-500 text-sm">Property Value</p>
       <p className="text-2xl font-bold text-[#2563EB]">{formatCurrency(calculations.finalValue)}</p>
      </div>
      <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
       <p className="text-gray-500 text-sm">Capital Gain</p>
       <p className="text-2xl font-bold text-[#059669]">{formatCurrency(calculations.totalCapitalGain)}</p>
      </div>
      <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
       <p className="text-gray-500 text-sm">Total Cash Flow</p>
       <p className={`text-2xl font-bold ${calculations.yearlyData[calculations.yearlyData.length - 1]?.cumulativeCashFlow >= 0 ? 'text-[#2563EB]' : 'text-[#EF4444]'}`}>
        {formatCurrency(calculations.yearlyData[calculations.yearlyData.length - 1]?.cumulativeCashFlow || 0)}
       </p>
      </div>
      <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
       <p className="text-gray-500 text-sm">Total ROI</p>
       <p className="text-2xl font-bold text-[#7C3AED]">{calculations.totalROI.toFixed(0)}%</p>
      </div>
     </div>
     {calculations.breakEvenYear && (
      <div className="mt-4 p-3 bg-[#2563EB]/10 rounded-lg text-center">
       <p className="text-[#2563EB] text-sm">
         Break-even in <strong>Year {calculations.breakEvenYear}</strong> (recovers {useFinancing ? 'down payment' : 'investment'})
       </p>
      </div>
     )}
    </div>
   </div>
  </div>
 )
}

// ============================================
// TAB 4: 5-YEAR INVESTMENT PROJECTION
// ============================================
function InvestmentProjection({ onInputChange }: { onInputChange?: (inputs: Record<string, any>) => void }) {
 const currentYear = new Date().getFullYear()

 // Property Details
 const [initialInvestment, setInitialInvestment] = useState(1000000)
 const [propertyType, setPropertyType] = useState('Apartment')
 const [location, setLocation] = useState('')
 const [currentMarketValue, setCurrentMarketValue] = useState(5000000)

 // Appreciation
 const [appreciationRate, setAppreciationRate] = useState(7)
 const [scenario, setScenario] = useState<'conservative' | 'moderate' | 'optimistic'>('moderate')

 // Loan Details
 const [hasLoan, setHasLoan] = useState(true)
 const [loanAmount, setLoanAmount] = useState(4000000)
 const [loanInterestRate, setLoanInterestRate] = useState(8.5)
 const [loanTenure, setLoanTenure] = useState(20)

 // Investment Goal
 const [investmentGoal, setInvestmentGoal] = useState<'appreciation' | 'rental' | 'both'>('appreciation')

 // Scenario rates
 const scenarioRates = {
  conservative: 5,
  moderate: 7,
  optimistic: 10,
 }

 // Use scenario rate if selected
 const effectiveRate = scenarioRates[scenario]

 const calculations = useMemo(() => {
  const projectionYears = 5

  // Calculate EMI if loan exists
  let monthlyEMI = 0
  let annualEMI = 0
  if (hasLoan && loanAmount > 0) {
   const monthlyRate = loanInterestRate / 100 / 12
   const months = loanTenure * 12
   monthlyEMI = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
   annualEMI = monthlyEMI * 12
  }

  // Calculate yearly amortization
  const calculateLoanBalance = (startBalance: number, rate: number, emi: number, yearsElapsed: number) => {
   let balance = startBalance
   const monthlyRate = rate / 100 / 12
   for (let month = 0; month < yearsElapsed * 12 && balance > 0; month++) {
    const interest = balance * monthlyRate
    const principal = emi - interest
    balance = Math.max(0, balance - principal)
   }
   return balance
  }

  // Year-by-year projection for all scenarios
  const generateProjection = (rate: number) => {
   const data: {
    year: number
    calendarYear: number
    propertyValue: number
    equity: number
    loanBalance: number
    netWorth: number
    yoyGrowth: number
    principalPaid: number
   }[] = []

   let prevNetWorth = initialInvestment
   let totalPrincipalPaid = 0

   for (let year = 0; year <= projectionYears; year++) {
    const calendarYear = currentYear + year
    const propertyValue = currentMarketValue * Math.pow(1 + rate / 100, year)
    const loanBalance = hasLoan ? calculateLoanBalance(loanAmount, loanInterestRate, monthlyEMI, year) : 0
    const equity = propertyValue - loanBalance
    const netWorth = equity
    const yoyGrowth = year === 0 ? 0 : ((netWorth - prevNetWorth) / prevNetWorth) * 100

    // Principal paid this year
    const prevLoanBalance = year === 0 ? loanAmount : calculateLoanBalance(loanAmount, loanInterestRate, monthlyEMI, year - 1)
    const principalPaidThisYear = year === 0 ? 0 : (prevLoanBalance - loanBalance)
    totalPrincipalPaid += principalPaidThisYear

    data.push({
     year,
     calendarYear,
     propertyValue,
     equity,
     loanBalance,
     netWorth,
     yoyGrowth,
     principalPaid: principalPaidThisYear,
    })

    prevNetWorth = netWorth
   }

   return { data, totalPrincipalPaid }
  }

  // Generate projections for all scenarios
  const conservativeProjection = generateProjection(scenarioRates.conservative)
  const moderateProjection = generateProjection(scenarioRates.moderate)
  const optimisticProjection = generateProjection(scenarioRates.optimistic)

  // Use selected scenario for main display
  const mainProjection = scenario === 'conservative' ? conservativeProjection :
   scenario === 'optimistic' ? optimisticProjection : moderateProjection

  // Summary metrics (for selected scenario)
  const finalData = mainProjection.data[projectionYears]
  const initialData = mainProjection.data[0]

  const totalAppreciation = finalData.propertyValue - initialData.propertyValue
  const appreciationPercent = (totalAppreciation / initialData.propertyValue) * 100
  const equityBuilt = finalData.equity
  const loanPaidDown = hasLoan ? loanAmount - finalData.loanBalance : 0
  const totalWealthCreated = finalData.netWorth - initialData.netWorth

  // LTV Ratio
  const currentLTV = hasLoan ? (loanAmount / currentMarketValue) * 100 : 0
  const finalLTV = hasLoan ? (finalData.loanBalance / finalData.propertyValue) * 100 : 0

  return {
   mainProjection: mainProjection.data,
   conservativeProjection: conservativeProjection.data,
   moderateProjection: moderateProjection.data,
   optimisticProjection: optimisticProjection.data,
   totalAppreciation,
   appreciationPercent,
   equityBuilt,
   loanPaidDown,
   totalWealthCreated,
   totalPrincipalPaid: mainProjection.totalPrincipalPaid,
   currentLTV,
   finalLTV,
   monthlyEMI,
   annualEMI,
  }
 }, [currentMarketValue, effectiveRate, scenario, hasLoan, loanAmount, loanInterestRate, loanTenure, initialInvestment, currentYear])

 // Report inputs to parent
 useEffect(() => {
  onInputChange?.({
   initialInvestment, propertyType, location, currentMarketValue, scenario,
   hasLoan, loanAmount, loanInterestRate, loanTenure, investmentGoal
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [initialInvestment, propertyType, location, currentMarketValue, scenario,
  hasLoan, loanAmount, loanInterestRate, loanTenure, investmentGoal])

 // Chart data for selected scenario
 const chartData = calculations.mainProjection.map(d => ({
  year: d.calendarYear.toString(),
  'Property Value': Math.round(d.propertyValue),
  'Equity': Math.round(d.equity),
  'Loan Balance': Math.round(d.loanBalance),
 }))

 // Comparison chart data
 const comparisonData = calculations.mainProjection.map((d, i) => ({
  year: d.calendarYear.toString(),
  'Conservative (5%)': Math.round(calculations.conservativeProjection[i].netWorth),
  'Moderate (7%)': Math.round(calculations.moderateProjection[i].netWorth),
  'Optimistic (10%)': Math.round(calculations.optimisticProjection[i].netWorth),
 }))

 return (
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
   {/* Left Side - Input */}
   <div className="lg:col-span-2 space-y-6">
    {/* Property Details */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Building className="h-5 w-5 text-[#2563EB]" />
      Property Details
     </h3>

     <div className="space-y-4">
      <div>
       <label className="block text-sm text-gray-500 mb-2">Initial Investment (Down Payment)</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={initialInvestment}
         onChange={(e) => setInitialInvestment(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
      </div>

      <div>
       <label className="block text-sm text-gray-500 mb-2">Property Type</label>
       <select
        value={propertyType}
        onChange={(e) => setPropertyType(e.target.value)}
        className="w-full bg-white border border-[#E2E8F0]rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
       >
        <option>Apartment</option>
        <option>Villa</option>
        <option>Independent House</option>
        <option>Plot</option>
        <option>Commercial</option>
       </select>
      </div>

      <div>
       <label className="block text-sm text-gray-500 mb-2">Location</label>
       <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="e.g., Bangalore, Mumbai"
        className="w-full bg-white border border-[#E2E8F0]rounded-lg px-4 py-2.5 text-gray-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
       />
      </div>

      <div>
       <label className="block text-sm text-gray-500 mb-2">Current Market Value</label>
       <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
        <input
         type="number"
         value={currentMarketValue}
         onChange={(e) => setCurrentMarketValue(Number(e.target.value))}
         className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
       </div>
       <p className="text-xs text-gray-400 mt-1">{formatCurrency(currentMarketValue)}</p>
      </div>
     </div>
    </div>

    {/* Loan Details */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <label className="flex items-center gap-3 cursor-pointer mb-4">
      <input
       type="checkbox"
       checked={hasLoan}
       onChange={(e) => setHasLoan(e.target.checked)}
       className="w-5 h-5 rounded border-[#E2E8F0]bg-white text-[#2563EB] focus:ring-emerald-500"
      />
      <span className="text-gray-900 font-medium">Include Home Loan</span>
     </label>

     {hasLoan && (
      <div className="space-y-4">
       <div>
        <label className="block text-sm text-gray-500 mb-2">Loan Amount</label>
        <div className="relative">
         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
         <input
          type="number"
          value={loanAmount}
          onChange={(e) => setLoanAmount(Number(e.target.value))}
          className="w-full bg-white border border-[#E2E8F0]rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
         />
        </div>
       </div>

       <div>
        <div className="flex justify-between mb-2">
         <label className="text-sm text-gray-500">Interest Rate</label>
         <span className="text-sm text-[#2563EB]">{loanInterestRate}%</span>
        </div>
        <input
         type="range"
         min="6"
         max="15"
         step="0.1"
         value={loanInterestRate}
         onChange={(e) => setLoanInterestRate(Number(e.target.value))}
         className="w-full accent-[#2563EB]"
        />
       </div>

       <div>
        <div className="flex justify-between mb-2">
         <label className="text-sm text-gray-500">Loan Tenure</label>
         <span className="text-sm text-[#2563EB]">{loanTenure} years</span>
        </div>
        <input
         type="range"
         min="5"
         max="30"
         value={loanTenure}
         onChange={(e) => setLoanTenure(Number(e.target.value))}
         className="w-full accent-[#2563EB]"
        />
       </div>

       {hasLoan && (
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
         <p className="text-gray-500 text-xs">Monthly EMI</p>
         <p className="text-xl font-bold text-[#2563EB]">₹{formatNumber(calculations.monthlyEMI)}</p>
        </div>
       )}
      </div>
     )}
    </div>

    {/* Investment Goal */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
      <Target className="h-5 w-5 text-[#2563EB]" />
      Investment Goal
     </h3>

     <div className="space-y-2">
      {[
       { value: 'appreciation', label: 'Capital Appreciation', desc: 'Focus on property value growth' },
       { value: 'rental', label: 'Rental Income', desc: 'Focus on rental returns' },
       { value: 'both', label: 'Both', desc: 'Balanced approach' },
      ].map(({ value, label, desc }) => (
       <label
        key={value}
        className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all ${investmentGoal === value
         ? 'bg-[#EFF6FF] border-[#BFDBFE]'
         : 'bg-white border-[#E2E8F0] hover:border-[#93C5FD]'
         }`}
       >
        <input
         type="radio"
         name="investmentGoal"
         value={value}
         checked={investmentGoal === value}
         onChange={(e) => setInvestmentGoal(e.target.value as typeof investmentGoal)}
         className="mt-1 accent-[#2563EB]"
        />
        <div>
         <p className="text-gray-900 font-medium">{label}</p>
         <p className="text-xs text-gray-400">{desc}</p>
        </div>
       </label>
      ))}
     </div>
    </div>

    {/* Scenario Toggle */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Appreciation Scenario</h3>
     <div className="flex gap-2">
      {[
       { key: 'conservative', label: 'Conservative', rate: '5%', color: 'slate' },
       { key: 'moderate', label: 'Moderate', rate: '7%', color: 'emerald' },
       { key: 'optimistic', label: 'Optimistic', rate: '10%', color: 'amber' },
      ].map(({ key, label, rate, color }) => (
       <button
        key={key}
        onClick={() => setScenario(key as typeof scenario)}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${scenario === key
         ? key === 'conservative' ? 'bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]' :
          key === 'moderate' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]' :
           'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
         : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
         }`}
       >
        <div>{label}</div>
        <div className="text-xs opacity-70">{rate}</div>
       </button>
      ))}
     </div>
    </div>
   </div>

   {/* Right Side - Results */}
   <div className="lg:col-span-3 space-y-6">
    {/* Summary Cards */}
    <div className="grid grid-cols-2 gap-4">
     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1"> Total Appreciation</p>
      <p className="text-3xl font-bold text-[#2563EB]">{formatCurrency(calculations.totalAppreciation)}</p>
      <p className="text-xs text-gray-400 mt-2">+{calculations.appreciationPercent.toFixed(1)}% growth</p>
     </div>

     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1"> Equity Built</p>
      <p className="text-3xl font-bold text-[#059669]">{formatCurrency(calculations.equityBuilt)}</p>
      <p className="text-xs text-gray-400 mt-2">By {currentYear + 5}</p>
     </div>

     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1"> Loan Paid Down</p>
      <p className="text-3xl font-bold text-[#7C3AED]">{formatCurrency(calculations.loanPaidDown)}</p>
      <p className="text-xs text-gray-400 mt-2">Principal repaid</p>
     </div>

     <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-gray-500 text-sm mb-1"> Total Wealth Created</p>
      <p className="text-3xl font-bold text-[#D97706]">{formatCurrency(calculations.totalWealthCreated)}</p>
      <p className="text-xs text-gray-400 mt-2">Net worth increase</p>
     </div>
    </div>

    {/* LTV Gauge */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Loan-to-Value (LTV) Ratio</h3>
     <div className="flex items-center gap-8">
      <div className="flex-1">
       <div className="flex justify-between mb-2">
        <span className="text-gray-500 text-sm">Current LTV</span>
        <span className={`font-bold ${calculations.currentLTV <= 50 ? 'text-[#059669]' : calculations.currentLTV <= 75 ? 'text-[#D97706]' : 'text-[#EF4444]'}`}>
         {calculations.currentLTV.toFixed(0)}%
        </span>
       </div>
       <div className="w-full bg-[#E2E8F0] rounded-full h-3">
        <div
         className={`h-3 rounded-full transition-all ${calculations.currentLTV <= 50 ? 'bg-[#059669]' :
          calculations.currentLTV <= 75 ? 'bg-[#D97706]' : 'bg-[#EF4444]'
          }`}
         style={{ width: `${Math.min(calculations.currentLTV, 100)}%` }}
        />
       </div>
      </div>
      <div className="text-2xl">→</div>
      <div className="flex-1">
       <div className="flex justify-between mb-2">
        <span className="text-gray-500 text-sm">LTV by {currentYear + 5}</span>
        <span className={`font-bold ${calculations.finalLTV <= 50 ? 'text-[#059669]' : calculations.finalLTV <= 75 ? 'text-[#D97706]' : 'text-[#EF4444]'}`}>
         {calculations.finalLTV.toFixed(0)}%
        </span>
       </div>
       <div className="w-full bg-[#E2E8F0] rounded-full h-3">
        <div
         className={`h-3 rounded-full transition-all ${calculations.finalLTV <= 50 ? 'bg-[#059669]' :
          calculations.finalLTV <= 75 ? 'bg-[#D97706]' : 'bg-[#EF4444]'
          }`}
         style={{ width: `${Math.min(calculations.finalLTV, 100)}%` }}
        />
       </div>
      </div>
     </div>
     <p className="text-xs text-gray-400 mt-3 text-center">
      {calculations.finalLTV <= 50 ? ' Healthy LTV - less than 50%' :
       calculations.finalLTV <= 75 ? ' Moderate LTV - consider prepayments' :
        ' High LTV - risky position'}
     </p>
    </div>

    {/* 5-Year Projection Table */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> 5-Year Projection ({scenario.charAt(0).toUpperCase() + scenario.slice(1)})</h3>
     <div className="overflow-x-auto">
      <table className="w-full text-sm">
       <thead>
        <tr className="text-gray-500 border-b border-gray-200">
         <th className="text-left py-2 px-2">Year</th>
         <th className="text-right py-2 px-2">Property Value</th>
         <th className="text-right py-2 px-2">Equity</th>
         <th className="text-right py-2 px-2">Loan Balance</th>
         <th className="text-right py-2 px-2">Net Worth</th>
         <th className="text-right py-2 px-2">YoY Growth</th>
        </tr>
       </thead>
       <tbody>
        {calculations.mainProjection.map((row) => (
         <tr key={row.year} className="border-b border-gray-100 hover:bg-gray-50/30">
          <td className="py-2 px-2 text-gray-900 font-medium">{row.calendarYear}</td>
          <td className="text-right py-2 px-2 text-[#2563EB]">{formatCurrency(row.propertyValue)}</td>
          <td className="text-right py-2 px-2 text-[#2563EB]">{formatCurrency(row.equity)}</td>
          <td className="text-right py-2 px-2 text-[#D97706]">{formatCurrency(row.loanBalance)}</td>
          <td className="text-right py-2 px-2 text-[#7C3AED] font-semibold">{formatCurrency(row.netWorth)}</td>
          <td className={`text-right py-2 px-2 ${row.yoyGrowth > 0 ? 'text-[#059669]' : 'text-gray-500'}`}>
           {row.year === 0 ? '-' : `+${row.yoyGrowth.toFixed(0)}%`}
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    </div>

    {/* Wealth Growth Chart */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Wealth Growth Over 5 Years</h3>
     <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
       <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, 0)} />
        <Tooltip
         contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
         formatter={(value: number) => formatCurrency(value)}
        />
        <Legend />
        <Area type="monotone" dataKey="Property Value" stroke="#059669" fill="#059669" fillOpacity={0.3} />
        <Area type="monotone" dataKey="Equity" stroke="#2563EB" fill="#2563EB" fillOpacity={0.5} />
        {hasLoan && (
         <Area type="monotone" dataKey="Loan Balance" stroke="#D97706" fill="#D97706" fillOpacity={0.2} />
        )}
       </AreaChart>
      </ResponsiveContainer>
     </div>
    </div>

    {/* Scenario Comparison Chart */}
    <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0]">
     <h3 className="text-gray-900 font-semibold mb-4"> Scenario Comparison</h3>
     <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
       <LineChart data={comparisonData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, 0)} />
        <Tooltip
         contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
         formatter={(value: number) => formatCurrency(value)}
        />
        <Legend />
        <Line type="monotone" dataKey="Conservative (5%)" stroke="#94a3b8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Moderate (7%)" stroke="#059669" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Optimistic (10%)" stroke="#D97706" strokeWidth={2} dot={false} />
       </LineChart>
      </ResponsiveContainer>
     </div>
     <div className="grid grid-cols-3 gap-4 mt-4">
      <div className="text-center p-2 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
       <p className="text-xs text-gray-500">Conservative</p>
       <p className="text-lg font-bold text-gray-600">
        {formatCurrency(calculations.conservativeProjection[5]?.netWorth || 0)}
       </p>
      </div>
      <div className="text-center p-2 bg-[#2563EB]/10 rounded-lg border border-[#2563EB]/30">
       <p className="text-xs text-gray-500">Moderate</p>
       <p className="text-lg font-bold text-[#2563EB]">
        {formatCurrency(calculations.moderateProjection[5]?.netWorth || 0)}
       </p>
      </div>
      <div className="text-center p-2 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
       <p className="text-xs text-gray-500">Optimistic</p>
       <p className="text-lg font-bold text-[#D97706]">
        {formatCurrency(calculations.optimisticProjection[5]?.netWorth || 0)}
       </p>
      </div>
     </div>
    </div>
   </div>
  </div>
 )
}

// ============================================
// TAB 5: STAMP DUTY CALCULATOR
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
      { label: 'Other (no surcharge)',     value: 0   },
      { label: 'Mumbai (+ 1% metro cess)', value: 1   },
      { label: 'PMC/PCMC (+ 1% LBT)',      value: 1   },
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
      { label: 'Other', value: 0 },
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

  const { stampDutyPct, regPct, stampDutyAmt, regAmt, surchargeAmt, totalGovt, totalAcquisition } = useMemo(() => {
    let baseSd: number
    let regPct: number

    if (propType === 'commercial') {
      baseSd = stateData.commercial.rate
      regPct = stateData.commercial.reg
    } else {
      const r = stateData.residential
      baseSd = r[gender]
      regPct = r.reg
    }

    const surPct        = localBody.value
    const stampDutyPct  = baseSd + surPct
    const surchargeAmt  = propValue * (surPct / 100)
    const stampDutyAmt  = propValue * (stampDutyPct / 100)
    const regAmt        = propValue * (regPct / 100)
    // Telangana resale transfer duty
    const transferDuty  = (state === 'TS' && isResale) ? propValue * 0.015 : 0
    const totalGovt     = stampDutyAmt + regAmt + transferDuty
    const totalAcquisition = propValue + totalGovt

    return { stampDutyPct, regPct, stampDutyAmt, regAmt, surchargeAmt, totalGovt, totalAcquisition }
  }, [state, propValue, gender, propType, localBody, isResale, stateData])

  const fmtINR = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`
    if (v >= 100000)   return `₹${(v / 100000).toFixed(2)} L`
    return `₹${Math.round(v).toLocaleString('en-IN')}`
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0',
    borderRadius: 10, fontSize: 13, color: '#0F172A', outline: 'none',
    background: '#fff', boxSizing: 'border-box' as const,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#64748B',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    display: 'block', marginBottom: 6,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

      {/* ── Left: Inputs ── */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>Property Details</h3>

        {/* State */}
        <div>
          <label style={labelStyle}>State</label>
          <select value={state} onChange={e => { setState(e.target.value); setLocalBodyIdx(0) }} style={inputStyle}>
            {Object.entries(STAMP_DUTY_RATES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Property Value */}
        <div>
          <label style={labelStyle}>Property Value</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: 13 }}>₹</span>
            <input
              type="number" min={100000} step={100000}
              value={propValue}
              onChange={e => setPropValue(Number(e.target.value))}
              style={{ ...inputStyle, paddingLeft: 24 }}
            />
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{fmtINR(propValue)}</p>
        </div>

        {/* Property Type */}
        <div>
          <label style={labelStyle}>Property Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['residential', 'commercial'] as const).map(t => (
              <button key={t} onClick={() => setPropType(t)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${propType === t ? '#2563EB' : '#E2E8F0'}`, background: propType === t ? 'rgba(37,99,235,0.06)' : '#fff', color: propType === t ? '#2563EB' : '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Gender (residential only) */}
        {propType === 'residential' && (
          <div>
            <label style={labelStyle}>Buyer</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['male', 'female', 'joint'] as const).map(g => (
                <button key={g} onClick={() => setGender(g)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${gender === g ? '#7C3AED' : '#E2E8F0'}`, background: gender === g ? 'rgba(124,58,237,0.06)' : '#fff', color: gender === g ? '#7C3AED' : '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Local body */}
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

        {/* Resale toggle (Telangana) */}
        {state === 'TS' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={isResale} onChange={e => setIsResale(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#2563EB' }} />
            <span style={{ fontSize: 13, color: '#0F172A' }}>Resale property (+ 1.5% transfer duty)</span>
          </label>
        )}

        {/* State note */}
        {propType === 'residential' && stateData.residential.note && (
          <div style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontSize: 12, color: '#2563EB', margin: 0 }}>ℹ️ {stateData.residential.note}</p>
          </div>
        )}
      </div>

      {/* ── Right: Results ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Breakdown card */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total Govt Charges</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>{fmtINR(totalGovt)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0' }}>
              {((totalGovt / propValue) * 100).toFixed(2)}% of property value
            </p>
          </div>

          <div style={{ padding: '20px' }}>
            {[
              { label: 'Property Value',     value: propValue,      pct: null,          color: '#0F172A' },
              { label: `Stamp Duty (${stampDutyPct}%)`, value: stampDutyAmt, pct: stampDutyPct, color: '#2563EB' },
              { label: `Registration (${regPct}%)`,     value: regAmt,       pct: regPct,       color: '#059669' },
              ...(state === 'TS' && isResale ? [{ label: 'Transfer Duty (1.5%)', value: propValue * 0.015, pct: 1.5, color: '#D97706' }] : []),
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{fmtINR(row.value)}</span>
              </div>
            ))}

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', marginTop: 12, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Total Acquisition Cost</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{fmtINR(totalAcquisition)}</span>
            </div>
          </div>
        </div>

        {/* Rate reference card */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>{stateData.label} — Current Rates</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {propType === 'residential' ? (
              <>
                {(['male', 'female', 'joint'] as const).map(g => (
                  <div key={g} style={{ background: gender === g ? 'rgba(124,58,237,0.06)' : '#F8FAFC', border: `1px solid ${gender === g ? 'rgba(124,58,237,0.2)' : '#E2E8F0'}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: '#94A3B8', margin: '0 0 4px', textTransform: 'capitalize' }}>{g}</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>{stateData.residential[g]}%</p>
                    <p style={{ fontSize: 9, color: '#94A3B8', margin: '2px 0 0' }}>stamp duty</p>
                  </div>
                ))}
              </>
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

        {/* Compare all states */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>All States — Male Residential</p>
          {Object.entries(STAMP_DUTY_RATES).map(([k, v]) => {
            const total = v.residential.male + v.residential.reg
            const isActive = k === state
            return (
              <div key={k} onClick={() => { setState(k); setLocalBodyIdx(0) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: isActive ? 'rgba(37,99,235,0.05)' : 'transparent', marginBottom: 2 }}>
                <span style={{ fontSize: 12, color: isActive ? '#2563EB' : '#64748B', flex: 1, fontWeight: isActive ? 700 : 400 }}>{v.label}</span>
                <div style={{ flex: 2, height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(total / 15) * 100}%`, background: isActive ? '#2563EB' : '#94A3B8', borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#2563EB' : '#0F172A', minWidth: 36, textAlign: 'right' }}>{total}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN CALCULATORS PAGE
// ============================================
export default function CalculatorsPage() {
 const [activeTab, setActiveTab] = useState<CalculatorTab>('buy-vs-rent')
 const [showShareModal, setShowShareModal] = useState(false)
 const [shareLoading, setShareLoading] = useState(false)
 const [shareUrl, setShareUrl] = useState<string | null>(null)
 const [shareError, setShareError] = useState<string | null>(null)

 // Agent details for sharing
 const [agentName, setAgentName] = useState('')
 const [agentPhone, setAgentPhone] = useState('')
 const [companyName, setCompanyName] = useState('RealEstate')
 const [clientPhone, setClientPhone] = useState('')

 // Calculator input states - stored globally for sharing
 const [calculatorInputs, setCalculatorInputs] = useState<Record<string, any>>({})

 const tabs = [
  { id: 'buy-vs-rent', label: 'Buy vs Rent', icon: <Home className="h-4 w-4" />, color: 'emerald' },
  { id: 'emi', label: 'EMI Calculator', icon: <Calculator className="h-4 w-4" />, color: 'cyan' },
  { id: 'rental-yield', label: 'Rental Yield', icon: <TrendingUp className="h-4 w-4" />, color: 'amber' },
  { id: 'investment', label: '5-Year Projection', icon: <Target className="h-4 w-4" />, color: 'purple' },
  { id: 'stamp-duty', label: 'Stamp Duty', icon: <Building className="h-4 w-4" />, color: 'rose' },
 ] as const

 const handleOpenShareModal = () => {
  setShareUrl(null)
  setShareError(null)
  setShowShareModal(true)
 }

 const handleShare = async () => {
  setShareLoading(true)
  setShareError(null)

  try {
   // Get the current calculator inputs for the active tab
   const currentInputs = calculatorInputs[activeTab] || {}

   // Get agent ID from session if available
   const { data: { session } } = await supabase.auth.getSession()
   const agentId = session?.user?.id || 'mock-user-id' // Use mock ID if no session

   const response = await fetch('/api/calculations/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
     agentId,
     calculatorType: activeTab.replace('-', '_'),
     inputData: currentInputs,
     agentName,
     agentPhone,
     companyName,
    }),
   })

   const result = await response.json()

   if (result.success) {
    setShareUrl(result.url)
   } else {
    setShareError(result.error || 'Failed to generate link')
   }
  } catch (error) {
   console.error('Share error:', error)
   setShareError('Failed to generate shareable link')
  }

  setShareLoading(false)
 }

 const [copied, setCopied] = useState(false)

 const handleCopyLink = async () => {
  if (shareUrl) {
   await navigator.clipboard.writeText(shareUrl)
   setCopied(true)
   setTimeout(() => setCopied(false), 2000)
  }
 }

 const handleWhatsAppShare = () => {
  if (!shareUrl) return

  // Get calculator type name
  const calcTypeNames: Record<string, string> = {
   'buy-vs-rent': 'Buy vs Rent Comparison',
   'emi': 'EMI Calculator',
   'rental-yield': 'Rental Yield Analysis',
   'investment': '5-Year Investment Projection',
   'stamp-duty': 'Stamp Duty Calculator',
  }

  const calcName = calcTypeNames[activeTab] || 'ROI Analysis'
  const phone = clientPhone.replace(/\D/g, '')

  // Create a more detailed message
  const message = `Hi! \n\nI've prepared a detailed *${calcName}* for you.\n\nThis personalized analysis will help you make an informed decision about your real estate investment.\n\n View your analysis here:\n${shareUrl}\n\nFeel free to reach out if you have any questions!\n\nBest regards,\n${agentName || 'Your Real Estate Agent'}`

  const whatsappUrl = phone
   ? `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`
   : `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(whatsappUrl, '_blank')
 }

 // Update calculator inputs from child components
 const updateCalculatorInputs = (inputs: Record<string, any>) => {
  setCalculatorInputs(prev => ({ ...prev, [activeTab]: inputs }))
 }

 return (
  <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
   {/* Header */}
   <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
    <div className="flex items-center gap-4">
     <Link
      href="/dashboard"
      className="p-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] transition-colors"
     >
      <ChevronLeft className="h-5 w-5" />
     </Link>
     <div>
      <h1 className="text-2xl font-bold text-gray-900">ROI Calculators</h1>
      <p className="text-gray-500 text-sm">Make data-driven real estate decisions</p>
     </div>
    </div>

    <div className="flex items-center gap-3">
     <button
      onClick={handleOpenShareModal}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] transition-colors"
     >
      <Share2 className="h-4 w-4" />
      Share
     </button>
     <button
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white transition-colors"
     >
      <Download className="h-4 w-4" />
      Download PDF
     </button>
    </div>
   </div>

   {/* Tabs */}
   <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-white border border-[#E2E8F0] rounded-xl">
    {tabs.map((tab) => (
     <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id as CalculatorTab)}
      style={activeTab === tab.id
       ? { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 8 }
       : { background: 'transparent', color: '#64748B', border: '1px solid transparent', borderRadius: 8 }}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all hover:bg-[#F8FAFC]"
     >
      {tab.icon}
      {tab.label}
     </button>
    ))}
   </div>

   {/* Calculator Content */}
   <div className="animate-fade-in">
    {activeTab === 'buy-vs-rent' && <BuyVsRentCalculator onInputChange={updateCalculatorInputs} />}
    {activeTab === 'emi' && <EMICalculator onInputChange={updateCalculatorInputs} />}
    {activeTab === 'rental-yield' && <RentalYieldCalculator onInputChange={updateCalculatorInputs} />}
    {activeTab === 'investment' && <InvestmentProjection onInputChange={updateCalculatorInputs} />}
    {activeTab === 'stamp-duty' && <StampDutyCalculator />}
   </div>

   {/* Share Modal */}
   {showShareModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
     <div
      className="absolute inset-0 bg-black/60 "
      onClick={() => setShowShareModal(false)}
     />

     <div className="relative bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
       <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#F0EBFA] flex items-center justify-center">
         <Share2 className="h-5 w-5 text-[#2563EB]" />
        </div>
        <div>
         <h3 className="font-semibold text-gray-900">Share Calculator</h3>
         <p className="text-xs text-gray-400">Create a shareable link for your client</p>
        </div>
       </div>
       <button
        onClick={() => setShowShareModal(false)}
        className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
       >
        <X className="h-5 w-5" />
       </button>
      </div>

      {!shareUrl ? (
       <>
        {/* Agent Details Form */}
        <div className="space-y-4 mb-6">
         <div>
          <label className="block text-sm text-gray-500 mb-2">Your Name</label>
          <input
           type="text"
           value={agentName}
           onChange={(e) => setAgentName(e.target.value)}
           placeholder="e.g., Rahul Sharma"
           className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
          />
         </div>

         <div>
          <label className="block text-sm text-gray-500 mb-2">Your Phone (for client to contact)</label>
          <input
           type="tel"
           value={agentPhone}
           onChange={(e) => setAgentPhone(e.target.value)}
           placeholder="e.g., 9876543210"
           className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
          />
         </div>

         <div>
          <label className="block text-sm text-gray-500 mb-2">Company Name</label>
          <input
           type="text"
           value={companyName}
           onChange={(e) => setCompanyName(e.target.value)}
           placeholder="e.g., Dream Homes Realty"
           className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
          />
         </div>

         <div>
          <label className="block text-sm text-gray-500 mb-2">Client Phone (optional, for WhatsApp)</label>
          <input
           type="tel"
           value={clientPhone}
           onChange={(e) => setClientPhone(e.target.value)}
           placeholder="e.g., 9876543210"
           className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
          />
         </div>
        </div>

        {shareError && (
         <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#EF4444] text-sm">
          {shareError}
         </div>
        )}

        <button
         onClick={handleShare}
         disabled={shareLoading || !agentName}
         className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white py-3 rounded-xl font-medium transition-colors disabled:cursor-not-allowed"
        >
         {shareLoading ? (
          <>
           <Loader2 className="h-5 w-5 animate-spin" />
           Generating Link...
          </>
         ) : (
          <>
           <Share2 className="h-5 w-5" />
           Generate Shareable Link
          </>
         )}
        </button>
       </>
      ) : (
       <>
        {/* Success State */}
        <div className="text-center mb-6">
         <div className="w-16 h-16 rounded-lg bg-[#F0EBFA] flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-[#2563EB]" />
         </div>
         <h4 className="text-xl font-semibold text-gray-900 mb-2">Link Generated!</h4>
         <p className="text-gray-500 text-sm">Share this link with your client</p>
        </div>

        {/* URL Display */}
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 mb-4">
         <p className="text-[#2563EB] text-sm break-all">{shareUrl}</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
         <button
          onClick={handleCopyLink}
          className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${copied
           ? 'bg-[#2563EB] text-white'
           : 'bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A]'
           }`}
         >
          {copied ? (
           <>
            <CheckCircle className="h-4 w-4" />
            Copied!
           </>
          ) : (
           <>
            <Copy className="h-4 w-4" />
            Copy Link
           </>
          )}
         </button>
         <button
          onClick={handleWhatsAppShare}
          className="flex items-center justify-center gap-2 bg-[#059669] hover:bg-emerald-700 text-white py-3 rounded-xl font-medium transition-colors"
         >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
         </button>
        </div>

        <button
         onClick={() => { setShareUrl(null); setShowShareModal(false); }}
         className="w-full text-gray-500 hover:text-gray-900 text-sm transition-colors"
        >
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

