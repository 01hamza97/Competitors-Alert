export default function KPICard({ title, value, sub, delta, className = '' }) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 ${className}`}>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{value ?? '—'}</p>
      {sub && <p className="text-gray-400 text-xs mt-1.5">{sub}</p>}
      {delta !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-sm font-semibold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          <span>{delta >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(delta)} vs LY</span>
        </div>
      )}
    </div>
  );
}