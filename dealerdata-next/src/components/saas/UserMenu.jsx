'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Settings, CreditCard, ShieldCheck, LogOut, Sparkles, Building2 } from 'lucide-react';

export default function UserMenu() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
      >
        Sign In
      </Link>
    );
  }

  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'US';

  const roleBadgeStyle = {
    admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    manager: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    user: 'bg-slate-700 text-slate-300 border-slate-600',
  }[user.role || 'user'] || 'bg-slate-700 text-slate-300 border-slate-600';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 p-1 pl-2 rounded-lg hover:bg-slate-700/60 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-semibold text-white leading-tight max-w-[130px] truncate">
              {user.full_name}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">
              {user.role === 'admin' ? 'Super Admin' : user.role === 'manager' ? 'Store GM' : 'Analyst'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center ring-2 ring-slate-700 shadow-sm">
            {initials}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-xl border-slate-200">
        <DropdownMenuLabel className="p-2 font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 leading-none">{user.full_name}</p>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${roleBadgeStyle}`}>
                {user.role}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-none truncate">{user.email}</p>
            {user.company && (
              <p className="text-[11px] text-blue-600 font-medium flex items-center gap-1 pt-1">
                <Building2 size={11} /> {user.company}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer flex items-center gap-2 py-2">
            <Settings size={14} className="text-gray-500" />
            <span>Account & Dealership Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/billing" className="cursor-pointer flex items-center gap-2 py-2">
            <CreditCard size={14} className="text-gray-500" />
            <div className="flex items-center justify-between w-full">
              <span>Subscription & Billing</span>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                {user.plan || 'Pro'}
              </span>
            </div>
          </Link>
        </DropdownMenuItem>

        {user.role === 'admin' && (
          <DropdownMenuItem asChild>
            <Link href="/admin/clients" className="cursor-pointer flex items-center gap-2 py-2">
              <ShieldCheck size={14} className="text-purple-600" />
              <span>Client Management</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={logout}
          className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 py-2 flex items-center gap-2"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
