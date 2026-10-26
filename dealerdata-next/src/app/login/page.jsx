'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      await login({ email, password });
      window.location.href = '/competitor-analysis';
    } catch (err) {
      setErrorMessage(err.message || 'Invalid email or password');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-white selection:bg-blue-600 selection:text-white">
      {/* Left side: Form */}
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

        <div className="max-w-md w-full mx-auto py-10">
          <div className="mb-8">
            <h2 className="text-3xl font-black tracking-tight text-white">Sign In</h2>
            <p className="text-sm text-slate-400 mt-2">
              Access your competitor intelligence and inventory pricing dashboard.
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
                Work Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@dealership.com"
                  required
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="text-xs text-slate-600 text-center">
          &copy; {new Date().getFullYear()} CompetitorAlerts.ai. All rights reserved.
        </div>
      </div>

      {/* Right side: Branding & Metrics Showcase */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-16 flex-col justify-between relative overflow-hidden border-l border-slate-800/80">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest">
          Competitor Alerts Intelligence
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Transform your automotive sales data into actionable daily revenue.
          </h2>
          <p className="text-slate-300 text-base leading-relaxed">
            Consolidate lead closing ratios, monitor local competitor inventory pricing in real-time, and benchmark salesperson activity across all rooftop locations.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <TrendingUp size={16} />
                <span className="text-xs font-bold uppercase">Close Rate Lift</span>
              </div>
              <p className="text-2xl font-black text-white">+3.8%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Average dealer conversion gain</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Activity size={16} />
                <span className="text-xs font-bold uppercase">Automated Reports</span>
              </div>
              <p className="text-2xl font-black text-white">100%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Nightly import verification</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 p-5 rounded-2xl bg-slate-800/40 border border-slate-700/40 backdrop-blur-sm">
          <p className="text-xs text-slate-300 italic">
            "Competitor Alerts has completely eliminated our blind spots between what competitors are pricing on their lots and how our BDC closes internet leads."
          </p>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
              AV
            </div>
            <div>
              <p className="text-xs font-bold text-white">Aaron Automotive Group</p>
              <p className="text-[10px] text-slate-400">Managing 7 Locations in Southern California</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
