import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDealer } from '@/lib/DealerContext';
import { sumField } from '@/lib/dealershipUtils';
import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const DATE_RANGES = [
  { label: 'MTD',      index: 'mtd' },
  { label: 'Last 30D', index: '30d' },
];

export default function GroupVendorPerformance() {
  const { activeStores } = useDealer();
  const [rangeIndex, setRangeIndex] = useState('mtd');
  const [sortKey, setSortKey] = useState('sold');
  const [sortDir, setSortDir] = useState('desc');

  const { data: allVendorData = [] } = useQuery({
    queryKey: ['vendorData'],
    queryFn: () => base44.entities.VendorData.list('-date', 1000),
  });

  const dealershipKeys = activeStores.map(s => s.dealership_key).filter(Boolean);
  const filteredData = allVendorData.filter(r => dealershipKeys.includes(r.dealership));

  // Rank dealerships by vendor performance
  const dealershipRankings = activeStores
    .map(store => {
      const storeData = filteredData.filter(r => r.dealership === store.dealership_key);
      const leads = sumField(storeData, 'leads');
      const sold = sumField(storeData, 'sold');
      const closeRate = leads > 0 ? ((sold / leads) * 100).toFixed(1) : 0;
      return {
        name: store.name,
        leads,
        sold,
        closeRate,
      };
    })
    .sort((a, b) => b.sold - a.sold);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  function SortIcon({ col }) {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="ml-1 text-gray-300 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-blue-500 inline" />
      : <ChevronDown size={12} className="ml-1 text-blue-500 inline" />;
  }

  return (
    <div className="space-y-5">
      {/* Date range */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {DATE_RANGES.map(r => (
          <button
            key={r.index}
            onClick={() => setRangeIndex(r.index)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${rangeIndex === r.index ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Dealership rankings */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                onClick={() => handleSort('name')}
                className={`py-3 px-4 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 text-left`}
              >
                Dealership
                <SortIcon col="name" />
              </th>
              <th
                onClick={() => handleSort('leads')}
                className={`py-3 px-4 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 text-right`}
              >
                Leads
                <SortIcon col="leads" />
              </th>
              <th
                onClick={() => handleSort('sold')}
                className={`py-3 px-4 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 text-right`}
              >
                Sold
                <SortIcon col="sold" />
              </th>
              <th
                onClick={() => handleSort('closeRate')}
                className={`py-3 px-4 text-gray-400 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 text-right`}
              >
                Close %
                <SortIcon col="closeRate" />
              </th>
            </tr>
          </thead>
          <tbody>
            {dealershipRankings.map((r, i) => (
              <tr key={r.name} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                <td className="py-3 px-4 font-medium text-gray-800">{r.name}</td>
                <td className="py-3 px-4 text-gray-600 tabular-nums text-right">{r.leads}</td>
                <td className="py-3 px-4 font-bold text-gray-900 tabular-nums text-right">{r.sold}</td>
                <td className="py-3 px-4 font-semibold text-gray-600 tabular-nums text-right">{r.closeRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}