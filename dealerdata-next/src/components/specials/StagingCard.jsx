import React, { useState } from 'react';
import { Check, X, ImageIcon } from 'lucide-react';

const OFFER_TYPES = ['Lease', 'APR', 'Discount', 'Other'];
const inputClass = "w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";
const compactInput = "w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";

function sourceBadgeClasses(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('homepage')) return 'bg-orange-100 text-orange-800 border border-orange-200';
  if (s.includes('slider')) return 'bg-orange-100 text-orange-800 border border-orange-200';
  if (s.includes('specials')) return 'bg-blue-100 text-blue-800 border border-blue-200';
  return 'bg-gray-100 text-gray-700 border border-gray-200';
}

function confidenceClasses(conf) {
  const c = (conf || '').toLowerCase();
  if (c === 'high') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  if (c === 'medium') return 'bg-amber-100 text-amber-800 border border-amber-200';
  if (c === 'low') return 'bg-red-100 text-red-800 border border-red-200';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
}

function SourceLabel({ source }) {
  const s = (source || '').toLowerCase();
  let label = source || 'Unknown';
  if (s.includes('homepage') || s.includes('slider')) label = 'Homepage';
  else if (s.includes('specials')) label = 'Specials Page';
  return label;
}

function StagingCard({ row, onApprove, onReject, isBusy }) {
  const [edits, setEdits] = useState({});
  const [imageBroken, setImageBroken] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);

  const field = (key) => edits[key] !== undefined ? edits[key] : (row[key] ?? '');
  const setField = (key, val) => setEdits(prev => ({ ...prev, [key]: val }));
  const imageUrl = field('image_url') || '';
  const isService = (row.special_type || 'vehicle').toLowerCase() === 'service';

  if (approved) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-center gap-2">
        <Check size={16} className="text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-800">✓ Approved</span>
        {!isService ? (
          <span className="text-xs text-emerald-700 ml-2 truncate">
            {field('year') || ''} {field('make') || ''} {field('model') || ''} {field('trim') || ''}
          </span>
        ) : (
          <span className="text-xs text-emerald-700 ml-2 truncate">
            {field('service_type') || ''} — {field('offer_title') || ''}
          </span>
        )}
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-2">
        <X size={16} className="text-red-600" />
        <span className="text-sm font-semibold text-red-700">✗ Rejected</span>
      </div>
    );
  }

  const handleApprove = async () => {
    await onApprove(row, Object.keys(edits).length ? edits : null);
    setApproved(true);
  };
  const handleReject = async () => {
    await onReject(row);
    setRejected(true);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2.5">
      {/* Top row: badges + approve/reject */}
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sourceBadgeClasses(row.source)}`}>
          {SourceLabel({ source: row.source })}
        </span>
        {row.ai_confidence && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${confidenceClasses(row.ai_confidence)}`}>
            {row.ai_confidence}
          </span>
        )}
        <div className="flex-1" />
        <button onClick={handleApprove} disabled={isBusy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
          <Check size={13} /> Approve
        </button>
        <button onClick={handleReject} disabled={isBusy}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50" title="Reject">
          <X size={15} />
        </button>
      </div>

      {!isService ? (
        <>
          {/* Vehicle: Year/Make/Model/Trim */}
          <div className="grid grid-cols-4 gap-2">
            <input type="number" placeholder="Year" value={field('year')} onChange={e => setField('year', e.target.value)} className={compactInput} />
            <input type="text" placeholder="Make" value={field('make')} onChange={e => setField('make', e.target.value)} className={compactInput} />
            <input type="text" placeholder="Model" value={field('model')} onChange={e => setField('model', e.target.value)} className={compactInput} />
            <input type="text" placeholder="Trim" value={field('trim')} onChange={e => setField('trim', e.target.value)} className={compactInput} />
          </div>
          {/* Offer type + amount + term + down */}
          <div className="grid grid-cols-4 gap-2">
            <select value={field('offer_type')} onChange={e => setField('offer_type', e.target.value)} className={compactInput}>
              {OFFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" placeholder="Amount" value={field('offer_details')} onChange={e => setField('offer_details', e.target.value)} className={compactInput} />
            <input type="number" placeholder="Term (mo)" value={field('term')} onChange={e => setField('term', e.target.value)} className={compactInput} />
            <input type="number" placeholder="Down $" value={field('down_payment')} onChange={e => setField('down_payment', e.target.value)} className={compactInput} />
          </div>
        </>
      ) : (
        <>
          {/* Service: type / title / price */}
          <div className="grid grid-cols-3 gap-2">
            <input type="text" placeholder="Service Type" value={field('service_type')} onChange={e => setField('service_type', e.target.value)} className={inputClass} />
            <input type="text" placeholder="Offer Title" value={field('offer_title')} onChange={e => setField('offer_title', e.target.value)} className={inputClass} />
            <input type="text" placeholder="Price" value={field('price')} onChange={e => setField('price', e.target.value)} className={inputClass} />
          </div>
          <textarea placeholder="Description" value={field('offer_description')} onChange={e => setField('offer_description', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
        </>
      )}

      {/* Image URL + thumbnail */}
      <div className="flex items-center gap-2">
        <input type="text" placeholder="Image URL" value={imageUrl} onChange={e => setField('image_url', e.target.value)} className={`${inputClass} flex-1`} />
        {!imageUrl || imageBroken ? (
          <div className="w-[100px] h-[75px] rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-300 shrink-0">
            <ImageIcon size={18} />
          </div>
        ) : (
          <img src={imageUrl} alt="" onError={() => setImageBroken(true)} className="w-[100px] h-[75px] object-cover rounded border border-gray-200 bg-white shrink-0" />
        )}
      </div>

      {/* AI notes */}
      {row.ai_notes && (
        <p className="text-[11px] text-gray-500 italic">{row.ai_notes}</p>
      )}
    </div>
  );
}

export default StagingCard;