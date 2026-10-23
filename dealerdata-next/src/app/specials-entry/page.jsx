'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bot, PencilLine, Car, Wrench, ExternalLink } from 'lucide-react';
import { SPECIALS_STORES, getSpecialsStore, getDealerOptions, getCompetitorByName } from '@/lib/specialsStoreConfig';
import VehicleSpecialsTable from '@/components/specials/VehicleSpecialsTable';
import ServiceSpecialsTable from '@/components/specials/ServiceSpecialsTable';
import { useToast } from '@/components/ui/use-toast';

const todayStr = () => new Date().toISOString().slice(0, 10);
const LS_KEY = (storeId, type, dealer) => `specials_draft_${storeId}_${type}_${dealer}`;

// Normalize a staging row so it matches the editor row shape.
function normalizeStagingRow(r) {
  const SOURCES = ['Homepage', 'Specials Page'];
  const rawSrc = (r.source || r.source_file_name || 'Specials Page').toLowerCase();
  const source = rawSrc.includes('home') || rawSrc.includes('slider') ? 'Homepage' : 'Specials Page';
  return {
    ...r,
    offer_dealer_name: r.offer_dealer_name || r.client_dealer_name || '',
    offer_details: r.offer_details ?? r.offer_description ?? '',
    source,
  };
}

export default function SpecialsEntryTool() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [storeValue, setStoreValue] = useState(SPECIALS_STORES[0].value);
  const store = getSpecialsStore(storeValue);
  const dealerOptions = useMemo(() => getDealerOptions(store), [store]);

  const [entryTab, setEntryTab] = useState('vehicle');
  const [selectedDealer, setSelectedDealer] = useState(dealerOptions[0]?.value || '');
  const [snapshotDate, setSnapshotDate] = useState(todayStr());

  const [vehicleRows, setVehicleRows] = useState([]);
  const [serviceRows, setServiceRows] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [loadedDate, setLoadedDate] = useState(null);

  const [viewMode, setViewMode] = useState('manual'); // 'manual' (AI review tab hidden)

  // AI mode: busy + fade tracking
  const [busyIds, setBusyIds] = useState(new Set());
  const [fadeIds, setFadeIds] = useState(new Set());

  const today = todayStr();

  // Reset state on store change
  useEffect(() => {
    setSelectedDealer(dealerOptions[0]?.value || '');
    setVehicleRows([]);
    setServiceRows([]);
    setSnapshotDate(todayStr());
    setLastSavedAt(null);
    setLoadedDate(null);
    setViewMode('manual');
    setFadeIds(new Set());
    setBusyIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeValue]);

  // Staging rows for today
  const { data: stagingData } = useQuery({
    queryKey: ['specialsStaging', store?.dealer_id, snapshotDate],
    enabled: !!store,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => (await base44.functions.invoke('getSpecialsStaging', { dealer_id: store.dealer_id, snapshot_date: snapshotDate })).data,
  });
  const stagingCount = stagingData?.count || 0;
  const hasStaging = stagingCount > 0;

  useEffect(() => {
    if (viewMode === 'ai' && !hasStaging) setViewMode('manual');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStaging]);

  // Manual mode: auto-load most recent snapshot for the selected dealer + tab
  const loadKey = entryTab === 'vehicle' ? 'vehicle' : 'service';
  const { data: autoloadData, isFetching: isLoadingSpecials } = useQuery({
    queryKey: ['specialsAutoload', store?.dealer_id, selectedDealer, loadKey],
    enabled: !!store && !!selectedDealer && viewMode === 'manual',
    staleTime: 0,
    queryFn: async () => (await base44.functions.invoke('autoLoadSpecials', { dealer_id: store.dealer_id, offer_dealer_name: selectedDealer, special_type: loadKey })).data,
  });

  // SINGLE effect that owns row state — no separate reset effect, no race condition.
  // When autoloadData is undefined (new query fetching): clear rows for current tab.
  // When autoloadData arrives: set rows for current tab.
  useEffect(() => {
    if (viewMode !== 'manual') return;
    if (!autoloadData) {
      if (entryTab === 'vehicle') setVehicleRows([]);
      else setServiceRows([]);
      setLoadedDate(null);
      setLastSavedAt(null);
      return;
    }
    const rows = (autoloadData.data || []).map(r => ({
      ...r,
      offer_dealer_name: r.offer_dealer_name || r.client_dealer_name || selectedDealer,
      source: r.source || 'Specials Page',
    }));
    if (entryTab === 'vehicle') setVehicleRows(rows);
    else setServiceRows(rows);
    setLoadedDate(autoloadData.loaded_date || null);
    if (autoloadData.last_updated) setLastSavedAt(autoloadData.last_updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoloadData, entryTab, selectedDealer, viewMode]);

  // Staging rows filtered to selected dealer (AI mode) — normalized.
  const stagingRowsForDealer = useMemo(() => {
    if (viewMode !== 'ai' || !stagingData) return [];
    const all = stagingData.rows || [];
    return all
      .filter(r => (r.offer_dealer_name || r.client_dealer_name) === selectedDealer)
      .map(normalizeStagingRow);
  }, [stagingData, selectedDealer, viewMode]);

  // Manual save — ref guard prevents duplicate fires from rapid clicks
  // (before isSaving disables the button).
  const savingRef = useRef(false);
  const handleSave = async () => {
    if (!selectedDealer || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const rows = entryTab === 'vehicle' ? vehicleRows : serviceRows;
      await base44.functions.invoke('saveSpecials', {
        dealer_id: store.dealer_id,
        client_dealer_name: store.label,
        group_name: store.group_name,
        offer_dealer_name: selectedDealer,
        snapshot_date: snapshotDate,
        special_type: entryTab,
        rows,
      });
      setLastSavedAt(new Date().toISOString());
      setLoadedDate(snapshotDate);
      queryClient.invalidateQueries(['specialsAutoload', store.dealer_id, selectedDealer, entryTab]);
      toast({ title: 'Specials saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Staging approve/reject with fade animation
  const refreshAfterStagingChange = () => {
    queryClient.invalidateQueries(['specialsStaging', store.dealer_id, snapshotDate]);
  };

  const approveOne = async (row, edits) => {
    setBusyIds(prev => new Set(prev).add(row.id));
    try {
      const res = await base44.functions.invoke('approveSpecial', { staging_id: row.id, edits });
      if (res.data?.ok) {
        const id = row.id;
        setFadeIds(prev => new Set(prev).add(id));
        setTimeout(() => {
          setFadeIds(prev => { const n = new Set(prev); n.delete(id); return n; });
          if (entryTab === 'vehicle') setVehicleRows(prev => prev.filter(r => r.id !== id));
          else setServiceRows(prev => prev.filter(r => r.id !== id));
        }, 2000);
        refreshAfterStagingChange();
      } else {
        toast({ title: 'Approve failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Approve failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(row.id); return n; });
    }
  };

  const rejectOne = async (row) => {
    setBusyIds(prev => new Set(prev).add(row.id));
    try {
      const res = await base44.functions.invoke('rejectSpecial', { staging_ids: [row.id] });
      if (res.data?.ok) {
        const id = row.id;
        setFadeIds(prev => new Set(prev).add(id));
        if (entryTab === 'vehicle') setVehicleRows(prev => prev.map(r => r.id === id ? { ...r, _rejected: true } : r));
        else setServiceRows(prev => prev.map(r => r.id === id ? { ...r, _rejected: true } : r));
        setTimeout(() => {
          setFadeIds(prev => { const n = new Set(prev); n.delete(id); return n; });
          if (entryTab === 'vehicle') setVehicleRows(prev => prev.filter(r => r.id !== id));
          else setServiceRows(prev => prev.filter(r => r.id !== id));
        }, 2000);
        refreshAfterStagingChange();
      } else {
        toast({ title: 'Reject failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Reject failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(row.id); return n; });
    }
  };

  // Wire staging rows into the row state the table components use.
  // In AI mode, we drive the table from stagingRowsForDealer via local editable copy.
  const [aiVehicleRows, setAiVehicleRows] = useState([]);
  const [aiServiceRows, setAiServiceRows] = useState([]);
  useEffect(() => {
    if (viewMode !== 'ai') return;
    const isService = (r) => (r.special_type || 'vehicle').toLowerCase() === 'service';
    setAiVehicleRows(stagingRowsForDealer.filter(r => !isService(r)));
    setAiServiceRows(stagingRowsForDealer.filter(r => isService(r)));
    setFadeIds(new Set());
    setBusyIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagingRowsForDealer, viewMode]);

  const banner = loadedDate && viewMode === 'manual'
    ? `Pre-loaded from ${loadedDate}${autoloadData?.from_previous ? ' (previous snapshot)' : ''} — review and update as needed, then Save.`
    : null;

  const handleResetOverride = async (row) => {
    if (!row?.id) return;
    try {
      await base44.functions.invoke('resetSpecialOverride', {
        store_id: store?.dealer_id,
        special_id: row.id,
      });
      queryClient.invalidateQueries(['specialsAutoload', store?.dealer_id, selectedDealer, entryTab]);
      toast({ title: 'Reset to global scraper value' });
    } catch (e) {
      toast({ title: 'Reset failed', description: e.message, variant: 'destructive' });
    }
  };

  const tableCommonProps = {
    selectedDealer,
    onSave: handleSave,
    isSaving,
    banner,
    busyIds,
    fadeIds,
    onApprove: approveOne,
    onReject: rejectOne,
    onResetOverride: handleResetOverride,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== TOP BAR ===== */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-6 pt-4 pb-2">
          {/* Row 1: controls */}
          <div className="flex items-end gap-6 flex-wrap">
            <div className="min-w-[260px] flex-1 max-w-[420px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Client Store</label>
              <select value={storeValue} onChange={e => setStoreValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                {SPECIALS_STORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Snapshot Date</label>
              <input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)}
                className="px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex-1" />
            <div className="text-xs text-gray-400 pb-2">
              {lastSavedAt && viewMode === 'manual' ? `Last saved: ${new Date(lastSavedAt).toLocaleString()}` : '\u00A0'}
            </div>
          </div>

          {/* Row 2: mode tabs (AI Review hidden per request) */}
          <div className="flex gap-1 mt-3 -mb-px">
            <button onClick={() => setViewMode('manual')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 border-blue-600 text-blue-700 bg-blue-50/50">
              <PencilLine size={15} /> Manual Entry
            </button>
          </div>
        </div>
      </div>

      {/* ===== MAIN: full width ===== */}
      <div className="max-w-[1600px] mx-auto px-6 py-5 space-y-3">
        {/* Header row: dealer dropdown + website links + tab toggle */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="min-w-[280px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Dealer</label>
              <select value={selectedDealer} onChange={e => setSelectedDealer(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                {dealerOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.isClient ? '★ ' : ''}{opt.label}{opt.isClient ? ' (Client Store)' : ' (Competitor)'}
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const comp = getCompetitorByName(store, selectedDealer);
              if (!comp) return null;
              return (
                <div className="flex items-center gap-2 pb-0.5">
                  {comp.homepage && (
                    <a href={comp.homepage} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                      Homepage <ExternalLink size={11} />
                    </a>
                  )}
                  {comp.specials_url && (
                    <a href={comp.specials_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                      Specials Page <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-white text-blue-600 shadow-sm">
              <Car size={13} /> Vehicle Specials
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 relative">
          {viewMode === 'manual' && isLoadingSpecials && !autoloadData && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
              <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}
          {viewMode === 'manual' ? (
            entryTab === 'vehicle' ? (
              <VehicleSpecialsTable rows={vehicleRows} setRows={setVehicleRows} mode="manual" {...tableCommonProps} />
            ) : (
              <ServiceSpecialsTable rows={serviceRows} setRows={setServiceRows} mode="manual" {...tableCommonProps} />
            )
          ) : (
            entryTab === 'vehicle' ? (
              <VehicleSpecialsTable rows={aiVehicleRows} setRows={setAiVehicleRows} mode="ai" {...tableCommonProps} />
            ) : (
              <ServiceSpecialsTable rows={aiServiceRows} setRows={setAiServiceRows} mode="ai" {...tableCommonProps} />
            )
          )}
        </div>
      </div>
    </div>
  );
}