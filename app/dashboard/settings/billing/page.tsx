'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle, Zap, Users, Shield, Loader2,
  AlertCircle, ExternalLink, X, ChevronRight,
  CreditCard, Calendar, RefreshCw,
} from 'lucide-react'
import { PLANS } from '@/lib/razorpay'
import type { PlanId } from '@/lib/razorpay'

const C = {
  bg:      '#F8FAFC',
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  blue:    '#2563EB',
  emerald: '#059669',
  amber:   '#D97706',
  red:     '#EF4444',
  violet:  '#7C3AED',
}

type BillingStatus = {
  plan:                   PlanId
  status:                 string
  razorpaySubscriptionId: string | null
  currentPeriodEnd:       string | null
  cancelAtPeriodEnd:      boolean
  cancelledAt:            string | null
  invoices:               { id: string; date: number; amount_paid: number; status: string; short_url: string }[]
  razorpayConfigured:     boolean
}

declare global {
  interface Window { Razorpay: new (opts: Record<string, unknown>) => { open(): void } }
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free:  <Shield  style={{ width: 20, height: 20 }} />,
  pro:   <Zap     style={{ width: 20, height: 20 }} />,
  team:  <Users   style={{ width: 20, height: 20 }} />,
}

function PlanCard({
  planId, current, onUpgrade, loading,
}: {
  planId:    PlanId
  current:   PlanId
  onUpgrade: (p: PlanId) => void
  loading:   boolean
}) {
  const plan      = PLANS[planId]
  const isCurrent = planId === current
  const isUpgrade = planId !== 'free' && planId !== current
  const isDowngrade = planId === 'free' && current !== 'free'

  const accentColor = plan.color

  return (
    <div style={{
      background:    C.panel,
      border:        `${isCurrent ? '2px' : '1px'} solid ${isCurrent ? accentColor : C.border}`,
      borderRadius:  20,
      padding:       28,
      position:      'relative',
      overflow:      'hidden',
      flex:          1,
    }}>
      {isCurrent && (
        <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 10, fontWeight: 700, background: accentColor, color: '#fff', padding: '3px 10px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Current
        </div>
      )}

      {/* Plan header */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor, marginBottom: 14 }}>
        {PLAN_ICONS[planId]}
      </div>

      <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{plan.label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: C.text }}>{plan.priceLabel}</span>
        {plan.price > 0 && <span style={{ fontSize: 12, color: C.muted }}>/{plan.period.replace('per ', '')}</span>}
      </div>
      {plan.price === 0 && <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Free forever</p>}
      {plan.price > 0  && <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>billed monthly · cancel anytime</p>}

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
        {plan.features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle style={{ width: 14, height: 14, color: accentColor, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.text }}>{f}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {isCurrent ? (
        <div style={{ padding: '11px 0', textAlign: 'center', borderRadius: 12, background: `${accentColor}10`, fontSize: 13, fontWeight: 700, color: accentColor }}>
          Active Plan
        </div>
      ) : isUpgrade ? (
        <button onClick={() => onUpgrade(planId)} disabled={loading}
          style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: 'none', background: loading ? C.border : accentColor, color: loading ? C.label : '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {loading ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
          Upgrade to {plan.label}
        </button>
      ) : isDowngrade ? (
        <button onClick={() => onUpgrade(planId)} disabled={loading}
          style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Downgrade to Free
        </button>
      ) : null}
    </div>
  )
}

export default function BillingPage() {
  const [status,       setStatus]       = useState<BillingStatus | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [upgrading,    setUpgrading]    = useState(false)
  const [cancelling,   setCancelling]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [showCancel,   setShowCancel]   = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/billing/status')
      const json = await res.json()
      setStatus(json.data)
    } catch { setError('Failed to load billing info') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // Load Razorpay checkout.js
  useEffect(() => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    document.head.appendChild(s)
    return () => { document.head.removeChild(s) }
  }, [])

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === 'free') { setShowCancel(true); return }

    if (!status?.razorpayConfigured) {
      setError('Razorpay is not configured yet. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and the plan IDs to .env.local.')
      return
    }

    setUpgrading(true)
    setError(null)
    try {
      const res  = await fetch('/api/billing/create-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: planId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const { subscriptionId, keyId, planLabel, amount } = json.data

      const rzp = new window.Razorpay({
        key:             keyId,
        subscription_id: subscriptionId,
        name:            'RealEdge CRM',
        description:     `${planLabel} Plan — Monthly`,
        image:           '/favicon.ico',
        currency:        'INR',
        amount,
        prefill:         {},
        theme:           { color: '#2563EB' },
        modal:           { ondismiss: () => setUpgrading(false) },
        handler:         () => {
          // Payment successful — webhook will update Supabase; poll status
          setTimeout(fetchStatus, 3000)
          setUpgrading(false)
        },
      })
      rzp.open()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout')
      setUpgrading(false)
    }
  }

  const handleCancel = async (immediately: boolean) => {
    setCancelling(true)
    setShowCancel(false)
    try {
      const res  = await fetch('/api/billing/cancel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ immediately }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      fetchStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancellation failed')
    } finally { setCancelling(false) }
  }

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`
  const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader2 style={{ width: 22, height: 22, color: C.blue, animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, color: C.muted }}>Loading billing…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const currentPlan = (status?.plan ?? 'free') as PlanId
  const planData    = PLANS[currentPlan]

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* Header */}
        <div style={{ padding: '28px 0 28px', borderBottom: `1px solid ${C.border}`, marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Billing & Plan</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Manage your RealEdge subscription</p>
          </div>
          <button onClick={() => { setRefreshing(true); fetchStatus() }}
            style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}>
            <RefreshCw style={{ width: 15, height: 15, color: C.muted, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(239,68,68,0.05)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
            <AlertCircle style={{ width: 15, height: 15, color: C.red, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: C.red, margin: 0 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.red }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
        )}

        {/* Current plan summary */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '20px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `${planData.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: planData.color, flexShrink: 0 }}>
            {PLAN_ICONS[currentPlan]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{planData.label} Plan</p>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: status?.status === 'active' ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)', color: status?.status === 'active' ? C.emerald : C.red, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {status?.status ?? 'active'}
              </span>
              {status?.cancelAtPeriodEnd && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(217,119,6,0.1)', color: C.amber }}>Cancels at period end</span>
              )}
            </div>
            {status?.currentPeriodEnd && (
              <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar style={{ width: 11, height: 11 }} />
                Next billing: {new Date(status.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {currentPlan === 'free' && (
              <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0' }}>Free plan — upgrade to unlock AI features, Exotel calling, and bulk WhatsApp</p>
            )}
          </div>
          {currentPlan !== 'free' && !status?.cancelAtPeriodEnd && (
            <button onClick={() => setShowCancel(true)} disabled={cancelling}
              style={{ padding: '8px 16px', borderRadius: 9, border: `1px solid rgba(239,68,68,0.25)`, background: 'rgba(239,68,68,0.04)', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Cancel Plan
            </button>
          )}
        </div>

        {/* Plan cards */}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Choose a Plan</h2>
        <div style={{ display: 'flex', gap: 16, marginBottom: 40 }}>
          {(Object.keys(PLANS) as PlanId[]).map(id => (
            <PlanCard key={id} planId={id} current={currentPlan} onUpgrade={handleUpgrade} loading={upgrading} />
          ))}
        </div>

        {/* Razorpay not configured notice */}
        {!status?.razorpayConfigured && (
          <div style={{ background: 'rgba(217,119,6,0.04)', border: `1px solid rgba(217,119,6,0.2)`, borderRadius: 14, padding: '16px 20px', marginBottom: 32, display: 'flex', gap: 12 }}>
            <AlertCircle style={{ width: 16, height: 16, color: C.amber, flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Razorpay not configured</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 8px' }}>Add these keys to <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>.env.local</code> to enable payments:</p>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.blue, lineHeight: 1.8 }}>
                RAZORPAY_KEY_ID=rzp_live_...<br />
                RAZORPAY_KEY_SECRET=...<br />
                RAZORPAY_WEBHOOK_SECRET=...<br />
                RAZORPAY_PLAN_PRO_MONTHLY=plan_...<br />
                RAZORPAY_PLAN_TEAM_MONTHLY=plan_...
              </div>
            </div>
          </div>
        )}

        {/* Invoice history */}
        {(status?.invoices?.length ?? 0) > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard style={{ width: 15, height: 15, color: C.muted }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Invoice History</h3>
            </div>
            {status!.invoices.map((inv, i) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: i < status!.invoices.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{fmt(inv.amount_paid)}</p>
                  <p style={{ fontSize: 11, color: C.label, margin: '2px 0 0' }}>{fmtDate(inv.date)}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: inv.status === 'paid' ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)', color: inv.status === 'paid' ? C.emerald : C.red, marginRight: 12 }}>
                  {inv.status}
                </span>
                {inv.short_url && (
                  <a href={inv.short_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.blue, textDecoration: 'none', fontWeight: 600 }}>
                    View <ExternalLink style={{ width: 11, height: 11 }} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel modal */}
      {showCancel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setShowCancel(false)}>
          <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, padding: 28, width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Cancel Subscription?</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
              You can cancel at the end of your current billing period (keep access until then) or cancel immediately and lose access now.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => handleCancel(false)}
                style={{ padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel at period end (recommended)
              </button>
              <button onClick={() => handleCancel(true)}
                style={{ padding: '11px 0', borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.08)', color: C.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancel immediately
              </button>
              <button onClick={() => setShowCancel(false)}
                style={{ padding: '11px 0', borderRadius: 10, border: 'none', background: '#F1F5F9', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Keep my plan
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
