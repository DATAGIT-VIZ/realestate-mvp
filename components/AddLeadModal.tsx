'use client'

import { useState } from 'react'
import { X, User, Phone, Mail, MapPin, IndianRupee, Clock, Tag, Loader2, UserPlus, AlertCircle } from 'lucide-react'

type Props = { onClose: () => void; onSuccess: () => void }

type Form = {
  firstName: string
  lastName: string
  phone: string
  email: string
  city: string
  budgetMin: string
  budgetMax: string
  sourcePortal: string
  clientType: string
  propertyType: string
  timeline: string
  localities: string
}

const CLIENT_TYPES = ['Individual', 'Channel Partner', 'Agent', 'Interior Designer']

const SOURCE_OPTIONS = [
  'MagicBricks', '99acres', 'Housing.com', 'NoBroker',
  'Website', 'Referral', 'Facebook Ads', 'Google Ads',
  'Walk-in', 'Cold Call', 'WhatsApp', 'Other',
]

const PROPERTY_TYPES = [
  'Apartment', 'Villa', 'Plot', 'Independent House',
  'Commercial', 'Office Space', 'Retail', 'Warehouse', 'Other',
]

const TIMELINE_OPTIONS = [
  'Immediate (within 2 weeks)',
  'Within 1 Month',
  'Within 1–3 Months',
  'Within 3–6 Months',
  'Within 6–12 Months',
  'Just Exploring',
]

const EMPTY: Form = {
  firstName: '', lastName: '', phone: '', email: '',
  city: '', budgetMin: '', budgetMax: '',
  sourcePortal: '', clientType: '', propertyType: '', timeline: '', localities: '',
}

// Design tokens
const BG_OVERLAY = 'rgba(15,23,42,0.4)'
const BG_MODAL   = '#FFFFFF'
const BORDER     = '#E2E8F0'
const AMBER      = '#D97706'
const TEXT       = '#0F172A'
const MUTED      = '#64748B'

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        <Icon style={{ width: 11, height: 11 }} />{label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#F8FAFC',
  border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

export function AddLeadModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Form & { general: string }>>({})
  const [loading, setLoading] = useState(false)
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }))
    setErrors(prev => ({ ...prev, [k]: undefined, general: undefined }))
    setDuplicate(null)
  }

  const validate = (): boolean => {
    const errs: Partial<Form & { general: string }> = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.phone.trim()) errs.phone = 'Phone number is required'
    else if (!/^[+\d\s\-()]{7,15}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email'
    if (form.budgetMin && form.budgetMax && Number(form.budgetMin) > Number(form.budgetMax)) {
      errs.budgetMax = 'Max must be greater than min'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || undefined,
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          city: form.city.trim() || undefined,
          budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
          sourcePortal: form.sourcePortal || undefined,
          clientType: form.clientType || undefined,
          propertyType: form.propertyType ? [form.propertyType] : undefined,
          timeline: form.timeline || undefined,
          localities: form.localities ? form.localities.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          status: 'Fresh',
        }),
      })
      const json = await res.json()

      if (res.status === 409 && json.duplicate) {
        setDuplicate({ id: json.existingId, name: json.error.replace('Lead already exists: ', '') })
        return
      }
      if (json.error) throw new Error(json.error)
      const assignedId = json.data?.leadPortalId ?? null
      setCreatedId(assignedId)
      onSuccess()
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: BG_OVERLAY, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: BG_MODAL, border: `1px solid ${BORDER}`, borderRadius: 20, width: 'min(560px, calc(100vw - 24px))', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div className="px-4 sm:px-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus style={{ width: 16, height: 16, color: AMBER }} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: 0 }}>Add New Lead</h2>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Score is calculated automatically</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-4 py-4 sm:px-6 sm:py-5" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Duplicate warning */}
          {duplicate && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertCircle style={{ width: 15, height: 15, color: AMBER, flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, color: AMBER, fontWeight: 600, margin: '0 0 2px' }}>Duplicate detected</p>
                <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                  A lead with this phone already exists: <strong style={{ color: TEXT }}>{duplicate.name}</strong>
                </p>
              </div>
            </div>
          )}

          {/* General error */}
          {errors.general && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{errors.general}</p>
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First Name *" icon={User}>
              <input value={form.firstName} onChange={set('firstName')} placeholder="Rajesh" style={{ ...inputStyle, borderColor: errors.firstName ? 'rgba(239,68,68,0.5)' : BORDER }} />
              {errors.firstName && <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>{errors.firstName}</p>}
            </Field>
            <Field label="Last Name" icon={User}>
              <input value={form.lastName} onChange={set('lastName')} placeholder="Sharma" style={inputStyle} />
            </Field>
          </div>

          {/* Contact row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Phone *" icon={Phone}>
              <input value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" style={{ ...inputStyle, borderColor: errors.phone ? 'rgba(239,68,68,0.5)' : BORDER }} />
              {errors.phone && <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>{errors.phone}</p>}
            </Field>
            <Field label="Email" icon={Mail}>
              <input value={form.email} onChange={set('email')} type="email" placeholder="rajesh@example.com" style={{ ...inputStyle, borderColor: errors.email ? 'rgba(239,68,68,0.5)' : BORDER }} />
              {errors.email && <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>{errors.email}</p>}
            </Field>
          </div>

          {/* Budget row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget Min (₹)" icon={IndianRupee}>
              <input value={form.budgetMin} onChange={set('budgetMin')} type="number" placeholder="5000000" style={inputStyle} />
            </Field>
            <Field label="Budget Max (₹)" icon={IndianRupee}>
              <input value={form.budgetMax} onChange={set('budgetMax')} type="number" placeholder="8000000" style={{ ...inputStyle, borderColor: errors.budgetMax ? 'rgba(239,68,68,0.5)' : BORDER }} />
              {errors.budgetMax && <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>{errors.budgetMax}</p>}
            </Field>
          </div>

          {/* Client Type + Source Portal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Client Type *" icon={Tag}>
              <select value={form.clientType} onChange={set('clientType')} style={selectStyle}>
                <option value="">Select type</option>
                {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Source Portal" icon={Tag}>
              <select value={form.sourcePortal} onChange={set('sourcePortal')} style={selectStyle}>
                <option value="">Select source</option>
                {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Property Type */}
          <Field label="Property Type" icon={Tag}>
            <select value={form.propertyType} onChange={set('propertyType')} style={selectStyle}>
              <option value="">Select type</option>
              {PROPERTY_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>

          {/* Timeline + City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Timeline" icon={Clock}>
              <select value={form.timeline} onChange={set('timeline')} style={selectStyle}>
                <option value="">Select timeline</option>
                {TIMELINE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="City" icon={MapPin}>
              <input value={form.city} onChange={set('city')} placeholder="Mumbai, Pune…" style={inputStyle} />
            </Field>
          </div>

          {/* Localities */}
          <Field label="Preferred Localities (comma-separated)" icon={MapPin}>
            <input value={form.localities} onChange={set('localities')} placeholder="Baner, Wakad, Kothrud" style={inputStyle} />
          </Field>
        </form>

        {/* Footer */}
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '9px 20px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: loading ? 'rgba(245,158,11,0.6)' : AMBER, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />Saving…</> : <><UserPlus style={{ width: 13, height: 13 }} />Add Lead</>}
          </button>
        </div>
      </div>
    </div>
  )
}
