import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import SnapshotDatePicker from './SnapshotDatePicker';

const BADGE_STYLES = {
  lease: 'bg-violet-100 text-violet-700',
  apr: 'bg-blue-100 text-blue-700',
  finance: 'bg-blue-100 text-blue-700',
  purchase: 'bg-emerald-100 text-emerald-700',
  discount: 'bg-emerald-100 text-emerald-700',
  cash: 'bg-emerald-100 text-emerald-700',
  visual: 'bg-amber-100 text-amber-800 border border-amber-200',
  'visual flyer': 'bg-amber-100 text-amber-800 border border-amber-200',
  default: 'bg-gray-100 text-gray-600',
};

function getBadgeStyle(offerType) {
  const t = (offerType || '').toLowerCase();
  for (const key of Object.keys(BADGE_STYLES)) {
    if (t.includes(key)) return BADGE_STYLES[key];
  }
  return BADGE_STYLES.default;
}

function DollarAmount({ value }) {
  if (!value) return value;
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d+)(.*)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return (
      <>
        <sup className="text-xs font-bold text-gray-700 -top-1">$</sup>
        {num.toLocaleString()}
        {match[2]}
      </>
    );
  }
  return trimmed;
}

function OfferCard({ s }) {
  const [tooltip, setTooltip] = useState(false);
  const ref = useRef(null);
  const rawType = s.offer_type || s.special_type || '';
  const type = rawType.toLowerCase();

  const isLease = type.includes('lease');
  const isApr = type.includes('apr') || type.includes('finance') || type.includes('financing');
  const isDiscount = type.includes('discount') || type.includes('cash') || type.includes('msrp') || type.includes('purchase');

  const badgeStyle = getBadgeStyle(rawType);

  return (
    <div
      ref={ref}
      className="relative bg-white border border-gray-300 rounded-lg p-2.5 text-xs shadow-sm hover:border-gray-400 transition-colors"
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        {rawType && (
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${badgeStyle}`}>
            {rawType}
          </span>
        )}
        {s.trim && (
          <span className="text-[10px] text-gray-500 font-medium truncate max-w-[110px]" title={s.trim}>
            {s.trim}
          </span>
        )}
      </div>

      {s.title && (
        <p className="text-xs font-semibold text-gray-900 leading-snug mb-1.5 line-clamp-2" title={s.title}>
          {s.title}
        </p>
      )}

      {isLease && (
        <>
          {s.offer_details && (
            <p className="text-xl font-extrabold text-gray-900 leading-tight">
              <DollarAmount value={s.offer_details} />
            </p>
          )}
          {s.term && (
            <p className="text-sm font-semibold text-gray-500 mt-0.5">{s.term} months</p>
          )}
          {s.down_payment != null && (
            <p className="text-sm font-semibold text-gray-500">${Number(s.down_payment).toLocaleString()} down</p>
          )}
        </>
      )}

      {isApr && !isLease && (
        <>
          <div className="flex items-baseline gap-0.5">
            {s.offer_details && (
              <>
                <span className="text-xl font-extrabold text-gray-900 leading-tight">{s.offer_details}</span>
                <sup className="text-xs font-bold text-gray-700 -top-1">%</sup>
              </>
            )}
          </div>
          {s.term && (
            <p className="text-sm font-semibold text-gray-500 mt-0.5">{s.term} months</p>
          )}
          {s.down_payment != null && (
            <p className="text-sm font-semibold text-gray-500">${Number(s.down_payment).toLocaleString()} down</p>
          )}
        </>
      )}

      {isDiscount && !isLease && !isApr && (
        <>
          {s.offer_details && (
            <p className="text-xl font-extrabold text-gray-900 leading-tight"><DollarAmount value={s.offer_details} /></p>
          )}
        </>
      )}

      {!isLease && !isApr && !isDiscount && (
        <>
          {s.offer_details && (
            <p className="text-xl font-extrabold text-gray-900 leading-tight">{s.offer_details}</p>
          )}
          {s.term && <p className="text-sm font-semibold text-gray-500 mt-0.5">{s.term} months</p>}
          {s.down_payment != null && (
            <p className="text-sm font-semibold text-gray-500">${Number(s.down_payment).toLocaleString()} down</p>
          )}
        </>
      )}

      {s.special_url && (
        <div className="mt-1.5 pt-1 border-t border-gray-100 flex items-center justify-between">
          <a
            href={s.special_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium"
          >
            View Special <ExternalLink size={10} />
          </a>
        </div>
      )}

      {tooltip && (s.disclaimer || s.title || s.offer_details) && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-slate-800 text-white text-xs rounded-xl shadow-xl p-3 leading-relaxed pointer-events-none space-y-1.5">
          {s.title && <p className="font-semibold text-slate-100">{s.title}</p>}
          <div className="flex items-center gap-2">
            {rawType && <p className={`font-bold ${badgeStyle} px-2 py-0.5 rounded-full inline-block`}>{rawType}</p>}
            {s.offer_details && <span className="text-white font-bold"><DollarAmount value={s.offer_details} /></span>}
          </div>
          {s.term && <p className="text-slate-300">{s.term} months</p>}
          {s.down_payment != null && <p className="text-slate-300">${Number(s.down_payment).toLocaleString()} down</p>}
          {s.disclaimer && (
            <p className="text-[10px] text-slate-400 border-t border-slate-700 pt-1 line-clamp-4">{s.disclaimer}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewVehicleSpecialsView({ store }) {
  const storeId = store?.id || null;
  const storeName = store?.name || null;

  const { data: storeCompetitors, isFetched: competitorsFetched } = useQuery({
    queryKey: ['storeCompetitors', storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => base44.entities.StoreCompetitor.filter({ store_id: storeId }),
  });

  const canonicalNames = useMemo(() => {
    if (!storeName) return [];
    return [...new Set([storeName, ...(storeCompetitors || []).map(c => c.name)])];
  }, [storeName, storeCompetitors]);

  const competitorNames = useMemo(() => {
    if (!storeName) return [];
    const names = [storeName];
    (storeCompetitors || []).forEach(c => {
      names.push(c.name);
      if (c.alias_names) c.alias_names.split('|').forEach(a => { if (a.trim()) names.push(a.trim()); });
    });
    return [...new Set(names)];
  }, [storeName, storeCompetitors]);

  const [snapshotDate, setSnapshotDate] = useState(null);
  const [view, setView] = useState('pivot');
  const [makeFilter, setMakeFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [offerTypeFilter, setOfferTypeFilter] = useState('all');
  const [showYear, setShowYear] = useState(false);
  const [showTrim, setShowTrim] = useState(false);
  const [hoveredImage, setHoveredImage] = useState(null);
  const [activeModalImage, setActiveModalImage] = useState(null);

  const { data: result, isLoading } = useQuery({
    queryKey: ['competitorVehicleSpecials', storeId, competitorNames.join(','), snapshotDate],
    enabled: competitorNames.length > 0 && (!storeId || competitorsFetched),
    queryFn: () => base44.functions.invoke('supabaseCompetitorVehicleSpecials', {
      competitor_names: competitorNames,
      snapshot_date: snapshotDate,
      store_id: storeId,
    }).then(r => r.data),
  });

  const rows = result?.data || [];
  const availableDates = result?.available_dates || [];
  const activeDate = result?.snapshot_date;

  // Build alias→canonical map so aliased names resolve to canonical column
  const aliasToCanonical = useMemo(() => {
    const map = {};
    (storeCompetitors || []).forEach(c => {
      if (c.alias_names) c.alias_names.split('|').forEach(a => { if (a.trim()) map[a.trim()] = c.name; });
      if (c.competitor_key) map[c.competitor_key] = c.name;
    });
    return map;
  }, [storeCompetitors]);

  const makes = useMemo(() => [...new Set(rows.map(r => r.make).filter(Boolean))].sort(), [rows]);
  const models = useMemo(() => {
    const src = makeFilter === 'all' ? rows : rows.filter(r => r.make === makeFilter);
    return [...new Set(src.map(r => r.model).filter(Boolean))].sort();
  }, [rows, makeFilter]);
  const offerTypes = useMemo(() => [...new Set(rows.map(r => r.offer_type).filter(Boolean))].sort(), [rows]);
  // Always use configured canonical names as columns
  const dealers = useMemo(() => canonicalNames, [canonicalNames]);

  const filtered = useMemo(() => rows.filter(r => {
    if (view === 'pivot' && r.is_pending_ai) return false;
    return (
      (makeFilter === 'all' || r.make === makeFilter) &&
      (modelFilter === 'all' || r.model === modelFilter) &&
      (offerTypeFilter === 'all' || r.offer_type === offerTypeFilter)
    );
  }), [rows, view, makeFilter, modelFilter, offerTypeFilter]);

  // Pivot rows: unique combos based on active toggles
  const pivotRows = useMemo(() => {
    const key = r => [
      showYear ? (r.year ?? '') : '',
      r.model ?? '',
      showTrim ? (r.trim ?? '') : '',
    ].join('||');

    const unique = [...new Set(filtered.map(key))];
    return unique
      .map(k => {
        const [year, model, trim] = k.split('||');
        return {
          year: showYear ? (year || null) : null,
          model: model || null,
          trim: showTrim ? (trim || null) : null,
        };
      })
      .sort((a, b) => {
        if (a.model === 'Special Offer') return 1;
        if (b.model === 'Special Offer') return -1;
        const yCmp = showYear ? (String(a.year || '')).localeCompare(String(b.year || '')) : 0;
        if (yCmp !== 0) return yCmp;
        const mCmp = (a.model || '').localeCompare(b.model || '');
        if (mCmp !== 0) return mCmp;
        return showTrim ? (a.trim || '').localeCompare(b.trim || '') : 0;
      });
  }, [filtered, showYear, showTrim]);

  if (!storeName) {
    return <div className="text-gray-400 text-sm py-10 text-center">Select a store to view vehicle specials.</div>;
  }

  if (isLoading) return <div className="text-gray-400 text-sm py-10 text-center">Loading...</div>;

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <SnapshotDatePicker dates={availableDates} selected={snapshotDate} onChange={setSnapshotDate} />
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No vehicle specials found for this dealer.</p>
        </div>
      </div>
    );
  }

  const yearColW = 60;
  const trimColW = 100;
  const modelColW = 140;
  const dealerColW = 240;
  const totalW = (showYear ? yearColW : 0) + modelColW + (showTrim ? trimColW : 0) + dealerColW * dealers.length;

  // Shared pivot table body (used by both Pivot and Visual views)
  const PivotTable = ({ imageOnly }) => (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-auto">
      <table style={{ tableLayout: 'fixed', width: `${totalW}px`, borderCollapse: 'collapse' }}>
        <colgroup>
          {showYear && <col style={{ width: `${yearColW}px` }} />}
          <col style={{ width: `${modelColW}px` }} />
          {showTrim && <col style={{ width: `${trimColW}px` }} />}
          {dealers.map(d => <col key={d} style={{ width: `${dealerColW}px` }} />)}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 bg-white" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            {showYear && (
              <th className="py-3 px-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400 bg-white border-b border-gray-200">Year</th>
            )}
            <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400 bg-white border-b border-gray-200">Model</th>
            {showTrim && (
              <th className="py-3 px-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400 bg-white border-b border-gray-200">Trim</th>
            )}
            {dealers.map(d => (
              <th key={d} className="py-3 px-4 text-left text-xs font-bold text-gray-800 bg-white border-b border-gray-200 leading-snug">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pivotRows.map((row, ri) => {
            const matchFn = r =>
              (row.model == null ? !r.model : r.model === row.model) &&
              (!showYear || (row.year == null ? !r.year : String(r.year) === String(row.year))) &&
              (!showTrim || (row.trim == null ? !r.trim : r.trim === row.trim));

            const hasData = dealers.some(d =>
              filtered.some(r => {
                const resolvedName = aliasToCanonical[r.offer_dealer_name] ?? r.offer_dealer_name;
                return resolvedName === d && matchFn(r) && (!imageOnly || r.image_url);
              })
            );
            if (!hasData) return null;

            return (
              <tr key={ri} className={`align-top border-b border-gray-100 ${ri % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                {showYear && (
                  <td className="py-4 px-3 align-top text-xs text-gray-500 font-medium">{row.year ?? '—'}</td>
                )}
                <td className="py-4 px-4 align-top">
                  <span className={`text-sm font-bold ${!row.model ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                    {row.model || 'Other'}
                  </span>
                </td>
                {showTrim && (
                  <td className="py-4 px-3 align-top text-xs text-gray-500 italic">{row.trim ?? '—'}</td>
                )}
                {dealers.map(d => {
                  const items = filtered.filter(r => {
                    const resolvedName = aliasToCanonical[r.offer_dealer_name] ?? r.offer_dealer_name;
                    return resolvedName === d && matchFn(r) && (!imageOnly || r.image_url);
                  });
                  return (
                    <td key={d} className="py-3 px-3 align-top">
                      {items.length === 0 ? (
                        <span className="text-gray-200 text-xs">—</span>
                      ) : imageOnly ? (
                        <div className="space-y-2">
                          {items.map((s, i) => (
                            <div
                              key={i}
                              className="relative bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                              onClick={() => setActiveModalImage(s.image_url)}
                              title={s.title || 'Click to zoom image'}
                            >
                              <div className="relative rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                                <img
                                  src={s.image_url}
                                  alt={s.title || ''}
                                  className="w-full max-h-40 object-contain transition-transform group-hover:scale-105"
                                  style={{ display: 'block' }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-black/80 text-white px-2 py-0.5 rounded-full font-semibold shadow">
                                    Click to Zoom 🔍
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {items.map((s, i) => <OfferCard key={i} s={s} />)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {activeDate && (
        <p className="px-5 py-2 text-xs text-gray-400">
          Snapshot: {format(new Date(activeDate + 'T12:00:00'), 'MMMM d, yyyy')}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4 relative">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <SnapshotDatePicker dates={availableDates} selected={snapshotDate} onChange={setSnapshotDate} />

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setView('pivot')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${view === 'pivot' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Pivot</button>
          <button onClick={() => setView('visual')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${view === 'visual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Visuals</button>
        </div>

        {makes.length > 1 && (
          <select value={makeFilter} onChange={e => { setMakeFilter(e.target.value); setModelFilter('all'); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
            <option value="all">All Makes</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
          <option value="all">All Models</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {offerTypes.length > 0 && (
          <select value={offerTypeFilter} onChange={e => setOfferTypeFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
            <option value="all">All Offer Types</option>
            {offerTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showYear} onChange={e => setShowYear(e.target.checked)} className="rounded" />
          By Year
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showTrim} onChange={e => setShowTrim(e.target.checked)} className="rounded" />
          By Trim
        </label>
      </div>

      {view === 'pivot' && <PivotTable imageOnly={false} />}
      {view === 'visual' && <PivotTable imageOnly={true} />}

      {/* Interactive Lightbox Modal */}
      {activeModalImage && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 p-4 cursor-pointer backdrop-blur-sm"
          onClick={() => setActiveModalImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl p-3 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModalImage(null)}
              className="absolute -top-3 -right-3 bg-gray-900 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg hover:bg-black transition-colors"
            >
              ✕
            </button>
            <img
              src={activeModalImage}
              alt=""
              className="max-w-full max-h-[82vh] rounded-lg object-contain shadow-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}