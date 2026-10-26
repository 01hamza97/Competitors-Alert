'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
  Lock,
  Mail,
  User,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      await signup({
        full_name: fullName,
        email,
        password,
        company_name: companyName,
      });
      router.push('/');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-white selection:bg-blue-600 selection:text-white">
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 lg:p-16 z-10">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-sm shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              CA
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">Competitor Alerts</h1>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                Automotive Intelligence
              </p>
            </div>
          </Link>
        </div>

        <div className="max-w-md w-full mx-auto py-8">
          <div className="mb-6">
            <h2 className="text-3xl font-black tracking-tight text-white">Join Competitor Alerts</h2>
            <p className="text-sm text-slate-400 mt-1">
              Join leading dealership groups scaling their sales and BDC conversions.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 mb-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <ShieldCheck size={16} className="text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Marcus Vance"
                  required
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Dealership / Group Name
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Summit Automotive Group"
                  required
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@summitauto.com"
                  required
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Create Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={6}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create SaaS Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-bold">
              Sign In &rarr;
            </Link>
          </p>
        </div>

        <div className="text-xs text-slate-600 text-center">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>

      {/* Right side: Benefits list */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-16 flex-col justify-center space-y-8 border-l border-slate-800/80">
        <div className="max-w-md space-y-6">
          <h3 className="text-3xl font-extrabold text-white">
            Everything your group needs to outperform local competitors.
          </h3>
          
          <div className="space-y-4 pt-2">
            {[
              'Direct CRM integration with automatic lead-source grouping',
              'Real-time automated scraping of local competitor inventory & specials',
              'Nightly executive email summaries delivered directly to GMs & Principals',
              'Ask Sam AI assistant for instant natural-language sales intelligence',
              'Multi-store rollup leaderboards with custom closing ratios'
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={13} />
                </div>
                <p className="text-sm text-slate-300">{text}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 mt-6">
            <p className="text-xs text-slate-400">
              Need custom enterprise scrapers or tailored CRM pipelines? Contact our solutions engineering team at <span className="text-blue-400 font-semibold">enterprise@dealerdata.com</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
