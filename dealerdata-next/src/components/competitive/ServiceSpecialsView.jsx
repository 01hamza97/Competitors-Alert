import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import SnapshotDatePicker from './SnapshotDatePicker';

function OfferCard({ s }) {
  const [tooltip, setTooltip] = useState(false);
  const ref = useRef(null);

  return (
    <div
      ref={ref}
      className="relative bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs shadow-sm"
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      {s.offer_title && (
        <p className="font-bold text-blue-600 leading-snug mb-0.5">{s.offer_title}</p>
      )}
      {s.price && (
        <p className="text-base font-extrabold text-gray-900 leading-tight mb-0.5">{s.price}</p>
      )}
      {/* Tooltip popup */}
      {tooltip && s.offer_details && (
        <div className="absolute z-50 left-0 top-full mt-1 w-72 bg-slate-800 text-white text-xs rounded-xl shadow-xl p-3 leading-relaxed pointer-events-none">
          {s.offer_title && <p className="font-bold text-blue-300 mb-1">{s.offer_title}</p>}
          {s.price && <p className="text-base font-extrabold text-white mb-1">{s.price}</p>}
          <p className="text-slate-300 whitespace-pre-line">{s.offer_details}</p>
        </div>
      )}
    </div>
  );
}

export default function ServiceSpecialsView({ store }) {
  const storeId = store?.id || null;
  const storeName = store?.name || null;

  const { data: storeCompetitors, isFetched: competitorsFetched } = useQuery({
    queryKey: ['storeCompetitors', storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => base44.entities.StoreCompetitor.filter({ store_id: storeId }),
  });

  // canonicalNames: the display names (store + competitor canonical names, no aliases)
  // competitorNames: all names including aliases, used for Supabase filtering
  const canonicalNames = useMemo(() => {
    if (!storeName) return [];
    return [storeName, ...(storeCompetitors || []).map(c => c.name)];
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
  const [filterCategory, setFilterCategory] = useState('all');

  const { data: result, isLoading } = useQuery({
    queryKey: ['competitorServiceSpecials', competitorNames.join(','), snapshotDate],
    enabled: competitorNames.length > 0 && (!storeId || competitorsFetched),
    queryFn: () => base44.functions.invoke('supabaseCompetitorServiceSpecials', {
      competitor_names: competitorNames,
      snapshot_date: snapshotDate,
    }).then(r => r.data),
  });

  const rows = result?.data || [];
  const availableDates = result?.available_dates || [];
  const activeDate = result?.snapshot_date;
  const allCategories = result?.all_categories || [];

  // Build alias→canonical map so aliased names (e.g. "Moss Bros CDJR Riverside") resolve to canonical column
  const aliasToCanonical = useMemo(() => {
    const map = {};
    (storeCompetitors || []).forEach(c => {
      if (c.alias_names) c.alias_names.split('|').forEach(a => { if (a.trim()) map[a.trim()] = c.name; });
    });
    return map;
  }, [storeCompetitors]);

  // Always use configured canonical names as columns, sorted by sort_order
  const dealers = useMemo(() => canonicalNames, [canonicalNames]);
  const categories = useMemo(() => (allCategories.length > 0 ? allCategories.sort() : [...new Set(rows.map(r => r.service_type).filter(Boolean))].sort()), [rows, allCategories]);

  const filtered = useMemo(() => rows.filter(r =>
    filterCategory === 'all' || r.service_type === filterCategory
  ), [rows, filterCategory]);

  if (!storeName) {
    return <div className="text-gray-400 text-sm py-10 text-center">Select a store to view service specials.</div>;
  }

  if (isLoading) return <div className="text-gray-400 text-sm py-10 text-center">Loading...</div>;

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <SnapshotDatePicker dates={availableDates} selected={snapshotDate} onChange={setSnapshotDate} />
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No service specials found for this dealer.</p>
        </div>
      </div>
    );
  }

  const hasUncategorized = filtered.some(r => !r.service_type);
  const visibleCategories = [
    ...categories.filter(c => filterCategory === 'all' || c === filterCategory),
    ...(hasUncategorized && filterCategory === 'all' ? ['__uncategorized__'] : []),
  ];
  const catColW = 130;
  const maxDealerW = 230;
  const minDealerW = 160;
  const targetContentW = 970; // approx available width within max-w-6xl after padding
  const dealerColW = dealers.length > 0
    ? Math.max(minDealerW, Math.min(maxDealerW, Math.floor(targetContentW / dealers.length)))
    : maxDealerW;
  const totalW = catColW + dealerColW * dealers.length;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <SnapshotDatePicker dates={availableDates} selected={snapshotDate} onChange={setSnapshotDate} />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Pivot table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table style={{ tableLayout: 'fixed', width: `${totalW}px`, borderCollapse: 'collapse' }}>
          <colgroup>
            <col style={{ width: `${catColW}px` }} />
            {dealers.map(d => <col key={d} style={{ width: `${dealerColW}px` }} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-white" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400 bg-white border-b border-gray-200">
                Category
              </th>
              {dealers.map(d => (
                <th key={d} className="py-3 px-4 text-left text-xs font-bold text-gray-800 bg-white border-b border-gray-200 leading-snug">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleCategories.map((cat, ci) => {
              const isUncategorized = cat === '__uncategorized__';
              const hasData = dealers.some(d => filtered.some(r => {
                const resolvedName = aliasToCanonical[r.offer_dealer_name] ?? r.offer_dealer_name;
                return resolvedName === d && (isUncategorized ? !r.service_type : r.service_type === cat);
              }));
              if (!hasData) return null;
              return (
                <tr key={cat} className={`align-top border-b border-gray-100 ${ci % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                  <td className="py-4 px-4 align-top">
                    <span className={`text-sm font-bold ${isUncategorized ? 'text-gray-400 italic' : 'text-gray-800'}`}>{isUncategorized ? 'Other' : cat}</span>
                  </td>
                  {dealers.map(d => {
                    const items = filtered.filter(r => {
                      const resolvedName = aliasToCanonical[r.offer_dealer_name] ?? r.offer_dealer_name;
                      return resolvedName === d && (isUncategorized ? !r.service_type : r.service_type === cat);
                    });
                    return (
                      <td key={d} className="py-3 px-3 align-top">
                        {items.length === 0 ? (
                          <span className="text-gray-200 text-xs">—</span>
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
    </div>
  );
}