'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import { Suspense } from 'react'

const C = {
  bg:     '#F8FAFC',
  panel:  '#FFFFFF',
  border: '#E2E8F0',
  text:   '#0F172A',
  muted:  '#64748B',
  label:  '#94A3B8',
  blue:   '#2563EB',
  red:    '#EF4444',
}

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirectTo') ?? '/dashboard'

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // If already logged in, go straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(redirectTo)
    })
  }, [router, redirectTo])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        setError('Incorrect email or password.')
      } else if (authError.message.includes('Email not confirmed')) {
        setError('Please confirm your email before signing in.')
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    if (data.session) {
      window.location.href = redirectTo
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 12px 11px 42px',
    border: `1px solid ${C.border}`, borderRadius: 10,
    fontSize: 14, color: C.text, outline: 'none',
    background: '#FAFBFC', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #7600bc 0%, #b100cd 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>VP</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Sign in to Vya Pulse CRM</p>
        </div>

        {/* Card */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.label }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" style={inp} />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                <a href="#" style={{ fontSize: 12, color: C.blue, textDecoration: 'none', fontWeight: 500 }}>Forgot password?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.label }} />
                <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" style={{ ...inp, paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.label, display: 'flex' }}>
                  {showPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.red }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{ padding: '12px 0', background: loading ? '#E2E8F0' : C.blue, border: 'none', borderRadius: 12, color: loading ? C.label : '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              {loading ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Signing in…</> : 'Sign in'}
            </button>
          </form>

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 24, paddingTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
              Don't have an account?{' '}
              <Link href="/signup" style={{ color: C.blue, fontWeight: 600, textDecoration: 'none' }}>Create one free</Link>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: C.label, marginTop: 20 }}>
          Your data is encrypted and never shared.
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
