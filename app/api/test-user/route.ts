import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhqdhmlelprreniddodp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocWRobWxlbHBycmVuaWRkb2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDUxMDEsImV4cCI6MjA4MDQ4MTEwMX0.y-cOeeuhlbn6t3UW2byLdkjMSugFSUhm3gedTgb6bro'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: Request) {
  try {
    const { email, password, full_name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard`,
        data: {
          full_name: full_name || 'Test User',
        },
      },
    })

    if (authError) {
      // If user already exists, try to sign in instead
      if (authError.message.includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          return NextResponse.json(
            { error: `User exists but password is incorrect. Error: ${signInError.message}` },
            { status: 400 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'User already exists. Use these credentials to login.',
          email,
          password,
          userId: signInData.user?.id,
          session: signInData.session,
        })
      }

      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        full_name: full_name || 'Test User',
        company_name: 'Test Company',
        phone: null,
        role: 'agent',
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Continue even if profile creation fails
    }

    return NextResponse.json({
      success: true,
      message: authData.session ? 'Test user created and logged in!' : 'Test user created! Please check your email to confirm (if required).',
      email,
      password,
      userId: authData.user.id,
      session: authData.session,
      requiresEmailConfirmation: !authData.session,
    })
  } catch (error: any) {
    console.error('Error creating test user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create test user' },
      { status: 500 }
    )
  }
}

