'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import {
  Building2,
  Phone,
  MessageCircle,
  Home,
  Calculator,
  TrendingUp,
  Target,
  IndianRupee,
  Calendar,
  Percent,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Share2,
  Building,
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
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts'

// Use the provided Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhqdhmlelprreniddodp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocWRobWxlbHBycmVuaWRkb2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDUxMDEsImV4cCI6MjA4MDQ4MTEwMX0.y-cOeeuhlbn6t3UW2byLdkjMSugFSUhm3gedTgb6bro'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

type CalculationType = 'buy_vs_rent' | 'emi' | 'rental_yield' | 'projection'

interface SharedCalculation {
  id: string
  agent_id: string | null
  lead_id: string | null
  calculator_type: CalculationType
  input_data: Record<string, any>
  created_at: string
  views_count: number
}

export default function SharedCalculationPage() {
  const params = useParams()
  const id = params.id as string

  const [calculation, setCalculation] = useState<SharedCalculation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCalculation = async () => {
      try {
        // Fetch the calculation
        const { data, error: fetchError } = await supabase
          .from('shared_calculations')
          .select('*')
          .eq('id', id)
          .single()

        if (fetchError) {
          setError('Calculation not found')
          setLoading(false)
          return
        }

        setCalculation(data)

        // Increment view count
        await supabase
          .from('shared_calculations')
          .update({ 
            views_count: (data.views_count || 0) + 1,
            last_viewed_at: new Date().toISOString()
          })
          .eq('id', id)

      } catch (err) {
        setError('Failed to load calculation')
      }
      setLoading(false)
    }

    if (id) {
      fetchCalculation()
    }
  }, [id])

  const handleWhatsAppContact = () => {
    if (!calculation?.input_data?.agent_phone) return
    const phone = calculation.input_data.agent_phone.replace(/\D/g, '')
    const message = `Hi! I saw the ${getCalculatorTitle(calculation.calculator_type)} you shared. I'd like to discuss this further.`
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handlePhoneContact = () => {
    if (!calculation?.input_data?.agent_phone) return
    window.open(`tel:${calculation.input_data.agent_phone}`, '_blank')
  }

  const getCalculatorTitle = (type: CalculationType) => {
    switch (type) {
      case 'buy_vs_rent': return 'Buy vs Rent Analysis'
      case 'emi': return 'EMI Calculator'
      case 'rental_yield': return 'Rental Yield Analysis'
      case 'projection': return '5-Year Investment Projection'
      default: return 'ROI Calculator'
    }
  }

  const getCalculatorIcon = (type: CalculationType) => {
    switch (type) {
      case 'buy_vs_rent': return <Home className="h-6 w-6" />
      case 'emi': return <Calculator className="h-6 w-6" />
      case 'rental_yield': return <TrendingUp className="h-6 w-6" />
      case 'projection': return <Target className="h-6 w-6" />
      default: return <Calculator className="h-6 w-6" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          <p className="text-slate-400">Loading calculation...</p>
        </div>
      </div>
    )
  }

  if (error || !calculation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Calculation Not Found</h1>
          <p className="text-slate-400 mb-6">This link may have expired or is invalid.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Go Home <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  const inputData = calculation.input_data
  const agentName = inputData.agent_name || 'Real Estate Agent'
  const companyName = inputData.company_name || 'RealEstate'
  const agentPhone = inputData.agent_phone

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{companyName}</h1>
              <p className="text-xs text-slate-500">ROI Calculator</p>
            </div>
          </div>
          
          {agentPhone && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePhoneContact}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                onClick={handleWhatsAppContact}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-sm mb-4">
            {getCalculatorIcon(calculation.calculator_type)}
            {getCalculatorTitle(calculation.calculator_type)}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Your Personalized Analysis
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Prepared by <span className="text-white font-medium">{agentName}</span> from {companyName}
          </p>
        </div>

        {/* Calculator-specific content */}
        {calculation.calculator_type === 'buy_vs_rent' && (
          <BuyVsRentResults data={inputData} />
        )}
        {calculation.calculator_type === 'emi' && (
          <EMIResults data={inputData} />
        )}
        {calculation.calculator_type === 'rental_yield' && (
          <RentalYieldResults data={inputData} />
        )}
        {calculation.calculator_type === 'projection' && (
          <ProjectionResults data={inputData} />
        )}

        {/* CTA Section */}
        <div className="mt-12 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl p-8 border border-emerald-500/30 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Interested in this property?
          </h2>
          <p className="text-slate-400 mb-6 max-w-lg mx-auto">
            I can help you make the right investment decision. Let's discuss your requirements and find the perfect property for you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {agentPhone && (
              <>
                <button
                  onClick={handlePhoneContact}
                  className="flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-6 py-3 rounded-xl font-semibold transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  Call {agentName.split(' ')[0]}
                </button>
                <button
                  onClick={handleWhatsAppContact}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </button>
              </>
            )}
          </div>
          {agentPhone && (
            <p className="text-slate-500 text-sm mt-4">
              📞 {agentPhone}
            </p>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-slate-500 text-sm">
          <p>Generated on {new Date(calculation.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}</p>
          <p className="mt-1">Powered by {companyName} • Professional Real Estate Services</p>
        </footer>
      </main>
    </div>
  )
}

// ============================================
// BUY VS RENT RESULTS COMPONENT
// ============================================
function BuyVsRentResults({ data }: { data: Record<string, any> }) {
  const {
    propertyPrice = 5000000,
    downPaymentPercent = 20,
    loanTenure = 20,
    interestRate = 8.5,
    stampDutyPercent = 7,
    monthlyRent = 25000,
    annualRentIncrease = 5,
    monthlyMaintenance = 3000,
    annualPropertyTaxPercent = 0.5,
    propertyAppreciation = 7,
    timeHorizon = 10,
    alternativeReturn = 8,
  } = data

  const calculations = useMemo(() => {
    const downPayment = propertyPrice * (downPaymentPercent / 100)
    const loanAmount = propertyPrice - downPayment
    const stampDuty = propertyPrice * (stampDutyPercent / 100)
    const totalInitialCost = downPayment + stampDuty

    // EMI Calculation
    const monthlyRate = interestRate / 100 / 12
    const months = loanTenure * 12
    const emi = monthlyRate > 0 
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
      : loanAmount / months

    // Year-by-year calculations
    let rentCumulative = 0
    let buyCostCumulative = totalInitialCost
    let currentRent = monthlyRent
    let loanBalance = loanAmount
    let investmentValue = totalInitialCost

    for (let year = 1; year <= timeHorizon; year++) {
      rentCumulative += currentRent * 12
      investmentValue = investmentValue * (1 + alternativeReturn / 100)
      
      // Calculate yearly principal payment
      let yearPrincipal = 0
      for (let m = 0; m < 12 && loanBalance > 0; m++) {
        const monthlyInterest = loanBalance * (interestRate / 100 / 12)
        const monthlyPrincipal = Math.min(emi - monthlyInterest, loanBalance)
        yearPrincipal += monthlyPrincipal
        loanBalance -= monthlyPrincipal
      }
      
      buyCostCumulative += (emi * 12) + (monthlyMaintenance * 12) + (propertyPrice * annualPropertyTaxPercent / 100)
      currentRent = currentRent * (1 + annualRentIncrease / 100)
    }

    const finalPropertyValue = propertyPrice * Math.pow(1 + propertyAppreciation / 100, timeHorizon)
    const finalEquity = finalPropertyValue - loanBalance
    const netGainLoss = finalEquity - investmentValue
    const isBuyingBetter = netGainLoss > 0

    return {
      emi,
      finalPropertyValue,
      finalEquity,
      investmentValue,
      netGainLoss,
      isBuyingBetter,
      rentCumulative,
      buyCostCumulative,
    }
  }, [propertyPrice, downPaymentPercent, loanTenure, interestRate, stampDutyPercent, monthlyRent, annualRentIncrease, monthlyMaintenance, annualPropertyTaxPercent, propertyAppreciation, timeHorizon, alternativeReturn])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Property Price</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(propertyPrice)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Monthly EMI</p>
          <p className="text-2xl font-bold text-emerald-400">₹{formatNumber(calculations.emi)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">vs Monthly Rent</p>
          <p className="text-2xl font-bold text-cyan-400">₹{formatNumber(monthlyRent)}</p>
        </div>
        <div className={`rounded-xl p-5 border ${calculations.isBuyingBetter ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <p className="text-slate-400 text-sm mb-1">Verdict ({timeHorizon} years)</p>
          <p className={`text-2xl font-bold ${calculations.isBuyingBetter ? 'text-green-400' : 'text-red-400'}`}>
            {calculations.isBuyingBetter ? 'Buy' : 'Rent'}
          </p>
        </div>
      </div>

      {/* Net Gain/Loss */}
      <div className={`rounded-2xl p-6 border ${calculations.isBuyingBetter ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
        <div className="flex items-center gap-4">
          {calculations.isBuyingBetter ? (
            <CheckCircle className="h-12 w-12 text-green-400" />
          ) : (
            <XCircle className="h-12 w-12 text-red-400" />
          )}
          <div>
            <p className="text-slate-400 text-sm">Net Gain/Loss over {timeHorizon} years</p>
            <p className={`text-3xl font-bold ${calculations.isBuyingBetter ? 'text-green-400' : 'text-red-400'}`}>
              {calculations.netGainLoss > 0 ? '+' : ''}{formatCurrency(calculations.netGainLoss)}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {calculations.isBuyingBetter 
                ? `Buying is ${formatCurrency(Math.abs(calculations.netGainLoss))} more profitable than renting`
                : `Renting saves you ${formatCurrency(Math.abs(calculations.netGainLoss))} over buying`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">📈 If You Buy</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Property Value (Year {timeHorizon})</span>
              <span className="text-emerald-400 font-medium">{formatCurrency(calculations.finalPropertyValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Equity Built</span>
              <span className="text-cyan-400 font-medium">{formatCurrency(calculations.finalEquity)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Cost Paid</span>
              <span className="text-amber-400 font-medium">{formatCurrency(calculations.buyCostCumulative)}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">🏠 If You Rent</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Rent Paid</span>
              <span className="text-red-400 font-medium">{formatCurrency(calculations.rentCumulative)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Investment Growth</span>
              <span className="text-emerald-400 font-medium">{formatCurrency(calculations.investmentValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Asset Owned</span>
              <span className="text-slate-500 font-medium">₹0 (No property)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// EMI RESULTS COMPONENT
// ============================================
function EMIResults({ data }: { data: Record<string, any> }) {
  const {
    loanAmount = 4000000,
    interestRate = 8.5,
    tenure = 20,
  } = data

  const calculations = useMemo(() => {
    const monthlyRate = interestRate / 100 / 12
    const months = tenure * 12
    const emi = monthlyRate > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
      : loanAmount / months
    
    const totalPayment = emi * months
    const totalInterest = totalPayment - loanAmount

    return { emi, totalPayment, totalInterest }
  }, [loanAmount, interestRate, tenure])

  return (
    <div className="space-y-6">
      {/* EMI Display */}
      <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl p-8 border border-emerald-500/30 text-center">
        <p className="text-slate-400 text-lg mb-2">Your Monthly EMI</p>
        <p className="text-5xl font-bold text-emerald-400">₹{formatNumber(calculations.emi)}</p>
        <p className="text-slate-500 mt-2">for {tenure} years at {interestRate}% interest</p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 text-center">
          <p className="text-slate-400 text-sm mb-1">Principal Amount</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(loanAmount)}</p>
          <p className="text-xs text-slate-500 mt-1">{Math.round(loanAmount / calculations.totalPayment * 100)}% of total</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 text-center">
          <p className="text-slate-400 text-sm mb-1">Total Interest</p>
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(calculations.totalInterest)}</p>
          <p className="text-xs text-slate-500 mt-1">{Math.round(calculations.totalInterest / calculations.totalPayment * 100)}% of total</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 text-center">
          <p className="text-slate-400 text-sm mb-1">Total Payment</p>
          <p className="text-2xl font-bold text-purple-400">{formatCurrency(calculations.totalPayment)}</p>
          <p className="text-xs text-slate-500 mt-1">Over {tenure} years</p>
        </div>
      </div>

      {/* Visual Split */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">Principal vs Interest Split</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-slate-400 text-sm">Principal</span>
              <span className="text-emerald-400 font-medium">{formatCurrency(loanAmount)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-emerald-500 h-4 rounded-l-full" 
                style={{ width: `${Math.round(loanAmount / calculations.totalPayment * 100)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-slate-400 text-sm">Interest</span>
              <span className="text-amber-400 font-medium">{formatCurrency(calculations.totalInterest)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-amber-500 h-4 rounded-l-full" 
                style={{ width: `${Math.round(calculations.totalInterest / calculations.totalPayment * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// RENTAL YIELD RESULTS COMPONENT
// ============================================
function RentalYieldResults({ data }: { data: Record<string, any> }) {
  const {
    propertyPrice = 5000000,
    monthlyRent = 20000,
    occupancyRate = 90,
    monthlyMaintenance = 3000,
    annualPropertyTax = 25000,
    annualInsurance = 5000,
    managementFeePercent = 5,
    years = 10,
  } = data

  const calculations = useMemo(() => {
    const annualGrossRent = monthlyRent * 12
    const effectiveRent = annualGrossRent * (occupancyRate / 100)
    const managementFee = effectiveRent * (managementFeePercent / 100)
    const annualMaintenance = monthlyMaintenance * 12
    const totalExpenses = annualMaintenance + annualPropertyTax + annualInsurance + managementFee
    const netOperatingIncome = effectiveRent - totalExpenses

    const grossYield = (annualGrossRent / propertyPrice) * 100
    const netYield = (netOperatingIncome / propertyPrice) * 100

    return { grossYield, netYield, netOperatingIncome, effectiveRent, totalExpenses }
  }, [propertyPrice, monthlyRent, occupancyRate, monthlyMaintenance, annualPropertyTax, annualInsurance, managementFeePercent])

  const yieldRating = calculations.netYield >= 6 ? 'Excellent' : 
                      calculations.netYield >= 4 ? 'Good' : 
                      calculations.netYield >= 2.5 ? 'Average' : 'Poor'
  const yieldColor = calculations.netYield >= 6 ? 'text-green-400' : 
                     calculations.netYield >= 4 ? 'text-emerald-400' : 
                     calculations.netYield >= 2.5 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-6">
      {/* Yield Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl p-6 border border-emerald-500/30 text-center">
          <p className="text-slate-400 text-sm mb-1">Gross Rental Yield</p>
          <p className="text-4xl font-bold text-emerald-400">{calculations.grossYield.toFixed(2)}%</p>
          <p className="text-xs text-slate-500 mt-2">Annual rent / Property price</p>
        </div>
        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-2xl p-6 border border-cyan-500/30 text-center">
          <p className="text-slate-400 text-sm mb-1">Net Rental Yield</p>
          <p className="text-4xl font-bold text-cyan-400">{calculations.netYield.toFixed(2)}%</p>
          <p className="text-xs text-slate-500 mt-2">After all expenses</p>
        </div>
      </div>

      {/* Investment Rating */}
      <div className={`rounded-2xl p-6 border ${
        calculations.netYield >= 4 ? 'bg-green-500/10 border-green-500/30' : 
        calculations.netYield >= 2.5 ? 'bg-amber-500/10 border-amber-500/30' : 
        'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center gap-4">
          <span className="text-4xl">
            {calculations.netYield >= 4 ? '✅' : calculations.netYield >= 2.5 ? '⚠️' : '❌'}
          </span>
          <div>
            <p className={`text-2xl font-bold ${yieldColor}`}>{yieldRating} Investment</p>
            <p className="text-slate-400 text-sm">
              {calculations.netYield >= 4 ? 'Good returns - worth considering' : 
               calculations.netYield >= 2.5 ? 'Marginal returns - negotiate the price' : 
               'Poor returns - look for better options'}
            </p>
          </div>
        </div>
      </div>

      {/* Cash Flow */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">Annual Cash Flow</h3>
        <div className="space-y-3">
          <div className="flex justify-between p-3 bg-emerald-500/10 rounded-lg">
            <span className="text-slate-300">+ Rental Income</span>
            <span className="text-emerald-400 font-medium">+{formatCurrency(calculations.effectiveRent)}</span>
          </div>
          <div className="flex justify-between p-3 bg-red-500/10 rounded-lg">
            <span className="text-slate-300">- Expenses</span>
            <span className="text-red-400 font-medium">-{formatCurrency(calculations.totalExpenses)}</span>
          </div>
          <div className={`flex justify-between p-3 rounded-lg border-2 ${
            calculations.netOperatingIncome >= 0 ? 'bg-green-500/20 border-green-500/50' : 'bg-red-500/20 border-red-500/50'
          }`}>
            <span className="text-white font-semibold">= Net Cash Flow</span>
            <span className={`text-xl font-bold ${calculations.netOperatingIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(calculations.netOperatingIncome)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// 5-YEAR PROJECTION RESULTS COMPONENT
// ============================================
function ProjectionResults({ data }: { data: Record<string, any> }) {
  const currentYear = new Date().getFullYear()
  const {
    currentMarketValue = 5000000,
    scenario = 'moderate',
    hasLoan = true,
    loanAmount = 4000000,
    loanInterestRate = 8.5,
    loanTenure = 20,
  } = data

  const scenarioRates: Record<string, number> = {
    conservative: 5,
    moderate: 7,
    optimistic: 10,
  }

  const appreciationRate = scenarioRates[scenario] || 7

  const calculations = useMemo(() => {
    // Calculate EMI
    let monthlyEMI = 0
    if (hasLoan && loanAmount > 0) {
      const monthlyRate = loanInterestRate / 100 / 12
      const months = loanTenure * 12
      monthlyEMI = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                   (Math.pow(1 + monthlyRate, months) - 1)
    }

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

    const projection = []
    for (let year = 0; year <= 5; year++) {
      const propertyValue = currentMarketValue * Math.pow(1 + appreciationRate / 100, year)
      const loanBalance = hasLoan ? calculateLoanBalance(loanAmount, loanInterestRate, monthlyEMI, year) : 0
      const equity = propertyValue - loanBalance
      projection.push({ year: currentYear + year, propertyValue, loanBalance, equity })
    }

    const totalAppreciation = projection[5].propertyValue - projection[0].propertyValue
    const equityBuilt = projection[5].equity
    const loanPaidDown = hasLoan ? loanAmount - projection[5].loanBalance : 0

    return { projection, totalAppreciation, equityBuilt, loanPaidDown, monthlyEMI }
  }, [currentMarketValue, appreciationRate, hasLoan, loanAmount, loanInterestRate, loanTenure, currentYear])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl p-5 border border-emerald-500/30 text-center">
          <p className="text-slate-400 text-sm mb-1">Total Appreciation</p>
          <p className="text-3xl font-bold text-emerald-400">{formatCurrency(calculations.totalAppreciation)}</p>
          <p className="text-xs text-slate-500 mt-1">+{((calculations.totalAppreciation / currentMarketValue) * 100).toFixed(0)}% growth</p>
        </div>
        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-2xl p-5 border border-cyan-500/30 text-center">
          <p className="text-slate-400 text-sm mb-1">Equity Built</p>
          <p className="text-3xl font-bold text-cyan-400">{formatCurrency(calculations.equityBuilt)}</p>
          <p className="text-xs text-slate-500 mt-1">By {currentYear + 5}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 rounded-2xl p-5 border border-purple-500/30 text-center">
          <p className="text-slate-400 text-sm mb-1">Loan Paid Down</p>
          <p className="text-3xl font-bold text-purple-400">{formatCurrency(calculations.loanPaidDown)}</p>
          <p className="text-xs text-slate-500 mt-1">Principal repaid</p>
        </div>
      </div>

      {/* 5-Year Table */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">📅 5-Year Projection ({scenario})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 px-2">Year</th>
                <th className="text-right py-2 px-2">Property Value</th>
                <th className="text-right py-2 px-2">Loan Balance</th>
                <th className="text-right py-2 px-2">Equity</th>
              </tr>
            </thead>
            <tbody>
              {calculations.projection.map((row, i) => (
                <tr key={i} className="border-b border-slate-700/50">
                  <td className="py-2 px-2 text-white font-medium">{row.year}</td>
                  <td className="text-right py-2 px-2 text-emerald-400">{formatCurrency(row.propertyValue)}</td>
                  <td className="text-right py-2 px-2 text-amber-400">{formatCurrency(row.loanBalance)}</td>
                  <td className="text-right py-2 px-2 text-cyan-400 font-semibold">{formatCurrency(row.equity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hasLoan && (
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <p className="text-slate-400 text-sm">Monthly EMI</p>
          <p className="text-2xl font-bold text-emerald-400">₹{formatNumber(calculations.monthlyEMI)}</p>
        </div>
      )}
    </div>
  )
}

