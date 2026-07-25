'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, User, Phone, Loader2, Eye, EyeOff, CheckCircle, TrendingUp, Users, Zap, Shield } from 'lucide-react'

const LEFT_BG = `
  radial-gradient(ellipse at 15% 85%, rgba(0,56,168,0.25) 0%, transparent 55%),
  radial-gradient(ellipse at 85% 15%, rgba(77,127,208,0.2) 0%, transparent 55%),
  radial-gradient(ellipse at 55% 55%, rgba(244,248,253,0.95) 0%, transparent 65%),
  #F4F8FD
`.trim()

const FEATURES = [
  { icon: TrendingUp, text: 'Auto-sync leads from 99acres, MagicBricks & Housing' },
  { icon: Users,      text: 'Assign, track and follow-up with your entire team' },
  { icon: Zap,        text: 'AI lead scoring so you always call the right person first' },
  { icon: Shield,     text: 'Bank-grade encryption — your data stays yours' },
]

const PERKS = ['All features unlocked', 'No credit card', 'Cancel anytime']

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#0F172A' }}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

export default function SignupPage() {
  const router = useRouter()

  const [fullName,      setFullName]      = useState('')
  const [email,         setEmail]         = useState('')
  const [phone,         setPhone]         = useState('')
  const [password,      setPassword]      = useState('')
  const [showPass,      setShowPass]      = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [success,       setSuccess]       = useState(false)

  const handleGoogle = async () => {
    setError(null)
    setGoogleLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (oauthError) { setError(oauthError.message); setGoogleLoading(false) }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone }, emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data.session) { router.push('/dashboard'); router.refresh(); return }
    setSuccess(true)
    setLoading(false)
  }

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '11px 12px 11px 40px',
    border: '1px solid #E2E8F0', borderRadius: 2,
    fontSize: 14, color: '#0F172A', outline: 'none',
    background: '#FAFAFA', boxSizing: 'border-box',
    ...extra,
  })

  /* ── Success state ── */
  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F8FD', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 2, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', borderRadius: 2 }}>
            <CheckCircle style={{ width: 24, height: 24, color: '#059669' }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 10px' }}>Check your email</h2>
          <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 24px', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: '#0F172A' }}>{email}</strong>. Click it to activate your account.
          </p>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
            Didn&apos;t receive it? Check spam or{' '}
            <button onClick={() => setSuccess(false)} style={{ background: 'none', border: 'none', color: '#0038A8', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
              try again
            </button>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}>

      {/* ── Left: marketing panel ── */}
      <div className="hidden lg:flex" style={{ flex: '1 1 0', background: LEFT_BG, flexDirection: 'column', padding: '0 56px', position: 'relative', overflow: 'hidden' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#0038A8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>LG</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '0.04em' }}>LEAD GAP</span>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {['Features', 'How it works', 'Pricing'].map(l => (
              <Link key={l} href="/#" style={{ fontSize: 13, color: '#64748B', textDecoration: 'none', fontWeight: 500 }}>{l}</Link>
            ))}
          </div>
        </div>

        {/* Hero copy */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 80 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: '#0047AB', marginBottom: 20 }}>
            14 days free · No credit card
          </p>
          <h1 style={{ fontSize: 'clamp(32px, 3.5vw, 52px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#0F172A', margin: '0 0 20px' }}>
            Your leads.<br />
            <span style={{ color: '#0038A8', fontStyle: 'italic' }}>Never drop one.</span>
          </h1>
          <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, maxWidth: 420, margin: '0 0 40px' }}>
            The CRM built for Indian real estate teams. Sync portals, score leads with AI, and never drop a follow-up again.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 30, height: 30, background: 'rgba(0,71,171,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Icon size={14} style={{ color: '#0038A8' }} />
                </div>
                <span style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 40, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {PERKS.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={13} style={{ color: '#059669', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#64748B' }}>{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative blobs */}
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(0,56,168,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 120, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(77,127,208,0.1)', pointerEvents: 'none' }} />
      </div>

      {/* ── Right: auth card panel ── */}
      <div style={{ width: '100%', maxWidth: 500, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', background: 'white', boxShadow: '-1px 0 0 #E2E8F0', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Logo (mobile only) */}
          <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <div style={{ width: 32, height: 32, background: '#0038A8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>LG</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '0.04em' }}>LEAD GAP</span>
          </div>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#0047AB', margin: '0 0 10px' }}>
              Create your account
            </p>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
              Start free today
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748B', margin: 0 }}>
              14 days free. No credit card required.
            </p>
          </div>

          {/* Social buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {/* Google — active */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              style={{ width: '100%', padding: '11px 16px', border: '1px solid #E2E8F0', background: googleLoading ? '#F4F8FD' : '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13.5, fontWeight: 600, color: '#0F172A', cursor: googleLoading ? 'wait' : 'pointer', borderRadius: 2, transition: 'border-color 0.15s' }}
              onMouseEnter={e => { if (!googleLoading) (e.currentTarget as HTMLElement).style.borderColor = '#0038A8' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0' }}
            >
              {googleLoading
                ? <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite', color: '#94A3B8' }} />
                : <GoogleIcon />}
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            {/* GitHub — placeholder */}
            <button type="button" disabled title="Coming soon"
              style={{ width: '100%', padding: '11px 16px', border: '1px solid #E2E8F0', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13.5, fontWeight: 600, color: '#64748B', cursor: 'not-allowed', opacity: 0.55, borderRadius: 2 }}>
              <GitHubIcon />
              Continue with GitHub
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#E8EFFA', color: '#0047AB', padding: '2px 6px', borderRadius: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>soon</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>or sign up with email</span>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, letterSpacing: '0.04em' }}>Full name</label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Rahul Sharma" autoComplete="name"
                  style={inp()}
                  onFocus={e => (e.target.style.borderColor = '#0038A8')}
                  onBlur={e  => (e.target.style.borderColor = '#E2E8F0')} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, letterSpacing: '0.04em' }}>Work email</label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  style={inp()}
                  onFocus={e => (e.target.style.borderColor = '#0038A8')}
                  onBlur={e  => (e.target.style.borderColor = '#E2E8F0')} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, letterSpacing: '0.04em' }}>Mobile number</label>
              <div style={{ position: 'relative' }}>
                <Phone style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210" autoComplete="tel"
                  style={inp()}
                  onFocus={e => (e.target.style.borderColor = '#0038A8')}
                  onBlur={e  => (e.target.style.borderColor = '#E2E8F0')} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, letterSpacing: '0.04em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
                <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" autoComplete="new-password"
                  style={inp({ paddingRight: 42 })}
                  onFocus={e => (e.target.style.borderColor = '#0038A8')}
                  onBlur={e  => (e.target.style.borderColor = '#E2E8F0')} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 0 }}>
                  {showPass ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 2, padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ padding: '13px 0', background: loading ? '#E2E8F0' : '#0038A8', border: 'none', borderRadius: 2, color: loading ? '#94A3B8' : '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, letterSpacing: '0.01em' }}>
              {loading
                ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> Creating account…</>
                : 'Create free account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8', marginTop: 20 }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#0038A8', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#CBD5E1', marginTop: 16, lineHeight: 1.6 }}>
            By signing up you agree to our{' '}
            <a href="#" style={{ color: '#94A3B8', textDecoration: 'underline' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="#" style={{ color: '#94A3B8', textDecoration: 'underline' }}>Privacy Policy</a>.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
