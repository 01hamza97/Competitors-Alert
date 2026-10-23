import React, { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';

const OFFER_TYPES = ['Lease', 'APR', 'Discount', 'Other'];
const SOURCES = ['Homepage Slider', 'Specials Page', 'Other'];

const inputClass = "w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";

function emptyRow(defaultDealer) {
  return {
    offer_dealer_name: defaultDealer || '',
    year: '', make: '', model: '', trim: '',
    offer_type: 'Lease', offer_details: '', term: '', down_payment: '',
    image_url: '', apply_to_multiple_models: false, source: 'Specials Page',
  };
}

function ImageThumb({ url }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return <div className="w-[80px] h-[60px] rounded border border-dashed border-gray-300 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 shrink-0">no img</div>;
  }
  return <img src={url} alt="" onError={() => setBroken(true)} className="w-[80px] h-[60px] object-cover rounded border border-gray-200 bg-white shrink-0" />;
}

export default function VehicleSpecialsEditor({ rows, setRows, dealerOptions, selectedDealer, existsForDate, onSave, isSaving, banner }) {
  const update = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow(selectedDealer)]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const isLease = (t) => t === 'Lease';
  const isApr = (t) => t === 'APR';

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

      {rows.length === 0 && <p className="text-xs text-gray-400 py-6 text-center">No specials yet. Click "+ Add Special" below to start.</p>}

      <div className="space-y-3 divide-y divide-gray-100">
        {rows.map((row, i) => {
          const showTerm = isLease(row.offer_type) || isApr(row.offer_type);
          const showDown = isLease(row.offer_type);
          return (
            <div key={i} className="pt-3 first:pt-0">
              <div className="rounded-xl border border-gray-200 bg-[#f9f9f9] p-3 space-y-2.5">
                {/* Row 1: dealer + source + delete */}
                <div className="flex items-center gap-2">
                  <select value={row.offer_dealer_name || ''} onChange={e => update(i, { offer_dealer_name: e.target.value })} className={`${inputClass} max-w-[220px] font-medium`}>
                    {dealerOptions.map(d => (
                      <option key={d.value} value={d.value}>{d.label}{d.isClient ? ' (client)' : ''}</option>
                    ))}
                  </select>
                  <div className="flex-1" />
                  <select value={row.source} onChange={e => update(i, { source: e.target.value })} className={`${inputClass} max-w-[150px]`}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 shrink-0" title="Delete special">
                    <X size={16} />
                  </button>
                </div>

                {/* Row 2: year/make/model/trim */}
                <div className="grid grid-cols-4 gap-2">
                  <input type="number" placeholder="Year" value={row.year} onChange={e => update(i, { year: e.target.value })} className={inputClass} />
                  <input type="text" placeholder="Make" value={row.make} onChange={e => update(i, { make: e.target.value })} className={inputClass} />
                  <input type="text" placeholder="Model" value={row.model} onChange={e => update(i, { model: e.target.value })} className={inputClass} />
                  <input type="text" placeholder="Trim" value={row.trim} onChange={e => update(i, { trim: e.target.value })} className={inputClass} />
                </div>

                {/* Row 3: offer type + amount + (term) + (down) */}
                <div className="grid grid-cols-4 gap-2">
                  <select value={row.offer_type} onChange={e => update(i, { offer_type: e.target.value })} className={inputClass}>
                    {OFFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="text" placeholder={row.offer_type === 'Lease' ? 'Monthly $' : row.offer_type === 'APR' ? 'Rate %' : 'Amount $'} value={row.offer_details} onChange={e => update(i, { offer_details: e.target.value })} className={inputClass} />
                  {showTerm ? (
                    <input type="number" placeholder="Term (mo)" value={row.term} onChange={e => update(i, { term: e.target.value })} className={inputClass} />
                  ) : <div />}
                  {showDown ? (
                    <input type="number" placeholder="Down $" value={row.down_payment} onChange={e => update(i, { down_payment: e.target.value })} className={inputClass} />
                  ) : <div />}
                </div>

                {/* Row 4: image url + thumb + shared checkbox */}
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Image URL" value={row.image_url} onChange={e => update(i, { image_url: e.target.value })} className={`${inputClass} flex-1`} />
                  <ImageThumb url={row.image_url} />
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer select-none whitespace-nowrap">
                    <input type="checkbox" checked={!!row.apply_to_multiple_models} onChange={e => update(i, { apply_to_multiple_models: e.target.checked })} className="rounded" />
                    Shared image
                  </label>
                </div>
                {row.apply_to_multiple_models && (
                  <p className="text-[10px] text-amber-700 flex items-center gap-1"><Check size={10} /> This image will be shared with other rows.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={addRow} className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 border-dashed rounded-lg hover:bg-blue-100">
        <Plus size={15} /> Add Special
      </button>

      <button onClick={onSave} disabled={isSaving} className="w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {isSaving ? 'Saving...' : 'Save Vehicle Specials'}
      </button>
    </div>
  );
}