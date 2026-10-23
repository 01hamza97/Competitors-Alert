import { useDealer } from '@/lib/DealerContext';
import { useLeadPerformanceRange, aggregateLPRows } from '@/lib/useSupabaseData';
import { getPeriodRange } from './PerformanceKPIs';
import { format, startOfMonth } from 'date-fns';

function MTDCard({ store, rows }) {
  const agg = aggregateLPRows(rows);
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-100">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{store.name}</p>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-3xl font-black tabular-nums text-blue-600">{agg.leads.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Leads</p>
        </div>
        <div>
          <p className="text-3xl font-black tabular-nums text-emerald-600">{agg.sold.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Sold</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-gray-600">{agg.soldPct.toFixed ? agg.soldPct : 0}%</p>
          <p className="text-xs text-gray-400 mt-0.5">Close %</p>
        </div>
      </div>
    </div>
  );
}

export default function GroupMTDOverview() {
  const { activeStores, activeDealershipKeys } = useDealer();

  const now = new Date();
  const mtdStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const yesterday = format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), 'yyyy-MM-dd');

  const { data: allRows = [] } = useLeadPerformanceRange(activeDealershipKeys, mtdStart, yesterday);

  const rankings = activeStores
    .map(store => {
      const storeRows = allRows.filter(r => r.dealer_id === store.dealership_key);
      const agg = aggregateLPRows(storeRows);
      return { store, rows: storeRows, leads: agg.leads, sold: agg.sold, close: agg.soldPct };
    })
    .sort((a, b) => b.leads - a.leads);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rankings.map(({ store, rows }) => (
          <MTDCard key={store.id} store={store} rows={rows} />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-lg">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">MTD Performance Ranking</h2>
        </div>
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-full" />
            <col style={{ width: '60px' }} />
            <col style={{ width: '60px' }} />
            <col style={{ width: '72px' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Dealership</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-500">Leads</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">Sold</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Close %</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map(({ store, leads, sold, close }, i) => (
              <tr key={store.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-4 py-2 font-medium text-gray-800">{store.name}</td>
                <td className="px-3 py-2 text-right font-semibold text-blue-600 tabular-nums">{leads.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-600 tabular-nums">{sold.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-600 tabular-nums">{close}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}