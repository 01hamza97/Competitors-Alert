'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDealer } from '@/lib/DealerContext';
import { format, subDays, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SnapshotDatePicker from '@/components/competitive/SnapshotDatePicker';

const fmt = n => (n ?? 0).toLocaleString();

export default function InventoryVsLeads() {
  const { activeStores, selectedType } = useDealer();
  const isGroup = selectedType === 'group';

  const [selectedStoreName, setSelectedStoreName] = useState(null);
  const [snapshotDate, setSnapshotDate] = useState(null);
  const [trendMode, setTrendMode] = useState('weekly');

  const activeStore = activeStores?.find(s => s.name === selectedStoreName) || activeStores?.[0];
  const dealershipKey = activeStore?.dealership_key || null;

  // ── Single snapshot (for top cards) ──────────────────────────────────────
  const { data: invResult, isLoading: invLoading } = useQuery({
    queryKey: ['clientInventorySingle', dealershipKey, snapshotDate],
    enabled: !!dealershipKey,
    staleTime: 0,
    queryFn: () => base44.functions.invoke('supabaseClientInventory', {
      dealer_id: dealershipKey,
      snapshot_date: snapshotDate || null,
      mode: 'single',
    }).then(r => r.data),
  });

  const availableDates = invResult?.available_dates || [];
  // activeDate comes from snapshot_date column — never derived from browser date
  const activeDate = invResult?.snapshot_date || null;

  // Use server-computed totals if available; fall back to summing inventory rows
  const totals = useMemo(() => {
    if (invResult?.totals) return invResult.totals;
    const rows = invResult?.inventory || [];
    const newCount  = rows.filter(r => r.inventory_type === 'new').reduce((s, r) => s + (r.count || 0), 0);
    const usedCount = rows.filter(r => r.inventory_type === 'used').reduce((s, r) => s + (r.count || 0), 0);
    return { new: newCount, used: usedCount, total: newCount + usedCount };
  }, [invResult]);

  // ── Trend data (all snapshots) ────────────────────────────────────────────
  const { data: trendResult } = useQuery({
    queryKey: ['clientInventoryTrend', dealershipKey],
    enabled: !!dealershipKey,
    staleTime: 0,
    queryFn: () => base44.functions.invoke('supabaseClientInventory', {
      dealer_id: dealershipKey,
      mode: 'trend',
    }).then(r => r.data),
  });

  const inventoryTrend = trendResult?.trend || [];

  // ── Leads/Sold data — fetch a 180-day window ending today so both queries fire in parallel ──
  const today = format(new Date(), 'yyyy-MM-dd');
  const leadsEnd = today;
  const leadsStart = format(subDays(new Date(), 180), 'yyyy-MM-dd');

  const { data: leadsData = [] } = useQuery({
    queryKey: ['invLeadsDaily', dealershipKey, leadsStart, leadsEnd],
    enabled: !!dealershipKey,
    staleTime: 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseLeadTrend', {
        dealer_ids: [dealershipKey],
        start_date: leadsStart,
        end_date: leadsEnd,
      });
      return res.data?.data || [];
    },
  });

  // Aggregate leads/sold for a date window from daily rows
  function sumWindow(start, end) {
    const rows = leadsData.filter(d => d.report_date >= start && d.report_date <= end);
    return {
      leads: rows.reduce((s, r) => s + (r.total_leads || 0), 0),
      sold: rows.reduce((s, r) => s + (r.total_sold || 0), 0),
    };
  }

  // ── WEEKLY mode: last ~12 weekly snapshots + leads window for each ─────────
  // Weekly: use last 12 inventory snapshot points. For each, sum leads/sold
  // for the 7 days ending on that snapshot_date.
  const weeklyChartData = useMemo(() => {
    if (inventoryTrend.length === 0) return [];
    const points = inventoryTrend.slice(-12);
    return points.map(snap => {
      const endDate = snap.snapshot_date;
      const startDate = format(subDays(parseISO(endDate), 6), 'yyyy-MM-dd');
      const { leads, sold } = sumWindow(startDate, endDate);
      return {
        label: format(parseISO(endDate), 'M/d'),
        new_inv: snap.new_inv,
        used_inv: snap.used_inv,
        leads,
        sold,
      };
    });
  }, [inventoryTrend, leadsData]);

  // ── MONTHLY mode: week-by-week snapshot points with matching 7-day leads ──
  // Same as weekly but shows all available snapshots (up to 24 weeks)
  const monthlyChartData = useMemo(() => {
    if (inventoryTrend.length === 0) return [];
    const points = inventoryTrend.slice(-24);
    return points.map(snap => {
      const endDate = snap.snapshot_date;
      const startDate = format(subDays(parseISO(endDate), 6), 'yyyy-MM-dd');
      const { leads, sold } = sumWindow(startDate, endDate);
      const d = parseISO(endDate);
      return {
        label: format(d, 'M/d'),
        fullLabel: format(d, 'MMM d, yyyy'),
        new_inv: snap.new_inv,
        used_inv: snap.used_inv,
        leads,
        sold,
      };
    });
  }, [inventoryTrend, leadsData]);

  const chartData = trendMode === 'weekly' ? weeklyChartData : monthlyChartData;
  const hasData = chartData.some(d => d.new_inv > 0 || d.leads > 0 || d.sold > 0);

  // Active snapshot for display — only from snapshot_date column
  const displayDate = activeDate
    ? format(parseISO(activeDate), 'MMM d, yyyy')
    : null;

  // 7-day leads/sold window ending on activeDate (for top cards)
  const cardWindow = useMemo(() => {
    if (!activeDate) return { leads: 0, sold: 0 };
    const start = format(subDays(parseISO(activeDate), 6), 'yyyy-MM-dd');
    return sumWindow(start, activeDate);
  }, [activeDate, leadsData]);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory vs Leads</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Weekly inventory snapshots compared against lead and sold performance
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isGroup && activeStores && activeStores.length > 0 && (
            <select
              value={selectedStoreName || activeStores[0]?.name || ''}
              onChange={e => setSelectedStoreName(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {activeStores.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          )}
          <SnapshotDatePicker
            dates={availableDates}
            selected={snapshotDate || activeDate}
            onChange={setSnapshotDate}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {invLoading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Loading inventory…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'New Inventory', value: totals.new, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: 'Used Inventory', value: totals.used, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
            { label: 'Leads (7-day)', value: cardWindow.leads, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
            { label: 'Sold (7-day)', value: cardWindow.sold, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          ].map(card => (
            <div key={card.label} className={`rounded-2xl border ${card.border} ${card.bg} p-5 flex flex-col gap-1`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{card.label}</p>
              <p className={`text-3xl font-bold tabular-nums ${card.color}`}>{fmt(card.value)}</p>
              {displayDate && (
                <p className="text-xs text-gray-400 mt-1">
                  {card.label.includes('day') ? `7 days ending ` : `Snapshot `}{displayDate}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inventory Breakdown Table */}
      {!invLoading && invResult?.inventory?.length > 0 && (() => {
        const newRows = (invResult.inventory || []).filter(r => r.inventory_type === 'new').sort((a, b) => (b.count - a.count));
        const usedRows = (invResult.inventory || []).filter(r => r.inventory_type === 'used').sort((a, b) => (b.count - a.count));
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{ label: 'New Inventory', rows: newRows, color: 'text-blue-600', headerBg: 'bg-blue-50', border: 'border-blue-100' },
              { label: 'Used Inventory', rows: usedRows, color: 'text-amber-600', headerBg: 'bg-amber-50', border: 'border-amber-100' }
            ].map(({ label, rows, color, headerBg, border }) => (
              <div key={label} className={`rounded-2xl border ${border} overflow-hidden`}>
                <div className={`${headerBg} px-4 py-3 flex items-center justify-between`}>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
                  <span className={`text-sm font-bold tabular-nums ${color}`}>
                    {fmt(rows.reduce((s, r) => s + (r.count || 0), 0))} total
                  </span>
                </div>
                <div className="bg-white divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {rows.length === 0 ? (
                    <p className="text-xs text-gray-400 px-4 py-3 italic">No data</p>
                  ) : rows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2">
                      <span className="text-sm text-gray-700 truncate flex-1">
                        {[r.year, r.make, r.model].filter(Boolean).join(' ') || '—'}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-gray-800 ml-3">{fmt(r.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            Inventory Level vs Leads &amp; Sold
          </p>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTrendMode('weekly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${trendMode === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Weekly
            </button>
            <button
              onClick={() => setTrendMode('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${trendMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Monthly
            </button>
          </div>
        </div>

        {!hasData ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                interval={trendMode === 'monthly' ? Math.max(0, Math.floor(chartData.length / 8) - 1) : 0}
              />
              {/* Left axis: inventory */}
              <YAxis yAxisId="inv" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
              {/* Right axis: leads + sold */}
              <YAxis yAxisId="perf" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 12 }}
                labelStyle={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}
                formatter={(value, name) => [fmt(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Line
                yAxisId="inv" type="monotone" dataKey="new_inv"
                stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3"
                dot={false} name="New Inventory" connectNulls
              />
              <Line
                yAxisId="inv" type="monotone" dataKey="used_inv"
                stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3"
                dot={false} name="Used Inventory" connectNulls
              />
              <Line
                yAxisId="perf" type="monotone" dataKey="leads"
                stroke="#8b5cf6" strokeWidth={2.5}
                dot={{ r: 3, fill: '#8b5cf6', stroke: 'white', strokeWidth: 1.5 }}
                activeDot={{ r: 5 }} name="Leads"
              />
              <Line
                yAxisId="perf" type="monotone" dataKey="sold"
                stroke="#10b981" strokeWidth={2.5}
                dot={{ r: 3, fill: '#10b981', stroke: 'white', strokeWidth: 1.5 }}
                activeDot={{ r: 5 }} name="Sold Units"
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        <p className="text-xs text-gray-400 mt-2">
          Inventory (dashed) from weekly Thursday snapshots.
          Leads &amp; Sold are summed for the 7-day window ending on each snapshot date.
          {displayDate ? ` Selected snapshot: ${displayDate}.` : ''}
        </p>
      </div>
    </div>
  );
}