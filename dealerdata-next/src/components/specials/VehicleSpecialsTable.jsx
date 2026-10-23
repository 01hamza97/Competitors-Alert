import React from 'react';
import { Plus, Check, CheckCheck, X, RotateCcw } from 'lucide-react';
import ImagePopover from './ImagePopover';

const OFFER_TYPES = ['Lease', 'APR', 'Discount', 'Other'];
const SOURCES = ['Homepage', 'Specials Page'];

const cellInput = "w-full px-1.5 py-1 text-[11px] border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";

function emptyRow(defaultDealer) {
  return {
    offer_dealer_name: defaultDealer || '',
    year: '', make: '', model: '', trim: '',
    offer_type: 'Lease', offer_details: '', term: '', down_payment: '',
    image_url: '', source: 'Specials Page',
  };
}

function confBadge(conf) {
  const c = (conf || '').toLowerCase();
  if (c === 'high') return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">High</span>;
  if (c === 'medium') return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Med</span>;
  if (c === 'low') return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200">Low</span>;
  return null;
}

// mode: 'manual' | 'ai'
// In 'ai' mode, rows are staging records; onApprove(row, edits), onReject(row) fire
// and rows get colored green (approved) / red (rejected) then fade.
// In 'manual' mode, rows are editable; onSave fires with all rows.
export default function VehicleSpecialsTable({
  rows, setRows, selectedDealer, onSave, isSaving, banner,
  mode, onApprove, onReject, onResetOverride, busyIds, fadeIds,
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
      {/* Pre-loaded banner */}
      {banner && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-3 py-1.5 rounded-md font-medium">
          {banner}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-2 py-2 w-[60px]">Year</th>
              <th className="px-2 py-2 w-[80px]">Make</th>
              <th className="px-2 py-2 w-[120px]">Model</th>
              <th className="px-2 py-2 w-[120px]">Trim</th>
              <th className="px-2 py-2 w-[80px]">Type</th>
              <th className="px-2 py-2 w-[80px]">Amount</th>
              <th className="px-2 py-2 w-[50px]">Term</th>
              <th className="px-2 py-2 w-[70px]">Down</th>
              <th className="px-2 py-2 w-[50px] text-center">Img</th>
              <th className="px-2 py-2 w-[100px]">Source</th>
              <th className="px-2 py-2 w-[120px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={11} className="px-2 py-8 text-center text-[11px] text-gray-400">No specials yet. Click "+ Add Row" below to start.</td></tr>
            )}
            {rows.map((row, i) => {
              const rowType = row.offer_type || row.special_type || 'Lease';
              const normalizedType = OFFER_TYPES.find(t => t.toLowerCase() === String(rowType).toLowerCase()) ||
                (String(rowType).toLowerCase() === 'cash' ? 'Discount' : (String(rowType).toLowerCase() === 'finance' ? 'APR' : 'Other'));
              const isLease = normalizedType === 'Lease';
              const isApr = normalizedType === 'APR';
              const showTerm = isLease || isApr || !!row.term || !!row.term_months;
              const showDown = isLease || (row.down_payment !== '' && row.down_payment !== null && row.down_payment !== undefined);
              const fading = fadeIds?.has(row.id);
              const rowBg = fading
                ? (row._rejected ? 'bg-red-50' : 'bg-emerald-50')
                : 'bg-white';
              const amountPh = isLease ? 'Monthly $' : isApr ? 'Rate %' : 'Amount $';
              return (
                <tr key={row.id || i} className={rowBg}>
                  <td className="px-1 py-1"><input type="number" value={row.year || ''} onChange={e => update(i, { year: e.target.value })} className={cellInput} placeholder="—" /></td>
                  <td className="px-1 py-1"><input type="text" value={row.make || ''} onChange={e => update(i, { make: e.target.value })} className={cellInput} /></td>
                  <td className="px-1 py-1"><input type="text" value={row.model || ''} onChange={e => update(i, { model: e.target.value })} className={cellInput} /></td>
                  <td className="px-1 py-1"><input type="text" value={row.trim || ''} onChange={e => update(i, { trim: e.target.value })} className={cellInput} /></td>
                  <td className="px-1 py-1">
                    <select value={normalizedType} onChange={e => update(i, { offer_type: e.target.value })} className={cellInput}>
                      {OFFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input type="text" value={row.offer_details || (row.monthly_payment ? `$${row.monthly_payment}` : '')} onChange={e => update(i, { offer_details: e.target.value })} className={cellInput} placeholder={amountPh} /></td>
                  <td className="px-1 py-1">{showTerm ? <input type="number" value={row.term ?? row.term_months ?? ''} onChange={e => update(i, { term: e.target.value })} className={cellInput} placeholder="mo" /> : <span className="text-gray-300 text-center block">—</span>}</td>
                  <td className="px-1 py-1">{showDown ? <input type="number" value={row.down_payment ?? ''} onChange={e => update(i, { down_payment: e.target.value })} className={cellInput} placeholder="$" /> : <span className="text-gray-300 text-center block">—</span>}</td>
                  <td className="px-1 py-1 flex justify-center">
                    <ImagePopover url={row.image_url || row.imageUrl} onChange={url => update(i, { image_url: url, imageUrl: url })} />
                  </td>
                  <td className="px-1 py-1">
                    <select value={row.source || 'Specials Page'} onChange={e => update(i, { source: e.target.value })} className={cellInput}>
                      {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex items-center justify-center gap-1">
                      {row.has_workspace_override && (
                        <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Custom workspace override applied">
                          Custom
                        </span>
                      )}
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
                        <>
                          {row.has_workspace_override && onResetOverride && (
                            <button onClick={() => onResetOverride(row)} className="inline-flex items-center justify-center w-6 h-6 rounded text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50" title="Reset to global scraper value">
                              <RotateCcw size={12} />
                            </button>
                          )}
                          <button onClick={() => removeRow(i)} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete row">
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action row */}
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