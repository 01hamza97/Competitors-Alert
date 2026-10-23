'use client';
import { useState } from 'react';
import SectionCard from '@/components/SectionCard';
import { useDealer } from '@/lib/DealerContext';
import { useActivityData } from '@/lib/useSupabaseData';
import { RefreshCw } from 'lucide-react';
import { buildPeriodOptions, parseCustomPeriod } from '@/components/dashboard/PerformanceControls';

// ── Group View ────────────────────────────────────────────────────
function GroupView({ activeDealershipKeys, activeStores }) {
  const [period, setPeriod] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const periodOptions = buildPeriodOptions();

  const { data: activityData = [], isLoading } = useActivityData(activeDealershipKeys, period);

  // Aggregate by dealership
  const storeMap = {};
  activeStores.forEach(s => {
    storeMap[s.dealership_key] = { name: s.name, calls: 0, emails: 0, texts: 0, sold: 0, total: 0 };
  });
  activityData.forEach(r => {
    if (storeMap[r.dealer_id]) {
      storeMap[r.dealer_id].calls += r.calls || 0;
      storeMap[r.dealer_id].emails += r.emails || 0;
      storeMap[r.dealer_id].texts += r.texts || 0;
      storeMap[r.dealer_id].sold += r.sold || 0;
      storeMap[r.dealer_id].total += r.total_activity || 0;
    }
  });

  const rows = Object.values(storeMap).sort((a, b) => b.total - a.total);
  const periodLabel = buildPeriodOptions().find(o => o.value === period)?.label || period;

  const THRESHOLD_HIGH = 30;
  const THRESHOLD_LOW = 10;
  const activityColor = (total) => {
    if (total >= THRESHOLD_HIGH) return 'text-green-600 font-bold';
    if (total <= THRESHOLD_LOW) return 'text-red-500 font-bold';
    return 'text-gray-800 font-semibold';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Period:</span>
        <select
          value={period === 'custom' || period?.startsWith('custom_') ? 'custom' : period}
          onChange={e => {
            if (e.target.value === 'custom') setPeriod('custom');
            else setPeriod(e.target.value);
          }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {periodOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {(period === 'custom' || period?.startsWith('custom_')) && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart || parseCustomPeriod(period)?.start || ''}
              onChange={e => setCustomStart(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={customEnd || parseCustomPeriod(period)?.end || ''}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => { if (customStart && customEnd) setPeriod(`custom_${customStart}_${customEnd}`); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      <SectionCard title={`Activity Breakdown — ${periodLabel}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><RefreshCw className="animate-spin text-gray-400" size={20} /></div>
        ) : (
          <>
            <div className="mb-3 flex gap-4 text-xs text-gray-400">
              <span><span className="text-green-600 font-bold">Green</span> = High activity (≥{THRESHOLD_HIGH})</span>
              <span><span className="text-red-500 font-bold">Red</span> = Low activity (≤{THRESHOLD_LOW})</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Dealership', 'Total', 'Calls', 'Emails', 'Texts'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-400 font-semibold text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 px-3 text-gray-400 text-sm">No activity data for this period</td></tr>
                ) : rows.map(r => (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-medium text-gray-800">{r.name}</td>
                    <td className={`py-3 px-3 tabular-nums text-base ${activityColor(r.total)}`}>{r.total}</td>
                    <td className="py-3 px-3 text-gray-600 tabular-nums">{r.calls}</td>
                    <td className="py-3 px-3 text-gray-600 tabular-nums">{r.emails}</td>
                    <td className="py-3 px-3 text-gray-600 tabular-nums">{r.texts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ── Store View ────────────────────────────────────────────────────
function StoreView({ activeDealershipKeys }) {
  const [period, setPeriod] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const periodOptions = buildPeriodOptions();

  const { data: activityData = [], isLoading } = useActivityData(activeDealershipKeys, period);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const getSortValue = (person, key) => {
    if (key === 'soldPct') return person.leads > 0 ? (person.sold / person.leads) * 100 : 0;
    return person[key];
  };

  // Aggregate by salesperson name
  const personMap = {};
  activityData.forEach(r => {
    const name = r.salesperson;
    if (!personMap[name]) personMap[name] = { name, calls: 0, emails: 0, texts: 0, sold: 0, total: 0, leads: 0 };
    personMap[name].calls += r.calls || 0;
    personMap[name].emails += r.emails || 0;
    personMap[name].texts += r.texts || 0;
    personMap[name].sold += r.sold || 0;
    personMap[name].total += r.total_activity || 0;
    personMap[name].leads += r.all_leads || 0;
  });

  const rows = Object.values(personMap)
    .filter(r => r.total > 0)
    .sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const totals = rows.reduce((acc, r) => ({
    calls: acc.calls + r.calls,
    emails: acc.emails + r.emails,
    texts: acc.texts + r.texts,
    sold: acc.sold + r.sold,
    total: acc.total + r.total,
    leads: acc.leads + r.leads,
  }), { calls: 0, emails: 0, texts: 0, sold: 0, total: 0, leads: 0 });

  const periodLabel = buildPeriodOptions().find(o => o.value === period)?.label || period;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Period:</span>
        <select
          value={period === 'custom' || period?.startsWith('custom_') ? 'custom' : period}
          onChange={e => {
            if (e.target.value === 'custom') setPeriod('custom');
            else setPeriod(e.target.value);
          }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {periodOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {(period === 'custom' || period?.startsWith('custom_')) && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart || parseCustomPeriod(period)?.start || ''}
              onChange={e => setCustomStart(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={customEnd || parseCustomPeriod(period)?.end || ''}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => { if (customStart && customEnd) setPeriod(`custom_${customStart}_${customEnd}`); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      <SectionCard title={`Salesperson Activity — ${periodLabel}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><RefreshCw className="animate-spin text-gray-400" size={20} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
             <tr className="border-b border-gray-200">
               <th className="text-left py-2 px-3 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('name')}>Salesperson</th>
               <th className="text-right py-2 px-3 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('total')}>Total</th>
               <th className="text-right py-2 px-3 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('calls')}>Calls</th>
               <th className="text-right py-2 px-3 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('emails')}>Emails</th>
               <th className="text-right py-2 px-3 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('texts')}>Texts</th>
               <th className="text-right py-2 px-3 bg-gray-100 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('leads')}>Leads</th>
               <th className="text-right py-2 px-3 bg-gray-100 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('sold')}>Sold</th>
               <th className="text-right py-2 px-3 bg-gray-100 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('soldPct')}>Sold %</th>
             </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="py-6 px-3 text-gray-400 text-sm">No salesperson activity data for this period.</td></tr>
              ) : rows.map((r, i) => {
               const soldPct = r.leads > 0 ? Math.round((r.sold / r.leads) * 100) : 0;
               return (
               <tr key={r.name} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                 <td className="py-3 px-3 font-medium text-gray-800">{r.name}</td>
                 <td className="py-3 px-3 font-bold text-gray-900 tabular-nums text-right">{r.total}</td>
                 <td className="py-3 px-3 text-gray-600 tabular-nums text-right">{r.calls}</td>
                 <td className="py-3 px-3 text-gray-600 tabular-nums text-right">{r.emails}</td>
                 <td className="py-3 px-3 text-gray-600 tabular-nums text-right">{r.texts}</td>
                 <td className="py-3 px-3 bg-gray-50 font-bold text-gray-900 tabular-nums text-right">{r.leads}</td>
                 <td className="py-3 px-3 bg-gray-50 font-bold text-emerald-600 tabular-nums text-right">{r.sold}</td>
                 <td className="py-3 px-3 bg-gray-50 font-bold text-gray-900 tabular-nums text-right">{soldPct}%</td>
               </tr>
              );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-100">
                  <td className="py-3 px-3 font-bold text-gray-700 text-sm uppercase tracking-wide">Total</td>
                  <td className="py-3 px-3 font-bold text-gray-900 tabular-nums text-right">{totals.total}</td>
                  <td className="py-3 px-3 font-bold text-gray-900 tabular-nums text-right">{totals.calls}</td>
                  <td className="py-3 px-3 font-bold text-gray-900 tabular-nums text-right">{totals.emails}</td>
                  <td className="py-3 px-3 font-bold text-gray-900 tabular-nums text-right">{totals.texts}</td>
                  <td className="py-3 px-3 bg-gray-200 font-bold text-gray-900 tabular-nums text-right">{totals.leads}</td>
                  <td className="py-3 px-3 bg-gray-200 font-bold text-emerald-600 tabular-nums text-right">{totals.sold}</td>
                  <td className="py-3 px-3 bg-gray-200 font-bold text-gray-900 tabular-nums text-right">{totals.total > 0 ? Math.round((totals.sold / totals.total) * 100) : 0}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </SectionCard>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function SalespersonActivity() {
  const { activeDealershipKeys, activeStores, selectedLabel, selectedType } = useDealer();
  const isGroup = selectedType === 'group';

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Salesperson Activity</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {selectedLabel ? `${selectedLabel} · ` : ''}
          Dealership comparison and ranking
        </p>
        <p className="text-xs text-amber-600 mt-1">
          Note: Today's activity may appear low earlier in the day — nightly import completes after 10pm PST.
        </p>
      </div>

      {isGroup
        ? <GroupView activeDealershipKeys={activeDealershipKeys} activeStores={activeStores} />
        : <StoreView activeDealershipKeys={activeDealershipKeys} />
      }
    </div>
  );
}