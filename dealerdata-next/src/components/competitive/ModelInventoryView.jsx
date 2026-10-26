import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import SnapshotDatePicker from './SnapshotDatePicker';
import { useDealer } from '@/lib/DealerContext';
import { normalizeMake, normalizeModel } from '@/lib/vehicleNormalization';


function blueShade(val, min, max) {
  if (val == null || max === 0 || min === max) return null;
  const ratio = (val - min) / (max - min);
  const opacity = 0.08 + ratio * 0.82;
  return { backgroundColor: `rgba(59,130,246,${opacity.toFixed(2)})`, color: ratio > 0.55 ? 'white' : '#1e3a5f' };
}

function blueShadePrice(val, min, max) {
  if (val == null || max === 0 || min === max) return {};
  const ratio = 1 - (val - min) / (max - min);
  const opacity = 0.08 + ratio * 0.82;
  return { backgroundColor: `rgba(59,130,246,${opacity.toFixed(2)})`, color: ratio > 0.55 ? 'white' : '#1e3a5f' };
}

// Per-model (per-row) min/max so each model's dealerships rank against each other
function rowRange(row, competitorIds, priceMode) {
  let min = Infinity, max = -Infinity;
  competitorIds.forEach(cid => {
    const cell = row[cid];
    let num;
    if (priceMode === 'all') num = cell?.count ?? null;
    else if (priceMode === 'inventory') num = cell;
    else num = cell?.num ?? null;
    if (num == null || typeof num !== 'number') return;
    if (num < min) min = num;
    if (num > max) max = num;
  });
  if (min === Infinity) return null;
  return { min, max };
}

function PriceDisplay({ numericValue, priceText }) {
  if (priceText) return <span className="text-[11px] leading-tight">{priceText}</span>;
  if (numericValue == null) return '';
  return (
    <>
      <sup className="text-[9px] font-bold">$</sup>
      {numericValue.toLocaleString()}
    </>
  );
}

export default function ModelInventoryView({ store }) {
  const { isDealerLoading } = useDealer();
  const storeId = store?.id || null;
  const storeName = store?.name || null;
  const dealershipKey = store?.dealership_key || null;
  const scraperStoreId = store?.scraper_store_id || null;

  const [snapshotDate, setSnapshotDate] = useState(null);
  const [priceMode, setPriceMode] = useState('inventory');

  // Reset snapshot date whenever the store changes so we don't carry over another dealer's date
  useEffect(() => {
    setSnapshotDate(null);
  }, [dealershipKey]);
  const [modelFilter, setModelFilter] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const inventoryType = 'new';
  const [showYear, setShowYear] = useState(true);
  const [showTrim, setShowTrim] = useState(false);
  const [sortBy, setSortBy] = useState('year');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey: ['competitorInventory_v10', storeId, dealershipKey, snapshotDate ?? '__latest__'],
    enabled: !!dealershipKey,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => {
      const payload = {
        dealer_id: dealershipKey,
        snapshot_date: snapshotDate ?? null,
      };
      console.group(`[DIAG REQUEST] supabaseCompetitorInventory`);
      console.log(`  storeId:`, storeId);
      console.log(`  dealershipKey:`, dealershipKey);
      console.log(`  snapshotDate:`, snapshotDate ?? null);
      console.log(`  full payload being sent:`, JSON.stringify(payload));
      console.groupEnd();

      return base44.functions.invoke('supabaseCompetitorInventory', payload).then(r => {
        const data = r.data;
        const rows = data?.data || [];
        const dealerIds = [...new Set(rows.map(r => r.dealer_id).filter(Boolean))];
        const competitorIds = [...new Set(rows.map(r => r.competitor_id || r.competitor_dealer_name).filter(Boolean))];

        console.group(`[DIAG RESPONSE] supabaseCompetitorInventory for dealershipKey=${dealershipKey}`);
        console.log(`  rows.length:`, rows.length);
        console.log(`  dealer_id values in response:`, dealerIds);
        console.log(`  competitor_ids in response:`, competitorIds);
        console.log(`  competitor_id_to_name:`, data?.competitor_id_to_name);
        console.log(`  First 10 raw rows from backend (before any processing):`, rows.slice(0, 10).map(r => ({
          dealer_id: r.dealer_id,
          competitor_id: r.competitor_id,
          competitor_dealer_name: r.competitor_dealer_name,
          make: r.make,
          model: r.model,
          snapshot_date: r.snapshot_date,
        })));
        console.groupEnd();

        return data;
      });
    },
  });

  const perDealerDates = result?.per_dealer_dates || null;
  const availableDates = result?.available_dates || [];
  const availableDatesMeta = result?.available_dates_meta || [];

  // competitor_id → display name from backend (rebuilt every load, never cached).
  // For rows where competitor_id is NULL, the pivot key IS the competitor_dealer_name,
  // so we ensure those are self-mapped here.
  const competitorIdToName = useMemo(() => {
    const base = result?.competitor_id_to_name || {};
    const raw = result?.data || [];
    const extended = { ...base };
    raw.forEach(r => {
      if (!r.competitor_id && r.competitor_dealer_name) {
        // key = name, display = name
        extended[r.competitor_dealer_name] = r.competitor_dealer_name;
      }
    });
    return extended;
  }, [result]);

  // Identify the client store's pivot key (shown as first column, visually distinct).
  // SOLE RULE: competitor_id === dealer_id (the value used to query Supabase, i.e. dealership_key).
  // dealer_type is always null for this group and is ignored. No name matching.
  const clientStoreKey = useMemo(() => {
    if (!dealershipKey) return null;
    return dealershipKey;
  }, [dealershipKey]);

  // Derive ordered pivot keys from the backend response.
  // Use competitor_id as the stable key; fall back to competitor_dealer_name for rows
  // where the Supabase column is NULL (older scrape data before competitor_id was added).
  const competitorIds = useMemo(() => {
    const raw = result?.data || [];
    const seen = new Set();
    if (dealershipKey) seen.add(dealershipKey);
    raw.forEach(r => {
      const key = r.competitor_id || r.competitor_dealer_name;
      if (key) seen.add(key);
    });
    const ids = [...seen];

    ids.sort((a, b) => {
      if (a === clientStoreKey) return -1;
      if (b === clientStoreKey) return 1;
      return (competitorIdToName[a] || a).localeCompare(competitorIdToName[b] || b);
    });

    // ── DIAGNOSTIC: column construction ──
    console.group(`[Pivot] Column construction for dealer_id="${dealershipKey}"`);
    console.log('Total raw rows from backend:', raw.length);
    const nullCidCount = raw.filter(r => !r.competitor_id).length;
    console.log(`Rows with competitor_id: ${raw.length - nullCidCount}, rows using name fallback: ${nullCidCount}`);
    const rawCountPer = {};
    raw.forEach(r => {
      const key = r.competitor_id || r.competitor_dealer_name;
      if (key) rawCountPer[key] = (rawCountPer[key] || 0) + 1;
    });
    console.log('Raw row count per pivot key:', rawCountPer);
    console.log('Final columns:', ids);
    console.groupEnd();

    return ids;
  }, [result, dealershipKey, competitorIdToName]);

  // Normalize all rows. Use competitor_id as pivot key, fall back to competitor_dealer_name.
  const rows = useMemo(() => {
    const raw = result?.data || [];
    const valid = raw.filter(r => r.competitor_id || r.competitor_dealer_name);
    const dropped = raw.length - valid.length;
    if (dropped > 0) console.warn(`[Pivot] Dropped ${dropped} rows with no competitor_id or name`);
    console.log(`[Pivot] rows: total=${raw.length} valid=${valid.length} dealershipKey=${dealershipKey}`);
    return valid.map(r => {
      const normMake = normalizeMake(r.make) || r.make || '';
      const normModel = normalizeModel(normMake, r.model) || r.model || '';
      return {
        ...r,
        // Normalize pivot key: use competitor_id if present, else competitor_dealer_name
        competitor_id: r.competitor_id || r.competitor_dealer_name,
        make: normMake,
        model: normModel,
      };
    });
  }, [result, dealershipKey]);

  // Filter out summary rows and apply inventory_type filter
  const typeFilteredRows = useMemo(() => {
    return rows.filter(r =>
      (r.model || '').trim().toLowerCase() !== 'total' &&
      (inventoryType === 'all' || (r.inventory_type?.toLowerCase().trim() || 'new') === inventoryType)
    );
  }, [rows, inventoryType]);

  const makes = useMemo(() =>
    [...new Set(typeFilteredRows.map(r => r.make).filter(Boolean))].sort(),
    [typeFilteredRows]
  );
  const years = useMemo(() =>
    [...new Set(typeFilteredRows.map(r => r.year).filter(y => y != null))].sort((a, b) => b - a),
    [typeFilteredRows]
  );
  const models = useMemo(() => {
    let src = typeFilteredRows;
    if (makeFilter !== 'all') src = src.filter(r => r.make === makeFilter);
    if (yearFilter !== 'all') src = src.filter(r => Number(r.year) === Number(yearFilter));
    return [...new Set(src.map(r => r.model).filter(Boolean))].sort();
  }, [typeFilteredRows, makeFilter, yearFilter]);

  const showMake = makes.length > 1;

  // Accumulate a source row into a pivot cell, keyed by competitor_id
  function accumCell(pivotRow, competitorId, srcRow) {
    const inv = (srcRow.inventory_count != null && srcRow.inventory_count > 0) ? srcRow.inventory_count : 1;
    const lp = (srcRow.low_price != null && Number(srcRow.low_price) > 0) ? Number(srcRow.low_price) : null;

    if (priceMode === 'all') {
      if (!pivotRow[competitorId]) pivotRow[competitorId] = { count: 0, low: null };
      pivotRow[competitorId].count += inv;
      if (lp != null && (pivotRow[competitorId].low == null || lp < pivotRow[competitorId].low)) pivotRow[competitorId].low = lp;
    } else if (priceMode === 'inventory') {
      pivotRow[competitorId] = (pivotRow[competitorId] || 0) + inv;
    } else if (priceMode === 'low') {
      const prev = pivotRow[competitorId];
      if (lp != null && (prev == null || lp < prev.num)) pivotRow[competitorId] = { num: lp, disp: null };
    }
  }

  const filteredRows = useMemo(() => {
    const result = typeFilteredRows.filter(r =>
      (makeFilter === 'all' || r.make === makeFilter) &&
      (yearFilter === 'all' || Number(r.year) === Number(yearFilter)) &&
      (modelFilter === 'all' || r.model === modelFilter)
    );

    // ── DIAGNOSTIC: filter exclusions ──
    const afterFilterCountPer = {};
    result.forEach(r => { afterFilterCountPer[r.competitor_id] = (afterFilterCountPer[r.competitor_id] || 0) + 1; });
    const beforeFilterCountPer = {};
    typeFilteredRows.forEach(r => { beforeFilterCountPer[r.competitor_id] = (beforeFilterCountPer[r.competitor_id] || 0) + 1; });
    const excluded = Object.keys(beforeFilterCountPer).filter(c => !afterFilterCountPer[c]);
    if (excluded.length) console.warn('[Pivot] competitor_ids with 0 rows after make/model/year filter:', excluded, { makeFilter, modelFilter, yearFilter });
    console.log('[Pivot] filteredRows per competitor_id:', afterFilterCountPer, `(makeFilter=${makeFilter}, modelFilter=${modelFilter}, yearFilter=${yearFilter})`);

    return result;
  }, [typeFilteredRows, makeFilter, modelFilter, yearFilter]);

  // Grand totals keyed by competitor_id
  const grandTotals = useMemo(() => {
    if (priceMode !== 'inventory' && priceMode !== 'all') return {};
    const totals = {};
    filteredRows.forEach(r => {
      const cid = r.competitor_id;
      const inv = (r.inventory_count != null && r.inventory_count > 0) ? r.inventory_count : 1;
      totals[cid] = (totals[cid] || 0) + inv;
    });
    return totals;
  }, [filteredRows, priceMode]);

  // Build pivot rows keyed by competitor_id
  const pivotData = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;

    const makeKey = (r) => [
      showYear ? (r.year ?? '') : '',
      r.make ?? '',
      r.model ?? r.raw_title ?? '',
    ].join('|');

    if (showTrim) {
      // Grouped hierarchy: header row per (year+make+model), children per trim
      const headerMap = {};
      const trimMap = {};

      filteredRows.forEach(r => {
        const cid = r.competitor_id;
        const modelLabel = r.model ?? r.raw_title ?? '';

        const hKey = [showYear ? (r.year ?? '') : '', r.make ?? '', modelLabel].join('|');
        if (!headerMap[hKey]) {
          headerMap[hKey] = { _year: showYear ? (r.year ?? null) : null, _make: r.make ?? '', _model: modelLabel, _isHeader: true };
        }
        accumCell(headerMap[hKey], cid, r);

        const tKey = [showYear ? (r.year ?? '') : '', r.make ?? '', modelLabel, r.trim ?? ''].join('|');
        if (!trimMap[tKey]) {
          trimMap[tKey] = { _year: showYear ? (r.year ?? null) : null, _make: r.make ?? '', _model: modelLabel, _trim: r.trim ?? '', _isHeader: false, _hKey: hKey };
        }
        accumCell(trimMap[tKey], cid, r);
      });

      const groups = Object.entries(headerMap).sort(([, a], [, b]) => {
        if (showYear && sortBy === 'year') {
          const yc = ((a._year || 0) - (b._year || 0)) * dir;
          if (yc !== 0) return yc;
          return (a._model || '').localeCompare(b._model || '');
        }
        if (sortBy === 'make') {
          const mkc = (a._make || '').localeCompare(b._make || '') * dir;
          if (mkc !== 0) return mkc;
          return (a._model || '').localeCompare(b._model || '');
        }
        const mc = (a._model || '').localeCompare(b._model || '') * dir;
        if (mc !== 0) return mc;
        return showYear ? ((a._year || 0) - (b._year || 0)) : 0;
      });

      const flat = [];
      groups.forEach(([hKey, header]) => {
        flat.push(header);
        const children = Object.values(trimMap)
          .filter(t => t._hKey === hKey)
          .sort((a, b) => (a._trim || '').localeCompare(b._trim || ''));
        children.forEach(t => flat.push(t));
      });
      return flat;

    } else {
      const rowMap = {};
      filteredRows.forEach(r => {
        const key = makeKey(r);
        if (!rowMap[key]) {
          rowMap[key] = {
            _year: showYear ? (r.year ?? null) : null,
            _make: r.make ?? '',
            _model: r.model ?? r.raw_title ?? '',
            _isHeader: false,
          };
        }
        accumCell(rowMap[key], r.competitor_id, r);
      });

      const sorted = Object.values(rowMap).sort((a, b) => {
        if (showYear && sortBy === 'year') {
          const yc = ((a._year || 0) - (b._year || 0)) * dir;
          if (yc !== 0) return yc;
          return (a._model || '').localeCompare(b._model || '');
        }
        if (showMake && sortBy === 'make') {
          const mkc = (a._make || '').localeCompare(b._make || '') * dir;
          if (mkc !== 0) return mkc;
          return (a._model || '').localeCompare(b._model || '');
        }
        const mc = (a._model || '').localeCompare(b._model || '') * dir;
        if (mc !== 0) return mc;
        if (showYear) return (a._year || 0) - (b._year || 0);
        return 0;
      });

      // ── DIAGNOSTIC: pivot cell coverage ──
      const cidWithCells = new Set();
      sorted.forEach(row => competitorIds.forEach(cid => { if (row[cid] != null) cidWithCells.add(cid); }));
      const cidWithNoCells = competitorIds.filter(c => !cidWithCells.has(c));
      console.log('[Pivot] competitor_ids with at least 1 cell in pivot:', [...cidWithCells]);
      if (cidWithNoCells.length) console.warn('[Pivot] competitor_ids with ZERO cells in pivot (column exists but all blank):', cidWithNoCells);
      console.log(`[Pivot] pivot rows=${sorted.length}, columns=${competitorIds.length}`);

      return sorted;
    }
  }, [filteredRows, priceMode, showYear, showTrim, showMake, sortBy, sortDir, competitorIds]);

  const isGroupedHierarchy = showTrim;
  const makeColPx = 90;
  const modelColPx = isGroupedHierarchy ? 220 : 180;
  const yearColPx = 52;
  const dataColPx = priceMode === 'all' ? 85 : 110;
  const dealerColSpan = priceMode === 'all' ? 2 : 1;
  const totalWidth = (showYear ? yearColPx : 0) + (showMake ? makeColPx : 0) + modelColPx + dataColPx * dealerColSpan * competitorIds.length;

  if (!storeName || !dealershipKey) {
    return <div className="text-gray-400 text-sm py-10 text-center">Select a store to view inventory data.</div>;
  }

  if (isLoading || isFetching) {
    return <div className="text-gray-400 text-sm py-10 text-center">Loading...</div>;
  }



  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <SnapshotDatePicker dates={availableDates} datesMeta={availableDatesMeta} selected={snapshotDate} onChange={setSnapshotDate} perDealerDates={perDealerDates} />
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No inventory data found for this dealer.</p>
          <p className="text-gray-300 text-xs mt-1">Data is imported via scraper into the <code>competitor_inventory_pricing</code> Supabase table.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="sticky top-0 z-20 bg-gray-50 py-4 flex flex-wrap items-center gap-3">
        <SnapshotDatePicker dates={availableDates} datesMeta={availableDatesMeta} selected={snapshotDate} onChange={setSnapshotDate} perDealerDates={perDealerDates} />

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setPriceMode('all')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${priceMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>All Columns</button>
          <button onClick={() => setPriceMode('inventory')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${priceMode === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Inventory Count</button>
          <button onClick={() => setPriceMode('low')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${priceMode === 'low' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Low Price</button>
        </div>

        {makes.length > 1 && (
          <select value={makeFilter} onChange={e => { setMakeFilter(e.target.value); setModelFilter('all'); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
            <option value="all">All Makes</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        {years.length > 1 && (
          <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setModelFilter('all'); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
          <option value="all">All Models</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showYear} onChange={e => setShowYear(e.target.checked)} className="rounded" />
          By Year
        </label>

        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showTrim} onChange={e => setShowTrim(e.target.checked)} className="rounded" />
          By Trim
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-auto">
        <table className="text-sm" style={{ tableLayout: 'fixed', width: `${totalWidth}px` }}>
          <colgroup>
            {showYear && <col style={{ width: `${yearColPx}px` }} />}
            {showMake && <col style={{ width: `${makeColPx}px` }} />}
            <col style={{ width: `${modelColPx}px` }} />
            {competitorIds.map(cid => priceMode === 'all'
              ? [<col key={`${cid}-c`} style={{ width: `${dataColPx}px` }} />, <col key={`${cid}-l`} style={{ width: `${dataColPx}px` }} />]
              : <col key={cid} style={{ width: `${dataColPx}px` }} />
            )}
          </colgroup>
          <thead>
            {priceMode === 'all' && (
              <tr className="border-b border-gray-100 bg-gray-50">
                {showYear && <th />}
                {showMake && <th />}
                <th />
                {competitorIds.map(cid => (
                  <th key={cid} colSpan={2} className={`py-2 px-2 text-center text-xs font-bold border-l border-gray-200 leading-tight ${cid === clientStoreKey ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>
                    {competitorIdToName[cid] || cid}
                  </th>
                ))}
              </tr>
            )}
            <tr className="border-b border-gray-200 bg-gray-50">
              {showYear && (
                <th
                  className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                  style={{ color: sortBy === 'year' ? '#2563eb' : '#9ca3af' }}
                  onClick={() => handleSort('year')}
                >
                  <span className="inline-flex items-center justify-center gap-0.5">
                    Yr
                    {sortBy === 'year'
                      ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                      : <ChevronsUpDown size={11} className="opacity-40" />}
                  </span>
                </th>
              )}
              {showMake && (
                <th
                  className="py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                  style={{ color: sortBy === 'make' ? '#2563eb' : '#9ca3af' }}
                  onClick={() => handleSort('make')}
                >
                  <span className="inline-flex items-center gap-0.5">
                    Make
                    {sortBy === 'make'
                      ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                      : <ChevronsUpDown size={11} className="opacity-40" />}
                  </span>
                </th>
              )}
              <th
                className="py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                style={{ color: sortBy === 'model' ? '#2563eb' : '#9ca3af' }}
                onClick={() => handleSort('model')}
              >
                <span className="inline-flex items-center gap-0.5">
                  {isGroupedHierarchy ? 'Model / Trim' : 'Model'}
                  {sortBy === 'model'
                    ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                    : <ChevronsUpDown size={11} className="opacity-40" />}
                </span>
              </th>
              {competitorIds.map(cid => priceMode === 'all' ? (
                <React.Fragment key={cid}>
                  <th className={`py-2 px-1 text-center text-xs font-semibold border-l border-gray-200 ${cid === clientStoreKey ? 'bg-blue-50 text-blue-600' : 'text-blue-500'}`}>Inv</th>
                  <th className={`py-2 px-1 text-center text-xs font-semibold ${cid === clientStoreKey ? 'bg-blue-50 text-emerald-700' : 'text-emerald-600'}`}>Low $</th>
                </React.Fragment>
              ) : (
                <th key={cid} className={`py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider leading-tight break-words ${cid === clientStoreKey ? 'bg-blue-50 text-blue-700' : 'text-gray-400'}`}>
                  {competitorIdToName[cid] || cid}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Totals row */}
            <tr className="border-b-2 border-gray-300 bg-blue-50 font-bold">
              {showYear && <td />}
              {showMake && <td />}
              <td className="py-2 px-3 text-xs font-bold text-gray-700">Total</td>
              {competitorIds.map(cid => priceMode === 'all' ? (
                <React.Fragment key={cid}>
                  <td className={`py-2 px-1 text-center text-xs font-bold text-blue-700 tabular-nums border-l border-gray-200 ${cid === clientStoreKey ? 'bg-blue-100' : ''}`}>{grandTotals[cid] || ''}</td>
                  <td className={cid === clientStoreKey ? 'bg-blue-100' : ''} />
                </React.Fragment>
              ) : (
                <td key={cid} className={`py-2 px-2 text-center text-xs font-bold text-blue-700 tabular-nums ${cid === clientStoreKey ? 'bg-blue-100' : ''}`}>
                  {priceMode === 'inventory' ? (grandTotals[cid] || '') : ''}
                </td>
              ))}
            </tr>
            {pivotData.map((row, i) => {
              const isHeader = !!row._isHeader;
              // Color scale is per model: dealers in this row are ranked against each other
              const range = rowRange(row, competitorIds, priceMode);
              const rowMin = range ? range.min : 0;
              const rowMax = range ? range.max : 0;

              return (
                <tr
                  key={i}
                  className={`border-b border-gray-100 ${isHeader ? 'bg-gray-50/60' : ''}`}
                >
                  {showYear && (
                    <td className="py-2 px-2 text-center text-xs text-gray-500 tabular-nums font-medium">
                      {isGroupedHierarchy ? (isHeader ? (row._year ?? '') : '') : (row._year ?? '')}
                    </td>
                  )}
                  {showMake && (
                    <td className="py-2 px-3 text-xs text-gray-500">
                      {isGroupedHierarchy ? (isHeader ? (row._make || '—') : '') : (row._make || '—')}
                    </td>
                  )}
                  {isGroupedHierarchy ? (
                    <td className={`py-2 text-xs ${isHeader ? 'px-3 font-bold text-gray-800' : 'pl-6 pr-3 font-normal text-gray-500 italic'}`}>
                      {isHeader ? (row._model || '—') : (row._trim || '—')}
                    </td>
                  ) : (
                    <td className="py-2 px-3 text-xs font-medium text-gray-800">
                      {row._model || '—'}
                    </td>
                  )}
                  {competitorIds.map(cid => {
                    const isClient = cid === clientStoreKey;
                    if (priceMode === 'all') {
                      const all = row[cid];
                      const countStyle = all?.count != null ? blueShade(all.count, rowMin, rowMax) : {};
                      return (
                        <React.Fragment key={cid}>
                          <td className={`py-2 px-1 tabular-nums text-center text-xs ${isHeader ? 'font-bold' : 'font-semibold'} border-l border-gray-100 ${isClient ? 'bg-blue-50/60' : ''}`} style={countStyle || {}}>
                            {all?.count ?? ''}
                          </td>
                          <td className={`py-2 px-1 tabular-nums text-center text-xs ${isHeader ? 'font-bold' : ''} text-emerald-700 ${isClient ? 'bg-blue-50/60' : ''}`}>
                            {all?.low != null && all.low > 0 ? <><sup className="text-[9px]">$</sup>{all.low.toLocaleString()}</> : ''}
                          </td>
                        </React.Fragment>
                      );
                    }
                    const val = row[cid];
                    const numVal = priceMode === 'inventory' ? val : val?.num ?? null;
                    const dispText = priceMode !== 'inventory' ? val?.disp ?? null : null;
                    const style = numVal != null
                      ? (priceMode === 'inventory' ? blueShade(numVal, rowMin, rowMax) : blueShadePrice(numVal, rowMin, rowMax))
                      : (isClient ? { backgroundColor: 'rgba(219,234,254,0.4)' } : {});
                    return (
                      <td
                        key={cid}
                        className={`py-2 px-2 tabular-nums text-center text-xs font-semibold ${isHeader ? '' : 'font-normal'}`}
                        style={style || {}}
                      >
                        {priceMode === 'inventory'
                          ? (val ?? '')
                          : (val != null ? <PriceDisplay numericValue={numVal} priceText={dispText} /> : '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-5 py-2 text-xs text-gray-400">
          {priceMode === 'all'
            ? 'Inv = unit count (blue intensity, ranked within each model). Low $ = lowest listed price.'
            : priceMode === 'inventory'
              ? 'Blue intensity ranks dealers within each model (darker = most units for that model). Blank = no inventory.'
              : 'Darker blue = lowest price for that model (best deal).'}
          {' New inventory only.'}
          {snapshotDate
            ? ` Snapshot: ${format(new Date(snapshotDate + 'T12:00:00'), 'MMM d, yyyy')}`
            : ` Latest available snapshot per competitor.`
          }
        </p>
      </div>
    </div>
  );
}