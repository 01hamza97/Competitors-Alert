import React, { useState } from 'react';
import { Plus, Check, CheckCheck, X } from 'lucide-react';

const SERVICE_TYPES = ['Oil Change', 'Tires', 'Alignment', 'Brakes', 'Battery', 'A/C', 'Engine', 'Wipers', 'Package', 'General', 'Diagnostic', 'Other'];

const cellInput = "w-full px-1.5 py-1 text-[11px] border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";

function emptyRow(defaultDealer) {
  return { offer_dealer_name: defaultDealer || '', service_type: 'Oil Change', offer_title: '', price: '', offer_details: '' };
}

function confBadge(conf) {
  const c = (conf || '').toLowerCase();
  if (c === 'high') return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">High</span>;
  if (c === 'medium') return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Med</span>;
  if (c === 'low') return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200">Low</span>;
  return null;
}

// Expandable details cell — truncates, click to expand inline.
function DetailsCell({ value, onChange }) {
  const [expanded, setExpanded] = useState(false);
  if (expanded) {
    return <textarea autoFocus value={value || ''} onChange={e => onChange(e.target.value)} onBlur={() => setExpanded(false)} rows={3} className={`${cellInput} resize-none`} />;
  }
  return (
    <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} onFocus={() => setExpanded(true)} className={cellInput} placeholder="Details…" />
  );
}

export default function ServiceSpecialsTable({
  rows, setRows, selectedDealer, onSave, isSaving, banner,
  mode, onApprove, onReject, busyIds, fadeIds,
}) {
  const update = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow(selectedDealer)]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const totalPending = mode === 'ai' ? rows.filter(r => (r.status === 'pending') && !fadeIds?.has(r.id)).length : 0;
  const approveAll = async () => {
    const pending = rows.filter(r => (r.status === 'pending') && !fadeIds?.has(r.id));
    for (const row of pending) {
      try { await onApprove?.(row, null); } catch (e) { /* continue */ }
    }
  };

  return (
    <div className="space-y-2">
      {banner && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-3 py-1.5 rounded-md font-medium">
          {banner}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-2 py-2 w-[120px]">Type</th>
              <th className="px-2 py-2 w-[200px]">Offer Title</th>
              <th className="px-2 py-2 w-[100px]">Price</th>
              <th className="px-2 py-2 w-[220px]">Details</th>
              <th className="px-2 py-2 w-[120px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-8 text-center text-[11px] text-gray-400">No service specials yet. Click "+ Add Row" below to start.</td></tr>
            )}
            {rows.map((row, i) => {
              const fading = fadeIds?.has(row.id);
              const rowBg = fading ? (row._rejected ? 'bg-red-50' : 'bg-emerald-50') : 'bg-white';
              return (
                <tr key={row.id || i} className={rowBg}>
                  <td className="px-1 py-1">
                    <select value={row.service_type || 'Oil Change'} onChange={e => update(i, { service_type: e.target.value })} className={cellInput}>
                      {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input type="text" value={row.offer_title || ''} onChange={e => update(i, { offer_title: e.target.value })} className={`${cellInput} font-medium`} /></td>
                  <td className="px-1 py-1"><input type="text" value={row.price || ''} onChange={e => update(i, { price: e.target.value })} className={cellInput} placeholder="$99.95" /></td>
                  <td className="px-1 py-1"><DetailsCell value={row.offer_details} onChange={v => update(i, { offer_details: v })} /></td>
                  <td className="px-1 py-1">
                    <div className="flex items-center justify-center gap-1">
                      {mode === 'ai' && row.ai_confidence && confBadge(row.ai_confidence)}
                      {mode === 'ai' ? (
                        <>
                          <button onClick={() => onApprove?.(row, null)} disabled={busyIds?.has(row.id) || fading}
                            className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40" title="Approve">
                            <Check size={11} /> Approve
                          </button>
                          <button onClick={() => onReject?.(row)} disabled={busyIds?.has(row.id) || fading}
                            className="inline-flex items-center justify-center w-6 h-6 rounded text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40" title="Reject">
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => removeRow(i)} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete row">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        {mode !== 'ai' && (
          <button onClick={addRow} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 border-dashed rounded-lg hover:bg-blue-100">
            <Plus size={14} /> Add Row
          </button>
        )}
        {mode === 'ai' && (
          <button onClick={approveAll} disabled={!totalPending}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40">
            <CheckCheck size={14} /> Approve All ({totalPending})
          </button>
        )}
        {mode !== 'ai' && (
          <button onClick={onSave} disabled={isSaving}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 ml-auto">
            {isSaving ? 'Saving...' : <><Check size={14} /> Save All</>}
          </button>
        )}
      </div>
    </div>
  );
}