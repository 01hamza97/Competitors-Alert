import React, { useMemo, useState } from 'react';
import StagingCard from './StagingCard';
import { base44 } from '@/api/base44Client';
import { Check, CheckCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Mode 1 — "Review AI Scrape". Groups pending staging rows by dealer, lets the hire
// edit fields inline and approve/reject each card, with per-group and bulk "Approve All".
export default function AIScrapeReview({ stagingData, store, dealerOptions, onAfterChange }) {
  const { toast } = useToast();
  const [busyIds, setBusyIds] = useState(new Set());
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [approvingAll, setApprovingAll] = useState(false);

  const byDealer = stagingData?.by_dealer || {};
  const rows = useMemo(() => stagingData?.rows || [], [stagingData]);
  const totalPending = useMemo(
    () => rows.filter(r => !hiddenIds.has(r.id)).reduce((acc, r) => acc + (r.status === 'pending' ? 1 : 0), 0),
    [rows, hiddenIds]
  );

  // Order dealers: client store first, then competitors in configured order.
  const dealerOrder = useMemo(() => {
    const names = new Set();
    rows.forEach(r => { const n = r.offer_dealer_name || r.client_dealer_name; if (n) names.add(n); });
    const ordered = [];
    if (store?.label && names.has(store.label)) ordered.push(store.label);
    (store?.competitors || []).forEach(c => { if (names.has(c.label)) ordered.push(c.label); });
    names.forEach(n => { if (!ordered.includes(n)) ordered.push(n); });
    return ordered;
  }, [rows, store]);

  const approveOne = async (row, edits) => {
    setBusyIds(prev => new Set(prev).add(row.id));
    try {
      const res = await base44.functions.invoke('approveSpecial', { staging_id: row.id, edits });
      if (res.data?.ok) {
        setHiddenIds(prev => new Set(prev).add(row.id));
        onAfterChange?.();
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
        setHiddenIds(prev => new Set(prev).add(row.id));
        onAfterChange?.();
      } else {
        toast({ title: 'Reject failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Reject failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(row.id); return n; });
    }
  };

  const rejectDealer = async (dealerName) => {
    const ids = (byDealer[dealerName]?.rows || []).filter(r => !hiddenIds.has(r.id)).map(r => r.id);
    if (!ids.length) return;
    try {
      const res = await base44.functions.invoke('rejectSpecial', { staging_ids: ids });
      if (res.data?.ok) {
        setHiddenIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
        onAfterChange?.();
        toast({ title: `Rejected ${res.data.rejected} specials for ${dealerName}` });
      }
    } catch (e) {
      toast({ title: 'Reject failed', description: e.message, variant: 'destructive' });
    }
  };

  // Approve All for a single dealer — send each row through approveSpecial so the live
  // insert fires per-row; the staging patch also happens per-row.
  const approveAllForDealer = async (dealerName) => {
    const pending = (byDealer[dealerName]?.rows || []).filter(r => !hiddenIds.has(r.id));
    if (!pending.length) return;
    setApprovingAll(true);
    let ok = 0;
    for (const row of pending) {
      try {
        const res = await base44.functions.invoke('approveSpecial', { staging_id: row.id });
        if (res.data?.ok) { ok++; setHiddenIds(prev => new Set(prev).add(row.id)); }
      } catch (e) { /* continue */ }
    }
    onAfterChange?.();
    setApprovingAll(false);
    toast({ title: `Approved ${ok} of ${pending.length} for ${dealerName}` });
  };

  // Approve All Pending across every dealer.
  const approveAllPending = async () => {
    const allPending = rows.filter(r => !hiddenIds.has(r.id));
    if (!allPending.length) return;
    setApprovingAll(true);
    let ok = 0;
    for (const row of allPending) {
      try {
        const res = await base44.functions.invoke('approveSpecial', { staging_id: row.id });
        if (res.data?.ok) { ok++; setHiddenIds(prev => new Set(prev).add(row.id)); }
      } catch (e) { /* continue */ }
    }
    onAfterChange?.();
    setApprovingAll(false);
    toast({ title: `Approved ${ok} of ${allPending.length} specials` });
  };

  if (!rows.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <p className="text-gray-400 text-sm">No pending AI-scraped specials for this date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Approve All Pending — sticky at bottom */}
      <div className="space-y-3">
        {dealerOrder.map(dealerName => {
          const group = byDealer[dealerName] || { rows: [], count: 0 };
          const visibleRows = group.rows.filter(r => !hiddenIds.has(r.id));
          if (!visibleRows.length) return null;
          return (
            <div key={dealerName} className="space-y-2">
              {/* Group header */}
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-800">{dealerName}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {visibleRows.length} pending
                </span>
                <div className="flex-1" />
                <button onClick={() => approveAllForDealer(dealerName)} disabled={approvingAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50">
                  <Check size={13} /> Approve All {visibleRows.length} for {dealerName}
                </button>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleRows.map(row => (
                  <StagingCard
                    key={row.id}
                    row={row}
                    onApprove={approveOne}
                    onReject={rejectOne}
                    isBusy={busyIds.has(row.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk action button */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <button onClick={approveAllPending} disabled={approvingAll || !totalPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-lg">
          <CheckCheck size={16} /> {approvingAll ? 'Approving...' : `Approve All Pending (${totalPending})`}
        </button>
      </div>
    </div>
  );
}