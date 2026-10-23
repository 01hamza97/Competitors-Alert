import React from 'react';
import { X, Plus } from 'lucide-react';

const SERVICE_TYPES = ['Oil Change', 'Tires', 'Alignment', 'Brakes', 'Battery', 'A/C', 'Package', 'General', 'Diagnostic', 'Other'];

const inputClass = "w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";

function emptyRow(defaultDealer) {
  return { offer_dealer_name: defaultDealer || '', service_type: 'Oil Change', offer_title: '', price: '', offer_details: '' };
}

export default function ServiceSpecialsEditor({ rows, setRows, dealerOptions, selectedDealer, existsForDate, onSave, isSaving, banner }) {
  const update = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow(selectedDealer)]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {banner && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded-md font-medium">
          {banner}
        </div>
      )}
      {existsForDate && !banner && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-md">
          Data already exists for this date — saving will overwrite it.
        </div>
      )}

      {rows.length === 0 && <p className="text-xs text-gray-400 py-6 text-center">No service specials yet. Click "+ Add Service Special" below to start.</p>}

      <div className="space-y-3 divide-y divide-gray-100">
        {rows.map((row, i) => (
          <div key={i} className="pt-3 first:pt-0">
            <div className="rounded-xl border border-gray-200 bg-[#f9f9f9] p-3 space-y-2.5">
              {/* Row 1: dealer + type + delete */}
              <div className="flex items-center gap-2">
                <select value={row.offer_dealer_name || ''} onChange={e => update(i, { offer_dealer_name: e.target.value })} className={`${inputClass} max-w-[220px] font-medium`}>
                  {dealerOptions.map(d => (
                    <option key={d.value} value={d.value}>{d.label}{d.isClient ? ' (client)' : ''}</option>
                  ))}
                </select>
                <div className="flex-1" />
                <select value={row.service_type} onChange={e => update(i, { service_type: e.target.value })} className={`${inputClass} max-w-[150px]`}>
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 shrink-0" title="Delete special">
                  <X size={16} />
                </button>
              </div>

              {/* Row 2: offer title */}
              <input type="text" placeholder="Offer Title" value={row.offer_title} onChange={e => update(i, { offer_title: e.target.value })} className={`${inputClass} font-medium`} />

              {/* Row 3: price */}
              <input type="text" placeholder="Price (e.g. $99.95, Free, 20% Off)" value={row.price} onChange={e => update(i, { price: e.target.value })} className={`${inputClass} max-w-[280px]`} />

              {/* Row 4: details */}
              <textarea placeholder="Offer Details" rows={3} value={row.offer_details} onChange={e => update(i, { offer_details: e.target.value })} className={`${inputClass} resize-none`} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={addRow} className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 border-dashed rounded-lg hover:bg-blue-100">
        <Plus size={15} /> Add Service Special
      </button>

      <button onClick={onSave} disabled={isSaving} className="w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {isSaving ? 'Saving...' : 'Save Service Specials'}
      </button>
    </div>
  );
}