'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Layers,
  ArrowRight,
  AlertCircle,
  Loader2,
  UserPlus,
  Building2,
} from 'lucide-react';
import {
  authenticateWithEmail,
  registerInstructor,
  saveStoredCurrentUser,
  getStoredCurrentUser,
} from '@/lib/storage';

type Tab = 'signin' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('signin');

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPass, setShowSignInPass] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regHall, setRegHall] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    const user = getStoredCurrentUser();
    if (user) router.replace('/');
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setSignInLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = authenticateWithEmail(signInEmail, signInPassword);
    setSignInLoading(false);
    if (!result.success || !result.user) {
      setSignInError(result.error ?? 'Authentication failed.');
      return;
    }
    saveStoredCurrentUser(result.user);
    router.push('/');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    if (regName.trim().length < 2) { setRegError('Full name must be at least 2 characters.'); return; }
    if (!regEmail.includes('@')) { setRegError('Please enter a valid email address.'); return; }
    if (regPassword.length < 6) { setRegError('Password must be at least 6 characters.'); return; }
    setRegLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = registerInstructor(regName, regEmail, regPassword, regHall);
    setRegLoading(false);
    if (!result.success || !result.user) { setRegError(result.error ?? 'Registration failed.'); return; }
    setRegSuccess('Account created! Signing you in...');
    await new Promise((r) => setTimeout(r, 800));
    saveStoredCurrentUser(result.user);
    router.push('/');
  };

  const inp = 'w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
            <Layers className="h-5 w-5" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">KKH DSA Evaluation</h1>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Instructor portal · v2.4</p>
          </div>
        </div>

        <div className="mb-6 flex rounded-lg border border-zinc-200 bg-zinc-100/60 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <button type="button" onClick={() => { setTab('signin'); setSignInError(''); }}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${tab === 'signin' ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'}`}>
            Sign in
          </button>
          <button type="button" onClick={() => { setTab('register'); setRegError(''); setRegSuccess(''); }}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${tab === 'register' ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'}`}>
            Register
          </button>
        </div>

        {tab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Email address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type="email" autoComplete="email" required placeholder="you@kkh.edu"
                  value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)}
                  className={`${inp} pl-10`} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type={showSignInPass ? 'text' : 'password'} autoComplete="current-password" required placeholder="••••••••"
                  value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)}
                  className={`${inp} pl-10 pr-10`} />
                <button type="button" onClick={() => setShowSignInPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  {showSignInPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {signInError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800/50 dark:bg-red-950/40">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                <p className="text-xs text-red-700 dark:text-red-300">{signInError}</p>
              </div>
            )}
            <button type="submit" disabled={signInLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors">
              {signInLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>}
            </button>
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Demo credentials</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">admin@kkh.edu / admin <span className="text-zinc-400 not-italic">(Admin)</span></p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono mt-0.5">ashutosh.rana@kkh.edu / evaluator123</p>
            </div>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Full name</label>
              <input type="text" required autoComplete="name" placeholder="Dr. Anjali Mehta"
                value={regName} onChange={(e) => setRegName(e.target.value)} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Email address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type="email" required autoComplete="email" placeholder="you@kkh.edu"
                  value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={`${inp} pl-10`} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type={showRegPass ? 'text' : 'password'} required autoComplete="new-password" placeholder="Min. 6 characters"
                  value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className={`${inp} pl-10 pr-10`} />
                <button type="button" onClick={() => setShowRegPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showRegPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Examination hall <span className="font-normal text-zinc-400">(optional)</span></label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type="text" placeholder="Hall A" value={regHall} onChange={(e) => setRegHall(e.target.value)} className={`${inp} pl-10`} />
              </div>
            </div>
            {regError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800/50 dark:bg-red-950/40">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                <p className="text-xs text-red-700 dark:text-red-300">{regError}</p>
              </div>
            )}
            {regSuccess && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800/50 dark:bg-emerald-950/40">
                <p className="text-xs text-emerald-700 dark:text-emerald-300">{regSuccess}</p>
              </div>
            )}
            <button type="submit" disabled={regLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors">
              {regLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /><span>Create account</span></>}
            </button>
          </form>
        )}
      </div>
      <p className="mt-8 text-center text-[11px] text-zinc-400 dark:text-zinc-600">KKH DSA Evaluation Platform · Internal use only</p>
    </div>
  );
}
