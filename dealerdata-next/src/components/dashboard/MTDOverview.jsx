// Aaron Chevrolet MTD May 2026: 320+92+46=458 leads, 33+14+6=53 sold
// vs April 2026: 690+199+100=989 leads, 71+31+14=116 sold (partial month so lower)
// vs May 2025: 680+195+98=973 leads, 68+30+13=111 sold
const MTD = {
  leads: { value: 458, vsLastMonth: -53.7, vsLastMonthActual: -531, vsLastYear: -52.9, vsLastYearActual: -515 },
  sold:  { value: 53,  vsLastMonth: -54.3, vsLastMonthActual: -63,  vsLastYear: -52.3, vsLastYearActual: -58  },
};

function PctBadge({ pct, actual, label }) {
  const pos = pct >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${pos ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
        {pos ? '+' : ''}{Number(actual).toLocaleString()}
      </span>
      <span className={`text-xs font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
        {pos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
      </span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

function MTDCard({ title, data, accentColor }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      <p className={`text-5xl font-black tabular-nums mb-4 ${accentColor}`}>{data.value.toLocaleString()}</p>
      <div className="space-y-2">
        <PctBadge pct={data.vsLastMonth} actual={data.vsLastMonthActual} label="vs last month" />
        <PctBadge pct={data.vsLastYear} actual={data.vsLastYearActual} label="vs last year" />
      </div>
    </div>
  );
}

export default function MTDOverview() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <MTDCard title="MTD Leads" data={MTD.leads} accentColor="text-blue-600" />
      <MTDCard title="MTD Sold" data={MTD.sold} accentColor="text-emerald-600" />
    </div>
  );
}