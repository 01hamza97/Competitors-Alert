'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  BarChart2,
  TrendingUp,
  Layers,
  ClipboardList,
  Settings
} from 'lucide-react';
import DealerSelector from '@/components/DealerSelector';
import UserMenu from '@/components/saas/UserMenu';
import NotificationCenter from '@/components/saas/NotificationCenter';
import PlanBadge from '@/components/saas/PlanBadge';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { to: '/competitor-analysis', icon: TrendingUp, label: 'Competitive Analysis', hasSubnav: true },
  { to: '/vendor-performance', icon: BarChart2, label: 'Vendor Performance' },
  { to: '/inventory-vs-sold', icon: Layers, label: 'Inventory vs Leads' },
  { to: '/specials-entry', icon: ClipboardList, label: 'Specials Entry Tool' },
  { to: '/admin/clients', icon: ShieldCheck, label: 'Client Admin', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const competitorSubnav = [
  { path: '/competitor-analysis?view=inventory', label: 'Inventory & Pricing' },
  { path: '/competitor-analysis?view=new_specials', label: 'New Specials' },
];

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoadingAuth } = useAuth();

  // If on login/signup auth pages, render plain layout without sidebar
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';
  if (isAuthPage) {
    return <main className="min-h-screen bg-slate-900">{children}</main>;
  }

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-xl shadow-xl shadow-blue-500/30 animate-pulse">
          D
        </div>
        <p className="mt-4 text-xs font-semibold tracking-wider uppercase text-slate-400">Loading DealerData...</p>
      </div>
    );
  }

  const isCompetitorAnalysisActive = pathname === '/competitor-analysis';
  const currentView = searchParams.get('view') || 'inventory';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* SaaS Left Sidebar */}
      <aside className="w-60 bg-slate-900 flex flex-col flex-shrink-0 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
                D
              </div>
              <h1 className="text-white font-black text-lg tracking-tight">DealerData</h1>
            </div>
            <p className="text-slate-400 text-[11px] mt-1 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Intelligence Platform
            </p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, hasSubnav, adminOnly }) => {
            if (adminOnly && user?.role !== 'admin') return null;
            const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <div key={to}>
                <Link
                  href={to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                  {label}
                </Link>

                {hasSubnav && isCompetitorAnalysisActive && (
                  <div className="ml-6 mt-1 space-y-0.5 border-l border-slate-800 pl-2">
                    {competitorSubnav.map(sub => {
                      const viewParam = sub.path.split('?view=')[1];
                      const isSubActive = currentView === viewParam;
                      return (
                        <Link
                          key={sub.path}
                          href={sub.path}
                          className={`block px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                            isSubActive
                              ? 'bg-blue-600/20 text-blue-400 font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                          }`}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 bg-slate-800 border-b border-slate-700/70 flex items-center justify-between px-5 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-3">
            <PlanBadge />
          </div>

          <div className="flex items-center gap-3">
            <DealerSelector />
            <div className="h-5 w-px bg-slate-700" />
            <NotificationCenter />
            <div className="h-5 w-px bg-slate-700" />
            <UserMenu />
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-auto bg-gray-50/60">
          {children}
        </main>
      </div>
    </div>
  );
}