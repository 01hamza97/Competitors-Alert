import React, { useState, useRef, useEffect } from 'react';
import { ImageIcon, X } from 'lucide-react';

// Small thumbnail (40x30 by default) that opens a popover with a larger preview
// and a URL text input for editing. Clicking outside closes the popover.
export default function ImagePopover({ url, onChange, width = 40, height = 30, previewW = 200, previewH = 150, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [draftUrl, setDraftUrl] = useState(url || '');
  const popRef = useRef(null);

  useEffect(() => { setDraftUrl(url || ''); setBroken(false); }, [url]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const commit = () => {
    if (!readOnly && onChange) onChange(draftUrl);
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={popRef}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="block rounded border border-gray-200 bg-white overflow-hidden shrink-0 hover:ring-1 hover:ring-blue-400"
        style={{ width, height }}
        title={url ? 'Click to edit image' : 'Click to add image'}>
        {url && !broken ? (
          <img src={url} alt="" onError={() => setBroken(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
            <ImageIcon size={12} />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl p-3 space-y-2" style={{ width: previewW + 16 }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-600">Image</span>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center" style={{ width: previewW, height: previewH }}>
            {draftUrl && !broken ? (
              <img src={draftUrl} alt="" onError={() => setBroken(true)} className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="flex flex-col items-center text-gray-300"><ImageIcon size={28} /><span className="text-[10px] mt-1">No image</span></div>
            )}
          </div>
          {readOnly ? (
            <input type="text" value={draftUrl} readOnly className="w-full px-2 py-1.5 text-[11px] border border-gray-200 rounded-md bg-gray-50 text-gray-500" />
          ) : (
            <input type="text" value={draftUrl} onChange={e => setDraftUrl(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); }}
              placeholder="Paste image URL" className="w-full px-2 py-1.5 text-[11px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
          )}
        </div>
      )}
    </div>
  );
}