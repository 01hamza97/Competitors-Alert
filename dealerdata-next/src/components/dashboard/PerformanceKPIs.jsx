import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, subYears } from 'date-fns';
import { useDealer } from '@/lib/DealerContext';
import { useLeadKpiSummary, useDealerRanking } from '@/lib/useAggregatedData';
import UpTypeFilter from './UpTypeFilter';

// Get today's date string in PST
function todayPST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

export function getPeriodRange(period) {
  const todayStr = todayPST();
  const today = new Date(todayStr + 'T12:00:00');
  const yesterday = subDays(today, 1);
  if (period === 'today') {
    const d = todayStr;
    return { start: d, end: d };
  }
  if (period === 'yesterday') {
    const d = format(yesterday, 'yyyy-MM-dd');
    return { start: d, end: d };
  }
  if (period === 'mtd') {
    return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(yesterday, 'yyyy-MM-dd') };
  }
  if (period?.startsWith('month_')) {
    const n = parseInt(period.split('_')[1]);
    const d = subMonths(today, n);
    return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') };
  }
  if (period?.startsWith('mtd_')) {
    const n = parseInt(period.split('_')[1]);
    const d = subMonths(today, n);
    const dayOfMonth = yesterday.getDate();
    const endD = new Date(d.getFullYear(), d.getMonth(), Math.min(dayOfMonth, endOfMonth(d).getDate()));
    return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endD, 'yyyy-MM-dd') };
  }
  if (period?.startsWith('custom_')) {
    const parts = period.split('_');
    return { start: parts[1], end: parts[2] };
  }
  return { start: format(yesterday, 'yyyy-MM-dd'), end: format(yesterday, 'yyyy-MM-dd') };
}

export function getCompareRange(period, compare) {
  if (!compare) return null;
  const { start, end } = getPeriodRange(period);
  const shiftFn = compare === 'lastMonth' ? (d) => subMonths(d, 1) : (d) => subYears(d, 1);
  return {
    start: format(shiftFn(new Date(start + 'T00:00:00')), 'yyyy-MM-dd'),
    end: format(shiftFn(new Date(end + 'T00:00:00')), 'yyyy-MM-dd'),
  };
}

const fmt = (n) => (n ?? 0).toLocaleString();

function Delta({ cur, cmp, showCmp }) {
  if (!showCmp) return null;
  if (cmp === null || cmp === undefined || !Number.isFinite(cmp)) {
    return <span className="text-xs font-semibold text-gray-300 whitespace-nowrap"> (N/A)</span>;
  }
  const d = cur - cmp;
  const pos = d > 0;
  return (
    <span className={`text-xs font-semibold whitespace-nowrap ${d === 0 ? 'text-gray-400' : pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {' '}({d === 0 ? '0' : (pos ? '+' : '') + fmt(d)})
    </span>
  );
}

function PctDelta({ cur, cmp, showCmp }) {
  if (!showCmp) return null;
  if (cmp === null || cmp === undefined || !Number.isFinite(cmp)) {
    return <span className="text-xs font-semibold text-gray-300 whitespace-nowrap"> (N/A)</span>;
  }
  const d = cur - cmp;
  const pos = d > 0;
  return (
    <span className={`text-xs font-semibold whitespace-nowrap ${d === 0 ? 'text-gray-400' : pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {' '}({d === 0 ? '0%' : (pos ? '+' : '') + d + '%'})
    </span>
  );
}

function HeroKPIs({ cur, cmp, showCmp }) {
  const cmpLeads = cmp?.total_leads ?? null;
  const cmpSold = cmp?.total_sold ?? null;
  const cmpPct = cmp?.sold_pct ?? null;
  return (
    <div className="flex border-b border-gray-200">
      <div className="flex-1 px-5 py-4 border-r border-gray-100">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Total Leads</p>
        <span className="text-5xl font-black tabular-nums text-blue-600 leading-none">{fmt(cur?.total_leads)}</span>
        {showCmp && <div className="mt-0.5"><Delta cur={cur?.total_leads ?? 0} cmp={cmpLeads} showCmp /></div>}
      </div>
      <div className="flex-1 px-5 py-4 border-r border-gray-100">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Total Sold</p>
        <span className="text-5xl font-black tabular-nums text-emerald-600 leading-none">{fmt(cur?.total_sold)}</span>
        {showCmp && <div className="mt-0.5"><Delta cur={cur?.total_sold ?? 0} cmp={cmpSold} showCmp /></div>}
      </div>
      <div className="flex-1 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Sold %</p>
        <span className="text-5xl font-black tabular-nums text-gray-700 leading-none">{cur?.sold_pct ?? 0}%</span>
        {showCmp && <div className="mt-0.5"><PctDelta cur={cur?.sold_pct ?? 0} cmp={cmpPct} showCmp /></div>}
      </div>
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

// Up-type filter options → Supabase lead_type value (null = all types)
const UP_TYPE_MAP = { all: null, internet: 'Internet', phone: 'Phone', walkin: 'Walk-in' };

function SortIcon({ active, dir }) {
  if (!active) return null;
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function RankingTable({ rows, cmpRows, hasCmp }) {
  const [sortKey, setSortKey] = useState('total_leads');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const cmpMap = {};
  (cmpRows || []).forEach(r => { cmpMap[r.dealer_id] = r; });

  return (
    <table className="w-full text-sm">
      <colgroup>
        <col style={{ minWidth: '100px' }} />
        <col style={{ width: '90px' }} />
        <col style={{ width: '90px' }} />
        <col style={{ width: '90px' }} />
      </colgroup>
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Dealership</th>
          {[
            { key: 'total_leads', label: 'Leads',  color: 'text-blue-500' },
            { key: 'total_sold',  label: 'Sold',   color: 'text-emerald-600' },
            { key: 'sold_pct',    label: 'Sold %', color: 'text-amber-500' },
          ].map(col => (
            <th key={col.key} onClick={() => handleSort(col.key)}
              className={`text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${col.color}`}>
              {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, i) => {
          const cp = cmpMap[row.dealer_id];
          return (
            <tr key={row.dealer_id} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
              <td className="px-4 py-2 font-medium text-gray-700">
                <span className="inline-flex items-center gap-1.5">
                  {i < 3 && <span className="text-base leading-none">{MEDALS[i]}</span>}
                  {row.label || row.dealer_id}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-semibold text-blue-600 tabular-nums">
                {fmt(row.total_leads)}
                {hasCmp && <Delta cur={row.total_leads} cmp={cp?.total_leads ?? null} showCmp />}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-emerald-600 tabular-nums">
                {fmt(row.total_sold)}
                {hasCmp && <Delta cur={row.total_sold} cmp={cp?.total_sold ?? null} showCmp />}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-amber-500 tabular-nums">
                {row.sold_pct}%
                {hasCmp && <PctDelta cur={row.sold_pct} cmp={cp?.sold_pct ?? null} showCmp />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Single component that handles both store and group views
export default function PerformanceKPIs({ period, compare, selectedDealership }) {
  const { activeDealershipKeys, activeStores, selectedType } = useDealer();
  const isGroup = selectedType === 'group';
  const [upType, setUpType] = useState('all');
  const leadType = UP_TYPE_MAP[upType];

  const { start, end } = getPeriodRange(period);
  const cmpRange = getCompareRange(period, compare);

  // For group view + specific dealership filter, narrow keys
  const kpiKeys = isGroup && selectedDealership
    ? activeDealershipKeys.filter(k => k === selectedDealership)
    : activeDealershipKeys;

  const { data: curKpi, isLoading: loadingCur } = useLeadKpiSummary(kpiKeys, start, end, true, leadType);
  const { data: cmpKpi } = useLeadKpiSummary(kpiKeys, cmpRange?.start, cmpRange?.end, !!cmpRange, leadType);

  // Dealer ranking only for group view with no specific store selected
  const { data: curRanking = [] } = useDealerRanking(
    activeDealershipKeys, start, end,
    isGroup && !selectedDealership, leadType
  );
  const { data: cmpRanking = [] } = useDealerRanking(
    activeDealershipKeys, cmpRange?.start, cmpRange?.end,
    isGroup && !selectedDealership && !!cmpRange, leadType
  );

  // Enrich ranking rows with store display names
  const storeNameMap = {};
  activeStores.forEach(s => { storeNameMap[s.dealership_key] = s.name; });
  const rankingWithNames = curRanking.map(r => ({
    ...r,
    label: storeNameMap[r.dealer_id] || r.dealer_id,
  }));

  if (loadingCur) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-xl">
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-xl">
        <HeroKPIs cur={curKpi} cmp={compare ? (cmpKpi ?? null) : null} showCmp={!!compare} />
      </div>

      {isGroup && !selectedDealership && rankingWithNames.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-xl">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Dealership Ranking</h2>
            <UpTypeFilter value={upType} onChange={setUpType} />
          </div>
          <RankingTable rows={rankingWithNames} cmpRows={cmpRanking} hasCmp={!!compare} />
        </div>
      )}
    </div>
  );
}