import { useState } from 'react';
import { format, subMonths, subYears, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDealer } from '@/lib/DealerContext';
import { useLeadTrend } from '@/lib/useAggregatedData';
import { getPeriodRange, getCompareRange } from './PerformanceKPIs';

const METRICS = [
  { key: 'total_leads',       label: 'Leads',        color: '#3b82f6' },
  { key: 'total_sold',        label: 'Sold',          color: '#10b981' },
  { key: 'sold_pct',          label: 'Sold %',        color: '#f59e0b' },
  { key: 'total_appts_set',   label: 'Appts Set',     color: '#8b5cf6' },
  { key: 'first_party_leads', label: '1st Party',     color: '#f43f5e' },
];

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}



function CustomDotWithLabel({ cx, cy, value, color }) {
  if (cx == null || cy == null || value == null) return null;
  const label = typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value;
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1.5} />
      <rect x={cx - 10} y={cy - 22} width={20} height={14} rx={4} fill={color} opacity={0.85} />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="white" fontSize={8} fontWeight="600">{label}</text>
    </g>
  );
}

// Build a lookup map from trend data: date → row
function buildDateMap(rows) {
  const map = {};
  (rows || []).forEach(r => { map[r.report_date] = r; });
  return map;
}

export default function MTDTrendChart({ period, compare, selectedDealership }) {
  const [active, setActive] = useState({ total_leads: true, total_sold: true, sold_pct: false, total_appts_set: false, first_party_leads: false });

  const { activeDealershipKeys, selectedType } = useDealer();
  const isGroup = selectedType === 'group';

  const isMTDChart = period === 'mtd';

  const trendKeys = isGroup && selectedDealership
    ? activeDealershipKeys.filter(k => k === selectedDealership)
    : activeDealershipKeys;

  // Call all hooks unconditionally at the top level
  const { start: chartStart, end: chartEnd } = getPeriodRange(period);
  
  // Determine data fetch range based on period
  let trendStart = chartStart;
  let trendEnd = chartEnd;
  let chartDisplayStart = chartStart;
  let chartDisplayEnd = chartEnd;
  let cmpRangeLastMonth = getCompareRange(period, 'lastMonth');
  let cmpRangeLastYear = getCompareRange(period, 'lastYear');
  
  if (isMTDChart) {
    // For MTD: fetch full 12-month range
    const todayPST = new Date().toLocaleDateString('en-ca', { timeZone: 'America/Los_Angeles' });
    const today = new Date(todayPST + 'T12:00:00');
    trendStart = format(startOfMonth(subMonths(today, 11)), 'yyyy-MM-dd');
    trendEnd = chartEnd;
    // Extend comparison ranges to cover 12 months
    cmpRangeLastMonth = {
      start: format(startOfMonth(subMonths(today, 12)), 'yyyy-MM-dd'),
      end: format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
    };
    cmpRangeLastYear = {
      start: format(startOfMonth(subYears(subMonths(today, 11), 1)), 'yyyy-MM-dd'),
      end: format(endOfMonth(subYears(today, 1)), 'yyyy-MM-dd'),
    };
  } else if (period === 'yesterday') {
    // For Yesterday: show full month-to-date through yesterday
    const yesterdayPST = chartEnd; // chartEnd is May 10 (yesterday)
    const monthStartDate = startOfMonth(new Date(yesterdayPST + 'T00:00:00'));
    const mtdStart = format(monthStartDate, 'yyyy-MM-dd');
    trendStart = mtdStart;
    trendEnd = yesterdayPST;
    chartDisplayStart = mtdStart;
    chartDisplayEnd = yesterdayPST;
    
    // For yesterday, calculate comparison ranges based on MTD window from prior month/year
    cmpRangeLastMonth = {
      start: format(subMonths(monthStartDate, 1), 'yyyy-MM-dd'),
      end: format(subMonths(new Date(yesterdayPST + 'T00:00:00'), 1), 'yyyy-MM-dd'),
    };
    cmpRangeLastYear = {
      start: format(subYears(monthStartDate, 1), 'yyyy-MM-dd'),
      end: format(subYears(new Date(yesterdayPST + 'T00:00:00'), 1), 'yyyy-MM-dd'),
    };
  } else {
    // For full month / prior MTD / today / custom: fetch 12 months ending at the selected period
    const endDate = new Date(chartEnd + 'T12:00:00');
    trendStart = format(startOfMonth(subMonths(endDate, 11)), 'yyyy-MM-dd');
    trendEnd = chartEnd;
    cmpRangeLastMonth = {
      start: format(startOfMonth(subMonths(endDate, 12)), 'yyyy-MM-dd'),
      end: format(endOfMonth(subMonths(endDate, 1)), 'yyyy-MM-dd'),
    };
    cmpRangeLastYear = {
      start: format(startOfMonth(subYears(subMonths(endDate, 11), 1)), 'yyyy-MM-dd'),
      end: format(endOfMonth(subYears(endDate, 1)), 'yyyy-MM-dd'),
    };
  }
  
  const { data: curTrend = [], isLoading } = useLeadTrend(trendKeys, trendStart, trendEnd, true);
  const { data: cmpTrendLastMonth = [] } = useLeadTrend(trendKeys, cmpRangeLastMonth?.start, cmpRangeLastMonth?.end, !!cmpRangeLastMonth);
  const { data: cmpTrendLastYear = [] } = useLeadTrend(trendKeys, cmpRangeLastYear?.start, cmpRangeLastYear?.end, !!cmpRangeLastYear);
  // Always fetch 1st party leads so data is ready when toggle is activated
  const { data: firstPartyTrend = [] } = useLeadTrend(trendKeys, trendStart, trendEnd, true, '1st Party');

  const activeMetrics = METRICS.filter(m => active[m.key]);

  if (isMTDChart) {
    // Get today's date in PST
    const todayPST = new Date().toLocaleDateString('en-ca', { timeZone: 'America/Los_Angeles' });
    const today = new Date(todayPST + 'T12:00:00');

    // MTD window end day-of-month, taken from the period's last day (yesterday).
    // Every month on the chart is summed over the same 1st-through-N window, so a
    // prior month is never a full month and the current month is never a full month.
    const mtdDay = new Date(chartEnd + 'T12:00:00').getDate();

    // Generate 12 months back
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), mtdDay);
      if (monthEndDate.getMonth() !== monthDate.getMonth()) {
        monthEndDate.setDate(0);
      }
      const monthEnd = format(monthEndDate, 'yyyy-MM-dd');
      months.push({ monthStart, monthEnd, monthLabel: format(monthDate, 'MMM yyyy') });
    }

    // Build date range strings for MTD
    const curDateStrs = months.map(m => `${m.monthStart}|${m.monthEnd}`);
    const cmpDateStrsLastMonth = months.map((m, idx) => {
      const prevMonthDate = subMonths(new Date(m.monthStart + 'T00:00:00'), 1);
      const prevMonthStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd');
      const prevMonthEndDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), mtdDay);
      if (prevMonthEndDate.getMonth() !== prevMonthDate.getMonth()) {
        prevMonthEndDate.setDate(0);
      }
      return `${prevMonthStart}|${format(prevMonthEndDate, 'yyyy-MM-dd')}`;
    });
    const cmpDateStrsLastYear = months.map(m => {
      const prevYearDate = subYears(new Date(m.monthStart + 'T00:00:00'), 1);
      const prevYearStart = format(startOfMonth(prevYearDate), 'yyyy-MM-dd');
      const prevYearEndDate = new Date(prevYearDate.getFullYear(), prevYearDate.getMonth(), mtdDay);
      if (prevYearEndDate.getMonth() !== prevYearDate.getMonth()) {
        prevYearEndDate.setDate(0);
      }
      return `${prevYearStart}|${format(prevYearEndDate, 'yyyy-MM-dd')}`;
    });

    const firstPartyMap = buildDateMap(firstPartyTrend);

    // Build monthly snapshots from trend data with comparison
    const chartData = curDateStrs.map((dateStr, i) => {
      const [start, end] = dateStr.split('|');
      const monthData = curTrend.filter(d => d.report_date >= start && d.report_date <= end);
      const fpMonthData = firstPartyTrend.filter(d => d.report_date >= start && d.report_date <= end);
      const row = { date: months[i].monthLabel };
      
      METRICS.forEach(metric => {
        if (metric.key === 'first_party_leads') {
          row[metric.key] = fpMonthData.reduce((sum, d) => sum + (d.total_leads ?? 0), 0);
          return;
        }
        row[metric.key] = monthData.reduce((sum, d) => sum + (d[metric.key] ?? 0), 0);
        
        if (compare === 'lastMonth') {
          const [cStart, cEnd] = cmpDateStrsLastMonth[i].split('|');
          const cmpDataLM = cmpTrendLastMonth.filter(d => d.report_date >= cStart && d.report_date <= cEnd);
          row[`${metric.key}_lm`] = cmpDataLM.reduce((sum, d) => sum + (d[metric.key] ?? 0), 0);
        } else if (compare === 'lastYear') {
          const [cStart, cEnd] = cmpDateStrsLastYear[i].split('|');
          const cmpDataLY = cmpTrendLastYear.filter(d => d.report_date >= cStart && d.report_date <= cEnd);
          row[`${metric.key}_ly`] = cmpDataLY.reduce((sum, d) => sum + (d[metric.key] ?? 0), 0);
        }
      });
      return row;
    });

    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">MTD Trend (Monthly Snapshots)</p>
          <p className="text-xs text-gray-400 mt-1">
            Each point is month-to-date (the 1st through the {ordinal(mtdDay)}){compare ? `, compared with the same window in the prior ${compare === 'lastYear' ? 'year' : 'month'}` : ''}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setActive(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                active[m.key] ? 'text-white border-transparent shadow-sm' : 'text-gray-400 border-gray-200 bg-white hover:border-gray-300'
              }`}
              style={active[m.key] ? { backgroundColor: m.color, borderColor: m.color } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active[m.key] ? 'white' : m.color }} />
              {m.label}
            </button>
          ))}
        </div>

        {compare && (
          <div className="flex items-center gap-5 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 rounded-full bg-gray-400" />
              <span className="text-xs text-gray-500 font-medium">This Period</span>
            </div>
            {compare === 'lastMonth' && (
              <div className="flex items-center gap-2">
                <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#d1d5db" strokeWidth="2" strokeDasharray="4,2" /></svg>
                <span className="text-xs text-gray-500 font-medium">Last Month (MTD)</span>
              </div>
            )}
            {compare === 'lastYear' && (
              <div className="flex items-center gap-2">
                <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#d1d5db" strokeWidth="2" strokeDasharray="2,2" /></svg>
                <span className="text-xs text-gray-500 font-medium">Last Year (MTD)</span>
              </div>
            )}
          </div>
        )}

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No data for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 40, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              {activeMetrics.map(m => (
                <YAxis key={`y-${m.key}`} yAxisId={m.key} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
              ))}
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                labelStyle={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }} />
              {activeMetrics.map(m => (
                <Line key={m.key} type="linear" dataKey={m.key} yAxisId={m.key} stroke={m.color} strokeWidth={2.5}
                  dot={(props) => <CustomDotWithLabel key={props.index} {...props} color={m.color} />}
                  activeDot={{ r: 5 }} name={m.label} />
              ))}
              {compare === 'lastMonth' && activeMetrics.filter(m => m.key !== 'first_party_leads').map(m => (
                <Line key={`${m.key}_lm`} type="linear" dataKey={`${m.key}_lm`} yAxisId={m.key} stroke={m.color}
                  strokeWidth={1.5} strokeDasharray="4 2" dot={false} activeDot={{ r: 4 }}
                  name={`${m.label} (Last Month MTD)`} opacity={0.5} />
              ))}
              {compare === 'lastYear' && activeMetrics.filter(m => m.key !== 'first_party_leads').map(m => (
                <Line key={`${m.key}_ly`} type="linear" dataKey={`${m.key}_ly`} yAxisId={m.key} stroke={m.color}
                  strokeWidth={1.5} strokeDasharray="2 2" dot={false} activeDot={{ r: 4 }}
                  name={`${m.label} (Last Year MTD)`} opacity={0.35} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }

  // DAILY CHART (period === 'yesterday')
  // Build date range for chart display (not the KPI range)
  const curMap = buildDateMap(curTrend);
  const cmpMapLastMonth = buildDateMap(cmpTrendLastMonth);
  const cmpMapLastYear = buildDateMap(cmpTrendLastYear);

  // For yesterday period: compare same dates from prior month or prior year
  // For MTD period: compare monthly MTD snapshots from prior month or prior year
  const isYesterdayPeriod = period === 'yesterday';
  
  let currentDateStrs = [];
  let compareDateStrsLastMonth = [];
  let compareDateStrsLastYear = [];

  if (isYesterdayPeriod) {
    // Yesterday: 7-day window
    const cursor = new Date(chartDisplayStart + 'T00:00:00');
    const endDate = new Date(chartDisplayEnd + 'T00:00:00');
    while (cursor <= endDate) {
      currentDateStrs.push(format(cursor, 'yyyy-MM-dd'));
      cursor.setDate(cursor.getDate() + 1);
    }
    // For last month: same calendar dates from prior month
    compareDateStrsLastMonth = currentDateStrs.map(d => {
      const date = new Date(d + 'T00:00:00');
      return format(subMonths(date, 1), 'yyyy-MM-dd');
    });
    // For last year: same calendar dates from prior year
    compareDateStrsLastYear = currentDateStrs.map(d => {
      const date = new Date(d + 'T00:00:00');
      return format(subYears(date, 1), 'yyyy-MM-dd');
    });
  } else {
    // Monthly snapshots: 12 months ending at the selected period's month
    const isFullMonth = period?.startsWith('month_');
    const anchorDate = new Date(chartEnd + 'T12:00:00');
    const currentDayOfMonth = anchorDate.getDate();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(anchorDate, i);
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      let monthEnd;
      if (isFullMonth) {
        monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
      } else {
        const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), currentDayOfMonth - 1);
        if (monthEndDate.getMonth() !== monthDate.getMonth()) {
          monthEndDate.setDate(0);
        }
        monthEnd = format(monthEndDate, 'yyyy-MM-dd');
      }
      months.push({ monthStart, monthEnd, monthLabel: format(monthDate, 'MMM yyyy') });
    }
    currentDateStrs = months.map(m => `${m.monthStart}|${m.monthEnd}`);
    // For last month: same position months but shifted back 1 month
    compareDateStrsLastMonth = months.map((m) => {
      const prevMonthDate = subMonths(new Date(m.monthStart + 'T00:00:00'), 1);
      const prevMonthStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd');
      let prevMonthEnd;
      if (isFullMonth) {
        prevMonthEnd = format(endOfMonth(prevMonthDate), 'yyyy-MM-dd');
      } else {
        const prevMonthEndDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), currentDayOfMonth - 1);
        if (prevMonthEndDate.getMonth() !== prevMonthDate.getMonth()) {
          prevMonthEndDate.setDate(0);
        }
        prevMonthEnd = format(prevMonthEndDate, 'yyyy-MM-dd');
      }
      return `${prevMonthStart}|${prevMonthEnd}`;
    });
    // For last year: same months but from prior year
    compareDateStrsLastYear = months.map(m => {
      const prevYearDate = subYears(new Date(m.monthStart + 'T00:00:00'), 1);
      const prevYearStart = format(startOfMonth(prevYearDate), 'yyyy-MM-dd');
      let prevYearEnd;
      if (isFullMonth) {
        prevYearEnd = format(endOfMonth(prevYearDate), 'yyyy-MM-dd');
      } else {
        const prevYearEndDate = new Date(prevYearDate.getFullYear(), prevYearDate.getMonth(), currentDayOfMonth - 1);
        if (prevYearEndDate.getMonth() !== prevYearDate.getMonth()) {
          prevYearEndDate.setDate(0);
        }
        prevYearEnd = format(prevYearEndDate, 'yyyy-MM-dd');
      }
      return `${prevYearStart}|${prevYearEnd}`;
    });
  }

  const firstPartyMapDaily = buildDateMap(firstPartyTrend);

  const chartData = isYesterdayPeriod
    ? currentDateStrs.map((dateStr, i) => {
        const cur = curMap[dateStr];
        const fp = firstPartyMapDaily[dateStr];
        const row = { date: format(new Date(dateStr + 'T00:00:00'), 'MMM d') };
        METRICS.forEach(m => {
          if (m.key === 'first_party_leads') {
            row[m.key] = fp?.total_leads ?? 0;
            return;
          }
          row[m.key] = cur?.[m.key] ?? 0;
          row[`${m.key}_lm`] = cmpMapLastMonth[compareDateStrsLastMonth[i]]?.[m.key] ?? 0;
          row[`${m.key}_ly`] = cmpMapLastYear[compareDateStrsLastYear[i]]?.[m.key] ?? 0;
        });
        return row;
      })
    : currentDateStrs.map((dateStr, i) => {
        const [start, end] = dateStr.split('|');
        const monthData = curTrend.filter(d => d.report_date >= start && d.report_date <= end);
        const fpMonthData = firstPartyTrend.filter(d => d.report_date >= start && d.report_date <= end);
        const cmpDataLM = cmpTrendLastMonth.filter(d => {
          const [cStart, cEnd] = compareDateStrsLastMonth[i].split('|');
          return d.report_date >= cStart && d.report_date <= cEnd;
        });
        const cmpDataLY = cmpTrendLastYear.filter(d => {
          const [cStart, cEnd] = compareDateStrsLastYear[i].split('|');
          return d.report_date >= cStart && d.report_date <= cEnd;
        });
        const row = { date: format(new Date(start + 'T12:00:00'), 'MMM yyyy') };
        METRICS.forEach(metric => {
          if (metric.key === 'first_party_leads') {
            row[metric.key] = fpMonthData.reduce((sum, d) => sum + (d.total_leads ?? 0), 0);
            return;
          }
          row[metric.key] = monthData.reduce((sum, d) => sum + (d[metric.key] ?? 0), 0);
          row[`${metric.key}_lm`] = cmpDataLM.reduce((sum, d) => sum + (d[metric.key] ?? 0), 0);
          row[`${metric.key}_ly`] = cmpDataLY.reduce((sum, d) => sum + (d[metric.key] ?? 0), 0);
        });
        return row;
      });

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">Trend Chart</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setActive(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              active[m.key] ? 'text-white border-transparent shadow-sm' : 'text-gray-400 border-gray-200 bg-white hover:border-gray-300'
            }`}
            style={active[m.key] ? { backgroundColor: m.color, borderColor: m.color } : {}}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active[m.key] ? 'white' : m.color }} />
            {m.label}
          </button>
        ))}
      </div>

      {compare && !isMTDChart && (
        <div className="flex items-center gap-5 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 rounded-full bg-gray-400" />
            <span className="text-xs text-gray-500 font-medium">This Period</span>
          </div>
          {compare === 'lastMonth' && (
            <div className="flex items-center gap-2">
              <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#d1d5db" strokeWidth="2" strokeDasharray="4,2" /></svg>
              <span className="text-xs text-gray-500 font-medium">Last Month</span>
            </div>
          )}
          {compare === 'lastYear' && (
            <div className="flex items-center gap-2">
              <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#d1d5db" strokeWidth="2" strokeDasharray="2,2" /></svg>
              <span className="text-xs text-gray-500 font-medium">Last Year</span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
       <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
      ) : chartData.length === 0 ? (
       <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No data for this period.</div>
      ) : (
       <ResponsiveContainer width="100%" height={300}>
         <LineChart data={chartData} margin={{ top: 20, right: 40, left: -10, bottom: 0 }}>
           <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
           <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
             interval={Math.max(1, Math.floor(chartData.length / 10))} />
           {activeMetrics.map(m => (
             <YAxis key={`y-${m.key}`} yAxisId={m.key} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
           ))}
           <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
             labelStyle={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }} />
           {activeMetrics.map(m => (
             <Line key={m.key} type="linear" dataKey={m.key} yAxisId={m.key} stroke={m.color} strokeWidth={2.5}
               dot={(props) => <CustomDotWithLabel key={props.index} {...props} color={m.color} />}
               activeDot={{ r: 5 }} name={m.label} />
           ))}
           {compare === 'lastMonth' && activeMetrics.filter(m => m.key !== 'first_party_leads').map(m => (
              <Line key={`${m.key}_lm`} type="linear" dataKey={`${m.key}_lm`} yAxisId={m.key} stroke={m.color}
                strokeWidth={1.5} strokeDasharray="4 2" dot={false} activeDot={{ r: 4 }}
                name={`${m.label} (Last Month)`} opacity={0.5} />
            ))}
            {compare === 'lastYear' && activeMetrics.filter(m => m.key !== 'first_party_leads').map(m => (
              <Line key={`${m.key}_ly`} type="linear" dataKey={`${m.key}_ly`} yAxisId={m.key} stroke={m.color}
                strokeWidth={1.5} strokeDasharray="2 2" dot={false} activeDot={{ r: 4 }}
                name={`${m.label} (Last Year)`} opacity={0.35} />
            ))}
         </LineChart>
       </ResponsiveContainer>
      )}
    </div>
  );
}