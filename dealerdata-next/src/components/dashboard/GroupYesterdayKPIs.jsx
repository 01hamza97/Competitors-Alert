import { format, subDays } from 'date-fns';
import { useDealer } from '@/lib/DealerContext';
import { useLeadPerformanceRange, aggregateLPRows } from '@/lib/useSupabaseData';

export default function GroupYesterdayKPIs() {
  const { activeStores, activeDealershipKeys } = useDealer();
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const { data: allRows = [] } = useLeadPerformanceRange(activeDealershipKeys, yesterdayStr, yesterdayStr);

  const agg = aggregateLPRows(allRows);

  const dealershipRows = activeStores.map(store => {
    const storeRows = allRows.filter(r => r.dealer_id === store.dealership_key);
    const storeAgg = aggregateLPRows(storeRows);
    return { name: store.name, leads: storeAgg.leads, sold: storeAgg.sold };
  }).sort((a, b) => b.leads - a.leads);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-lg">
        <div className="flex border-b border-gray-200">
          <div className="flex-1 px-5 py-4 border-r border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Total Leads</p>
            <p className="text-5xl font-black tabular-nums text-blue-600 leading-none">{agg.leads}</p>
          </div>
          <div className="flex-1 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Total Sold</p>
            <p className="text-5xl font-black tabular-nums text-emerald-600 leading-none">{agg.sold}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <colgroup>
            <col className="w-full" />
            <col style={{ width: '60px' }} />
            <col style={{ width: '60px' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Up Type</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-500">Leads</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">Sold</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Internet', leads: agg.internet.leads, sold: agg.internet.sold },
              { label: 'Walk-In',  leads: agg.walkin.leads,   sold: agg.walkin.sold },
              { label: 'Phone',    leads: agg.phone.leads,     sold: agg.phone.sold },
            ].map((row, i) => (
              <tr key={row.label} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-4 py-2 font-medium text-gray-600">{row.label}</td>
                <td className="px-3 py-2 text-right font-semibold text-blue-600 tabular-nums">{row.leads}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-600 tabular-nums">{row.sold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-lg">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Dealership Ranking — Yesterday</h2>
        </div>
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-full" />
            <col style={{ width: '60px' }} />
            <col style={{ width: '60px' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Dealership</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-500">Leads</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">Sold</th>
            </tr>
          </thead>
          <tbody>
            {dealershipRows.map((row, i) => (
              <tr key={row.name} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-4 py-2 font-medium text-gray-800">{row.name}</td>
                <td className="px-3 py-2 text-right font-semibold text-blue-600 tabular-nums">{row.leads}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-600 tabular-nums">{row.sold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}