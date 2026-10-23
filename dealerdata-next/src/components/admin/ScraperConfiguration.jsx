import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronRight, Building2, Settings, Play, Plus, Power, Tag, Layers, RefreshCw } from 'lucide-react';
import ScraperStoreConfig from './ScraperStoreConfig.jsx';
import ScraperCompetitorConfig from './ScraperCompetitorConfig.jsx';
import ScraperHealthDashboard from './ScraperHealthDashboard';
import AddStoreModal from './AddStoreModal.jsx';
import AddCompetitorModal from './AddCompetitorModal.jsx';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function CompetitorScraperRow({ competitor }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningSpecials, setRunningSpecials] = useState(false);
  const queryClient = useQueryClient();

  async function toggleActive(e) {
    e.stopPropagation();
    await base44.entities.StoreCompetitor.update(competitor.id, { scraper_active: !competitor.scraper_active });
    queryClient.invalidateQueries({ queryKey: ['storeCompetitors', competitor.store_id] });
    toast.success(competitor.scraper_active ? 'Competitor scraper deactivated' : 'Competitor scraper activated');
  }

  const runScrape = async (e, specialsOnly = false) => {
    e.stopPropagation();
    if (specialsOnly) setRunningSpecials(true);
    else setRunning(true);
    try {
      const res = await base44.functions.invoke('triggerScraper', {
        scope: 'competitor',
        competitor_id: competitor.id,
        specials_only: specialsOnly,
        source: 'ui_button',
        clicked_at: new Date().toISOString(),
      });
      const d = res.data;
      if (d?.ok) {
        toast.success(
          specialsOnly
            ? `⚡ Specials-only crawl triggered for ${d.store_name || competitor.name}`
            : `Scraper triggered for ${d.store_name || competitor.name}`
        );
      } else {
        toast.error(d?.error || 'Failed to trigger competitor scraper');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to trigger scraper');
    } finally {
      setRunning(false);
      setRunningSpecials(false);
    }
  };

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
        <button className="flex items-center gap-2 flex-1 text-left min-w-0" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
          <span className="text-sm text-gray-700 flex-1 truncate">{competitor.name}</span>
          {competitor.competitor_id && (
            <span className="text-xs font-mono text-gray-400 shrink-0 mr-1">{competitor.competitor_id}</span>
          )}
          {competitor.scraper_platform && (
            <span className="text-xs font-mono text-blue-500 bg-blue-50 px-2 py-0.5 rounded shrink-0">{competitor.scraper_platform}</span>
          )}
        </button>

        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2 gap-1 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 border-amber-200 shrink-0 font-medium"
          onClick={(e) => runScrape(e, true)}
          disabled={running || runningSpecials}
          title="Fetch only specials and offers for this competitor (~5s)"
        >
          {runningSpecials ? <RefreshCw size={9} className="animate-spin text-amber-600" /> : <Tag size={9} />}
          {runningSpecials ? 'Fetching…' : 'Specials Only'}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2 gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 border-blue-200 shrink-0 font-medium"
          onClick={(e) => runScrape(e, false)}
          disabled={running || runningSpecials}
          title="Complete scrape for this competitor"
        >
          {running ? <RefreshCw size={9} className="animate-spin text-blue-600" /> : <Play size={9} />}
          {running ? 'Running…' : 'Scrape'}
        </Button>

        <button
          onClick={toggleActive}
          title={competitor.scraper_active ? 'Deactivate scraper' : 'Activate scraper'}
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            competitor.scraper_active
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <Power size={11} />
          {competitor.scraper_active ? 'On' : 'Off'}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4">
          <ScraperCompetitorConfig competitor={competitor} />
        </div>
      )}
    </div>
  );
}

function StoreScraperRow({ store, groups }) {
  const [open, setOpen] = useState(false);
  const [runningMode, setRunningMode] = useState(null); // 'specials' | 'single' | 'all' | null
  const [addingComp, setAddingComp] = useState(false);
  const queryClient = useQueryClient();

  const { data: competitors = [] } = useQuery({
    queryKey: ['storeCompetitors', store.id],
    enabled: !!store.id,
    queryFn: () => base44.entities.StoreCompetitor.filter({ store_id: store.id }, 'sort_order', 50),
  });

  const runScraper = async (e, { specialsOnly = false, includeCompetitors = false } = {}) => {
    e.stopPropagation();
    if (!store.scraper_store_id) {
      toast.error('Store has no Scraper Store ID set');
      return;
    }
    const modeKey = specialsOnly ? 'specials' : (includeCompetitors ? 'all' : 'single');
    setRunningMode(modeKey);
    try {
      const res = await base44.functions.invoke('triggerScraper', {
        scope: 'store',
        store_id: store.scraper_store_id,
        specials_only: specialsOnly,
        include_competitors: includeCompetitors,
        source: 'ui_button',
        clicked_at: new Date().toISOString(),
      });
      const d = res.data;
      if (d?.ok) {
        if (specialsOnly) {
          toast.success(`⚡ Specials-only crawl triggered for ${d.store_name || store.name}`);
        } else if (includeCompetitors) {
          toast.success(`Full scrape queued for ${d.store_name || store.name} (+${d.competitor_count || 0} competitors)`);
        } else {
          toast.success(`Individual scrape queued for ${d.store_name || store.name} (competitors skipped)`);
        }
      } else {
        toast.error(d?.error || 'Failed to trigger scraper');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to trigger scraper');
    } finally {
      setRunningMode(null);
    }
  };

  async function toggleActive(e) {
    e.stopPropagation();
    await base44.entities.Store.update(store.id, { scraper_active: !store.scraper_active });
    queryClient.invalidateQueries({ queryKey: ['stores'] });
    queryClient.invalidateQueries({ queryKey: ['allStores'] });
    toast.success(store.scraper_active ? 'Store scraper deactivated' : 'Store scraper activated');
  }

  const isBusy = Boolean(runningMode);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-5 py-4 bg-white border-b border-gray-100 flex-wrap sm:flex-nowrap">
        <button
          className="flex items-center gap-3 text-left flex-1 min-w-0"
          onClick={() => setOpen(o => !o)}
        >
          {open ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
          <Building2 size={14} className="text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-800 text-sm flex-1 truncate">{store.name}</span>
          {store.scraper_platform && (
            <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded shrink-0">{store.scraper_platform}</span>
          )}
          {store.scraper_store_id && (
            <span className="text-xs font-mono text-gray-400 shrink-0">{store.scraper_store_id}</span>
          )}
        </button>

        <button
          onClick={toggleActive}
          title={store.scraper_active ? 'Deactivate scraper' : 'Activate scraper'}
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            store.scraper_active
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <Power size={11} />
          {store.scraper_active ? 'On' : 'Off'}
        </button>

        {/* 1. Specials Only */}
        <Button
          size="sm" variant="outline"
          className="gap-1 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 border-amber-200 shrink-0 text-xs font-medium h-7"
          onClick={(e) => runScraper(e, { specialsOnly: true, includeCompetitors: false })}
          disabled={isBusy}
          title="Fast crawl: fetch only specials and offers for this store (~5-10s)"
        >
          {runningMode === 'specials' ? <RefreshCw size={11} className="animate-spin text-amber-600" /> : <Tag size={11} />}
          {runningMode === 'specials' ? 'Fetching…' : 'Specials Only'}
        </Button>

        {/* 2. Store Only */}
        <Button
          size="sm" variant="outline"
          className="gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 border-blue-200 shrink-0 text-xs font-medium h-7"
          onClick={(e) => runScraper(e, { specialsOnly: false, includeCompetitors: false })}
          disabled={isBusy}
          title="Complete scrape for this individual store only (skips competitors)"
        >
          {runningMode === 'single' ? <RefreshCw size={11} className="animate-spin text-blue-600" /> : <Play size={11} />}
          {runningMode === 'single' ? 'Scraping Store…' : 'Scrape Store'}
        </Button>

        {/* 3. All (+Competitors) */}
        <Button
          size="sm" variant="outline"
          className="gap-1 text-gray-700 hover:bg-gray-100 border-gray-200 shrink-0 text-xs font-medium h-7"
          onClick={(e) => runScraper(e, { specialsOnly: false, includeCompetitors: true })}
          disabled={isBusy}
          title="Scrape this store and cascade to all its active competitors"
        >
          {runningMode === 'all' ? <RefreshCw size={11} className="animate-spin text-gray-600" /> : <Layers size={11} />}
          {runningMode === 'all' ? 'Queuing All…' : 'All (+Comps)'}
        </Button>
      </div>

      {open && (
        <div className="p-5 space-y-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Store Scraper Settings</p>
            <ScraperStoreConfig store={store} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Competitors ({competitors.length})
              </p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddingComp(true)}>
                <Plus size={12} /> Add Competitor
              </Button>
            </div>
            {competitors.length > 0 ? (
              <div className="space-y-2">
                {competitors.map(c => (
                  <CompetitorScraperRow key={c.id} competitor={c} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No competitors yet. Click "Add Competitor" to add one.</p>
            )}
          </div>
        </div>
      )}

      {addingComp && (
        <AddCompetitorModal store={store} onClose={() => setAddingComp(false)} />
      )}
    </div>
  );
}

export default function ScraperConfiguration({ groups, stores }) {
  const [view, setView] = useState('config');
  const [addingStore, setAddingStore] = useState(false);

  const groupId = groups?.[0]?.id || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Scraper Configuration</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage scraper settings for each store and competitor. GitHub reads these fields directly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setView('config')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${view === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Settings size={12} /> Configuration
            </button>
            <button
              onClick={() => setView('health')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'health' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Health Dashboard
            </button>
          </div>
          {view === 'config' && (
            <Button size="sm" className="gap-1.5" onClick={() => setAddingStore(true)}>
              <Plus size={13} /> Add Store
            </Button>
          )}
        </div>
      </div>

      {view === 'config' && (
        <div className="space-y-3">
          {stores.length === 0 ? (
            <p className="text-gray-400 text-sm">No stores configured yet. Click "Add Store" to get started.</p>
          ) : (
            stores.map(store => <StoreScraperRow key={store.id} store={store} groups={groups} />)
          )}
        </div>
      )}

      {view === 'health' && (
        <ScraperHealthDashboard stores={stores} groupId={groupId} />
      )}

      {addingStore && (
        <AddStoreModal groups={groups} onClose={() => setAddingStore(false)} />
      )}
    </div>
  );
}