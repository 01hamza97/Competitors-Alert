import { useState } from 'react';
import { format, subMonths } from 'date-fns';

function todayPST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // yyyy-MM-dd
}

// Period options: today, yesterday, MTD, prior full months, custom
export function buildPeriodOptions() {
  const now = new Date(todayPST() + 'T12:00:00');
  const options = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'mtd', label: `MTD (${format(now, 'MMM yyyy')})` },
  ];
  for (let i = 1; i <= 6; i++) {
    const d = subMonths(now, i);
    options.push({ value: `month_${i}`, label: format(d, 'MMM yyyy') });
    options.push({ value: `mtd_${i}`, label: `${format(d, 'MMM yyyy')} MTD` });
  }
  options.push({ value: 'custom', label: 'Custom Range…' });
  return options;
}

// Parse a custom period string "custom_YYYY-MM-DD_YYYY-MM-DD" → { start, end }
export function parseCustomPeriod(period) {
  if (!period?.startsWith('custom_')) return null;
  const parts = period.split('_');
  // format: custom_YYYY-MM-DD_YYYY-MM-DD → parts[1..3] and [4..6]
  return { start: parts[1], end: parts[2] };
}

export const COMPARE_OPTIONS = [
  { value: null, label: 'No Compare' },
  { value: 'lastMonth', label: 'vs Last Month' },
  { value: 'lastYear', label: 'vs Last Year' },
];

export default function PerformanceControls({ period, onPeriodChange, compare, onCompareChange, dealership, onDealershipChange, stores, isGroup }) {
  const periodOptions = buildPeriodOptions();
  const todayStr = todayPST();

  const isCustom = period === 'custom' || period?.startsWith('custom_');
  const parsed = parseCustomPeriod(period);

  const [customStart, setCustomStart] = useState(parsed?.start || todayStr);
  const [customEnd, setCustomEnd] = useState(parsed?.end || todayStr);

  const handleSelectChange = (val) => {
    if (val === 'custom') {
      // Stay in "custom" mode — show pickers but don't fire until both dates chosen
      onPeriodChange('custom');
    } else {
      onPeriodChange(val);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onPeriodChange(`custom_${customStart}_${customEnd}`);
    }
  };

  // The value shown in the <select>
  const selectValue = isCustom ? 'custom' : period;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Period:</span>
        <select
          value={selectValue}
          onChange={e => handleSelectChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {periodOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Custom date pickers */}
      {isCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            max={customEnd || todayStr}
            onChange={e => setCustomStart(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            max={todayStr}
            onChange={e => setCustomEnd(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleCustomApply}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {/* Compare selector */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {COMPARE_OPTIONS.map(c => (
          <button
            key={String(c.value)}
            onClick={() => onCompareChange(c.value)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${compare === c.value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Dealership selector (group view) */}
      {isGroup && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Store:</span>
          <select
            value={dealership || 'all'}
            onChange={e => onDealershipChange(e.target.value === 'all' ? null : e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Stores</option>
            {stores.map(s => (
              <option key={s.dealership_key} value={s.dealership_key}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}