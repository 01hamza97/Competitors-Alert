import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

const SENTINEL = '__latest_per_dealer__';

export default function SnapshotDatePicker({ dates, datesMeta, selected, onChange, perDealerDates }) {
  if (!dates || dates.length === 0) return null;

  // Build a map of date → competitor list for option labels
  const metaByDate = {};
  (datesMeta || []).forEach(m => { metaByDate[m.date] = m.competitors || []; });

  const latestLabel = 'Latest available';

  // selected=null means default/per-dealer mode; any real date string = manual override
  const selectValue = selected || SENTINEL;

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val === SENTINEL ? null : val);
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar size={13} className="text-gray-400" />
      <select
        value={selectValue}
        onChange={handleChange}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none max-w-sm"
      >
        <option value={SENTINEL}>{latestLabel}</option>
        {dates.map(d => {
          const label = format(new Date(d + 'T12:00:00'), 'MMM d, yyyy');
          return (
            <option key={d} value={d}>
              {label}
            </option>
          );
        })}
      </select>
    </div>
  );
}