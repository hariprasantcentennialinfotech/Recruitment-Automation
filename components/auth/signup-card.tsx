'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserPlus, LogIn, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface AuthCardProps {
  initialMode?: 'signup' | 'signin'
  onSuccess: (user: any) => void
}

export function SignupCard({ initialMode = 'signup', onSuccess }: AuthCardProps) {
  const [mode, setMode] = useState<'signup' | 'signin'>(initialMode)
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleGoogleAuth = () => {
    setError(null)
    window.location.href = '/api/auth/google'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name')
        return
      }
      if (!email.trim()) {
        setError('Please enter your work email')
        return
      }
      if (!password) {
        setError('Please enter a password')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }

      setLoading(true)
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim(),
            company: company.trim(),
            email: email.trim(),
            password,
            confirmPassword,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create account')
        }

        setSuccessMsg('Account created successfully! Connecting...')
        setTimeout(() => {
          onSuccess(data.user)
        }, 600)
      } catch (err: any) {
        setError(err.message || 'Something went wrong')
      } finally {
        setLoading(false)
      }
    } else {
      // Signin
      if (!email.trim() || !password) {
        setError('Please enter both email and password')
        return
      }

      setLoading(true)
      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to sign in')
        }

        setSuccessMsg('Signed in successfully!')
        setTimeout(() => {
          onSuccess(data.user)
        }, 500)
      } catch (err: any) {
        setError(err.message || 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="w-full max-w-[440px] rounded-[28px] border border-slate-200/90 bg-white p-7 sm:p-9 shadow-[0_12px_45px_-15px_rgba(15,23,42,0.12)]">
      {/* Brand Logo & Name */}
      <div className="flex flex-col items-center justify-center mb-5">
        <img
          src="/logo.png"
          alt="Centennial Infotech"
          className="h-14 w-auto object-contain mb-1.5"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">
          Centennial Infotech
        </p>
        <p className="text-sm font-bold text-slate-800">
          Recruiting Automation
        </p>
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-[22px] sm:text-[24px] font-bold tracking-tight text-slate-900">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {mode === 'signup'
            ? 'Start your 14-day free trial of Centennial Connect'
            : 'Sign in to manage your recruitment workspace'}
        </p>
      </div>

      {/* Google Sign-in button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={handleGoogleAuth}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 active:scale-[0.99]"
        >
          {/* Google SVG Icon */}
          <svg className="size-4.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.35 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-5 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <span className="relative bg-white px-3 text-xs text-slate-400">
          or continue with email
        </span>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {mode === 'signup' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Full name</label>
              <input
                type="text"
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Company</label>
              <input
                type="text"
                placeholder="Acme Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Work email</label>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        {mode === 'signup' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Confirm password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#1e3a5f] py-2.5 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#152943] focus:outline-none focus:ring-2 focus:ring-slate-400 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : mode === 'signup' ? (
            <>
              <UserPlus className="size-4" />
              <span>Create account</span>
            </>
          ) : (
            <>
              <LogIn className="size-4" />
              <span>Sign in</span>
            </>
          )}
        </button>
      </form>

      {/* Footer Switch */}
      <p className="mt-5 text-center text-xs text-slate-500">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
              }}
              className="font-semibold text-blue-600 hover:underline"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
              }}
              className="font-semibold text-blue-600 hover:underline"
            >
              Sign up
            </button>
          </>
        )}
      </p>

      {/* Legal Links */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-[11px] text-slate-400">
        <Link href="/privacy-policy" className="hover:text-slate-600 transition underline underline-offset-2">
          Privacy Policy
        </Link>
        <span>•</span>
        <Link href="/terms-and-conditions" className="hover:text-slate-600 transition underline underline-offset-2">
          Terms &amp; Conditions
        </Link>
        <span>•</span>
        <Link href="/admin" className="hover:text-blue-600 transition font-medium text-slate-500">
          Admin Portal
        </Link>
      </div>
    </div>
  )
}
