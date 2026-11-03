import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { ChevronUp, ChevronDown, ChevronsUpDown, ShoppingBag } from 'lucide-react';
import SnapshotDatePicker from './SnapshotDatePicker';
import { useDealer } from '@/lib/DealerContext';
import { normalizeMake, normalizeModel } from '@/lib/vehicleNormalization';

function emeraldShade(val, min, max) {
  if (val == null || max === 0 || min === max) return null;
  const ratio = (val - min) / (max - min);
  const opacity = 0.12 + ratio * 0.78;
  return { backgroundColor: `rgba(16, 185, 129, ${opacity.toFixed(2)})`, color: ratio > 0.5 ? 'white' : '#064e3b' };
}

function emeraldShadePrice(val, min, max) {
  if (val == null || max === 0 || min === max) return {};
  const ratio = 1 - (val - min) / (max - min);
  const opacity = 0.12 + ratio * 0.78;
  return { backgroundColor: `rgba(16, 185, 129, ${opacity.toFixed(2)})`, color: ratio > 0.5 ? 'white' : '#064e3b' };
}

// Per-model (per-row) min/max so each model's dealerships rank against each other
function rowRange(row, competitorIds, priceMode) {
  let min = Infinity, max = -Infinity;
  competitorIds.forEach(cid => {
    const cell = row[cid];
    let num;
    if (priceMode === 'all') num = cell?.count ?? null;
    else if (priceMode === 'units') num = cell;
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

export default function SoldVehiclesView({ store }) {
  const { isDealerLoading } = useDealer();
  const searchParams = useSearchParams();

  const paramTrim = searchParams?.get('trim');
  const paramYear = searchParams?.get('year');
  const paramDate = searchParams?.get('date');
  const paramMode = searchParams?.get('mode') || searchParams?.get('columns');

  const storeId = store?.id || null;
  const storeName = store?.name || null;
  const dealershipKey = store?.dealership_key || null;

  const [snapshotDate, setSnapshotDate] = useState(() => paramDate || null);
  const [priceMode, setPriceMode] = useState(() => paramMode === 'all' ? 'all' : 'units'); // 'units' | 'all'

  // Reset snapshot date whenever dealershipKey changes (unless paramDate is specified)
  const prevDealershipKeyRef = useRef(dealershipKey);
  if (prevDealershipKeyRef.current !== dealershipKey) {
    prevDealershipKeyRef.current = dealershipKey;
    setSnapshotDate(paramDate || null);
  }

  const [modelFilter, setModelFilter] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const initialShowYear = paramYear === 'false' || paramYear === '0' ? false : true;
  const initialShowTrim = paramTrim === 'true' || paramTrim === '1' ? true : false;

  const [showYear, setShowYear] = useState(initialShowYear);
  const [showTrim, setShowTrim] = useState(initialShowTrim);

  // Synchronize state if URL params change dynamically
  useEffect(() => {
    if (paramTrim === 'true' || paramTrim === '1') {
      setShowTrim(true);
    } else if (paramTrim === 'false' || paramTrim === '0') {
      setShowTrim(false);
    }
    if (paramYear === 'true' || paramYear === '1') {
      setShowYear(true);
    } else if (paramYear === 'false' || paramYear === '0') {
      setShowYear(false);
    }
    if (paramMode === 'all') {
      setPriceMode('all');
    }
    if (paramDate) {
      setSnapshotDate(paramDate);
    }
  }, [paramTrim, paramYear, paramMode, paramDate]);

  const [sortBy, setSortBy] = useState('year');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey: ['competitorSoldVehicles', storeId, dealershipKey, snapshotDate ?? '__latest__'],
    enabled: !!dealershipKey,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => {
      const payload = {
        dealer_id: dealershipKey,
        snapshot_date: snapshotDate ?? null,
      };
      return base44.functions.invoke('supabaseCompetitorSold', payload).then(r => r.data);
    },
  });

  const availableDates = result?.available_dates || [];
  const activeDate = result?.snapshot_date;

  // Find a representative prior date for the banner
  const samplePriorDate = useMemo(() => {
    const dates = Object.values(result?.per_dealer_prior_dates || {}).filter(Boolean);
    return dates[0] || null;
  }, [result?.per_dealer_prior_dates]);

  const competitorIdToName = useMemo(() => {
    const base = result?.competitor_id_to_name || {};
    const raw = result?.data || [];
    const extended = { ...base };
    raw.forEach(r => {
      if (!r.competitor_id && r.competitor_dealer_name) {
        extended[r.competitor_dealer_name] = r.competitor_dealer_name;
      }
    });
    return extended;
  }, [result]);

  const clientStoreKey = useMemo(() => dealershipKey, [dealershipKey]);

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

    return ids;
  }, [result, dealershipKey, competitorIdToName, clientStoreKey]);

  const rows = useMemo(() => {
    const raw = result?.data || [];
    const valid = raw.filter(r => r.competitor_id || r.competitor_dealer_name);
    return valid.map(r => {
      const normMake = normalizeMake(r.make) || r.make || '';
      const normModel = normalizeModel(normMake, r.model) || r.model || '';
      return {
        ...r,
        competitor_id: r.competitor_id || r.competitor_dealer_name,
        make: normMake,
        model: normModel,
      };
    });
  }, [result]);

  const typeFilteredRows = useMemo(() => {
    return rows.filter(r => (r.model || '').trim().toLowerCase() !== 'total');
  }, [rows]);

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

  const accumCell = useCallback((pivotRow, competitorId, srcRow) => {
    const inv = (srcRow.inventory_count != null && srcRow.inventory_count > 0) ? srcRow.inventory_count : 1;
    const lp = (srcRow.list_price != null && Number(srcRow.list_price) > 0) ? Number(srcRow.list_price) : null;

    if (priceMode === 'all') {
      if (!pivotRow[competitorId]) pivotRow[competitorId] = { count: 0, totalPrice: 0, validPriceCount: 0, avg: null };
      pivotRow[competitorId].count += inv;
      if (lp != null) {
        pivotRow[competitorId].totalPrice += lp;
        pivotRow[competitorId].validPriceCount += 1;
        pivotRow[competitorId].avg = Math.round(pivotRow[competitorId].totalPrice / pivotRow[competitorId].validPriceCount);
      }
    } else {
      pivotRow[competitorId] = (pivotRow[competitorId] || 0) + inv;
    }
  }, [priceMode]);

  const filteredRows = useMemo(() => {
    return typeFilteredRows.filter(r =>
      (makeFilter === 'all' || r.make === makeFilter) &&
      (yearFilter === 'all' || Number(r.year) === Number(yearFilter)) &&
      (modelFilter === 'all' || r.model === modelFilter)
    );
  }, [typeFilteredRows, makeFilter, modelFilter, yearFilter]);

  const grandTotals = useMemo(() => {
    const totals = {};
    filteredRows.forEach(r => {
      const cid = r.competitor_id;
      const inv = (r.inventory_count != null && r.inventory_count > 0) ? r.inventory_count : 1;
      totals[cid] = (totals[cid] || 0) + inv;
    });
    return totals;
  }, [filteredRows]);

  const totalSoldAllCompetitors = useMemo(() => {
    return Object.values(grandTotals).reduce((sum, n) => sum + (n || 0), 0);
  }, [grandTotals]);

  const pivotData = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;

    const makeKey = (r) => [
      showYear ? (r.year ?? '') : '',
      r.make ?? '',
      r.model ?? r.raw_title ?? '',
    ].join('|');

    if (showTrim) {
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

      return Object.values(rowMap).sort((a, b) => {
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
    }
  }, [filteredRows, priceMode, showYear, showTrim, showMake, sortBy, sortDir, competitorIds, accumCell]);

  const isGroupedHierarchy = showTrim;
  const makeColPx = 90;
  const modelColPx = isGroupedHierarchy ? 220 : 180;
  const yearColPx = 52;
  const dataColPx = priceMode === 'all' ? 85 : 110;
  const dealerColSpan = priceMode === 'all' ? 2 : 1;
  const totalWidth = (showYear ? yearColPx : 0) + (showMake ? makeColPx : 0) + modelColPx + dataColPx * dealerColSpan * competitorIds.length;

  const yearLeft = 0;
  const makeLeft = showYear ? yearColPx : 0;
  const modelLeft = (showYear ? yearColPx : 0) + (showMake ? makeColPx : 0);

  if (!storeName || !dealershipKey) {
    return <div className="text-gray-400 text-sm py-10 text-center">Select a store to view sold vehicles.</div>;
  }

  if (isLoading || isFetching) {
    return <div className="text-gray-400 text-sm py-10 text-center">Loading sold vehicles data...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <SnapshotDatePicker dates={availableDates} selected={snapshotDate} onChange={setSnapshotDate} />
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold text-base">No sold vehicles detected for this snapshot</p>
          <p className="text-gray-400 text-xs mt-1 max-w-md mx-auto">
            Sold vehicles are determined by VINs tracked in the prior day&apos;s scrape that were removed from the website on the current date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Informative Comparison Banner */}
      {activeDate && (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Tracking vehicles removed from competitor websites between{' '}
              <strong className="font-bold text-emerald-950">
                {samplePriorDate ? format(parseISO(samplePriorDate), 'MMM d, yyyy') : 'Prior Day'}
              </strong>{' '}
              and{' '}
              <strong className="font-bold text-emerald-950">
                {format(parseISO(activeDate), 'MMM d, yyyy')}
              </strong>
            </span>
          </div>
          <div className="text-emerald-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-sm">
            {totalSoldAllCompetitors} Total Units Sold / Delisted
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="sticky top-0 z-20 bg-gray-50 py-2 flex flex-wrap items-center gap-3">
        <SnapshotDatePicker dates={availableDates} selected={snapshotDate} onChange={setSnapshotDate} />

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setPriceMode('units')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              priceMode === 'units' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Units Sold
          </button>
          <button
            onClick={() => setPriceMode('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              priceMode === 'all' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            All Columns (Units & Avg $)
          </button>
        </div>

        {makes.length > 1 && (
          <select
            value={makeFilter}
            onChange={e => { setMakeFilter(e.target.value); setModelFilter('all'); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
          >
            <option value="all">All Makes</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        {years.length > 1 && (
          <select
            value={yearFilter}
            onChange={e => { setYearFilter(e.target.value); setModelFilter('all'); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
          >
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        <select
          value={modelFilter}
          onChange={e => setModelFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
        >
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
      <div className="bg-white rounded-2xl border border-gray-100 overflow-auto max-h-[calc(100vh-210px)] min-h-[450px]">
        <table className="text-sm" style={{ tableLayout: 'fixed', width: `${totalWidth}px`, borderCollapse: 'separate', borderSpacing: 0 }}>
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
                {showYear && (
                  <th
                    rowSpan={2}
                    style={{ position: 'sticky', top: 0, left: `${yearLeft}px`, zIndex: 30, width: `${yearColPx}px` }}
                    className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-emerald-700 transition-colors bg-gray-50 border-b border-gray-200"
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
                    rowSpan={2}
                    style={{ position: 'sticky', top: 0, left: `${makeLeft}px`, zIndex: 30, width: `${makeColPx}px` }}
                    className="py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-emerald-700 transition-colors bg-gray-50 border-b border-gray-200"
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
                  rowSpan={2}
                  style={{ position: 'sticky', top: 0, left: `${modelLeft}px`, zIndex: 30, width: `${modelColPx}px` }}
                  className="py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-emerald-700 transition-colors bg-gray-50 border-b border-gray-200 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
                  onClick={() => handleSort('model')}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {isGroupedHierarchy ? 'Model / Trim' : 'Model'}
                    {sortBy === 'model'
                      ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                      : <ChevronsUpDown size={11} className="opacity-40" />}
                  </span>
                </th>
                {competitorIds.map(cid => (
                  <th
                    key={cid}
                    colSpan={2}
                    style={{ position: 'sticky', top: 0, zIndex: 20 }}
                    className={`py-2 px-2 text-center text-xs font-bold border-l border-b border-gray-200 leading-tight ${
                      cid === clientStoreKey ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {competitorIdToName[cid] || cid}
                  </th>
                ))}
              </tr>
            )}
            <tr className="border-b border-gray-200 bg-gray-50">
              {priceMode !== 'all' && (
                <>
                  {showYear && (
                    <th
                      style={{ position: 'sticky', top: 0, left: `${yearLeft}px`, zIndex: 30, width: `${yearColPx}px` }}
                      className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-emerald-700 transition-colors bg-gray-50 border-b border-gray-200"
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
                      style={{ position: 'sticky', top: 0, left: `${makeLeft}px`, zIndex: 30, width: `${makeColPx}px` }}
                      className="py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-emerald-700 transition-colors bg-gray-50 border-b border-gray-200"
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
                    style={{ position: 'sticky', top: 0, left: `${modelLeft}px`, zIndex: 30, width: `${modelColPx}px` }}
                    className="py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-emerald-700 transition-colors bg-gray-50 border-b border-gray-200 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
                    onClick={() => handleSort('model')}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {isGroupedHierarchy ? 'Model / Trim' : 'Model'}
                      {sortBy === 'model'
                        ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                        : <ChevronsUpDown size={11} className="opacity-40" />}
                    </span>
                  </th>
                </>
              )}
              {competitorIds.map(cid => priceMode === 'all' ? (
                <React.Fragment key={cid}>
                  <th
                    style={{ position: 'sticky', top: '34px', zIndex: 20 }}
                    className={`py-1.5 px-1 text-center text-xs font-semibold border-l border-b border-gray-200 ${
                      cid === clientStoreKey ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-50 text-emerald-600'
                    }`}
                  >
                    Sold
                  </th>
                  <th
                    style={{ position: 'sticky', top: '34px', zIndex: 20 }}
                    className={`py-1.5 px-1 text-center text-xs font-semibold border-b border-gray-200 ${
                      cid === clientStoreKey ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-50 text-slate-600'
                    }`}
                  >
                    Avg $
                  </th>
                </React.Fragment>
              ) : (
                <th
                  key={cid}
                  style={{ position: 'sticky', top: 0, zIndex: 20 }}
                  className={`py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider leading-tight break-words bg-gray-50 border-b border-gray-200 ${
                    cid === clientStoreKey ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-gray-500'
                  }`}
                >
                  {competitorIdToName[cid] || cid}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Totals row */}
            <tr className="border-b-2 border-gray-300 bg-emerald-50/70 font-bold">
              {showYear && (
                <td style={{ position: 'sticky', left: `${yearLeft}px`, zIndex: 10 }} className="bg-emerald-50/70 border-b-2 border-gray-300" />
              )}
              {showMake && (
                <td style={{ position: 'sticky', left: `${makeLeft}px`, zIndex: 10 }} className="bg-emerald-50/70 border-b-2 border-gray-300" />
              )}
              <td
                style={{ position: 'sticky', left: `${modelLeft}px`, zIndex: 10 }}
                className="py-2.5 px-3 text-xs font-bold text-emerald-950 bg-emerald-50/70 border-b-2 border-gray-300 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
              >
                Total Sold
              </td>
              {competitorIds.map(cid => priceMode === 'all' ? (
                <React.Fragment key={cid}>
                  <td className={`py-2.5 px-1 text-center text-xs font-bold text-emerald-900 tabular-nums border-l border-b-2 border-gray-300 ${
                    cid === clientStoreKey ? 'bg-emerald-100' : 'bg-emerald-50/70'
                  }`}>
                    {grandTotals[cid] || ''}
                  </td>
                  <td className={`border-b-2 border-gray-300 ${cid === clientStoreKey ? 'bg-emerald-100' : 'bg-emerald-50/70'}`} />
                </React.Fragment>
              ) : (
                <td
                  key={cid}
                  className={`py-2.5 px-2 text-center text-xs font-bold text-emerald-900 tabular-nums border-b-2 border-gray-300 ${
                    cid === clientStoreKey ? 'bg-emerald-100' : 'bg-emerald-50/70'
                  }`}
                >
                  {grandTotals[cid] || ''}
                </td>
              ))}
            </tr>
            {pivotData.map((row, i) => {
              const isHeader = !!row._isHeader;
              const range = rowRange(row, competitorIds, priceMode);
              const rowMin = range ? range.min : 0;
              const rowMax = range ? range.max : 0;
              const rowBg = isHeader ? 'bg-gray-100' : (i % 2 === 1 ? 'bg-slate-50' : 'bg-white');

              return (
                <tr
                  key={i}
                  className={`border-b border-gray-100 ${isHeader ? 'bg-gray-50/80 font-semibold' : ''}`}
                >
                  {showYear && (
                    <td
                      style={{ position: 'sticky', left: `${yearLeft}px`, zIndex: 10 }}
                      className={`py-2 px-2 text-center text-xs text-gray-500 tabular-nums font-medium ${rowBg} border-b border-gray-100`}
                    >
                      {isGroupedHierarchy ? (isHeader ? (row._year ?? '') : '') : (row._year ?? '')}
                    </td>
                  )}
                  {showMake && (
                    <td
                      style={{ position: 'sticky', left: `${makeLeft}px`, zIndex: 10 }}
                      className={`py-2 px-3 text-xs text-gray-500 ${rowBg} border-b border-gray-100`}
                    >
                      {isGroupedHierarchy ? (isHeader ? (row._make || '—') : '') : (row._make || '—')}
                    </td>
                  )}
                  {isGroupedHierarchy ? (
                    <td
                      style={{ position: 'sticky', left: `${modelLeft}px`, zIndex: 10 }}
                      className={`py-2 text-xs ${isHeader ? 'px-3 font-bold text-gray-800' : 'pl-6 pr-3 font-normal text-gray-500 italic'} ${rowBg} border-b border-gray-100 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]`}
                    >
                      {isHeader ? (row._model || '—') : (row._trim || '—')}
                    </td>
                  ) : (
                    <td
                      style={{ position: 'sticky', left: `${modelLeft}px`, zIndex: 10 }}
                      className={`py-2 px-3 text-xs font-medium text-gray-800 ${rowBg} border-b border-gray-100 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]`}
                    >
                      {row._model || '—'}
                    </td>
                  )}
                  {competitorIds.map(cid => {
                    const isClient = cid === clientStoreKey;
                    if (priceMode === 'all') {
                      const all = row[cid];
                      const countStyle = all?.count != null ? emeraldShade(all.count, rowMin, rowMax) : {};
                      return (
                        <React.Fragment key={cid}>
                          <td
                            className={`py-2 px-1 tabular-nums text-center text-xs ${isHeader ? 'font-bold' : 'font-semibold'} border-l border-b border-gray-100 ${isClient ? 'bg-emerald-50/60' : ''}`}
                            style={countStyle || {}}
                          >
                            {all?.count ?? ''}
                          </td>
                          <td className={`py-2 px-1 tabular-nums text-center text-xs ${isHeader ? 'font-bold' : ''} text-slate-700 border-b border-gray-100 ${isClient ? 'bg-emerald-50/60' : ''}`}>
                            {all?.avg != null && all.avg > 0 ? <><sup className="text-[9px]">$</sup>{all.avg.toLocaleString()}</> : ''}
                          </td>
                        </React.Fragment>
                      );
                    }
                    const val = row[cid];
                    const numVal = val != null ? val : null;
                    const style = numVal != null
                      ? emeraldShade(numVal, rowMin, rowMax)
                      : (isClient ? { backgroundColor: 'rgba(209, 250, 229, 0.35)' } : {});
                    return (
                      <td
                        key={cid}
                        className={`py-2 px-2 tabular-nums text-center text-xs font-semibold border-b border-gray-100 ${isHeader ? '' : 'font-normal'}`}
                        style={style || {}}
                      >
                        {val ?? ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-5 py-2 text-xs text-gray-400">
          Green intensity ranks who sold the most units for each model. Blank = 0 sold units detected between snapshots.
          {activeDate
            ? ` Snapshot: ${format(parseISO(activeDate), 'MMM d, yyyy')}`
            : ' Latest available snapshot per competitor.'
          }
        </p>
      </div>
    </div>
  );
}
