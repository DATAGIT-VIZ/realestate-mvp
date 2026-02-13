'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, LogIn, Loader2, Building2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [creatingTest, setCreatingTest] = useState(false)
  const [clearingSession, setClearingSession] = useState(false)

  // Check for existing session on page load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // If there's a valid session, redirect to dashboard
        if (session && session.user && !sessionError) {
          router.push('/dashboard')
        }
      } catch (err) {
        // Silently handle any errors - we're already on the login page
        console.log('Session check completed')
      }
    }

    checkSession()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        // Handle specific error types
        if (authError.message.includes('Failed to fetch') || authError.message.includes('ERR_NAME_NOT_RESOLVED')) {
          setError('Unable to connect to server. Please check your internet connection and try again.')
        } else if (authError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please check your email and confirm your account before logging in.')
        } else {
          setError(authError.message)
        }
        setLoading(false)
        return
      }

      if (data.user && data.session) {
        // Successfully logged in, redirect to dashboard
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Login successful but no session created. Please try again.')
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      // Handle network errors
      if (err.message?.includes('Failed to fetch') || err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        setError('Network error: Unable to connect to authentication server. Please check your internet connection.')
      } else if (err.message) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
  }

  const handleCreateTestAccount = async () => {
    setCreatingTest(true)
    setError(null)
    
    const testEmail = `test${Date.now()}@example.com`
    const testPassword = 'Test123456'
    const testName = 'Test User'

    try {
      // Create test account via API
      const response = await fetch('/api/test-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          full_name: testName,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Auto-fill credentials
        setEmail(testEmail)
        setPassword(testPassword)
        
        // If session is provided, user is already logged in
        if (result.session) {
          router.push('/dashboard')
          router.refresh()
          return
        }

        // If email confirmation is required
        if (result.requiresEmailConfirmation) {
          setError('Account created! If email confirmation is enabled, please check your email. Otherwise, try logging in now.')
          setCreatingTest(false)
          // Auto-submit login form after a moment
          setTimeout(() => {
            const form = document.querySelector('form')
            if (form) {
              form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
            }
          }, 1000)
          return
        }
        
        // Try to login immediately
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        })

        if (authError) {
          if (authError.message.includes('Email not confirmed')) {
            setError('Account created! Please check your email to confirm, or disable email confirmation in Supabase settings.')
          } else {
            setError(`Account created but login failed: ${authError.message}. Credentials are filled - try clicking Sign in.`)
          }
          setCreatingTest(false)
          return
        }

        if (data.user) {
          router.push('/dashboard')
          router.refresh()
        }
      } else {
        setError(result.error || 'Failed to create test account')
        setCreatingTest(false)
      }
    } catch (err: any) {
      console.error('Test account creation error:', err)
      setError('Failed to create test account. Please try signing up manually.')
      setCreatingTest(false)
    }
  }

  const handleClearSession = async () => {
    setClearingSession(true)
    setError(null)
    
    try {
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Clear all localStorage items related to auth
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('sb-') || key.includes('auth')) {
            try {
              localStorage.removeItem(key)
            } catch (e) {
              // Ignore errors
            }
          }
        })
      }
      
      // Reload the page to clear any state
      window.location.reload()
    } catch (err) {
      console.error('Error clearing session:', err)
      setError('Failed to clear session. Please refresh the page manually.')
      setClearingSession(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back
          </h1>
          <p className="text-slate-400 mt-2">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Quick Test Account Button */}
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={handleCreateTestAccount}
              disabled={creatingTest || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingTest ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating test account...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quick Test Account (Auto-login)
                </>
              )}
            </button>
            
            {/* Clear Session Button */}
            <button
              type="button"
              onClick={handleClearSession}
              disabled={clearingSession || loading}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingSession ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Stale Session (Fix Token Errors)
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-center text-slate-400 text-sm">
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 space-y-3">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-400 text-xs text-center mb-2">
              💡 <strong>Quick Start:</strong> Click &quot;Quick Test Account&quot; above to automatically create and login
            </p>
            <p className="text-blue-300/70 text-xs text-center">
              ⚙️ <strong>Note:</strong> If login fails, disable &quot;Confirm email&quot; in Supabase Dashboard → Authentication → Providers → Email
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-8">
          Protected by industry-standard encryption
        </p>
      </div>
    </div>
  )
}

