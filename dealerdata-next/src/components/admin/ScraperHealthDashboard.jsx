import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RefreshCw, Play, Building2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ScraperHealthDashboard({ stores, groupId }) {
  const qc = useQueryClient();
  const [triggering, setTriggering] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: healthGroups = [], isLoading, refetch } = useQuery({
    queryKey: ['scraperInventoryHealth', stores.map(s => s.id).join(',')],
    enabled: stores.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const scraperStores = stores.filter(s => s.scraper_active || s.scraper_store_id);
      if (scraperStores.length === 0) return [];

      const payload = {
        stores: scraperStores.map(s => ({
          id: s.id,
          name: s.name,
          dealership_key: s.dealership_key || null,
          scraper_store_id: s.scraper_store_id || null,
        })),
      };
      const res = await base44.functions.invoke('scraperInventoryHealth', payload);
      return res.data?.health || [];
    },
  });

  const refresh = async () => {
    setRefreshing(true);
    await refetch();
    qc.invalidateQueries({ queryKey: ['stores'] });
    toast.success('Status refreshed');
    setRefreshing(false);
  };

  const handleTriggerResponse = (res, label) => {
    const d = res.data;
    if (d?.ok) {
      toast.success(`${label} triggered — Run ID: ${d.run_id || '?'}`);
      setTimeout(() => refetch(), 2000);
      return true;
    }
    const errMsg = d?.detail
      ? `GitHub ${d.github_status}: ${d.detail}`
      : (d?.error || `Failed to trigger ${label}`);
    toast.error(errMsg);
    return false;
  };

  const runGroup = async () => {
    if (!groupId) {
      toast.error('No group ID available for this dealer group');
      return;
    }
    setTriggering('group');
    try {
      const res = await base44.functions.invoke('triggerScraper', { scope: 'group', group_id: groupId, source: 'ui_button', clicked_at: new Date().toISOString() });
      handleTriggerResponse(res, 'Group scraper');
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error || err.message;
      toast.error(`Trigger failed: ${detail}`);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh Status
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={runGroup} disabled={triggering === 'group'}>
          <Play size={12} />
          {triggering === 'group' ? 'Triggering…' : 'Run Group Scraper'}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading inventory counts…</p>
      ) : healthGroups.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">No stores with scraper configuration found.</p>
          <p className="text-gray-300 text-xs mt-1">Set a Scraper Store ID and activate scraping on the store to see inventory counts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {healthGroups.map((g) => {
            return (
              <div key={g.store_id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                {/* Store header row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <Building2 size={14} className="text-gray-400 shrink-0" />
                  <span className="font-semibold text-gray-800 text-sm flex-1 truncate">{g.store_name}</span>
                </div>

                {/* Inventory counts per dealership */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[45%]" />
                      <col className="w-[15%]" />
                      <col className="w-[15%]" />
                      <col className="w-[25%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100 bg-white">
                        <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Dealership</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">New</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Used</th>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Snapshot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.dealerships.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-gray-300 text-xs italic">No dealerships configured for this store.</td>
                        </tr>
                      ) : (
                        g.dealerships.map((d, idx) => {
                          const hasData = d.snapshot_date != null;
                          return (
                            <tr key={`${g.store_id}-${idx}`} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/40">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {d.source === 'client' && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold uppercase tracking-wide">Client</span>
                                  )}
                                  <span className={`text-sm ${d.source === 'client' ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>{d.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-800">
                                {d.new_count != null
                                  ? d.new_count.toLocaleString()
                                  : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-800">
                                {d.used_count != null
                                  ? d.used_count.toLocaleString()
                                  : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                {hasData ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                    <CheckCircle size={11} /> {d.snapshot_date}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300">No data</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Counts reflect the latest successful scrape snapshot in Supabase for each dealership's New and Used inventory. Client stores are matched by Scraper Store ID (or name fallback); competitors by their Competitor ID (or name fallback).
      </p>
    </div>
  );
}