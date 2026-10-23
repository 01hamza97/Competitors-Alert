'use client';
import { useState, useMemo } from 'react';
import { useDealer } from '@/lib/DealerContext';
import { useVendorSummary } from '@/lib/useAggregatedData';
import { getPeriodRange, getCompareRange } from '@/components/dashboard/PerformanceKPIs';
import { format, subMonths, startOfMonth, eachDayOfInterval } from 'date-fns';
import { ChevronUp, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { buildPeriodOptions, parseCustomPeriod, COMPARE_OPTIONS } from '@/components/dashboard/PerformanceControls';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const COLUMNS = [
  { key: 'source',      label: 'Lead Source',  align: 'left'  },
  { key: 'goodLeads',   label: 'Good Leads',   align: 'right' },
  { key: 'apptsSet',    label: 'Appts Set',    align: 'right' },
  { key: 'sold',        label: 'Sold',         align: 'right' },
  { key: 'soldPct',     label: 'Sold %',       align: 'right' },
  { key: 'totalGross',  label: 'Total Gross',  align: 'right' },
];

const CHART_METRICS = [
  { key: 'Good Leads', color: '#3b82f6', yAxis: 'left' },
  { key: 'Sold',       color: '#10b981', yAxis: 'right' },
];

const INVENTORY_OPTIONS = [
  { value: 'all',  label: 'All'  },
  { value: 'new',  label: 'New'  },
  { value: 'used', label: 'Used' },
];

function fmtGross(n) {
  if (n == null || n === undefined) return '$0';
  if (n === 0) return '$0';
  if (n < 0) return `($${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })})`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={12} className="ml-1 text-gray-300 inline" />;
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="ml-1 text-blue-500 inline" />
    : <ChevronDown size={12} className="ml-1 text-blue-500 inline" />;
}

function Delta({ cur, cmp }) {
  if (cmp == null) return null;
  const d = cur - cmp;
  if (d === 0) return <span className="text-xs text-gray-400 ml-1">(0)</span>;
  const pos = d > 0;
  return (
    <span className={`text-xs font-semibold ml-1 ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      ({pos ? '+' : ''}{d.toLocaleString()})
    </span>
  );
}

function PctDelta({ cur, cmp }) {
  if (cmp == null) return null;
  const d = cur - cmp;
  if (d === 0) return <span className="text-xs text-gray-400 ml-1">(0%)</span>;
  const pos = d > 0;
  return (
    <span className={`text-xs font-semibold ml-1 ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      ({pos ? '+' : ''}{d}%)
    </span>
  );
}

function CustomDotWithLabel({ cx, cy, value, color }) {
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1.5} />
      <rect x={cx - 10} y={cy - 22} width={20} height={14} rx={4} fill={color} opacity={0.85} />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="white" fontSize={8} fontWeight="600">{value}</text>
    </g>
  );
}

// Build vendor rows grouped by InternetLeadGroup definitions
function buildGroupedRows(rawData, leadGroups) {
  if (!leadGroups || leadGroups.length === 0) {
    // No groups — aggregate by raw lead_source
    const map = {};
    rawData.forEach(r => {
      const src = r.lead_source || 'Unknown';
      if (!map[src]) map[src] = { source: src, goodLeads: 0, apptsSet: 0, sold: 0, totalGross: 0 };
      map[src].goodLeads  += r.total_leads;
      map[src].apptsSet   += r.total_appts_set;
      map[src].sold       += r.total_sold;
      map[src].totalGross += r.total_gross;
    });
    return Object.values(map).map(row => ({
      ...row,
      soldPct: row.goodLeads > 0 ? Math.round((row.sold / row.goodLeads) * 100) : 0,
    }));
  }

  // Build source → group name map
  const sourceToGroup = {};
  const knownGroupNames = new Set(leadGroups.map(g => g.group_name));
  leadGroups.forEach(g => {
    const sources = g.raw_sources ? g.raw_sources.split('|').map(s => s.trim()).filter(Boolean) : [];
    sources.forEach(s => { sourceToGroup[s] = g.group_name; });
  });

  const map = {};
  rawData.forEach(r => {
    const src = r.lead_source || 'Unknown';
    const groupName = sourceToGroup[src] || (knownGroupNames.has(src) ? src : src);
    if (!map[groupName]) map[groupName] = { source: groupName, goodLeads: 0, apptsSet: 0, sold: 0, totalGross: 0 };
    map[groupName].goodLeads  += r.total_leads;
    map[groupName].apptsSet   += r.total_appts_set;
    map[groupName].sold       += r.total_sold;
    map[groupName].totalGross += r.total_gross;
  });
  return Object.values(map).map(row => ({
    ...row,
    soldPct: row.goodLeads > 0 ? Math.round((row.sold / row.goodLeads) * 100) : 0,
  }));
}


function filterByVendor(rows, vendorFilter, leadGroups) {
  if (!vendorFilter) return rows;
  if (leadGroups && leadGroups.length > 0) {
    const matchingGroups = leadGroups.filter(g => g.group_name === vendorFilter);
    if (matchingGroups.length > 0) {
      const sources = new Set(
        matchingGroups.flatMap(g =>
          g.raw_sources ? g.raw_sources.split('|').map(s => s.trim()).filter(Boolean) : []
        )
      );
      sources.add(vendorFilter);
      return rows.filter(r => sources.has(r.lead_source));
    }
  }
  return rows.filter(r => r.lead_source === vendorFilter);
}

// Hook: fetch vendor summary for multiple months (for trend chart)
function useMonthlyVendorTrend(dealerIds, endDate, numMonths, inventoryType = null) {
  const months = [];
  const ref = new Date(endDate + 'T00:00:00');
  // Like-for-like buckets: every month runs the 1st through the same day-of-month as the
  // period end, so viewing MTD compares MTD to MTD and never to a full prior month.
  // A full-month period (one ending on the last day of its month) still uses full months.
  const refDaysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const mtdDay = ref.getDate() === refDaysInMonth ? null : ref.getDate();
  // Go from numMonths ago up to and including the current month (i=0)
  for (let i = numMonths; i >= 0; i--) {
    const mo = subMonths(ref, i);
    const daysInMonth = new Date(mo.getFullYear(), mo.getMonth() + 1, 0).getDate();
    const endDay = mtdDay == null ? daysInMonth : Math.min(mtdDay, daysInMonth);
    months.push({
      start: format(startOfMonth(mo), 'yyyy-MM-dd'),
      end: format(new Date(mo.getFullYear(), mo.getMonth(), endDay), 'yyyy-MM-dd'),
      label: format(mo, 'MMM yy'),
    });
  }

  return useQuery({
    queryKey: ['vendor_monthly_trend', dealerIds?.join(','), endDate, numMonths, inventoryType],
    enabled: !!dealerIds && dealerIds.length > 0 && !!endDate,
    staleTime: 0,
    queryFn: async () => {
      const results = await Promise.all(months.map(async (m) => {
        const res = await base44.functions.invoke('supabaseVendorSummary', {
          dealer_ids: dealerIds,
          start_date: m.start,
          end_date: m.end,
          inventory_type: inventoryType,
        });
        return { label: m.label, data: res.data?.data || [] };
      }));
      return results;
    },
  });
}

// Hook: fetch vendor summary for a date range and return per-day totals
function useDailyVendorTrend(dealerIds, startDate, endDate, inventoryType = null) {
  return useQuery({
    queryKey: ['vendor_daily_trend', dealerIds?.join(','), startDate, endDate, inventoryType],
    enabled: !!dealerIds && dealerIds.length > 0 && !!startDate && !!endDate,
    staleTime: 0,
    queryFn: async () => {
      // Fetch raw internet lead rows (with lead_source) so we can filter by vendor client-side.
      const res = await base44.functions.invoke('supabaseLeadPerformance', {
        dealer_ids: dealerIds,
        start_date: startDate,
        end_date: endDate,
      });
      const rows = (res.data?.data || [])
        .filter(r => r.lead_type === 'Internet')
        .filter(r => !inventoryType || (r.inventory_type || '').toLowerCase() === inventoryType);
      const days = eachDayOfInterval({
        start: new Date(startDate + 'T00:00:00'),
        end: new Date(endDate + 'T00:00:00'),
      }).map(d => format(d, 'yyyy-MM-dd'));
      return { rows, days };
    },
  });
}

export default function VendorPerformance() {
  const { selectedLabel, selectedType, activeStores, activeDealershipKeys } = useDealer();
  const isGroup = selectedType === 'group';

  const storeIds = activeStores.map(s => s.id);
  const { data: allLeadGroups = [] } = useQuery({
    queryKey: ['internetLeadGroups_all', storeIds.join(',')],
    enabled: storeIds.length > 0,
    queryFn: () => Promise.all(
      storeIds.map(id => base44.entities.InternetLeadGroup.filter({ store_id: id }, 'sort_order', 200))
    ).then(results => results.flat()),
  });

  const [period, setPeriod] = useState('mtd');
  const [compare, setCompare] = useState(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortKey, setSortKey] = useState('sold');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedVendor, setSelectedVendor] = useState('__all__');
  const [inventoryType, setInventoryType] = useState('all');
  // 'all' | 'new' | 'used' → Supabase inventory_type value
  const inventoryFilter = inventoryType === 'all' ? null : inventoryType === 'new' ? 'New' : 'Used';
  const [activeMetrics, setActiveMetrics] = useState({ 'Good Leads': true, 'Sold': true });
  const [selectedBreakdownVendor, setSelectedBreakdownVendor] = useState('__total__');
  const [bottomView, setBottomView] = useState('trend');
  const [breakdownSortKey, setBreakdownSortKey] = useState('leads');
  const [breakdownSortDir, setBreakdownSortDir] = useState('desc');
  const [expandedVendors, setExpandedVendors] = useState(new Set());

  const toggleVendorExpand = (source) => {
    setExpandedVendors(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const { start, end } = getPeriodRange(period);
  const cmpRange = getCompareRange(period, compare);
  const NUM_PRIOR_MONTHS = 6;

  // For the trend chart: "yesterday" → show current MTD daily; everything else → monthly buckets
  const isYesterday = period === 'yesterday';

  // For monthly trend: use the MTD end date (today-1) so "MTD" period shows prior months MTD
  // For mtd_N or month_N periods, use that period's end date
  const monthlyTrendEnd = end;

  // Main table data
  const { data: rawVendorData = [], isLoading } = useVendorSummary(activeDealershipKeys, start, end, true, inventoryFilter);

  // Comparison data (store view only)
  const { data: rawCmpData = [] } = useVendorSummary(
    activeDealershipKeys,
    cmpRange?.start,
    cmpRange?.end,
    !!cmpRange,
    inventoryFilter
  );

  // Daily trend (for "yesterday" period — shows each day of current MTD)
  const mtdRange = getPeriodRange('mtd');
  const { data: dailyTrendData, isLoading: loadingDaily } = useDailyVendorTrend(
    activeDealershipKeys, mtdRange.start, mtdRange.end, inventoryFilter
  );

  // Monthly trend data (for MTD and other period views)
  const { data: monthlyTrendData = [] } = useMonthlyVendorTrend(activeDealershipKeys, monthlyTrendEnd, NUM_PRIOR_MONTHS, inventoryFilter);

  // Build grouped rows for the table
  const vendorRows = useMemo(() =>
    buildGroupedRows(rawVendorData, allLeadGroups),
    [rawVendorData, allLeadGroups]
  );

  // Comparison rows keyed by source name (store view only)
  const cmpRowMap = useMemo(() => {
    if (!cmpRange) return {};
    const rows = buildGroupedRows(rawCmpData, allLeadGroups);
    const map = {};
    rows.forEach(r => { map[r.source] = r; });
    return map;
  }, [rawCmpData, allLeadGroups, cmpRange]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => [...vendorRows].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  }), [vendorRows, sortKey, sortDir]);

  const totals = useMemo(() => {
    const sum = sorted.reduce((acc, r) => ({
      goodLeads: acc.goodLeads + r.goodLeads,
      apptsSet: acc.apptsSet + r.apptsSet,
      sold: acc.sold + r.sold,
      totalGross: acc.totalGross + r.totalGross,
    }), { goodLeads: 0, apptsSet: 0, sold: 0, totalGross: 0 });
    return {
      ...sum,
      soldPct: sum.goodLeads > 0 ? Math.round((sum.sold / sum.goodLeads) * 100) : 0,
    };
  }, [sorted]);

  const availableVendors = useMemo(() =>
    [...new Set(vendorRows.map(r => r.source))].sort(),
    [vendorRows]
  );

  // Trend chart data — daily for "yesterday" period, monthly otherwise
  const { trendChartData, trendXKey } = useMemo(() => {
    if (isYesterday) {
      const vendorFilter = selectedVendor === '__all__' ? null : selectedVendor;
      const breakdownFilter = selectedBreakdownVendor === '__total__' ? null : selectedBreakdownVendor;
      const filter = isGroup ? breakdownFilter : vendorFilter;
      const rawRows = dailyTrendData?.rows || [];
      const filteredRows = filter ? filterByVendor(rawRows, filter, allLeadGroups) : rawRows;
      const map = {};
      filteredRows.forEach(r => {
        const d = r.report_date?.substring(0, 10);
        if (!d) return;
        if (!map[d]) map[d] = { 'Good Leads': 0, 'Sold': 0 };
        map[d]['Good Leads'] += r.good_leads || 0;
        map[d]['Sold'] += r.sold || 0;
      });
      const days = dailyTrendData?.days || [];
      const data = days.map(dStr => ({
        date: format(new Date(dStr + 'T00:00:00'), 'MMM d'),
        'Good Leads': map[dStr]?.['Good Leads'] ?? 0,
        'Sold': map[dStr]?.['Sold'] ?? 0,
      }));
      return { trendChartData: data, trendXKey: 'date' };
    }
    // Monthly
    const vendorFilter = selectedVendor === '__all__' ? null : selectedVendor;
    const breakdownFilter = selectedBreakdownVendor === '__total__' ? null : selectedBreakdownVendor;
    const filter = isGroup ? breakdownFilter : vendorFilter;
    const data = monthlyTrendData.map(m => {
      const rows = filter ? filterByVendor(m.data, filter, allLeadGroups) : m.data;
      return {
        month: m.label,
        'Good Leads': rows.reduce((s, r) => s + r.total_leads, 0),
        'Sold': rows.reduce((s, r) => s + r.total_sold, 0),
      };
    });
    return { trendChartData: data, trendXKey: 'month' };
  }, [isYesterday, dailyTrendData, monthlyTrendData, selectedVendor, selectedBreakdownVendor, isGroup, allLeadGroups]);

  // Group: per-dealership breakdown for selected vendor
  const vendorBreakdownRows = useMemo(() => {
    if (!isGroup) return [];
    const rows = selectedBreakdownVendor !== '__total__'
      ? filterByVendor(rawVendorData, selectedBreakdownVendor, allLeadGroups)
      : rawVendorData;

    const map = {};
    activeStores.forEach(s => { map[s.dealership_key] = { name: s.name, dealer_key: s.dealership_key, leads: 0, sold: 0, gross: 0 }; });
    rows.forEach(r => {
      if (map[r.dealer_id]) {
        map[r.dealer_id].leads += r.total_leads;
        map[r.dealer_id].sold  += r.total_sold;
        map[r.dealer_id].gross += r.total_gross;
      }
    });
    return Object.values(map).map(r => ({
      ...r,
      soldPct: r.leads > 0 ? Math.round((r.sold / r.leads) * 100) : 0,
    }));
  }, [isGroup, rawVendorData, activeStores, selectedBreakdownVendor, allLeadGroups]);

  // Comparison breakdown map (group view)
  const cmpBreakdownMap = useMemo(() => {
    if (!isGroup || !cmpRange) return {};
    const rows = selectedBreakdownVendor !== '__total__'
      ? filterByVendor(rawCmpData, selectedBreakdownVendor, allLeadGroups)
      : rawCmpData;

    const map = {};
    activeStores.forEach(s => { map[s.dealership_key] = { leads: 0, sold: 0, gross: 0 }; });
    rows.forEach(r => {
      if (map[r.dealer_id]) {
        map[r.dealer_id].leads += r.total_leads;
        map[r.dealer_id].sold  += r.total_sold;
        map[r.dealer_id].gross += r.total_gross;
      }
    });
    Object.values(map).forEach(r => {
      r.soldPct = r.leads > 0 ? Math.round((r.sold / r.leads) * 100) : 0;
    });
    return map;
  }, [isGroup, rawCmpData, activeStores, selectedBreakdownVendor, allLeadGroups, cmpRange]);

  const vendorBreakdownSorted = useMemo(() => [...vendorBreakdownRows].sort((a, b) => {
    const av = breakdownSortKey === 'soldPct' ? parseFloat(a[breakdownSortKey]) : a[breakdownSortKey];
    const bv = breakdownSortKey === 'soldPct' ? parseFloat(b[breakdownSortKey]) : b[breakdownSortKey];
    if (typeof av === 'string') return breakdownSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return breakdownSortDir === 'asc' ? av - bv : bv - av;
  }), [vendorBreakdownRows, breakdownSortKey, breakdownSortDir]);

  const vendorBreakdownTotals = useMemo(() => vendorBreakdownSorted.reduce(
    (acc, r) => ({ leads: acc.leads + r.leads, sold: acc.sold + r.sold, gross: acc.gross + r.gross }),
    { leads: 0, sold: 0, gross: 0 }
  ), [vendorBreakdownSorted]);

  const handleBreakdownSort = (key) => {
    if (breakdownSortKey === key) setBreakdownSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setBreakdownSortKey(key); setBreakdownSortDir('desc'); }
  };

  const toggleMetric = (key) => setActiveMetrics(prev => ({ ...prev, [key]: !prev[key] }));

  // Compute per-dealership rows for a given vendor source name
  const getDealerRowsForVendor = (sourceName) => {
    const filteredRaw = filterByVendor(rawVendorData, sourceName, allLeadGroups);
    const filteredCmp = cmpRange ? filterByVendor(rawCmpData, sourceName, allLeadGroups) : [];
    const map = {};
    activeStores.forEach(s => { map[s.dealership_key] = { name: s.name, dealer_key: s.dealership_key, leads: 0, apptsSet: 0, sold: 0, gross: 0 }; });
    filteredRaw.forEach(r => {
      if (map[r.dealer_id]) {
        map[r.dealer_id].leads    += r.total_leads;
        map[r.dealer_id].apptsSet += r.total_appts_set;
        map[r.dealer_id].sold     += r.total_sold;
        map[r.dealer_id].gross    += r.total_gross;
      }
    });
    const cmpMap = {};
    activeStores.forEach(s => { cmpMap[s.dealership_key] = { leads: 0, sold: 0 }; });
    filteredCmp.forEach(r => {
      if (cmpMap[r.dealer_id]) {
        cmpMap[r.dealer_id].leads += r.total_leads;
        cmpMap[r.dealer_id].sold  += r.total_sold;
      }
    });
    return Object.values(map)
      .map(r => ({
        ...r,
        soldPct: r.leads > 0 ? Math.round((r.sold / r.leads) * 100) : 0,
        cmp: cmpRange ? { ...cmpMap[r.dealer_key], soldPct: cmpMap[r.dealer_key]?.leads > 0 ? Math.round((cmpMap[r.dealer_key].sold / cmpMap[r.dealer_key].leads) * 100) : 0 } : null,
      }))
      .filter(r => r.leads > 0 || r.sold > 0 || r.apptsSet > 0)
      .sort((a, b) => b.leads - a.leads);
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vendor Performance</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {selectedLabel ? `${selectedLabel} · ` : ''}
          {isGroup ? 'All vendors across stores' : 'Internet Leads ROI breakdown'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Period:</span>
          <select
            value={period === 'custom' || period?.startsWith('custom_') ? 'custom' : period}
            onChange={e => {
              if (e.target.value === 'custom') setPeriod('custom');
              else setPeriod(e.target.value);
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {buildPeriodOptions().map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
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
        {/* Compare toggle — all views */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {COMPARE_OPTIONS.map(c => (
            <button
              key={String(c.value)}
              onClick={() => setCompare(c.value)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${compare === c.value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* New / Used / All inventory toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Inventory:</span>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {INVENTORY_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setInventoryType(o.value)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${inventoryType === o.value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main vendor table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Loading vendor data…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {COLUMNS.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className={`py-3 px-4 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {col.label}
                    <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={5} className="py-8 px-4 text-center text-gray-400 text-sm">No vendor data for this period.</td></tr>
              ) : sorted.map((r, i) => {
                const cmp = compare ? cmpRowMap[r.source] : null;
                const isExpanded = isGroup && expandedVendors.has(r.source);
                const dealerRows = isExpanded ? getDealerRowsForVendor(r.source) : [];
                return (
                  <>
                    <tr
                      key={r.source}
                      onClick={() => isGroup && toggleVendorExpand(r.source)}
                      className={`border-b border-gray-50 ${isGroup ? 'cursor-pointer hover:bg-blue-50/40' : 'hover:bg-gray-50/50'} ${isExpanded ? 'bg-blue-50/30' : (i % 2 === 1 ? 'bg-gray-50/30' : '')}`}
                    >
                      <td className="py-3 px-4 font-medium text-gray-800">
                        <span className="inline-flex items-center gap-2">
                          {isGroup && (
                            isExpanded
                              ? <ChevronDown size={14} className="text-blue-500 flex-shrink-0" />
                              : <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                          )}
                          {r.source}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 tabular-nums text-right">
                        {r.goodLeads}<Delta cur={r.goodLeads} cmp={cmp?.goodLeads ?? null} />
                      </td>
                      <td className="py-3 px-4 text-gray-600 tabular-nums text-right">
                        {r.apptsSet}<Delta cur={r.apptsSet} cmp={cmp?.apptsSet ?? null} />
                      </td>
                      <td className="py-3 px-4 text-gray-900 tabular-nums text-right">
                        {r.sold}<Delta cur={r.sold} cmp={cmp?.sold ?? null} />
                      </td>
                      <td className="py-3 px-4 text-gray-600 tabular-nums text-right">
                        {r.soldPct}%<PctDelta cur={r.soldPct} cmp={cmp?.soldPct ?? null} />
                      </td>
                      <td className={`py-3 px-4 tabular-nums text-right ${r.totalGross < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtGross(r.totalGross)}</td>
                    </tr>
                    {isExpanded && dealerRows.map(d => (
                      <tr key={`${r.source}_${d.dealer_key}`} className="border-b border-blue-50 bg-blue-50/20">
                        <td className="py-2 pl-10 pr-4 text-gray-500 text-xs font-medium">{d.name}</td>
                        <td className="py-2 px-4 text-gray-500 tabular-nums text-right text-xs">
                          {d.leads.toLocaleString()}<Delta cur={d.leads} cmp={d.cmp?.leads ?? null} />
                        </td>
                        <td className="py-2 px-4 text-gray-500 tabular-nums text-right text-xs">{d.apptsSet.toLocaleString()}</td>
                        <td className="py-2 px-4 text-gray-500 tabular-nums text-right text-xs">
                          {d.sold.toLocaleString()}<Delta cur={d.sold} cmp={d.cmp?.sold ?? null} />
                        </td>
                        <td className="py-2 px-4 text-gray-500 tabular-nums text-right text-xs">
                          {d.soldPct}%<PctDelta cur={d.soldPct} cmp={d.cmp?.soldPct ?? null} />
                        </td>
                        <td className={`py-2 px-4 tabular-nums text-right text-xs ${d.gross < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtGross(d.gross)}</td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const cmpTotals = compare && Object.keys(cmpRowMap).length > 0
                  ? Object.values(cmpRowMap).reduce((acc, r) => ({
                      goodLeads: acc.goodLeads + r.goodLeads,
                      apptsSet: acc.apptsSet + r.apptsSet,
                      sold: acc.sold + r.sold,
                      soldPct: 0,
                    }), { goodLeads: 0, apptsSet: 0, sold: 0, soldPct: 0 })
                  : null;
                if (cmpTotals) {
                  cmpTotals.soldPct = cmpTotals.goodLeads > 0
                    ? Math.round((cmpTotals.sold / cmpTotals.goodLeads) * 100) : 0;
                }
                return (
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="py-3 px-4 font-bold text-gray-700 text-xs uppercase tracking-wide">Total</td>
                    <td className="py-3 px-4 font-bold text-gray-900 tabular-nums text-right">
                      {totals.goodLeads}<Delta cur={totals.goodLeads} cmp={cmpTotals?.goodLeads ?? null} />
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 tabular-nums text-right">
                      {totals.apptsSet}<Delta cur={totals.apptsSet} cmp={cmpTotals?.apptsSet ?? null} />
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 tabular-nums text-right">
                      {totals.sold}<Delta cur={totals.sold} cmp={cmpTotals?.sold ?? null} />
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-600 tabular-nums text-right">
                      {totals.soldPct}%<PctDelta cur={totals.soldPct} cmp={cmpTotals?.soldPct ?? null} />
                    </td>
                    <td className={`py-3 px-4 font-bold tabular-nums text-right ${totals.totalGross < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtGross(totals.totalGross)}</td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        )}
      </div>

      {/* Group: bottom card with trend + dealership breakdown */}
      {isGroup && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button onClick={() => setBottomView('trend')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${bottomView === 'trend' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{isYesterday ? 'MTD Daily Trend' : 'Historical Trend'}</button>
              <button onClick={() => setBottomView('breakdown')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${bottomView === 'breakdown' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Dealership Breakdown</button>
            </div>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Vendor:</span>
            <select value={selectedBreakdownVendor} onChange={e => setSelectedBreakdownVendor(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[180px]">
              <option value="__total__">All Vendors (Total)</option>
              {availableVendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            {bottomView === 'trend' && (
              <div className="flex flex-wrap gap-2">
                {CHART_METRICS.map(m => (
                  <button key={m.key} onClick={() => toggleMetric(m.key)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeMetrics[m.key] ? 'text-white border-transparent shadow-sm' : 'text-gray-400 border-gray-200 bg-white hover:border-gray-300'}`}
                    style={activeMetrics[m.key] ? { backgroundColor: m.color, borderColor: m.color } : {}}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeMetrics[m.key] ? 'white' : m.color }} />
                    {m.key}
                  </button>
                ))}
              </div>
            )}
          </div>

          {bottomView === 'trend' && (
            <div className="p-6">
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey={trendXKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      interval={trendXKey === 'date' ? Math.max(1, Math.floor(trendChartData.length / 10)) : 0} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#3b82f6' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#10b981' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} labelStyle={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }} />
                    {CHART_METRICS.filter(m => activeMetrics[m.key]).map(m => (
                      <Line key={m.key} type="linear" dataKey={m.key} stroke={m.color} strokeWidth={2.5} yAxisId={m.yAxis}
                        dot={trendXKey === 'date' ? false : (props) => <CustomDotWithLabel key={props.index} {...props} color={m.color} />}
                        activeDot={{ r: 5 }} name={m.key} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">No vendor data available.</div>
              )}
            </div>
          )}

          {bottomView === 'breakdown' && (
            vendorBreakdownSorted.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No data available.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {[
                      { key: 'name',    label: 'Dealership', align: 'left'  },
                      { key: 'leads',   label: 'Leads',      align: 'right' },
                      { key: 'sold',    label: 'Sold',       align: 'right' },
                      { key: 'soldPct', label: 'Sold %',     align: 'right' },
                      { key: 'gross',   label: 'Total Gross',align: 'right' },
                    ].map(col => (
                      <th key={col.key} onClick={() => handleBreakdownSort(col.key)}
                        className={`py-3 px-4 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                        {col.label}
                        <SortIcon col={col.key} sortKey={breakdownSortKey} sortDir={breakdownSortDir} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorBreakdownSorted.map((r, i) => {
                    const cmp = cmpBreakdownMap[r.dealer_key] ?? null;
                    return (
                      <tr key={r.name} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                        <td className="py-3 px-4 font-medium text-gray-800">{r.name}</td>
                        <td className="py-3 px-4 text-gray-600 tabular-nums text-right">
                          {r.leads.toLocaleString()}<Delta cur={r.leads} cmp={cmp?.leads ?? null} />
                        </td>
                        <td className="py-3 px-4 text-gray-900 tabular-nums text-right">
                          {r.sold.toLocaleString()}<Delta cur={r.sold} cmp={cmp?.sold ?? null} />
                        </td>
                        <td className="py-3 px-4 text-gray-600 tabular-nums text-right">
                          {r.soldPct}%<PctDelta cur={r.soldPct} cmp={cmp?.soldPct ?? null} />
                        </td>
                        <td className={`py-3 px-4 tabular-nums text-right ${r.gross < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtGross(r.gross)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const cmpTotals = Object.values(cmpBreakdownMap).reduce((acc, r) => ({ leads: acc.leads + r.leads, sold: acc.sold + r.sold }), { leads: 0, sold: 0 });
                    const cmpSoldPct = cmpTotals.leads > 0 ? Math.round((cmpTotals.sold / cmpTotals.leads) * 100) : 0;
                    const hasCmp = cmpRange && Object.keys(cmpBreakdownMap).length > 0;
                    const totalSoldPct = vendorBreakdownTotals.leads > 0 ? Math.round((vendorBreakdownTotals.sold / vendorBreakdownTotals.leads) * 100) : 0;
                    return (
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-700 text-xs uppercase tracking-wide">Total</td>
                        <td className="py-3 px-4 font-bold text-gray-900 tabular-nums text-right">
                          {vendorBreakdownTotals.leads.toLocaleString()}<Delta cur={vendorBreakdownTotals.leads} cmp={hasCmp ? cmpTotals.leads : null} />
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900 tabular-nums text-right">
                          {vendorBreakdownTotals.sold.toLocaleString()}<Delta cur={vendorBreakdownTotals.sold} cmp={hasCmp ? cmpTotals.sold : null} />
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-600 tabular-nums text-right">
                          {totalSoldPct}%<PctDelta cur={totalSoldPct} cmp={hasCmp ? cmpSoldPct : null} />
                        </td>
                        <td className={`py-3 px-4 font-bold tabular-nums text-right ${vendorBreakdownTotals.gross < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtGross(vendorBreakdownTotals.gross)}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            )
          )}
        </div>
      )}

      {/* Store: historical trend chart */}
      {!isGroup && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">{isYesterday ? 'MTD Daily Trend' : 'Historical Trend by Vendor'}</p>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider ml-1">Vendor:</span>
            <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
              <option value="__all__">All Vendors</option>
              {availableVendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              {CHART_METRICS.map(m => (
                <button key={m.key} onClick={() => toggleMetric(m.key)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeMetrics[m.key] ? 'text-white border-transparent shadow-sm' : 'text-gray-400 border-gray-200 bg-white hover:border-gray-300'}`}
                  style={activeMetrics[m.key] ? { backgroundColor: m.color, borderColor: m.color } : {}}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeMetrics[m.key] ? 'white' : m.color }} />
                  {m.key}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey={trendXKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  interval={trendXKey === 'date' ? Math.max(1, Math.floor(trendChartData.length / 10)) : 0} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#3b82f6' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#10b981' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} labelStyle={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }} />
                {CHART_METRICS.filter(m => activeMetrics[m.key]).map(m => (
                  <Line key={m.key} type="linear" dataKey={m.key} stroke={m.color} strokeWidth={2.5} yAxisId={m.yAxis}
                    dot={trendXKey === 'date' ? false : (props) => <CustomDotWithLabel key={props.index} {...props} color={m.color} />}
                    activeDot={{ r: 5 }} name={m.key} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}