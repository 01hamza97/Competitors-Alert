import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useDealer } from '@/lib/DealerContext';
import { useLeadTypeBreakdown, useVendorSummary } from '@/lib/useAggregatedData';
import { getPeriodRange, getCompareRange } from './PerformanceKPIs';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const BLUE = '#3b82f6';
const BLUE_LIGHT = '#93c5fd';
const fmt = (n) => (n ?? 0).toLocaleString();
const pct = (s, t) => t > 0 ? Math.round((s / t) * 100) : 0;

const EXCLUDED_UP_TYPES = new Set(['Import', 'PreviousCustomer', 'Previous Customer']);

// Aggregate breakdown rows into { byLeadType, byInventory, party }
// sourcePartyMap: { [lead_source]: '1st Party' | '3rd Party' }
function buildBreakdown(rows, vendorRows = [], sourcePartyMap = {}) {
  const byLeadType = {};
  const byInventory = {};

  rows.forEach(r => {
    if (r.lead_type === '__src__') return; // skip source rows here
    const lt = r.lead_type || 'Unknown';
    if (EXCLUDED_UP_TYPES.has(lt)) return;
    if (!byLeadType[lt]) byLeadType[lt] = { type: lt, leads: 0, sold: 0 };
    byLeadType[lt].leads += r.total_leads;
    byLeadType[lt].sold  += r.total_sold;

    const inv = r.inventory_type || 'Unknown';
    if (!byInventory[inv]) byInventory[inv] = { type: inv, leads: 0, sold: 0 };
    byInventory[inv].leads += r.total_leads;
    byInventory[inv].sold  += r.total_sold;
  });

  const upType = Object.values(byLeadType).sort((a, b) => b.leads - a.leads);
  const invType = Object.values(byInventory).sort((a, b) => b.leads - a.leads);

  // Party breakdown: classify Internet leads (per-source vendor rows) via sourcePartyMap
  const partyMap = { '1st Party': { leads: 0, sold: 0 }, '3rd Party': { leads: 0, sold: 0 } };
  vendorRows.forEach(r => {
    const pt = sourcePartyMap[r.lead_source] || '3rd Party';
    partyMap[pt].leads += r.total_leads || 0;
    partyMap[pt].sold  += r.total_sold || 0;
  });

  return {
    upType,
    invType,
    party: [
      { name: '1st Party', leads: partyMap['1st Party'].leads, sold: partyMap['1st Party'].sold, color: '#3b82f6' },
      { name: '3rd Party', leads: partyMap['3rd Party'].leads, sold: partyMap['3rd Party'].sold, color: '#e2e8f0' },
    ],
  };
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function SectionTitle({ children }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">{children}</p>;
}

function BarLegend({ showCompare }) {
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: BLUE }} /><span className="text-xs text-gray-500">Leads</span></div>
      {showCompare && <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm opacity-50" style={{ background: BLUE }} /><span className="text-xs text-gray-400">Leads (Prev)</span></div>}
      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: BLUE_LIGHT }} /><span className="text-xs text-gray-500">Sold</span></div>
      {showCompare && <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm opacity-50" style={{ background: BLUE_LIGHT }} /><span className="text-xs text-gray-400">Sold (Prev)</span></div>}
    </div>
  );
}

function UpTypeChart({ cur, cmp }) {
  const data = cur.upType.map((r, i) => ({
    type: r.type,
    'Leads': r.leads,
    'Sold': r.sold,
    ...(cmp ? { 'Leads (Prev)': cmp.upType[i]?.leads ?? 0, 'Sold (Prev)': cmp.upType[i]?.sold ?? 0 } : {}),
  }));
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionTitle>Up Type</SectionTitle>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<CustomBarTooltip />} />
          <Bar dataKey="Leads" fill={BLUE} radius={[4, 4, 0, 0]} />
          {cmp && <Bar dataKey="Leads (Prev)" fill={BLUE} fillOpacity={0.35} radius={[4, 4, 0, 0]} />}
          <Bar dataKey="Sold" fill={BLUE_LIGHT} radius={[4, 4, 0, 0]} />
          {cmp && <Bar dataKey="Sold (Prev)" fill={BLUE_LIGHT} fillOpacity={0.35} radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
      <BarLegend showCompare={!!cmp} />
    </div>
  );
}

function NewUsedChart({ cur, cmp }) {
  const newLeads  = cur.invType.find(r => r.type === 'New')?.leads  ?? 0;
  const newSold   = cur.invType.find(r => r.type === 'New')?.sold   ?? 0;
  const usedLeads = cur.invType.filter(r => r.type !== 'New' && r.type !== 'Unknown').reduce((s, r) => s + r.leads, 0);
  const usedSold  = cur.invType.filter(r => r.type !== 'New' && r.type !== 'Unknown').reduce((s, r) => s + r.sold,  0);

  const cmpNewLeads  = cmp ? (cmp.invType.find(r => r.type === 'New')?.leads  ?? 0) : 0;
  const cmpNewSold   = cmp ? (cmp.invType.find(r => r.type === 'New')?.sold   ?? 0) : 0;
  const cmpUsedLeads = cmp ? cmp.invType.filter(r => r.type !== 'New' && r.type !== 'Unknown').reduce((s, r) => s + r.leads, 0) : 0;
  const cmpUsedSold  = cmp ? cmp.invType.filter(r => r.type !== 'New' && r.type !== 'Unknown').reduce((s, r) => s + r.sold,  0) : 0;

  const data = [
    { type: 'New',  'Leads': newLeads,  'Sold': newSold,  ...(cmp ? { 'Leads (Prev)': cmpNewLeads,  'Sold (Prev)': cmpNewSold  } : {}) },
    { type: 'Used', 'Leads': usedLeads, 'Sold': usedSold, ...(cmp ? { 'Leads (Prev)': cmpUsedLeads, 'Sold (Prev)': cmpUsedSold } : {}) },
  ];
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionTitle>New vs Used</SectionTitle>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<CustomBarTooltip />} />
          <Bar dataKey="Leads" fill={BLUE} radius={[4, 4, 0, 0]} />
          {cmp && <Bar dataKey="Leads (Prev)" fill={BLUE} fillOpacity={0.35} radius={[4, 4, 0, 0]} />}
          <Bar dataKey="Sold" fill={BLUE_LIGHT} radius={[4, 4, 0, 0]} />
          {cmp && <Bar dataKey="Sold (Prev)" fill={BLUE_LIGHT} fillOpacity={0.35} radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
      <BarLegend showCompare={!!cmp} />
    </div>
  );
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.08) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text>;
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl p-3 text-xs space-y-1">
      <p className="font-bold text-gray-700">{d.name}</p>
      <p className="text-blue-600">Leads: <span className="font-semibold">{fmt(d.leads)}</span></p>
      <p className="text-emerald-600">Sold: <span className="font-semibold">{fmt(d.sold)}</span></p>
      <p className="text-amber-500">Sold %: <span className="font-semibold">{pct(d.sold, d.leads)}%</span></p>
    </div>
  );
};

function PartyChart({ cur }) {
  const pieData = cur.party.map(d => ({ ...d, value: d.leads }));
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <SectionTitle>1st vs 3rd Party</SectionTitle>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" labelLine={false} label={renderCustomLabel}>
            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip content={<CustomPieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Delta({ cur, prev }) {
  if (prev == null) return null;
  const diff = cur - prev;
  if (diff === 0) return null;
  const positive = diff > 0;
  return (
    <span className={`ml-1 text-[10px] font-semibold ${positive ? 'text-emerald-500' : 'text-red-400'}`}>
      {positive ? '+' : ''}{diff}
    </span>
  );
}

function DeltaPct({ cur, prev }) {
  if (prev == null) return null;
  const diff = cur - prev;
  if (diff === 0) return null;
  const positive = diff > 0;
  return (
    <span className={`ml-1 text-[10px] font-semibold ${positive ? 'text-emerald-500' : 'text-red-400'}`}>
      {positive ? '+' : ''}{diff.toFixed(0)}%
    </span>
  );
}

function SectionTable({ title, rows, cmpRows, onSort }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Type</th>
            <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-500 cursor-pointer select-none hover:text-blue-700" onClick={() => onSort?.('leads')}>Leads</th>
            <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 cursor-pointer select-none hover:text-emerald-700" onClick={() => onSort?.('sold')}>Sold</th>
            <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-amber-500 whitespace-nowrap cursor-pointer select-none hover:text-amber-700" onClick={() => onSort?.('soldPct')}>Sold %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const cp = cmpRows?.[i];
            const cpByType = cmpRows?.find(r => r.type === row.type);
            const cmpRow = cpByType || cp;
            return (
              <tr key={row.type} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-4 py-2 font-medium text-gray-700">{row.type}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="font-semibold text-blue-600">{fmt(row.leads)}</span>
                  {cmpRow && <Delta cur={row.leads} prev={cmpRow.leads} />}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="font-semibold text-emerald-600">{fmt(row.sold)}</span>
                  {cmpRow && <Delta cur={row.sold} prev={cmpRow.sold} />}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="font-semibold text-amber-500">{pct(row.sold, row.leads)}%</span>
                  {cmpRow && <DeltaPct cur={pct(row.sold, row.leads)} prev={pct(cmpRow.sold, cmpRow.leads)} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MTDBreakdown({ comparison, period, selectedDealership }) {
  const [view, setView] = useState('table');
  const [sortKey, setSortKey] = useState('sold');
  const [sortDir, setSortDir] = useState('desc');
  const { activeDealershipKeys } = useDealer();

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Use the selected period for breakdown
  const { start, end } = getPeriodRange(period || 'mtd');
  const cmpRange = getCompareRange(period || 'mtd', comparison);

  const breakdownKeys = selectedDealership
    ? activeDealershipKeys.filter(k => k === selectedDealership)
    : activeDealershipKeys;

  const { data: curRows = [], isLoading } = useLeadTypeBreakdown(breakdownKeys, start, end);
  const { data: cmpRows = [] } = useLeadTypeBreakdown(breakdownKeys, cmpRange?.start, cmpRange?.end, !!cmpRange);
  const { data: curVendorRows = [] } = useVendorSummary(breakdownKeys, start, end);
  const { data: cmpVendorRows = [] } = useVendorSummary(breakdownKeys, cmpRange?.start, cmpRange?.end, !!cmpRange);

  // Load InternetLeadGroup records to build lead_source → party_type map
  const { data: leadGroups = [] } = useQuery({
    queryKey: ['internetLeadGroups_party'],
    staleTime: 5 * 60 * 1000,
    queryFn: () => base44.entities.InternetLeadGroup.list('sort_order', 500),
  });

  const sourcePartyMap = useMemo(() => {
    const map = {};
    leadGroups.forEach(g => {
      if (!g.raw_sources || !g.party_type) return;
      g.raw_sources.split('|').map(s => s.trim()).filter(Boolean).forEach(s => {
        map[s] = g.party_type;
      });
    });
    return map;
  }, [leadGroups]);

  const cur = buildBreakdown(curRows, curVendorRows, sourcePartyMap);
  const cmp = cmpRange && cmpRows.length > 0 ? buildBreakdown(cmpRows, cmpVendorRows, sourcePartyMap) : null;

  if (isLoading) {
    return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading breakdown…</div>;
  }

  const getSortValue = (row, key) => {
    if (key === 'soldPct') return row.leads > 0 ? (row.sold / row.leads) * 100 : 0;
    return row[key];
  };

  const sortRows = (rows) => {
    return [...rows].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  };

  // Sort rows
  const sortedUpType = sortRows(cur.upType);
  
  const newUsedRows = [
    { type: 'New',  leads: cur.invType.find(r => r.type === 'New')?.leads  ?? 0, sold: cur.invType.find(r => r.type === 'New')?.sold  ?? 0 },
    { type: 'Used', leads: cur.invType.filter(r => r.type !== 'New' && r.type !== 'Unknown').reduce((s, r) => s + r.leads, 0), sold: cur.invType.filter(r => r.type !== 'New' && r.type !== 'Unknown').reduce((s, r) => s + r.sold, 0) },
  ];
  const sortedNewUsedRows = sortRows(newUsedRows);

  const cmpNewUsedRows = cmp ? [
    { type: 'New',  leads: cmp.invType.find(r => r.type === 'New')?.leads  ?? 0, sold: cmp.invType.find(r => r.type === 'New')?.sold  ?? 0 },
    { type: 'Used', leads: cmp.invType.filter(r => r.type !== 'New' && r.type !== 'Unknown').reduce((s, r) => s + r.leads, 0), sold: cmp.invType.filter(r => r.type !== 'New' && r.type !== 'Unknown').reduce((s, r) => s + r.sold, 0) },
  ] : null;

  return (
    <div>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-4">
        <button onClick={() => setView('chart')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${view === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Charts</button>
        <button onClick={() => setView('table')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${view === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Table</button>
      </div>

      {view === 'table' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionTable title="Up Type" rows={sortedUpType} cmpRows={cmp?.upType} onSort={handleSort} />
          <SectionTable title="New vs Used" rows={sortedNewUsedRows} cmpRows={cmpNewUsedRows} onSort={handleSort} />
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">1st vs 3rd Party</p>
            </div>
            <table className="w-full text-sm">
              <colgroup>
                <col style={{ minWidth: '100px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Type</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-500 cursor-pointer select-none hover:text-blue-700" onClick={() => handleSort('leads')}>Leads</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 cursor-pointer select-none hover:text-emerald-700" onClick={() => handleSort('sold')}>Sold</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber-500 whitespace-nowrap cursor-pointer select-none hover:text-amber-700" onClick={() => handleSort('soldPct')}>Sold %</th>
                </tr>
              </thead>
              <tbody>
                {cur.party.map((r, i) => {
                  const cp = cmp?.party.find(p => p.name === r.name);
                  return (
                    <React.Fragment key={r.name}>
                      <tr className={i % 2 === 1 ? 'bg-gray-50/40' : ''}>
                        <td className="px-4 py-2 font-medium text-gray-700">{r.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <span className="font-semibold text-blue-600">{r.leads}</span>
                          {cp && <Delta cur={r.leads} prev={cp.leads} />}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <span className="font-semibold text-emerald-600">{r.sold}</span>
                          {cp && <Delta cur={r.sold} prev={cp.sold} />}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <span className="font-semibold text-amber-500">{r.leads > 0 ? Math.round((r.sold / r.leads) * 100) : 0}%</span>
                          {cp && <DeltaPct cur={r.leads > 0 ? Math.round((r.sold / r.leads) * 100) : 0} prev={cp.leads > 0 ? Math.round((cp.sold / cp.leads) * 100) : 0} />}
                        </td>
                      </tr>
                      {i === 1 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-xs text-gray-400">Internet leads only, grouped by party type per lead source settings.</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <UpTypeChart cur={{...cur, upType: sortedUpType}} cmp={cmp} />
          <NewUsedChart cur={{...cur, invType: cur.invType.sort((a, b) => (cur.invType.find(x => x.type === b.type)?.sold ?? 0) - (cur.invType.find(x => x.type === a.type)?.sold ?? 0))}} cmp={cmp} />
          <PartyChart cur={cur} />
        </div>
      )}
    </div>
  );
}