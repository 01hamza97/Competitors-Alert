'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  CreditCard,
  Check,
  Sparkles,
  Zap,
  Building2,
  ShieldCheck,
  Download,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 199,
    annualPrice: 159,
    description: 'Essential performance tracking for single-location automotive dealerships.',
    features: [
      '1 Dealership Rooftop',
      'Daily Lead & Sales Performance KPIs',
      'Salesperson Activity breakdown',
      'Automated Performance Syncs',
      'Email support (24h SLA)'
    ],
    highlight: false,
    cta: 'Select Starter',
  },
  {
    id: 'pro',
    name: 'Professional',
    monthlyPrice: 499,
    annualPrice: 399,
    description: 'Advanced intelligence and competitor scraping for growing multi-store groups.',
    features: [
      'Up to 5 Dealership Rooftops',
      'Real-time Competitor Inventory & Specials Tracking',
      'Automated Nightly & Morning Email Reports',
      'Unlimited Performance & Benchmark Analytics',
      'Vendor ROI & Lead-Source Grouping',
      'Priority Phone & Slack support'
    ],
    highlight: true,
    badge: 'Most Popular',
    cta: 'Upgrade to Pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 1199,
    annualPrice: 959,
    description: 'Full-scale automotive intelligence for large dealer groups and auto-malls.',
    features: [
      'Unlimited Dealership Rooftops',
      'Custom Scraper platform development',
      'Dedicated GitHub Actions Runners',
      'Multi-group consolidation & principal rollups',
      'Direct CRM & DMS raw webhook feed',
      'Dedicated Account Executive & 99.9% SLA'
    ],
    highlight: false,
    badge: 'Enterprise Tier',
    cta: 'Contact Sales',
  }
];

export default function BillingPage() {
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [currentPlan, setCurrentPlan] = useState(user?.plan || 'Enterprise');
  const [upgrading, setUpgrading] = useState(null);

  const handlePlanChange = async (planName) => {
    setUpgrading(planName);
    try {
      if (user?.id) {
        await fetch(`/api/entities/User/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planName }),
        });
      }
      setCurrentPlan(planName);
      toast.success(`Successfully updated subscription to ${planName} Plan!`);
    } catch (e) {
      toast.error('Failed to update subscription');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Subscription & License
          </span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mt-2">Plans & Billing</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your dealership group's tier, usage limits, and payment methods.
        </p>
      </div>

      {/* Active Subscription Summary */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Current Plan:</h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
              {currentPlan} Tier
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Active since January 2026 &bull; Renews on <strong className="text-slate-700">November 1, 2026</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <CreditCard size={16} className="text-blue-600" />
            <span>Visa ending in <strong>4242</strong></span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('Billing portal link will be emailed to ' + (user?.email || 'admin'))}
            className="text-xs font-semibold"
          >
            Update Payment Method
          </Button>
        </div>
      </div>

      {/* Usage Quotas */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Resource Allocation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase">Rooftop Stores</p>
            <p className="text-2xl font-black text-slate-900 mt-1">7 <span className="text-xs font-normal text-slate-400">/ Unlimited</span></p>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase">Monthly Scraper Executions</p>
            <p className="text-2xl font-black text-slate-900 mt-1">418 <span className="text-xs font-normal text-slate-400">/ 1,000</span></p>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '42%' }}></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase">Automated Syncs & Ingests</p>
            <p className="text-2xl font-black text-slate-900 mt-1">1,240 <span className="text-xs font-normal text-slate-400">/ Unlimited</span></p>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: '28%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Selection Cards */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Available Plans</h3>
            <p className="text-xs text-slate-500 mt-0.5">Scale rooftop locations or activate deep competitive scrapers as you grow.</p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                isAnnual ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Annual</span>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
            const isCurrent = currentPlan.toLowerCase() === plan.id;

            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 transition-all flex flex-col justify-between relative ${
                  plan.highlight
                    ? 'bg-white border-2 border-blue-600 shadow-xl shadow-blue-600/10'
                    : 'bg-white border border-slate-200 shadow-sm hover:border-slate-300'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-sm">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-bold text-slate-900">{plan.name}</h4>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        Active Plan
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed mb-4 min-h-[36px]">
                    {plan.description}
                  </p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-black text-slate-900">${price}</span>
                    <span className="text-xs font-medium text-slate-500">/ month</span>
                    {isAnnual && (
                      <span className="text-[11px] text-emerald-600 font-semibold ml-1">(billed annually)</span>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-slate-100 pt-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Included Features</p>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8">
                  <Button
                    onClick={() => handlePlanChange(plan.name)}
                    disabled={isCurrent || upgrading === plan.name}
                    className={`w-full h-10 rounded-xl text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed hover:bg-slate-100'
                        : plan.highlight
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {upgrading === plan.name ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Updating...
                      </span>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : (
                      plan.cta
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
