const YESTERDAY = {
  leads: { total: 40, internet: 28, walkin: 8, phone: 4 },
  sold: { total: 4, internet: 3, walkin: 1, phone: 0 },
};

const SOURCES = ['Internet', 'Walk-In', 'Phone'];

export default function YesterdayKPIs() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Totals hero row */}
      <div className="flex border-b border-gray-200">
        <div className="flex-1 px-5 py-4 border-r border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Total Leads</p>
          <p className="text-5xl font-black tabular-nums text-blue-600 leading-none">{YESTERDAY.leads.total}</p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Total Sold</p>
          <p className="text-5xl font-black tabular-nums text-emerald-600 leading-none">{YESTERDAY.sold.total}</p>
        </div>
      </div>

      {/* Breakdown by source */}
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
            { label: 'Internet', leads: YESTERDAY.leads.internet, sold: YESTERDAY.sold.internet },
            { label: 'Walk-In',  leads: YESTERDAY.leads.walkin,   sold: YESTERDAY.sold.walkin   },
            { label: 'Phone',    leads: YESTERDAY.leads.phone,     sold: YESTERDAY.sold.phone    },
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
  );
}