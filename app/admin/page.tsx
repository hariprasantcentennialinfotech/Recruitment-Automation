'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  Lock,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  Briefcase,
  ChevronLeft
} from 'lucide-react'
import { AdminPortal } from '@/components/admin/admin-portal'

export default function AdminPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [notice, setNotice] = useState('')

  // Login form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const announce = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 3000)
  }

  const checkAdminAuth = async () => {
    try {
      setCheckingAuth(true)
      const res = await fetch('/api/admin/me')
      const data = await res.json()
      setIsAdmin(Boolean(data.isSuperAdmin))
    } catch {
      setIsAdmin(false)
    } finally {
      setCheckingAuth(false)
    }
  }

  useEffect(() => {
    checkAdminAuth()
  }, [])

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    if (!username.trim() || !password) {
      setLoginError('Please enter both admin username and password')
      return
    }

    try {
      setLoggingIn(true)
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Invalid admin credentials')
      }

      setIsAdmin(true)
      announce('Admin authenticated successfully')
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleAdminSignOut = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {}
    setIsAdmin(false)
    setUsername('')
    setPassword('')
    announce('Admin signed out')
  }

  const handleSelectClientWorkspace = (client: { slug: string; name: string }) => {
    announce(`Switched context to ${client.name}. Navigating to workspace...`)
    router.push(`/?tenantOrg=${client.slug}`)
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Verifying admin access...</p>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-4 text-white">
        {notice && (
          <div
            role="status"
            className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-xl"
          >
            {notice}
          </div>
        )}

        <div className="w-full max-w-md">
          {/* Back link */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-white"
            >
              <ChevronLeft className="size-4" /> Back to Recruiter App
            </Link>
            <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
              Restricted Area
            </span>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
            {/* Header / Brand */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-inner">
                <ShieldCheck className="size-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Super Admin Portal
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Centennial Infotech · Platform Administration &amp; Credit Management
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
                <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Admin Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Sharp"
                    autoComplete="username"
                    required
                    disabled={loggingIn}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    disabled={loggingIn}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn || !username.trim() || !password}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loggingIn ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Verifying Credentials...
                  </>
                ) : (
                  <>
                    Sign In to Admin Portal <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
              <p className="text-[11px] text-slate-500">
                Credentials configured securely via server environment.
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg"
        >
          {notice}
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Centennial Infotech"
              className="size-10 object-contain rounded-xl"
            />
            <div>
              <p className="text-[16px] sm:text-[17px] font-bold tracking-tight text-foreground leading-tight">
                Recruiting Automation
              </p>
              <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-primary font-bold">
                Centennial Infotech · Super Admin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Briefcase className="size-3.5" /> Back to Recruiter App
            </Link>
            <button
              onClick={handleAdminSignOut}
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20"
            >
              Sign out Admin
            </button>
          </div>
        </div>
      </header>

      {/* Admin Portal Content */}
      <div className="mx-auto max-w-[1440px] p-5 lg:p-10">
        <AdminPortal
          onSelectClientWorkspace={handleSelectClientWorkspace}
          onNotice={announce}
          onSignOut={handleAdminSignOut}
        />
      </div>
    </main>
  )
}
