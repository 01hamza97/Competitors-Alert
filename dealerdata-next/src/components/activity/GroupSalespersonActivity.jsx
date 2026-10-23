import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { useDealer } from '@/lib/DealerContext';
import { sumField } from '@/lib/dealershipUtils';
import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const DATE_RANGES = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
];

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={12} className="ml-1 text-gray-300 inline" />;
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="ml-1 text-blue-500 inline" />
    : <ChevronDown size={12} className="ml-1 text-blue-500 inline" />;
}

export default function GroupSalespersonActivity() {
  const { activeStores } = useDealer();
  const [rangeDays, setRangeDays] = useState(1);
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const { data: allPerf = [] } = useQuery({
    queryKey: ['dailyPerf'],
    queryFn: () => base44.entities.DailyPerformance.list('-date', 1000),
  });

  const dealershipKeys = activeStores.map(s => s.dealership_key).filter(Boolean);
  const filteredData = allPerf.filter(r => dealershipKeys.includes(r.dealership));

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const today = new Date();
  const startDate = subDays(today, rangeDays - 1);
  const days = eachDayOfInterval({ start: startDate, end: subDays(today, 1) });

  const baseRanking = activeStores
    .map(store => {
      const daysData = filteredData.filter(r => {
        const rDate = new Date(r.date);
        return rDate >= startDate && rDate <= subDays(today, 1);
      }).filter(r => r.dealership === store.dealership_key);
      
      const calls = sumField(daysData, 'activity_calls');
      const emails = sumField(daysData, 'activity_emails');
      const texts = sumField(daysData, 'activity_texts');
      const sold = sumField(daysData, 'sold_internet') + sumField(daysData, 'sold_showroom') + sumField(daysData, 'sold_phone');
      
      return {
        name: store.name,
        calls,
        emails,
        texts,
        sold,
        total: calls + emails + texts,
      };
    });

  const ranking = [...baseRanking].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mr-2">Date Range:</p>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {DATE_RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${rangeDays === r.days ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Activity by Dealership — {DATE_RANGES.find(r => r.days === rangeDays)?.label}</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('name')}>Dealership<SortIcon col="name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('calls')}>Calls<SortIcon col="calls" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('emails')}>Emails<SortIcon col="emails" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('texts')}>Texts<SortIcon col="texts" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('total')}>Total<SortIcon col="total" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 cursor-pointer select-none hover:text-gray-600" onClick={() => handleSort('sold')}>Sold<SortIcon col="sold" sortKey={sortKey} sortDir={sortDir} /></th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.name} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-4 py-2 font-medium text-gray-800">{r.name}</td>
                <td className="px-4 py-2 text-gray-600 tabular-nums text-right">{r.calls}</td>
                <td className="px-4 py-2 text-gray-600 tabular-nums text-right">{r.emails}</td>
                <td className="px-4 py-2 text-gray-600 tabular-nums text-right">{r.texts}</td>
                <td className="px-4 py-2 font-bold text-gray-900 tabular-nums text-right">{r.total}</td>
                <td className="px-4 py-2 font-bold text-emerald-600 tabular-nums text-right">{r.sold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}