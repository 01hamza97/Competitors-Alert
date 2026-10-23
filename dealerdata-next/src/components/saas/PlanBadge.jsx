'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function PlanBadge() {
  const { user } = useAuth();
  const plan = user?.plan || 'Enterprise';

  const badgeColor = {
    Enterprise: 'from-amber-500/20 to-purple-600/20 text-amber-300 border-amber-500/30 hover:border-amber-400/50',
    Pro: 'from-blue-500/20 to-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:border-cyan-400/50',
    Starter: 'from-slate-700/50 to-slate-800 text-slate-300 border-slate-600 hover:border-slate-500',
  }[plan] || 'from-amber-500/20 to-purple-600/20 text-amber-300 border-amber-500/30';

  return (
    <Link
      href="/billing"
      className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r border transition-all shadow-sm ${badgeColor}`}
      title="Click to view subscription plan & billing"
    >
      <Sparkles size={12} className="text-amber-400" />
      <span>{plan} Plan</span>
    </Link>
  );
}
