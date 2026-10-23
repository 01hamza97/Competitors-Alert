const OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'internet', label: 'Internet' },
  { key: 'phone', label: 'Phone' },
  { key: 'walkin', label: 'Walk In' },
];

export default function UpTypeFilter({ value, onChange }) {
  return (
    <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
      {OPTIONS.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${value === o.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}