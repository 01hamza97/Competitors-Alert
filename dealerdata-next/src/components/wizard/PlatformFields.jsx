import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { PLATFORM_PRESETS, PLATFORM_OPTIONS } from './platformPresets';

function TagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState('');

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 border border-gray-200 rounded-lg p-2 min-h-[40px] bg-white focus-within:ring-2 focus-within:ring-blue-300 focus-within:border-blue-400">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="text-blue-400 hover:text-blue-700 leading-none">×</button>
        </span>
      ))}
      <input
        className="outline-none text-sm flex-1 min-w-[120px] placeholder:text-gray-300"
        placeholder={placeholder || 'Type and press Enter…'}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
      />
    </div>
  );
}

export { TagInput };

export default function PlatformFields({ platform, values, onChange, flash }) {
  const [tipsOpen, setTipsOpen] = useState(false);
  const preset = PLATFORM_PRESETS[platform];

  if (!platform || !preset) return null;

  const field = (key, val) => onChange({ ...values, [key]: val });

  const inputCls = (key) =>
    `w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all ${
      flash?.[key] ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-200' : 'border-gray-200'
    }`;

  return (
    <div className="space-y-4">
      {/* Platform Tips */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
        <button
          type="button"
          className="flex items-center gap-2 w-full px-3 py-2.5 text-left"
          onClick={() => setTipsOpen(o => !o)}
        >
          <Info size={14} className="text-amber-500 shrink-0" />
          <span className="text-sm font-medium text-amber-800 flex-1">Platform Tips: {PLATFORM_OPTIONS.find(p => p.value === platform)?.label}</span>
          {tipsOpen ? <ChevronDown size={14} className="text-amber-500" /> : <ChevronRight size={14} className="text-amber-500" />}
        </button>
        {tipsOpen && (
          <div className="px-3 pb-3 text-sm text-amber-700 border-t border-amber-200 pt-2">
            {preset.notes}
          </div>
        )}
      </div>

      {/* DealerInspire fields */}
      {platform === 'dealerinspire' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">API Key <span className="text-red-500">*</span></label>
            <input
              className={inputCls('api_key')}
              placeholder="From carscommerce.inc network request"
              value={values.api_key || ''}
              onChange={e => field('api_key', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">API URL <span className="text-red-500">*</span></label>
            <input
              className={inputCls('api_url')}
              placeholder="https://websites-search.api.carscommerce.inc/api/v1/listings/{DEALER_ID}/search"
              value={values.api_url || ''}
              onChange={e => field('api_url', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* AutoFi fields */}
      {platform === 'autofi' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">AutoFi Dealer ID <span className="text-red-500">*</span></label>
            <input
              className={inputCls('autofi_dealer_id')}
              placeholder="Found in page source or network requests"
              value={values.autofi_dealer_id || ''}
              onChange={e => field('autofi_dealer_id', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!values.use_autofi_page_price_override} onChange={e => field('use_autofi_page_price_override', e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">Page Price Override</span>
              <span className="text-xs text-gray-400">(enable if prices aren't loading from API)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!values.use_autofi_missing_vin_page_fallback} onChange={e => field('use_autofi_missing_vin_page_fallback', e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">Missing VIN Page Fallback</span>
            </label>
          </div>
        </div>
      )}

      {/* DealerOn fields */}
      {platform === 'dealeron' && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">API URL <span className="text-red-500">*</span></label>
          <input
            className={inputCls('api_url')}
            placeholder="Found in network inspector on their inventory page"
            value={values.api_url || ''}
            onChange={e => field('api_url', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}