'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, User, Phone, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react'

const C = {
  bg:      '#F8FAFC',
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  blue:    '#2563EB',
  emerald: '#059669',
  red:     '#EF4444',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 12px 11px 42px',
  border: `1px solid ${C.border}`, borderRadius: 10,
  fontSize: 14, color: C.text, outline: 'none',
  background: '#FAFBFC', boxSizing: 'border-box',
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: C.muted,
  marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em',
}

export default function SignupPage() {
  const router = useRouter()

  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // If email confirmation is disabled in Supabase → session returned immediately
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle style={{ width: 28, height: 28, color: C.emerald }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>Check your email</h2>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <p style={{ fontSize: 12, color: C.label, margin: 0 }}>
            Didn&apos;t receive it? Check spam or{' '}
            <button onClick={() => setSuccess(false)} style={{ background: 'none', border: 'none', color: C.blue, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>try again</button>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>RE</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Start your free trial</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>14 days free · No credit card required</p>
        </div>

        {/* Card */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={lbl}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.label }} />
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Rahul Sharma" autoComplete="name" style={inp} />
              </div>
            </div>

            <div>
              <label style={lbl}>Work Email</label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.label }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" style={inp} />
              </div>
            </div>

            <div>
              <label style={lbl}>Mobile Number</label>
              <div style={{ position: 'relative' }}>
                <Phone style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.label }} />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210" autoComplete="tel" style={inp} />
              </div>
            </div>

            <div>
              <label style={lbl}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.label }} />
                <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" autoComplete="new-password" style={{ ...inp, paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.label, display: 'flex' }}>
                  {showPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.red }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ padding: '12px 0', background: loading ? '#E2E8F0' : C.blue, border: 'none', borderRadius: 12, color: loading ? C.label : '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
              {loading ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Creating account…</> : 'Create free account'}
            </button>

            <p style={{ fontSize: 11, color: C.label, textAlign: 'center', margin: 0 }}>
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, paddingTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: C.blue, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          {['All features unlocked', 'No credit card', 'Cancel anytime'].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle style={{ width: 13, height: 13, color: C.emerald }} />
              <span style={{ fontSize: 12, color: C.muted }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
